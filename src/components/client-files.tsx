"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  FolderOpen,
  Upload,
  Link as LinkIcon,
  Plus,
  X,
  Loader2,
  Image as ImageIcon,
  Film,
  ExternalLink,
} from "lucide-react";
import { upload } from "@vercel/blob/client";
import type { ClientFile } from "@/lib/client-files";
import { detectKind } from "@/lib/client-files";

const BROADCAST_CHANNEL = "wa-client-files";
const POLL_INTERVAL_MS = 30_000;

function sameFiles(a: ClientFile[], b: ClientFile[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (f, i) => f.id === b[i].id && f.url === b[i].url && f.name === b[i].name,
  );
}

export function ClientFiles({
  slug,
  clientName,
}: {
  slug: string;
  clientName: string;
}) {
  const [files, setFiles] = useState<ClientFile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addingLink, setAddingLink] = useState(false);
  const lastSavedRef = useRef<ClientFile[]>([]);
  const savingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch the live list on mount — the page is ISR-cached so the server
  // render can be stale.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/files/${slug}`, { cache: "no-store" });
        if (cancelled || !res.ok) return;
        const fresh = (await res.json()) as ClientFile[];
        if (cancelled) return;
        lastSavedRef.current = fresh;
        setFiles(fresh);
      } catch {
        /* polling will retry */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Cross-tab instant sync.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(BROADCAST_CHANNEL);
    ch.onmessage = (e: MessageEvent) => {
      const msg = e.data as { slug?: string; files?: ClientFile[] } | undefined;
      if (!msg || msg.slug !== slug || !msg.files) return;
      if (savingRef.current) return;
      if (sameFiles(msg.files, lastSavedRef.current)) return;
      lastSavedRef.current = msg.files;
      setFiles(msg.files);
    };
    return () => ch.close();
  }, [slug]);

  // Cross-device backstop poll.
  useEffect(() => {
    const id = window.setInterval(async () => {
      if (savingRef.current) return;
      try {
        const res = await fetch(`/api/files/${slug}`, { cache: "no-store" });
        if (!res.ok) return;
        const fresh = (await res.json()) as ClientFile[];
        if (savingRef.current) return;
        if (!sameFiles(fresh, lastSavedRef.current)) {
          lastSavedRef.current = fresh;
          setFiles(fresh);
        }
      } catch {
        /* ignore network blips */
      }
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [slug]);

  const persist = useCallback(
    async (next: ClientFile[]) => {
      setBusy(true);
      savingRef.current = true;
      setError(null);
      try {
        const res = await fetch(`/api/files/${slug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? `Save failed (${res.status})`);
        }
        const saved = (await res.json()) as ClientFile[];
        lastSavedRef.current = saved;
        setFiles(saved);
        if (typeof BroadcastChannel !== "undefined") {
          const ch = new BroadcastChannel(BROADCAST_CHANNEL);
          ch.postMessage({ slug, files: saved });
          ch.close();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
        setFiles(lastSavedRef.current);
      } finally {
        setBusy(false);
        savingRef.current = false;
      }
    },
    [slug],
  );

  async function handleUploadFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setError(null);
    const picked = Array.from(list);
    const added: ClientFile[] = [];
    for (let i = 0; i < picked.length; i++) {
      const file = picked[i];
      try {
        setProgress(
          picked.length > 1
            ? `Uploading ${i + 1}/${picked.length}…`
            : `Uploading ${file.name}…`,
        );
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/files/upload",
        });
        added.push({
          id: crypto.randomUUID(),
          kind: detectKind(file.name),
          name: file.name,
          url: blob.url,
          addedAt: Date.now(),
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : `Upload failed: ${file.name}`,
        );
      }
    }
    setProgress(null);
    if (added.length > 0) {
      const next = [...added, ...files];
      setFiles(next);
      await persist(next);
    }
  }

  function addLink(rawUrl: string, rawName: string) {
    const url = rawUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      setError("Enter a valid URL (must start with http).");
      return;
    }
    setAddingLink(false);
    const next: ClientFile[] = [
      {
        id: crypto.randomUUID(),
        kind: detectKind(url),
        name: rawName.trim() || url,
        url,
        addedAt: Date.now(),
      },
      ...files,
    ];
    setFiles(next);
    persist(next);
  }

  function removeFile(id: string) {
    const next = files.filter((f) => f.id !== id);
    setFiles(next);
    persist(next);
  }

  const uploading = progress !== null;

  return (
    <section aria-label={`Client files for ${clientName}`} className="relative">
      <header className="mb-5 flex flex-wrap items-center gap-2">
        <FolderOpen className="h-4 w-4 text-white/55" strokeWidth={2.25} />
        <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-white/55">
          Client Files
        </h2>

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
          <button
            type="button"
            onClick={() => setAddingLink((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium tracking-tight text-white/75 transition hover:border-white/35 hover:bg-white/[0.06]"
          >
            <LinkIcon className="h-3.5 w-3.5" />
            Add link
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="brand-gradient-bg inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold tracking-tight text-white shadow-[0_4px_18px_-4px_rgba(120,61,245,0.55)] transition hover:opacity-90 disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(e) => {
              handleUploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </header>

      {addingLink && (
        <AddLinkForm
          onCancel={() => setAddingLink(false)}
          onAdd={addLink}
        />
      )}

      <div className="brand-gradient-border rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md">
        {!loaded ? (
          <p className="py-6 text-center text-sm text-white/35">Loading…</p>
        ) : files.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/40">
            No files yet — upload images or videos, or paste a Google Drive
            link. Files stay in sync across the SEO &amp; ADS departments.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {files.map((file) => (
              <FileTile
                key={file.id}
                file={file}
                onRemove={() => removeFile(file.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function FileTile({
  file,
  onRemove,
}: {
  file: ClientFile;
  onRemove: () => void;
}) {
  return (
    <li className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]">
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        title="Remove"
        className="absolute right-1.5 top-1.5 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white/70 opacity-0 backdrop-blur-sm transition hover:bg-black/80 hover:text-white group-hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {file.kind === "image" ? (
        <a href={file.url} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={file.url}
            alt={file.name}
            className="aspect-[4/3] w-full object-cover"
          />
        </a>
      ) : file.kind === "video" ? (
        <video
          src={file.url}
          controls
          preload="metadata"
          className="aspect-[4/3] w-full bg-black object-contain"
        />
      ) : (
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-white/[0.02] transition hover:bg-white/[0.05]"
        >
          <span className="brand-gradient-bg flex h-9 w-9 items-center justify-center rounded-lg shadow-[0_4px_18px_-4px_rgba(120,61,245,0.55)]">
            <LinkIcon className="h-4 w-4 text-white" strokeWidth={2.25} />
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-white/45">
            Open link
            <ExternalLink className="h-3 w-3" />
          </span>
        </a>
      )}

      <div className="flex items-center gap-1.5 border-t border-white/8 px-2.5 py-2">
        {file.kind === "image" && (
          <ImageIcon className="h-3 w-3 shrink-0 text-white/40" />
        )}
        {file.kind === "video" && (
          <Film className="h-3 w-3 shrink-0 text-white/40" />
        )}
        {file.kind === "link" && (
          <LinkIcon className="h-3 w-3 shrink-0 text-white/40" />
        )}
        <span
          className="truncate text-[11px] text-white/65"
          title={file.name}
        >
          {file.name}
        </span>
      </div>
    </li>
  );
}

function AddLinkForm({
  onAdd,
  onCancel,
}: {
  onAdd: (url: string, name: string) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const urlRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    urlRef.current?.focus();
  }, []);

  function submit() {
    if (url.trim()) onAdd(url, name);
  }

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:flex-row sm:items-center">
      <input
        ref={urlRef}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          else if (e.key === "Escape") onCancel();
        }}
        placeholder="Google Drive or file URL (https://…)"
        className="flex-1 rounded-lg border-0 bg-white/[0.06] px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none ring-2 ring-white/15 focus:ring-white/30"
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          else if (e.key === "Escape") onCancel();
        }}
        placeholder="Label (optional)"
        className="rounded-lg border-0 bg-white/[0.06] px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none ring-2 ring-white/15 focus:ring-white/30 sm:w-44"
      />
      <button
        type="button"
        onClick={submit}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-xs font-medium text-white/80 transition hover:border-white/40 hover:bg-white/[0.06]"
      >
        <Plus className="h-3.5 w-3.5" />
        Add
      </button>
    </div>
  );
}
