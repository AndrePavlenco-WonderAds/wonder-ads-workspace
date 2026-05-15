"use client";

import { useEffect, useRef, useState } from "react";
import {
  Zap,
  FileText,
  Globe,
  MapPin,
  PenLine,
  Gauge,
  ArrowRight,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

type Pillar = {
  name: string;
  Icon: LucideIcon;
  blurb: string;
  actions: string[];
  fullWidth?: boolean;
};

// The SEO action playbook. Each action will wire to SEO Claude in a later
// version — for now they're the catalogue of one-click workflows.
const PILLARS: Pillar[] = [
  {
    name: "Overall SEO",
    Icon: Gauge,
    blurb: "High-level audits and strategic research.",
    actions: ["SEO Audit", "Keyword Research"],
    fullWidth: true,
  },
  {
    name: "On-Page SEO",
    Icon: FileText,
    blurb: "Optimise what's on the page itself.",
    actions: [
      "Generate Header Tags",
      "Meta Title & Description",
      "Image Alt Text",
      "Internal Linking Suggestions",
      "Schema Markup (JSON-LD)",
      "Content Gap Analysis",
    ],
  },
  {
    name: "Off-Page SEO",
    Icon: Globe,
    blurb: "Build authority from outside the site.",
    actions: [
      "Find Backlink Directories",
      "Outreach Email Drafts",
      "Competitor Backlink Gap",
      "Broken-Link Building",
      "Digital PR Angles",
    ],
  },
  {
    name: "Local SEO",
    Icon: MapPin,
    blurb: "Win the map pack and local searches.",
    actions: [
      "GMB Profile Audit",
      "GMB Posts Creation",
      "Local Citation Check",
      "GMB Reviews Responder",
    ],
  },
  {
    name: "Content",
    Icon: PenLine,
    blurb: "Plan and produce content that ranks.",
    actions: [
      "Write Blog Article",
      "Content Calendar",
      "Blog Roadmap",
      "Refresh Existing Content",
      "FAQ Section Generator",
    ],
  },
];

export function SeoActions({ clientName }: { clientName: string }) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      id="section-actions"
      aria-label="SEO actions"
      className="scroll-mt-8"
    >
      <header className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Zap className="h-4 w-4 text-white/55" strokeWidth={2.25} />
        <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-white/55">
          Actions
        </h2>
        <span className="text-xs text-white/35">
          One-click SEO workflows for {clientName} — wiring to SEO Claude in
          upcoming versions.
        </span>
      </header>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {PILLARS.map((pillar, pi) => (
          <PillarCard
            key={pillar.name}
            pillar={pillar}
            shown={shown}
            pillarIndex={pi}
          />
        ))}
      </div>
    </section>
  );
}

function PillarCard({
  pillar,
  shown,
  pillarIndex,
}: {
  pillar: Pillar;
  shown: boolean;
  pillarIndex: number;
}) {
  const { Icon } = pillar;
  return (
    <article
      className={`brand-gradient-border relative overflow-hidden rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md${
        pillar.fullWidth ? " md:col-span-2" : ""
      }`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--brand-gradient)" }}
      />

      <header className="relative flex items-center gap-3">
        <span
          aria-hidden
          className="brand-gradient-bg flex h-9 w-9 items-center justify-center rounded-xl shadow-[0_4px_18px_-4px_rgba(120,61,245,0.55)]"
        >
          <Icon className="h-4 w-4 text-white" strokeWidth={2.25} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-white">
            {pillar.name}
          </h3>
          <p className="truncate text-[11px] text-white/45">{pillar.blurb}</p>
        </div>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
          {pillar.actions.length}
        </span>
      </header>

      <ol
        className={`mt-4 ${
          pillar.fullWidth
            ? "grid grid-cols-1 gap-2 md:grid-cols-2"
            : "space-y-2"
        }`}
      >
        {pillar.actions.map((action, ai) => (
          <li key={action}>
            <button
              type="button"
              title="Coming soon — wired to SEO Claude"
              style={{
                transitionDelay: shown
                  ? `${pillarIndex * 90 + ai * 70}ms`
                  : "0ms",
              }}
              className={`group relative flex w-full items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] py-1.5 pl-1.5 pr-3 text-left transition-all duration-500 ease-out hover:border-[color:var(--brand-purple)]/45 hover:bg-white/[0.06] ${
                shown
                  ? "translate-y-0 opacity-100"
                  : "translate-y-3 opacity-0"
              }`}
            >
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/12 transition group-hover:bg-[color:var(--brand-purple)]/25 group-hover:ring-[color:var(--brand-purple)]/45"
              >
                <Sparkles
                  className="h-3.5 w-3.5 text-white/65 transition group-hover:text-white"
                  strokeWidth={2.25}
                />
              </span>
              <span className="flex-1 truncate text-sm font-medium text-white/85 transition group-hover:text-white">
                {action}
              </span>
              <ArrowRight
                className="h-3.5 w-3.5 shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-white/60"
                aria-hidden
              />
            </button>
          </li>
        ))}
      </ol>
    </article>
  );
}
