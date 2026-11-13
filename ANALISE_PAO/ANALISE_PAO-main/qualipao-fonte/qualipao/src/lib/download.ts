function nomeSeguro(nomeArquivo: string): string {
  return nomeArquivo.replace(/[\\/:*?"<>|]/g, "-");
}

export function baixarBlob(blob: Blob, nomeArquivo: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = nomeSeguro(nomeArquivo);
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Mantém a URL viva até o navegador registrar o download.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
}

export async function baixarUrl(url: string, nomeArquivo: string): Promise<void> {
  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) throw new Error("Falha ao baixar o arquivo.");

  const dados = await resp.arrayBuffer();
  const tipo = nomeArquivo.toLowerCase().endsWith(".pdf")
    ? "application/pdf"
    : nomeArquivo.toLowerCase().endsWith(".json")
      ? "application/json;charset=utf-8"
      : "application/octet-stream";

  baixarBlob(new Blob([dados], { type: tipo }), nomeArquivo);
}
