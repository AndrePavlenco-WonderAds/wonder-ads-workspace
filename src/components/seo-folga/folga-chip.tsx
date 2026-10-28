// Chip «Folga» na ficha do cliente SEO (v78.37), ao lado do Pending Review:
// a percentagem da folga do mês que ainda está livre, com uma mini barra, e o
// atalho para a página da folga. Só a percentagem — o valor em euros fica
// dentro da página (pedido do André, v78.40). Só para quem pode editar o SEO
// — é quem decide oferecer um extra.

import Link from "next/link";
import { Wallet } from "lucide-react";
import { getClientTier } from "@/lib/client-tiers";
import { lisbonMonthKey } from "@/lib/dates";
import { baseAllowance, summarizeFolga, type FolgaState } from "@/lib/seo-folga";
import { getFolga } from "@/lib/seo-folga-store";

const TONE: Record<FolgaState, { pill: string; bar: string }> = {
  ok: { pill: "border-emerald-400/35 bg-emerald-500/15 text-emerald-100", bar: "bg-emerald-300" },
  low: { pill: "border-amber-400/40 bg-amber-500/20 text-amber-100", bar: "bg-amber-300" },
  out: { pill: "border-rose-400/40 bg-rose-500/20 text-rose-100", bar: "bg-rose-300" },
  over: { pill: "border-rose-400/50 bg-rose-500/25 text-rose-100", bar: "bg-rose-400" },
  lite: { pill: "border-amber-400/40 bg-amber-500/15 text-amber-100", bar: "bg-amber-300" },
  unset: { pill: "border-white/15 bg-white/[0.06] text-white/60", bar: "bg-white/30" },
};

export async function FolgaChip({ slug, hidden = false }: { slug: string; hidden?: boolean }) {
  if (hidden) return null;
  const tier = getClientTier(slug);
  const s = summarizeFolga(await getFolga(slug), baseAllowance(slug, tier), tier, lisbonMonthKey(Date.now()));
  const tone = TONE[s.state];
  const left = s.available > 0 ? Math.max(0, Math.min(1, s.remaining / s.available)) : 0;
  // Acima da folga a percentagem fica negativa: −30% = gastou-se 30% a mais.
  const pct = s.available > 0 ? Math.round((s.remaining / s.available) * 100) : s.remaining < 0 ? -100 : 0;
  const value = s.state === "unset" ? "—" : `${pct}%`.replace("-", "−");

  return (
    <Link
      href={`/seo/${slug}/folga`}
      title={
        s.state === "lite"
          ? "Folga de custos: cliente Lite, sem folga — os extras são cobrados"
          : s.state === "unset"
            ? "Folga de custos: por definir"
            : `Folga de custos: ${pct}% da folga deste mês ainda livre`
      }
      className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/75 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
    >
      <Wallet className="h-3 w-3" />
      <span>Folga</span>
      {s.state !== "lite" && s.state !== "unset" && (
        <span aria-hidden className="ml-0.5 h-1 w-9 overflow-hidden rounded-full bg-white/10">
          <span className={`block h-full rounded-full ${tone.bar}`} style={{ width: `${left * 100}%` }} />
        </span>
      )}
      {/* Lite: só o chip cinzento «Folga», sem etiqueta (v78.40). */}
      {s.state !== "lite" && (
        <span
          className={`ml-1 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${tone.pill}`}
        >
          {value}
        </span>
      )}
    </Link>
  );
}
