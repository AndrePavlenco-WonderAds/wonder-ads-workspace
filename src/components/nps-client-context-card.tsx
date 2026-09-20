// A FICHA INTERNA DO NPS MOSTRA O QUE O CLIENTE VAI VER (v77.38).
//
// O formulário público traz, ao lado das perguntas, o último relatório
// finalizado e o trabalho concluído nos últimos 3 meses (ver
// nps-context-shared.ts). Se o consultor enviar o inquérito com o relatório
// por finalizar ou o roadmap sem tarefas marcadas, o cliente avalia às
// cegas — e ninguém dá por isso. Este cartão diz-lhe, ANTES de enviar,
// exatamente o que está do outro lado, com o caminho mais curto para
// compor o que falta. Componente de servidor, tema escuro do workspace,
// sempre em português.

import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ListChecks,
} from "lucide-react";
import { formatDate } from "@/lib/dates";
import {
  NPS_PILLAR_LABEL,
  type NpsSurveyContext,
} from "@/lib/nps-context-shared";

type RowLink = { href: string; label: string; external?: boolean };

function Row({
  ok,
  icon,
  title,
  body,
  links,
}: {
  ok: boolean;
  icon: React.ReactNode;
  title: string;
  body: string;
  links: RowLink[];
}) {
  return (
    <div
      className="flex gap-3.5 rounded-xl border p-4"
      style={{
        borderColor: ok ? "rgba(52,211,153,0.25)" : "rgba(251,191,36,0.3)",
        background: ok ? "rgba(52,211,153,0.05)" : "rgba(251,191,36,0.06)",
      }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{
          background: ok ? "rgba(52,211,153,0.14)" : "rgba(251,191,36,0.14)",
          color: ok ? "#6ee7b7" : "#fcd34d",
        }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-semibold text-white/90">{title}</p>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              background: ok ? "rgba(52,211,153,0.12)" : "rgba(251,191,36,0.12)",
              color: ok ? "#6ee7b7" : "#fcd34d",
            }}
          >
            {ok ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <AlertTriangle className="h-3 w-3" />
            )}
            {ok ? "O cliente vê" : "O cliente não vê"}
          </span>
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-white/60">{body}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
          {links.map((l) =>
            l.external ? (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11.5px] font-medium text-white/65 underline-offset-2 transition hover:text-white hover:underline"
              >
                {l.label}
                <ArrowUpRight className="h-3 w-3" />
              </a>
            ) : (
              <Link
                key={l.href}
                href={l.href}
                className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[#a78bfa] underline-offset-2 transition hover:text-white hover:underline"
              >
                {l.label}
              </Link>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

export function NpsClientContextCard({
  slug,
  context,
}: {
  slug: string;
  context: NpsSurveyContext;
}) {
  const report = context.report;
  const work = context.work;
  const workCount = work?.total ?? 0;

  const pillarSummary =
    work && work.byPillar.length > 0
      ? work.byPillar
          .map((p) => `${NPS_PILLAR_LABEL[p.pillar].pt} ${p.count}`)
          .join(" · ")
      : "";

  const reportBody = report
    ? `${report.periodLabel} · finalizado a ${formatDate(
        report.finalizedAt ?? report.generatedAt,
      )}${report.partial ? " · parcial" : ""}`
    : "Sem relatório mensal finalizado — o cliente não encontra nenhum relatório no formulário. Gera e finaliza o do último mês antes de enviar.";

  const workBody =
    workCount > 0
      ? `${workCount} ${workCount === 1 ? "ação implementada" : "ações implementadas"} nos últimos 3 meses${
          pillarSummary ? ` · ${pillarSummary}` : ""
        }`
      : work
        ? "0 tarefas marcadas como Implemented nos últimos 3 meses — o cliente não encontra trabalho concluído no formulário. Atualiza o estado das tarefas no roadmap antes de enviar."
        : "Sem roadmap para este cliente — o cliente não encontra trabalho concluído no formulário.";

  return (
    <section className="animate-fade-up mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
      <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
        O que o cliente vê no formulário
      </p>
      <p className="mt-1 max-w-3xl text-sm text-white/60">
        Ao lado das perguntas, o cliente pode consultar o último relatório
        mensal finalizado e o trabalho concluído nos últimos 3 meses — dentro
        do formulário ou noutro separador. Confirma que está tudo em dia antes
        de enviar.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Row
          ok={Boolean(report)}
          icon={<BarChart3 className="h-4 w-4" />}
          title="Relatório mensal"
          body={reportBody}
          links={
            report
              ? [
                  {
                    href: `/seo/${slug}/report/${report.period}`,
                    label: "Abrir no workspace",
                  },
                  {
                    href: report.href,
                    label: "Ver como o cliente",
                    external: true,
                  },
                ]
              : [{ href: `/seo/${slug}/report`, label: "Gerar e finalizar o relatório" }]
          }
        />
        <Row
          ok={workCount > 0}
          icon={<ListChecks className="h-4 w-4" />}
          title="Trabalho concluído · 3 meses"
          body={workBody}
          links={[
            { href: `/seo/${slug}/roadmap`, label: "Abrir o roadmap" },
            ...(work?.roadmapHref
              ? [
                  {
                    href: work.roadmapHref,
                    label: "Ver como o cliente",
                    external: true,
                  },
                ]
              : []),
          ]}
        />
      </div>
    </section>
  );
}
