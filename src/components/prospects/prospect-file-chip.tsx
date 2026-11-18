// Chip «Ficha do prospect» no topo da página do cliente no SEO DPT (v80.0).
//
// Aparece quando o cliente tem ficha. Para o consultor do cliente pulsa com
// «Nova» enquanto ele não a abrir (e «Novidades» quando o Comercial
// acrescentou alguma coisa depois da última leitura). Ao passar o rato abre
// uma pré-visualização com o resumo, as prioridades e as oportunidades — o
// essencial sem sair da página.

import Link from "next/link";
import { ClipboardList, Layers, ListOrdered, MessagesSquare } from "lucide-react";
import { getProspectFile, getProspectReads } from "@/lib/prospects/store";
import {
  OPPORTUNITY_KIND_LABEL,
  isProspectFileEmpty,
  prospectCompleteness,
  prospectPath,
} from "@/lib/prospects/shared";

export async function ProspectFileChip({
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

  const priorities = file.priorities.slice(0, 3);
  const openOpps = file.opportunities.filter((o) => o.status === "ideia" || o.status === "proposta");

  return (
    <span className="group/pf relative inline-flex">
      <Link
        href={prospectPath(slug)}
        className={
          callout
            ? "prospect-pulse inline-flex items-center gap-1.5 rounded-full border border-[#a78bfa]/70 bg-[#783DF5]/20 px-2.5 py-0.5 text-[11px] font-semibold text-violet-50 transition hover:bg-[#783DF5]/30"
            : "inline-flex items-center gap-1.5 rounded-full border border-[#783DF5]/35 bg-[#783DF5]/[0.08] px-2.5 py-0.5 text-[11px] font-medium text-white/70 transition hover:border-[#783DF5]/60 hover:bg-[#783DF5]/[0.14] hover:text-white"
        }
      >
        <ClipboardList className="h-3 w-3 text-violet-300" />
        <span className={callout ? "uppercase tracking-[0.08em] text-violet-100/80" : "uppercase tracking-[0.08em] text-white/45"}>
          Ficha do prospect
        </span>
        {fresh ? (
          <span className="font-semibold text-white">Nova</span>
        ) : updated ? (
          <span className="font-semibold text-white">Novidades</span>
        ) : empty ? (
          <span className="text-white/40">por preencher</span>
        ) : (
          <span className="font-semibold tabular-nums text-violet-100">{pct}%</span>
        )}
      </Link>

      {/* Pré-visualização no hover/foco — informativa, não apanha o rato. */}
      {!empty && (
        <span
          aria-hidden
          className="pointer-events-none invisible absolute left-0 top-full z-40 mt-2 block w-[22rem] max-w-[calc(100vw-2rem)] translate-y-[-4px] rounded-2xl border border-white/12 bg-[#0b0b12]/95 p-4 text-left opacity-0 shadow-[0_24px_70px_-16px_rgba(0,0,0,0.85),0_0_0_1px_rgba(120,61,245,0.1)] transition duration-200 group-hover/pf:visible group-hover/pf:translate-y-0 group-hover/pf:opacity-100 group-focus-within/pf:visible group-focus-within/pf:translate-y-0 group-focus-within/pf:opacity-100 motion-reduce:transition-none"
        >
          <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-200/70">
            Em 30 segundos
          </span>
          <span className="mt-1 line-clamp-4 block text-[12.5px] leading-relaxed text-white/80">
            {file.summary.trim() || "Sem resumo ainda."}
          </span>
          {priorities.length > 0 && (
            <>
              <span className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                <ListOrdered className="h-3 w-3" />
                Prioridades
              </span>
              <span className="mt-1 block space-y-1">
                {priorities.map((p, i) => (
                  <span key={p.id} className="flex gap-2 text-[12px] leading-snug text-white/75">
                    <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded bg-white/10 text-[10px] font-bold tabular-nums text-white/80">
                      {i + 1}
                    </span>
                    <span className="line-clamp-2">{p.text}</span>
                  </span>
                ))}
              </span>
            </>
          )}
          {openOpps.length > 0 && (
            <>
              <span className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                <Layers className="h-3 w-3" />
                Oportunidades em aberto
              </span>
              <span className="mt-1 flex flex-wrap gap-1">
                {openOpps.slice(0, 6).map((o) => (
                  <span
                    key={o.id}
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${
                      o.kind === "upsell"
                        ? "border-emerald-400/30 text-emerald-100/90"
                        : "border-sky-400/30 text-sky-100/90"
                    }`}
                  >
                    {OPPORTUNITY_KIND_LABEL[o.kind]} · {o.service}
                  </span>
                ))}
              </span>
            </>
          )}
          <span className="mt-3 flex items-center justify-between border-t border-white/[0.08] pt-2.5 text-[11px] text-white/40">
            <span className="inline-flex items-center gap-1">
              <MessagesSquare className="h-3 w-3" />
              {file.notes.length} {file.notes.length === 1 ? "reunião/nota" : "reuniões/notas"}
            </span>
            <span>Ficha {pct}% preenchida</span>
          </span>
        </span>
      )}
    </span>
  );
}
