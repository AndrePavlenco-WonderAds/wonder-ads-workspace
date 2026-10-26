"use client";

// Barra de secções colada ao topo, com a secção visível acesa. Substitui o
// índice lateral: funciona em qualquer largura e diz sempre onde estás.

import { useEffect, useRef, useState } from "react";

export function SectionNav({ items }: { items: Array<{ id: string; label: string }> }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const targets = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (targets.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // A faixa «ativa» é o terço de cima do ecrã, por baixo das barras.
      { rootMargin: "-160px 0px -60% 0px", threshold: 0 },
    );
    targets.forEach((t) => obs.observe(t));
    return () => obs.disconnect();
  }, [items]);

  // Mantém o separador ativo à vista quando a barra rola na horizontal.
  useEffect(() => {
    const el = barRef.current?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  return (
    <div className="sticky top-[72px] z-20 -mx-6 mt-8 border-b border-white/[0.06] bg-[color:var(--background)]/80 px-6 backdrop-blur-md sm:top-[81px] sm:-mx-10 sm:px-10">
      <div ref={barRef} className="flex gap-1 overflow-x-auto py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((it) => {
          const on = it.id === active;
          return (
            <a
              key={it.id}
              href={`#${it.id}`}
              data-id={it.id}
              aria-current={on ? "true" : undefined}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5] ${
                on ? "bg-white/[0.1] font-medium text-white" : "text-white/50 hover:text-white/85"
              }`}
            >
              {it.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}
