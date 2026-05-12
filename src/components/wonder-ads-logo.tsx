import Link from "next/link";

export function WonderAdsLogo() {
  return (
    <Link
      href="/"
      className="group flex items-center gap-2.5 transition-opacity hover:opacity-90"
      aria-label="Wonder Ads — Home"
    >
      <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg">
        <span
          aria-hidden
          className="brand-gradient-bg absolute inset-0 rounded-lg"
        />
        <span
          aria-hidden
          className="absolute inset-0 rounded-lg opacity-50 blur-md"
          style={{ background: "var(--brand-gradient)" }}
        />
        <span className="relative font-semibold text-white">W</span>
      </span>
      <span className="text-base font-semibold tracking-tight text-white sm:text-lg">
        Wonder<span className="brand-gradient-text">Ads</span>
      </span>
    </Link>
  );
}
