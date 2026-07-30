"use client";

// Per-client GA4 lead event mapping.
//
// Every GTM container names its events differently. Before this existed the
// only fix was to rename the event inside GA4 to match our default — and GA4
// does not backfill, so every month before the rename reads 0 forever.
//
// Each lead type takes a LIST of names, so a client that renamed an event
// mid-year keeps one continuous series: list the old name and the new one and
// the report sums both.
//
// Below the four defaults, the consultant can add EXTRA lines (v76.19): a
// second phone number for a second unit, a form that only exists on one
// landing page, one line per unit. Each extra line is its own row in the
// report, with its own name, and counts towards the consolidated total.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Tags, AlertCircle, Plus, X } from "lucide-react";
import {
  MAX_CUSTOM_LEAD_EVENTS,
  type CustomLeadEvent,
} from "@/lib/report/report-types";

type EventMap = {
  form: string[];
  call: string[];
  email: string[];
  whatsapp: string[];
};

const ROWS: { key: keyof EventMap; label: string; hint: string }[] = [
  { key: "form", label: "Formulários", hint: "generate_lead" },
  { key: "call", label: "Cliques em Ligar", hint: "click_to_call" },
  { key: "email", label: "Cliques em Email", hint: "click_to_email" },
  { key: "whatsapp", label: "WhatsApp", hint: "whatsapp_click" },
];

/** Placeholder pairs for new lines, cycled so the examples show the two real
 *  use cases: a second unit, and a form on a specific page. */
const EXTRA_HINTS: { label: string; events: string }[] = [
  { label: "Ligar · Unidade Cascais", events: "click_to_call_cascais" },
  { label: "Formulário · Landing Implantes", events: "form_implantes" },
  { label: "Ligar · Unidade Lisboa", events: "click_to_call_lisboa" },
  { label: "Formulário · Marcações", events: "form_marcacoes" },
];

/** An extra line while being edited — events kept as raw text so a half-typed
 *  comma-separated list doesn't get chopped up between keystrokes. */
type ExtraDraft = { id: string; label: string; events: string };

const newId = () => Math.random().toString(36).slice(2, 10);

export function ReportLeadEvents({
  slug,
  eventMap,
  extraLeadEvents,
}: {
  slug: string;
  eventMap: EventMap;
  extraLeadEvents: CustomLeadEvent[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<keyof EventMap, string>>({
    form: eventMap.form.join(", "),
    call: eventMap.call.join(", "),
    email: eventMap.email.join(", "),
    whatsapp: eventMap.whatsapp.join(", "),
  });
  const [extras, setExtras] = useState<ExtraDraft[]>(() =>
    extraLeadEvents.map((e) => ({
      id: e.id,
      label: e.label,
      events: e.events.join(", "),
    })),
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const setExtra = (id: string, patch: Partial<ExtraDraft>) =>
    setExtras((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );

  async function save() {
    // A half-filled line would silently vanish server-side — say so instead.
    const filled = extras.filter((e) => e.label.trim() || e.events.trim());
    if (filled.some((e) => !e.label.trim() || !e.events.trim())) {
      setErr("Cada linha adicional precisa de um nome e de pelo menos um evento.");
      return;
    }
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/reports/${slug}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventMap: values,
          extraLeadEvents: filled.map((e) => ({
            id: e.id,
            label: e.label.trim(),
            events: e.events,
          })),
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(j?.error ?? "Não foi possível guardar.");
      }
      setExtras(filled);
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falhou.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "min-w-0 flex-1 rounded-lg border border-white/12 bg-black/25 px-3 py-1.5 font-mono text-[12.5px] text-white outline-none placeholder:text-white/25 focus:border-[#783DF5]/50";

  return (
    <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <div className="mb-1 flex items-center gap-2">
        <Tags className="h-4 w-4 text-[#b79bff]" />
        <h3 className="text-sm font-semibold text-white/85">
          Eventos de lead no GA4
        </h3>
      </div>
      <p className="mb-4 text-[12.5px] leading-relaxed text-white/50">
        Diz à app que eventos ler — em vez de renomear o evento no GA4, que{" "}
        <b className="text-white/70">não recupera o histórico</b> e põe a zero
        todos os meses anteriores. Podes indicar{" "}
        <b className="text-white/70">vários nomes por linha</b> (separados por
        vírgula): se o cliente mudou de nome a meio do ano, lista o antigo e o
        novo e o relatório soma os dois.
      </p>

      <div className="flex flex-col gap-2.5">
        {ROWS.map((r) => (
          <label key={r.key} className="flex flex-wrap items-center gap-2.5">
            <span className="w-36 shrink-0 text-[13px] text-white/65">
              {r.label}
            </span>
            <input
              type="text"
              value={values[r.key]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [r.key]: e.target.value }))
              }
              placeholder={r.hint}
              spellCheck={false}
              className={inputCls}
            />
          </label>
        ))}
      </div>

      {/* Linhas extra — 2.ª unidade, 2.º telefone, formulário por página. */}
      <div className="mt-5 border-t border-white/8 pt-4">
        <div className="mb-1 text-[12.5px] font-semibold text-white/70">
          Linhas adicionais
        </div>
        <p className="mb-3 text-[12.5px] leading-relaxed text-white/45">
          Para um segundo telefone ou uma segunda unidade (ex.:{" "}
          <i>Ligar · Unidade Cascais</i>), ou formulários com eventos diferentes
          em páginas diferentes. Cada linha aparece com este nome no relatório do
          cliente e soma ao total de leads — por isso{" "}
          <b className="text-white/65">
            não repitas o mesmo evento em duas linhas
          </b>
          , seria contado duas vezes.
        </p>

        {extras.length > 0 && (
          <div className="mb-3 flex flex-col gap-2.5">
            {extras.map((row, i) => {
              const hint = EXTRA_HINTS[i % EXTRA_HINTS.length];
              return (
                <div key={row.id} className="flex flex-wrap items-center gap-2.5">
                  <input
                    type="text"
                    value={row.label}
                    onChange={(e) => setExtra(row.id, { label: e.target.value })}
                    placeholder={hint.label}
                    maxLength={60}
                    className="w-36 shrink-0 rounded-lg border border-white/12 bg-black/25 px-3 py-1.5 text-[12.5px] text-white outline-none placeholder:text-white/25 focus:border-[#783DF5]/50"
                  />
                  <input
                    type="text"
                    value={row.events}
                    onChange={(e) => setExtra(row.id, { events: e.target.value })}
                    placeholder={hint.events}
                    spellCheck={false}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setExtras((rows) => rows.filter((r) => r.id !== row.id))
                    }
                    title="Remover linha"
                    aria-label={`Remover linha ${row.label || i + 1}`}
                    className="shrink-0 rounded-lg border border-white/10 p-1.5 text-white/40 transition hover:border-red-400/40 hover:text-red-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={() =>
            setExtras((rows) => [...rows, { id: newId(), label: "", events: "" }])
          }
          disabled={extras.length >= MAX_CUSTOM_LEAD_EVENTS}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-1.5 text-[12.5px] font-medium text-white/70 transition hover:border-[#783DF5]/50 hover:text-white disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar linha
        </button>
        {extras.length >= MAX_CUSTOM_LEAD_EVENTS && (
          <span className="ml-2 text-[12px] text-white/35">
            Máximo de {MAX_CUSTOM_LEAD_EVENTS} linhas adicionais.
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#783DF5] px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#8a52ff] disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Guardar eventos
        </button>
        {saved && (
          <span className="text-[12.5px] text-emerald-300/90">
            Guardado ✓ — gera o relatório de novo para aplicar.
          </span>
        )}
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
