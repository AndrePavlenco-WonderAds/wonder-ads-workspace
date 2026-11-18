"use client";

// Oportunidades da Ficha do prospect (v80.0): cross-sells (outros serviços)
// e upsells (mais do mesmo programa), cada uma com potencial, quando faz
// sentido propor e o estado — de «ideia» a «ganho».

import { useState } from "react";
import { ArrowUpRight, Clock, Layers, Plus, Repeat2, TrendingUp } from "lucide-react";
import {
  OPPORTUNITY_KIND_HINT,
  OPPORTUNITY_KIND_LABEL,
  OPPORTUNITY_POTENTIALS,
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_SUGGESTIONS,
  POTENTIAL_LABEL,
  STATUS_LABEL,
  TIMING_SUGGESTIONS,
  type OpportunityKind,
  type OpportunityPotential,
  type OpportunityStatus,
  type ProspectOpportunity,
} from "@/lib/prospects/shared";
import {
  AutoTextarea,
  Card,
  DeleteButton,
  EditButton,
  GhostButton,
  PersonChip,
  PrimaryButton,
  SectionHead,
  inputClass,
  relTime,
  useDirtyFlag,
  useProspect,
} from "./ui";

const POTENTIAL_STYLE: Record<OpportunityPotential, string> = {
  alta: "border-emerald-400/35 bg-emerald-500/[0.12] text-emerald-200",
  media: "border-amber-400/30 bg-amber-500/[0.1] text-amber-200",
  baixa: "border-white/15 bg-white/[0.05] text-white/55",
};

const STATUS_STYLE: Record<OpportunityStatus, string> = {
  ideia: "border-white/15 bg-white/[0.04] text-white/60",
  proposta: "border-sky-400/35 bg-sky-500/[0.1] text-sky-200",
  ganho: "border-emerald-400/40 bg-emerald-500/[0.14] text-emerald-200",
  perdido: "border-rose-400/30 bg-rose-500/[0.08] text-rose-200/80 line-through decoration-rose-300/40",
};

const KIND_ICON: Record<OpportunityKind, React.ComponentType<{ className?: string }>> = {
  "cross-sell": Repeat2,
  upsell: TrendingUp,
};

type Draft = {
  id?: string;
  kind: OpportunityKind;
  service: string;
  note: string;
  potential: OpportunityPotential;
  timing: string;
  status: OpportunityStatus;
};

function blank(kind: OpportunityKind): Draft {
  return { kind, service: "", note: "", potential: "media", timing: "", status: "ideia" };
}

function Editor({
  initial,
  onDone,
}: {
  initial: Draft;
  onDone: () => void;
}) {
  const { send } = useProspect();
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const dirty =
    d.service !== initial.service ||
    d.note !== initial.note ||
    d.potential !== initial.potential ||
    d.timing !== initial.timing ||
    d.status !== initial.status;
  useDirtyFlag(`opp:${initial.id ?? `new-${initial.kind}`}`, dirty);
  const suggestions = OPPORTUNITY_SUGGESTIONS[d.kind];

  async function save() {
    if (!d.service.trim()) return;
    setBusy(true);
    const ok = await send({ op: "opportunity.save", opportunity: d });
    setBusy(false);
    if (ok) onDone();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      onKeyDown={(e) => e.key === "Escape" && onDone()}
      className="space-y-3 rounded-xl border border-[#783DF5]/30 bg-[#783DF5]/[0.05] p-3.5"
    >
      <div>
        <input
          autoFocus
          value={d.service}
          onChange={(e) => setD({ ...d, service: e.target.value.slice(0, 120) })}
          placeholder={d.kind === "upsell" ? "Que upsell? (ex.: Origem dos pacientes)" : "Que serviço? (ex.: Google Ads)"}
          aria-label="Serviço"
          className={inputClass}
        />
        <div className="mt-1.5 flex flex-wrap gap-1">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setD({ ...d, service: s })}
              className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                d.service === s
                  ? "border-[#783DF5]/60 bg-[#783DF5]/20 text-white"
                  : "border-white/12 text-white/45 hover:border-white/30 hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
            Potencial
          </span>
          <div className="flex gap-1">
            {OPPORTUNITY_POTENTIALS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={d.potential === p}
                onClick={() => setD({ ...d, potential: p })}
                className={`flex-1 rounded-lg border px-2 py-1 text-[11.5px] font-semibold transition ${
                  d.potential === p ? POTENTIAL_STYLE[p] : "border-white/10 text-white/40 hover:text-white/80"
                }`}
              >
                {POTENTIAL_LABEL[p]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
            Estado
          </span>
          <select
            value={d.status}
            onChange={(e) => setD({ ...d, status: e.target.value as OpportunityStatus })}
            aria-label="Estado"
            className={`${inputClass} py-1.5`}
          >
            {OPPORTUNITY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
          Quando faz sentido propor
        </span>
        <input
          value={d.timing}
          onChange={(e) => setD({ ...d, timing: e.target.value.slice(0, 60) })}
          placeholder="ex.: depois dos primeiros resultados, na renovação…"
          aria-label="Quando"
          className={inputClass}
        />
        <div className="mt-1.5 flex flex-wrap gap-1">
          {TIMING_SUGGESTIONS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setD({ ...d, timing: t })}
              className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                d.timing === t
                  ? "border-[#783DF5]/60 bg-[#783DF5]/20 text-white"
                  : "border-white/12 text-white/45 hover:border-white/30 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <AutoTextarea
        value={d.note}
        onChange={(v) => setD({ ...d, note: v.slice(0, 2000) })}
        placeholder="Porquê? O que o cliente disse, sinais de interesse, a quem falar…"
        minRows={2}
        onSubmit={save}
        onCancel={onDone}
        ariaLabel="Nota da oportunidade"
      />

      <div className="flex justify-end gap-2">
        <GhostButton onClick={onDone}>Cancelar</GhostButton>
        <PrimaryButton type="submit" busy={busy} disabled={!d.service.trim() || (!dirty && Boolean(initial.id))}>
          {initial.id ? "Guardar" : "Acrescentar"}
        </PrimaryButton>
      </div>
    </form>
  );
}

function OpportunityCard({ o }: { o: ProspectOpportunity }) {
  const { viewer, send, now } = useProspect();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  if (editing) {
    return (
      <Editor
        initial={{
          id: o.id,
          kind: o.kind,
          service: o.service,
          note: o.note,
          potential: o.potential,
          timing: o.timing,
          status: o.status,
        }}
        onDone={() => setEditing(false)}
      />
    );
  }

  return (
    <article
      className={`group/opp rounded-xl border bg-white/[0.02] p-3.5 transition hover:border-white/20 ${
        o.status === "ganho" ? "border-emerald-400/25" : o.status === "perdido" ? "border-white/[0.05] opacity-70" : "border-white/[0.08]"
      }`}
    >
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 text-[13.5px] font-semibold leading-snug text-white">{o.service}</h3>
        <span className={`shrink-0 rounded-full border px-2 py-px text-[10px] font-semibold uppercase tracking-wide ${POTENTIAL_STYLE[o.potential]}`}>
          {POTENTIAL_LABEL[o.potential]}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {viewer.canWrite ? (
          <select
            value={o.status}
            disabled={busy}
            onChange={async (e) => {
              setBusy(true);
              await send({ op: "opportunity.save", opportunity: { id: o.id, status: e.target.value as OpportunityStatus } });
              setBusy(false);
            }}
            aria-label={`Estado de ${o.service}`}
            className={`cursor-pointer appearance-none rounded-full border px-2.5 py-0.5 text-[11px] font-medium outline-none transition focus:ring-1 focus:ring-[#783DF5]/60 ${STATUS_STYLE[o.status]}`}
          >
            {OPPORTUNITY_STATUSES.map((s) => (
              <option key={s} value={s} className="bg-[#0b0b12] text-white no-underline">
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        ) : (
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE[o.status]}`}>
            {STATUS_LABEL[o.status]}
          </span>
        )}
        {o.timing && (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-white/55">
            <Clock className="h-3 w-3" />
            {o.timing}
          </span>
        )}
      </div>
      {o.note && <p className="mt-2 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-white/65">{o.note}</p>}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1 text-[10.5px] text-white/30">
          <PersonChip username={o.createdBy} size={14} />
          <span className="shrink-0">· {relTime(o.updatedAt ?? o.createdAt, now)}</span>
        </span>
        {viewer.canWrite && (
          <span className="flex shrink-0 items-center opacity-100 transition sm:opacity-0 sm:group-hover/opp:opacity-100 sm:group-focus-within/opp:opacity-100">
            <EditButton onClick={() => setEditing(true)} />
            <DeleteButton onConfirm={() => send({ op: "opportunity.delete", id: o.id })} />
          </span>
        )}
      </div>
    </article>
  );
}

function Column({ kind }: { kind: OpportunityKind }) {
  const { file, viewer } = useProspect();
  const [adding, setAdding] = useState(false);
  const list = file.opportunities.filter((o) => o.kind === kind);
  const Icon = KIND_ICON[kind];
  const open = list.filter((o) => o.status === "ideia" || o.status === "proposta").length;
  return (
    <div className="min-w-0">
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-md ${
            kind === "upsell" ? "bg-emerald-400/10 text-emerald-200" : "bg-sky-400/10 text-sky-200"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h3 title={OPPORTUNITY_KIND_HINT[kind]} className="text-[12px] font-semibold text-white/75">
          {OPPORTUNITY_KIND_LABEL[kind]}s
        </h3>
        {list.length > 0 && (
          <span className="rounded-full bg-white/[0.06] px-1.5 text-[10.5px] font-semibold tabular-nums text-white/55">
            {list.length}
          </span>
        )}
        {open > 0 && <span className="text-[10.5px] text-white/35">· {open} em aberto</span>}
      </div>
      <div className="space-y-2">
        {list.map((o) => (
          <OpportunityCard key={o.id} o={o} />
        ))}
        {adding ? (
          <Editor initial={blank(kind)} onDone={() => setAdding(false)} />
        ) : viewer.canWrite ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-[12.5px] text-white/40 transition hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            {kind === "upsell" ? "Acrescentar upsell" : "Acrescentar cross-sell"}
          </button>
        ) : list.length === 0 ? (
          <p className="text-[12.5px] text-white/25">—</p>
        ) : null}
      </div>
    </div>
  );
}

export function OpportunitiesCard() {
  const { file } = useProspect();
  const won = file.opportunities.filter((o) => o.status === "ganho").length;
  return (
    <Card id="oportunidades">
      <SectionHead
        icon={Layers}
        title="Oportunidades"
        hint="O que o cliente pode vir a comprar — para o consultor saber quando abrir a porta"
        right={
          won > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
              <ArrowUpRight className="h-3 w-3" />
              {won} ganho{won === 1 ? "" : "s"}
            </span>
          ) : null
        }
      />
      <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
        <Column kind="cross-sell" />
        <Column kind="upsell" />
      </div>
    </Card>
  );
}
