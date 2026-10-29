"use client";

// O painel lateral de um processo da Jornada de Cliente (v78.46) — abre à
// direita, como o das notificações, por cima da página. Sai para o <body> por
// portal (o header tem backdrop-blur e prenderia um `fixed` à caixa dele).

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Download, FileSpreadsheet, MessageCircleQuestion, X } from "lucide-react";
import type { JourneyGuide } from "@/lib/documentacao/jornada";

export function JourneyGuideDrawer({
  guide,
  where,
  onClose,
}: {
  guide: JourneyGuide | null;
  /** «Mês 2 · Semana 8» */
  where: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Escape fecha, e a página deixa de rolar por trás do painel.
  useEffect(() => {
    if (!guide) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [guide, onClose]);

  if (!guide || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="journey-guide-title">
      <button
        type="button"
        aria-label="Fechar o processo"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/55 backdrop-blur-[2px]"
      />
      <aside className="animate-drawer-in absolute inset-y-0 right-0 flex w-full max-w-[600px] flex-col border-l border-white/10 bg-[color:var(--background)] shadow-[-30px_0_80px_-30px_rgba(0,0,0,0.9)]">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-px"
          style={{ background: "linear-gradient(180deg, transparent, rgba(120,61,245,0.7), rgba(197,53,201,0.4), transparent)" }}
        />
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-6 py-5">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[#c4a6ff]">Processo · {where}</p>
            <h2 id="journey-guide-title" className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-[-0.015em] text-white">
              {guide.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg border border-white/10 p-1.5 text-white/50 transition hover:border-white/25 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
          <div className="space-y-3">
            <p className="text-[15px] leading-relaxed text-white/80">{guide.lead}</p>
            <p className="rounded-2xl border border-[#783DF5]/30 bg-[#783DF5]/[0.08] px-4 py-3 text-[14px] leading-relaxed text-white/75">
              <span className="font-semibold text-white">Porquê: </span>
              {guide.why}
            </p>
          </div>

          <section>
            <h3 className="flex items-center gap-2 text-[15px] font-semibold text-white">
              <MessageCircleQuestion className="h-4 w-4 text-[#c4a6ff]" />
              Perguntar ao cliente
            </h3>
            <ul className="mt-3 space-y-2">
              {guide.questions.map((q) => (
                <li key={q} className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-2.5 text-[14px] leading-relaxed text-white/75">
                  «{q}»
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-[15px] font-semibold text-white">Como se faz</h3>
            <ol className="mt-3 space-y-3">
              {guide.steps.map((s, i) => (
                <li key={s} className="flex gap-3 text-[14px] leading-relaxed text-white/70">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
                    style={{ background: ["#343ED7", "#783DF5", "#9b3ae0", "#C535C9"][i % 4] }}
                  >
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
          </section>

          {guide.image && (
            <figure>
              <h3 className="text-[15px] font-semibold text-white">Um exemplo</h3>
              {/* Fundo branco: a tabela é uma folha de Excel. Rola na
                  horizontal num ecrã estreito em vez de ficar ilegível. */}
              <div className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-white p-2">
                <Image
                  src={guide.image.src}
                  alt={guide.image.alt}
                  width={guide.image.width}
                  height={guide.image.height}
                  sizes="900px"
                  className="h-auto w-[900px] max-w-none sm:w-full sm:max-w-full"
                />
              </div>
              <figcaption className="mt-2 text-[12.5px] leading-relaxed text-white/45">{guide.image.caption}</figcaption>
            </figure>
          )}

          {guide.download && (
            <a
              href={guide.download.href}
              download
              className="group flex items-center gap-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.07] px-4 py-3.5 transition hover:border-emerald-300/45 hover:bg-emerald-500/[0.11]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20">
                <FileSpreadsheet className="h-5 w-5 text-emerald-200" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-white">{guide.download.label}</span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-white/55">{guide.download.note}</span>
              </span>
              <Download className="h-4 w-4 shrink-0 text-emerald-200/70 transition group-hover:translate-y-0.5 group-hover:text-emerald-100" />
            </a>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
