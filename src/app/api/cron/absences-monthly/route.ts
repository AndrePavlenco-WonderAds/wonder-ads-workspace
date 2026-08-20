// O resumo mensal de assiduidade para o #ausencias.
//
// QUEM CHAMA:
//   • O cron da Vercel, todo o dia 1 (ver vercel.json). Vem com o header
//     `Authorization: Bearer $CRON_SECRET`, que a Vercel injeta sozinha
//     quando a env existe.
//   • Um superadmin, a partir do botão «Enviar resumo agora» em /admin/faltas
//     — para testar a mensagem sem esperar pelo dia 1, ou para reenviar o mês
//     se a RH pedir.
//
// Por omissão o resumo é do MÊS QUE FECHOU (a 01/09 sai agosto). Os
// parâmetros ?year=&month= servem para reenviar um mês antigo.
//
// Sem CRON_SECRET configurado, só a sessão de superadmin abre a porta: um
// endpoint que publica no Slack da empresa não pode ficar aberto ao mundo
// só porque uma env está por preencher.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { absencesConfigured } from "@/lib/absences-store";
import { previousMonth, sendMonthlyDigest } from "@/lib/absences-monthly";
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
  const fallback = previousMonth(new Date());
  const year = Number(url.searchParams.get("year")) || fallback.year;
  const month = Number(url.searchParams.get("month")) || fallback.month;
  if (month < 1 || month > 12 || year < 2020 || year > 2100) {
    return NextResponse.json({ error: "Mês inválido." }, { status: 400 });
  }

  try {
    const { digest, delivered } = await sendMonthlyDigest(year, month);
    return NextResponse.json({
      ok: true,
      delivered,
      // Sem webhook configurado a mensagem não sai — mas o resumo é calculado
      // na mesma, e é isso que o botão do Control Suite mostra.
      slackConfigured: ausenciasSlackConfigured(),
      month: digest.label,
      people: digest.people.length,
      totals: digest.totals,
    });
  } catch (err) {
    console.error("Resumo mensal de assiduidade falhou:", err);
    return NextResponse.json(
      { error: "Não foi possível construir o resumo." },
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
