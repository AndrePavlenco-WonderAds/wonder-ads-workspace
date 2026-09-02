// Generate (or regenerate) a client's monthly report for a given period.
// Pulls GA4 + GSC live, assembles the snapshot, persists it. GBP + any
// non-instrumented lead events come back as "pending" and are filled via the
// manual-input step (PUT ../[period]) before the report is client-ready.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { getClientBySlug } from "@/lib/notion";
import { buildMonthlyReport } from "@/lib/report/report-build";
import { saveReport } from "@/lib/report/report-store";
import {
  getReportConfig,
  saveReportConfig,
} from "@/lib/report/report-config-store";
import {
  isValidPeriodKey,
  isPeriodReportable,
  previousCompleteMonth,
} from "@/lib/report/report-dates";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const employee = await getCurrentEmployee();
  if (!employee || !editableDepts(employee).includes("seo")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const client = await getClientBySlug(slug).catch(() => null);
  if (!client) {
    return NextResponse.json({ error: "unknown client" }, { status: 404 });
  }

  // Any period the consultant asks for — the last CLOSED month (default) or
  // the month still in progress, which yields a month-to-date report.
  let period: string;
  let ecommerce: boolean | undefined;
  let lang: "pt" | "en" | undefined;
  let rememberKind = false;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      period?: unknown;
      /** Relatório e-commerce (tabela de conversão + páginas + produtos) em
       *  vez do normal. Sem isto, fica o tipo configurado do cliente. */
      ecommerce?: unknown;
      /** Idioma do relatório ("pt" | "en"). Sem isto, fica o configurado. */
      lang?: unknown;
      /** True só no gerador da página do cliente — as escolhas deliberadas
       *  (tipo + idioma) ficam gravadas no report-config para os meses
       *  seguintes. Regenerar um relatório antigo NÃO regrava nada. */
      rememberKind?: unknown;
    };
    period =
      typeof body.period === "string" && isValidPeriodKey(body.period)
        ? body.period
        : previousCompleteMonth().key;
    if (typeof body.ecommerce === "boolean") ecommerce = body.ecommerce;
    if (body.lang === "pt" || body.lang === "en") lang = body.lang;
    rememberKind = body.rememberKind === true;
  } catch {
    period = previousCompleteMonth().key;
  }

  // A future month (or one whose first day hasn't cleared the data lag) has
  // nothing to pull — refuse rather than persist an all-zero report.
  if (!isPeriodReportable(period)) {
    return NextResponse.json(
      {
        error: "period_not_reportable",
        message:
          "Ainda não há dados para este período. Escolhe um mês já iniciado.",
      },
      { status: 400 },
    );
  }

  try {
    // As escolhas deliberadas do gerador ficam gravadas para os meses
    // seguintes; um "Regenerar" apenas fixa o tipo/idioma daquele relatório,
    // sem tocar no config do cliente.
    if (rememberKind && (ecommerce !== undefined || lang !== undefined)) {
      const config = await getReportConfig(slug);
      const patch: { ecommerce?: boolean; reportLang?: "pt" | "en" } = {};
      if (ecommerce !== undefined && config.ecommerce !== ecommerce) {
        patch.ecommerce = ecommerce;
      }
      if (lang !== undefined && config.reportLang !== lang) {
        patch.reportLang = lang;
      }
      if (Object.keys(patch).length > 0) {
        await saveReportConfig(slug, patch, Date.now());
      }
    }

    // Generating only pulls data + persists the draft. The #client-wins
    // announcement is deliberately NOT fired here — it fires when the
    // consultant clicks "Finalizar" (see ../[period]/finalize), after the
    // manual data is filled in.
    const snapshot = await buildMonthlyReport(
      slug,
      client.title,
      period,
      Date.now(),
      {
        ...(ecommerce !== undefined ? { ecommerce } : {}),
        ...(lang !== undefined ? { lang } : {}),
      },
    );
    await saveReport(snapshot);
    revalidatePath(`/seo/${slug}`);
    revalidatePath(`/seo/${slug}/report/${period}`);
    return NextResponse.json({
      ok: true,
      period,
      status: snapshot.status,
      fetch: snapshot.fetch,
    });
  } catch (err) {
    console.error("monthly report generate failed:", err);
    return NextResponse.json(
      { error: "generate_failed", message: err instanceof Error ? err.message : "failed" },
      { status: 500 },
    );
  }
}
