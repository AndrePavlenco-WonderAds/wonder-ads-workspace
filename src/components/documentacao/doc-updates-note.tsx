// «Alteração recente» no topo de uma página da Documentação (v78.62): quem
// chega pelo sino (ou por acaso) vê logo o que mudou, quando e por quem.
//
// v80.9: passou a um botão pequeno («Alteração recente · dd/mm») que abre o
// conteúdo ao passar o rato (ou ao focar, no teclado e no toque). A caixa
// aberta no topo pesava no hero de todas as páginas. As anteriores (até 30
// dias) continuam num «ver mais» nativo dentro do painel. Servidor, sem
// JavaScript; sem alterações recentes não desenha nada.

import { BellRing, ChevronDown } from "lucide-react";
import { DOC_UPDATE_KIND_LABEL, changeLines, type DocUpdate } from "@/lib/documentacao/updates";
import { listDocUpdatesForPage } from "@/lib/documentacao/updates-store";

const RECENT_MS = 30 * 24 * 60 * 60 * 1000;

function when(ms: number): string {
  return new Date(ms).toLocaleString("en-GB", {
    timeZone: "Europe/Lisbon",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function shortDay(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit" });
}

function Entry({ u, lead }: { u: DocUpdate; lead: boolean }) {
  return (
    <div>
      <p className={`text-[12.5px] ${lead ? "text-white/80" : "text-white/60"}`}>
        <span className="font-semibold text-white">{DOC_UPDATE_KIND_LABEL[u.kind]}</span>
        <span className="text-white/40"> · {when(u.updatedAt)} · {u.by}</span>
      </p>
      <ul className="mt-1.5 space-y-0.5">
        {changeLines(u.changes).map((c, i) => (
          <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-white/60">
            <span aria-hidden className="text-[#b9a4ff]">•</span>
            <span className="min-w-0">{c}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function DocUpdatesNote({ pageId }: { pageId: string }) {
  const now = Date.now();
  const recent = (await listDocUpdatesForPage(pageId)).filter((u) => now - u.updatedAt <= RECENT_MS);
  if (recent.length === 0) return null;
  const [latest, ...older] = recent;
  return (
    <div className="group/upd relative mt-4 inline-block">
      <button
        type="button"
        aria-haspopup="true"
        className="inline-flex items-center gap-1.5 rounded-full border border-[#783DF5]/35 bg-[#783DF5]/[0.08] px-3 py-1.5 text-[12px] font-semibold text-[#cdbdff] transition hover:border-[#783DF5]/60 hover:bg-[#783DF5]/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5]"
      >
        <BellRing className="h-3.5 w-3.5" />
        Alteração recente
        <span className="font-medium text-white/45">· {shortDay(latest.updatedAt)}</span>
        <ChevronDown className="h-3.5 w-3.5 text-white/40 transition group-hover/upd:rotate-180 group-focus-within/upd:rotate-180" />
      </button>
      {/* O pt-2 faz de ponte: o rato passa do botão para o painel sem o fechar. */}
      <div className="invisible absolute left-0 top-full z-40 w-[32rem] max-w-[calc(100vw-2rem)] translate-y-[-4px] pt-2 opacity-0 transition duration-150 group-focus-within/upd:visible group-focus-within/upd:translate-y-0 group-focus-within/upd:opacity-100 group-hover/upd:visible group-hover/upd:translate-y-0 group-hover/upd:opacity-100 motion-reduce:transition-none">
        <aside
          aria-label="Alterações recentes a esta página"
          className="rounded-2xl border border-[#783DF5]/35 bg-[#0d0b1a]/95 px-4 py-3.5 shadow-[0_24px_70px_-16px_rgba(0,0,0,0.85)] backdrop-blur-md"
        >
          <Entry u={latest} lead />
          {older.length > 0 && (
            <details className="group mt-3">
              <summary className="cursor-pointer list-none text-[12px] font-medium text-white/50 transition hover:text-white">
                <span className="group-open:hidden">
                  Ver {older.length === 1 ? "a alteração anterior" : `as ${older.length} alterações anteriores`}
                </span>
                <span className="hidden group-open:inline">Esconder as anteriores</span>
              </summary>
              <div className="mt-3 space-y-3 border-t border-white/[0.07] pt-3">
                {older.map((u) => (
                  <Entry key={u.id} u={u} lead={false} />
                ))}
              </div>
            </details>
          )}
        </aside>
      </div>
    </div>
  );
}
