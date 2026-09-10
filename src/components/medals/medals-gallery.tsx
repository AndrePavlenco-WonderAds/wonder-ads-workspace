"use client";

// Galeria de medalhas + seletor das três do header (v77.25).
//
// Recebe tudo já calculado no servidor (catálogo, o que a pessoa tem e o
// progresso em cada uma) e só trata da escolha: até três medalhas ganhas
// marcadas «No header», gravadas de uma vez. Uma lista vazia é uma escolha
// («não mostrar nenhuma»).

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, Pin, PinOff, Loader2 } from "lucide-react";
import {
  MAX_DISPLAYED,
  MEDAL_FAMILIES,
  type Medal,
  type MedalProgress,
} from "@/lib/medals/catalog";
import { formatEur } from "@/lib/proposals/value";
import { MedalBadge } from "./medal-badge";

export type GalleryItem = { medal: Medal; progress: MedalProgress };

function progressLabel(item: GalleryItem, unit: "count" | "eur" | "rate"): string {
  const { value, threshold } = item.progress;
  if (unit === "eur") return `${formatEur(value)} / ${formatEur(threshold)}`;
  if (unit === "rate") return `${Math.round(value * 100)} % / ${Math.round(threshold * 100)} %`;
  return `${value} / ${threshold}`;
}

export function MedalsGallery({
  items,
  chosen,
  defaultDisplay,
  canChoose,
}: {
  items: GalleryItem[];
  /** A escolha gravada (ids), ou null se nunca escolheu. */
  chosen: string[] | null;
  /** O que o header mostra quando não há escolha (3 de maior prestígio). */
  defaultDisplay: string[];
  /** false com «Ver como» ativo — a lente é só de leitura. */
  canChoose: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>(chosen ?? defaultDisplay);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const earnedCount = items.filter((i) => i.progress.earned).length;
  const byId = useMemo(() => new Map(items.map((i) => [i.medal.id, i])), [items]);
  const dirty = JSON.stringify(selected) !== JSON.stringify(chosen ?? defaultDisplay);

  function toggle(id: string) {
    setError(null);
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= MAX_DISPLAYED) {
        setError(`Só cabem ${MAX_DISPLAYED} medalhas no header — tira uma primeiro.`);
        return cur;
      }
      return [...cur, id];
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/medalhas/display", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setSavedAt(Date.now());
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível gravar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* ----- Barra do header: o que está em exibição ----- */}
      <div className="sticky top-[72px] z-20 mb-8 rounded-2xl border border-white/10 bg-[color:var(--background)]/90 p-4 backdrop-blur-md sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex min-h-[44px] items-center gap-2">
              {selected.length === 0 ? (
                <span className="text-[12px] text-white/40">Nenhuma medalha no header.</span>
              ) : (
                selected.map((id) => {
                  const item = byId.get(id);
                  return item ? (
                    <span key={id} title={item.medal.name} className="inline-flex">
                      <MedalBadge medal={item.medal} size={44} />
                    </span>
                  ) : null;
                })
              )}
              {Array.from({ length: Math.max(0, MAX_DISPLAYED - selected.length) }, (_, i) => (
                <span
                  key={`slot-${i}`}
                  aria-hidden
                  className="inline-flex h-[44px] w-[66px] items-center justify-center rounded-lg border border-dashed border-white/12 text-[10px] text-white/25"
                >
                  livre
                </span>
              ))}
            </div>
            <div className="leading-tight">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">No header</p>
              <p className="text-[12px] text-white/55">
                {selected.length} de {MAX_DISPLAYED} · escolhe entre as {earnedCount} que já tens
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {savedAt && !dirty && (
              <span className="inline-flex items-center gap-1 text-[12px] text-emerald-200">
                <Check className="h-3.5 w-3.5" /> Guardado
              </span>
            )}
            {canChoose ? (
              <button
                type="button"
                disabled={!dirty || saving || pending}
                onClick={() => void save()}
                className="brand-gradient-bg inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold text-white shadow-[0_8px_30px_-10px_rgba(120,61,245,0.8)] transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pin className="h-3.5 w-3.5" />}
                Guardar escolha
              </button>
            ) : (
              <span className="text-[12px] text-amber-200/80">A ver como outra pessoa — a escolha é só de leitura.</span>
            )}
          </div>
        </div>
        {error && <p className="mt-2 text-[12px] text-rose-300">{error}</p>}
      </div>

      {/* ----- Famílias ----- */}
      <div className="space-y-10">
        {MEDAL_FAMILIES.map((fam) => {
          const list = items.filter((i) => i.medal.family === fam.id);
          const have = list.filter((i) => i.progress.earned).length;
          return (
            <section key={fam.id}>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-white">{fam.name}</h3>
                  <p className="text-[12.5px] text-white/50">{fam.description}</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                  {have} / {list.length}
                </span>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {list.map((item) => {
                  const { medal, progress } = item;
                  const isSelected = selected.includes(medal.id);
                  const pct = progress.earned ? 100 : Math.min(100, Math.round((progress.value / progress.threshold) * 100));
                  return (
                    <li
                      key={medal.id}
                      className={`relative flex flex-col items-center rounded-2xl border p-4 text-center transition ${
                        progress.earned
                          ? isSelected
                            ? "border-[#783DF5]/60 bg-[#783DF5]/[0.12] shadow-[0_14px_40px_-20px_rgba(120,61,245,0.9)]"
                            : "border-white/12 bg-white/[0.035]"
                          : "border-white/8 bg-white/[0.015]"
                      }`}
                    >
                      {!progress.earned && (
                        <span className="absolute right-3 top-3 text-white/30" title="Por ganhar">
                          <Lock className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <div className="flex h-[72px] items-center">
                        <MedalBadge medal={medal} size={64} earned={progress.earned} />
                      </div>
                      <p className={`mt-3 text-[13.5px] font-semibold ${progress.earned ? "text-white" : "text-white/55"}`}>{medal.name}</p>
                      <p className="mt-0.5 text-[11.5px] text-white/45">{medal.requirement}</p>
                      {medal.family !== "top" && (
                        <div className="mt-3 w-full">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                            <div
                              className={`h-full rounded-full ${progress.earned ? "brand-gradient-bg" : "bg-white/25"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="mt-1 text-[10.5px] tabular-nums text-white/40">{progressLabel(item, fam.unit)}</p>
                        </div>
                      )}
                      {medal.family === "top" && (
                        <p className={`mt-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] ${progress.earned ? "text-amber-200" : "text-white/30"}`}>
                          {progress.earned ? "És tu, agora" : "Ainda não lideras"}
                        </p>
                      )}
                      {progress.earned && canChoose && (
                        <button
                          type="button"
                          onClick={() => toggle(medal.id)}
                          className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                            isSelected
                              ? "border-[#783DF5]/60 bg-[#783DF5]/25 text-white hover:bg-[#783DF5]/35"
                              : "border-white/12 bg-white/[0.03] text-white/70 hover:border-white/25 hover:text-white"
                          }`}
                        >
                          {isSelected ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                          {isSelected ? "Tirar do header" : "Pôr no header"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
