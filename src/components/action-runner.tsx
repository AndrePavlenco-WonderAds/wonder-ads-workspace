"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import {
  Clock,
  Loader2,
  Play,
  Trash2,
  Sparkles,
} from "lucide-react";
import type { ActionDef } from "@/lib/seo-pillars";
import type { HistoryEntry } from "@/lib/action-history";
import { makeResultId } from "@/lib/action-history";
import { formatDateTime } from "@/lib/dates";

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
}: {
  clientSlug: string;
  clientName: string;
  action: ActionDef;
  defaults?: Record<string, string>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of action.fields) {
      init[f.key] = defaults?.[f.key] ?? f.defaultValue ?? "";
    }
    return init;
  });
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

  const requiredMissing = action.fields
    .filter((f) => f.required)
    .some((f) => !(values[f.key] ?? "").trim());

  function setField(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function run() {
    if (navigating || requiredMissing) return;
    setNavigating(true);
    const resultId = makeResultId();
    try {
      sessionStorage.setItem(
        pendingKey(clientSlug, action.slug, resultId),
        JSON.stringify(values),
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

        <div className="space-y-4">
          {action.fields.map((f) => (
            <FieldRow
              key={f.key}
              field={f}
              value={values[f.key] ?? ""}
              onChange={(v) => setField(f.key, v)}
              disabled={navigating}
            />
          ))}
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
                        {e.id}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.13em] text-white/35">
                        {e.model.replace("claude-", "")}
                      </span>
                    </div>
                    <div className="mt-1 text-sm font-medium text-white">
                      {formatDateTime(date)}
                    </div>
                    <div className="mt-2 line-clamp-2 text-[11px] text-white/55">
                      {firstLineOfMarkdown(e.output) || "—"}
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
