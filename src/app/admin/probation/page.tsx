// SuperAdmin → Planos de Probation: a lista de todos os planos (consultor,
// início, próxima avaliação, estado) e as portas para um plano novo e para o
// template em branco. Só SuperAdmin: a página verifica isAdmin antes de ler
// o KV (o layout de /admin sozinho não basta — ver abaixo) e as APIs voltam a
// verificar por conta própria.

import Link from "next/link";
import { ArrowLeft, ClipboardCheck, FileDown, Plus } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { StatusChip } from "@/components/probation/status-chip";
import { listPlans, probationConfigured } from "@/lib/probation/store";
import { formatISODate, summarize, type ProbationSummary } from "@/lib/probation/shared";
import { daysUntilISO } from "@/lib/dates";
import { getCurrentEmployee } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Planos de Probation — SuperAdmin Control Suite",
};

/** O template em branco — uma rota de API (descarga), não uma página. */
const TEMPLATE_PDF = "/api/admin/probation/template/pdf";

/** Abertos primeiro, pela próxima avaliação; fechados depois, pelos mais
 *  recentes. */
function order(a: ProbationSummary, b: ProbationSummary): number {
  if (a.next && b.next) return a.next.date.localeCompare(b.next.date);
  if (a.next) return -1;
  if (b.next) return 1;
  return b.updatedAt - a.updatedAt;
}

function NextCell({ s }: { s: ProbationSummary }) {
  if (!s.next) return <span className="text-white/30">—</span>;
  const days = daysUntilISO(s.next.date);
  const when =
    Number.isNaN(days) ? "" : days === 0 ? "hoje" : days > 0 ? `daqui a ${days} d` : `há ${-days} d`;
  return (
    <span className="flex flex-col">
      <span className="tabular font-semibold text-white/85">{formatISODate(s.next.date)}</span>
      <span className={`text-[11px] ${days < 0 ? "text-amber-300/80" : "text-white/40"}`}>
        {s.next.label}
        {when ? ` · ${when}` : ""}
      </span>
    </span>
  );
}

export default async function ProbationListPage() {
  // O layout de /admin mostra o «SuperAdmin only», mas NÃO chega: no App
  // Router a página renderiza em paralelo com o layout e o payload dela
  // segue na resposta mesmo quando o layout recusa. Dados de RH → a página
  // verifica por conta própria, ANTES de ler o que quer que seja.
  const employee = await getCurrentEmployee();
  if (!employee?.isAdmin) return null;
  const plans = (await listPlans()).map(summarize).sort(order);
  const open = plans.filter((p) => p.next).length;

  return (
    <PageShell>
      <Link
        href="/admin"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to Control Suite
      </Link>

      <header className="animate-fade-up mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="readout text-white/35">Recursos Humanos · Direção</p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            <span className="brand-gradient-text">Planos de Probation</span>
          </h1>
          <p className="mt-1.5 max-w-[640px] text-[12.5px] leading-relaxed text-white/45">
            30 dias, duas avaliações (aos 15 e aos 30) e acompanhamento semanal. Cada avaliação acaba numa de
            três decisões: extensão, recuperação para a equipa ou saída.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={TEMPLATE_PDF}
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-[12.5px] font-medium text-white/75 transition hover:border-white/25 hover:text-white"
          >
            <FileDown className="h-3.5 w-3.5" />
            Template em branco (PDF)
          </a>
          <Link
            href="/admin/probation/novo"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-semibold text-white shadow-[0_8px_22px_-8px_rgba(120,61,245,0.7)] transition hover:-translate-y-px"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Plus className="h-3.5 w-3.5" />
            Novo plano
          </Link>
        </div>
      </header>

      {!probationConfigured && (
        <p className="mt-6 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-[12.5px] text-amber-100">
          O armazenamento (KV) não está configurado neste ambiente — os planos não podem ser lidos nem gravados.
        </p>
      )}

      <section className="animate-fade-up mt-8">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
          {plans.length === 0
            ? "Ainda não há planos"
            : `${plans.length} ${plans.length === 1 ? "plano" : "planos"} · ${open} em aberto`}
        </p>

        {plans.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/12 px-6 py-10 text-center">
            <ClipboardCheck className="mx-auto h-6 w-6 text-white/30" />
            <p className="mt-3 text-[13px] text-white/55">Nenhum plano de probation criado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-white/[0.08] text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                  <th className="px-4 py-3 font-semibold">Consultor</th>
                  <th className="px-4 py-3 font-semibold">Início</th>
                  <th className="px-4 py-3 font-semibold">Próxima avaliação</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} className="border-b border-white/[0.05] transition last:border-b-0 hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <Link href={`/admin/probation/${p.id}`} className="group block">
                        <span className="font-semibold text-white group-hover:underline">{p.consultantName}</span>
                        <span className="block text-[11.5px] text-white/40">
                          {p.roleTeam || "—"}
                          {p.periodNumber > 1 ? ` · ${p.periodNumber}.º período` : ""}
                        </span>
                      </Link>
                    </td>
                    <td className="tabular px-4 py-3 text-white/70">{formatISODate(p.startDate) || "—"}</td>
                    <td className="px-4 py-3">
                      <NextCell s={p} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageShell>
  );
}
