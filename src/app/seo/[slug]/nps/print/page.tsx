// Print-friendly (light theme) NPS answers sheet — all survey questions
// with the client's most recent answers. Opened in a new tab from the NPS
// management page; auto-fires the print dialog so it behaves like a PDF
// download. Consultant-only (behind the app auth + a dept check).

import { notFound } from "next/navigation";
import { getClientBySlug } from "@/lib/notion";
import { getNpsRecord } from "@/lib/nps-store";
import {
  NPS_SECTIONS,
  isScale10,
  isSingle,
  isMulti,
} from "@/lib/nps-questions";
import { pickLang } from "@/lib/public-i18n";
import { getCurrentEmployee } from "@/lib/auth/server";
import { accessibleDepts } from "@/lib/auth/credentials";
import { formatDateTime } from "@/lib/dates";
import { NpsPrintToolbar } from "@/components/nps-print-toolbar";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  promoter: "Promoter",
  passive: "Passive",
  detractor: "Detractor",
};

const PRINT_CSS = `
  .nps-print-root {
    background:#ffffff; color:#1b2430;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  @media print {
    .no-print { display:none !important; }
    body { background:#ffffff !important; }
    .nps-print-card { break-inside: avoid; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
`;

const PURPLE = "#783DF5";

export default async function NpsPrintPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const employee = await getCurrentEmployee();
  if (!employee || !accessibleDepts(employee).includes("seo")) notFound();

  const client = await getClientBySlug(slug).catch(() => null);
  if (!client) notFound();

  const record = await getNpsRecord(slug);
  const latest = record.submissions[0] ?? null;
  const lang = pickLang(slug);

  const filename = `NPS ${client.title} — Respostas`;

  return (
    <div className="nps-print-root min-h-screen px-4 py-8 sm:px-6">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <NpsPrintToolbar title={filename} />

      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <header className="flex items-start justify-between border-b border-black/10 pb-5">
          <div>
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: "#A9834F" }}
            >
              Avaliação de Satisfação · SEO
            </span>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-black/85">
              {client.title}
            </h1>
            {latest && (
              <p className="mt-1 text-[12px] text-black/50">
                Respondido em {formatDateTime(latest.submittedAt)}
                {latest.identification ? ` · ${latest.identification}` : ""}
                {latest.consultant ? ` · Consultor: ${latest.consultant}` : ""}
              </p>
            )}
          </div>
          <div
            className="text-lg font-semibold"
            style={{
              background:
                "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
            }}
          >
            Wonder Ads
          </div>
        </header>

        {!latest ? (
          <p className="mt-8 text-sm text-black/50">
            Este cliente ainda não tem respostas ao inquérito.
          </p>
        ) : (
          <>
            {/* Scores */}
            <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ScoreTile label="Global" value={`${latest.scores.overall.toFixed(1)}/10`} />
              <ScoreTile
                label="Continuidade"
                value={`${latest.scores.nps}/10`}
                sub={CATEGORY_LABEL[latest.scores.category]}
              />
              <ScoreTile
                label="Satisfação"
                value={`${latest.scores.satisfaction.toFixed(1)}/10`}
              />
              <ScoreTile
                label="Consultor"
                value={`${latest.scores.consultant.toFixed(1)}/10`}
              />
            </section>

            {/* Questions + answers */}
            <section className="mt-8 space-y-6">
              {NPS_SECTIONS.filter((s) => s.questions.length > 0).map(
                (section) => (
                  <div key={section.key} className="nps-print-card">
                    <div className="mb-3 flex items-baseline gap-2 border-b border-black/10 pb-1.5">
                      <span
                        className="font-mono text-[10px] tracking-widest"
                        style={{ color: "#783DF5" }}
                      >
                        {section.tag}
                      </span>
                      <span className="text-sm font-semibold text-black/80">
                        {section.title[lang]}
                      </span>
                    </div>
                    <div className="space-y-3.5">
                      {section.questions.map((q) => (
                        <div key={q.name}>
                          <p className="text-[13px] font-semibold leading-snug text-black/80">
                            {q.q[lang]}
                          </p>
                          <div className="mt-2 text-[13px] text-black/85">
                            <Answer q={q} latest={latest} lang={lang} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ),
              )}
            </section>
          </>
        )}

        <footer className="mt-10 border-t border-black/10 pt-4 text-center text-[11px] text-black/40">
          Wonder Ads · Avaliação de satisfação do cliente
        </footer>
      </div>
    </div>
  );
}

function ScoreTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-[#f8f7f2] px-3.5 py-3">
      <p className="text-[10px] uppercase tracking-wide text-black/45">{label}</p>
      <p className="mt-0.5 text-xl font-semibold text-black/85">{value}</p>
      {sub && <p className="text-[11px] text-black/50">{sub}</p>}
    </div>
  );
}

/** A print-safe tick box (square = checkbox, round = radio). */
function Box({ checked, radio }: { checked: boolean; radio?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 15,
        height: 15,
        flexShrink: 0,
        borderRadius: radio ? "50%" : 4,
        border: checked ? "1px solid transparent" : "1.5px solid rgba(0,0,0,0.28)",
        background: checked ? PURPLE : "#ffffff",
        color: "#ffffff",
        fontSize: 10,
        lineHeight: 1,
        fontWeight: 700,
      }}
    >
      {checked ? "✓" : ""}
    </span>
  );
}

/** A filled-form view of one answer: the 0–10 scale with the chosen number
 *  highlighted, option lists with real tick boxes, or the open text. */
function Answer({
  q,
  latest,
  lang,
}: {
  q: (typeof NPS_SECTIONS)[number]["questions"][number];
  latest: NonNullable<Awaited<ReturnType<typeof getNpsRecord>>["submissions"][number]>;
  lang: ReturnType<typeof pickLang>;
}) {
  if (isScale10(q)) {
    const v = latest.answers[q.name];
    return (
      <div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(11, 1fr)",
            gap: 4,
            maxWidth: 380,
          }}
        >
          {Array.from({ length: 11 }, (_, n) => {
            const sel = v === n;
            return (
              <span
                key={n}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 26,
                  borderRadius: 6,
                  border: sel ? "1px solid transparent" : "1px solid rgba(0,0,0,0.15)",
                  background: sel ? PURPLE : "#ffffff",
                  color: sel ? "#ffffff" : "rgba(0,0,0,0.5)",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {n}
              </span>
            );
          })}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            maxWidth: 380,
            marginTop: 3,
            fontSize: 10,
            color: "rgba(0,0,0,0.45)",
          }}
        >
          <span>0 · {q.capLow[lang]}</span>
          <span>10 · {q.capHigh[lang]}</span>
        </div>
      </div>
    );
  }

  if (isSingle(q)) {
    const picked = latest.choices?.[q.name]?.[0];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {q.options.map((o) => {
          const on = picked === o.value;
          return (
            <div
              key={o.value}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                fontWeight: on ? 600 : 400,
                color: on ? "#1b2430" : "rgba(0,0,0,0.5)",
              }}
            >
              <Box checked={on} radio />
              <span>
                {o.label[lang]}
                {o.note ? (
                  <span style={{ color: "#A9834F", fontWeight: 400 }}>
                    {" "}
                    — {o.note[lang]}
                  </span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  if (isMulti(q)) {
    const chosen = latest.choices?.[q.name] ?? [];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {q.options.map((o) => {
          const on = chosen.includes(o.value);
          return (
            <div
              key={o.value}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontWeight: on ? 600 : 400,
                color: on ? "#1b2430" : "rgba(0,0,0,0.45)",
              }}
            >
              <Box checked={on} />
              <span>{o.label[lang]}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // open
  const text = latest.texts?.[q.name];
  return text ? (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.12)",
        borderRadius: 8,
        background: "#f8f7f2",
        padding: "8px 10px",
        fontStyle: "italic",
        color: "rgba(0,0,0,0.8)",
      }}
    >
      “{text}”
    </div>
  ) : (
    <span style={{ fontStyle: "italic", color: "rgba(0,0,0,0.4)" }}>
      Sem resposta
    </span>
  );
}
