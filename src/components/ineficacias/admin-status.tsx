// As pastilhas da vista da direção (v80.50): o estado de uma ocorrência na
// escala e as marcas do «passado que interessa». Puro (server-safe) — serve
// a mesa de pontuação, o histórico e o painel da equipa.

import { FileSignature, Hourglass, ShieldAlert } from "lucide-react";
import type { AdminStatus, RelatedTag } from "@/lib/ineficacias/admin-view";

export const STATUS_META: Record<AdminStatus, { label: string; cls: string; hint: string }> = {
  conta: {
    label: "A contar agora",
    cls: "border-amber-400/35 bg-amber-400/10 text-amber-200",
    hint: "Entra no PA e no NO de hoje.",
  },
  pontuar: {
    label: "Por pontuar",
    cls: "border-dashed border-[#a78bfa]/45 bg-[#783DF5]/10 text-[#c3aaff]",
    hint: "À espera da pontuação da direção — só depois entra nas contas.",
  },
  anterior: {
    label: "Fase anterior",
    cls: "border-white/15 bg-white/[0.05] text-white/55",
    hint: "Contou numa fase que já fechou (subida de nível ou reset). Já não pesa no PA/NO de hoje.",
  },
  zero: {
    label: "Não contou",
    cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    hint: "Pontuada a 0: fica no histórico, mas não entra no PA nem no NO.",
  },
};

export function StatusChip({ status }: { status: AdminStatus }) {
  const m = STATUS_META[status];
  return (
    <span title={m.hint} className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${m.cls}`}>
      {status === "pontuar" && <Hourglass className="h-3 w-3" />}
      {m.label}
    </span>
  );
}

const TAG_META: Record<RelatedTag, { label: string; cls: string }> = {
  parecida: { label: "Parecida", cls: "border-rose-400/35 bg-rose-500/10 text-rose-200" },
  cliente: { label: "Mesmo cliente", cls: "border-sky-400/30 bg-sky-400/10 text-sky-200" },
  motivo: { label: "Mesmo motivo", cls: "border-white/15 bg-white/[0.05] text-white/60" },
};

export function RelatedTagChip({ tag }: { tag: RelatedTag }) {
  const m = TAG_META[tag];
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-px text-[10px] font-semibold ${m.cls}`}>{m.label}</span>;
}

export function SourceChip({ source, reportRef }: { source: "report" | "direcao"; reportRef: string | null }) {
  return source === "direcao" ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/[0.07] px-2 py-0.5 text-[10.5px] font-semibold text-amber-200/90">
      <ShieldAlert className="h-3 w-3" />
      Direção
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] font-semibold text-white/55">
      <FileSignature className="h-3 w-3" />
      {reportRef ?? "Relatório"}
    </span>
  );
}

/** «12/11/26» — a data curta das listas. */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}
