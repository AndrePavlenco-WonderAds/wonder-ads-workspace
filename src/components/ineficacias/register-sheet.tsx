"use client";

// A folha RH-04 — a direção regista uma ineficácia de um consultor (v77.90).
// O mesmo papel das outras folhas de RH, com o que a direção decide por cima:
// quem, o erro cometido, se foi a primeira vez, quem deu por ele, a GRAVIDADE
// (as bandas da escala) e a pontuação exata — e, ao vivo, o que isso faz à
// escala do consultor (PA, NO, nível) antes de carregar no botão.
//
// O impacto é calculado no browser com a mesma `deriveLedger` do servidor:
// recebe as ocorrências pontuadas de cada consultor (sem texto nenhum) e os
// eventos da escala, e junta a ocorrência que está a ser escrita.
//
// A CALCULADORA (v77.93): o que o erro causou (caixas), o motivo, a primeira
// vez, aprendizagem/recorrência e quem deu pelo erro dão uma pontuação
// sugerida (`suggestScore`, a mesma que o servidor grava). A direção aplica-a
// com um clique ou escolhe outra — a decisão continua a ser dela.

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calculator,
  Check,
  CheckCircle2,
  GraduationCap,
  Loader2,
  PenLine,
  Repeat,
  RotateCcw,
  TrendingUp,
  Wand2,
} from "lucide-react";
import { SheetSection, SignatureLine, formatDatePT } from "@/components/absences/sheet";
import {
  addDaysISO,
  deriveLedger,
  DIRECT_LOOKBACK_DAYS,
  ERROR_TYPES,
  firstName,
  IMPACTS,
  LEVELS,
  LIMITS,
  NOTICED_OPTIONS,
  REASONS,
  SCORE_BANDS,
  bandOf,
  isISODate,
  suggestScore,
  type IneficaciaErrorType,
  type IneficaciaImpact,
  type IneficaciaNoticed,
  type IneficaciaReason,
  type LedgerEvent,
  type LedgerState,
  type Occurrence,
  type ScoreBand,
  type ScoreSuggestion,
} from "@/lib/ineficacias/shared";

export type RegisterPerson = {
  username: string;
  name: string;
  fullName: string;
  role: string;
  dept: string;
  avatar: string | null;
  /** As ocorrências da pessoa, SEM texto — só datas e pontuações. */
  occurrences: Occurrence[];
  events: LedgerEvent[];
  /** Os dias em que um probation da pessoa fechou com recuperação (v78.57). */
  recoveries: string[];
};

const PAPER_BAND: Record<ScoreBand["id"], { on: string; off: string; text: string; dot: string }> = {
  zero: { on: "border-black/40 bg-black/[0.06]", off: "border-black/12", text: "text-black/60", dot: "bg-black/30" },
  baixo: { on: "border-emerald-600 bg-emerald-600/[0.08]", off: "border-emerald-600/25", text: "text-emerald-700", dot: "bg-emerald-600" },
  medio: { on: "border-amber-600 bg-amber-500/[0.1]", off: "border-amber-600/25", text: "text-amber-700", dot: "bg-amber-500" },
  alto: { on: "border-orange-600 bg-orange-500/[0.1]", off: "border-orange-600/25", text: "text-orange-700", dot: "bg-orange-500" },
  critico: { on: "border-rose-600 bg-rose-500/[0.1]", off: "border-rose-600/25", text: "text-rose-700", dot: "bg-rose-600" },
};

const LEVEL_PAPER: Record<number, string> = {
  0: "border-emerald-600/30 bg-emerald-600/[0.07] text-emerald-800",
  1: "border-amber-600/35 bg-amber-500/[0.1] text-amber-800",
  2: "border-orange-600/35 bg-orange-500/[0.1] text-orange-800",
  3: "border-rose-600/35 bg-rose-500/[0.1] text-rose-800",
};

const GRAVITY_BANDS = SCORE_BANDS.filter((b) => b.id !== "zero");

type Phase = "fill" | "signing" | "done";

export function RegisterIneficaciaSheet({
  people,
  today,
  initialUsername,
  adminName,
}: {
  people: RegisterPerson[];
  today: string;
  initialUsername: string | null;
  adminName: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(
    initialUsername && people.some((p) => p.username === initialUsername) ? initialUsername : null,
  );
  const [occurredOn, setOccurredOn] = useState(today);
  const [client, setClient] = useState("");
  const [what, setWhat] = useState("");
  const [reason, setReason] = useState<IneficaciaReason | null>(null);
  const [reasonOther, setReasonOther] = useState("");
  const [firstTime, setFirstTime] = useState<boolean | null>(null);
  const [lastTime, setLastTime] = useState("");
  const [noticed, setNoticed] = useState<IneficaciaNoticed | null>(null);
  const [errorType, setErrorType] = useState<IneficaciaErrorType | null>(null);
  const [impacts, setImpacts] = useState<IneficaciaImpact[]>([]);
  const [shouldHave, setShouldHave] = useState("");
  const [points, setPoints] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [phase, setPhase] = useState<Phase>("fill");
  const [error, setError] = useState<string | null>(null);
  const [showStamp, setShowStamp] = useState(false);
  const [doneFor, setDoneFor] = useState<RegisterPerson | null>(null);
  const animationDoneRef = useRef<() => void>(() => {});
  const signatureZoneRef = useRef<HTMLDivElement | null>(null);

  const person = people.find((p) => p.username === username) ?? null;
  const dateMin = addDaysISO(today, -DIRECT_LOOKBACK_DAYS);
  const band = points === null ? null : bandOf(points);
  const suggestion = useMemo(
    () => suggestScore({ impacts, reason, firstTime, errorType, noticed }),
    [impacts, reason, firstTime, errorType, noticed],
  );

  const impact = useMemo(() => {
    if (!person || points === null || !isISODate(occurredOn)) return null;
    const before = deriveLedger(person.occurrences, person.events, today, person.recoveries);
    const draft: Occurrence = {
      id: "draft",
      source: "direcao",
      reportId: null,
      reportRef: null,
      occurredOn,
      what: "",
      client: "",
      reason: "outro",
      reasonOther: "",
      shouldHave: "",
      firstTime,
      lastTime: "",
      noticed: "equipa",
      errorType,
      score: { points, by: "", byName: "", at: 0, note: "" },
    };
    const after = deriveLedger([...person.occurrences, draft], person.events, today, person.recoveries);
    return { before, after };
  }, [person, points, occurredOn, firstTime, errorType, today]);

  const problem = (() => {
    if (!person) return "Escolhe o consultor (secção 1).";
    if (!isISODate(occurredOn)) return "Indica a data em que ocorreu.";
    if (occurredOn > today) return "A data não pode ser no futuro.";
    if (occurredOn < dateMin) return "A data é demasiado antiga (máximo um ano).";
    if (what.trim().length < 10) return "Descreve o erro cometido (pelo menos 10 caracteres).";
    if (!reason) return "Escolhe o motivo (A, B, C ou D).";
    if (reason === "outro" && reasonOther.trim().length < LIMITS.reasonOther.min) return "Especifica o motivo «Outro».";
    if (firstTime === null) return "Indica se foi a primeira vez.";
    if (firstTime === false && lastTime.trim().length < LIMITS.lastTime.min) return "Indica quando foi a última vez.";
    if (!errorType) return "Indica se foi um erro de aprendizagem ou de recorrência.";
    if (!noticed) return "Indica quem deu pelo erro.";
    if (points === null) return "Escolhe a gravidade e a pontuação (secção 3).";
    return null;
  })();

  const sectionOk = {
    who: Boolean(person),
    what:
      isISODate(occurredOn) &&
      what.trim().length >= 10 &&
      Boolean(reason) &&
      (reason !== "outro" || reasonOther.trim().length >= LIMITS.reasonOther.min) &&
      firstTime !== null &&
      (firstTime || lastTime.trim().length >= LIMITS.lastTime.min) &&
      Boolean(errorType) &&
      Boolean(noticed),
    score: points !== null,
  };

  async function submit(): Promise<string | null> {
    try {
      const res = await fetch("/api/admin/ineficacias/occurrence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username,
          occurredOn,
          client,
          what,
          reason,
          reasonOther,
          firstTime,
          lastTime,
          noticed,
          errorType,
          impacts,
          shouldHave,
          points,
          note,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return res.ok ? null : (data.error ?? "Não foi possível registar.");
    } catch {
      return "Falha de rede — a ineficácia não foi registada.";
    }
  }

  async function handleSign() {
    if (phase !== "fill") return;
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setPhase("signing");
    signatureZoneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const animation = new Promise<void>((resolve) => {
      animationDoneRef.current = resolve;
    });
    const [err] = await Promise.all([submit(), animation]);
    if (err) {
      setPhase("fill");
      setError(err);
      return;
    }
    setShowStamp(true);
    setDoneFor(person);
    setTimeout(() => {
      setPhase("done");
      router.refresh();
    }, 1100);
  }

  function resetForm(keepPerson: boolean) {
    if (!keepPerson) setUsername(null);
    setOccurredOn(today);
    setClient("");
    setWhat("");
    setReason(null);
    setReasonOther("");
    setFirstTime(null);
    setLastTime("");
    setNoticed(null);
    setErrorType(null);
    setImpacts([]);
    setShouldHave("");
    setPoints(null);
    setNote("");
    setShowStamp(false);
    setError(null);
    setDoneFor(null);
    setPhase("fill");
  }

  const signing = phase !== "fill";

  if (phase === "done" && doneFor) {
    return (
      <section className="animate-fade-up mx-auto w-full max-w-[920px] rounded-3xl border border-emerald-400/25 bg-emerald-400/[0.05] p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300 shadow-[0_12px_40px_-14px_rgba(52,211,153,0.8)]">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="readout text-emerald-200/70">Registado</p>
            <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-white">
              Ineficácia registada na ficha de {doneFor.fullName}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-white/65">
              Já conta no PA e no NO de {firstName(doneFor.fullName)} e aparece no histórico dele, marcada «registada pela
              direção».
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/admin/ineficacias/${encodeURIComponent(doneFor.username)}`}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white transition hover:brightness-110"
                style={{ background: "var(--brand-gradient)" }}
              >
                Ver a ficha de {firstName(doneFor.fullName)}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => resetForm(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.06] px-4 py-2 text-[12.5px] font-semibold text-white/85 transition hover:bg-white/[0.1]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Registar outra para {firstName(doneFor.fullName)}
              </button>
              <button
                type="button"
                onClick={() => resetForm(false)}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-[12.5px] font-semibold text-white/60 transition hover:text-white"
              >
                Outro consultor
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Registar uma ineficácia" className="relative mx-auto w-full max-w-[920px]">
      <div className="relative overflow-hidden rounded-[6px] bg-gradient-to-b from-[#fbfaf7] to-[#f0eee8] text-[#20202a] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.06)]">
        <div aria-hidden className="h-1.5 w-full" style={{ background: "var(--brand-gradient)" }} />
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] select-none whitespace-nowrap text-[110px] font-extrabold tracking-[0.3em] text-black/[0.028]"
        >
          WONDER ADS
        </span>

        <header className="relative flex flex-wrap items-start justify-between gap-4 border-b border-black/10 px-6 pb-5 pt-6 sm:px-10">
          <div>
            <p className="text-[19px] font-extrabold tracking-tight">
              Wonder{" "}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--brand-gradient)" }}>
                Ads
              </span>
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-black/45">
              Operações · Team Inefficiency · Direção
            </p>
          </div>
          <div className="rounded border border-black/15 bg-white/70 px-3.5 py-2 text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/50">Formulário RH-04</p>
            <p className="text-[13px] font-extrabold uppercase tracking-[0.08em]">Registo de ineficácia</p>
            <p className="mt-0.5 font-mono text-[10.5px] text-black/45">Lançado pela direção · {formatDatePT(today)}</p>
          </div>
        </header>

        <div className="relative px-6 py-6 sm:px-10 sm:py-8">
          {/* 1 — Consultor */}
          <SheetSection n={1} title="Consultor" done={sectionOk.who}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {people.map((p) => {
                const on = p.username === username;
                const s = deriveLedger(p.occurrences, p.events, today, p.recoveries);
                return (
                  <button
                    key={p.username}
                    type="button"
                    disabled={signing}
                    onClick={() => setUsername(p.username)}
                    aria-pressed={on}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                      on
                        ? "border-[#783DF5] bg-[#783DF5]/[0.08] shadow-[0_8px_24px_-14px_rgba(120,61,245,0.8)]"
                        : "border-black/12 bg-white/60 hover:border-black/30"
                    }`}
                  >
                    {p.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full border border-black/10 object-cover" />
                    ) : (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.07] text-[13px] font-bold text-black/55">
                        {p.name.charAt(0)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-black/85">{p.fullName}</span>
                      <span className="block truncate text-[10.5px] text-black/45">
                        {p.role} · PA {s.pa} · NO {s.no}
                      </span>
                    </span>
                    <span className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold ${LEVEL_PAPER[s.reached]}`}>
                      Nível {s.reached}
                    </span>
                  </button>
                );
              })}
            </div>
          </SheetSection>

          {/* 2 — O erro cometido */}
          <SheetSection n={2} title="O erro cometido" done={sectionOk.what}>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <label className="block">
                <span className="sheet-label">Data em que ocorreu</span>
                <input
                  type="date"
                  value={occurredOn}
                  min={dateMin}
                  max={today}
                  disabled={signing}
                  onChange={(e) => setOccurredOn(e.target.value)}
                  className="sheet-input mt-1"
                />
              </label>
              <label className="block">
                <span className="sheet-label">Cliente ou projeto</span>
                <input
                  type="text"
                  value={client}
                  maxLength={LIMITS.client.max}
                  disabled={signing}
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="Ex.: White Clinic · post do GBP — ou «Interno»"
                  className="sheet-input mt-1"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="sheet-label">O erro cometido — o que aconteceu</span>
                <textarea
                  value={what}
                  rows={3}
                  maxLength={LIMITS.what.max}
                  disabled={signing}
                  onChange={(e) => setWhat(e.target.value)}
                  placeholder="Os factos: o quê, quando, o que ficou por fazer ou saiu mal."
                  className="sheet-input mt-1 resize-y"
                />
              </label>

              <div className="sm:col-span-2">
                <span className="sheet-label">Motivo</span>
                <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {REASONS.map((r) => {
                    const on = reason === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        disabled={signing}
                        onClick={() => setReason(r.id)}
                        className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition ${
                          on ? "border-[#783DF5] bg-[#783DF5]/[0.08]" : "border-black/12 bg-white/70 hover:border-black/30"
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-extrabold ${
                            on ? "bg-[#783DF5] text-white" : "bg-black/[0.06] text-black/60"
                          }`}
                        >
                          {r.letter}
                        </span>
                        <span>
                          <span className="block text-[12.5px] font-semibold text-black/80">{r.label}</span>
                          <span className="block text-[10.5px] text-black/45">{r.hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {reason === "outro" && (
                  <input
                    type="text"
                    value={reasonOther}
                    maxLength={LIMITS.reasonOther.max}
                    disabled={signing}
                    onChange={(e) => setReasonOther(e.target.value)}
                    placeholder="Especifica o motivo"
                    className="sheet-input mt-2"
                  />
                )}
              </div>

              <div className="sm:col-span-2">
                <span className="sheet-label">Tipo de erro</span>
                <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ERROR_TYPES.map((t) => {
                    const on = errorType === t.id;
                    const Icon = t.id === "aprendizagem" ? GraduationCap : Repeat;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        disabled={signing}
                        onClick={() => setErrorType(t.id)}
                        aria-pressed={on}
                        className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition ${
                          on ? "border-[#783DF5] bg-[#783DF5]/[0.08]" : "border-black/12 bg-white/70 hover:border-black/30"
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                            on ? "bg-[#783DF5] text-white" : "bg-black/[0.06] text-black/60"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span>
                          <span className="block text-[12.5px] font-semibold text-black/80">{t.label}</span>
                          <span className="block text-[10.5px] text-black/45">{t.hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="sheet-label">Foi a primeira vez que cometeu este erro?</span>
                <div className="mt-1.5 inline-flex overflow-hidden rounded-lg border border-black/15 bg-white/70">
                  {[
                    { v: true, label: "Sim" },
                    { v: false, label: "Não, é repetido" },
                  ].map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      disabled={signing}
                      onClick={() => setFirstTime(o.v)}
                      className={`px-4 py-1.5 text-[12.5px] font-semibold transition ${
                        firstTime === o.v ? "bg-[#783DF5] text-white" : "text-black/60 hover:bg-black/[0.04]"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                {firstTime === false && (
                  <input
                    type="text"
                    value={lastTime}
                    maxLength={LIMITS.lastTime.max}
                    disabled={signing}
                    onChange={(e) => setLastTime(e.target.value)}
                    placeholder="Quando foi a última vez?"
                    className="sheet-input mt-2"
                  />
                )}
              </div>

              <div>
                <span className="sheet-label">Quem deu pelo erro</span>
                <div className="mt-1.5 space-y-1.5">
                  {NOTICED_OPTIONS.map((o) => {
                    const on = noticed === o.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        disabled={signing}
                        onClick={() => setNoticed(o.id)}
                        className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-[12px] transition ${
                          on ? "border-[#783DF5] bg-[#783DF5]/[0.08] text-black/85" : "border-black/12 bg-white/70 text-black/65 hover:border-black/30"
                        }`}
                      >
                        <span className={`h-3 w-3 shrink-0 rounded-full border-2 ${on ? "border-[#783DF5] bg-[#783DF5]" : "border-black/30"}`} />
                        {o.read}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="block sm:col-span-2">
                <span className="sheet-label">Como deveria ter sido feito (opcional)</span>
                <textarea
                  value={shouldHave}
                  rows={2}
                  maxLength={LIMITS.shouldHave.max}
                  disabled={signing}
                  onChange={(e) => setShouldHave(e.target.value)}
                  className="sheet-input mt-1 resize-y"
                />
              </label>
            </div>
          </SheetSection>

          {/* 3 — Gravidade e pontuação */}
          <SheetSection n={3} title="Gravidade e pontuação" done={sectionOk.score}>
            <span className="sheet-label">O que o erro causou — assinala tudo o que se aplica</span>
            <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {IMPACTS.map((i) => {
                const implied = i.id === "cliente" && noticed === "cliente";
                const on = implied || impacts.includes(i.id);
                return (
                  <button
                    key={i.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    disabled={signing || implied}
                    onClick={() => setImpacts((cur) => (cur.includes(i.id) ? cur.filter((x) => x !== i.id) : [...cur, i.id]))}
                    className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition ${
                      on ? "border-[#783DF5] bg-[#783DF5]/[0.08]" : "border-black/12 bg-white/70 hover:border-black/30"
                    } ${implied ? "cursor-default" : ""}`}
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${
                        on ? "border-[#783DF5] bg-[#783DF5] text-white" : "border-black/30 bg-white"
                      }`}
                    >
                      {on && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-semibold text-black/80">{i.label}</span>
                      <span className="block text-[10.5px] text-black/45">
                        {implied ? "Assinalado: foi o cliente que deu pelo erro." : i.hint}
                      </span>
                    </span>
                    <span className="tabular shrink-0 rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[10px] font-bold text-black/45">
                      base {i.base}
                    </span>
                  </button>
                );
              })}
            </div>

            <ScoreCalculator
              suggestion={suggestion}
              points={points}
              disabled={signing}
              onApply={() => setPoints(suggestion.points)}
            />

            <p className="sheet-label mb-1.5 mt-5">A tua decisão — gravidade</p>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {GRAVITY_BANDS.map((b) => {
                const on = band?.id === b.id;
                const t = PAPER_BAND[b.id];
                return (
                  <button
                    key={b.id}
                    type="button"
                    disabled={signing}
                    onClick={() => setPoints((p) => (p !== null && p >= b.min && p <= b.max ? p : b.min))}
                    aria-pressed={on}
                    className={`rounded-xl border-2 px-3 py-2.5 text-left transition ${on ? t.on : `${t.off} bg-white/60 hover:bg-white`}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className={`text-[13px] font-extrabold ${t.text}`}>{b.label}</span>
                      <span className="tabular rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[10.5px] font-bold text-black/55">
                        {b.min}–{b.max}
                      </span>
                    </span>
                    <span className="mt-1 block text-[10.5px] leading-snug text-black/50">{b.hint}</span>
                    {suggestion.band.id === b.id && (
                      <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#783DF5]/[0.1] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-[#5b2bd0]">
                        <Calculator className="h-2.5 w-2.5" />
                        Sugestão
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {band && band.id !== "zero" && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="sheet-label">Pontuação exata</span>
                {Array.from({ length: band.max - band.min + 1 }, (_, i) => band.min + i).map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={signing}
                    onClick={() => setPoints(p)}
                    aria-pressed={points === p}
                    title={p === suggestion.points ? "A sugestão da calculadora" : undefined}
                    className={`tabular relative h-9 w-9 rounded-lg border-2 text-[14px] font-extrabold transition ${
                      points === p ? `${PAPER_BAND[band.id].on} ${PAPER_BAND[band.id].text}` : "border-black/12 bg-white/70 text-black/55 hover:border-black/30"
                    }`}
                  >
                    {p}
                    {p === suggestion.points && (
                      <span aria-hidden className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#fbfaf7] bg-[#783DF5]" />
                    )}
                  </button>
                ))}
                <span className="text-[11px] text-black/45">
                  {points !== null && `${points} ${points === 1 ? "ponto" : "pontos"} no PA · conta 1 no NO`}
                </span>
              </div>
            )}

            <label className="mt-4 block">
              <span className="sheet-label">Nota para o consultor (opcional)</span>
              <input
                type="text"
                value={note}
                maxLength={LIMITS.note.max}
                disabled={signing}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Contexto da pontuação — o consultor vê-a"
                className="sheet-input mt-1"
              />
            </label>
          </SheetSection>

          {/* 4 — Impacto + assinatura */}
          <SheetSection n={4} title="Impacto na escala e assinatura" done={showStamp} last>
            <ImpactPanel person={person} impact={impact} occurredOn={occurredOn} />

            <div ref={signatureZoneRef} className="mt-5 grid grid-cols-1 items-end gap-6 sm:grid-cols-[1fr_auto]">
              <SignatureLine
                name={adminName}
                playing={signing}
                showStamp={showStamp}
                stampRef={person ? firstName(person.fullName) : null}
                onDone={() => animationDoneRef.current()}
                signatureLabel="Assinatura da direção"
                stampLabel="Registado"
                placeholder={adminName}
              />
              <div className="pb-1 text-right sm:min-w-[150px]">
                <p className="border-b border-dotted border-black/30 pb-1 font-mono text-[12px] text-black/70">{formatDatePT(today)}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-black/40">Data</p>
              </div>
            </div>

            {error && (
              <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/45 bg-rose-500/[0.07] px-3.5 py-2.5 text-[12.5px] font-semibold text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => void handleSign()}
              disabled={signing}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3.5 text-[14px] font-bold text-white shadow-[0_14px_40px_-12px_rgba(120,61,245,0.7)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              style={{ background: "var(--brand-gradient)" }}
            >
              {signing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />A registar…
                </>
              ) : (
                <>
                  <PenLine className="h-4 w-4" />
                  Registar e assinar
                </>
              )}
            </button>
            <p className="mt-2 text-[10.5px] text-black/40">
              {!signing && problem
                ? `Falta: ${problem}`
                : "Fica já pontuada e entra no PA e no NO. O consultor vê-a no histórico, marcada «registada pela direção»."}
            </p>
          </SheetSection>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function signed(v: number): string {
  if (v > 0) return `+${v}`;
  if (v < 0) return `−${Math.abs(v)}`;
  return "±0";
}

function ScoreCalculator({
  suggestion,
  points,
  disabled,
  onApply,
}: {
  suggestion: ScoreSuggestion;
  points: number | null;
  disabled: boolean;
  onApply: () => void;
}) {
  const t = PAPER_BAND[suggestion.band.id];
  const applied = points === suggestion.points;
  const provisional = suggestion.missing.length > 0;
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-[#783DF5]/30 bg-white/80 shadow-[0_12px_32px_-22px_rgba(120,61,245,0.9)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.07] bg-[#783DF5]/[0.05] px-4 py-3">
        <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#5b2bd0]">
          <Calculator className="h-4 w-4" />
          Calculadora de gravidade
        </p>
        <p className="flex items-baseline gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/40">{provisional ? "Provisória" : "Sugestão"}</span>
          <span className={`tabular text-[30px] font-extrabold leading-none ${t.text}`}>{suggestion.points}</span>
          <span className="text-[12px] font-semibold text-black/35">/ 10</span>
          <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${t.on} ${t.text}`}>{suggestion.band.label}</span>
        </p>
      </div>

      <ul className="divide-y divide-black/[0.05] px-4 py-1">
        {suggestion.lines.map((l, i) => (
          <li key={i} className="flex items-baseline justify-between gap-3 py-1.5 text-[12px]">
            <span className={l.base ? "font-semibold text-black/80" : "text-black/60"}>{l.label}</span>
            <span
              className={`tabular shrink-0 font-bold ${
                l.base ? "text-black/80" : l.value > 0 ? "text-rose-600" : l.value < 0 ? "text-emerald-700" : "text-black/35"
              }`}
            >
              {l.base ? `base ${l.value}` : signed(l.value)}
            </span>
          </li>
        ))}
        {suggestion.raw !== suggestion.points && (
          <li className="py-1.5 text-[11px] text-black/45">
            A soma dá {suggestion.raw} — a escala vai de 1 a 10, fica {suggestion.points}.
          </li>
        )}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.07] px-4 py-3">
        <p className="text-[11px] text-black/50">
          {provisional ? (
            <span className="font-semibold text-amber-700">Falta: {suggestion.missing.join(", ")} — conta 0 até responderes.</span>
          ) : points !== null && !applied ? (
            <>
              Escolheste {points} — a calculadora sugere {suggestion.points}.
            </>
          ) : (
            "Uma sugestão: a pontuação final é tua."
          )}
        </p>
        <button
          type="button"
          onClick={onApply}
          disabled={disabled || applied}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-bold transition ${
            applied
              ? "border border-emerald-600/30 bg-emerald-600/[0.08] text-emerald-700"
              : "text-white shadow-[0_10px_24px_-12px_rgba(120,61,245,0.9)] hover:brightness-110"
          } disabled:cursor-default`}
          style={applied ? undefined : { background: "var(--brand-gradient)" }}
        >
          {applied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Sugestão aplicada
            </>
          ) : (
            <>
              <Wand2 className="h-3.5 w-3.5" />
              Usar a sugestão · {suggestion.points} {suggestion.points === 1 ? "ponto" : "pontos"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function Delta({ label, before, after, limit }: { label: string; before: number; after: number; limit: number | null }) {
  const hot = limit !== null && after >= limit;
  return (
    <div className="rounded-xl border border-black/10 bg-white/70 px-3.5 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/40">{label}</p>
      <p className="mt-1 flex items-baseline gap-2 tabular-nums">
        <span className="text-[16px] font-bold text-black/40">{before}</span>
        <ArrowRight className="h-3.5 w-3.5 self-center text-black/30" />
        <span className={`text-[22px] font-extrabold ${hot ? "text-rose-600" : "text-black/85"}`}>{after}</span>
        {limit !== null && <span className="text-[11px] font-semibold text-black/35">/ {limit}</span>}
      </p>
    </div>
  );
}

function ImpactPanel({
  person,
  impact,
  occurredOn,
}: {
  person: RegisterPerson | null;
  impact: { before: LedgerState; after: LedgerState } | null;
  occurredOn: string;
}) {
  if (!person || !impact) {
    return (
      <p className="rounded-xl border border-dashed border-black/15 bg-white/40 px-4 py-3 text-[12px] text-black/45">
        <TrendingUp className="mr-1.5 inline h-3.5 w-3.5" />
        Escolhe o consultor e a pontuação para ver o efeito na escala antes de registar.
      </p>
    );
  }
  const { before, after } = impact;
  const who = firstName(person.fullName);
  // Antes do último reinício (subida de nível, reset do semestre ou
  // recuperação do probation): entra na fase anterior, não no PA e NO de agora.
  const phase = before.phaseOpen;
  const beforePhase = Boolean(phase && occurredOn <= phase.at);
  const phaseLabel =
    phase?.reason === "semestre"
      ? "ao reset do fim do semestre"
      : phase?.reason === "recuperado"
        ? "à recuperação do probation"
        : "à última subida de nível";
  const levelUp = after.reached > before.reached;
  return (
    <div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Delta label="PA · pontos" before={before.pa} after={after.pa} limit={after.next?.pa ?? null} />
        <Delta label="NO · ocorrências" before={before.no} after={after.no} limit={after.next?.no ?? null} />
        <div className="rounded-xl border border-black/10 bg-white/70 px-3.5 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/40">Nível</p>
          <p className="mt-1 flex items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${LEVEL_PAPER[before.reached]}`}>Nível {before.reached}</span>
            <ArrowRight className="h-3.5 w-3.5 text-black/30" />
            <span className={`rounded-full border px-2.5 py-0.5 text-[12px] font-extrabold ${LEVEL_PAPER[after.reached]}`}>
              Nível {after.reached}
            </span>
          </p>
        </div>
      </div>
      {levelUp ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-rose-500/35 bg-rose-500/[0.07] px-3.5 py-2.5 text-[12.5px] font-semibold text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Com esta ocorrência, {who} sobe ao nível {after.reached} e o PA e o NO voltam a zero —{" "}
          {LEVELS[after.reached].measure.toLowerCase()}
        </p>
      ) : beforePhase ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-black/12 bg-white/60 px-3.5 py-2.5 text-[12px] text-black/60">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          A data é anterior {phaseLabel} de {who} — conta na fase anterior, não no PA nem no NO de agora.
        </p>
      ) : after.pendingMeasure ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-600/30 bg-amber-500/[0.08] px-3.5 py-2.5 text-[12px] font-semibold text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {who} já tinha atingido o nível {after.reached} e a medida continua por aplicar — {LEVELS[after.reached].measure.toLowerCase()}
        </p>
      ) : (
        <p className="mt-3 flex items-center gap-2 text-[12px] text-black/55">
          <Check className="h-3.5 w-3.5 text-emerald-600" />
          {who} continua no nível {after.reached}
          {after.next ? ` · faltam ${Math.max(0, after.next.pa - after.pa)} pts ou ${Math.max(0, after.next.no - after.no)} ocorrências para o nível ${after.next.level}` : ""}.
        </p>
      )}
    </div>
  );
}
