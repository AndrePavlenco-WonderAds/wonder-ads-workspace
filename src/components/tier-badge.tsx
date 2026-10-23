import type { ClientTier } from "@/lib/client-tiers";
import { TIER_LABEL } from "@/lib/client-tiers";

// Três degraus visuais, do mais simples ao mais top (v78.2). Todos levam o
// medidor de nível — 1, 2 ou 3 barras acesas — para o tier ler-se de relance
// mesmo sem o texto; o resto da pastilha sobe com o nível.
const STYLES: Record<ClientTier, { chip: string; on: string; off: string }> = {
  // Simples: vidro neutro, sem brilho.
  lite: {
    chip: "border border-white/15 bg-white/[0.04] text-white/70",
    on: "bg-white/70",
    off: "bg-white/15",
  },
  // Médio: roxo da marca em vidro, realce interior e um brilho suave.
  core: {
    chip: "border border-[rgba(150,110,255,0.5)] bg-[linear-gradient(135deg,rgba(52,62,215,0.28),rgba(120,61,245,0.3))] text-[#E4D8FF] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_3px_14px_-4px_rgba(120,61,245,0.6)]",
    on: "bg-[#C9B2FF]",
    off: "bg-[#C9B2FF]/25",
  },
  // Top: gradiente completo, anel claro, brilho forte e um reflexo a passar.
  // `border-box` no fundo: com o padding-box por defeito o gradiente repetia-
  // -se por baixo da borda semitransparente e deixava um fio rosa à esquerda.
  growth: {
    chip: "tier-growth-sheen border border-white/25 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_24px_-4px_rgba(197,53,201,0.75)] [background:var(--brand-gradient)_border-box]",
    on: "bg-white",
    off: "bg-white/35",
  },
};

const LEVEL: Record<ClientTier, number> = { lite: 1, core: 2, growth: 3 };
const BAR_HEIGHTS = ["h-[4px]", "h-[6px]", "h-[8px]"];

export function TierBadge({ tier }: { tier: ClientTier | null }) {
  if (!tier) return null;
  const s = STYLES[tier];
  return (
    <span
      className={`relative inline-flex shrink-0 items-center gap-1.5 overflow-hidden rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${s.chip}`}
      aria-label={`Tier: ${TIER_LABEL[tier]}`}
    >
      <span className="flex items-end gap-[2px]" aria-hidden>
        {BAR_HEIGHTS.map((h, i) => (
          <span
            key={h}
            className={`w-[2px] rounded-full ${h} ${i < LEVEL[tier] ? s.on : s.off}`}
          />
        ))}
      </span>
      {TIER_LABEL[tier]}
    </span>
  );
}
