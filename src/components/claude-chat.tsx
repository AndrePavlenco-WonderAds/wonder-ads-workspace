"use client";

import { useChat } from "@ai-sdk/react";
import { ArrowUp, Bot, Loader2, Sparkles, User } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export function ClaudeChat({
  department = "seo",
  placeholder = "Ask SEO Claude anything — strategy, audits, content briefs...",
}: {
  department?: string;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat({
    onError: (err) => console.error("Chat error:", err),
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const isLoading = status === "submitted" || status === "streaming";
  const trimmed = input.trim();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed || isLoading) return;
    sendMessage(
      { text: trimmed },
      { body: { department } },
    );
    setInput("");
  }

  return (
    <section
      aria-label="Claude chat"
      className="brand-gradient-border relative flex h-[520px] flex-col overflow-hidden rounded-2xl bg-white/[0.035] backdrop-blur-md"
    >
      <header className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
        <div
          aria-hidden
          className="brand-gradient-bg flex h-9 w-9 items-center justify-center rounded-lg shadow-[0_6px_24px_-4px_rgba(120,61,245,0.6)]"
        >
          <Sparkles className="h-4 w-4 text-white" strokeWidth={2.25} />
        </div>
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-white">
            SEO Claude
          </h3>
          <p className="text-xs text-white/45">
            In-house assistant · streams in real time
          </p>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-4 [scrollbar-width:thin]"
      >
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div
              aria-hidden
              className="brand-gradient-bg flex h-12 w-12 items-center justify-center rounded-2xl opacity-80"
            >
              <Bot className="h-6 w-6 text-white" />
            </div>
            <p className="mt-4 max-w-sm text-sm text-white/55">
              Hi — I&apos;m here for SEO questions. Audits, keyword strategy,
              content briefs, technical fixes. Try asking anything.
            </p>
          </div>
        )}

        <ul className="space-y-4">
          {messages.map((message) => (
            <li
              key={message.id}
              className={`flex gap-3 ${
                message.role === "user" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              <div
                aria-hidden
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  message.role === "user"
                    ? "bg-white/10"
                    : "brand-gradient-bg"
                }`}
              >
                {message.role === "user" ? (
                  <User className="h-3.5 w-3.5 text-white/80" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                )}
              </div>
              <div
                className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "bg-white/[0.06] text-white"
                    : "border border-white/5 bg-white/[0.025] text-white/85"
                }`}
              >
                {message.parts.map((part, i) => {
                  if (part.type === "text") {
                    return (
                      <span key={i} className="whitespace-pre-wrap">
                        {part.text}
                      </span>
                    );
                  }
                  return null;
                })}
              </div>
            </li>
          ))}
        </ul>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            Something went wrong. Make sure <code>AI_GATEWAY_API_KEY</code> is
            set, or check the API route logs.
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-white/5 bg-white/[0.02] px-3 py-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
              }
            }}
            placeholder={placeholder}
            rows={1}
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-white/25 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!trimmed || isLoading}
            className="brand-gradient-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-[0_6px_24px_-4px_rgba(120,61,245,0.6)] transition-all duration-300 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100"
            aria-label="Send"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
