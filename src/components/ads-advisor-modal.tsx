"use client";

// Full-page chat with the ADS Advisor (a paid-media-specialist Claude
// agent). On open it auto-sends a hidden kickoff so the FIRST visible
// message is Claude's own diagnosis — the server grounds that reply in
// the client's last-30-days analytics + the whole Campaign Vault. After
// that the user chats freely for advice.

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Loader2, Sparkles, User, X, BarChart3 } from "lucide-react";

const KICKOFF =
  "Analisa as analytics dos últimos 30 dias e todo o Campaign Vault e dá-me o teu diagnóstico inicial: o que está a correr bem, o que está a falhar e as 3-5 prioridades de otimização.";

export function AdsAdvisorModal({
  slug,
  clientName,
  onClose,
}: {
  slug: string;
  clientName: string;
  onClose: () => void;
}) {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: `/api/ads/${slug}/advisor` }),
    [slug],
  );
  const { messages, sendMessage, status, error } = useChat({
    transport,
    onError: (err) => console.error("ADS Advisor error:", err),
  });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const kickedOff = useRef(false);

  // Fire the analysis kickoff once on open.
  useEffect(() => {
    if (kickedOff.current) return;
    kickedOff.current = true;
    sendMessage({ text: KICKOFF });
  }, [sendMessage]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const isLoading = status === "submitted" || status === "streaming";
  const trimmed = input.trim();

  // Hide the kickoff user bubble so Claude appears to start the chat.
  const visible = messages.filter((m) => {
    if (m.role !== "user") return true;
    const text = m.parts
      .map((p) => (p.type === "text" ? p.text : ""))
      .join("");
    return text.trim() !== KICKOFF;
  });
  const waitingFirst =
    visible.every((m) => m.role === "user") && isLoading;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed || isLoading) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  const body = (
    <div className="fixed inset-0 z-[100] flex items-stretch justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        className="animate-fade-up flex h-full w-full max-w-3xl flex-col overflow-hidden border border-white/10 bg-[#0a0a0f] shadow-2xl shadow-black/70 sm:h-[88vh] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={`ADS Advisor — ${clientName}`}
      >
        <header className="flex items-center gap-3 border-b border-white/8 bg-black/40 px-5 py-4">
          <span className="brand-gradient-bg flex h-9 w-9 items-center justify-center rounded-lg shadow-[0_6px_24px_-4px_rgba(120,61,245,0.6)]">
            <Sparkles className="h-4 w-4 text-white" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-white">
              ADS Advisor · {clientName}
            </h2>
            <p className="text-[11px] text-white/45">
              Especialista em Google Ads &amp; Meta Ads · analisa analytics +
              Campaign Vault
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:border-white/30 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 [scrollbar-width:thin]">
          {waitingFirst && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <span className="brand-gradient-bg flex h-12 w-12 items-center justify-center rounded-2xl">
                <BarChart3 className="h-6 w-6 text-white" />
              </span>
              <p className="inline-flex items-center gap-2 text-sm text-white/60">
                <Loader2 className="h-4 w-4 animate-spin" />
                A analisar analytics dos últimos 30 dias e o Campaign Vault…
              </p>
            </div>
          )}

          <ul className="space-y-4">
            {visible.map((m) => (
              <li
                key={m.id}
                className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  aria-hidden
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    m.role === "user" ? "bg-white/10" : "brand-gradient-bg"
                  }`}
                >
                  {m.role === "user" ? (
                    <User className="h-3.5 w-3.5 text-white/80" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  )}
                </div>
                <div
                  className={`max-w-[82%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-white/[0.06] text-white"
                      : "border border-white/5 bg-white/[0.025] text-white/85"
                  }`}
                >
                  {m.parts.map((part, i) =>
                    part.type === "text" ? (
                      <span key={i} className="whitespace-pre-wrap">
                        {part.text}
                      </span>
                    ) : null,
                  )}
                </div>
              </li>
            ))}
          </ul>

          {error && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              Algo correu mal. Confirma que <code>ANTHROPIC_API_KEY</code> está
              definido no ambiente.
            </div>
          )}
        </div>

        <form onSubmit={submit} className="border-t border-white/8 bg-white/[0.02] px-3 py-3">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(e as unknown as React.FormEvent);
                }
              }}
              placeholder="Pergunta ao ADS Advisor — otimizações, budgets, criativos, segmentação…"
              rows={1}
              className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-white/25 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!trimmed || isLoading}
              className="brand-gradient-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-[0_6px_24px_-4px_rgba(120,61,245,0.6)] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100"
              aria-label="Enviar"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
