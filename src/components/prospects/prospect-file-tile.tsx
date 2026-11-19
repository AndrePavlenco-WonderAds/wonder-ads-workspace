// «Ficha do prospect» na página do cliente no SEO DPT.
//
// v80.0 era uma pastilha na fila do topo (com pré-visualização no hover);
// v80.6 passou a linha fixa no cimo do cartão Client Files — o topo já tinha
// pastilhas a mais, e o pop-up do hover tapava o resto da página.
//
// Só aparece quando o cliente tem ficha. Para o consultor do cliente pulsa
// com «Nova» enquanto ele não a abrir (e «Novidades» quando o Comercial
// acrescentou alguma coisa depois da última leitura). O resumo vai numa linha.

import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";
import { getProspectFile, getProspectReads } from "@/lib/prospects/store";
import {
  isProspectFileEmpty,
  prospectCompleteness,
  prospectPath,
} from "@/lib/prospects/shared";

export async function ProspectFileTile({
  slug,
  viewerUsername,
  consultantUsername,
}: {
  slug: string;
  viewerUsername: string | null;
  consultantUsername: string | null;
}) {
  const { file } = await getProspectFile(slug);
  if (!file) return null;
  const reads = await getProspectReads(slug);
  const { pct } = prospectCompleteness(file);
  const empty = isProspectFileEmpty(file);

  const isConsultant = Boolean(viewerUsername && viewerUsername === consultantUsername);
  const myRead = viewerUsername ? reads[viewerUsername] ?? null : null;
  const fresh = isConsultant && !empty && myRead === null;
  const updated =
    isConsultant && !empty && myRead !== null && file.updatedAt > myRead && file.updatedBy !== viewerUsername;
  const callout = fresh || updated;

  const openOpps = file.opportunities.filter((o) => o.status === "ideia" || o.status === "proposta").length;
  const summary = file.summary.trim();
  const facts = [
    file.priorities.length > 0 &&
      `${file.priorities.length} ${file.priorities.length === 1 ? "prioridade" : "prioridades"}`,
    openOpps > 0 && `${openOpps} ${openOpps === 1 ? "oportunidade" : "oportunidades"}`,
    file.notes.length > 0 &&
      `${file.notes.length} ${file.notes.length === 1 ? "reunião/nota" : "reuniões/notas"}`,
  ].filter(Boolean) as string[];
  const subtitle = summary || facts.join(" · ") || "O que o Comercial sabe do cliente";

  return (
    <Link
      href={prospectPath(slug)}
      title={summary || "Abrir a ficha do prospect"}
      className={`group/pf mb-4 flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
        callout
          ? "prospect-pulse border-[#a78bfa]/60 bg-[#783DF5]/[0.16] hover:bg-[#783DF5]/[0.22]"
          : "border-[#783DF5]/25 bg-[#783DF5]/[0.06] hover:border-[#783DF5]/50 hover:bg-[#783DF5]/[0.11]"
      }`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#783DF5]/25 text-violet-100">
        <ClipboardList className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-white/90">Ficha do prospect</span>
          {(fresh || updated) && (
            <span className="rounded-full bg-[#783DF5] px-1.5 py-px text-[9.5px] font-bold uppercase tracking-[0.1em] text-white">
              {fresh ? "Nova" : "Novidades"}
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-white/50">{subtitle}</span>
      </span>
      <span className="shrink-0 text-[11px] tabular-nums text-white/45">
        {empty ? "por preencher" : `${pct}%`}
      </span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/35 transition group-hover/pf:translate-x-0.5 group-hover/pf:text-white" />
    </Link>
  );
}
