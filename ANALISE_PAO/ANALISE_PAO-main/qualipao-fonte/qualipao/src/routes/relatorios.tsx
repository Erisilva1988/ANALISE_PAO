import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FileDown, FileJson, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { baixarUrl } from "@/lib/download";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios de auditoria por data — Qualipão" },
      {
        name: "description",
        content:
          "Consulte e baixe os relatórios de auditoria de panificação em PDF e JSON filtrando por período.",
      },
      { property: "og:title", content: "Relatórios de auditoria por data — Qualipão" },
      {
        property: "og:description",
        content: "Baixe em PDF e JSON todas as auditorias realizadas em um intervalo de datas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Relatorios,
});

type Linha = {
  id: string;
  loja_codigo: string;
  loja_nome: string;
  produto: string;
  nota: number;
  status: string;
  created_at: string;
  pdf_url: string | null;
  json_url: string | null;
};

const hoje = () => new Date().toISOString().slice(0, 10);
const fmtData = (iso: string) => new Date(iso).toLocaleString("pt-BR");
const fmtNota = (n: number) => n.toFixed(1).replace(".", ",");

function Relatorios() {
  const [inicio, setInicio] = useState(hoje());
  const [fim, setFim] = useState(hoje());

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["auditorias", inicio, fim],
    queryFn: async (): Promise<Linha[]> => {
      const de = new Date(`${inicio}T00:00:00`).toISOString();
      const ate = new Date(`${fim}T23:59:59.999`).toISOString();
      const { data, error } = await supabase
        .from("auditorias")
        .select("id,loja_codigo,loja_nome,produto,nota,status,created_at,pdf_url,json_url")
        .gte("created_at", de)
        .lte("created_at", ate)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Linha[];
    },
  });

  const linhas = useMemo(() => data ?? [], [data]);

  const nomeArquivo = (l: Linha, ext: "pdf" | "json") =>
    `auditoria_loja-${l.loja_codigo}_${l.created_at.slice(0, 10)}_${l.id.slice(0, 8)}.${ext}`;

  const baixarTodos = (campo: "pdf_url" | "json_url") => {
    const ext = campo === "pdf_url" ? "pdf" : "json";
    linhas.forEach((l, i) => {
      const url = l[campo];
      if (!url) return;
      setTimeout(() => {
        baixarUrl(url, nomeArquivo(l, ext)).catch(() => {});
      }, i * 600);
    });
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/70">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-5">
          <div
            className="flex size-10 items-center justify-center rounded-xl text-lg"
            style={{ background: "var(--gradient-crust)" }}
          >
            🥖
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-foreground">Qualipão</h1>
            <p className="text-xs text-muted-foreground">Relatórios gerados por período</p>
          </div>
          <nav className="flex gap-2 text-sm">
            <Link to="/" className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary">
              Nova análise
            </Link>
            <Link
              to="/relatorios"
              className="rounded-md bg-secondary px-3 py-1.5 font-medium text-foreground"
            >
              Relatórios
            </Link>
            <Link
              to="/whatsapp"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary"
            >
              WhatsApp
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-5 px-5 py-8">
        <Card className="p-5" style={{ boxShadow: "var(--shadow-soft)" }}>
          <h2 className="text-base font-semibold text-foreground">1. Escolha o período</h2>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="inicio">Data inicial</Label>
              <Input
                id="inicio"
                type="date"
                value={inicio}
                max={fim}
                onChange={(e) => setInicio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fim">Data final</Label>
              <Input
                id="fim"
                type="date"
                value={fim}
                min={inicio}
                onChange={(e) => setFim(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={linhas.length === 0}
                onClick={() => baixarTodos("pdf_url")}
              >
                <Download className="size-4" /> Baixar todos os PDFs
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={linhas.length === 0}
                onClick={() => baixarTodos("json_url")}
              >
                <Download className="size-4" /> Baixar todos os JSONs
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-5" style={{ boxShadow: "var(--shadow-soft)" }}>
          <h2 className="text-base font-semibold text-foreground">2. Relatórios encontrados</h2>

          {isLoading && (
            <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Carregando auditorias...
            </div>
          )}

          {isError && (
            <p className="mt-6 text-sm text-destructive">
              {error instanceof Error ? error.message : "Falha ao carregar os relatórios."}
            </p>
          )}

          {!isLoading && !isError && linhas.length === 0 && (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              Nenhuma auditoria registrada nesse período.
            </p>
          )}

          {linhas.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Data</th>
                    <th className="px-3 py-2 text-left font-medium">Loja</th>
                    <th className="px-3 py-2 text-left font-medium">Produto</th>
                    <th className="px-3 py-2 text-right font-medium">Nota</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Download</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {fmtData(l.created_at)}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {l.loja_codigo} — {l.loja_nome}
                      </td>
                      <td className="px-3 py-2 text-foreground">{l.produto}</td>
                      <td className="px-3 py-2 text-right font-semibold text-foreground">
                        {fmtNota(Number(l.nota))}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{l.status}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          {l.pdf_url ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-secondary"
                              onClick={() => {
                                if (l.pdf_url) void baixarUrl(l.pdf_url, nomeArquivo(l, "pdf"));
                              }}
                            >
                              <FileDown className="size-3" /> PDF
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">sem PDF</span>
                          )}
                          {l.json_url ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-secondary"
                              onClick={() => {
                                if (l.json_url) void baixarUrl(l.json_url, nomeArquivo(l, "json"));
                              }}
                            >
                              <FileJson className="size-3" /> JSON
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">sem JSON</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
