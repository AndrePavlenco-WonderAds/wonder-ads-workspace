"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Check, Loader2, X } from "lucide-react";
import { CONSULTANT_ORDER } from "@/lib/client-overrides";

/** SuperAdmin-only overlay button on an SEO client card, ao lado do botão de
 *  pausa. Abre um modal para passar o cliente para outro consultor (PUT
 *  /api/admin/seo-consultant). A rota volta a verificar SuperAdmin — isto é
 *  só UX. O modal vai para o document.body por portal: um `fixed` dentro do
 *  cartão ficava preso aos transforms/blur dos antepassados. */
export function SeoConsultantMigrate({
  slug,
  title,
  currentConsultant,
}: {
  slug: string;
  title: string;
  /** Nome da coluna onde o cartão está (pode ser «Por atribuir»). */
  currentConsultant: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        title={`Migrar “${title}” para outro consultor`}
        aria-label={`Migrar ${title} para outro consultor`}
        className="absolute right-11 top-2.5 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white/55 opacity-70 backdrop-blur-md transition hover:border-[#783DF5]/70 hover:bg-[#783DF5]/20 hover:text-white hover:opacity-100"
      >
        <ArrowRightLeft className="h-3.5 w-3.5" />
      </button>
      {open && (
        <MigrateModal
          slug={slug}
          title={title}
          currentConsultant={currentConsultant}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function MigrateModal({
  slug,
  title,
  currentConsultant,
  onClose,
}: {
  slug: string;
  title: string;
  currentConsultant: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const options = CONSULTANT_ORDER.filter((n) => n !== currentConsultant);
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function submit() {
    if (!target || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/seo-consultant/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultant: target }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        warnings?: string[];
      };
      if (!res.ok) throw new Error(data.error || "Falhou a migração.");
      if (data.warnings?.length) window.alert(data.warnings.join("\n"));
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setBusy(false);
    }
  }

  const body = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Migrar ${title}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d14] shadow-2xl"
      >
        <header className="flex items-start gap-3 border-b border-white/8 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">
              Migrar cliente
            </p>
            <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-white">
              {title}
            </h2>
            <p className="mt-1 text-[12px] text-white/50">
              Atualmente com{" "}
              <span className="font-medium text-white/80">
                {currentConsultant}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fechar"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:border-white/30 hover:text-white disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-2 px-5 py-4">
          <p className="text-[12px] text-white/45">Passar para:</p>
          {options.map((name) => {
            const active = target === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setTarget(name)}
                disabled={busy}
                className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm transition ${
                  active
                    ? "border-[#783DF5]/70 bg-[#783DF5]/15 text-white"
                    : "border-white/10 bg-white/[0.03] text-white/75 hover:border-white/25 hover:text-white"
                }`}
              >
                {name}
                {active && <Check className="h-4 w-4 text-[#b9a4ff]" />}
              </button>
            );
          })}
          <p className="pt-2 text-[11px] leading-relaxed text-white/40">
            Muda em todo o lado: coluna na board, roadmaps e weekly reports,
            rodapés «Dúvidas? Envia email a…» das páginas públicas, PDFs/DOCX,
            relatório mensal, NPS e onboarding.
          </p>
          {error && <p className="text-[12px] text-rose-300">{error}</p>}
        </div>

        <footer className="flex justify-end gap-2 border-t border-white/8 bg-black/20 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full px-4 py-1.5 text-[13px] text-white/60 transition hover:text-white disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!target || busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,#343ED7_0%,#783DF5_53.65%,#C535C9_100%)] px-4 py-1.5 text-[13px] font-medium text-white transition hover:brightness-110 disabled:opacity-40"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {target ? `Migrar para ${target}` : "Escolhe um consultor"}
          </button>
        </footer>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
