"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import {
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  MessageSquarePlus,
  Paperclip,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  WEB_CRED_KINDS,
  WEB_CRED_KIND_LABEL,
  WEB_PRIORITIES,
  WEB_PRIORITY_META,
  WEB_STATUSES,
  WEB_STATUS_META,
  type PublicWebCredential,
  type PublicWebProject,
  type WebAssetFile,
  type WebCredKind,
  type WebPriority,
  type WebResource,
  type WebStatus,
} from "@/lib/web-shared";
import { detectKind } from "@/lib/client-files";
import { formatDate, formatDateTime } from "@/lib/dates";

type Assignee = { username: string; name: string };

function rid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export function WebProjectDetail({
  initialProject,
  assignees,
  currentUser,
}: {
  initialProject: PublicWebProject;
  assignees: Assignee[];
  currentUser: { username: string; name: string };
}) {
  const router = useRouter();
  const [project, setProject] = useState<PublicWebProject>(initialProject);
  const [savingTag, setSavingTag] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** PUT the full project. `tag` drives the per-section saving spinner.
   *  Optimistically applies `next`, reconciles with the server echo. */
  const save = useCallback(
    async (
      next: PublicWebProject,
      tag: string,
    ): Promise<PublicWebProject | null> => {
      setSavingTag(tag);
      setError(null);
      const prev = project;
      setProject(next);
      try {
        const res = await fetch(`/api/web/projects/${project.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (!res.ok) throw new Error("Save failed");
        const data = await res.json();
        setProject(data.project);
        return data.project as PublicWebProject;
      } catch {
        setProject(prev);
        setError("Couldn't save — try again.");
        return null;
      } finally {
        setSavingTag(null);
      }
    },
    [project],
  );

  const meta = WEB_STATUS_META[project.status];

  return (
    <div className="mt-6">
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}
          <button onClick={() => setError(null)} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${meta.tag}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {project.name}
          </h1>
          {project.clientName && (
            <p className="mt-1.5 text-base text-white/55">
              {project.clientName}
            </p>
          )}
        </div>
        <DeleteButton projectId={project.id} onDeleted={() => router.push("/web")} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* LEFT: details + comments */}
        <div className="flex flex-col gap-6">
          <DetailsCard
            project={project}
            assignees={assignees}
            saving={savingTag === "details"}
            onSave={(patch) => save({ ...project, ...patch }, "details")}
          />
          <CommentsCard
            project={project}
            currentUser={currentUser}
            onProject={setProject}
            onError={setError}
          />
        </div>

        {/* RIGHT: assets vault */}
        <div className="flex flex-col gap-6">
          <NotesCard
            project={project}
            saving={savingTag === "notes"}
            onSave={(notes) =>
              save({ ...project, assets: { ...project.assets, notes } }, "notes")
            }
          />
          <DosDontsCard
            project={project}
            saving={savingTag === "dosdonts"}
            onSave={(dos, donts) =>
              save(
                { ...project, assets: { ...project.assets, dos, donts } },
                "dosdonts",
              )
            }
          />
          <CredentialsCard
            project={project}
            saving={savingTag === "creds"}
            onSave={(credentials) =>
              save(
                { ...project, assets: { ...project.assets, credentials } },
                "creds",
              )
            }
          />
          <AssetsCard project={project} onSave={save} />
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Details
// ===========================================================================

function DetailsCard({
  project,
  assignees,
  saving,
  onSave,
}: {
  project: PublicWebProject;
  assignees: Assignee[];
  saving: boolean;
  onSave: (patch: Partial<PublicWebProject>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [clientName, setClientName] = useState(project.clientName);
  const [assignee, setAssignee] = useState(project.assigneeUsername);
  const [priority, setPriority] = useState<WebPriority>(project.priority);
  const [status, setStatus] = useState<WebStatus>(project.status);
  const [startDate, setStartDate] = useState(project.startDate ?? "");
  const [deadline, setDeadline] = useState(project.deadline ?? "");

  const submit = () => {
    const assigneeName =
      assignees.find((a) => a.username === assignee)?.name ?? "Unassigned";
    onSave({
      name: name.trim() || project.name,
      clientName,
      assigneeUsername: assignee,
      assigneeName,
      priority,
      status,
      startDate: startDate || null,
      deadline: deadline || null,
    });
    setEditing(false);
  };

  if (!editing) {
    return (
      <Card>
        <CardHead title="Project details" icon={Pencil}>
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-white/55 transition hover:text-white"
          >
            Edit
          </button>
        </CardHead>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <Meta label="Web designer" value={project.assigneeName} />
          <Meta
            label="Priority"
            value={WEB_PRIORITY_META[project.priority].label}
          />
          <Meta label="Start date" value={formatDate(project.startDate)} />
          <Meta label="Target launch" value={formatDate(project.deadline)} />
          <Meta label="Status" value={WEB_STATUS_META[project.status].label} />
          <Meta label="Last updated" value={formatDateTime(project.updatedAt)} />
        </dl>
      </Card>
    );
  }

  return (
    <Card>
      <CardHead title="Edit details" icon={Pencil} />
      <div className="flex flex-col gap-4">
        <Labeled label="Project name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="modal-input"
          />
        </Labeled>
        <Labeled label="Client name">
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="modal-input"
          />
        </Labeled>
        <div className="grid grid-cols-2 gap-4">
          <Labeled label="Web designer">
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="modal-input"
            >
              {assignees.map((a) => (
                <option key={a.username} value={a.username}>
                  {a.name}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Priority">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as WebPriority)}
              className="modal-input"
            >
              {WEB_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {WEB_PRIORITY_META[p].label}
                </option>
              ))}
            </select>
          </Labeled>
        </div>
        <Labeled label="Status / column">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as WebStatus)}
            className="modal-input"
          >
            {WEB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {WEB_STATUS_META[s].label}
              </option>
            ))}
          </select>
        </Labeled>
        <div className="grid grid-cols-2 gap-4">
          <Labeled label="Start date">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="modal-input"
            />
          </Labeled>
          <Labeled label="Target launch">
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="modal-input"
            />
          </Labeled>
        </div>
        <div className="flex items-center gap-2">
          <SaveButton saving={saving} onClick={submit} />
          <button
            onClick={() => setEditing(false)}
            className="rounded-xl border border-white/12 px-4 py-2.5 text-sm font-medium text-white/65 transition hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </Card>
  );
}

// ===========================================================================
// Comments
// ===========================================================================

function CommentsCard({
  project,
  currentUser,
  onProject,
  onError,
}: {
  project: PublicWebProject;
  currentUser: { username: string; name: string };
  onProject: (p: PublicWebProject) => void;
  onError: (m: string) => void;
}) {
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  const post = async () => {
    const text = body.trim();
    if (!text) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/web/projects/${project.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      onProject(data.project);
      setBody("");
    } catch {
      onError("Couldn't post the comment — try again.");
    } finally {
      setPosting(false);
    }
  };

  const comments = [...project.comments].sort(
    (a, b) => b.createdAt - a.createdAt,
  );

  return (
    <Card>
      <CardHead title="Status updates & comments" icon={MessageSquarePlus} />
      <div className="flex flex-col gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder={`Add an update as ${currentUser.name}…`}
          className="modal-input resize-y"
        />
        <div className="flex justify-end">
          <SaveButton
            saving={posting}
            onClick={post}
            label="Post update"
            icon={MessageSquarePlus}
            disabled={!body.trim()}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {comments.length === 0 && (
          <p className="text-sm text-white/40">
            No updates yet. Post the first one above.
          </p>
        )}
        {comments.map((c) => (
          <div
            key={c.id}
            className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-white">
                {c.authorName}
              </span>
              <time className="text-[10.5px] text-white/40">
                {formatDateTime(c.createdAt)}
              </time>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-white/75">
              {c.body}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ===========================================================================
// Notes
// ===========================================================================

function NotesCard({
  project,
  saving,
  onSave,
}: {
  project: PublicWebProject;
  saving: boolean;
  onSave: (notes: string) => void;
}) {
  const [notes, setNotes] = useState(project.assets.notes);
  const dirty = notes !== project.assets.notes;
  return (
    <Card>
      <CardHead title="Notes" icon={FileText} />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={5}
        placeholder="Project notes, context, anything the team should know…"
        className="modal-input resize-y"
      />
      {dirty && (
        <div className="mt-2 flex justify-end">
          <SaveButton saving={saving} onClick={() => onSave(notes)} />
        </div>
      )}
    </Card>
  );
}

// ===========================================================================
// Do's & Don'ts
// ===========================================================================

function DosDontsCard({
  project,
  saving,
  onSave,
}: {
  project: PublicWebProject;
  saving: boolean;
  onSave: (dos: string[], donts: string[]) => void;
}) {
  const [dos, setDos] = useState<string[]>(project.assets.dos);
  const [donts, setDonts] = useState<string[]>(project.assets.donts);
  const dirty =
    JSON.stringify(dos) !== JSON.stringify(project.assets.dos) ||
    JSON.stringify(donts) !== JSON.stringify(project.assets.donts);

  return (
    <Card>
      <CardHead title="Do's & Don'ts" icon={ShieldCheck} />
      <div className="flex flex-col gap-4">
        <ListEditor
          items={dos}
          setItems={setDos}
          placeholder="Add a do…"
          tone="good"
        />
        <ListEditor
          items={donts}
          setItems={setDonts}
          placeholder="Add a don't…"
          tone="bad"
        />
      </div>
      {dirty && (
        <div className="mt-2 flex justify-end">
          <SaveButton saving={saving} onClick={() => onSave(dos, donts)} />
        </div>
      )}
    </Card>
  );
}

function ListEditor({
  items,
  setItems,
  placeholder,
  tone,
}: {
  items: string[];
  setItems: (v: string[]) => void;
  placeholder: string;
  tone: "good" | "bad";
}) {
  const [draft, setDraft] = useState("");
  const Icon = tone === "good" ? ThumbsUp : ThumbsDown;
  const color = tone === "good" ? "text-emerald-300" : "text-rose-300";
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    setItems([...items, v]);
    setDraft("");
  };
  return (
    <div>
      <div className="flex flex-col gap-1.5">
        {items.map((it, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5 text-[13px] text-white/80"
          >
            <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} />
            <span className="flex-1">{it}</span>
            <button
              onClick={() => setItems(items.filter((_, j) => j !== i))}
              aria-label="Remove"
              className="text-white/30 hover:text-white/70"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="modal-input"
        />
        <button
          onClick={add}
          className="shrink-0 rounded-lg border border-white/12 px-3 text-white/70 transition hover:border-white/30 hover:text-white"
          aria-label="Add"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ===========================================================================
// Credentials vault
// ===========================================================================

function CredentialsCard({
  project,
  saving,
  onSave,
}: {
  project: PublicWebProject;
  saving: boolean;
  onSave: (creds: CredentialDraft[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const creds = project.assets.credentials;

  // A draft carries an optional `secret` (plaintext) only when changed.
  const persist = (next: CredentialDraft[]) => onSave(next);

  const existingDrafts = (): CredentialDraft[] =>
    creds.map((c) => ({
      id: c.id,
      label: c.label,
      kind: c.kind,
      url: c.url,
      username: c.username,
      notes: c.notes,
      updatedAt: c.updatedAt,
      hasSecret: c.hasSecret,
    }));

  return (
    <Card>
      <CardHead title="Access credentials" icon={KeyRound}>
        <span className="inline-flex items-center gap-1 text-[10px] text-white/40">
          <Lock className="h-3 w-3" /> encrypted at rest
        </span>
      </CardHead>

      <div className="flex flex-col gap-2.5">
        {creds.length === 0 && !adding && (
          <p className="text-sm text-white/40">
            No credentials stored. Add WordPress, hosting, FTP or domain access
            below — secrets are encrypted and masked.
          </p>
        )}
        {creds.map((c) => (
          <CredentialRow
            key={c.id}
            projectId={project.id}
            cred={c}
            onUpdate={(patch, newSecret) => {
              const next = existingDrafts().map((d) =>
                d.id === c.id
                  ? {
                      ...d,
                      ...patch,
                      secret: newSecret,
                      hasSecret: newSecret ? true : d.hasSecret,
                    }
                  : d,
              );
              persist(next);
            }}
            onDelete={() =>
              persist(existingDrafts().filter((d) => d.id !== c.id))
            }
            saving={saving}
          />
        ))}
      </div>

      {adding ? (
        <CredentialForm
          saving={saving}
          onCancel={() => setAdding(false)}
          onSubmit={(draft) => {
            persist([...existingDrafts(), draft]);
            setAdding(false);
          }}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/12 px-3 py-2 text-[13px] font-medium text-white/70 transition hover:border-white/30 hover:text-white"
        >
          <Plus className="h-4 w-4" /> Add credential
        </button>
      )}
    </Card>
  );
}

type CredentialDraft = {
  id: string;
  label: string;
  kind: WebCredKind;
  url?: string;
  username?: string;
  notes?: string;
  updatedAt: number;
  hasSecret: boolean;
  /** Plaintext, set only when the user typed a new secret. */
  secret?: string;
};

function CredentialRow({
  projectId,
  cred,
  onUpdate,
  onDelete,
  saving,
}: {
  projectId: string;
  cred: PublicWebCredential;
  onUpdate: (patch: Partial<CredentialDraft>, newSecret?: string) => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);

  const reveal = async () => {
    if (revealed !== null) {
      setRevealed(null);
      return;
    }
    setRevealing(true);
    try {
      const res = await fetch(`/api/web/projects/${projectId}/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialId: cred.id }),
      });
      const data = await res.json();
      setRevealed(typeof data.secret === "string" ? data.secret : "");
    } catch {
      setRevealed("");
    } finally {
      setRevealing(false);
    }
  };

  if (editing) {
    return (
      <CredentialForm
        saving={saving}
        initial={cred}
        onCancel={() => setEditing(false)}
        onSubmit={(draft) => {
          onUpdate(
            {
              label: draft.label,
              kind: draft.kind,
              url: draft.url,
              username: draft.username,
              notes: draft.notes,
            },
            draft.secret,
          );
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-white">
              {cred.label}
            </span>
            <span className="rounded-full border border-white/12 bg-white/[0.04] px-1.5 py-0.5 text-[9.5px] uppercase tracking-wide text-white/50">
              {WEB_CRED_KIND_LABEL[cred.kind]}
            </span>
          </div>
          {cred.url && (
            <a
              href={cred.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-[11.5px] text-sky-300/80 hover:text-sky-200"
            >
              <Link2 className="h-3 w-3" /> {cred.url}
            </a>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => setEditing(true)}
            aria-label="Edit credential"
            className="text-white/35 hover:text-white"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            aria-label="Delete credential"
            className="text-white/35 hover:text-rose-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-[12px]">
        {cred.username && (
          <>
            <span className="text-white/40">User</span>
            <span className="font-mono text-white/80">{cred.username}</span>
          </>
        )}
        <span className="text-white/40">Secret</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-white/80">
            {cred.hasSecret
              ? revealed !== null
                ? revealed || "(empty)"
                : "•••••••••••"
              : "— none set —"}
          </span>
          {cred.hasSecret && (
            <button
              onClick={reveal}
              disabled={revealing}
              className="inline-flex items-center gap-1 rounded-md border border-white/12 px-1.5 py-0.5 text-[10.5px] text-white/60 transition hover:border-white/30 hover:text-white disabled:opacity-50"
            >
              {revealing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : revealed !== null ? (
                <EyeOff className="h-3 w-3" />
              ) : (
                <Eye className="h-3 w-3" />
              )}
              {revealed !== null ? "Hide" : "Reveal"}
            </button>
          )}
        </div>
      </div>
      {cred.notes && (
        <p className="mt-2 whitespace-pre-wrap text-[11.5px] text-white/45">
          {cred.notes}
        </p>
      )}
    </div>
  );
}

function CredentialForm({
  initial,
  saving,
  onSubmit,
  onCancel,
}: {
  initial?: PublicWebCredential;
  saving: boolean;
  onSubmit: (draft: CredentialDraft) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [kind, setKind] = useState<WebCredKind>(initial?.kind ?? "wordpress");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [username, setUsername] = useState(initial?.username ?? "");
  const [secret, setSecret] = useState("");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const submit = () => {
    if (!label.trim()) return;
    onSubmit({
      id: initial?.id ?? rid("c"),
      label: label.trim(),
      kind,
      url: url.trim() || undefined,
      username: username.trim() || undefined,
      notes: notes.trim() || undefined,
      updatedAt: Date.now(),
      hasSecret: secret ? true : Boolean(initial?.hasSecret),
      // Empty secret on edit = keep existing; on create = none.
      secret: secret ? secret : undefined,
    });
  };

  return (
    <div className="mt-3 rounded-xl border border-[color:var(--brand-purple)]/30 bg-white/[0.03] p-3.5">
      <div className="grid grid-cols-2 gap-3">
        <Labeled label="Label">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. WP admin"
            className="modal-input"
          />
        </Labeled>
        <Labeled label="Type">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as WebCredKind)}
            className="modal-input"
          >
            {WEB_CRED_KINDS.map((k) => (
              <option key={k} value={k}>
                {WEB_CRED_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Labeled>
      </div>
      <div className="mt-3 flex flex-col gap-3">
        <Labeled label="Login URL">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://site.com/wp-admin"
            className="modal-input"
          />
        </Labeled>
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Username">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="modal-input"
            />
          </Labeled>
          <Labeled
            label={
              initial?.hasSecret ? "Password (blank = keep)" : "Password"
            }
          >
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={initial?.hasSecret ? "••••••••" : ""}
              autoComplete="new-password"
              className="modal-input"
            />
          </Labeled>
        </div>
        <Labeled label="Notes">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="2FA seed location, recovery email, etc."
            className="modal-input"
          />
        </Labeled>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <SaveButton saving={saving} onClick={submit} disabled={!label.trim()} />
        <button
          onClick={onCancel}
          className="rounded-xl border border-white/12 px-3 py-2 text-sm font-medium text-white/65 transition hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ===========================================================================
// Assets: branding, onboarding form, files, resources
// ===========================================================================

function AssetsCard({
  project,
  onSave,
}: {
  project: PublicWebProject;
  onSave: (
    next: PublicWebProject,
    tag: string,
  ) => Promise<PublicWebProject | null>;
}) {
  const setAssets = (
    patch: Partial<PublicWebProject["assets"]>,
    tag: string,
  ) => onSave({ ...project, assets: { ...project.assets, ...patch } }, tag);

  return (
    <Card>
      <CardHead title="Branding, forms & files" icon={Paperclip} />
      <div className="flex flex-col gap-5">
        <LinkAndFiles
          title="Branding kit"
          linkValue={project.assets.brandingKitUrl ?? ""}
          files={project.assets.brandingFiles}
          onLink={(brandingKitUrl) =>
            setAssets({ brandingKitUrl: brandingKitUrl || undefined }, "branding")
          }
          onFiles={(brandingFiles) => setAssets({ brandingFiles }, "branding")}
        />
        <LinkAndFiles
          title="Onboarding web form"
          linkValue={project.assets.onboardingFormUrl ?? ""}
          files={project.assets.onboardingFiles}
          onLink={(onboardingFormUrl) =>
            setAssets(
              { onboardingFormUrl: onboardingFormUrl || undefined },
              "onboarding",
            )
          }
          onFiles={(onboardingFiles) =>
            setAssets({ onboardingFiles }, "onboarding")
          }
        />
        <FilesBlock
          title="Files & attachments"
          files={project.assets.files}
          onFiles={(files) => setAssets({ files }, "files")}
        />
        <ResourcesBlock
          resources={project.assets.resources}
          onResources={(resources) => setAssets({ resources }, "resources")}
        />
      </div>
    </Card>
  );
}

function LinkAndFiles({
  title,
  linkValue,
  files,
  onLink,
  onFiles,
}: {
  title: string;
  linkValue: string;
  files: WebAssetFile[];
  onLink: (v: string) => void;
  onFiles: (files: WebAssetFile[]) => void;
}) {
  const [link, setLink] = useState(linkValue);
  const dirty = link !== linkValue;
  return (
    <div>
      <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/45">
        {title}
      </h4>
      <div className="flex gap-2">
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Paste a link (Drive, Figma, Notion…)"
          className="modal-input"
        />
        {dirty && (
          <button
            onClick={() => onLink(link.trim())}
            className="shrink-0 rounded-lg border border-white/12 px-3 text-white/70 transition hover:border-white/30 hover:text-white"
            aria-label="Save link"
          >
            <Save className="h-4 w-4" />
          </button>
        )}
      </div>
      <FileList files={files} onFiles={onFiles} />
      <UploadButton files={files} onFiles={onFiles} compact />
    </div>
  );
}

function FilesBlock({
  title,
  files,
  onFiles,
}: {
  title: string;
  files: WebAssetFile[];
  onFiles: (files: WebAssetFile[]) => void;
}) {
  return (
    <div>
      <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/45">
        {title}
      </h4>
      <FileList files={files} onFiles={onFiles} />
      <UploadButton files={files} onFiles={onFiles} />
    </div>
  );
}

function FileList({
  files,
  onFiles,
}: {
  files: WebAssetFile[];
  onFiles: (files: WebAssetFile[]) => void;
}) {
  if (files.length === 0) return null;
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {files.map((f) => (
        <div
          key={f.id}
          className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5"
        >
          <FileText className="h-3.5 w-3.5 shrink-0 text-white/45" />
          <a
            href={f.url}
            target="_blank"
            rel="noreferrer"
            className="flex-1 truncate text-[12.5px] text-white/80 hover:text-white"
          >
            {f.name}
          </a>
          <button
            onClick={() => onFiles(files.filter((x) => x.id !== f.id))}
            aria-label="Remove file"
            className="text-white/30 hover:text-rose-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function UploadButton({
  files,
  onFiles,
  compact = false,
}: {
  files: WebAssetFile[];
  onFiles: (files: WebAssetFile[]) => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    setBusy(true);
    try {
      const uploaded: WebAssetFile[] = [];
      for (const file of picked) {
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/files/upload",
        });
        uploaded.push({
          id: rid("f"),
          name: file.name,
          url: blob.url,
          kind: detectKind(file.name),
          addedAt: Date.now(),
        });
      }
      onFiles([...files, ...uploaded]);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={onPick}
        className="hidden"
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={`mt-2 inline-flex items-center gap-2 rounded-lg border border-white/12 px-3 ${
          compact ? "py-1.5 text-[12px]" : "py-2 text-[13px]"
        } font-medium text-white/65 transition hover:border-white/30 hover:text-white disabled:opacity-60`}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        Upload file
      </button>
    </>
  );
}

function ResourcesBlock({
  resources,
  onResources,
}: {
  resources: WebResource[];
  onResources: (r: WebResource[]) => void;
}) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const add = () => {
    if (!url.trim() && !label.trim()) return;
    onResources([
      ...resources,
      { id: rid("r"), label: label.trim() || url.trim(), url: url.trim() },
    ]);
    setLabel("");
    setUrl("");
  };
  return (
    <div>
      <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/45">
        Other resources
      </h4>
      {resources.length > 0 && (
        <div className="mb-2 flex flex-col gap-1.5">
          {resources.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5"
            >
              <Link2 className="h-3.5 w-3.5 shrink-0 text-white/45" />
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="flex-1 truncate text-[12.5px] text-white/80 hover:text-white"
              >
                {r.label}
              </a>
              <button
                onClick={() => onResources(resources.filter((x) => x.id !== r.id))}
                aria-label="Remove resource"
                className="text-white/30 hover:text-rose-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (optional)"
          className="modal-input"
        />
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="modal-input"
          />
          <button
            onClick={add}
            className="shrink-0 rounded-lg border border-white/12 px-3 text-white/70 transition hover:border-white/30 hover:text-white"
            aria-label="Add resource"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Delete
// ===========================================================================

function DeleteButton({
  projectId,
  onDeleted,
}: {
  projectId: string;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const doDelete = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/web/projects/${projectId}`, {
        method: "DELETE",
      });
      if (res.ok) onDeleted();
    } finally {
      setBusy(false);
    }
  };
  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[12px] font-medium text-white/45 transition hover:border-rose-400/40 hover:text-rose-200"
      >
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </button>
    );
  }
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-1.5">
      <span className="text-[12px] text-rose-100">Delete this project?</span>
      <button
        onClick={doDelete}
        disabled={busy}
        className="inline-flex items-center gap-1 text-[12px] font-semibold text-rose-200 hover:text-white"
      >
        {busy && <Loader2 className="h-3 w-3 animate-spin" />} Yes
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="text-[12px] text-white/50 hover:text-white"
      >
        No
      </button>
    </div>
  );
}

// ===========================================================================
// Small shared UI atoms
// ===========================================================================

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      {children}
    </section>
  );
}

function CardHead({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof FileText;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight text-white">
        <Icon className="h-4 w-4 text-[color:var(--brand-purple)]" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.14em] text-white/40">
        {label}
      </dt>
      <dd className="mt-0.5 text-[13.5px] text-white/85">{value}</dd>
    </div>
  );
}

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
        {label}
      </span>
      {children}
    </label>
  );
}

function SaveButton({
  saving,
  onClick,
  label = "Save",
  icon: Icon = Save,
  disabled = false,
}: {
  saving: boolean;
  onClick: () => void;
  label?: string;
  icon?: typeof Save;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={saving || disabled}
      className="brand-gradient-bg inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:scale-[1.01] disabled:opacity-60"
    >
      {saving ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      {label}
    </button>
  );
}
