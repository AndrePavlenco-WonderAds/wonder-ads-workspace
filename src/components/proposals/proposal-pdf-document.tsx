// Página pública de uma proposta carregada em PDF — /proposta/<slug> para
// as propostas que entraram pelo Comercial (v77.12). A mesma moldura clara
// das propostas em código (logos lado a lado, «Descarregar PDF»), com o
// documento embebido a ocupar o ecrã: o cliente recebe o link, lê e
// descarrega — sem login e sem chrome interno.

import { Download } from "lucide-react";
import type { ProposalMeta } from "@/lib/proposals";
import type { ProposalFile } from "@/lib/proposals/store";
import { BRAND_GRADIENT, GradientText, Pill } from "./proposal-primitives";
import { KIND_LABEL } from "@/lib/proposals";
import { formatDate } from "@/lib/dates";

export function ProposalPdfDocument({
  meta,
  file,
  clientLogo,
  consultantName,
  consultantEmail,
}: {
  meta: ProposalMeta;
  file: ProposalFile;
  clientLogo: string | null;
  consultantName: string;
  consultantEmail: string;
}) {
  const downloadHref = `${file.url}${file.url.includes("?") ? "&" : "?"}download=1`;
  return (
    <main className="proposal flex min-h-screen flex-col bg-[#f4f4ed]">
      <div className="sticky top-0 z-30 border-b border-black/8 bg-[#f4f4ed]/92 backdrop-blur">
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
              <img src={clientLogo} alt={`${meta.clientName} logo`} className="h-7 w-7 rounded-md border border-black/8 bg-white object-contain p-0.5" />
            )}
            <span className="truncate text-[14px] font-semibold text-black/75">{meta.clientName}</span>
          </div>
          <a
            href={downloadHref}
            className="inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-[#783DF5]/25 transition hover:brightness-110"
            style={{ background: BRAND_GRADIENT }}
          >
            <Download className="h-3.5 w-3.5" />
            Descarregar PDF
          </a>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col px-4 pb-10 pt-8 sm:px-8 lg:px-12">
        <header>
          <div className="flex flex-wrap items-center gap-2">
            <Pill>{KIND_LABEL[meta.kind]}</Pill>
            {meta.period && <Pill tone="soft">{meta.period}</Pill>}
            <span className="text-[11.5px] text-black/45">{formatDate(meta.date)}</span>
          </div>
          <h1 className="mt-4 text-3xl font-semibold leading-[1.05] tracking-tight text-black/90 sm:text-5xl">
            {meta.clientName} <span className="text-black/30">+</span> <GradientText>WonderAds</GradientText>
          </h1>
          <p className="mt-2 text-base text-black/60 sm:text-lg">{meta.title}</p>
        </header>

        <div className="mt-6 flex-1 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-xl shadow-black/5">
          <iframe
            src={`${file.url}#toolbar=1&view=FitH`}
            title={`${meta.title} — ${meta.clientName}`}
            className="h-[78vh] min-h-[640px] w-full"
          />
        </div>
        <p className="mt-3 text-center text-[12px] text-black/45">
          Se o documento não aparecer,{" "}
          <a href={downloadHref} className="font-medium text-black/70 underline-offset-2 hover:underline">
            descarrega o PDF
          </a>
          .
        </p>

        <footer className="mt-10 border-t border-black/8 pt-6 text-center text-[11.5px] leading-relaxed text-black/50">
          <p>
            <span className="font-semibold"><GradientText>Wonder Ads</GradientText></span> · Agência de crescimento para Saúde &amp; Bem-Estar · #1 SEO Provider em Portugal
          </p>
          <p className="mt-1.5">
            Website: <a href="https://www.wonder-ads.com" className="font-medium text-black/65 underline-offset-2 hover:underline">www.wonder-ads.com</a>
            {" "}· E-mail: <a href="mailto:info@wonder-ads.com" className="font-medium text-black/65 underline-offset-2 hover:underline">info@wonder-ads.com</a>
          </p>
          {consultantName && consultantName !== "Unassigned" && (
            <p className="mt-1.5">
              Dúvidas sobre esta proposta? Fale com {consultantName} —{" "}
              <a href={`mailto:${consultantEmail}`} className="font-medium text-black/65 underline-offset-2 hover:underline">{consultantEmail}</a>
            </p>
          )}
          <p className="mt-3 text-black/35">Copyright 2026. All rights reserved.</p>
        </footer>
      </div>
      <div aria-hidden className="h-1.5 w-full" style={{ background: BRAND_GRADIENT }} />
    </main>
  );
}
