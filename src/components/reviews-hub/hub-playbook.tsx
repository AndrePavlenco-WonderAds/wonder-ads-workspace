"use client";

// Respostas — as cinco estratégias (uma por nível de estrelas) e, ao lado, a
// estratégia em ação: uma review real desse nível e a resposta da IA.

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  MessageSquareText,
  RefreshCw,
  Settings2,
  Sparkles,
} from "lucide-react";
import type { HubDraft, HubReview, ResponseMode, StarLevel } from "@/lib/reviews-hub/types";
import { useHub } from "./hub-context";
import { Avatar, GoogleG, LEVELS, LevelFace, STAR_GOLD, StarRow, relativeTime } from "./hub-ui";
import { useReplyStream } from "./use-reply-stream";

const MODE_LABEL: Record<ResponseMode, string> = {
  auto: "Automático",
  approval: "Com aprovação",
  manual: "Manual",
};

/** Exemplos para quando ainda não há reviews daquele nível sincronizadas. */
const SAMPLES: Record<StarLevel, { author: string; text: string }> = {
  1: {
    author: "Mariana Silva",
    text: "Fiquei desiludida com o resultado. Marquei um horário e tive de esperar bastante tempo. Além disso, o corte não ficou como eu tinha pedido.",
  },
  2: {
    author: "Rui Costa",
    text: "O atendimento foi simpático, mas a coloração não ficou no tom que tínhamos combinado e ninguém me perguntou se estava satisfeito.",
  },
  3: {
    author: "Ana Ferreira",
    text: "Gostei do corte, mas o salão estava muito cheio e senti que o brushing foi feito à pressa.",
  },
  4: {
    author: "Joana Martins",
    text: "Muito bom atendimento e o balayage ficou lindo. Só achei a espera um bocadinho longa.",
  },
  5: {
    author: "Carla Sousa",
    text: "Adorei! A equipa é super profissional e o ritual Keratin Boost deixou o meu cabelo incrível. Volto com certeza.",
  },
};

type Example =
  | { kind: "real"; review: HubReview }
  | { kind: "sample"; author: string; text: string; stars: StarLevel };

export function PlaybookView() {
  const { settings, scoped, go } = useHub();
  const [level, setLevel] = useState<StarLevel>(1);

  const unansweredBy = useMemo(() => {
    const m: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of scoped) if (!r.reply && r.stars) m[r.stars] += 1;
    return m;
  }, [scoped]);

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
      <LayoutGroup id="rhub-playbook">
        <div className="space-y-3">
          {([1, 2, 3, 4, 5] as StarLevel[]).map((l, i) => {
            const s = settings.strategies[`${l}`];
            const L = LEVELS[l];
            const active = level === l;
            return (
              <motion.button
                key={l}
                onClick={() => setLevel(l)}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ x: 4 }}
                className="group relative w-full rounded-2xl text-left"
              >
                {active && (
                  <motion.span
                    layoutId="rhub-strategy-active"
                    className="absolute inset-0 rounded-2xl border border-violet-400/60 bg-[linear-gradient(135deg,rgba(79,70,229,0.16),rgba(168,85,247,0.10))] shadow-[0_18px_50px_-24px_rgba(139,92,246,0.9)]"
                    transition={{ type: "spring", stiffness: 380, damping: 34 }}
                  />
                )}
                <span
                  className={`relative flex items-center gap-4 rounded-2xl border p-4 transition-colors sm:gap-5 sm:p-5 ${
                    active ? "border-transparent" : "border-white/[0.07] bg-white/[0.02] group-hover:border-white/15"
                  }`}
                >
                  <LevelFace level={l} size={56} active={active} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <StarRow value={l} size={17} color={l <= 3 ? STAR_GOLD : L.color} animateIn={active} />
                      <span className="text-[16px] font-semibold text-white">{L.label}</span>
                    </span>
                    <span className="mt-1.5 block text-[16px] font-semibold text-white/95">{s.title}</span>
                    <span className="mt-0.5 block text-[14px] leading-snug text-white/50">{s.description}</span>
                    <span className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-white/55">{MODE_LABEL[s.mode]}</span>
                      {unansweredBy[l] > 0 && (
                        <span
                          role="link"
                          onClick={(e) => {
                            e.stopPropagation();
                            go("reviews", { tab: "pending", stars: [l] });
                          }}
                          className="rounded-full px-2 py-0.5 font-semibold transition hover:brightness-125"
                          style={{ background: L.soft, color: L.color }}
                        >
                          {unansweredBy[l]} por responder →
                        </span>
                      )}
                    </span>
                  </span>
                  <ChevronRight
                    className={`h-5 w-5 shrink-0 transition ${active ? "translate-x-0.5 text-white" : "text-white/35 group-hover:text-white/70"}`}
                  />
                </span>
              </motion.button>
            );
          })}
        </div>
      </LayoutGroup>

      <div className="xl:sticky xl:top-6">
        <StrategyPreview key={level} level={level} />
      </div>
    </div>
  );
}

function StrategyPreview({ level }: { level: StarLevel }) {
  const { slug, scoped, locationsById, settings, viewer, go, setDraft, toast, brand } = useHub();
  const stream = useReplyStream(slug);
  const [copied, setCopied] = useState(false);
  const [idx, setIdx] = useState(0);
  const L = LEVELS[level];
  const strategy = settings.strategies[`${level}`];

  // Reviews reais deste nível, com texto — as que ainda não têm resposta primeiro.
  const pool = useMemo(
    () =>
      scoped
        .filter((r) => r.stars === level && r.text.length > 30)
        .sort((a, b) => Number(Boolean(a.reply)) - Number(Boolean(b.reply)) || b.created.localeCompare(a.created))
        .slice(0, 25),
    [scoped, level],
  );
  const example: Example = pool.length
    ? { kind: "real", review: pool[idx % pool.length] }
    : { kind: "sample", stars: level, ...SAMPLES[level] };

  useEffect(() => stream.reset(""), [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  const author = example.kind === "real" ? example.review.author : example.author;
  const text = example.kind === "real" ? example.review.text : example.text;
  const salon = example.kind === "real" ? locationsById.get(example.review.loc) : null;
  const streaming = stream.status === "streaming";

  async function generate(again = false) {
    const previous = again && stream.text ? stream.text : undefined;
    if (example.kind === "real") {
      await stream.run({ reviewId: example.review.id, loc: example.review.loc, previous });
    } else {
      await stream.run({ sample: { author: example.author, stars: level, text: example.text, salon: brand }, previous });
    }
  }

  async function adoptReply() {
    if (example.kind !== "real" || !stream.text) return;
    const res = await fetch(`/api/reviews-hub/${slug}/drafts`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewId: example.review.id, loc: example.review.loc, text: stream.text }),
    });
    if (!res.ok) return toast("Não foi possível guardar o rascunho.", "error");
    const j = (await res.json()) as { draft: HubDraft };
    setDraft(example.review.id, j.draft);
    go("reviews", { tab: "all", reviewId: example.review.id });
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0c14]/80 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <h3 className="flex items-center gap-2.5 text-[16px] font-semibold text-white">
          <MessageSquareText className="h-[18px] w-[18px] text-white/60" /> Pré-visualização
        </h3>
        <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: L.soft, color: L.color }}>
          {strategy.title}
        </span>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025]">
          <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5 text-[12px] text-white/55">
            <span className="flex min-w-0 items-center gap-2">
              <GoogleG size={15} />
              <span className="truncate">
                {example.kind === "real" ? `Review do Google · ${salon?.short ?? ""}` : "Exemplo de review do Google"}
              </span>
            </span>
            {pool.length > 1 && (
              <button
                onClick={() => setIdx((i) => i + 1)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium text-white/50 transition hover:bg-white/[0.06] hover:text-white"
              >
                <RefreshCw className="h-3 w-3" /> Outro exemplo
              </button>
            )}
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${level}-${idx}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="flex gap-3.5 px-4 py-4"
            >
              <Avatar
                name={author}
                photo={example.kind === "real" ? example.review.photo : undefined}
                size={42}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-white">{author}</p>
                <p className="text-[12px] text-white/40">
                  {example.kind === "real" ? relativeTime(example.review.created) : "há 3 dias"}
                </p>
                <div className="mt-1.5">
                  <StarRow value={level} size={15} animateIn />
                </div>
                <p className="mt-2 line-clamp-6 text-[14px] leading-relaxed text-white/75">{text}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex justify-center">
          <motion.span animate={{ y: [0, 3, 0] }} transition={{ duration: 1.8, repeat: Infinity }}>
            <ChevronDown className="h-4 w-4 text-white/30" />
          </motion.span>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 text-[15px] font-semibold text-white">
              <Sparkles className="h-4 w-4 text-violet-300" /> Resposta gerada
            </h4>
            {stream.text && viewer.canWrite && (
              <button
                onClick={() => void generate(true)}
                disabled={streaming}
                className="inline-flex items-center gap-2 rounded-xl border border-white/12 px-3 py-1.5 text-[12px] font-medium text-white/70 transition hover:border-white/25 hover:text-white disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${streaming ? "animate-spin" : ""}`} /> Gerar outra resposta
              </button>
            )}
          </div>
          <div
            className={`mt-3 min-h-[200px] rounded-2xl border p-4 text-[14px] leading-relaxed transition ${
              streaming ? "border-violet-400/40 shadow-[0_0_0_4px_rgba(139,92,246,0.10)]" : "border-white/[0.08]"
            } bg-white/[0.02]`}
          >
            {streaming && !stream.text ? (
              <div className="space-y-2.5">
                <p className="flex items-center gap-2 text-[13px] font-medium text-violet-200">
                  <motion.span animate={{ rotate: [0, 14, -10, 0], scale: [1, 1.15, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
                    <Sparkles className="h-4 w-4" />
                  </motion.span>
                  A aplicar a estratégia «{strategy.title}»…
                </p>
                {[90, 100, 82, 95, 50].map((w, i) => (
                  <div key={i} className="rhub-skeleton h-3 rounded-full" style={{ width: `${w}%` }} />
                ))}
              </div>
            ) : stream.text ? (
              <p className="whitespace-pre-line text-white/85">
                {stream.text}
                {streaming && <span className="rhub-caret" />}
              </p>
            ) : (
              <div className="flex h-[168px] flex-col items-center justify-center text-center">
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 ring-1 ring-violet-400/25"
                >
                  <Sparkles className="h-5 w-5 text-violet-300" />
                </motion.div>
                <p className="mt-3 max-w-xs text-[13px] text-white/45">
                  Veja como a IA responde a uma review de {L.label}, com o tom e as regras da marca.
                </p>
              </div>
            )}
            {stream.error && <p className="mt-2 text-[12px] text-rose-300">{stream.error}</p>}
          </div>

          {viewer.canWrite && (
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_auto]">
              <motion.button
                onClick={() => void generate(Boolean(stream.text))}
                disabled={streaming}
                whileHover={{ scale: 1.012 }}
                whileTap={{ scale: 0.98 }}
                className="relative flex h-[52px] items-center justify-center gap-2.5 overflow-hidden rounded-2xl text-[15px] font-semibold text-white shadow-[0_16px_40px_-18px_rgba(120,61,245,0.95)] disabled:cursor-wait"
                style={{ background: "linear-gradient(135deg,#4f46e5 0%,#7c3aed 55%,#a855f7 100%)" }}
              >
                {streaming && (
                  <motion.span
                    className="absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.22)_50%,transparent_75%)]"
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ duration: 1.3, repeat: Infinity, ease: "linear" }}
                  />
                )}
                <span className="relative flex items-center gap-2.5">
                  <Sparkles className="h-[18px] w-[18px]" /> {streaming ? "A gerar…" : "Gerar resposta"}
                </span>
              </motion.button>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(stream.text).catch(() => undefined);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                }}
                disabled={!stream.text || streaming}
                className="flex h-[52px] items-center justify-center gap-2 rounded-2xl border border-white/12 px-5 text-[14px] font-medium text-white/80 transition hover:border-white/25 hover:bg-white/[0.04] disabled:opacity-40"
              >
                {copied ? (
                  <span className="flex items-center gap-2 text-emerald-300">
                    <Check className="h-4 w-4" /> Copiada
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Copy className="h-4 w-4" /> Copiar resposta
                  </span>
                )}
              </button>
            </div>
          )}

          <AnimatePresence>
            {example.kind === "real" && !example.review.reply && stream.status === "done" && viewer.canWrite && (
              <motion.button
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                onClick={() => void adoptReply()}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400/25 bg-violet-500/10 py-2.5 text-[13px] font-semibold text-violet-100 transition hover:bg-violet-500/20"
              >
                Esta review ainda não tem resposta — usar esta e rever antes de publicar <ArrowRight className="h-4 w-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/40">Como a IA responde</p>
            <button
              onClick={() => go("definicoes")}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-violet-300 hover:text-violet-200"
            >
              <Settings2 className="h-3.5 w-3.5" /> Editar
            </button>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-white/60">{strategy.guidelines}</p>
          <p className="mt-2 text-[12px] text-white/40">
            Modo da automação: <span className="font-semibold text-white/65">{MODE_LABEL[strategy.mode]}</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
