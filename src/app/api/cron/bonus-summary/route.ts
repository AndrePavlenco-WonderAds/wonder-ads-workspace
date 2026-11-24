// O resumo de fim de mês dos bónus para o canal dos bónus no Slack (v80.37).
//
// QUEM CHAMA:
//   • O cron da Vercel, todo o dia 1 às 09:00 UTC (vercel.json), com
//     `Authorization: Bearer $CRON_SECRET` — envia o mês que fechou.
//   • Um SuperAdmin com sessão, no browser:
//       /api/cron/bonus-summary?dry=1               → pré-visualiza (não envia)
//       /api/cron/bonus-summary?month=2026-10&dry=1 → pré-visualiza outro mês
//       /api/cron/bonus-summary?month=2026-10       → envia esse mês agora
//
// Sem CRON_SECRET, só a sessão de SuperAdmin abre a porta: um endpoint que
// publica valores de remuneração no Slack nunca fica aberto ao mundo.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { bonusSlackConfigured } from "@/lib/slack";
import { isMonthKey } from "@/lib/documentacao/nps-bonus";
import { bonusSlackPayload, buildBonusSummary, previousMonthKey, sendBonusSummary } from "@/lib/bonus-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function isAuthorised(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  const employee = await getCurrentEmployee();
  return Boolean(employee?.isAdmin);
}

export async function GET(req: Request) {
  if (!(await isAuthorised(req))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const url = new URL(req.url);
  const asked = url.searchParams.get("month");
  const month = asked ?? previousMonthKey();
  if (!isMonthKey(month)) return NextResponse.json({ error: "Mês inválido (AAAA-MM)." }, { status: 400 });

  try {
    if (url.searchParams.get("dry") === "1") {
      const summary = await buildBonusSummary(month);
      return NextResponse.json({
        ok: true,
        sent: false,
        slackConfigured: bonusSlackConfigured(),
        month: summary.label,
        total: summary.total,
        people: summary.people,
        message: bonusSlackPayload(summary),
      });
    }
    const { summary, delivered } = await sendBonusSummary(month);
    return NextResponse.json({
      ok: true,
      sent: delivered,
      slackConfigured: bonusSlackConfigured(),
      month: summary.label,
      total: summary.total,
      people: summary.people,
    });
  } catch (err) {
    console.error("Resumo dos bónus falhou:", err);
    return NextResponse.json({ error: "Não foi possível construir o resumo dos bónus." }, { status: 500 });
  }
}
