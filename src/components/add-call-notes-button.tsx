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

import { useEffect, useState } from "react";
import {
  Check,
  Loader2,
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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function processCall() {
    if (transcript.trim().length < 50) {
      setError("Paste at least the AI summary — needs ~50 characters minimum.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/call-notes/${slug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transcript: transcript.trim(),
          fathomUrl: fathomUrl.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        suggestions: Array<{
          bucket: Bucket;
          text: string;
          reasoning: string;
          source: string | null;
        }>;
      };
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

  async function accept(suggestion: Suggestion) {
    setSuggestions((cur) =>
      cur.map((s) =>
        s.id === suggestion.id ? { ...s, state: "accepting" } : s,
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
        [suggestion.bucket]: [...brief[suggestion.bucket], suggestion.text],
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

  const pending = suggestions.filter((s) => s.state === "pending").length;
  const accepted = suggestions.filter((s) => s.state === "accepted").length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="brand-gradient-border w-full max-w-2xl overflow-hidden rounded-2xl bg-[#0a0a0a] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-4 border-b border-white/8 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <PhoneCall className="h-4 w-4 text-[color:var(--brand-purple)]" />
            <h2 className="text-sm font-medium text-white">
              Add Call Notes — {clientName}
            </h2>
            {step === "suggestions" && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-white/55">
                {accepted} accepted · {pending} pending
              </span>
            )}
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

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {step === "paste" && (
            <PasteView
              fathomUrl={fathomUrl}
              setFathomUrl={setFathomUrl}
              transcript={transcript}
              setTranscript={setTranscript}
              busy={busy}
              error={error}
              onProcess={processCall}
            />
          )}
          {step === "suggestions" && (
            <SuggestionsView
              suggestions={suggestions}
              onAccept={accept}
              onDecline={decline}
              onBack={() => {
                setStep("paste");
                setSuggestions([]);
              }}
              onClose={onClose}
            />
          )}
        </div>
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
  onProcess,
}: {
  fathomUrl: string;
  setFathomUrl: (v: string) => void;
  transcript: string;
  setTranscript: (v: string) => void;
  busy: boolean;
  error: string | null;
  onProcess: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-white/65 leading-relaxed">
        Paste the <strong className="text-white/85">AI Summary</strong> (or the
        full transcript) from the Fathom share page. Claude filters out the
        scheduling / chit-chat parts and surfaces only items worth adding to
        the Client Brief. Each suggestion gets an Accept / Decline button on
        the next step.
      </p>
      <div>
        <label className="block text-[10px] font-medium uppercase tracking-[0.2em] text-white/55">
          Fathom share URL <span className="text-white/35">(optional)</span>
        </label>
        <input
          type="url"
          value={fathomUrl}
          onChange={(e) => setFathomUrl(e.target.value)}
          placeholder="https://fathom.video/share/…"
          className="mt-1.5 w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
          disabled={busy}
        />
      </div>
      <div>
        <label className="block text-[10px] font-medium uppercase tracking-[0.2em] text-white/55">
          AI summary or transcript
        </label>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder={
            "Paste the AI Summary text from the right panel of the Fathom share page.\n\nOr paste the full transcript — Claude will skim it."
          }
          rows={10}
          className="mt-1.5 w-full resize-y rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2.5 font-mono text-[11px] leading-relaxed text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
          disabled={busy}
        />
        <p className="mt-1 text-[10px] text-white/40">
          {transcript.length.toLocaleString()} chars · min 50, max 60,000
        </p>
      </div>
      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onProcess}
          disabled={busy || transcript.trim().length < 50}
          className="inline-flex items-center gap-2 rounded-md bg-gradient-to-br from-[#343ED7] via-[#783DF5] to-[#C535C9] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-[#783DF5]/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Processing…
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

function SuggestionsView({
  suggestions,
  onAccept,
  onDecline,
  onBack,
  onClose,
}: {
  suggestions: Suggestion[];
  onAccept: (s: Suggestion) => void;
  onDecline: (id: string) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  if (suggestions.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-white/65">
          No brief-worthy items found in this call.
        </p>
        <p className="mt-1 text-xs text-white/45">
          Likely just scheduling / status-update content. Try pasting a different
          call.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/85 transition hover:bg-white/[0.08]"
          >
            ← Try another transcript
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
  return (
    <div className="space-y-3">
      {suggestions.map((s) => (
        <SuggestionCard
          key={s.id}
          suggestion={s}
          onAccept={() => onAccept(s)}
          onDecline={() => onDecline(s.id)}
        />
      ))}
      <div className="flex items-center justify-between gap-2 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/65 transition hover:bg-white/[0.08] hover:text-white"
        >
          ← Process another call
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-gradient-to-br from-[#343ED7] via-[#783DF5] to-[#C535C9] px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg shadow-[#783DF5]/25 transition hover:brightness-110"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  onAccept,
  onDecline,
}: {
  suggestion: Suggestion;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const styles = BUCKET_STYLES[suggestion.bucket];
  const isDone =
    suggestion.state === "accepted" || suggestion.state === "declined";
  return (
    <article
      className={`rounded-xl border px-4 py-3 transition ${styles.ring} ${
        isDone ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] ${styles.chip}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
              {BUCKET_LABEL[suggestion.bucket]}
            </span>
            {suggestion.state === "accepted" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.12em] text-emerald-300">
                <Check className="h-3 w-3" /> Added to brief
              </span>
            )}
            {suggestion.state === "declined" && (
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/40">
                Declined
              </span>
            )}
            {suggestion.state === "error" && (
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-rose-300">
                {suggestion.error?.slice(0, 80) ?? "Save failed"}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm leading-snug text-white">
            {suggestion.text}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-white/55">
            {suggestion.reasoning}
          </p>
          {suggestion.source && (
            <blockquote className="mt-2 border-l-2 border-white/15 pl-2.5 text-[11px] italic leading-relaxed text-white/45">
              &ldquo;{suggestion.source}&rdquo;
            </blockquote>
          )}
        </div>
        {!isDone && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onAccept}
              disabled={suggestion.state === "accepting"}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-emerald-400/40 bg-emerald-500/15 text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
              title="Add this item to the brief"
            >
              {suggestion.state === "accepting" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={onDecline}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-white/[0.04] text-white/65 transition hover:bg-white/[0.08] hover:text-white"
              title="Skip this suggestion"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
