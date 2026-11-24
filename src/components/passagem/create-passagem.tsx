"use client";

// «Nova passagem» (v80.39; resumo ao vivo v80.40) — a direção escolhe quem
// sai, o motivo, as datas, os projetos e quem fica com cada um. À direita, o
// resumo vivo: quem sai, o prazo e a CARGA de cada consultor antes e depois
// (para não sobrecarregar ninguém sem dar por isso). «Distribuir pela carga»
// sugere quem entra: quem tem menos projetos recebe primeiro.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Check, Loader2, Shuffle } from "lucide-react";
import { PersonAvatar } from "./ui";
import { PASSAGEM_DAYS, PASSAGEM_REASONS, addDaysISO, daysBetweenISO, firstName, formatISODate, reasonLabel, type PassagemReason } from "@/lib/passagem/shared";

export type CreateConsultant = {
  username: string;
  name: string;
  avatar: string | null;
  clients: Array<{ slug: string; title: string; icon: string | null }>;
  busy: boolean;
};

const field =
  "w-full rounded-xl border border-white/12 bg-black/30 px-3.5 py-2.5 text-[14px] text-white outline-none transition placeholder:text-white/25 focus:border-[#783DF5]/70 focus:ring-2 focus:ring-[#783DF5]/30";

function Step({ n, title, hint, done, children }: { n: number; title: string; hint?: string; done?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
      <div className="flex items-start gap-3.5">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${
            done ? "bg-emerald-500 text-white" : "bg-white/10 text-white"
          }`}
        >
          {done ? <Check className="h-4 w-4" /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-semibold text-white">{title}</h3>
          {hint && <p className="mt-0.5 text-[13px] leading-relaxed text-white/50">{hint}</p>}
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

export function CreatePassagem({ consultants, today }: { consultants: CreateConsultant[]; today: string }) {
  const router = useRouter();
  const [outgoing, setOutgoing] = useState<string | null>(null);
  const [reason, setReason] = useState<PassagemReason>("saida");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDaysISO(today, PASSAGEM_DAYS - 1));
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [incoming, setIncoming] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const who = consultants.find((c) => c.username === outgoing) ?? null;
  // Quem está a sair (outra passagem ativa) não recebe projetos.
  const others = useMemo(() => consultants.filter((c) => c.username !== outgoing && !c.busy), [consultants, outgoing]);
  const chosen = who ? who.clients.filter((c) => picked[c.slug] !== false) : [];
  const assigned = chosen.filter((c) => incoming[c.slug]).length;
  const days = startDate && endDate ? daysBetweenISO(startDate, endDate) + 1 : 0;

  // Carga de cada um depois da passagem (só conta o que já tem destino).
  const load = others.map((o) => {
    const gets = chosen.filter((c) => incoming[c.slug] === o.username).length;
    return { ...o, before: o.clients.length, after: o.clients.length + gets, gets };
  });
  const maxAfter = Math.max(1, ...load.map((l) => l.after));

  function pickOutgoing(username: string) {
    setOutgoing(username);
    setPicked({});
    setIncoming({});
    setError(null);
  }

  /** Quem tem menos projetos (contando os que já recebeu aqui) leva o próximo. */
  function distribute() {
    if (!who) return;
    const l = new Map(others.map((o) => [o.username, o.clients.length]));
    const next: Record<string, string> = {};
    for (const c of chosen) {
      const target = [...l.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0];
      if (!target) break;
      next[c.slug] = target[0];
      l.set(target[0], target[1] + 1);
    }
    setIncoming(next);
  }

  async function submit() {
    if (!who) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/passagens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          outgoing: who.username,
          reason,
          startDate,
          endDate,
          note,
          projects: chosen.map((c) => ({ slug: c.slug, incoming: incoming[c.slug] || null })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error ?? "Não foi possível abrir a passagem.");
      router.push(`/admin/passagens/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível abrir a passagem.");
      setBusy(false);
    }
  }

  const canSubmit = Boolean(who) && chosen.length > 0 && Boolean(startDate) && Boolean(endDate) && endDate >= startDate && !busy;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
      <div className="space-y-4">
        <Step n={1} title="Quem sai" hint="O consultor que vai passar os projetos." done={Boolean(who)}>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {consultants.map((c) => {
              const on = c.username === outgoing;
              return (
                <button
                  key={c.username}
                  type="button"
                  disabled={c.busy}
                  onClick={() => pickOutgoing(c.username)}
                  title={c.busy ? "Já tem uma passagem a decorrer" : undefined}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-35 ${
                    on ? "border-[#783DF5]/70 bg-[#783DF5]/15" : "border-white/12 hover:border-white/25 hover:bg-white/[0.03]"
                  }`}
                >
                  <PersonAvatar name={c.name} avatar={c.avatar} size={34} />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium text-white">{c.name}</span>
                    <span className="block text-[12px] text-white/45">
                      {c.busy ? "passagem a decorrer" : `${c.clients.length} projeto${c.clients.length === 1 ? "" : "s"}`}
                    </span>
                  </span>
                  {on && <Check className="ml-auto h-4 w-4 shrink-0 text-[#c4a6ff]" />}
                </button>
              );
            })}
          </div>
        </Step>

        {who && (
          <>
            <Step n={2} title="Motivo e prazo" hint={`${PASSAGEM_DAYS} dias por defeito. Podes mudar o fim depois, no cockpit.`} done={days > 0}>
              <div className="flex flex-wrap gap-2">
                {PASSAGEM_REASONS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setReason(r.id)}
                    className={`rounded-xl border px-3.5 py-2 text-[13.5px] transition ${
                      reason === r.id ? "border-[#783DF5]/70 bg-[#783DF5]/15 text-white" : "border-white/12 text-white/70 hover:border-white/25"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[12.5px] text-white/55">Começa a</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (e.target.value) setEndDate(addDaysISO(e.target.value, PASSAGEM_DAYS - 1));
                    }}
                    className={field}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[12.5px] text-white/55">Último dia</span>
                  <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className={field} />
                </label>
              </div>
            </Step>

            <Step
              n={3}
              title="Projetos e quem fica com cada um"
              hint="Podes deixar alguns por decidir e escolher depois no cockpit."
              done={chosen.length > 0 && assigned === chosen.length}
            >
              {who.clients.length === 0 ? (
                <p className="text-[13.5px] text-white/50">{who.name} não tem projetos ativos.</p>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[12.5px] text-white/45">
                      {chosen.length} de {who.clients.length} projetos · {assigned} com destino
                    </p>
                    <button
                      type="button"
                      onClick={distribute}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#783DF5]/40 bg-[#783DF5]/10 px-3 py-1.5 text-[12.5px] text-[#d9c8ff] transition hover:border-[#783DF5]/70 hover:text-white"
                    >
                      <Shuffle className="h-3.5 w-3.5" /> Distribuir pela carga
                    </button>
                  </div>
                  <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/10">
                    {who.clients.map((c) => {
                      const on = picked[c.slug] !== false;
                      return (
                        <li key={c.slug} className={`flex flex-wrap items-center gap-3 px-4 py-3 transition ${on ? "" : "opacity-45"}`}>
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={on}
                            aria-label={`Incluir ${c.title}`}
                            onClick={() => setPicked((p) => ({ ...p, [c.slug]: !on }))}
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${on ? "border-[#783DF5] bg-[#783DF5]" : "border-white/25"}`}
                          >
                            {on && <Check className="h-3.5 w-3.5 text-white" />}
                          </button>
                          <span className="min-w-0 flex-1 truncate text-[14px] text-white">
                            {c.icon ? `${c.icon} ` : ""}
                            {c.title}
                          </span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-white/25" />
                          <select
                            value={incoming[c.slug] ?? ""}
                            disabled={!on}
                            onChange={(e) => setIncoming((m) => ({ ...m, [c.slug]: e.target.value }))}
                            aria-label={`Quem fica com ${c.title}`}
                            className={`w-full rounded-lg border bg-black/40 px-2.5 py-1.5 text-[13px] outline-none focus:border-[#783DF5]/70 sm:w-56 ${
                              incoming[c.slug] ? "border-white/12 text-white" : "border-dashed border-white/20 text-white/50"
                            }`}
                          >
                            <option value="">Por decidir</option>
                            {others.map((o) => (
                              <option key={o.username} value={o.username}>
                                {o.name} · {o.clients.length} proj.
                              </option>
                            ))}
                          </select>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </Step>

            <Step n={4} title="Nota para quem sai (opcional)" hint="Aparece no topo da página de quem sai. Ex.: prioridades, clientes sensíveis." done={note.trim().length > 0}>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} className={`${field} resize-none`} />
            </Step>
          </>
        )}
      </div>

      {/* ── Resumo vivo ─────────────────────────────────────────────── */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">Resumo</p>
          {who ? (
            <>
              <div className="mt-3 flex items-center gap-3">
                <PersonAvatar name={who.name} avatar={who.avatar} size={40} />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-white">{who.name}</p>
                  <p className="text-[12.5px] text-white/50">{reasonLabel(reason)}</p>
                </div>
              </div>
              <dl className="mt-4 space-y-1.5 text-[13px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-white/45">Prazo</dt>
                  <dd className="text-right text-white">
                    {formatISODate(startDate)} → {formatISODate(endDate)}
                    {days > 0 && <span className="text-white/45"> · {days} dias</span>}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-white/45">Projetos</dt>
                  <dd className="text-white">
                    {chosen.length} · {assigned} com destino
                  </dd>
                </div>
              </dl>

              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">Carga depois da passagem</p>
              <ul className="mt-2.5 space-y-2.5">
                {load.map((l) => (
                  <li key={l.username}>
                    <div className="flex items-center justify-between gap-2 text-[12.5px]">
                      <span className="flex min-w-0 items-center gap-2 text-white/80">
                        <PersonAvatar name={l.name} avatar={l.avatar} size={20} />
                        <span className="truncate">{l.name}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-white/55">
                        {l.before}
                        {l.gets > 0 && (
                          <>
                            {" "}
                            → <span className="font-semibold text-white">{l.after}</span>
                          </>
                        )}
                      </span>
                    </div>
                    <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                      <div className="h-full bg-white/30" style={{ width: `${(l.before / maxAfter) * 100}%` }} />
                      <div className="h-full" style={{ width: `${(l.gets / maxAfter) * 100}%`, background: "linear-gradient(90deg,#783DF5,#E040A0)" }} />
                    </div>
                  </li>
                ))}
              </ul>
              {chosen.length > assigned && (
                <p className="mt-4 flex items-start gap-1.5 text-[12px] leading-relaxed text-amber-200/90">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {chosen.length - assigned} projeto{chosen.length - assigned === 1 ? "" : "s"} sem destino. Podes decidir depois.
                </p>
              )}
            </>
          ) : (
            <p className="mt-3 text-[13.5px] leading-relaxed text-white/50">Escolhe quem sai para ver os projetos, o prazo e a carga de cada colega.</p>
          )}

          <button
            type="button"
            disabled={!canSubmit}
            onClick={submit}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "linear-gradient(90deg,#783DF5,#E040A0)" }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {who ? `Abrir a passagem de ${firstName(who.name)}` : "Abrir passagem"}
          </button>
          {who && (
            <p className="mt-2.5 text-[12px] leading-relaxed text-white/45">
              {firstName(who.name)} passa a ver «A minha passagem» no menu do nome. Quem entra vê a ficha de cada projeto que recebe.
            </p>
          )}
          {error && <p className="mt-2 text-[13px] text-rose-300">{error}</p>}
        </div>
      </aside>
    </div>
  );
}
