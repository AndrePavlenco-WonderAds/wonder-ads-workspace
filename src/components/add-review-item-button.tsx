"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Plus, Upload, X } from "lucide-react";
import {
  REVIEW_CATEGORIES,
  type ReviewCategory,
} from "@/lib/review-store";
import {
  REVIEW_UPLOAD_ACCEPT,
  fileNameToTask,
  uploadReviewDoc,
} from "@/lib/review-upload";

/** Modal-less inline add — pops a small form, POSTs the new item,
 *  reloads the page so the table refreshes via SSR.
 *
 *  v77.80: o documento pode ser um link colado OU um ficheiro carregado
 *  (PDF, Word, imagem…). O ficheiro sobe logo ao ser escolhido; o link do
 *  Blob passa a ser o doc link da linha e o nome do ficheiro preenche a
 *  Task se ainda estiver vazia. */
export function AddReviewItemButton({
  clientSlug,
  defaultCategory = "Other",
}: {
  clientSlug: string;
  /** Categoria pré-escolhida — os web designers abrem em «Web Design». */
  defaultCategory?: ReviewCategory;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState("");
  const [category, setCategory] = useState<ReviewCategory>(defaultCategory);
  const [docLink, setDocLink] = useState("");
  /** Preenchido quando o doc é um ficheiro carregado — o input do link dá
   *  lugar ao nome do ficheiro. */
  const [docFileName, setDocFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTask("");
    setDocLink("");
    setDocFileName(null);
    setCategory(defaultCategory);
    setError(null);
  }

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const { url, fileName } = await uploadReviewDoc(clientSlug, file);
      setDocLink(url);
      setDocFileName(fileName);
      setTask((t) => (t.trim() ? t : fileNameToTask(fileName)));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Upload failed: ${file.name}`,
      );
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function submit() {
    if (!task.trim() || uploading) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/reviews/${clientSlug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          task,
          category,
          docLink: docLink || undefined,
          docFileName: docFileName ?? undefined,
        }),
      });
      if (res.ok) {
        reset();
        setOpen(false);
        router.refresh();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `HTTP ${res.status}`);
      }
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/85 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
      >
        <Plus className="h-3.5 w-3.5" />
        Add row manually
      </button>
    );
  }
  return (
    <div className="brand-gradient-border w-full rounded-xl bg-white/[0.03] p-3 backdrop-blur-md">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[2fr_1fr_2fr_auto_auto]">
        <input
          type="text"
          autoFocus
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Task name"
          className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/30"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ReviewCategory)}
          className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/30"
        >
          {REVIEW_CATEGORIES.map((c) => (
            <option key={c} value={c} className="bg-[#0a0a0f]">
              {c}
            </option>
          ))}
        </select>
        <div className="flex min-w-0 items-center gap-2">
          {docFileName ? (
            <span
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-emerald-400/30 bg-emerald-400/[0.08] px-2.5 py-1.5 text-xs text-emerald-50"
              title={docFileName}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
              <span className="min-w-0 flex-1 truncate">{docFileName}</span>
              <button
                type="button"
                onClick={() => {
                  setDocLink("");
                  setDocFileName(null);
                }}
                title="Remove file"
                className="shrink-0 rounded p-0.5 text-emerald-100/60 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ) : (
            <input
              type="url"
              value={docLink}
              onChange={(e) => setDocLink(e.target.value)}
              placeholder="Doc link (optional)"
              disabled={uploading}
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/30 disabled:opacity-50"
            />
          )}
          <input
            ref={fileInput}
            type="file"
            accept={REVIEW_UPLOAD_ACCEPT}
            className="hidden"
            onChange={(e) => void pickFile(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            title="Upload a PDF, Word file, image… — the client opens it from the table"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/85 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white disabled:cursor-wait disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {uploading ? "Uploading…" : docFileName ? "Replace" : "Upload file"}
          </button>
        </div>
        <button
          type="button"
          disabled={!task.trim() || saving || uploading}
          onClick={submit}
          className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-br from-[#343ED7] via-[#783DF5] to-[#C535C9] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm shadow-[#783DF5]/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Add
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/65 transition hover:bg-white/[0.08] hover:text-white"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[11px] text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}
