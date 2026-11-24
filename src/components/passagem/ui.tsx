// Peças visuais da Passagem de consultor (v80.39) — sem estado, servem às
// páginas (servidor) e aos componentes interativos (browser).

import {
  PHASES,
  PASSAGEM_DAYS,
  STAGE_LABEL,
  formatISODate,
  healthOf,
  phaseFor,
  type Health,
  type ProjectStage,
} from "@/lib/passagem/shared";

export function ProgressRing({ pct, size = 44, stroke = 4 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const done = pct >= 100;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={done ? "#34d399" : "url(#passagem-ring)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(100, Math.max(0, pct)) / 100)}
          className="transition-[stroke-dashoffset] duration-500"
        />
        <defs>
          <linearGradient id="passagem-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#783DF5" />
            <stop offset="100%" stopColor="#E040A0" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute text-[11px] font-semibold tabular-nums text-white/85">{pct}%</span>
    </span>
  );
}

const STAGE_TONE: Record<ProjectStage, string> = {
  "por-comecar": "border-white/12 text-white/55",
  "em-escrita": "border-[#783DF5]/40 bg-[#783DF5]/10 text-[#c4a6ff]",
  pronta: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  assumido: "border-sky-300/30 bg-sky-300/10 text-sky-200",
  passado: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
};

export function StageChip({ stage }: { stage: ProjectStage }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium ${STAGE_TONE[stage]}`}>
      {STAGE_LABEL[stage]}
    </span>
  );
}

export function HealthDot({ health, withLabel = false }: { health: Health | null; withLabel?: boolean }) {
  const h = healthOf(health);
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-white/60" title={h ? `${h.label} — ${h.hint}` : "Semáforo por definir"}>
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={h ? { background: h.color, boxShadow: `0 0 10px ${h.color}66` } : { border: "1px dashed rgba(255,255,255,0.3)" }}
      />
      {withLabel && <span>{h ? h.label : "Por definir"}</span>}
    </span>
  );
}

export function PersonAvatar({ name, avatar, size = 28 }: { name: string; avatar: string | null; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={avatar} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover ring-1 ring-white/15" style={{ width: size, height: size }} />
  ) : (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white/75 ring-1 ring-white/15"
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  );
}

/** A linha dos 30 dias: as 4 fases, com o dia de hoje marcado. */
export function Timeline({
  day,
  totalDays,
  startDate,
  endDate,
}: {
  day: number;
  totalDays: number;
  startDate: string;
  endDate: string;
}) {
  const current = day > 0 ? phaseFor(day, totalDays) : null;
  const pct = day <= 0 ? 0 : Math.min(100, (Math.min(day, totalDays) / totalDays) * 100);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] text-white/50">
          {formatISODate(startDate)} → {formatISODate(endDate)}
        </p>
        <p className="text-[13px] font-medium text-white/80">
          {day <= 0 ? `Começa a ${formatISODate(startDate)}` : day > totalDays ? "Prazo terminado" : `Dia ${day} de ${totalDays}`}
        </p>
      </div>
      <div className="relative mt-4">
        <div className="flex h-2 gap-1 overflow-hidden rounded-full">
          {PHASES.map((ph) => (
            <div
              key={ph.n}
              className="h-full rounded-full bg-white/[0.07]"
              style={{ flexGrow: ph.to - ph.from + 1 }}
            />
          ))}
        </div>
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg,#783DF5,#E040A0)" }}
        />
        {day > 0 && day <= totalDays && (
          <span
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#E040A0] shadow-[0_0_14px_rgba(224,64,160,0.7)]"
            style={{ left: `${pct}%` }}
          />
        )}
      </div>
      <ol className="mt-4 grid gap-3 sm:grid-cols-4">
        {PHASES.map((ph) => {
          const active = current?.n === ph.n && day <= totalDays;
          const past = current ? ph.n < current.n || day > totalDays : false;
          return (
            <li
              key={ph.n}
              className={`rounded-xl border p-3 transition ${
                active ? "border-[#783DF5]/50 bg-[#783DF5]/10" : "border-white/8 bg-transparent"
              }`}
            >
              <p className={`text-[11px] font-medium uppercase tracking-[0.14em] ${active ? "text-[#c4a6ff]" : past ? "text-emerald-300/70" : "text-white/35"}`}>
                Dias {Math.round(((ph.from - 1) / PASSAGEM_DAYS) * totalDays) + 1}–{Math.round((ph.to / PASSAGEM_DAYS) * totalDays)}
                {past ? " · feito" : active ? " · agora" : ""}
              </p>
              <p className="mt-1 text-[14px] font-semibold text-white">{ph.title}</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-white/50">{ph.detail}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Os 7 passos de um projeto numa linha de traços (verde = feito). */
export function StepDots({ steps, className = "" }: { steps: Array<{ id: string; label: string; done: boolean }>; className?: string }) {
  const done = steps.filter((s) => s.done).length;
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} role="img" aria-label={`${done} de ${steps.length} passos feitos`}>
      {steps.map((s) => (
        <span
          key={s.id}
          title={`${s.done ? "✓" : "·"} ${s.label}`}
          className={`h-1.5 w-5 rounded-full transition ${s.done ? "bg-emerald-400" : "bg-white/[0.12]"}`}
        />
      ))}
    </span>
  );
}

export function KpiTile({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const color = tone === "good" ? "text-emerald-300" : tone === "warn" ? "text-amber-200" : tone === "bad" ? "text-rose-300" : "text-white";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/40">{label}</p>
      <p className={`mt-1 text-[24px] font-semibold leading-none tabular-nums ${color}`}>{value}</p>
      {sub && <p className="mt-1.5 text-[12px] text-white/45">{sub}</p>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="animate-fade-up mt-2 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className="readout text-white/35">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          <span className="brand-gradient-text">{title}</span>
        </h1>
        {lead && <p className="mt-3 text-[15px] leading-relaxed text-white/60">{lead}</p>}
      </div>
      {children}
    </header>
  );
}
