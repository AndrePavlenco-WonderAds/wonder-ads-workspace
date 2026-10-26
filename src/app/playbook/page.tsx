// /playbook — o hub de documentação e SOPs (v78.5).
//
// Um cartão por bloco, filtrado pelo departamento da pessoa VISTA. Em
// construção: só o André entra (lib/playbook/access.ts).

import Link from "next/link";
import { ArrowUpRight, BookOpen, Users } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { PlaybookClosed } from "@/components/playbook/doc-ui";
import { PLAYBOOK_OPEN_TO_TEAM } from "@/lib/playbook/access";
import { blocksFor } from "@/lib/playbook/blocks";
import { getPlaybookContext } from "@/lib/playbook/server";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Playbook — Wonder Ads Workspace",
};

export default async function PlaybookPage() {
  const ctx = await getPlaybookContext();
  if (ctx.state === "no-session") return null;
  if (ctx.state !== "ok") {
    return (
      <PageShell backHref="/" backLabel="workspace">
        <PlaybookClosed kind={ctx.state} name={ctx.state === "closed" ? ctx.name : ctx.reader.name} />
      </PageShell>
    );
  }

  const { reader } = ctx;
  const blocks = blocksFor(reader);

  return (
    <PageShell backHref="/" backLabel="workspace">
      <header className="animate-fade-up mt-4 sm:mt-6">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
          <BookOpen className="h-3.5 w-3.5 text-[#c4a6ff]" />
          Documentação · SOPs
          {!PLAYBOOK_OPEN_TO_TEAM && (
            <span className="rounded-full border border-amber-400/40 bg-amber-400/15 px-1.5 py-px text-[9.5px] tracking-normal text-amber-200 normal-case">
              em construção
            </span>
          )}
        </p>
        <h1 className="mt-2 text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl">Playbook</h1>
        <p className="mt-3 max-w-2xl text-base text-white/65 sm:text-lg">
          As regras da casa, por escrito. Se não está aqui, pergunta — e passa a estar.
        </p>
      </header>

      {blocks.length === 0 ? (
        <p className="animate-fade-up mt-10 rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-white/50">
          Ainda não há blocos para o teu departamento.
        </p>
      ) : (
        <ul className="animate-fade-up mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {blocks.map((b) => (
            <li key={b.id} className="brand-gradient-border group relative flex flex-col rounded-3xl bg-white/[0.035] p-6">
              {reader.isAdmin && (
                <span
                  title="Quem vê este bloco"
                  className="mb-3 inline-flex w-fit items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/50"
                >
                  <Users className="h-3 w-3" />
                  SuperAdmin + {b.audienceLabel}
                </span>
              )}
              <h2 className="text-xl font-semibold tracking-tight text-white">{b.title}</h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-white/60">{b.summary}</p>
              <div className="mt-5 flex flex-1 flex-col justify-end gap-2">
                {b.pages.map((p) => (
                  <Link
                    key={p.href}
                    href={p.href}
                    className="group/link flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 transition hover:border-white/20 hover:bg-white/[0.06]"
                  >
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-white">{p.label}</span>
                      <span className="block truncate text-[11px] text-white/45">{p.hint}</span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-white/35 transition group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5 group-hover/link:text-white" />
                  </Link>
                ))}
              </div>
              <p className="mt-4 text-[10.5px] text-white/30">Atualizado {formatDate(b.updatedAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
