// In-app surface for the Blog Article Writer Pro agent's rules.
//
// Renders the EXACT same constants the agent receives in its system
// prompt — collapsible cards keyed by topic so the consultant can
// reference them while filling the form. One source of truth: edit
// lib/blog-writer-prompt.ts and the agent + the panel stay in sync.

import { MarkdownView } from "./markdown-view";
import {
  BLOG_WRITER_LANGUAGE_RULE,
  BLOG_WRITER_BRIEF_CHECK,
  BLOG_WRITER_STANDARD,
  BLOG_WRITER_PROCESS,
  BLOG_WRITER_OUTPUT_FORMAT,
} from "@/lib/blog-writer-prompt";

const SECTIONS: Array<{
  id: string;
  emoji: string;
  title: string;
  blurb: string;
  body: string;
  defaultOpen?: boolean;
}> = [
  {
    id: "language",
    emoji: "🌍",
    title: "Language rule — absolute",
    blurb:
      "American English for EN clients · European Portuguese (pt-PT) from Portugal for PT clients · NEVER Brazilian.",
    body: BLOG_WRITER_LANGUAGE_RULE,
    defaultOpen: true,
  },
  {
    id: "brief",
    emoji: "🛡️",
    title: "Client brief — triple check",
    blurb:
      "The agent verifies Do's / Don'ts / Notes three times — before, during, after — and self-reports.",
    body: BLOG_WRITER_BRIEF_CHECK,
  },
  {
    id: "standard",
    emoji: "📝",
    title: "WonderAds writing standard",
    blurb:
      "Keywords · headings · intro · lists · internal & external linking · meta · CTAs · images · tone.",
    body: BLOG_WRITER_STANDARD,
  },
  {
    id: "process",
    emoji: "🧭",
    title: "Process — research → references → links → draft → audit",
    blurb:
      "Five mandatory steps. References and internal-linking are non-optional planning stages, not afterthoughts.",
    body: BLOG_WRITER_PROCESS,
  },
  {
    id: "output",
    emoji: "📤",
    title: "Output format + brief-check appendix",
    blurb:
      "Publication-ready Markdown · slug + meta block · Working Notes + Brief Check appendix the consultant strips before publishing.",
    body: BLOG_WRITER_OUTPUT_FORMAT,
  },
];

export function BlogWriterStandardPanel() {
  return (
    <section
      aria-label="Blog Article Writer Pro — standard & process"
      className="mt-6 rounded-2xl border border-white/8 bg-white/[0.025] p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
            Blog Article Writer Pro — what the agent always does
          </h2>
          <p className="mt-1.5 max-w-2xl text-[12.5px] leading-snug text-white/55">
            This is the EXACT rule-set the agent receives in its system
            prompt. Edit{" "}
            <code className="rounded bg-white/[0.06] px-1 py-px text-[11px] text-white/80">
              lib/blog-writer-prompt.ts
            </code>{" "}
            and both the agent and this panel update together — one
            source of truth.
          </p>
        </div>
        <span className="hidden shrink-0 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200 md:inline-flex">
          Specialist agent
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {SECTIONS.map((s) => (
          <details
            key={s.id}
            open={s.defaultOpen}
            className="group rounded-xl border border-white/8 bg-black/20 open:bg-black/30"
          >
            <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 text-left transition hover:bg-white/[0.025]">
              <span
                aria-hidden
                className="mt-0.5 text-base leading-none"
              >
                {s.emoji}
              </span>
              <span className="flex-1">
                <span className="block text-[12.5px] font-semibold text-white">
                  {s.title}
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-white/55">
                  {s.blurb}
                </span>
              </span>
              <span
                aria-hidden
                className="mt-0.5 text-[11px] text-white/40 transition group-open:rotate-180"
              >
                ▾
              </span>
            </summary>
            <div className="border-t border-white/8 px-4 py-3">
              <MarkdownView source={s.body} />
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
