"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Clock,
  Loader2,
  Play,
  Trash2,
  ChevronDown,
  ChevronUp,
  Square,
  Sparkles,
} from "lucide-react";
import type { ActionDef } from "@/lib/seo-pillars";
import type { HistoryEntry } from "@/lib/action-history";
import { MarkdownView } from "./markdown-view";

type Status = "idle" | "streaming" | "done" | "error";

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
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of action.fields) {
      init[f.key] = defaults?.[f.key] ?? f.defaultValue ?? "";
    }
    return init;
  });
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const apiBase = useMemo(
    () => `/api/seo-actions/${clientSlug}/${action.slug}`,
    [clientSlug, action.slug],
  );

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

  function stop() {
    abortRef.current?.abort();
  }

  async function run() {
    if (status === "streaming") return;
    setOutput("");
    setStatus("streaming");
    setErrorMsg(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inputs: values }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        // Server returns `{ error: "..." }` on validation/config failures —
        // surface the human message, not the raw JSON.
        let message = text || `HTTP ${res.status}`;
        try {
          const parsed = JSON.parse(text) as { error?: unknown };
          if (typeof parsed?.error === "string") message = parsed.error;
        } catch {
          /* not JSON, keep raw text */
        }
        throw new Error(message);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setOutput(acc);
      }
      acc += decoder.decode();
      setOutput(acc);
      setStatus("done");
      // give KV a beat to persist before refetching
      setTimeout(() => loadHistory(), 400);
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setStatus("idle");
        return;
      }
      console.error("run failed:", err);
      setErrorMsg((err as Error).message || "Generation failed.");
      setStatus("error");
    } finally {
      abortRef.current = null;
    }
  }

  async function deleteEntry(id: string) {
    if (!confirm("Delete this past generation?")) return;
    try {
      await fetch(`${apiBase}/history?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setHistory((h) => h.filter((e) => e.id !== id));
    } catch (err) {
      console.error("delete failed:", err);
    }
  }

  const isStreaming = status === "streaming";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      {/* Main column: form + output */}
      <div className="space-y-5">
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
                disabled={isStreaming}
              />
            ))}
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={run}
              disabled={isStreaming || requiredMissing}
              className="brand-gradient-bg inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-[0_6px_24px_-4px_rgba(120,61,245,0.6)] transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" strokeWidth={2.5} />
              )}
              {isStreaming ? "Generating…" : "Generate"}
            </button>
            {isStreaming && (
              <button
                type="button"
                onClick={stop}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/75 transition hover:border-white/30 hover:text-white"
              >
                <Square className="h-3 w-3" />
                Stop
              </button>
            )}
            {requiredMissing && !isStreaming && (
              <span className="text-xs text-white/40">
                Fill in the required fields to generate.
              </span>
            )}
          </div>

          {errorMsg && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {errorMsg}
            </div>
          )}
        </article>

        <article className="brand-gradient-border relative overflow-hidden rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md">
          <header className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-white">
              {status === "idle"
                ? "Output will appear here"
                : status === "streaming"
                  ? "Live output"
                  : "Latest output"}
            </h2>
            {output && (
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(output)}
                className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white/65 transition hover:border-white/25 hover:text-white"
              >
                Copy
              </button>
            )}
          </header>

          {output ? (
            <MarkdownView source={output} />
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-4 py-8 text-center text-xs text-white/40">
              Run the action to see the live, streaming output here.
            </div>
          )}
        </article>
      </div>

      {/* Sidebar: history */}
      <aside className="space-y-3">
        <header className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-white/55" strokeWidth={2.25} />
          <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-white/55">
            History
          </h2>
          <span className="ml-auto text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
            {history.length}
          </span>
        </header>

        {historyLoading ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-6 text-center text-xs text-white/40">
            Loading…
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-3 py-6 text-center text-xs text-white/40">
            No past generations yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {history.map((e) => {
              const isOpen = expandedId === e.id;
              const date = new Date(e.createdAt);
              return (
                <li
                  key={e.id}
                  className="rounded-xl border border-white/10 bg-white/[0.025]"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(isOpen ? null : e.id)
                    }
                    className="flex w-full items-center gap-2 px-3 py-2 text-left"
                  >
                    <span className="flex-1 truncate text-xs text-white/75">
                      {date.toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.13em] text-white/40">
                      {e.model.replace("claude-", "")}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="h-3.5 w-3.5 text-white/45" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-white/45" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="space-y-3 border-t border-white/8 px-3 py-3">
                      <details>
                        <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-[0.18em] text-white/45 hover:text-white/70">
                          Inputs
                        </summary>
                        <dl className="mt-2 space-y-1 text-[12px]">
                          {Object.entries(e.inputs).map(([k, v]) =>
                            v && v.trim() ? (
                              <div key={k}>
                                <dt className="text-white/45">{k}</dt>
                                <dd className="text-white/80 whitespace-pre-wrap">
                                  {v}
                                </dd>
                              </div>
                            ) : null,
                          )}
                        </dl>
                      </details>
                      <div className="rounded-lg border border-white/8 bg-black/20 p-3">
                        <MarkdownView source={e.output} />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            navigator.clipboard.writeText(e.output)
                          }
                          className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white/65 hover:border-white/25 hover:text-white"
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteEntry(e.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white/50 hover:border-red-400/40 hover:text-red-300"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
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
