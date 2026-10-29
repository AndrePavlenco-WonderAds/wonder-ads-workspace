"use client";

// A lista de uma página de Protocolos (v78.46) — Obrigatórios ou Recomendados.
// Lê-se como um documento: número, protocolo, frequência e o que é, separados
// por linhas finas. A direção (SuperAdmin, sem «Ver como») edita aqui mesmo:
// acrescenta, muda, reordena e remove. Cada mudança grava logo.

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { MAX_PROTOCOLS, PROTOCOL_CADENCES, newProtocolId, type Protocol, type ProtocolDoc } from "@/lib/documentacao/protocolos";
import { useDocSave } from "./use-doc-save";

const GRADIENT = "linear-gradient(135deg,#343ED7,#783DF5 55%,#C535C9)";

export function ProtocolListEditor({
  doc,
  initial,
  canEdit,
  tone,
}: {
  /** «protocolos-obrigatorios» | «protocolos-recomendados» */
  doc: string;
  initial: ProtocolDoc;
  canEdit: boolean;
  tone: "obrigatorio" | "recomendado";
}) {
  const { data, save, saving, error, clearError } = useDocSave(doc, initial);
  const [editing, setEditing] = useState(false);
  /** undefined = nenhum formulário; null = a acrescentar; id = a editar. */
  const [form, setForm] = useState<string | null | undefined>(undefined);
  const items = data.items;

  const commit = async (next: Protocol[]) => save({ items: next });
  const saveItem = async (id: string | null, v: Omit<Protocol, "id">) => {
    const next = id ? items.map((p) => (p.id === id ? { ...p, ...v } : p)) : [...items, { id: newProtocolId(), ...v }];
    if (await commit(next)) setForm(undefined);
  };
  const move = (i: number, dir: -1 | 1) => {
    const next = [...items];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    void commit(next);
  };

  return (
    <div>
      {canEdit && (
        <div className="mb-5 flex flex-wrap items-center justify-end gap-3">
          <span className="text-[12px] text-white/40" aria-live="polite">
            {saving ? "A guardar…" : data.updatedBy ? `Editado por ${data.updatedBy} a ${formatDate(data.updatedAt)}` : "Lista de partida"}
          </span>
          <button
            type="button"
            onClick={() => {
              setEditing((e) => !e);
              setForm(undefined);
            }}
            aria-pressed={editing}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5] ${
              editing ? "bg-white text-[#07080d] hover:bg-white/90" : "border border-white/15 bg-white/[0.04] text-white/80 hover:border-white/30 hover:text-white"
            }`}
          >
            {editing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            {editing ? "Terminar edição" : "Editar a lista"}
          </button>
        </div>
      )}
      {error && (
        <div role="alert" className="mb-5 flex items-start justify-between gap-3 rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-[13.5px] text-rose-100">
          {error}
          <button type="button" onClick={clearError} aria-label="Fechar aviso" className="text-rose-200/70 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {items.length === 0 && form !== null && (
        <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-[14px] text-white/45">Ainda não há protocolos nesta lista.</p>
      )}

      <ol className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
        {items.map((p, i) =>
          form === p.id ? (
            <li key={p.id} className="py-5">
              <ProtocolForm initial={p} busy={saving} onCancel={() => setForm(undefined)} onSave={(v) => saveItem(p.id, v)} />
            </li>
          ) : (
            <li key={p.id} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-4 py-6 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:gap-x-6">
              <span
                aria-hidden
                className={`pt-0.5 text-[2rem] font-semibold leading-none tabular-nums tracking-[-0.04em] sm:text-[2.6rem] ${
                  tone === "obrigatorio" ? "bg-clip-text text-transparent" : "text-[#a78bfa]/55"
                }`}
                style={tone === "obrigatorio" ? { backgroundImage: GRADIENT } : undefined}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <h3 className="text-[17px] font-semibold leading-snug text-white sm:text-[18px]">{p.title}</h3>
                {p.detail && <p className="mt-1.5 max-w-2xl text-[14.5px] leading-relaxed text-white/60">{p.detail}</p>}
                {p.cadence && (
                  <span className="mt-3 inline-flex rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-0.5 text-[12px] font-medium text-white/70 sm:hidden">
                    {p.cadence}
                  </span>
                )}
              </div>
              <div className="col-start-2 mt-3 flex items-start gap-2 sm:col-start-3 sm:mt-0">
                {p.cadence && (
                  <span
                    className={`hidden whitespace-nowrap rounded-full border px-3 py-1 text-[12.5px] font-medium sm:inline-flex ${
                      tone === "obrigatorio" ? "border-[#783DF5]/45 bg-[#783DF5]/[0.14] text-[#e4d9ff]" : "border-white/12 bg-white/[0.04] text-white/70"
                    }`}
                  >
                    {p.cadence}
                  </span>
                )}
                {editing && (
                  <span className="flex items-center gap-1">
                    <IconButton label="Subir" icon={ArrowUp} disabled={i === 0 || saving} onClick={() => move(i, -1)} />
                    <IconButton label="Descer" icon={ArrowDown} disabled={i === items.length - 1 || saving} onClick={() => move(i, 1)} />
                    <IconButton label="Editar o protocolo" icon={Pencil} onClick={() => setForm(p.id)} />
                    <RemoveButton onConfirm={() => void commit(items.filter((x) => x.id !== p.id))} />
                  </span>
                )}
              </div>
            </li>
          ),
        )}
        {form === null && (
          <li className="py-5">
            <ProtocolForm busy={saving} onCancel={() => setForm(undefined)} onSave={(v) => saveItem(null, v)} />
          </li>
        )}
      </ol>

      {editing && form === undefined && items.length < MAX_PROTOCOLS && (
        <button
          type="button"
          onClick={() => setForm(null)}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/20 py-3 text-[13px] font-medium text-white/60 transition hover:border-white/40 hover:text-white"
        >
          <Plus className="h-4 w-4" />
          Acrescentar protocolo
        </button>
      )}
    </div>
  );
}

const INPUT =
  "w-full rounded-xl border border-white/12 bg-[#0b0c18] px-3 py-2 text-[14px] text-white placeholder:text-white/30 focus:border-[#a78bfa]/70 focus:outline-none";

function ProtocolForm({
  initial,
  busy,
  onCancel,
  onSave,
}: {
  initial?: Protocol;
  busy: boolean;
  onCancel: () => void;
  onSave: (v: Omit<Protocol, "id">) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [cadence, setCadence] = useState(initial?.cadence ?? "");
  const [detail, setDetail] = useState(initial?.detail ?? "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) onSave({ title: title.trim(), cadence: cadence.trim(), detail: detail.trim() });
      }}
      className="space-y-2.5 rounded-2xl border border-[#783DF5]/45 bg-[#783DF5]/[0.07] p-4"
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="O protocolo — o que se faz" maxLength={120} autoFocus className={INPUT} aria-label="Protocolo" />
      <div>
        <input value={cadence} onChange={(e) => setCadence(e.target.value)} placeholder="Frequência" maxLength={40} className={INPUT} aria-label="Frequência" />
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {PROTOCOL_CADENCES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCadence(c)}
              className={`rounded-full border px-2.5 py-0.5 text-[12px] transition ${
                cadence === c ? "border-white/50 bg-white/[0.1] text-white" : "border-white/10 text-white/55 hover:text-white"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="Como se cumpre e porquê"
        maxLength={600}
        rows={3}
        className={`${INPUT} resize-y`}
        aria-label="Descrição"
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1.5 text-[12.5px] text-white/60 hover:text-white">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!title.trim() || busy}
          className="rounded-lg bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-[#07080d] transition hover:bg-white/90 disabled:opacity-40"
        >
          {busy ? "A guardar…" : initial ? "Guardar" : "Acrescentar"}
        </button>
      </div>
    </form>
  );
}

function IconButton({
  label,
  icon: Icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: typeof Pencil;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-white/55 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/** Remover em dois toques: o primeiro arma, o segundo confirma (4 s). */
function RemoveButton({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return armed ? (
    <button
      type="button"
      onClick={() => {
        setArmed(false);
        onConfirm();
      }}
      className="inline-flex h-8 items-center gap-1 rounded-lg bg-rose-500/90 px-2.5 text-[12px] font-semibold text-white transition hover:bg-rose-500"
    >
      <Trash2 className="h-3.5 w-3.5" />
      Remover
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setArmed(true)}
      aria-label="Remover o protocolo"
      title="Remover o protocolo"
      className="flex h-8 w-8 items-center justify-center rounded-lg text-white/55 transition hover:bg-rose-500/20 hover:text-rose-200"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
