import {
  Sparkles,
  PenLine,
  FileText,
  Search,
  ClipboardCheck,
  Link as LinkIcon,
  Code2,
  ArrowRight,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  type LucideIcon,
} from "lucide-react";

type QuickAction = {
  Icon: LucideIcon;
  label: string;
  description: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    Icon: PenLine,
    label: "Write SEO Blog",
    description: "Draft an article with Claude",
  },
  {
    Icon: FileText,
    label: "Meta Title & Description",
    description: "Generate on-page snippets",
  },
  {
    Icon: Search,
    label: "Keyword Research",
    description: "Plan next topics",
  },
  {
    Icon: ClipboardCheck,
    label: "On-Page Audit",
    description: "Quick technical scan",
  },
  {
    Icon: LinkIcon,
    label: "Backlink Outreach",
    description: "Compose outreach emails",
  },
  {
    Icon: Code2,
    label: "Schema Markup",
    description: "Generate JSON-LD",
  },
];

export function SeoProjectContainers({
  clientName,
}: {
  clientName: string;
}) {
  return (
    <section
      aria-label="Project tools"
      className="grid grid-cols-1 gap-5 lg:grid-cols-3"
    >
      <QuickActions />
      <Ga4Placeholder clientName={clientName} />
      <KeywordsPlaceholder clientName={clientName} />
    </section>
  );
}

function PanelHeader({
  Icon,
  title,
  status,
}: {
  Icon: LucideIcon;
  title: string;
  status?: "ready" | "pending";
}) {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="brand-gradient-bg flex h-7 w-7 items-center justify-center rounded-lg shadow-[0_4px_18px_-4px_rgba(120,61,245,0.55)]"
        >
          <Icon className="h-3.5 w-3.5 text-white" strokeWidth={2.25} />
        </span>
        <h3 className="text-sm font-semibold tracking-tight text-white">
          {title}
        </h3>
      </div>
      {status === "pending" && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-amber-300/85">
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.7)]"
          />
          Not connected
        </span>
      )}
    </header>
  );
}

function QuickActions() {
  return (
    <article className="brand-gradient-border relative overflow-hidden rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-25 blur-3xl"
        style={{ background: "var(--brand-gradient)" }}
      />
      <PanelHeader Icon={Sparkles} title="Quick Actions" />
      <p className="mt-3 text-xs text-white/55">
        One-click tasks for SEO Claude.
      </p>
      <ul className="relative mt-4 space-y-1.5">
        {QUICK_ACTIONS.map((a) => (
          <li key={a.label}>
            <button
              type="button"
              disabled
              title="Coming soon — wired to SEO Claude in the next version"
              className="group flex w-full cursor-not-allowed items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2.5 text-left transition disabled:opacity-90"
            >
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/10"
              >
                <a.Icon
                  className="h-3.5 w-3.5 text-white/75"
                  strokeWidth={2.25}
                />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block truncate text-sm font-medium text-white">
                  {a.label}
                </span>
                <span className="block truncate text-[11px] text-white/50">
                  {a.description}
                </span>
              </span>
              <ArrowRight
                className="h-3.5 w-3.5 shrink-0 text-white/30"
                aria-hidden
              />
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

function Ga4Placeholder({ clientName }: { clientName: string }) {
  const metrics = [
    { label: "Users (30d)", trend: "up" as const },
    { label: "Sessions", trend: "up" as const },
    { label: "Engagement", trend: "flat" as const },
    { label: "Conversions", trend: "down" as const },
  ];

  return (
    <article className="brand-gradient-border relative overflow-hidden rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-emerald-500/40 opacity-20 blur-3xl"
      />
      <PanelHeader Icon={BarChart3} title="GA4 Metrics" status="pending" />
      <p className="mt-3 text-xs text-white/55">
        Live traffic and conversions for {clientName}.
      </p>

      <div className="relative mt-4 grid grid-cols-2 gap-2.5">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-white/8 bg-white/[0.025] p-3"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/40">
              {m.label}
            </p>
            <div className="mt-1.5 flex items-end justify-between gap-2">
              <span className="text-lg font-bold tracking-tight text-white/40">
                ——
              </span>
              {m.trend === "up" && (
                <TrendingUp
                  className="h-3.5 w-3.5 text-emerald-400/50"
                  aria-hidden
                />
              )}
              {m.trend === "down" && (
                <TrendingDown
                  className="h-3.5 w-3.5 text-rose-400/50"
                  aria-hidden
                />
              )}
              {m.trend === "flat" && (
                <Minus
                  className="h-3.5 w-3.5 text-white/30"
                  aria-hidden
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="relative mt-4">
        <Sparkline />
      </div>

      <p className="relative mt-3 text-[11px] text-white/35">
        Connecting via GA4 Data API — coming in a future version.
      </p>
    </article>
  );
}

function Sparkline() {
  // Static ghost sparkline — purely decorative.
  return (
    <svg
      viewBox="0 0 200 50"
      className="h-12 w-full"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#34D399" stopOpacity="0.18" />
          <stop offset="1" stopColor="#34D399" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 35 Q 20 25, 40 28 T 80 18 T 120 22 T 160 12 T 200 16 L 200 50 L 0 50 Z"
        fill="url(#spark-fill)"
      />
      <path
        d="M0 35 Q 20 25, 40 28 T 80 18 T 120 22 T 160 12 T 200 16"
        stroke="#34D399"
        strokeWidth="1.25"
        strokeOpacity="0.65"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function KeywordsPlaceholder({ clientName }: { clientName: string }) {
  const rows = [
    { rank: 1, change: 2 },
    { rank: 2, change: 0 },
    { rank: 3, change: -1 },
    { rank: 4, change: 5 },
    { rank: 5, change: -2 },
  ];

  return (
    <article className="brand-gradient-border relative overflow-hidden rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-amber-500/40 opacity-20 blur-3xl"
      />
      <PanelHeader Icon={Search} title="Tracked Keywords" status="pending" />
      <p className="mt-3 text-xs text-white/55">
        Live ranking positions for {clientName}.
      </p>
      <ul className="relative mt-4 space-y-1.5">
        {rows.map((r, i) => (
          <li
            key={i}
            className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2"
          >
            <span
              aria-hidden
              className="brand-gradient-bg h-1.5 w-1.5 shrink-0 rounded-full opacity-40"
            />
            <span className="flex-1 truncate text-sm font-medium text-white/40">
              ————————
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/35">
              #{r.rank}
            </span>
            {r.change > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-400/60">
                <TrendingUp className="h-3 w-3" />
                {r.change}
              </span>
            )}
            {r.change < 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-400/60">
                <TrendingDown className="h-3 w-3" />
                {Math.abs(r.change)}
              </span>
            )}
            {r.change === 0 && (
              <span className="inline-flex items-center text-[10px] font-bold text-white/30">
                <Minus className="h-3 w-3" />
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="relative mt-3 text-[11px] text-white/35">
        Connecting via DataForSEO — coming in a future version.
      </p>
    </article>
  );
}
