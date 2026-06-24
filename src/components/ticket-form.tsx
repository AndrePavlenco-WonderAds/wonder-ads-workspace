"use client";

// Create-ticket form. Available to ANY logged-in employee from the home
// page (/web/tickets/new) — no Web-dept access required. Uploads
// attachments straight to Vercel Blob (same client-upload pattern as the
// roadmap board), then POSTs the ticket. On success, redirects to the
// new ticket's detail page.

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import {
  CheckCircle2,
  Loader2,
  Paperclip,
  Send,
  UserPlus,
  X,
} from "lucide-react";
import {
  REQUESTING_DEPTS,
  REQUESTING_DEPT_LABEL,
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABEL,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_META,
  type RequestingDept,
  type TicketCategory,
  type TicketPriority,
} from "@/lib/web-tickets-shared";
import { ClientCombobox, type ClientOption } from "@/components/client-combobox";

const MAX_FILES = 10;

type Upl = {
  id: string;
  name: string;
  url: string;
  kind: "image" | "video" | "document" | "link";
  previewUrl: string;
  uploading: boolean;
  error?: string;
};

function kindFromType(type: string): Upl["kind"] {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  return "document";
}

export function TicketForm({
  authorName,
  defaultDept,
  webDevs,
  clients,
}: {
  authorName: string;
  /** Pre-select the requesting dept from the author's home department. */
  defaultDept: RequestingDept;
  /** Web designers a ticket can be force-assigned to on creation. */
  webDevs: { username: string; name: string }[];
  /** Known clients (registry + project-derived) for the combobox. */
  clients: ClientOption[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [accesses, setAccesses] = useState("");
  const [project, setProject] = useState("");
  const [clientSlug, setClientSlug] = useState("");
  const [category, setCategory] = useState<TicketCategory>("improvement");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [requestingDept, setRequestingDept] =
    useState<RequestingDept>(defaultDept);
  const [forceAssign, setForceAssign] = useState(false);
  const [assignee, setAssignee] = useState<string>(webDevs[0]?.username ?? "");
  const [files, setFiles] = useState<Upl[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const addFiles = useCallback(
    async (list: FileList | null) => {
      if (!list || list.length === 0) return;
      const slots = Math.max(0, MAX_FILES - files.length);
      const picked = Array.from(list).slice(0, slots);
      const initial: Upl[] = picked.map((f) => ({
        id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        name: f.name,
        url: "",
        kind: kindFromType(f.type),
        previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : "",
        uploading: true,
      }));
      setFiles((p) => [...p, ...initial]);
      await Promise.all(
        picked.map(async (file, i) => {
          const id = initial[i].id;
          try {
            const blob = await upload(file.name, file, {
              access: "public",
              handleUploadUrl: "/api/files/upload",
            });
            setFiles((p) =>
              p.map((x) =>
                x.id === id ? { ...x, url: blob.url, uploading: false } : x,
              ),
            );
          } catch (err) {
            setFiles((p) =>
              p.map((x) =>
                x.id === id
                  ? {
                      ...x,
                      uploading: false,
                      error: err instanceof Error ? err.message : "Falhou",
                    }
                  : x,
              ),
            );
          }
        }),
      );
    },
    [files.length],
  );

  const removeFile = useCallback((id: string) => {
    setFiles((p) => p.filter((x) => x.id !== id));
  }, []);

  const submit = useCallback(async () => {
    if (!title.trim()) {
      setError("O título é obrigatório.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const attachments = files
        .filter((f) => f.url && !f.uploading && !f.error)
        .map((f) => ({ name: f.name, url: f.url, kind: f.kind }));
      const res = await fetch("/api/web/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          accesses: accesses.trim(),
          project: project.trim(),
          clientSlug,
          category,
          priority,
          requestingDept,
          attachments,
          assigneeUsername: forceAssign ? assignee : null,
        }),
      });
      const data = (await res.json()) as {
        ticket?: { id: string; seq: number };
        error?: string;
      };
      if (!res.ok || !data.ticket) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      // Simple success confirmation, then back to the home page where the
      // user picks which department to enter.
      window.alert(
        `✅ Ticket #${data.ticket.seq} criado com sucesso! A equipa de Web foi notificada.`,
      );
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }, [
    title,
    description,
    accesses,
    project,
    clientSlug,
    category,
    priority,
    requestingDept,
    forceAssign,
    assignee,
    files,
    router,
  ]);

  const anyUploading = files.some((f) => f.uploading);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="brand-gradient-border rounded-2xl bg-white/[0.03] p-5 backdrop-blur-md sm:p-6">
        <label className="block text-xs">
          <span className="text-[11px] font-medium uppercase tracking-[0.13em] text-white/55">
            Título *
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Resumo curto do pedido"
            className="mt-1.5 w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
          />
        </label>

        <label className="mt-4 block text-xs">
          <span className="text-[11px] font-medium uppercase tracking-[0.13em] text-white/55">
            Descrição detalhada
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="O que é preciso? Contexto, links, passos para reproduzir (se for um bug)…"
            className="mt-1.5 w-full resize-y rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
          />
        </label>

        {/* Acessos — small field for the requester to paste any access
            (logins, URLs, painel, FTP…) the Web team will need. */}
        <label className="mt-4 block text-xs">
          <span className="text-[11px] font-medium uppercase tracking-[0.13em] text-white/55">
            Acessos (opcional)
          </span>
          <textarea
            value={accesses}
            onChange={(e) => setAccesses(e.target.value)}
            rows={2}
            placeholder="Logins, URLs do painel/WordPress, FTP… o que a equipa precisa para avançar."
            className="mt-1.5 w-full resize-y rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
          />
        </label>

        {/* Projeto / Cliente */}
        <label className="mt-4 block text-xs">
          <span className="text-[11px] font-medium uppercase tracking-[0.13em] text-white/55">
            Projeto / Cliente
          </span>
          <div className="mt-1.5">
            <ClientCombobox
              options={clients}
              value={project}
              onChange={(v) => {
                setProject(v);
                setClientSlug("");
              }}
              onPick={(opt) => setClientSlug(opt ? opt.slug : "")}
              placeholder="ex.: WonderAds"
            />
          </div>
        </label>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Categoria">
            <Select
              value={category}
              onChange={(v) => setCategory(v as TicketCategory)}
              options={TICKET_CATEGORIES.map((c) => ({
                value: c,
                label: TICKET_CATEGORY_LABEL[c],
              }))}
            />
          </Field>
          <Field label="Prioridade">
            <Select
              value={priority}
              onChange={(v) => setPriority(v as TicketPriority)}
              options={TICKET_PRIORITIES.map((p) => ({
                value: p,
                label: `${TICKET_PRIORITY_META[p].emoji} ${TICKET_PRIORITY_META[p].label}`,
              }))}
            />
          </Field>
          <Field label="Departamento requerente">
            <Select
              value={requestingDept}
              onChange={(v) => setRequestingDept(v as RequestingDept)}
              options={REQUESTING_DEPTS.map((d) => ({
                value: d,
                label: REQUESTING_DEPT_LABEL[d],
              }))}
            />
          </Field>
        </div>

        {/* Attachments */}
        <div className="mt-4">
          <span className="text-[11px] font-medium uppercase tracking-[0.13em] text-white/55">
            Anexos (até {MAX_FILES})
          </span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {files.map((f) => (
              <div
                key={f.id}
                className="group relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]"
                title={f.name}
              >
                {f.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={f.previewUrl}
                    alt={f.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Paperclip className="h-5 w-5 text-white/45" />
                )}
                {f.uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/55">
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  </div>
                )}
                {f.error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-rose-900/70 px-1 text-center text-[8px] text-rose-100">
                    {f.error.slice(0, 30)}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeFile(f.id)}
                  aria-label="Remover"
                  className="absolute right-0.5 top-0.5 hidden rounded-full border border-white/20 bg-black/60 p-0.5 text-white/80 group-hover:block"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {files.length < MAX_FILES && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/15 bg-white/[0.02] text-[10px] text-white/55 transition hover:border-white/35 hover:text-white"
              >
                <Paperclip className="h-4 w-4" />
                Anexar
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {/* Forçar atribuição — optional. Off by default (tickets land
            unassigned in the Web board's Not Started column); turn on to
            pin the ticket to a specific web dev on creation. */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setForceAssign((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-medium transition ${
              forceAssign
                ? "border-[color:var(--brand-purple)]/60 bg-[color:var(--brand-purple)]/15 text-white"
                : "border-white/15 bg-white/[0.04] text-white/80 hover:border-white/30 hover:text-white"
            }`}
          >
            <UserPlus className="h-4 w-4" />
            Forçar atribuição
          </button>
          {forceAssign && (
            <div className="mt-2 max-w-xs">
              <Select
                value={assignee}
                onChange={setAssignee}
                options={webDevs.map((d) => ({
                  value: d.username,
                  label: d.name,
                }))}
              />
              <p className="mt-1 text-[10.5px] text-white/40">
                O ticket é atribuído já a este web dev.
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center gap-3 border-t border-white/8 pt-4">
          <span className="flex items-center gap-1.5 text-[11px] text-white/45">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/70" />
            Criado por <span className="text-white/70">{authorName}</span> · data
            automática
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || anyUploading || !title.trim()}
            className="ml-auto inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#783DF5]/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background:
                "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)",
            }}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {submitting
              ? "A criar…"
              : anyUploading
                ? "A carregar anexos…"
                : "Criar ticket"}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs">
      <span className="text-[11px] font-medium uppercase tracking-[0.13em] text-white/55">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 pr-8 text-sm text-white outline-none focus:border-white/30"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#14141b] text-white">
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/45">
        ▾
      </span>
    </div>
  );
}
