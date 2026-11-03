// Chip «Origem» no cabeçalho do cliente no SEO (ao lado das Reviews) — só
// para os clientes com o add-on Origem de Pacientes (v78.68). Mostra quantos
// pacientes novos a receção registou este mês e abre a página.

import { Users } from "lucide-react";
import { getOrigemConfig, origemPath } from "@/lib/origem/config";
import { getMonthStats } from "@/lib/origem/store";
import { lisbonParts, scopeOf, searchCount, pct } from "@/lib/origem/stats";

export async function OrigemChip({ slug }: { slug: string }) {
  const cfg = getOrigemConfig(slug);
  if (!cfg) return null;
  const month = lisbonParts(Date.now()).month;
  const stats = await getMonthStats(cfg, month).catch(() => null);
  const all = stats ? scopeOf(stats, month, null) : null;
  const total = all?.total ?? 0;
  const search = all ? searchCount(cfg, all) : 0;

  const title = all
    ? `Origem dos ${cfg.person.many} · ${total} registados este mês` +
      (total ? ` · ${pct(search, total)}% pelo Google ou por IAs` : "") +
      " — a receção entra com PIN"
    : `Origem dos ${cfg.person.many} — a receção entra com PIN`;

  return (
    <a
      href={origemPath(slug)}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-medium text-white/65 transition hover:border-sky-300/40 hover:bg-sky-300/[0.06] hover:text-white"
    >
      <Users className="h-3 w-3 text-[#8CC2D0]" />
      <span className="uppercase tracking-[0.08em] text-white/45">Origem</span>
      <span className="font-semibold text-[#B9DEE8]">{total.toLocaleString("pt-PT")}</span>
      <span className="text-white/40">este mês</span>
    </a>
  );
}
