"use client";

// Desbloquear partes de um projeto em pausa (v80.36). O botão 🔓 nos cartões
// dos «Pausados / Suspensos» do SEO DPT (só SuperAdmin) abre um pop-up:
// o que está aberto e até quando (com o tempo a contar), fechar já, e abrir
// mais partes por 30, 60 ou 90 dias ou sem prazo. No fim do prazo a parte
// volta a fechar sozinha (o middleware conta o prazo em cada pedido).
//
// O pop-up vai para o document.body (createPortal): dentro do cartão, um
// antepassado com transform/blur prendia o `fixed`.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, Clock, Loader2, LockOpen, X } from "lucide-react";
import { formatDate } from "@/lib/dates";
import {
  UNLOCK_DURATIONS,
  UNLOCK_UNITS,
  isGrantActive,
  remainingLabel,
  remainingShort,
  unlockUnit,
  type ProjectUnlocks,
  type UnlockUnitId,
} from "@/lib/paused-unlocks-shared";

const DAY = 24 * 60 * 60 * 1000;

/** As pastilhas do cartão: o que está aberto e quanto falta. */
export function UnlockChips({ unlocks }: { unlocks: ProjectUnlocks | undefined }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  if (!unlocks) return null;
  const active = UNLOCK_UNITS.filter((u) => isGrantActive(unlocks[u.id], now));
  if (active.length === 0) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1" suppressHydrationWarning>
      {active.map((u) => (
        <span
          key={u.id}
          title={`${u.label} desbloqueado ${unlocks[u.id]!.until === null ? "sem prazo" : `até ${formatDate(unlocks[u.id]!.until)}`}`}
          className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-px text-[9.5px] font-semibold text-emerald-200"
        >
          <LockOpen className="h-2.5 w-2.5" />
          {u.short} · {remainingShort(unlocks[u.id]!.until, now)}
        </span>
      ))}
    </span>
  );
}

export function SeoUnlockButton({
  slug,
  title,
  unlocks,
}: {
  slug: string;
  title: string;
  unlocks: ProjectUnlocks | undefined;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = UNLOCK_UNITS.filter((u) => isGrantActive(unlocks?.[u.id])).length;
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        title={`Desbloquear partes de “${title}”`}
        aria-label={`Desbloquear partes de ${title}`}
        className={`absolute right-[4.875rem] top-2.5 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full border transition ${
          activeCount > 0
            ? "border-emerald-400/45 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
            : "border-white/15 bg-black/30 text-white/55 opacity-70 hover:border-emerald-400/60 hover:bg-emerald-500/15 hover:text-emerald-200 hover:opacity-100"
        }`}
      >
        <LockOpen className="h-3.5 w-3.5" />
        {activeCount > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white">
            {activeCount}
          </span>
        )}
      </button>
      {open && createPortal(<UnlockDialog slug={slug} title={title} unlocks={unlocks ?? {}} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function UnlockDialog({
  slug,
  title,
  unlocks,
  onClose,
}: {
  slug: string;
  title: string;
  unlocks: ProjectUnlocks;
  onClose: () => void;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [units, setUnits] = useState<UnlockUnitId[]>(["aprovacoes"]);
  const [days, setDays] = useState<number | null>(30);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearInterval(t);
    };
  }, [onClose]);

  const granted = UNLOCK_UNITS.filter((u) => unlocks[u.id]);

  async function call(method: "PUT" | "DELETE", body: unknown, key: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(`/api/admin/seo-paused/${encodeURIComponent(slug)}/unlocks`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Não foi possível gravar.");
      router.refresh();
      if (method === "PUT") onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gravar.");
    } finally {
      setBusy(null);
    }
  }

  const toggleUnit = (id: UnlockUnitId) =>
    setUnits((cur) => (cur.includes(id) ? cur.filter((u) => u !== id) : [...cur, id]));

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={`Desbloquear ${title}`}>
      <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-black/70" />
      <div className="relative max-h-[92dvh] w-full max-w-[560px] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0d0b16] p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 rounded-t-3xl" style={{ background: "var(--brand-gradient)" }} />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold text-amber-300/80">Projeto em pausa</p>
            <h2 className="mt-0.5 text-[20px] font-semibold leading-tight text-white">Desbloquear partes de {title}</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-white/50">
              O projeto continua em pausa. O que abrires aqui fica disponível ao cliente, com o prazo à vista, e volta a fechar
              sozinho no fim.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/50 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {granted.length > 0 && (
          <section className="mt-5">
            <p className="text-[12.5px] font-semibold text-white/60">Em vigor</p>
            <ul className="mt-2 space-y-2">
              {granted.map((u) => {
                const g = unlocks[u.id]!;
                const active = isGrantActive(g, now);
                return (
                  <li
                    key={u.id}
                    className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 ${
                      active ? "border-emerald-400/25 bg-emerald-400/[0.06]" : "border-white/10 bg-white/[0.02] opacity-70"
                    }`}
                  >
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${active ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-white/50"}`}>
                      {active ? <LockOpen className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1" suppressHydrationWarning>
                      <p className="text-[14px] font-semibold text-white">{u.label}</p>
                      <p className="text-[12.5px] text-white/50">
                        {!active
                          ? `Fechou a ${formatDate(g.until)}`
                          : g.until === null
                            ? "Sem prazo"
                            : (
                              <>
                                Até {formatDate(g.until)} ·{" "}
                                <span className="font-semibold text-emerald-200">{remainingLabel(g.until, now, "pt")}</span>
                              </>
                            )}
                        {g.grantedBy ? ` · por ${g.grantedBy.split(" ")[0]}` : ""}
                      </p>
                    </div>
                    <a
                      href={`/${encodeURIComponent(slug)}${u.path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir como o cliente vê"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/45 hover:bg-white/10 hover:text-white"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => call("DELETE", { unit: u.id }, `del:${u.id}`)}
                      disabled={busy !== null}
                      className="shrink-0 rounded-xl border border-white/12 px-2.5 py-1.5 text-[12px] font-medium text-white/70 transition hover:border-rose-400/50 hover:text-rose-200 disabled:opacity-50"
                    >
                      {busy === `del:${u.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : active ? "Fechar já" : "Limpar"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="mt-6">
          <p className="text-[12.5px] font-semibold text-white/60">O que desbloquear</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {UNLOCK_UNITS.map((u) => {
              const on = units.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleUnit(u.id)}
                  aria-pressed={on}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[13px] transition ${
                    on ? "border-[#c4a6ff]/60 bg-[#783DF5]/15 text-white" : "border-white/10 text-white/60 hover:border-white/25 hover:text-white"
                  }`}
                >
                  <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${on ? "border-[#c4a6ff] bg-[#c4a6ff] text-[#120f24]" : "border-white/25"}`}>
                    {on && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  {u.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-5">
          <p className="text-[12.5px] font-semibold text-white/60">Durante quanto tempo</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {UNLOCK_DURATIONS.map((d) => {
              const on = days === d.days;
              return (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => setDays(d.days)}
                  aria-pressed={on}
                  className={`rounded-xl border px-2 py-2.5 text-[13px] font-medium transition ${
                    on ? "border-white bg-white text-[#07080d]" : "border-white/12 text-white/65 hover:border-white/30 hover:text-white"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 text-[12.5px] text-white/45" suppressHydrationWarning>
            {days === null
              ? "Fica aberto até o fechares aqui ou reativares o projeto."
              : `Fica aberto até ${formatDate(now + days * DAY)} e fecha sozinho a seguir.`}
          </p>
        </section>

        {error && <p className="mt-4 text-[13px] text-rose-300">{error}</p>}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-[13.5px] text-white/60 hover:text-white">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => call("PUT", { units, days }, "put")}
            disabled={units.length === 0 || busy !== null}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "var(--brand-gradient)" }}
          >
            {busy === "put" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockOpen className="h-4 w-4" />}
            Desbloquear{units.length > 0 ? ` (${units.length})` : ""}
          </button>
        </div>
        {units.some((u) => unlockUnit(u) && isGrantActive(unlocks[u], now)) && (
          <p className="mt-2 text-right text-[12px] text-white/40">O que já estava aberto passa a contar o prazo novo a partir de hoje.</p>
        )}
      </div>
    </div>
  );
}
