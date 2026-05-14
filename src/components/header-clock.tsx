"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}

/** Live local-time clock for the header (with milliseconds). On project pages
 *  it also shows a "Working on this for" timer that counts up from the moment
 *  the page was opened. */
export function HeaderClock({
  sessionTimer = false,
}: {
  sessionTimer?: boolean;
}) {
  const [now, setNow] = useState<Date | null>(null);
  const startRef = useRef<number>(Date.now());
  const pathname = usePathname();

  // Reset the "working on this for" timer whenever the route changes.
  useEffect(() => {
    startRef.current = Date.now();
  }, [pathname]);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 50);
    return () => window.clearInterval(id);
  }, []);

  // Render a same-size placeholder until mounted to avoid hydration mismatch.
  if (!now) {
    return <div className={sessionTimer ? "h-9" : "h-4"} aria-hidden />;
  }

  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  const ms = pad(now.getMilliseconds(), 3);

  const totalMin = Math.floor((now.getTime() - startRef.current) / 60_000);
  const wh = pad(Math.floor(totalMin / 60));
  const wm = pad(totalMin % 60);

  return (
    <div className="flex flex-col items-end gap-1 font-mono">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.22em] text-white/35">
          Local
        </span>
        <span aria-hidden className="brand-gradient-bg h-px w-4" />
        <span className="text-sm tabular-nums text-white/85">
          {hh}:{mm}:{ss}
          <span className="brand-gradient-text">.{ms}</span>
        </span>
      </div>
      {sessionTimer && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.22em] text-white/30">
            Working on this for
          </span>
          <span aria-hidden className="h-px w-4 bg-white/20" />
          <span className="text-sm tabular-nums text-white/70">
            {wh}:{wm}
          </span>
        </div>
      )}
    </div>
  );
}
