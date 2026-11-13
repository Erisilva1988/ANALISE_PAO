import { createFileRoute } from "@tanstack/react-router";
import { montarJson, type RelatorioMeta } from "@/lib/relatorio";
import { produtoNoTexto } from "@/lib/produtos";

const MIN_FOTOS = 2;
const MAX_FOTOS = 6;
const GATEWAY = "https://connector-gateway.lovable.dev/twilio";

function twiml(mensagem: string) {
  const texto = mensagem.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${texto}</Message></Response>`, {
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

function base64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/** Baixa a mídia do Twilio através do gateway e devolve uma data URL. */
async function baixarMidia(mediaUrl: string): Promise<string | null> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const twilioKey = process.env["TWILIO_API_KEY"];
  if (!lovableKey || !twilioKey) return null;

  const caminho = mediaUrl.replace(/^https:\/\/api\.twilio\.com\/2010-04-01\/Accounts\/[^/]+/, "");
  if (!caminho.startsWith("/")) return null;

  const headers = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": twilioKey,
  };

  let res = await fetch(`${GATEWAY}${caminho}`, { headers, redirect: "manual" });
  if (res.status >= 300 && res.status < 400) {
    const destino = res.headers.get("location");
    if (!destino) return null;
    res = await fetch(destino);
  }
  if (!res.ok) {
    console.error(`Falha ao baixar mídia do WhatsApp [${res.status}]: ${await res.text()}`);
    return null;
  }
  const tipo = res.headers.get("content-type") ?? "image/jpeg";
  if (!tipo.startsWith("image/")) return null;
  return `data:${tipo};base64,${base64(await res.arrayBuffer())}`;
}

export const Route = createFileRoute("/api/public/whatsapp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env["WHATSAPP_WEBHOOK_TOKEN"];
        const url = new URL(request.url);
        if (!token || url.searchParams.get("token") !== token) {
          return new Response("Unauthorized", { status: 401 });
        }

        const form = await request.formData();
        const de = String(form.get("From") ?? "").replace("whatsapp:", "").trim();
        const corpo = String(form.get("Body") ?? "").trim();
        const qtdMidia = Number(form.get("NumMedia") ?? 0) || 0;
        if (!de) return new Response("Bad Request", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: cadastro } = await supabaseAdmin
          .from("numeros_whatsapp")
          .select("loja_codigo,loja_nome,produto_padrao,ativo")
          .eq("telefone", de)
          .maybeSingle();

        if (!cadastro || !cadastro.ativo) {
          return twiml(
            "Este número não está cadastrado no Qualipão. Peça ao responsável para cadastrar o número da loja no painel.",
          );
        }

        // Sessão aberta (fotos ainda não analisadas) deste número.
        const { data: aberta } = await supabaseAdmin
          .from("whatsapp_fila")
          .select("id,imagens,produto")
          .eq("telefone", de)
          .eq("situacao", "aguardando")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const imagensAtuais: string[] = Array.isArray(aberta?.imagens)
          ? (aberta.imagens as string[])
          : [];
        const produtoCitado = produtoNoTexto(corpo);
        const produto = produtoCitado ?? aberta?.produto ?? cadastro.produto_padrao;

        if (/^(cancelar|apagar|limpar)/i.test(corpo) && aberta) {
          await supabaseAdmin
            .from("whatsapp_fila")
            .update({ situacao: "cancelada" })
            .eq("id", aberta.id);
          return twiml("Fotos descartadas. Pode começar de novo quando quiser.");
        }

        const novas: string[] = [];
        for (let i = 0; i < qtdMidia && imagensAtuais.length + novas.length < MAX_FOTOS; i++) {
          const midia = String(form.get(`MediaUrl${i}`) ?? "");
          if (!midia) continue;
          const dataUrl = await baixarMidia(midia);
          if (dataUrl) novas.push(dataUrl);
        }

        const imagens = [...imagensAtuais, ...novas];

        let filaId = aberta?.id ?? null;
        if (!filaId) {
          const { data: criada } = await supabaseAdmin
            .from("whatsapp_fila")
            .insert({
              telefone: de,
              loja_codigo: cadastro.loja_codigo,
              loja_nome: cadastro.loja_nome,
              produto,
              imagens,
            })
            .select("id")
            .single();
          filaId = criada?.id ?? null;
        } else {
          await supabaseAdmin
            .from("whatsapp_fila")
            .update({ imagens, produto })
            .eq("id", filaId);
        }

        const querAnalisar = /^(ok|analisar|pronto|finalizar|fechar)/i.test(corpo);

        if (qtdMidia > 0 && !querAnalisar && imagens.length < MAX_FOTOS) {
          return twiml(
            `Loja ${cadastro.loja_codigo} — ${cadastro.loja_nome}\nProduto: ${produto}\nFotos recebidas: ${imagens.length}\n\n` +
              (imagens.length >= MIN_FOTOS
                ? 'Responda "OK" para gerar o relatório ou envie mais fotos (até 6).'
                : `Envie mais ${MIN_FOTOS - imagens.length} foto(s) para liberar a análise.`),
          );
        }

        if (imagens.length < MIN_FOTOS) {
          return twiml(
            `Envie no mínimo ${MIN_FOTOS} fotos do mesmo produto para gerar o relatório. Recebidas até agora: ${imagens.length}.`,
          );
        }

        // Dispara a auditoria.
        try {
          const { auditarImagens } = await import("@/lib/analise.server");
          const resultado = await auditarImagens(imagens, produto);

          const meta: RelatorioMeta = {
            produto,
            totalFotos: imagens.length,
            loja: cadastro.loja_codigo,
            lojaNome: cadastro.loja_nome,
            dataAuditoria: new Date().toISOString().slice(0, 10),
          };
          const relatorio = montarJson(resultado, meta);

          const { data: registro, error } = await supabaseAdmin
            .from("auditorias")
            .insert({
              loja_codigo: cadastro.loja_codigo,
              loja_nome: cadastro.loja_nome,
              produto,
              total_fotos: imagens.length,
              nota: resultado.nota,
              status: resultado.status,
              relatorio,
            })
            .select("id")
            .single();
          if (error || !registro) throw new Error(error?.message ?? "Falha ao salvar auditoria.");

          const ANO = 60 * 60 * 24 * 365;
          const fotosUrls: string[] = [];
          for (let i = 0; i < imagens.length; i++) {
            const partes = /^data:(image\/[^;]+);base64,(.+)$/.exec(imagens[i]!);
            if (!partes) continue;
            const bytes = Uint8Array.from(atob(partes[2]!), (c) => c.charCodeAt(0));
            const ext = partes[1]!.split("/")[1] ?? "jpg";
            const caminho = `loja-${cadastro.loja_codigo}/${registro.id}/foto-${i + 1}.${ext}`;
            const { error: erroUpload } = await supabaseAdmin.storage
              .from("relatorios")
              .upload(caminho, bytes, { contentType: partes[1]!, upsert: true });
            if (erroUpload) continue;
            const { data: assinada } = await supabaseAdmin.storage
              .from("relatorios")
              .createSignedUrl(caminho, ANO);
            if (assinada?.signedUrl) fotosUrls.push(assinada.signedUrl);
          }

          const relatorioFinal = { ...relatorio, origem: "whatsapp", imagens: fotosUrls };
          const caminhoJson = `loja-${cadastro.loja_codigo}/${registro.id}/auditoria.json`;
          const { error: erroJson } = await supabaseAdmin.storage
            .from("relatorios")
            .upload(caminhoJson, JSON.stringify(relatorioFinal, null, 2), {
              contentType: "application/json",
              upsert: true,
            });
          let jsonUrl: string | null = null;
          if (!erroJson) {
            const { data: assinada } = await supabaseAdmin.storage
              .from("relatorios")
              .createSignedUrl(caminhoJson, ANO);
            jsonUrl = assinada?.signedUrl ?? null;
          }

          await supabaseAdmin
            .from("auditorias")
            .update({
              relatorio: relatorioFinal,
              json_path: jsonUrl ? caminhoJson : null,
              json_url: jsonUrl,
            })
            .eq("id", registro.id);

          if (filaId) {
            await supabaseAdmin
              .from("whatsapp_fila")
              .update({ situacao: "processada", auditoria_id: registro.id, imagens: [] })
              .eq("id", filaId);
          }

          const linhas = [
            `Auditoria concluída ✅`,
            `Loja ${cadastro.loja_codigo} — ${cadastro.loja_nome}`,
            `Produto: ${produto} (${imagens.length} fotos)`,
            `Nota: ${resultado.nota.toFixed(1).replace(".", ",")} / 10 — ${resultado.status}`,
          ];
          if (resultado.naoConformidades.length > 0) {
            linhas.push("", "Principais não conformidades:");
            resultado.naoConformidades.slice(0, 3).forEach((n) => linhas.push(`• ${n}`));
          }
          linhas.push("", "O relatório completo já está na aba Relatórios do painel Qualipão.");
          return twiml(linhas.join("\n"));
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Erro inesperado.";
          console.error("Falha na auditoria via WhatsApp:", msg);
          if (filaId) {
            await supabaseAdmin
              .from("whatsapp_fila")
              .update({ situacao: "erro", erro: msg })
              .eq("id", filaId);
          }
          return twiml(`Não consegui concluir a análise: ${msg} Tente enviar as fotos novamente.`);
        }
      },
    },
  },
});
