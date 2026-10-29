"use client";

// «Sugerir à direção» — o fim de cada página de Protocolos (v78.51). Quem lê
// escreve uma sugestão sobre a lista; vai direta para o sino da direção. A
// direção vê aqui, por baixo, as que já chegaram sobre esta lista.

import { useState } from "react";
import { Check, Lightbulb, Loader2, Send } from "lucide-react";
import { formatDateTime } from "@/lib/dates";
import { MAX_SUGGESTION_CHARS } from "@/lib/documentacao/protocolos";

export type SuggestionView = { id: string; name: string; text: string; at: number };

export function ProtocolSuggest({
  doc,
  canSend,
  received,
}: {
  /** «protocolos-obrigatorios» | «protocolos-recomendados» | «protocolos-proibidos» */
  doc: string;
  /** false com «Ver como»: a sugestão ficava assinada por outra pessoa. */
  canSend: boolean;
  /** Só para a direção: as sugestões que já chegaram sobre esta lista. */
  received: SuggestionView[] | null;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/documentacao/${doc}/sugestao`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Não foi possível enviar a sugestão.");
      setText("");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={send} className="rounded-[24px] border border-white/10 bg-white/[0.025] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#783DF5]/20">
            <Lightbulb className="h-4.5 w-4.5 text-[#c4a6ff]" />
          </span>
          <p className="text-[14px] leading-relaxed text-white/60">
            Falta um protocolo, há um que já não faz sentido, ou tens uma ideia para esta lista? Escreve aqui: vai direto
            para a direção.
          </p>
        </div>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (sent) setSent(false);
          }}
          disabled={!canSend}
          rows={3}
          maxLength={MAX_SUGGESTION_CHARS}
          placeholder={canSend ? "A tua sugestão…" : "Com «Ver como» não se enviam sugestões."}
          aria-label="Sugestão à direção"
          className="mt-4 w-full resize-y rounded-xl border border-white/12 bg-[#0b0c18] px-3.5 py-2.5 text-[14px] leading-relaxed text-white placeholder:text-white/30 focus:border-[#a78bfa]/70 focus:outline-none disabled:opacity-50"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12.5px] text-white/40" aria-live="polite">
            {error ? (
              <span className="text-rose-300">{error}</span>
            ) : sent ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-300">
                <Check className="h-3.5 w-3.5" />
                Enviada. A direção recebeu a tua sugestão.
              </span>
            ) : (
              "A direção vê o teu nome com a sugestão."
            )}
          </p>
          <button
            type="submit"
            disabled={!canSend || sending || text.trim().length < 5}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "var(--brand-gradient)" }}
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Enviar sugestão
          </button>
        </div>
      </form>

      {received && (
        <div>
          <h3 className="text-[14px] font-semibold text-white">
            Sugestões recebidas <span className="font-normal text-white/40">· só a direção vê</span>
          </h3>
          {received.length === 0 ? (
            <p className="mt-2 text-[13px] text-white/45">Ainda não chegou nenhuma sugestão sobre esta lista.</p>
          ) : (
            <ul className="mt-3 divide-y divide-white/[0.07] border-y border-white/[0.07]">
              {received.map((s) => (
                <li key={s.id} className="py-3.5">
                  <p className="text-[12.5px] text-white/45">
                    <span className="font-medium text-white/80">{s.name}</span> · {formatDateTime(s.at)}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-[14px] leading-relaxed text-white/70">{s.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
