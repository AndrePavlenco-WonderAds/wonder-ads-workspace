// Finalise a monthly report: the explicit step the consultant takes AFTER
// filling in the manual data. Only here (never on generate) do we announce the
// month's wins to #client-wins, and only here does the report unlock its
// client-facing actions (PDF, public link, send-for-approval). Finalising is
// re-runnable — every finalise re-announces (Andre: "em todas as gerações").

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { getReport, saveReport } from "@/lib/report/report-store";
import { recomputeDerived } from "@/lib/report/report-build";
import { notifyClientWin } from "@/lib/report/report-win-slack";
import {
  ECOM_METRIC_KEYS,
  isEcomCellUnresolved,
  isUnresolved,
  kwTrackingIssues,
} from "@/lib/report/report-types";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string; period: string }> },
) {
  const { slug, period } = await params;

  const employee = await getCurrentEmployee();
  if (!employee || !editableDepts(employee).includes("seo")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const snap = await getReport(slug, period);
  if (!snap) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Recompute first so the completeness check sees the latest manual edits, then
  // refuse to finalise while any lead metric is still unresolved (not filled,
  // not N/A) — that's exactly the data the consultant must complete first.
  const recomputed = recomputeDerived(snap);
  const pending = recomputed.leads.channels.filter((c) => isUnresolved(c.metric));
  // Relatório e-commerce: a coluna do MÊS DO RELATÓRIO da tabela de conversão
  // também tem de estar resolvida (valor ou N/A) — é a que o cliente lê como
  // «o resultado do mês». As colunas de contexto podem ficar a «—».
  const ecomCurrent = recomputed.ecom?.columns.find(
    (c) => !c.yoy && c.key === recomputed.period,
  );
  const ecomPending = ecomCurrent
    ? ECOM_METRIC_KEYS.filter((k) =>
        isEcomCellUnresolved(ecomCurrent.cells[k]),
      ).map((k) => `Conversão · ${k}`)
    : [];
  // Keyword tracking (v77.82): as 15 keywords escolhidas, com Semrush e
  // Search Console verificados. Os relatórios antigos não têm o bloco.
  const kwPending = kwTrackingIssues(recomputed.kwTracking);
  if (pending.length > 0 || ecomPending.length > 0 || kwPending.length > 0) {
    return NextResponse.json(
      {
        error: "incomplete",
        pending: [...pending.map((c) => c.label), ...ecomPending, ...kwPending],
      },
      { status: 400 },
    );
  }

  const finalized = { ...recomputed, finalizedAt: Date.now() };

  // Sem revalidatePath (v77.83): as páginas do relatório são force-dynamic e
  // leem o KV direto, e o botão já faz router.refresh(). O revalidatePath só
  // invalidava a lista de clientes da Notion (unstable_cache) para esta rota,
  // e o refresh a seguir ia buscá-la toda outra vez — com várias gravações
  // seguidas a Notion respondia 429 e a página rebentava.
  try {
    await saveReport(finalized);
  } catch (err) {
    console.error("report finalize save failed:", err);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  // Announce the month's wins. Fires on EVERY finalise. Never throws and is a
  // silent no-op until SLACK_CLIENT_WINS_WEBHOOK_URL is set, so a Slack outage
  // (or an unconfigured webhook) can never fail the finalise.
  const announced = await notifyClientWin(finalized, new URL(req.url).origin);

  return NextResponse.json({
    ok: true,
    announced,
    finalizedAt: finalized.finalizedAt,
    status: finalized.status,
  });
}
