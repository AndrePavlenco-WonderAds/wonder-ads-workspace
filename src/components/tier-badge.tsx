import type { ClientTier } from "@/lib/client-tiers";
import { TIER_LABEL } from "@/lib/client-tiers";

const STYLES: Record<ClientTier, string> = {
  // Subtle. Low-key chip on dark glass.
  lite: "border border-white/15 bg-white/[0.05] text-white/65",
  // Medium impact. Brand purple with mid opacity.
  core: "border border-[rgba(120,61,245,0.45)] bg-[rgba(120,61,245,0.18)] text-[#D9C5FF] shadow-[0_2px_12px_-4px_rgba(120,61,245,0.45)]",
  // Full brand gradient + glow. Reserved for top tier.
  growth:
    "border border-transparent text-white shadow-[0_6px_22px_-4px_rgba(197,53,201,0.65)] [background:var(--brand-gradient)]",
};

export function TierBadge({ tier }: { tier: ClientTier }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${STYLES[tier]}`}
      aria-label={`Tier: ${TIER_LABEL[tier]}`}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}
