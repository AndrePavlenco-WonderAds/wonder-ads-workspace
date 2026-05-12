import Image from "next/image";
import Link from "next/link";

export function WonderAdsLogo() {
  return (
    <Link
      href="/"
      className="group flex items-center gap-3 transition-opacity hover:opacity-90"
      aria-label="Wonder Ads — Home"
    >
      <span className="relative inline-flex h-11 w-11 items-center justify-center">
        <span
          aria-hidden
          className="absolute inset-0 rounded-full opacity-30 blur-lg transition-opacity duration-500 group-hover:opacity-60"
          style={{ background: "var(--brand-gradient)" }}
        />
        <Image
          src="/wonder-ads-butterfly.png"
          alt=""
          width={44}
          height={44}
          priority
          className="relative h-11 w-11 object-contain"
        />
      </span>
      <span className="text-base font-semibold tracking-tight text-white sm:text-lg">
        Wonder<span className="brand-gradient-text">Ads</span>
      </span>
    </Link>
  );
}
