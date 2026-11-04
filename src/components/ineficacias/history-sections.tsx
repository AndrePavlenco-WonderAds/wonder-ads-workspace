// O histórico do PRÓPRIO consultor — as ocorrências que a direção registou
// diretamente (RH-04) e «Os meus relatórios» (RH-03 com a pontuação da
// direção). Vive em /ineficacias e, desde a v78.71, também em
// /ineficacias/painel (pedido do André: o painel é o sítio principal para
// ver isto). Puro (server-safe).
//
// Recebe SEMPRE dados de `loadConsultantForSelf` — tipo de erro, impactos e
// sugestão da calculadora já vêm apagados; nunca passar aqui o bundle cru.

import { History, ShieldAlert } from "lucide-react";
import { ReportView, ScoreBadge } from "@/components/ineficacias/report-view";
import {
  formatISODate,
  formatLisbonDateTime,
  noticedLabel,
  reasonLabel,
  type DirectOccurrence,
  type IneficaciaReport,
} from "@/lib/ineficacias/shared";

export function IneficaciasHistory({
  reports,
  direct,
  className = "mt-10",
}: {
  reports: IneficaciaReport[];
  direct: DirectOccurrence[];
  className?: string;
}) {
  const sortedDirect = direct.slice().sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));

  return (
    <>
      {sortedDirect.length > 0 && (
        <section className={`animate-fade-up ${className}`} aria-label="Ocorrências registadas pela direção">
          <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-tight text-white">
            <ShieldAlert className="h-4 w-4 text-amber-300" />
            Ocorrências registadas pela direção
          </h2>
          <p className="mt-1 text-[12px] text-white/45">
            Registadas diretamente pela direção (não vieram de um relatório teu). Contam como as outras.
          </p>
          <div className="mt-3 space-y-3">
            {sortedDirect.map((d) => (
              <article key={d.id} className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-4">
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12.5px] text-white/80">
                    <span className="font-semibold">{d.client}</span>
                    <span className="text-white/40"> · {formatISODate(d.occurredOn)} · {reasonLabel(d.reason, d.reasonOther)} · {noticedLabel(d.noticed)}
                      {d.firstTime === true ? " · primeira vez" : d.firstTime === false ? ` · repetido (última vez: ${d.lastTime || "—"})` : ""}
                    </span>
                  </p>
                  <ScoreBadge score={d.score} size="sm" />
                </header>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-white/80">{d.what}</p>
                {d.shouldHave && <p className="mt-2 text-[12px] text-white/55">Como deveria ter sido: {d.shouldHave}</p>}
                {d.score.note && (
                  <p className="mt-2 text-[12px] text-white/55">
                    Nota ({d.score.byName || "direção"}, {formatLisbonDateTime(d.score.at)}): {d.score.note}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      <section className={`animate-fade-up ${className}`} aria-label="Os meus relatórios">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-tight text-white">
            <History className="h-4 w-4 text-[color:var(--brand-purple)]" />
            Os meus relatórios
          </h2>
          {reports.length > 0 && <span className="tabular text-[11px] text-white/35">{reports.length} no total</span>}
        </div>
        {reports.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-white/12 px-5 py-6 text-[12.5px] text-white/45">
            Ainda não assinaste nenhum relatório. O primeiro fica aqui, com a assinatura e a pontuação da direção.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {reports.map((r, i) => (
              <ReportView key={r.id} report={r} audience="consultor" defaultOpen={i === 0} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
