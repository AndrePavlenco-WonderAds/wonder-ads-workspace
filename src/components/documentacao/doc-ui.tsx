// As peças de leitura da Documentação da empresa — cabeçalho, secções,
// linhas de regras, notas e o portão. Servidor, sem estado. Um só sítio para
// o aspeto de um documento, para todos os blocos se lerem da mesma maneira.
//
// Linguagem (v78.7): conteúdo direto no fundo, separado por linhas finas;
// superfícies só para o que é vivo (tracking, simulador). Rótulos em letra
// normal, nunca maiúsculas espaçadas. Os números (€, %) são o destaque.

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ChevronRight, Construction, Lock } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { DocUpdatesNote } from "./doc-updates-note";

export function DocHero({
  block,
  title,
  lead,
  meta,
  tabs,
  pageId,
}: {
  /** Nome do bloco — vai para o trilho «Documentação › bloco». */
  block: string;
  title: string;
  lead: ReactNode;
  meta?: ReactNode;
  tabs?: { pages: Array<{ href: string; label: string }>; current: string };
  /** A página (`DocsPage.id`) — mostra a «Alteração recente» (v78.62). */
  pageId?: string;
}) {
  return (
    <header className="mt-4 sm:mt-6">
      <nav aria-label="Trilho" className="flex items-center gap-1 text-[12.5px] text-white/45">
        <Link href="/documentacao" className="transition hover:text-white">
          Documentação
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-white/25" />
        <span className="text-white/65">{block}</span>
      </nav>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.03em] text-white sm:text-[3.4rem]">
            {title}
          </h1>
          <p className="mt-3 text-[15.5px] leading-relaxed text-white/65 sm:text-[17px]">{lead}</p>
          {meta && <p className="mt-3 text-[12px] text-white/35">{meta}</p>}
          {pageId && <DocUpdatesNote pageId={pageId} />}
        </div>
        {tabs && <BlockTabs pages={tabs.pages} current={tabs.current} />}
      </div>
    </header>
  );
}

/** Troca entre as páginas de um bloco. */
export function BlockTabs({
  pages,
  current,
}: {
  pages: Array<{ href: string; label: string }>;
  current: string;
}) {
  return (
    <nav aria-label="Páginas do bloco" className="inline-flex rounded-2xl border border-white/10 bg-white/[0.03] p-1">
      {pages.map((p) => {
        const active = p.href === current;
        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-xl px-4 py-2 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5] ${
              active ? "bg-white text-[#07080d] shadow-[0_8px_24px_-12px_rgba(255,255,255,0.5)]" : "text-white/60 hover:text-white"
            }`}
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DocSection({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} data-doc-section className="scroll-mt-40 border-t border-white/[0.07] pt-10 sm:pt-12">
      <div className="max-w-3xl">
        <h2 className="text-[1.6rem] font-semibold leading-tight tracking-[-0.02em] text-white sm:text-[1.85rem]">{title}</h2>
        {lead && <p className="mt-2 text-[15px] leading-relaxed text-white/55">{lead}</p>}
      </div>
      <div className="mt-7 space-y-8">{children}</div>
    </section>
  );
}

export function SubHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-[15px] font-semibold text-white">{children}</h3>
      {aside && <span className="text-[12px] text-white/40">{aside}</span>}
    </div>
  );
}

/** Lista de regras: termo à esquerda, explicação ao meio, valor à direita.
 *  Lê-se como um documento, não como uma folha de cálculo. */
export function Rows({
  rows,
}: {
  rows: Array<{ term: ReactNode; detail?: ReactNode; value?: ReactNode; tone?: "default" | "amber" | "accent" }>;
}) {
  return (
    <dl className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
      {rows.map((r, i) => (
        <div
          key={i}
          className="grid gap-x-6 gap-y-1 py-3.5 sm:grid-cols-[minmax(10rem,14rem)_1fr_auto] sm:items-baseline"
        >
          <dt
            className={`text-[14px] font-medium ${
              r.tone === "amber" ? "text-amber-200" : r.tone === "accent" ? "text-[#c4a6ff]" : "text-white"
            }`}
          >
            {r.term}
          </dt>
          <dd className="text-[14px] leading-relaxed text-white/60">{r.detail}</dd>
          {r.value !== undefined && (
            <dd className="text-[15px] font-semibold tabular-nums text-white sm:text-right">{r.value}</dd>
          )}
        </div>
      ))}
    </dl>
  );
}

export function Note({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn";
  title?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border px-5 py-4 text-[14px] leading-relaxed ${
        tone === "warn"
          ? "border-amber-300/25 bg-amber-400/[0.06] text-amber-50/80"
          : "border-[#783DF5]/30 bg-[#783DF5]/[0.08] text-white/70"
      }`}
    >
      {title && <p className={`mb-1 font-semibold ${tone === "warn" ? "text-amber-100" : "text-white"}`}>{title}</p>}
      {children}
    </div>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2 text-[14px] leading-relaxed text-white/65">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden className="mt-[0.62em] h-1 w-1 shrink-0 rounded-full bg-[#a78bfa]" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

/** Uma sequência de etapas ligadas por uma linha no gradiente da marca — na
 *  horizontal a partir de md, na vertical no telemóvel. Só para conteúdo que
 *  é mesmo uma sequência: os números dizem a ordem. */
export function StageFlow({
  stages,
}: {
  stages: Array<{ title: ReactNode; body: ReactNode; foot?: ReactNode }>;
}) {
  return (
    <ol className="relative grid gap-6 md:grid-cols-3 md:gap-5">
      <span
        aria-hidden
        className="absolute bottom-6 left-5 top-6 w-px bg-[linear-gradient(180deg,#343ED7,#783DF5_50%,#C535C9)] md:bottom-auto md:left-6 md:right-0 md:top-5 md:h-px md:w-auto md:bg-[linear-gradient(90deg,#343ED7,#783DF5_40%,#C535C9_72%,transparent)]"
      />
      {stages.map((s, i) => (
        <li key={i} className="relative pl-14 md:pl-0 md:pt-16">
          <span
            className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full text-[15px] font-semibold text-white ring-4 ring-[#07080d]"
            style={{ background: ["#343ED7", "#783DF5", "#C535C9"][i % 3] }}
          >
            {i + 1}
          </span>
          <p className="text-[16px] font-semibold text-white">{s.title}</p>
          <div className="mt-1.5 text-[14px] leading-relaxed text-white/60">{s.body}</div>
          {s.foot && <div className="mt-3">{s.foot}</div>}
        </li>
      ))}
    </ol>
  );
}

/** O fecho de cada página (v78.25): o protocolo contado por extenso, em 3 a
 *  5 parágrafos — o que é, porquê e como se faz — para quem quer ler a regra
 *  de seguida em vez de a montar a partir das secções. Uma só coluna, a
 *  toda a largura do cartão, que se prolonga para baixo (pedido do André,
 *  v78.30 — as duas colunas da v78.28 saíram), e fecha com a assinatura e a
 *  data da última atualização. */
export function ExecutiveSummary({
  title,
  paragraphs,
  updatedAt,
}: {
  title: string;
  paragraphs: ReactNode[];
  /** YYYY-MM-DD — a data do bloco. */
  updatedAt: string;
}) {
  return (
    <section id="resumo" data-doc-section className="scroll-mt-40 border-t border-white/[0.07] pt-10 sm:pt-12">
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.025] px-6 pb-8 pt-9 sm:px-10 sm:pb-10 sm:pt-11">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: "var(--brand-gradient)" }} />
        <p className="text-[13px] font-medium text-[#c4a6ff]">Resumo executivo do protocolo</p>
        <h2 className="mt-1 text-[1.6rem] font-semibold leading-tight tracking-[-0.02em] text-white sm:text-[1.85rem]">{title}</h2>
        <div className="mt-6 space-y-5 text-[15.5px] leading-[1.85] text-white/75 sm:text-[16.5px]">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <footer className="mt-8 border-t border-white/10 pt-5">
          <p className="text-[15px] font-semibold text-white">Direção WonderAds</p>
          <p className="mt-0.5 text-[13px] text-white/50">Última atualização a {formatDate(updatedAt)}</p>
        </footer>
      </div>
    </section>
  );
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-white">{children}</strong>;
}

/** O que aparece a quem não pode abrir a página. */
export function DocsClosed({ kind, name }: { kind: "closed" | "forbidden"; name: string }) {
  const Icon = kind === "closed" ? Construction : Lock;
  return (
    <section className="mt-10 flex justify-center sm:mt-16">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
          <Icon className="h-5 w-5 text-white/60" />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-white">
          {kind === "closed" ? "Documentação em construção" : "Sem acesso a esta página"}
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-white/55">
          {kind === "closed"
            ? `${name.split(" ")[0]}, a documentação da empresa ainda não está aberta à equipa.`
            : "Este bloco não é do teu departamento."}
        </p>
        <Link
          href={kind === "closed" ? "/" : "/documentacao"}
          className="mt-6 inline-flex items-center gap-2 text-[13px] font-medium text-white/60 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {kind === "closed" ? "Voltar ao início" : "Voltar à documentação"}
        </Link>
      </div>
    </section>
  );
}
