"use client";

// O HISTÓRICO de um consultor, na vista da direção (v80.50): todas as
// ocorrências numa linha cada (relatório ou direção), das mais recentes para
// as mais antigas, agrupadas por mês, com o percurso na escala pelo meio
// (subidas, resets, medidas, nível à mão). Filtros por estado, cliente e
// motivo, e pesquisa no texto. Cada linha abre o relato inteiro, o porquê
// dos pontos e o «Corrigir pontuação».

import { useEffect, useMemo, useState } from "react";
import { ArrowUp, ChevronDown, MessageSquareQuote, PencilLine, Search, X } from "lucide-react";
import { ItemScoreControl, type ScoreImpact } from "@/components/ineficacias/admin-scoring";
import { ScoreBadge } from "@/components/ineficacias/report-view";
import { CalcBreakdownView } from "@/components/ineficacias/calc-breakdown";
import { shortDate, SourceChip, STATUS_META, StatusChip } from "@/components/ineficacias/admin-status";
import { normalize } from "@/lib/documentacao/search";
import { bandOf, formatISODate, formatLisbonDateTime, MAX_POINTS } from "@/lib/ineficacias/shared";
import type { AdminEntry, AdminStatus, JourneyItem } from "@/lib/ineficacias/admin-view";

type Filter = "todas" | AdminStatus;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "pontuar", label: STATUS_META.pontuar.label },
  { id: "conta", label: STATUS_META.conta.label },
  { id: "anterior", label: "Fases anteriores" },
  { id: "zero", label: "Não contaram" },
];

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const name = MONTHS[m - 1] ?? key;
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${y}`;
}

const JOURNEY_TONE: Record<JourneyItem["kind"], string> = {
  subida: "bg-rose-300",
  direcao: "bg-amber-300",
  nivel: "bg-amber-300",
  semestre: "bg-emerald-300",
  recuperado: "bg-emerald-300",
  medida: "bg-[#a78bfa]",
};

type Row = { kind: "occ"; at: string; e: AdminEntry } | { kind: "step"; at: string; j: JourneyItem; key: string };

function haystack(e: AdminEntry): string {
  return normalize([e.client, e.what, e.shouldHave, e.reason, e.noticed, e.reportRef ?? "", e.score?.note ?? ""].join(" "));
}

function JourneyRow({ j }: { j: JourneyItem }) {
  return (
    <li className="relative flex items-start gap-3 px-4 py-2.5">
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${JOURNEY_TONE[j.kind]}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold text-white/85">{j.title}</p>
        <p className="text-[11px] text-white/45">
          {formatISODate(j.at)}
          {j.by ? ` · por ${j.by}` : " · automático"}
        </p>
        {j.detail.length > 0 && (
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11.5px] text-white/55">
            {j.detail.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function EntryRow({
  e,
  who,
  impact,
  open,
  onToggle,
}: {
  e: AdminEntry;
  who: string;
  impact: ScoreImpact;
  open: boolean;
  onToggle: () => void;
}) {
  const [edit, setEdit] = useState(false);
  return (
    <li id={`h-${e.id}`} className={`scroll-mt-28 ${open ? "bg-white/[0.035]" : ""}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left transition hover:bg-white/[0.03]"
      >
        <span className="tabular w-[58px] text-[11.5px] text-white/45">{shortDate(e.occurredOn)}</span>
        <span className="min-w-0">
          <span className={`block text-[12.5px] text-white/85 ${open ? "" : "truncate"}`}>
            <span className="font-semibold">{e.client}</span>
            <span className="text-white/35"> · </span>
            {e.what}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1">
            <StatusChip status={e.status} />
            <SourceChip source={e.source} reportRef={e.reportRef} />
            <span className="text-[10.5px] text-white/40">{e.reason}</span>
            {e.firstTime === false && <span className="text-[10.5px] font-semibold text-rose-200/80">· repetido</span>}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <ScoreBadge score={e.score} size="sm" />
          <ChevronDown className={`h-3.5 w-3.5 text-white/35 transition ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-4 pl-[86px] max-sm:pl-4">
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/85">{e.what}</p>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 text-[12px] sm:grid-cols-2">
            {e.shouldHave && (
              <div className="sm:col-span-2">
                <dt className="text-[10.5px] text-white/40">{e.source === "report" ? "Como acha que deveria ter feito" : "Como deveria ter sido"}</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-white/75">{e.shouldHave}</dd>
              </div>
            )}
            <div>
              <dt className="text-[10.5px] text-white/40">Motivo</dt>
              <dd className="mt-0.5 text-white/75">{e.reason}</dd>
            </div>
            <div>
              <dt className="text-[10.5px] text-white/40">Quem deu pelo erro</dt>
              <dd className="mt-0.5 text-white/75">{e.noticed}</dd>
            </div>
            <div>
              <dt className="text-[10.5px] text-white/40">Primeira vez?</dt>
              <dd className="mt-0.5 text-white/75">
                {e.firstTime === true ? "Sim" : e.firstTime === false ? `Não — última vez: ${e.lastTime || "—"}` : "Não indicado"}
              </dd>
            </div>
            <div>
              <dt className="text-[10.5px] text-white/40">Gravidade</dt>
              <dd className="mt-0.5 text-white/75">
                {e.selfScore !== null ? `${who}: ${e.selfScore}/${MAX_POINTS}` : `${who}: —`}
                {" · "}
                {e.score ? `direção: ${e.score.points} (${bandOf(e.score.points).label.toLowerCase()})` : "direção: por pontuar"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[10.5px] text-white/40">Origem</dt>
              <dd className="mt-0.5 text-white/75">
                {e.source === "report" ? (
                  <>
                    Relatório{" "}
                    <a href={`#relatorio-${e.reportId}`} className="font-mono text-[#c3aaff] underline-offset-4 hover:underline">
                      {e.reportRef}
                    </a>
                    {e.reportedOn ? `, assinado a ${formatISODate(e.reportedOn)}` : ""}
                  </>
                ) : (
                  "Registada pela direção (RH-04)"
                )}
                {e.score ? ` · pontuada por ${e.score.byName || "direção"} a ${formatLisbonDateTime(e.score.at)}` : ""}
              </dd>
            </div>
          </dl>
          {e.score?.note && (
            <p className="flex gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-[12px] leading-relaxed text-white/70">
              <MessageSquareQuote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#c3aaff]" />
              <span>
                <span className="font-semibold text-white/85">{e.score.byName || "Direção"}:</span> {e.score.note}
              </span>
            </p>
          )}
          {e.breakdown && <CalcBreakdownView breakdown={e.breakdown} compact />}

          {e.status === "pontuar" ? (
            <a
              href={`#oc-${e.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-semibold text-white"
              style={{ background: "var(--brand-gradient)" }}
            >
              <ArrowUp className="h-3.5 w-3.5" />
              Pontuar lá em cima
            </a>
          ) : edit ? (
            <ItemScoreControl target={e.target} initial={e.score} calc={e.calc} impact={impact} />
          ) : (
            <button
              type="button"
              onClick={() => setEdit(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[11.5px] font-semibold text-white/70 transition hover:text-white"
            >
              <PencilLine className="h-3.5 w-3.5" />
              Corrigir pontuação
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export function AdminHistory({
  entries,
  journey,
  counts,
  clients,
  who,
  impactBase,
  focusIds = [],
}: {
  entries: AdminEntry[];
  journey: JourneyItem[];
  counts: Record<Filter, number>;
  clients: string[];
  who: string;
  /** O PA/NO de hoje — para o «Corrigir pontuação» mostrar o efeito. */
  impactBase: Omit<ScoreImpact, "inPhase">;
  /** Abre estas linhas e leva o ecrã à primeira (links do painel). */
  focusIds?: string[];
}) {
  const [filter, setFilter] = useState<Filter>("todas");
  const [client, setClient] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => new Set(focusIds));

  useEffect(() => {
    if (!focusIds.length) return;
    const el = document.getElementById(`h-${focusIds[0]}`);
    if (el) el.scrollIntoView({ block: "center" });
    // Só à chegada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tokens = useMemo(() => normalize(q).split(" ").filter(Boolean), [q]);
  const plain = filter === "todas" && !client && tokens.length === 0;

  const rows = useMemo(() => {
    const occ: Row[] = entries
      .filter((e) => filter === "todas" || e.status === filter)
      .filter((e) => !client || e.client === client)
      .filter((e) => {
        if (!tokens.length) return true;
        const h = haystack(e);
        return tokens.every((t) => h.includes(t));
      })
      .map((e) => ({ kind: "occ", at: e.occurredOn, e }));
    const steps: Row[] = plain ? journey.map((j, i) => ({ kind: "step", at: j.at, j, key: `j-${i}` })) : [];
    // No mesmo dia, a mudança de nível (que fecha o dia) fica por cima.
    return [...occ, ...steps].sort((a, b) => b.at.localeCompare(a.at) || (a.kind === "step" ? -1 : 1) - (b.kind === "step" ? -1 : 1));
  }, [entries, journey, filter, client, tokens, plain]);

  const groups = useMemo(() => {
    const out: { key: string; rows: Row[]; n: number }[] = [];
    for (const r of rows) {
      const k = r.at.slice(0, 7);
      let g = out.find((x) => x.key === k);
      if (!g) {
        g = { key: k, rows: [], n: 0 };
        out.push(g);
      }
      g.rows.push(r);
      if (r.kind === "occ") g.n += 1;
    }
    return out;
  }, [rows]);

  const visibleFilters = FILTERS.filter((f) => f.id === "todas" || counts[f.id] > 0);
  const toggle = (id: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (entries.length === 0 && journey.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-white/12 px-5 py-6 text-[12.5px] text-white/45">
        Ainda não há ocorrências de {who} — nem reportadas, nem registadas pela direção.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
        <div role="tablist" aria-label="Filtrar por estado" className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                <span className={`tabular rounded-full px-1.5 text-[10.5px] ${on ? "bg-black/10" : "bg-white/[0.08] text-white/50"}`}>{counts[f.id]}</span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 lg:ml-auto">
          {clients.length > 1 && (
            <select
              value={client}
              onChange={(ev) => setClient(ev.target.value)}
              aria-label="Filtrar por cliente"
              className="modal-input h-8 min-w-0 max-w-[180px] py-0 text-[12px]"
            >
              <option value="">Todos os clientes</option>
              {clients.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <label className="relative flex min-w-0 flex-1 items-center lg:w-56 lg:flex-none">
            <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-white/35" />
            <input
              type="search"
              value={q}
              onChange={(ev) => setQ(ev.target.value)}
              placeholder="Procurar no histórico"
              className="modal-input h-8 w-full py-0 pl-8 pr-7 text-[12px]"
            />
            {q && (
              <button type="button" onClick={() => setQ("")} aria-label="Limpar" className="absolute right-2 text-white/40 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-white/12 px-5 py-6 text-[12.5px] text-white/45">Nada com estes filtros.</p>
      ) : (
        <div className="mt-4 space-y-5">
          {groups.map((g) => (
            <section key={g.key} aria-label={monthLabel(g.key)}>
              <p className="mb-2 flex items-baseline gap-2 text-[12px] font-semibold text-white/55">
                {monthLabel(g.key)}
                {g.n > 0 && (
                  <span className="tabular text-[11px] font-normal text-white/30">
                    {g.n} {g.n === 1 ? "ocorrência" : "ocorrências"}
                  </span>
                )}
              </p>
              <ul className="divide-y divide-white/[0.05] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
                {g.rows.map((r) =>
                  r.kind === "step" ? (
                    <JourneyRow key={r.key} j={r.j} />
                  ) : (
                    <EntryRow
                      key={r.e.id}
                      e={r.e}
                      who={who}
                      impact={{ ...impactBase, inPhase: r.e.inPhase }}
                      open={open.has(r.e.id)}
                      onToggle={() => toggle(r.e.id)}
                    />
                  ),
                )}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
