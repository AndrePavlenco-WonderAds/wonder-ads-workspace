"use client";

// Recrutamento (v80.13) — o modo entrevista. Um ecrã por pergunta: a pergunta
// em grande, os critérios do guião para ir marcando (✓) e a nota ao vivo.
//
// Ecrãs: 0 = abertura · 1…N = perguntas · N+1 = pontos fortes/fracos ·
// N+2 = Fit e Técnica · N+3 = grade final.
//
// Atalhos: ← → muda de ecrã · 1–9 e 0 marcam critérios · F red flag ·
// N vai às notas · Esc sai do campo de texto.
//
// Grava sozinho: as alterações juntam-se e seguem num PATCH de cada vez
// (fila), 700 ms depois da última; ao sair da página (pagehide/unmount) vai
// o que faltar com keepalive — a lição das autosaves do roadmap (v78.26).

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  CloudOff,
  Flag,
  Keyboard,
  Loader2,
  Lock,
  Mic,
  Minus,
  PenLine,
  Plus,
  Quote,
  RotateCcw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import {
  computedScore,
  emptyAnswer,
  fmtScore,
  isScored,
  maxPoints,
  questionScore,
  summarize,
  zoneOf,
  type Answer,
  type Closing,
} from "@/lib/recrutamento/scoring";
import type { Candidate, Interview } from "@/lib/recrutamento/shared";
import type { InterviewTemplate, Question, ScriptBlock, SectionId } from "@/lib/recrutamento/templates";
import { GradeBadge, GradeMatrix, Initials, scoreColor, ScoreRing, TONE } from "./ui";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

type Pending = { answers: Record<string, Answer>; closing?: Closing; step?: number };

const SECTION_TINT: Record<SectionId, string> = {
  hard: "#c4a6ff",
  coach: "#7dd3fc",
  soft: "#f9a8d4",
  detail: "#fcd34d",
  questions: "#86efac",
  pessoal: "#fdba74",
};

function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function InterviewRunner({
  candidate,
  interview,
  template,
}: {
  candidate: Candidate;
  interview: Interview;
  template: InterviewTemplate;
}) {
  const router = useRouter();
  const N = template.questions.length;
  const LAST = N + 3;
  const locked = Boolean(interview.finishedAt) || candidate.status === "aceite";

  const [answers, setAnswers] = useState<Record<string, Answer>>(interview.answers);
  const [closing, setClosing] = useState<Closing>(interview.closing);
  const [step, setStep] = useState<number>(Math.min(interview.step, LAST));
  const [startedAt, setStartedAt] = useState<number | null>(interview.startedAt);
  const [save, setSave] = useState<SaveState>("idle");
  const [now, setNow] = useState(() => Date.now());
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const notesRef = useRef<HTMLTextAreaElement | null>(null);

  const url = `/api/admin/recrutamento/${candidate.id}`;
  const pending = useRef<Pending>({ answers: {} });
  const inflight = useRef(false);
  const timer = useRef<number | null>(null);
  const enteredAt = useRef<number>(Date.now());
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // ── gravação ────────────────────────────────────────────────────────────
  const hasPending = () => {
    const p = pending.current;
    return Object.keys(p.answers).length > 0 || p.closing !== undefined || p.step !== undefined;
  };

  const flush = useCallback(
    async (keepalive = false): Promise<boolean> => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      if (locked || !hasPending()) return true;
      if (inflight.current && !keepalive) {
        timer.current = window.setTimeout(() => void flush(), 400);
        return false;
      }
      const p = pending.current;
      pending.current = { answers: {} };
      inflight.current = true;
      setSave("saving");
      try {
        const res = await fetch(url, {
          method: "PATCH",
          keepalive,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: "save", interviewId: interview.id, ...p }),
        });
        if (!res.ok) throw new Error(String(res.status));
        setSave(hasPending() ? "dirty" : "saved");
        return true;
      } catch {
        // Volta para a fila (o que entrou entretanto ganha).
        const q = pending.current;
        pending.current = {
          answers: { ...p.answers, ...q.answers },
          closing: q.closing ?? p.closing,
          step: q.step ?? p.step,
        };
        setSave("error");
        if (!keepalive) timer.current = window.setTimeout(() => void flush(), 3000);
        return false;
      } finally {
        inflight.current = false;
        if (hasPending() && !timer.current && !keepalive) timer.current = window.setTimeout(() => void flush(), 700);
      }
    },
    [url, interview.id, locked],
  );

  const schedule = useCallback(() => {
    if (locked) return;
    setSave("dirty");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 700);
  }, [flush, locked]);

  useEffect(() => {
    const onHide = () => void flush(true);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      void flush(true);
    };
  }, [flush]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const putAnswer = useCallback(
    (qid: string, next: Answer) => {
      answersRef.current = { ...answersRef.current, [qid]: next };
      setAnswers((prev) => ({ ...prev, [qid]: next }));
      pending.current.answers[qid] = next;
      schedule();
    },
    [schedule],
  );

  const putClosing = useCallback(
    (patch: Partial<Closing>) => {
      setClosing((prev) => {
        const next = { ...prev, ...patch };
        pending.current.closing = next;
        return next;
      });
      schedule();
    },
    [schedule],
  );

  // ── navegação ───────────────────────────────────────────────────────────
  const question: Question | null = step >= 1 && step <= N ? template.questions[step - 1] : null;

  const goTo = useCallback(
    (target: number) => {
      const t = Math.max(0, Math.min(LAST, target));
      if (t === step) return;
      // Soma o tempo passado na pergunta que se deixa.
      if (!locked && question) {
        const spent = Date.now() - enteredAt.current;
        if (spent > 1500) {
          const cur = answersRef.current[question.id] ?? emptyAnswer();
          putAnswer(question.id, { ...cur, timeMs: cur.timeMs + spent });
        }
      }
      if (!locked && !startedAt && t > 0) setStartedAt(Date.now());
      enteredAt.current = Date.now();
      setStep(t);
      if (!locked) {
        pending.current.step = t;
        schedule();
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [LAST, step, locked, question, putAnswer, schedule, startedAt],
  );

  // ── atalhos ─────────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if (typing) {
        if (e.key === "Escape") el.blur();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goTo(step + 1);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(step - 1);
        return;
      }
      if (!question || locked) return;
      const a = answersRef.current[question.id] ?? emptyAnswer();
      if (/^[0-9]$/.test(e.key)) {
        const idx = e.key === "0" ? 9 : Number(e.key) - 1;
        const c = question.criteria[idx];
        if (!c) return;
        e.preventDefault();
        const checked = a.checked.includes(c.id) ? a.checked.filter((x) => x !== c.id) : [...a.checked, c.id];
        putAnswer(question.id, { ...a, checked });
        return;
      }
      if (e.key === "f" || e.key === "F") {
        const p = question.penalties[0];
        if (!p) return;
        e.preventDefault();
        const flags = a.flags.includes(p.id) ? a.flags.filter((x) => x !== p.id) : [...a.flags, p.id];
        putAnswer(question.id, { ...a, flags });
        return;
      }
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        notesRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, step, question, locked, putAnswer]);

  const summary = useMemo(() => summarize(template, answers, closing), [template, answers, closing]);

  async function finish() {
    setFinishing(true);
    setFinishError(null);
    try {
      await flush();
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "finish", interviewId: interview.id }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "Não foi possível terminar.");
      }
      router.push(`/admin/recrutamento/${candidate.id}?terminada=1`);
      router.refresh();
    } catch (err) {
      setFinishError(err instanceof Error ? err.message : "Não foi possível terminar.");
      setFinishing(false);
    }
  }

  async function leave() {
    await flush();
    router.push(`/admin/recrutamento/${candidate.id}`);
    router.refresh();
  }

  const qElapsed = question ? (answers[question.id]?.timeMs ?? 0) + (locked ? 0 : now - enteredAt.current) : 0;

  return (
    <div className="pb-28">
      {/* Cabeçalho: candidato + progresso por secções */}
      <div className="animate-fade-up mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Initials name={candidate.name} size={38} />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-white">{candidate.name}</p>
            <p className="truncate text-[11.5px] text-white/40">
              {template.title} · {template.phase}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {locked && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[11.5px] text-white/60">
              <Lock className="h-3 w-3" />
              Entrevista terminada · só leitura
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11.5px] tabular-nums text-white/60">
            <Clock className="h-3 w-3" />
            {startedAt ? mmss((interview.finishedAt ?? now) - startedAt) : "0:00"}
          </span>
        </div>
      </div>

      <Progress template={template} step={step} answers={answers} onJump={goTo} />

      <div key={step} className="animate-fade-up mt-6">
        {step === 0 && <Opening candidate={candidate} interview={interview} template={template} started={Boolean(startedAt)} locked={locked} onStart={() => goTo(Math.max(1, interview.step || 1))} />}
        {question && (
          <QuestionScreen
            template={template}
            question={question}
            index={step - 1}
            answer={answers[question.id] ?? emptyAnswer()}
            onChange={(a) => putAnswer(question.id, a)}
            locked={locked}
            notesRef={notesRef}
            elapsed={qElapsed}
          />
        )}
        {step === N + 1 && <StrengthsScreen template={template} answers={answers} closing={closing} onChange={putClosing} locked={locked} />}
        {step === N + 2 && <FitTechScreen template={template} summary={summary} closing={closing} onChange={putClosing} locked={locked} />}
        {step === N + 3 && (
          <GradeScreen
            summary={summary}
            closing={closing}
            onChange={putClosing}
            locked={locked}
            finishing={finishing}
            finishError={finishError}
            onFinish={finish}
            fichaHref={`/admin/recrutamento/${candidate.id}`}
          />
        )}
      </div>

      {/* Barra de baixo: navegação + estado da gravação */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] bg-[#0b0b12]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => void leave()}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] text-white/50 transition hover:bg-white/[0.05] hover:text-white"
          >
            Sair para a ficha
          </button>
          <SaveBadge state={save} locked={locked} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => goTo(step - 1)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3.5 py-2 text-[12.5px] font-semibold text-white/75 transition hover:border-white/30 disabled:opacity-30"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Anterior</span>
            </button>
            {step < LAST && (
              <button
                type="button"
                onClick={() => goTo(step + 1)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[12.5px] font-semibold text-black transition hover:bg-[#ede4ff]"
              >
                {step === 0 ? (startedAt ? "Continuar" : "Começar") : "Seguinte"}
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SaveBadge({ state, locked }: { state: SaveState; locked: boolean }) {
  if (locked) return <span className="text-[11px] text-white/30">Só leitura</span>;
  const map: Record<SaveState, { icon: ReactNode; text: string; cls: string }> = {
    idle: { icon: <Check className="h-3 w-3" />, text: "Grava sozinho", cls: "text-white/35" },
    dirty: { icon: <PenLine className="h-3 w-3" />, text: "Por gravar…", cls: "text-white/45" },
    saving: { icon: <Loader2 className="h-3 w-3 animate-spin" />, text: "A gravar…", cls: "text-white/55" },
    saved: { icon: <CheckCircle2 className="h-3 w-3" />, text: "Guardado", cls: "text-emerald-300/80" },
    error: { icon: <CloudOff className="h-3 w-3" />, text: "Sem ligação, a tentar de novo", cls: "text-rose-300" },
  };
  const m = map[state];
  return (
    <span className={`hidden items-center gap-1.5 text-[11.5px] sm:inline-flex ${m.cls}`}>
      {m.icon}
      {m.text}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Progresso
// ---------------------------------------------------------------------------

function Progress({
  template,
  step,
  answers,
  onJump,
}: {
  template: InterviewTemplate;
  step: number;
  answers: Record<string, Answer>;
  onJump: (s: number) => void;
}) {
  const N = template.questions.length;
  const pct = Math.round((step / (N + 3)) * 100);
  return (
    <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-3 py-3 sm:px-4">
      <div className="flex items-center gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <StepDot label="Abertura" active={step === 0} done={step > 0} onClick={() => onJump(0)} tint="#ffffff" wide />
        {template.sections.map((sec) => {
          const qs = template.questions.map((q, i) => ({ q, i })).filter(({ q }) => q.section === sec.id);
          if (!qs.length) return null;
          const inSec = qs.some(({ i }) => step === i + 1);
          return (
            <div key={sec.id} className="flex shrink-0 items-center gap-1.5">
              <span
                className={`text-[10px] font-bold uppercase tracking-[0.14em] ${inSec ? "text-white" : "text-white/30"}`}
                style={inSec ? { color: SECTION_TINT[sec.id] } : undefined}
              >
                {sec.short}
              </span>
              {qs.map(({ q, i }) => (
                <StepDot
                  key={q.id}
                  label={`${q.code} · ${q.title}`}
                  short={qs.length > 1 ? q.code : undefined}
                  active={step === i + 1}
                  done={q.unscored ? Boolean(answers[q.id]?.notes.trim()) : isScored(answers[q.id])}
                  flagged={(answers[q.id]?.flags.length ?? 0) > 0}
                  onClick={() => onJump(i + 1)}
                  tint={SECTION_TINT[sec.id]}
                />
              ))}
            </div>
          );
        })}
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${step > N ? "text-white" : "text-white/30"}`}>Fecho</span>
          {["Pontos fortes e fracos", "Fit e Técnica", "Grade final"].map((label, k) => (
            <StepDot key={label} label={label} active={step === N + 1 + k} done={step > N + 1 + k} onClick={() => onJump(N + 1 + k)} tint="#ffffff" />
          ))}
        </div>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg,#783DF5,#C535C9,#f9a8d4)", transition: "width 400ms cubic-bezier(.2,.8,.2,1)" }}
        />
      </div>
    </div>
  );
}

function StepDot({
  label,
  short,
  active,
  done,
  flagged,
  onClick,
  tint,
  wide,
}: {
  label: string;
  short?: string;
  active: boolean;
  done: boolean;
  flagged?: boolean;
  onClick: () => void;
  tint: string;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-current={active ? "step" : undefined}
      onClick={onClick}
      className={`relative inline-flex h-6 shrink-0 items-center justify-center rounded-full border text-[9.5px] font-bold tabular-nums transition ${
        wide ? "px-2.5" : short ? "min-w-[30px] px-1.5" : "w-6"
      } ${active ? "scale-110 text-black" : done ? "border-transparent text-white/85" : "border-white/12 text-white/35 hover:border-white/30"}`}
      style={
        active
          ? { background: tint, borderColor: tint, boxShadow: `0 0 0 4px ${tint}22` }
          : done
            ? { background: `${tint}2e` }
            : undefined
      }
    >
      {wide ? label : short ?? (done ? <Check className="h-3 w-3" /> : "")}
      {flagged && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-rose-400" />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Abertura
// ---------------------------------------------------------------------------

function Opening({
  candidate,
  interview,
  template,
  started,
  locked,
  onStart,
}: {
  candidate: Candidate;
  interview: Interview;
  template: InterviewTemplate;
  started: boolean;
  locked: boolean;
  onStart: () => void;
}) {
  const day = interview.date ? interview.date.split("-").reverse().join("/") : null;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-[radial-gradient(120%_120%_at_0%_0%,rgba(120,61,245,0.22),transparent_55%),radial-gradient(120%_120%_at_100%_100%,rgba(197,53,201,0.16),transparent_55%)] p-7 sm:p-9">
        <p className="readout flex items-center gap-1.5 text-white/50">
          <Mic className="h-3 w-3" />
          {template.phase}
        </p>
        <h2 className="mt-3 text-[30px] font-semibold leading-[1.1] tracking-tight text-white sm:text-[40px]">
          Entrevista com
          <br />
          <span className="brand-gradient-text">{candidate.name}</span>
        </h2>
        <div className="mt-5 flex flex-wrap gap-2 text-[12px]">
          <Pill>Vaga: {candidate.role}</Pill>
          {day && <Pill>Data: {day}</Pill>}
          <Pill>{template.questions.length} perguntas</Pill>
        </div>

        <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">Abertura</p>
        <ol className="mt-3 space-y-2.5">
          {template.opening.map((line, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-white/85">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[11.5px] font-bold text-white/70">
                {i + 1}
              </span>
              {line}
            </li>
          ))}
        </ol>

        <div className="mt-7 flex flex-wrap items-center gap-1.5">
          {template.sections.map((s, i) => (
            <span key={s.id} className="inline-flex items-center gap-1.5">
              <span className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold text-black" style={{ background: SECTION_TINT[s.id] }}>
                {s.label}
              </span>
              {i < template.sections.length - 1 && <ArrowRight className="h-3 w-3 text-white/25" />}
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={onStart}
          className="mt-9 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[14px] font-semibold text-black shadow-[0_18px_60px_-18px_rgba(196,166,255,0.9)] transition hover:bg-[#ede4ff]"
        >
          {locked ? "Rever a entrevista" : started ? "Continuar onde fiquei" : "Começar a entrevista"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </section>

      <aside className="space-y-4">
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">Pontuação</p>
          <p className="mt-2 text-[13px] leading-relaxed text-white/75">{template.scoringNote}</p>
          <p className="mt-2 text-[12px] leading-relaxed text-white/45">
            Cada pergunta vale 10. No fim, o Fit Cultural e a Capacidade Técnica dão a grade D–A.
          </p>
        </div>
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">
            <Keyboard className="h-3.5 w-3.5" />
            Atalhos
          </p>
          <ul className="mt-3 space-y-2 text-[12.5px] text-white/65">
            <Shortcut keys={["←", "→"]}>Pergunta anterior / seguinte</Shortcut>
            <Shortcut keys={["1", "…", "9"]}>Marcar ou desmarcar um critério</Shortcut>
            <Shortcut keys={["F"]}>Red flag</Shortcut>
            <Shortcut keys={["N"]}>Escrever nas notas</Shortcut>
            <Shortcut keys={["Esc"]}>Sair do campo de texto</Shortcut>
          </ul>
        </div>
      </aside>
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-white/12 bg-black/20 px-3 py-1 text-white/70">{children}</span>;
}

function Shortcut({ keys, children }: { keys: string[]; children: ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span>{children}</span>
      <span className="flex gap-1">
        {keys.map((k) => (
          <kbd key={k} className="min-w-[22px] rounded-md border border-white/15 bg-white/[0.05] px-1.5 py-0.5 text-center text-[10.5px] font-semibold text-white/70">
            {k}
          </kbd>
        ))}
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Pergunta
// ---------------------------------------------------------------------------

function QuestionScreen({
  template,
  question: q,
  index,
  answer: a,
  onChange,
  locked,
  notesRef,
  elapsed,
}: {
  template: InterviewTemplate;
  question: Question;
  index: number;
  answer: Answer;
  onChange: (a: Answer) => void;
  locked: boolean;
  notesRef: React.RefObject<HTMLTextAreaElement | null>;
  elapsed: number;
}) {
  const section = template.sections.find((s) => s.id === q.section)!;
  const secQs = template.questions.filter((x) => x.section === q.section);
  const posInSec = secQs.findIndex((x) => x.id === q.id) + 1;
  const tint = SECTION_TINT[q.section];
  const score = questionScore(q, a);
  const calc = computedScore(q, a);
  const max = maxPoints(q);
  const hasOverride = a.override !== null;

  const toggle = (id: string, key: "checked" | "flags") => {
    if (locked) return;
    const list = a[key];
    onChange({ ...a, [key]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      {/* Esquerda: a pergunta */}
      <section className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full px-2.5 py-1 text-[11px] font-bold text-black" style={{ background: tint }}>
            {section.label}
            {secQs.length > 1 ? ` · ${posInSec} de ${secQs.length}` : ""}
          </span>
          <span className="text-[11.5px] tabular-nums text-white/35">
            Pergunta {index + 1} de {template.questions.length}
          </span>
          <span className="inline-flex items-center gap-1 text-[11.5px] tabular-nums text-white/35">
            <Clock className="h-3 w-3" />
            {mmss(elapsed)}
          </span>
        </div>
        <h2 className="mt-3 text-[26px] font-semibold leading-tight tracking-tight text-white sm:text-[32px]">{q.title}</h2>

        {q.prompt && (
          <div
            className="relative mt-5 overflow-hidden rounded-3xl border p-6 sm:p-7"
            style={{ borderColor: `${tint}55`, background: `linear-gradient(135deg, ${tint}1f, transparent 70%)` }}
          >
            <Quote className="absolute right-5 top-5 h-8 w-8 opacity-15" style={{ color: tint }} />
            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: tint }}>
              Perguntar
            </p>
            <p className="mt-2 text-[20px] font-medium leading-snug text-white sm:text-[23px]">{q.prompt}</p>
          </div>
        )}

        {q.script && <Script blocks={q.script} tint={tint} />}

        <div className="mt-5">
          <label className="text-[11.5px] font-semibold text-white/50" htmlFor={`notes-${q.id}`}>
            Notas
          </label>
          <textarea
            id={`notes-${q.id}`}
            ref={notesRef}
            value={a.notes}
            readOnly={locked}
            onChange={(e) => onChange({ ...a, notes: e.target.value })}
            rows={5}
            placeholder="O que disse, exemplos, números, como reagiu…"
            className="mt-1.5 w-full resize-y rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-[14px] leading-relaxed text-white placeholder:text-white/25 focus:border-white/25 focus:outline-none"
          />
        </div>
      </section>

      {/* Direita: pontuação (as perguntas da secção Pessoal não têm — v80.17) */}
      {q.unscored ? (
        <aside className="min-w-0">
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 lg:sticky lg:top-24">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">Sem pontuação</p>
            <p className="mt-2 text-[13px] leading-relaxed text-white/60">
              Só notas. Não conta para o Fit Cultural nem para a Capacidade Técnica.
            </p>
          </div>
        </aside>
      ) : (
      <aside className="min-w-0">
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 lg:sticky lg:top-24">
          <div className="flex items-center gap-4">
            <ScoreRing value={score} size={96} />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">Nota</p>
              <p className="mt-1 text-[12.5px] leading-snug text-white/55">
                {hasOverride ? (
                  <>
                    Ajustada à mão. Pelos ✓ seria <b className="text-white/80">{fmtScore(calc)}</b>.
                  </>
                ) : (
                  <>Soma dos ✓{q.penalties.some((p) => p.kind === "minus") ? ", menos 3 por red flag" : ""}. Máximo {Math.min(10, max)}.</>
                )}
              </p>
              {!locked && (
                <OverrideControl
                  value={a.override}
                  calc={calc}
                  onChange={(override) => onChange({ ...a, override })}
                />
              )}
            </div>
          </div>

          <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">{q.criteriaLabel ?? "O que procurar"}</p>
          <ul className="mt-2 space-y-1.5">
            {q.criteria.map((c, i) => {
              const on = a.checked.includes(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => toggle(c.id, "checked")}
                    aria-pressed={on}
                    className={`group flex w-full items-start gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${
                      on ? "border-emerald-300/40 bg-emerald-400/[0.09]" : "border-white/[0.07] bg-white/[0.015] hover:border-white/20 hover:bg-white/[0.04]"
                    } disabled:cursor-default`}
                  >
                    <span
                      className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                        on ? "border-emerald-300 bg-emerald-400 text-black" : "border-white/20 text-transparent"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    <span className={`min-w-0 flex-1 text-[13px] leading-snug ${on ? "text-white" : "text-white/70"}`}>{c.label}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className={`tabular-nums rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${on ? "bg-emerald-300/20 text-emerald-200" : "bg-white/[0.06] text-white/45"}`}>
                        {c.pts} pt{c.pts === 1 ? "" : "s"}
                      </span>
                      {i < 10 && <kbd className="hidden text-[9.5px] text-white/25 sm:inline">{i === 9 ? 0 : i + 1}</kbd>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {q.penalties.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {q.penalties.map((p, i) => {
                const on = a.flags.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={locked}
                    onClick={() => toggle(p.id, "flags")}
                    aria-pressed={on}
                    className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${
                      on ? "border-rose-300/50 bg-rose-500/[0.14]" : "border-rose-300/[0.14] bg-rose-500/[0.03] hover:border-rose-300/35"
                    } disabled:cursor-default`}
                  >
                    <Flag className={`mt-0.5 h-4 w-4 shrink-0 ${on ? "text-rose-300" : "text-rose-300/40"}`} />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[11px] font-bold uppercase tracking-[0.12em] ${on ? "text-rose-200" : "text-rose-200/55"}`}>
                        {p.kind === "minus" ? `Red flag (−${p.pts})` : "Red flag (teto)"}
                      </span>
                      <span className={`mt-0.5 block text-[12.5px] leading-snug ${on ? "text-white/90" : "text-white/55"}`}>{p.label}</span>
                    </span>
                    {i === 0 && <kbd className="hidden text-[9.5px] text-white/25 sm:inline">F</kbd>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>
      )}
    </div>
  );
}

function OverrideControl({ value, calc, onChange }: { value: number | null; calc: number; onChange: (v: number | null) => void }) {
  if (value === null) {
    return (
      <button
        type="button"
        onClick={() => onChange(calc)}
        className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-white/40 underline-offset-2 transition hover:text-white/80 hover:underline"
      >
        <PenLine className="h-3 w-3" />
        Ajustar nota à mão
      </button>
    );
  }
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} className="rounded-full border border-white/15 p-1 text-white/70 hover:border-white/35" aria-label="Menos 1">
        <Minus className="h-3 w-3" />
      </button>
      <span className="w-6 text-center text-[13px] font-bold tabular-nums text-white">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(10, value + 1))} className="rounded-full border border-white/15 p-1 text-white/70 hover:border-white/35" aria-label="Mais 1">
        <Plus className="h-3 w-3" />
      </button>
      <button type="button" onClick={() => onChange(null)} className="ml-1 inline-flex items-center gap-1 text-[11px] text-white/40 hover:text-white/80">
        <RotateCcw className="h-3 w-3" />
        Voltar ao calculado
      </button>
    </div>
  );
}

function Script({ blocks, tint }: { blocks: ScriptBlock[]; tint: string }) {
  return (
    <div className="mt-5 space-y-3">
      {blocks.map((b, i) => {
        if (b.kind === "list") {
          return (
            <div key={i} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
              {b.title && <p className="text-[13px] font-semibold text-white/85">{b.title}</p>}
              <ol className="mt-2 space-y-1">
                {b.items.map((it, k) => (
                  <li key={k} className="flex gap-2.5 text-[13.5px] text-white/75">
                    <span className="w-4 shrink-0 text-right tabular-nums text-white/35">{k + 1}.</span>
                    {it}
                  </li>
                ))}
              </ol>
              {b.answer && <RevealAnswer answer={b.answer} tint={tint} />}
            </div>
          );
        }
        if (b.kind === "step") {
          return (
            <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-4 py-3">
              <p className="text-[11.5px] font-bold text-white/50">{b.label}</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-white/75">{b.text}</p>
            </div>
          );
        }
        return (
          <p key={i} className="rounded-2xl border border-dashed border-white/10 px-4 py-3 text-[13px] leading-relaxed text-white/60">
            {b.text}
          </p>
        );
      })}
    </div>
  );
}

/** A ordem certa fica tapada até se carregar (o ecrã pode estar partilhado). */
function RevealAnswer({ answer, tint }: { answer: string; tint: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-semibold transition"
      style={{ borderColor: `${tint}55`, color: open ? "#fff" : tint, background: open ? `${tint}22` : "transparent" }}
    >
      Ordem certa: {open ? <span className="tabular-nums tracking-wide">{answer}</span> : <span className="tracking-[0.3em] opacity-60">••••</span>}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Fecho 1 — pontos fortes vs fracos
// ---------------------------------------------------------------------------

function StrengthsScreen({
  template,
  answers,
  closing,
  onChange,
  locked,
}: {
  template: InterviewTemplate;
  answers: Record<string, Answer>;
  closing: Closing;
  onChange: (p: Partial<Closing>) => void;
  locked: boolean;
}) {
  const scored = template.questions.filter((q) => isScored(answers[q.id]));
  const high = scored.filter((q) => questionScore(q, answers[q.id]) >= 8);
  const low = scored.filter((q) => questionScore(q, answers[q.id]) <= 4 || (answers[q.id]?.flags.length ?? 0) > 0);
  const setList = (key: "strengths" | "weaknesses", i: number, v: string) => {
    const list = [...closing[key]];
    list[i] = v;
    onChange({ [key]: list } as Partial<Closing>);
  };
  return (
    <div>
      <ScreenTitle eyebrow="Fecho · 1 de 3" title="Pontos fortes vs pontos fracos" />
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ListCard
          tone="emerald"
          icon={<ThumbsUp className="h-4 w-4" />}
          title="Pontos fortes"
          hints={high.map((q) => `${q.code} ${q.title}`)}
          values={closing.strengths}
          onChange={(i, v) => setList("strengths", i, v)}
          locked={locked}
        />
        <ListCard
          tone="rose"
          icon={<ThumbsDown className="h-4 w-4" />}
          title="Pontos fracos"
          hints={low.map((q) => `${q.code} ${q.title}`)}
          values={closing.weaknesses}
          onChange={(i, v) => setList("weaknesses", i, v)}
          locked={locked}
        />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TextCard label="Como me lembro dele/a" value={closing.remember} onChange={(v) => onChange({ remember: v })} locked={locked} rows={4} />
        <TextCard label="Frase que me ficou" value={closing.quote} onChange={(v) => onChange({ quote: v })} locked={locked} rows={4} quote />
        <TextCard label="Dúvidas por esclarecer" value={closing.doubts} onChange={(v) => onChange({ doubts: v })} locked={locked} rows={4} />
      </div>
    </div>
  );
}

function ScreenTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">{eyebrow}</p>
      <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-white sm:text-[34px]">{title}</h2>
      {children}
    </div>
  );
}

function ListCard({
  tone,
  icon,
  title,
  hints,
  values,
  onChange,
  locked,
}: {
  tone: "emerald" | "rose";
  icon: ReactNode;
  title: string;
  hints: string[];
  values: string[];
  onChange: (i: number, v: string) => void;
  locked: boolean;
}) {
  const t = TONE[tone];
  return (
    <div className={`rounded-3xl border p-5 ${t.border} bg-white/[0.015]`}>
      <p className={`flex items-center gap-2 text-[14px] font-semibold ${t.text}`}>
        {icon}
        {title}
      </p>
      {hints.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="text-[10.5px] text-white/35">Da entrevista:</span>
          {hints.slice(0, 6).map((h) => (
            <span key={h} className={`rounded-full px-2 py-0.5 text-[10.5px] ${t.bg} ${t.text}`}>
              {h}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 space-y-2">
        {values.map((v, i) => (
          <input
            key={i}
            value={v}
            readOnly={locked}
            onChange={(e) => onChange(i, e.target.value)}
            placeholder={`${i + 1}.`}
            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[13.5px] text-white placeholder:text-white/20 focus:border-white/25 focus:outline-none"
          />
        ))}
      </div>
    </div>
  );
}

function TextCard({
  label,
  value,
  onChange,
  locked,
  rows,
  quote,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  locked: boolean;
  rows: number;
  quote?: boolean;
}) {
  return (
    <label className="block rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-white/80">
        {quote && <Quote className="h-3.5 w-3.5 text-[#c4a6ff]" />}
        {label}
      </span>
      <textarea
        value={value}
        readOnly={locked}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className={`mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[13.5px] leading-relaxed text-white placeholder:text-white/20 focus:border-white/25 focus:outline-none ${
          quote ? "italic" : ""
        }`}
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Fecho 2 — Fit Cultural e Capacidade Técnica
// ---------------------------------------------------------------------------

function FitTechScreen({
  template,
  summary,
  closing,
  onChange,
  locked,
}: {
  template: InterviewTemplate;
  summary: ReturnType<typeof summarize>;
  closing: Closing;
  onChange: (p: Partial<Closing>) => void;
  locked: boolean;
}) {
  return (
    <div>
      <ScreenTitle eyebrow="Fecho · 2 de 3" title="Fit Cultural e Capacidade Técnica">
        <p className="mt-2 max-w-[720px] text-[13px] leading-relaxed text-white/50">
          O calculado vem das perguntas. A tua nota, se a deres, é a que conta para a grade.
        </p>
      </ScreenTitle>
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <AxisCard
          label={template.fit.label}
          signals={template.fit.signals}
          zones={template.fit.zones}
          calc={summary.fitCalc}
          mine={closing.fitMine}
          parts={[
            ["Média Soft Skills", summary.soft],
            ["Coachability", summary.coach],
            ["Perguntas do candidato", summary.questions],
          ]}
          onMine={(v) => onChange({ fitMine: v })}
          locked={locked}
        />
        <AxisCard
          label={template.tech.label}
          signals={template.tech.signals}
          zones={template.tech.zones}
          calc={summary.techCalc}
          mine={closing.techMine}
          parts={[
            ["Média Hard Skills", summary.hard],
            ["Atenção ao detalhe", summary.detail],
          ]}
          onMine={(v) => onChange({ techMine: v })}
          locked={locked}
        />
      </div>
    </div>
  );
}

function AxisCard({
  label,
  signals,
  zones,
  calc,
  mine,
  parts,
  onMine,
  locked,
}: {
  label: string;
  signals: string;
  zones: { low: string; mid: string; high: string };
  calc: number | null;
  mine: number | null;
  parts: Array<[string, number | null]>;
  onMine: (v: number | null) => void;
  locked: boolean;
}) {
  const calcRound = calc === null ? null : Math.round(calc);
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[18px] font-semibold text-white">{label}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-white/45">Sinais: {signals}</p>
        </div>
        <ScoreRing value={mine ?? calc} size={78} label={mine !== null ? "a tua nota" : "calculado"} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {parts.map(([name, v]) => (
          <span key={name} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11.5px] text-white/60">
            {name}: <b className="tabular-nums" style={{ color: scoreColor(v) }}>{fmtScore(v)}</b>
          </span>
        ))}
      </div>

      <div className="mt-5 overflow-x-auto">
        <div className="grid min-w-[480px] grid-cols-[90px_repeat(11,minmax(0,1fr))] gap-1 text-center">
          <span />
          {Array.from({ length: 11 }, (_, n) => (
            <span key={n} className="text-[11px] font-semibold tabular-nums text-white/40">
              {n}
            </span>
          ))}
          <span className="text-left text-[11px] text-white/40">Zona</span>
          {Array.from({ length: 11 }, (_, n) => {
            const z = n === 0 ? null : zoneOf(n);
            return (
              <span key={n} className="text-[9.5px] text-white/30">
                {z === "low" ? zones.low : z === "mid" ? zones.mid : z === "high" ? zones.high : ""}
              </span>
            );
          })}
          <span className="text-left text-[11px] text-white/40">Calculado</span>
          {Array.from({ length: 11 }, (_, n) => (
            <span key={n} className="flex h-8 items-center justify-center rounded-lg bg-white/[0.02]">
              {calcRound === n && <span className="h-3 w-3 rounded-full" style={{ background: scoreColor(calc) }} />}
            </span>
          ))}
          <span className="text-left text-[11px] font-semibold text-white/70">A minha nota</span>
          {Array.from({ length: 11 }, (_, n) => {
            const on = mine === n;
            return (
              <button
                key={n}
                type="button"
                disabled={locked}
                onClick={() => onMine(on ? null : n)}
                className={`h-8 rounded-lg border text-[12px] font-bold tabular-nums transition ${
                  on ? "border-transparent text-black" : "border-white/[0.08] text-white/45 hover:border-white/30 hover:text-white"
                } disabled:cursor-default`}
                style={on ? { background: scoreColor(n) } : undefined}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>
      {mine !== null && !locked && (
        <button type="button" onClick={() => onMine(null)} className="mt-3 inline-flex items-center gap-1 text-[11.5px] text-white/40 hover:text-white/80">
          <RotateCcw className="h-3 w-3" />
          Usar o calculado
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fecho 3 — grade final
// ---------------------------------------------------------------------------

function GradeScreen({
  summary,
  closing,
  onChange,
  locked,
  finishing,
  finishError,
  onFinish,
  fichaHref,
}: {
  fichaHref: string;
  summary: ReturnType<typeof summarize>;
  closing: Closing;
  onChange: (p: Partial<Closing>) => void;
  locked: boolean;
  finishing: boolean;
  finishError: string | null;
  onFinish: () => void;
}) {
  const cell = summary.cell;
  const t = cell ? TONE[cell.tone] : null;
  const missing = summary.total - summary.scored;
  return (
    <div>
      <ScreenTitle eyebrow="Fecho · 3 de 3" title="Grade final (D–A)" />
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div
          className={`relative overflow-hidden rounded-[28px] border p-6 ${t ? t.border : "border-white/10"}`}
          style={t ? { background: `radial-gradient(120% 100% at 0% 0%, ${t.glow}, transparent 60%)` } : undefined}
        >
          <div className="flex items-center gap-4">
            <GradeBadge cell={cell} size="lg" />
            <div>
              <p className={`text-[22px] font-bold ${t ? t.text : "text-white/50"}`}>{cell ? cell.grade : "Sem grade"}</p>
              <p className="text-[12.5px] text-white/55">{cell ? cell.line : "Faltam notas de Fit ou de Técnica."}</p>
            </div>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-3">
            <Metric label="Fit /10" value={summary.fit} mine={closing.fitMine !== null} />
            <Metric label="Técnica /10" value={summary.tech} mine={closing.techMine !== null} />
          </dl>
          {cell && (
            <p className={`mt-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold ${t!.bg} ${t!.text}`}>
              <Sparkles className="h-3.5 w-3.5" />
              Decisão: {cell.decision}
            </p>
          )}
          <label className="mt-5 block">
            <span className="text-[11.5px] font-semibold text-white/55">Próximo passo</span>
            <input
              value={closing.nextStep}
              readOnly={locked}
              onChange={(e) => onChange({ nextStep: e.target.value })}
              placeholder="Ex.: segunda entrevista com o Alex, pedir referências…"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[13px] text-white placeholder:text-white/25 focus:border-white/25 focus:outline-none"
            />
          </label>
        </div>
        <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
          <GradeMatrix fit={summary.fit} tech={summary.tech} />
        </div>
      </div>

      {!locked && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div className="text-[13px] text-white/60">
            {missing > 0 ? (
              <span className="inline-flex items-center gap-2 text-amber-200/90">
                <AlertTriangle className="h-4 w-4" />
                {missing} pergunta{missing === 1 ? "" : "s"} sem pontuação. Podes terminar na mesma, ou voltar atrás.
              </span>
            ) : (
              "Todas as perguntas pontuadas. Ao terminar, a ficha fica com a grade e as notas."
            )}
            {finishError && <p className="mt-1 text-rose-300">{finishError}</p>}
          </div>
          <button
            type="button"
            onClick={onFinish}
            disabled={finishing}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[13.5px] font-semibold text-black shadow-[0_18px_60px_-18px_rgba(196,166,255,0.9)] transition hover:bg-[#ede4ff] disabled:opacity-60"
          >
            {finishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Terminar entrevista
          </button>
        </div>
      )}
      {locked && (
        <p className="mt-8 text-center text-[12.5px] text-white/45">
          Entrevista terminada.{" "}
          <Link href={fichaHref} className="underline underline-offset-2 hover:text-white">
            Voltar à ficha
          </Link>
        </p>
      )}
    </div>
  );
}

function Metric({ label, value, mine }: { label: string; value: number | null; mine: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5">
      <dt className="text-[10.5px] uppercase tracking-[0.14em] text-white/40">{label}</dt>
      <dd className="mt-0.5 text-[24px] font-black tabular-nums" style={{ color: scoreColor(value) }}>
        {fmtScore(value)}
      </dd>
      <dd className="text-[10.5px] text-white/35">{mine ? "a tua nota" : "calculado"}</dd>
    </div>
  );
}
