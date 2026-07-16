"use client";

// "Marcar como Concluído" toggle on a lesson page. Posts to the public
// progress endpoint and refreshes so the hub + sidebar reflect the change.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, RotateCcw } from "lucide-react";

const BRAND_GRADIENT =
  "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)";

export function OnboardingMarkComplete({
  slug,
  lessonId,
  initialDone,
}: {
  slug: string;
  lessonId: string;
  initialDone: boolean;
}) {
  const router = useRouter();
  const [done, setDone] = useState(initialDone);
  const [pending, start] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function toggle() {
    const nextDone = !done;
    setSaving(true);
    setError(false);
    try {
      const res = await fetch(`/api/onboarding-progress/${slug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lessonId, done: nextDone }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDone(nextDone);
      start(() => router.refresh());
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || pending;

  return (
    <div>
      {done ? (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-black/12 bg-white px-4 py-2.5 text-sm font-semibold text-black/60 transition-all duration-200 hover:bg-black/[0.03] disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          Concluído — marcar como pendente
        </button>
      ) : (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#783DF5]/25 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: BRAND_GRADIENT }}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" strokeWidth={3} />
          )}
          Marcar como Concluído
        </button>
      )}
      {error && (
        <p className="mt-2 text-[12px] text-rose-600">
          Não foi possível guardar. Tente novamente.
        </p>
      )}
    </div>
  );
}
