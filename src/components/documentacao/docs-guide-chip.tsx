// Chip «Como funciona» (v78.43) — no topo das páginas da app que têm um
// protocolo na Documentação (folga de custos, NPS, ineficácias, probation,
// comissões): liga diretamente à página certa da Documentação.
//
// Só aparece a quem consegue abrir essa página: enquanto a Documentação está
// em construção, só a quem lá entra; quando abrir à equipa, a cada um os
// blocos do seu departamento. Um chip que levasse a «Sem acesso» era pior do
// que nenhum.

import Link from "next/link";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { getDocsContext } from "@/lib/documentacao/server";

export async function DocsGuideChip({
  blockId,
  href,
  label,
}: {
  /** O bloco da Documentação — decide quem vê o chip. */
  blockId: string;
  /** A página exata do protocolo. */
  href: string;
  /** «Como atribuir extras», «Como funciona o NPS»… */
  label: string;
}) {
  const ctx = await getDocsContext(blockId).catch(() => null);
  if (ctx?.state !== "ok") return null;
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2 rounded-full border border-[#783DF5]/35 bg-[#783DF5]/[0.1] py-1 pl-1 pr-3 text-[12.5px] text-[#e4d9ff] transition hover:border-[#a78bfa]/60 hover:bg-[#783DF5]/[0.18]"
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "var(--brand-gradient)" }}>
        <BookOpen className="h-3.5 w-3.5 text-white" />
      </span>
      <span className="font-medium">{label}</span>
      <span className="hidden text-white/45 sm:inline">· ler na Documentação</span>
      <ArrowUpRight className="h-3.5 w-3.5 text-white/45 transition group-hover:-translate-y-px group-hover:translate-x-px group-hover:text-white" />
    </Link>
  );
}
