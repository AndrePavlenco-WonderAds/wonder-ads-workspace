"use client";

// Botão «Copiar» para os modelos da Documentação (v80.7 — o template de
// pedido à direção do SOP de Comunicação), para se colar no WhatsApp tal e
// qual.

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyTextButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 1800);
        } catch {
          /* sem permissão para a área de transferência: fica o texto à vista */
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-white/75 transition hover:border-white/30 hover:text-white"
    >
      {done ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? "Copiado" : label}
    </button>
  );
}
