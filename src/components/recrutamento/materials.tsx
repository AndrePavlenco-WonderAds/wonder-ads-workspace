"use client";

// Os materiais de uma pergunta da entrevista (v80.55) — os PDFs do teste de
// atenção ao detalhe: o do candidato (para enviar na call) e os do
// entrevistador (marcado e soluções). «Ver aqui» abre o PDF dentro da página,
// ao lado da grelha; nunca partilhar o ecrã com estes abertos.

import { useState } from "react";
import { Download, ExternalLink, Eye, EyeOff, FileText, Highlighter, ListChecks, ShieldAlert } from "lucide-react";
import { MATERIALS, materialHref, type MaterialId } from "@/lib/recrutamento/materials";

const ICON: Record<MaterialId, typeof FileText> = {
  "teste-detalhe-candidato": FileText,
  "teste-detalhe-marcado": Highlighter,
  "teste-detalhe-solucoes": ListChecks,
};

export function QuestionMaterials({ ids, tint }: { ids: MaterialId[]; tint: string }) {
  const [preview, setPreview] = useState<MaterialId | null>(null);
  const shown = preview ? MATERIALS[preview] : null;

  return (
    <div className="mt-5 rounded-3xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: tint }}>
        Materiais do exercício
      </p>
      <ul className="mt-3 space-y-2">
        {ids.map((id) => {
          const m = MATERIALS[id];
          const Icon = ICON[id];
          const on = preview === id;
          return (
            <li
              key={id}
              className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border px-3.5 py-3 ${
                m.interviewerOnly ? "border-rose-300/20 bg-rose-500/[0.04]" : "border-white/[0.08] bg-white/[0.02]"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  m.interviewerOnly ? "bg-rose-400/15 text-rose-200" : "bg-white/[0.07] text-white/75"
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-semibold text-white">{m.label}</span>
                  {m.interviewerOnly ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-300/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-rose-200">
                      <ShieldAlert className="h-3 w-3" />
                      Só para ti
                    </span>
                  ) : (
                    <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-200">
                      Para o candidato
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-white/45">{m.hint}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {m.interviewerOnly && (
                  <button
                    type="button"
                    onClick={() => setPreview(on ? null : id)}
                    aria-pressed={on}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11.5px] font-semibold transition ${
                      on ? "border-white/60 bg-white text-[#0c0a18]" : "border-white/12 bg-white/[0.04] text-white/75 hover:text-white"
                    }`}
                  >
                    {on ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {on ? "Fechar" : "Ver aqui"}
                  </button>
                )}
                <a
                  href={materialHref(id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-[11.5px] font-semibold text-white/75 transition hover:text-white"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir
                </a>
                <a
                  href={materialHref(id, true)}
                  aria-label={`Descarregar: ${m.label}`}
                  title="Descarregar o PDF"
                  className="inline-flex items-center rounded-xl border border-white/12 bg-white/[0.04] p-1.5 text-white/75 transition hover:text-white"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
              </span>
            </li>
          );
        })}
      </ul>

      {shown && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-rose-300/25 bg-white">
          <p className="flex items-center gap-1.5 bg-rose-600 px-3 py-1.5 text-[11px] font-semibold text-white">
            <ShieldAlert className="h-3.5 w-3.5" />
            {shown.label} — não partilhes o ecrã com isto aberto.
          </p>
          <iframe title={shown.label} src={`${materialHref(shown.id)}#navpanes=0&view=FitH`} className="block h-[72vh] w-full" />
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-white/40">
        Se partilhares o ecrã na call, partilha só a janela do documento do candidato, nunca esta página.
      </p>
    </div>
  );
}
