import Link from "next/link";
import { ArrowUpRight, UserRound } from "lucide-react";
import type { ClientPalette } from "@/lib/client-colors";
import { paletteToGradient } from "@/lib/client-colors";
import type { ClientTier } from "@/lib/client-tiers";
import type { AdChannel } from "@/lib/ads-clients";
import type { LogoBgMode, LogoSizing } from "@/lib/client-meta";
import { TierBadge } from "./tier-badge";
import { LogoChip } from "./logo-chip";
import { SiGoogle, SiMeta } from "./brand-icons";

export type ClientCardProps = {
  title: string;
  icon: string | null;
  logo?: string | null;
  logoBgMode?: LogoBgMode;
  logoSizing?: LogoSizing;
  href: string;
  consultant: string;
  palette: ClientPalette;
  tier: ClientTier;
  channels?: AdChannel[];
  index?: number;
};

export function ClientCard({
  title,
  icon,
  logo = null,
  logoBgMode = "white",
  logoSizing = "normal",
  href,
  consultant,
  palette,
  tier,
  channels,
  index = 0,
}: ClientCardProps) {
  const gradient = paletteToGradient(palette);

  return (
    <Link
      href={href}
      style={
        {
          "--client-grad": gradient,
        } as React.CSSProperties
      }
      className="brand-gradient-border animate-fade-up group relative flex flex-col gap-4 overflow-hidden rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md transition-all duration-500 hover:-translate-y-1 hover:bg-white/[0.06]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-15 blur-2xl transition-all duration-500 group-hover:opacity-55"
        style={{ background: gradient, animationDelay: `${index * 0.04}s` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -bottom-px h-px opacity-50 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: gradient }}
      />

      <div className="relative flex items-start justify-between">
        <div className="transition-transform duration-500 group-hover:scale-110">
          <LogoChip
            logo={logo}
            emoji={icon}
            alt={`${title} logo`}
            gradient={gradient}
            size="md"
            bgMode={logoBgMode}
            sizing={logoSizing}
          />
        </div>
        <ArrowUpRight
          className="h-4 w-4 text-white/30 transition-all duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white"
          aria-hidden
        />
      </div>

      <div className="relative">
        <h3 className="text-base font-semibold tracking-tight text-white">
          {title}
        </h3>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs">
            <UserRound className="h-3 w-3 text-white/50" />
            <span className="font-medium text-white/75">{consultant}</span>
          </p>
          <TierBadge tier={tier} />
        </div>
        {channels && channels.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {channels.map((c) => (
              <ChannelTag key={c} channel={c} />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

function ChannelTag({ channel }: { channel: AdChannel }) {
  if (channel === "google") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow-[0_4px_18px_-6px_rgba(234,67,53,0.4)]"
        style={{
          background:
            "linear-gradient(135deg, #4285F4 0%, #EA4335 35%, #FBBC05 65%, #34A853 100%)",
        }}
      >
        <SiGoogle className="h-3 w-3" />
        Google Ads
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow-[0_4px_18px_-6px_rgba(8,102,255,0.55)]"
      style={{
        background:
          "linear-gradient(135deg, #0866FF 0%, #1877F2 50%, #00C6FF 100%)",
      }}
    >
      <SiMeta className="h-3 w-3" />
      Meta Ads
    </span>
  );
}
