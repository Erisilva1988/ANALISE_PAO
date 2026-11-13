import type { AnaliseResultado, CriterioNome } from "@/lib/analise.functions";
import { baixarBlob } from "@/lib/download";

export const CRITERIO_LABEL: Record<CriterioNome, string> = {
  uniformidade: "Uniformidade",
  cor: "Cor e forneamento",
  volume: "Volume e desenvolvimento",
  organizacao: "Organização e exposição",
  recemForneado: "Aparência de recém forneado",
  defeitos: "Ausência de defeitos",
};

const ORDEM = Object.keys(CRITERIO_LABEL) as CriterioNome[];

export type RelatorioMeta = {
  produto: string;
  totalFotos: number;
  loja: string;
  lojaNome: string;
  /** Data da auditoria no formato AAAA-MM-DD (padrão: hoje). */
  dataAuditoria: string;
};

export type RelatorioJson = {
  schema: "qualipao.auditoria/v1";
  geradoEm: string;
  dataAuditoria: string;
  loja: string;
  lojaNome: string;
  produto: string;
  totalFotos: number;
  notaFinal: number;
  notaMaxima: 10;
  status: string;
  criterios: Array<{
    chave: CriterioNome;
    label: string;
    pontuacao: number;
    maximo: number;
    percentual: number;
    justificativa: string;
  }>;
  naoConformidades: string[];
  pontosPositivos: string[];
  diagnostico: string;
  recomendacoes: string[];
  naoAvaliavel: string[];
  /** Link assinado do PDF armazenado (preenchido após o envio ao storage). */
  pdfUrl?: string | null;
};

export function montarJson(r: AnaliseResultado, meta: RelatorioMeta): RelatorioJson {
  const dataValida = /^\d{4}-\d{2}-\d{2}/.test(meta.dataAuditoria);
  return {
    schema: "qualipao.auditoria/v1",
    geradoEm: dataValida
      ? new Date(`${meta.dataAuditoria.slice(0, 10)}T12:00:00.000Z`).toISOString()
      : new Date().toISOString(),
    dataAuditoria: meta.dataAuditoria,
    loja: meta.loja,
    lojaNome: meta.lojaNome,
    produto: meta.produto,
    totalFotos: meta.totalFotos,
    notaFinal: r.nota,
    notaMaxima: 10,
    status: r.status,
    criterios: ORDEM.map((chave) => {
      const c = r.criterios[chave];
      return {
        chave,
        label: CRITERIO_LABEL[chave],
        pontuacao: c.pontuacao,
        maximo: c.maximo,
        percentual: Math.round((c.pontuacao / c.maximo) * 100),
        justificativa: c.justificativa,
      };
    }),
    naoConformidades: r.naoConformidades,
    pontosPositivos: r.pontosPositivos,
    diagnostico: r.diagnostico,
    recomendacoes: r.recomendacoes,
    naoAvaliavel: r.naoAvaliavel,
  };
}

function nomeArquivo(meta: RelatorioMeta, ext: string) {
  const slug = meta.produto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const data = meta.dataAuditoria || new Date().toISOString().slice(0, 10);
  return `auditoria-loja-${meta.loja}-${slug}-${data}.${ext}`;
}

export function baixarJson(r: AnaliseResultado, meta: RelatorioMeta) {
  const dados = montarJson(r, meta);
  baixarBlob(
    new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" }),
    nomeArquivo(meta, "json"),
  );
}

export async function copiarJson(r: AnaliseResultado, meta: RelatorioMeta) {
  await navigator.clipboard.writeText(JSON.stringify(montarJson(r, meta), null, 2));
}

const fmt = (n: number) => n.toFixed(2).replace(".", ",").replace(/,00$/, ",0");

/** Converte AAAA-MM-DD para DD/MM/AAAA (sem depender de fuso horário). */
export function formatarData(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Converte qualquer data URL de imagem (webp, heic renderizado, etc.) para JPEG, que o jsPDF embute com segurança. */
async function paraJpeg(src: string): Promise<string | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = src;
    });
    if (!img.naturalWidth || !img.naturalHeight) return null;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return null;
  }
}

export async function gerarPdfBlob(
  r: AnaliseResultado,
  meta: RelatorioMeta,
  imagens: string[] = [],
) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const M = 40;
  const W = doc.internal.pageSize.getWidth();
  let y = M;

  doc.setFillColor(146, 84, 42);
  doc.rect(0, 0, W, 76, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(18);
  doc.text("Qualipão — Auditoria visual de panificação", M, 34);
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(
    `Loja ${meta.loja} — ${meta.lojaNome}  •  Produto: ${meta.produto}  •  Fotos analisadas: ${meta.totalFotos}  •  Data da auditoria: ${formatarData(meta.dataAuditoria)}`,
    M,
    54,
  );
  y = 100;

  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold").setFontSize(30);
  doc.text(r.nota.toFixed(1).replace(".", ","), M, y + 10);
  doc.setFontSize(13);
  doc.text(`/ 10 — ${r.status}`, M + 70, y + 10);
  y += 34;

  autoTable(doc, {
    startY: y,
    head: [["Critério", "Pontuação", "Justificativa"]],
    body: ORDEM.map((chave) => {
      const c = r.criterios[chave];
      return [CRITERIO_LABEL[chave], `${fmt(c.pontuacao)} / ${fmt(c.maximo)}`, c.justificativa];
    }),
    styles: { fontSize: 9, cellPadding: 5, valign: "top" },
    headStyles: { fillColor: [146, 84, 42], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 120, fontStyle: "bold" },
      1: { cellWidth: 70, halign: "right" },
    },
    margin: { left: M, right: M },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 24;

  const secao = (titulo: string, linhas: string[]) => {
    if (linhas.length === 0) return;
    const texto = linhas.map((l) => `• ${l}`);
    const altura = texto.reduce(
      (acc, t) => acc + doc.splitTextToSize(t, W - M * 2).length * 13,
      22,
    );
    if (y + altura > doc.internal.pageSize.getHeight() - M) {
      doc.addPage();
      y = M;
    }
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(30, 30, 30);
    doc.text(titulo, M, y);
    y += 15;
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(70, 70, 70);
    texto.forEach((t) => {
      const linhasQuebradas = doc.splitTextToSize(t, W - M * 2) as string[];
      doc.text(linhasQuebradas, M, y);
      y += linhasQuebradas.length * 13;
    });
    y += 12;
  };

  secao("Principais não conformidades", r.naoConformidades);
  secao("Pontos positivos", r.pontosPositivos);
  if (r.diagnostico) secao("Diagnóstico técnico", [r.diagnostico]);
  secao("Recomendações", r.recomendacoes);
  secao("Não avaliável nas imagens", r.naoAvaliavel);

  const convertidas = await Promise.all(
    imagens.filter((s) => s.startsWith("data:image")).map(paraJpeg),
  );
  const fotos = convertidas.filter((s): s is string => s !== null);
  if (fotos.length > 0) {
    doc.addPage();
    y = M;
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(30, 30, 30);
    doc.text("Imagens auditadas", M, y);
    y += 16;
    const larg = (W - M * 2 - 12) / 2;
    const alt = larg * 0.72;
    fotos.forEach((src, i) => {
      const col = i % 2;
      if (col === 0 && y + alt > doc.internal.pageSize.getHeight() - M) {
        doc.addPage();
        y = M;
      }
      try {
        doc.addImage(src, M + col * (larg + 12), y, larg, alt, undefined, "FAST");
      } catch {
        /* imagem inválida ignorada */
      }
      if (col === 1) y += alt + 12;
    });
  }

  return { blob: doc.output("blob") as Blob, nome: nomeArquivo(meta, "pdf") };
}

export async function baixarPdf(
  r: AnaliseResultado,
  meta: RelatorioMeta,
  imagens: string[] = [],
) {
  const { blob, nome } = await gerarPdfBlob(r, meta, imagens);
  baixarBlob(blob, nome);
  return { blob, nome };
}
