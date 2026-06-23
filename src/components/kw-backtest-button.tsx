"use client";

// "Backtest" button for the Keyword Research action. Runs the deterministic
// comparison of the last research's DataforSEO predictions vs real GSC
// performance and shows the report in a full-screen modal. The result is
// also persisted so the next research run injects its confidence summary.

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { History, Loader2, X } from "lucide-react";

export function KwBacktestButton({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const run = useCallback(async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    setMarkdown(null);
    try {
      const res = await fetch(`/api/kw-backtest/${slug}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMarkdown(data.markdown ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falhou o backtest.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={run}
        title="Comparar a última KW Research com o desempenho real no GSC e medir a confiança nos dados do DataforSEO"
        className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-sm font-medium text-white/85 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
      >
        <History className="h-4 w-4" />
        Backtest
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm sm:items-center"
            onClick={() => setOpen(false)}
          >
            <div
              className="brand-gradient-border my-auto w-full max-w-3xl rounded-2xl bg-[#0c0c12] p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                  <History className="h-4 w-4 text-[color:var(--brand-purple)]" />
                  Backtest — KW Research vs GSC real
                </h2>
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
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-[color:var(--brand-purple)]" />
                  <p className="text-xs text-white/65">
                    A comparar previsões com o GSC real…
                  </p>
                </div>
              )}
              {error && !loading && (
                <div className="mt-4 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-100">
                  {error}
                </div>
              )}
              {markdown && !loading && (
                <pre className="mt-4 max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-white/[0.02] p-3 text-[12px] leading-relaxed text-white/85">
                  {markdown}
                </pre>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
