import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LOJAS, nomeLoja } from "@/lib/lojas";
import { PRODUTOS } from "@/lib/produtos";

export const Route = createFileRoute("/whatsapp")({
  head: () => ({
    meta: [
      { title: "Números de WhatsApp por loja — Qualipão" },
      {
        name: "description",
        content:
          "Cadastre os celulares de cada loja que podem enviar fotos por WhatsApp para auditoria automática.",
      },
      { property: "og:title", content: "Números de WhatsApp por loja — Qualipão" },
      {
        property: "og:description",
        content: "Gerencie quais números de WhatsApp podem enviar fotos para análise de qualidade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WhatsAppPage,
});

type Numero = {
  id: string;
  telefone: string;
  loja_codigo: string;
  loja_nome: string;
  produto_padrao: string;
  ativo: boolean;
};

/** Normaliza para E.164 brasileiro: +55DDD9XXXXXXXX */
function normalizarTelefone(valor: string): string | null {
  const digitos = valor.replace(/\D/g, "");
  if (digitos.length < 10) return null;
  const comPais = digitos.startsWith("55") ? digitos : `55${digitos}`;
  if (comPais.length < 12 || comPais.length > 13) return null;
  return `+${comPais}`;
}

function WhatsAppPage() {
  const qc = useQueryClient();
  const [telefone, setTelefone] = useState("");
  const [loja, setLoja] = useState("");
  const [produto, setProduto] = useState(PRODUTOS[0]!);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["numeros_whatsapp"],
    queryFn: async (): Promise<Numero[]> => {
      const { data, error } = await supabase
        .from("numeros_whatsapp")
        .select("id,telefone,loja_codigo,loja_nome,produto_padrao,ativo")
        .order("loja_codigo");
      if (error) throw new Error(error.message);
      return (data ?? []) as Numero[];
    },
  });

  const recarregar = () => void qc.invalidateQueries({ queryKey: ["numeros_whatsapp"] });

  const cadastrar = useMutation({
    mutationFn: async () => {
      const tel = normalizarTelefone(telefone);
      if (!tel) throw new Error("Informe um celular válido com DDD.");
      if (!loja) throw new Error("Escolha a loja.");
      const { error } = await supabase.from("numeros_whatsapp").insert({
        telefone: tel,
        loja_codigo: loja,
        loja_nome: nomeLoja(loja),
        produto_padrao: produto,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setTelefone("");
      toast.success("Número cadastrado.");
      recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const alternar = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("numeros_whatsapp").update({ ativo }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: recarregar,
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("numeros_whatsapp").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Número removido.");
      recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const linhas = data ?? [];

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
            <p className="text-xs text-muted-foreground">Números de WhatsApp por loja</p>
          </div>
          <nav className="flex gap-2 text-sm">
            <Link to="/" className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary">
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
              className="rounded-md bg-secondary px-3 py-1.5 font-medium text-foreground"
            >
              WhatsApp
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-5 px-5 py-8">
        <Card className="p-5" style={{ boxShadow: "var(--shadow-soft)" }}>
          <h2 className="text-base font-semibold text-foreground">1. Cadastrar um número</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Só os celulares cadastrados aqui podem enviar fotos por WhatsApp para análise.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="telefone">Celular (com DDD)</Label>
              <Input
                id="telefone"
                placeholder="(84) 99999-0000"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="w-52"
              />
            </div>
            <div className="space-y-2">
              <Label>Loja</Label>
              <Select value={loja} onValueChange={setLoja}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Escolha a loja" />
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
            <div className="space-y-2">
              <Label>Produto padrão</Label>
              <Select value={produto} onValueChange={setProduto}>
                <SelectTrigger className="w-48">
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
            <Button onClick={() => cadastrar.mutate()} disabled={cadastrar.isPending}>
              {cadastrar.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Cadastrar
            </Button>
          </div>
        </Card>

        <Card className="p-5" style={{ boxShadow: "var(--shadow-soft)" }}>
          <h2 className="text-base font-semibold text-foreground">2. Números cadastrados</h2>
          {isLoading ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Carregando…
            </p>
          ) : isError ? (
            <p className="mt-4 text-sm text-destructive">
              {error instanceof Error ? error.message : "Falha ao carregar."}
            </p>
          ) : linhas.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Nenhum número cadastrado ainda.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Celular</th>
                    <th className="py-2 pr-3 font-medium">Loja</th>
                    <th className="py-2 pr-3 font-medium">Produto padrão</th>
                    <th className="py-2 pr-3 font-medium">Ativo</th>
                    <th className="py-2 font-medium"> </th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((n) => (
                    <tr key={n.id} className="border-b border-border/60">
                      <td className="py-2 pr-3 font-medium text-foreground">{n.telefone}</td>
                      <td className="py-2 pr-3">
                        {n.loja_codigo} — {n.loja_nome}
                      </td>
                      <td className="py-2 pr-3">{n.produto_padrao}</td>
                      <td className="py-2 pr-3">
                        <Switch
                          checked={n.ativo}
                          onCheckedChange={(v) => alternar.mutate({ id: n.id, ativo: v })}
                        />
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => remover.mutate(n.id)}
                          aria-label={`Remover ${n.telefone}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-5" style={{ boxShadow: "var(--shadow-soft)" }}>
          <h2 className="text-base font-semibold text-foreground">3. Como a loja usa</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>A loja envia de 2 a 6 fotos do mesmo produto para o número da empresa.</li>
            <li>Pode escrever o nome do produto na legenda (ex.: “pão doce”).</li>
            <li>
              Ao terminar, responde <strong>OK</strong> e recebe a nota no próprio WhatsApp.
            </li>
            <li>O relatório completo aparece na aba Relatórios.</li>
          </ol>
        </Card>
      </div>
    </main>
  );
}
