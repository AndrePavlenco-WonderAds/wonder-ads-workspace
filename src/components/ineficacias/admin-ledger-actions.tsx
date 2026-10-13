"use client";

// As ações da direção sobre a ESCALA de um consultor:
//   • registar a medida do nível atingido (o 1:1 com as ações, ou o arranque
//     do probation) — reinicia os contadores a partir do dia seguinte;
//   • definir o nível à mão, com justificação (falha grave → probation
//     direto; reintegração → volta a 0);
//   • registar uma ocorrência diretamente, já pontuada.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ChevronDown, ClipboardCheck, Loader2, PlusCircle, Scale, Wand2 } from "lucide-react";
import {
  formatISODate,
  LEVELS,
  NOTICED_OPTIONS,
  REASONS,
  type IneficaciaLevel,
  type IneficaciaNoticed,
  type IneficaciaReason,
  type PendingMeasure,
} from "@/lib/ineficacias/shared";
import { ScorePicker } from "./admin-scoring";

async function post(path: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? null : (data.error ?? "Não foi possível gravar.");
  } catch {
    return "Falha de rede.";
  }
}

function Panel({
  icon: Icon,
  title,
  hint,
  tone = "default",
  defaultOpen = false,
  children,
}: {
  icon: typeof Scale;
  title: string;
  hint: string;
  tone?: "default" | "amber" | "rose";
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const ring =
    tone === "amber" ? "border-amber-400/30 bg-amber-400/[0.05]" : tone === "rose" ? "border-rose-400/30 bg-rose-500/[0.05]" : "border-white/[0.08] bg-white/[0.02]";
  const iconTone = tone === "amber" ? "text-amber-300" : tone === "rose" ? "text-rose-300" : "text-[#c3aaff]";
  return (
    <section className={`rounded-2xl border ${ring}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] ${iconTone}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-white/90">{title}</span>
          <span className="block text-[11px] text-white/45">{hint}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-white/40 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-white/[0.06] px-4 pb-4 pt-3.5">{children}</div>}
    </section>
  );
}

const LABEL = "block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40";

export function MeasureForm({
  username,
  pending,
  today,
  defaultConductedBy,
}: {
  username: string;
  pending: PendingMeasure;
  today: string;
  defaultConductedBy: string;
}) {
  const router = useRouter();
  const [at, setAt] = useState(today);
  const [conductedBy, setConductedBy] = useState(defaultConductedBy);
  const [actions, setActions] = useState<string[]>(["", "", ""]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const level = pending.level;
  const def = LEVELS[level];

  async function save() {
    setBusy(true);
    setError(null);
    const err = await post("/api/admin/ineficacias/measure", {
      username,
      level,
      at,
      conductedBy,
      actions: actions.map((a) => a.trim()).filter(Boolean),
      note,
    });
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <Panel
      icon={ClipboardCheck}
      title={`Registar a medida do nível ${level}`}
      hint={`${def.measure} Atingido a ${formatISODate(pending.since)} com PA ${pending.pa} · NO ${pending.no}.`}
      tone={level === 3 ? "rose" : "amber"}
      defaultOpen
    >
      {level === 3 && (
        <p className="mb-3 flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-500/[0.06] px-3.5 py-2.5 text-[12px] leading-relaxed text-rose-100/90">
          <Scale className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            O nível 3 é o probation: cria o plano escrito (KPIs e cadência) no módulo de Probation e regista aqui a data
            do kickoff.{" "}
            <Link href="/admin/probation/novo" className="inline-flex items-center gap-1 font-semibold underline underline-offset-2">
              Abrir Plano de Probation <ArrowUpRight className="h-3 w-3" />
            </Link>
          </span>
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label>
          <span className={LABEL}>{level === 3 ? "Data do kickoff" : "Data do 1:1"}</span>
          <input type="date" value={at} max={today} onChange={(e) => setAt(e.target.value)} className="modal-input mt-1 w-full text-[12.5px]" />
        </label>
        <label>
          <span className={LABEL}>{level === 3 ? "Responsável" : "Quem conduziu"}</span>
          <input type="text" value={conductedBy} maxLength={120} onChange={(e) => setConductedBy(e.target.value)} className="modal-input mt-1 w-full text-[12.5px]" />
        </label>
      </div>
      {level < 3 && (
        <div className="mt-3">
          <span className={LABEL}>{level === 1 ? "Plano de 1 a 3 ações" : "Medidas extra (1 a 3)"}</span>
          <div className="mt-1 space-y-1.5">
            {actions.map((a, i) => (
              <input
                key={i}
                type="text"
                value={a}
                maxLength={300}
                placeholder={`Ação ${i + 1}${i === 0 ? " (obrigatória)" : " (opcional)"}`}
                onChange={(e) => setActions((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                className="modal-input w-full text-[12.5px]"
              />
            ))}
          </div>
        </div>
      )}
      <label className="mt-3 block">
        <span className={LABEL}>Nota (opcional)</span>
        <textarea value={note} rows={2} maxLength={1000} onChange={(e) => setNote(e.target.value)} className="modal-input mt-1 w-full resize-y text-[12.5px]" />
      </label>
      {error && <p className="mt-2 text-[11.5px] font-semibold text-rose-300">{error}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        style={{ background: "var(--brand-gradient)" }}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
        Registar medida e reiniciar contadores
      </button>
      <p className="mt-2 text-[10.5px] text-white/40">
        O consultor fica no nível {level}; as ocorrências a partir do dia seguinte contam para o nível seguinte. As
        ineficácias anteriores não se apagam.
      </p>
    </Panel>
  );
}

export function SetLevelForm({ username, currentLevel, today }: { username: string; currentLevel: IneficaciaLevel; today: string }) {
  const router = useRouter();
  const [level, setLevel] = useState<IneficaciaLevel>(currentLevel);
  const [at, setAt] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function save() {
    setBusy(true);
    setError(null);
    const err = await post("/api/admin/ineficacias/level", { username, level, at, note });
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setNote("");
    startTransition(() => router.refresh());
  }

  return (
    <Panel icon={Wand2} title="Definir o nível à mão" hint="Falha grave → probation direto · reintegração → volta a 0. Fica no histórico, com justificação.">
      <div className="flex flex-wrap gap-2">
        {LEVELS.map((l) => (
          <button
            key={l.level}
            type="button"
            onClick={() => setLevel(l.level)}
            className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition ${
              level === l.level ? "border-[#a78bfa] bg-[#783DF5]/20 text-white" : "border-white/10 text-white/55 hover:bg-white/[0.05]"
            }`}
          >
            {l.title}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr]">
        <label>
          <span className={LABEL}>Data</span>
          <input type="date" value={at} max={today} onChange={(e) => setAt(e.target.value)} className="modal-input mt-1 w-full text-[12.5px]" />
        </label>
        <label>
          <span className={LABEL}>Justificação (obrigatória)</span>
          <input type="text" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="Porquê — fica no histórico do consultor" className="modal-input mt-1 w-full text-[12.5px]" />
        </label>
      </div>
      {error && <p className="mt-2 text-[11.5px] font-semibold text-rose-300">{error}</p>}
      <button
        type="button"
        disabled={busy || note.trim().length < 5 || level === currentLevel}
        onClick={() => void save()}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-4 py-2 text-[12.5px] font-semibold text-white/85 transition hover:bg-white/[0.1] disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
        Definir nível {level}
      </button>
    </Panel>
  );
}

export function DirectOccurrenceForm({ username, today }: { username: string; today: string }) {
  const router = useRouter();
  const [occurredOn, setOccurredOn] = useState(today);
  const [client, setClient] = useState("");
  const [what, setWhat] = useState("");
  const [reason, setReason] = useState<IneficaciaReason>("atencao");
  const [reasonOther, setReasonOther] = useState("");
  const [shouldHave, setShouldHave] = useState("");
  const [noticed, setNoticed] = useState<IneficaciaNoticed>("equipa");
  const [points, setPoints] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function save() {
    if (points === null) {
      setError("Escolhe a pontuação (0 a 10).");
      return;
    }
    setBusy(true);
    setError(null);
    const err = await post("/api/admin/ineficacias/occurrence", {
      username,
      occurredOn,
      client,
      what,
      reason,
      reasonOther,
      shouldHave,
      noticed,
      points,
      note,
    });
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setWhat("");
    setShouldHave("");
    setClient("");
    setPoints(null);
    setNote("");
    startTransition(() => router.refresh());
  }

  return (
    <Panel icon={PlusCircle} title="Registar uma ocorrência pela direção" hint="Algo que não foi reportado, ou que a direção viu primeiro. Nasce já pontuada e o consultor vê-a no histórico dele.">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label>
          <span className={LABEL}>Data em que ocorreu</span>
          <input type="date" value={occurredOn} max={today} onChange={(e) => setOccurredOn(e.target.value)} className="modal-input mt-1 w-full text-[12.5px]" />
        </label>
        <label>
          <span className={LABEL}>Cliente ou projeto</span>
          <input type="text" value={client} maxLength={120} onChange={(e) => setClient(e.target.value)} placeholder="ou «Interno»" className="modal-input mt-1 w-full text-[12.5px]" />
        </label>
        <label className="sm:col-span-2">
          <span className={LABEL}>O que aconteceu</span>
          <textarea value={what} rows={2} maxLength={2000} onChange={(e) => setWhat(e.target.value)} className="modal-input mt-1 w-full resize-y text-[12.5px]" />
        </label>
        <label>
          <span className={LABEL}>Motivo</span>
          <select value={reason} onChange={(e) => setReason(e.target.value as IneficaciaReason)} className="modal-input mt-1 w-full text-[12.5px]">
            {REASONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.letter}) {r.label}
              </option>
            ))}
          </select>
          {reason === "outro" && (
            <input type="text" value={reasonOther} maxLength={200} onChange={(e) => setReasonOther(e.target.value)} placeholder="Especifica" className="modal-input mt-1.5 w-full text-[12.5px]" />
          )}
        </label>
        <label>
          <span className={LABEL}>Quem deu pelo erro</span>
          <select value={noticed} onChange={(e) => setNoticed(e.target.value as IneficaciaNoticed)} className="modal-input mt-1 w-full text-[12.5px]">
            {NOTICED_OPTIONS.map((n) => (
              <option key={n.id} value={n.id}>
                {n.read}
              </option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className={LABEL}>Como deveria ter sido feito (opcional)</span>
          <textarea value={shouldHave} rows={2} maxLength={2000} onChange={(e) => setShouldHave(e.target.value)} className="modal-input mt-1 w-full resize-y text-[12.5px]" />
        </label>
      </div>
      <div className="mt-3">
        <span className={LABEL}>Pontuação</span>
        <div className="mt-1.5">
          <ScorePicker value={points} onChange={setPoints} />
        </div>
      </div>
      <input type="text" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional) — o consultor vê-a" className="modal-input mt-3 w-full text-[12.5px]" />
      {error && <p className="mt-2 text-[11.5px] font-semibold text-rose-300">{error}</p>}
      <button
        type="button"
        disabled={busy || what.trim().length < 10 || points === null}
        onClick={() => void save()}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        style={{ background: "var(--brand-gradient)" }}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlusCircle className="h-3.5 w-3.5" />}
        Registar ocorrência
      </button>
    </Panel>
  );
}
