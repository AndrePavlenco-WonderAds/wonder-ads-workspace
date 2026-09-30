"use client";

// O painel de resposta: a review como aparece no Google, a resposta escrita
// pela IA (editável, guardada como rascunho enquanto se escreve) e os botões
// Gerar · Copiar · Publicar no Google.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BadgeCheck,
  Bot,
  Check,
  ChevronDown,
  CircleAlert,
  Copy,
  ExternalLink,
  Hourglass,
  Loader2,
  MessageSquareText,
  PenLine,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { formatDate } from "@/lib/dates";
import type { HubDraft, HubReview } from "@/lib/reviews-hub/types";
import { useHub } from "./hub-context";
import { Avatar, GoogleG, LEVELS, StarRow, levelOf, relativeTime } from "./hub-ui";
import { useReplyStream } from "./use-reply-stream";

type SaveState = "idle" | "saving" | "saved";

export function Composer({
  review,
  onPublished,
}: {
  review: HubReview;
  onPublished?: (review: HubReview) => void;
}) {
  const { slug, data, settings, locationsById, viewer, applyReview, setDraft, toast } = useHub();
  const loc = locationsById.get(review.loc);
  const draft = data.drafts[review.id] as HubDraft | undefined;
  const level = levelOf(review.stars);
  const L = LEVELS[level];
  const strategy = settings.strategies[`${level}`];
  const stream = useReplyStream(slug);
  const [editing, setEditing] = useState(!review.reply);
  const [save, setSave] = useState<SaveState>("idle");
  const [armed, setArmed] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [celebrate, setCelebrate] = useState<null | "published" | "marked">(null);
  // Modo leitura (reviews pela DataForSEO): publica-se à mão no Google.
  const publishAvailable = Boolean(data.sync.publishAvailable);
  const [handoff, setHandoff] = useState(false);
  const [marking, setMarking] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const savedText = useRef(draft?.text ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canWrite = viewer.canWrite;
  const text = stream.text;
  const streaming = stream.status === "streaming";

  // Trocar de review → carrega o rascunho dela (ou nada).
  useEffect(() => {
    stream.reset(draft?.text ?? "");
    savedText.current = draft?.text ?? "";
    setEditing(!review.reply || Boolean(draft));
    setArmed(false);
    setPublishError(null);
    setSave("idle");
    setExpanded(false);
    setHandoff(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review.id]);

  // Rascunho gravado sozinho, 900 ms depois de parar de escrever.
  useEffect(() => {
    if (!canWrite || streaming || !editing) return;
    if (text.trim() === savedText.current.trim()) return;
    const t = setTimeout(() => void persistDraft(text), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, streaming, editing, canWrite]);

  // Desarma o «Confirmar publicação» ao fim de uns segundos.
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4500);
    return () => clearTimeout(t);
  }, [armed]);

  // «G» gera (ou volta a gerar) a resposta da review aberta.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "g" || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
      if (!canWrite || streaming || publishing) return;
      e.preventDefault();
      void generate(Boolean(text));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canWrite, streaming, publishing, text, review.id]);

  // Cresce com o texto.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(180, el.scrollHeight)}px`;
  }, [text, editing, streaming]);

  async function persistDraft(value: string) {
    if (!value.trim()) {
      if (draft) {
        await fetch(`/api/reviews-hub/${slug}/drafts?reviewId=${encodeURIComponent(review.id)}`, { method: "DELETE" });
        setDraft(review.id, null);
      }
      savedText.current = "";
      return;
    }
    setSave("saving");
    try {
      const res = await fetch(`/api/reviews-hub/${slug}/drafts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: review.id, loc: review.loc, text: value }),
      });
      if (!res.ok) throw new Error();
      const j = (await res.json()) as { draft: HubDraft };
      savedText.current = value;
      setDraft(review.id, j.draft);
      setSave("saved");
    } catch {
      setSave("idle");
    }
  }

  async function generate(again = false) {
    if (!canWrite) return;
    setEditing(true);
    setArmed(false);
    setPublishError(null);
    const final = await stream.run({
      reviewId: review.id,
      loc: review.loc,
      ...(again && text ? { previous: text } : {}),
    });
    if (final) void persistDraft(final);
  }

  async function copy() {
    if (!text) return;
    await navigator.clipboard.writeText(text).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function publish() {
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch(`/api/reviews-hub/${slug}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: review.id, loc: review.loc, text }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; review?: HubReview };
      if (!res.ok || !j.review) throw new Error(j.error ?? "Não foi possível publicar no Google.");
      setCelebrate("published");
      setDraft(review.id, null);
      savedText.current = "";
      toast(`Resposta publicada no Google — ${review.author}`);
      setTimeout(() => {
        setCelebrate(null);
        applyReview(j.review!);
        setEditing(false);
        onPublished?.(j.review!);
      }, 1500);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Não foi possível publicar no Google.");
    } finally {
      setPublishing(false);
    }
  }

  /** Copia a resposta e abre a review no Google (modo leitura). O
   *  window.open tem de ser síncrono, ainda dentro do clique, senão o
   *  browser bloqueia o separador. */
  function copyAndOpen() {
    const url = review.url ?? loc?.mapsUri;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    void navigator.clipboard.writeText(text).catch(() => undefined);
    setHandoff(true);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function markReplied() {
    setMarking(true);
    setPublishError(null);
    try {
      const res = await fetch(`/api/reviews-hub/${slug}/mark-replied`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: review.id, loc: review.loc, text }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; review?: HubReview };
      if (!res.ok || !j.review) throw new Error(j.error ?? "Não foi possível marcar a review.");
      setCelebrate("marked");
      setDraft(review.id, null);
      savedText.current = "";
      toast(`Resposta a ${review.author} marcada como publicada`);
      setTimeout(() => {
        setCelebrate(null);
        setHandoff(false);
        applyReview(j.review!);
        setEditing(false);
        onPublished?.(j.review!);
      }, 1500);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Não foi possível marcar a review.");
    } finally {
      setMarking(false);
    }
  }

  async function discard() {
    stream.reset("");
    savedText.current = "";
    if (draft) {
      await fetch(`/api/reviews-hub/${slug}/drafts?reviewId=${encodeURIComponent(review.id)}`, { method: "DELETE" });
      setDraft(review.id, null);
    }
    if (review.reply) setEditing(false);
  }

  const long = review.text.length > 420;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0c14]/80 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
        <h3 className="flex items-center gap-2.5 text-[15px] font-semibold text-white">
          <MessageSquareText className="h-[18px] w-[18px] text-white/60" /> Pré-visualização
        </h3>
        {(review.url || loc?.mapsUri) && (
          <a
            href={review.url ?? loc?.mapsUri}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-white/55 transition hover:border-white/25 hover:text-white"
          >
            {review.url ? "Ver a review no Google" : "Ver no Google Maps"} <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {/* A review, como no Google */}
        <motion.div
          key={review.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-white/[0.07] bg-white/[0.025]"
        >
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5 text-[12px] text-white/55">
            <GoogleG size={15} /> Review do Google · <span className="truncate text-white/75">{loc?.short ?? "Salão"}</span>
          </div>
          <div className="flex gap-3.5 px-4 py-4">
            <Avatar name={review.author} photo={review.photo} size={42} />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-white">{review.author}</p>
              <p className="text-[12px] text-white/40" title={formatDate(review.created)}>
                {relativeTime(review.created)} · {formatDate(review.created)}
              </p>
              <div className="mt-1.5">
                <StarRow value={review.stars} size={15} animateIn />
              </div>
              {review.text ? (
                <>
                  <p
                    className={`mt-2 whitespace-pre-line text-[14px] leading-relaxed text-white/75 ${
                      long && !expanded ? "line-clamp-6" : ""
                    }`}
                  >
                    {review.text}
                  </p>
                  {long && (
                    <button onClick={() => setExpanded((v) => !v)} className="mt-1 text-[12px] font-semibold text-violet-300">
                      {expanded ? "Ver menos" : "Ver mais"}
                    </button>
                  )}
                </>
              ) : (
                <p className="mt-2 text-[13px] italic text-white/35">A pessoa deixou só a nota, sem comentário.</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* A resposta que já está publicada */}
        <AnimatePresence initial={false}>
          {review.reply && !editing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-[13px] font-semibold text-emerald-200">
                    <BadgeCheck className="h-4 w-4" /> Resposta publicada
                    {review.reply.via === "auto" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/80">
                        <Bot className="h-3 w-3" /> automática
                      </span>
                    )}
                    {review.reply.via === "manual" && (
                      <span className="rounded-full bg-violet-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-200/80">
                        escrita aqui
                      </span>
                    )}
                    {review.reply.via === "hub" && (
                      <span className="rounded-full bg-violet-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-200/80">
                        pela plataforma
                      </span>
                    )}
                  </p>
                  <span className="text-[11px] text-white/40">{relativeTime(review.reply.updated)}</span>
                </div>
                <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-white/75">{review.reply.text}</p>
                {canWrite && (
                  <button
                    onClick={() => {
                      setEditing(true);
                      // A resposta publicada não é um rascunho — só passa a
                      // sê-lo quando for mexida.
                      savedText.current = review.reply!.text;
                      stream.reset(review.reply!.text);
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/55 transition hover:text-white"
                  >
                    <PenLine className="h-3.5 w-3.5" /> Reescrever resposta
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {editing && (
          <>
            <div className="flex justify-center">
              <motion.span animate={{ y: [0, 3, 0] }} transition={{ duration: 1.8, repeat: Infinity }}>
                <ChevronDown className="h-4 w-4 text-white/30" />
              </motion.span>
            </div>

            {/* A resposta */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <h4 className="flex items-center gap-2 text-[15px] font-semibold text-white">
                    <Sparkles className="h-4 w-4 text-violet-300" />
                    {review.reply ? "Nova resposta" : "Resposta gerada"}
                  </h4>
                  <span
                    className="truncate rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{ background: L.soft, color: L.color }}
                    title={strategy.description}
                  >
                    {strategy.title}
                  </span>
                </div>
                {text && canWrite && (
                  <button
                    onClick={() => void generate(true)}
                    disabled={streaming}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/12 px-3 py-1.5 text-[12px] font-medium text-white/70 transition hover:border-white/25 hover:text-white disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${streaming ? "animate-spin" : ""}`} /> Gerar outra resposta
                  </button>
                )}
              </div>

              {draft?.status === "awaiting_approval" && (
                <p className="mt-2.5 flex items-center gap-2 rounded-xl border border-amber-300/25 bg-amber-300/[0.06] px-3 py-2 text-[12px] text-amber-100">
                  <Hourglass className="h-3.5 w-3.5 text-amber-300" /> Escrita pela automação — revê e publica para aprovar.
                </p>
              )}
              {draft?.status === "failed" && (
                <p className="mt-2.5 flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/[0.06] px-3 py-2 text-[12px] text-rose-100">
                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" /> A publicação automática falhou: {draft.error}
                </p>
              )}

              <div
                className={`relative mt-3 rounded-2xl border bg-white/[0.02] transition ${
                  streaming ? "border-violet-400/40 shadow-[0_0_0_4px_rgba(139,92,246,0.10)]" : "border-white/[0.08] focus-within:border-violet-400/40"
                }`}
              >
                {streaming && !text ? (
                  <div className="space-y-2.5 p-4">
                    <p className="flex items-center gap-2 text-[13px] font-medium text-violet-200">
                      <motion.span animate={{ rotate: [0, 14, -10, 0], scale: [1, 1.15, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
                        <Sparkles className="h-4 w-4" />
                      </motion.span>
                      A escrever uma resposta à medida…
                    </p>
                    {[92, 100, 84, 96, 58].map((w, i) => (
                      <div key={i} className="rhub-skeleton h-3 rounded-full" style={{ width: `${w}%`, animationDelay: `${i * 0.12}s` }} />
                    ))}
                  </div>
                ) : streaming ? (
                  <div className="min-h-[180px] whitespace-pre-line p-4 text-[14px] leading-relaxed text-white/85">
                    {text}
                    <span className="rhub-caret" />
                  </div>
                ) : (
                  <textarea
                    ref={textareaRef}
                    value={text}
                    readOnly={!canWrite}
                    onChange={(e) => {
                      stream.setText(e.target.value);
                      setArmed(false);
                    }}
                    placeholder={canWrite ? "Clique em «Gerar resposta» — ou escreva aqui a sua." : "Ainda sem resposta."}
                    className="block min-h-[180px] w-full resize-none bg-transparent p-4 text-[14px] leading-relaxed text-white/85 outline-none placeholder:text-white/25"
                  />
                )}
                <div className="flex items-center justify-between border-t border-white/[0.05] px-4 py-2 text-[11px] text-white/35">
                  <span>
                    <AnimatePresence mode="wait">
                      {save === "saving" ? (
                        <motion.span key="s" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
                          <Loader2 className="h-3 w-3 animate-spin" /> A guardar…
                        </motion.span>
                      ) : save === "saved" || draft ? (
                        <motion.span key="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
                          <Check className="h-3 w-3 text-emerald-400" /> Rascunho guardado
                        </motion.span>
                      ) : (
                        <motion.span key="n" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          {settings.signature}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                  <span className={text.length > 900 ? "text-amber-300" : ""}>{text.length} caracteres</span>
                </div>
              </div>

              <AnimatePresence>
                {(stream.error || publishError) && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-3 flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/[0.06] px-3 py-2 text-[12px] text-rose-100"
                  >
                    <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" />
                    <span>
                      {publishError ?? stream.error}
                      {publishError && (
                        <span className="mt-0.5 block text-rose-100/60">
                          Pode copiar a resposta e publicá-la diretamente no perfil do salão no Google.
                        </span>
                      )}
                    </span>
                  </motion.p>
                )}
              </AnimatePresence>

              {canWrite ? (
                <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_auto]">
                  {!text || streaming ? (
                    <PrimaryButton onClick={() => void generate(false)} disabled={streaming} busy={streaming}>
                      <Sparkles className="h-[18px] w-[18px]" /> {streaming ? "A gerar…" : "Gerar resposta"}
                    </PrimaryButton>
                  ) : !publishAvailable ? (
                    <PrimaryButton onClick={copyAndOpen}>
                      <ExternalLink className="h-[18px] w-[18px]" /> Copiar e responder no Google
                    </PrimaryButton>
                  ) : (
                    <PrimaryButton onClick={() => void publish()} busy={publishing} armed={armed}>
                      {publishing ? (
                        <>
                          <Loader2 className="h-[18px] w-[18px] animate-spin" /> A publicar…
                        </>
                      ) : armed ? (
                        <>
                          <Check className="h-[18px] w-[18px]" /> Confirmar — publicar no Google
                        </>
                      ) : (
                        <>
                          <Send className="h-[18px] w-[18px]" /> {review.reply ? "Substituir no Google" : "Publicar no Google"}
                        </>
                      )}
                    </PrimaryButton>
                  )}
                  <button
                    onClick={() => void copy()}
                    disabled={!text}
                    className="flex h-[52px] items-center justify-center gap-2 rounded-2xl border border-white/12 px-5 text-[14px] font-medium text-white/80 transition hover:border-white/25 hover:bg-white/[0.04] hover:text-white disabled:opacity-40"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {copied ? (
                        <motion.span key="c" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-emerald-300">
                          <Check className="h-4 w-4" /> Copiada
                        </motion.span>
                      ) : (
                        <motion.span key="n" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                          <Copy className="h-4 w-4" /> Copiar resposta
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                </div>
              ) : (
                <p className="mt-4 text-[12px] text-white/40">Perfil só de leitura — não pode gerar nem publicar respostas.</p>
              )}

              <AnimatePresence>
                {handoff && canWrite && !publishAvailable && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -6 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 rounded-2xl border border-violet-400/25 bg-[linear-gradient(135deg,rgba(79,70,229,0.12),rgba(168,85,247,0.06))] p-4">
                      <ol className="space-y-2.5 text-[13px] text-white/75">
                        {[
                          "Copiámos a resposta.",
                          "No separador que abriu, com a conta que gere o perfil, carregue em «Responder».",
                          "Cole (⌘V / Ctrl+V) e publique.",
                        ].map((step, i) => (
                          <motion.li
                            key={step}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 + i * 0.12 }}
                            className="flex items-start gap-3"
                          >
                            <span
                              className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                                i === 0 ? "bg-emerald-400/20 text-emerald-300" : "bg-violet-400/20 text-violet-200"
                              }`}
                            >
                              {i === 0 ? <Check className="h-3 w-3" /> : i + 1}
                            </span>
                            {step}
                          </motion.li>
                        ))}
                      </ol>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <motion.button
                          onClick={() => void markReplied()}
                          disabled={marking}
                          whileTap={{ scale: 0.97 }}
                          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_30px_-12px_rgba(52,211,153,0.8)] disabled:opacity-70"
                        >
                          {marking ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
                          Já publiquei no Google
                        </motion.button>
                        <button
                          onClick={copyAndOpen}
                          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-[12px] font-medium text-white/55 transition hover:text-white"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Abrir outra vez
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {canWrite && (text || review.reply) && !streaming && (
                <div className="mt-3 flex items-center justify-between text-[12px]">
                  <AnimatePresence>
                    {armed && (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-amber-200/80">
                        A resposta fica pública no perfil do salão.
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <button
                    onClick={() => void discard()}
                    className="ml-auto inline-flex items-center gap-1.5 text-white/35 transition hover:text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> {review.reply ? "Cancelar" : "Descartar rascunho"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Publicada! */}
      <AnimatePresence>
        {celebrate !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#07080d]/85 backdrop-blur-md"
          >
            <div className="relative flex h-28 w-28 items-center justify-center">
              {Array.from({ length: 14 }).map((_, i) => {
                const a = (i / 14) * Math.PI * 2;
                return (
                  <motion.span
                    key={i}
                    className="absolute h-2 w-2 rounded-full"
                    style={{ background: ["#a78bfa", "#34d399", "#fbbf24", "#f472b6"][i % 4] }}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    animate={{ x: Math.cos(a) * 90, y: Math.sin(a) * 90, opacity: 0, scale: 0.4 }}
                    transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
                  />
                );
              })}
              <motion.span
                className="absolute inset-0 rounded-full border-2 border-emerald-400/60"
                initial={{ scale: 0.4, opacity: 1 }}
                animate={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 0.9 }}
              />
              <motion.span
                initial={{ scale: 0, rotate: -120 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 14 }}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shadow-[0_0_60px_rgba(52,211,153,0.5)]"
              >
                <Check className="h-10 w-10 text-white" strokeWidth={3} />
              </motion.span>
            </div>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mt-5 text-lg font-semibold text-white"
            >
              {celebrate === "marked" ? "Respondida" : "Publicada no Google"}
            </motion.p>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="text-[13px] text-white/50">
              {celebrate === "marked"
                ? "A próxima sincronização confirma a resposta no Google."
                : `${review.author} já pode ver a resposta.`}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  busy,
  armed,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  armed?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || busy}
      whileHover={{ scale: disabled ? 1 : 1.012 }}
      whileTap={{ scale: 0.98 }}
      animate={armed ? { boxShadow: ["0 0 0 0 rgba(251,191,36,0.0)", "0 0 0 6px rgba(251,191,36,0.18)", "0 0 0 0 rgba(251,191,36,0.0)"] } : {}}
      transition={armed ? { duration: 1.4, repeat: Infinity } : undefined}
      className="relative flex h-[52px] items-center justify-center gap-2.5 overflow-hidden rounded-2xl px-5 text-[15px] font-semibold text-white shadow-[0_16px_40px_-18px_rgba(120,61,245,0.95)] transition disabled:cursor-wait disabled:opacity-80"
      style={{
        background: armed
          ? "linear-gradient(135deg,#d97706,#f59e0b)"
          : "linear-gradient(135deg,#4f46e5 0%,#7c3aed 55%,#a855f7 100%)",
      }}
    >
      {busy && (
        <motion.span
          className="absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.22)_50%,transparent_75%)]"
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 1.3, repeat: Infinity, ease: "linear" }}
        />
      )}
      <span className="relative flex items-center gap-2.5">{children}</span>
    </motion.button>
  );
}
