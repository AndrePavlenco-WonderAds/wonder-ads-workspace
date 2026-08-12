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
  /** Web designers, com a carga aberta de cada um — a atribuição é
   *  obrigatória e tem de ser informada (v76.52). */
  webDevs: {
    username: string;
    name: string;
    /** Retrato em `public/team/`. Sem foto, fica a inicial. */
    photo?: string;
    load: { label: string; count: number }[];
    total: number;
  }[];
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
  // ATRIBUIÇÃO OBRIGATÓRIA (v76.52) — arranca VAZIA de propósito. Um
  // pré-selecionado seria escolhido por omissão em metade dos tickets, e a
  // pessoa que menos aparece no topo da lista acabava com metade do
  // trabalho. Obrigar a escolher é o que torna a carga uma decisão.
  const [assignee, setAssignee] = useState<string>("");
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
    if (!assignee) {
      setError("Escolhe o web designer que fica com este ticket.");
      return;
    }
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
          assigneeUsername: assignee,
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

        {/* ATRIBUIÇÃO — cartas com a carga de cada web designer.
            Um dropdown escondia justamente a informação que torna a escolha
            boa: quem está com o quê. Aqui vê-se a fila de cada um antes de
            se decidir, que é a diferença entre atribuir e despachar. */}
        <div className="mt-5 border-t border-white/8 pt-4">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-white/55">
              Atribuir a <span className="text-rose-300">*</span>
            </span>
            <span className="text-[10.5px] text-white/40">
              O número em cada carta é o trabalho em aberto dessa pessoa.
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {webDevs.map((d) => {
              const on = assignee === d.username;
              return (
                <button
                  key={d.username}
                  type="button"
                  onClick={() => setAssignee(on ? "" : d.username)}
                  aria-pressed={on}
                  className={`group overflow-hidden rounded-xl border text-left transition ${
                    on
                      ? "border-[color:var(--brand-purple)]/70 bg-[color:var(--brand-purple)]/12 shadow-[0_10px_34px_-14px_rgba(120,61,245,.8)]"
                      : "border-white/12 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.06]"
                  }`}
                >
                  {/* BANNER. A cara da pessoa antes do nome: escolhe-se a
                      quem se atribui olhando para quem é, e uma inicial num
                      círculo não deixa ninguém fazer isso. O recorte corta a
                      faixa do logótipo que vem nos retratos do site. */}
                  <span className="relative block h-[104px] w-full overflow-hidden bg-white/[0.06]">
                    {d.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={d.photo}
                        alt=""
                        aria-hidden
                        className={`h-full w-full object-cover transition duration-300 ${
                          on ? "scale-[1.03]" : "grayscale-[.35] group-hover:grayscale-0"
                        }`}
                        style={{ objectPosition: "center 38%" }}
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-3xl font-bold text-white/45">
                        {d.name.trim().charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span
                      aria-hidden
                      className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/45 to-transparent"
                    />
                    <span className="absolute bottom-2 left-3 text-[17px] font-bold leading-none tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.7)]">
                      {d.name}
                    </span>
                    <span
                      className={`tabular absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10.5px] font-bold backdrop-blur-sm ${
                        d.total === 0
                          ? "bg-emerald-500/25 text-emerald-100"
                          : d.total >= 10
                            ? "bg-rose-500/30 text-rose-50"
                            : "bg-black/45 text-white/90"
                      }`}
                      title="Total em aberto"
                    >
                      {d.total}
                    </span>
                    {on && (
                      <span className="brand-gradient-bg absolute left-0 top-0 h-full w-1" />
                    )}
                  </span>
                  <dl className="space-y-0.5 px-3 py-2.5">
                    {d.load.map((l) => (
                      <div
                        key={l.label}
                        className="flex items-baseline justify-between gap-2 text-[10.5px]"
                      >
                        <dt className="text-white/45">{l.label}</dt>
                        <dd
                          className={`tabular font-semibold ${
                            l.count > 0 ? "text-white/85" : "text-white/25"
                          }`}
                        >
                          {l.count}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </button>
              );
            })}
          </div>
          {!assignee && (
            <p className="mt-2 text-[11px] text-amber-200/70">
              Escolhe o web designer que vai ficar com este ticket.
            </p>
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
            disabled={submitting || anyUploading || !title.trim() || !assignee}
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
