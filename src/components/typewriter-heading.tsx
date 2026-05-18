"use client";

import { useEffect, useState } from "react";

/** Typewriter heading used on the department chooser landing. Types the
 *  prefix as plain text, then types the highlight word in the brand
 *  gradient. A blinking caret stays visible at the cursor while typing,
 *  then slows to a gentle blink at the end. The original layout (one
 *  line, large display heading) is preserved — only the text is
 *  progressively revealed.
 *
 *  Respects prefers-reduced-motion: when set, renders the full text
 *  immediately without animating.
 */
export function TypewriterHeading({
  prefix,
  highlight,
  typingMs = 70,
}: {
  prefix: string;
  highlight: string;
  /** Per-character delay in ms. Default 70ms feels natural without being
   *  sluggish. */
  typingMs?: number;
}) {
  const full = prefix + highlight;
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq =
      typeof window !== "undefined"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    if (mq?.matches) {
      setReduceMotion(true);
      setCount(full.length);
      setDone(true);
      return;
    }
    let i = 0;
    const tick = () => {
      i += 1;
      setCount(i);
      if (i >= full.length) {
        setDone(true);
        return;
      }
      timer = window.setTimeout(tick, typingMs);
    };
    let timer = window.setTimeout(tick, typingMs);
    return () => window.clearTimeout(timer);
  }, [full, typingMs]);

  const prefixShown = full.slice(0, Math.min(count, prefix.length));
  const highlightShown =
    count > prefix.length ? full.slice(prefix.length, count) : "";

  if (reduceMotion) {
    return (
      <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
        {prefix}
        <span className="brand-gradient-text">{highlight}</span>
      </h1>
    );
  }

  return (
    <h1
      className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl"
      aria-label={full}
    >
      <span aria-hidden>{prefixShown}</span>
      <span aria-hidden className="brand-gradient-text">
        {highlightShown}
      </span>
      <span
        aria-hidden
        className={
          done
            ? "animate-caret-blink ml-1 inline-block h-[0.9em] w-[3px] translate-y-[0.12em] rounded-sm bg-[color:var(--brand-purple)] align-baseline"
            : "ml-1 inline-block h-[0.9em] w-[3px] translate-y-[0.12em] rounded-sm bg-[color:var(--brand-purple)] align-baseline"
        }
      />
    </h1>
  );
}
