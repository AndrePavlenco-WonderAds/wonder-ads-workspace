"use client";

// O editor de um Plano de Probation (só SuperAdmin): a folha de RH à
// esquerda, com o mesmo papel das Ausências, e o documento à direita, a
// redesenhar-se a cada tecla.
//
// GRAVA SOZINHO. Num plano já criado, cada alteração é gravada ~1 s depois
// de parar de escrever (e ao sair da página), para que reabrir o plano o
// mostre exatamente como ficou. As gravações vão uma de cada vez e levam a
// `rev` que o editor leu; se o plano mudou noutro sítio entretanto, a API
// recusa e o editor pára de gravar até se recarregar — nunca se apaga o
// trabalho de outra pessoa em silêncio.
//
// Um plano novo só passa a existir no «Criar plano»: abrir o formulário e
// desistir não deixa registos vazios no KV.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Check,
  CircleDashed,
  Download,
  History,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { SheetSection } from "@/components/absences/sheet";
import { ProbationDocument } from "./probation-document";
import { StatusChip } from "./status-chip";
import { buildDocModel } from "@/lib/probation/document";
import {
  DECISIONS,
  KPI_MET_OPTIONS,
  MAX_KPIS,
  awaitingNewPeriod,
  emptyKpi,
  emptyPeriod,
  eval30Open,
  extensionDate,
  formatISODate,
  isISODate,
  kpiFilled,
  metCount,
  periodDates,
  planStatus,
  roleTeamFor,
  validateDraft,
  type KpiMet,
  type ProbationDecision,
  type ProbationDraft,
  type ProbationEvaluation,
  type ProbationKpi,
  type ProbationPeriod,
  type ProbationPlan,
} from "@/lib/probation/shared";

export type RosterPerson = {
  username: string;
  name: string;
  role: string;
  dept: string;
};

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `k-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Linhas iniciais de cada tabela de KPIs num plano novo — três, como o
 *  protótipo. */
const START_ROWS = 3;

const WEEKDAYS = [
  "segundas-feiras",
  "terças-feiras",
  "quartas-feiras",
  "quintas-feiras",
  "sextas-feiras",
];

function draftFromPlan(plan: ProbationPlan): ProbationDraft {
  return {
    consultantUsername: plan.consultantUsername,
    consultantName: plan.consultantName,
    roleTeam: plan.roleTeam,
    manager: plan.manager,
    direction: plan.direction,
    checkinDay: plan.checkinDay,
    resources: plan.resources,
    supportPerson: plan.supportPerson,
    trackingTool: plan.trackingTool,
    confirmationDeadline: plan.confirmationDeadline,
    period: plan.period,
  };
}

function newDraft(defaults: { manager: string; direction: string }): ProbationDraft {
  const period = emptyPeriod("");
  period.kpis15 = Array.from({ length: START_ROWS }, () => emptyKpi(newId()));
  period.kpis30 = Array.from({ length: START_ROWS }, () => emptyKpi(newId()));
  return {
    consultantUsername: null,
    consultantName: "",
    roleTeam: "",
    manager: defaults.manager,
    direction: defaults.direction,
    checkinDay: "",
    resources: "",
    supportPerson: "",
    trackingTool: "",
    confirmationDeadline: "",
    period,
  };
}

type SaveState =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string }
  | { kind: "conflict"; message: string };

export function ProbationEditor({
  initial,
  defaults,
  people,
}: {
  /** null → plano novo. */
  initial: ProbationPlan | null;
  /** Responsável direto e direção por defeito: o superadmin com sessão. */
  defaults: { manager: string; direction: string };
  people: RosterPerson[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ProbationDraft>(() =>
    initial ? draftFromPlan(initial) : newDraft(defaults),
  );
  // O que veio do servidor na última gravação: rev, histórico, datas das
  // decisões, autoria. O rascunho é do editor; isto é do servidor.
  const [server, setServer] = useState<ProbationPlan | null>(initial);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const id = server?.id ?? null;
  const latest = useRef(draft);
  const revRef = useRef(server?.rev ?? 0);
  const dirty = useRef(false);
  const blocked = useRef(false);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    latest.current = draft;
  }, [draft]);

  /** Grava o rascunho atual, se houver alterações. Uma gravação de cada
   *  vez: se já há uma a caminho, espera por ela e depois grava o resto. */
  const flush = useCallback(
    async (opts: { keepalive?: boolean } = {}): Promise<boolean> => {
      if (!id || blocked.current) return false;
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      if (inFlight.current) await inFlight.current;
      if (!dirty.current) return true;
      dirty.current = false;
      const body = JSON.stringify({ rev: revRef.current, draft: latest.current });
      const run = (async () => {
        setSave({ kind: "saving" });
        try {
          const res = await fetch(`/api/admin/probation/${id}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body,
            keepalive: opts.keepalive,
          });
          const data = (await res.json().catch(() => ({}))) as {
            plan?: ProbationPlan;
            error?: string;
          };
          if (res.status === 409) {
            blocked.current = true;
            setSave({ kind: "conflict", message: data.error ?? "O plano mudou noutro sítio." });
            return false;
          }
          if (!res.ok || !data.plan) {
            // Fica por gravar: a próxima alteração (ou o «Tentar outra vez»)
            // volta a tentar.
            dirty.current = true;
            setSave({ kind: "error", message: data.error ?? "Não foi possível gravar." });
            return false;
          }
          revRef.current = data.plan.rev;
          setServer(data.plan);
          setSave(dirty.current ? { kind: "dirty" } : { kind: "saved", at: data.plan.updatedAt });
          return true;
        } catch {
          dirty.current = true;
          setSave({ kind: "error", message: "Sem ligação — as alterações ainda não foram gravadas." });
          return false;
        }
      })();
      inFlight.current = run;
      const ok = await run;
      inFlight.current = null;
      return ok;
    },
    [id],
  );

  /** Todas as alterações passam por aqui. */
  const update = useCallback(
    (fn: (d: ProbationDraft) => ProbationDraft) => {
      setDraft((d) => fn(d));
      if (!id || blocked.current) return;
      dirty.current = true;
      setSave({ kind: "dirty" });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void flush();
      }, 1000);
    },
    [id, flush],
  );

  // Ao esconder o separador, ao sair da página ou ao navegar dentro da app:
  // grava o que faltar.
  useEffect(() => {
    if (!id) return;
    const onHide = () => {
      if (document.visibilityState === "hidden" && dirty.current) void flush({ keepalive: true });
    };
    const onPageHide = () => {
      if (dirty.current) void flush({ keepalive: true });
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      if (dirty.current) void flush({ keepalive: true });
    };
  }, [id, flush]);

  /* ---------------------------- ajudantes ---------------------------- */

  const setField = <K extends keyof ProbationDraft>(key: K, value: ProbationDraft[K]) =>
    update((d) => ({ ...d, [key]: value }));

  const setPeriod = (fn: (p: ProbationPeriod) => ProbationPeriod) =>
    update((d) => ({ ...d, period: fn(d.period) }));

  const period = draft.period;
  const dates = periodDates(period);
  const history = server?.history ?? [];
  const periodIndex = history.length;
  const status = planStatus({ period, history });
  const model = useMemo(
    () => buildDocModel(draft, draft.period, periodIndex),
    [draft, periodIndex],
  );
  const problem = validateDraft(draft);

  function pickPerson(username: string) {
    if (username === "__other__" || username === "") {
      update((d) => ({ ...d, consultantUsername: null }));
      return;
    }
    const p = people.find((x) => x.username === username);
    if (!p) return;
    update((d) => {
      const prevAuto = d.consultantUsername
        ? (() => {
            const prev = people.find((x) => x.username === d.consultantUsername);
            return prev ? roleTeamFor(prev.role, prev.dept) : "";
          })()
        : "";
      // A função só é reescrita se estava vazia ou se era a que veio do
      // roster para a pessoa anterior — nunca por cima de texto escrito à mão.
      const keepRole = d.roleTeam.trim() && d.roleTeam !== prevAuto;
      return {
        ...d,
        consultantUsername: p.username,
        consultantName: p.name,
        roleTeam: keepRole ? d.roleTeam : roleTeamFor(p.role, p.dept),
      };
    });
  }

  async function create() {
    const issue = validateDraft(draft);
    if (issue) {
      setCreateError(issue);
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/probation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = (await res.json().catch(() => ({}))) as { plan?: ProbationPlan; error?: string };
      if (!res.ok || !data.plan) {
        setCreateError(data.error ?? "Não foi possível criar o plano.");
        setCreating(false);
        return;
      }
      router.replace(`/admin/probation/${data.plan.id}`);
      router.refresh();
    } catch {
      setCreateError("Sem ligação — tenta outra vez.");
      setCreating(false);
    }
  }

  /** Descarrega o PDF depois de gravar o que faltar — o PDF é gerado a
   *  partir do que está gravado. */
  async function downloadPdf(href: string) {
    if (dirty.current || inFlight.current) {
      const ok = await flush();
      if (!ok) return;
    }
    window.location.href = href;
  }

  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  async function openNewPeriod() {
    if (!id) return;
    setOpening(true);
    setOpenError(null);
    const ok = await flush();
    if (!ok && dirty.current) {
      setOpening(false);
      setOpenError("Grava primeiro as alterações em curso.");
      return;
    }
    try {
      const res = await fetch(`/api/admin/probation/${id}/novo-periodo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rev: revRef.current }),
      });
      const data = (await res.json().catch(() => ({}))) as { plan?: ProbationPlan; error?: string };
      if (!res.ok || !data.plan) {
        setOpenError(data.error ?? "Não foi possível abrir o novo período.");
        setOpening(false);
        return;
      }
      revRef.current = data.plan.rev;
      setServer(data.plan);
      setDraft(draftFromPlan(data.plan));
      setSave({ kind: "saved", at: data.plan.updatedAt });
      setOpening(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setOpenError("Sem ligação — tenta outra vez.");
      setOpening(false);
    }
  }

  /* ------------------------------ render ----------------------------- */

  const title = draft.consultantName.trim() || "Novo plano";

  return (
    <div className="animate-fade-up">
      {/* Barra do topo: voltar, quem é, estado, gravação e PDF. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/probation"
          className="group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Planos de probation
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {id && <SaveIndicator state={save} onRetry={() => void flush()} />}
          {id && (
            <button
              type="button"
              onClick={() => void downloadPdf(`/api/admin/probation/${id}/pdf`)}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-semibold text-white shadow-[0_8px_22px_-8px_rgba(120,61,245,0.7)] transition hover:-translate-y-px"
              style={{ background: "var(--brand-gradient)" }}
            >
              <Download className="h-3.5 w-3.5" />
              Descarregar PDF
            </button>
          )}
        </div>
      </div>

      <header className="mt-3">
        <p className="readout text-white/35">Recursos Humanos · Direção</p>
        <h1 className="mt-1 flex flex-wrap items-center gap-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          <span className="brand-gradient-text">{title}</span>
          {id && <StatusChip status={status} />}
        </h1>
        <p className="mt-1.5 max-w-[680px] text-[12.5px] leading-relaxed text-white/45">
          {id
            ? `Plano de probation · ${periodIndex + 1}.º período. Tudo o que escreves fica gravado; o documento à direita é o que sai no PDF.`
            : "Preenche os dados do plano e cria-o. Depois disso, tudo o que escreves fica gravado sozinho."}
        </p>
      </header>

      {save.kind === "conflict" && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-[12.5px] text-amber-100">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{save.message}</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 px-3 py-1 font-semibold hover:bg-amber-500/15"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Recarregar
          </button>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,600px)_minmax(0,1fr)]">
        {/* ------------------------------ a folha ------------------------------ */}
        <section
          aria-label="Folha do plano de probation"
          className="relative min-w-0 overflow-hidden rounded-[6px] bg-gradient-to-b from-[#fbfaf7] to-[#f0eee8] text-[#20202a] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.06)]"
        >
          <div aria-hidden className="h-1.5 w-full" style={{ background: "var(--brand-gradient)" }} />
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-black/10 px-6 pb-5 pt-6 sm:px-8">
            <div>
              <p className="text-[19px] font-extrabold tracking-tight">
                Wonder{" "}
                <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--brand-gradient)" }}>
                  Ads
                </span>
              </p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-black/45">
                Recursos Humanos · Direção
              </p>
            </div>
            <div className="rounded border border-violet-600/25 bg-violet-50/80 px-3.5 py-2 text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-800/70">Documento interno</p>
              <p className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-violet-950">
                Plano de Probation
              </p>
              <p className="mt-0.5 font-mono text-[10.5px] text-violet-800/60">
                {id ? `${periodIndex + 1}.º período · 30 dias` : "30 dias · 2 avaliações"}
              </p>
            </div>
          </header>

          <div className="px-6 py-6 sm:px-8 sm:py-8">
            {/* 1 — Consultor e responsáveis */}
            <SheetSection
              n={1}
              title="Consultor e responsáveis"
              done={Boolean(draft.consultantName.trim() && draft.manager.trim() && draft.direction.trim())}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Escolher da equipa" className="sm:col-span-2">
                  <select
                    className="sheet-input"
                    value={draft.consultantUsername ?? (draft.consultantName ? "__other__" : "")}
                    onChange={(e) => pickPerson(e.target.value)}
                  >
                    <option value="">— Escolhe uma pessoa —</option>
                    {people.map((p) => (
                      <option key={p.username} value={p.username}>
                        {p.name} · {p.role}
                      </option>
                    ))}
                    <option value="__other__">Outra pessoa (escrever o nome)</option>
                  </select>
                </Field>
                <Field label="Nome do consultor">
                  <input
                    className="sheet-input"
                    value={draft.consultantName}
                    onChange={(e) => setField("consultantName", e.target.value)}
                    placeholder="Nome completo"
                  />
                </Field>
                <Field label="Função e equipa">
                  <input
                    className="sheet-input"
                    value={draft.roleTeam}
                    onChange={(e) => setField("roleTeam", e.target.value)}
                    placeholder="Ex.: Consultor SEO · Equipa SEO"
                  />
                </Field>
                <Field label="Responsável direto">
                  <input
                    className="sheet-input"
                    value={draft.manager}
                    onChange={(e) => setField("manager", e.target.value)}
                    placeholder="Nome"
                  />
                </Field>
                <Field label="Direção">
                  <input
                    className="sheet-input"
                    value={draft.direction}
                    onChange={(e) => setField("direction", e.target.value)}
                    placeholder="Nome"
                  />
                </Field>
              </div>
            </SheetSection>

            {/* 2 — Datas */}
            <SheetSection n={2} title="Datas" done={isISODate(period.startDate)}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label={periodIndex > 0 ? "Início do período" : "Data de início"}>
                  <input
                    type="date"
                    className="sheet-input"
                    value={period.startDate}
                    onChange={(e) => setPeriod((p) => ({ ...p, startDate: e.target.value }))}
                  />
                </Field>
                <DateReadout label="Avaliação dos 15 dias" iso={dates.d15} hint="início + 15 dias" />
                <DateReadout label="Avaliação dos 30 dias" iso={dates.d30} hint="início + 30 dias" />
              </div>
            </SheetSection>

            {/* 3 e 4 — KPIs */}
            <SheetSection n={3} title="KPIs dos 15 dias" done={period.kpis15.some(kpiFilled)}>
              <KpiDefinitions
                which={15}
                rows={period.kpis15}
                onChange={(rows) => setPeriod((p) => ({ ...p, kpis15: rows }))}
              />
            </SheetSection>
            <SheetSection n={4} title="KPIs dos 30 dias" done={period.kpis30.some(kpiFilled)}>
              <KpiDefinitions
                which={30}
                rows={period.kpis30}
                onChange={(rows) => setPeriod((p) => ({ ...p, kpis30: rows }))}
              />
            </SheetSection>

            {/* 5 — Apoio */}
            <SheetSection
              n={5}
              title="Acompanhamento e apoio"
              done={Boolean(
                draft.checkinDay.trim() &&
                  draft.resources.trim() &&
                  draft.supportPerson.trim() &&
                  draft.trackingTool.trim() &&
                  draft.confirmationDeadline.trim(),
              )}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Dia do check-in semanal">
                  <input
                    className="sheet-input"
                    list="probation-weekdays"
                    value={draft.checkinDay}
                    onChange={(e) => setField("checkinDay", e.target.value)}
                    placeholder="Ex.: sextas-feiras"
                  />
                  <datalist id="probation-weekdays">
                    {WEEKDAYS.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Pessoa de apoio">
                  <input
                    className="sheet-input"
                    list="probation-people"
                    value={draft.supportPerson}
                    onChange={(e) => setField("supportPerson", e.target.value)}
                    placeholder="Nome"
                  />
                  <datalist id="probation-people">
                    {people.map((p) => (
                      <option key={p.username} value={p.name} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Recursos e formação" className="sm:col-span-2">
                  <textarea
                    className="sheet-input min-h-[64px] resize-y"
                    value={draft.resources}
                    onChange={(e) => setField("resources", e.target.value)}
                    placeholder="Formação, shadowing, ferramentas ou materiais específicos"
                  />
                </Field>
                <Field label="Ferramenta de registo do trabalho">
                  <input
                    className="sheet-input"
                    value={draft.trackingTool}
                    onChange={(e) => setField("trackingTool", e.target.value)}
                    placeholder="CRM / ferramenta"
                  />
                </Field>
                <Field label="Prazo da confirmação por escrito">
                  <input
                    className="sheet-input"
                    value={draft.confirmationDeadline}
                    onChange={(e) => setField("confirmationDeadline", e.target.value)}
                    placeholder="Ex.: 24 horas"
                  />
                </Field>
              </div>
            </SheetSection>

            {/* 6 e 7 — Avaliações */}
            {id ? (
              <>
                <SheetSection n={6} title={`Avaliação dos 15 dias · ${formatISODate(dates.d15) || "—"}`} done={Boolean(period.eval15.decision)}>
                  <EvaluationEditor
                    which={15}
                    kpis={period.kpis15}
                    evaluation={period.eval15}
                    decidedAt={server?.period.eval15.decidedAt ?? null}
                    extensionHint={`Segue para a avaliação dos 30 dias, a ${formatISODate(extensionDate(period, 15)) || "—"}.`}
                    suggestedDecider={suggestDecider(draft)}
                    onKpis={(rows) => setPeriod((p) => ({ ...p, kpis15: rows }))}
                    onEval={(ev) => setPeriod((p) => ({ ...p, eval15: ev }))}
                  />
                </SheetSection>
                <SheetSection
                  n={7}
                  title={`Avaliação dos 30 dias · ${formatISODate(dates.d30) || "—"}`}
                  done={Boolean(period.eval30.decision)}
                  last
                >
                  {eval30Open(period) ? (
                    <>
                      <EvaluationEditor
                        which={30}
                        kpis={period.kpis30}
                        evaluation={period.eval30}
                        decidedAt={server?.period.eval30.decidedAt ?? null}
                        extensionHint={`Abre-se um novo período de 30 dias a começar a ${formatISODate(dates.d30) || "—"}, com novas datas e novos KPIs. Este período fica guardado no histórico.`}
                        suggestedDecider={suggestDecider(draft)}
                        onKpis={(rows) => setPeriod((p) => ({ ...p, kpis30: rows }))}
                        onEval={(ev) => setPeriod((p) => ({ ...p, eval30: ev }))}
                      />
                      {awaitingNewPeriod(period) && (
                        <div className="mt-5 rounded-xl border border-blue-600/25 bg-blue-50 px-4 py-4">
                          <p className="flex items-center gap-2 text-[13px] font-bold text-blue-950">
                            <CalendarClock className="h-4 w-4" />
                            Extensão aos 30 dias: abrir o novo período
                          </p>
                          <p className="mt-1 text-[12.5px] leading-relaxed text-blue-950/75">
                            O período novo começa a {formatISODate(dates.d30)}, com avaliações a{" "}
                            {formatISODate(extensionDate(period, 30))} e{" "}
                            {formatISODate(periodDates({ startDate: dates.d30 }).d30)}. Os KPIs atuais são copiados como
                            rascunho (sem resultados) para os reescreveres. Este período, com as duas avaliações, fica no
                            histórico do plano.
                          </p>
                          <button
                            type="button"
                            disabled={opening || save.kind === "conflict"}
                            onClick={() => void openNewPeriod()}
                            className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-700 px-4 py-2 text-[12.5px] font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60"
                          >
                            {opening ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                            Abrir novo período de 30 dias
                          </button>
                          {openError && <p className="mt-2 text-[12px] font-medium text-rose-700">{openError}</p>}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="rounded-lg border border-dashed border-black/15 bg-white/50 px-4 py-3 text-[12.5px] text-black/55">
                      {period.eval15.decision
                        ? "Não se aplica: o plano terminou na avaliação dos 15 dias."
                        : "Abre quando a avaliação dos 15 dias decidir extensão."}
                    </p>
                  )}
                </SheetSection>
              </>
            ) : (
              <div className="mt-2 border-t border-black/[0.07] pt-6">
                <p className="text-[12.5px] leading-relaxed text-black/55">
                  As avaliações dos 15 e dos 30 dias registam-se depois de o plano estar criado.
                </p>
                <button
                  type="button"
                  disabled={creating || Boolean(problem)}
                  onClick={() => void create()}
                  className="mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_22px_-8px_rgba(120,61,245,0.7)] transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: "var(--brand-gradient)" }}
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Criar plano
                </button>
                {(createError || problem) && (
                  <p className="mt-2 text-[12px] font-medium text-black/50">{createError ?? problem}</p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* -------------------------- o documento -------------------------- */}
        <aside className="min-w-0 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:pr-1">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
            Pré-visualização do documento
          </p>
          <FitToWidth width={860}>
            <ProbationDocument model={model} />
          </FitToWidth>
        </aside>
      </div>

      {id && history.length > 0 && <HistoryList id={id} history={history} onDownload={downloadPdf} />}

      {id && <DeletePlan id={id} name={title} />}
    </div>
  );
}

/* ============================ peças da folha ============================ */

function suggestDecider(d: ProbationDraft): string {
  const a = d.manager.trim();
  const b = d.direction.trim();
  if (a && b && a !== b) return `${a} e ${b}`;
  return a || b;
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="sheet-label mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function DateReadout({ label, iso, hint }: { label: string; iso: string; hint: string }) {
  return (
    <div>
      <span className="sheet-label mb-1.5">{label}</span>
      <p className="flex min-h-[38px] items-center rounded-lg border border-dashed border-black/15 bg-white/50 px-3 text-[13.5px] font-semibold tabular-nums">
        {formatISODate(iso) || <span className="font-normal text-black/30">dd/mm/aaaa</span>}
      </p>
      <p className="mt-1 text-[10.5px] text-black/40">{hint}</p>
    </div>
  );
}

function KpiDefinitions({
  which,
  rows,
  onChange,
}: {
  which: 15 | 30;
  rows: ProbationKpi[];
  onChange: (rows: ProbationKpi[]) => void;
}) {
  const set = (i: number, patch: Partial<ProbationKpi>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div>
      {rows.length > 0 && (
        <div className="hidden grid-cols-[22px_minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_28px] gap-2 px-0.5 pb-1.5 sm:grid">
          <span />
          <span className="sheet-label">KPI</span>
          <span className="sheet-label">Meta dia {which}</span>
          <span className="sheet-label">Como medimos</span>
          <span />
        </div>
      )}
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div
            key={r.id}
            className="grid grid-cols-[22px_minmax(0,1fr)_28px] items-start gap-2 sm:grid-cols-[22px_minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_28px]"
          >
            <span className="pt-2.5 text-center text-[12px] font-bold text-[#783df5]">{i + 1}</span>
            <input
              className="sheet-input"
              aria-label={`KPI ${i + 1}`}
              value={r.kpi}
              onChange={(e) => set(i, { kpi: e.target.value })}
              placeholder="Ex.: reuniões qualificadas marcadas"
            />
            <div className="col-start-2 sm:col-start-auto">
              <input
                className="sheet-input"
                aria-label={`Meta dia ${which} do KPI ${i + 1}`}
                value={r.target}
                onChange={(e) => set(i, { target: e.target.value })}
                placeholder="Número"
              />
            </div>
            <div className="col-start-2 sm:col-start-auto">
              <input
                className="sheet-input"
                aria-label={`Como medimos o KPI ${i + 1}`}
                value={r.measure}
                onChange={(e) => set(i, { measure: e.target.value })}
                placeholder="Ex.: CRM"
              />
            </div>
            <button
              type="button"
              aria-label={`Remover KPI ${i + 1}`}
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              className="col-start-3 row-start-1 mt-1.5 flex h-7 w-7 items-center justify-center rounded-md text-black/30 transition hover:bg-rose-50 hover:text-rose-600 sm:col-start-auto sm:row-start-auto"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={rows.length >= MAX_KPIS}
        onClick={() => onChange([...rows, emptyKpi(newId())])}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#c9c5dc] px-3 py-1.5 text-[12px] font-semibold text-[#783df5] transition hover:bg-[#f6f4fd] disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar KPI
      </button>
    </div>
  );
}

function EvaluationEditor({
  which,
  kpis,
  evaluation,
  decidedAt,
  extensionHint,
  suggestedDecider,
  onKpis,
  onEval,
}: {
  which: 15 | 30;
  kpis: ProbationKpi[];
  evaluation: ProbationEvaluation;
  decidedAt: number | null;
  extensionHint: string;
  suggestedDecider: string;
  onKpis: (rows: ProbationKpi[]) => void;
  onEval: (ev: ProbationEvaluation) => void;
}) {
  const filled = kpis.filter(kpiFilled);
  const count = metCount(kpis);
  const setKpi = (id: string, patch: Partial<ProbationKpi>) =>
    onKpis(kpis.map((k) => (k.id === id ? { ...k, ...patch } : k)));
  const set = (patch: Partial<ProbationEvaluation>) => onEval({ ...evaluation, ...patch });

  function decide(d: ProbationDecision | null) {
    set({
      decision: d,
      // Quem decide vem sugerido (responsável e direção) na primeira decisão.
      decidedBy: d && !evaluation.decidedBy.trim() ? suggestedDecider : evaluation.decidedBy,
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="sheet-label">Resultado por KPI</span>
          {count.recorded && (
            <span className="text-[11.5px] font-semibold text-black/55">
              {count.met} de {count.total} cumpridos
            </span>
          )}
        </div>
        {filled.length === 0 ? (
          <p className="rounded-lg border border-dashed border-black/15 bg-white/50 px-3 py-2.5 text-[12.5px] text-black/45">
            Ainda não há KPIs dos {which} dias — escreve-os na secção {which === 15 ? 3 : 4}.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filled.map((k, i) => (
              <div key={k.id} className="rounded-lg border border-black/[0.08] bg-white/60 p-3">
                <p className="text-[12.5px] font-semibold leading-snug">
                  <span className="mr-1.5 text-[#783df5]">{i + 1}</span>
                  {k.kpi || <span className="font-normal text-black/35">KPI sem nome</span>}
                  {k.target && <span className="font-normal text-black/45"> · meta {k.target}</span>}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    className="sheet-input min-w-[140px] flex-1 !py-1.5"
                    aria-label={`Resultado do KPI ${i + 1}`}
                    value={k.result}
                    onChange={(e) => setKpi(k.id, { result: e.target.value })}
                    placeholder="Resultado"
                  />
                  <MetToggle value={k.met} onChange={(m) => setKpi(k.id, { met: m })} label={`Cumprido, KPI ${i + 1}`} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Field label="O que correu bem">
          <textarea
            className="sheet-input min-h-[72px] resize-y"
            value={evaluation.wentWell}
            onChange={(e) => set({ wentWell: e.target.value })}
          />
        </Field>
        <Field label="O que ficou aquém">
          <textarea
            className="sheet-input min-h-[72px] resize-y"
            value={evaluation.fellShort}
            onChange={(e) => set({ fellShort: e.target.value })}
          />
        </Field>
        <Field label="Comentário do consultor">
          <textarea
            className="sheet-input min-h-[72px] resize-y"
            value={evaluation.consultantComment}
            onChange={(e) => set({ consultantComment: e.target.value })}
          />
        </Field>
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="sheet-label">Decisão</span>
          {evaluation.decision && (
            <button
              type="button"
              onClick={() => decide(null)}
              className="text-[11px] font-medium text-black/40 underline-offset-2 hover:text-black/70 hover:underline"
            >
              Limpar decisão
            </button>
          )}
        </div>
        <div role="radiogroup" aria-label={`Decisão da avaliação dos ${which} dias`} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {DECISIONS.map((d) => {
            const on = evaluation.decision === d.id;
            return (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => decide(d.id)}
                className={`rounded-lg border px-3 py-2.5 text-left text-[12.5px] transition ${
                  on
                    ? "border-[#783df5] bg-[#f3eefe] font-semibold text-[#3b1d8f] shadow-[0_0_0_3px_rgba(120,61,245,0.14)]"
                    : "border-black/15 bg-white/70 text-black/70 hover:border-black/30"
                }`}
              >
                <span className="block text-[10px] font-bold uppercase tracking-[0.16em] opacity-60">Opção {d.n}</span>
                {d.label}
              </button>
            );
          })}
        </div>
        {evaluation.decision && (
          <p className="mt-2 text-[12px] leading-relaxed text-black/55">
            {evaluation.decision === "extensao" ? extensionHint : "O plano termina nesta avaliação."}
            {decidedAt ? ` Decisão registada a ${new Date(decidedAt).toLocaleDateString("en-GB")}.` : ""}
          </p>
        )}
      </div>

      <Field label="Decisão tomada por">
        <input
          className="sheet-input"
          value={evaluation.decidedBy}
          onChange={(e) => set({ decidedBy: e.target.value })}
          placeholder={suggestedDecider || "Nome"}
        />
      </Field>
    </div>
  );
}

function MetToggle({
  value,
  onChange,
  label,
}: {
  value: KpiMet | null;
  onChange: (m: KpiMet | null) => void;
  label: string;
}) {
  const tone: Record<KpiMet, string> = {
    sim: "border-emerald-600 bg-emerald-600 text-white",
    parcial: "border-amber-500 bg-amber-500 text-white",
    nao: "border-rose-600 bg-rose-600 text-white",
  };
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex overflow-hidden rounded-lg border border-black/15 bg-white">
      {KPI_MET_OPTIONS.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            // Carregar outra vez na mesma opção limpa-a.
            onClick={() => onChange(on ? null : o.id)}
            className={`border-l px-3 py-1.5 text-[12px] font-semibold transition first:border-l-0 ${
              on ? tone[o.id] : "border-black/10 text-black/55 hover:bg-black/[0.04]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  const base = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-medium";
  if (state.kind === "saving") {
    return (
      <span className={`${base} border-white/10 text-white/55`}>
        <Loader2 className="h-3 w-3 animate-spin" />A gravar…
      </span>
    );
  }
  if (state.kind === "dirty") {
    return (
      <span className={`${base} border-white/10 text-white/45`}>
        <CircleDashed className="h-3 w-3" />
        Alterações por gravar
      </span>
    );
  }
  if (state.kind === "error") {
    return (
      <button type="button" onClick={onRetry} className={`${base} border-rose-400/40 text-rose-200 hover:bg-rose-500/10`}>
        <AlertTriangle className="h-3 w-3" />
        {state.message} Tentar outra vez
      </button>
    );
  }
  if (state.kind === "conflict") {
    return (
      <span className={`${base} border-amber-400/40 text-amber-200`}>
        <AlertTriangle className="h-3 w-3" />
        Gravação parada
      </span>
    );
  }
  return (
    <span className={`${base} border-emerald-400/25 text-emerald-200/80`}>
      <Check className="h-3 w-3" />
      {state.kind === "saved"
        ? `Gravado às ${new Date(state.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
        : "Tudo gravado"}
    </span>
  );
}

/** Mostra um filho de largura fixa encolhido para caber no contentor (nunca
 *  maior do que o natural). `zoom` e não `transform`: o zoom conta para o
 *  layout, por isso a altura acompanha sem contas à mão. */
function FitToWidth({ width, children }: { width: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setZoom(Math.min(1, el.clientWidth / width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={ref} className="w-full">
      <div style={{ zoom, width }}>{children}</div>
    </div>
  );
}

function HistoryList({
  id,
  history,
  onDownload,
}: {
  id: string;
  history: ProbationPeriod[];
  onDownload: (href: string) => Promise<void>;
}) {
  const label = (d: ProbationDecision | null) =>
    d ? (DECISIONS.find((x) => x.id === d)?.label ?? "—") : "sem decisão";
  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
        <History className="h-3.5 w-3.5" />
        Períodos anteriores
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        {history.map((p, i) => {
          const d = periodDates(p);
          return (
            <div key={i} className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5">
              <p className="text-[13px] font-semibold text-white/85">
                {i + 1}.º período · {formatISODate(d.d0)} → {formatISODate(d.d30)}
              </p>
              <p className="mt-1 text-[12px] text-white/50">
                15 dias: {label(p.eval15.decision)} · 30 dias: {label(p.eval30.decision)}
              </p>
              <p className="mt-1 text-[12px] text-white/40">
                KPIs cumpridos: {metCount(p.kpis15).met}/{metCount(p.kpis15).total} aos 15 ·{" "}
                {metCount(p.kpis30).met}/{metCount(p.kpis30).total} aos 30
              </p>
              <button
                type="button"
                onClick={() => void onDownload(`/api/admin/probation/${id}/pdf?periodo=${i + 1}`)}
                className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#c3aaff] hover:underline"
              >
                <Download className="h-3.5 w-3.5" />
                PDF deste período
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DeletePlan({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/probation/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Não foi possível apagar.");
        setBusy(false);
        return;
      }
      router.push("/admin/probation");
      router.refresh();
    } catch {
      setError("Sem ligação — tenta outra vez.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-12 border-t border-white/[0.06] pt-5">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-3 text-[12.5px] text-white/60">
          <span>Apagar o plano de {name}, com o histórico? Não dá para desfazer.</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void remove()}
            className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-1 font-semibold text-rose-200 hover:bg-rose-500/20 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Apagar de vez
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="text-white/45 hover:text-white/80">
            Cancelar
          </button>
          {error && <span className="text-rose-300">{error}</span>}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1.5 text-[12px] text-white/35 transition hover:text-rose-300"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Apagar plano
        </button>
      )}
    </div>
  );
}
