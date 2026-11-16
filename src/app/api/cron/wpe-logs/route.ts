// Cron dos registos do WP Engine (todos os dias às 04:30 UTC, ver
// vercel.json): o WP Engine copia os registos NGINX do dia anterior para o
// nosso bucket S3 por volta das 02:00 UTC; aqui lê-se cada ficheiro novo e
// guardam-se em KV as visitas das IAs (lib/report/wpe-logs.ts).
//
// Vem da Vercel com `Authorization: Bearer $CRON_SECRET`. Sem CRON_SECRET,
// só um SuperAdmin com sessão (para correr à mão).

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { syncWpeLogs, wpeLogsCreds } from "@/lib/report/wpe-logs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
  if (!wpeLogsCreds()) {
    return NextResponse.json({ ok: true, skipped: "WPE_LOGS_* por configurar na Vercel." });
  }
  try {
    const installs = await syncWpeLogs();
    return NextResponse.json({ ok: true, installs });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
