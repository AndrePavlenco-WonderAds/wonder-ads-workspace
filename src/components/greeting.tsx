"use client";

import { useEffect, useState } from "react";

/** Time-of-day greeting (PT-PT) typed out like a typewriter, using the
 *  VIEWER's local clock — Bom dia / Boa tarde / Boa noite. Renders on the
 *  client to read real local time; a blinking caret runs while it types. */
export function Greeting({ name }: { name: string }) {
  const [full, setFull] = useState("");
  const [shown, setShown] = useState("");

  // Compute the greeting once mounted (needs the viewer's local hour).
  useEffect(() => {
    const h = new Date().getHours();
    const g = h < 12 ? "Bom dia" : h < 19 ? "Boa tarde" : "Boa noite";
    setFull(`${g}, ${name}`);
  }, [name]);

  // Type it out, one character at a time.
  useEffect(() => {
    if (!full) return;
    setShown("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(full.slice(0, i));
      if (i >= full.length) clearInterval(id);
    }, 55);
    return () => clearInterval(id);
  }, [full]);

  const typing = shown.length < full.length;

  return (
    <span>
      {shown}
      <span
        aria-hidden
        className={`ml-0.5 inline-block w-[2px] -translate-y-[2px] self-center bg-current align-middle ${
          typing ? "animate-pulse" : "opacity-0"
        }`}
        style={{ height: "0.9em" }}
      />
    </span>
  );
}
