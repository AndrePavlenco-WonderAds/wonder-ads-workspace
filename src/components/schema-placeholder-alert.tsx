"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import type { PlaceholderHit } from "@/lib/schema-placeholders";

/**
 * Warns the consultant that the JSON-LD below still carries placeholder or
 * empty values — BEFORE they copy it onto the client's site.
 *
 * Two surfaces on purpose (v76.72): a card above the result, plus a floating
 * pill that appears only once that card scrolls out of view. Schema blocks
 * are long, and the copy happens at the bottom of the block — a banner the
 * consultant scrolled past ten seconds ago doesn't stop a paste.
 */
export function SchemaPlaceholderAlert({ hits }: { hits: PlaceholderHit[] }) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardVisible, setCardVisible] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setCardVisible(entry.isIntersecting),
      { rootMargin: "-8px 0px 0px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (hits.length === 0) return null;

  const count = hits.length;
  const label = `${count} campo${count === 1 ? "" : "s"} por preencher`;

  return (
    <>
      <div
        ref={cardRef}
        className="animate-fade-up rounded-2xl border border-amber-400/35 bg-amber-400/[0.08] p-4"
      >
        <header className="flex items-center gap-2.5">
          <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-amber-300" />
          <h2 className="text-sm font-semibold tracking-tight text-amber-100">
            Não copies ainda — {label}
          </h2>
        </header>
        <p className="mt-2 text-[12.5px] leading-relaxed text-amber-100/80">
          O schema abaixo tem valores de exemplo ou vazios. Colados no site,
          ficam a valer como dados reais — o Google lê-os tal como estão.
          Substitui-os pelos dados verdadeiros do cliente (ou apaga a
          propriedade) antes de entregar.
        </p>
        <ul className="mt-3 space-y-1.5">
          {hits.map((hit, i) => (
            <li
              key={`${hit.property}-${hit.value}-${i}`}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg bg-black/20 px-3 py-1.5 text-[12px]"
            >
              <code className="font-mono font-semibold text-amber-200">
                {hit.property}
              </code>
              <span className="font-mono text-amber-100/85">“{hit.value}”</span>
              <span className="text-amber-100/50">— {hit.reason}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Floating reminder — portalled to <body> because PageShell's blurred
          chrome would otherwise become the containing block for a fixed
          child and pin it to the wrong box. */}
      {mounted &&
        !dismissed &&
        !cardVisible &&
        createPortal(
          <div className="fixed bottom-5 right-5 z-50 flex max-w-[320px] items-start gap-2.5 rounded-xl border border-amber-400/40 bg-[#2a1f05]/95 px-3.5 py-3 text-[12px] text-amber-100 shadow-xl shadow-black/40 backdrop-blur-md">
            <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-amber-300" />
            <div className="flex-1">
              <button
                onClick={() =>
                  cardRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  })
                }
                className="text-left font-semibold underline-offset-2 hover:underline"
              >
                {label}
              </button>
              <p className="mt-0.5 text-amber-100/70">
                Substitui os valores de exemplo antes de colar no site.
              </p>
            </div>
            <button
              onClick={() => setDismissed(true)}
              aria-label="Dispensar aviso"
              className="-mr-1 -mt-1 rounded p-1 text-amber-100/50 transition hover:bg-white/10 hover:text-amber-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
