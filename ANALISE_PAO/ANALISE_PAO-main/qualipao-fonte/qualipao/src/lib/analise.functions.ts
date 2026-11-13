import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  imagens: z.array(z.string().min(20)).min(2, "Envie no mínimo 2 fotos do produto.").max(6),
  produto: z.string().min(1),
});

export type CriterioNome =
  | "uniformidade"
  | "cor"
  | "volume"
  | "organizacao"
  | "recemForneado"
  | "defeitos";

export type Criterio = {
  pontuacao: number;
  maximo: number;
  justificativa: string;
};

export type AnaliseResultado = {
  nota: number;
  status: string;
  criterios: Record<CriterioNome, Criterio>;
  naoConformidades: string[];
  pontosPositivos: string[];
  diagnostico: string;
  recomendacoes: string[];
  naoAvaliavel: string[];
};

export const analisarProduto = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<AnaliseResultado> => {
    const { auditarImagens } = await import("@/lib/analise.server");
    return auditarImagens(data.imagens, data.produto);
  });
