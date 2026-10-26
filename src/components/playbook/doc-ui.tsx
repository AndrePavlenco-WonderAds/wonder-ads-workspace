// As peças de leitura do Playbook — secções, tabelas de regras, notas e o
// portão. Tudo servidor; sem estado. Um só sítio para o aspeto de um
// documento, para todos os blocos se lerem da mesma maneira.

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Construction, Lock } from "lucide-react";

export function DocHeader({
  eyebrow,
  title,
  lead,
  meta,
}: {
  eyebrow: string;
  title: string;
  lead: ReactNode;
  /** Linha pequena por baixo («Atualizado 26/10/2026 · SEO DPT»). */
  meta?: ReactNode;
}) {
  return (
    <header className="animate-fade-up mt-4 sm:mt-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">{eyebrow}</p>
      <h1 className="mt-2 text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/65 sm:text-lg">{lead}</p>
      {meta && <p className="mt-4 text-[11.5px] text-white/35">{meta}</p>}
    </header>
  );
}

/** Separador entre as páginas de um bloco. */
export function BlockTabs({
  pages,
  current,
}: {
  pages: Array<{ href: string; label: string }>;
  current: string;
}) {
  return (
    <nav aria-label="Páginas do bloco" className="mt-6 inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
      {pages.map((p) => {
        const active = p.href === current;
        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-[12.5px] font-medium transition ${
              active ? "bg-white text-[#0b0b14]" : "text-white/60 hover:text-white"
            }`}
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Section({
  id,
  n,
  title,
  lead,
  children,
}: {
  id: string;
  /** «01» — o número da secção. */
  n: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="animate-fade-up scroll-mt-24 border-t border-white/[0.07] pt-8 sm:pt-10">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[13rem_1fr]">
        <div>
          <p className="font-mono text-[11px] font-semibold text-[#c4a6ff]">{n}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h2>
        </div>
        <div className="min-w-0">
          {lead && <p className="mb-5 max-w-2xl text-[14px] leading-relaxed text-white/60">{lead}</p>}
          <div className="space-y-5">{children}</div>
        </div>
      </div>
    </section>
  );
}

export function SubTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-white/45">{children}</h3>;
}

/** Tabela de regras. A primeira coluna vai a negrito; o resto é texto. */
export function RuleTable({
  head,
  rows,
  highlight,
  dense = false,
}: {
  head: string[];
  rows: ReactNode[][];
  /** Índice da linha a destacar (ex.: o patamar atual). */
  highlight?: number | null;
  dense?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
      <table className="w-full min-w-[32rem] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.03]">
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/40">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr
              key={i}
              className={`border-b border-white/[0.06] last:border-b-0 ${
                highlight === i ? "bg-[#783DF5]/[0.12]" : ""
              }`}
            >
              {cells.map((c, j) => (
                <td
                  key={j}
                  className={`px-4 align-top ${dense ? "py-2" : "py-3"} ${
                    j === 0 ? "font-medium text-white" : "text-white/70"
                  }`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Callout({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  return (
    <div
      className={`rounded-2xl border-l-2 px-4 py-3 text-[13px] leading-relaxed ${
        tone === "warn"
          ? "border-amber-300/70 bg-amber-400/[0.06] text-amber-50/85"
          : "border-[#783DF5] bg-[#783DF5]/[0.07] text-white/75"
      }`}
    >
      {children}
    </div>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-1.5 text-[13.5px] leading-relaxed text-white/70">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <span aria-hidden className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-white/35" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

/** Índice lateral (≥lg) com âncoras para as secções. */
export function DocToc({ items }: { items: Array<{ id: string; label: string }> }) {
  return (
    <nav aria-label="Nesta página" className="hidden xl:block">
      <div className="sticky top-24">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Nesta página</p>
        <ul className="mt-3 space-y-1.5 border-l border-white/10">
          {items.map((it) => (
            <li key={it.id}>
              <a
                href={`#${it.id}`}
                className="-ml-px block border-l border-transparent pl-3 text-[12px] text-white/45 transition hover:border-white/40 hover:text-white"
              >
                {it.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

/** O que aparece a quem não pode abrir a página. */
export function PlaybookClosed({ kind, name }: { kind: "closed" | "forbidden"; name: string }) {
  const Icon = kind === "closed" ? Construction : Lock;
  return (
    <section className="animate-fade-up mt-10 flex justify-center sm:mt-16">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
          <Icon className="h-5 w-5 text-white/60" />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-white">
          {kind === "closed" ? "Playbook — em construção" : "Sem acesso a esta página"}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-white/55">
          {kind === "closed"
            ? `${name.split(" ")[0]}, o Playbook ainda não está aberto à equipa.`
            : "Este bloco não é do teu departamento."}
        </p>
        <Link
          href={kind === "closed" ? "/" : "/playbook"}
          className="mt-6 inline-flex items-center gap-2 text-[12.5px] font-medium text-white/60 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {kind === "closed" ? "Voltar ao início" : "Voltar ao Playbook"}
        </Link>
      </div>
    </section>
  );
}
