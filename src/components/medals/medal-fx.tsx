// Os efeitos das peles especiais (v78.62) — as famílias difíceis têm de se
// ver de longe:
//
//   • «estelar» (NPS Perfeito): halo de nebulosa, um céu de pontinhos a
//     cintilar, estrelas a voar em órbita (umas para um lado, outras para o
//     outro), estrelas cadentes e corações a subir;
//   • «lendaria» (Rigor): halo de ouro e esmeralda, raios a rodar, dois
//     anéis de runas em sentidos opostos, faíscas a subir dos lados,
//     cometas em órbita, cintilações e um brilho a varrer o escudo.
//
// Cada pele tem uma camada de TRÁS (antes do escudo) e uma da FRENTE
// (depois). Tudo SMIL dentro do SVG, sem hooks e sem trigonometria nas
// posições animadas (tabelas fixas — o servidor e o browser desenham igual).
// Com `animated=false` (PNG do Slack) fica um retrato parado da mesma cena.
// As camadas que mexem levam `.medal-fx` — escondem-se com movimento
// reduzido (globals.css).
//
// Coordenadas: as do emblema (viewBox 120×80, centro do escudo em 60,40).
// `wide` = há asas (tier 4+) e o desenho é mais largo — tudo se afasta.

import type { MedalFx, MedalTier } from "@/lib/medals/catalog";

export type FxProps = { uid: string; tier: MedalTier; wide: boolean; animated: boolean };

/** O contorno do escudo — o brilho que o varre fica recortado a ele. */
export const SHIELD_PATH = "M36 14 H84 V45 C84 58 73 66.5 60 71 C47 66.5 36 58 36 45 Z";

/** Paletas das peles: degradê do desenho, fundo do escudo, medalhão, brilho. */
export const FX_PALETTES: Record<
  MedalFx,
  { stops: Array<[string, string]>; bg: string; inner: string; stroke: string; glow: string; glow2: string; accent: string }
> = {
  estelar: {
    stops: [
      ["0", "#FF7AD9"],
      ["0.36", "#B678FF"],
      ["0.7", "#62E6FF"],
      ["1", "#FFF07A"],
    ],
    bg: "#1A0B2E",
    inner: "rgba(255,122,217,0.12)",
    stroke: "#FF9BE6",
    glow: "rgba(255,110,220,0.75)",
    glow2: "rgba(98,230,255,0.45)",
    accent: "#FFFFFF",
  },
  lendaria: {
    stops: [
      ["0", "#FFFBE0"],
      ["0.4", "#FFD23F"],
      ["0.78", "#FF9F1C"],
      ["1", "#FF7A1A"],
    ],
    bg: "#061D17",
    inner: "rgba(92,255,200,0.1)",
    stroke: "#FFD23F",
    glow: "rgba(255,196,60,0.8)",
    glow2: "rgba(92,255,200,0.5)",
    accent: "#5CFFC8",
  },
};

function Star4({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  const i = r * 0.34;
  return (
    <polygon
      points={`${x},${y - r} ${x + i},${y - i} ${x + r},${y} ${x + i},${y + i} ${x},${y + r} ${x - i},${y + i} ${x - r},${y} ${x - i},${y - i}`}
      fill={fill}
    />
  );
}

/** Estrela de cinco pontas centrada em (0,0) — tabela fixa, raio 1. */
const STAR5 = [
  [0, -1],
  [0.26, -0.36],
  [0.95, -0.31],
  [0.43, 0.14],
  [0.59, 0.81],
  [0, 0.45],
  [-0.59, 0.81],
  [-0.43, 0.14],
  [-0.95, -0.31],
  [-0.26, -0.36],
];

function Star5({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  return <polygon points={STAR5.map(([a, b]) => `${(x + a * r).toFixed(2)},${(y + b * r).toFixed(2)}`).join(" ")} fill={fill} />;
}

const HEART = "M0,2.4 C-3.2,0.2 -3.6,-1.5 -2.2,-2.5 C-1.1,-3.2 0,-2.4 0,-1.5 C0,-2.4 1.1,-3.2 2.2,-2.5 C3.6,-1.5 3.2,0.2 0,2.4 Z";

/** Elipse fechada centrada em (cx,cy) para o animateMotion. `cw` = sentido
 *  dos ponteiros do relógio. */
function ellipse(cx: number, cy: number, rx: number, ry: number, cw = true): string {
  const s = cw ? 1 : 0;
  return `M${cx - rx},${cy} A${rx},${ry} 0 1 ${s} ${cx + rx},${cy} A${rx},${ry} 0 1 ${s} ${cx - rx},${cy}`;
}

/** Cauda de cometa / estrela cadente, a apontar para trás (−x). */
function Tail({ len, w, fill }: { len: number; w: number; fill: string }) {
  return <polygon points={`0,${-w} ${-len},0 0,${w}`} fill={fill} />;
}

// ---------------------------------------------------------------------------
// Estelar — NPS Perfeito
// ---------------------------------------------------------------------------

const STAR_COLORS = ["#FFFFFF", "#FF7AD9", "#62E6FF", "#FFF07A", "#B678FF", "#FFFFFF"];

/** Céu de pontinhos à volta (dx relativo a 60; num desenho largo, ×1,4). */
const STARFIELD = [
  { dx: -34, y: 6, r: 0.8, c: "#FFFFFF", d: 0 },
  { dx: 30, y: 4, r: 0.7, c: "#62E6FF", d: -0.5 },
  { dx: -40, y: 28, r: 0.6, c: "#FF7AD9", d: -1.1 },
  { dx: 41, y: 24, r: 0.9, c: "#FFFFFF", d: -0.2 },
  { dx: -37, y: 52, r: 0.7, c: "#FFF07A", d: -1.6 },
  { dx: 38, y: 56, r: 0.6, c: "#B678FF", d: -0.8 },
  { dx: -24, y: 76, r: 0.8, c: "#62E6FF", d: -1.3 },
  { dx: 22, y: 77, r: 0.7, c: "#FFFFFF", d: -0.4 },
  { dx: -14, y: -2, r: 0.6, c: "#FFF07A", d: -1.9 },
  { dx: 15, y: -3, r: 0.8, c: "#FF7AD9", d: -1.0 },
  { dx: -44, y: 40, r: 0.5, c: "#FFFFFF", d: -0.7 },
  { dx: 45, y: 42, r: 0.6, c: "#62E6FF", d: -1.4 },
];

/** Posições paradas das estrelas em órbita (PNG): pontos da elipse. */
const ORBIT_STATIC = [
  { ax: -0.98, ay: -0.2 },
  { ax: 0.55, ay: -0.84 },
  { ax: 0.96, ay: 0.3 },
  { ax: -0.5, ay: 0.87 },
  { ax: 0.2, ay: 0.98 },
  { ax: -0.7, ay: -0.71 },
];

export function StellarBack({ uid, tier, wide, animated }: FxProps) {
  const spread = wide ? 1.4 : 1;
  const ringR = wide ? 47 : 37;
  return (
    <g>
      <defs>
        <radialGradient id={`nh${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FF7AD9" stopOpacity="0.55" />
          <stop offset="0.55" stopColor="#8B5CFF" stopOpacity="0.22" />
          <stop offset="1" stopColor="#62E6FF" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Nebulosa */}
      <circle cx="60" cy="40" r={wide ? 50 : 41} fill={`url(#nh${uid})`}>
        {animated && <animate attributeName="opacity" values="0.6;1;0.6" dur="3s" repeatCount="indefinite" />}
      </circle>
      {/* Anel holográfico a rodar devagar */}
      <g {...(animated ? { className: "medal-fx" } : {})}>
        {animated && <animateTransform attributeName="transform" type="rotate" from="0 60 40" to="360 60 40" dur="22s" repeatCount="indefinite" />}
        <circle cx="60" cy="40" r={ringR} fill="none" stroke={`url(#mg${uid})`} strokeWidth={0.9} strokeDasharray="2 5" strokeLinecap="round" opacity={0.7} />
      </g>
      {/* Céu de pontinhos */}
      <g>
        {STARFIELD.slice(0, 6 + tier * 2).map((s, i) => (
          <circle key={i} cx={60 + s.dx * spread} cy={s.y} r={s.r} fill={s.c}>
            {animated && <animate attributeName="opacity" values="0.15;1;0.15" dur="2.2s" begin={`${s.d}s`} repeatCount="indefinite" />}
          </circle>
        ))}
      </g>
    </g>
  );
}

export function StellarFront({ uid, tier, wide, animated }: FxProps) {
  const rx = wide ? 57 : 40;
  const ry = 39;
  const nOrbit = tier >= 5 ? 6 : tier >= 4 ? 5 : 4;
  const nShooting = Math.max(1, tier - 2);
  if (!animated) {
    return (
      <g>
        {ORBIT_STATIC.slice(0, nOrbit).map((p, i) => (
          <Star5 key={i} x={60 + p.ax * rx} y={40 + p.ay * ry} r={i % 2 ? 2.4 : 3.2} fill={STAR_COLORS[i]} />
        ))}
      </g>
    );
  }
  const orbit = ellipse(60, 40, rx, ry);
  const dur = 7;
  const inner = ellipse(0, 0, wide ? 47 : 33, 24, false);
  return (
    <g className="medal-fx">
      <defs>
        <linearGradient id={`nt${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.95" />
        </linearGradient>
      </defs>

      {/* Estrelas em órbita — a voar à volta, a rodar e a cintilar */}
      {Array.from({ length: nOrbit }, (_, i) => (
        <g key={`o${i}`}>
          <animateMotion path={orbit} dur={`${dur}s`} begin={`${(-(i * dur) / nOrbit).toFixed(2)}s`} repeatCount="indefinite" />
          <g>
            <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur={`${2.4 + (i % 3) * 0.7}s`} repeatCount="indefinite" />
            <Star5 x={0} y={0} r={i % 2 ? 2.5 : 3.4} fill={STAR_COLORS[i % STAR_COLORS.length]} />
          </g>
          <animate attributeName="opacity" values="0.55;1;0.55" dur="1.4s" begin={`${-i * 0.35}s`} repeatCount="indefinite" />
        </g>
      ))}

      {/* Segunda órbita, inclinada e ao contrário */}
      <g transform="translate(60 40) rotate(-22)">
        {Array.from({ length: 3 }, (_, i) => (
          <g key={`c${i}`}>
            <animateMotion path={inner} dur="4.8s" begin={`${(-i * 1.6).toFixed(1)}s`} repeatCount="indefinite" />
            <Star4 x={0} y={0} r={i === 1 ? 2.6 : 2} fill={i === 1 ? "#62E6FF" : "#FFF07A"} />
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" begin={`${-i * 0.4}s`} repeatCount="indefinite" />
          </g>
        ))}
      </g>

      {/* Estrelas cadentes */}
      {[
        { from: [60 - (wide ? 74 : 52), -10], to: [60 + (wide ? 70 : 50), 30], dur: 3.4, begin: 0 },
        { from: [60 + (wide ? 72 : 50), -6], to: [60 - (wide ? 66 : 46), 44], dur: 4.2, begin: -1.6 },
        { from: [60 - (wide ? 70 : 50), 48], to: [60 + (wide ? 74 : 54), 6], dur: 5, begin: -3.1 },
      ]
        .slice(0, nShooting)
        .map((s, i) => (
          <g key={`s${i}`} opacity={0}>
            <animateMotion
              path={`M${s.from[0]},${s.from[1]} L${s.to[0]},${s.to[1]}`}
              dur={`${s.dur}s`}
              begin={`${s.begin}s`}
              repeatCount="indefinite"
              rotate="auto"
              keyPoints="0;1;1"
              keyTimes="0;0.3;1"
              calcMode="linear"
            />
            <animate attributeName="opacity" values="0;1;0;0" keyTimes="0;0.08;0.3;1" dur={`${s.dur}s`} begin={`${s.begin}s`} repeatCount="indefinite" />
            <Tail len={20} w={1.1} fill={`url(#nt${uid})`} />
            <Star4 x={0} y={0} r={2.8} fill="#FFFFFF" />
          </g>
        ))}

      {/* Corações a subir dos lados */}
      {[
        { x: 60 - (wide ? 44 : 31), dur: 3.6, begin: 0 },
        { x: 60 + (wide ? 46 : 32), dur: 4.1, begin: -1.9 },
      ].map((h, i) => (
        <g key={`h${i}`} opacity={0}>
          <animateMotion path={`M${h.x},74 Q${h.x + (i ? -6 : 6)},44 ${h.x},12`} dur={`${h.dur}s`} begin={`${h.begin}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;0.95;0.8;0" keyTimes="0;0.2;0.7;1" dur={`${h.dur}s`} begin={`${h.begin}s`} repeatCount="indefinite" />
          <path d={HEART} fill="#FF7AD9" />
        </g>
      ))}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Lendária — Rigor
// ---------------------------------------------------------------------------

const GOLD = "#FFD23F";
const MINT = "#5CFFC8";

/** Faíscas a subir: dx relativo a 60 (fora do escudo), deriva, raio,
 *  duração, atraso e cor. Num desenho largo afastam-se ×1,35. */
const EMBERS = [
  { dx: -27, drift: -6, r: 1.3, dur: 2.8, begin: 0, c: GOLD },
  { dx: 26, drift: 5, r: 1.1, dur: 3.3, begin: -1.1, c: MINT },
  { dx: -31, drift: 4, r: 0.9, dur: 3.9, begin: -2.3, c: MINT },
  { dx: 30, drift: -5, r: 1.4, dur: 2.5, begin: -0.6, c: GOLD },
  { dx: -22, drift: -3, r: 1, dur: 3.5, begin: -1.8, c: GOLD },
  { dx: 23, drift: 6, r: 0.8, dur: 4.2, begin: -3, c: MINT },
  { dx: -35, drift: 3, r: 1.2, dur: 3.1, begin: -2.7, c: GOLD },
  { dx: 34, drift: -2, r: 1, dur: 3.7, begin: -0.3, c: MINT },
  { dx: -18, drift: -5, r: 0.9, dur: 2.9, begin: -1.5, c: MINT },
  { dx: 19, drift: 4, r: 1.2, dur: 3.4, begin: -2.1, c: GOLD },
  { dx: -40, drift: 2, r: 0.8, dur: 4.4, begin: -3.6, c: GOLD },
  { dx: 39, drift: -4, r: 0.9, dur: 4, begin: -1.3, c: MINT },
  { dx: -12, drift: 3, r: 0.7, dur: 3.2, begin: -0.9, c: GOLD },
  { dx: 13, drift: -3, r: 0.8, dur: 3.8, begin: -2.5, c: MINT },
];

/** Cintilações paradas no sítio (dx relativo a 60; ×1,45 num desenho largo). */
const GLINTS = [
  { dx: -30, y: 8, r: 3.2, d: 0, c: "#FFFBE0" },
  { dx: 31, y: 13, r: 2.6, d: -0.7, c: MINT },
  { dx: -27, y: 64, r: 2.4, d: -1.3, c: MINT },
  { dx: 28, y: 66, r: 3, d: -0.4, c: "#FFFBE0" },
  { dx: 0, y: -5, r: 2.8, d: -1, c: GOLD },
  { dx: -37, y: 36, r: 2.2, d: -1.6, c: GOLD },
  { dx: 37, y: 40, r: 2.4, d: -0.2, c: "#FFFBE0" },
];

const COMETS = [
  { tilt: -16, dur: 3.6, begin: 0, c: "#FFFBE0" },
  { tilt: 24, dur: 4.6, begin: -2.2, c: MINT },
  { tilt: -62, dur: 5.4, begin: -1, c: GOLD },
];

export function LegendaryBack({ uid, tier, wide, animated }: FxProps) {
  const rays = 10 + tier * 2;
  const ringA = wide ? 45 : 36.5;
  const ringB = wide ? 49.5 : 40;
  return (
    <g>
      <defs>
        <radialGradient id={`lh${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFE27A" stopOpacity="0.6" />
          <stop offset="0.5" stopColor={MINT} stopOpacity="0.2" />
          <stop offset="1" stopColor={MINT} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`lr${uid}`} gradientUnits="userSpaceOnUse" x1="60" y1="40" x2="60" y2="-14">
          <stop offset="0" stopColor="#FFE27A" stopOpacity="0.95" />
          <stop offset="1" stopColor="#FFE27A" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Halo de ouro e esmeralda */}
      <circle cx="60" cy="40" r={wide ? 52 : 43} fill={`url(#lh${uid})`}>
        {animated && <animate attributeName="opacity" values="0.55;1;0.55" dur="2.6s" repeatCount="indefinite" />}
      </circle>
      {/* Raios — longos e curtos, a rodar devagar */}
      <g opacity={0.7}>
        {animated && <animateTransform attributeName="transform" type="rotate" from="0 60 40" to="360 60 40" dur="28s" repeatCount="indefinite" />}
        {Array.from({ length: rays }, (_, i) => (
          <polygon
            key={i}
            points={i % 2 ? "60,40 58.9,2 61.1,2" : "60,40 57.7,-14 62.3,-14"}
            fill={`url(#lr${uid})`}
            transform={`rotate(${((i * 360) / rays).toFixed(2)} 60 40)`}
          />
        ))}
      </g>
      {/* Anéis de runas, em sentidos opostos */}
      <g {...(animated ? { className: "medal-fx" } : {})}>
        {animated && <animateTransform attributeName="transform" type="rotate" from="0 60 40" to="360 60 40" dur="14s" repeatCount="indefinite" />}
        <circle cx="60" cy="40" r={ringA} fill="none" stroke={MINT} strokeWidth={1.1} strokeDasharray="0.6 3.2" strokeLinecap="round" opacity={0.85} />
      </g>
      <g {...(animated ? { className: "medal-fx" } : {})}>
        {animated && <animateTransform attributeName="transform" type="rotate" from="360 60 40" to="0 60 40" dur="20s" repeatCount="indefinite" />}
        <circle cx="60" cy="40" r={ringB} fill="none" stroke={GOLD} strokeWidth={0.9} strokeDasharray="8 3 1.5 3" opacity={0.6} />
      </g>
    </g>
  );
}

export function LegendaryFront({ uid, tier, wide, animated }: FxProps) {
  const spread = wide ? 1.35 : 1;
  const glintSpread = wide ? 1.45 : 1;
  const nEmbers = 6 + tier * 2;
  const nComets = tier >= 4 ? 3 : 2;
  if (!animated) {
    return (
      <g>
        {GLINTS.map((g, i) => (
          <Star4 key={`g${i}`} x={60 + g.dx * glintSpread} y={g.y} r={g.r} fill={g.c} />
        ))}
        {EMBERS.slice(0, nEmbers).map((e, i) => (
          <circle key={`e${i}`} cx={60 + e.dx * spread} cy={18 + ((i * 37) % 50)} r={e.r} fill={e.c} opacity={0.85} />
        ))}
      </g>
    );
  }
  const rx = wide ? 58 : 41;
  const ry = wide ? 29 : 27;
  return (
    <g className="medal-fx">
      <defs>
        <clipPath id={`lc${uid}`}>
          <path d={SHIELD_PATH} />
        </clipPath>
        <linearGradient id={`lw${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        {COMETS.map((c, i) => (
          <linearGradient key={i} id={`lt${uid}${i}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={c.c} stopOpacity="0" />
            <stop offset="1" stopColor={c.c} stopOpacity="0.9" />
          </linearGradient>
        ))}
      </defs>

      {/* Brilho a varrer o escudo */}
      <g clipPath={`url(#lc${uid})`}>
        <rect x="20" y="-10" width="15" height="100" fill={`url(#lw${uid})`} transform="rotate(22 60 40)">
          <animateTransform attributeName="transform" type="translate" values="-34 0;72 0;72 0" keyTimes="0;0.42;1" dur="3.2s" repeatCount="indefinite" additive="sum" />
        </rect>
      </g>

      {/* Faíscas a subir dos lados */}
      {EMBERS.slice(0, nEmbers).map((e, i) => {
        const x = 60 + e.dx * spread;
        return (
          <g key={`e${i}`} opacity={0}>
            <animateMotion path={`M${x},76 Q${x + e.drift},38 ${x},-2`} dur={`${e.dur}s`} begin={`${e.begin}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;0.9;0" keyTimes="0;0.15;0.65;1" dur={`${e.dur}s`} begin={`${e.begin}s`} repeatCount="indefinite" />
            <polygon points={`0,${-e.r * 1.7} ${e.r},0 0,${e.r * 1.7} ${-e.r},0`} fill={e.c} />
          </g>
        );
      })}

      {/* Cometas em órbita inclinada */}
      {COMETS.slice(0, nComets).map((c, i) => (
        <g key={`c${i}`} transform={`translate(60 40) rotate(${c.tilt})`}>
          <g>
            <animateMotion path={ellipse(0, 0, rx, ry)} dur={`${c.dur}s`} begin={`${c.begin}s`} repeatCount="indefinite" rotate="auto" />
            <Tail len={17} w={1.5} fill={`url(#lt${uid}${i})`} />
            <circle cx="0" cy="0" r="3.4" fill={c.c} opacity={0.35} />
            <circle cx="0" cy="0" r="1.7" fill="#FFFFFF" />
          </g>
        </g>
      ))}

      {/* Cintilações */}
      {GLINTS.map((g, i) => {
        const x = 60 + g.dx * glintSpread;
        return (
          <g key={`g${i}`} opacity={0}>
            <animate attributeName="opacity" values="0;1;0" dur="1.7s" begin={`${g.d}s`} repeatCount="indefinite" />
            <animateTransform attributeName="transform" type="rotate" from={`0 ${x} ${g.y}`} to={`90 ${x} ${g.y}`} dur="1.7s" begin={`${g.d}s`} repeatCount="indefinite" />
            <Star4 x={x} y={g.y} r={g.r} fill={g.c} />
          </g>
        );
      })}
    </g>
  );
}
