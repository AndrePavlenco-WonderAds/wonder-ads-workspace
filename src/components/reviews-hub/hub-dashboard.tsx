"use client";

// Dashboard — a média, o que falta responder, a evolução mês a mês e o
// ranking dos salões. Segue o salão escolhido na barra lateral.

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  Bot,
  CircleCheck,
  Clock,
  MessageSquareText,
  RefreshCw,
  Settings2,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { isNegative } from "@/lib/reviews-hub/stats";
import type { HubActivityKind, StarLevel } from "@/lib/reviews-hub/types";
import { useHub } from "./hub-context";
import {
  Avatar,
  CountUp,
  LEVELS,
  Panel,
  Skeleton,
  StarRow,
  STAR_GOLD,
  formatRating,
  levelOf,
  monthLabel,
  pct,
  relativeTime,
} from "./hub-ui";

export function DashboardView() {
  const { loaded, data, syncing } = useHub();
  if (!loaded) return <DashboardSkeleton />;
  if (data.reviews.length === 0) return <EmptyState syncing={syncing} />;
  return (
    <div className="space-y-5">
      <KpiRow />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Distribution />
        <TrendChart />
      </div>
      <SalonsTable />
      <div className="grid gap-5 xl:grid-cols-2">
        <NeedsAttention />
        <ActivityFeed />
      </div>
    </div>
  );
}

// ── KPIs ──────────────────────────────────────────────────────────────
function KpiRow() {
  const { stats, go } = useHub();
  const delta = stats.prev30 > 0 ? (stats.last30 - stats.prev30) / stats.prev30 : null;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi delay={0} label="Média no Google" glow="rgba(251,191,36,0.20)">
        <div className="flex items-end gap-3">
          <CountUp value={stats.average ?? 0} decimals={1} className="text-[44px] font-semibold leading-none tracking-tight" />
          <span className="mb-1.5">
            <StarRow value={stats.average ?? 0} size={16} animateIn />
          </span>
        </div>
        <p className="mt-3 text-[13px] text-white/45">
          em <span className="font-semibold text-white/75">{stats.total.toLocaleString("pt-PT")}</span> reviews
        </p>
      </Kpi>

      <Kpi
        delay={0.05}
        label="Por responder"
        glow={stats.negativeUnanswered ? "rgba(251,113,133,0.22)" : "rgba(52,211,153,0.16)"}
        onClick={() => go("reviews", { tab: "pending" })}
      >
        <CountUp value={stats.unanswered} className="text-[44px] font-semibold leading-none tracking-tight" />
        <p className="mt-3 text-[13px] text-white/45">
          {stats.negativeUnanswered > 0 ? (
            <>
              <span className="font-semibold text-rose-300">{stats.negativeUnanswered}</span> com 3 estrelas ou menos
            </>
          ) : stats.unanswered === 0 ? (
            <span className="text-emerald-300">Tudo respondido ✨</span>
          ) : (
            "nenhuma negativa pendente"
          )}
        </p>
      </Kpi>

      <Kpi delay={0.1} label="Taxa de resposta" glow="rgba(139,92,246,0.22)">
        <div className="flex items-center gap-4">
          <Ring value={stats.responseRate ?? 0} />
          <div>
            <CountUp value={Math.round((stats.responseRate ?? 0) * 100)} suffix="%" className="text-[36px] font-semibold leading-none tracking-tight" />
            <p className="mt-2 text-[12px] text-white/45">
              {stats.medianReplyHours !== null ? (
                <>
                  responde em ~<span className="font-semibold text-white/70">{humanHours(stats.medianReplyHours)}</span>
                </>
              ) : (
                "das reviews guardadas"
              )}
            </p>
          </div>
        </div>
      </Kpi>

      <Kpi delay={0.15} label="Últimos 30 dias" glow="rgba(45,212,191,0.18)">
        <div className="flex items-end gap-3">
          <CountUp value={stats.last30} className="text-[44px] font-semibold leading-none tracking-tight" />
          {delta !== null && (
            <span
              className={`mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold ${
                delta >= 0 ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"
              }`}
            >
              {delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {delta >= 0 ? "+" : ""}
              {Math.round(delta * 100)}%
            </span>
          )}
        </div>
        <p className="mt-3 text-[13px] text-white/45">
          reviews novas · média{" "}
          <span className="font-semibold text-white/75">{formatRating(stats.last30Average)}</span>
          <span style={{ color: STAR_GOLD }}> ★</span>
        </p>
      </Kpi>
    </div>
  );
}

function humanHours(h: number): string {
  if (h < 1) return "menos de 1 h";
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} dias`;
}

function Kpi({
  label,
  children,
  delay,
  glow,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  delay: number;
  glow: string;
  onClick?: () => void;
}) {
  const Comp = onClick ? motion.button : motion.div;
  return (
    <Comp
      onClick={onClick}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 text-left transition-colors hover:border-white/15"
    >
      <span
        className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full opacity-70 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: glow }}
        aria-hidden
      />
      <p className="relative flex items-center justify-between text-[12px] font-medium uppercase tracking-[0.14em] text-white/45">
        {label}
        {onClick && <ArrowUpRight className="h-4 w-4 text-white/30 transition group-hover:text-white/70" />}
      </p>
      <div className="relative mt-4 text-white">{children}</div>
    </Comp>
  );
}

function Ring({ value }: { value: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
      <circle cx="32" cy="32" r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="7" fill="none" />
      <motion.circle
        cx="32"
        cy="32"
        r={r}
        stroke="url(#rhub-ring)"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - Math.min(1, value)) }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      />
      <defs>
        <linearGradient id="rhub-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#d946ef" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── Distribuição ──────────────────────────────────────────────────────
function Distribution() {
  const { stats, go } = useHub();
  const rated = ([5, 4, 3, 2, 1] as StarLevel[]).map((l) => ({ l, n: stats.distribution[l] }));
  const total = rated.reduce((a, x) => a + x.n, 0) || 1;
  const max = Math.max(...rated.map((x) => x.n), 1);
  return (
    <Panel delay={0.1} className="p-5 sm:p-6">
      <h2 className="text-[15px] font-semibold text-white">Distribuição das notas</h2>
      <p className="text-[12px] text-white/40">Reviews guardadas, por número de estrelas</p>
      <div className="mt-5 space-y-3">
        {rated.map(({ l, n }, i) => (
          <button
            key={l}
            onClick={() => go("reviews", { tab: "all", stars: [l] })}
            className="group grid w-full grid-cols-[62px_1fr_76px] items-center gap-3 text-left"
            title={`Ver as reviews de ${LEVELS[l].label}`}
          >
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-white/70">
              {l} <span style={{ color: STAR_GOLD }}>★</span>
            </span>
            <span className="relative h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ background: `linear-gradient(90deg, ${LEVELS[l].color}aa, ${LEVELS[l].color})` }}
                initial={{ width: 0 }}
                animate={{ width: `${(n / max) * 100}%` }}
                transition={{ duration: 1, delay: 0.15 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              />
            </span>
            <span className="text-right text-[13px] tabular-nums text-white/55 group-hover:text-white">
              {n.toLocaleString("pt-PT")} <span className="text-white/30">· {Math.round((n / total) * 100)}%</span>
            </span>
          </button>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-5 text-[12px]">
        <div>
          <p className="text-white/40">Com comentário</p>
          <p className="mt-1 text-lg font-semibold text-white">{pct(stats.withText / Math.max(1, total))}</p>
        </div>
        <div>
          <p className="text-white/40">Negativas (1–3★)</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {pct((stats.distribution[1] + stats.distribution[2] + stats.distribution[3]) / total)}
          </p>
        </div>
      </div>
    </Panel>
  );
}

// ── Evolução mensal ───────────────────────────────────────────────────
function TrendChart() {
  const { stats } = useHub();
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 230;
  const pad = { l: 8, r: 8, t: 18, b: 30 };
  const months = stats.months;
  const maxCount = Math.max(...months.map((m) => m.count), 1);
  const bw = (W - pad.l - pad.r) / months.length;
  const yCount = (n: number) => pad.t + (H - pad.t - pad.b) * (1 - n / maxCount);
  const yAvg = (a: number) => pad.t + (H - pad.t - pad.b) * (1 - (a - 1) / 4);
  const pts = months
    .map((m, i) => (m.average === null ? null : { x: pad.l + bw * i + bw / 2, y: yAvg(m.average), i }))
    .filter((p): p is { x: number; y: number; i: number } => p !== null);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const hm = hover !== null ? months[hover] : null;

  return (
    <Panel delay={0.15} className="relative p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-white">Evolução dos últimos 12 meses</h2>
          <p className="text-[12px] text-white/40">Reviews recebidas por mês e a média de estrelas</p>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-white/50">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-gradient-to-t from-indigo-500/60 to-fuchsia-400/80" /> Reviews
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-amber-300" /> Média ★
          </span>
        </div>
      </div>
      <div className="relative mt-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" onMouseLeave={() => setHover(null)}>
          <defs>
            <linearGradient id="rhub-bar" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#d946ef" stopOpacity="0.85" />
            </linearGradient>
          </defs>
          {[1, 2, 3, 4, 5].map((s) => (
            <line
              key={s}
              x1={pad.l}
              x2={W - pad.r}
              y1={yAvg(s)}
              y2={yAvg(s)}
              stroke="rgba(255,255,255,0.05)"
              strokeDasharray={s === 1 ? undefined : "3 5"}
            />
          ))}
          {months.map((m, i) => {
            const x = pad.l + bw * i + bw * 0.22;
            const w = bw * 0.56;
            const y = yCount(m.count);
            const h = H - pad.b - y;
            return (
              <g key={m.key}>
                <motion.rect
                  x={x}
                  width={w}
                  rx={5}
                  fill="url(#rhub-bar)"
                  initial={{ y: H - pad.b, height: 0 }}
                  animate={{ y, height: Math.max(0, h), opacity: hover === null || hover === i ? 1 : 0.45 }}
                  transition={{ duration: 0.9, delay: 0.1 + i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                />
                <text
                  x={pad.l + bw * i + bw / 2}
                  y={H - 8}
                  textAnchor="middle"
                  className="fill-white/40"
                  style={{ fontSize: 11 }}
                >
                  {monthLabel(m.key)}
                </text>
                <rect
                  x={pad.l + bw * i}
                  y={0}
                  width={bw}
                  height={H}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                />
              </g>
            );
          })}
          {line && (
            <motion.path
              d={line}
              fill="none"
              stroke="#fcd34d"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.6, delay: 0.5, ease: "easeInOut" }}
              style={{ filter: "drop-shadow(0 0 6px rgba(252,211,77,0.45))" }}
            />
          )}
          {pts.map((p, idx) => (
            <motion.circle
              key={p.i}
              cx={p.x}
              cy={p.y}
              r={hover === p.i ? 5.5 : 3.5}
              fill="#0b0b12"
              stroke="#fcd34d"
              strokeWidth={2}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.6 + idx * 0.1, type: "spring", stiffness: 400, damping: 16 }}
            />
          ))}
        </svg>
        <AnimatePresence>
          {hm && hover !== null && (
            <motion.div
              key={hm.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-xl border border-white/10 bg-[#12121c]/95 px-3 py-2 text-[12px] shadow-xl backdrop-blur"
              style={{ left: `${((pad.l + bw * hover + bw / 2) / W) * 100}%` }}
            >
              <p className="font-semibold capitalize text-white">{monthLabel(hm.key, true)}</p>
              <p className="text-white/60">
                {hm.count} {hm.count === 1 ? "review" : "reviews"}
                {hm.average !== null && (
                  <>
                    {" · "}
                    <span className="text-amber-300">{formatRating(hm.average)} ★</span>
                  </>
                )}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Panel>
  );
}

// ── Salões ────────────────────────────────────────────────────────────
type SortKey = "unanswered" | "average" | "total" | "rate";

function SalonsTable() {
  const { stats, setLoc, go, loc } = useHub();
  const [sort, setSort] = useState<SortKey>("unanswered");
  const rows = useMemo(() => {
    const list = [...stats.locations];
    const val = (l: (typeof list)[number]) =>
      sort === "unanswered" ? l.unanswered : sort === "average" ? l.average ?? 0 : sort === "total" ? l.total : l.responseRate ?? 0;
    return list.sort((a, b) => val(b) - val(a));
  }, [stats.locations, sort]);
  if (loc !== "all" || rows.length < 2) return null;
  const best = [...rows].sort((a, b) => (b.average ?? 0) - (a.average ?? 0))[0];

  const Head = ({ k, label, className = "" }: { k: SortKey; label: string; className?: string }) => (
    <button
      onClick={() => setSort(k)}
      className={`text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
        sort === k ? "text-violet-200" : "text-white/35 hover:text-white/60"
      } ${className}`}
    >
      {label}
      {sort === k && " ↓"}
    </button>
  );

  return (
    <Panel delay={0.2} className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 sm:px-6">
        <div>
          <h2 className="text-[15px] font-semibold text-white">Os salões</h2>
          <p className="text-[12px] text-white/40">Clique num salão para ver as reviews dele</p>
        </div>
        {best?.average && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-300/[0.07] px-3 py-1 text-[12px] text-amber-100">
            <Trophy className="h-3.5 w-3.5 text-amber-300" /> Melhor média: {best.short} · {formatRating(best.average)}
          </span>
        )}
      </div>
      <div className="rhub-scroll mt-4 overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[minmax(170px,1.6fr)_1.3fr_0.7fr_0.9fr_1.1fr] gap-4 border-y border-white/[0.06] px-5 py-2.5 sm:px-6">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35">Salão</span>
            <Head k="average" label="Média" />
            <Head k="total" label="Reviews" className="text-right" />
            <Head k="unanswered" label="Por responder" className="text-right" />
            <Head k="rate" label="Taxa de resposta" />
          </div>
          <motion.div layout>
            {rows.map((l, i) => (
              <motion.button
                layout
                key={l.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + Math.min(i, 14) * 0.035, layout: { type: "spring", stiffness: 400, damping: 36 } }}
                onClick={() => {
                  setLoc(l.id);
                  go("reviews", { tab: "pending" });
                }}
                className="group grid w-full grid-cols-[minmax(170px,1.6fr)_1.3fr_0.7fr_0.9fr_1.1fr] items-center gap-4 border-b border-white/[0.04] px-5 py-3 text-left transition hover:bg-white/[0.03] sm:px-6"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="text-[12px] font-semibold tabular-nums text-white/25">{String(i + 1).padStart(2, "0")}</span>
                  <span className="truncate text-[14px] font-medium text-white/85 group-hover:text-white">{l.short}</span>
                </span>
                <span className="flex items-center gap-2.5">
                  <span className="w-8 text-[14px] font-semibold tabular-nums text-white">{formatRating(l.average)}</span>
                  <StarRow value={l.average ?? 0} size={12} />
                </span>
                <span className="text-right text-[14px] tabular-nums text-white/65">{l.total.toLocaleString("pt-PT")}</span>
                <span className="text-right">
                  {l.unanswered > 0 ? (
                    <span
                      className={`inline-flex min-w-9 justify-center rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums ${
                        l.negativeUnanswered > 0 ? "bg-rose-500/15 text-rose-200" : "bg-white/[0.06] text-white/70"
                      }`}
                    >
                      {l.unanswered}
                    </span>
                  ) : (
                    <CircleCheck className="ml-auto h-4 w-4 text-emerald-400/80" />
                  )}
                </span>
                <span className="flex items-center gap-2.5">
                  <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <motion.span
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${(l.responseRate ?? 0) * 100}%` }}
                      transition={{ duration: 1, delay: 0.3 + i * 0.03 }}
                    />
                  </span>
                  <span className="w-10 text-right text-[12px] tabular-nums text-white/55">{pct(l.responseRate)}</span>
                </span>
              </motion.button>
            ))}
          </motion.div>
        </div>
      </div>
    </Panel>
  );
}

// ── Precisam de atenção ───────────────────────────────────────────────
function NeedsAttention() {
  const { scoped, go, locationsById } = useHub();
  const list = useMemo(
    () => scoped.filter((r) => !r.reply && isNegative(r)).slice(0, 5),
    [scoped],
  );
  return (
    <Panel delay={0.25} className="p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-white">Precisam de atenção</h2>
          <p className="text-[12px] text-white/40">Negativas ainda sem resposta, as mais recentes primeiro</p>
        </div>
        <button
          onClick={() => go("reviews", { tab: "pending", stars: [1, 2, 3] })}
          className="text-[12px] font-semibold text-violet-300 hover:text-violet-200"
        >
          Ver todas →
        </button>
      </div>
      <div className="mt-4 space-y-2.5">
        {list.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-4 py-4 text-[13px] text-emerald-100/80">
            <CircleCheck className="h-5 w-5 text-emerald-300" /> Nenhuma review negativa por responder. Excelente!
          </div>
        ) : (
          list.map((r, i) => {
            const L = LEVELS[levelOf(r.stars)];
            return (
              <motion.button
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.06 }}
                whileHover={{ x: 3 }}
                onClick={() => go("reviews", { tab: "pending", reviewId: r.id })}
                className="flex w-full items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition hover:border-white/15"
                style={{ boxShadow: `inset 3px 0 0 ${L.color}` }}
              >
                <Avatar name={r.author} photo={r.photo} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-[13px] font-semibold text-white/90">{r.author}</span>
                    <StarRow value={r.stars} size={11} color={L.color} />
                    <span className="text-[11px] text-white/35">
                      {locationsById.get(r.loc)?.short} · {relativeTime(r.created)}
                    </span>
                  </span>
                  <span className="mt-1 line-clamp-2 block text-[13px] text-white/55">
                    {r.text || <em className="text-white/35">Sem comentário — só a nota.</em>}
                  </span>
                </span>
              </motion.button>
            );
          })
        )}
      </div>
    </Panel>
  );
}

// ── Atividade ─────────────────────────────────────────────────────────
const ACTIVITY_ICON: Record<HubActivityKind, { Icon: LucideIcon; color: string }> = {
  reply: { Icon: MessageSquareText, color: "#a78bfa" },
  "auto-reply": { Icon: Bot, color: "#34d399" },
  "auto-draft": { Icon: Sparkles, color: "#fbbf24" },
  sync: { Icon: RefreshCw, color: "#60a5fa" },
  settings: { Icon: Settings2, color: "#f0abfc" },
};

function ActivityFeed() {
  const { data } = useHub();
  const list = data.activity.slice(0, 8);
  return (
    <Panel delay={0.3} className="p-5 sm:p-6">
      <h2 className="text-[15px] font-semibold text-white">Atividade recente</h2>
      <p className="text-[12px] text-white/40">Respostas publicadas, automação e sincronizações</p>
      <div className="relative mt-4">
        {list.length === 0 ? (
          <p className="rounded-xl border border-white/[0.06] px-4 py-5 text-center text-[13px] text-white/40">
            Ainda sem atividade — a primeira resposta publicada aparece aqui.
          </p>
        ) : (
          <ol className="relative space-y-3.5 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-white/[0.07]">
            {list.map((a, i) => {
              const { Icon, color } = ACTIVITY_ICON[a.kind];
              return (
                <motion.li
                  key={`${a.at}-${i}`}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.05 }}
                  className="relative flex items-start gap-3"
                >
                  <span
                    className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#0e0e16]"
                    style={{ color }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 pt-1">
                    <span className="block text-[13px] text-white/80">{a.text}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/35">
                      <Clock className="h-3 w-3" /> {relativeTime(a.at)}
                      {a.by && <> · {a.by}</>}
                    </span>
                  </span>
                </motion.li>
              );
            })}
          </ol>
        )}
      </div>
    </Panel>
  );
}

// ── Estados vazios ────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[138px] rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[5fr_7fr]">
        <Skeleton className="h-[300px] rounded-2xl" />
        <Skeleton className="h-[300px] rounded-2xl" />
      </div>
    </div>
  );
}

export function EmptyState({ syncing }: { syncing: boolean }) {
  const { data, runSync, viewer } = useHub();
  const arriving = Boolean(data.sync.dfsPending);
  const ready = data.locations.filter((l) => l.syncedAt && !l.error).length;
  return (
    <Panel className="relative overflow-hidden px-6 py-16 text-center">
      <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.span
            key={i}
            className="absolute text-2xl"
            style={{ color: STAR_GOLD }}
            animate={syncing || arriving ? { rotate: 360 } : { rotate: 0 }}
            transition={{ duration: 6, repeat: syncing || arriving ? Infinity : 0, ease: "linear" }}
          >
            <span style={{ display: "inline-block", transform: `rotate(${i * 72}deg) translateY(-46px)` }}>★</span>
          </motion.span>
        ))}
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.05] ring-1 ring-white/10">
          <MessageSquareText className="h-7 w-7 text-violet-200" />
        </span>
      </div>
      <h2 className="mt-6 text-xl font-semibold text-white">
        {syncing || arriving ? "A receber as reviews dos salões…" : "Ainda sem reviews"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[14px] text-white/50">
        {syncing || arriving
          ? "Estamos a ir buscar todas as reviews de todos os salões ao Google. Na primeira vez pode demorar uns minutos — esta página atualiza-se sozinha."
          : data.sync.error
            ? "A ligação ao Google ainda não está a funcionar — veja o aviso acima."
            : "Sincronize com o Google para trazer as reviews de todos os salões."}
      </p>
      {arriving && data.locations.length > 0 && (
        <div className="mx-auto mt-5 max-w-xs">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
            <motion.div
              className="h-full rounded-full bg-[linear-gradient(90deg,#4f46e5,#a855f7,#d946ef)]"
              initial={{ width: 0 }}
              animate={{ width: `${(ready / data.locations.length) * 100}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <p className="mt-2 text-[12px] text-white/40">
            {ready} de {data.locations.length} salões já chegaram
          </p>
        </div>
      )}
      {!syncing && !arriving && viewer.canWrite && (
        <button
          onClick={() => void runSync(true)}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#343ed7,#783df5_55%,#c535c9)] px-5 py-3 text-[14px] font-semibold text-white shadow-[0_14px_40px_-16px_rgba(120,61,245,0.9)] transition hover:brightness-110"
        >
          <RefreshCw className="h-4 w-4" /> Sincronizar com o Google
        </button>
      )}
    </Panel>
  );
}
