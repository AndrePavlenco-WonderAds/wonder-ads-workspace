"use client";

// Per-client profile editor — the canonical place a client's reusable data
// lives: default designer, notes, accesses/credentials (encrypted vault),
// resource links and branding kit. Saving any section PUTs the full record
// to /api/web/clients/[slug] (which upserts, so editing an as-yet-
// unregistered client creates it). Mirrors the project-detail vault UX.

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Save,
  StickyNote,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  WEB_CRED_KINDS,
  WEB_CRED_KIND_LABEL,
  type PublicWebClient,
  type PublicWebCredential,
  type WebCredKind,
  type WebResource,
} from "@/lib/web-shared";

type Assignee = { username: string; name: string };

function rid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export function WebClientDetail({
  initialClient,
  registered,
  assignees,
}: {
  initialClient: PublicWebClient;
  /** False when this client only exists as a name on projects/tickets and
   *  hasn't been saved as a profile yet. */
  registered: boolean;
  assignees: Assignee[];
}) {
  const router = useRouter();
  const [client, setClient] = useState<PublicWebClient>(initialClient);
  const [savedOnce, setSavedOnce] = useState(registered);
  const [savingTag, setSavingTag] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(
    async (next: PublicWebClient, tag: string): Promise<PublicWebClient | null> => {
      setSavingTag(tag);
      setError(null);
      const prev = client;
      setClient(next);
      try {
        const res = await fetch(`/api/web/clients/${client.slug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (!res.ok) throw new Error("Save failed");
        const data = await res.json();
        setClient(data.client);
        setSavedOnce(true);
        router.refresh();
        return data.client as PublicWebClient;
      } catch {
        setClient(prev);
        setError("Não foi possível guardar — tenta de novo.");
        return null;
      } finally {
        setSavingTag(null);
      }
    },
    [client, router],
  );

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}
          <button onClick={() => setError(null)} aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {!savedOnce && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-100">
          Este cliente ainda não tem perfil guardado. Preenche os dados abaixo
          e guarda — passa a aparecer nas sugestões ao criar projetos.
        </div>
      )}

      {/* Profile basics */}
      <Card>
        <CardHead title="Perfil" icon={UserRound} />
        <div className="flex flex-col gap-3">
          <Labeled label="Nome do cliente">
            <input
              value={client.name}
              onChange={(e) => setClient({ ...client, name: e.target.value })}
              className="modal-input"
            />
          </Labeled>
          <Labeled label="Designer padrão">
            <select
              value={client.defaultAssigneeUsername}
              onChange={(e) => {
                const username = e.target.value;
                const name =
                  assignees.find((a) => a.username === username)?.name ?? "";
                setClient({
                  ...client,
                  defaultAssigneeUsername: username,
                  defaultAssigneeName: name,
                });
              }}
              className="modal-input"
            >
              <option value="">— sem padrão —</option>
              {assignees.map((a) => (
                <option key={a.username} value={a.username}>
                  {a.name}
                </option>
              ))}
            </select>
          </Labeled>
          <div className="flex">
            <SaveButton
              saving={savingTag === "profile"}
              onClick={() => save(client, "profile")}
              disabled={!client.name.trim()}
              label="Guardar perfil"
            />
          </div>
        </div>
      </Card>

      {/* Notes */}
      <Card>
        <CardHead title="Notas" icon={StickyNote} />
        <textarea
          value={client.assets.notes}
          onChange={(e) =>
            setClient({
              ...client,
              assets: { ...client.assets, notes: e.target.value },
            })
          }
          rows={4}
          placeholder="Contexto do cliente, preferências, contactos, avisos…"
          className="modal-input w-full resize-y"
        />
        <div className="mt-3 flex">
          <SaveButton
            saving={savingTag === "notes"}
            onClick={() => save(client, "notes")}
          />
        </div>
      </Card>

      {/* Branding + resources */}
      <Card>
        <CardHead title="Branding & links" icon={Link2} />
        <div className="flex flex-col gap-3">
          <Labeled label="Branding kit (URL)">
            <input
              value={client.assets.brandingKitUrl ?? ""}
              onChange={(e) =>
                setClient({
                  ...client,
                  assets: {
                    ...client.assets,
                    brandingKitUrl: e.target.value || undefined,
                  },
                })
              }
              placeholder="https://drive.google.com/…"
              className="modal-input"
            />
          </Labeled>
          <ResourceEditor
            resources={client.assets.resources}
            onChange={(resources) =>
              setClient({ ...client, assets: { ...client.assets, resources } })
            }
          />
          <div className="flex">
            <SaveButton
              saving={savingTag === "branding"}
              onClick={() => save(client, "branding")}
            />
          </div>
        </div>
      </Card>

      {/* Credentials vault */}
      <CredentialsCard
        slug={client.slug}
        creds={client.assets.credentials}
        saving={savingTag === "creds"}
        onSave={(credentials) =>
          save(
            { ...client, assets: { ...client.assets, credentials } },
            "creds",
          )
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resources (label + url)
// ---------------------------------------------------------------------------

function ResourceEditor({
  resources,
  onChange,
}: {
  resources: WebResource[];
  onChange: (r: WebResource[]) => void;
}) {
  return (
    <div>
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
        Links úteis
      </span>
      <div className="mt-1.5 flex flex-col gap-2">
        {resources.map((r) => (
          <div key={r.id} className="flex items-center gap-2">
            <input
              value={r.label}
              onChange={(e) =>
                onChange(
                  resources.map((x) =>
                    x.id === r.id ? { ...x, label: e.target.value } : x,
                  ),
                )
              }
              placeholder="Etiqueta"
              className="modal-input w-1/3"
            />
            <input
              value={r.url}
              onChange={(e) =>
                onChange(
                  resources.map((x) =>
                    x.id === r.id ? { ...x, url: e.target.value } : x,
                  ),
                )
              }
              placeholder="https://…"
              className="modal-input flex-1"
            />
            <button
              onClick={() => onChange(resources.filter((x) => x.id !== r.id))}
              aria-label="Remover link"
              className="text-white/35 hover:text-rose-300"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          onClick={() =>
            onChange([...resources, { id: rid("r"), label: "", url: "" }])
          }
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/12 px-3 py-2 text-[13px] font-medium text-white/70 transition hover:border-white/30 hover:text-white"
        >
          <Plus className="h-4 w-4" /> Adicionar link
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Credentials vault — mirrors the project credential card, pointed at the
// client reveal endpoint.
// ---------------------------------------------------------------------------

type CredentialDraft = {
  id: string;
  label: string;
  kind: WebCredKind;
  url?: string;
  username?: string;
  notes?: string;
  updatedAt: number;
  hasSecret: boolean;
  secret?: string;
};

function CredentialsCard({
  slug,
  creds,
  saving,
  onSave,
}: {
  slug: string;
  creds: PublicWebCredential[];
  saving: boolean;
  onSave: (creds: CredentialDraft[]) => void;
}) {
  const [adding, setAdding] = useState(false);

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
      <CardHead title="Acessos / credenciais" icon={KeyRound}>
        <span className="inline-flex items-center gap-1 text-[10px] text-white/40">
          <Lock className="h-3 w-3" /> encriptado
        </span>
      </CardHead>

      <div className="flex flex-col gap-2.5">
        {creds.length === 0 && !adding && (
          <p className="text-sm text-white/40">
            Sem acessos guardados. Adiciona WordPress, hosting, FTP ou domínio
            — as passwords são encriptadas e mascaradas.
          </p>
        )}
        {creds.map((c) => (
          <CredentialRow
            key={c.id}
            slug={slug}
            cred={c}
            saving={saving}
            onUpdate={(patch, newSecret) => {
              onSave(
                existingDrafts().map((d) =>
                  d.id === c.id
                    ? {
                        ...d,
                        ...patch,
                        secret: newSecret,
                        hasSecret: newSecret ? true : d.hasSecret,
                      }
                    : d,
                ),
              );
            }}
            onDelete={() =>
              onSave(existingDrafts().filter((d) => d.id !== c.id))
            }
          />
        ))}
      </div>

      {adding ? (
        <CredentialForm
          saving={saving}
          onCancel={() => setAdding(false)}
          onSubmit={(draft) => {
            onSave([...existingDrafts(), draft]);
            setAdding(false);
          }}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/12 px-3 py-2 text-[13px] font-medium text-white/70 transition hover:border-white/30 hover:text-white"
        >
          <Plus className="h-4 w-4" /> Adicionar acesso
        </button>
      )}
    </Card>
  );
}

function CredentialRow({
  slug,
  cred,
  onUpdate,
  onDelete,
  saving,
}: {
  slug: string;
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
      const res = await fetch(`/api/web/clients/${slug}/reveal`, {
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
            aria-label="Editar acesso"
            className="text-white/35 hover:text-white"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            aria-label="Eliminar acesso"
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
        <span className="text-white/40">Password</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-white/80">
            {cred.hasSecret
              ? revealed !== null
                ? revealed || "(vazio)"
                : "•••••••••••"
              : "— sem password —"}
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
              {revealed !== null ? "Esconder" : "Ver"}
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
      secret: secret ? secret : undefined,
    });
  };

  return (
    <div className="mt-3 rounded-xl border border-[color:var(--brand-purple)]/30 bg-white/[0.03] p-3.5">
      <div className="grid grid-cols-2 gap-3">
        <Labeled label="Etiqueta">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="ex.: WP admin"
            className="modal-input"
          />
        </Labeled>
        <Labeled label="Tipo">
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
        <Labeled label="URL de login">
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
            label={initial?.hasSecret ? "Password (vazio = manter)" : "Password"}
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
        <Labeled label="Notas">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="2FA, email de recuperação, etc."
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
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
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
  icon: React.ComponentType<{ className?: string }>;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight text-white">
        <Icon className="h-4 w-4 text-[color:var(--brand-magenta)]" />
        {title}
      </h2>
      {children}
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
  disabled,
  label = "Guardar",
}: {
  saving: boolean;
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={saving || disabled}
      className="brand-gradient-bg inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:scale-[1.01] disabled:opacity-60"
    >
      {saving ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      {label}
    </button>
  );
}
