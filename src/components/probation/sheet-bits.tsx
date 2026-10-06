"use client";

// Peças pequenas da folha do plano (papel claro, como as Ausências) e os
// selos de envio — partilhadas pelo editor, pelos check-ins e pelos envios.

import type { ReactNode } from "react";
import { AlertTriangle, Check, CheckCheck, CircleDashed, Send } from "lucide-react";
import { formatDateTime } from "@/lib/dates";
import { PULSE_TONE, type SendState } from "@/lib/probation/published";
import { PULSE_OPTIONS, type WeekPulse } from "@/lib/probation/shared";

export function Field({
  label,
  hint,
  className = "",
  children,
}: {
  label: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="sheet-label mb-1.5">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[10.5px] leading-snug text-black/40">{hint}</span>}
    </label>
  );
}

/** O semáforo — na folha (papel) ou compacto, por KPI. */
export function PulsePicker({
  value,
  onChange,
  compact = false,
  label,
}: {
  value: WeekPulse | null;
  onChange: (v: WeekPulse | null) => void;
  compact?: boolean;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={compact ? "inline-flex gap-1" : "grid grid-cols-3 gap-2"}>
      {PULSE_OPTIONS.map((o) => {
        const on = value === o.id;
        const t = PULSE_TONE[o.id];
        if (compact) {
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              title={o.label}
              onClick={() => onChange(on ? null : o.id)}
              className="flex h-7 w-7 items-center justify-center rounded-full border transition"
              style={{
                borderColor: on ? t.dot : "rgba(0,0,0,0.15)",
                background: on ? t.dot : "white",
              }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: on ? "white" : t.dot }} />
            </button>
          );
        }
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(on ? null : o.id)}
            className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-[12.5px] font-semibold transition"
            style={{
              borderColor: on ? t.dot : "rgba(0,0,0,0.15)",
              background: on ? t.bg : "rgba(255,255,255,0.7)",
              color: on ? t.text : "rgba(0,0,0,0.65)",
              boxShadow: on ? `0 0 0 3px ${t.ring}` : undefined,
            }}
          >
            <span className="h-3 w-3 rounded-full" style={{ background: t.dot }} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** O selo de envio de um item (fundo escuro). */
export function SendBadge({ state, compact = false }: { state: SendState; compact?: boolean }) {
  const base = `inline-flex items-center gap-1 rounded-full font-semibold ${compact ? "px-2 py-0.5 text-[10.5px]" : "px-2.5 py-1 text-[11px]"}`;
  if (state.kind === "never") {
    return (
      <span className={`${base} bg-white/[0.06] text-white/45`}>
        <CircleDashed className="h-3 w-3" />
        Por enviar
      </span>
    );
  }
  if (state.kind === "changed") {
    return (
      <span className={`${base} bg-amber-500/15 text-amber-200`} title={`Enviado a ${formatDateTime(state.at)}`}>
        <AlertTriangle className="h-3 w-3" />
        Alterado desde o envio
      </span>
    );
  }
  if (state.ack) {
    return (
      <span className={`${base} bg-emerald-500/15 text-emerald-200`} title={`Lido a ${formatDateTime(state.ack.at)}`}>
        <CheckCheck className="h-3 w-3" />
        Lido{compact ? "" : ` · ${formatDateTime(state.ack.at)}`}
      </span>
    );
  }
  return (
    <span className={`${base} bg-sky-500/15 text-sky-200`} title={`Enviado a ${formatDateTime(state.at)}`}>
      {compact ? <Send className="h-3 w-3" /> : <Check className="h-3 w-3" />}
      Enviado{compact ? "" : ` · ${formatDateTime(state.at)}`}
    </span>
  );
}
