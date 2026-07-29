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

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Tags, AlertCircle } from "lucide-react";

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

export function ReportLeadEvents({
  slug,
  eventMap,
}: {
  slug: string;
  eventMap: EventMap;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<keyof EventMap, string>>({
    form: eventMap.form.join(", "),
    call: eventMap.call.join(", "),
    email: eventMap.email.join(", "),
    whatsapp: eventMap.whatsapp.join(", "),
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/reports/${slug}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventMap: values }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(j?.error ?? "Não foi possível guardar.");
      }
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falhou.");
    } finally {
      setBusy(false);
    }
  }

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
              className="min-w-0 flex-1 rounded-lg border border-white/12 bg-black/25 px-3 py-1.5 font-mono text-[12.5px] text-white outline-none placeholder:text-white/25 focus:border-[#783DF5]/50"
            />
          </label>
        ))}
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
