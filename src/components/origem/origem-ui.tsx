"use client";

// Peças comuns da Origem de Pacientes (v78.69): os ícones das origens, a
// marca gráfica do cliente (a cruz da MyMedic, que se monta a cada registo —
// mais um paciente, «+1»), o «made by WonderAds» e o número que sobe.
//
// As cores vêm das variáveis --o-* que a página define a partir do tema do
// cliente (config.ts), por isso nada aqui é específico da MyMedic a não ser a
// própria cruz.

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
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
import type { OrigemTheme } from "@/lib/origem/config";

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

/** O gradiente da WonderAds — só para o que é trabalho da WonderAds
 *  (a «Pesquisa e IA») e para a assinatura. */
export const WA_GRADIENT = "linear-gradient(120deg,#343ed7 0%,#783df5 52%,#c535c9 100%)";

/** Cor com transparência (#RRGGBB → rgba). */
export function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export function ClientLogo({ logo, brand, className = "" }: { logo: string | null; brand: string; className?: string }) {
  if (!logo) return <span className={`font-extrabold tracking-tight ${className}`}>{brand}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={logo} alt={brand} className={`w-auto object-contain ${className}`} />;
}

// As quatro hastes e o centro da cruz do logótipo da MyMedic.
const CROSS = {
  top: "#CAD225",
  left: "#8CC6D2",
  bottom: "#7DBBC9",
  right: "#B5C99B",
  center: "#3E7486",
};

/**
 * A marca do cliente. `play` muda de valor a cada registo e a cruz monta-se
 * outra vez: as quatro hastes entram de fora e o centro acende por último.
 */
export function BrandMark({
  mark,
  className = "",
  play,
  still,
}: {
  mark: OrigemTheme["mark"];
  className?: string;
  /** Muda → anima. */
  play?: number | string;
  /** Sem animação de entrada. */
  still?: boolean;
}) {
  const reduce = useReducedMotion();
  const animate = !still && !reduce;
  if (mark !== "mymedic-cross") {
    return (
      <svg viewBox="0 0 100 100" className={className} aria-hidden>
        <circle cx="50" cy="50" r="34" fill="var(--o-primary)" />
      </svg>
    );
  }
  const arm = (from: { x?: number; y?: number }, delay: number) =>
    animate
      ? {
          initial: { opacity: 0, ...from },
          animate: { opacity: 0.92, x: 0, y: 0 },
          transition: { type: "spring" as const, stiffness: 260, damping: 20, delay },
        }
      : { initial: false as const, animate: { opacity: 0.92 } };
  return (
    <svg key={play} viewBox="0 0 100 100" className={className} aria-hidden>
      <motion.rect {...arm({ y: -22 }, 0)} x="33" y="0" width="34" height="42" rx="7" fill={CROSS.top} />
      <motion.rect {...arm({ x: -22 }, 0.05)} x="0" y="33" width="42" height="34" rx="7" fill={CROSS.left} />
      <motion.rect {...arm({ x: 22 }, 0.1)} x="58" y="33" width="42" height="34" rx="7" fill={CROSS.right} />
      <motion.rect {...arm({ y: 22 }, 0.15)} x="33" y="58" width="34" height="42" rx="7" fill={CROSS.bottom} />
      <motion.rect
        x="33"
        y="33"
        width="34"
        height="34"
        fill={CROSS.center}
        style={{ transformOrigin: "50px 50px", transformBox: "view-box" }}
        initial={animate ? { scale: 0, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={animate ? { type: "spring", stiffness: 320, damping: 18, delay: 0.28 } : undefined}
      />
    </svg>
  );
}

export function MadeBy({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://wonder-ads.com"
      target="_blank"
      rel="noopener noreferrer"
      className={`group inline-flex items-center gap-1 text-[13px] text-[var(--o-muted)] transition-colors hover:text-[var(--o-ink)] ${className}`}
    >
      made by
      <span className="relative font-bold text-[var(--o-ink)]">
        WonderAds
        <span
          className="absolute -bottom-0.5 left-0 h-[2px] w-full origin-left scale-x-0 rounded-full transition-transform duration-300 group-hover:scale-x-100"
          style={{ background: WA_GRADIENT }}
          aria-hidden
        />
      </span>
      <ArrowUpRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
    </a>
  );
}

/** Um número que dá um pequeno salto quando muda. */
export function BumpNumber({ value, className = "" }: { value: number; className?: string }) {
  const prev = useRef(value);
  const [bump, setBump] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (value !== prev.current) {
      prev.current = value;
      setBump((b) => b + 1);
    }
  }, [value]);
  return (
    <motion.span
      key={bump}
      initial={bump && !reduce ? { scale: 1.18, y: -4 } : false}
      animate={{ scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 16 }}
      className={`inline-block origin-bottom-left tabular-nums ${className}`}
    >
      {value.toLocaleString("pt-PT")}
    </motion.span>
  );
}

/** Um bloco branco dos relatórios. */
export function Sheet({
  title,
  aside,
  children,
  className = "",
}: {
  title?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[28px] border border-[var(--o-line)] bg-white p-5 sm:p-7 ${className}`}>
      {(title || aside) && (
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          {title && <h2 className="text-[17px] font-bold tracking-tight">{title}</h2>}
          {aside && <div className="text-[13px] text-[var(--o-muted)]">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
