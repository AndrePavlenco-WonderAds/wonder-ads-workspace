// «Ficha de passagem» no cartão Client Files da página do cliente no SEO DPT
// (v80.43). A ficha que quem saiu escreveu fica junto do cliente PARA SEMPRE
// — também depois de a passagem fechar — para quem o tiver nesse momento.
//
// Só aparece a quem pode abrir a ficha: a direção, quem tem o cliente hoje,
// quem saiu e quem entrou nessa passagem. Os viewers nunca a veem.

import Link from "next/link";
import { ArrowRight, Handshake } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { getFicha, passagensForSlug } from "@/lib/passagem/store";
import { fichaProgress, formatISODate } from "@/lib/passagem/shared";

export async function PassagemFileTile({
  slug,
  viewer,
  ownerName,
}: {
  slug: string;
  viewer: { username: string; name: string; isAdmin: boolean; viewer: boolean } | null;
  /** Quem tem o cliente hoje no SEO DPT. */
  ownerName: string | null;
}) {
  if (!viewer || viewer.viewer) return null;
  const list = await passagensForSlug(slug).catch(() => []);
  const p = list[0];
  if (!p) return null;
  const project = p.projects.find((x) => x.slug === slug);
  const allowed =
    viewer.isAdmin ||
    viewer.name === ownerName ||
    p.outgoing.username === viewer.username ||
    project?.incoming?.username === viewer.username;
  if (!allowed) return null;

  const ficha = await getFicha(p.id, slug);
  const { pct } = fichaProgress(ficha, null);
  const subtitle =
    p.status === "ativa"
      ? `${p.outgoing.name} → ${project?.incoming?.name ?? "por decidir"} · em curso até ${formatISODate(p.endDate)}`
      : `Escrita por ${p.outgoing.name} · passagem concluída${p.closedAt ? ` a ${formatDate(p.closedAt)}` : ""}`;

  return (
    <Link
      href={`/passagem/${p.id}/${slug}`}
      title="Abrir a ficha de passagem"
      className="group/pa mb-4 flex items-center gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.05] px-3 py-2.5 transition hover:border-emerald-400/50 hover:bg-emerald-400/[0.09]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400/20 text-emerald-100">
        <Handshake className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-[13px] font-semibold text-white/90">Ficha de passagem</span>
        <span className="mt-0.5 block truncate text-[12px] text-white/50">{subtitle}</span>
      </span>
      <span className="shrink-0 text-[11px] tabular-nums text-white/45">{ficha.readyAt ? "pronta" : `${pct}%`}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/35 transition group-hover/pa:translate-x-0.5 group-hover/pa:text-white" />
    </Link>
  );
}
