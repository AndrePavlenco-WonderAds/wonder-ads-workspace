"use client";

// «Submeter para revisão» — o sítio fixo do consultor no plano de probation
// (v77.84). Submete o que vai fazendo, sem limite: o que é, um link e/ou um
// ficheiro, e o KPI a que se refere. Por baixo, tudo o que já submeteu,
// arrumado pela semana do check-in em que a direção o vai rever.
//
// Os ficheiros sobem direto do browser para o Blob (a mesma rota de token dos
// Client Files e do Pending Review) e só depois a submissão é gravada.

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import {
  ExternalLink,
  Inbox,
  Loader2,
  Lock,
  Paperclip,
  Send,
  Trash2,
  X,
} from "lucide-react";
import {
  SUBMISSION_LIM,
  linkHost,
  submissionStamp,
  type ProbationSubmission,
  type SubmissionFile,
  type SubmissionGroup,
} from "@/lib/probation/submissions";

/** Filtro de conveniência no seletor — a rota de upload tem a sua lista. */
const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip,image/*,video/*";

export type SubmissionsPanelHandle = { focus: () => void };

export const SubmissionsPanel = forwardRef<
  SubmissionsPanelHandle,
  {
    planId: string;
    /** Os nomes dos KPIs do documento enviado. */
    kpis: string[];
    lead: string;
    initial: SubmissionGroup[];
  }
>(function SubmissionsPanel({ planId, kpis, lead, initial }, ref) {
  const [groups, setGroups] = useState(initial);
  const [text, setText] = useState("");
  const [kpi, setKpi] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<SubmissionFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      textRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      textRef.current?.focus({ preventScroll: true });
    },
  }));

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  async function pickFile(f: File | undefined) {
    if (!f) return;
    setUploading(true);
    setError(null);
    try {
      const blob = await upload(`probation/${planId}/${f.name}`, f, {
        access: "public",
        handleUploadUrl: "/api/files/upload",
      });
      setFile({ url: blob.url, name: f.name });
    } catch {
      setError("O ficheiro não subiu — tenta outra vez.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit() {
    if (!text.trim() || busy || uploading) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/probation/submissoes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId, text, kpi, link, file }),
      });
      const data = (await res.json().catch(() => ({}))) as { groups?: SubmissionGroup[]; error?: string };
      if (!res.ok || !data.groups) {
        setError(data.error ?? "Não foi possível submeter.");
        return;
      }
      setGroups(data.groups);
      setText("");
      setLink("");
      setFile(null);
      setFlash("Submetido — a direção vê-o no próximo check-in.");
      setTimeout(() => setFlash(null), 4000);
    } catch {
      setError("Sem ligação — tenta outra vez.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(sub: ProbationSubmission): Promise<string | null> {
    try {
      const res = await fetch(
        `/api/probation/submissoes?plano=${encodeURIComponent(planId)}&id=${encodeURIComponent(sub.id)}`,
        { method: "DELETE" },
      );
      const data = (await res.json().catch(() => ({}))) as { groups?: SubmissionGroup[]; error?: string };
      if (!res.ok || !data.groups) return data.error ?? "Não foi possível tirar.";
      setGroups(data.groups);
      return null;
    } catch {
      return "Sem ligação — tenta outra vez.";
    }
  }

  const input =
    "w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:border-[#783DF5]/60 focus:outline-none disabled:opacity-60";

  return (
    <div className="space-y-8">
      {/* ------------------------------ compositor ------------------------------ */}
      <section className="rounded-2xl border border-[#783DF5]/30 bg-[#783DF5]/[0.06] p-5 sm:p-6">
        <h2 className="text-[16px] font-semibold text-white">Submeter para revisão</h2>
        <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-white/55">
          Vai submetendo o que fazes — documentos, links, notas — sem limite. Tudo o que submeteres numa semana
          aparece {lead ? "a " : "à "}
          <span className="font-semibold text-white/80">{lead || "direção"}</span> no check-in dessa semana, antes
          de dar o semáforo a cada KPI.
        </p>

        <label className="mt-4 block">
          <span className="readout mb-1.5 block text-white/45">O que é</span>
          <textarea
            ref={textRef}
            value={text}
            maxLength={SUBMISSION_LIM.text}
            disabled={busy}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
            }}
            placeholder="Ex.: Roadmap de conteúdo de novembro da Clínica X — 12 artigos planeados e aprovados pelo cliente"
            className={`${input} min-h-[84px] resize-y`}
          />
        </label>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block min-w-0">
            <span className="readout mb-1.5 block text-white/45">KPI</span>
            <select value={kpi} disabled={busy} onChange={(e) => setKpi(e.target.value)} className={`${input} [&>option]:bg-[#14151f]`}>
              <option value="">Geral — não é de um KPI só</option>
              {kpis.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0">
            <span className="readout mb-1.5 block text-white/45">Link (opcional)</span>
            <input
              type="url"
              inputMode="url"
              value={link}
              disabled={busy}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://docs.google.com/…"
              className={input}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {file ? (
            <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] py-1 pl-3 pr-1 text-[12.5px] text-white/85">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-white/50" />
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                aria-label="Tirar o ficheiro"
                onClick={() => setFile(null)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ) : (
            <button
              type="button"
              disabled={uploading || busy}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-[12.5px] font-medium text-white/80 transition hover:border-white/25 hover:text-white disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
              {uploading ? "A subir…" : "Anexar ficheiro"}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => void pickFile(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={!text.trim() || busy || uploading}
            onClick={() => void submit()}
            className="ml-auto inline-flex items-center gap-2 rounded-full px-5 py-2 text-[13px] font-semibold text-white shadow-[0_8px_22px_-8px_rgba(120,61,245,0.7)] transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: "var(--brand-gradient)" }}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Submeter
          </button>
        </div>
        {error && <p className="mt-2 text-[12px] text-rose-300">{error}</p>}
        {flash && <p className="mt-2 text-[12px] text-emerald-300">{flash}</p>}
      </section>

      {/* -------------------------------- lista -------------------------------- */}
      <section>
        <p className="readout text-white/40">
          O que já submeteste{total ? ` · ${total}` : ""}
        </p>
        {groups.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-white/12 px-6 py-10 text-center">
            <Inbox className="mx-auto h-6 w-6 text-white/25" />
            <p className="mt-3 text-[13px] text-white/50">Ainda não submeteste nada.</p>
          </div>
        ) : (
          <div className="mt-3 space-y-6">
            {groups.map((g) => (
              <div key={`${g.periodIndex}-${g.week}`}>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <h3 className="text-[13.5px] font-semibold text-white">{g.label}</h3>
                  {g.range && <span className="text-[12px] tabular-nums text-white/40">{g.range}</span>}
                  <span className="text-[12px] text-white/40">· {g.items.length}</span>
                  {g.locked && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10.5px] font-medium text-white/50">
                      <Lock className="h-3 w-3" />
                      Check-in feito · revisto
                    </span>
                  )}
                </div>
                <ul className="mt-2 space-y-2">
                  {g.items.map((s) => (
                    <SubmissionRow key={s.id} sub={s} locked={g.locked} onRemove={remove} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
});

function SubmissionRow({
  sub,
  locked,
  onRemove,
}: {
  sub: ProbationSubmission;
  locked: boolean;
  onRemove: (sub: ProbationSubmission) => Promise<string | null>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/40">
            <span className="tabular-nums">{submissionStamp(sub.at)}</span>
            {sub.kpi && (
              <span className="max-w-full truncate rounded-full bg-[#783DF5]/15 px-2 py-0.5 font-medium text-[#c9b8ff]">
                {sub.kpi}
              </span>
            )}
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-white/85">{sub.text}</p>
          {(sub.link || sub.file) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {sub.link && (
                <a
                  href={sub.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[11.5px] text-white/70 transition hover:border-white/25 hover:text-white"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="truncate">{linkHost(sub.link)}</span>
                </a>
              )}
              {sub.file && (
                <a
                  href={sub.file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[11.5px] text-white/70 transition hover:border-white/25 hover:text-white"
                >
                  <Paperclip className="h-3 w-3 shrink-0" />
                  <span className="truncate">{sub.file.name}</span>
                </a>
              )}
            </div>
          )}
          {error && <p className="mt-1.5 text-[12px] text-rose-300">{error}</p>}
        </div>
        {!locked &&
          (confirming ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  const err = await onRemove(sub);
                  // Sucesso: a linha desaparece com a lista nova.
                  if (err) {
                    setError(err);
                    setBusy(false);
                    setConfirming(false);
                  }
                }}
                className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2.5 py-1 text-[11.5px] font-semibold text-rose-200 transition hover:bg-rose-500/30 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Tirar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(false)}
                className="rounded-full px-2 py-1 text-[11.5px] text-white/50 hover:text-white/80"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              aria-label="Tirar esta submissão"
              title="Tirar"
              onClick={() => setConfirming(true)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/30 transition hover:bg-rose-500/10 hover:text-rose-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ))}
      </div>
    </li>
  );
}
