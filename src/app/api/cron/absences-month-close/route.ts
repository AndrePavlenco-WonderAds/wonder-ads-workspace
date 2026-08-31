// O fecho do mês das ausências para o #ausencias — a mensagem do ÚLTIMO dia.
//
// QUEM CHAMA:
//   • O cron da Vercel, a 28, 29, 30 e 31 de cada mês às 17:00 UTC (ver
//     vercel.json — 18h em Lisboa no verão, 17h no inverno). A Vercel não
//     aceita «L» na expressão, por isso é AQUI que se pergunta se hoje é o
//     último dia do mês em Lisboa; nos outros dias a rota responde
//     `skipped` e não publica nada.
//   • Um superadmin, a partir do botão «Enviar agora» em /admin/ausencias —
//     para testar a mensagem sem esperar pelo fim do mês, ou para reenviar
//     um mês (o botão manda sempre ?year=&month=, o que salta a verificação
//     do dia).
//
// Sem CRON_SECRET configurado, só a sessão de superadmin abre a porta: um
// endpoint que publica no Slack da empresa não pode ficar aberto ao mundo
// só porque uma env está por preencher.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { absencesConfigured } from "@/lib/absences-store";
import {
  isLastDayOfMonth,
  lisbonToday,
  sendMonthClose,
} from "@/lib/absences-month-close";
import { ausenciasSlackConfigured } from "@/lib/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isAuthorised(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth === `Bearer ${secret}`) return true;
  }
  const employee = await getCurrentEmployee();
  return Boolean(employee?.isAdmin);
}

async function run(req: Request) {
  if (!(await isAuthorised(req))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!absencesConfigured) {
    return NextResponse.json(
      { error: "Armazenamento não configurado neste ambiente." },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const today = lisbonToday();
  const explicitMonth = url.searchParams.has("year") || url.searchParams.has("month");
  const force = explicitMonth || url.searchParams.get("force") === "1";

  // O cron bate à porta quatro dias seguidos; só num deles é o último do mês.
  if (!force && !isLastDayOfMonth(today.iso)) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: `Hoje (${today.iso}, Lisboa) não é o último dia do mês — nada enviado.`,
    });
  }

  const year = Number(url.searchParams.get("year")) || today.year;
  const month = Number(url.searchParams.get("month")) || today.month;
  if (month < 1 || month > 12 || year < 2020 || year > 2100) {
    return NextResponse.json({ error: "Mês inválido." }, { status: 400 });
  }

  try {
    const { overview, delivered, teamDelivered } = await sendMonthClose(year, month);
    return NextResponse.json({
      ok: true,
      delivered,
      teamDelivered,
      // Sem webhook configurado a mensagem não sai — mas o balanço é
      // calculado na mesma, e é isso que o botão do Control Suite mostra.
      slackConfigured: ausenciasSlackConfigured(),
      month: overview.label,
      totals: overview.totals,
    });
  } catch (err) {
    console.error("Fecho do mês das ausências falhou:", err);
    return NextResponse.json(
      { error: "Não foi possível construir o balanço." },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  return run(req);
}

/** O botão do Control Suite usa POST — escrever no Slack é um efeito, não
 *  uma leitura. (O cron da Vercel só faz GET.) */
export async function POST(req: Request) {
  return run(req);
}
