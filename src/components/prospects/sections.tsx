"use client";

// As secções de texto e listas da Ficha do prospect (v80.0): os blocos de
// texto (resumo, interesses, expectativas, cuidados, concorrência), as
// etiquetas, as prioridades, o perfil, os links das calls e a atividade.

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  ExternalLink,
  Globe,
  Handshake,
  History,
  Link2,
  MapPin,
  Megaphone,
  Plus,
  Tag,
  UserRound,
  BriefcaseBusiness,
  X,
  Video,
} from "lucide-react";
import {
  INTEREST_SUGGESTIONS,
  LEAD_SOURCE_SUGGESTIONS,
  LIMITS,
  PROFILE_FIELDS,
  PROFILE_LABEL,
  PROFILE_PLACEHOLDER,
  PROSPECT_TEXT_LABEL,
  callProvider,
  cleanUrl,
  newId,
  type ProfileField,
  type ProspectPriority,
  type ProspectProfile,
  type ProspectTextField,
} from "@/lib/prospects/shared";
import {
  AutoTextarea,
  Card,
  DeleteButton,
  EditButton,
  EmptyHint,
  GhostButton,
  KeyHint,
  PersonChip,
  PrimaryButton,
  RichText,
  SectionHead,
  inputClass,
  personOf,
  relTime,
  useDirtyFlag,
  useProspect,
} from "./ui";

// ── Bloco de texto ──────────────────────────────────────────────────────

export function TextBlock({
  field,
  placeholder,
  emptyCta,
  large = false,
  minRows = 4,
}: {
  field: ProspectTextField;
  placeholder: string;
  emptyCta: string;
  large?: boolean;
  minRows?: number;
}) {
  const { file, viewer, send } = useProspect();
  const value = file[field];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const dirty = editing && draft !== value;
  useDirtyFlag(`text:${field}`, dirty);

  function start() {
    setDraft(value);
    setEditing(true);
  }
  async function save() {
    setBusy(true);
    const ok = await send({ op: "text", field, value: draft });
    setBusy(false);
    if (ok) setEditing(false);
  }

  if (editing) {
    return (
      <div>
        <AutoTextarea
          value={draft}
          onChange={setDraft}
          placeholder={placeholder}
          minRows={minRows}
          autoFocus
          onSubmit={save}
          onCancel={() => setEditing(false)}
          ariaLabel={PROSPECT_TEXT_LABEL[field]}
          className={large ? "text-[14.5px]" : ""}
        />
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-2">
            <KeyHint />
            <GhostButton onClick={() => setEditing(false)}>Cancelar</GhostButton>
            <PrimaryButton onClick={save} busy={busy} disabled={!dirty}>
              Guardar
            </PrimaryButton>
          </div>
        </div>
      </div>
    );
  }

  if (!value.trim()) {
    return <EmptyHint onClick={viewer.canWrite ? start : undefined}>{emptyCta}</EmptyHint>;
  }

  const body = <RichText text={value} className={large ? "text-[15px] leading-[1.7] text-white/90" : ""} />;
  if (!viewer.canWrite) return body;

  // Quem escreve edita com um clique no próprio texto (fora dos links) —
  // sem botões «Editar» à vista em cada bloco.
  return (
    <div
      role="button"
      tabIndex={0}
      title="Clica para editar"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) return;
        start();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) {
          e.preventDefault();
          start();
        }
      }}
      className="-mx-2 cursor-text rounded-xl px-2 py-1 transition hover:bg-white/[0.035] focus-visible:bg-white/[0.05] focus-visible:outline-none"
    >
      {body}
    </div>
  );
}

// ── Etiquetas de interesse ──────────────────────────────────────────────

export function InterestTags() {
  const { file, viewer, send } = useProspect();
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const tags = file.interestTags;
  const lower = new Set(tags.map((t) => t.toLowerCase()));

  async function commit(next: string[]) {
    setBusy(true);
    await send({ op: "tags", tags: next });
    setBusy(false);
  }
  function toggle(t: string) {
    if (busy) return;
    const k = t.toLowerCase();
    void commit(lower.has(k) ? tags.filter((x) => x.toLowerCase() !== k) : [...tags, t]);
  }

  const suggestions = INTEREST_SUGGESTIONS.filter((s) => !lower.has(s.toLowerCase()));

  if (tags.length === 0 && !viewer.canWrite) return null;

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full border border-[#783DF5]/40 bg-[#783DF5]/[0.14] py-0.5 pl-2.5 pr-1 text-[12px] font-medium text-violet-100"
          >
            <Tag className="h-3 w-3 text-violet-300/80" />
            {t}
            {viewer.canWrite ? (
              <button
                type="button"
                onClick={() => toggle(t)}
                aria-label={`Tirar ${t}`}
                className="ml-0.5 rounded-full p-0.5 text-violet-200/60 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            ) : (
              <span className="w-1.5" />
            )}
          </span>
        ))}
        {viewer.canWrite && !picking && tags.length < LIMITS.tags && (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-white/15 px-2.5 py-0.5 text-[11.5px] text-white/45 transition hover:border-[#783DF5]/50 hover:text-white"
          >
            <Plus className="h-3 w-3" />
            Etiqueta
          </button>
        )}
      </div>
      {viewer.canWrite && picking && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-2">
          <button
            type="button"
            onClick={() => setPicking(false)}
            aria-label="Fechar sugestões"
            className="rounded-full p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy || tags.length >= LIMITS.tags}
              onClick={() => toggle(s)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-white/15 px-2.5 py-0.5 text-[11.5px] text-white/45 transition hover:border-[#783DF5]/50 hover:text-white disabled:opacity-40"
            >
              <Plus className="h-3 w-3" />
              {s}
            </button>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = custom.trim();
              if (!v || lower.has(v.toLowerCase())) return;
              setCustom("");
              void commit([...tags, v]);
            }}
            className="inline-flex"
          >
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value.slice(0, LIMITS.tag))}
              placeholder="Outra… ↵"
              aria-label="Nova etiqueta de interesse"
              className="w-32 rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-0.5 text-[11.5px] text-white placeholder:text-white/30 outline-none focus:border-[#783DF5]/60"
            />
          </form>
        </div>
      )}
    </div>
  );
}

// ── Prioridades ─────────────────────────────────────────────────────────

export function PrioritiesList() {
  const { file, viewer, send } = useProspect();
  const [adding, setAdding] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);
  const list = file.priorities;
  useDirtyFlag("priorities:add", adding.trim().length > 0);

  async function commit(next: ProspectPriority[]) {
    setBusy(true);
    const ok = await send({ op: "priorities", priorities: next });
    setBusy(false);
    return ok;
  }
  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    void commit(next);
  }

  return (
    <div>
      {list.length === 0 && !viewer.canWrite && (
        <p className="text-[12.5px] italic text-white/35">Ainda por preencher.</p>
      )}
      <ol className="space-y-2">
        {list.map((p, i) => (
          <li
            key={p.id}
            className="group/prio flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5"
          >
            <span
              className={`mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold tabular-nums ${
                i === 0
                  ? "brand-gradient-bg text-white shadow-[0_4px_14px_-4px_rgba(120,61,245,0.8)]"
                  : "border border-white/12 bg-white/[0.05] text-white/70"
              }`}
            >
              {i + 1}
            </span>
            {editId === p.id ? (
              <form
                className="flex flex-1 items-center gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const v = editText.trim();
                  if (!v) return;
                  if (await commit(list.map((x) => (x.id === p.id ? { ...x, text: v } : x)))) setEditId(null);
                }}
              >
                <input
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value.slice(0, LIMITS.priority))}
                  onKeyDown={(e) => e.key === "Escape" && setEditId(null)}
                  className={inputClass}
                  aria-label="Editar prioridade"
                />
                <PrimaryButton type="submit" busy={busy}>
                  Guardar
                </PrimaryButton>
              </form>
            ) : (
              <>
                <p className="min-w-0 flex-1 pt-0.5 text-[13.5px] leading-snug text-white/85">{p.text}</p>
                {viewer.canWrite && (
                  <span className="flex shrink-0 items-center opacity-100 transition sm:opacity-0 sm:group-hover/prio:opacity-100 sm:group-focus-within/prio:opacity-100">
                    <GhostButton onClick={() => move(i, -1)} disabled={i === 0 || busy} title="Subir">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </GhostButton>
                    <GhostButton onClick={() => move(i, 1)} disabled={i === list.length - 1 || busy} title="Descer">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </GhostButton>
                    <EditButton
                      label="Editar"
                      onClick={() => {
                        setEditId(p.id);
                        setEditText(p.text);
                      }}
                    />
                    <DeleteButton onConfirm={() => commit(list.filter((x) => x.id !== p.id))} />
                  </span>
                )}
              </>
            )}
          </li>
        ))}
      </ol>
      {viewer.canWrite && list.length < LIMITS.priorities && (
        <form
          className="mt-2.5 flex items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const v = adding.trim();
            if (!v) return;
            if (await commit([...list, { id: newId("pr"), text: v }])) setAdding("");
          }}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/15 text-[12px] font-bold text-white/35">
            {list.length + 1}
          </span>
          <input
            value={adding}
            onChange={(e) => setAdding(e.target.value.slice(0, LIMITS.priority))}
            placeholder={
              list.length === 0
                ? "Qual é a prioridade nº 1 do cliente? ↵"
                : "Acrescentar prioridade ↵"
            }
            aria-label="Nova prioridade"
            className={inputClass}
          />
          <PrimaryButton type="submit" busy={busy} disabled={!adding.trim()}>
            <Plus className="h-3.5 w-3.5" />
          </PrimaryButton>
        </form>
      )}
    </div>
  );
}

// ── Perfil ──────────────────────────────────────────────────────────────

const PROFILE_ICON: Record<ProfileField, React.ComponentType<{ className?: string }>> = {
  website: Globe,
  sector: Building2,
  location: MapPin,
  contactName: UserRound,
  contactRole: BriefcaseBusiness,
  source: Megaphone,
  deal: Handshake,
};

export function ProfileCard() {
  const { file, viewer, send } = useProspect();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProspectProfile>(file.profile);
  const [busy, setBusy] = useState(false);
  const dirty = editing && PROFILE_FIELDS.some((f) => draft[f] !== file.profile[f]);
  useDirtyFlag("profile", dirty);
  const filled = PROFILE_FIELDS.filter((f) => file.profile[f].trim());

  async function save() {
    setBusy(true);
    const ok = await send({ op: "profile", patch: draft });
    setBusy(false);
    if (ok) setEditing(false);
  }

  return (
    <Card id="perfil">
      <SectionHead
        icon={UserRound}
        title="Perfil do prospect"
        hint="Quem é, quem decide e o que ficou acordado"
        right={
          viewer.canWrite && !editing ? (
            <EditButton
              onClick={() => {
                setDraft(file.profile);
                setEditing(true);
              }}
            />
          ) : null
        }
      />
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          className="space-y-2.5"
        >
          {PROFILE_FIELDS.map((f, i) => (
            <label key={f} className="block">
              <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/40">
                {PROFILE_LABEL[f]}
              </span>
              <input
                autoFocus={i === 0}
                value={draft[f]}
                list={f === "source" ? "prospect-lead-sources" : undefined}
                onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value.slice(0, LIMITS.short) }))}
                placeholder={PROFILE_PLACEHOLDER[f]}
                className={inputClass}
              />
            </label>
          ))}
          <datalist id="prospect-lead-sources">
            {LEAD_SOURCE_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <div className="flex justify-end gap-2 pt-1">
            <GhostButton onClick={() => setEditing(false)}>Cancelar</GhostButton>
            <PrimaryButton type="submit" busy={busy} disabled={!dirty}>
              Guardar
            </PrimaryButton>
          </div>
        </form>
      ) : filled.length === 0 ? (
        <EmptyHint
          onClick={
            viewer.canWrite
              ? () => {
                  setDraft(file.profile);
                  setEditing(true);
                }
              : undefined
          }
        >
          Preencher perfil
        </EmptyHint>
      ) : (
        <dl className="space-y-2.5">
          {PROFILE_FIELDS.filter((f) => f !== "contactRole").map((f) => {
            const Icon = PROFILE_ICON[f];
            let value: React.ReactNode = file.profile[f].trim();
            if (f === "contactName" && file.profile.contactRole.trim()) {
              value = (
                <>
                  {file.profile.contactName.trim() || "—"}
                  <span className="text-white/45"> · {file.profile.contactRole.trim()}</span>
                </>
              );
            }
            if (f === "website" && file.profile.website.trim()) {
              const url = cleanUrl(file.profile.website);
              value = url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-violet-200 hover:text-white"
                >
                  {file.profile.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                file.profile.website
              );
            }
            const empty = !file.profile[f].trim() && !(f === "contactName" && file.profile.contactRole.trim());
            return (
              <div key={f} className="flex items-start gap-2.5">
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/35" />
                <div className="min-w-0">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                    {PROFILE_LABEL[f]}
                  </dt>
                  <dd className={`break-words text-[13px] ${empty ? "text-white/25" : "text-white/85"}`}>
                    {empty ? "—" : value}
                  </dd>
                </div>
              </div>
            );
          })}
        </dl>
      )}
    </Card>
  );
}

// ── Links das calls ─────────────────────────────────────────────────────

export function LinksCard() {
  const { file, viewer, send, now, people } = useProspect();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = Boolean(cleanUrl(url));
  useDirtyFlag("links:add", adding && (label.trim() !== "" || url.trim() !== ""));

  // Os links das notas também aparecem aqui — é o sítio onde se procuram.
  const fromNotes = file.notes.filter((n) => n.callUrl);

  return (
    <Card id="links">
      <SectionHead
        icon={Video}
        title="Links das calls"
        hint="Gravações (Fathom, Meet, Zoom), docs e apresentações"
        right={
          viewer.canWrite && !adding ? (
            <GhostButton onClick={() => setAdding(true)}>
              <Plus className="h-3.5 w-3.5" />
              Link
            </GhostButton>
          ) : null
        }
      />
      {adding && (
        <form
          className="mb-3 space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid) return;
            setBusy(true);
            const ok = await send({ op: "link.add", label, url });
            setBusy(false);
            if (ok) {
              setAdding(false);
              setLabel("");
              setUrl("");
            }
          }}
          onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
        >
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://fathom.video/share/…"
            aria-label="Endereço do link"
            className={inputClass}
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value.slice(0, 120))}
            placeholder={url && valid ? `Nome (opcional) — ex.: Discovery call · ${callProvider(cleanUrl(url) ?? "")}` : "Nome (opcional)"}
            aria-label="Nome do link"
            className={inputClass}
          />
          <div className="flex justify-end gap-2">
            <GhostButton onClick={() => setAdding(false)}>Cancelar</GhostButton>
            <PrimaryButton type="submit" busy={busy} disabled={!valid}>
              Acrescentar
            </PrimaryButton>
          </div>
        </form>
      )}
      {file.links.length === 0 && fromNotes.length === 0 && !adding ? (
        <EmptyHint onClick={viewer.canWrite ? () => setAdding(true) : undefined}>
          Acrescentar link
        </EmptyHint>
      ) : (
        <ul className="space-y-1.5">
          {file.links.map((l) => (
            <li key={l.id} className="group/link flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-sky-200">
                <Link2 className="h-3.5 w-3.5" />
              </span>
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium text-white/90 hover:text-white">
                  {l.label || callProvider(l.url)}
                </span>
                <span className="block truncate text-[10.5px] text-white/35">
                  {callProvider(l.url)} · {personOf(people, l.addedBy).name} · {relTime(l.addedAt, now)}
                </span>
              </a>
              {(viewer.isAdmin || viewer.username === l.addedBy) && viewer.canWrite && (
                <span className="opacity-100 transition sm:opacity-0 sm:group-hover/link:opacity-100">
                  <DeleteButton onConfirm={() => send({ op: "link.delete", id: l.id })} />
                </span>
              )}
            </li>
          ))}
          {fromNotes.map((n) => (
            <li key={n.id} className="flex items-center gap-2.5 rounded-xl border border-white/[0.05] px-3 py-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-white/45">
                <Video className="h-3.5 w-3.5" />
              </span>
              <a href={n.callUrl!} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-white/75 hover:text-white">
                  {n.title || "Gravação"} · {callProvider(n.callUrl!)}
                </span>
                <span className="block truncate text-[10.5px] text-white/30">Na nota de {n.date ? n.date.split("-").reverse().join("/") : "—"}</span>
              </a>
              <ExternalLink className="h-3.5 w-3.5 text-white/30" />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ── Atividade ───────────────────────────────────────────────────────────

export function ActivityCard() {
  const { file, now } = useProspect();
  const [all, setAll] = useState(false);
  const list = all ? file.activity : file.activity.slice(0, 6);
  if (file.activity.length === 0) return null;
  return (
    <Card id="atividade">
      <SectionHead icon={History} title="Atividade" hint="Quem mexeu na ficha e quando" />
      <ol className="relative space-y-3 border-l border-white/[0.08] pl-4">
        {list.map((a, i) => (
          <li key={`${a.at}-${i}`} className="relative">
            <span aria-hidden className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border border-[#0b0b12] bg-violet-400/70" />
            <p className="text-[12px] leading-snug text-white/70">
              <span className="font-semibold text-white/90">
                <PersonChip username={a.by} size={14} />
              </span>{" "}
              {a.text}
            </p>
            <p className="text-[10.5px] text-white/30">{relTime(a.at, now)}</p>
          </li>
        ))}
      </ol>
      {file.activity.length > 6 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-3 text-[11.5px] font-medium text-violet-200/80 hover:text-white"
        >
          {all ? "Mostrar menos" : `Ver tudo (${file.activity.length})`}
        </button>
      )}
    </Card>
  );
}
