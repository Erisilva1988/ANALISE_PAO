import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  Loader2,
  Camera,
  RefreshCw,
  AlertTriangle,
  X,
  FileDown,
  FileJson,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { analisarProduto, type AnaliseResultado } from "@/lib/analise.functions";
import { baixarPdf, baixarJson, copiarJson, type RelatorioMeta } from "@/lib/relatorio";
import { LOJAS, nomeLoja } from "@/lib/lojas";
import { salvarAuditoriaNoBanco } from "@/lib/persistencia";
import { baixarUrl } from "@/lib/download";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Qualipão — Análise visual de pães por IA" },
      {
        name: "description",
        content:
          "Envie a foto do pão e receba em segundos notas de cor, formato, uniformidade e aparência avaliadas por inteligência artificial.",
      },
      { property: "og:title", content: "Qualipão — Análise visual de pães por IA" },
      {
        property: "og:description",
        content:
          "Controle de qualidade de panificação com avaliação automática de imagens por IA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Qualipao,
});

const PRODUTOS = [
  "Pão francês",
  "Pão de forma",
  "Pão doce",
  "Baguete",
  "Croissant",
  "Bolo",
  "Sonho",
];

const CRITERIOS: { chave: keyof AnaliseResultado["criterios"]; label: string }[] = [
  { chave: "uniformidade", label: "Uniformidade" },
  { chave: "cor", label: "Cor e forneamento" },
  { chave: "volume", label: "Volume e desenvolvimento" },
  { chave: "organizacao", label: "Organização e exposição" },
  { chave: "recemForneado", label: "Aparência de recém forneado" },
  { chave: "defeitos", label: "Ausência de defeitos" },
];

const fmt = (n: number) => n.toFixed(2).replace(".", ",").replace(/,00$/, ",0");

function Lista({ titulo, itens }: { titulo: string; itens: string[] }) {
  if (itens.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {itens.map((p) => (
          <li key={p}>• {p}</li>
        ))}
      </ul>
    </div>
  );
}


const MIN_FOTOS = 2;
const MAX_FOTOS = 6;

function Qualipao() {
  const [imagens, setImagens] = useState<string[]>([]);
  const [copiado, setCopiado] = useState(false);
  const [produto, setProduto] = useState<string>(PRODUTOS[0]!);
  const [loja, setLoja] = useState<string>("");
  const [dataAuditoria, setDataAuditoria] = useState<string>(() =>
    new Date().toLocaleDateString("en-CA"),
  );
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState<{ id: string; pdfUrl: string | null; jsonUrl: string | null } | null>(null);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const meta: RelatorioMeta = {
    produto,
    totalFotos: imagens.length,
    loja,
    lojaNome: loja ? nomeLoja(loja) : "",
    dataAuditoria,
  };

  const analisar = useServerFn(analisarProduto);
  const mutation = useMutation<AnaliseResultado, Error, void>({
    mutationFn: async () => analisar({ data: { imagens, produto } }),
    onSuccess: async (resultado) => {
      setSalvando(true);
      setErroSalvar(null);
      setSalvo(null);
      try {
        const r = await salvarAuditoriaNoBanco(resultado, meta, imagens);
        setSalvo({ id: r.id, pdfUrl: r.pdfUrl, jsonUrl: r.jsonUrl });
      } catch (e) {
        setErroSalvar(e instanceof Error ? e.message : "Falha ao salvar no banco.");
      } finally {
        setSalvando(false);
      }
    },
  });

  const onFiles = (files?: FileList | null) => {
    if (!files || files.length === 0) return;
    const lista = Array.from(files).slice(0, MAX_FOTOS);
    Promise.all(
      lista.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(String(e.target?.result ?? ""));
            reader.readAsDataURL(file);
          }),
      ),
    ).then((urls) => {
      setImagens((atual) => [...atual, ...urls].slice(0, MAX_FOTOS));
      mutation.reset();
    });
  };

  const r = mutation.data;

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
            <p className="text-xs text-muted-foreground">
              Controle visual de qualidade com IA
            </p>
          </div>
          <nav className="flex gap-2 text-sm">
            <Link
              to="/"
              className="rounded-md bg-secondary px-3 py-1.5 font-medium text-foreground"
            >
              Nova análise
            </Link>
            <Link
              to="/relatorios"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary"
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

      <div className="mx-auto grid max-w-5xl gap-5 px-5 py-8 md:grid-cols-2">
        <Card className="p-5" style={{ boxShadow: "var(--shadow-soft)" }}>
          <h2 className="text-base font-semibold text-foreground">1. Foto do produto</h2>

          <div className="mt-4 space-y-2">
            <Label>Loja auditada</Label>
            <Select
              value={loja}
              onValueChange={(v) => {
                setLoja(v);
                setSalvo(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a loja" />
              </SelectTrigger>
              <SelectContent>
                {LOJAS.map((l) => (
                  <SelectItem key={l.codigo} value={l.codigo}>
                    {l.codigo} — {l.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 space-y-2">
            <Label>Produto avaliado</Label>
            <Select value={produto} onValueChange={setProduto}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUTOS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 space-y-2">
            <Label htmlFor="data-auditoria">Data da auditoria</Label>
            <input
              id="data-auditoria"
              type="date"
              value={dataAuditoria}
              max={new Date().toLocaleDateString("en-CA")}
              onChange={(e) => {
                if (e.target.value) setDataAuditoria(e.target.value);
              }}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={imagens.length >= MAX_FOTOS}
            className="mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-secondary/40 p-6 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-50"
          >
            <Camera className="size-6" />
            {imagens.length === 0
              ? `Toque para enviar ou tirar fotos (mínimo ${MIN_FOTOS})`
              : `Adicionar mais fotos (${imagens.length}/${MAX_FOTOS})`}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              onFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {imagens.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {imagens.map((src, i) => (
                <div key={src.slice(-40) + i} className="relative">
                  <img
                    src={src}
                    alt={`Foto ${i + 1} do produto enviada para análise`}
                    className="h-24 w-full rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    aria-label={`Remover foto ${i + 1}`}
                    onClick={() => {
                      setImagens((a) => a.filter((_, idx) => idx !== i));
                      mutation.reset();
                    }}
                    className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {imagens.length > 0 && imagens.length < MIN_FOTOS && (
            <p className="mt-3 text-xs text-muted-foreground">
              Envie no mínimo {MIN_FOTOS} fotos do mesmo produto para liberar a análise.
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <Button
              className="flex-1"
              disabled={imagens.length < MIN_FOTOS || !loja || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {mutation.isPending ? "Analisando..." : "Analisar com IA"}
            </Button>
            {imagens.length > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  setImagens([]);
                  mutation.reset();
                }}
              >
                <RefreshCw className="size-4" />
              </Button>
            )}
          </div>
        </Card>

        <Card className="p-5" style={{ boxShadow: "var(--shadow-soft)" }}>
          <h2 className="text-base font-semibold text-foreground">2. Resultado da análise</h2>

          {mutation.isPending && (
            <div className="mt-10 flex flex-col items-center gap-3 text-center">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                A IA está avaliando cor, formato, uniformidade e aparência.
              </p>
            </div>
          )}

          {mutation.isError && (
            <div className="mt-6 flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
              <AlertTriangle className="size-5 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{mutation.error.message}</p>
            </div>
          )}

          {!mutation.isPending && !r && !mutation.isError && (
            <p className="mt-10 text-center text-sm text-muted-foreground">
              Envie no mínimo {MIN_FOTOS} fotos para receber a avaliação.
            </p>
          )}

          {r && !mutation.isPending && (
            <div className="mt-4 space-y-4">
              <div className="rounded-xl p-5 text-center" style={{ background: "var(--gradient-crust)" }}>
                <p className="text-5xl font-bold text-primary-foreground">
                  {r.nota.toFixed(1).replace(".", ",")}
                </p>
                <p className="mt-1 text-sm font-medium text-primary-foreground/90">{r.status}</p>
              </div>

              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Critério</th>
                      <th className="px-3 py-2 text-right font-medium">Pontuação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CRITERIOS.map(({ chave, label }) => {
                      const c = r.criterios[chave];
                      return (
                        <tr key={chave} className="border-t border-border align-top">
                          <td className="px-3 py-2">
                            <p className="font-medium text-foreground">{label}</p>
                            <p className="text-xs text-muted-foreground">{c.justificativa}</p>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-foreground">
                            {fmt(c.pontuacao)} / {fmt(c.maximo)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <Lista titulo="Principais não conformidades" itens={r.naoConformidades} />
              <Lista titulo="Pontos positivos" itens={r.pontosPositivos} />

              {r.diagnostico && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Diagnóstico técnico</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{r.diagnostico}</p>
                </div>
              )}

              <Lista titulo="Recomendações" itens={r.recomendacoes} />
              <Lista titulo="Não avaliável na imagem" itens={r.naoAvaliavel} />

              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-foreground">Exportar relatório</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  PDF para arquivo/compartilhamento e JSON para integrar em dashboards externos.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void baixarPdf(r, meta, imagens);
                    }}
                  >
                    <FileDown className="size-4" /> Baixar PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => baixarJson(r, meta)}>
                    <FileJson className="size-4" /> Baixar JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await copiarJson(r, meta);
                        setCopiado(true);
                        setTimeout(() => setCopiado(false), 2000);
                      } catch {
                        setCopiado(false);
                      }
                    }}
                  >
                    {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
                    {copiado ? "Copiado!" : "Copiar JSON"}
                  </Button>
                </div>

                <div className="mt-3 text-xs">
                  {salvando && (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" /> Salvando JSON e PDF no banco...
                    </p>
                  )}
                  {salvo && (
                    <p className="text-muted-foreground">
                      Auditoria salva no banco (JSON + PDF).{" "}
                      {salvo.pdfUrl && (
                        <button
                          type="button"
                          className="font-medium text-primary underline"
                          onClick={() => {
                            if (salvo.pdfUrl) void baixarUrl(salvo.pdfUrl, "relatorio-qualipao.pdf");
                          }}
                        >
                          Baixar PDF armazenado
                        </button>
                      )}
                      {salvo.pdfUrl && salvo.jsonUrl && " / "}
                      {salvo.jsonUrl && (
                        <button
                          type="button"
                          className="font-medium text-primary underline"
                          onClick={() => {
                            if (salvo.jsonUrl) void baixarUrl(salvo.jsonUrl, "relatorio-qualipao.json");
                          }}
                        >
                          Baixar JSON armazenado
                        </button>
                      )}
                    </p>
                  )}
                  {erroSalvar && <p className="text-destructive">{erroSalvar}</p>}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
