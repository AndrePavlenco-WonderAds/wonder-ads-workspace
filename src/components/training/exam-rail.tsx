// A fita dos seis exames de fase — server component, sem estado.
//
// DESENHO — MOSTRAR O CAMINHO TODO DESDE O DIA 1. Os seis cartões aparecem
// sempre, todos, mesmo os que só abrem daqui a três meses. Um exame escondido
// até ao dia em que abre é uma surpresa; um exame visível e trancado, com a
// data escrita, é um objetivo. É por isso que os bloqueados não são cinzentos
// tristes: são cinzentos com uma data.
//
// A leitura é uma linha só, da esquerda para a direita, porque é assim que o
// tempo anda: semana 1 → 2 → 3 → 4 → 60 dias → 90 dias. Só o cartão
// disponível tem brilho e movimento — tudo o resto fica quieto, para o olho
// cair no que há para fazer HOJE.

import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Target,
} from "lucide-react";
import type { ExamJourney, ExamState } from "@/lib/training/exams";
import { formatDate } from "@/lib/dates";

export function ExamRail({
  journey,
  interactive = true,
}: {
  journey: ExamJourney;
  /** False no drill-down do admin: os cartões deixam de ser links, porque
   *  `/formacao/exame/<id>` abre SEMPRE o exame de quem está com a sessão
   *  aberta — clicar na fita de outra pessoa levaria o C-Level ao exame
   *  dele próprio. */
  interactive?: boolean;
}) {
  const { exams, passedCount, effective, blocked, startedAt } = journey;
  const total = exams.length;

  return (
    <section className="animate-fade-up relative mt-5 overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.018] p-5 sm:p-6">
      <span
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-40 h-[24rem] w-[24rem] rounded-full opacity-[0.13] blur-3xl"
        style={{ background: "var(--brand-gradient)" }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(197,53,201,0.55), rgba(120,61,245,0.35), transparent)",
        }}
      />

      {/* ---- Cabeçalho da fita ---- */}
      <header className="relative flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="readout inline-flex items-center gap-1.5 rounded-full border border-[#C535C9]/30 bg-[#C535C9]/[0.08] px-2.5 py-1 text-[#f0a8ee]">
          <Target className="h-3 w-3" />
          Exames de fase
        </span>
        <span className="tabular text-[11.5px] font-semibold text-white/45">
          {passedCount}/{total} passados
        </span>
        {effective ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-500/[0.12] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-emerald-200">
            <ShieldCheck className="h-3 w-3" />
            Efetivo
          </span>
        ) : blocked ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/35 bg-rose-500/[0.1] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-rose-200">
            <ShieldAlert className="h-3 w-3" />
            Decisão do C-Level
          </span>
        ) : null}
        <span className="ml-auto text-[11px] text-white/32">
          {startedAt
            ? `Contados a partir de ${formatDate(`${startedAt}T00:00:00`)}`
            : "Data de entrada por definir"}
        </span>
      </header>

      <p className="relative mt-2 max-w-3xl text-[12px] leading-relaxed text-white/40">
        Os quizzes dos capítulos ensinam e repetem-se; estes seis decidem a
        passagem de fase. Abrem pelo relógio — e por ordem, um de cada vez.
      </p>

      {/* ---- Os seis ---- */}
      <div className="relative mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {exams.map((e) => (
          <ExamCard key={e.exam.id} state={e} interactive={interactive} />
        ))}
      </div>
    </section>
  );
}

function ExamCard({
  state,
  interactive,
}: {
  state: ExamState;
  interactive: boolean;
}) {
  const { exam, status } = state;
  const open = status === "available";
  const passed = status === "passed";
  const dead = status === "exhausted";

  const shell = passed
    ? "border-emerald-400/30 bg-emerald-500/[0.06]"
    : dead
      ? "border-rose-400/30 bg-rose-500/[0.06]"
      : open
        ? "border-[#C535C9]/45 bg-[#C535C9]/[0.07] shadow-[0_18px_50px_-30px_rgba(197,53,201,0.95)]"
        : "border-white/[0.07] bg-white/[0.015]";

  const badge = passed ? (
    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
  ) : dead ? (
    <ShieldAlert className="h-4 w-4 text-rose-300" />
  ) : open ? (
    <Target className="h-4 w-4 text-[#f0a8ee]" />
  ) : status === "no_start" ? (
    <CalendarClock className="h-4 w-4 text-white/25" />
  ) : (
    <Lock className="h-3.5 w-3.5 text-white/25" />
  );

  // A segunda linha do cartão é a única coisa que muda de estado para estado —
  // e é sempre concreta: uma nota, uma data, um número de dias.
  const line =
    status === "passed"
      ? `Passado · ${state.bestScore}%`
      : status === "exhausted"
        ? "Sem tentativas"
        : status === "available"
          ? "Disponível agora"
          : status === "locked_prev"
            ? "Passa o anterior"
            : status === "no_start"
              ? "Sem data de entrada"
              : status === "no_questions"
                ? "Por escrever"
                : state.daysUntil !== null && state.daysUntil <= 1
                  ? "Abre amanhã"
                  : `Faltam ${state.daysUntil} dias`;

  const body = (
    <>
      <span
        aria-hidden
        className={`relative flex h-9 w-9 items-center justify-center rounded-xl border ${
          passed
            ? "border-emerald-400/30 bg-emerald-500/10"
            : dead
              ? "border-rose-400/30 bg-rose-500/10"
              : open
                ? "animate-node-halo border-[#C535C9]/40 bg-[#C535C9]/12"
                : "border-white/[0.08] bg-white/[0.025]"
        }`}
      >
        {badge}
      </span>

      <span className="mt-2.5 block">
        <span className="readout block text-white/32">{exam.milestone}</span>
        <span
          className={`mt-1 block text-[13.5px] font-semibold tracking-[-0.01em] ${
            open || passed ? "text-white" : "text-white/55"
          }`}
        >
          {exam.label}
        </span>
      </span>

      <span
        className={`tabular mt-2 block text-[11px] font-medium ${
          passed
            ? "text-emerald-300/90"
            : dead
              ? "text-rose-300/90"
              : open
                ? "text-[#f0a8ee]"
                : "text-white/32"
        }`}
      >
        {line}
      </span>

      {!open && !passed && state.unlockAt !== null && (
        <span className="tabular mt-0.5 block text-[10px] text-white/22">
          {formatDate(state.unlockAt)}
        </span>
      )}
      {(open || passed) && (
        <span className="tabular mt-0.5 block text-[10px] text-white/25">
          mínimo {exam.passingScore}%
        </span>
      )}
    </>
  );

  const shared = `relative flex flex-col rounded-2xl border p-3.5 transition ${shell}`;

  // Só é clicável o que tem alguma coisa para ver: o disponível e o passado
  // (que abre a folha de tentativas). Um cartão trancado que navega para uma
  // página que só repete "está trancado" é um clique desperdiçado.
  if (interactive && (open || passed)) {
    return (
      <Link
        href={`/formacao/exame/${exam.id}`}
        className={`${shared} hover:-translate-y-0.5 ${
          passed
            ? "hover:border-emerald-400/50"
            : "hover:border-[#C535C9]/70 hover:bg-[#C535C9]/[0.11]"
        }`}
      >
        {body}
      </Link>
    );
  }

  return (
    <div className={`${shared} opacity-80`} title={exam.title}>
      {body}
    </div>
  );
}

/** Cartão "próximo exame" — o bloco de leitura rápida usado no hub e no
 *  drill-down do admin. Verde e com selo quando a pessoa está efetiva. */
export function NextExamCard({
  journey,
  subject = "Tens",
}: {
  journey: ExamJourney;
  /** "Tens" no hub do próprio; "Tem" no drill-down do admin. */
  subject?: string;
}) {
  const next = journey.next;

  if (journey.effective) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-emerald-400/35 bg-emerald-500/[0.09] px-4 py-3.5">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-400/20 opacity-40 blur-3xl"
        />
        <p className="readout relative flex items-center gap-1.5 text-emerald-200/80">
          <ShieldCheck className="h-3 w-3" />
          Situação
        </p>
        <p className="relative mt-1.5 text-[17px] font-bold tracking-tight text-emerald-200">
          Efetivo
        </p>
        <p className="relative mt-0.5 text-[11.5px] text-emerald-100/65">
          Passou os seis exames
          {journey.effectiveAt
            ? ` · ${formatDate(journey.effectiveAt)}`
            : ""}
        </p>
      </div>
    );
  }

  const blockedNow = next?.status === "exhausted";
  const tone = blockedNow
    ? "border-rose-400/30 bg-rose-500/[0.07]"
    : "border-white/10 bg-white/[0.025]";

  const value = !next
    ? "—"
    : next.status === "available"
      ? "Disponível"
      : next.status === "exhausted"
        ? "Sem tentativas"
        : next.status === "locked_prev"
          ? "Por desbloquear"
          : next.status === "no_start"
            ? "Sem data"
            : next.unlockAt
              ? formatDate(next.unlockAt)
              : "—";

  const hint = !next
    ? "Sem exames por fazer."
    : next.status === "available"
      ? `${subject} o ${next.exam.label} para fazer agora.`
      : next.status === "exhausted"
        ? `${next.exam.label} — decisão do C-Level.`
        : next.status === "locked_prev"
          ? `${next.exam.label} — falta passar o anterior.`
          : next.status === "no_start"
            ? "Data de entrada por definir."
            : next.daysUntil !== null && next.daysUntil <= 1
              ? `${next.exam.label} — abre amanhã.`
              : `${next.exam.label} — faltam ${next.daysUntil} dias.`;

  return (
    <div className={`rounded-2xl border px-4 py-3.5 ${tone}`}>
      <p className="readout flex items-center gap-1.5 text-white/40">
        <CalendarClock className="h-3 w-3" />
        Próximo exame
      </p>
      <p
        className={`tabular mt-1.5 text-[17px] font-bold tracking-tight ${
          blockedNow ? "text-rose-200" : "text-white"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11.5px] text-white/40">{hint}</p>
    </div>
  );
}
