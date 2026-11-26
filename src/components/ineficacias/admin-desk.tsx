// A MESA DE PONTUAÇÃO da direção (v80.50): uma ocorrência por pontuar de
// cada vez, com tudo o que é preciso para decidir à vista — o relato, o que o
// consultor diz (primeira vez? gravidade?), «o passado que interessa» (o
// mesmo cliente, o mesmo motivo, as parecidas) e, ao pontuar, o que a
// pontuação faz ao PA/NO de hoje. Server-safe; o controlo de pontuação é
// cliente.

import { ArrowDown, History, MessageSquareQuote, Sparkles } from "lucide-react";
import { ItemScoreControl, type ScoreImpact } from "@/components/ineficacias/admin-scoring";
import { ScoreBadge } from "@/components/ineficacias/report-view";
import { CalcBreakdownView } from "@/components/ineficacias/calc-breakdown";
import { RelatedTagChip, shortDate, SourceChip, StatusChip } from "@/components/ineficacias/admin-status";
import { bandOf, formatISODate, MAX_POINTS } from "@/lib/ineficacias/shared";
import type { PendingDesk } from "@/lib/ineficacias/admin-view";

function Fact({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">{label}</p>
      <div className="mt-1 text-[13px] leading-relaxed text-white/80">{children}</div>
    </div>
  );
}

export function PendingDeskCard({
  desk,
  who,
  impact,
  focused = false,
}: {
  desk: PendingDesk;
  who: string;
  impact: ScoreImpact;
  focused?: boolean;
}) {
  const e = desk.entry;
  const self = e.selfScore;
  const firstClaimWrong = e.firstTime === true && desk.similar > 0;

  return (
    <article
      id={`oc-${e.id}`}
      className={`scroll-mt-24 overflow-hidden rounded-3xl border bg-white/[0.025] ${
        focused ? "border-[#a78bfa]/60 shadow-[0_18px_50px_-24px_rgba(120,61,245,0.9)]" : "border-white/[0.1]"
      }`}
    >
      <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-b border-white/[0.06] px-5 py-3.5">
        <StatusChip status="pontuar" />
        <span className="text-[14px] font-semibold text-white">{e.client}</span>
        <span className="text-[12px] text-white/45">aconteceu a {formatISODate(e.occurredOn)}</span>
        <span className="ml-auto flex items-center gap-2 text-[11px] text-white/40">
          {e.reportedOn && <span>reportada a {formatISODate(e.reportedOn)}</span>}
          <SourceChip source={e.source} reportRef={e.reportRef} />
        </span>
      </header>

      <div className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* o relato */}
        <div className="min-w-0 space-y-4">
          <Fact label="O erro — o que aconteceu">
            <p className="whitespace-pre-wrap text-[14px] text-white/90">{e.what}</p>
          </Fact>
          {e.shouldHave && (
            <Fact label={e.source === "report" ? "Como acha que deveria ter feito" : "Como deveria ter sido"}>
              <p className="whitespace-pre-wrap">{e.shouldHave}</p>
            </Fact>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Fact label="Motivo">{e.reason}</Fact>
            <Fact label="Quem deu pelo erro">{e.noticed}</Fact>
            <Fact label="Primeira vez?">
              {e.firstTime === true ? "Sim, diz que é a primeira vez" : e.firstTime === false ? <>Não — última vez: <span className="text-white">{e.lastTime || "—"}</span></> : "Não indicado"}
            </Fact>
            <Fact label={`Gravidade para ${who}`}>
              {self === null ? (
                <span className="text-white/40">Sem autoavaliação</span>
              ) : (
                <>
                  <span className="tabular font-semibold text-white">{self}</span>
                  <span className="text-white/45"> / {MAX_POINTS} · {bandOf(self).label}</span>
                </>
              )}
            </Fact>
          </div>
        </div>

        {/* o passado que interessa */}
        <aside className="min-w-0 rounded-2xl border border-white/[0.08] bg-black/25 p-4">
          <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/55">
            <History className="h-3.5 w-3.5 text-[#c3aaff]" />
            O passado de {who}
          </p>
          {desk.others === 0 ? (
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-white/55">
              É a primeira ocorrência de {who} no registo — não há passado para comparar.
            </p>
          ) : (
            <>
              <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-white/50">
                <span>
                  <span className="tabular font-semibold text-white/80">{desk.others}</span> {desk.others === 1 ? "outra ocorrência" : "outras ocorrências"}
                </span>
                <span>
                  <span className={`tabular font-semibold ${desk.similar ? "text-rose-200" : "text-white/80"}`}>{desk.similar}</span>{" "}
                  {desk.similar === 1 ? "parecida" : "parecidas"}
                </span>
                {e.client !== "Interno" && (
                  <span>
                    <span className="tabular font-semibold text-white/80">{desk.sameClient}</span> em {e.client}
                  </span>
                )}
                <span>
                  <span className="tabular font-semibold text-white/80">{desk.sameReason}</span> com o mesmo motivo
                </span>
              </p>

              {firstClaimWrong && (
                <p className="mt-2.5 flex items-start gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-2 text-[11.5px] leading-snug text-amber-100">
                  <Sparkles className="mt-px h-3.5 w-3.5 shrink-0 text-amber-300" />
                  Diz que é a primeira vez, mas há {desk.similar} {desk.similar === 1 ? "ocorrência parecida" : "ocorrências parecidas"} no histórico — vê se é recorrência.
                </p>
              )}

              {desk.related.length === 0 ? (
                <p className="mt-3 text-[12px] text-white/45">Nada no mesmo cliente, com o mesmo motivo ou parecido.</p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {desk.related.map(({ entry: o, tags }) => (
                    <li key={o.id}>
                      <details className="group rounded-xl border border-white/[0.07] bg-white/[0.02] open:bg-white/[0.04]">
                        <summary className="flex cursor-pointer list-none flex-col gap-1 px-3 py-2 [&::-webkit-details-marker]:hidden">
                          <span className="flex items-center gap-2">
                            <span className="tabular shrink-0 text-[11px] text-white/40">{shortDate(o.occurredOn)}</span>
                            <span className="min-w-0 flex-1 truncate text-[12.5px] text-white/85">
                              <span className="font-semibold">{o.client}</span> · {o.what}
                            </span>
                            <ScoreBadge score={o.score} size="sm" />
                          </span>
                          <span className="flex flex-wrap gap-1">
                            {tags.map((t) => (
                              <RelatedTagChip key={t} tag={t} />
                            ))}
                            {o.status !== "pontuar" && <StatusChip status={o.status} />}
                          </span>
                        </summary>
                        <div className="space-y-2 border-t border-white/[0.06] px-3 py-2.5 text-[12px] leading-relaxed text-white/70">
                          <p className="whitespace-pre-wrap text-white/85">{o.what}</p>
                          {o.shouldHave && <p className="text-white/55">Como deveria ter sido: {o.shouldHave}</p>}
                          <p className="text-[11px] text-white/45">
                            {o.reason} · {o.noticed}
                            {o.firstTime === false ? ` · repetido (última vez: ${o.lastTime || "—"})` : o.firstTime ? " · primeira vez" : ""}
                            {o.selfScore !== null ? ` · ${who} deu ${o.selfScore}` : ""}
                          </p>
                          {o.score?.note && (
                            <p className="flex gap-1.5 text-white/65">
                              <MessageSquareQuote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#c3aaff]" />
                              <span>
                                <span className="font-semibold">{o.score.byName || "Direção"}:</span> {o.score.note}
                              </span>
                            </p>
                          )}
                          {o.breakdown && <CalcBreakdownView breakdown={o.breakdown} compact />}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
              <a href="#historico" className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#c3aaff] hover:text-white">
                <ArrowDown className="h-3 w-3" />
                Ver o histórico todo ({desk.others + 1})
              </a>
            </>
          )}
        </aside>
      </div>

      <div className="border-t border-white/[0.06] px-5 pb-5 pt-4">
        <ItemScoreControl target={e.target} initial={e.score} calc={e.calc} impact={impact} />
      </div>
    </article>
  );
}
