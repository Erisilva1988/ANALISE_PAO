import { supabase } from "@/integrations/supabase/client";
import { montarJson, gerarPdfBlob, type RelatorioMeta } from "@/lib/relatorio";
import type { AnaliseResultado } from "@/lib/analise.functions";

export type SalvarResultado = {
  id: string;
  pdfUrl: string | null;
  jsonUrl: string | null;
  nomePdf: string;
  blobPdf: Blob;
};

/** Gera o PDF, envia PDF + JSON ao armazenamento e grava a auditoria no banco. */
export async function salvarAuditoriaNoBanco(
  r: AnaliseResultado,
  meta: RelatorioMeta,
  imagens: string[],
): Promise<SalvarResultado> {
  const { blob, nome } = await gerarPdfBlob(r, meta, imagens);


  const jsonBase = montarJson(r, meta);

  const { data: registro, error: erroInsert } = await supabase
    .from("auditorias")
    .insert({
      loja_codigo: meta.loja,
      loja_nome: meta.lojaNome,
      produto: meta.produto,
      total_fotos: meta.totalFotos,
      nota: r.nota,
      status: r.status,
      relatorio: jsonBase,
    })
    .select("id")
    .single();

  if (erroInsert || !registro) {
    throw new Error(erroInsert?.message ?? "Não foi possível salvar a auditoria.");
  }

  const ANO = 60 * 60 * 24 * 365;
  const enviar = async (caminho: string, arquivo: Blob, tipo: string) => {
    const { error } = await supabase.storage
      .from("relatorios")
      .upload(caminho, arquivo, { contentType: tipo, upsert: true });
    if (error) return null;
    const { data } = await supabase.storage.from("relatorios").createSignedUrl(caminho, ANO);
    return data?.signedUrl ?? null;
  };

  const caminhoPdf = `loja-${meta.loja}/${registro.id}/${nome}`;
  const nomeJson = nome.replace(/\.pdf$/, ".json");
  const caminhoJson = `loja-${meta.loja}/${registro.id}/${nomeJson}`;

  // Envia o PDF primeiro para obter o link e incluí-lo no JSON.
  const pdfUrl = await enviar(caminhoPdf, blob, "application/pdf");
  const json = { ...jsonBase, pdfUrl };
  const jsonUrl = await enviar(
    caminhoJson,
    new Blob([JSON.stringify(json, null, 2)], { type: "application/json" }),
    "application/json",
  );

  await supabase
    .from("auditorias")
    .update({
      relatorio: json,
      pdf_path: pdfUrl ? caminhoPdf : null,
      pdf_url: pdfUrl,
      json_path: jsonUrl ? caminhoJson : null,
      json_url: jsonUrl,
    })
    .eq("id", registro.id);

  return { id: registro.id, pdfUrl, jsonUrl, nomePdf: nome, blobPdf: blob };
}

