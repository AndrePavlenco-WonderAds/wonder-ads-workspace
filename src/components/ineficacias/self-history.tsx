"use client";

// O histórico do painel do consultor (v80.45): todas as ocorrências, das
// mais recentes para as mais antigas, agrupadas por mês, com filtros (a
// contar agora, por pontuar, de fases anteriores, não contaram). Cada cartão
// põe lado a lado a gravidade que o consultor deu e a pontuação da direção
// numa régua de 0 a 10, e abre o porquê dos pontos quando a direção o
// mostrou. Recebe a vista já montada (buildSelfPanel), sem nada da direção
// que ela não tenha escolhido mostrar.

import { useMemo, useState } from "react";
import { Calculator, ChevronDown, FileSignature, Hourglass, MessageSquareQuote, ShieldAlert } from "lucide-react";
import { CalcBreakdownView } from "@/components/ineficacias/calc-breakdown";
import { BAND_TONES } from "@/components/ineficacias/report-view";
import { bandOf, formatLisbonDateTime, MAX_POINTS } from "@/lib/ineficacias/shared";
import type { PanelEntry, PanelStatus, SelfPanel } from "@/lib/ineficacias/self-panel";

type Filter = "todas" | PanelStatus;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "conta", label: "A contar agora" },
  { id: "pontuar", label: "Por pontuar" },
  { id: "anterior", label: "Fases anteriores" },
  { id: "zero", label: "Não contaram" },
];

const STATUS: Record<PanelStatus, { label: string; cls: string; hint: string }> = {
  conta: {
    label: "A contar agora",
    cls: "border-amber-400/35 bg-amber-400/10 text-amber-200",
    hint: "Entra no teu PA e no teu NO de agora.",
  },
  pontuar: {
    label: "Por pontuar",
    cls: "border-dashed border-[#a78bfa]/45 bg-[#783DF5]/10 text-[#c3aaff]",
    hint: "À espera da pontuação da direção. Só depois entra nas contas.",
  },
  anterior: {
    label: "Fase anterior",
    cls: "border-white/15 bg-white/[0.05] text-white/55",
    hint: "Contou numa fase que já fechou (subida de nível ou reset). Já não pesa agora.",
  },
  zero: {
    label: "Não contou",
    cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    hint: "A direção deu 0 pontos: fica no histórico, mas não entra no PA nem no NO.",
  },
};

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const name = MONTHS[m - 1] ?? key;
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${y}`;
}

/* ------------------------------------------------------------------ */

/** A régua 0–10 com a tua marca e a da direção. */
function ScaleCompare({ self, dir }: { self: number | null; dir: number | null }) {
  const pos = (v: number) => `${(v / MAX_POINTS) * 100}%`;
  const dirBand = dir === null ? null : bandOf(dir);
  const markerTone: Record<string, string> = {
    zero: "bg-white",
    baixo: "bg-emerald-300",
    medio: "bg-amber-300",
    alto: "bg-orange-300",
    critico: "bg-rose-300",
  };
  return (
    <div className="relative mx-1.5 h-9">
      {/* a régua, pintada pelas bandas */}
      <div className="absolute inset-x-0 top-[15px] flex h-1.5 overflow-hidden rounded-full">
        <span className="h-full bg-white/10" style={{ width: "5%" }} />
        <span className="h-full bg-emerald-400/25" style={{ width: "30%" }} />
        <span className="h-full bg-amber-400/25" style={{ width: "30%" }} />
        <span className="h-full bg-orange-400/25" style={{ width: "20%" }} />
        <span className="h-full bg-rose-500/30" style={{ width: "15%" }} />
      </div>
      {self !== null && dir !== null && self !== dir && (
        <span
          aria-hidden
          className="absolute top-[16px] h-1 rounded-full bg-white/40"
          style={{ left: pos(Math.min(self, dir)), width: `${(Math.abs(dir - self) / MAX_POINTS) * 100}%` }}
        />
      )}
      {self !== null && (
        <span
          className="absolute top-[9px] flex h-[18px] w-[18px] -translate-x-1/2 items-center justify-center rounded-full border-2 border-white/80 bg-[#15121f] text-[8.5px] font-bold text-white"
          style={{ left: pos(self) }}
          title={`A tua avaliação: ${self}`}
        >
          {self}
        </span>
      )}
      {dir !== null && dirBand && (
        <span
          className={`absolute top-[7px] flex h-[22px] w-[22px] -translate-x-1/2 items-center justify-center rounded-full text-[10px] font-extrabold text-[#15121f] shadow-[0_4px_14px_-4px_rgba(0,0,0,0.8)] ${markerTone[dirBand.id]}`}
          style={{ left: pos(dir) }}
          title={`Direção: ${dir}`}
        >
          {dir}
        </span>
      )}
      <span className="absolute -bottom-0.5 left-0 text-[9px] text-white/25">0</span>
      <span className="absolute -bottom-0.5 right-0 text-[9px] text-white/25">10</span>
    </div>
  );
}

function Delta({ self, dir }: { self: number; dir: number }) {
  const d = dir - self;
  if (d === 0) {
    return <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-200">Igual ao que deste</span>;
  }
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${
        d > 0 ? "border-rose-400/30 bg-rose-500/10 text-rose-200" : "border-sky-400/30 bg-sky-400/10 text-sky-200"
      }`}
    >
      {d > 0 ? `+${d}` : `−${Math.abs(d)}`} do que deste
    </span>
  );
}

function ScoreLine({ who, value, muted }: { who: string; value: number | null; muted?: string }) {
  if (value === null) {
    return (
      <p className="text-[11.5px] text-white/45">
        <span className="font-semibold text-white/60">{who}:</span> {muted}
      </p>
    );
  }
  const b = bandOf(value);
  return (
    <p className="text-[11.5px] text-white/60">
      <span className="font-semibold text-white/75">{who}:</span>{" "}
      <span className="tabular font-bold text-white">{value}</span>
      <span className="text-white/40"> · {b.label}</span>
    </p>
  );
}

function EntryCard({ e }: { e: PanelEntry }) {
  const [open, setOpen] = useState(false);
  const [why, setWhy] = useState(false);
  const [y, m, d] = e.occurredOn.split("-");
  const st = STATUS[e.status];
  const dir = e.score?.points ?? null;
  const band = dir === null ? null : bandOf(dir);

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-white/[0.02] transition hover:border-white/[0.14]">
      <div className="flex gap-3.5 p-4 sm:gap-4 sm:p-5">
        {/* a data */}
        <div className="flex w-11 shrink-0 flex-col items-center self-start rounded-xl border border-white/[0.08] bg-black/20 py-1.5 text-center">
          <span className="tabular text-[17px] font-bold leading-none text-white">{d}</span>
          <span className="mt-0.5 text-[10px] font-semibold uppercase text-white/40">{MONTHS_SHORT[Number(m) - 1]}</span>
          <span className="text-[9px] text-white/25">{y}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[13.5px] font-semibold text-white/90">{e.client}</span>
            {e.source === "direcao" ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/[0.07] px-2 py-0.5 text-[10.5px] font-semibold text-amber-200/90">
                <ShieldAlert className="h-3 w-3" />
                Registada pela direção
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[10.5px] font-semibold text-white/55">
                <FileSignature className="h-3 w-3" />
                Reportada por ti{e.reportRef ? ` · ${e.reportRef}` : ""}
              </span>
            )}
            <span title={st.hint} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${st.cls}`}>
              {e.status === "pontuar" && <Hourglass className="h-3 w-3" />}
              {st.label}
            </span>
          </div>

          <p className={`mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-white/80 ${open ? "" : "line-clamp-2"}`}>{e.what}</p>

          {/* tu vs. direção */}
          <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/20 px-3.5 pb-2.5 pt-2">
            <ScaleCompare self={e.selfScore} dir={dir} />
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
              {e.source === "report" ? (
                <ScoreLine who="Tu" value={e.selfScore} muted="sem autoavaliação (relatório antigo)" />
              ) : (
                <ScoreLine who="Tu" value={null} muted="registada pela direção, sem a tua avaliação" />
              )}
              <ScoreLine who="Direção" value={dir} muted="ainda por pontuar" />
              {e.selfScore !== null && dir !== null && <Delta self={e.selfScore} dir={dir} />}
            </div>
          </div>

          {e.score?.note && (
            <p className="mt-2.5 flex gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-white/70">
              <MessageSquareQuote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#c3aaff]" />
              <span>
                <span className="font-semibold text-white/85">{e.score.byName || "Direção"}:</span> {e.score.note}
              </span>
            </p>
          )}

          {e.breakdown && (
            <div className="mt-2.5">
              <button
                type="button"
                onClick={() => setWhy((v) => !v)}
                aria-expanded={why}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#783DF5]/30 bg-[#783DF5]/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-[#d9c9ff] transition hover:bg-[#783DF5]/20"
              >
                <Calculator className="h-3.5 w-3.5" />
                Porquê {e.breakdown.total} {e.breakdown.total === 1 ? "ponto" : "pontos"}
                <ChevronDown className={`h-3.5 w-3.5 transition ${why ? "rotate-180" : ""}`} />
              </button>
              {why && (
                <div className="mt-2">
                  <CalcBreakdownView breakdown={e.breakdown} />
                </div>
              )}
            </div>
          )}

          {open && (
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-white/[0.06] pt-3 text-[12.5px] sm:grid-cols-2">
              <div>
                <dt className="text-[11px] text-white/40">Motivo</dt>
                <dd className="mt-0.5 text-white/80">{e.reason}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-white/40">Quem deu pelo erro</dt>
                <dd className="mt-0.5 text-white/80">{e.noticed}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-white/40">Primeira vez?</dt>
                <dd className="mt-0.5 text-white/80">
                  {e.firstTime === true ? "Sim" : e.firstTime === false ? `Não — última vez: ${e.lastTime || "—"}` : "Não indicado"}
                </dd>
              </div>
              {e.score && (
                <div>
                  <dt className="text-[11px] text-white/40">Pontuado</dt>
                  <dd className="mt-0.5 text-white/80">
                    {e.score.byName || "Direção"} · {formatLisbonDateTime(e.score.at)}
                  </dd>
                </div>
              )}
              {e.shouldHave && (
                <div className="sm:col-span-2">
                  <dt className="text-[11px] text-white/40">{e.source === "report" ? "Como achas que deverias ter feito" : "Como deveria ter sido"}</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-white/80">{e.shouldHave}</dd>
                </div>
              )}
              {e.reportId && (
                <div className="sm:col-span-2">
                  <a href={`#relatorio-${e.reportId}`} className="text-[12px] text-[#c3aaff] underline-offset-4 hover:underline">
                    Ver o relatório assinado {e.reportRef}
                  </a>
                </div>
              )}
            </dl>
          )}
        </div>

        {/* a pontuação final */}
        <div className="hidden shrink-0 flex-col items-end sm:flex">
          {band ? (
            <span className={`flex h-14 w-14 flex-col items-center justify-center rounded-2xl border ${BAND_TONES[band.id]}`}>
              <span className="tabular text-[22px] font-extrabold leading-none">{dir}</span>
              <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide opacity-80">{dir === 1 ? "ponto" : "pontos"}</span>
            </span>
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-[#a78bfa]/40 bg-[#783DF5]/10 text-[#c3aaff]">
              <Hourglass className="h-5 w-5" />
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-1 border-t border-white/[0.06] py-2 text-[11.5px] text-white/40 transition hover:bg-white/[0.02] hover:text-white/75"
      >
        {open ? "Esconder detalhes" : "Ver detalhes"}
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
      </button>
    </article>
  );
}

export function SelfHistory({ panel }: { panel: SelfPanel }) {
  const [filter, setFilter] = useState<Filter>("todas");
  const list = useMemo(
    () => (filter === "todas" ? panel.entries : panel.entries.filter((e) => e.status === filter)),
    [panel.entries, filter],
  );
  const groups = useMemo(() => {
    const out: { key: string; items: PanelEntry[] }[] = [];
    for (const e of list) {
      const k = monthKey(e.occurredOn);
      const g = out.find((x) => x.key === k);
      if (g) g.items.push(e);
      else out.push({ key: k, items: [e] });
    }
    return out;
  }, [list]);

  const visibleFilters = FILTERS.filter((f) => f.id === "todas" || panel.counts[f.id] > 0);

  return (
    <div>
      {visibleFilters.length > 1 && (
        <div role="tablist" aria-label="Filtrar ocorrências" className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visibleFilters.map((f) => {
            const on = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setFilter(f.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                  on ? "border-white/80 bg-white text-[#0c0a18]" : "border-white/10 bg-white/[0.03] text-white/60 hover:text-white"
                }`}
              >
                {f.label}
                <span className={`tabular rounded-full px-1.5 text-[10.5px] ${on ? "bg-black/10" : "bg-white/[0.08] text-white/50"}`}>
                  {panel.counts[f.id]}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {groups.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-white/12 px-5 py-6 text-[12.5px] text-white/45">Nada neste filtro.</p>
      ) : (
        <div className="mt-4 space-y-7">
          {groups.map((g) => (
            <section key={g.key} aria-label={monthLabel(g.key)}>
              <p className="mb-2.5 flex items-baseline gap-2 text-[12.5px] font-semibold text-white/55">
                {monthLabel(g.key)}
                <span className="tabular text-[11px] font-normal text-white/30">
                  {g.items.length} {g.items.length === 1 ? "ocorrência" : "ocorrências"}
                </span>
              </p>
              <div className="space-y-3">
                {g.items.map((e) => (
                  <EntryCard key={e.id} e={e} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
