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
 *  that isn't instrumented in GA4) + the report notes. Compacto (v77.1): duas
 *  colunas, um ponto de estado por linha e as explicações fechadas num
 *  expansor — preencher 7 números não pode exigir ler 7 parágrafos. */
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
          // Every GA4-sourced lead line: the four defaults + the client's
          // extra lines (`custom:<id>`). GBP rows are always manual.
          !c.key.startsWith("gbp") &&
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

  const pendingCount = editable.filter((c) => {
    const r = rows[c.key];
    return r.mode === "pending" || (r.mode === "value" && r.value.trim() === "");
  }).length;

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
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Pencil className="h-4 w-4 text-[#b79bff]" />
        <h3 className="text-sm font-semibold text-white/85">Preencher dados em falta</h3>
        {pendingCount > 0 ? (
          <span className="rounded-full border border-amber-400/25 bg-amber-500/[0.1] px-2 py-0.5 text-[10.5px] font-semibold text-amber-200/90">
            {pendingCount} por resolver
          </span>
        ) : (
          <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-200/90">
            tudo resolvido
          </span>
        )}
      </div>
      <p className="mb-3 text-[12px] text-white/45">
        Valor do mês ou <b>N/A</b> — o relatório fica pronto quando nada sobrar.
      </p>

      {uninstrumentedLeads && (
        <details className="mb-3 rounded-lg border border-sky-400/20 bg-sky-500/[0.05]">
          <summary className="cursor-pointer select-none list-none px-3 py-2 text-[12px] font-medium text-sky-100/80 transition hover:text-sky-100 [&::-webkit-details-marker]:hidden">
            💡 Automatizar estes leads via Google Tag Manager
          </summary>
          <p className="border-t border-sky-400/15 px-3 py-2.5 text-[12px] leading-relaxed text-sky-100/70">
            No GTM do site, cria os disparos como eventos GA4:{" "}
            <b>submit de formulário</b> → <code className="rounded bg-white/10 px-1">generate_lead</code>,
            {" "}links <code className="rounded bg-white/10 px-1">tel:</code> → <code className="rounded bg-white/10 px-1">click_to_call</code>,
            {" "}links <code className="rounded bg-white/10 px-1">mailto:</code> → <code className="rounded bg-white/10 px-1">click_to_email</code>,
            {" "}widget WhatsApp → <code className="rounded bg-white/10 px-1">whatsapp_click</code>.
            {" "}A partir daí o relatório puxa-os sozinho.{" "}
            <a
              href="https://support.google.com/tagmanager/answer/6106716"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-sky-300/50 underline-offset-2 hover:text-white"
            >
              Guia GTM
            </a>
          </p>
        </details>
      )}

      {/* 2 colunas quando o cartão está a toda a largura (ecrãs < xl, onde os
          painéis empilham); 1 coluna dentro do rail estreito de xl+. */}
      <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-1">
        {editable.map((c) => {
          const r = rows[c.key];
          const state: Mode =
            r.mode === "na"
              ? "na"
              : r.mode === "value" && r.value.trim() !== ""
                ? "value"
                : "pending";
          return (
            <div
              key={c.key}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition ${
                state === "pending"
                  ? "border-amber-400/20 bg-amber-500/[0.04]"
                  : state === "value"
                    ? "border-emerald-400/15 bg-white/[0.02]"
                    : "border-white/8 bg-white/[0.015]"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  state === "pending"
                    ? "bg-amber-400"
                    : state === "value"
                      ? "bg-emerald-400"
                      : "bg-white/25"
                }`}
                aria-hidden
              />
              <span
                className="min-w-0 flex-1 truncate text-[12px] text-white/70"
                title={c.label}
              >
                {c.label}
              </span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={r.mode === "na" ? "" : r.value}
                disabled={r.mode === "na"}
                onChange={(e) => setRow(c.key, { value: e.target.value, mode: "value" })}
                placeholder={r.mode === "na" ? "N/A" : "—"}
                className="w-20 rounded-md border border-white/12 bg-white/[0.04] px-2 py-1 text-right text-[12.5px] text-white/90 outline-none transition focus:border-[#783DF5]/50 focus:bg-white/[0.06] disabled:opacity-40"
              />
              <button
                type="button"
                onClick={() =>
                  setRow(c.key, r.mode === "na" ? { mode: "pending", value: "" } : { mode: "na", value: "" })
                }
                title="Marcar N/A"
                className={`rounded-md border p-1 transition ${
                  r.mode === "na"
                    ? "border-white/25 bg-white/10 text-white/85"
                    : "border-white/10 text-white/35 hover:border-white/20 hover:text-white/70"
                }`}
              >
                <Ban className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-[12px] font-medium text-white/60">
          Notas &amp; Próximos Passos
        </label>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={3}
          placeholder="Foco do próximo mês, pedidos ao cliente, contexto que os números não mostram…"
          className="w-full resize-y rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-white/85 outline-none transition focus:border-[#783DF5]/50 focus:bg-white/[0.06]"
        />
      </div>

      <div className="mt-3 flex items-center gap-3">
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
