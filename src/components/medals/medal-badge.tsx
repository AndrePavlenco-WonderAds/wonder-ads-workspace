// O emblema de uma medalha, em SVG, ao estilo dos patches militares
// (chevrons, estrelas, escudo, asas, louros, coroa). O desenho escala com
// o tier: I é um escudo com um chevron; V tem asas, coroa, raios e brilho
// animado. As «Top» (chefes) levam tudo isso e ainda a faixa «TOP» com
// acentos vermelhos e pulsação — são as que se querem ver de longe.
//
// Sem hooks de cliente além do useId (funciona em servidor e cliente): o
// header (servidor) e a galeria (cliente) usam o mesmo componente.

import { useId } from "react";
import type { Medal, MedalGlyph, MedalTier } from "@/lib/medals/catalog";

type Palette = { fg: string; bg: string; stroke: string; glow: string | null; accent: string };

const TIERS: Record<MedalTier, Palette> = {
  1: { fg: "#CDB27A", bg: "#1F2119", stroke: "#8E7A4E", glow: null, accent: "#CDB27A" },
  2: { fg: "#DCE1EA", bg: "#1B1E25", stroke: "#8F99AA", glow: null, accent: "#DCE1EA" },
  3: { fg: "#F6C654", bg: "#231C0F", stroke: "#B98D2C", glow: "rgba(246,198,84,0.45)", accent: "#F6C654" },
  4: { fg: "#A9F1FF", bg: "#0F1F26", stroke: "#4FB9D3", glow: "rgba(169,241,255,0.5)", accent: "#A9F1FF" },
  5: { fg: "url(#g)", bg: "#170F27", stroke: "#B26BFF", glow: "rgba(197,53,201,0.6)", accent: "#E9C8FF" },
};

const BOSS: Palette = { fg: "url(#g)", bg: "#1A0B10", stroke: "#F5C451", glow: "rgba(244,63,94,0.65)", accent: "#FB7185" };

function Star({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + Math.cos(a) * rad).toFixed(2)},${(cy + Math.sin(a) * rad).toFixed(2)}`);
  }
  return <polygon points={pts.join(" ")} fill={fill} />;
}

function Glyph({ glyph, fg, accent }: { glyph: MedalGlyph; fg: string; accent: string }) {
  switch (glyph) {
    case "check":
      return <path d="M51 37 L57.5 43.5 L69.5 30.5" fill="none" stroke={fg} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />;
    case "plane":
      return <path d="M48.5 37.5 L71.5 28 L63.5 47 L59.5 39.5 Z" fill={fg} />;
    case "euro":
      return (
        <text x="60" y="44" textAnchor="middle" fontSize="21" fontWeight="800" fontFamily="ui-sans-serif, system-ui, sans-serif" fill={fg}>
          €
        </text>
      );
    case "cycle":
      return (
        <>
          <path d="M52.5 40 A8.5 8.5 0 1 1 56 45.5" fill="none" stroke={fg} strokeWidth={3.2} strokeLinecap="round" />
          <polygon points="51,46 58,46.5 53.5,41" fill={fg} />
        </>
      );
    case "sparkle":
      return <polygon points="60,26 63,34 71,37 63,40 60,48 57,40 49,37 57,34" fill={fg} />;
    case "crosshair":
      return (
        <>
          <circle cx="60" cy="37" r="7.5" fill="none" stroke={fg} strokeWidth={2.6} />
          <path d="M60 26 V31 M60 43 V48 M49 37 H54 M66 37 H71" stroke={fg} strokeWidth={2.6} strokeLinecap="round" />
          <circle cx="60" cy="37" r="1.8" fill={accent} />
        </>
      );
    case "diamond":
      return (
        <>
          <polygon points="60,27 70,37 60,47 50,37" fill={fg} />
          <polygon points="60,31 66,37 60,43 54,37" fill={accent} opacity={0.55} />
        </>
      );
    case "star":
      return <Star cx={60} cy={37} r={10} fill={fg} />;
  }
}

function Wings({ fg, big }: { fg: string; big: boolean }) {
  const d = big
    ? "M38 34 C 28 18, 12 20, 3 26 C 12 27, 17 30, 21 33 C 11 34, 6 39, 3 45 C 13 41, 22 40, 30 41 C 22 44, 17 48, 15 54 C 24 49, 32 46, 38 45 Z"
    : "M38 36 C 30 26, 18 27, 10 31 C 18 32, 22 34, 25 36 C 17 37, 13 41, 11 46 C 19 42, 27 41, 33 42 C 28 44, 25 47, 24 51 C 30 47, 35 45, 38 44 Z";
  return (
    <>
      <path d={d} fill={fg} />
      <path d={d} fill={fg} transform="translate(120 0) scale(-1 1)" />
    </>
  );
}

function Laurel({ fg }: { fg: string }) {
  return (
    <>
      <path d="M33 64 A 30 30 0 0 1 27 28" fill="none" stroke={fg} strokeWidth={3.2} strokeDasharray="2.6 2.6" strokeLinecap="round" />
      <path d="M87 64 A 30 30 0 0 0 93 28" fill="none" stroke={fg} strokeWidth={3.2} strokeDasharray="2.6 2.6" strokeLinecap="round" />
    </>
  );
}

function Bolts({ fill }: { fill: string }) {
  return (
    <>
      <polygon points="27,24 20,40 26,38 21,54 33,34 27,36" fill={fill} />
      <polygon points="93,24 100,40 94,38 99,54 87,34 93,36" fill={fill} />
    </>
  );
}

export function MedalBadge({
  medal,
  size = 32,
  earned = true,
  className = "",
}: {
  medal: Medal;
  /** Altura em px; a largura é 1,5×. */
  size?: number;
  /** false = por ganhar: fica a cinzento e apagada. */
  earned?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const P = medal.boss ? BOSS : TIERS[medal.tier];
  const gradId = `mg${uid}`;
  const fg = P.fg === "url(#g)" ? `url(#${gradId})` : P.fg;
  const t = medal.tier;
  const stars = t >= 3 ? 3 : t === 2 ? 1 : 0;
  const chevrons = t <= 3 ? t : 0;
  const wings = t >= 4;
  const crown = t >= 5;
  const bolts = t >= 5;
  const laurel = t >= 4;
  const width = size * 1.5;
  const filter = earned && P.glow ? `drop-shadow(0 0 ${Math.max(3, size / 8)}px ${P.glow})` : undefined;

  return (
    <svg
      viewBox="0 0 120 80"
      width={width}
      height={size}
      role="img"
      aria-label={`${medal.name} — ${medal.requirement}`}
      className={`${earned ? (medal.boss ? "animate-medal-pulse" : "") : "opacity-35 grayscale"} ${className}`}
      style={{ filter, overflow: "visible" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          {medal.boss ? (
            <>
              <stop offset="0" stopColor="#FDE68A" />
              <stop offset="0.5" stopColor="#F59E0B" />
              <stop offset="1" stopColor="#FB7185" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#B26BFF" />
              <stop offset="0.5" stopColor="#E36BE0" />
              <stop offset="1" stopColor="#FFD166" />
            </>
          )}
          {earned && t >= 5 && (
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              from="-0.6 0"
              to="0.6 0"
              dur="2.8s"
              repeatCount="indefinite"
            />
          )}
        </linearGradient>
      </defs>

      {laurel && <Laurel fg={fg} />}
      {wings && <Wings fg={fg} big={t >= 5} />}
      {bolts && <Bolts fill={medal.boss ? P.accent : fg} />}

      {/* Escudo */}
      <path d="M38 16 H82 V44 C82 56.5 72 64.5 60 69 C48 64.5 38 56.5 38 44 Z" fill={P.bg} stroke={fg} strokeWidth={3} strokeLinejoin="round" />
      {t >= 4 && (
        <path d="M43 21 H77 V43.5 C77 53 69 59.5 60 63 C51 59.5 43 53 43 43.5 Z" fill="none" stroke={fg} strokeWidth={1} opacity={0.5} />
      )}

      {/* Coroa (V) */}
      {crown && <polygon points="45,15 49,5 55,11 60,2 65,11 71,5 75,15" fill={fg} />}

      {/* Estrelas */}
      {stars > 0 && !crown && (
        <>
          {Array.from({ length: stars }, (_, i) => (
            <Star key={i} cx={60 + (i - (stars - 1) / 2) * 12} cy={9} r={4.2} fill={fg} />
          ))}
        </>
      )}

      {/* Anel vermelho à volta do glifo — só chefes */}
      {medal.boss && <circle cx="60" cy="37" r="14.5" fill="none" stroke={P.accent} strokeWidth={2} opacity={0.9} />}

      <Glyph glyph={medal.glyph} fg={fg} accent={P.accent} />

      {/* Chevrons (I–III) */}
      {chevrons > 0 &&
        Array.from({ length: chevrons }, (_, i) => {
          const y = 51 + i * 5 - (chevrons - 1) * 2.5;
          return (
            <path key={i} d={`M51 ${y} L60 ${y + 4.5} L69 ${y}`} fill="none" stroke={fg} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          );
        })}
      {chevrons === 0 && !medal.boss && (
        <text x="60" y="58" textAnchor="middle" fontSize="8" fontWeight="800" letterSpacing="1" fontFamily="ui-sans-serif, system-ui, sans-serif" fill={fg}>
          {medal.level}
        </text>
      )}

      {/* Faixa «TOP» dos chefes */}
      {medal.boss && (
        <>
          <path d="M34 66 H86 L82 76 H38 Z" fill={P.accent} />
          <text x="60" y="73.5" textAnchor="middle" fontSize="8" fontWeight="900" letterSpacing="2" fontFamily="ui-sans-serif, system-ui, sans-serif" fill="#1A0B10">
            TOP
          </text>
        </>
      )}
    </svg>
  );
}
