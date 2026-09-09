"use client";

import { useEffect, useId, useState } from "react";

export function TypewriterPrompt({
  text,
  startDelay = 450,
  charSpeed = 55,
}: {
  text: string;
  startDelay?: number;
  charSpeed?: number;
}) {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    if (visible >= text.length) return;
    const id = window.setTimeout(
      () => setVisible((v) => v + 1),
      visible === 0 ? startDelay : charSpeed,
    );
    return () => window.clearTimeout(id);
  }, [visible, text.length, startDelay, charSpeed]);

  const done = visible >= text.length;

  return (
    <p
      aria-label={text}
      className="flex items-center gap-3 text-base font-medium text-white/80 sm:text-lg"
    >
      <AiMascot />
      <span className="inline-block min-h-[1.2em] leading-snug">
        <span aria-hidden>{text.slice(0, visible)}</span>
        <span
          aria-hidden
          className={`typewriter-caret ml-[1px] inline-block h-[1.05em] w-[2px] translate-y-[2px] rounded-[1px] align-middle ${
            done ? "animate-caret-blink" : ""
          }`}
          style={{ background: "var(--brand-gradient)" }}
        />
      </span>
    </p>
  );
}

/** O boneco AI que acena (v77.17): cabeça com o gradiente da marca, olhos
 *  que pestanejam, antena acesa e um braço a acenar em loop. SVG puro —
 *  sem gif, sem ficheiro extra, escala em qualquer ecrã. */
function AiMascot() {
  const gid = `ai-mascot-${useId().replace(/:/g, "")}`;
  return (
    <span
      aria-hidden
      className="ai-mascot relative inline-flex h-10 w-10 shrink-0 items-center justify-center"
    >
      <svg viewBox="0 0 48 48" className="h-10 w-10 overflow-visible">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5C6FFF" />
            <stop offset="55%" stopColor="#783DF5" />
            <stop offset="100%" stopColor="#C535C9" />
          </linearGradient>
        </defs>
        {/* antena */}
        <line
          x1="24"
          y1="6"
          x2="24"
          y2="11"
          stroke={`url(#${gid})`}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="24" cy="5" r="2.6" fill="#FF6FB6" className="ai-mascot-antenna" />
        {/* cabeça */}
        <rect x="9" y="11" width="30" height="23" rx="9" fill={`url(#${gid})`} />
        {/* visor */}
        <rect x="13.5" y="15.5" width="21" height="14" rx="6" fill="#0b0b12" opacity="0.88" />
        {/* olhos */}
        <g className="ai-mascot-eyes">
          <circle cx="19.5" cy="22" r="2.4" fill="#fff" />
          <circle cx="28.5" cy="22" r="2.4" fill="#fff" />
        </g>
        {/* sorriso */}
        <path
          d="M20 26.6 Q24 29.4 28 26.6"
          stroke="#fff"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
          opacity="0.9"
        />
        {/* corpo */}
        <rect x="15" y="35" width="18" height="10" rx="5" fill={`url(#${gid})`} opacity="0.85" />
        {/* braço esquerdo, quieto */}
        <line
          x1="14"
          y1="38"
          x2="9"
          y2="42"
          stroke={`url(#${gid})`}
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.85"
        />
        {/* braço direito — acena a partir do ombro (34, 37) */}
        <g className="ai-mascot-arm">
          <line
            x1="34"
            y1="37"
            x2="41"
            y2="29"
            stroke={`url(#${gid})`}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle cx="42.5" cy="27.2" r="3.4" fill="#fff" />
        </g>
      </svg>
    </span>
  );
}
