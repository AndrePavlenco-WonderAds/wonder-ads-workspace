"use client";

import { useEffect, useState } from "react";

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
      className="text-base font-medium text-white/80 sm:text-lg"
    >
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
