"use client";

// Peças pequenas do Reviews Hub: estrelas, caras por nível, números que
// contam, avatares, datas relativas e o fundo de madeixas animadas.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useInView, useMotionValue, useTransform } from "motion/react";
import { Annoyed, Frown, Laugh, Meh, Smile, Star, type LucideIcon } from "lucide-react";
import type { StarLevel } from "@/lib/reviews-hub/types";

// ── Paleta por nível de estrelas ───────────────────────────────────────
export const LEVELS: Record<
  StarLevel,
  { color: string; soft: string; ring: string; Icon: LucideIcon; label: string }
> = {
  1: { color: "#fb7185", soft: "rgba(251,113,133,0.12)", ring: "rgba(251,113,133,0.38)", Icon: Frown, label: "1 estrela" },
  2: { color: "#fb923c", soft: "rgba(251,146,60,0.12)", ring: "rgba(251,146,60,0.38)", Icon: Annoyed, label: "2 estrelas" },
  3: { color: "#facc15", soft: "rgba(250,204,21,0.11)", ring: "rgba(250,204,21,0.34)", Icon: Meh, label: "3 estrelas" },
  4: { color: "#2dd4bf", soft: "rgba(45,212,191,0.11)", ring: "rgba(45,212,191,0.34)", Icon: Smile, label: "4 estrelas" },
  5: { color: "#34d399", soft: "rgba(52,211,153,0.12)", ring: "rgba(52,211,153,0.36)", Icon: Laugh, label: "5 estrelas" },
};

export const STAR_GOLD = "#fbbf24";

export function levelOf(stars: number): StarLevel {
  return (Math.min(5, Math.max(1, Math.round(stars || 5))) as StarLevel);
}

// ── Estrelas ──────────────────────────────────────────────────────────
export function StarRow({
  value,
  size = 14,
  color,
  animateIn = false,
  gap = 2,
}: {
  value: number;
  size?: number;
  color?: string;
  animateIn?: boolean;
  gap?: number;
}) {
  const fill = color ?? STAR_GOLD;
  return (
    <span className="inline-flex items-center" style={{ gap }} aria-label={`${value} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const partial = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <motion.span
            key={i}
            className="relative inline-block"
            style={{ width: size, height: size }}
            initial={animateIn ? { scale: 0, rotate: -40, opacity: 0 } : false}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 520, damping: 18, delay: animateIn ? i * 0.06 : 0 }}
          >
            <Star
              className="absolute inset-0"
              style={{ width: size, height: size, color: "rgba(255,255,255,0.22)" }}
              strokeWidth={1.6}
            />
            {partial > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${partial * 100}%` }}>
                <Star
                  style={{ width: size, height: size, color: fill, fill }}
                  strokeWidth={1.6}
                />
              </span>
            )}
          </motion.span>
        );
      })}
    </span>
  );
}

// ── A cara de cada nível (círculo com ícone) ──────────────────────────
export function LevelFace({ level, size = 56, active = false }: { level: StarLevel; size?: number; active?: boolean }) {
  const L = LEVELS[level];
  return (
    <motion.span
      className="relative inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: L.soft, boxShadow: `inset 0 0 0 1px ${L.ring}` }}
      animate={active ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      {active && (
        <span
          className="absolute inset-0 rounded-full blur-xl"
          style={{ background: L.color, opacity: 0.22 }}
          aria-hidden
        />
      )}
      <L.Icon style={{ width: size * 0.46, height: size * 0.46, color: L.color }} strokeWidth={1.8} />
    </motion.span>
  );
}

// ── Números que contam quando entram no ecrã ──────────────────────────
export function CountUp({
  value,
  decimals = 0,
  duration = 1.2,
  suffix = "",
  className,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) =>
    `${v.toLocaleString("pt-PT", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`,
  );
  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [inView, value, duration, mv]);
  return (
    <motion.span ref={ref} className={className}>
      {text}
    </motion.span>
  );
}

// ── Avatar (foto da Google ou inicial) ────────────────────────────────
const AVATAR_TINTS = ["#6366f1", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b", "#0ea5e9", "#22c55e", "#f43f5e"];

export function Avatar({ name, photo, size = 40 }: { name: string; photo?: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  const tint = AVATAR_TINTS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TINTS.length];
  if (photo && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="shrink-0 rounded-full object-cover ring-1 ring-white/10"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-1 ring-white/10"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(135deg, ${tint}, ${tint}99)`,
      }}
      aria-hidden
    >
      {initial}
    </span>
  );
}

// ── Datas ─────────────────────────────────────────────────────────────
const RTF = typeof Intl !== "undefined" ? new Intl.RelativeTimeFormat("pt-PT", { numeric: "auto" }) : null;

export function relativeTime(iso: string | number | null | undefined, now = Date.now()): string {
  if (iso === null || iso === undefined) return "—";
  const t = typeof iso === "number" ? iso : Date.parse(iso);
  if (!Number.isFinite(t) || !RTF) return "—";
  const diff = (t - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "agora mesmo";
  if (abs < 3600) return RTF.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return RTF.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return RTF.format(Math.round(diff / 86400), "day");
  if (abs < 86400 * 365) return RTF.format(Math.round(diff / (86400 * 30)), "month");
  return RTF.format(Math.round(diff / (86400 * 365)), "year");
}

const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export function monthLabel(key: string, withYear = false): string {
  const [y, m] = key.split("-").map(Number);
  const name = MONTHS_PT[(m ?? 1) - 1] ?? key;
  return withYear ? `${name} ${y}` : name;
}

export function formatRating(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : v.toLocaleString("pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function pct(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : `${Math.round(v * 100)}%`;
}

// ── O «G» da Google ───────────────────────────────────────────────────
export function GoogleG({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

// ── Fundo: madeixas de cabelo a ondular ───────────────────────────────
export function HairStrands({ className = "", subtle = false }: { className?: string; subtle?: boolean }) {
  const strands = [
    "M 980 -40 C 820 120, 900 260, 760 380 S 560 560, 610 760",
    "M 1040 -30 C 900 140, 960 300, 820 420 S 640 600, 700 820",
    "M 1100 -20 C 980 150, 1020 320, 890 450 S 720 640, 790 860",
    "M 930 -50 C 760 90, 850 240, 700 350 S 500 520, 540 700",
    "M 1160 0 C 1060 170, 1080 340, 960 480 S 800 680, 880 900",
    "M 880 -60 C 700 60, 800 200, 640 320 S 440 470, 470 640",
  ];
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 top-0 overflow-hidden ${subtle ? "h-[460px]" : "bottom-0"} ${className}`}
      style={subtle ? { maskImage: "linear-gradient(180deg, #000 30%, transparent)", WebkitMaskImage: "linear-gradient(180deg, #000 30%, transparent)" } : undefined}
      aria-hidden
    >
      <div
        className="rhub-aurora absolute -right-40 -top-56 h-[620px] w-[760px] rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(120,61,245,0.30), rgba(197,53,201,0.16) 55%, transparent 75%)",
        }}
      />
      <svg
        className={`rhub-strands rhub-sway absolute -right-24 -top-10 h-[760px] w-[1200px] ${subtle ? "opacity-40" : "opacity-70"}`}
        viewBox="0 0 1200 900"
        fill="none"
      >
        <defs>
          <linearGradient id="rhub-strand" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0" />
            <stop offset="35%" stopColor="#a78bfa" stopOpacity="0.55" />
            <stop offset="70%" stopColor="#e879f9" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#f0abfc" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rhub-strand-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fde68a" stopOpacity="0" />
            <stop offset="50%" stopColor="#fcd34d" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </linearGradient>
        </defs>
        {strands.map((d, i) => (
          <path
            key={i}
            d={d}
            stroke={i % 3 === 1 ? "url(#rhub-strand-gold)" : "url(#rhub-strand)"}
            strokeWidth={i % 2 ? 1.1 : 1.6}
            strokeLinecap="round"
            strokeDasharray="520 180"
          />
        ))}
      </svg>
      <div className="absolute inset-x-0 top-0 h-[560px] bg-gradient-to-b from-transparent via-transparent to-[#07080d]" />
    </div>
  );
}

// ── Esqueleto com brilho ──────────────────────────────────────────────
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`rhub-skeleton rounded-lg ${className}`} />;
}

// ── Cartão base ───────────────────────────────────────────────────────
export function Panel({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-sm ${className}`}
    >
      {children}
    </motion.section>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-white/15 bg-white/[0.06] px-1 font-sans text-[10px] font-semibold text-white/60">
      {children}
    </kbd>
  );
}
