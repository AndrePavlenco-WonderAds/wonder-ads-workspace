"use client";

// O editor de um Plano de Probation (só SuperAdmin).
//
// v77.77 — de folha única a cockpit de acompanhamento:
//   • em cima, o ponto de situação: os 30 dias numa linha, o que fazer a
//     seguir, os KPIs semana a semana e o que o consultor já recebeu;
//   • quatro separadores: o Plano (a folha + o documento ao vivo), os
//     Check-ins semanais da chefia, as Avaliações e os Envios;
//   • NADA chega ao consultor sem pré-visualização: cada envio abre a página
//     dele tal como vai ficar, e só o «Enviar» publica (ver published.ts).
//
// GRAVA SOZINHO (como na v77.73). Num plano já criado, cada alteração é
// gravada ~1 s depois de parar de escrever (e ao sair da página). As
// gravações vão uma de cada vez e levam a `rev` que o editor leu; se o plano
// mudou noutro sítio, a API recusa e o editor pára de gravar até se
// recarregar — nunca se apaga o trabalho de outra pessoa em silêncio.
//
// Um plano novo só passa a existir no «Criar plano»: abrir o formulário e
// desistir não deixa registos vazios no KV.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck2,
  CalendarClock,
  Check,
  CircleDashed,
  Download,
  Eye,
  FileText,
  History,
  Loader2,
  LogOut,
  PencilLine,
  Plus,
  RefreshCw,
  Scale,
  Send,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { SheetSection } from "@/components/absences/sheet";
import { ProbationDocument } from "./probation-document";
import { StatusChip } from "./status-chip";
import { FitToWidth } from "./fit-to-width";
import { Field, SendBadge } from "./sheet-bits";
import { EvaluationEditor, KpiDefinitions } from "./plan-pieces";
import { WeekEditor } from "./week-editor";
import { Cockpit, SEND_ITEMS } from "./cockpit";
import { PreviewModal } from "./preview-modal";
import { EvalCardView, PulseDot, WeekCardView, dayLabel } from "./views";
import { buildDocModel } from "@/lib/probation/document";
import { formatDateTime } from "@/lib/dates";
import {
  DECISIONS,
  activationProblem,
  awaitingNewPeriod,
  decidersName,
  defaultWeekDates,
  emptyKpi,
  emptyPeriod,
  eval30Open,
  extensionDate,
  formatISODate,
  isISODate,
  kpiFilled,
  leadName,
  metCount,
  periodDates,
  planStatus,
  roleTeamFor,
  validateDraft,
  weekDate,
  type ProbationAction,
  type ProbationDecision,
  type ProbationDraft,
  type ProbationPeriod,
  type ProbationPlan,
  type ProbationWeek,
} from "@/lib/probation/shared";
import {
  evalView,
  pubEntry,
  sendItemLabel,
  sendState,
  snapshotFor,
  weekView,
  type PublishedPlan,
  type SendItem,
} from "@/lib/probation/published";
import type { NextStep } from "@/lib/probation/progress";

export type RosterPerson = {
  username: string;
  name: string;
  role: string;
  dept: string;
};

export type EditorTab = "plano" | "semanas" | "avaliacoes" | "envios";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `k-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Linhas iniciais de cada tabela de KPIs num plano novo — três, como o
 *  protótipo. */
const START_ROWS = 3;

/** O apoio de sempre — vem escrito em cada plano novo (pedido do André,
 *  v77.78) e edita-se como qualquer outro campo. */
const DEFAULT_RESOURCES =
  "https://workspace.wonder-ads.com/formacao + shadowing nas reuniões + acompanhamento semanal";

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
    hasManager: plan.hasManager,
    isDraft: plan.isDraft,
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

function newDraft(defaults: { direction: string }): ProbationDraft {
  const period = emptyPeriod("");
  period.kpis15 = Array.from({ length: START_ROWS }, () => emptyKpi(newId()));
  period.kpis30 = Array.from({ length: START_ROWS }, () => emptyKpi(newId()));
  return {
    consultantUsername: null,
    consultantName: "",
    roleTeam: "",
    // Por agora não há chefia intermédia na casa: a direção acompanha e
    // decide sozinha. Um clique liga a chefia quando existir.
    hasManager: false,
    isDraft: false,
    manager: "",
    direction: defaults.direction,
    checkinDay: "",
    resources: DEFAULT_RESOURCES,
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
  initialPub = null,
  defaults,
  people,
  today,
  initialTab = "plano",
  initialWeek,
}: {
  /** null → plano novo. */
  initial: ProbationPlan | null;
  initialPub?: PublishedPlan | null;
  /** Direção por defeito: o superadmin com sessão. */
  defaults: { manager: string; direction: string };
  people: RosterPerson[];
  /** Hoje em Lisboa (YYYY-MM-DD), vindo do servidor. */
  today: string;
  initialTab?: EditorTab;
  initialWeek?: number;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ProbationDraft>(() =>
    initial ? draftFromPlan(initial) : newDraft(defaults),
  );
  // O que veio do servidor na última gravação: rev, histórico, datas das
  // decisões, autoria. O rascunho é do editor; isto é do servidor.
  const [server, setServer] = useState<ProbationPlan | null>(initial);
  const [pub, setPub] = useState<PublishedPlan | null>(initialPub);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [tab, setTab] = useState<EditorTab>(initial ? initialTab : "plano");
  const [weekN, setWeekN] = useState<number>(() => {
    if (initialWeek && initialWeek >= 1 && initialWeek <= 4) return initialWeek;
    return initial?.period.weeks.find((w) => !w.done)?.n ?? 1;
  });
  const [preview, setPreview] = useState<{ item: SendItem | null } | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

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

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3500);
    return () => clearTimeout(t);
  }, [flash]);

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

  const setWeek = (n: number, patch: Partial<ProbationWeek>) =>
    setPeriod((p) => ({ ...p, weeks: p.weeks.map((w) => (w.n === n ? { ...w, ...patch } : w)) }));

  const setPrevActions = (n: number, actions: ProbationAction[]) => setWeek(n - 1, { actions });

  const period = draft.period;
  const dates = periodDates(period);
  const history = server?.history ?? [];
  const periodIndex = history.length;
  const status = planStatus({ period, history, isDraft: draft.isDraft });
  const model = useMemo(
    () => buildDocModel(draft, draft.period, periodIndex),
    [draft, periodIndex],
  );
  const problem = validateDraft(draft);
  const toActivate = activationProblem(draft);
  const lead = leadName(draft);
  const canSend = Boolean(draft.consultantUsername);

  const stateOf = (item: SendItem) => {
    const snap = snapshotFor(draft, period, periodIndex, item);
    return sendState(pubEntry(pub, periodIndex, item), snap?.sig ?? null);
  };
  const pendingSends = SEND_ITEMS.filter((item) => {
    const snap = snapshotFor(draft, period, periodIndex, item);
    if (!snap) return false;
    if (item.startsWith("week:") && !period.weeks.find((w) => `week:${w.n}` === item)?.done) return false;
    return stateOf(item).kind !== "sent";
  }).length;

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

  /** Cria o plano. Como rascunho grava-se como estiver e volta-se à lista
   *  (fica em «Rascunhos» para continuar depois). */
  async function create(asDraft: boolean) {
    const body = { ...draft, isDraft: asDraft };
    const issue = validateDraft(body);
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
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { plan?: ProbationPlan; error?: string };
      if (!res.ok || !data.plan) {
        setCreateError(data.error ?? "Não foi possível criar o plano.");
        setCreating(false);
        return;
      }
      if (asDraft) {
        router.push("/admin/probation?guardado=1");
      } else {
        router.replace(`/admin/probation/${data.plan.id}`);
      }
      router.refresh();
    } catch {
      setCreateError("Sem ligação — tenta outra vez.");
      setCreating(false);
    }
  }

  /** «Guardar e sair»: grava o que faltar e volta à lista. */
  const [leaving, setLeaving] = useState(false);
  async function saveAndExit() {
    setLeaving(true);
    if (dirty.current || inFlight.current) {
      const ok = await flush();
      if (!ok) {
        setLeaving(false);
        return;
      }
    }
    router.push(`/admin/probation${draft.isDraft ? "?guardado=1" : ""}`);
    router.refresh();
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
      setTab("plano");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setOpenError("Sem ligação — tenta outra vez.");
      setOpening(false);
    }
  }

  /* ------------------------- pré-visualizar e enviar ------------------------- */

  /** Porque é que um item não se pode enviar — o mesmo critério da API. */
  function blockerFor(item: SendItem): string | null {
    if (draft.isDraft && toActivate) return `É um rascunho e ainda não pode ser ativado: ${toActivate}`;
    if (!draft.consultantUsername) {
      return "Escolhe o consultor da lista da equipa (secção 1 do Plano) — um nome escrito à mão não tem conta na app.";
    }
    if (item === "plan") {
      if (problem) return problem;
      if (!period.kpis15.some(kpiFilled) && !period.kpis30.some(kpiFilled)) return "Escreve pelo menos um KPI antes de enviar o plano.";
    } else if (item.startsWith("week:")) {
      if (!period.weeks.find((w) => `week:${w.n}` === item)?.done) return "Marca o check-in como feito antes de o enviar.";
    } else if (!snapshotFor(draft, period, periodIndex, item)) {
      return "Ainda não há decisão nesta avaliação.";
    }
    return null;
  }

  async function openPreview(item: SendItem | null) {
    setSendError(null);
    // A pré-visualização tem de ser o que está gravado: é isso que a API
    // fotografa no «Enviar».
    if (item && (dirty.current || inFlight.current)) {
      const ok = await flush();
      if (!ok) setSendError("Não foi possível gravar as últimas alterações — o envio fica bloqueado até gravar.");
    }
    setPreview({ item });
  }

  async function sendNow() {
    if (!id || !preview?.item) return;
    setSending(true);
    setSendError(null);
    if (dirty.current || inFlight.current) {
      const ok = await flush();
      if (!ok) {
        setSending(false);
        setSendError("Não foi possível gravar as últimas alterações — tenta outra vez.");
        return;
      }
    }
    try {
      const res = await fetch(`/api/admin/probation/${id}/enviar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rev: revRef.current, item: preview.item }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        pub?: PublishedPlan;
        plan?: ProbationPlan;
        error?: string;
      };
      if (!res.ok || !data.pub) {
        setSendError(data.error ?? "Não foi possível enviar.");
        setSending(false);
        return;
      }
      setPub(data.pub);
      // O primeiro envio de um rascunho ativa-o no servidor (rev + 1).
      if (data.plan && data.plan.rev !== revRef.current) {
        const activated = data.plan;
        revRef.current = activated.rev;
        setServer(activated);
        setDraft((d) => ({ ...d, isDraft: activated.isDraft }));
      }
      setSending(false);
      setFlash(`${sendItemLabel(preview.item)} enviado a ${draft.consultantName.trim().split(/\s+/)[0] || "o consultor"}.`);
      setPreview(null);
    } catch {
      setSendError("Sem ligação — tenta outra vez.");
      setSending(false);
    }
  }

  /** Um «o que fazer a seguir» do cockpit: abre o envio quando o item já se
   *  pode enviar; senão leva ao separador onde está o trabalho. */
  function goStep(s: NextStep) {
    if (s.week) setWeekN(s.week);
    setTab(s.tab);
    if (s.item && !blockerFor(s.item)) {
      void openPreview(s.item);
      return;
    }
    requestAnimationFrame(() =>
      document.getElementById("probation-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  /* ------------------------------ render ----------------------------- */

  const title = draft.consultantName.trim() || "Novo plano";
  const week = period.weeks.find((w) => w.n === weekN) ?? period.weeks[0];
  const weekDates = defaultWeekDates(period.startDate, draft.checkinDay);

  const TABS: { id: EditorTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "plano", label: "Plano", icon: <FileText className="h-3.5 w-3.5" /> },
    { id: "semanas", label: "Check-ins semanais", icon: <CalendarCheck2 className="h-3.5 w-3.5" />, badge: period.weeks.filter((w) => w.done).length },
    { id: "avaliacoes", label: "Avaliações", icon: <Scale className="h-3.5 w-3.5" /> },
    { id: "envios", label: "Envios ao consultor", icon: <Send className="h-3.5 w-3.5" />, badge: pendingSends || undefined },
  ];

  return (
    <div className="animate-fade-up">
      {/* Barra do topo: voltar, gravação, PDF e envio. */}
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
              disabled={leaving || save.kind === "conflict"}
              onClick={() => void saveAndExit()}
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-[12.5px] font-medium text-white/80 transition hover:border-white/25 hover:text-white disabled:opacity-50"
            >
              {leaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
              Guardar e sair
            </button>
          )}
          {id && (
            <button
              type="button"
              onClick={() => void downloadPdf(`/api/admin/probation/${id}/pdf`)}
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-[12.5px] font-medium text-white/80 transition hover:border-white/25 hover:text-white"
            >
              <Download className="h-3.5 w-3.5" />
              PDF
            </button>
          )}
          {id && (
            <button
              type="button"
              onClick={() => void openPreview("plan")}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-semibold text-white shadow-[0_8px_22px_-8px_rgba(120,61,245,0.7)] transition hover:-translate-y-px"
              style={{ background: "var(--brand-gradient)" }}
            >
              <Eye className="h-3.5 w-3.5" />
              {stateOf("plan").kind === "never" ? "Pré-visualizar e enviar plano" : "Plano · pré-visualizar"}
            </button>
          )}
        </div>
      </div>

      <header className="mt-3">
        <p className="readout text-white/35">Recursos Humanos · Direção</p>
        <h1 className="mt-1 flex flex-wrap items-center gap-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          <span className="brand-gradient-text">{title}</span>
          {id && <StatusChip status={status} />}
          {id && <SendBadge state={stateOf("plan")} />}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-white/50">
          {draft.roleTeam && <span>{draft.roleTeam}</span>}
          {draft.roleTeam && <span className="text-white/20">·</span>}
          <span className="inline-flex items-center gap-1.5">
            {draft.hasManager ? <UsersRound className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}
            {draft.hasManager
              ? `Chefia: ${draft.manager.trim() || "—"} · Direção: ${draft.direction.trim() || "—"}`
              : `Só direção: ${draft.direction.trim() || "—"}`}
          </span>
          {id && <span className="text-white/20">·</span>}
          {id && <span>{periodIndex + 1}.º período</span>}
          {/* Voltar a rascunho só enquanto nada foi enviado ao consultor. */}
          {id && !draft.isDraft && !pub && (
            <>
              <span className="text-white/20">·</span>
              <button
                type="button"
                onClick={() => update((d) => ({ ...d, isDraft: true }))}
                className="inline-flex items-center gap-1 text-white/45 underline-offset-2 transition hover:text-white hover:underline"
              >
                <PencilLine className="h-3 w-3" />
                Passar a rascunho
              </button>
            </>
          )}
        </div>
      </header>

      {id && draft.isDraft && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-white/20 bg-white/[0.03] px-4 py-3.5">
          <PencilLine className="h-4 w-4 shrink-0 text-white/50" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-white/90">Rascunho</p>
            <p className="text-[12px] text-white/50">
              Grava sozinho, mesmo incompleto. Não entra na agenda nem nos lembretes e o consultor não vê nada.
              {toActivate ? ` Para ativar falta: ${toActivate.replace(/^Falta /, "").replace(/\.$/, "")}.` : " Está pronto a ativar."}
            </p>
          </div>
          <button
            type="button"
            disabled={Boolean(toActivate) || save.kind === "conflict"}
            onClick={() => update((d) => ({ ...d, isDraft: false }))}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-semibold text-white shadow-[0_8px_22px_-8px_rgba(120,61,245,0.7)] transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Check className="h-3.5 w-3.5" />
            Ativar plano
          </button>
        </div>
      )}

      {flash && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-[12.5px] text-emerald-100">
          <Check className="h-4 w-4" />
          {flash}
        </div>
      )}

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

      {id && (
        <Cockpit
          planId={id}
          draft={draft}
          periodIndex={periodIndex}
          pub={pub}
          today={today}
          onStep={goStep}
          onPreviewPage={() => void openPreview(null)}
        />
      )}

      {/* ------------------------------ separadores ------------------------------ */}
      <nav
        id="probation-tabs"
        className="mt-8 flex scroll-mt-24 flex-wrap gap-1.5 border-b border-white/[0.08]"
        aria-label="Secções do plano"
      >
        {TABS.map((t) => {
          const disabled = !id && t.id !== "plano";
          return (
            <button
              key={t.id}
              type="button"
              disabled={disabled}
              onClick={() => setTab(t.id)}
              className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-35 ${
                tab === t.id ? "border-[#783DF5] text-white" : "border-transparent text-white/45 hover:text-white/80"
              }`}
            >
              {t.icon}
              {t.label}
              {typeof t.badge === "number" && (
                <span
                  className={`rounded-full px-1.5 text-[10.5px] tabular-nums ${
                    t.id === "envios" ? "bg-[#783DF5] text-white" : "bg-white/10 text-white/60"
                  }`}
                >
                  {t.id === "semanas" ? `${t.badge}/4` : t.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ================================ PLANO ================================ */}
      {tab === "plano" && (
        <div className="mt-6 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,600px)_minmax(0,1fr)]">
          <Sheet label="Folha do plano de probation" subtitle={id ? `${periodIndex + 1}.º período · 30 dias` : "30 dias · 2 avaliações"}>
            {/* 1 — Consultor e quem acompanha */}
            <SheetSection
              n={1}
              title="Consultor e quem acompanha"
              done={Boolean(
                draft.consultantName.trim() && draft.direction.trim() && (!draft.hasManager || draft.manager.trim()),
              )}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Escolher da equipa"
                  className="sm:col-span-2"
                  hint={
                    draft.consultantName && !draft.consultantUsername
                      ? "Nome escrito à mão: dá para o PDF, mas não para enviar o plano na app."
                      : "Vindo da equipa, o plano pode ser enviado ao consultor na app."
                  }
                >
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

                <div className="sm:col-span-2">
                  <span className="sheet-label mb-1.5">Quem acompanha e decide</span>
                  <div role="radiogroup" aria-label="Chefia" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[
                      { on: false, title: "Só a direção", sub: "Ainda não há chefia intermédia: a direção faz os check-ins e decide." },
                      { on: true, title: "Chefia intermédia + direção", sub: "A chefia acompanha semana a semana; decidem os dois." },
                    ].map((o) => {
                      const active = draft.hasManager === o.on;
                      return (
                        <button
                          key={o.title}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setField("hasManager", o.on)}
                          className={`rounded-lg border px-3 py-2.5 text-left transition ${
                            active
                              ? "border-[#783df5] bg-[#f3eefe] shadow-[0_0_0_3px_rgba(120,61,245,0.14)]"
                              : "border-black/15 bg-white/70 hover:border-black/30"
                          }`}
                        >
                          <span className={`flex items-center gap-1.5 text-[12.5px] font-bold ${active ? "text-[#3b1d8f]" : "text-black/75"}`}>
                            {o.on ? <UsersRound className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}
                            {o.title}
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-black/50">{o.sub}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {draft.hasManager && (
                  <Field label="Chefia intermédia (responsável direto)">
                    <input
                      className="sheet-input"
                      list="probation-people"
                      value={draft.manager}
                      onChange={(e) => setField("manager", e.target.value)}
                      placeholder="Nome"
                    />
                  </Field>
                )}
                <Field
                  label="Direção"
                  className={draft.hasManager ? "" : "sm:col-span-2"}
                  hint={draft.hasManager ? undefined : "No documento, a direção aparece como responsável direto."}
                >
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
              last
              done={Boolean(
                draft.checkinDay.trim() &&
                  draft.resources.trim() &&
                  draft.supportPerson.trim() &&
                  draft.trackingTool.trim() &&
                  draft.confirmationDeadline.trim(),
              )}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Dia do check-in semanal" hint={`Com ${lead || "a chefia"}. Define as datas dos quatro check-ins.`}>
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
                {isISODate(period.startDate) && (
                  <div className="sm:col-span-2">
                    <span className="sheet-label mb-1.5">Check-ins previstos</span>
                    <div className="flex flex-wrap gap-1.5">
                      {period.weeks.map((w, i) => (
                        <span
                          key={w.n}
                          className="rounded-md border border-black/10 bg-white/70 px-2 py-1 text-[11.5px] font-semibold tabular-nums text-black/70"
                        >
                          S{w.n} · {dayLabel(weekDate(w, period.startDate, draft.checkinDay) || weekDates[i])}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
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

            {!id && (
              <div className="mt-2 border-t border-black/[0.07] pt-6">
                <p className="text-[12.5px] leading-relaxed text-black/55">
                  Ainda não está pronto? Guarda como rascunho e continua depois — fica em «Rascunhos» na lista. Depois
                  de criado: check-ins semanais, avaliações e envio ao consultor, sempre com pré-visualização.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={creating}
                    onClick={() => void create(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-black/20 bg-white px-5 py-2.5 text-[13px] font-bold text-black/75 transition hover:border-black/40 disabled:opacity-50"
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <PencilLine className="h-4 w-4" />}
                    Guardar rascunho
                  </button>
                  <button
                    type="button"
                    disabled={creating || Boolean(toActivate)}
                    onClick={() => void create(false)}
                    className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_22px_-8px_rgba(120,61,245,0.7)] transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ background: "var(--brand-gradient)" }}
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Criar plano
                  </button>
                </div>
                {(createError || toActivate) && (
                  <p className="mt-2 text-[12px] font-medium text-black/50">
                    {createError ?? `Para criar o plano: ${toActivate} O rascunho grava-se mesmo assim.`}
                  </p>
                )}
              </div>
            )}
          </Sheet>

          <aside className="min-w-0 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:pr-1">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
              Documento ao vivo · é o que sai no PDF e o que se envia
            </p>
            <FitToWidth width={860}>
              <ProbationDocument model={model} />
            </FitToWidth>
          </aside>
        </div>
      )}

      {/* ============================== CHECK-INS ============================== */}
      {tab === "semanas" && id && week && (
        <div className="mt-6">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {period.weeks.map((w) => {
              const d = weekDate(w, period.startDate, draft.checkinDay);
              const st = stateOf(`week:${w.n}` as SendItem);
              const late = !w.done && d && d < today;
              return (
                <button
                  key={w.n}
                  type="button"
                  onClick={() => setWeekN(w.n)}
                  className={`flex flex-col items-stretch justify-start rounded-2xl border p-3.5 text-left transition ${
                    w.n === weekN
                      ? "border-[#783DF5]/60 bg-[#783DF5]/[0.12] shadow-[0_14px_40px_-24px_rgba(120,61,245,1)]"
                      : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="readout text-white/45">Semana {w.n}</span>
                    {w.done ? (
                      <PulseDot pulse={w.pulse} />
                    ) : (
                      <CircleDashed className={`h-3.5 w-3.5 ${late ? "text-rose-300" : "text-white/25"}`} />
                    )}
                  </div>
                  <p className="mt-1 text-[14px] font-semibold tabular-nums text-white">{dayLabel(d)}</p>
                  <p className={`text-[11px] ${w.done ? "text-emerald-300/80" : late ? "text-rose-300/90" : "text-white/40"}`}>
                    {w.done ? "Feito" : late ? "Por fazer · atrasado" : "Por fazer"}
                  </p>
                  {w.done && (
                    <div className="mt-2">
                      <SendBadge compact state={st} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,600px)_minmax(0,1fr)]">
            <Sheet label={`Check-in da semana ${week.n}`} subtitle={`Semana ${week.n} de 4`}>
              <WeekEditor
                period={period}
                week={week}
                checkinDay={draft.checkinDay}
                lead={lead}
                send={stateOf(`week:${week.n}` as SendItem)}
                canSend={canSend}
                onWeek={(patch) => setWeek(week.n, patch)}
                onPrevActions={(actions) => setPrevActions(week.n, actions)}
                onPreview={() => void openPreview(`week:${week.n}` as SendItem)}
              />
            </Sheet>
            <aside className="min-w-0 xl:sticky xl:top-24 xl:self-start">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
                Como o consultor vai receber · ao vivo, sem a nota interna
              </p>
              {(() => {
                const v = weekView(draft, period, week.n);
                return v ? <WeekCardView view={v} /> : null;
              })()}
            </aside>
          </div>
        </div>
      )}

      {/* ============================= AVALIAÇÕES ============================= */}
      {tab === "avaliacoes" && id && (
        <div className="mt-6 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,600px)_minmax(0,1fr)]">
          <Sheet label="Avaliações" subtitle="Dia 15 · Dia 30">
            <SheetSection n={6} title={`Avaliação dos 15 dias · ${formatISODate(dates.d15) || "—"}`} done={Boolean(period.eval15.decision)}>
              <EvaluationEditor
                which={15}
                kpis={period.kpis15}
                evaluation={period.eval15}
                decidedAt={server?.period.eval15.decidedAt ?? null}
                extensionHint={`Segue para a avaliação dos 30 dias, a ${formatISODate(extensionDate(period, 15)) || "—"}.`}
                suggestedDecider={decidersName(draft)}
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
                    suggestedDecider={decidersName(draft)}
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
                        rascunho (sem resultados) e há quatro check-ins novos. Envia a avaliação dos 30 dias ao
                        consultor antes de abrir o período novo.
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
          </Sheet>

          <aside className="min-w-0 space-y-6 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:self-start xl:overflow-y-auto xl:pr-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
              Como o consultor vai receber · ao vivo
            </p>
            {([15, 30] as const).map((which) => {
              const v = evalView(draft, period, which);
              const item = `eval:${which}` as SendItem;
              if (!v) {
                return (
                  <div key={which} className="rounded-2xl border border-dashed border-white/12 px-5 py-6 text-[12.5px] text-white/45">
                    Avaliação dos {which} dias: aparece aqui quando houver decisão.
                  </div>
                );
              }
              return (
                <div key={which}>
                  <EvalCardView view={v} />
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void openPreview(item)}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-semibold text-white transition hover:-translate-y-px"
                      style={{ background: "var(--brand-gradient)" }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Pré-visualizar e enviar
                    </button>
                    <SendBadge state={stateOf(item)} />
                  </div>
                </div>
              );
            })}
          </aside>
        </div>
      )}

      {/* =============================== ENVIOS =============================== */}
      {tab === "envios" && id && (
        <SendCenter
          draft={draft}
          period={period}
          periodIndex={periodIndex}
          pub={pub}
          stateOf={stateOf}
          blockerFor={blockerFor}
          onPreview={(item) => void openPreview(item)}
        />
      )}

      {id && history.length > 0 && <HistoryList id={id} history={history} onDownload={downloadPdf} />}

      {id && <DeletePlan id={id} name={title} />}

      {preview && id && (
        <PreviewModal
          planId={id}
          draft={draft}
          periodIndex={periodIndex}
          pub={pub}
          item={preview.item}
          today={today}
          blocker={preview.item ? blockerFor(preview.item) : null}
          sending={sending}
          error={sendError}
          onClose={() => {
            setPreview(null);
            setSendError(null);
          }}
          onSend={() => void sendNow()}
        />
      )}
    </div>
  );
}

/* ============================ peças da folha ============================ */

/** O papel claro onde se escreve (o mesmo das Ausências). */
function Sheet({ label, subtitle, children }: { label: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section
      aria-label={label}
      className="relative min-w-0 self-start overflow-hidden rounded-[6px] bg-gradient-to-b from-[#fbfaf7] to-[#f0eee8] text-[#20202a] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.06)]"
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
          <p className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-violet-950">Plano de Probation</p>
          <p className="mt-0.5 font-mono text-[10.5px] text-violet-800/60">{subtitle}</p>
        </div>
      </header>
      <div className="px-6 py-6 sm:px-8 sm:py-8">{children}</div>
    </section>
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

/* =============================== envios =============================== */

function SendCenter({
  draft,
  period,
  periodIndex,
  pub,
  stateOf,
  blockerFor,
  onPreview,
}: {
  draft: ProbationDraft;
  period: ProbationPeriod;
  periodIndex: number;
  pub: PublishedPlan | null;
  stateOf: (item: SendItem) => ReturnType<typeof sendState>;
  blockerFor: (item: SendItem) => string | null;
  onPreview: (item: SendItem | null) => void;
}) {
  const { d15, d30 } = periodDates(period);
  const describe = (item: SendItem): string => {
    if (item === "plan") return "O documento do plano, com os KPIs e os desfechos possíveis.";
    if (item === "eval:15") return `Resultado e decisão da avaliação de ${formatISODate(d15) || "—"}.`;
    if (item === "eval:30") return `Resultado e decisão da avaliação de ${formatISODate(d30) || "—"}.`;
    const w = period.weeks.find((x) => `week:${x.n}` === item);
    return w ? `Check-in de ${dayLabel(weekDate(w, period.startDate, draft.checkinDay))}${w.done ? "" : " · ainda por fazer"}.` : "";
  };
  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[12.5px] leading-relaxed text-white/50">
          Nada chega a {draft.consultantName.trim() || "o consultor"} sem passar pela pré-visualização. Depois de enviado,
          aparece-lhe no sino e na página «O meu plano de probation», onde confirma que leu — e o comentário dele aparece aqui.
        </p>
        <button
          type="button"
          onClick={() => onPreview(null)}
          className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-[12.5px] font-medium text-white/80 transition hover:border-white/25 hover:text-white"
        >
          <Eye className="h-3.5 w-3.5" />
          Ver a página do consultor
        </button>
      </div>
      {!draft.consultantUsername && (
        <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-[12.5px] text-amber-100">
          O consultor foi escrito à mão — escolhe-o da lista da equipa (Plano → secção 1) para poderes enviar na app.
        </p>
      )}
      <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.08]">
        {SEND_ITEMS.map((item, i) => {
          const st = stateOf(item);
          const blocker = blockerFor(item);
          const entry = pubEntry(pub, periodIndex, item);
          return (
            <div
              key={item}
              className={`flex flex-wrap items-center gap-4 bg-white/[0.02] px-5 py-4 ${i ? "border-t border-white/[0.06]" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold text-white">
                  {sendItemLabel(item)}
                  {st.kind === "never" && blocker && !blocker.startsWith("Escolhe") ? (
                    <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10.5px] font-semibold text-white/35">
                      {item.startsWith("eval:") ? "Sem decisão" : item === "plan" ? "Incompleto" : "Por fazer"}
                    </span>
                  ) : (
                    <SendBadge compact state={st} />
                  )}
                </p>
                <p className="mt-0.5 text-[12px] text-white/45">{describe(item)}</p>
                {entry?.ack?.comment && (
                  <p className="mt-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[12px] italic text-white/70">
                    «{entry.ack.comment}» — {formatDateTime(entry.ack.at)}
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={Boolean(blocker) && st.kind === "never"}
                title={blocker ?? undefined}
                onClick={() => onPreview(item)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${
                  st.kind === "sent"
                    ? "border border-white/12 text-white/70 hover:text-white"
                    : "text-white shadow-[0_8px_22px_-10px_rgba(120,61,245,0.8)] hover:-translate-y-px"
                }`}
                style={st.kind === "sent" ? undefined : { background: "var(--brand-gradient)" }}
              >
                <Eye className="h-3.5 w-3.5" />
                {st.kind === "never" ? "Pré-visualizar e enviar" : st.kind === "changed" ? "Rever e reenviar" : "Ver o que foi enviado"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================ gravação e afins ============================ */

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
                {metCount(p.kpis30).met}/{metCount(p.kpis30).total} aos 30 · check-ins feitos:{" "}
                {p.weeks.filter((w) => w.done).length}/4
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
          <span>
            Apagar o plano de {name}, com o histórico? O consultor deixa de o ver na app. Não dá para desfazer.
          </span>
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
