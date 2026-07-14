"use client";

// Typed intro for the public survey — reveals the line character by
// character (as if someone were writing it), then fades in a small
// "4-minute form" meta chip. Purely decorative; no data.

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

export function NpsIntro({
  text,
  minutesLabel,
}: {
  text: string;
  minutesLabel: string;
}) {
  const [shown, setShown] = useState(0);
  const done = shown >= text.length;

  useEffect(() => {
    if (done) return;
    // Ease the cadence a touch so it reads like typing, not a ticker.
    const id = setTimeout(() => setShown((n) => n + 1), 18);
    return () => clearTimeout(id);
  }, [shown, done]);

  return (
    <div className="mb-8">
      <p className="max-w-xl text-sm leading-relaxed text-black/60">
        {text.slice(0, shown)}
        <span
          aria-hidden
          className={`ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] bg-[#783DF5] ${
            done ? "animate-pulse" : ""
          }`}
        />
      </p>
      <div
        className={`mt-3 transition-all duration-500 ${
          done ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
        }`}
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/60 px-2.5 py-1 text-[11px] font-medium text-black/55">
          <Clock className="h-3 w-3 text-[#783DF5]" />
          {minutesLabel}
        </span>
      </div>
    </div>
  );
}
