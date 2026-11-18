"use client";

// Reuniões e notas da Ficha do prospect (v80.0) — a linha do tempo do que o
// Comercial falou com o cliente: discovery call, reunião introdutória,
// proposta, fecho… Cada entrada leva texto, o link opcional da gravação e
// anexos (atas, prints, PDFs da proposta).

import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  CirclePlay,
  MessagesSquare,
  NotebookPen,
  Plus,
  Sparkles,
} from "lucide-react";
import {
  LIMITS,
  NOTE_TYPES,
  NOTE_TYPE_COLOR,
  NOTE_TYPE_LABEL,
  callProvider,
  cleanUrl,
  type NoteType,
  type ProspectAttachment,
  type ProspectNote,
} from "@/lib/prospects/shared";
import { formatDate } from "@/lib/dates";
import {
  AutoTextarea,
  Avatar,
  Card,
  DeleteButton,
  EditButton,
  GhostButton,
  KeyHint,
  PrimaryButton,
  RichText,
  SectionHead,
  inputClass,
  personOf,
  relTime,
  useDirtyFlag,
  useProspect,
} from "./ui";
import { AttachmentTile, DropZone, UploadQueue, useProspectUploads } from "./uploads";

/** Guião para quem regista uma reunião — só cabeçalhos, nada inventado. */
const NOTE_TEMPLATE = [
  "Contexto:",
  "",
  "O que procuram:",
  "- ",
  "",
  "Dores e objeções:",
  "- ",
  "",
  "Decisores e prazos:",
  "",
  "Próximos passos:",
  "- ",
].join("\n");

function todayLisbon(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type Draft = {
  id?: string;
  type: NoteType;
  date: string;
  title: string;
  body: string;
  callUrl: string;
  attachments: ProspectAttachment[];
};

function Composer({
  initial,
  onDone,
}: {
  initial: Draft;
  onDone: () => void;
}) {
  const { send, slug } = useProspect();
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const uploads = useProspectUploads(slug, LIMITS.attachmentsPerNote - initial.attachments.length);
  const urlOk = !d.callUrl.trim() || Boolean(cleanUrl(d.callUrl));
  const hasContent =
    d.body.trim() !== "" || d.title.trim() !== "" || d.attachments.length + uploads.done.length > 0 || Boolean(cleanUrl(d.callUrl));
  const dirty =
    d.body !== initial.body ||
    d.title !== initial.title ||
    d.callUrl !== initial.callUrl ||
    d.type !== initial.type ||
    d.date !== initial.date ||
    d.attachments.length !== initial.attachments.length ||
    uploads.items.length > 0;
  useDirtyFlag(`note:${initial.id ?? "new"}`, dirty);

  async function save() {
    if (!hasContent || !urlOk || uploads.uploading) return;
    setBusy(true);
    const ok = await send({
      op: "note.save",
      note: {
        id: d.id,
        type: d.type,
        date: d.date,
        title: d.title.trim(),
        body: d.body,
        callUrl: d.callUrl.trim() || null,
        attachments: [...d.attachments, ...(uploads.done as ProspectAttachment[])],
      },
    });
    setBusy(false);
    if (ok) {
      uploads.reset();
      onDone();
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="rounded-2xl border border-[#783DF5]/35 bg-[linear-gradient(160deg,rgba(120,61,245,0.10),rgba(11,11,18,0.4))] p-4"
    >
      {/* Tipo */}
      <div className="flex flex-wrap gap-1.5">
        {NOTE_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={d.type === t}
            onClick={() => setD({ ...d, type: t })}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition ${
              d.type === t ? "border-white/25 bg-white/[0.09] text-white" : "border-white/10 text-white/45 hover:text-white/85"
            }`}
          >
            <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: NOTE_TYPE_COLOR[t] }} />
            {NOTE_TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)]">
        <label className="relative block">
          <span className="sr-only">Data</span>
          <input
            type="date"
            value={d.date}
            max={todayLisbon()}
            onChange={(e) => setD({ ...d, date: e.target.value })}
            className={`${inputClass} [color-scheme:dark]`}
          />
        </label>
        <input
          value={d.title}
          onChange={(e) => setD({ ...d, title: e.target.value.slice(0, LIMITS.short) })}
          placeholder="Título (opcional) — ex.: Primeira call com a diretora clínica"
          aria-label="Título"
          className={inputClass}
        />
      </div>

      <div className="mt-2">
        <AutoTextarea
          value={d.body}
          onChange={(v) => setD({ ...d, body: v.slice(0, LIMITS.noteBody) })}
          placeholder="O que se falou: o que o cliente procura, dúvidas, objeções, quem decide, próximos passos…"
          minRows={6}
          autoFocus={!initial.id}
          onSubmit={save}
          onCancel={onDone}
          ariaLabel="Notas da reunião"
        />
        {!d.body.trim() && (
          <button
            type="button"
            onClick={() => setD({ ...d, body: NOTE_TEMPLATE })}
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-violet-200/70 transition hover:text-white"
          >
            <Sparkles className="h-3 w-3" />
            Usar guião (contexto, o que procuram, objeções, decisores, próximos passos)
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <CirclePlay className="h-4 w-4 shrink-0 text-white/35" />
        <input
          value={d.callUrl}
          onChange={(e) => setD({ ...d, callUrl: e.target.value })}
          placeholder="Link da gravação da call (opcional) — Fathom, Meet, Zoom…"
          aria-label="Link da call"
          className={`${inputClass} ${urlOk ? "" : "border-rose-400/60"}`}
        />
      </div>
      {!urlOk && <p className="mt-1 pl-6 text-[11px] text-rose-200">Link inválido — tem de ser um endereço web.</p>}

      {/* Anexos */}
      <div className="mt-3">
        {d.attachments.length > 0 && (
          <div className="mb-2 grid gap-1.5 sm:grid-cols-2">
            {d.attachments.map((a) => (
              <AttachmentTile
                key={a.id}
                a={a}
                right={
                  <GhostButton
                    tone="danger"
                    onClick={() => setD({ ...d, attachments: d.attachments.filter((x) => x.id !== a.id) })}
                    title="Tirar da nota"
                  >
                    ✕
                  </GhostButton>
                }
              />
            ))}
          </div>
        )}
        <DropZone
          compact
          onFiles={uploads.add}
          disabled={d.attachments.length + uploads.items.length >= LIMITS.attachmentsPerNote}
          label="Anexar ficheiros (ata, prints, proposta em PDF…) — arrasta para aqui"
        />
        <UploadQueue items={uploads.items} onRemove={uploads.remove} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <KeyHint />
        <GhostButton onClick={onDone}>Cancelar</GhostButton>
        <PrimaryButton type="submit" busy={busy} disabled={!hasContent || !urlOk || uploads.uploading || (!dirty && Boolean(initial.id))}>
          {uploads.uploading ? "A enviar anexos…" : initial.id ? "Guardar alterações" : "Guardar nota"}
        </PrimaryButton>
      </div>
    </form>
  );
}

const LONG_NOTE = 900;

function NoteItem({ n, last }: { n: ProspectNote; last: boolean }) {
  const { viewer, people, send, now } = useProspect();
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const author = personOf(people, n.author);
  const color = NOTE_TYPE_COLOR[n.type];
  const mine = viewer.canWrite && (viewer.isAdmin || viewer.username === n.author);
  const long = n.body.length > LONG_NOTE;

  return (
    <li className="relative pl-8">
      {/* A linha e o ponto da linha do tempo. */}
      {!last && <span aria-hidden className="absolute left-[11px] top-7 bottom-[-18px] w-px bg-white/[0.08]" />}
      <span
        aria-hidden
        className="absolute left-0 top-1 flex h-[23px] w-[23px] items-center justify-center rounded-full border"
        style={{ borderColor: `${color}66`, background: `${color}1A`, boxShadow: `0 0 14px -4px ${color}` }}
      >
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      </span>

      {editing ? (
        <Composer
          initial={{
            id: n.id,
            type: n.type,
            date: n.date,
            title: n.title,
            body: n.body,
            callUrl: n.callUrl ?? "",
            attachments: n.attachments,
          }}
          onDone={() => setEditing(false)}
        />
      ) : (
        <article className="group/note rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 transition hover:border-white/15">
          <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className="rounded-full border px-2 py-px text-[10.5px] font-semibold uppercase tracking-[0.08em]"
              style={{ color, borderColor: `${color}55`, background: `${color}14` }}
            >
              {NOTE_TYPE_LABEL[n.type]}
            </span>
            {n.date && (
              <span className="inline-flex items-center gap-1 text-[11.5px] text-white/50">
                <CalendarDays className="h-3 w-3" />
                {formatDate(`${n.date}T12:00:00`)}
              </span>
            )}
            <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-white/40">
              <Avatar person={author} size={18} />
              {author.name}
              <span className="text-white/25">· {relTime(n.createdAt, now)}</span>
              {n.updatedAt && <span className="text-white/25">· editada</span>}
            </span>
          </header>
          {n.title && <h3 className="mt-2 text-[14.5px] font-semibold tracking-tight text-white">{n.title}</h3>}
          {n.body.trim() && (
            <div className="relative mt-2">
              <div className={long && !expanded ? "max-h-[16rem] overflow-hidden" : ""}>
                <RichText text={n.body} />
              </div>
              {long && !expanded && (
                <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0d0d15] to-transparent" />
              )}
              {long && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-medium text-violet-200/80 hover:text-white"
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition ${expanded ? "rotate-180" : ""}`} />
                  {expanded ? "Ler menos" : "Ler tudo"}
                </button>
              )}
            </div>
          )}
          {(n.callUrl || n.attachments.length > 0) && (
            <div className="mt-3 space-y-2">
              {n.callUrl && (
                <a
                  href={n.callUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-sky-400/30 bg-sky-500/[0.08] px-3 py-1.5 text-[12px] font-medium text-sky-100 transition hover:border-sky-300/50 hover:bg-sky-500/[0.14]"
                >
                  <CirclePlay className="h-4 w-4" />
                  Ver gravação · {callProvider(n.callUrl)}
                </a>
              )}
              {n.attachments.length > 0 && (
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {n.attachments.map((a) => (
                    <AttachmentTile key={a.id} a={a} />
                  ))}
                </div>
              )}
            </div>
          )}
          {mine && (
            <div className="mt-2 flex justify-end opacity-100 transition sm:opacity-0 sm:group-hover/note:opacity-100 sm:group-focus-within/note:opacity-100">
              <EditButton onClick={() => setEditing(true)} />
              <DeleteButton onConfirm={() => send({ op: "note.delete", id: n.id })} label="Apagar nota" />
            </div>
          )}
        </article>
      )}
    </li>
  );
}

export function TimelineCard() {
  const { file, viewer } = useProspect();
  const [composing, setComposing] = useState(false);
  const [filter, setFilter] = useState<NoteType | "all">("all");

  // Mais recentes primeiro, pela data da reunião (e pela hora do registo).
  const notes = useMemo(
    () =>
      [...file.notes].sort(
        (a, b) => (b.date || "").localeCompare(a.date || "") || b.createdAt - a.createdAt,
      ),
    [file.notes],
  );
  const counts = useMemo(() => {
    const c = new Map<NoteType, number>();
    for (const n of file.notes) c.set(n.type, (c.get(n.type) ?? 0) + 1);
    return c;
  }, [file.notes]);
  const shown = filter === "all" ? notes : notes.filter((n) => n.type === filter);

  return (
    <Card id="reunioes">
      <SectionHead
        icon={MessagesSquare}
        title="Reuniões e notas"
        hint="Tudo o que o Comercial falou com o cliente, com gravações e anexos"
        right={
          viewer.canWrite && !composing ? (
            <PrimaryButton onClick={() => setComposing(true)}>
              <Plus className="h-3.5 w-3.5" />
              Registar
            </PrimaryButton>
          ) : null
        }
      />

      {composing && (
        <div className="mb-5">
          <Composer
            initial={{
              type: file.notes.length === 0 ? "discovery" : "followup",
              date: todayLisbon(),
              title: "",
              body: "",
              callUrl: "",
              attachments: [],
            }}
            onDone={() => setComposing(false)}
          />
        </div>
      )}

      {counts.size > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={`Todas · ${file.notes.length}`} />
          {NOTE_TYPES.filter((t) => counts.has(t)).map((t) => (
            <FilterChip
              key={t}
              active={filter === t}
              onClick={() => setFilter(t)}
              color={NOTE_TYPE_COLOR[t]}
              label={`${NOTE_TYPE_LABEL[t]} · ${counts.get(t)}`}
            />
          ))}
        </div>
      )}

      {notes.length === 0 && !composing ? (
        viewer.canWrite ? (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="group flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-white/12 px-6 py-8 text-center transition hover:border-[#783DF5]/45 hover:bg-[#783DF5]/[0.04]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-violet-200 transition group-hover:scale-105">
              <NotebookPen className="h-5 w-5" />
            </span>
            <span className="text-[13px] font-semibold text-white/80">Regista a primeira reunião</span>
            <span className="max-w-sm text-[12px] text-white/40">
              Discovery call, reunião introdutória, apresentação da proposta… com o link da gravação e os anexos.
            </span>
          </button>
        ) : (
          <p className="text-[12.5px] italic text-white/35">Ainda sem reuniões registadas.</p>
        )
      ) : (
        <ol className="space-y-[18px]">
          {shown.map((n, i) => (
            <NoteItem key={n.id} n={n} last={i === shown.length - 1} />
          ))}
        </ol>
      )}
    </Card>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
        active ? "border-white/25 bg-white/[0.09] text-white" : "border-white/10 text-white/45 hover:text-white/85"
      }`}
    >
      {color && <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
      {label}
    </button>
  );
}
