// Rota de API que recebe a foto de um prato/alimento e usa a API do Google
// Gemini (visão) para estimar os itens e os macros (kcal, proteína,
// carboidrato, gordura). O front-end (public/app.html) chama essa rota,
// mostra os itens pro usuário revisar/ajustar e só então adiciona ao diário.
//
// Requer a variável de ambiente GEMINI_API_KEY configurada no projeto
// Vercel (Settings → Environment Variables). Gere uma chave grátis (sem
// cartão de crédito) em https://aistudio.google.com/apikey — a camada
// gratuita do Gemini tem limite de requisições por dia, mas de sobra pro
// uso pessoal de registrar refeições.

export const runtime = 'nodejs';
export const maxDuration = 60;

// Modelo principal + fallback para quando o principal estiver sobrecarregado
// gemini-3.5-flash-lite primeiro (mais rápido e estável); gemini-3.6-flash como fallback
const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.6-flash'];

const PROMPT = `Você é um nutricionista analisando uma foto de uma refeição ou alimento.
Identifique cada alimento visível e estime, para a porção mostrada na foto:
- nome do alimento (em português, simples e direto)
- quantidade estimada em gramas (ou ml para líquidos)
- calorias (kcal)
- proteína (g)
- carboidrato (g)
- gordura (g)

Use referências visuais comuns para estimar porção (prato raso ~26cm de diâmetro, colher de sopa ~15ml, punho fechado ~1 xícara, etc).

Se não conseguir identificar nenhum alimento com confiança razoável, retorne "itens" vazio e explique o motivo em "observacao".`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    itens: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          nome: { type: 'STRING' },
          quantidade_g: { type: 'NUMBER' },
          kcal: { type: 'NUMBER' },
          proteina_g: { type: 'NUMBER' },
          carboidrato_g: { type: 'NUMBER' },
          gordura_g: { type: 'NUMBER' },
        },
        required: ['nome', 'quantidade_g', 'kcal', 'proteina_g', 'carboidrato_g', 'gordura_g'],
      },
    },
    observacao: { type: 'STRING' },
  },
  required: ['itens'],
};

// --- proteção da rota: só usuários logados, com cota diária e limites de entrada ---
// A URL e a chave "publishable" do Supabase são públicas por desenho (a segurança vem do RLS);
// podem ser sobrescritas por variáveis de ambiente no Vercel.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xmxdxevrnvmczzlkxqxy.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_CxKPsJr-My_yqWL0S5gQLQ_ixZhPpDj';
const MAX_FOTOS_POR_DIA = 40;
const MAX_BASE64_CHARS = 6_000_000; // ~4,5 MB de imagem; o app já comprime antes de enviar
const MEDIA_TYPES_OK = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

async function usuarioValido(token: string): Promise<boolean> {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8_000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

// consome 1 unidade da cota diária do usuário (função SQL security definer; usa o token dele)
async function consumirCota(token: string): Promise<boolean> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_foto_quota`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ max_per_day: MAX_FOTOS_POR_DIA }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!r.ok) return false;
    return (await r.json()) === true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token || !(await usuarioValido(token))) {
      return Response.json({ error: 'Faça login para analisar fotos.' }, { status: 401 });
    }
    const tamanho = Number(req.headers.get('content-length') || 0);
    if (tamanho > MAX_BASE64_CHARS + 2_000) {
      return Response.json({ error: 'Imagem grande demais.' }, { status: 413 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: 'Análise por foto ainda não configurada: falta a chave GEMINI_API_KEY no servidor.' },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    const imageBase64: string | undefined = body?.imageBase64;
    const mediaType: string = body?.mediaType || 'image/jpeg';
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return Response.json({ error: 'Imagem não enviada.' }, { status: 400 });
    }
    if (imageBase64.length > MAX_BASE64_CHARS) {
      return Response.json({ error: 'Imagem grande demais.' }, { status: 413 });
    }
    if (!MEDIA_TYPES_OK.has(mediaType)) {
      return Response.json({ error: 'Formato de imagem não suportado.' }, { status: 400 });
    }
    if (!(await consumirCota(token))) {
      return Response.json(
        { error: `Limite diário de ${MAX_FOTOS_POR_DIA} análises por foto atingido. Tente amanhã.` },
        { status: 429 }
      );
    }

    const requestBody = JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: mediaType, data: imageBase64 } },
            { text: PROMPT },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    // Tenta cada modelo na ordem; se o primeiro der 503 (overload), tenta o próximo.
    // Timeout de 25s por tentativa pra caber dentro do maxDuration de 60s.
    let geminiResp: Response | null = null;
    let usedModel = '';
    for (const model of MODELS) {
      usedModel = model;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25_000);
      try {
        geminiResp = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: requestBody,
          signal: controller.signal,
        });
      } catch (fetchErr: any) {
        clearTimeout(timer);
        // Timeout ou erro de rede — trata como 503 pra tentar o próximo
        if (model !== MODELS[MODELS.length - 1]) continue;
        return Response.json(
          { error: 'A análise demorou demais. Tente novamente em instantes.' },
          { status: 504 }
        );
      }
      clearTimeout(timer);

      // Se deu certo ou erro diferente de 503/429, para aqui
      if (geminiResp.ok || (geminiResp.status !== 503 && geminiResp.status !== 429)) break;

      // Se é o último modelo, para também (vai cair no tratamento de erro abaixo)
      if (model === MODELS[MODELS.length - 1]) break;

      // Senão, tenta o próximo modelo
    }

    if (!geminiResp!.ok) {
      const errText = await geminiResp!.text().catch(() => '');
      const status = geminiResp!.status;
      const msg =
        status === 429
          ? 'Limite gratuito de análises por foto atingido por agora. Tente novamente em alguns minutos.'
          : status === 503
          ? 'O serviço de análise está temporariamente sobrecarregado. Tente novamente em 1-2 minutos.'
          : `Erro ao chamar a análise de imagem (${status}).`;
      console.error('[analisar-foto] Gemini', status, errText.slice(0, 500)); // detalhe fica só no log do servidor
      return Response.json({ error: msg }, { status: 502 });
    }

    const data = await geminiResp!.json();

    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) {
      return Response.json(
        { error: 'A foto não pôde ser analisada (conteúdo bloqueado pelo filtro de segurança).' },
        { status: 502 }
      );
    }

    const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) {
      return Response.json({ error: 'Não consegui interpretar a resposta da análise.' }, { status: 502 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return Response.json({ error: 'A resposta da análise veio em um formato inesperado.' }, { status: 502 });
    }

    if (!Array.isArray(parsed.itens)) parsed.itens = [];

    return Response.json(parsed);
  } catch (e: any) {
    console.error('[analisar-foto]', e?.message || e);
    return Response.json({ error: 'Erro inesperado ao analisar a foto.' }, { status: 500 });
  }
}
