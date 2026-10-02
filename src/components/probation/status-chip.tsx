// A etiqueta do estado de um plano (em curso, estendido, recuperado, saída)
// — na lista e no topo do editor, sobre o fundo escuro da app.

import { STATUS_LABEL, type ProbationStatus } from "@/lib/probation/shared";

const TONE: Record<ProbationStatus, string> = {
  "em-curso": "border-violet-400/35 bg-violet-500/10 text-violet-200",
  estendido: "border-sky-400/35 bg-sky-500/10 text-sky-200",
  recuperado: "border-emerald-400/35 bg-emerald-500/10 text-emerald-200",
  saida: "border-rose-400/35 bg-rose-500/10 text-rose-200",
};

export function StatusChip({ status }: { status: ProbationStatus }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.14em] ${TONE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
