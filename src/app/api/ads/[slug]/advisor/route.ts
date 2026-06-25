// ADS Advisor — a separate, paid-media-specialist Claude agent (Google
// Ads + Meta Ads pro). On every turn the route re-reads the client's
// last-30-days analytics AND the whole Campaign Vault and injects them as
// grounded context, so the first message (a kickoff sent by the UI) is a
// data-aware diagnosis and the conversation stays grounded afterwards.
//
// HARD RULE: analytics are only ever the real platform numbers. When a
// platform isn't connected the context says so — the agent must NOT
// invent metrics.

import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { getCurrentSession } from "@/lib/auth/server";
import { getAdsClient } from "@/lib/ads-clients";
import { getAdsPerformance } from "@/lib/ads/ads-data";
import { getVault, VAULT_KIND_LABEL } from "@/lib/ads/ads-vault-store";
import { getAdsReports } from "@/lib/ads/ads-reports-store";
import { formatDate } from "@/lib/dates";

export const maxDuration = 120;

const BASE_SYSTEM = `És o "ADS Advisor" da Wonder Ads — um estratega sénior de paid media, especialista PRO em Google Ads e Meta Ads, ao serviço da equipa de ADS de uma agência de growth em Health & Wellness.

Função: analisar a performance das campanhas do cliente e o Campaign Vault, e dar aconselhamento acionável — estrutura de contas, budgets e bidding, qualidade de criativos e copy, segmentação, funis, tracking/conversões, ROAS/CPA, testes A/B e otimizações concretas.

Estilo:
- Direto, prático, conciso. Vai ao que interessa.
- Responde em Português (Portugal) se o utilizador escrever em português; caso contrário, inglês.
- Estrutura com bullets curtos e prioriza por impacto.
- És especialista APENAS em paid ads (Google/Meta). Se perguntarem algo de SEO/web/faturação, diz brevemente que pertence a outro departamento.

REGRA DURA — honestidade com dados:
- Usa apenas os números reais que te são dados no contexto. NUNCA inventes métricas, conversões, ROAS ou tendências.
- Se as analytics não estiverem ligadas (sem dados), diz-o claramente e baseia o aconselhamento no Campaign Vault + boas práticas, pedindo os dados em falta.`;

function buildContext(opts: {
  clientName: string;
  perf: Awaited<ReturnType<typeof getAdsPerformance>>;
  vault: Awaited<ReturnType<typeof getVault>>;
  reports: Awaited<ReturnType<typeof getAdsReports>>;
}): string {
  const { clientName, perf, vault, reports } = opts;
  const lines: string[] = [`# Contexto do cliente: ${clientName}`];

  lines.push(`\n## Ligação às plataformas`);
  lines.push(
    `- Google Ads: ${perf.connected.google ? "ligado" : "NÃO ligado"}`,
  );
  lines.push(`- Meta Ads: ${perf.connected.meta ? "ligado" : "NÃO ligado"}`);
  lines.push(`- Canais do cliente: ${perf.channels.join(", ") || "nenhum"}`);

  lines.push(`\n## Analytics — últimos 30 dias (dados reais)`);
  if (perf.kpis) {
    const k = perf.kpis;
    lines.push(
      `- Conversões: ${k.conversions} · ROAS: ${k.roas.toFixed(2)}x · CTR: ${k.ctr.toFixed(2)}% · CPA: €${k.cpa.toFixed(0)} · Spend: €${k.spend.toFixed(0)}${k.budget != null ? ` (orçamento €${k.budget.toFixed(0)})` : ""}`,
    );
    if (perf.topCampaigns.length) {
      lines.push(`- Top campanhas por conversão:`);
      for (const c of perf.topCampaigns.slice(0, 8)) {
        lines.push(
          `  • ${c.name} [${c.platform}] — ${c.conversions} conv · ROAS ${c.roas.toFixed(1)}x`,
        );
      }
    }
  } else {
    lines.push(
      `- SEM DADOS: a(s) plataforma(s) não está(ão) ligada(s) à app neste momento. Não há métricas reais para os últimos 30 dias.`,
    );
  }

  lines.push(`\n## Campaign Vault (${vault.length} itens)`);
  if (vault.length === 0) {
    lines.push(`- Vazio.`);
  } else {
    for (const v of vault.slice(0, 60)) {
      const plat = v.platform ? ` (${v.platform})` : "";
      const desc = v.description ? ` — ${v.description}` : "";
      lines.push(
        `- [${VAULT_KIND_LABEL[v.kind]}]${plat} ${v.title}${desc} · ${formatDate(v.addedAt)}`,
      );
    }
  }

  lines.push(`\n## Reports gerados anteriormente (${reports.length})`);
  for (const r of reports.slice(0, 12)) {
    const k = r.kpis
      ? `Conv ${r.kpis.conversions} · ROAS ${r.kpis.roas.toFixed(1)}x · Spend €${r.kpis.spend.toFixed(0)}`
      : "sem dados";
    lines.push(`- ${r.kind} · ${formatDate(r.requestedAt)} · ${k}`);
  }

  lines.push(
    `\nNota: o Vault lista metadados (título, tipo, data, link) — não tens o conteúdo dos ficheiros. Se precisares do detalhe de um brief/criativo, pede ao utilizador.`,
  );
  return lines.join("\n");
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!(await getCurrentSession())) {
    return new Response("Not authorised", { status: 401 });
  }
  const { slug } = await ctx.params;
  const client = getAdsClient(slug);
  if (!client) return new Response("Unknown client", { status: 404 });

  const { messages }: { messages: UIMessage[] } = await req.json();

  const [perf, vault, reports] = await Promise.all([
    getAdsPerformance(slug, { platform: "all", window: { mode: "days", days: 30 } }),
    getVault(slug),
    getAdsReports(slug),
  ]);

  const system = `${BASE_SYSTEM}\n\n${buildContext({
    clientName: client.title,
    perf,
    vault,
    reports,
  })}`;

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
