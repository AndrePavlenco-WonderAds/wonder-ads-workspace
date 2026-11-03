"use client";

// Peças comuns da Origem de Pacientes: o logótipo do cliente numa placa
// branca, o fundo com as duas marcas, os ícones das origens e o número que
// sobe quando há um registo novo.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  ArrowUpRight,
  DoorOpen,
  Globe,
  HeartHandshake,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Search,
  Share2,
  Sparkles,
  Stethoscope,
  Store,
  type LucideIcon,
} from "lucide-react";

export const SOURCE_ICONS: Record<string, LucideIcon> = {
  google: Search,
  ia: Sparkles,
  redes: Share2,
  recomendacao: HeartHandshake,
  medico: Stethoscope,
  porta: DoorOpen,
  outro: MoreHorizontal,
};

export const CHANNEL_ICONS: Record<string, LucideIcon> = {
  telefone: Phone,
  whatsapp: MessageCircle,
  balcao: Store,
  online: Globe,
};

export const WA_GRADIENT = "linear-gradient(135deg,#343ed7 0%,#783df5 55%,#c535c9 100%)";

/** Cor com transparência (#RRGGBB → rgba). */
export function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export function LogoPlate({ logo, brand, size = "md" }: { logo: string | null; brand: string; size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-24 w-56 p-5 rounded-3xl" : "h-10 w-[104px] px-2.5 py-1.5 rounded-xl sm:h-11 sm:w-[120px]";
  return (
    <div className={`relative flex shrink-0 items-center justify-center bg-white shadow-[0_10px_40px_-14px_rgba(110,193,214,0.55)] ${box}`}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={brand} className="max-h-full max-w-full object-contain" />
      ) : (
        <span className="text-sm font-semibold text-slate-800">{brand}</span>
      )}
    </div>
  );
}

/** O fundo: um brilho azul MyMedic à esquerda e o violeta WonderAds à direita. */
export function BrandBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#07080d]">
      <div className="absolute -left-40 -top-48 h-[520px] w-[620px] rounded-full bg-[radial-gradient(closest-side,rgba(110,193,214,0.16),transparent)]" />
      <div className="absolute -right-40 -top-40 h-[520px] w-[640px] rounded-full bg-[radial-gradient(closest-side,rgba(120,61,245,0.18),transparent)]" />
      <div className="absolute bottom-[-260px] left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(201,210,43,0.05),transparent)]" />
      <svg className="absolute right-0 top-0 h-[420px] w-[min(760px,100%)] opacity-60" viewBox="0 0 760 420" preserveAspectRatio="none" fill="none">
        <path d="M760 40C640 120 560 240 520 420" stroke="rgba(176,130,240,.10)" />
        <path d="M760 110C670 180 610 290 590 420" stroke="rgba(176,130,240,.08)" />
        <path d="M700 0C600 90 470 230 430 420" stroke="rgba(110,193,214,.08)" />
      </svg>
    </div>
  );
}

export function MadeBy({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://wonder-ads.com"
      target="_blank"
      rel="noopener noreferrer"
      className={`group inline-flex items-center gap-1 text-xs text-white/30 transition-colors hover:text-white/60 ${className}`}
    >
      made by
      <span className="relative font-semibold text-white/55 transition-colors group-hover:text-white">
        WonderAds
        <span
          className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
          style={{ background: WA_GRADIENT }}
          aria-hidden
        />
      </span>
      <ArrowUpRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
    </a>
  );
}

/** Um número que dá um pequeno salto quando muda. */
export function BumpNumber({ value, className = "" }: { value: number; className?: string }) {
  const prev = useRef(value);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    if (value !== prev.current) {
      prev.current = value;
      setBump((b) => b + 1);
    }
  }, [value]);
  return (
    <motion.span
      key={bump}
      initial={bump ? { scale: 1.35, color: "#C9D22B" } : false}
      animate={{ scale: 1, color: "currentColor" }}
      transition={{ type: "spring", stiffness: 320, damping: 14 }}
      className={`inline-block tabular-nums ${className}`}
    >
      {value.toLocaleString("pt-PT")}
    </motion.span>
  );
}

export function Panel({ title, aside, children, className = "" }: { title: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6 ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold tracking-tight text-white">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
