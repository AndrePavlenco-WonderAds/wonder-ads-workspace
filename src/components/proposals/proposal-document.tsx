// Moldura de uma proposta pública: barra superior fixa (logos + âncoras +
// Guardar em PDF), hero, corpo e rodapé. O conteúdo vem de fora — cada
// proposta tem o seu corpo em `bodies/<slug>.tsx`.
//
// PORQUE NÃO USA PublicReportView: essa moldura é a de um RESULTADO de ação
// (voltar às Aprovações Pendentes, comentários, id do resultado). Uma
// proposta é um documento de venda — precisa de navegação por secções e de
// um cabeçalho que ponha os dois logos lado a lado, não de um botão de
// «voltar» para uma tabela que o prospect nunca viu.

import type { ReactNode } from "react";
import type { ProposalMeta } from "@/lib/proposals";
import { ProposalPrintButton } from "./proposal-print-button";
import { BRAND_GRADIENT, GradientText, Pill, StatGrid, type StatItem } from "./proposal-primitives";
import { formatDate } from "@/lib/dates";

export type ProposalNavItem = { id: string; label: string };

export type ProposalHero = {
  eyebrow: string;
  /** O nome do cliente — o «+ WonderAds» é acrescentado pela moldura. */
  title: string;
  subtitle?: string;
  /** Parágrafo de enquadramento por baixo do subtítulo — opcional. */
  context?: ReactNode;
  stats: StatItem[];
};

export function ProposalDocument({
  meta,
  clientLogo,
  nav,
  hero,
  consultantName,
  consultantEmail,
  children,
}: {
  meta: ProposalMeta;
  clientLogo: string | null;
  nav: ProposalNavItem[];
  hero: ProposalHero;
  consultantName: string;
  consultantEmail: string;
  children: ReactNode;
}) {
  const docTitle = `${meta.title} - ${meta.clientName} - Wonder Ads`;
  return (
    <main className="proposal min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: PROPOSAL_CSS }} />

      {/* ----- Barra superior ----- */}
      <div className="proposal-topbar sticky top-0 z-30 border-b border-black/8 bg-[#f4f4ed]/92 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between gap-4 px-4 py-2.5 sm:px-8 lg:px-12">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/wonder-ads-butterfly.png" alt="" className="h-7 w-7 object-contain" />
            <span className="text-[15px] font-semibold tracking-tight text-black/85">
              Wonder<GradientText>Ads</GradientText>
            </span>
            <span className="px-1 text-black/30">×</span>
            {clientLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={clientLogo}
                alt={`${meta.clientName} logo`}
                className="h-7 w-7 rounded-md border border-black/8 bg-white object-contain p-0.5"
              />
            )}
            <span className="truncate text-[14px] font-semibold text-black/75">
              {meta.clientName}
            </span>
          </div>
          <nav className="hidden items-center gap-4 md:flex">
            {nav.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className="text-[12px] font-medium text-black/55 transition hover:text-black/90"
              >
                {n.label}
              </a>
            ))}
          </nav>
          <ProposalPrintButton docTitle={docTitle} label="Guardar em PDF" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1800px] px-4 pb-16 pt-10 sm:px-8 sm:pt-14 lg:px-12">
        {/* ----- Hero ----- */}
        <header>
          <div className="flex flex-wrap items-center gap-2">
            <Pill>{hero.eyebrow}</Pill>
            <Pill tone="soft">SEO DPT</Pill>
            <span className="text-[11.5px] text-black/45">{formatDate(meta.date)}</span>
          </div>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight text-black/90 sm:text-6xl">
            {hero.title} <span className="text-black/30">+</span>{" "}
            <GradientText>WonderAds</GradientText>
          </h1>
          {hero.subtitle && (
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-black/70 sm:text-xl">
              {hero.subtitle}
            </p>
          )}
          {hero.context && (
            <div className="mt-6 rounded-xl border border-black/8 bg-white/70 px-5 py-4 text-[14px] leading-relaxed text-black/68">
              {hero.context}
            </div>
          )}
          <div className="mt-6">
            <StatGrid items={hero.stats} cols={4} />
          </div>
        </header>

        {children}

        {/* ----- Rodapé ----- */}
        <footer className="mt-16 border-t border-black/8 pt-8 text-center text-[11.5px] leading-relaxed text-black/50">
          <p>
            <span className="font-semibold">
              <GradientText>Wonder Ads</GradientText>
            </span>{" "}
            · Agência de crescimento para Saúde &amp; Bem-Estar · #1 SEO Provider em Portugal
          </p>
          <p className="mt-1.5">
            Website:{" "}
            <a href="https://www.wonder-ads.com" className="font-medium text-black/65 underline-offset-2 hover:underline">
              www.wonder-ads.com
            </a>{" "}
            · E-mail:{" "}
            <a href="mailto:info@wonder-ads.com" className="font-medium text-black/65 underline-offset-2 hover:underline">
              info@wonder-ads.com
            </a>
          </p>
          {consultantName && consultantName !== "Unassigned" && (
            <p className="mt-1.5">
              Dúvidas sobre esta proposta? Fale com {consultantName} —{" "}
              <a href={`mailto:${consultantEmail}`} className="font-medium text-black/65 underline-offset-2 hover:underline">
                {consultantEmail}
              </a>
            </p>
          )}
          <p className="mt-3 text-black/35">Copyright 2026. All rights reserved.</p>
        </footer>
      </div>

      {/* Faixa de gradiente no fundo, como assinatura */}
      <div aria-hidden className="h-1.5 w-full" style={{ background: BRAND_GRADIENT }} />
    </main>
  );
}

const PROPOSAL_CSS = `
html { scroll-behavior: smooth; }
@keyframes pr-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(120, 61, 245, 0.55); }
  50% { box-shadow: 0 0 0 14px rgba(120, 61, 245, 0); }
}
.proposal .pr-pulse { animation: pr-pulse 2.2s ease-out infinite; }
@keyframes pr-stripes { from { background-position: 0 0; } to { background-position: 14.14px 0; } }
.proposal .pr-stripes {
  background-image: repeating-linear-gradient(-45deg, rgba(255,255,255,0.28) 0 5px, transparent 5px 10px) !important;
  background-color: #783DF5;
  background-size: 14.14px 14.14px;
  animation: pr-stripes 1.1s linear infinite;
}
.proposal .pr-pulse-off { animation: none; }
@media (prefers-reduced-motion: reduce) {
  .proposal .pr-pulse, .proposal .pr-stripes { animation: none; }
}
@media print {
  .proposal .proposal-topbar { display: none !important; }
  .proposal .no-print { display: none !important; }
  .proposal .pr-reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
  .proposal .pr-anim { transform: none !important; opacity: 1 !important; transition: none !important; }
  .proposal .pr-stripes.pr-anim { transform: translateY(-50%) !important; }
  .proposal .pr-acc-body { grid-template-rows: 1fr !important; }
  .proposal .pr-pulse { animation: none !important; box-shadow: none !important; }
  .proposal .pr-stripes { animation: none !important; }
  .proposal section { break-inside: auto; }
  .proposal figure, .proposal .avoid-break { break-inside: avoid; }
  body { background: #fff !important; }
}
`;
