// Átomos visuais da Formação, partilhados entre o hub do consultor, as
// páginas de módulo/aula e o Superadmin — para que "concluído" tenha sempre o
// mesmo aspeto em todo o lado.

import type { ReactNode } from "react";
import {
  CheckCircle2,
  Clock,
  Drama,
  Lock,
  PhoneCall,
  PlayCircle,
  Video,
} from "lucide-react";
import {
  LESSON_TYPE_LABEL,
  type TrainingLessonType,
} from "@/lib/training/catalog";
import type { ModuleStatus, ModuleState } from "@/lib/training/progress";

const TYPE_TONE: Record<
  TrainingLessonType,
  { border: string; bg: string; text: string }
> = {
  formacao: {
    border: "border-[#783DF5]/35",
    bg: "bg-[#783DF5]/12",
    text: "text-[#c3aaff]",
  },
  scenario: {
    border: "border-amber-400/30",
    bg: "bg-amber-500/10",
    text: "text-amber-200/90",
  },
  call_real: {
    border: "border-emerald-400/30",
    bg: "bg-emerald-500/10",
    text: "text-emerald-200/90",
  },
};

export function LessonTypeBadge({ type }: { type: TrainingLessonType }) {
  const tone = TYPE_TONE[type];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${tone.border} ${tone.bg} ${tone.text}`}
    >
      <Video className="h-2.5 w-2.5" />
      {LESSON_TYPE_LABEL[type]}
    </span>
  );
}

export function ModuleStatusChip({
  status,
  percent,
  hasContent = true,
}: {
  status: ModuleStatus;
  percent: number;
  /** Um capítulo ainda sem aulas gravadas não é um capítulo "concluído". */
  hasContent?: boolean;
}) {
  if (!hasContent) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-500/[0.08] px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-amber-200/80">
        <Clock className="h-3 w-3" />
        Brevemente
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-emerald-200/85">
        <CheckCircle2 className="h-3 w-3" />
        Concluído
      </span>
    );
  }
  if (status === "locked") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-white/40">
        <Lock className="h-3 w-3" />
        Bloqueado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#783DF5]/40 bg-[#783DF5]/12 px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#c3aaff]">
      <PlayCircle className="h-3 w-3" />
      Em curso · <span className="tabular">{percent}%</span>
    </span>
  );
}

/** Anel de progresso — mesmo desenho do hub de onboarding de clientes,
 *  adaptado ao tema escuro do workspace. */
export function ProgressRing({
  percent,
  label,
  size = 120,
}: {
  percent: number;
  label?: string;
  size?: number;
}) {
  const R = 46;
  const C = 2 * Math.PI * R;
  const dash = (Math.min(100, Math.max(0, percent)) / 100) * C;
  const gradId = `ring-${size}`;
  return (
    <div className="relative" style={{ height: size, width: size }}>
      <svg viewBox="0 0 120 120" className="-rotate-90" width={size} height={size}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#343ED7" />
            <stop offset="0.55" stopColor="#783DF5" />
            <stop offset="1" stopColor="#C535C9" />
          </linearGradient>
        </defs>
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.09)"
          strokeWidth="10"
        />
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-2xl font-bold text-white">
          {percent}%
        </span>
        {label && (
          <span className="text-[10.5px] font-medium text-white/45">{label}</span>
        )}
      </div>
    </div>
  );
}

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="brand-gradient-bg h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

/** Miniatura de uma aula — ícone por tipo sobre um bloco de gradiente, o
 *  equivalente escuro do LessonThumb do onboarding de clientes. Fica a
 *  esmaecido quando a aula ainda não tem vídeo. */
export function LessonThumb({
  type,
  watched,
  comingSoon,
  size = "md",
}: {
  type: TrainingLessonType;
  watched?: boolean;
  comingSoon?: boolean;
  size?: "sm" | "md";
}) {
  const Icon =
    type === "call_real" ? PhoneCall : type === "scenario" ? Drama : PlayCircle;
  const box = size === "sm" ? "h-9 w-9" : "h-12 w-12";
  const icon = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <span
      className={`relative flex ${box} shrink-0 items-center justify-center rounded-xl border ${
        watched
          ? "border-emerald-400/25 bg-emerald-500/10"
          : comingSoon
            ? "border-white/8 bg-white/[0.03]"
            : "border-white/10"
      }`}
      style={
        watched || comingSoon
          ? undefined
          : {
              background:
                "linear-gradient(135deg, rgba(52,62,215,0.22), rgba(197,53,201,0.22))",
            }
      }
    >
      {watched ? (
        <CheckCircle2 className={`${icon} text-emerald-300`} />
      ) : (
        <Icon
          className={`${icon} ${comingSoon ? "text-white/30" : "text-white/85"}`}
        />
      )}
    </span>
  );
}

/** Mostrador compacto de um número com legenda — usado nas linhas de
 *  estatística do hub e do overview de admin. */
export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "warn" | "good";
}) {
  const toneCls =
    tone === "warn"
      ? "border-amber-400/25 bg-amber-500/[0.06]"
      : tone === "good"
        ? "border-emerald-400/25 bg-emerald-500/[0.06]"
        : "border-white/10 bg-white/[0.025]";
  return (
    <div className={`rounded-2xl border px-4 py-3.5 ${toneCls}`}>
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
        {icon}
        {label}
      </p>
      <p className="tabular mt-1.5 text-2xl font-semibold tracking-tight text-white">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-white/40">{hint}</p>}
    </div>
  );
}

/** Fita de capítulos de um módulo — um segmento por capítulo, colorido pelo
 *  estado. Dá a leitura da jornada inteira num relance, sem scroll. */
export function TrackJourney({ modules }: { modules: ModuleState[] }) {
  return (
    <div className="flex items-center gap-1">
      {modules.map((m) => (
        <span
          key={m.module.id}
          title={`${m.module.title} — ${
            !m.hasContent
              ? "brevemente"
              : m.status === "completed"
                ? "concluído"
                : m.status === "in_progress"
                  ? `em curso (${m.percent}%)`
                  : "bloqueado"
          }`}
          className={`h-1.5 flex-1 rounded-full ${
            !m.hasContent
              ? "bg-amber-400/25"
              : m.status === "completed"
                ? "bg-emerald-400/70"
                : m.status === "in_progress"
                  ? "brand-gradient-bg"
                  : "bg-white/10"
          }`}
        />
      ))}
    </div>
  );
}

export function MinutesLeft({ minutes }: { minutes: number }) {
  if (minutes <= 0) return null;
  const label =
    minutes >= 60
      ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}min` : ""}`
      : `${minutes} min`;
  return (
    <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-white/45">
      <Clock className="h-3 w-3" />~{label}
    </span>
  );
}
