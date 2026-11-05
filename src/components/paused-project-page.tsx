// A página «Projeto em pausa» (v78.81) — o que um cliente vê em qualquer
// página pública do projeto dele (registo de leads, aprovações, relatórios,
// onboarding, NPS, reviews) enquanto um SuperAdmin o tiver pausado no SEO
// DPT. Clara, sem alarme: diz o que está fechado, que nada se perdeu e como
// se retoma.
//
// Veste a marca do cliente — o logótipo dele no centro de uma órbita que roda
// e, nos clientes da Origem, as cores dele — com a assinatura da WonderAds no
// rodapé, como as outras páginas que o cliente abre. A animação é só CSS e
// para com «reduzir movimento».

import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowUpRight, BarChart3, ClipboardList, Gem, ListChecks, Pause, ShieldCheck } from "lucide-react";
import { WonderAdsButterfly, WonderAdsFooter } from "@/components/origem/wonder-ads-signature";
import type { PublicLang } from "@/lib/public-i18n";

export type PausedPalette = {
  paper: string;
  ink: string;
  muted: string;
  line: string;
  primary: string;
  accent: string;
};

/** As cores da página quando o cliente não tem tema próprio: a WonderAds,
 *  em claro. */
export const NEUTRAL_PALETTE: PausedPalette = {
  paper: "#F6F5FA",
  ink: "#17142B",
  muted: "#625E78",
  line: "#E4E1EE",
  primary: "#783DF5",
  accent: "#C535C9",
};

export type PausedLogo =
  | { kind: "image"; src: string; background: string }
  | { kind: "butterfly" };

const COPY = {
  pt: {
    kicker: "Projeto em pausa",
    title: "Parece que este projeto está em pausa",
    lead: (brand: string) =>
      `As páginas do projeto ${brand} com a WonderAds estão fechadas enquanto o projeto estiver em pausa.`,
    featured: "Material Valioso para Ranks",
    items: ["Registo de leads", "Aprovações", "Relatórios"],
    paused: "em pausa",
    safe: "Nada se perdeu. Tudo o que foi registado fica guardado e volta a aparecer, tal e qual, quando o projeto for retomado.",
    hint: "Para retomar o projeto, fala connosco.",
    cta: "Falar com a WonderAds",
    message: (brand: string) => `Olá! Gostava de retomar o projeto ${brand} com a WonderAds.`,
  },
  en: {
    kicker: "Project on pause",
    title: "It looks like this project is on pause",
    lead: (brand: string) =>
      `The ${brand} project pages with WonderAds are closed while the project is on pause.`,
    featured: "Valuable Material for Rankings",
    items: ["Lead tracking", "Approvals", "Reports"],
    paused: "paused",
    safe: "Nothing is lost. Everything recorded so far is kept and will be back, exactly as it was, when the project resumes.",
    hint: "To resume the project, get in touch.",
    cta: "Talk to WonderAds",
    message: (brand: string) => `Hi! I'd like to resume the ${brand} project with WonderAds.`,
  },
} as const;

const ITEM_ICONS = [ClipboardList, ListChecks, BarChart3];

/** O botão abre uma conversa de WhatsApp com o André (v78.82), já com a
 *  mensagem escrita e o nome do projeto. */
const WHATSAPP_NUMBER = "351936535306";

const STYLES = `
.pp-spin{animation:pp-spin 3.6s linear infinite}
.pp-spin-slow{animation:pp-spin 22s linear infinite reverse}
.pp-breathe{animation:pp-breathe 4.8s ease-in-out infinite}
.pp-float{animation:pp-float 6s ease-in-out infinite}
.pp-rise{animation:pp-rise .7s cubic-bezier(.2,.8,.2,1) both}
@keyframes pp-spin{to{transform:rotate(360deg)}}
@keyframes pp-breathe{0%,100%{opacity:.5;transform:scale(.94)}50%{opacity:.9;transform:scale(1.05)}}
@keyframes pp-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes pp-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.pp-border{transform:translate(-50%,-50%);animation:pp-border 5s linear infinite}
.pp-shine{transform:translateX(0) skewX(-14deg);animation:pp-shine 4.2s ease-in-out 1.2s infinite}
.pp-grow{transform-origin:bottom;animation:pp-grow .9s cubic-bezier(.2,.8,.2,1) both}
.pp-pulse{animation:pp-pulse 3.2s ease-in-out infinite}
@keyframes pp-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
@keyframes pp-border{to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes pp-shine{0%{transform:translateX(0) skewX(-14deg)}50%,100%{transform:translateX(480%) skewX(-14deg)}}
@keyframes pp-grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@media (prefers-reduced-motion:reduce){.pp-spin,.pp-spin-slow,.pp-breathe,.pp-float,.pp-rise,.pp-border,.pp-grow,.pp-pulse{animation:none}.pp-shine{display:none}}
`;

/** #RRGGBB + alfa → rgba(). */
function alpha(hex: string, a: number): string {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** O logótipo do cliente no centro de uma órbita: um anel no gradiente da
 *  marca a rodar, uma órbita tracejada no sentido contrário com um ponto a
 *  dar a volta, e o selo de pausa a respirar. */
function PausedOrbit({ logo, brand, palette }: { logo: PausedLogo; brand: string; palette: PausedPalette }) {
  const ring: CSSProperties = {
    background: `conic-gradient(from 0deg, transparent 0deg, ${alpha(palette.primary, 0.15)} 40deg, ${palette.primary} 150deg, ${palette.accent} 250deg, transparent 320deg)`,
    WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px))",
    mask: "radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px))",
  };
  return (
    <div className="pp-float relative mx-auto h-48 w-48 sm:h-56 sm:w-56">
      <div
        aria-hidden
        className="pp-breathe absolute -inset-[22%] rounded-full blur-2xl"
        style={{ background: `radial-gradient(closest-side, ${alpha(palette.primary, 0.28)}, ${alpha(palette.accent, 0.12)} 55%, transparent)` }}
      />
      <div aria-hidden className="pp-spin absolute inset-0 rounded-full" style={ring} />
      <svg aria-hidden viewBox="0 0 100 100" className="pp-spin-slow absolute inset-[8%] h-[84%] w-[84%]">
        <circle cx="50" cy="50" r="48" fill="none" stroke={palette.ink} strokeOpacity="0.16" strokeWidth="0.7" strokeDasharray="1.6 3.4" />
        <circle cx="50" cy="2" r="2.4" fill={palette.accent} />
        <circle cx="2" cy="50" r="1.5" fill={palette.primary} fillOpacity="0.7" />
      </svg>
      <div
        className="absolute inset-[19%] grid place-items-center overflow-hidden rounded-full ring-1"
        style={{
          background: logo.kind === "image" ? logo.background : "#0F0B21",
          boxShadow: `0 18px 40px -18px ${alpha(palette.ink, 0.45)}, inset 0 0 0 1px ${alpha(palette.ink, 0.06)}`,
          ["--tw-ring-color" as string]: alpha(palette.ink, 0.06),
        }}
      >
        {logo.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo.src} alt={brand} className="h-[64%] w-[64%] object-contain" draggable={false} />
        ) : (
          <WonderAdsButterfly className="h-[52%] w-[52%] drop-shadow-[0_0_8px_rgba(150,90,255,0.6)]" />
        )}
      </div>
      <span
        className="absolute bottom-[9%] right-[9%] grid h-11 w-11 place-items-center rounded-full text-white shadow-lg ring-4"
        style={{
          background: `linear-gradient(135deg, ${palette.primary}, ${palette.accent})`,
          ["--tw-ring-color" as string]: palette.paper,
        }}
        aria-hidden
      >
        <Pause className="pp-breathe h-[18px] w-[18px]" fill="currentColor" strokeWidth={0} />
      </span>
    </div>
  );
}

/** O bloco principal (v78.83): o material que faz o site subir no Google —
 *  o que mais se perde com a pausa. Ocupa a linha toda, com a borda no
 *  gradiente da marca a rodar, um brilho que passa e o gráfico de subida
 *  parado no ⏸. */
function FeaturedPausedItem({ label, paused, palette }: { label: string; paused: string; palette: PausedPalette }) {
  return (
    <li
      className="relative col-span-3 overflow-hidden rounded-[18px] p-[1.5px]"
      style={{ boxShadow: `0 20px 40px -26px ${alpha(palette.primary, 0.9)}` }}
    >
      <span
        aria-hidden
        className="pp-border absolute left-1/2 top-1/2 aspect-square w-[150%]"
        style={{
          background: `conic-gradient(from 0deg, ${alpha(palette.primary, 0.12)}, ${palette.primary}, ${palette.accent}, ${alpha(palette.accent, 0.12)} 70%, ${alpha(palette.primary, 0.12)})`,
        }}
      />
      <div className="relative flex items-center gap-3.5 overflow-hidden rounded-[16.5px] bg-white px-4 py-4 text-left sm:gap-4 sm:px-5">
        <span
          aria-hidden
          className="pp-shine pointer-events-none absolute inset-y-0 -left-1/4 w-1/4"
          style={{ background: `linear-gradient(90deg, transparent, ${alpha(palette.primary, 0.13)}, transparent)` }}
        />
        <span
          className="pp-pulse relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white"
          style={{
            background: `linear-gradient(135deg, ${palette.primary}, ${palette.accent})`,
            boxShadow: `0 10px 24px -10px ${alpha(palette.primary, 0.85)}`,
          }}
        >
          <Gem className="h-5 w-5" />
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="block text-[15px] font-bold leading-snug sm:text-[16.5px]">{label}</span>
          <span
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold"
            style={{ background: alpha(palette.accent, 0.1), color: palette.ink }}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 motion-reduce:animate-none" style={{ background: palette.accent }} />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: palette.accent }} />
            </span>
            {paused}
          </span>
        </span>
        <span aria-hidden className="relative mr-1 flex h-11 shrink-0 items-end gap-[5px]">
          {[32, 50, 70, 100].map((h, i) => (
            <span
              key={h}
              className="pp-grow w-[7px] rounded-t-[3px]"
              style={{
                height: `${h}%`,
                background: `linear-gradient(180deg, ${palette.accent}, ${palette.primary})`,
                opacity: 0.4 + i * 0.2,
                animationDelay: `${450 + i * 120}ms`,
              }}
            />
          ))}
          <span
            className="absolute -right-2.5 -top-2.5 grid h-5 w-5 place-items-center rounded-full bg-white shadow-md ring-1"
            style={{ color: palette.primary, ["--tw-ring-color" as string]: alpha(palette.ink, 0.08) }}
          >
            <Pause className="h-2.5 w-2.5" fill="currentColor" strokeWidth={0} />
          </span>
        </span>
      </div>
    </li>
  );
}

export function PausedProjectPage({
  brand,
  logo,
  palette,
  lang,
  teamNote,
}: {
  brand: string;
  logo: PausedLogo;
  palette: PausedPalette;
  lang: PublicLang;
  /** Só com sessão da equipa: é isto que o cliente vê, e como se reabre. */
  teamNote: boolean;
}) {
  const t = COPY[lang];
  const whatsapp = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t.message(brand))}`;
  return (
    <div
      className="flex min-h-[100dvh] flex-col"
      style={{
        background: `radial-gradient(60rem 32rem at 50% -8rem, ${alpha(palette.primary, 0.1)}, transparent 70%), radial-gradient(40rem 26rem at 100% 100%, ${alpha(palette.accent, 0.07)}, transparent 70%), ${palette.paper}`,
        color: palette.ink,
      }}
    >
      <style>{`html,body{background:${palette.paper}}${STYLES}`}</style>
      <main className="flex flex-1 items-center justify-center px-5 pb-14 pt-[max(40px,env(safe-area-inset-top))] sm:px-8">
        <div className="w-full max-w-[600px] text-center">
          <PausedOrbit logo={logo} brand={brand} palette={palette} />

          <p
            className="pp-rise mt-9 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ borderColor: alpha(palette.primary, 0.28), background: alpha(palette.primary, 0.07), color: palette.ink }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:animate-none" style={{ background: palette.primary }} />
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: palette.primary }} />
            </span>
            {t.kicker} · {brand}
          </p>

          <h1 className="pp-rise mt-5 text-balance text-[30px] font-bold leading-[1.12] tracking-tight sm:text-[40px]" style={{ animationDelay: "60ms" }}>
            {t.title}
          </h1>
          <p className="pp-rise mx-auto mt-4 max-w-[480px] text-pretty text-[15.5px] leading-relaxed" style={{ color: palette.muted, animationDelay: "120ms" }}>
            {t.lead(brand)}
          </p>

          <ul className="pp-rise mx-auto mt-7 grid max-w-[540px] grid-cols-3 gap-2 sm:gap-3" style={{ animationDelay: "180ms" }}>
            <FeaturedPausedItem label={t.featured} paused={t.paused} palette={palette} />
            {t.items.map((label, i) => {
              const Icon = ITEM_ICONS[i];
              return (
                <li
                  key={label}
                  className="flex flex-col items-center gap-2 rounded-2xl border bg-white/70 px-2 py-3.5 sm:px-3 sm:py-4"
                  style={{ borderColor: palette.line }}
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: alpha(palette.primary, 0.1), color: palette.primary }}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="text-balance text-[12.5px] font-semibold leading-tight sm:text-[13.5px]">{label}</span>
                  <span className="-mt-0.5 inline-flex items-center gap-1 text-[11px] sm:text-[11.5px]" style={{ color: palette.muted }}>
                    <Pause className="h-2.5 w-2.5" fill="currentColor" strokeWidth={0} />
                    {t.paused}
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="pp-rise mx-auto mt-6 flex max-w-[460px] items-start justify-center gap-2 text-left text-[13.5px] leading-relaxed" style={{ color: palette.muted, animationDelay: "240ms" }}>
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: palette.primary }} />
            <span>{t.safe}</span>
          </p>

          <div className="pp-rise mt-8 flex flex-col items-center gap-2.5" style={{ animationDelay: "300ms" }}>
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14.5px] font-semibold text-white shadow-[0_14px_30px_-14px_rgba(0,0,0,0.5)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{ background: palette.ink }}
            >
              {t.cta}
              <ArrowUpRight className="h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
            <p className="text-[12.5px]" style={{ color: palette.muted }}>
              {t.hint}
            </p>
          </div>

          {teamNote && (
            <p
              className="mx-auto mt-9 max-w-[480px] rounded-2xl border border-dashed px-4 py-3 text-left text-[12.5px] leading-relaxed"
              style={{ borderColor: alpha(palette.ink, 0.2), color: palette.muted }}
            >
              <strong style={{ color: palette.ink }}>Sessão da equipa:</strong> é isto que o cliente vê em todas as
              páginas do projeto. Para as reabrir, reativa {brand} no{" "}
              <Link href="/seo" className="font-semibold underline underline-offset-2" style={{ color: palette.ink }}>
                SEO DPT
              </Link>{" "}
              (botão ▶ no cartão do cliente).
            </p>
          )}
        </div>
      </main>
      <WonderAdsFooter />
    </div>
  );
}
