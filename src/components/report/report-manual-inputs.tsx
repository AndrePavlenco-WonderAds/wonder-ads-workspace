"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { Loader2, Check, Ban, Pencil, Paperclip, FileText, X } from "lucide-react";
import {
  MAX_REPORT_ATTACHMENTS,
  type LeadChannel,
  type LeadChannelKey,
  type ReportAttachment,
} from "@/lib/report/report-types";

/** "1,2 MB" / "340 KB" — para o chip do anexo. */
function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

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
  attachments = [],
}: {
  slug: string;
  period: string;
  channels: LeadChannel[];
  notes: string;
  /** Prints e ficheiros já anexados às notas (v77.9). */
  attachments?: ReportAttachment[];
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
  // Anexos: sobem direto para o Blob e gravam-se LOGO no relatório, sem
  // esperar pelo «Guardar dados» — um ficheiro carregado não pode perder-se
  // por causa de um botão que não se clicou (o mesmo princípio das faturas).
  const [files, setFiles] = useState<ReportAttachment[]>(attachments);
  const [uploading, setUploading] = useState(false);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function persistFiles(list: ReportAttachment[]) {
    const res = await fetch(`/api/reports/${slug}/${period}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ notesAttachments: list }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setFiles(list);
    router.refresh();
  }

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const room = MAX_REPORT_ATTACHMENTS - files.length;
    if (room <= 0) {
      setFileErr(`Máximo de ${MAX_REPORT_ATTACHMENTS} anexos por relatório.`);
      return;
    }
    setUploading(true);
    setFileErr(null);
    try {
      const next = [...files];
      for (const file of Array.from(list).slice(0, room)) {
        const blob = await upload(
          `reports/${slug}/${period}/${file.name}`,
          file,
          { access: "public", handleUploadUrl: "/api/files/upload" },
        );
        next.push({
          url: blob.url,
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          addedAt: Date.now(),
        });
      }
      await persistFiles(next);
    } catch (e) {
      setFileErr(e instanceof Error ? e.message : "O upload falhou.");
    } finally {
      setUploading(false);
    }
  }

  async function removeFile(url: string) {
    setFileErr(null);
    try {
      await persistFiles(files.filter((f) => f.url !== url));
    } catch (e) {
      setFileErr(e instanceof Error ? e.message : "Não foi possível remover.");
    }
  }

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
        body: JSON.stringify({
          channels: channelsPayload,
          notes: noteText,
          notesAttachments: files,
        }),
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
        <p className="mb-1.5 text-[11.5px] leading-snug text-white/40">
          💡 Anexa aqui links para reports do Searchable e outros detalhes
          interessantes — os links ficam clicáveis no relatório. Prints e
          ficheiros entram em baixo e aparecem ao cliente na mesma secção.
        </p>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={4}
          placeholder="Foco do próximo mês, pedidos ao cliente, contexto que os números não mostram… e o link do report do Searchable."
          className="w-full resize-y rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-white/85 outline-none transition focus:border-[#783DF5]/50 focus:bg-white/[0.06]"
        />

        {/* Anexos — prints e ficheiros, gravados assim que sobem. */}
        <div className="mt-2">
          {files.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-2">
              {files.map((f) => (
                <li
                  key={f.url}
                  className="flex max-w-full items-center gap-2 rounded-lg border border-white/12 bg-white/[0.03] py-1 pl-1.5 pr-1"
                >
                  {f.type.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={f.url}
                      alt=""
                      className="h-8 w-11 shrink-0 rounded object-cover ring-1 ring-white/10"
                    />
                  ) : (
                    <FileText className="h-4 w-4 shrink-0 text-white/45" />
                  )}
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 max-w-[180px] truncate text-[12px] text-white/75 hover:text-white"
                    title={f.name}
                  >
                    {f.name}
                  </a>
                  <span className="shrink-0 text-[10.5px] text-white/30">{fmtSize(f.size)}</span>
                  <button
                    type="button"
                    onClick={() => void removeFile(f.url)}
                    title="Remover anexo"
                    aria-label={`Remover ${f.name}`}
                    className="shrink-0 rounded-md p-1 text-white/40 transition hover:bg-white/[0.06] hover:text-red-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,application/pdf,.csv,.xlsx,.docx,.pptx,.zip"
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || files.length >= MAX_REPORT_ATTACHMENTS}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-1.5 text-[12.5px] font-medium text-white/70 transition hover:border-[#783DF5]/50 hover:text-white disabled:opacity-40"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Paperclip className="h-3.5 w-3.5" />
              )}
              {uploading ? "A carregar…" : "Anexar print ou ficheiro"}
            </button>
            <span className="text-[11px] text-white/30">
              {files.length}/{MAX_REPORT_ATTACHMENTS}
            </span>
            {fileErr && <span className="text-[12px] text-rose-400">{fileErr}</span>}
          </div>
        </div>
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
