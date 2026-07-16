"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Loader2 } from "lucide-react";

/** SuperAdmin-only overlay button on an SEO client card. Pauses/suspends
 *  the client (PUT) or reactivates it (DELETE) via /api/admin/seo-paused.
 *  Rendered as a sibling of the card <Link>, so clicking it never
 *  navigates. The server route re-checks SuperAdmin — this is UX only. */
export function SeoPauseToggle({
  slug,
  title,
  paused,
}: {
  slug: string;
  title: string;
  paused: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    const verb = paused ? "reativar" : "pausar";
    if (!window.confirm(`Confirmas ${verb} o cliente “${title}”?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/seo-paused/${slug}`, {
        method: paused ? "DELETE" : "PUT",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(data.error || "Falhou a atualização.");
      }
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title={paused ? `Reativar “${title}”` : `Pausar / suspender “${title}”`}
      aria-label={paused ? `Reativar ${title}` : `Pausar ${title}`}
      className={`absolute right-2.5 top-2.5 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full border backdrop-blur-md transition disabled:opacity-50 ${
        paused
          ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:border-emerald-400/70 hover:bg-emerald-500/25"
          : "border-white/15 bg-black/30 text-white/55 opacity-70 hover:border-amber-400/60 hover:bg-amber-500/20 hover:text-amber-200 hover:opacity-100"
      }`}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : paused ? (
        <Play className="h-3.5 w-3.5" />
      ) : (
        <Pause className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
