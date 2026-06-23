"use client";

// Admin-only "Enviar para o Slack" button shown on a changelog entry.
// Posts that version's release notes to the announcements channel via
// the workspace Slack bot (webhook).

import { useCallback, useState } from "react";
import { Check, Loader2, Send } from "lucide-react";

export function ChangelogSlackButton({ version }: { version: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [msg, setMsg] = useState<string | null>(null);

  const send = useCallback(async () => {
    setState("sending");
    setMsg(null);
    try {
      const res = await fetch("/api/changelog/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falhou o envio.");
      setState("sent");
      setTimeout(() => setState("idle"), 4000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Falhou o envio.");
      setState("error");
      setTimeout(() => setState("idle"), 5000);
    }
  }, [version]);

  return (
    <span className="ml-auto inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={send}
        disabled={state === "sending" || state === "sent"}
        title="Publicar estas notas no canal do Slack via o bot do workspace"
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition disabled:opacity-60 ${
          state === "sent"
            ? "border-emerald-400/45 bg-emerald-500/15 text-emerald-100"
            : state === "error"
              ? "border-rose-400/45 bg-rose-500/15 text-rose-100"
              : "border-white/15 bg-white/[0.05] text-white/80 hover:border-white/35 hover:text-white"
        }`}
      >
        {state === "sending" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : state === "sent" ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
        {state === "sending"
          ? "A enviar…"
          : state === "sent"
            ? "Enviado!"
            : state === "error"
              ? "Falhou"
              : "Enviar para o Slack"}
      </button>
      {state === "error" && msg && (
        <span className="max-w-[240px] text-right text-[10px] text-rose-300">
          {msg}
        </span>
      )}
    </span>
  );
}
