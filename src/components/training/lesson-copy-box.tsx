"use client";

// Copy box da aula — o prompt (ou outro texto) que o vídeo manda usar, com
// botão «Copiar». Vive por baixo do vídeo, a seguir aos anexos: quem vê a aula
// descarrega os exemplos, copia o prompt e cola tudo no Claude.

import { useState } from "react";
import { Check, Copy, TerminalSquare } from "lucide-react";
import type { TrainingCopyBox } from "@/lib/training/catalog";

function CopyBox({ box }: { box: TrainingCopyBox }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(box.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* sem permissão de clipboard — o texto continua selecionável */
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.018]">
      <header className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#783DF5]/30 bg-[#783DF5]/10 text-[#c3aaff]">
          <TerminalSquare className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="readout text-white/40">Copy box</p>
          <p className="truncate text-[11.5px] text-white/60">{box.label}</p>
        </div>
        <button
          type="button"
          onClick={copy}
          aria-live="polite"
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-semibold transition ${
            copied
              ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30"
              : "brand-gradient-bg text-white hover:brightness-110"
          }`}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </header>
      <pre className="whitespace-pre-wrap break-words px-4 py-4 font-sans text-[13px] leading-relaxed text-white/70 selection:bg-[#783DF5]/40">
        {box.text}
      </pre>
    </section>
  );
}

export function LessonCopyBoxes({ boxes }: { boxes: TrainingCopyBox[] }) {
  if (boxes.length === 0) return null;
  return (
    <>
      {boxes.map((b, i) => (
        <CopyBox key={i} box={b} />
      ))}
    </>
  );
}
