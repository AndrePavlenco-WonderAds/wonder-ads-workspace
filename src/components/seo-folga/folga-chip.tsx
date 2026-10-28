// Chip «Folga» na ficha do cliente SEO (v78.37), ao lado do Pending Review:
// o que o projeto ainda tem este mês para extras, com uma mini barra, e o
// atalho para a página da folga. Só para quem pode editar o SEO — é quem
// decide oferecer um extra.

import Link from "next/link";
import { Wallet } from "lucide-react";
import { getClientTier } from "@/lib/client-tiers";
import { lisbonMonthKey } from "@/lib/dates";
import { baseAllowance, eurCents, summarizeFolga, type FolgaState } from "@/lib/seo-folga";
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
  const value =
    s.state === "lite" ? "cobrar extras" : s.state === "unset" ? "por definir" : eurCents(s.remaining);

  return (
    <Link
      href={`/seo/${slug}/folga`}
      title="Folga de custos: o que este projeto ainda tem este mês para extras oferecidos ao cliente"
      className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/75 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
    >
      <Wallet className="h-3 w-3" />
      <span>Folga</span>
      {s.state !== "lite" && s.state !== "unset" && (
        <span aria-hidden className="ml-0.5 h-1 w-9 overflow-hidden rounded-full bg-white/10">
          <span className={`block h-full rounded-full ${tone.bar}`} style={{ width: `${left * 100}%` }} />
        </span>
      )}
      <span
        className={`ml-1 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${tone.pill}`}
      >
        {value}
      </span>
    </Link>
  );
}
