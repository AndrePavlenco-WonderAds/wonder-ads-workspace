"use client";

// O painel lateral de uma tarefa da Jornada de Cliente (v78.48) — abre à
// direita, como o das notificações, quando se carrega no título da tarefa na
// estrada. Mostra a explicação (parágrafos) e, se a tarefa tiver um processo,
// o passo a passo dele. A direção edita a tarefa aqui mesmo.
//
// Sai para o <body> por portal: o header tem backdrop-blur e prenderia um
// `fixed` à caixa dele.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Download, FileSpreadsheet, MessageCircleQuestion, Pencil, X } from "lucide-react";
import { JOURNEY_GUIDES, MAX_DETAIL_CHARS, type JourneyBlock, type JourneyGuide } from "@/lib/documentacao/jornada";

export type TaskPanel = {
  /** «Mês 2 · Semana 8» */
  where: string;
  /** Abre já no formulário (tarefa nova ou espaço por preencher). */
  editing: boolean;
};

export function JourneyTaskDrawer({
  panel,
  block,
  canEdit,
  busy,
  onSave,
  onClose,
}: {
  /** O estado de abertura — o mesmo objeto enquanto o painel está aberto. */
  panel: TaskPanel | null;
  /** A tarefa, lida dos dados atuais; null = tarefa nova. */
  block: JourneyBlock | null;
  canEdit: boolean;
  busy: boolean;
  onSave: (v: { title: string; detail: string }) => Promise<boolean>;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [editing, setEditing] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => setEditing(Boolean(panel?.editing)), [panel]);

  // Escape fecha, e a página deixa de rolar por trás do painel.
  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [panel, onClose]);

  if (!panel || !mounted) return null;
  const { where } = panel;
  const guide = block?.guide ? JOURNEY_GUIDES[block.guide] : undefined;
  const title = block && !block.placeholder ? block.title : "";
  const paragraphs = (block?.detail ?? "").split(/\n{2,}/).filter(Boolean);

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="journey-task-title">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/55 backdrop-blur-[2px]"
      />
      <aside className="animate-drawer-in absolute inset-y-0 right-0 flex w-full max-w-[600px] flex-col border-l border-white/10 bg-[color:var(--background)] shadow-[-30px_0_80px_-30px_rgba(0,0,0,0.9)]">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-px"
          style={{ background: "linear-gradient(180deg, transparent, rgba(120,61,245,0.7), rgba(197,53,201,0.4), transparent)" }}
        />
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-6 py-5">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[#c4a6ff]">Jornada de Cliente · {where}</p>
            <h2 id="journey-task-title" className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-[-0.015em] text-white">
              {title || (block ? "Tarefa por definir" : "Tarefa nova")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg border border-white/10 p-1.5 text-white/50 transition hover:border-white/25 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {editing && canEdit ? (
          <TaskForm
            key={block?.id ?? "nova"}
            initial={{ title, detail: block?.detail ?? "" }}
            hasGuide={Boolean(guide)}
            busy={busy}
            onCancel={() => (block && !panel.editing ? setEditing(false) : onClose())}
            onSave={async (v) => {
              if (await onSave(v)) {
                if (block) setEditing(false);
                else onClose();
              }
            }}
          />
        ) : (
          <>
            <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
              {paragraphs.length > 0 && (
                <div className="space-y-4 text-[15px] leading-[1.75] text-white/75">
                  {paragraphs.map((p, i) => (
                    <p key={i} className="whitespace-pre-line">
                      {p}
                    </p>
                  ))}
                </div>
              )}
              {guide && <GuideBody guide={guide} />}
              {paragraphs.length === 0 && !guide && (
                <p className="rounded-2xl border border-dashed border-white/15 px-5 py-8 text-center text-[14px] text-white/45">
                  Esta tarefa ainda não tem explicação.
                </p>
              )}
            </div>
            {canEdit && (
              <footer className="border-t border-white/[0.07] px-6 py-4">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1.5 text-[13px] font-medium text-white/80 transition hover:border-white/30 hover:text-white"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar a tarefa
                </button>
              </footer>
            )}
          </>
        )}
      </aside>
    </div>,
    document.body,
  );
}

const INPUT =
  "w-full rounded-xl border border-white/12 bg-[#0b0c18] px-3.5 py-2.5 text-[14px] text-white placeholder:text-white/30 focus:border-[#a78bfa]/70 focus:outline-none";

function TaskForm({
  initial,
  hasGuide,
  busy,
  onCancel,
  onSave,
}: {
  initial: { title: string; detail: string };
  hasGuide: boolean;
  busy: boolean;
  onCancel: () => void;
  onSave: (v: { title: string; detail: string }) => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [detail, setDetail] = useState(initial.detail);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) onSave({ title: title.trim(), detail });
      }}
      className="flex flex-1 flex-col overflow-hidden"
    >
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        <label className="block">
          <span className="text-[13px] font-medium text-white/70">Título</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Site Audit"
            maxLength={90}
            autoFocus
            className={`${INPUT} mt-1.5`}
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-medium text-white/70">Explicação</span>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="O que se faz, como, com quem e o que fica feito no fim."
            maxLength={MAX_DETAIL_CHARS}
            rows={14}
            className={`${INPUT} mt-1.5 resize-y leading-relaxed`}
          />
          <span className="mt-1 block text-[12px] text-white/35">
            Uma linha em branco separa parágrafos.{hasGuide ? " O processo desta tarefa aparece por baixo da explicação." : ""}
          </span>
        </label>
      </div>
      <footer className="flex justify-end gap-2 border-t border-white/[0.07] px-6 py-4">
        <button type="button" onClick={onCancel} className="rounded-lg px-3.5 py-2 text-[13px] text-white/60 hover:text-white">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!title.trim() || busy}
          className="rounded-lg bg-white px-4 py-2 text-[13px] font-semibold text-[#07080d] transition hover:bg-white/90 disabled:opacity-40"
        >
          {busy ? "A guardar…" : "Guardar"}
        </button>
      </footer>
    </form>
  );
}

function GuideBody({ guide }: { guide: JourneyGuide }) {
  return (
    <>
      <div className="space-y-3">
        <p className="text-[15px] leading-relaxed text-white/80">{guide.lead}</p>
        <p className="rounded-2xl border border-[#783DF5]/30 bg-[#783DF5]/[0.08] px-4 py-3 text-[14px] leading-relaxed text-white/75">
          <span className="font-semibold text-white">Porquê: </span>
          {guide.why}
        </p>
      </div>

      <section>
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-white">
          <MessageCircleQuestion className="h-4 w-4 text-[#c4a6ff]" />
          Perguntar ao cliente
        </h3>
        <ul className="mt-3 space-y-2">
          {guide.questions.map((q) => (
            <li key={q} className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-2.5 text-[14px] leading-relaxed text-white/75">
              «{q}»
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-[15px] font-semibold text-white">Como se faz</h3>
        <ol className="mt-3 space-y-3">
          {guide.steps.map((s, i) => (
            <li key={s} className="flex gap-3 text-[14px] leading-relaxed text-white/70">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
                style={{ background: ["#343ED7", "#783DF5", "#9b3ae0", "#C535C9"][i % 4] }}
              >
                {i + 1}
              </span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
      </section>

      {guide.image && (
        <figure>
          <h3 className="text-[15px] font-semibold text-white">Um exemplo</h3>
          {/* Fundo branco: a tabela é uma folha de Excel. Rola na horizontal
              num ecrã estreito em vez de ficar ilegível. */}
          <a
            href={guide.image.src}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir em tamanho real"
            className="mt-3 block overflow-x-auto rounded-xl border border-white/10 bg-white p-2 transition hover:border-white/40"
          >
            <Image
              src={guide.image.src}
              alt={guide.image.alt}
              width={guide.image.width}
              height={guide.image.height}
              sizes="900px"
              className="h-auto w-[900px] max-w-none sm:w-full sm:max-w-full"
            />
          </a>
          <figcaption className="mt-2 text-[12.5px] leading-relaxed text-white/45">
            {guide.image.caption} Carrega na imagem para a ver em tamanho real.
          </figcaption>
        </figure>
      )}

      {guide.download && (
        <a
          href={guide.download.href}
          download
          className="group flex items-center gap-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.07] px-4 py-3.5 transition hover:border-emerald-300/45 hover:bg-emerald-500/[0.11]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20">
            <FileSpreadsheet className="h-5 w-5 text-emerald-200" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-white">{guide.download.label}</span>
            <span className="mt-0.5 block text-[12.5px] leading-snug text-white/55">{guide.download.note}</span>
          </span>
          <Download className="h-4 w-4 shrink-0 text-emerald-200/70 transition group-hover:translate-y-0.5 group-hover:text-emerald-100" />
        </a>
      )}
    </>
  );
}
