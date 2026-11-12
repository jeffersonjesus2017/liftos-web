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
export const maxDuration = 30;

const MODEL = 'gemini-2.5-flash';

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

export async function POST(req: Request) {
  try {
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
    if (!imageBase64) {
      return Response.json({ error: 'Imagem não enviada.' }, { status: 400 });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
    const geminiResp = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
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
      }),
    });

    if (!geminiResp.ok) {
      const errText = await geminiResp.text().catch(() => '');
      // 429 = estourou o limite gratuito diário/por minuto do Gemini
      const msg =
        geminiResp.status === 429
          ? 'Limite gratuito de análises por foto atingido por agora. Tente novamente em alguns minutos.'
          : `Erro ao chamar a análise de imagem (${geminiResp.status}).`;
      return Response.json({ error: msg, detail: errText.slice(0, 500) }, { status: 502 });
    }

    const data = await geminiResp.json();

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
    return Response.json({ error: e?.message || 'Erro inesperado ao analisar a foto.' }, { status: 500 });
  }
}
