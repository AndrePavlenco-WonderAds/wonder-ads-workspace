"use client";

// Full-page pop-up opened by clicking a client name in the Clients
// table. Five tabs: Contactos, Email p/ Contabilidade, Email p/ Cliente,
// Notas, Faturas. Data is per-client (slug-only) and shared across the
// SEO/ADS rows — it's one company, one billing relationship.
//
// Everything edits into local state; one "Guardar" button persists the
// whole detail via PUT. Invoice uploads go straight to Vercel Blob and
// persist immediately so a file is never lost to an unsaved tab.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Loader2,
  Check,
  Plus,
  Trash2,
  Copy,
  Upload,
  FileText,
  ExternalLink,
  Users,
  Calculator,
  Mail,
  StickyNote,
  ReceiptText,
} from "lucide-react";
import { upload } from "@vercel/blob/client";
import type {
  AdminClientDetail,
  ClientContact,
  ClientInvoiceFile,
  EmailTemplate,
} from "@/lib/admin-client-detail-store";
import { formatDate } from "@/lib/dates";

type TabKey = "contacts" | "accounting" | "client" | "notes" | "invoices";

const TABS: Array<{ key: TabKey; label: string; Icon: typeof Users }> = [
  { key: "contacts", label: "Contactos", Icon: Users },
  { key: "accounting", label: "Email p/ Contabilidade", Icon: Calculator },
  { key: "client", label: "Email p/ Cliente", Icon: Mail },
  { key: "notes", label: "Notas", Icon: StickyNote },
  { key: "invoices", label: "Faturas", Icon: ReceiptText },
];

export function ClientDetailModal({
  slug,
  clientName,
  logo,
  onClose,
}: {
  slug: string;
  clientName: string;
  logo?: React.ReactNode;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<TabKey>("contacts");
  const [detail, setDetail] = useState<AdminClientDetail | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load on open.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/client-detail/${slug}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { detail: AdminClientDetail };
        if (cancelled) return;
        setDetail(json.detail);
        setSavedSnapshot(JSON.stringify(json.detail));
      } catch (err) {
        if (!cancelled)
          setLoadError(err instanceof Error ? err.message : "Load failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Escape closes (only when there are no unsaved changes — otherwise
  // it would silently drop edits).
  const dirty = detail !== null && JSON.stringify(detail) !== savedSnapshot;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !dirtyRef.current) onClose();
    }
    document.addEventListener("keydown", onKey);
    // Lock body scroll while the modal is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const persist = useCallback(
    async (next: AdminClientDetail) => {
      setState("saving");
      setErrorMsg(null);
      try {
        const res = await fetch(`/api/admin/client-detail/${slug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? `HTTP ${res.status}`);
        }
        const json = (await res.json()) as { detail: AdminClientDetail };
        setDetail(json.detail);
        setSavedSnapshot(JSON.stringify(json.detail));
        setState("saved");
        setTimeout(() => setState("idle"), 2500);
        return json.detail;
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Save failed");
        setState("error");
        setTimeout(() => setState("idle"), 4000);
        return null;
      }
    },
    [slug],
  );

  function patch(p: Partial<AdminClientDetail>) {
    setDetail((d) => (d ? { ...d, ...p } : d));
  }

  function requestClose() {
    if (dirty && !window.confirm("Tens alterações por guardar. Fechar mesmo assim?"))
      return;
    onClose();
  }

  const body = (
    <div className="fixed inset-0 z-[100] flex items-stretch justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        className="animate-fade-up flex h-full w-full max-w-5xl flex-col overflow-hidden border border-white/10 bg-[#0a0a0f] shadow-2xl shadow-black/70 sm:h-[88vh] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhe de ${clientName}`}
      >
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-white/8 bg-black/40 px-5 py-4">
          {logo && <div className="shrink-0">{logo}</div>}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold tracking-tight text-white">
              {clientName}
            </h2>
            <p className="text-[11px] text-white/40">
              Contactos, emails, notas e faturas — partilhado entre departamentos.
            </p>
          </div>
          <SaveButton
            state={state}
            dirty={dirty}
            onClick={() => detail && persist(detail)}
          />
          <button
            type="button"
            onClick={requestClose}
            aria-label="Fechar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:border-white/30 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Tabs */}
        <nav className="flex gap-1 overflow-x-auto border-b border-white/8 bg-black/20 px-3">
          {TABS.map(({ key, label, Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[12px] font-medium transition ${
                  active
                    ? "border-[#783DF5] text-white"
                    : "border-transparent text-white/45 hover:text-white/75"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loadError ? (
            <p className="text-[13px] text-rose-300">
              Não foi possível carregar: {loadError}
            </p>
          ) : !detail ? (
            <div className="flex h-40 items-center justify-center text-white/40">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : tab === "contacts" ? (
            <ContactsTab
              contacts={detail.contacts}
              onChange={(contacts) => patch({ contacts })}
            />
          ) : tab === "accounting" ? (
            <EmailTab
              template={detail.accountingEmail}
              hint="Pedido de emissão de fatura à contabilista."
              onChange={(accountingEmail) => patch({ accountingEmail })}
            />
          ) : tab === "client" ? (
            <EmailTab
              template={detail.clientEmail}
              hint="Pedido de pagamento da fatura ao cliente."
              onChange={(clientEmail) => patch({ clientEmail })}
            />
          ) : tab === "notes" ? (
            <NotesTab
              notes={detail.notes}
              onChange={(notes) => patch({ notes })}
            />
          ) : (
            <InvoicesTab
              invoices={detail.invoices}
              onPersist={(invoices) =>
                persist({ ...detail, invoices })
              }
            />
          )}
        </div>

        {errorMsg && (
          <div className="border-t border-rose-500/20 bg-rose-500/[0.06] px-5 py-2 text-[11px] text-rose-300">
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(body, document.body);
}

function SaveButton({
  state,
  dirty,
  onClick,
}: {
  state: "idle" | "saving" | "saved" | "error";
  dirty: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!dirty || state === "saving"}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
        state === "saved"
          ? "border border-emerald-400/45 bg-emerald-500/15 text-emerald-100"
          : state === "error"
            ? "border border-rose-400/45 bg-rose-500/15 text-rose-100"
            : dirty
              ? "brand-gradient-bg text-white shadow-[0_6px_22px_-4px_rgba(120,61,245,0.55)] hover:opacity-90"
              : "cursor-not-allowed border border-white/8 bg-white/[0.02] text-white/30"
      }`}
    >
      {state === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {state === "saved" && <Check className="h-3.5 w-3.5" />}
      {state === "saving"
        ? "A guardar"
        : state === "saved"
          ? "Guardado"
          : "Guardar"}
    </button>
  );
}

// ── Contactos ──────────────────────────────────────────────────────────
function ContactsTab({
  contacts,
  onChange,
}: {
  contacts: ClientContact[];
  onChange: (c: ClientContact[]) => void;
}) {
  function add() {
    onChange([
      ...contacts,
      { id: crypto.randomUUID(), name: "", role: "", email: "", phone: "" },
    ]);
  }
  function update(id: string, p: Partial<ClientContact>) {
    onChange(contacts.map((c) => (c.id === id ? { ...c, ...p } : c)));
  }
  function remove(id: string) {
    onChange(contacts.filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-white/45">
        Onde enviar faturas e quem contactar — emails e números do cliente.
      </p>
      {contacts.length === 0 && (
        <p className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-[12px] text-white/35">
          Sem contactos ainda.
        </p>
      )}
      <div className="space-y-3">
        {contacts.map((c) => (
          <div
            key={c.id}
            className="grid grid-cols-1 gap-2 rounded-xl border border-white/8 bg-white/[0.02] p-3 sm:grid-cols-[1fr_1fr_auto]"
          >
            <Field
              label="Nome"
              value={c.name}
              onChange={(v) => update(c.id, { name: v })}
            />
            <Field
              label="Função"
              value={c.role}
              placeholder="Financeiro, CEO…"
              onChange={(v) => update(c.id, { role: v })}
            />
            <button
              type="button"
              onClick={() => remove(c.id)}
              aria-label="Remover contacto"
              className="row-span-2 hidden items-center justify-center rounded-lg border border-white/10 px-2 text-white/40 transition hover:border-rose-400/50 hover:text-rose-300 sm:flex"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <Field
              label="Email"
              type="email"
              value={c.email}
              placeholder="faturas@cliente.pt"
              onChange={(v) => update(c.id, { email: v })}
            />
            <Field
              label="Telefone"
              value={c.phone}
              placeholder="+351 …"
              onChange={(v) => update(c.id, { phone: v })}
            />
            <button
              type="button"
              onClick={() => remove(c.id)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-2 py-2 text-[11px] text-white/50 transition hover:border-rose-400/50 hover:text-rose-300 sm:hidden"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remover
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-[12px] font-medium text-white/75 transition hover:border-white/35 hover:bg-white/[0.05]"
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar contacto
      </button>
    </div>
  );
}

// ── Email templates (Contabilidade / Cliente) ──────────────────────────
function EmailTab({
  template,
  hint,
  onChange,
}: {
  template: EmailTemplate;
  hint: string;
  onChange: (t: EmailTemplate) => void;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const text = `Assunto: ${template.subject}\n\n${template.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — no-op */
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] text-white/45">{hint}</p>
        <button
          type="button"
          onClick={copy}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition ${
            copied
              ? "border-emerald-400/45 bg-emerald-500/15 text-emerald-100"
              : "border-white/15 text-white/75 hover:border-white/35 hover:bg-white/[0.05]"
          }`}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copiado" : "Copiar email"}
        </button>
      </div>
      <label className="block">
        <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/45">
          Assunto
        </span>
        <input
          value={template.subject}
          onChange={(e) => onChange({ ...template, subject: e.target.value })}
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white outline-none transition focus:border-white/30"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/45">
          Corpo do email
        </span>
        <textarea
          value={template.body}
          onChange={(e) => onChange({ ...template, body: e.target.value })}
          rows={14}
          className="w-full resize-y rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] leading-relaxed text-white outline-none transition focus:border-white/30"
        />
      </label>
    </div>
  );
}

// ── Notas ──────────────────────────────────────────────────────────────
function NotesTab({
  notes,
  onChange,
}: {
  notes: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[12px] text-white/45">
        Notas livres sobre o cliente — particularidades de faturação,
        condições de pagamento, etc.
      </p>
      <textarea
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        rows={18}
        placeholder="Escreve aqui…"
        className="w-full resize-y rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13px] leading-relaxed text-white outline-none transition focus:border-white/30 placeholder:text-white/30"
      />
    </div>
  );
}

// ── Faturas ────────────────────────────────────────────────────────────
function InvoicesTab({
  invoices,
  onPersist,
}: {
  invoices: ClientInvoiceFile[];
  onPersist: (next: ClientInvoiceFile[]) => Promise<AdminClientDetail | null>;
}) {
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setError(null);
    const picked = Array.from(list);
    const added: ClientInvoiceFile[] = [];
    for (let i = 0; i < picked.length; i++) {
      const file = picked[i];
      try {
        setProgress(
          picked.length > 1
            ? `A carregar ${i + 1}/${picked.length}…`
            : `A carregar ${file.name}…`,
        );
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/files/upload",
        });
        added.push({
          id: crypto.randomUUID(),
          name: file.name,
          url: blob.url,
          addedAt: Date.now(),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : `Falhou: ${file.name}`);
      }
    }
    setProgress(null);
    if (added.length > 0) await onPersist([...added, ...invoices]);
  }

  async function remove(id: string) {
    await onPersist(invoices.filter((f) => f.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-white/45">
          Faturas anteriores — carrega PDFs ou imagens. Cada upload é
          guardado de imediato.
        </p>
        <div className="flex items-center gap-2">
          {progress && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-white/45">
              <Loader2 className="h-3 w-3 animate-spin" />
              {progress}
            </span>
          )}
          <button
            type="button"
            disabled={progress !== null}
            onClick={() => inputRef.current?.click()}
            className="brand-gradient-bg inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white shadow-[0_4px_18px_-4px_rgba(120,61,245,0.55)] transition hover:opacity-90 disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" /> Adicionar fatura
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      {error && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] text-rose-300">
          {error}
        </p>
      )}

      {invoices.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-[12px] text-white/35">
          Sem faturas guardadas.
        </p>
      ) : (
        <ul className="divide-y divide-white/8 overflow-hidden rounded-xl border border-white/8">
          {invoices.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 bg-white/[0.02] px-3 py-2.5"
            >
              <span className="brand-gradient-bg flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                <FileText className="h-4 w-4 text-white" strokeWidth={2.25} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] text-white/85" title={f.name}>
                  {f.name}
                </div>
                <div className="text-[10.5px] text-white/35">
                  {formatDate(f.addedAt)}
                </div>
              </div>
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-white/12 px-2.5 py-1.5 text-[11px] text-white/65 transition hover:border-white/30 hover:text-white"
              >
                Abrir <ExternalLink className="h-3 w-3" />
              </a>
              <button
                type="button"
                onClick={() => remove(f.id)}
                aria-label="Remover fatura"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/40 transition hover:border-rose-400/50 hover:text-rose-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── shared field ───────────────────────────────────────────────────────
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-[13px] text-white outline-none transition focus:border-white/30 placeholder:text-white/30"
      />
    </label>
  );
}
