"use client";

// A folha de um exame de fase, UMA PERGUNTA DE CADA VEZ.
//
// PORQUE NÃO A LISTA DOS QUIZZES: com 35 perguntas sorteadas de capítulos
// diferentes, uma lista de 35 cartões é um scroll infinito onde se perde o
// fio — e o exame passa a ser "procurar a que falta". Aqui cada pergunta tem
// o ecrã todo, com o capítulo de onde veio, e a navegação é explícita:
//   · o mapa da folha (1…35) mostra o que está respondido e o que ficou
//     marcado para rever, e salta para qualquer pergunta;
//   · o ritmo diz, em perguntas, se a pessoa está à frente ou atrás dos
//     ~1,7 min por pergunta — sem isso os últimos 10 minutos são pânico;
//   · antes de entregar há um ecrã de revisão (o que falta, o que ficou
//     marcado), em vez de um `confirm()` do browser;
//   · teclado: 1–6 ou A–F escolhem, ←/→ navegam, Enter avança, M marca.
//
// MECÂNICA ZERO AQUI. Respostas, gravação, relógio e entrega continuam no
// `QuizRunner` — este componente só desenha a folha e chama o que lhe dão.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Target,
} from "lucide-react";
import type { PublicQuestion, QuestionTopic } from "@/lib/training/grading";

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Uma cor por capítulo, para que o salto de capítulo em capítulo se VEJA.
 *  Tons dentro da família da marca, nenhum deles verde/vermelho (que ficam
 *  reservados para certo/errado na correção). */
const TOPIC_TONES = [
  "#8b93ff",
  "#b18cff",
  "#7dd3fc",
  "#f0a8ee",
  "#fcd34d",
  "#a5b4fc",
  "#c4b5fd",
  "#67e8f9",
  "#f9a8d4",
  "#fdba74",
  "#93c5fd",
];

export function topicTone(topic: QuestionTopic): string {
  if (topic.no === null) return "#f0a8ee";
  return TOPIC_TONES[(topic.no - 1) % TOPIC_TONES.length];
}

export function TopicChip({
  topic,
  compact = false,
}: {
  topic: QuestionTopic;
  compact?: boolean;
}) {
  const tone = topicTone(topic);
  const isCore = topic.no === null;
  return (
    <span
      className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
      style={{
        borderColor: `${tone}55`,
        backgroundColor: `${tone}14`,
        color: tone,
      }}
      title={topic.title}
    >
      {isCore ? (
        <Target className="h-3 w-3 shrink-0" />
      ) : (
        <span className="tabular shrink-0 font-bold">Cap. {topic.no}</span>
      )}
      {!compact && <span className="truncate text-white/70">{topic.title}</span>}
    </span>
  );
}

const LETTERS = "ABCDEFGH";

export function ExamSheet({
  storageKey,
  questions,
  answers,
  onToggle,
  msLeft,
  durationMs,
  passingScore,
  attemptNumber,
  attemptsLeft,
  awayCount,
  locked,
  submitting,
  error,
  onSubmit,
}: {
  /** Chave das marcações «rever» no browser — exame + tentativa. */
  storageKey: string;
  questions: PublicQuestion[];
  answers: Record<string, string[]>;
  onToggle: (q: PublicQuestion, optionId: string) => void;
  msLeft: number | null;
  durationMs: number | null;
  passingScore: number;
  attemptNumber: number;
  attemptsLeft: number | null;
  awayCount: number;
  locked: boolean;
  submitting: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  const total = questions.length;
  const isAnswered = useCallback(
    (id: string) => (answers[id] ?? []).length > 0,
    [answers],
  );

  // Quem volta a meio (F5) cai na primeira por responder, não na 1.
  const [index, setIndex] = useState(() => {
    const first = questions.findIndex((q) => !(answers[q.id] ?? []).length);
    return first === -1 ? 0 : first;
  });
  const [reviewing, setReviewing] = useState(false);

  // As marcações «rever» são uma ajuda de quem responde, não fazem parte da
  // folha — ficam no browser e não vão ao servidor.
  const [flagged, setFlagged] = useState<Set<string>>(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const ids = raw ? (JSON.parse(raw) as unknown) : [];
      return new Set(Array.isArray(ids) ? ids.filter((x) => typeof x === "string") : []);
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([...flagged]));
    } catch {
      /* modo privado / storage bloqueado — as marcas vivem só nesta página */
    }
  }, [flagged, storageKey]);

  const answeredCount = useMemo(
    () => questions.filter((q) => isAnswered(q.id)).length,
    [questions, isAnswered],
  );
  const unanswered = questions
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => !isAnswered(q.id));
  const flaggedList = questions
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => flagged.has(q.id));

  const cardRef = useRef<HTMLDivElement>(null);
  const go = useCallback(
    (i: number) => {
      setReviewing(false);
      setIndex(Math.max(0, Math.min(total - 1, i)));
    },
    [total],
  );
  // Ao mudar de pergunta num ecrã pequeno, o enunciado novo pode ficar acima
  // do que se está a ver — traz-se o cartão de volta à vista.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    if (el.getBoundingClientRect().top < 0) {
      el.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [index, reviewing]);

  const toggleFlag = useCallback((id: string) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const q = questions[index];
  const next = useCallback(() => {
    if (index >= total - 1) setReviewing(true);
    else go(index + 1);
  }, [go, index, total]);

  // Teclado. Ignora-se tudo o que vem com modificadores (atalhos do browser)
  // e tudo o que acontece dentro de campos de texto.
  useEffect(() => {
    if (locked) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (reviewing) {
        if (e.key === "Escape" || e.key === "ArrowLeft") {
          e.preventDefault();
          setReviewing(false);
        }
        return;
      }
      const key = e.key.toLowerCase();
      if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(index - 1);
        return;
      }
      // Enter avança — exceto em cima de um botão que não seja uma opção,
      // onde Enter tem de continuar a carregar nesse botão.
      if (e.key === "Enter") {
        if (target?.tagName === "BUTTON" && !target.dataset.option) return;
        e.preventDefault();
        next();
        return;
      }
      if (key === "m") {
        e.preventDefault();
        toggleFlag(q.id);
        return;
      }
      const n = /^[1-8]$/.test(key)
        ? Number(key) - 1
        : LETTERS.toLowerCase().indexOf(key);
      if (key.length === 1 && n >= 0 && n < q.options.length) {
        e.preventDefault();
        onToggle(q, q.options[n].id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, locked, next, onToggle, q, reviewing, toggleFlag]);

  // ---- Ritmo ----
  // Quantas perguntas "devia" ter respondidas a esta altura, ao ritmo certo,
  // contra quantas tem. Dito em perguntas porque é o que se consegue usar.
  const pace = useMemo(() => {
    if (msLeft === null || !durationMs || total === 0) return null;
    const elapsed = Math.max(0, durationMs - msLeft);
    const expected = elapsed / (durationMs / total);
    const delta = answeredCount - expected;
    if (delta >= 1.5) {
      return { tone: "ahead" as const, label: `${Math.floor(delta)} à frente do ritmo` };
    }
    if (delta <= -2) {
      return { tone: "behind" as const, label: `${Math.round(-delta)} atrás do ritmo` };
    }
    return { tone: "ok" as const, label: "no ritmo" };
  }, [answeredCount, durationMs, msLeft, total]);
  const perQuestion =
    durationMs && total
      ? (durationMs / total / 60_000).toFixed(1).replace(".", ",")
      : null;

  const urgent = msLeft !== null && msLeft <= 5 * 60_000;
  const critical = msLeft !== null && msLeft <= 60_000;

  return (
    <div className="space-y-4">
      {/* ===== Barra fixa: relógio, progresso, ritmo, entregar ===== */}
      <div
        className={`sticky top-2 z-20 rounded-xl border px-4 py-3 backdrop-blur-md ${
          critical
            ? "border-rose-400/50 bg-rose-950/70"
            : urgent
              ? "border-amber-400/40 bg-amber-950/50"
              : "border-white/10 bg-[color:var(--background)]/90"
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {msLeft !== null && (
            <span
              className={`tabular inline-flex shrink-0 items-center rounded-lg px-3 py-1.5 text-[19px] font-bold leading-none tracking-tight ${
                critical
                  ? "animate-pulse bg-rose-500/20 text-rose-100"
                  : urgent
                    ? "bg-amber-500/15 text-amber-100"
                    : "bg-white/[0.06] text-white"
              }`}
              aria-live="off"
              title="Tempo que falta — carimbado pelo servidor"
            >
              {formatClock(msLeft)}
            </span>
          )}
          <div className="min-w-[120px] flex-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="brand-gradient-bg h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: `${total ? Math.round((answeredCount / total) * 100) : 0}%`,
                }}
              />
            </div>
            <p className="tabular mt-1.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-white/50">
              <span className="font-medium text-white/70">
                {answeredCount}/{total} respondidas
              </span>
              {pace && (
                <span
                  className={
                    pace.tone === "behind"
                      ? "text-amber-200/90"
                      : pace.tone === "ahead"
                        ? "text-emerald-300/85"
                        : "text-white/45"
                  }
                  title={
                    perQuestion
                      ? `Ritmo de referência: ~${perQuestion} min por pergunta`
                      : undefined
                  }
                >
                  · {pace.label}
                </span>
              )}
              <span className="text-white/35">
                · mínimo {passingScore}%
                {attemptsLeft !== null && ` · tentativa ${attemptNumber}`}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReviewing(true)}
            disabled={submitting || locked}
            className="brand-gradient-bg inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            Rever e entregar
          </button>
        </div>
        {awayCount > 0 && (
          <p className="mt-2 text-[11px] font-medium text-amber-200/80">
            Saíste do exame {awayCount} {awayCount === 1 ? "vez" : "vezes"} —
            fica registado, e o cronómetro nunca parou.
          </p>
        )}
      </div>

      {/* ===== Mapa da folha ===== */}
      <nav
        aria-label="Mapa da folha"
        className="flex flex-wrap gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.015] p-2.5"
      >
        {questions.map((qq, i) => {
          const current = !reviewing && i === index;
          const done = isAnswered(qq.id);
          const marked = flagged.has(qq.id);
          const tone = qq.topic ? topicTone(qq.topic) : null;
          return (
            <button
              key={qq.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Pergunta ${i + 1}${done ? ", respondida" : ""}${marked ? ", marcada para rever" : ""}`}
              aria-current={current ? "step" : undefined}
              title={qq.topic?.title}
              className={`tabular relative flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-semibold transition ${
                current
                  ? "bg-white text-[#1a1033] shadow-[0_0_0_2px_rgba(197,53,201,0.55)]"
                  : done
                    ? "bg-[#783DF5]/40 text-white hover:bg-[#783DF5]/55"
                    : "bg-white/[0.05] text-white/45 hover:bg-white/[0.1] hover:text-white/80"
              }`}
            >
              {i + 1}
              {tone && !current && (
                <span
                  aria-hidden
                  className="absolute inset-x-1.5 bottom-0.5 h-[2px] rounded-full opacity-70"
                  style={{ backgroundColor: tone }}
                />
              )}
              {marked && (
                <span
                  aria-hidden
                  className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-[color:var(--background)] bg-amber-300"
                />
              )}
            </button>
          );
        })}
      </nav>

      {error && (
        <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-100/90">
          {error}
        </p>
      )}

      <div ref={cardRef} className="scroll-mt-28">
        {reviewing ? (
          <ReviewPanel
            total={total}
            answeredCount={answeredCount}
            unanswered={unanswered}
            flagged={flaggedList}
            submitting={submitting}
            locked={locked}
            onGo={go}
            onBack={() => setReviewing(false)}
            onSubmit={onSubmit}
          />
        ) : (
          q && (
            <article
              key={q.id}
              className="animate-fade-up rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-7"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="readout tabular text-white/40">
                  Pergunta {index + 1} de {total}
                </span>
                {q.topic && <TopicChip topic={q.topic} />}
                <button
                  type="button"
                  onClick={() => toggleFlag(q.id)}
                  className={`ml-auto inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] font-medium transition ${
                    flagged.has(q.id)
                      ? "border-amber-300/40 bg-amber-400/10 text-amber-200"
                      : "border-white/10 text-white/45 hover:border-white/25 hover:text-white/80"
                  }`}
                  title="Atalho: M"
                >
                  {flagged.has(q.id) ? (
                    <BookmarkCheck className="h-3.5 w-3.5" />
                  ) : (
                    <Bookmark className="h-3.5 w-3.5" />
                  )}
                  {flagged.has(q.id) ? "Marcada para rever" : "Marcar para rever"}
                </button>
              </div>

              <p className="mt-4 text-[16px] font-medium leading-relaxed text-white/92 sm:text-[17px]">
                {q.prompt}
              </p>
              {q.type === "multi_select" && (
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-[#A9834F]">
                  Escolhe todas as que se aplicam · só conta se acertares em
                  todas
                </p>
              )}

              <ul className="mt-5 space-y-2.5">
                {q.options.map((o, oi) => {
                  const chosen = (answers[q.id] ?? []).includes(o.id);
                  return (
                    <li key={o.id}>
                      <button
                        type="button"
                        data-option="1"
                        onClick={() => onToggle(q, o.id)}
                        disabled={locked}
                        className={`group flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-[13.5px] leading-relaxed transition ${
                          chosen
                            ? "border-[#783DF5]/60 bg-[#783DF5]/[0.14] text-white"
                            : "border-white/10 bg-white/[0.02] text-white/72 hover:border-white/25 hover:bg-white/[0.05]"
                        }`}
                      >
                        <span
                          className={`mt-px flex h-6 w-6 shrink-0 items-center justify-center text-[11px] font-bold transition ${
                            q.type === "multi_select"
                              ? "rounded-md"
                              : "rounded-full"
                          } ${
                            chosen
                              ? "brand-gradient-bg text-white"
                              : "border border-white/20 text-white/50 group-hover:border-white/40"
                          }`}
                        >
                          {chosen && q.type === "multi_select"
                            ? "✓"
                            : (LETTERS[oi] ?? oi + 1)}
                        </span>
                        <span className="min-w-0 flex-1">{o.text}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-5">
                <button
                  type="button"
                  onClick={() => go(index - 1)}
                  disabled={index === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 px-4 py-2.5 text-[13px] font-medium text-white/70 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Anterior
                </button>
                <span className="hidden flex-1 text-center text-[11px] text-white/30 sm:block">
                  <Kbd>A</Kbd>–<Kbd>{LETTERS[Math.max(0, q.options.length - 1)]}</Kbd>{" "}
                  escolhe · <Kbd>←</Kbd> <Kbd>→</Kbd> navega · <Kbd>M</Kbd>{" "}
                  marca
                </span>
                <button
                  type="button"
                  onClick={next}
                  className={`ml-auto inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[13px] font-semibold transition sm:ml-0 ${
                    isAnswered(q.id)
                      ? "brand-gradient-bg text-white hover:brightness-110"
                      : "border border-white/15 text-white/75 hover:border-white/35 hover:text-white"
                  }`}
                >
                  {index >= total - 1 ? (
                    <>
                      Rever e entregar
                      <ClipboardCheck className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      {isAnswered(q.id) ? "Seguinte" : "Saltar"}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </article>
          )
        )}
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-white/15 bg-white/[0.04] px-1 py-px font-sans text-[10px] text-white/50">
      {children}
    </kbd>
  );
}

/** O ecrã antes de entregar: o que falta e o que ficou marcado, com atalho
 *  para cada um. Substitui o `confirm()` do browser — diz o preço de entregar
 *  assim em vez de perguntar "tens a certeza?". */
function ReviewPanel({
  total,
  answeredCount,
  unanswered,
  flagged,
  submitting,
  locked,
  onGo,
  onBack,
  onSubmit,
}: {
  total: number;
  answeredCount: number;
  unanswered: { q: PublicQuestion; i: number }[];
  flagged: { q: PublicQuestion; i: number }[];
  submitting: boolean;
  locked: boolean;
  onGo: (i: number) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const missing = unanswered.length;
  return (
    <section className="animate-fade-up rounded-2xl border border-[#C535C9]/30 bg-[#C535C9]/[0.05] p-5 sm:p-7">
      <p className="flex items-center gap-2 text-[16px] font-semibold text-white">
        <ClipboardCheck className="h-4.5 w-4.5 text-[#f0a8ee]" />
        Rever antes de entregar
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <ReviewStat label="Respondidas" value={`${answeredCount}/${total}`} />
        <ReviewStat
          label="Por responder"
          value={missing}
          tone={missing ? "amber" : "emerald"}
        />
        <ReviewStat label="Marcadas" value={flagged.length} />
      </div>

      {missing > 0 && (
        <JumpList
          title="Por responder"
          items={unanswered}
          onGo={onGo}
          tone="amber"
        />
      )}
      {flagged.length > 0 && (
        <JumpList title="Marcadas para rever" items={flagged} onGo={onGo} />
      )}

      <p
        className={`mt-5 flex items-start gap-2 text-[12.5px] leading-relaxed ${
          missing ? "text-amber-100/80" : "text-emerald-100/80"
        }`}
      >
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {missing
          ? `${missing} pergunta${missing === 1 ? "" : "s"} por responder conta${missing === 1 ? "" : "m"} como errada${missing === 1 ? "" : "s"} se entregares agora. Entregar fecha a tentativa — não se reabre.`
          : "Tudo respondido. Entregar fecha a tentativa — não se reabre."}
      </p>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 px-5 py-2.5 text-[13px] font-medium text-white/75 transition hover:border-white/35 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar às perguntas
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || locked}
          className="brand-gradient-bg inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Entregar exame
        </button>
      </div>
    </section>
  );
}

function ReviewStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "amber" | "emerald";
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-2.5">
      <p className="readout text-white/35">{label}</p>
      <p
        className={`tabular mt-1 text-[17px] font-semibold ${
          tone === "amber"
            ? "text-amber-200"
            : tone === "emerald"
              ? "text-emerald-300"
              : "text-white/90"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function JumpList({
  title,
  items,
  onGo,
  tone,
}: {
  title: string;
  items: { q: PublicQuestion; i: number }[];
  onGo: (i: number) => void;
  tone?: "amber";
}) {
  return (
    <div className="mt-4">
      <p className="readout text-white/40">{title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map(({ q, i }) => (
          <button
            key={q.id}
            type="button"
            onClick={() => onGo(i)}
            title={q.topic?.title}
            className={`tabular rounded-lg border px-2.5 py-1 text-[12px] font-semibold transition ${
              tone === "amber"
                ? "border-amber-300/30 bg-amber-400/[0.07] text-amber-100 hover:border-amber-300/60"
                : "border-white/12 bg-white/[0.03] text-white/75 hover:border-white/30"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Depois da correção: como correu cada capítulo. É a leitura que diz onde
 *  voltar antes da tentativa seguinte — "chumbei" não diz nada, "Cap. 4 em
 *  1/3" diz tudo. */
export function TopicBreakdown({
  rows,
  passingScore,
}: {
  rows: { topic: QuestionTopic; right: number; total: number }[];
  passingScore: number;
}) {
  if (rows.length < 2) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#A9834F]">
        Por capítulo
      </h2>
      <ul className="mt-3 space-y-2.5">
        {rows.map(({ topic, right, total }) => {
          const pct = total ? Math.round((right / total) * 100) : 0;
          const weak = pct < passingScore;
          return (
            <li key={topic.key} className="flex items-center gap-3">
              <span className="w-[42%] min-w-0 sm:w-1/2">
                <TopicChip topic={topic} />
              </span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <span
                  className={`block h-1.5 rounded-full ${
                    pct === 100
                      ? "bg-emerald-400/80"
                      : weak
                        ? "bg-rose-400/75"
                        : "bg-amber-300/75"
                  }`}
                  style={{ width: `${Math.max(pct, 4)}%` }}
                />
              </span>
              <span
                className={`tabular w-10 shrink-0 text-right text-[12px] font-semibold ${
                  weak ? "text-rose-200/90" : "text-white/70"
                }`}
              >
                {right}/{total}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
