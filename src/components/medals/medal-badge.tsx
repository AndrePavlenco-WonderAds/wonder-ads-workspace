// O emblema de uma medalha, em SVG, ao estilo dos patches militares
// (chevrons, estrelas, escudo, medalhão, asas, louros, coroa). O desenho
// escala com o tier: I é um escudo de bronze com um chevron; V tem asas,
// coroa, raios e brilho lendário. As «Top» (chefes) levam tudo isso, um
// sol de raios atrás, a faixa vermelha «TOP» e o pulso forte.
//
// A partir do nível 3 (Ouro) há três estrelas em órbita à volta do
// emblema, ao estilo das cartas lendárias — animação SMIL dentro do SVG.
// Nada de gradientes a andar: as cores são fixas (v77.26).
//
// Sem hooks de cliente além do useId (funciona em servidor e cliente): o
// header (servidor) e a galeria (cliente) usam o mesmo componente.

import { useId } from "react";
import type { Medal, MedalGlyph, MedalTier } from "@/lib/medals/catalog";

type Palette = {
  /** Cor principal; «gradient» usa o degradê fixo definido em <defs>. */
  fg: string | "gradient";
  bg: string;
  stroke: string;
  glow: string | null;
  accent: string;
};

const TIERS: Record<MedalTier, Palette> = {
  1: { fg: "#D2A05A", bg: "#1C1710", stroke: "#9A6A2E", glow: null, accent: "#F1C27D" },
  2: { fg: "#E2E8F0", bg: "#171A20", stroke: "#8A93A3", glow: null, accent: "#FFFFFF" },
  3: { fg: "#FFD166", bg: "#201A0C", stroke: "#C79A2E", glow: "rgba(255,209,102,0.5)", accent: "#FFF1B8" },
  4: { fg: "#9EEBFF", bg: "#0D1C24", stroke: "#45B7D6", glow: "rgba(158,235,255,0.55)", accent: "#FFFFFF" },
  5: { fg: "gradient", bg: "#150E24", stroke: "#B26BFF", glow: "rgba(199,125,255,0.65)", accent: "#FFD166" },
};

const BOSS: Palette = { fg: "gradient", bg: "#1B0A0E", stroke: "#FFD166", glow: "rgba(255,77,109,0.7)", accent: "#FF4D6D" };

function Star({ cx, cy, r, fill, points = 5 }: { cx: number; cy: number; r: number; fill: string; points?: 4 | 5 }) {
  const pts: string[] = [];
  const n = points * 2;
  const inner = points === 4 ? 0.38 : 0.45;
  for (let i = 0; i < n; i++) {
    const rad = i % 2 === 0 ? r : r * inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    pts.push(`${(cx + Math.cos(a) * rad).toFixed(2)},${(cy + Math.sin(a) * rad).toFixed(2)}`);
  }
  return <polygon points={pts.join(" ")} fill={fill} />;
}

/** Glifo da família, centrado em (60,40) dentro do medalhão (r=13). */
function Glyph({ glyph, fg, accent }: { glyph: MedalGlyph; fg: string; accent: string }) {
  switch (glyph) {
    case "check":
      return <path d="M52 40.5 L57.5 46 L68.5 34" fill="none" stroke={fg} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" />;
    case "plane":
      return <path d="M50.5 41 L70 33 L63.5 48.5 L60 41.5 Z" fill={fg} />;
    case "euro":
      return (
        <text x="60" y="46.5" textAnchor="middle" fontSize="19" fontWeight="800" fontFamily="ui-sans-serif, system-ui, sans-serif" fill={fg}>
          €
        </text>
      );
    case "cycle":
      return (
        <>
          <path d="M53.5 43 A7.5 7.5 0 1 1 56.5 47.5" fill="none" stroke={fg} strokeWidth={3} strokeLinecap="round" />
          <polygon points="52,48.5 58.5,49 54.5,44" fill={fg} />
        </>
      );
    case "sparkle":
      return <polygon points="60,30.5 62.6,37.4 69.5,40 62.6,42.6 60,49.5 57.4,42.6 50.5,40 57.4,37.4" fill={fg} />;
    case "crosshair":
      return (
        <>
          <circle cx="60" cy="40" r="6.5" fill="none" stroke={fg} strokeWidth={2.4} />
          <path d="M60 30.5 V34.5 M60 45.5 V49.5 M50.5 40 H54.5 M65.5 40 H69.5" stroke={fg} strokeWidth={2.4} strokeLinecap="round" />
          <circle cx="60" cy="40" r="1.7" fill={accent} />
        </>
      );
    case "diamond":
      return (
        <>
          <polygon points="60,31 68.5,40 60,49 51.5,40" fill={fg} />
          <polygon points="60,34.5 65,40 60,45.5 55,40" fill={accent} opacity={0.6} />
        </>
      );
    case "star":
      return <Star cx={60} cy={40} r={9.5} fill={fg} />;
  }
}

/** Asa esquerda com três penas; a direita é o espelho. */
const WING = "M38 32 C31 22, 20 19, 6 22 C14 25, 19 29, 23 33 C15 33, 8 37, 2 42 C11 41, 18 42, 25 44 C18 47, 13 52, 11 58 C20 53, 30 49, 38 48 Z";

function Wings({ fg, big }: { fg: string; big: boolean }) {
  const t = big ? "translate(60 40) scale(1.12) translate(-60 -40)" : undefined;
  return (
    <g transform={t}>
      <path d={WING} fill={fg} />
      <path d={WING} fill={fg} transform="translate(120 0) scale(-1 1)" />
      {/* Nervuras das penas */}
      <path d="M36 36 L14 26 M36 41 L10 41 M36 46 L16 54" stroke="rgba(0,0,0,0.35)" strokeWidth={1.2} strokeLinecap="round" />
      <path d="M84 36 L106 26 M84 41 L110 41 M84 46 L104 54" stroke="rgba(0,0,0,0.35)" strokeWidth={1.2} strokeLinecap="round" />
    </g>
  );
}

function Laurel({ fg }: { fg: string }) {
  return (
    <>
      <path d="M32 66 A29 29 0 0 1 28 30" fill="none" stroke={fg} strokeWidth={3.4} strokeDasharray="2.4 2.6" strokeLinecap="round" />
      <path d="M88 66 A29 29 0 0 0 92 30" fill="none" stroke={fg} strokeWidth={3.4} strokeDasharray="2.4 2.6" strokeLinecap="round" />
    </>
  );
}

function Bolts({ fill }: { fill: string }) {
  return (
    <>
      <polygon points="25,22 18,38 24,36 19,52 31,32 25,34" fill={fill} />
      <polygon points="95,22 102,38 96,36 101,52 89,32 95,34" fill={fill} />
    </>
  );
}

function Sparkle({ cx, cy, r, fill, delay }: { cx: number; cy: number; r: number; fill: string; delay: number }) {
  return (
    <g>
      <Star cx={cx} cy={cy} r={r} fill={fill} points={4} />
      <animate attributeName="opacity" values="0.2;1;0.2" dur="1.8s" begin={`${delay}s`} repeatCount="indefinite" />
    </g>
  );
}

export function MedalBadge({
  medal,
  size = 32,
  earned = true,
  className = "",
}: {
  medal: Medal;
  /** Altura em px. A largura é 1,5× com asas (nível 4+), 0,8× sem. */
  size?: number;
  /** false = por ganhar: fica a cinzento e apagada. */
  earned?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const P = medal.boss ? BOSS : TIERS[medal.tier];
  const gradId = `mg${uid}`;
  const shineId = `ms${uid}`;
  const fg = P.fg === "gradient" ? `url(#${gradId})` : P.fg;
  const t = medal.tier;
  const boss = medal.boss;
  const stars = t >= 3 ? 3 : t === 2 ? 1 : 0;
  const chevrons = t <= 3 ? t : 0;
  const wings = t >= 4;
  const crown = t >= 5;
  const bolts = t >= 5;
  const laurel = t === 3;
  const orbit = earned && t >= 3;
  const wide = wings;
  const width = size * (wide ? 1.5 : 0.8);
  const filter = earned && P.glow ? `drop-shadow(0 0 ${Math.max(3, size / 7)}px ${P.glow})` : undefined;
  const pulse = !earned ? "" : boss ? "animate-medal-pulse-strong" : t >= 3 ? "animate-medal-pulse" : "";
  const sparkleFill = boss ? P.accent : t === 5 ? "#FFD166" : P.accent;

  return (
    <svg
      viewBox={wide ? "0 0 120 80" : "28 0 64 80"}
      width={width}
      height={size}
      role="img"
      aria-label={`${medal.name} — ${medal.requirement}`}
      className={`${earned ? pulse : "opacity-35 grayscale"} ${className}`}
      style={{ filter, overflow: "visible" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          {boss ? (
            <>
              <stop offset="0" stopColor="#FFE08A" />
              <stop offset="0.55" stopColor="#FFB347" />
              <stop offset="1" stopColor="#FF5C7A" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#9F6BFF" />
              <stop offset="0.55" stopColor="#E86BE0" />
              <stop offset="1" stopColor="#FFD166" />
            </>
          )}
        </linearGradient>
        <radialGradient id={shineId} cx="0.5" cy="0.15" r="0.8">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.16" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Sol de raios — só chefes */}
      {boss && (
        <g opacity={0.32}>
          {Array.from({ length: 12 }, (_, i) => (
            <polygon key={i} points="60,42 56.5,-2 63.5,-2" fill={fg} transform={`rotate(${i * 30} 60 42)`} />
          ))}
        </g>
      )}

      {laurel && <Laurel fg={fg} />}
      {wings && <Wings fg={fg} big={t >= 5} />}
      {bolts && <Bolts fill={boss ? P.accent : fg} />}

      {/* Escudo com bisel interior e brilho no topo */}
      <path d="M36 14 H84 V45 C84 58 73 66.5 60 71 C47 66.5 36 58 36 45 Z" fill={P.bg} stroke={fg} strokeWidth={3} strokeLinejoin="round" />
      <path d="M36 14 H84 V45 C84 58 73 66.5 60 71 C47 66.5 36 58 36 45 Z" fill={`url(#${shineId})`} />
      <path d="M41 19 H79 V44 C79 54.5 70 61 60 65 C50 61 41 54.5 41 44 Z" fill="none" stroke={fg} strokeWidth={1.2} opacity={0.55} />

      {/* Coroa (V e chefes) */}
      {crown && (
        <>
          <polygon points="44,14 47.5,4 54,10 60,1.5 66,10 72.5,4 76,14" fill={fg} />
          <circle cx="47.5" cy="4.5" r="1.6" fill={P.accent} />
          <circle cx="60" cy="2.2" r="1.9" fill={P.accent} />
          <circle cx="72.5" cy="4.5" r="1.6" fill={P.accent} />
        </>
      )}

      {/* Estrelas no topo (II–IV) */}
      {stars > 0 && !crown &&
        Array.from({ length: stars }, (_, i) => (
          <Star key={i} cx={60 + (i - (stars - 1) / 2) * 12} cy={8} r={4.2} fill={fg} />
        ))}

      {/* Medalhão com o glifo */}
      <circle cx="60" cy="40" r="13.5" fill="rgba(255,255,255,0.055)" stroke={fg} strokeWidth={1.8} />
      {boss && <circle cx="60" cy="40" r="16.5" fill="none" stroke={P.accent} strokeWidth={1.6} opacity={0.9} />}
      <Glyph glyph={medal.glyph} fg={fg} accent={P.accent} />

      {/* Chevrons (I–III) ou placa com o numeral (IV–V) */}
      {chevrons > 0 &&
        Array.from({ length: chevrons }, (_, i) => {
          const y = 57.5 + i * 4.2 - (chevrons - 1) * 2.1;
          return (
            <path key={i} d={`M53.5 ${y} L60 ${y + 3.6} L66.5 ${y}`} fill="none" stroke={fg} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          );
        })}
      {chevrons === 0 && !boss && (
        <>
          <rect x="51" y="56.5" width="18" height="8.5" rx="2" fill={fg} />
          <text x="60" y="63" textAnchor="middle" fontSize="6.5" fontWeight="900" letterSpacing="0.5" fontFamily="ui-sans-serif, system-ui, sans-serif" fill={P.bg}>
            {medal.level}
          </text>
        </>
      )}

      {/* Faixa «TOP» dos chefes, com pontas */}
      {boss && (
        <>
          <path d="M36 63 H84 L88 69 L84 76 H36 L32 69 Z" fill={P.accent} />
          <path d="M30 60 L38 63 L36 69.5 L38 76 L30 78 L33 69 Z" fill={P.accent} opacity={0.85} />
          <path d="M90 60 L82 63 L84 69.5 L82 76 L90 78 L87 69 Z" fill={P.accent} opacity={0.85} />
          <text x="60" y="72.6" textAnchor="middle" fontSize="8.5" fontWeight="900" letterSpacing="2.5" fontFamily="ui-sans-serif, system-ui, sans-serif" fill="#1B0A0E">
            TOP
          </text>
        </>
      )}

      {/* Estrelas em órbita (Ouro e acima) */}
      {orbit && (
        <g className="medal-orbit">
          <animateTransform attributeName="transform" type="rotate" from="0 60 42" to="360 60 42" dur={boss ? "5s" : "8s"} repeatCount="indefinite" />
          {[0, 120, 240].map((deg, i) => {
            const a = (deg * Math.PI) / 180;
            return (
              <Sparkle
                key={deg}
                cx={60 + Math.cos(a) * (wide ? 50 : 36)}
                cy={42 + Math.sin(a) * 38}
                r={boss ? 4.4 : 3.4}
                fill={sparkleFill}
                delay={i * 0.6}
              />
            );
          })}
        </g>
      )}
    </svg>
  );
}
