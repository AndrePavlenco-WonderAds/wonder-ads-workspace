import { CheckCircle2, XCircle, FileText, Sparkles } from "lucide-react";
import type { ClientBrief as Brief } from "@/lib/client-briefs";
import { hasAnyBriefContent } from "@/lib/client-briefs";

export function ClientBrief({
  brief,
  clientName,
}: {
  brief: Brief;
  clientName: string;
}) {
  const hasContent = hasAnyBriefContent(brief);

  return (
    <section
      aria-label={`Client brief for ${clientName}`}
      className="relative"
    >
      <header className="mb-5 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-white/55" strokeWidth={2.25} />
        <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-white/55">
          Client Brief
        </h2>
        {!hasContent && (
          <span className="ml-2 rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-white/45">
            Not set
          </span>
        )}
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BriefPanel
          tone="do"
          title="Do's"
          items={brief.dos}
          clientName={clientName}
        />
        <BriefPanel
          tone="dont"
          title="Don'ts"
          items={brief.donts}
          clientName={clientName}
        />
      </div>

      {brief.notes.length > 0 && (
        <div className="mt-4">
          <NotesPanel items={brief.notes} />
        </div>
      )}
    </section>
  );
}

function BriefPanel({
  tone,
  title,
  items,
  clientName,
}: {
  tone: "do" | "dont";
  title: string;
  items: string[];
  clientName: string;
}) {
  const isDo = tone === "do";
  const Icon = isDo ? CheckCircle2 : XCircle;

  const accentBg = isDo ? "bg-emerald-500/[0.06]" : "bg-rose-500/[0.06]";
  const accentBorder = isDo
    ? "border-emerald-500/25"
    : "border-rose-500/25";
  const accentText = isDo ? "text-emerald-300" : "text-rose-300";
  const accentDot = isDo ? "bg-emerald-400" : "bg-rose-400";
  const accentGlow = isDo
    ? "shadow-[0_8px_30px_-12px_rgba(16,185,129,0.55)]"
    : "shadow-[0_8px_30px_-12px_rgba(244,63,94,0.55)]";
  const accentLine = isDo
    ? "from-transparent via-emerald-400/70 to-transparent"
    : "from-transparent via-rose-400/70 to-transparent";

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border ${accentBorder} ${accentBg} ${accentGlow} p-6 backdrop-blur-md transition-all duration-500 hover:-translate-y-0.5`}
    >
      {/* Top accent line */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accentLine}`}
      />
      {/* Soft corner glow */}
      <span
        aria-hidden
        className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-30 blur-3xl ${
          isDo ? "bg-emerald-500" : "bg-rose-500"
        }`}
      />

      <header className="relative flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Icon className={`h-5 w-5 ${accentText}`} strokeWidth={2.25} />
          <h3 className="text-lg font-semibold tracking-tight text-white">
            {title}
          </h3>
        </div>
        <span
          className={`text-[10px] font-bold uppercase tracking-[0.18em] ${accentText} opacity-75`}
        >
          {items.length}
        </span>
      </header>

      {items.length === 0 ? (
        <p className="relative mt-4 text-sm text-white/45">
          No {title.toLowerCase()} set for {clientName} yet.
          <br />
          <span className="text-white/30">
            Ask Claude to populate this in the next push.
          </span>
        </p>
      ) : (
        <ul className="relative mt-4 space-y-2.5">
          {items.map((item, i) => (
            <li
              key={i}
              className="flex gap-2.5 text-sm leading-relaxed text-white/85 sm:text-base"
            >
              <span
                aria-hidden
                className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${accentDot}`}
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function NotesPanel({ items }: { items: string[] }) {
  return (
    <article className="brand-gradient-border relative rounded-2xl bg-white/[0.035] p-6 backdrop-blur-md">
      <header className="flex items-center gap-2.5">
        <FileText className="h-4 w-4 text-white/65" strokeWidth={2.25} />
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/65">
          Notes
        </h3>
      </header>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-white/75 sm:text-base">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2.5">
            <span
              aria-hidden
              className="brand-gradient-bg mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
