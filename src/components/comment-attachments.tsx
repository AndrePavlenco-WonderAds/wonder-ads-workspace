"use client";

// ANEXOS NOS COMENTÁRIOS (v77.33) — tickets e projetos do Web DPT.
//
// Os comentários eram só texto, e metade das conversas de um ajuste é
// «olha este print» ou «o cliente mandou este PDF». O ficheiro sobe direto
// do browser para o Blob (/api/files/upload, o mesmo token dos restantes
// uploads da app — sem limite de body da função), e o comentário só leva
// os URLs. Um comentário pode ser só texto, só anexos, ou os dois.

import { useCallback, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { detectKind } from "@/lib/client-files";
import {
  MAX_COMMENT_ATTACHMENTS,
  type CommentAttachment,
} from "@/lib/web-shared";

type PendingFile = CommentAttachment & {
  uploading: boolean;
  error?: string;
  previewUrl?: string;
};

function kindOf(file: File): CommentAttachment["kind"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  const k = detectKind(file.name);
  return k === "link" ? "document" : k;
}

/** Estado dos ficheiros de UM comentário ainda por enviar. */
export function useCommentAttachments() {
  const [files, setFiles] = useState<PendingFile[]>([]);

  const add = useCallback(
    async (list: FileList | File[] | null) => {
      if (!list) return;
      const slots = Math.max(0, MAX_COMMENT_ATTACHMENTS - files.length);
      const picked = Array.from(list).slice(0, slots);
      if (picked.length === 0) return;
      const now = Date.now();
      const initial: PendingFile[] = picked.map((f, i) => ({
        id: `ca_${now.toString(36)}_${i}_${Math.random().toString(36).slice(2, 5)}`,
        name: f.name || `anexo-${i + 1}`,
        url: "",
        kind: kindOf(f),
        addedAt: now,
        uploading: true,
        previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
      }));
      setFiles((p) => [...p, ...initial]);
      await Promise.all(
        picked.map(async (file, i) => {
          const id = initial[i].id;
          try {
            const blob = await upload(file.name || initial[i].name, file, {
              access: "public",
              handleUploadUrl: "/api/files/upload",
            });
            setFiles((p) =>
              p.map((x) =>
                x.id === id ? { ...x, url: blob.url, uploading: false } : x,
              ),
            );
          } catch (err) {
            setFiles((p) =>
              p.map((x) =>
                x.id === id
                  ? {
                      ...x,
                      uploading: false,
                      error: err instanceof Error ? err.message : "Falhou",
                    }
                  : x,
              ),
            );
          }
        }),
      );
    },
    [files.length],
  );

  const remove = useCallback((id: string) => {
    setFiles((p) => {
      const gone = p.find((x) => x.id === id);
      if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
      return p.filter((x) => x.id !== id);
    });
  }, []);

  const reset = useCallback(() => {
    setFiles((p) => {
      for (const f of p) if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      return [];
    });
  }, []);

  /** Colar um print (Cmd+V) diretamente na caixa do comentário. */
  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const pasted = Array.from(e.clipboardData?.files ?? []);
      if (pasted.length === 0) return;
      e.preventDefault();
      void add(pasted);
    },
    [add],
  );

  const uploading = files.some((f) => f.uploading);
  const ready: CommentAttachment[] = files
    .filter((f) => !f.uploading && !f.error && f.url)
    .map(({ id, name, url, kind, addedAt }) => ({ id, name, url, kind, addedAt }));

  return { files, add, remove, reset, onPaste, uploading, ready };
}

/** Botão do clipe + ficheiros em espera, por baixo da caixa de texto. */
export function CommentAttachmentPicker({
  state,
  disabled,
}: {
  state: ReturnType<typeof useCommentAttachments>;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const full = state.files.length >= MAX_COMMENT_ATTACHMENTS;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          void state.add(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || full}
        title={
          full
            ? `Máximo de ${MAX_COMMENT_ATTACHMENTS} anexos por comentário`
            : "Anexar ficheiros (também podes colar um print)"
        }
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-[11.5px] font-medium text-white/70 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Paperclip className="h-3.5 w-3.5" />
        Anexar
      </button>
      {state.files.map((f) => (
        <span
          key={f.id}
          className={`inline-flex max-w-[200px] items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] ${
            f.error
              ? "border-rose-400/40 bg-rose-500/10 text-rose-100"
              : "border-white/12 bg-white/[0.04] text-white/75"
          }`}
          title={f.error ? `${f.name} — ${f.error}` : f.name}
        >
          {f.uploading ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
          ) : f.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.previewUrl} alt="" className="h-4 w-4 shrink-0 rounded object-cover" />
          ) : (
            <FileText className="h-3 w-3 shrink-0" />
          )}
          <span className="truncate">{f.error ? `Falhou: ${f.name}` : f.name}</span>
          <button
            type="button"
            onClick={() => state.remove(f.id)}
            aria-label={`Remover ${f.name}`}
            className="shrink-0 text-white/45 transition hover:text-white"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

/** Anexos de um comentário já publicado. */
export function CommentAttachmentList({
  attachments,
}: {
  attachments: CommentAttachment[] | undefined;
}) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((a) =>
        a.kind === "image" ? (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block h-20 w-20 overflow-hidden rounded-lg border border-white/10 transition hover:border-white/30"
            title={a.name}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
          </a>
        ) : (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-[220px] items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-2 text-[11px] text-white/75 transition hover:border-white/30 hover:text-white"
            title={a.name}
          >
            <Paperclip className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{a.name}</span>
          </a>
        ),
      )}
    </div>
  );
}
