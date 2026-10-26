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

export function DocHero({
  block,
  title,
  lead,
  meta,
  tabs,
}: {
  /** Nome do bloco — vai para o trilho «Documentação › bloco». */
  block: string;
  title: string;
  lead: ReactNode;
  meta?: ReactNode;
  tabs?: { pages: Array<{ href: string; label: string }>; current: string };
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
