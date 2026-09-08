// POST /api/commercial/proposals/analyse — o consultor carregou um PDF de
// proposta (renovação ou cross-sell, feito a partir dos templates) e o
// Claude lê-o e devolve os metadados do cartão: cliente, título, tipo,
// data, período, investimento, resumo, quem assina. O consultor revê o
// rascunho no modal antes de gravar (POST /api/commercial/proposals).
//
// O PDF vai inteiro ao modelo (bloco `document`) — lê o layout, tabelas e
// valores tal como estão na página, o que o texto extraído perde. Se o
// ficheiro for grande demais para isso, cai no texto do unpdf.

import { NextResponse } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { guardCommercialWrite } from "@/lib/proposals/api-guard";
import { findUsernameByEmail, findEmployeeByName } from "@/lib/proposals/consultant";
import { extractFromUrl } from "@/lib/pdf-extract";
import { getSeoClients } from "@/lib/notion";
import { toISODate } from "@/lib/dates";

export const runtime = "nodejs";
export const maxDuration = 120;

const PRIMARY_MODEL = "claude-opus-5";
// O modelo que já corre nas outras rotas da app — a rede se o primário
// não estiver disponível na conta.
const FALLBACK_MODEL = "claude-sonnet-4-6";
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

const DraftSchema = z.object({
  clientName: z.string().describe("Nome do cliente tal como aparece no documento (sem morada)."),
  clientSlug: z
    .string()
    .nullable()
    .describe("Slug do cliente na lista de clientes conhecidos, ou null se não bate com nenhum."),
  kind: z.enum(["renovacao", "cross-sell"]),
  title: z
    .string()
    .describe("Título curto para a lista, ex.: «Proposta de Renovação · Set 2026 – Fev 2027» ou «Sessão Fotográfica Profissional»."),
  date: z.string().describe("Data de emissão da proposta em yyyy-mm-dd."),
  period: z
    .string()
    .describe("Período contratual ou janela de execução, ex.: «Setembro 2026 – Fevereiro 2027» ou «Validade 30 dias · entrega em 7–10 dias úteis»."),
  investment: z
    .string()
    .describe("Investimento como aparece no cartão de preço, ex.: «6.000 € mensal · 5.400 € pré-pago» ou «700 € + IVA»."),
  summary: z
    .string()
    .describe("Uma frase em português europeu (máx. 200 caracteres) que resume o que se propõe."),
  consultantName: z.string().nullable().describe("Nome de quem assina pela WonderAds, se estiver no documento."),
  consultantEmail: z.string().nullable().describe("E-mail @wonder-ads.com de quem assina, se estiver no documento."),
  reference: z.string().nullable().describe("Referência do documento (ex.: WA-2026-09-MIMUS-FOTO-01), se existir."),
  validUntil: z.string().nullable().describe("Data de validade em yyyy-mm-dd, se existir."),
});

export type ProposalDraft = z.infer<typeof DraftSchema>;

function isModelUnavailable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /not[_ ]found|model|permission|does not exist|unsupported/i.test(msg);
}

function pickKind(v: unknown): "renovacao" | "cross-sell" | null {
  return v === "renovacao" || v === "cross-sell" ? v : null;
}

export async function POST(req: Request) {
  const g = await guardCommercialWrite();
  if (!g.ok) return g.res;
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY não está configurada — o Claude não pode ler a proposta." },
      { status: 503 },
    );
  }
  let body: { url?: unknown; name?: unknown; kind?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const url = typeof body.url === "string" ? body.url : "";
  if (!/^https:\/\//.test(url)) {
    return NextResponse.json({ error: "Falta o URL do ficheiro carregado." }, { status: 400 });
  }
  const fileName = typeof body.name === "string" ? body.name : "proposta.pdf";
  const hintedKind = pickKind(body.kind);

  // Clientes conhecidos — para o Claude ligar o PDF à ficha certa.
  const clients = await getSeoClients().catch(() => []);
  const clientList = clients.map((c) => `- ${c.slug} → ${c.title}`).join("\n");

  // O documento: inteiro como PDF quando cabe; senão o texto extraído.
  let pdfBytes: Uint8Array | null = null;
  let extractedText = "";
  let pages: number | null = null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength <= MAX_DOCUMENT_BYTES) pdfBytes = buf;
  } catch (err) {
    console.error("[proposals/analyse] fetch do PDF falhou:", err);
  }
  try {
    const ex = await extractFromUrl(url, "application/pdf");
    extractedText = ex.text;
    pages = ex.pageCount;
  } catch (err) {
    console.error("[proposals/analyse] extração de texto falhou:", err);
  }
  if (!pdfBytes && !extractedText) {
    return NextResponse.json(
      { error: "Não foi possível ler o ficheiro — confirma que é um PDF com texto." },
      { status: 422 },
    );
  }

  const system = [
    "És o assistente do departamento Comercial da Wonder Ads, uma agência de crescimento (SEO, Ads, Web) para Saúde & Bem-Estar em Portugal.",
    "Recebes um PDF de proposta comercial preparado por um consultor da agência e devolves os metadados para o cartão da lista de propostas.",
    "Regras:",
    "- Escreve em português europeu (PT-PT), sem brasileirismos.",
    "- «renovacao» = renovação de um contrato que já existe (SEO, Ads…); «cross-sell» = serviço novo vendido a um cliente que já é nosso (sessão fotográfica, vídeo, CRM, website…). Um orçamento de serviço pontual é cross-sell.",
    "- clientSlug: escolhe APENAS um slug da lista de clientes conhecidos, se o nome do cliente no documento bater com um deles (mesmo com variações de grafia). Senão, null.",
    "- Nunca inventes valores: se um campo não está no documento, devolve null (ou uma string vazia quando o campo é obrigatório).",
    `- Se não houver data de emissão, usa a data de hoje: ${toISODate()}.`,
    hintedKind ? `- O consultor indicou que esta proposta é do tipo «${hintedKind}»; respeita-o salvo evidência clara em contrário.` : "",
    "",
    "Clientes conhecidos (slug → nome):",
    clientList || "(lista indisponível)",
  ]
    .filter(Boolean)
    .join("\n");

  const userText = [
    `Ficheiro: ${fileName}${pages ? ` · ${pages} página(s)` : ""}`,
    "Extrai os metadados da proposta.",
    !pdfBytes && extractedText ? `\n--- TEXTO EXTRAÍDO ---\n${extractedText.slice(0, 60_000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const content: Array<
    | { type: "text"; text: string }
    | { type: "file"; data: Uint8Array; mediaType: string; filename?: string }
  > = [];
  if (pdfBytes) {
    content.push({ type: "file", data: pdfBytes, mediaType: "application/pdf", filename: fileName });
  }
  content.push({ type: "text", text: userText });

  async function run(model: string) {
    const r = await generateObject({
      model: anthropic(model),
      schema: DraftSchema,
      system,
      messages: [{ role: "user", content }],
    });
    return r.object;
  }

  let draft: ProposalDraft;
  let modelUsed = PRIMARY_MODEL;
  try {
    draft = await run(PRIMARY_MODEL);
  } catch (err) {
    console.error(`[proposals/analyse] ${PRIMARY_MODEL} falhou:`, err);
    if (!isModelUnavailable(err)) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `O Claude não conseguiu ler a proposta: ${message}` }, { status: 502 });
    }
    try {
      modelUsed = FALLBACK_MODEL;
      draft = await run(FALLBACK_MODEL);
    } catch (err2) {
      const message = err2 instanceof Error ? err2.message : String(err2);
      return NextResponse.json({ error: `O Claude não conseguiu ler a proposta: ${message}` }, { status: 502 });
    }
  }

  // Validações que o esquema não faz: slug tem de existir; data em ISO.
  const known = new Set(clients.map((c) => c.slug));
  const clientSlug = draft.clientSlug && known.has(draft.clientSlug) ? draft.clientSlug : null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(draft.date) ? draft.date : toISODate();
  const consultantUsername =
    findUsernameByEmail(draft.consultantEmail) ??
    findEmployeeByName(draft.consultantName)?.username ??
    null;

  return NextResponse.json({
    ok: true,
    model: modelUsed,
    pages,
    draft: {
      ...draft,
      clientSlug,
      date,
      kind: hintedKind ?? draft.kind,
      consultantUsername,
      summary: draft.summary.slice(0, 240),
    },
  });
}
