"use client";

// "Add Call Notes" button + modal flow.
//
// Two-step UI inside one modal:
//   1) Paste view  — Fathom URL (optional) + textarea for the AI summary /
//                    transcript + "Process call" button.
//   2) Suggestions — cards showing Claude's filtered Do/Don't/Note
//                    suggestions; each card has Accept / Decline.
//                    On Accept: PUT the appended brief; the ClientBrief
//                    component picks it up via its SSE channel and the
//                    card disappears.
//
// Suggestions are EPHEMERAL — refreshing the page drops them. That's by
// design: the only persisted artefact is the accepted brief item.

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Loader2,
  PencilLine,
  PhoneCall,
  Sparkles,
  X,
} from "lucide-react";
import type { ClientBrief } from "@/lib/client-briefs";

type Bucket = "dos" | "donts" | "notes";

type Suggestion = {
  id: string;
  bucket: Bucket;
  text: string;
  reasoning: string;
  source: string | null;
  state: "pending" | "accepted" | "declined" | "accepting" | "error";
  error?: string;
};

const BUCKET_LABEL: Record<Bucket, string> = {
  dos: "Do's",
  donts: "Don'ts",
  notes: "Notes",
};

const BUCKET_STYLES: Record<Bucket, { ring: string; chip: string; dot: string }> =
  {
    dos: {
      ring: "border-emerald-400/35 bg-emerald-500/[0.04]",
      chip: "border-emerald-400/40 bg-emerald-500/15 text-emerald-100",
      dot: "bg-emerald-400",
    },
    donts: {
      ring: "border-rose-400/35 bg-rose-500/[0.04]",
      chip: "border-rose-400/40 bg-rose-500/15 text-rose-100",
      dot: "bg-rose-400",
    },
    notes: {
      ring: "border-violet-400/35 bg-violet-500/[0.04]",
      chip: "border-violet-400/40 bg-violet-500/15 text-violet-100",
      dot: "bg-violet-400",
    },
  };

export function AddCallNotesButton({
  slug,
  clientName,
}: {
  slug: string;
  clientName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="brand-gradient-border inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/80 transition hover:bg-white/[0.08] hover:text-white"
        title="Paste the AI summary or transcript of a client call — Claude extracts Do's / Don'ts / Notes suggestions you can accept or decline."
      >
        <PhoneCall className="h-3 w-3 text-[color:var(--brand-purple)]" />
        Add Call Notes
      </button>
      {open && (
        <Modal slug={slug} clientName={clientName} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function Modal({
  slug,
  clientName,
  onClose,
}: {
  slug: string;
  clientName: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"paste" | "suggestions">("paste");
  const [transcript, setTranscript] = useState("");
  const [fathomUrl, setFathomUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showPasteFallback, setShowPasteFallback] = useState(false);
  const [sourceTitle, setSourceTitle] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function processCall() {
    const linkLooksValid =
      /^https:\/\/(www\.)?fathom\.video\/share\/[A-Za-z0-9_-]+/.test(
        fathomUrl.trim(),
      );
    const transcriptReady = transcript.trim().length >= 50;
    if (!linkLooksValid && !transcriptReady) {
      setError(
        "Paste a Fathom share URL OR the AI summary text (≥50 chars).",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/call-notes/${slug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transcript: transcriptReady ? transcript.trim() : undefined,
          fathomUrl: fathomUrl.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        // If the API tells us Fathom isn't wired up — OR the recording
        // simply isn't visible to the Wonder Ads key (recorded in the
        // consultant's own Fathom, or older than the ~250 recent calls) —
        // reveal the paste fallback inline so the consultant can keep
        // working instead of hitting a dead end.
        if (data.code === "no_fathom_key" || data.code === "not_found") {
          setShowPasteFallback(true);
        }
        if (data.code === "not_found") {
          throw new Error(
            "This call isn't visible to the Wonder Ads Fathom key — it was likely recorded in a personal Fathom account (or it's an older call). Paste the AI Summary text below instead, or share the recording with the Wonder Ads team in Fathom and retry.",
          );
        }
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        suggestions: Array<{
          bucket: Bucket;
          text: string;
          reasoning: string;
          source: string | null;
        }>;
        sourceTitle?: string | null;
        fathomFetched?: boolean;
      };
      setSourceTitle(data.sourceTitle ?? null);
      setSuggestions(
        data.suggestions.map((s, i) => ({
          ...s,
          id: `${Date.now()}-${i}`,
          state: "pending",
        })),
      );
      setStep("suggestions");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to process call.");
    } finally {
      setBusy(false);
    }
  }

  async function accept(
    suggestion: Suggestion,
    override?: { text?: string; bucket?: Bucket },
  ) {
    const textToSave = (override?.text ?? suggestion.text).trim();
    const bucketToSave = override?.bucket ?? suggestion.bucket;
    if (!textToSave) return;
    setSuggestions((cur) =>
      cur.map((s) =>
        s.id === suggestion.id
          ? {
              ...s,
              state: "accepting",
              text: textToSave,
              bucket: bucketToSave,
            }
          : s,
      ),
    );
    try {
      // Read current brief, append, PUT. ClientBrief polls + SSE, will
      // pick up the new item live.
      const briefRes = await fetch(`/api/briefs/${slug}`, {
        cache: "no-store",
      });
      if (!briefRes.ok) throw new Error("Couldn't load current brief");
      const brief = (await briefRes.json()) as ClientBrief;
      const next: ClientBrief = {
        ...brief,
        [bucketToSave]: [...brief[bucketToSave], textToSave],
      };
      const put = await fetch(`/api/briefs/${slug}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!put.ok) {
        const data = (await put.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `HTTP ${put.status}`);
      }
      setSuggestions((cur) =>
        cur.map((s) =>
          s.id === suggestion.id ? { ...s, state: "accepted" } : s,
        ),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed.";
      setSuggestions((cur) =>
        cur.map((s) =>
          s.id === suggestion.id ? { ...s, state: "error", error: msg } : s,
        ),
      );
    }
  }

  function decline(id: string) {
    setSuggestions((cur) =>
      cur.map((s) => (s.id === id ? { ...s, state: "declined" } : s)),
    );
  }

  // (deck-level progress is now rendered inside SuggestionDeck — no
  // need for a redundant header pill counter here)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0c] shadow-[0_25px_80px_-20px_rgba(120,61,245,0.5)]"
        style={{ maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — always visible */}
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/8 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <PhoneCall className="h-4 w-4 text-[color:var(--brand-purple)]" />
            <h2 className="text-sm font-medium text-white">
              Add Call Notes — {clientName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-white/55 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {step === "paste" && (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <PasteView
              fathomUrl={fathomUrl}
              setFathomUrl={setFathomUrl}
              transcript={transcript}
              setTranscript={setTranscript}
              busy={busy}
              error={error}
              showPasteFallback={showPasteFallback}
              setShowPasteFallback={setShowPasteFallback}
              onProcess={processCall}
            />
          </div>
        )}
        {step === "suggestions" && (
          <SuggestionDeck
            suggestions={suggestions}
            sourceTitle={sourceTitle}
            onAccept={accept}
            onDecline={decline}
            onBack={() => {
              setStep("paste");
              setSuggestions([]);
              setSourceTitle(null);
            }}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

function PasteView({
  fathomUrl,
  setFathomUrl,
  transcript,
  setTranscript,
  busy,
  error,
  showPasteFallback,
  setShowPasteFallback,
  onProcess,
}: {
  fathomUrl: string;
  setFathomUrl: (v: string) => void;
  transcript: string;
  setTranscript: (v: string) => void;
  busy: boolean;
  error: string | null;
  showPasteFallback: boolean;
  setShowPasteFallback: (v: boolean) => void;
  onProcess: () => void;
}) {
  const linkLooksValid = /^https:\/\/(www\.)?fathom\.video\/share\/[A-Za-z0-9_-]+/.test(
    fathomUrl.trim(),
  );
  const transcriptReady = transcript.trim().length >= 50;
  const canProcess = busy ? false : linkLooksValid || transcriptReady;
  return (
    <div className="space-y-4">
      <p className="text-xs text-white/65 leading-relaxed">
        Paste a <strong className="text-white/85">Fathom share URL</strong> and
        Claude fetches the transcript + AI summary, filters out the
        scheduling / chit-chat parts, and surfaces only items worth adding to
        the Client Brief.
      </p>
      <div>
        <label className="block text-[10px] font-medium uppercase tracking-[0.2em] text-white/55">
          Fathom share URL
        </label>
        <input
          type="url"
          value={fathomUrl}
          onChange={(e) => setFathomUrl(e.target.value)}
          placeholder="https://fathom.video/share/…"
          className="mt-1.5 w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
          disabled={busy}
          autoFocus
        />
        {linkLooksValid && !transcriptReady && (
          <p className="mt-1 text-[10px] text-emerald-300/80">
            ✓ Looks valid — hit Process call.
          </p>
        )}
      </div>

      {!showPasteFallback && (
        <button
          type="button"
          onClick={() => setShowPasteFallback(true)}
          className="text-[11px] text-white/45 underline-offset-2 transition hover:text-white/75 hover:underline"
        >
          Or paste the AI summary text directly →
        </button>
      )}

      {showPasteFallback && (
        <div>
          <label className="block text-[10px] font-medium uppercase tracking-[0.2em] text-white/55">
            AI summary or transcript{" "}
            <span className="text-white/35">(fallback)</span>
          </label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={
              "Paste the AI Summary text from the right panel of the Fathom share page.\n\nOr paste the full transcript — Claude will skim it."
            }
            rows={8}
            className="mt-1.5 w-full resize-y rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2.5 font-mono text-[11px] leading-relaxed text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
            disabled={busy}
          />
          <p className="mt-1 text-[10px] text-white/40">
            {transcript.length.toLocaleString()} chars · min 50, max 60,000 ·
            takes priority over the URL when filled
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onProcess}
          disabled={!canProcess}
          className="inline-flex items-center gap-2 rounded-md bg-gradient-to-br from-[#343ED7] via-[#783DF5] to-[#C535C9] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-[#783DF5]/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {transcriptReady ? "Analysing…" : "Fetching from Fathom…"}
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Process call
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// One-card-at-a-time review deck. Keyboard:
//   ← skip   → approve   E edit
//
// Each suggestion animates in from the right, then animates left (skip)
// or right (approve) on action. Edit replaces the card body with a
// bucket switcher + textarea — consultant can re-bucket and rewrite
// before approval.
function SuggestionDeck({
  suggestions,
  sourceTitle,
  onAccept,
  onDecline,
  onBack,
  onClose,
}: {
  suggestions: Suggestion[];
  sourceTitle: string | null;
  onAccept: (
    s: Suggestion,
    override?: { text?: string; bucket?: Bucket },
  ) => void;
  onDecline: (id: string) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  // Pending = not yet resolved. The deck advances by consuming from
  // here; accepted / declined items just disappear from the visible
  // queue, but stay in the parent's list for the final tally.
  const pending = suggestions.filter((s) => s.state === "pending");
  const inFlight = suggestions.find((s) => s.state === "accepting");
  const current = inFlight ?? pending[0] ?? null;

  const accepted = suggestions.filter((s) => s.state === "accepted").length;
  const declined = suggestions.filter((s) => s.state === "declined").length;
  const total = suggestions.length;
  const positionLabel = current
    ? `${accepted + declined + 1} of ${total}`
    : `${total} of ${total}`;

  const [editing, setEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [editedBucket, setEditedBucket] = useState<Bucket>("dos");
  const [exitDir, setExitDir] = useState<"left" | "right" | null>(null);

  // Reset edit + animation state whenever the current card changes.
  useEffect(() => {
    setEditing(false);
    setEditedText(current?.text ?? "");
    setEditedBucket(current?.bucket ?? "dos");
    setExitDir(null);
  }, [current?.id]);

  const animateOutAndAct = useCallback(
    (dir: "left" | "right", action: () => void) => {
      if (!current) return;
      setExitDir(dir);
      // Match the duration-200 in the card classes.
      window.setTimeout(action, 180);
    },
    [current],
  );

  const skip = useCallback(() => {
    if (!current) return;
    animateOutAndAct("left", () => onDecline(current.id));
  }, [animateOutAndAct, current, onDecline]);

  const approve = useCallback(() => {
    if (!current) return;
    animateOutAndAct("right", () => onAccept(current));
  }, [animateOutAndAct, current, onAccept]);

  const saveAndApprove = useCallback(() => {
    if (!current) return;
    const trimmed = editedText.trim();
    if (!trimmed) return;
    animateOutAndAct("right", () =>
      onAccept(current, { text: trimmed, bucket: editedBucket }),
    );
  }, [animateOutAndAct, current, editedText, editedBucket, onAccept]);

  // Keyboard shortcuts — disabled while editing so typing in the
  // textarea doesn't trigger swipes. Escape on edit cancels edit; on
  // card, parent handles the modal close.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "textarea" || tag === "input") return;
      if (!current) return;
      if (editing) {
        if (e.key === "Escape") {
          e.stopPropagation();
          setEditing(false);
        }
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        skip();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        approve();
      } else if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        setEditing(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, editing, skip, approve]);

  // No suggestions at all — empty state.
  if (total === 0) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-8 text-center">
        <p className="text-sm text-white/75">
          No brief-worthy items found in this call.
        </p>
        <p className="mt-1 text-xs text-white/45">
          Likely just scheduling / status-update content. Try a different call.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/85 transition hover:bg-white/[0.08]"
          >
            ← Try another call
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/85 transition hover:bg-white/[0.08]"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // All done.
  if (!current) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-8 text-center">
        <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15">
          <Check className="h-6 w-6 text-emerald-300" />
        </div>
        <h3 className="text-lg font-semibold text-white">All done</h3>
        <p className="mt-1 text-sm text-white/65">
          {accepted} added to brief · {declined} skipped
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-md border border-white/15 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-white/75 transition hover:bg-white/[0.08] hover:text-white"
          >
            <ArrowLeft className="-mt-0.5 inline-block h-3.5 w-3.5" /> Process
            another call
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-gradient-to-br from-[#343ED7] via-[#783DF5] to-[#C535C9] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-[#783DF5]/25 transition hover:brightness-110"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Scrollable body — source, progress, card */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="space-y-4">
          <div className="space-y-2">
            {sourceTitle && (
              <p className="truncate text-[11px] text-white/40">
                <span className="text-white/65">{sourceTitle}</span>
                <span className="ml-1.5 text-emerald-300/80">
                  · fetched from Fathom
                </span>
              </p>
            )}
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
                {positionLabel}
              </span>
              <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="absolute inset-y-0 left-0 bg-emerald-400/70 transition-all duration-300"
                  style={{ width: `${(accepted / total) * 100}%` }}
                />
                <div
                  className="absolute inset-y-0 bg-white/15 transition-all duration-300"
                  style={{
                    left: `${(accepted / total) * 100}%`,
                    width: `${(declined / total) * 100}%`,
                  }}
                />
              </div>
              <span className="text-[10px] text-white/45">
                <span className="text-emerald-300/85">{accepted}</span>
                <span className="px-0.5">·</span>
                <span className="text-white/45">{declined}</span>
              </span>
            </div>
          </div>

          <SuggestionDeckCard
            suggestion={current}
            editing={editing}
            editedText={editedText}
            setEditedText={setEditedText}
            editedBucket={editedBucket}
            setEditedBucket={setEditedBucket}
            exitDir={exitDir}
          />
        </div>
      </div>

      {/* Fixed footer — action bar + keyboard hint, ALWAYS visible */}
      <footer className="shrink-0 border-t border-white/8 bg-[#0a0a0c] px-5 py-3.5">
        <div className="flex items-stretch gap-2">
          <button
            type="button"
            onClick={skip}
            disabled={editing || current.state === "accepting"}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-white/75 transition hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
            title="Skip (←)"
          >
            <X className="h-4 w-4" />
            Skip
          </button>
          {editing ? (
            <>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-white/75 transition hover:bg-white/[0.08] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveAndApprove}
                disabled={editedText.trim().length === 0}
                className="flex-[1.4] inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-[#343ED7] via-[#783DF5] to-[#C535C9] px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#783DF5]/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                Save &amp; add
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                disabled={current.state === "accepting"}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-2.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                title="Edit before adding (E)"
              >
                <PencilLine className="h-4 w-4" />
                Edit first
              </button>
              <button
                type="button"
                onClick={approve}
                disabled={current.state === "accepting"}
                className="flex-[1.4] inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-emerald-500 via-emerald-500 to-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                title="Add to brief (→)"
              >
                {current.state === "accepting" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Add to brief
              </button>
            </>
          )}
        </div>
        <p className="mt-2 text-center text-[10px] text-white/30">
          ← skip · → add · E edit
        </p>
      </footer>
    </>
  );
}

function SuggestionDeckCard({
  suggestion,
  editing,
  editedText,
  setEditedText,
  editedBucket,
  setEditedBucket,
  exitDir,
}: {
  suggestion: Suggestion;
  editing: boolean;
  editedText: string;
  setEditedText: (v: string) => void;
  editedBucket: Bucket;
  setEditedBucket: (b: Bucket) => void;
  exitDir: "left" | "right" | null;
}) {
  // In edit mode the visual style follows the EDITED bucket (so the
  // user sees the colour change instantly when re-bucketing).
  const displayBucket = editing ? editedBucket : suggestion.bucket;
  const styles = BUCKET_STYLES[displayBucket];
  const animClasses =
    exitDir === "right"
      ? "translate-x-[120%] rotate-3 opacity-0"
      : exitDir === "left"
        ? "-translate-x-[120%] -rotate-3 opacity-0"
        : "translate-x-0 rotate-0 opacity-100";
  return (
    <article
      className={`relative rounded-xl border px-5 py-4 transition-all duration-200 ${styles.ring} ${animClasses}`}
    >
      <div className="flex items-center justify-between">
        {editing ? (
          <BucketPicker value={editedBucket} onChange={setEditedBucket} />
        ) : (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${styles.chip}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
            {BUCKET_LABEL[displayBucket]}
          </span>
        )}
        {suggestion.state === "error" && (
          <span
            className="max-w-[60%] truncate text-[10px] font-medium uppercase tracking-[0.12em] text-rose-300"
            title={suggestion.error}
          >
            {suggestion.error?.slice(0, 80) ?? "Save failed"}
          </span>
        )}
      </div>

      {editing ? (
        <textarea
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          rows={4}
          className="mt-3 w-full resize-y rounded-lg bg-white/[0.04] px-3 py-2.5 text-base leading-snug text-white placeholder:text-white/30 outline-none ring-1 ring-white/10 transition focus:ring-2 focus:ring-amber-400/40"
          autoFocus
        />
      ) : (
        <p className="mt-3 text-base leading-snug text-white">
          {suggestion.text}
        </p>
      )}

      {suggestion.reasoning && (
        <p className="mt-2.5 text-xs leading-relaxed text-white/55">
          <span className="font-medium uppercase tracking-[0.15em] text-white/40">
            Why
          </span>{" "}
          · {suggestion.reasoning}
        </p>
      )}
      {suggestion.source && !editing && (
        <blockquote className="mt-2.5 border-l-2 border-white/15 pl-3 text-[11px] italic leading-relaxed text-white/40">
          &ldquo;{suggestion.source}&rdquo;
        </blockquote>
      )}
    </article>
  );
}

/** Segmented control to re-bucket a suggestion during edit. Shows the
 *  active bucket in its own colour; the others are dimmed. Clicking any
 *  pill swaps the active bucket — the parent card then re-themes itself
 *  via the displayBucket prop. */
function BucketPicker({
  value,
  onChange,
}: {
  value: Bucket;
  onChange: (b: Bucket) => void;
}) {
  const buckets: Bucket[] = ["dos", "donts", "notes"];
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
      {buckets.map((b) => {
        const isActive = b === value;
        const s = BUCKET_STYLES[b];
        return (
          <button
            key={b}
            type="button"
            onClick={() => onChange(b)}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] transition ${
              isActive
                ? `border ${s.chip}`
                : "border border-transparent text-white/45 hover:bg-white/[0.06] hover:text-white/75"
            }`}
          >
            {isActive && (
              <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
            )}
            {BUCKET_LABEL[b]}
          </button>
        );
      })}
    </div>
  );
}
