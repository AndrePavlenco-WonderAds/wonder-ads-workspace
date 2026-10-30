// «Alteração recente» no topo de uma página da Documentação (v78.62): quem
// chega pelo sino (ou por acaso) vê logo o que mudou, quando e por quem. A
// mais recente aberta; as anteriores (até 30 dias) num «ver mais» nativo,
// sem JavaScript. Servidor; sem alterações recentes não desenha nada.

import { BellRing } from "lucide-react";
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
    <aside
      aria-label="Alterações recentes a esta página"
      className="mt-5 rounded-2xl border border-[#783DF5]/30 bg-[#783DF5]/[0.07] px-4 py-3.5"
    >
      <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#cdbdff]">
        <BellRing className="h-3.5 w-3.5" />
        Alteração recente
      </p>
      <div className="mt-2">
        <Entry u={latest} lead />
      </div>
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
  );
}
