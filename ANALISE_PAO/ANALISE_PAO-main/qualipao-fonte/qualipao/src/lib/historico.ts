import type { AnaliseResultado, CriterioNome } from "@/lib/analise.functions";

export const LOJAS = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "35",
  "37",
  "39",
  "40",
  "41",
  "42",
  "43",
  "44",
  "45",
  "46",
  "51",
];

export type Auditoria = {
  id: string;
  loja: string;
  produto: string;
  totalFotos: number;
  data: string;
  resultado: AnaliseResultado;
};

const CHAVE = "qualipao.historico.v1";

export function carregarHistorico(): Auditoria[] {
  if (typeof window === "undefined") return [];
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    const lista = bruto ? (JSON.parse(bruto) as Auditoria[]) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export function salvarAuditoria(a: Auditoria): Auditoria[] {
  const lista = [a, ...carregarHistorico()].slice(0, 200);
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch {
    /* armazenamento indisponível */
  }
  return lista;
}

export function limparHistorico(): Auditoria[] {
  try {
    window.localStorage.removeItem(CHAVE);
  } catch {
    /* ignorado */
  }
  return [];
}

export type ResumoLoja = {
  loja: string;
  auditorias: number;
  media: number;
  ultima: string;
  status: string;
  medias: Record<CriterioNome, number>;
};

const CHAVES: CriterioNome[] = [
  "uniformidade",
  "cor",
  "volume",
  "organizacao",
  "recemForneado",
  "defeitos",
];

export function resumoPorLoja(historico: Auditoria[]): ResumoLoja[] {
  const grupos = new Map<string, Auditoria[]>();
  historico.forEach((a) => {
    grupos.set(a.loja, [...(grupos.get(a.loja) ?? []), a]);
  });

  return Array.from(grupos.entries())
    .map(([loja, itens]) => {
      const media = itens.reduce((s, i) => s + i.resultado.nota, 0) / itens.length;
      const medias = {} as Record<CriterioNome, number>;
      CHAVES.forEach((c) => {
        medias[c] =
          itens.reduce((s, i) => s + (i.resultado.criterios[c]?.pontuacao ?? 0), 0) / itens.length;
      });
      const ordenadas = [...itens].sort((a, b) => (a.data < b.data ? 1 : -1));
      const nota = Math.round(media * 10) / 10;
      return {
        loja,
        auditorias: itens.length,
        media: nota,
        ultima: ordenadas[0]!.data,
        status: nota >= 8 ? "Dentro do padrão" : nota >= 6 ? "Atenção" : "Fora do padrão",
        medias,
      };
    })
    .sort((a, b) => b.media - a.media);
}
