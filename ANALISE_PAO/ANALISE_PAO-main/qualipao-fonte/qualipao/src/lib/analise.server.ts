import type { AnaliseResultado, Criterio, CriterioNome } from "@/lib/analise.functions";

const PESOS: Record<CriterioNome, number> = {
  uniformidade: 2,
  cor: 2,
  volume: 2,
  organizacao: 1,
  recemForneado: 1.5,
  defeitos: 1.5,
};

const PROMPT = `Assuma o papel de um Auditor de Qualidade em Panificação Industrial, com mais de 20 anos de experiência em avaliação de pães em ambiente de varejo.
Você recebe uma imagem contendo pães expostos em uma gôndola de padaria ou em uma tela. Realize uma auditoria visual completa, atribuindo pontuação padronizada de 0 a 10.

🔎 CRITÉRIOS DE AVALIAÇÃO (com pesos)
TODOS os critérios pontuam no MESMO sentido: nota ALTA = situação BOA. Nunca pontue "quantidade de problemas".
- Uniformidade (0 a 2,0): 2,0 quando tamanho, formato e acabamento são consistentes entre as peças.
- Cor e aspecto de forneamento (0 a 2,0): 2,0 quando a coloração é adequada e homogênea (nem pálido, nem queimado).
- Volume e desenvolvimento (0 a 2,0): 2,0 quando há bom crescimento e estrutura.
- Organização e exposição (0 a 1,0): 1,0 quando a gôndola está alinhada, abastecida e bem apresentada.
- Aparência de recém forneado (0 a 1,5): 1,5 quando há sinais claros de produto recente (brilho, casca viva, sem murchamento).
- Ausência de defeitos (0 a 1,5): 1,5 quando NÃO há defeitos visíveis. Reduza apenas por deformações, murchamento, quebras, inconsistências evidentes ou ausência/pouca pestana. NÃO penalize craqueamento — craqueamento é atributo positivo.

Atributos fortes esperados no produto: abertura de pestana, volume, craqueamento, brilho.

⚠️ REGRAS
- Seja técnico e objetivo (linguagem de auditoria).
- Não invente informações que não podem ser observadas visualmente.
- Não penalize limitações da foto (ângulo, luz, foco, distância): o que não for avaliável vai em "naoAvaliavel" e o critério recebe a nota do que É visível, sem desconto por dúvida.
- Use padrão de análise comparável entre diferentes imagens: aplique SEMPRE a mesma régua e as mesmas faixas de pontuação. Para a mesma imagem, a mesma nota deve ser reproduzida.
- Ancoragem por critério (fração do peso), em incrementos de 0,25: 100% padrão de referência; 90% muito bom, apenas detalhes menores; 80% bom, dentro do padrão comercial; 65% aceitável com ressalvas; 50% deficiente; 25% ruim; 0% inaceitável.
- Calibração: um lote comercialmente correto, sem desvios relevantes, deve fechar entre 8,5 e 9,5. Reserve notas abaixo de 7,0 para desvios realmente visíveis e descritos nas não conformidades. Só reduza um critério se conseguir citar na justificativa o que exatamente foi observado.
- Contexto: padaria de varejo, padronização entre lojas, uso para benchmarking.
- Se a imagem NÃO contiver produto de panificação, zere todos os critérios, use status "Imagem inválida" e explique no diagnóstico.

📊 SAÍDA
Responda SOMENTE com JSON válido, sem markdown, no formato exato:
{"criterios":{"uniformidade":{"pontuacao":number,"justificativa":string},"cor":{"pontuacao":number,"justificativa":string},"volume":{"pontuacao":number,"justificativa":string},"organizacao":{"pontuacao":number,"justificativa":string},"recemForneado":{"pontuacao":number,"justificativa":string},"defeitos":{"pontuacao":number,"justificativa":string}},"status":string,"naoConformidades":string[],"pontosPositivos":string[],"diagnostico":string,"recomendacoes":string[],"naoAvaliavel":string[]}
Onde "status" é curto: "Dentro do padrão" (>=8), "Atenção" (6 a 7,9) ou "Fora do padrão" (<6).
"diagnostico": causas prováveis na produção ou exposição (2 a 4 frases, português).`;

function clamp(v: unknown, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(0, Math.round(n * 4) / 4));
}

function strArr(v: unknown, max: number): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, max) : [];
}

export function extrairJson(texto: string): AnaliseResultado {
  const limpo = texto.replace(/```json/gi, "").replace(/```/g, "").trim();
  const inicio = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  const bruto = inicio >= 0 && fim > inicio ? limpo.slice(inicio, fim + 1) : limpo;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dados: any = JSON.parse(bruto);

  const criterios = {} as Record<CriterioNome, Criterio>;
  let total = 0;
  (Object.keys(PESOS) as CriterioNome[]).forEach((chave) => {
    const maximo = PESOS[chave];
    const bruta = dados?.criterios?.[chave] ?? {};
    const pontuacao = clamp(bruta.pontuacao, maximo);
    total += pontuacao;
    criterios[chave] = {
      pontuacao,
      maximo,
      justificativa: typeof bruta.justificativa === "string" ? bruta.justificativa : "—",
    };
  });

  const nota = Math.round(total * 10) / 10;
  const statusIA = typeof dados.status === "string" ? dados.status : "";
  const status =
    statusIA === "Imagem inválida"
      ? statusIA
      : nota >= 8
        ? "Dentro do padrão"
        : nota >= 6
          ? "Atenção"
          : "Fora do padrão";

  return {
    nota,
    status,
    criterios,
    naoConformidades: strArr(dados.naoConformidades, 6),
    pontosPositivos: strArr(dados.pontosPositivos, 6),
    diagnostico: typeof dados.diagnostico === "string" ? dados.diagnostico : "",
    recomendacoes: strArr(dados.recomendacoes, 5),
    naoAvaliavel: strArr(dados.naoAvaliavel, 5),
  };
}

/** Chama a IA de auditoria com as imagens (data URLs) e devolve o resultado consolidado. */
export async function auditarImagens(
  imagens: string[],
  produto: string,
): Promise<AnaliseResultado> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("IA não configurada (LOVABLE_API_KEY ausente).");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "google/gemini-3.7-flash",
      temperature: 0,
      top_p: 1,
      seed: 42,
      messages: [
        { role: "system", content: PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Produto declarado: ${produto}. São fornecidas ${imagens.length} imagens do MESMO produto/gôndola, em ângulos diferentes. Considere TODAS as imagens em conjunto e emita uma única auditoria consolidada.`,
            },
            ...imagens.map((url) => ({ type: "image_url" as const, image_url: { url } })),
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const corpo = await res.text();
    if (res.status === 429) throw new Error("Muitas análises seguidas. Aguarde alguns segundos.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados no workspace Lovable.");
    throw new Error(`Falha na análise (${res.status}): ${corpo.slice(0, 200)}`);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const texto = json.choices?.[0]?.message?.content ?? "";
  if (!texto) throw new Error("A IA não retornou resultado.");
  return extrairJson(texto);
}
