"use client";

// «Carregar proposta» — o botão que fecha o ciclo dos templates (v77.12).
//
// O consultor descarrega o template, trabalha-o na sessão dele com o
// Claude, e volta com um PDF. Aqui: (1) escolhe o tipo e larga o ficheiro
// — vai direto para o Blob a partir do browser; (2) o Claude lê o PDF e
// devolve o rascunho do cartão (cliente, título, período, investimento,
// resumo, quem assina); (3) o consultor revê e grava. O cartão aparece na
// lista e a proposta passa a ter página pública em /proposta/<slug>.

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { FileUp, Loader2, Sparkles, Upload, X } from "lucide-react";
import { ClientCombobox, type ClientOption } from "@/components/client-combobox";
import { KIND_LABEL, PROPOSAL_KINDS, type ProposalKind } from "@/lib/proposals";
import { toISODate } from "@/lib/dates";

type Signer = { username: string; name: string; role: string };

type Draft = {
  clientName: string;
  clientSlug: string | null;
  kind: ProposalKind;
  title: string;
  date: string;
  period: string;
  investment: string;
  /** Valor total em € sem IVA — o que o pódio pesa. */
  valueEur: number | null;
  summary: string;
  consultantUsername: string | null;
  consultantName: string | null;
  reference: string | null;
  validUntil: string | null;
};

type Step = "file" | "reading" | "review" | "saving";

const MAX_BYTES = 25 * 1024 * 1024;

export function ProposalUploadButton({
  clients,
  signers,
  defaultSigner,
}: {
  clients: ClientOption[];
  signers: Signer[];
  defaultSigner: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("file");
  const [kind, setKind] = useState<ProposalKind>("renovacao");
  const [file, setFile] = useState<{ url: string; name: string; size: number; type: string; pages: number | null } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && step !== "reading" && step !== "saving") close();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, step]);

  function close() {
    setOpen(false);
    setStep("file");
    setFile(null);
    setDraft(null);
    setError(null);
    setModelUsed(null);
  }

  async function handleFile(f: File | null) {
    if (!f) return;
    setError(null);
    const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
    if (!isPdf) {
      setError("Só aceitamos PDF — é o formato dos templates e o que o cliente recebe.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("O ficheiro tem mais de 25 MB. Exporta o PDF com as imagens comprimidas.");
      return;
    }
    setStep("reading");
    try {
      const stamp = toISODate().slice(0, 7);
      const blob = await upload(`proposals/${stamp}/${f.name}`, f, {
        access: "public",
        handleUploadUrl: "/api/files/upload",
      });
      const uploaded = { url: blob.url, name: f.name, size: f.size, type: f.type || "application/pdf", pages: null as number | null };
      setFile(uploaded);
      const res = await fetch("/api/commercial/proposals/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: blob.url, name: f.name, kind }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        draft?: Draft;
        model?: string;
        pages?: number | null;
      };
      if (!res.ok || !json.draft) throw new Error(json.error ?? `HTTP ${res.status}`);
      setFile({ ...uploaded, pages: json.pages ?? null });
      setModelUsed(json.model ?? null);
      setDraft({
        ...json.draft,
        kind: json.draft.kind ?? kind,
        valueEur: typeof json.draft.valueEur === "number" ? json.draft.valueEur : null,
        consultantUsername: json.draft.consultantUsername ?? defaultSigner,
      });
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "O upload falhou.");
      setStep("file");
    }
  }

  async function save() {
    if (!draft || !file) return;
    if (!draft.clientName.trim() || !draft.title.trim()) {
      setError("Cliente e título são obrigatórios.");
      return;
    }
    setStep("saving");
    setError(null);
    try {
      const res = await fetch("/api/commercial/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, file }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; slug?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      close();
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível gravar.");
      setStep("review");
    }
  }

  const field =
    "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:border-[#783DF5]/60 focus:outline-none focus:ring-2 focus:ring-[#783DF5]/30";
  const label = "mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40";

  const modal = open ? (
    <div className="fixed inset-0 z-[100] flex items-stretch justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Carregar proposta"
        className="animate-fade-up flex h-full w-full max-w-2xl flex-col overflow-hidden border border-white/10 bg-[#0a0a0f] shadow-2xl shadow-black/70 sm:h-auto sm:max-h-[90vh] sm:rounded-2xl"
      >
        <header className="flex items-center gap-3 border-b border-white/8 bg-black/40 px-5 py-4">
          <span className="brand-gradient-bg flex h-9 w-9 items-center justify-center rounded-lg shadow-[0_6px_24px_-4px_rgba(120,61,245,0.6)]">
            <FileUp className="h-4 w-4 text-white" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-white">Carregar proposta</h2>
            <p className="text-[11px] text-white/45">
              {step === "file" && "PDF feito a partir do template · o Claude lê e prepara o cartão"}
              {step === "reading" && "A carregar e a ler o PDF…"}
              {step === "review" && "Revê o que o Claude extraiu antes de gravar"}
              {step === "saving" && "A gravar…"}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={step === "reading" || step === "saving"}
            className="rounded-md p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {/* ---------------- passo 1: ficheiro ---------------- */}
          {(step === "file" || step === "reading") && (
            <div className="space-y-5">
              <div>
                <p className={label}>Tipo de proposta</p>
                <div className="grid grid-cols-2 gap-2">
                  {PROPOSAL_KINDS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      disabled={step === "reading"}
                      onClick={() => setKind(k)}
                      className={`rounded-xl border px-3 py-3 text-left transition ${
                        kind === k
                          ? "border-[#783DF5]/70 bg-[#783DF5]/15 text-white"
                          : "border-white/10 bg-white/[0.03] text-white/65 hover:border-white/25 hover:text-white"
                      }`}
                    >
                      <p className="text-[13px] font-semibold">{KIND_LABEL[k]}</p>
                      <p className="mt-0.5 text-[11px] text-white/45">
                        {k === "renovacao" ? "Renovar um contrato que já existe" : "Serviço novo a um cliente atual"}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  if (step === "file") setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  if (step === "file") void handleFile(e.dataTransfer.files?.[0] ?? null);
                }}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
                  dragging ? "border-[#783DF5] bg-[#783DF5]/10" : "border-white/15 bg-white/[0.02]"
                }`}
              >
                {step === "reading" ? (
                  <>
                    <Loader2 className="h-7 w-7 animate-spin text-[#a78bfa]" />
                    <p className="mt-3 text-[13px] font-medium text-white">
                      {file ? "O Claude está a ler a proposta…" : "A enviar o ficheiro…"}
                    </p>
                    <p className="mt-1 text-[11px] text-white/45">Normalmente demora menos de um minuto.</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-7 w-7 text-white/40" />
                    <p className="mt-3 text-[13px] font-medium text-white">Larga aqui o PDF da proposta</p>
                    <p className="mt-1 text-[11px] text-white/45">ou</p>
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      className="mt-2 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/10"
                    >
                      Escolher ficheiro
                    </button>
                    <input
                      ref={inputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
                    />
                    <p className="mt-3 text-[11px] text-white/35">PDF · até 25 MB</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ---------------- passo 2: rever ---------------- */}
          {(step === "review" || step === "saving") && draft && file && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-[12px] text-emerald-100">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 truncate">
                  <strong className="font-semibold">{file.name}</strong>
                  {file.pages ? ` · ${file.pages} página${file.pages === 1 ? "" : "s"}` : ""} lido
                  {modelUsed ? ` por ${modelUsed}` : ""} — confirma os campos e grava.
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={label} htmlFor="pu-client">Cliente</label>
                  <ClientCombobox
                    id="pu-client"
                    value={draft.clientName}
                    options={clients}
                    onChange={(name) => setDraft({ ...draft, clientName: name })}
                    onPick={(opt) => setDraft((d) => (d ? { ...d, clientSlug: opt?.slug ?? null, clientName: opt?.name ?? d.clientName } : d))}
                    placeholder="ex.: Fisio Restelo"
                    inputClassName={field}
                  />
                  <p className="mt-1 text-[11px] text-white/35">
                    {draft.clientSlug ? `Ligada à ficha /seo/${draft.clientSlug}` : "Sem ficha no workspace — fica só o nome."}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <label className={label} htmlFor="pu-title">Título</label>
                  <input id="pu-title" className={field} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                </div>
                <div>
                  <label className={label} htmlFor="pu-kind">Tipo</label>
                  <select id="pu-kind" className={field} value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as ProposalKind })}>
                    {PROPOSAL_KINDS.map((k) => (
                      <option key={k} value={k} className="bg-[#0a0a0f]">{KIND_LABEL[k]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label} htmlFor="pu-date">Data da proposta</label>
                  <input id="pu-date" type="date" className={field} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
                </div>
                <div>
                  <label className={label} htmlFor="pu-period">Período</label>
                  <input id="pu-period" className={field} value={draft.period} onChange={(e) => setDraft({ ...draft, period: e.target.value })} placeholder="ex.: Setembro 2026 – Fevereiro 2027" />
                </div>
                <div>
                  <label className={label} htmlFor="pu-investment">Investimento</label>
                  <input id="pu-investment" className={field} value={draft.investment} onChange={(e) => setDraft({ ...draft, investment: e.target.value })} placeholder="ex.: 700 € + IVA" />
                </div>
                <div className="sm:col-span-2">
                  <label className={label} htmlFor="pu-value">Valor total (€, sem IVA)</label>
                  <input
                    id="pu-value"
                    type="number"
                    min={0}
                    step={1}
                    inputMode="decimal"
                    className={field}
                    value={draft.valueEur ?? ""}
                    onChange={(e) => setDraft({ ...draft, valueEur: e.target.value === "" ? null : Number(e.target.value) })}
                    placeholder="ex.: 36000"
                  />
                  <p className="mt-1 text-[11px] text-white/35">
                    É o que o pódio do Comercial pesa: avença mensal × meses do período, ou o preço único do serviço.
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <label className={label} htmlFor="pu-summary">Resumo (uma frase)</label>
                  <textarea id="pu-summary" rows={2} className={field} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <label className={label} htmlFor="pu-signer">Consultor que assina</label>
                  <select
                    id="pu-signer"
                    className={field}
                    value={draft.consultantUsername ?? ""}
                    onChange={(e) => setDraft({ ...draft, consultantUsername: e.target.value || null })}
                  >
                    <option value="" className="bg-[#0a0a0f]">— sem consultor —</option>
                    {signers.map((s) => (
                      <option key={s.username} value={s.username} className="bg-[#0a0a0f]">
                        {s.name} · {s.role}
                      </option>
                    ))}
                  </select>
                  {draft.clientSlug && (
                    <p className="mt-1 text-[11px] text-white/35">
                      Com ficha de cliente ligada, o cartão mostra o Head Consultant da ficha; este campo é a rede para prospects.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && <p className="mt-4 rounded-lg border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-[12px] text-rose-200">{error}</p>}
        </div>

        {(step === "review" || step === "saving") && (
          <footer className="flex items-center justify-between gap-3 border-t border-white/8 bg-black/40 px-5 py-3">
            <button
              type="button"
              disabled={step === "saving"}
              onClick={() => {
                setStep("file");
                setDraft(null);
                setFile(null);
                setError(null);
              }}
              className="text-[12px] text-white/50 transition hover:text-white disabled:opacity-50"
            >
              Trocar ficheiro
            </button>
            <button
              type="button"
              disabled={step === "saving"}
              onClick={() => void save()}
              className="inline-flex items-center gap-2 rounded-md bg-gradient-to-br from-[#343ED7] via-[#783DF5] to-[#C535C9] px-4 py-2 text-[12px] font-semibold text-white shadow-sm shadow-[#783DF5]/30 transition hover:brightness-110 disabled:opacity-60"
            >
              {step === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
              {step === "saving" ? "A gravar…" : "Adicionar ao Comercial"}
            </button>
          </footer>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-gradient-to-br from-[#343ED7] via-[#783DF5] to-[#C535C9] px-3.5 py-2 text-[12px] font-semibold text-white shadow-lg shadow-[#783DF5]/25 transition hover:brightness-110"
      >
        <FileUp className="h-4 w-4" />
        Carregar proposta
      </button>
      {typeof document !== "undefined" && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
