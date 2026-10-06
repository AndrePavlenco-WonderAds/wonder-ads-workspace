"use client";

// «Pré-visualizar e enviar»: a página do consultor tal como vai ficar DEPOIS
// do envio — o publicado atual com o item novo por cima, destacado — e o
// botão que envia. Nada sai sem passar por aqui.
//
// Vai para document.body por portal: dentro da PageShell há contentores com
// backdrop-blur, que passariam a ser o bloco de referência do `fixed`.

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Eye, Loader2, Send, X } from "lucide-react";
import { ConsultantPlan } from "./consultant-plan";
import { firstName, type ProbationDraft } from "@/lib/probation/shared";
import {
  applySend,
  sendItemLabel,
  snapshotFor,
  type PublishedPlan,
  type SendItem,
} from "@/lib/probation/published";

export function PreviewModal({
  planId,
  draft,
  periodIndex,
  pub,
  item,
  today,
  blocker,
  sending,
  error,
  onClose,
  onSend,
}: {
  planId: string;
  draft: ProbationDraft;
  periodIndex: number;
  pub: PublishedPlan | null;
  /** null = só ver a página do consultor como está, sem enviar nada. */
  item: SendItem | null;
  today: string;
  /** Porque é que não se pode enviar (sem conta, sem KPIs…). */
  blocker: string | null;
  sending: boolean;
  error: string | null;
  onClose: () => void;
  onSend: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, sending]);

  const merged = useMemo(() => {
    if (!item) return pub;
    const snap = snapshotFor(draft, draft.period, periodIndex, item);
    if (!snap) return pub;
    return applySend(
      pub,
      { ...draft, id: planId, consultantUsername: draft.consultantUsername ?? "preview" },
      periodIndex,
      draft.period.startDate,
      snap,
      "pré-visualização",
      Date.now(),
    );
  }, [pub, draft, periodIndex, item, planId]);

  // Só abre depois de um clique, portanto já no browser.
  if (typeof document === "undefined") return null;
  const name = firstName(draft.consultantName) || "o consultor";

  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#05060a]/95 backdrop-blur-sm" role="dialog" aria-modal="true">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] bg-[#0a0b12] px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#783DF5]/40 bg-[#783DF5]/15 text-[#c3aaff]">
            <Eye className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="readout text-white/40">Pré-visualização · é isto que {name} vai ver</p>
            <p className="truncate text-[14px] font-semibold text-white">
              {item ? `${sendItemLabel(item)} — destacado a roxo` : "A página do consultor, como está agora"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-4 py-2 text-[12.5px] font-medium text-white/70 transition hover:text-white disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            {item ? "Voltar a editar" : "Fechar"}
          </button>
          {item && (
            <button
              type="button"
              onClick={onSend}
              disabled={sending || Boolean(blocker)}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-[13px] font-bold text-white shadow-[0_8px_22px_-8px_rgba(120,61,245,0.8)] transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: "var(--brand-gradient)" }}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar a {name}
            </button>
          )}
        </div>
      </header>

      {(blocker || error) && (
        <div className="flex items-center gap-2 border-b border-amber-400/25 bg-amber-500/10 px-5 py-2.5 text-[12.5px] text-amber-100">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error ?? blocker}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
          {merged ? (
            <ConsultantPlan
              key={item ?? "all"}
              pub={merged}
              today={today}
              mode="preview"
              focus={item ? { periodIndex, item } : undefined}
            />
          ) : (
            <p className="mt-20 text-center text-[13px] text-white/45">
              Ainda não foi enviado nada a {name} — a página dele está vazia.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
