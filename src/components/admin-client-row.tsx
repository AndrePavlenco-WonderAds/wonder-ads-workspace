"use client";

// Editable row inside the Admin Control Panel — one per client.
// Owns local "draft" state so the consultant can edit every field,
// then a single Save button persists the patch to KV via the API.
// Save → success pill auto-dismisses after 2.5s.

import { useMemo, useState } from "react";
import { Loader2, Save, Check, X } from "lucide-react";
import {
  BILLING_CADENCES,
  CLIENT_STATUSES,
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

export function AdminClientRow({
  slug,
  title,
  icon,
  departments,
  initial,
}: Props) {
  const [draft, setDraft] = useState<AdminClientRecord>(initial);
  const [saved, setSaved] = useState<AdminClientRecord>(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const dirty =
    draft.billingCadence !== saved.billingCadence ||
    draft.startingDate !== saved.startingDate ||
    draft.consultant !== saved.consultant ||
    draft.status !== saved.status ||
    draft.monthlyValueEur !== saved.monthlyValueEur ||
    draft.notes !== saved.notes;

  const nextBilling = useMemo(
    () => nextBillingDate(draft.startingDate, draft.billingCadence),
    [draft.startingDate, draft.billingCadence],
  );

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
          consultant: draft.consultant,
          status: draft.status,
          monthlyValueEur: draft.monthlyValueEur,
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
                  className="rounded border border-white/12 bg-white/[0.03] px-1.5 py-px text-[9.5px] font-bold uppercase tracking-[0.16em] text-white/55"
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

      {/* Consultant */}
      <td className="px-3 py-3.5">
        <input
          type="text"
          value={draft.consultant}
          onChange={(e) => setDraft({ ...draft, consultant: e.target.value })}
          placeholder="Unassigned"
          className="w-full rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[12px] text-white outline-none transition focus:border-white/30 placeholder:text-white/35"
        />
      </td>

      {/* Monthly value */}
      <td className="px-3 py-3.5">
        <div className="relative">
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-white/35">
            €
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={draft.monthlyValueEur ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              setDraft({
                ...draft,
                monthlyValueEur: raw === "" ? null : Number(raw),
              });
            }}
            placeholder="0"
            className="w-full rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 pr-5 text-right text-[12px] text-white outline-none transition focus:border-white/30 placeholder:text-white/35"
          />
        </div>
        <div className="mt-1 text-right text-[10.5px] text-white/40">/ mo</div>
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
