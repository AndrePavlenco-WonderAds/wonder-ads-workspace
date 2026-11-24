"use client";

// Vídeo de apresentação de uma página da Documentação (v80.44). Pedido do
// André: quem chega à app e vai ler a Documentação tem a versão em vídeo logo
// no topo, para ser mais prático. O cartão fica no DocHero (lado direito; em
// telemóvel, por baixo do título) e abre o vídeo por cima da página, sem sair
// dela. Os capítulos que o vídeo cobre ficam no rodapé: um clique fecha o
// vídeo e abre o capítulo (os links «#id» trocam de capítulo no SopChapters).
//
// `#video` no endereço abre-o logo (para partilhar o link direto).

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Play, X } from "lucide-react";

export type DocVideo = {
  /** O id do YouTube («34zwzH6nZ6Q»). */
  youtubeId: string;
  title: string;
  /** O que o vídeo cobre, numa linha («Objetivo e capítulos 1 a 4»). */
  covers: string;
  /** A imagem do cartão (a capa da página). */
  poster: string;
  /** Os capítulos do vídeo, para saltar para a leitura depois. */
  chapters?: Array<{ label: string; href: string }>;
};

export function DocVideoButton({ video }: { video: DocVideo }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
    if (window.location.hash === "#video") setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    if (window.location.hash === "#video") {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    openerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const src = `https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-3.5 rounded-2xl border border-[#783DF5]/35 bg-[#783DF5]/[0.08] p-2 text-left transition hover:border-[#c4a6ff]/60 hover:bg-[#783DF5]/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5] sm:w-[300px] sm:flex-col sm:items-stretch sm:gap-0 sm:p-0"
      >
        <span className="relative block aspect-video w-32 shrink-0 overflow-hidden rounded-xl sm:w-full sm:rounded-b-none sm:rounded-t-[15px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={video.poster}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-75 transition duration-500 group-hover:scale-[1.04] group-hover:opacity-90"
          />
          <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#0c0a18]/80 via-transparent to-transparent" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#783DF5] shadow-[0_10px_30px_-8px_rgba(120,61,245,0.9)] transition group-hover:scale-110 sm:h-14 sm:w-14">
              <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-white/40 [animation-duration:2.4s]" />
              <Play className="relative ml-0.5 h-4 w-4 fill-current sm:h-6 sm:w-6" />
            </span>
          </span>
          <span className="absolute left-2 top-2 hidden rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white/90 sm:inline-block">
            Formação em vídeo
          </span>
        </span>
        <span className="min-w-0 sm:px-4 sm:py-3">
          <span className="block text-[14.5px] font-semibold leading-snug text-white">Ver o vídeo de apresentação</span>
          <span className="mt-0.5 block text-[12.5px] leading-snug text-[#c4a6ff]">{video.covers}</span>
        </span>
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={video.title}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-3 sm:p-6"
            onClick={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-[#0c0a18] shadow-2xl">
              <div className="flex items-start justify-between gap-4 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-[#c4a6ff]">Formação em vídeo · {video.covers}</p>
                  <p className="mt-0.5 truncate text-[15px] font-semibold text-white">{video.title}</p>
                </div>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={close}
                  aria-label="Fechar o vídeo"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/[0.12] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="relative aspect-video w-full bg-black">
                <iframe
                  src={src}
                  title={video.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                {video.chapters && video.chapters.length > 0 ? (
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-[12px] text-white/40">Depois, lê:</span>
                    {video.chapters.map((c) => (
                      <a
                        key={c.href}
                        href={c.href}
                        onClick={(e) => {
                          // Fechar o modal tira o link do DOM antes da
                          // navegação por defeito — muda-se o hash à mão.
                          e.preventDefault();
                          setOpen(false);
                          window.location.hash = c.href;
                        }}
                        className="rounded-full border border-[#783DF5]/30 bg-[#783DF5]/[0.1] px-2.5 py-1 text-[12px] font-medium text-white/80 transition hover:border-[#c4a6ff]/60 hover:text-white"
                      >
                        {c.label}
                      </a>
                    ))}
                  </div>
                ) : (
                  <span />
                )}
                <a
                  href={`https://youtu.be/${video.youtubeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12px] text-white/45 transition hover:text-white"
                >
                  Abrir no YouTube <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
