import Image from "next/image";
import type { CSSProperties } from "react";
import type { LogoBgMode, LogoSizing } from "@/lib/client-meta";

/** A square chip that renders either a real brand logo (white, dark, or
 *  brand-tinted background + brand-coloured glow behind, so any logo's
 *  contrast works), or falls back to an emoji on a gradient chip when no
 *  logo is available. */
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
  size?: "md" | "lg";
  bgMode?: LogoBgMode;
  sizing?: LogoSizing;
}) {
  const isLarge = size === "lg";
  const dim = isLarge ? "h-16 w-16" : "h-11 w-11";
  const normalPad = isLarge ? "p-2" : "p-1.5";
  const tightPad = isLarge ? "p-1" : "p-0.5";
  const pad = sizing === "tight" ? tightPad : normalPad;
  const text = isLarge ? "text-3xl" : "text-lg";
  const imgPx = isLarge ? 64 : 44;

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
