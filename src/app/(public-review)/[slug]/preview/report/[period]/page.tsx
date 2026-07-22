// Public, read-only client view of a monthly report. Chrome-less (see the
// (public-review) layout), noindex, "the URL is the secret" access model — same
// as the other preview pages. Renders the branded document in client variant
// (pending / não-instrumentado metrics hidden). A still-draft report shows a
// polite "in preparation" placeholder instead of a half-filled document.

import { notFound } from "next/navigation";
import { getReport } from "@/lib/report/report-store";
import { isValidPeriodKey, periodFromKey } from "@/lib/report/report-dates";
import { ReportDocument } from "@/components/report/report-document";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; period: string }>;
}) {
  const { period } = await params;
  const label = isValidPeriodKey(period) ? periodFromKey(period).label : period;
  return { title: `Relatório ${label} · Wonder Ads`, robots: { index: false, follow: false } };
}

export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ slug: string; period: string }>;
}) {
  const { slug, period } = await params;
  if (!isValidPeriodKey(period)) notFound();

  const snapshot = await getReport(slug, period);
  if (!snapshot) notFound();

  const label = periodFromKey(period).label;

  return (
    <main style={{ maxWidth: "760px", margin: "0 auto", padding: "24px 16px 64px" }}>
      {snapshot.status === "draft" ? (
        <div
          style={{
            background: "#fff",
            border: "1px solid rgba(0,0,0,.08)",
            borderRadius: 14,
            padding: "48px 28px",
            textAlign: "center",
            color: "#45435c",
            boxShadow: "0 20px 60px -30px rgba(23,22,45,.35)",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              margin: "0 auto 16px",
              borderRadius: 12,
              background: "linear-gradient(135deg,#343ED7,#783DF5,#C535C9)",
            }}
          />
          <h1 style={{ fontSize: 20, margin: "0 0 6px", color: "#1a1a24" }}>
            Relatório em preparação
          </h1>
          <p style={{ margin: 0, fontSize: 14 }}>
            O relatório de {label} está a ser finalizado. Voltamos a partilhar assim
            que estiver pronto.
          </p>
        </div>
      ) : (
        <ReportDocument snapshot={snapshot} variant="client" />
      )}
    </main>
  );
}
