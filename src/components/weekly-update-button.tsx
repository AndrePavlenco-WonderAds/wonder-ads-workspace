"use client";

// "Gerar Weekly Update" — opens a modal that asks Claude to turn the
// client's current SEO roadmap (what got done this week, what's pending,
// what's planned for next week) into a short, ready-to-send WhatsApp
// message in European Portuguese. The consultant reviews, tweaks if
// needed, and copies it straight into WhatsApp.

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Loader2,
  MessageCircle,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";

type Result = {
  message: string;
  week: number;
  counts: { implemented: number; pending: number; nextWeek: number };
};

export function WeeklyUpdateButton({
  clientSlug,
  clientName,
}: {
  clientSlug: string;
  clientName: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/roadmaps/${clientSlug}/weekly-update`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const data = (await res.json()) as Result & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult(data);
      setDraft(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [clientSlug]);

  // Auto-generate the first time the modal opens.
  useEffect(() => {
    if (open && !result && !loading && !error) void generate();
  }, [open, result, loading, error, generate]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard may be blocked — the textarea is still selectable */
    }
  }, [draft]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Gera uma mensagem de WhatsApp com o ponto de situação desta semana para enviar ao cliente."
        className="relative inline-flex items-center justify-center gap-1.5 rounded-md border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 transition hover:border-emerald-300/70 hover:bg-emerald-500/20 hover:text-white"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        Gerar Weekly Update
        <span
          aria-hidden
          className="absolute -right-2 -top-2 inline-flex items-center rounded-full bg-gradient-to-br from-[#F5A623] via-[#F54EA2] to-[#C535C9] px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase tracking-[0.08em] text-white shadow-[0_4px_12px_-2px_rgba(245,78,162,0.7)] animate-pulse"
        >
          NEW!
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="brand-gradient-border animate-fade-up my-auto w-full max-w-lg rounded-2xl bg-[#0c0c12] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-200">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Weekly Update — {clientName}
                  </h2>
                  <p className="text-[11px] text-white/50">
                    {result
                      ? `Semana ${result.week} de 12 · pronto a enviar por WhatsApp`
                      : "Ponto de situação semanal · WhatsApp"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="rounded-md p-1 text-white/55 transition hover:bg-white/[0.08] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {loading && (
              <div className="mt-5 flex flex-col items-center gap-3 py-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-[color:var(--brand-purple)]" />
                <p className="text-xs text-white/65">
                  A ler o roadmap e a redigir o ponto de situação…
                </p>
              </div>
            )}

            {error && !loading && (
              <div className="mt-4 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-100">
                {error}
              </div>
            )}

            {!loading && result && (
              <>
                <div className="mt-4 flex flex-wrap gap-1.5 text-[10px] uppercase tracking-[0.1em]">
                  <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-100">
                    {result.counts.implemented} feito
                    {result.counts.implemented === 1 ? "" : "s"}
                  </span>
                  <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-100">
                    {result.counts.pending} pendente
                    {result.counts.pending === 1 ? "" : "s"}
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/[0.05] px-2 py-0.5 font-semibold text-white/65">
                    {result.counts.nextWeek} próx. semana
                  </span>
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={16}
                  className="mt-3 w-full resize-y rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2.5 text-[12.5px] leading-relaxed text-white/90 outline-none focus:border-white/30"
                />
              </>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              {result && (
                <button
                  type="button"
                  onClick={generate}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/85 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  Regenerar
                </button>
              )}
              <button
                type="button"
                onClick={copy}
                disabled={!result || loading}
                className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[11px] font-semibold text-white shadow-lg shadow-[#783DF5]/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background:
                    "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)",
                }}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copiar mensagem
                  </>
                )}
              </button>
            </div>

            <p className="mt-3 flex items-center gap-1.5 text-[10px] text-white/40">
              <Sparkles className="h-3 w-3" />
              Gerado a partir do roadmap (feito esta semana · pendente ·
              próxima semana). Revê antes de enviar.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
