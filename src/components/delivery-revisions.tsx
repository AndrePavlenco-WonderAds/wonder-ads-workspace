"use client";

// As LINHAS de entrega prevista — o histórico do que foi prometido, e do
// que passou a ser prometido de cada vez que o trabalho voltou para a mesa.
//
// PORQUE É UMA LISTA E NÃO UM CAMPO QUE SE CORRIGE: a data original é um
// compromisso. Corrigi-la apagava a promessa anterior e, com ela, a única
// prova de que o prazo escorregou — e porquê. Assim vê-se a história toda:
// «entrega a 12, passou para 15 porque faltavam animações, passou para 18
// porque o cliente mudou as cores». Isso é uma conversa que se pode ter com
// o cliente; «a data é 18» não é.
//
// Aparece no cartão lateral de TODOS os projetos e tickets, mesmo vazio,
// porque a ausência de revisões também é informação: este trabalho foi
// entregue à primeira.

import { CalendarClock, CornerDownRight } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/dates";
import type { DeliveryRevision } from "@/lib/web-shared";

export function DeliveryRevisions({
  original,
  revisions: revisionsProp,
}: {
  /** A entrega prevista original — a primeira linha da história. */
  original: string | null;
  /** Pode chegar a undefined de registos gravados antes de este campo
   *  existir. A store hidrata-os na leitura; aqui defende-se na mesma,
   *  porque um cartão lateral em falta é um detalhe e um ecrã em branco
   *  é um ticket que ninguém consegue abrir. */
  revisions: DeliveryRevision[] | undefined;
}) {
  const revisions = revisionsProp ?? [];
  const current =
    revisions.length > 0 ? revisions[revisions.length - 1].date : original;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.13em] text-white/55">
        Entrega prevista
      </h3>

      {current ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-200/90">
          <CalendarClock className="h-3.5 w-3.5" />
          {formatDate(current)}
          {revisions.length > 0 && (
            <span className="text-[10.5px] font-medium text-white/40">
              · {revisions.length}ª revisão
            </span>
          )}
        </p>
      ) : (
        <p className="mt-2 text-[12px] text-amber-200/70">Ainda por definir.</p>
      )}

      {(original || revisions.length > 0) && (
        <ol className="mt-3 space-y-2 border-t border-white/[0.07] pt-3">
          {original && (
            <li className="flex gap-2 text-[11.5px]">
              <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-white/35" />
              <span className="min-w-0">
                <span className="font-medium text-white/75">
                  {formatDate(original)}
                </span>
                <span className="ml-1.5 text-white/40">entrega inicial</span>
              </span>
            </li>
          )}
          {revisions.map((r) => (
            <li key={r.id} className="flex gap-2 text-[11.5px]">
              <CornerDownRight className="mt-[2px] h-3 w-3 shrink-0 text-amber-300/70" />
              <span className="min-w-0">
                <span className="font-medium text-white/85">
                  {formatDate(r.date)}
                </span>
                <span className="ml-1.5 text-white/60">{r.note}</span>
                <span className="mt-0.5 block text-[10px] text-white/30">
                  {r.byName} · {formatDateTime(r.at)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}

      {!original && revisions.length === 0 && (
        <p className="mt-2 text-[10.5px] leading-relaxed text-white/30">
          Cada vez que o trabalho voltar de Client Feedback para In Progress,
          fica aqui uma linha nova com a data e o motivo.
        </p>
      )}
    </div>
  );
}

/** O formulário que a app exige quando o trabalho volta para produção.
 *  Data + motivo, ambos obrigatórios: uma data nova sem explicação não
 *  resolve nada daqui a três semanas, quando alguém perguntar porquê. */
export function DeliveryRevisionPrompt({
  open,
  title,
  date,
  note,
  onDate,
  onNote,
  onCancel,
  onConfirm,
  busy,
  error,
}: {
  open: boolean;
  title: string;
  date: string;
  note: string;
  onDate: (v: string) => void;
  onNote: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  if (!open) return null;
  const ready = Boolean(date && note.trim());
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cancelar"
        onClick={onCancel}
        className="absolute inset-0 h-full w-full cursor-default bg-black/70 backdrop-blur-sm"
      />
      <div className="animate-fade-up relative z-10 w-full max-w-md rounded-2xl border border-white/12 bg-[color:var(--background)] p-5 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.9)]">
        <h2 className="text-[15px] font-semibold text-white">
          Nova entrega prevista
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed text-white/55">
          <span className="text-white/80">{title}</span> volta para produção.
          Diz qual passa a ser a data e o que falta — fica registado como uma
          linha nova, sem apagar a anterior.
        </p>

        <label className="mt-4 block">
          <span className="text-[10.5px] font-medium uppercase tracking-[0.13em] text-white/50">
            Nova data prevista
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => onDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-[13px] text-white outline-none [color-scheme:dark] focus:border-[color:var(--brand-purple)]/60"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-[10.5px] font-medium uppercase tracking-[0.13em] text-white/50">
            O que falta
          </span>
          <textarea
            value={note}
            onChange={(e) => onNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="ex.: Falta animações"
            className="mt-1 w-full resize-y rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-[color:var(--brand-purple)]/60"
          />
        </label>

        {error && (
          <p className="mt-2 rounded-lg border border-rose-400/30 bg-rose-500/[0.08] px-3 py-2 text-[12px] text-rose-100">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/15 px-3.5 py-2 text-[12px] font-medium text-white/75 transition hover:border-white/30 hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!ready || busy}
            className="brand-gradient-bg rounded-lg px-4 py-2 text-[12px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? "A guardar…" : "Guardar e mover"}
          </button>
        </div>
      </div>
    </div>
  );
}
