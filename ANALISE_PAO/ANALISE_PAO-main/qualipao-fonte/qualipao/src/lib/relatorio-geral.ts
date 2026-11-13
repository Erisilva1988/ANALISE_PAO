import { CRITERIO_LABEL } from "@/lib/relatorio";
import { resumoPorLoja, type Auditoria } from "@/lib/historico";
import type { CriterioNome } from "@/lib/analise.functions";
import { baixarBlob } from "@/lib/download";

const ORDEM = Object.keys(CRITERIO_LABEL) as CriterioNome[];
const fmt = (n: number) => n.toFixed(2).replace(".", ",").replace(/,00$/, ",0");
const dataBr = (iso: string) => new Date(iso).toLocaleString("pt-BR");

export type RelatorioGeralJson = {
  schema: "qualipao.levantamento-geral/v1";
  geradoEm: string;
  totalAuditorias: number;
  totalLojas: number;
  mediaGeral: number;
  lojas: ReturnType<typeof resumoPorLoja>;
  auditorias: Array<{
    id: string;
    loja: string;
    produto: string;
    data: string;
    nota: number;
    status: string;
  }>;
};

export function montarJsonGeral(historico: Auditoria[]): RelatorioGeralJson {
  const lojas = resumoPorLoja(historico);
  const mediaGeral =
    historico.length > 0
      ? Math.round((historico.reduce((s, a) => s + a.resultado.nota, 0) / historico.length) * 10) /
        10
      : 0;
  return {
    schema: "qualipao.levantamento-geral/v1",
    geradoEm: new Date().toISOString(),
    totalAuditorias: historico.length,
    totalLojas: lojas.length,
    mediaGeral,
    lojas,
    auditorias: historico.map((a) => ({
      id: a.id,
      loja: a.loja,
      produto: a.produto,
      data: a.data,
      nota: a.resultado.nota,
      status: a.resultado.status,
    })),
  };
}

export function baixarJsonGeral(historico: Auditoria[]) {
  const blob = new Blob([JSON.stringify(montarJsonGeral(historico), null, 2)], {
    type: "application/json",
  });
  baixarBlob(
    blob,
    `levantamento-geral-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`,
  );
}

export async function baixarPdfGeral(historico: Auditoria[]) {
  if (historico.length === 0) return;
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const dados = montarJsonGeral(historico);
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const M = 36;
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(146, 84, 42);
  doc.rect(0, 0, W, 72, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(17);
  doc.text("Qualipão — Levantamento geral de auditorias", M, 32);
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(
    `${dados.totalAuditorias} auditorias  •  ${dados.totalLojas} lojas  •  Média geral: ${fmt(dados.mediaGeral)} / 10  •  ${new Date().toLocaleString("pt-BR")}`,
    M,
    52,
  );

  autoTable(doc, {
    startY: 96,
    head: [
      [
        "Loja",
        "Auditorias",
        "Média",
        "Status",
        ...ORDEM.map((c) => CRITERIO_LABEL[c]),
        "Última auditoria",
      ],
    ],
    body: dados.lojas.map((l) => [
      `Loja ${l.loja}`,
      String(l.auditorias),
      fmt(l.media),
      l.status,
      ...ORDEM.map((c) => fmt(l.medias[c])),
      dataBr(l.ultima),
    ]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [146, 84, 42], textColor: 255, fontSize: 8 },
    columnStyles: { 0: { fontStyle: "bold" }, 2: { halign: "right" } },
    margin: { left: M, right: M },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let y = (doc as any).lastAutoTable.finalY + 26;
  if (y > doc.internal.pageSize.getHeight() - 120) {
    doc.addPage();
    y = M;
  }

  doc.setTextColor(30, 30, 30).setFont("helvetica", "bold").setFontSize(12);
  doc.text("Histórico detalhado", M, y);

  autoTable(doc, {
    startY: y + 10,
    head: [["Data", "Loja", "Produto", "Nota", "Status"]],
    body: dados.auditorias.map((a) => [
      dataBr(a.data),
      `Loja ${a.loja}`,
      a.produto,
      fmt(a.nota),
      a.status,
    ]),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [80, 80, 80], textColor: 255 },
    columnStyles: { 3: { halign: "right", fontStyle: "bold" } },
    margin: { left: M, right: M },
  });

  baixarBlob(
    doc.output("blob") as Blob,
    `levantamento-geral-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.pdf`,
  );
}
