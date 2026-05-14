import {
  Sparkles,
  PenLine,
  FileText,
  Search,
  ClipboardCheck,
  Link as LinkIcon,
  Code2,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { TrackedKeywords } from "./tracked-keywords";
import { Ga4Metrics } from "./ga4-metrics";

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
  slug,
  clientName,
}: {
  slug: string;
  clientName: string;
}) {
  return (
    <section
      aria-label="Project tools"
      className="grid grid-cols-1 gap-5 lg:grid-cols-3"
    >
      <QuickActions />
      <Ga4Metrics slug={slug} clientName={clientName} />
      <TrackedKeywords slug={slug} clientName={clientName} />
    </section>
  );
}

function PanelHeader({ Icon, title }: { Icon: LucideIcon; title: string }) {
  return (
    <header className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="brand-gradient-bg flex h-7 w-7 items-center justify-center rounded-lg shadow-[0_4px_18px_-4px_rgba(120,61,245,0.55)]"
      >
        <Icon className="h-3.5 w-3.5 text-white" strokeWidth={2.25} />
      </span>
      <h3 className="text-sm font-semibold tracking-tight text-white">
        {title}
      </h3>
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


