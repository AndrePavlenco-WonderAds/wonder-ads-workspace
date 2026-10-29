// /documentacao — o hub da Documentação da empresa (v78.5; cartões v78.9).
//
// Uma grelha de cartões, um por página de documentação, 4 por linha (v78.55):
// capa, título e o botão para abrir. Sem cabeçalhos de bloco — vai haver muitos tipos de
// documentação e o cartão tem de se explicar sozinho. Filtrado pelo
// departamento da pessoa VISTA. Em construção: só o André e o Alex entram
// (lib/documentacao/access.ts).

import Image from "next/image";
import Link from "next/link";
import { BookOpen, Lock } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { DocsClosed } from "@/components/documentacao/doc-ui";
import { DOCS_OPEN_TO_TEAM } from "@/lib/documentacao/access";
import { blocksFor } from "@/lib/documentacao/blocks";
import { getDocsContext } from "@/lib/documentacao/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Documentação — Wonder Ads Workspace",
};

export default async function DocumentacaoPage() {
  const ctx = await getDocsContext();
  if (ctx.state === "no-session") return null;
  if (ctx.state !== "ok") {
    return (
      <PageShell backHref="/" backLabel="workspace">
        <DocsClosed kind={ctx.state} name={ctx.state === "closed" ? ctx.name : ctx.reader.name} />
      </PageShell>
    );
  }

  const cards = blocksFor(ctx.reader).flatMap((b) => b.pages);

  return (
    <PageShell backHref="/" backLabel="workspace">
      <header className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 sm:mt-6">
        <h1 className="text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.03em] text-white sm:text-[3.4rem]">
          Documentação da empresa
        </h1>
        {!DOCS_OPEN_TO_TEAM && (
          <span className="rounded-full border border-amber-400/40 bg-amber-400/15 px-2.5 py-1 text-[12px] font-medium text-amber-200">
            Em construção — ainda fechada à equipa
          </span>
        )}
      </header>

      {cards.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-white/15 p-8 text-center text-[14px] text-white/50">
          Ainda não há documentação para o teu departamento.
        </p>
      ) : (
        // 4 por linha a partir do lg (v78.55); 2 no tablet, 1 no telemóvel.
        // O cartão inteiro é um link só: um alvo grande e uma paragem de
        // teclado por documento.
        <ul className="mt-8 grid grid-cols-1 gap-4 pb-10 sm:mt-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {cards.map((c, i) => (
            <li key={c.id} className="flex">
              <Link
                href={c.href}
                className="group flex w-full flex-col rounded-[24px] border border-white/10 bg-white/[0.035] p-2.5 transition duration-300 hover:border-white/20 hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07080d]"
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-[17px] bg-white/[0.04]">
                  {c.image ? (
                    // As capas são 4:3 (1200 de largura): object-cover nunca as
                    // estica, no máximo apara um fio de lado.
                    <Image
                      src={c.image}
                      alt=""
                      fill
                      sizes="(min-width: 1280px) 290px, (min-width: 1024px) 23vw, (min-width: 640px) 46vw, 100vw"
                      priority={i < 4}
                      className="object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    // Provisório, até a capa do Gemini estar gerada.
                    <span
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ background: "radial-gradient(70% 60% at 50% 55%, rgba(120,61,245,0.35), transparent 70%)" }}
                    >
                      <BookOpen className="h-9 w-9 text-white/35" />
                    </span>
                  )}
                </div>
                <div className="px-1.5 pb-4 pt-4">
                  <h2 className="text-[1.25rem] font-semibold leading-snug tracking-[-0.015em] text-white lg:text-[1.1rem]">
                    {c.label}
                  </h2>
                  {c.tag && (
                    // Sem fundo: só as letras, no gradiente da marca, que desliza
                    // por elas de tempos a tempos.
                    <p className="docs-brand-flow-text mt-1 text-[13px] font-semibold tracking-[0.01em] lg:text-[12.5px]">
                      {c.tag}
                    </p>
                  )}
                  {c.restricted && (
                    <p className="mt-2 inline-flex items-start gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[11.5px] font-medium leading-snug text-white/70">
                      <Lock className="mt-[2px] h-3 w-3 shrink-0" />
                      {c.restricted}
                    </p>
                  )}
                </div>
                <div className="mt-auto flex h-11 items-center justify-center rounded-[15px] bg-white text-[14px] font-semibold text-[#07080d] transition group-hover:bg-white/90 lg:h-10 lg:text-[13.5px]">
                  Ler documentação
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
