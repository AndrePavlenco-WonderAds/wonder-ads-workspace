"use client";

// Penalizações — one row per team member, expandable into their full history.
//
// UX calls worth naming:
//  • Everyone shows, including clean sheets. The value is seeing the whole
//    team, not a shame list of people who slipped.
//  • Removal asks for a reason and keeps the entry struck through in history.
//    An erasable disciplinary log is worthless the first time it's disputed.
//  • The active score only counts the last 12 months, and expired entries are
//    dimmed with an "expirada" tag so the drop-off is visible, not mysterious.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldAlert,
  Plus,
  Loader2,
  ChevronDown,
  Trash2,
  RotateCcw,
  X,
  AlertCircle,
  Check,
} from "lucide-react";
import {
  SEVERITY_LABEL,
  SEVERITY_TONE,
  RISK_LABEL,
  ACTIVE_WINDOW_MONTHS,
  type EmployeePenaltySummary,
  type Penalty,
  type PenaltySeverity,
  type RiskLevel,
} from "@/lib/admin-penalties-store";
import { formatDate } from "@/lib/dates";

const RISK_TONE: Record<RiskLevel, string> = {
  clean: "border-white/12 bg-white/[0.04] text-white/45",
  watch: "border-white/20 bg-white/[0.07] text-white/75",
  concern: "border-amber-400/30 bg-amber-500/[0.10] text-amber-200/90",
  critical: "border-red-400/35 bg-red-500/[0.12] text-red-200/90",
};

function SeverityChip({ s }: { s: PenaltySeverity }) {
  const tone = SEVERITY_TONE[s];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${tone.border} ${tone.bg} ${tone.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {SEVERITY_LABEL[s]}
    </span>
  );
}

export function AdminPenaltiesPanel({
  summaries,
}: {
  summaries: EmployeePenaltySummary[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const totals = useMemo(() => {
    const active = summaries.reduce((t, s) => t + s.activeCount, 0);
    const score = summaries.reduce((t, s) => t + s.activeScore, 0);
    const bySeverity = { 1: 0, 2: 0, 3: 0 } as Record<PenaltySeverity, number>;
    for (const s of summaries) {
      bySeverity[1] += s.bySeverity[1];
      bySeverity[2] += s.bySeverity[2];
      bySeverity[3] += s.bySeverity[3];
    }
    return {
      active,
      score,
      bySeverity,
      flagged: summaries.filter((s) => s.activeCount > 0).length,
      clean: summaries.filter((s) => s.activeCount === 0).length,
    };
  }, [summaries]);

  async function mutate(body: Record<string, unknown>, id: string) {
    setBusyId(id);
    setErr(null);
    try {
      const res = await fetch("/api/admin/penalties", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Falhou.");
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falhou.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="animate-fade-up">
      {/* Overview */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Penalizações ativas" value={totals.active} />
        <Tile label="Pontuação total" value={totals.score} />
        <Tile label="Com ocorrências" value={totals.flagged} />
        <Tile label="Sem ocorrências" value={totals.clean} tone="ok" />
        <Tile label="Médias" value={totals.bySeverity[2]} tone="warn" />
        <Tile label="Graves" value={totals.bySeverity[3]} tone="bad" />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-white/45">
          A pontuação soma a gravidade das penalizações dos últimos{" "}
          {ACTIVE_WINDOW_MONTHS} meses. Registos mais antigos ficam no
          histórico mas deixam de contar.
        </p>
        <label className="inline-flex cursor-pointer items-center gap-2 text-[12px] text-white/55">
          <input
            type="checkbox"
            checked={showRemoved}
            onChange={(e) => setShowRemoved(e.target.checked)}
            className="h-3.5 w-3.5 accent-[#783DF5]"
          />
          Mostrar removidas
        </label>
      </div>

      {err && (
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-200/90">
          <AlertCircle className="h-3.5 w-3.5" />
          {err}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {summaries.map((s) => {
          const open = openId === s.employeeId;
          const visible = s.history.filter((p) => showRemoved || !p.removedAt);
          return (
            <div
              key={s.employeeId}
              className="rounded-xl border border-white/10 bg-white/[0.025]"
            >
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : s.employeeId)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-white/35 transition-transform ${open ? "rotate-180" : ""}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">
                      {s.employeeName}
                    </span>
                    <span className="text-[11px] text-white/45">
                      {s.departments.join(" · ") || "—"}
                      {s.lastOccurredOn
                        ? ` · última: ${formatDate(s.lastOccurredOn)}`
                        : " · sem registos"}
                    </span>
                  </span>
                </button>

                <span className="flex shrink-0 items-center gap-1.5">
                  {s.bySeverity[3] > 0 && (
                    <Count n={s.bySeverity[3]} s={3} />
                  )}
                  {s.bySeverity[2] > 0 && <Count n={s.bySeverity[2]} s={2} />}
                  {s.bySeverity[1] > 0 && <Count n={s.bySeverity[1]} s={1} />}
                </span>

                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${RISK_TONE[s.risk]}`}
                >
                  {RISK_LABEL[s.risk]}
                  {s.activeScore > 0 ? ` · ${s.activeScore}` : ""}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setAdding(adding === s.employeeId ? null : s.employeeId)
                  }
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/12 px-2.5 py-1.5 text-[12px] font-medium text-white/65 transition hover:border-[#783DF5]/45 hover:text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar
                </button>
              </div>

              {adding === s.employeeId && (
                <AddForm
                  employee={s}
                  onDone={() => {
                    setAdding(null);
                    setOpenId(s.employeeId);
                    startTransition(() => router.refresh());
                  }}
                  onCancel={() => setAdding(null)}
                />
              )}

              {open && (
                <div className="border-t border-white/8 px-4 py-3">
                  {visible.length === 0 ? (
                    <p className="text-[12.5px] text-white/40">
                      Sem penalizações registadas.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {visible.map((p) => (
                        <PenaltyRow
                          key={p.id}
                          p={p}
                          busy={busyId === p.id}
                          onRemove={(reason) =>
                            mutate({ id: p.id, action: "remove", reason }, p.id)
                          }
                          onRestore={() =>
                            mutate({ id: p.id, action: "restore" }, p.id)
                          }
                        />
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "bad";
}) {
  const color =
    tone === "bad"
      ? "text-red-300"
      : tone === "warn"
        ? "text-amber-300"
        : tone === "ok"
          ? "text-emerald-300"
          : "text-white";
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="mt-0.5 text-[10.5px] uppercase tracking-wide text-white/40">
        {label}
      </div>
    </div>
  );
}

function Count({ n, s }: { n: number; s: PenaltySeverity }) {
  const tone = SEVERITY_TONE[s];
  return (
    <span
      title={SEVERITY_LABEL[s]}
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${tone.border} ${tone.bg} ${tone.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {n}
    </span>
  );
}

/** Expired = outside the active window, so it no longer counts. Shown dimmed
 *  rather than hidden, so the score dropping is explainable. */
function isExpired(p: Penalty): boolean {
  if (p.removedAt) return false;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - ACTIVE_WINDOW_MONTHS);
  return p.occurredOn < cutoff.toISOString().slice(0, 10);
}

function PenaltyRow({
  p,
  busy,
  onRemove,
  onRestore,
}: {
  p: Penalty;
  busy: boolean;
  onRemove: (reason: string) => void;
  onRestore: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const removed = Boolean(p.removedAt);
  const expired = isExpired(p);

  return (
    <li
      className={`rounded-lg border border-white/8 bg-white/[0.015] px-3 py-2.5 ${removed ? "opacity-55" : expired ? "opacity-70" : ""}`}
    >
      <div className="flex flex-wrap items-start gap-2">
        <SeverityChip s={p.severity} />
        <span
          className={`min-w-0 flex-1 text-[13px] font-semibold text-white/90 ${removed ? "line-through" : ""}`}
        >
          {p.title}
        </span>
        {expired && (
          <span className="rounded-full border border-white/12 px-1.5 py-px text-[9.5px] uppercase tracking-wide text-white/40">
            expirada
          </span>
        )}
        {removed && (
          <span className="rounded-full border border-white/12 px-1.5 py-px text-[9.5px] uppercase tracking-wide text-white/40">
            removida
          </span>
        )}
        {!removed ? (
          <button
            type="button"
            onClick={() => setConfirming((v) => !v)}
            disabled={busy}
            className="shrink-0 rounded-md p-1 text-white/35 transition hover:text-red-300 disabled:opacity-50"
            aria-label="Remover penalização"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={onRestore}
            disabled={busy}
            className="shrink-0 rounded-md p-1 text-white/35 transition hover:text-emerald-300 disabled:opacity-50"
            aria-label="Repor penalização"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      {p.description && (
        <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-white/60">
          {p.description}
        </p>
      )}

      <p className="mt-1.5 text-[11px] text-white/35">
        Ocorreu em {formatDate(p.occurredOn)} · registado por {p.createdBy}
        {removed && p.removedAt
          ? ` · removida por ${p.removedBy} em ${formatDate(p.removedAt)}${p.removalReason ? ` — “${p.removalReason}”` : ""}`
          : ""}
      </p>

      {confirming && !removed && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo da remoção (fica no histórico)"
            className="min-w-0 flex-1 rounded-lg border border-white/12 bg-black/25 px-2.5 py-1.5 text-[12.5px] text-white outline-none placeholder:text-white/30 focus:border-red-400/50"
          />
          <button
            type="button"
            onClick={() => {
              onRemove(reason);
              setConfirming(false);
            }}
            className="rounded-lg border border-red-400/40 bg-red-500/15 px-2.5 py-1.5 text-[12px] font-semibold text-red-100 transition hover:bg-red-500/25"
          >
            Confirmar
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-lg border border-white/12 p-1.5 text-white/50 transition hover:text-white"
            aria-label="Cancelar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </li>
  );
}

function AddForm({
  employee,
  onDone,
  onCancel,
}: {
  employee: EmployeePenaltySummary;
  onDone: () => void;
  onCancel: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [severity, setSeverity] = useState<PenaltySeverity>(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [occurredOn, setOccurredOn] = useState(today);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!title.trim()) {
      setErr("O título é obrigatório.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/penalties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employee.employeeId,
          employeeName: employee.employeeName,
          departments: employee.departments,
          severity,
          title,
          description,
          occurredOn,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Falhou.");
      }
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falhou.");
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-white/8 bg-white/[0.015] px-4 py-3.5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-white/40">
          Gravidade
        </span>
        {([1, 2, 3] as PenaltySeverity[]).map((s) => {
          const on = severity === s;
          const tone = SEVERITY_TONE[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSeverity(s)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition ${
                on
                  ? `${tone.border} ${tone.bg} ${tone.text}`
                  : "border-white/10 text-white/45 hover:border-white/25"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
              {s} · {SEVERITY_LABEL[s]}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título — o que aconteceu"
            className="min-w-0 flex-1 rounded-lg border border-white/12 bg-black/25 px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-[#783DF5]/50"
          />
          <input
            type="date"
            value={occurredOn}
            max={today}
            onChange={(e) => setOccurredOn(e.target.value)}
            className="rounded-lg border border-white/12 bg-black/25 px-3 py-2 text-[13px] text-white outline-none focus:border-[#783DF5]/50"
          />
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Descrição — contexto, impacto, o que foi combinado a seguir"
          className="w-full resize-y rounded-lg border border-white/12 bg-black/25 px-3 py-2 text-[13px] leading-relaxed text-white outline-none placeholder:text-white/30 focus:border-[#783DF5]/50"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#783DF5] px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#8a52ff] disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Registar penalização
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-lg border border-white/12 px-3 py-2 text-[13px] text-white/60 transition hover:text-white disabled:opacity-60"
        >
          Cancelar
        </button>
        {err && (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-red-300/90">
            <AlertCircle className="h-3.5 w-3.5" />
            {err}
          </span>
        )}
      </div>
    </div>
  );
}

export { ShieldAlert };
