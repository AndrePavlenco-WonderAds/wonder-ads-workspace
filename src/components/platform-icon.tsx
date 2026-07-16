// Brand glyphs for the onboarding access lessons. Simplified, recognisable
// inline SVGs (no external assets) so they render on the light onboarding
// surface without a network request. Server-safe (pure SVG).

export function PlatformIcon({
  platform,
  className = "h-7 w-7",
}: {
  platform: string;
  className?: string;
}) {
  const common = { viewBox: "0 0 48 48", className, "aria-hidden": true } as const;

  switch (platform) {
    case "ga4":
      return (
        <svg {...common}>
          <rect x="31" y="6" width="11" height="36" rx="5.5" fill="#F9AB00" />
          <rect x="18" y="18" width="11" height="24" rx="5.5" fill="#E37400" />
          <circle cx="10.5" cy="36.5" r="5.5" fill="#E37400" />
        </svg>
      );
    case "gsc":
      return (
        <svg {...common}>
          <circle cx="20" cy="20" r="12" fill="#fff" stroke="#4285F4" strokeWidth="4" />
          <rect x="14" y="18" width="3.5" height="8" rx="1.5" fill="#34A853" />
          <rect x="18.5" y="14" width="3.5" height="12" rx="1.5" fill="#FBBC04" />
          <rect x="23" y="20" width="3.5" height="6" rx="1.5" fill="#EA4335" />
          <line x1="29" y1="29" x2="41" y2="41" stroke="#4285F4" strokeWidth="5" strokeLinecap="round" />
        </svg>
      );
    case "gmb":
      return (
        <svg {...common}>
          <path
            d="M24 4c-8.3 0-15 6.5-15 14.6C9 29 24 44 24 44s15-15 15-25.4C39 10.5 32.3 4 24 4z"
            fill="#4285F4"
          />
          <circle cx="24" cy="18.5" r="6" fill="#fff" />
        </svg>
      );
    case "google-ads":
      return (
        <svg {...common}>
          <rect x="8" y="7" width="12" height="30" rx="6" fill="#FBBC04" transform="rotate(-30 14 22)" />
          <rect x="28" y="7" width="12" height="30" rx="6" fill="#4285F4" transform="rotate(30 34 22)" />
          <circle cx="13.5" cy="38.5" r="6" fill="#34A853" />
        </svg>
      );
    case "meta":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="meta-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0064E0" />
              <stop offset="1" stopColor="#19AFFF" />
            </linearGradient>
          </defs>
          <path
            d="M13 16c-4.4 0-7 3.6-7 8s2.6 8 7 8c3.7 0 6.2-3.2 8.8-7.6L24 28l2.2 4.4C28.8 36.8 31.3 40 35 40c4.4 0 7-3.6 7-8s-2.6-8-7-8c-3.7 0-6.2 3.2-8.8 7.6"
            fill="none"
            stroke="url(#meta-g)"
            strokeWidth="5.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "merchant":
      return (
        <svg {...common}>
          <path d="M9 12h30l-3 9H12z" fill="#4285F4" />
          <rect x="12" y="24" width="24" height="14" rx="2" fill="#5E97F6" />
          <rect x="21" y="28" width="6" height="10" fill="#fff" />
        </svg>
      );
    case "tag-manager":
      return (
        <svg {...common}>
          <path d="M24 4l20 20-20 20L4 24z" fill="#8AB4F8" />
          <path d="M24 12l12 12-12 12-6-6 6-6-6-6z" fill="#4285F4" />
          <circle cx="24" cy="24" r="3.5" fill="#fff" />
        </svg>
      );
    case "wordpress":
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="20" fill="#21759B" />
          <path
            d="M11 24a13 13 0 0 0 7.3 11.7L12 18a13 13 0 0 0-1 6zm22 0c0-1.6-.4-3-1-4.3.8 2 .6 4.4-.6 7.4L28 39a13 13 0 0 0 5-15zM24 26l-4 11a13 13 0 0 0 8 .2l-.1-.2zm8-8.6c0-1.4-.5-2.4-1-3.2-.6-1-1.2-1.8-1.2-2.8 0-1.1.8-2.1 2-2.1h.1A13 13 0 0 0 15 11h.6c1.3 0 3.3-.2 3.3-.2.7 0 .8 1-.1 1 0 0-.7.1-1.4.1L21.6 22l2.6-7.8-1.9-5.1c-.6 0-1.3-.1-1.3-.1-.7 0-.6-1 0-1 0 0 2 .2 3.2.2 1.3 0 3.3-.2 3.3-.2.7 0 .8 1-.1 1 0 0-.6.1-1.4.1l4.3 12.7 1.2-4z"
            fill="#fff"
          />
        </svg>
      );
    case "shopify":
      return (
        <svg {...common}>
          <path d="M30 10c-.4-.1-3.3.1-3.3.1s-2.2-2.1-2.4-2.3c-.2-.2-.7-.2-.9-.1 0 0-.4.1-1.1.4-.7-2-1.9-3.8-4-3.8h-.2c-.6-.8-1.4-1.1-2-1.1-4.9.1-7.2 6.2-8 9.2l-3.4 1c-1 .3-1.1.4-1.2 1.4L2 38l22 4 12-2.6S30.4 10.1 30 10z" fill="#95BF47" />
          <path d="M30 10c-.4-.1-3.3.1-3.3.1s-2.2-2.1-2.4-2.3c-.1-.1-.2-.1-.3-.1L24 42l12-2.6S30.4 10.1 30 10z" fill="#5E8E3E" />
          <path d="M19.6 17l-1.5 4.4s-1.3-.7-2.9-.7c-2.3 0-2.4 1.4-2.4 1.8 0 2 5.2 2.7 5.2 7.3 0 3.6-2.3 6-5.4 6-3.7 0-5.6-2.3-5.6-2.3l1-3.3s2 1.7 3.6 1.7c1.1 0 1.5-.8 1.5-1.4 0-2.5-4.3-2.6-4.3-6.9 0-3.5 2.5-6.9 7.7-6.9 2 0 3.6.6 3.6.6z" fill="#fff" />
        </svg>
      );
    case "website":
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="19" fill="none" stroke="#6366F1" strokeWidth="4" />
          <ellipse cx="24" cy="24" rx="9" ry="19" fill="none" stroke="#6366F1" strokeWidth="4" />
          <line x1="6" y1="24" x2="42" y2="24" stroke="#6366F1" strokeWidth="4" />
        </svg>
      );
    default:
      return null;
  }
}
