"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Mostra um filho de largura fixa encolhido para caber no contentor (nunca
 *  maior do que o natural). `zoom` e não `transform`: o zoom conta para o
 *  layout, por isso a altura acompanha sem contas à mão. */
export function FitToWidth({ width, children }: { width: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setZoom(Math.min(1, el.clientWidth / width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={ref} className="w-full">
      <div style={{ zoom, width }}>{children}</div>
    </div>
  );
}
