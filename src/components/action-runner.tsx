"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Clock,
  Loader2,
  Play,
  Trash2,
  Sparkles,
  ClipboardList,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import type { ActionDef } from "@/lib/seo-pillars";
import type { HistoryEntry } from "@/lib/action-history";
import { makeResultId, formatDisplayResultId } from "@/lib/action-history";
import { formatDate } from "@/lib/dates";
import { groupLocationTargets } from "@/lib/location-targets";

const PENDING_PREFIX = "wa:pending-gen:";

export function pendingKey(
  clientSlug: string,
  actionSlug: string,
  resultId: string,
): string {
  return `${PENDING_PREFIX}${clientSlug}:${actionSlug}:${resultId}`;
}

export function ActionRunner({
  clientSlug,
  clientName,
  action,
  defaults,
  hasOnboarding = false,
  onboardingName = null,
  onboardingCompetitorCount = 0,
}: {
  clientSlug: string;
  clientName: string;
  action: ActionDef;
  defaults?: Record<string, string>;
  /** True when an onboarding form has been uploaded for this client.
   *  Currently consumed only by keyword-research, which uses it to relax
   *  the seedTopic required-flag and show the "Use data from onboarding
   *  form" toggle. */
  hasOnboarding?: boolean;
  onboardingName?: string | null;
  onboardingCompetitorCount?: number;
}) {
  const router = useRouter();
  const isKwResearch = action.slug === "keyword-research";
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of action.fields) {
      init[f.key] = defaults?.[f.key] ?? f.defaultValue ?? "";
    }
    return init;
  });
  // For keyword-research only: whether to feed the onboarding doc to Claude.
  // Default ON when present (it's the strongest signal we have). User can
  // untick to run a clean keyword-data-only research.
  const [useOnboarding, setUseOnboarding] = useState<boolean>(
    isKwResearch && hasOnboarding,
  );
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [navigating, setNavigating] = useState(false);

  const apiBase = `/api/seo-actions/${clientSlug}/${action.slug}`;

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${apiBase}/history`, { cache: "no-store" });
      if (!res.ok) throw new Error(`History HTTP ${res.status}`);
      const data = (await res.json()) as { entries: HistoryEntry[] };
      setHistory(data.entries ?? []);
    } catch (err) {
      console.error("history load failed:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Field-level required override: for keyword-research, the seedTopic
  // field is required UNLESS the consultant is using the onboarding form
  // (which provides its own focus signals — services, objectives, competitors).
  const requiredKeys = useMemo(() => {
    const base = action.fields.filter((f) => f.required).map((f) => f.key);
    if (isKwResearch && useOnboarding) {
      return base.filter((k) => k !== "seedTopic");
    }
    return base;
  }, [action.fields, isKwResearch, useOnboarding]);
  const requiredMissing = requiredKeys.some(
    (key) => !(values[key] ?? "").trim(),
  );

  function setField(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function run() {
    if (navigating || requiredMissing) return;
    setNavigating(true);
    const resultId = makeResultId();
    // Carry the onboarding-toggle through to the API via a synthetic input.
    // The route reads inputs.useOnboarding to decide whether to read the
    // uploaded form (defaults to "yes if present" when absent).
    const payload: Record<string, string> = { ...values };
    if (isKwResearch && hasOnboarding) {
      payload.useOnboarding = useOnboarding ? "true" : "false";
    }
    try {
      sessionStorage.setItem(
        pendingKey(clientSlug, action.slug, resultId),
        JSON.stringify(payload),
      );
    } catch (err) {
      console.error("sessionStorage write failed:", err);
    }
    router.push(`/seo/${clientSlug}/actions/${action.slug}/results/${resultId}`);
  }

  async function deleteEntry(id: string) {
    if (!confirm("Delete this past result?")) return;
    try {
      await fetch(`${apiBase}/history?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setHistory((h) => h.filter((e) => e.id !== id));
    } catch (err) {
      console.error("delete failed:", err);
    }
  }

  return (
    <div className="space-y-6">
      <article className="brand-gradient-border relative overflow-hidden rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md">
        <header className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-white/65" strokeWidth={2.25} />
          <h2 className="text-sm font-semibold tracking-tight text-white">
            New generation for {clientName}
          </h2>
        </header>

        {isKwResearch && (
          <OnboardingBanner
            clientSlug={clientSlug}
            hasOnboarding={hasOnboarding}
            onboardingName={onboardingName}
            competitorCount={onboardingCompetitorCount}
            useOnboarding={useOnboarding}
            onToggle={setUseOnboarding}
          />
        )}

        <div className="space-y-4">
          {action.fields.map((f) => {
            // For keyword-research with onboarding-in-use, soften seedTopic:
            // no asterisk, label switches to "Additional focus (optional)",
            // placeholder explains the new role.
            let displayField = f;
            if (isKwResearch && f.key === "seedTopic") {
              if (useOnboarding) {
                displayField = {
                  ...f,
                  label: "Additional focus (optional)",
                  required: false,
                  placeholder:
                    "Optional — narrow the research to a specific service mentioned in the form (e.g. 'all-on-4 Lisbon').",
                  helpText:
                    "The onboarding form already tells Claude what to focus on. Use this to override or sharpen.",
                };
              } else if (!hasOnboarding) {
                displayField = {
                  ...f,
                  helpText:
                    "Required — no onboarding form on file, so Claude needs this seed to know what to focus on. Upload a form on the client page to make this optional.",
                };
              }
            }
            return (
              <FieldRow
                key={f.key}
                field={displayField}
                value={values[f.key] ?? ""}
                onChange={(v) => setField(f.key, v)}
                disabled={navigating}
              />
            );
          })}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={navigating || requiredMissing}
            className="brand-gradient-bg inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-[0_6px_24px_-4px_rgba(120,61,245,0.6)] transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            {navigating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" strokeWidth={2.5} />
            )}
            {navigating ? "Opening result page…" : "Generate"}
          </button>
          {requiredMissing && !navigating && (
            <span className="text-xs text-white/40">
              Fill in the required fields to generate.
            </span>
          )}
        </div>
      </article>

      <section>
        <header className="mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-white/55" strokeWidth={2.25} />
          <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-white/55">
            Past results
          </h2>
          <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
            {history.length}
          </span>
        </header>

        {historyLoading ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-6 text-center text-xs text-white/40">
            Loading…
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-3 py-8 text-center text-xs text-white/40">
            No past results yet. Generate one above — each run gets its own
            page you can come back to or share.
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {history.map((e) => {
              const date = new Date(e.createdAt);
              const summary = summariseHistoryEntry(e, action.slug);
              return (
                <li
                  key={e.id}
                  className="brand-gradient-border group relative overflow-hidden rounded-xl bg-white/[0.025]"
                >
                  <Link
                    href={`/seo/${clientSlug}/actions/${action.slug}/results/${e.id}`}
                    className="block p-3 transition group-hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-white/55">
                        {formatDisplayResultId(e.id)}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.13em] text-white/35">
                        {e.model.replace("claude-", "")}
                      </span>
                    </div>
                    <div className="mt-1 text-sm font-medium text-white">
                      {formatDate(date)}
                    </div>
                    {summary.tag && (
                      <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/[0.08] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[#c9a8ff]">
                        {summary.tag}
                      </div>
                    )}
                    <div className="mt-2 line-clamp-2 text-[11px] text-white/65">
                      {summary.body || "—"}
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      deleteEntry(e.id);
                    }}
                    aria-label={`Delete ${e.id}`}
                    className="absolute right-2 top-2 hidden rounded-md border border-white/10 bg-black/30 p-1 text-white/50 transition hover:border-red-400/40 hover:text-red-300 group-hover:block"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function OnboardingBanner({
  clientSlug,
  hasOnboarding,
  onboardingName,
  competitorCount,
  useOnboarding,
  onToggle,
}: {
  clientSlug: string;
  hasOnboarding: boolean;
  onboardingName: string | null;
  competitorCount: number;
  useOnboarding: boolean;
  onToggle: (v: boolean) => void;
}) {
  if (!hasOnboarding) {
    return (
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-rose-400/30 bg-rose-500/[0.06] px-4 py-3">
        <AlertCircle
          className="mt-0.5 h-4 w-4 shrink-0 text-rose-300"
          strokeWidth={2.25}
        />
        <div className="flex-1">
          <p className="text-[12.5px] font-medium text-rose-100">
            No onboarding form on file
          </p>
          <p className="mt-0.5 text-[11.5px] text-rose-200/75">
            Without it the seed topic below is required and the research can&apos;t
            anchor on the client&apos;s named services, objectives, or competitors.{" "}
            <Link
              href={`/seo/${clientSlug}#section-brief`}
              className="font-medium text-rose-200 underline-offset-2 hover:underline"
            >
              Upload the form on the project page
            </Link>{" "}
            for sharper, commercially-anchored output.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-400/30 bg-emerald-500/[0.06] px-4 py-3">
      <ClipboardList
        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300"
        strokeWidth={2.25}
      />
      <div className="flex-1">
        <p className="text-[12.5px] font-medium text-emerald-100">
          Onboarding form detected
          {onboardingName ? (
            <span className="ml-1 font-normal text-emerald-200/75">
              ({onboardingName})
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 text-[11.5px] text-emerald-200/75">
          Claude will read the form natively
          {competitorCount > 0
            ? ` and cross-reference the ${competitorCount} competitor${competitorCount === 1 ? "" : "s"} named in it`
            : ""}
          . The seed topic below becomes optional unless you untick this.
        </p>
        <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-[11.5px] text-emerald-50">
          <input
            type="checkbox"
            checked={useOnboarding}
            onChange={(e) => onToggle(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-emerald-400/40 bg-transparent text-emerald-400 accent-emerald-400 focus:ring-emerald-400"
          />
          <span className="font-medium">Use data from onboarding form</span>
        </label>
      </div>
    </div>
  );
}

function firstLineOfMarkdown(s: string): string {
  if (!s) return "";
  // Skip our tool-progress blockquotes + headings; find the first paragraph.
  for (const raw of s.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith(">") || line.startsWith("#") || line.startsWith("---"))
      continue;
    return line.replace(/[*_`]/g, "").slice(0, 160);
  }
  return s.slice(0, 160);
}

/** Per-action summary for the past-results card. Keyword Research surfaces
 *  the seed + geo so consultants can scan history; other actions fall back
 *  to the first markdown line of the analysis. */
function summariseHistoryEntry(
  e: HistoryEntry,
  actionSlug: string,
): { tag: string | null; body: string } {
  if (actionSlug === "keyword-research") {
    const seed = (e.inputs?.seedTopic ?? "").trim();
    const geo = (e.inputs?.geo ?? "").trim();
    const intent = (e.inputs?.intent ?? "").trim();
    const tag = geo || null;
    const bits: string[] = [];
    if (seed) bits.push(`Seed: ${seed}`);
    if (intent && intent.toLowerCase() !== "all intents")
      bits.push(`Intent: ${intent}`);
    if (bits.length === 0)
      bits.push(firstLineOfMarkdown(e.output) || "Onboarding-driven run");
    return { tag, body: bits.join(" · ") };
  }
  return { tag: null, body: firstLineOfMarkdown(e.output) };
}

function FieldRow({
  field,
  value,
  onChange,
  disabled,
}: {
  field: ActionDef["fields"][number];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const id = `field-${field.key}`;
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-white/65"
      >
        {field.label}
        {field.required && <span className="text-red-300/80">*</span>}
      </label>
      {field.type === "textarea" ? (
        <textarea
          id={id}
          value={value}
          rows={field.rows ?? 3}
          disabled={disabled}
          onChange={(e) => onChange(e.currentTarget.value)}
          placeholder={field.placeholder}
          className="w-full resize-y rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/25 focus:outline-none disabled:opacity-50"
        />
      ) : field.type === "select" ? (
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.currentTarget.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-white/25 focus:outline-none disabled:opacity-50"
        >
          {field.options?.map((opt) => (
            <option key={opt} value={opt} className="bg-[#0a0a0f]">
              {opt}
            </option>
          ))}
        </select>
      ) : field.type === "location" ? (
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.currentTarget.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-white/25 focus:outline-none disabled:opacity-50"
        >
          {groupLocationTargets().map(({ country, entries }) => (
            <optgroup
              key={country}
              label={country}
              className="bg-[#0a0a0f] text-white"
            >
              {entries.map((t) => (
                <option
                  key={t.locationCode}
                  value={t.label}
                  className="bg-[#0a0a0f]"
                >
                  {t.scope === "country"
                    ? `${t.label}`
                    : `  ${t.label}${t.localModifier && t.label !== t.localModifier ? ` (${t.localModifier})` : ""}`}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.currentTarget.value)}
          placeholder={field.placeholder}
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/25 focus:outline-none disabled:opacity-50"
        />
      )}
      {field.helpText && (
        <p className="text-[11px] text-white/40">{field.helpText}</p>
      )}
    </div>
  );
}
