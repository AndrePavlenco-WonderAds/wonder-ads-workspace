"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClipboardList,
  Upload,
  FileText,
  ExternalLink,
  Loader2,
  Trash2,
  RotateCw,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { upload } from "@vercel/blob/client";
import type { OnboardingDoc } from "@/lib/onboarding-store";
import { formatDateLong } from "@/lib/dates";
import { useSeoReadOnly } from "./seo-readonly";

const ACCEPT = ".pdf,.doc,.docx,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown";

export function OnboardingForm({
  slug,
  clientName,
}: {
  slug: string;
  clientName: string;
}) {
  const readOnly = useSeoReadOnly();
  const [doc, setDoc] = useState<OnboardingDoc | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/onboarding/${slug}`, { cache: "no-store" });
        if (cancelled || !res.ok) return;
        const fresh = (await res.json()) as OnboardingDoc | null;
        if (!cancelled) setDoc(fresh);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const persist = useCallback(
    async (next: OnboardingDoc) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/onboarding/${slug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? `Save failed (${res.status})`);
        }
        const saved = (await res.json()) as OnboardingDoc;
        setDoc(saved);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      } finally {
        setBusy(false);
      }
    },
    [slug],
  );

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const file = list[0];
    setError(null);
    setProgress(`Uploading ${file.name}…`);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/files/upload",
      });
      await persist({
        url: blob.url,
        name: file.name,
        contentType: file.type || "application/pdf",
        sizeBytes: file.size ?? null,
        uploadedAt: Date.now(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setProgress(null);
    }
  }

  async function reExtract() {
    setBusy(true);
    setError(null);
    setProgress("Re-running text extraction…");
    try {
      const res = await fetch(`/api/onboarding/${slug}/re-extract`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Re-extract failed (${res.status})`);
      }
      const fresh = (await res.json()) as OnboardingDoc;
      setDoc(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-extract failed");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function removeDoc() {
    if (!doc) return;
    if (
      !window.confirm(
        "Remove this onboarding form? You can upload a new one any time.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/${slug}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setDoc(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  const uploading = progress !== null;

  return (
    <section
      aria-label={`Onboarding form for ${clientName}`}
      className="brand-gradient-border rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md"
    >
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <ClipboardList className="h-4 w-4 text-white/55" strokeWidth={2.25} />
        <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-white/55">
          Onboarding Form
        </h2>
        {loaded && (
          <span
            title={
              doc
                ? "This document is feeding the Keyword Research action and other AI tools."
                : "MISSING — upload the client's onboarding form so AI actions can cite the keywords/competitors the client named."
            }
            className={
              doc
                ? "inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-emerald-300"
                : "animate-heartbeat inline-flex items-center gap-1 rounded-full border border-rose-400/50 bg-rose-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-rose-300"
            }
          >
            <Sparkles className="h-2.5 w-2.5" />
            {doc ? "Feeds AI actions" : "Missing — feeds AI actions"}
          </span>
        )}

        {(busy || uploading) && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-white/45">
            <Loader2 className="h-3 w-3 animate-spin" />
            {progress ?? "Saving…"}
          </span>
        )}
        {error && !busy && !uploading && (
          <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-300">
            {error}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {!readOnly && doc && (
            <>
              <button
                type="button"
                onClick={reExtract}
                disabled={busy || uploading}
                title="Re-run text extraction on the existing file. Use this after the extractor or prompt has been improved — pulls fresh competitor URLs + suggested seed without re-uploading."
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-white/65 transition hover:border-[#783DF5]/45 hover:bg-[#783DF5]/10 hover:text-white disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Re-extract
              </button>
              <button
                type="button"
                onClick={removeDoc}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-white/65 transition hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-200 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:border-white/40 hover:bg-white/[0.06] disabled:opacity-50"
              >
                <RotateCw className="h-3.5 w-3.5" />
                Replace
              </button>
            </>
          )}
          {!readOnly && !doc && (
            <button
              type="button"
              disabled={uploading || !loaded}
              onClick={() => fileInputRef.current?.click()}
              className="brand-gradient-bg inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_4px_18px_-4px_rgba(120,61,245,0.55)] transition hover:opacity-90 disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload onboarding form
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </header>

      {!loaded ? (
        <p className="py-8 text-center text-sm text-white/35">Loading…</p>
      ) : doc ? (
        <FilledState doc={doc} />
      ) : (
        <EmptyState />
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-8 text-center">
      <FileText className="h-7 w-7 text-white/35" strokeWidth={1.5} />
      <p className="max-w-md text-sm text-white/55">
        Upload the client&apos;s onboarding form — the doc that lists their main
        keywords to focus on, target audience, services, geo, brand voice, etc.
      </p>
      <p className="text-[11px] text-white/35">
        PDF, DOC, DOCX, TXT, or MD. Up to 200 MB.
      </p>
    </div>
  );
}

function FilledState({ doc }: { doc: OnboardingDoc }) {
  return (
    <a
      href={doc.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 transition hover:border-white/25 hover:bg-white/[0.05]"
    >
      <span className="brand-gradient-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-[0_4px_18px_-4px_rgba(120,61,245,0.55)]">
        <FileText className="h-5 w-5 text-white" strokeWidth={2.25} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium text-white" title={doc.name}>
            {doc.name}
          </p>
          <ExternalLink className="h-3 w-3 shrink-0 text-white/40 transition group-hover:text-white/70" />
        </div>
        <p className="mt-0.5 text-[11px] text-white/45">
          {prettyType(doc.contentType)}
          {doc.sizeBytes != null && <> · {prettySize(doc.sizeBytes)}</>} ·
          Uploaded {formatDateLong(new Date(doc.uploadedAt))}
        </p>
      </div>
    </a>
  );
}

function prettyType(ct: string): string {
  switch (ct) {
    case "application/pdf":
      return "PDF";
    case "application/msword":
      return "DOC";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "DOCX";
    case "text/plain":
      return "TXT";
    case "text/markdown":
      return "Markdown";
    default:
      return "Document";
  }
}

function prettySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
