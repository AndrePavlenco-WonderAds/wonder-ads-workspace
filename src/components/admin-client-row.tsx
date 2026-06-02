"use client";

// Editable row inside the Admin Control Panel — one per client.
// Owns local "draft" state so the consultant can edit every field,
// then a single Save button persists the patch to KV via the API.
// Save → success pill auto-dismisses after 2.5s.

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Save, Check, X, Users, ChevronDown } from "lucide-react";
import {
  BILLING_CADENCES,
  CLIENT_STATUSES,
  CONSULTANTS,
  cadenceLabel,
  cadenceMonths,
  nextBillingDate,
  type AdminClientRecord,
  type BillingCadence,
  type ClientStatus,
} from "@/lib/admin-clients-store";
import { formatDate } from "@/lib/dates";

type Props = {
  slug: string;
  title: string;
  icon: string | null;
  departments: string[]; // ["SEO"], ["ADS"], ["SEO", "ADS"], …
  initial: AdminClientRecord;
  /** Notified after the server confirms a save. The parent panel uses
   *  this to update its records map so the rollup tiles (MRR €, MRR $)
   *  recompute instantly without waiting on router.refresh(). */
  onSaved?: (record: AdminClientRecord) => void;
};

const STATUS_PILL: Record<ClientStatus, string> = {
  active:
    "border-emerald-400/35 bg-emerald-500/10 text-emerald-200",
  paused:
    "border-amber-400/35 bg-amber-500/10 text-amber-200",
  onboarding:
    "border-sky-400/35 bg-sky-500/10 text-sky-200",
  offboarded:
    "border-rose-400/35 bg-rose-500/10 text-rose-200",
};

const DEPT_PILL: Record<string, string> = {
  SEO: "border-[#783DF5]/40 bg-[#783DF5]/12 text-[#d4c4ff]",
  ADS: "border-[#C535C9]/40 bg-[#C535C9]/12 text-[#f4c5f1]",
  Web: "border-cyan-400/45 bg-cyan-500/12 text-cyan-200",
};

function arraysShallowEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function AdminClientRow({
  slug,
  title,
  icon,
  departments,
  initial,
  onSaved,
}: Props) {
  const [draft, setDraft] = useState<AdminClientRecord>(initial);
  const [saved, setSaved] = useState<AdminClientRecord>(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [consultantsOpen, setConsultantsOpen] = useState(false);
  const consultantsRef = useRef<HTMLDivElement | null>(null);

  // Close consultants dropdown on outside click + on Escape.
  useEffect(() => {
    if (!consultantsOpen) return;
    function onDown(e: MouseEvent) {
      if (
        consultantsRef.current &&
        !consultantsRef.current.contains(e.target as Node)
      ) {
        setConsultantsOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setConsultantsOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [consultantsOpen]);

  const dirty =
    draft.billingCadence !== saved.billingCadence ||
    draft.startingDate !== saved.startingDate ||
    !arraysShallowEqual(draft.consultants, saved.consultants) ||
    draft.status !== saved.status ||
    draft.currency !== saved.currency ||
    draft.monthlyValue !== saved.monthlyValue ||
    draft.notes !== saved.notes;

  const nextBilling = useMemo(
    () => nextBillingDate(draft.startingDate, draft.billingCadence),
    [draft.startingDate, draft.billingCadence],
  );

  function toggleConsultant(name: string) {
    setDraft((d) => {
      const has = d.consultants.includes(name);
      return {
        ...d,
        consultants: has
          ? d.consultants.filter((c) => c !== name)
          : [...d.consultants, name],
      };
    });
  }

  async function save() {
    setState("saving");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/clients/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingCadence: draft.billingCadence,
          startingDate: draft.startingDate,
          consultants: draft.consultants,
          status: draft.status,
          currency: draft.currency,
          monthlyValue: draft.monthlyValue,
          notes: draft.notes,
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { record: AdminClientRecord };
      setSaved(json.record);
      setDraft(json.record);
      setState("saved");
      onSaved?.(json.record);
      setTimeout(() => setState("idle"), 2500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setState("error");
      setTimeout(() => setState("idle"), 4000);
    }
  }

  function reset() {
    setDraft(saved);
    setState("idle");
    setErrorMsg(null);
  }

  return (
    <tr
      className="border-b border-white/5 align-top transition hover:bg-white/[0.015]"
      data-dirty={dirty ? "true" : "false"}
    >
      {/* Client */}
      <td className="px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          <span
            aria-hidden
            className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-sm"
          >
            {icon ?? "•"}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-white">
              {title}
            </div>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {departments.map((d) => (
                <span
                  key={d}
                  className={`rounded border px-1.5 py-px text-[9.5px] font-bold uppercase tracking-[0.16em] ${
                    DEPT_PILL[d] ??
                    "border-white/12 bg-white/[0.03] text-white/55"
                  }`}
                >
                  {d}
                </span>
              ))}
            </div>
          </div>
        </div>
      </td>

      {/* Billing cadence */}
      <td className="px-3 py-3.5">
        <select
          value={draft.billingCadence}
          onChange={(e) =>
            setDraft({
              ...draft,
              billingCadence: e.target.value as BillingCadence,
            })
          }
          className="w-full rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[12px] text-white outline-none transition focus:border-white/30"
        >
          {BILLING_CADENCES.map((c) => (
            <option key={c} value={c} className="bg-[#111]">
              {cadenceLabel(c)}
            </option>
          ))}
        </select>
        <div className="mt-1 text-[10.5px] text-white/40">
          Every {cadenceMonths(draft.billingCadence)} month
          {cadenceMonths(draft.billingCadence) === 1 ? "" : "s"}
        </div>
      </td>

      {/* Starting date */}
      <td className="px-3 py-3.5">
        <input
          type="date"
          value={draft.startingDate ?? ""}
          onChange={(e) =>
            setDraft({ ...draft, startingDate: e.target.value || null })
          }
          className="w-full rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[12px] text-white outline-none transition focus:border-white/30"
        />
        <div className="mt-1 text-[10.5px] text-white/40">
          {draft.startingDate
            ? `Started ${formatDate(draft.startingDate)}`
            : "Not set"}
        </div>
      </td>

      {/* Next billing — derived */}
      <td className="px-3 py-3.5 text-[12px]">
        <span className="text-white/80">
          {nextBilling ? formatDate(nextBilling) : "—"}
        </span>
        <div className="mt-1 text-[10.5px] text-white/40">Auto-computed</div>
      </td>

      {/* Consultants — multi-select dropdown */}
      <td className="px-3 py-3.5">
        <div ref={consultantsRef} className="relative">
          <button
            type="button"
            onClick={() => setConsultantsOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 text-left text-[12px] text-white outline-none transition hover:border-white/20 focus:border-white/30"
            aria-haspopup="listbox"
            aria-expanded={consultantsOpen}
          >
            <span className="flex flex-1 flex-wrap items-center gap-1">
              {draft.consultants.length === 0 ? (
                <span className="text-white/35">Unassigned</span>
              ) : (
                draft.consultants.map((c) => (
                  <span
                    key={c}
                    className="rounded border border-white/15 bg-white/[0.05] px-1.5 py-0.5 text-[10.5px] text-white/85"
                  >
                    {c}
                  </span>
                ))
              )}
            </span>
            <ChevronDown
              className={`h-3 w-3 shrink-0 text-white/40 transition ${
                consultantsOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          {consultantsOpen && (
            <div
              role="listbox"
              aria-multiselectable="true"
              className="absolute left-0 right-0 top-full z-30 mt-1 rounded-md border border-white/12 bg-[#0c0c12] py-1 shadow-2xl shadow-black/60"
            >
              <div className="border-b border-white/8 px-2.5 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.16em] text-white/45">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3 w-3" />
                  Assign consultants
                </span>
              </div>
              {CONSULTANTS.map((name) => {
                const checked = draft.consultants.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleConsultant(name)}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] text-white/85 transition hover:bg-white/[0.04]"
                    role="option"
                    aria-selected={checked}
                  >
                    <span
                      className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${
                        checked
                          ? "brand-gradient-bg border-transparent"
                          : "border-white/25 bg-transparent"
                      }`}
                    >
                      {checked && <Check className="h-2.5 w-2.5 text-white" />}
                    </span>
                    <span>{name}</span>
                  </button>
                );
              })}
              {/* Honour names already saved that aren't in the canonical
                  roster — show them as toggleable so the consultant can
                  remove them without losing the row state. */}
              {draft.consultants
                .filter(
                  (c) =>
                    !(CONSULTANTS as readonly string[]).includes(c),
                )
                .map((name) => (
                  <button
                    key={`custom-${name}`}
                    type="button"
                    onClick={() => toggleConsultant(name)}
                    className="flex w-full items-center gap-2 border-t border-white/8 px-2.5 py-1.5 text-left text-[12px] text-white/85 transition hover:bg-white/[0.04]"
                    role="option"
                    aria-selected
                  >
                    <span className="brand-gradient-bg flex h-3.5 w-3.5 items-center justify-center rounded border border-transparent">
                      <Check className="h-2.5 w-2.5 text-white" />
                    </span>
                    <span>
                      {name}
                      <span className="ml-1 text-[9.5px] uppercase tracking-[0.14em] text-white/35">
                        legacy
                      </span>
                    </span>
                  </button>
                ))}
            </div>
          )}
        </div>
        <div className="mt-1 text-[10.5px] text-white/40">
          {draft.consultants.length}{" "}
          {draft.consultants.length === 1 ? "consultant" : "consultants"}
        </div>
      </td>

      {/* Monthly value — emphasized column, EUR-locked.
          Empty cells get a vibrant rose ring + tint so unfilled
          clients pop on the board. */}
      <td className="px-3 py-3.5">
        {(() => {
          const isEmpty = draft.monthlyValue === null;
          return (
            <>
              <div className="flex items-stretch gap-1">
                <div
                  className={`flex shrink-0 items-center justify-center rounded-md border px-2.5 text-[13px] font-semibold ${
                    isEmpty
                      ? "border-rose-400/45 bg-rose-500/[0.08] text-rose-200"
                      : "brand-gradient-bg border-transparent text-white"
                  }`}
                  aria-hidden
                  title="Euros"
                >
                  €
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={draft.monthlyValue ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setDraft({
                      ...draft,
                      monthlyValue: raw === "" ? null : Number(raw),
                      currency: "EUR",
                    });
                  }}
                  placeholder="—"
                  className={`w-full rounded-md border px-2.5 py-2 text-right text-[14px] font-semibold tabular-nums outline-none transition focus:border-white/40 ${
                    isEmpty
                      ? "border-rose-400/55 bg-rose-500/[0.08] text-rose-100 placeholder:text-rose-300/70 focus:border-rose-300 shadow-[0_0_0_1px_rgba(244,63,94,0.18)]"
                      : "border-white/18 bg-white/[0.05] text-white placeholder:text-white/35"
                  }`}
                />
              </div>
              <div
                className={`mt-1 text-right text-[10.5px] ${
                  isEmpty ? "font-semibold text-rose-300" : "text-white/45"
                }`}
              >
                {isEmpty ? "Needs value" : "/ mo · EUR"}
              </div>
            </>
          );
        })()}
      </td>

      {/* Status */}
      <td className="px-3 py-3.5">
        <select
          value={draft.status}
          onChange={(e) =>
            setDraft({ ...draft, status: e.target.value as ClientStatus })
          }
          className={`w-full rounded-md border px-2 py-1.5 text-[12px] font-medium outline-none transition focus:border-white/30 ${STATUS_PILL[draft.status]}`}
        >
          {CLIENT_STATUSES.map((s) => (
            <option key={s} value={s} className="bg-[#111] text-white">
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </td>

      {/* Notes */}
      <td className="px-3 py-3.5">
        <textarea
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          rows={2}
          placeholder="Invoicing quirks, payment terms, etc."
          className="w-full rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[12px] text-white outline-none transition focus:border-white/30 placeholder:text-white/35"
        />
      </td>

      {/* Save / state */}
      <td className="px-3 py-3.5">
        <div className="flex flex-col items-stretch gap-1.5">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || state === "saving"}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-semibold transition ${
              state === "saved"
                ? "border border-emerald-400/45 bg-emerald-500/15 text-emerald-100"
                : state === "error"
                  ? "border border-rose-400/45 bg-rose-500/15 text-rose-100"
                  : dirty
                    ? "brand-gradient-bg text-white shadow-[0_6px_22px_-4px_rgba(120,61,245,0.55)] hover:opacity-90"
                    : "cursor-not-allowed border border-white/8 bg-white/[0.02] text-white/30"
            }`}
          >
            {state === "saving" && <Loader2 className="h-3 w-3 animate-spin" />}
            {state === "saved" && <Check className="h-3 w-3" />}
            {state === "error" && <X className="h-3 w-3" />}
            {(state === "idle" || state === "saving") && dirty && state !== "saving" && (
              <Save className="h-3 w-3" />
            )}
            {state === "saving"
              ? "Saving"
              : state === "saved"
                ? "Saved"
                : state === "error"
                  ? "Failed"
                  : dirty
                    ? "Save"
                    : "Saved"}
          </button>
          {dirty && state !== "saving" && (
            <button
              type="button"
              onClick={reset}
              className="text-[10.5px] text-white/40 transition hover:text-white/70"
            >
              Discard changes
            </button>
          )}
          {state === "error" && errorMsg && (
            <span
              className="block max-w-[160px] truncate text-[10px] text-rose-300"
              title={errorMsg}
            >
              {errorMsg}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
