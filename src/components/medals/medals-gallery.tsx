"use client";

// Galeria de medalhas + seletor das três do header (v77.25, refeita v77.26).
//
// Recebe tudo já calculado no servidor (catálogo, o que a pessoa tem, o
// progresso em cada uma, quem lidera nas «Top») e só trata da escolha:
// até três medalhas ganhas marcadas «No header», gravadas de uma vez. As
// «Top» ocupam lugar automaticamente e não se tiram; os lugares que sobram
// são da pessoa. Uma lista vazia é uma escolha («só as automáticas»).
//
// Estrutura: barra fixa com o que vai para o header → estante (as que a
// pessoa tem, em cartões com descrição) → catálogo por família.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Crown, Lock, Pin, PinOff, Loader2 } from "lucide-react";
import {
  MAX_DISPLAYED,
  MEDAL_FAMILIES,
  tierAccent,
  tierLabel,
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

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

export function MedalsGallery({
  items,
  chosen,
  display,
  canChoose,
  leaders,
  viewerName,
}: {
  items: GalleryItem[];
  /** A escolha gravada (ids), ou null se nunca escolheu. */
  chosen: string[] | null;
  /** O que o header mostra agora (Top automáticas + escolha / dificuldade). */
  display: string[];
  /** false com «Ver como» ativo — a lente é só de leitura. */
  canChoose: boolean;
  /** Quem lidera em cada medalha «Top» (nomes). */
  leaders: Record<string, string[]>;
  /** Nome da pessoa vista, para o «És tu» nas «Top». */
  viewerName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const earnedItems = useMemo(
    () => items.filter((i) => i.progress.earned).sort((a, b) => b.medal.prestige - a.medal.prestige),
    [items],
  );
  const byId = useMemo(() => new Map(items.map((i) => [i.medal.id, i])), [items]);
  // As «Top» ganhas vão sempre para o header — ocupam lugar sem se poder tirar.
  const autoIds = useMemo(
    () => earnedItems.filter((i) => i.medal.boss).map((i) => i.medal.id).slice(0, MAX_DISPLAYED),
    [earnedItems],
  );
  const freeSlots = MAX_DISPLAYED - autoIds.length;
  const initialPicked = useMemo(
    () => display.filter((id) => !autoIds.includes(id)).slice(0, Math.max(0, freeSlots)),
    [display, autoIds, freeSlots],
  );
  const [picked, setPicked] = useState<string[]>(initialPicked);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const selected = useMemo(() => [...autoIds, ...picked].slice(0, MAX_DISPLAYED), [autoIds, picked]);
  const dirty = JSON.stringify(picked) !== JSON.stringify(initialPicked);

  function toggle(id: string) {
    setError(null);
    if (autoIds.includes(id)) return;
    setPicked((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= freeSlots) {
        setError(
          autoIds.length
            ? `Só cabem ${MAX_DISPLAYED} no header e as ${autoIds.length === 1 ? "Top ocupa" : `${autoIds.length} Top ocupam`} lugar automaticamente — tira uma primeiro.`
            : `Só cabem ${MAX_DISPLAYED} medalhas no header — tira uma primeiro.`,
        );
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

  function PinButton({ id, compact = false }: { id: string; compact?: boolean }) {
    if (!canChoose) return null;
    if (autoIds.includes(id)) {
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-400/10 font-semibold text-amber-100 ${
            compact ? "px-2.5 py-1 text-[10.5px]" : "px-3 py-1 text-[11px]"
          }`}
          title="As «Top» vão sempre para o header"
        >
          <Crown className="h-3 w-3" />
          No header · automático
        </span>
      );
    }
    const isSelected = selected.includes(id);
    return (
      <button
        type="button"
        onClick={() => toggle(id)}
        className={`inline-flex items-center gap-1.5 rounded-full border font-semibold transition ${
          compact ? "px-2.5 py-1 text-[10.5px]" : "px-3 py-1 text-[11px]"
        } ${
          isSelected
            ? "border-[#783DF5]/60 bg-[#783DF5]/25 text-white hover:bg-[#783DF5]/35"
            : "border-white/12 bg-white/[0.03] text-white/70 hover:border-white/25 hover:text-white"
        }`}
      >
        {isSelected ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
        {isSelected ? "Tirar do header" : "Pôr no header"}
      </button>
    );
  }

  return (
    <div>
      {/* ----- Barra do header: o que está em exibição ----- */}
      <div className="sticky top-[72px] z-20 mb-8 rounded-2xl border border-white/10 bg-[color:var(--background)]/90 p-4 backdrop-blur-md sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex min-h-[48px] items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
              {selected.length === 0 && <span className="px-1 text-[12px] text-white/40">Nenhuma medalha no header.</span>}
              {selected.map((id) => {
                const item = byId.get(id);
                return item ? (
                  <span key={id} title={item.medal.name} className="inline-flex">
                    <MedalBadge medal={item.medal} size={40} />
                  </span>
                ) : null;
              })}
              {Array.from({ length: Math.max(0, MAX_DISPLAYED - selected.length) }, (_, i) => (
                <span
                  key={`slot-${i}`}
                  aria-hidden
                  className="inline-flex h-[34px] w-[30px] items-center justify-center rounded-md border border-dashed border-white/15 text-[9px] text-white/25"
                >
                  +
                </span>
              ))}
            </div>
            <div className="leading-tight">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">No header</p>
              <p className="text-[12px] text-white/55">
                {selected.length} de {MAX_DISPLAYED}
                {autoIds.length ? ` · ${autoIds.length} Top automática${autoIds.length === 1 ? "" : "s"}` : ""} · escolhe entre as{" "}
                {earnedItems.length} que já tens
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

      {/* ----- Estante: as que a pessoa tem ----- */}
      <section className="mb-12">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">A tua estante</p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight text-white">
              {earnedItems.length === 0
                ? "Ainda sem medalhas"
                : `${earnedItems.length} ${earnedItems.length === 1 ? "medalha conquistada" : "medalhas conquistadas"}`}
            </h3>
          </div>
        </div>
        {earnedItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center text-sm text-white/50">
            A primeira cai com a primeira proposta apresentada. Depois é fechar.
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {earnedItems.map(({ medal }) => {
              const accent = tierAccent(medal);
              const isSelected = selected.includes(medal.id);
              return (
                <li
                  key={medal.id}
                  className="relative overflow-hidden rounded-2xl border p-5"
                  style={{
                    borderColor: `${accent}55`,
                    background: `radial-gradient(120% 90% at 50% -10%, ${accent}2E 0%, rgba(255,255,255,0.03) 55%, rgba(255,255,255,0.02) 100%)`,
                    boxShadow: medal.boss || medal.tier >= 4 ? `0 24px 60px -30px ${accent}` : undefined,
                  }}
                >
                  {isSelected && (
                    <span
                      className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#783DF5]/30 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white"
                      title="Está no header"
                    >
                      <Pin className="h-2.5 w-2.5" /> header
                    </span>
                  )}
                  <div className="flex h-[96px] items-center justify-center">
                    <MedalBadge medal={medal} size={88} />
                  </div>
                  <div className="mt-3 flex items-center justify-center">
                    <span
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.16em]"
                      style={{ color: accent, borderColor: `${accent}66`, backgroundColor: `${accent}14` }}
                    >
                      {medal.boss && <Crown className="h-2.5 w-2.5" />}
                      {tierLabel(medal)}
                    </span>
                  </div>
                  <p className="mt-2 text-center text-[15px] font-semibold text-white">{medal.name}</p>
                  <p className="mt-1 text-center text-[12px] leading-relaxed text-white/60">{medal.blurb}</p>
                  {canChoose && (
                    <div className="mt-4 flex justify-center">
                      <PinButton id={medal.id} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ----- Catálogo por família ----- */}
      <div className="space-y-10">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Catálogo</p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-white">Tudo o que há para ganhar</h3>
        </div>
        {MEDAL_FAMILIES.map((fam) => {
          const list = items.filter((i) => i.medal.family === fam.id);
          const have = list.filter((i) => i.progress.earned).length;
          const isTop = fam.id === "top";
          return (
            <section key={fam.id}>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h4 className="text-lg font-semibold tracking-tight text-white">{fam.name}</h4>
                  <p className="text-[12.5px] text-white/50">{fam.description}</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                  {have} / {list.length}
                </span>
              </div>
              <ul className={`grid gap-3 sm:grid-cols-2 ${isTop ? "lg:grid-cols-3" : "lg:grid-cols-3 xl:grid-cols-5"}`}>
                {list.map((item) => {
                  const { medal, progress } = item;
                  const isSelected = selected.includes(medal.id);
                  const accent = tierAccent(medal);
                  const pct = progress.earned ? 100 : Math.min(100, Math.round((progress.value / progress.threshold) * 100));
                  const who = leaders[medal.id] ?? [];
                  const others = who.filter((n) => n !== viewerName);
                  return (
                    <li
                      key={medal.id}
                      className={`relative flex flex-col items-center rounded-2xl border p-4 text-center transition ${
                        progress.earned
                          ? isSelected
                            ? "border-[#783DF5]/60 bg-[#783DF5]/[0.12] shadow-[0_14px_40px_-20px_rgba(120,61,245,0.9)]"
                            : "border-white/12 bg-white/[0.035]"
                          : "border-white/8 bg-white/[0.015]"
                      } ${isTop ? "p-6" : ""}`}
                      style={
                        progress.earned && isTop
                          ? { background: `radial-gradient(120% 90% at 50% -10%, ${accent}33 0%, rgba(255,255,255,0.03) 60%)`, borderColor: `${accent}66` }
                          : undefined
                      }
                    >
                      {!progress.earned && (
                        <span className="absolute right-3 top-3 text-white/30" title="Por ganhar">
                          <Lock className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <div className={`flex items-center ${isTop ? "h-[112px]" : "h-[76px]"}`}>
                        <MedalBadge medal={medal} size={isTop ? 100 : 66} earned={progress.earned} />
                      </div>
                      <p className={`mt-3 text-[13.5px] font-semibold ${progress.earned ? "text-white" : "text-white/55"}`}>{medal.name}</p>
                      <p className="mt-0.5 text-[11.5px] text-white/45">{medal.requirement}</p>
                      {!isTop && (
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
                      {isTop && (
                        <p className={`mt-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] ${progress.earned ? "text-amber-200" : "text-white/40"}`}>
                          {progress.earned
                            ? others.length
                              ? `És tu, com ${joinNames(others)}`
                              : "És tu, agora"
                            : who.length
                              ? `Lidera: ${joinNames(who)}`
                              : "Ninguém lidera ainda"}
                        </p>
                      )}
                      {progress.earned && canChoose && (
                        <div className="mt-3">
                          <PinButton id={medal.id} compact />
                        </div>
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
