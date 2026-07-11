"use client";

// Client credentials vault, rendered at the bottom of each client's
// SEO project page. Pure client-rendered (KV reads via /api/accesses).
// Passwords masked by default with click-to-reveal + copy buttons.

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { ClientAccess } from "@/lib/client-accesses-store";
import { useSeoReadOnly } from "./seo-readonly";

type EditDraft = Omit<ClientAccess, "id" | "addedAt" | "updatedAt"> & {
  id?: string;
};

const EMPTY_DRAFT: EditDraft = {
  label: "",
  url: "",
  username: "",
  password: "",
  notes: "",
};

export function ClientAccesses({
  slug,
  clientName,
}: {
  slug: string;
  clientName: string;
}) {
  const readOnly = useSeoReadOnly();
  const [entries, setEntries] = useState<ClientAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/accesses/${slug}`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { entries: ClientAccess[] };
        setEntries(data.entries);
      }
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function persist(draft: EditDraft) {
    setSaving(true);
    try {
      const isEdit = Boolean(draft.id);
      const url = isEdit
        ? `/api/accesses/${slug}/${draft.id}`
        : `/api/accesses/${slug}`;
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: draft.label,
          url: draft.url || null,
          username: draft.username || null,
          password: draft.password || null,
          notes: draft.notes || null,
        }),
      });
      if (res.ok) {
        setEditing(null);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(id: string) {
    if (!confirm("Delete this access? You can't undo this.")) return;
    await fetch(`/api/accesses/${slug}/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <section
      id="section-accesses"
      aria-label="Client accesses"
      className="scroll-mt-8"
    >
      <header className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1">
        <KeyRound className="h-4 w-4 text-white/55" strokeWidth={2.25} />
        <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-white/55">
          Accesses
        </h2>
        <span className="text-xs text-white/35">
          Host login, CMS backend, and anything else {clientName} has given
          us. Stored privately — passwords masked by default.
        </span>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setEditing({ ...EMPTY_DRAFT })}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/85 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Add access
          </button>
        )}
      </header>

      {/* Inline editor (add or edit). Sits above the list when open. */}
      {editing && (
        <div className="brand-gradient-border mb-4 rounded-2xl bg-white/[0.03] p-4 backdrop-blur-md">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field
              label="Label *"
              value={editing.label}
              onChange={(v) => setEditing({ ...editing, label: v })}
              placeholder="e.g. WordPress admin · cPanel · Mailchimp"
            />
            <Field
              label="Login URL"
              value={editing.url ?? ""}
              onChange={(v) => setEditing({ ...editing, url: v })}
              placeholder="https://client-site.com/wp-admin"
              type="url"
            />
            <Field
              label="Username / email"
              value={editing.username ?? ""}
              onChange={(v) => setEditing({ ...editing, username: v })}
              placeholder="seo@wonder-ads.com"
            />
            <Field
              label="Password"
              value={editing.password ?? ""}
              onChange={(v) => setEditing({ ...editing, password: v })}
              placeholder="••••••••"
              type="password"
            />
          </div>
          <div className="mt-3">
            <Field
              label="Notes"
              value={editing.notes ?? ""}
              onChange={(v) => setEditing({ ...editing, notes: v })}
              placeholder="2FA via Authy on the consultant's phone · contact billing if locked out · etc."
              multiline
            />
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/65 transition hover:bg-white/[0.08] hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!editing.label.trim() || saving}
              onClick={() => void persist(editing)}
              className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-br from-[#343ED7] via-[#783DF5] to-[#C535C9] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm shadow-[#783DF5]/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {editing.id ? "Save" : "Add"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.015] p-8 text-center text-xs text-white/40">
          Loading accesses…
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.015] p-8 text-center text-xs text-white/40">
          No accesses stored yet. Add one above — host login, CMS backend,
          GA4 / GSC owner, anything {clientName} hands us during onboarding
          or later.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {entries.map((e) => (
            <AccessCard
              key={e.id}
              entry={e}
              onEdit={() =>
                setEditing({
                  id: e.id,
                  label: e.label,
                  url: e.url,
                  username: e.username,
                  password: e.password,
                  notes: e.notes,
                })
              }
              onDelete={() => void deleteEntry(e.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function AccessCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: ClientAccess;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const readOnly = useSeoReadOnly();
  return (
    <li className="brand-gradient-border group relative overflow-hidden rounded-xl bg-white/[0.025] p-4 backdrop-blur-md">
      <header className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight text-white">
          {entry.label}
        </h3>
        {!readOnly && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edit"
              className="rounded-md p-1.5 text-white/45 transition hover:bg-white/[0.06] hover:text-white"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete"
              className="rounded-md p-1.5 text-white/45 transition hover:bg-rose-500/15 hover:text-rose-300"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </header>
      <dl className="space-y-2.5">
        {entry.url && (
          <Row label="URL">
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-white/85 hover:text-white"
            >
              <span className="truncate">{entry.url}</span>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
            </a>
          </Row>
        )}
        {entry.username && (
          <Row label="Username">
            <CopyableValue value={entry.username} />
          </Row>
        )}
        {entry.password && (
          <Row label="Password">
            <SecretValue value={entry.password} />
          </Row>
        )}
        {entry.notes && (
          <Row label="Notes">
            <span className="whitespace-pre-wrap text-xs text-white/65">
              {entry.notes}
            </span>
          </Row>
        )}
      </dl>
    </li>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.13em] text-white/45">
        {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function CopyableValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }
  return (
    <span className="inline-flex max-w-full items-center gap-1.5">
      <span className="truncate text-xs text-white/85">{value}</span>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy"
        className="rounded p-1 text-white/45 transition hover:bg-white/[0.06] hover:text-white"
      >
        {copied ? (
          <Check className="h-3 w-3 text-emerald-300" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>
    </span>
  );
}

function SecretValue({ value }: { value: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }
  return (
    <span className="inline-flex max-w-full items-center gap-1.5">
      <span className="truncate font-mono text-xs text-white/85">
        {revealed ? value : "•".repeat(Math.min(value.length, 12))}
      </span>
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        aria-label={revealed ? "Hide" : "Reveal"}
        className="rounded p-1 text-white/45 transition hover:bg-white/[0.06] hover:text-white"
      >
        {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </button>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy"
        className="rounded p-1 text-white/45 transition hover:bg-white/[0.06] hover:text-white"
      >
        {copied ? (
          <Check className="h-3 w-3 text-emerald-300" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "url" | "password";
  multiline?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <label className="block text-xs">
      <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-white/55">
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          placeholder={placeholder}
          rows={3}
          className="mt-1 w-full resize-y rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-white/30"
        />
      ) : type === "password" ? (
        <div className="relative">
          <input
            type={revealed ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.currentTarget.value)}
            placeholder={placeholder}
            className="mt-1 w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 pr-9 text-sm text-white outline-none focus:border-white/30"
          />
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? "Hide" : "Reveal"}
            className="absolute right-2 top-1/2 mt-0.5 -translate-y-1/2 rounded p-1 text-white/45 transition hover:bg-white/[0.06] hover:text-white"
          >
            {revealed ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          placeholder={placeholder}
          className="mt-1 w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-white/30"
        />
      )}
    </label>
  );
}

