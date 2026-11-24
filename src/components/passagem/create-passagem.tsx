"use client";

// «Nova passagem» (v80.39) — a direção escolhe quem sai, o motivo, as datas,
// os projetos e quem fica com cada um. «Distribuir» sugere quem entra pela
// carga de cada consultor (quem tem menos projetos recebe primeiro).

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, Shuffle } from "lucide-react";
import { PersonAvatar } from "./ui";
import { PASSAGEM_DAYS, PASSAGEM_REASONS, addDaysISO, formatISODate, type PassagemReason } from "@/lib/passagem/shared";

export type CreateConsultant = {
  username: string;
  name: string;
  avatar: string | null;
  clients: Array<{ slug: string; title: string; icon: string | null }>;
  busy: boolean;
};

const field =
  "w-full rounded-xl border border-white/12 bg-black/30 px-3.5 py-2.5 text-[14px] text-white outline-none transition placeholder:text-white/25 focus:border-[#783DF5]/70 focus:ring-2 focus:ring-[#783DF5]/30";

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
      <div className="flex items-start gap-3.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-[13px] font-semibold text-white">{n}</span>
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
  const others = useMemo(() => consultants.filter((c) => c.username !== outgoing), [consultants, outgoing]);
  const chosen = who ? who.clients.filter((c) => picked[c.slug] !== false) : [];

  function pickOutgoing(username: string) {
    setOutgoing(username);
    setPicked({});
    setIncoming({});
    setError(null);
  }

  /** Quem tem menos projetos (contando os que já recebeu aqui) leva o próximo. */
  function distribute() {
    if (!who) return;
    const load = new Map(others.map((o) => [o.username, o.clients.length]));
    const next: Record<string, string> = {};
    for (const c of chosen) {
      const target = [...load.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0];
      if (!target) break;
      next[c.slug] = target[0];
      load.set(target[0], target[1] + 1);
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

  const assignedCount = chosen.filter((c) => incoming[c.slug]).length;

  return (
    <div className="space-y-4">
      <Step n={1} title="Quem sai" hint="O consultor que vai passar os projetos.">
        <div className="flex flex-wrap gap-2">
          {consultants.map((c) => {
            const on = c.username === outgoing;
            return (
              <button
                key={c.username}
                type="button"
                disabled={c.busy}
                onClick={() => pickOutgoing(c.username)}
                title={c.busy ? "Já tem uma passagem a decorrer" : undefined}
                className={`inline-flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-[13.5px] transition disabled:cursor-not-allowed disabled:opacity-35 ${
                  on ? "border-[#783DF5]/70 bg-[#783DF5]/15 text-white" : "border-white/12 text-white/75 hover:border-white/25"
                }`}
              >
                <PersonAvatar name={c.name} avatar={c.avatar} size={26} />
                <span>
                  <span className="block font-medium">{c.name}</span>
                  <span className="block text-[11.5px] text-white/45">
                    {c.busy ? "passagem a decorrer" : `${c.clients.length} projeto${c.clients.length === 1 ? "" : "s"}`}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Step>

      {who && (
        <>
          <Step n={2} title="Motivo e prazo" hint={`São ${PASSAGEM_DAYS} dias por defeito. Podes mudar o fim depois.`}>
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
                <span className="mb-1.5 block text-[12.5px] text-white/55">Termina a (último dia)</span>
                <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className={field} />
              </label>
            </div>
          </Step>

          <Step n={3} title="Projetos e quem fica com cada um" hint="Podes deixar quem entra por decidir e escolher mais tarde no cockpit.">
            {who.clients.length === 0 ? (
              <p className="text-[13.5px] text-white/50">{who.name} não tem projetos ativos.</p>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12.5px] text-white/45">
                    {chosen.length} de {who.clients.length} projetos · {assignedCount} com destino
                  </p>
                  <button
                    type="button"
                    onClick={distribute}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-1.5 text-[12.5px] text-white/75 transition hover:border-white/30 hover:text-white"
                  >
                    <Shuffle className="h-3.5 w-3.5" /> Distribuir pela carga
                  </button>
                </div>
                <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/10">
                  {who.clients.map((c) => {
                    const on = picked[c.slug] !== false;
                    return (
                      <li key={c.slug} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${on ? "" : "opacity-45"}`}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          onClick={() => setPicked((p) => ({ ...p, [c.slug]: !on }))}
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                            on ? "border-[#783DF5] bg-[#783DF5]" : "border-white/25"
                          }`}
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
                          className="w-full rounded-lg border border-white/12 bg-black/40 px-2.5 py-1.5 text-[13px] text-white outline-none focus:border-[#783DF5]/70 sm:w-56"
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

          <Step n={4} title="Nota para quem sai (opcional)" hint="Aparece no topo da página dele. Ex.: prioridades, clientes sensíveis.">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} className={`${field} resize-none`} />
          </Step>

          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <button
              type="button"
              disabled={busy || chosen.length === 0 || !startDate || !endDate}
              onClick={submit}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: "linear-gradient(90deg,#783DF5,#E040A0)" }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Abrir passagem de {who.name.split(" ")[0]}
            </button>
            <p className="text-[12.5px] leading-relaxed text-white/45">
              {who.name.split(" ")[0]} passa a ver «A minha passagem» no menu do nome, de {formatISODate(startDate)} a {formatISODate(endDate)}.
              Quem entra vê a ficha de cada projeto que recebe e pode fazer perguntas.
            </p>
            {error && <p className="w-full text-[13px] text-rose-300">{error}</p>}
          </div>
        </>
      )}
    </div>
  );
}
