// /documentacao — o hub da Documentação da empresa (v78.5; cartões v78.9).
//
// Uma grelha de cartões, um por página de documentação: capa, título e o
// botão para abrir. Sem cabeçalhos de bloco — vai haver muitos tipos de
// documentação e o cartão tem de se explicar sozinho. Filtrado pelo
// departamento da pessoa VISTA. Aberto à equipa desde a v78.57
// (lib/documentacao/access.ts).
//
// v78.62 — um cartão cuja página mudou nos últimos 14 dias leva a pastilha
// «Atualizado» na capa (as alterações vêm de updates-store.ts).
//
// v80.46 — a barra de pesquisa por cima dos cartões procura DENTRO de todas
// as páginas que a pessoa lê e nas aulas da Formação dela
// (components/documentacao/docs-search.tsx). O cartão das Comissões leva a
// entrada direta para os cross-sells.

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Lock, Sparkles } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { DocsClosed } from "@/components/documentacao/doc-ui";
import { DocsSearch } from "@/components/documentacao/docs-search";
import { DOCS_OPEN_TO_TEAM } from "@/lib/documentacao/access";
import { blocksFor } from "@/lib/documentacao/blocks";
import { getDocsContext } from "@/lib/documentacao/server";
import { listDocUpdates } from "@/lib/documentacao/updates-store";
import { CROSS_SELLS } from "@/lib/documentacao/sales-catalog";
import type { CrawlPage } from "@/lib/documentacao/search-crawl";
import type { DocUpdate } from "@/lib/documentacao/updates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Documentação — Wonder Ads Workspace",
};

/** Quanto tempo um cartão mostra «Atualizado» depois de uma alteração. */
const UPDATED_PILL_MS = 14 * 24 * 60 * 60 * 1000;

function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit" });
}

/** Muda a cada deploy — o índice da pesquisa guardado no browser renova-se. */
const BUILD = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? "dev";

export default async function DocumentacaoPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const ctx = await getDocsContext();
  if (ctx.state === "no-session") return null;
  if (ctx.state !== "ok") {
    return (
      <PageShell backHref="/" backLabel="workspace">
        <DocsClosed kind={ctx.state} name={ctx.state === "closed" ? ctx.name : ctx.reader.name} />
      </PageShell>
    );
  }

  const blocks = blocksFor(ctx.reader);
  const cards = blocks.flatMap((b) => b.pages);
  const updates = await listDocUpdates().catch((err): DocUpdate[] => {
    console.error("docs hub updates read failed:", err instanceof Error ? err.message : err);
    return [];
  });
  const now = Date.now();
  const freshByPage = new Map<string, DocUpdate>();
  const lastByPage = new Map<string, number>();
  for (const u of updates) {
    lastByPage.set(u.page, Math.max(lastByPage.get(u.page) ?? 0, u.updatedAt));
    if (now - u.updatedAt > UPDATED_PILL_MS || freshByPage.has(u.page)) continue;
    freshByPage.set(u.page, u);
  }

  // O que a pesquisa lê: as páginas dos cartões + as que só se abrem por
  // dentro de outra (Consultoria Comercial), cada uma com a sua versão.
  const searchPages: CrawlPage[] = blocks.flatMap((b) =>
    [...b.pages, ...(b.searchOnly ?? [])].map((p) => ({
      id: p.id,
      label: p.label,
      href: p.href,
      block: b.title,
      image: p.image,
      version: `${BUILD}|${b.updatedAt}|${lastByPage.get(p.id) ?? 0}`,
    })),
  );
  const rawQ = (await searchParams).q;
  const initialQuery = (Array.isArray(rawQ) ? rawQ[0] : rawQ)?.slice(0, 120) ?? "";
  const crossSellNames = CROSS_SELLS.map((c) => c.name);

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

      <DocsSearch
        pages={searchPages}
        user={`${ctx.reader.username}${ctx.reader.isAdmin ? ":admin" : ""}`}
        build={BUILD}
        initialQuery={initialQuery}
      >
      {cards.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-white/15 p-8 text-center text-[14px] text-white/50">
          Ainda não há documentação para o teu departamento.
        </p>
      ) : (
        <ul className="mt-8 grid gap-5 pb-10 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c, i) => (
            <li
              key={c.id}
              className="group flex flex-col rounded-[28px] border border-white/10 bg-white/[0.035] p-3 transition duration-300 hover:border-white/20 hover:bg-white/[0.05]"
            >
              <Link
                href={c.href}
                tabIndex={-1}
                aria-hidden
                className="relative block aspect-[4/3] overflow-hidden rounded-[20px] bg-white/[0.04]"
              >
                {c.image ? (
                  <Image
                    src={c.image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
                    priority={i < 3}
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  // Provisório, até a capa do Gemini estar gerada.
                  <span
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ background: "radial-gradient(70% 60% at 50% 55%, rgba(120,61,245,0.35), transparent 70%)" }}
                  >
                    <BookOpen className="h-10 w-10 text-white/35" />
                  </span>
                )}
                {freshByPage.has(c.id) && (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-[#07080d]/75 px-2.5 py-1 text-[11.5px] font-semibold text-white shadow-[0_8px_24px_-10px_rgba(120,61,245,0.9)]">
                    <Sparkles className="h-3 w-3 text-[#cdbdff]" />
                    {freshByPage.get(c.id)!.kind === "nova" ? "Novo" : "Atualizado"} a {shortDate(freshByPage.get(c.id)!.updatedAt)}
                  </span>
                )}
              </Link>
              <div className="px-2 pb-5 pt-5">
                <h2 className="text-[1.35rem] font-semibold leading-tight tracking-[-0.02em] text-white">{c.label}</h2>
                {c.tag && (
                  // Sem fundo: só as letras, no gradiente da marca, que desliza
                  // por elas de tempos a tempos.
                  <p className="docs-brand-flow-text mt-1.5 text-[13.5px] font-semibold tracking-[0.01em]">{c.tag}</p>
                )}
                {c.spotlight && (
                  <Link
                    href={c.spotlight.href}
                    className="group/spot mt-3 block rounded-2xl border border-[#783DF5]/35 bg-[#783DF5]/[0.08] px-3.5 py-3 transition hover:border-[#c4a6ff]/60 hover:bg-[#783DF5]/[0.14]"
                  >
                    <span className="flex items-center justify-between gap-2 text-[13.5px] font-semibold text-white">
                      <span>
                        <span className="text-[#c4a6ff]">Cross-sells</span> · {c.spotlight.label}
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-[#c4a6ff] transition group-hover/spot:translate-x-0.5" />
                    </span>
                    {c.id === "comissoes" && (
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {crossSellNames.map((n) => (
                          <span key={n} className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[11.5px] text-white/70">
                            {n}
                          </span>
                        ))}
                      </span>
                    )}
                  </Link>
                )}
                {c.restricted && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[12px] font-medium text-white/70">
                    <Lock className="h-3 w-3" />
                    {c.restricted}
                  </p>
                )}
              </div>
              <Link
                href={c.href}
                className="mt-auto flex h-12 items-center justify-center rounded-2xl bg-white text-[14.5px] font-semibold text-[#07080d] transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07080d]"
              >
                Ler documentação
              </Link>
            </li>
          ))}
        </ul>
      )}
      </DocsSearch>
    </PageShell>
  );
}
