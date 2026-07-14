"use client";

// Consultant-side controls on the NPS management page: copy the public
// survey link, log + compose a send to the client, and set the reminder
// cadence. All actions hit /api/nps/[slug]/send (auth-gated); copy is
// purely client-side.

import { useState } from "react";
import { Check, Link as LinkIcon, Loader2, Mail, Send } from "lucide-react";
import type { PublicLang } from "@/lib/public-i18n";

const MAIL = {
  pt: {
    subject: (c: string) => `Avaliação do serviço de SEO — ${c}`,
    body: (link: string) =>
      `Olá,\n\nGostaríamos de saber a sua opinião sobre o nosso serviço de SEO. É um formulário curto (cerca de 5 minutos) e o seu retorno ajuda-nos muito.\n\nBasta preencher aqui:\n${link}\n\nObrigado!\nEquipa Wonder Ads`,
  },
  en: {
    subject: (c: string) => `SEO service evaluation — ${c}`,
    body: (link: string) =>
      `Hi,\n\nWe'd love to hear your thoughts on our SEO service. It's a short form (about 5 minutes) and your feedback means a lot.\n\nJust fill it in here:\n${link}\n\nThank you!\nThe Wonder Ads team`,
  },
} as const;

export function NpsManagerActions({
  slug,
  surveyPath,
  clientName,
  cadenceDays,
  lang,
  readOnly,
}: {
  slug: string;
  surveyPath: string;
  clientName: string;
  cadenceDays: number;
  lang: PublicLang;
  readOnly: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent">(
    "idle",
  );
  const [cadence, setCadence] = useState(cadenceDays);
  const [savingCadence, setSavingCadence] = useState(false);

  function fullLink() {
    return typeof window !== "undefined"
      ? new URL(surveyPath, window.location.origin).toString()
      : surveyPath;
  }

  async function copy() {
    const url = fullLink();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  async function logSend() {
    setSendState("sending");
    try {
      await fetch(`/api/nps/${slug}/send`, { method: "POST" });
    } catch {
      // Non-fatal — the mailto still opens below.
    }
    setSendState("sent");
    setTimeout(() => setSendState("idle"), 4000);
  }

  async function sendToClient() {
    const link = fullLink();
    const m = MAIL[lang];
    // Log the send (sets next-due) then hand off to the mail client.
    await logSend();
    const href = `mailto:?subject=${encodeURIComponent(
      m.subject(clientName),
    )}&body=${encodeURIComponent(m.body(link))}`;
    if (typeof window !== "undefined") window.location.href = href;
  }

  async function changeCadence(days: number) {
    setCadence(days);
    setSavingCadence(true);
    try {
      await fetch(`/api/nps/${slug}/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "cadence", cadenceDays: days }),
      });
    } finally {
      setSavingCadence(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/85 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <LinkIcon className="h-3.5 w-3.5" />
        )}
        {copied ? "Copied" : "Copy link"}
      </button>

      {!readOnly && (
        <button
          type="button"
          onClick={sendToClient}
          disabled={sendState === "sending"}
          title="Log the send and open an email to the client with the survey link."
          className="inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-[11px] font-semibold text-white shadow-sm shadow-[#783DF5]/30 transition hover:brightness-110 disabled:opacity-50"
          style={{
            background:
              "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)",
          }}
        >
          {sendState === "sending" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : sendState === "sent" ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Mail className="h-3.5 w-3.5" />
          )}
          {sendState === "sent" ? "Send logged" : "Send to client"}
        </button>
      )}

      {!readOnly && (
        <button
          type="button"
          onClick={logSend}
          disabled={sendState === "sending"}
          title="Just record that you sent the link (e.g. via WhatsApp) without opening email."
          className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/70 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
        >
          <Send className="h-3.5 w-3.5" />
          Mark sent
        </button>
      )}

      {!readOnly && (
        <label className="inline-flex items-center gap-1.5 rounded-md border border-white/12 bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-white/55">
          A cada
          <select
            value={cadence}
            onChange={(e) => changeCadence(Number(e.target.value))}
            disabled={savingCadence}
            className="rounded bg-transparent text-[11px] font-medium text-white/85 outline-none [&>option]:bg-[#1B2430]"
          >
            <option value={30}>30 dias</option>
            <option value={60}>60 dias</option>
            <option value={90}>90 dias</option>
          </select>
        </label>
      )}
    </div>
  );
}
