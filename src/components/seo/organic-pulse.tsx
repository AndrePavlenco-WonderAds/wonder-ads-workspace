"use client";

// Etiqueta «organic · 30d» do SEO DPT + painel em hover (v77.17).
//
// A pílula fica na linha dos «clients», do tamanho de sempre: número a
// contar, «organic · 30d», variação face aos 30 dias anteriores e uma
// mini-curva. Ao passar o rato (ou focar, ou tocar) abre por baixo o
// «Pulso orgânico» inteiro da v77.14 — o total em grande, a diferença em
// visitantes, a curva diária, e os três indicadores de equipa — que era
// bom demais para deitar fora mas grande demais para viver sempre aberto.
//
// O painel vai por portal para o <body>: o cabeçalho do departamento anima
// com transform, o que cria um contexto de empilhamento, e um z-index lá
// dentro nunca passaria por cima dos cartões da board.

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownRight,
  ArrowUpRight,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

export type OrganicPulseProps = {
  /** Visitantes orgânicos (GA4 totalUsers · Organic Search), últimos 30 dias. */
  total: number;
  /** O mesmo, nos 30 dias anteriores. */
  prevTotal: number;
  /** Sessões orgânicas por dia, do dia mais antigo até ontem. */
  daily: number[];
  clientsWithData: number;
  /** Clientes cujo valor foi transportado de uma leitura anterior. */
  clientsStale: number;
  computedAt: number | null;
  /** Clientes com mais visitas do que no período anterior… */
  growing: number;
  /** …entre os que têm período anterior comparável. */
  comparable: number;
  topClimber: { name: string; pct: number } | null;
};

const fmt = (n: number) => Math.round(n).toLocaleString("en-GB");

/** Quanto tempo o painel sobrevive depois de o rato sair — o suficiente
 *  para atravessar o intervalo entre a pílula e o painel. */
const CLOSE_DELAY_MS = 180;

export function OrganicPulse(props: OrganicPulseProps) {
  const { total, prevTotal, daily } = props;
  const id = useId().replace(/:/g, "");
  const panelId = `organic-panel-${id}`;
  const hasData = total > 0;
  const shown = useCountUp(hasData ? total : 0);
  const delta = hasData && prevTotal > 0 ? total - prevTotal : null;
  const pct = delta !== null ? (delta / prevTotal) * 100 : null;

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<number | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }, [cancelClose]);
  const openNow = useCallback(() => {
    cancelClose();
    setOpen(true);
  }, [cancelClose]);

  useEffect(() => cancelClose, [cancelClose]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Onde pousar o painel: por baixo da pílula, alinhado à esquerda da linha
  // dos badges, sem sair do ecrã. Coordenadas do documento (o portal vive
  // no body), recalculadas ao redimensionar.
  const [anchor, setAnchor] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const place = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const chip = wrap.getBoundingClientRect();
    const row = (wrap.parentElement ?? wrap).getBoundingClientRect();
    const vw = window.innerWidth;
    const width = Math.min(880, vw - 32);
    const left = Math.max(16, Math.min(row.left, vw - width - 16));
    setAnchor({
      top: chip.bottom + 12 + window.scrollY,
      left: left + window.scrollX,
      width,
    });
  }, []);
  useEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, place]);

  return (
    <span
      ref={wrapRef}
      className="inline-flex"
      onMouseEnter={openNow}
      onMouseLeave={scheduleClose}
      onFocus={openNow}
      onBlur={(e) => {
        if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) {
          scheduleClose();
        }
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={
          hasData
            ? `${fmt(total)} visitantes orgânicos nos últimos 30 dias — abrir detalhe`
            : "Tráfego orgânico — ainda sem dados"
        }
        onClick={() => setOpen((o) => !o)}
        className="animate-count-pop inline-flex cursor-default items-center gap-2.5 rounded-full border border-emerald-400/35 bg-emerald-500/[0.10] px-3 py-1.5 text-emerald-100 backdrop-blur-md transition-all duration-300 hover:scale-[1.03] hover:border-emerald-400/60 hover:bg-emerald-500/[0.16] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60"
      >
        <TrendingUp className="h-3.5 w-3.5 text-emerald-300" strokeWidth={2.5} />
        <span className="text-base font-bold leading-none tracking-tight tabular-nums">
          {hasData ? fmt(shown) : "—"}
        </span>
        <span className="text-base font-medium uppercase leading-none tracking-[0.16em] text-emerald-200/80">
          organic · 30d
        </span>
        {pct !== null && (
          <>
            <span aria-hidden className="h-4 w-px bg-emerald-300/25" />
            <span
              className={`inline-flex items-center gap-0.5 text-sm font-semibold leading-none tabular-nums ${
                pct >= 0 ? "text-emerald-200" : "text-rose-300"
              }`}
            >
              {pct >= 0 ? (
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              )}
              {pctLabel(pct)}
            </span>
          </>
        )}
        {hasData && daily.length > 1 && (
          <>
            <span aria-hidden className="h-4 w-px bg-emerald-300/25" />
            <MiniSparkline daily={daily} id={`${id}-mini`} />
          </>
        )}
      </button>

      {open &&
        anchor &&
        createPortal(
          <OrganicPanel
            {...props}
            id={panelId}
            svgId={`${id}-panel`}
            anchor={anchor}
            onEnter={openNow}
            onLeave={scheduleClose}
          />,
          document.body,
        )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Painel — o «Pulso orgânico» da v77.14, agora só em hover
// ---------------------------------------------------------------------------

function OrganicPanel({
  id,
  svgId,
  total,
  prevTotal,
  daily,
  clientsWithData,
  clientsStale,
  computedAt,
  growing,
  comparable,
  topClimber,
  anchor,
  onEnter,
  onLeave,
}: OrganicPulseProps & {
  id: string;
  svgId: string;
  anchor: { top: number; left: number; width: number };
  onEnter: () => void;
  onLeave: () => void;
}) {
  const hasData = total > 0;
  const shown = useCountUp(hasData ? total : 0, 1500);
  const delta = hasData && prevTotal > 0 ? total - prevTotal : null;
  const pct = delta !== null ? (delta / prevTotal) * 100 : null;
  const yesterday = daily.length ? daily[daily.length - 1] : 0;
  const peak = daily.length ? Math.max(...daily) : 0;

  return (
    <div
      id={id}
      role="group"
      aria-label="Tráfego orgânico do departamento — detalhe"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ top: anchor.top, left: anchor.left, width: anchor.width }}
      className="organic-panel-in absolute z-[70] overflow-hidden rounded-[28px] border border-emerald-400/25 bg-[#0c1117]/95 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.85),0_30px_80px_-40px_rgba(52,211,153,0.45)] backdrop-blur-xl"
    >
      <div
        aria-hidden
        className="animate-orb-pulse pointer-events-none absolute -left-32 -top-44 h-[22rem] w-[22rem] rounded-full bg-emerald-500/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-52 -right-32 h-[22rem] w-[22rem] rounded-full opacity-30 blur-3xl"
        style={{ background: "var(--brand-gradient)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden"
      >
        <div className="organic-sweep h-full w-1/2 bg-gradient-to-r from-transparent via-emerald-300/90 to-transparent" />
      </div>

      <div className="relative grid gap-6 p-6 sm:p-7 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-center md:gap-10">
        {/* ---------- Esquerda: o número ---------- */}
        <div className="flex flex-col">
          <div
            className="organic-rise flex flex-wrap items-center gap-x-3 gap-y-1"
            style={{ animationDelay: "0ms" }}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)]" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200/85">
              Tráfego orgânico · últimos 30 dias
            </span>
            <UpdatedAgo at={computedAt} />
          </div>

          <div
            className="organic-rise mt-4 flex flex-wrap items-end gap-x-4 gap-y-3"
            style={{ animationDelay: "100ms" }}
          >
            <span className="text-5xl font-bold leading-[0.9] tracking-[-0.035em] text-white tabular-nums sm:text-6xl">
              {hasData ? fmt(shown) : "—"}
            </span>
            {pct !== null && delta !== null && (
              <DeltaChip pct={pct} delta={delta} />
            )}
          </div>

          <p
            className="organic-rise mt-4 max-w-md text-sm text-white/65 sm:text-base"
            style={{ animationDelay: "200ms" }}
          >
            {hasData ? (
              <>
                Pessoas que chegaram aos nossos clientes pelo Google e pelas
                IAs.{" "}
                <span className="text-white/85">
                  Sem pagar um cêntimo por clique.
                </span>
              </>
            ) : (
              "A recolher os dados do GA4 dos clientes — volta a abrir daqui a uns minutos."
            )}
          </p>

          {hasData && (
            <p
              className="organic-rise mt-2.5 text-sm font-medium text-emerald-200/90"
              style={{ animationDelay: "300ms" }}
            >
              {motivation(pct)}
            </p>
          )}

          <p
            className="organic-rise mt-5 text-xs text-white/40"
            style={{ animationDelay: "400ms" }}
          >
            {clientsWithData} {clientsWithData === 1 ? "cliente" : "clientes"}{" "}
            com GA4 ligado · soma real, nunca estimada
            {clientsStale > 0 && (
              <>
                {" "}
                · {clientsStale} com o último valor conhecido
              </>
            )}
          </p>
        </div>

        {/* ---------- Direita: a curva e os indicadores ---------- */}
        <div className="flex flex-col gap-3">
          <div
            className="organic-rise rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            style={{ animationDelay: "160ms" }}
          >
            <div className="flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              <span>Sessões orgânicas por dia</span>
              {peak > 0 && (
                <span className="tabular-nums text-emerald-200/70">
                  pico {fmt(peak)}
                </span>
              )}
            </div>
            <PanelSparkline daily={daily} id={svgId} />
            <div className="mt-2 flex justify-between text-[11px] text-white/35">
              <span>há 30 dias</span>
              <span>ontem</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Tile
              delay={260}
              Icon={Users}
              label="A crescer"
              value={comparable > 0 ? `${growing}/${comparable}` : "—"}
              hint={
                comparable > 0
                  ? "clientes acima dos 30 dias anteriores"
                  : "sem período anterior comparável"
              }
            />
            <Tile
              delay={330}
              Icon={Trophy}
              label="Maior subida"
              value={topClimber ? `+${pctLabel(topClimber.pct)}` : "—"}
              hint={topClimber ? topClimber.name : "à espera de mais dados"}
              accent
            />
            <Tile
              delay={400}
              Icon={Zap}
              label="Ontem"
              value={fmt(yesterday)}
              hint="sessões orgânicas, todos os clientes"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function motivation(pct: number | null): string {
  if (pct === null) {
    return "Cada uma destas visitas é trabalho da equipa a chegar a pessoas reais.";
  }
  if (pct >= 10) {
    return "A equipa está a acelerar. Isto é SEO a dar fruto — continua.";
  }
  if (pct >= 0) {
    return "A crescer, mês após mês. Consistência é o que ganha o jogo do orgânico.";
  }
  return "Mês a puxar. Os rankings recuperam-se com trabalho — e é aqui que se vê.";
}

function pctLabel(pct: number): string {
  const abs = Math.abs(pct);
  return `${abs >= 100 ? Math.round(abs) : abs.toFixed(1)}%`;
}

function DeltaChip({ pct, delta }: { pct: number; delta: number }) {
  const up = pct >= 0;
  return (
    <span className="mb-1.5 flex flex-col gap-1">
      <span
        className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-semibold tabular-nums ${
          up
            ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200 shadow-[0_0_24px_-6px_rgba(52,211,153,0.6)]"
            : "border-rose-400/40 bg-rose-500/15 text-rose-200"
        }`}
      >
        {up ? (
          <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
        ) : (
          <ArrowDownRight className="h-4 w-4" strokeWidth={2.5} />
        )}
        {up ? "+" : "−"}
        {pctLabel(pct)}
        <span className="font-normal text-white/50">vs. 30 dias anteriores</span>
      </span>
      <span className="pl-1 text-xs tabular-nums text-white/45">
        {up ? "+" : "−"}
        {fmt(Math.abs(delta))} visitantes
      </span>
    </span>
  );
}

function Tile({
  delay,
  Icon,
  label,
  value,
  hint,
  accent = false,
}: {
  delay: number;
  Icon: typeof Users;
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`organic-rise min-w-0 rounded-2xl border p-3.5 transition-colors duration-300 ${
        accent
          ? "border-emerald-400/25 bg-emerald-500/[0.07] hover:border-emerald-400/45 hover:bg-emerald-500/[0.11]"
          : "border-white/10 bg-white/[0.03] hover:border-emerald-400/30 hover:bg-emerald-500/[0.06]"
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
        <Icon className="h-3.5 w-3.5 text-emerald-300" strokeWidth={2.25} />
        {label}
      </div>
      <div className="mt-1.5 truncate text-xl font-bold tabular-nums text-white">
        {value}
      </div>
      <div
        className="mt-0.5 line-clamp-2 text-xs leading-snug text-white/45"
        title={hint}
      >
        {hint}
      </div>
    </div>
  );
}

/** «atualizado há 12 min» — calculado só depois de montar, para o servidor e
 *  o browser não discordarem do relógio. */
function UpdatedAgo({ at }: { at: number | null }) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!at) return;
    const update = () => {
      const mins = Math.max(0, Math.round((Date.now() - at) / 60_000));
      setLabel(
        mins < 1
          ? "atualizado agora"
          : mins < 60
            ? `atualizado há ${mins} min`
            : `atualizado há ${Math.round(mins / 60)} h`,
      );
    };
    update();
    const t = window.setInterval(update, 60_000);
    return () => window.clearInterval(t);
  }, [at]);
  if (!label) return null;
  return <span className="ml-auto text-xs text-white/40">{label}</span>;
}

/** Contagem animada até ao alvo (easeOutExpo). Respeita o pedido de menos
 *  animação do sistema: salta logo para o valor final. */
function useCountUp(target: number, duration = 1400): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target <= 0) {
      setValue(0);
      return;
    }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

// ---------------------------------------------------------------------------
// Curvas
// ---------------------------------------------------------------------------

type Pt = { x: number; y: number };

/** Curva suave: quadráticas até ao ponto médio de cada par, controladas
 *  pelo próprio ponto — sem picos serrilhados, sem biblioteca. */
function smoothPath(pts: Pt[], height: number): { line: string; area: string } {
  if (pts.length === 0) return { line: "", area: "" };
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const q = pts[i];
    d += ` Q${p.x.toFixed(1)} ${p.y.toFixed(1)} ${((p.x + q.x) / 2).toFixed(1)} ${((p.y + q.y) / 2).toFixed(1)}`;
  }
  const end = pts[pts.length - 1];
  d += ` L${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
  return {
    line: d,
    area: `${d} L${end.x.toFixed(1)} ${height} L${pts[0].x.toFixed(1)} ${height} Z`,
  };
}

function toPoints(daily: number[], w: number, h: number, pad: number): Pt[] {
  const n = daily.length;
  const max = Math.max(1, ...daily);
  return daily.map((v, i) => ({
    x: pad + (n > 1 ? (i / (n - 1)) * (w - pad * 2) : (w - pad * 2) / 2),
    y: h - pad - (v / max) * (h - pad * 2),
  }));
}

/** Mini-curva da pílula, 72×18. Só forma. */
function MiniSparkline({ daily, id }: { daily: number[]; id: string }) {
  const W = 72;
  const H = 18;
  const { line, area } = useMemo(
    () => smoothPath(toPoints(daily, W, H, 2), H),
    [daily],
  );
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="shrink-0" aria-hidden>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id}-fill)`} className="organic-fill-in" />
      <path
        d={line}
        fill="none"
        stroke="#6ee7b7"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        className="organic-draw"
      />
    </svg>
  );
}

/** Curva do painel, com linhas de grelha e o ponto de «ontem» a pulsar. */
function PanelSparkline({ daily, id }: { daily: number[]; id: string }) {
  const W = 320;
  const H = 96;
  const PAD = 6;
  const { line, area, last } = useMemo(() => {
    const pts = toPoints(daily, W, H, PAD);
    const { line, area } = smoothPath(pts, H);
    return {
      line,
      area,
      last: pts.length ? pts[pts.length - 1] : { x: W - PAD, y: H - PAD },
    };
  }, [daily]);

  return (
    <div className="relative mt-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-20 w-full sm:h-24"
        aria-hidden
      >
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}-stroke`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#5eead4" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#6ee7b7" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PAD}
            x2={W - PAD}
            y1={H - PAD - f * (H - PAD * 2)}
            y2={H - PAD - f * (H - PAD * 2)}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="2 4"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {area && (
          <path d={area} fill={`url(#${id}-fill)`} className="organic-fill-in" />
        )}
        {line && (
          <path
            d={line}
            fill="none"
            stroke={`url(#${id}-stroke)`}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            vectorEffect="non-scaling-stroke"
            className="organic-draw"
          />
        )}
      </svg>
      <span
        aria-hidden
        className="organic-fill-in absolute flex h-3 w-3 -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${(last.x / W) * 100}%`, top: `${(last.y / H) * 100}%` }}
      >
        <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-60" />
        <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-[#0c1117] bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.95)]" />
      </span>
    </div>
  );
}
