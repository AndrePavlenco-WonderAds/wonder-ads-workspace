"use client";

// "Envie-nos os vossos materiais" card on the PUBLIC onboarding sidebar.
//
// Red and pulsing while empty so it reads as an outstanding ask, green and
// calm once the client has sent anything. Uploads go straight to Vercel Blob
// from the browser (so big videos aren't bound by the serverless body limit);
// the resulting URLs — plus any pasted Drive/press links — are appended to the
// client's file library via /api/onboarding-files/[slug].

import { useCallback, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import {
  FolderUp,
  Check,
  Loader2,
  Link2,
  Plus,
  AlertCircle,
} from "lucide-react";

type Props = {
  slug: string;
  /** Files already sent — decides the initial red/green state. */
  initialCount: number;
};

export function OnboardingFilesRequest({ slug, initialCount }: Props) {
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkValue, setLinkValue] = useState("");
  const [showLink, setShowLink] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const done = count > 0;

  const send = useCallback(
    async (files: { name: string; url: string }[]) => {
      const res = await fetch(`/api/onboarding-files/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files }),
      });
      const json = (await res.json().catch(() => null)) as {
        count?: number;
        error?: string;
      } | null;
      if (!res.ok) throw new Error(json?.error ?? "Falhou o envio.");
      setCount(json?.count ?? count + files.length);
    },
    [slug, count],
  );

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ""; // let the same file be re-picked after an error
    if (picked.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded: { name: string; url: string }[] = [];
      for (let i = 0; i < picked.length; i++) {
        const file = picked[i];
        setProgress(`A enviar ${i + 1}/${picked.length} — ${file.name}`);
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/files/upload",
        });
        uploaded.push({ name: file.name, url: blob.url });
      }
      setProgress("A guardar…");
      await send(uploaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function onAddLink() {
    const url = linkValue.trim();
    if (!url) return;
    const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    setBusy(true);
    setError(null);
    try {
      await send([{ name: withScheme, url: withScheme }]);
      setLinkValue("");
      setShowLink(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Link inválido.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={[
        "relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-colors duration-500",
        done
          ? "border-emerald-500/30 bg-emerald-50"
          : "border-red-500/40 bg-red-50 animate-attention-pulse",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <span
          className={[
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
            done ? "bg-emerald-500/15" : "bg-red-500/15",
          ].join(" ")}
        >
          {done ? (
            <Check className="h-4 w-4 text-emerald-600" strokeWidth={3} />
          ) : (
            <FolderUp className="h-4 w-4 text-red-600" />
          )}
        </span>
        <p
          className={[
            "text-[11px] font-semibold uppercase tracking-[0.14em]",
            done ? "text-emerald-700" : "text-red-600",
          ].join(" ")}
        >
          {done ? "Materiais recebidos" : "Faltam os vossos materiais"}
        </p>
      </div>

      <p className="mt-2.5 text-[13px] leading-relaxed text-black/65">
        {done ? (
          <>
            Recebemos <strong className="font-semibold">{count}</strong>{" "}
            {count === 1 ? "ficheiro" : "ficheiros"}. Pode continuar a
            adicionar — quanto mais tivermos, melhor.
          </>
        ) : (
          <>
            Envie-nos <strong className="font-semibold">tudo</strong> o que
            possa ajudar: fotografias, vídeos, links do Google Drive,
            logótipos, catálogos, revistas, artigos ou menções na imprensa.
            Absolutamente qualquer material é útil.
          </>
        )}
      </p>

      <div className="mt-3.5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          className={[
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-white transition disabled:opacity-60",
            done
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-red-600 hover:bg-red-700",
          ].join(" ")}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Carregar ficheiros
        </button>
        <button
          type="button"
          onClick={() => setShowLink((v) => !v)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-black/12 bg-white px-3 py-2 text-[13px] font-medium text-black/70 transition hover:border-black/25 hover:text-black disabled:opacity-60"
        >
          <Link2 className="h-4 w-4" />
          Colar link
        </button>
      </div>

      {showLink && (
        <div className="mt-2.5 flex gap-2">
          <input
            type="url"
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void onAddLink();
              }
            }}
            placeholder="https://drive.google.com/…"
            className="min-w-0 flex-1 rounded-lg border border-black/12 bg-white px-2.5 py-1.5 text-[13px] text-black outline-none placeholder:text-black/30 focus:border-black/30"
          />
          <button
            type="button"
            onClick={() => void onAddLink()}
            disabled={busy || !linkValue.trim()}
            className="rounded-lg bg-black/85 px-3 py-1.5 text-[13px] font-semibold text-white transition hover:bg-black disabled:opacity-40"
          >
            Adicionar
          </button>
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={onPickFiles}
      />

      {progress && (
        <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-black/55">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {progress}
        </p>
      )}
      {error && (
        <p className="mt-2.5 flex items-start gap-1.5 text-[12px] text-red-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
