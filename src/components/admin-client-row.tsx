"use client";

// Editable row inside the Clients table — one per (client, department).
// Owns local "draft" state so the team can edit every field, then a
// single Save button persists the patch to KV via the API. Save →
// success pill auto-dismisses after 2.5s.
//
// v74.46: dropped the Consultants + Status columns (still stored, just
// not surfaced here — the Employees page still reads them). Added
// Invoice Type, an editable Invoice date (replacing the derived "next
// billing"), and an IVA amount. Clicking the client name opens the
// full-page detail pop-up.

import { useState } from "react";
import { Loader2, Save, Check, X } from "lucide-react";
import {
  BILLING_CADENCES,
  INVOICE_TYPES,
  cadenceLabel,
  cadenceMonths,
  type AdminClientRecord,
  type BillingCadence,
  type ClientDepartment,
  type InvoiceType,
} from "@/lib/admin-clients-store";
import { formatDate } from "@/lib/dates";

import { LogoChip } from "./logo-chip";
import { ClientDetailModal } from "./client-detail-modal";
import type { LogoBgMode, LogoSizing } from "@/lib/client-meta";

type Props = {
  slug: string;
  title: string;
  icon: string | null;
  /** Real brand-logo bundle — when `logo` is null the LogoChip falls
   *  back to the emoji icon. */
  logo: string | null;
  logoBgMode: LogoBgMode;
  logoSizing: LogoSizing;
  gradient: string;
  /** Which department this row represents. */
  department: ClientDepartment;
  /** All departments the client appears in — drives the "shared with"
   *  badge so the consultant remembers the other budget rows exist. */
  clientDepartments: ClientDepartment[];
  initial: AdminClientRecord;
  /** Notified after the server confirms a save. The parent panel uses
   *  this to update its records map so the rollup tiles (MRR / IVA)
   *  recompute instantly without waiting on router.refresh(). */
  onSaved?: (record: AdminClientRecord) => void;
  /** True when this client was added manually (extra-clients store) and
   *  can be removed from here. */
  isExtra?: boolean;
  /** Delete the whole manually-added client (all its dept rows). */
  onDelete?: (slug: string) => void;
};

const DEPT_PILL: Record<string, string> = {
  SEO: "border-[#783DF5]/40 bg-[#783DF5]/12 text-[#d4c4ff]",
  ADS: "border-[#C535C9]/40 bg-[#C535C9]/12 text-[#f4c5f1]",
  Web: "border-cyan-400/45 bg-cyan-500/12 text-cyan-200",
};

const INVOICE_TYPE_PILL: Record<InvoiceType, string> = {
  Canva: "border-sky-400/35 bg-sky-500/10 text-sky-200",
  Contabilidade: "border-amber-400/35 bg-amber-500/10 text-amber-200",
  Plataforma: "border-violet-400/35 bg-violet-500/10 text-violet-200",
};

export function AdminClientRow({
  slug,
  title,
  icon,
  logo,
  logoBgMode,
  logoSizing,
  gradient,
  department,
  clientDepartments,
  initial,
  onSaved,
  isExtra,
  onDelete,
}: Props) {
  const sharedWith = clientDepartments.filter((d) => d !== department);
  const [draft, setDraft] = useState<AdminClientRecord>(initial);
  const [saved, setSaved] = useState<AdminClientRecord>(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const dirty =
    draft.billingCadence !== saved.billingCadence ||
    draft.startingDate !== saved.startingDate ||
    draft.invoiceDate !== saved.invoiceDate ||
    draft.invoiceType !== saved.invoiceType ||
    draft.monthlyValue !== saved.monthlyValue ||
    draft.iva !== saved.iva;

  async function save() {
    setState("saving");
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/admin/clients/${slug}/${department.toLowerCase()}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            billingCadence: draft.billingCadence,
            startingDate: draft.startingDate,
            invoiceDate: draft.invoiceDate,
            invoiceType: draft.invoiceType,
            monthlyValue: draft.monthlyValue,
            iva: draft.iva,
            clientDepartments,
          }),
        },
      );
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
      {/* Client — name opens the full-page detail pop-up */}
      <td className="px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 shrink-0">
            <LogoChip
              logo={logo}
              emoji={icon}
              alt={`${title} logo`}
              gradient={gradient}
              size="sm"
              bgMode={logoBgMode}
              sizing={logoSizing}
            />
          </div>
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => setDetailOpen(true)}
              className="truncate text-left text-[13px] font-semibold text-white underline-offset-2 transition hover:text-[#c9b3ff] hover:underline"
              title="Abrir detalhe do cliente"
            >
              {title}
            </button>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              <span
                className={`rounded border px-1.5 py-px text-[9.5px] font-bold uppercase tracking-[0.16em] ${
                  DEPT_PILL[department] ??
                  "border-white/12 bg-white/[0.03] text-white/55"
                }`}
              >
                {department}
              </span>
              {sharedWith.length > 0 && (
                <span
                  className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-white/35"
                  title={`Also tracked under ${sharedWith.join(" + ")} on its own budget row.`}
                >
                  · also in {sharedWith.join(", ")}
                </span>
              )}
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

      {/* Invoice date — editable, empty by default */}
      <td className="px-3 py-3.5">
        <input
          type="date"
          value={draft.invoiceDate ?? ""}
          onChange={(e) =>
            setDraft({ ...draft, invoiceDate: e.target.value || null })
          }
          className="w-full rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[12px] text-white outline-none transition focus:border-white/30"
        />
        <div className="mt-1 text-[10.5px] text-white/40">
          {draft.invoiceDate ? formatDate(draft.invoiceDate) : "Not set"}
        </div>
      </td>

      {/* Invoice Type — Canva / Contabilidade / Plataforma */}
      <td className="px-3 py-3.5">
        <select
          value={draft.invoiceType}
          onChange={(e) =>
            setDraft({ ...draft, invoiceType: e.target.value as InvoiceType })
          }
          className={`w-full rounded-md border px-2 py-1.5 text-[12px] font-medium outline-none transition focus:border-white/30 ${INVOICE_TYPE_PILL[draft.invoiceType]}`}
        >
          {INVOICE_TYPES.map((t) => (
            <option key={t} value={t} className="bg-[#111] text-white">
              {t}
            </option>
          ))}
        </select>
      </td>

      {/* Monthly value — emphasized column, EUR-locked. Empty cells get
          a vibrant rose ring + tint so unfilled clients pop. */}
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

      {/* IVA — editable EUR amount, feeds the Obrigações Fiscais tile */}
      <td className="px-3 py-3.5">
        <div className="flex items-stretch gap-1">
          <div
            className="flex shrink-0 items-center justify-center rounded-md border border-rose-400/40 bg-rose-500/[0.10] px-2.5 text-[13px] font-semibold text-rose-200"
            aria-hidden
            title="IVA (euros)"
          >
            €
          </div>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={draft.iva ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              setDraft({ ...draft, iva: raw === "" ? null : Number(raw) });
            }}
            placeholder="0"
            className="w-full rounded-md border border-white/18 bg-white/[0.05] px-2.5 py-2 text-right text-[14px] font-semibold tabular-nums text-white outline-none transition placeholder:text-white/30 focus:border-white/40"
          />
        </div>
        <div className="mt-1 text-right text-[10.5px] text-white/45">IVA · EUR</div>
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
            {state === "idle" && dirty && <Save className="h-3 w-3" />}
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
          {isExtra && onDelete && (
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    `Remover o cliente "${title}"? Remove todas as linhas deste cliente adicionado manualmente.`,
                  )
                )
                  onDelete(slug);
              }}
              className="text-[10.5px] text-white/35 transition hover:text-rose-300"
            >
              Remove client
            </button>
          )}
        </div>
      </td>

      {detailOpen && (
        <ClientDetailModalPortal
          slug={slug}
          title={title}
          logo={logo}
          icon={icon}
          gradient={gradient}
          logoBgMode={logoBgMode}
          logoSizing={logoSizing}
          onClose={() => setDetailOpen(false)}
        />
      )}
    </tr>
  );
}

/** Thin wrapper so the heavy modal (+ its blob-upload deps) is only
 *  mounted when actually opened, and so the logo chip is built once. */
function ClientDetailModalPortal({
  slug,
  title,
  logo,
  icon,
  gradient,
  logoBgMode,
  logoSizing,
  onClose,
}: {
  slug: string;
  title: string;
  logo: string | null;
  icon: string | null;
  gradient: string;
  logoBgMode: LogoBgMode;
  logoSizing: LogoSizing;
  onClose: () => void;
}) {
  return (
    <ClientDetailModal
      slug={slug}
      clientName={title}
      logo={
        <LogoChip
          logo={logo}
          emoji={icon}
          alt={`${title} logo`}
          gradient={gradient}
          size="sm"
          bgMode={logoBgMode}
          sizing={logoSizing}
        />
      }
      onClose={onClose}
    />
  );
}
