"use client";

// Cancel / delete a client's onboarding registration from the SuperAdmin
// hub. Two-click confirm inline (no window.confirm — a native modal blocks
// the page and reads as a browser alert rather than part of the suite).
//
// Removes the onboarding record only. It does NOT touch the client's files,
// intake answers or SEO project — a client already promoted onto the board
// stays there; this just takes them off the onboarding list.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, X } from "lucide-react";

export function DeleteOnboardingButton({
  slug,
  title,
}: {
  slug: string;
  title: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/onboarding-clients?slug=${encodeURIComponent(slug)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(json?.error ?? "Não foi possível cancelar.");
      }
      setConfirming(false);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falhou.");
    } finally {
      setBusy(false);
    }
  }

  const working = busy || pending;

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        title={`Cancelar onboarding de ${title}`}
        aria-label={`Cancelar onboarding de ${title}`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-2.5 py-2 text-[13px] font-medium text-white/50 transition hover:border-red-400/45 hover:bg-red-500/10 hover:text-red-200"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {error && (
        <span className="text-[11px] text-red-300/90">{error}</span>
      )}
      <button
        type="button"
        onClick={() => void onDelete()}
        disabled={working}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/45 bg-red-500/15 px-2.5 py-2 text-[12px] font-semibold text-red-100 transition hover:bg-red-500/25 disabled:opacity-60"
      >
        {working ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
        Confirmar
      </button>
      <button
        type="button"
        onClick={() => {
          setConfirming(false);
          setError(null);
        }}
        disabled={working}
        className="inline-flex items-center justify-center rounded-lg border border-white/12 p-2 text-white/50 transition hover:text-white disabled:opacity-60"
        aria-label="Manter onboarding"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
