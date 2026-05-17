"use client";

import { useEffect } from "react";

/** Tiny client helper that fires window.print() once the printable
 *  document has laid out + images have a chance to load. Lives in its
 *  own file so the surrounding PrintLayout can stay a Server Component
 *  and be returned directly from page.tsx without any client roundtrip. */
export function AutoPrint() {
  useEffect(() => {
    // Wait for images (logo, astronaut) to actually load — otherwise Chrome
    // prints with missing imagery.
    const ready = () =>
      new Promise<void>((resolve) => {
        const imgs = Array.from(document.images);
        if (imgs.every((i) => i.complete)) return resolve();
        let remaining = imgs.length;
        imgs.forEach((img) => {
          if (img.complete) {
            if (--remaining === 0) resolve();
          } else {
            img.addEventListener("load", () => {
              if (--remaining === 0) resolve();
            });
            img.addEventListener("error", () => {
              if (--remaining === 0) resolve();
            });
          }
        });
        // Safety: never block forever.
        setTimeout(resolve, 3000);
      });
    let cancelled = false;
    ready().then(() => {
      if (cancelled) return;
      // One more rAF so layout is fully committed.
      requestAnimationFrame(() => {
        if (!cancelled) window.print();
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
