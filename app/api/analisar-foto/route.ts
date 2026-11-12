// Rota de API que recebe a foto de um prato/alimento e usa a API da Anthropic
// (Claude com visão) para estimar os itens e os macros (kcal, proteína,
// carboidrato, gordura). O front-end (public/app.html) chama essa rota,
// mostra os itens pro usuário revisar/ajustar e só então adiciona ao diário.
//
// Requer a variável de ambiente ANTHROPIC_API_KEY configurada no projeto
// Vercel (Settings → Environment Variables). Gere uma chave em
// https://console.anthropic.com — o uso dessa chave é cobrado separadamente
// da assinatura do Claude.ai, conforme o preço por token do modelo.

export const runtime = 'nodejs';
export const maxDuration = 30;

const PROMPT = `Você é um nutricionista analisando uma foto de uma refeição ou alimento.
Identifique cada alimento visível e estime, para a porção mostrada na foto:
- nome do alimento (em português, simples e direto)
- quantidade estimada em gramas (ou ml para líquidos)
- calorias (kcal)
- proteína (g)
- carboidrato (g)
- gordura (g)

Use referências visuais comuns para estimar porção (prato raso ~26cm de diâmetro, colher de sopa ~15ml, punho fechado ~1 xícara, etc).

Responda APENAS com um JSON válido, sem nenhum texto antes ou depois e sem marcação de código, exatamente neste formato:
{"itens":[{"nome":"string","quantidade_g":number,"kcal":number,"proteina_g":number,"carboidrato_g":number,"gordura_g":number}],"observacao":"string curta, opcional, sobre a confiança da estimativa"}

Se não conseguir identificar nenhum alimento com confiança razoável, responda com "itens": [] e explique o motivo em "observacao".`;

export async function POST(req: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: 'Análise por foto ainda não configurada: falta a chave ANTHROPIC_API_KEY no servidor.' },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    const imageBase64: string | undefined = body?.imageBase64;
    const mediaType: string = body?.mediaType || 'image/jpeg';
    if (!imageBase64) {
      return Response.json({ error: 'Imagem não enviada.' }, { status: 400 });
    }

    const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      }),
    });

    if (!anthropicResp.ok) {
      const errText = await anthropicResp.text().catch(() => '');
      return Response.json(
        { error: `Erro ao chamar a análise de imagem (${anthropicResp.status}).`, detail: errText.slice(0, 500) },
        { status: 502 }
      );
    }

    const data = await anthropicResp.json();
    const textBlock = Array.isArray(data?.content)
      ? data.content.find((c: any) => c.type === 'text')
      : null;
    const rawText: string = textBlock?.text || '';

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
