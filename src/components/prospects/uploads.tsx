"use client";

// Anexos da Ficha do prospect (v80.0) — sobem direto do browser para o Blob
// (token em /api/prospects/upload, sem o limite de body da função) e a ficha
// só guarda os URLs. Serve as notas (anexos de uma reunião) e o cartão
// «Anexos» da coluna lateral.

import { useCallback, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import {
  FileText,
  Film,
  ImageIcon,
  Loader2,
  Music,
  Paperclip,
  UploadCloud,
  X,
  AlertTriangle,
} from "lucide-react";
import {
  LIMITS,
  attachmentKindOf,
  formatBytes,
  newId,
  type ProspectAttachment,
  type ProspectAttachmentKind,
} from "@/lib/prospects/shared";

export type PendingUpload = {
  id: string;
  name: string;
  kind: ProspectAttachmentKind;
  size: number;
  progress: number;
  url: string | null;
  error: string | null;
  previewUrl: string | null;
};

function safeName(name: string): string {
  const clean = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-120);
  return clean || "ficheiro";
}

/** Uma fila de uploads. `done` são os anexos prontos a gravar na ficha. */
export function useProspectUploads(slug: string, max: number) {
  const [items, setItems] = useState<PendingUpload[]>([]);
  // A fila atual sem passar pelo updater do setState — os uploads arrancam
  // AQUI, fora do updater (em StrictMode o React chama-o duas vezes e cada
  // ficheiro subia em dobro).
  const itemsRef = useRef<PendingUpload[]>([]);
  itemsRef.current = items;

  const add = useCallback(
    (list: FileList | File[] | null) => {
      if (!list) return;
      const slots = Math.max(0, max - itemsRef.current.length);
      const picked = Array.from(list).slice(0, slots);
      if (picked.length === 0) return;
      const fresh: PendingUpload[] = picked.map((f) => ({
        id: newId("up"),
        name: f.name || "ficheiro",
        kind: attachmentKindOf(f.name, f.type),
        size: f.size,
        progress: 0,
        url: null,
        error: f.size > LIMITS.maxUploadBytes ? "Maior do que 200 MB" : null,
        previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
      }));
      itemsRef.current = [...itemsRef.current, ...fresh];
      setItems((cur) => [...cur, ...fresh]);
      fresh.forEach((p, i) => {
        if (p.error) return;
        const file = picked[i];
        upload(`prospects/${slug}/${safeName(file.name)}`, file, {
          access: "public",
          handleUploadUrl: "/api/prospects/upload",
          contentType: file.type || undefined,
          onUploadProgress: ({ percentage }) =>
            setItems((c) => c.map((x) => (x.id === p.id ? { ...x, progress: percentage } : x))),
        })
          .then((blob) =>
            setItems((c) => c.map((x) => (x.id === p.id ? { ...x, url: blob.url, progress: 100 } : x))),
          )
          .catch((err: unknown) =>
            setItems((c) =>
              c.map((x) =>
                x.id === p.id
                  ? { ...x, error: err instanceof Error ? err.message : "Upload falhou" }
                  : x,
              ),
            ),
          );
      });
    },
    [slug, max],
  );

  const remove = useCallback((id: string) => {
    const gone = itemsRef.current.find((x) => x.id === id);
    if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
    setItems((c) => c.filter((x) => x.id !== id));
  }, []);

  const reset = useCallback(() => {
    itemsRef.current.forEach((x) => x.previewUrl && URL.revokeObjectURL(x.previewUrl));
    setItems([]);
  }, []);

  const uploading = items.some((x) => !x.url && !x.error);
  const done: Array<Partial<ProspectAttachment>> = items
    .filter((x) => x.url)
    .map((x) => ({ id: x.id, name: x.name, url: x.url!, kind: x.kind, size: x.size }));

  return { items, add, remove, reset, uploading, done };
}

export const KIND_ICON: Record<ProspectAttachmentKind, React.ComponentType<{ className?: string }>> = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  pdf: FileText,
  document: Paperclip,
};

/** Zona de largar ficheiros + a fila dos que estão a subir. */
export function DropZone({
  onFiles,
  label,
  compact = false,
  disabled = false,
}: {
  onFiles: (files: FileList | null) => void;
  label: string;
  compact?: boolean;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault();
        setOver(false);
        onFiles(e.dataTransfer.files);
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className={`flex w-full items-center justify-center gap-2 rounded-xl border border-dashed text-[12px] transition disabled:cursor-not-allowed disabled:opacity-40 ${
          compact ? "px-3 py-2" : "px-4 py-4"
        } ${
          over
            ? "border-[#783DF5]/70 bg-[#783DF5]/[0.12] text-white"
            : "border-white/15 text-white/45 hover:border-[#783DF5]/45 hover:bg-[#783DF5]/[0.05] hover:text-white"
        }`}
      >
        <UploadCloud className="h-4 w-4" />
        {label}
      </button>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function UploadQueue({
  items,
  onRemove,
}: {
  items: PendingUpload[];
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
      {items.map((x) => {
        const Icon = KIND_ICON[x.kind];
        return (
          <li
            key={x.id}
            className={`relative flex items-center gap-2.5 overflow-hidden rounded-lg border px-2.5 py-2 ${
              x.error ? "border-rose-400/30 bg-rose-500/[0.06]" : "border-white/10 bg-white/[0.03]"
            }`}
          >
            {x.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={x.previewUrl} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-white/60">
                <Icon className="h-4 w-4" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] text-white/85">{x.name}</span>
              <span className={`block text-[10.5px] ${x.error ? "text-rose-200" : "text-white/35"}`}>
                {x.error ? (
                  <span className="inline-flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {x.error}
                  </span>
                ) : x.url ? (
                  `${formatBytes(x.size)} · pronto`
                ) : (
                  `${formatBytes(x.size)} · ${Math.round(x.progress)}%`
                )}
              </span>
            </span>
            {!x.url && !x.error ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-violet-200" />
            ) : (
              <button
                type="button"
                onClick={() => onRemove(x.id)}
                aria-label={`Tirar ${x.name}`}
                className="rounded-md p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {!x.url && !x.error && (
              <span
                aria-hidden
                className="brand-gradient-bg absolute bottom-0 left-0 h-[2px] transition-all"
                style={{ width: `${Math.max(4, x.progress)}%` }}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Um anexo já gravado: miniatura nas imagens, linha nos restantes. */
export function AttachmentTile({
  a,
  right,
  sub,
}: {
  a: ProspectAttachment;
  right?: React.ReactNode;
  sub?: React.ReactNode;
}) {
  const Icon = KIND_ICON[a.kind];
  return (
    <div className="group/att flex items-center gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.025] px-2.5 py-2 transition hover:border-white/20">
      <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-2.5">
        {a.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.url} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-md object-cover" />
        ) : (
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
              a.kind === "pdf" ? "bg-rose-500/10 text-rose-200" : "bg-white/[0.06] text-white/60"
            }`}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-[12px] font-medium text-white/85 group-hover/att:text-white">{a.name}</span>
          <span className="block truncate text-[10.5px] text-white/35">
            {sub ?? formatBytes(a.size)}
          </span>
        </span>
      </a>
      {right}
    </div>
  );
}
