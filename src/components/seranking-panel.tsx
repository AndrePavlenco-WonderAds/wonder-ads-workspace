"use client";

// SE Ranking rank-tracking status for one client, sitting under the Target
// Keywords table it's fed from.
//
// The panel is deliberately explicit about the near-duplicate collapse: the
// sync tracks fewer keywords than the client has targets, and a consultant who
// can't see WHICH ones were folded together has no way to trust the number.
// Nothing is removed from the Target Keywords list itself — the collapse only
// narrows what gets pushed to SE Ranking.

import { useCallback, useEffect, useState } from "react";
import { Activity, Loader2, RefreshCw, ExternalLink, ChevronDown } from "lucide-react";
import { formatDateTime } from "@/lib/dates";
import { useSeoReadOnly } from "./seo-readonly";
import type { DroppedKeyword } from "@/lib/seranking-dedupe";
import type { SeRankingLink } from "@/lib/seranking-store";

type Status = {
  configured: boolean;
  link: SeRankingLink | null;
  targets: number;
  wouldTrack: number;
  wouldDrop: DroppedKeyword[];
};

export function SeRankingPanel({ slug }: { slug: string }) {
  const readOnly = useSeoReadOnly();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [showDropped, setShowDropped] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/seranking/${slug}`, { cache: "no-store" });
      if (res.ok) setStatus((await res.json()) as Status);
    } catch {
      /* network blip — the panel just stays on its last state */
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  async function sync() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(`/api/seranking/${slug}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      setNote(
        data.added > 0
          ? `${data.added} keyword${data.added === 1 ? "" : "s"} enviada${data.added === 1 ? "" : "s"} · ${data.tracked} em tracking`
          : `Já sincronizado · ${data.tracked} keywords em tracking`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync falhou");
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;

  const link = status.link;
  const collapsed = link ? link.dropped : status.wouldDrop;

  return (
    <section
      aria-label="SE Ranking"
      id="section-seranking"
      className="brand-gradient-border rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md"
    >
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <Activity className="h-4 w-4 text-white/55" strokeWidth={2.25} />
        <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-white/55">
          SE Ranking
        </h2>
        {link ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-emerald-300/85">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.7)]"
            />
            {link.trackedCount} em tracking
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-amber-300/85">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-300" />
            Por ligar
          </span>
        )}
        {busy && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-white/45">
            <Loader2 className="h-3 w-3 animate-spin" />A sincronizar…
          </span>
        )}
        {note && (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
            {note}
          </span>
        )}
        {error && (
          <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-300">
            {error}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {link && (
            <a
              href={`https://online.seranking.com/research.keywords.html?site_id=${link.siteId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-medium text-white/65 transition hover:border-white/35 hover:bg-white/[0.06] hover:text-white"
            >
              <ExternalLink className="h-3 w-3" />
              Abrir projeto
            </a>
          )}
          {!readOnly && status.configured && (
            <button
              type="button"
              onClick={sync}
              disabled={busy || status.targets === 0}
              className="brand-gradient-bg inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white shadow-[0_4px_18px_-4px_rgba(120,61,245,0.55)] transition hover:opacity-90 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} />
              {link ? "Sincronizar" : "Ligar ao SE Ranking"}
            </button>
          )}
        </div>
      </header>

      {!status.configured ? (
        <p className="text-[11.5px] leading-relaxed text-white/45">
          A chave <code className="text-white/70">SERANKING_API_KEY</code> não
          está definida neste deployment — sem ela não há posições reais nos
          relatórios.
        </p>
      ) : status.targets === 0 ? (
        <p className="text-[11.5px] leading-relaxed text-white/45">
          Este cliente ainda não tem target keywords. Adiciona-as na tabela
          acima e depois sincroniza.
        </p>
      ) : (
        <>
          <p className="text-[11.5px] leading-relaxed text-white/55">
            Posição real na Google (não a média do Search Console) para as{" "}
            {status.targets} target keywords deste cliente. Aparece no relatório
            mensal, por baixo da tabela de keywords do GSC.
            {link
              ? ` Última sincronização a ${formatDateTime(link.syncedAt)}.`
              : ""}
          </p>

          {collapsed.length > 0 && (
            <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.02] p-3">
              <button
                type="button"
                onClick={() => setShowDropped((v) => !v)}
                className="flex w-full items-center gap-2 text-left text-[11px] font-medium text-white/60 transition hover:text-white/85"
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 transition ${showDropped ? "rotate-180" : ""}`}
                />
                {collapsed.length} quase-duplicada
                {collapsed.length === 1 ? "" : "s"} não enviada
                {collapsed.length === 1 ? "" : "s"} — mesma SERP
              </button>
              {showDropped && (
                <ul className="mt-2 space-y-1 border-t border-white/8 pt-2">
                  {collapsed.map((d) => (
                    <li
                      key={d.dropped}
                      className="flex flex-wrap items-baseline gap-1.5 text-[11px]"
                    >
                      <span className="text-white/40 line-through">
                        {d.dropped}
                      </span>
                      <span aria-hidden className="text-white/25">
                        →
                      </span>
                      <span className="text-white/75">{d.kept}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[10.5px] leading-relaxed text-white/35">
                Continuam na lista de Target Keywords acima — só não gastam
                quota de tracking a medir a mesma pesquisa duas vezes.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
