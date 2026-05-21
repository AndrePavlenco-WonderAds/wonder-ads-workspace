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
import { AddCallNotesButton } from "./add-call-notes-button";

type Kind = "dos" | "donts" | "notes";

const BROADCAST_CHANNEL = "wa-client-briefs";
const POLL_INTERVAL_MS = 30_000;

function sameBrief(a: Brief, b: Brief): boolean {
  return (
    a.dos.length === b.dos.length &&
    a.donts.length === b.donts.length &&
    a.notes.length === b.notes.length &&
    a.dos.every((v, i) => v === b.dos[i]) &&
    a.donts.every((v, i) => v === b.donts[i]) &&
    a.notes.every((v, i) => v === b.notes[i])
  );
}

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
  const savingRef = useRef(false);

  // On mount, always fetch the latest from KV. The page itself is statically
  // generated / ISR-cached, so the server-rendered brief can be stale — this
  // guarantees the displayed brief matches the live KV record within a tick.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/briefs/${slug}`, { cache: "no-store" });
        if (cancelled || !res.ok) return;
        const fresh = (await res.json()) as Brief;
        if (cancelled || savingRef.current) return;
        if (!sameBrief(fresh, lastSavedRef.current)) {
          lastSavedRef.current = fresh;
          setBrief(fresh);
        }
      } catch {
        /* ignore — polling will retry */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Cross-tab instant sync via BroadcastChannel.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(BROADCAST_CHANNEL);
    ch.onmessage = (e: MessageEvent) => {
      const msg = e.data as { slug?: string; brief?: Brief } | undefined;
      if (!msg || msg.slug !== slug || !msg.brief) return;
      if (savingRef.current) return; // don't clobber an in-flight save
      if (sameBrief(msg.brief, lastSavedRef.current)) return;
      lastSavedRef.current = msg.brief;
      setBrief(msg.brief);
    };
    return () => ch.close();
  }, [slug]);

  // Cross-device backstop: poll every 30s.
  useEffect(() => {
    const id = window.setInterval(async () => {
      if (savingRef.current) return;
      try {
        const res = await fetch(`/api/briefs/${slug}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const fresh = (await res.json()) as Brief;
        if (savingRef.current) return; // re-check after async
        if (!sameBrief(fresh, lastSavedRef.current)) {
          lastSavedRef.current = fresh;
          setBrief(fresh);
        }
      } catch {
        /* ignore network blips */
      }
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [slug]);

  async function persist(next: Brief) {
    setSaving(true);
    savingRef.current = true;
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
      // Broadcast to other tabs (same browser) for instant sync.
      if (typeof BroadcastChannel !== "undefined") {
        const ch = new BroadcastChannel(BROADCAST_CHANNEL);
        ch.postMessage({ slug, brief: saved });
        ch.close();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setBrief(lastSavedRef.current);
    } finally {
      setSaving(false);
      savingRef.current = false;
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
        <div className="ml-auto flex items-center gap-2">
          {saving && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-white/45">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving…
            </span>
          )}
          {error && !saving && (
            <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-300">
              {error}
            </span>
          )}
          <AddCallNotesButton slug={slug} clientName={clientName} />
        </div>
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

      <ul className="relative mt-4 max-h-[42vh] space-y-2 overflow-y-auto pr-1">
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
      <ul className="mt-3 max-h-[42vh] space-y-2 overflow-y-auto pr-1">
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

/** Line-clamp + expand limit. Items longer than this many lines are
 *  collapsed by default; click the `…show more` link to reveal the
 *  full text inline. Clicking the text itself opens the editor. */
const CLAMP_LINES = 3;

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
  void isNote;
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(value);
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const [isClamped, setIsClamped] = useState(false);

  useEffect(() => {
    if (editing && textRef.current) {
      textRef.current.focus();
      // Move caret to end (selecting all wipes intent when the user
      // just wants to tweak — common after Call-Notes adds).
      const end = textRef.current.value.length;
      textRef.current.setSelectionRange(end, end);
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  // Measure whether the (unclamped) text would actually overflow the
  // clamp height — only show "show more" when there's something to
  // show. Re-run when the text or container width changes.
  useEffect(() => {
    if (editing || expanded) return;
    const el = measureRef.current;
    if (!el) return;
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 22;
    const limit = lineHeight * CLAMP_LINES + 2;
    const ro = new ResizeObserver(() => {
      setIsClamped(el.scrollHeight > limit);
    });
    ro.observe(el);
    setIsClamped(el.scrollHeight > limit);
    return () => ro.disconnect();
  }, [value, editing, expanded]);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    } else if (!trimmed) {
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
        <textarea
          ref={textRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          rows={Math.min(6, Math.max(2, draft.split("\n").length))}
          className={`flex-1 resize-y rounded border-0 bg-white/[0.06] px-2 py-1.5 text-sm leading-relaxed text-white outline-none ring-2 ${ringClass} sm:text-base`}
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
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="block w-full cursor-text rounded text-left text-sm leading-relaxed text-white/85 transition hover:bg-white/[0.04] sm:text-base"
          title="Click to edit"
        >
          <span
            ref={measureRef}
            className={
              expanded
                ? "block whitespace-pre-wrap break-words"
                : "block whitespace-pre-wrap break-words [display:-webkit-box] [-webkit-line-clamp:3] [-webkit-box-orient:vertical] overflow-hidden"
            }
          >
            {value}
          </span>
        </button>
        {isClamped && !expanded && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(true);
            }}
            className="mt-0.5 text-[11px] font-medium text-white/45 underline-offset-2 transition hover:text-white/75 hover:underline"
          >
            show more
          </button>
        )}
        {expanded && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(false);
            }}
            className="mt-0.5 text-[11px] font-medium text-white/45 underline-offset-2 transition hover:text-white/75 hover:underline"
          >
            show less
          </button>
        )}
      </div>
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
