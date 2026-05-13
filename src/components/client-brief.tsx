"use client";

import { useState, useRef, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  FileText,
  Sparkles,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import type { ClientBrief as Brief } from "@/lib/client-briefs";
import { hasAnyBriefContent } from "@/lib/client-briefs";

type Kind = "dos" | "donts" | "notes";

export function ClientBrief({
  brief: initial,
  slug,
  clientName,
}: {
  brief: Brief;
  slug: string;
  clientName: string;
}) {
  const [brief, setBrief] = useState<Brief>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSavedRef = useRef<Brief>(initial);

  async function persist(next: Brief) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/briefs/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Save failed (${res.status})`);
      }
      const saved = (await res.json()) as Brief;
      lastSavedRef.current = saved;
      setBrief(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setBrief(lastSavedRef.current);
    } finally {
      setSaving(false);
    }
  }

  function addItem(kind: Kind, text: string) {
    const t = text.trim();
    if (!t) return;
    const next: Brief = { ...brief, [kind]: [...brief[kind], t] };
    setBrief(next);
    persist(next);
  }

  function removeItem(kind: Kind, index: number) {
    const next: Brief = {
      ...brief,
      [kind]: brief[kind].filter((_, i) => i !== index),
    };
    setBrief(next);
    persist(next);
  }

  function editItem(kind: Kind, index: number, text: string) {
    const t = text.trim();
    if (!t) {
      removeItem(kind, index);
      return;
    }
    if (brief[kind][index] === t) return; // no change
    const next: Brief = {
      ...brief,
      [kind]: brief[kind].map((v, i) => (i === index ? t : v)),
    };
    setBrief(next);
    persist(next);
  }

  const hasContent = hasAnyBriefContent(brief);

  return (
    <section
      aria-label={`Client brief for ${clientName}`}
      className="relative"
    >
      <header className="mb-5 flex flex-wrap items-center gap-2">
        <Sparkles className="h-4 w-4 text-white/55" strokeWidth={2.25} />
        <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-white/55">
          Client Brief
        </h2>
        {!hasContent && (
          <span className="ml-2 rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-white/45">
            Not set
          </span>
        )}
        {saving && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-white/45">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving…
          </span>
        )}
        {error && !saving && (
          <span className="ml-auto rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-300">
            {error}
          </span>
        )}
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BriefPanel
          tone="do"
          title="Do's"
          kind="dos"
          items={brief.dos}
          onAdd={(t) => addItem("dos", t)}
          onRemove={(i) => removeItem("dos", i)}
          onEdit={(i, t) => editItem("dos", i, t)}
        />
        <BriefPanel
          tone="dont"
          title="Don'ts"
          kind="donts"
          items={brief.donts}
          onAdd={(t) => addItem("donts", t)}
          onRemove={(i) => removeItem("donts", i)}
          onEdit={(i, t) => editItem("donts", i, t)}
        />
      </div>

      <div className="mt-4">
        <NotesPanel
          items={brief.notes}
          onAdd={(t) => addItem("notes", t)}
          onRemove={(i) => removeItem("notes", i)}
          onEdit={(i, t) => editItem("notes", i, t)}
        />
      </div>
    </section>
  );
}

function BriefPanel({
  tone,
  title,
  items,
  onAdd,
  onRemove,
  onEdit,
}: {
  tone: "do" | "dont";
  title: string;
  kind: Kind;
  items: string[];
  onAdd: (text: string) => void;
  onRemove: (index: number) => void;
  onEdit: (index: number, text: string) => void;
}) {
  const isDo = tone === "do";
  const Icon = isDo ? CheckCircle2 : XCircle;

  const styles = isDo
    ? {
        bg: "bg-emerald-500/[0.06]",
        border: "border-emerald-500/25",
        text: "text-emerald-300",
        dot: "bg-emerald-400",
        glow: "shadow-[0_8px_30px_-12px_rgba(16,185,129,0.55)]",
        line: "from-transparent via-emerald-400/70 to-transparent",
        cornerGlow: "bg-emerald-500",
        button:
          "border-emerald-500/30 hover:border-emerald-500/55 hover:bg-emerald-500/10 text-emerald-300",
        ring: "ring-emerald-500/40",
      }
    : {
        bg: "bg-rose-500/[0.06]",
        border: "border-rose-500/25",
        text: "text-rose-300",
        dot: "bg-rose-400",
        glow: "shadow-[0_8px_30px_-12px_rgba(244,63,94,0.55)]",
        line: "from-transparent via-rose-400/70 to-transparent",
        cornerGlow: "bg-rose-500",
        button:
          "border-rose-500/30 hover:border-rose-500/55 hover:bg-rose-500/10 text-rose-300",
        ring: "ring-rose-500/40",
      };

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border ${styles.border} ${styles.bg} ${styles.glow} p-6 backdrop-blur-md`}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${styles.line}`}
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-30 blur-3xl ${styles.cornerGlow}`}
      />

      <header className="relative flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Icon className={`h-5 w-5 ${styles.text}`} strokeWidth={2.25} />
          <h3 className="text-lg font-semibold tracking-tight text-white">
            {title}
          </h3>
        </div>
        <span
          className={`text-[10px] font-bold uppercase tracking-[0.18em] ${styles.text} opacity-75`}
        >
          {items.length}
        </span>
      </header>

      <ul className="relative mt-4 space-y-2">
        {items.map((item, i) => (
          <EditableRow
            key={i}
            value={item}
            dotClass={styles.dot}
            ringClass={styles.ring}
            onSave={(text) => onEdit(i, text)}
            onRemove={() => onRemove(i)}
          />
        ))}
      </ul>

      <AddRow
        placeholder={`Add a ${title.toLowerCase().replace("'s", "").replace("'t", "")}…`}
        buttonClass={styles.button}
        ringClass={styles.ring}
        onAdd={onAdd}
      />
    </article>
  );
}

function NotesPanel({
  items,
  onAdd,
  onRemove,
  onEdit,
}: {
  items: string[];
  onAdd: (text: string) => void;
  onRemove: (index: number) => void;
  onEdit: (index: number, text: string) => void;
}) {
  return (
    <article className="brand-gradient-border relative rounded-2xl bg-white/[0.035] p-6 backdrop-blur-md">
      <header className="flex items-center gap-2.5">
        <FileText className="h-4 w-4 text-white/65" strokeWidth={2.25} />
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/65">
          Notes
        </h3>
      </header>
      <ul className="mt-3 space-y-2">
        {items.map((item, i) => (
          <EditableRow
            key={i}
            value={item}
            dotClass="bg-[color:var(--brand-purple)]"
            ringClass="ring-[color:var(--brand-purple)]/40"
            onSave={(text) => onEdit(i, text)}
            onRemove={() => onRemove(i)}
            isNote
          />
        ))}
      </ul>
      <AddRow
        placeholder="Add a note…"
        buttonClass="border-white/20 hover:border-white/40 hover:bg-white/[0.06] text-white/75"
        ringClass="ring-white/30"
        onAdd={onAdd}
      />
    </article>
  );
}

function EditableRow({
  value,
  dotClass,
  ringClass,
  onSave,
  onRemove,
  isNote = false,
}: {
  value: string;
  dotClass: string;
  ringClass: string;
  onSave: (text: string) => void;
  onRemove: () => void;
  isNote?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  function commit() {
    setEditing(false);
    if (draft.trim() && draft.trim() !== value) {
      onSave(draft.trim());
    } else if (!draft.trim()) {
      // empty draft → revert visually; deletion happens via × button
      setDraft(value);
    }
  }

  if (editing) {
    return (
      <li className="group flex gap-2.5">
        <span
          aria-hidden
          className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`}
        />
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            else if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          className={`flex-1 rounded border-0 bg-white/[0.06] px-2 py-1 text-sm leading-relaxed text-white outline-none ring-2 ${ringClass} sm:text-base`}
        />
      </li>
    );
  }

  return (
    <li className="group flex items-start gap-2.5">
      <span
        aria-hidden
        className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`}
      />
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`flex-1 cursor-text rounded text-left text-sm leading-relaxed text-white/85 transition hover:bg-white/[0.04] sm:text-base ${isNote ? "" : ""}`}
        title="Click to edit"
      >
        {value}
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="invisible mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-white/35 transition hover:bg-white/10 hover:text-white group-hover:visible"
        aria-label="Remove"
        title="Remove"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function AddRow({
  placeholder,
  buttonClass,
  ringClass,
  onAdd,
}: {
  placeholder: string;
  buttonClass: string;
  ringClass: string;
  onAdd: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  function submit() {
    const t = text.trim();
    if (t) onAdd(t);
    setText("");
    setOpen(false);
  }

  if (open) {
    return (
      <div className="mt-3 flex items-center gap-2">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={submit}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            else if (e.key === "Escape") {
              setText("");
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          className={`flex-1 rounded-lg border-0 bg-white/[0.06] px-3 py-2 text-sm leading-relaxed text-white placeholder:text-white/35 outline-none ring-2 ${ringClass} sm:text-base`}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium tracking-tight transition ${buttonClass}`}
    >
      <Plus className="h-3.5 w-3.5" />
      Add
    </button>
  );
}
