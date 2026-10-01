"use client";

// Peças visuais partilhadas pelos ecrãs dos Mini-games.

import { useEffect, useState } from "react";
import { motion } from "motion/react";

export const LETTERS = ["A", "B", "C"] as const;

/** Uma cor por frase — a mesma no lobby, no palpite e na revelação. */
export const STATEMENT_TONES = [
  { ring: "#5C6FFF", soft: "rgba(92,111,255,0.14)", text: "#aab4ff" },
  { ring: "#A35BFF", soft: "rgba(163,91,255,0.14)", text: "#d2b4ff" },
  { ring: "#E04FD0", soft: "rgba(224,79,208,0.14)", text: "#f6b0ec" },
] as const;

export function Avatar({
  name,
  avatar,
  size = 40,
  className = "",
  ring = false,
}: {
  name: string;
  avatar: string | null;
  size?: number;
  className?: string;
  /** Contorno com o gradiente da marca. */
  ring?: boolean;
}) {
  const inner = (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#343ED7] via-[#783DF5] to-[#C535C9] font-bold text-white ${ring ? "" : className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.4) }}
      aria-hidden
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" className="h-full w-full object-cover object-top" />
      ) : (
        name.trim().charAt(0).toUpperCase()
      )}
    </span>
  );
  if (!ring) return inner;
  return (
    <span
      className={`inline-flex shrink-0 rounded-full p-[3px] ${className}`}
      style={{ background: "var(--brand-gradient)" }}
    >
      <span className="rounded-full bg-[color:var(--background)] p-[2px]">{inner}</span>
    </span>
  );
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** Anel de contagem decrescente. Fica vermelho e a pulsar nos últimos 5 s. */
export function CountdownRing({
  seconds,
  total,
  size = 64,
}: {
  seconds: number;
  total: number;
  size?: number;
}) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, seconds / total));
  const urgent = seconds <= 5;
  const shown = Math.min(total, Math.ceil(seconds));
  return (
    <div
      className={`relative shrink-0 ${urgent && seconds > 0 ? "animate-pulse" : ""}`}
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`${shown} segundos`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={urgent ? "#fb7185" : "url(#mg-ring)"}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: "stroke-dashoffset 0.25s linear" }}
        />
        <defs>
          <linearGradient id="mg-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5C6FFF" />
            <stop offset="55%" stopColor="#A35BFF" />
            <stop offset="100%" stopColor="#E04FD0" />
          </linearGradient>
        </defs>
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center text-lg font-bold tabular-nums ${
          urgent ? "text-rose-300" : "text-white"
        }`}
      >
        {shown}
      </span>
    </div>
  );
}

const CONFETTI_COLORS = ["#5C6FFF", "#A35BFF", "#E04FD0", "#FFC15E", "#34d399", "#ffffff"];

type ConfettiBit = {
  id: string;
  left: number;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
  w: number;
  h: number;
  color: string;
};

/** Confetes a cair por cima do ecrã inteiro. `burst` muda → nova chuva. */
export function Confetti({
  burst,
  pieces = 90,
  delay = 0,
}: {
  burst: string | number;
  pieces?: number;
  /** Segundos até começar a chover (para coincidir com a revelação). */
  delay?: number;
}) {
  // Gerados só no browser, depois de montar: Math.random() no render dava
  // HTML do servidor diferente do da hidratação.
  const [bits, setBits] = useState<ConfettiBit[]>([]);
  useEffect(() => {
    setBits(
      Array.from({ length: pieces }, (_, i) => ({
        id: `${burst}-${i}`,
        left: Math.random() * 100,
        delay: delay + Math.random() * 0.5,
        duration: 2.2 + Math.random() * 1.6,
        drift: (Math.random() - 0.5) * 160,
        spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540),
        w: 6 + Math.random() * 6,
        h: 9 + Math.random() * 9,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    );
  }, [burst, pieces, delay]);
  if (!bits.length) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {bits.map((b) => (
        <motion.span
          key={b.id}
          className="absolute top-0 rounded-[2px]"
          style={{ left: `${b.left}%`, width: b.w, height: b.h, background: b.color }}
          initial={{ y: "-5vh", x: 0, rotate: 0, opacity: 0 }}
          animate={{ y: "110vh", x: b.drift, rotate: b.spin, opacity: [0, 1, 1, 0.9, 0] }}
          transition={{ duration: b.duration, delay: b.delay, ease: [0.25, 0.6, 0.4, 1] }}
        />
      ))}
    </div>
  );
}

/** Fila de avatares sobrepostos (até `max`, depois «+N»). */
export function AvatarStack({
  people,
  size = 26,
  max = 6,
}: {
  people: { username: string; name: string; avatar: string | null }[];
  size?: number;
  max?: number;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="flex items-center">
      {shown.map((p, i) => (
        <motion.span
          key={p.username}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: i * 0.06, type: "spring", stiffness: 400, damping: 22 }}
          className="rounded-full ring-2 ring-[color:var(--background)]"
          style={{ marginLeft: i === 0 ? 0 : -size * 0.3 }}
          title={p.name}
        >
          <Avatar name={p.name} avatar={p.avatar} size={size} />
        </motion.span>
      ))}
      {extra > 0 && (
        <span
          className="flex items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-white/80 ring-2 ring-[color:var(--background)]"
          style={{ width: size, height: size, marginLeft: -size * 0.3 }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

/** As três cartas em leque — a imagem do jogo. */
export function FannedCards({ small = false }: { small?: boolean }) {
  const w = small ? 64 : 84;
  const h = small ? 88 : 116;
  const cards = [
    { rot: -14, x: -0.62, label: "✗", color: "#fb7185", bg: "rgba(251,113,133,0.10)" },
    { rot: 0, x: 0, label: "✓", color: "#34d399", bg: "rgba(52,211,153,0.12)" },
    { rot: 14, x: 0.62, label: "✗", color: "#fb7185", bg: "rgba(251,113,133,0.10)" },
  ];
  return (
    <div className="relative mx-auto" style={{ width: w * 2.4, height: h + 16 }} aria-hidden>
      {cards.map((c, i) => (
        <motion.div
          key={i}
          initial={{ rotate: 0, x: 0, opacity: 0 }}
          animate={{ rotate: c.rot, x: c.x * w, opacity: 1 }}
          whileHover={{ y: -6 }}
          transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 + i * 0.08 }}
          className="absolute left-1/2 top-2 flex origin-bottom flex-col items-center justify-center rounded-2xl border border-white/15 shadow-xl backdrop-blur"
          style={{ width: w, height: h, marginLeft: -w / 2, background: `linear-gradient(160deg, ${c.bg}, rgba(255,255,255,0.03))`, zIndex: i === 1 ? 2 : 1 }}
        >
          <span className="text-3xl font-black" style={{ color: c.color }}>
            {c.label}
          </span>
          <span className="mt-2 h-1 w-8 rounded-full bg-white/15" />
          <span className="mt-1 h-1 w-6 rounded-full bg-white/10" />
        </motion.div>
      ))}
    </div>
  );
}
