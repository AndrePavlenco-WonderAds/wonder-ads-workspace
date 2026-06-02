import Image from "next/image";
import type { CSSProperties } from "react";
import type { LogoBgMode, LogoSizing } from "@/lib/client-meta";

/** A square chip that renders either a real brand logo (white, dark, or
 *  brand-tinted background + brand-coloured glow behind, so any logo's
 *  contrast works), or falls back to an emoji on a gradient chip when no
 *  logo is available. */
const SIZES = {
  sm: { dim: "h-8 w-8", normalPad: "p-1", tightPad: "p-0.5", text: "text-base", imgPx: 32 },
  md: { dim: "h-11 w-11", normalPad: "p-1.5", tightPad: "p-0.5", text: "text-lg", imgPx: 44 },
  lg: { dim: "h-16 w-16", normalPad: "p-2", tightPad: "p-1", text: "text-3xl", imgPx: 64 },
  xl: { dim: "h-28 w-28", normalPad: "p-3", tightPad: "p-1.5", text: "text-5xl", imgPx: 112 },
} as const;

export function LogoChip({
  logo,
  emoji,
  alt,
  gradient,
  size = "md",
  bgMode = "white",
  sizing = "normal",
}: {
  logo: string | null;
  emoji: string | null;
  alt: string;
  gradient: string;
  size?: "sm" | "md" | "lg" | "xl";
  bgMode?: LogoBgMode;
  sizing?: LogoSizing;
}) {
  const s = SIZES[size];
  const dim = s.dim;
  const pad = sizing === "tight" ? s.tightPad : s.normalPad;
  const text = s.text;
  const imgPx = s.imgPx;

  if (!logo) {
    // Emoji fallback — keep the original gradient chip look.
    return (
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 rounded-xl opacity-45 blur-lg"
          style={{ background: gradient }}
        />
        <div
          className={`flex ${dim} items-center justify-center rounded-xl ring-1 ring-white/10 shadow-[0_8px_28px_-6px_rgba(0,0,0,0.5)]`}
          style={{ background: gradient }}
          aria-hidden
        >
          <span className={`${text} leading-none drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]`}>
            {emoji ?? "🌐"}
          </span>
        </div>
      </div>
    );
  }

  // Resolve chip background.
  let chipClass = "bg-white";
  let chipStyle: CSSProperties = {};
  let ringClass = "ring-white/20";
  if (bgMode === "dark") {
    chipClass = "bg-[#10131a]";
    ringClass = "ring-white/12";
  } else if (typeof bgMode === "object" && bgMode.custom) {
    chipClass = "";
    chipStyle = { background: bgMode.custom };
    ringClass = "ring-white/20";
  }

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-1 -z-10 rounded-2xl opacity-65 blur-lg"
        style={{ background: gradient }}
      />
      <div
        className={`flex ${dim} ${pad} items-center justify-center rounded-xl ${chipClass} ring-1 ${ringClass} shadow-[0_8px_28px_-6px_rgba(0,0,0,0.55)]`}
        style={chipStyle}
      >
        <Image
          src={logo}
          alt={alt}
          width={imgPx}
          height={imgPx}
          unoptimized
          className="h-full w-full object-contain"
        />
      </div>
    </div>
  );
}
