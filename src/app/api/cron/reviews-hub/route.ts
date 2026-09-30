// Cron do Reviews Hub (a cada 30 min, ver vercel.json): sincroniza as
// reviews de cada cliente com hub e corre a automação das respostas.
//
// Vem da Vercel com `Authorization: Bearer $CRON_SECRET`. Sem CRON_SECRET, só
// um SuperAdmin com sessão abre a porta — é um endpoint que publica no Google
// em nome do cliente.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { runAutomation } from "@/lib/reviews-hub/automation";
import { hubSlugs } from "@/lib/reviews-hub/config";
import { hubStoreConfigured } from "@/lib/reviews-hub/store";
import { syncReviews } from "@/lib/reviews-hub/sync";

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
  if (!hubStoreConfigured) {
    return NextResponse.json({ error: "KV não configurado." }, { status: 503 });
  }
  const out: Record<string, unknown> = {};
  for (const slug of hubSlugs()) {
    try {
      const sync = await syncReviews(slug);
      // A automação só corre sobre dados frescos: se a sync falhou (ou há
      // outra a correr), fica para a próxima volta.
      const automation = sync.status === "ok" ? await runAutomation(slug) : null;
      out[slug] = {
        sync: sync.status,
        error: sync.status === "error" ? sync.state.error : null,
        newReviews: sync.status === "ok" ? sync.newReviews.length : 0,
        automation,
      };
    } catch (err) {
      console.error(`[reviews-hub] cron failed for ${slug}:`, err);
      out[slug] = { error: err instanceof Error ? err.message : String(err) };
    }
  }
  return NextResponse.json({ ok: true, clients: out });
}
