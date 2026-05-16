"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Check,
  Pencil,
  Sparkles,
  X,
} from "lucide-react";
import { PILLARS, findAction } from "@/lib/seo-pillars";
import {
  moveQuickAction,
  setQuickActions,
  toggleQuickAction,
  useQuickActions,
} from "@/lib/quick-actions-store";

export function QuickActionsPanel({ clientSlug }: { clientSlug: string }) {
  const pinned = useQuickActions();
  const [editing, setEditing] = useState(false);

  return (
    <article className="brand-gradient-border relative overflow-hidden rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-25 blur-3xl"
        style={{ background: "var(--brand-gradient)" }}
      />

      <header className="relative flex items-center gap-2.5">
        <span
          aria-hidden
          className="brand-gradient-bg flex h-7 w-7 items-center justify-center rounded-lg shadow-[0_4px_18px_-4px_rgba(120,61,245,0.55)]"
        >
          <Sparkles className="h-3.5 w-3.5 text-white" strokeWidth={2.25} />
        </span>
        <h3 className="text-sm font-semibold tracking-tight text-white">
          Quick Actions
        </h3>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/70 transition hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
          aria-pressed={editing}
        >
          {editing ? (
            <>
              <Check className="h-3 w-3" strokeWidth={2.5} />
              Done
            </>
          ) : (
            <>
              <Pencil className="h-3 w-3" strokeWidth={2.25} />
              Edit
            </>
          )}
        </button>
      </header>

      <p className="relative mt-3 text-xs text-white/55">
        {editing
          ? "Toggle which actions appear here. Reorder pinned ones with the arrows."
          : "One-click tasks for SEO Claude."}
      </p>

      {editing ? (
        <EditList pinned={pinned} />
      ) : (
        <DisplayList pinned={pinned} clientSlug={clientSlug} />
      )}
    </article>
  );
}

function DisplayList({
  pinned,
  clientSlug,
}: {
  pinned: string[];
  clientSlug: string;
}) {
  if (pinned.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-xs text-white/45">
        No Quick Actions pinned yet. Click <span className="text-white/75">Edit</span> to add some.
      </div>
    );
  }
  return (
    <ul className="relative mt-4 space-y-1.5">
      {pinned.map((slug) => {
        const entry = findAction(slug);
        if (!entry) return null;
        const { Icon } = entry.pillar;
        return (
          <li key={slug}>
            <Link
              href={`/seo/${clientSlug}/actions/${entry.action.slug}`}
              className="group flex w-full items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2.5 text-left transition hover:border-[color:var(--brand-purple)]/45 hover:bg-white/[0.05]"
            >
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/10 transition group-hover:bg-[color:var(--brand-purple)]/25 group-hover:ring-[color:var(--brand-purple)]/45"
              >
                <Icon className="h-3.5 w-3.5 text-white/75 transition group-hover:text-white" strokeWidth={2.25} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block truncate text-sm font-medium text-white">
                  {entry.action.label}
                </span>
                <span className="block truncate text-[11px] text-white/50">
                  {entry.pillar.name}
                </span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white/60" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function EditList({ pinned }: { pinned: string[] }) {
  return (
    <div className="relative mt-4 space-y-4">
      <PinnedReorder pinned={pinned} />

      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
          All actions
        </p>
        {PILLARS.map((pillar) => {
          const { Icon } = pillar;
          return (
            <div key={pillar.name} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="flex h-5 w-5 items-center justify-center rounded-md bg-white/[0.06] ring-1 ring-white/10"
                >
                  <Icon className="h-3 w-3 text-white/75" strokeWidth={2.25} />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-white/70">
                  {pillar.name}
                </span>
              </div>
              <ul className="space-y-1 pl-1">
                {pillar.actions.map((action) => {
                  const isPinned = pinned.includes(action.slug);
                  return (
                    <li key={action.slug}>
                      <button
                        type="button"
                        onClick={() => toggleQuickAction(action.slug)}
                        className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
                          isPinned
                            ? "border-[color:var(--brand-purple)]/45 bg-[color:var(--brand-purple)]/15 text-white"
                            : "border-white/8 bg-white/[0.02] text-white/70 hover:border-white/20 hover:text-white"
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                            isPinned
                              ? "border-[color:var(--brand-purple)] bg-[color:var(--brand-purple)] text-white"
                              : "border-white/25 text-transparent"
                          }`}
                        >
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                        <span className="flex-1 truncate">{action.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setQuickActions([])}
        className="text-[11px] text-white/40 underline-offset-2 transition hover:text-white/70 hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}

function PinnedReorder({ pinned }: { pinned: string[] }) {
  if (pinned.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
        Pinned ({pinned.length})
      </p>
      <ul className="space-y-1">
        {pinned.map((slug, idx) => {
          const entry = findAction(slug);
          if (!entry) return null;
          const { Icon } = entry.pillar;
          return (
            <li
              key={slug}
              className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1.5"
            >
              <span
                aria-hidden
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/[0.06] ring-1 ring-white/10"
              >
                <Icon className="h-3 w-3 text-white/75" strokeWidth={2.25} />
              </span>
              <span className="flex-1 truncate text-xs text-white/85">
                {entry.action.label}
              </span>
              <button
                type="button"
                aria-label="Move up"
                disabled={idx === 0}
                onClick={() => moveQuickAction(slug, -1)}
                className="rounded p-1 text-white/45 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ArrowUp className="h-3 w-3" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                aria-label="Move down"
                disabled={idx === pinned.length - 1}
                onClick={() => moveQuickAction(slug, 1)}
                className="rounded p-1 text-white/45 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ArrowDown className="h-3 w-3" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                aria-label={`Remove ${entry.action.label}`}
                onClick={() => toggleQuickAction(slug)}
                className="rounded p-1 text-white/45 transition hover:bg-white/[0.06] hover:text-white"
              >
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
