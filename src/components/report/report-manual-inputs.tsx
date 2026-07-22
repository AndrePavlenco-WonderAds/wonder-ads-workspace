"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Ban, Pencil } from "lucide-react";
import type { LeadChannel, LeadChannelKey } from "@/lib/report/report-types";

type Mode = "value" | "na" | "pending";

type RowState = { mode: Mode; value: string };

function initialState(c: LeadChannel): RowState {
  if (c.metric.manualNa) return { mode: "na", value: "" };
  if (c.metric.value !== null && c.metric.source === "manual") {
    return { mode: "value", value: String(c.metric.value) };
  }
  return { mode: "pending", value: "" };
}

/** Consultant fill-in for the metrics the app can't pull (GBP + any lead event
 *  that isn't instrumented in GA4) + the report notes. Everything the report
 *  needs to leave "draft" and be client-ready. */
export function ReportManualInputs({
  slug,
  period,
  channels,
  notes,
}: {
  slug: string;
  period: string;
  channels: LeadChannel[];
  notes: string;
}) {
  const router = useRouter();
  // Only channels the app can't pull automatically are editable here.
  const editable = useMemo(
    () => channels.filter((c) => c.metric.source !== "ga4"),
    [channels],
  );
  // Lead events that GA4 isn't sending — the ones a GTM setup would automate.
  const uninstrumentedLeads = useMemo(
    () =>
      channels.some(
        (c) =>
          ["form", "call", "email", "whatsapp"].includes(c.key) &&
          c.metric.source === "na" &&
          !c.metric.manualNa &&
          c.metric.value === null,
      ),
    [channels],
  );
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(editable.map((c) => [c.key, initialState(c)])),
  );
  const [noteText, setNoteText] = useState(notes);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const setRow = (key: string, patch: Partial<RowState>) =>
    setRows((p) => ({ ...p, [key]: { ...p[key], ...patch } }));

  async function save() {
    setBusy(true);
    setErr(null);
    setSaved(false);
    const channelsPayload: Partial<Record<LeadChannelKey, number | "na" | null>> = {};
    for (const c of editable) {
      const r = rows[c.key];
      if (r.mode === "na") channelsPayload[c.key] = "na";
      else if (r.mode === "value") {
        const n = Number(r.value);
        channelsPayload[c.key] = Number.isFinite(n) && r.value.trim() !== "" ? Math.round(n) : null;
      } else channelsPayload[c.key] = null;
    }
    try {
      const res = await fetch(`/api/reports/${slug}/${period}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channels: channelsPayload, notes: noteText }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(true);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falhou");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="brand-gradient-border mb-4 rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md">
      <div className="mb-3 flex items-center gap-2">
        <Pencil className="h-4 w-4 text-[#b79bff]" />
        <h3 className="text-sm font-semibold text-white/85">Preencher dados em falta</h3>
      </div>
      <p className="mb-4 text-[12px] text-white/45">
        Métricas que a app não consegue puxar (GBP + eventos não instrumentados).
        Introduza o valor do mês ou marque <b>N/A</b>. O relatório fica pronto quando
        não sobrar nada por resolver.
      </p>

      {uninstrumentedLeads && (
        <div className="mb-4 rounded-xl border border-sky-400/25 bg-sky-500/[0.06] px-4 py-3 text-[12px] leading-relaxed text-sky-100/85">
          <b>Automatizar os leads via Google Tag Manager.</b> Estes eventos ainda não
          chegam do GA4 deste cliente. No GTM do site, cria os disparos e marca-os como
          eventos GA4: <b>submit de formulário → </b><code className="rounded bg-white/10 px-1">generate_lead</code>,
          {" "}links <code className="rounded bg-white/10 px-1">tel:</code> → <code className="rounded bg-white/10 px-1">click_to_call</code>,
          {" "}links <code className="rounded bg-white/10 px-1">mailto:</code> → <code className="rounded bg-white/10 px-1">click_to_email</code>,
          {" "}widget WhatsApp → <code className="rounded bg-white/10 px-1">whatsapp_click</code>.
          {" "}A partir daí o relatório puxa-os sozinho. Até lá, preenche abaixo.{" "}
          <a
            href="https://support.google.com/tagmanager/answer/6106716"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-sky-300/50 underline-offset-2 hover:text-white"
          >
            Guia GTM
          </a>
        </div>
      )}

      <div className="space-y-2">
        {editable.map((c) => {
          const r = rows[c.key];
          return (
            <div
              key={c.key}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-2.5"
            >
              <span className="min-w-[170px] flex-1 text-[13px] text-white/75">{c.label}</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={r.mode === "na" ? "" : r.value}
                disabled={r.mode === "na"}
                onChange={(e) => setRow(c.key, { value: e.target.value, mode: "value" })}
                placeholder={r.mode === "na" ? "N/A" : "valor do mês"}
                className="w-28 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1.5 text-sm text-white/90 outline-none transition focus:border-[#783DF5]/50 focus:bg-white/[0.06] disabled:opacity-40"
              />
              <button
                type="button"
                onClick={() =>
                  setRow(c.key, r.mode === "na" ? { mode: "pending", value: "" } : { mode: "na", value: "" })
                }
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition ${
                  r.mode === "na"
                    ? "border-white/25 bg-white/10 text-white/85"
                    : "border-white/10 text-white/50 hover:border-white/20 hover:text-white/75"
                }`}
              >
                <Ban className="h-3.5 w-3.5" />
                N/A
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block text-[12px] font-medium text-white/60">
          Notas &amp; Próximos Passos (secção 8 do relatório)
        </label>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={3}
          placeholder="Foco do próximo mês, pedidos ao cliente, contexto que os números não mostram…"
          className="w-full resize-y rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-3 text-sm text-white/85 outline-none transition focus:border-[#783DF5]/50 focus:bg-white/[0.06]"
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[#783DF5]/25 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#343ED7,#783DF5,#C535C9)" }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Guardar dados
        </button>
        {saved && !busy && <span className="text-[12px] text-emerald-300">Guardado ✓</span>}
        {err && <span className="text-[12px] text-rose-400">Não foi possível guardar: {err}</span>}
      </div>
    </div>
  );
}
