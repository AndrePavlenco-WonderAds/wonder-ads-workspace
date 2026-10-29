"use client";

// O registo da Folga de custos (v78.37): mês a mês, a folga que entrou, cada
// extra (oferecido ou cobrado), as mudanças da folga mensal e as anulações.
// Nada sai do registo — um extra anulado fica riscado, com o motivo.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CircleDollarSign,
  Clock,
  FileText,
  Globe,
  Link2,
  ListTodo,
  Loader2,
  MapPin,
  Palette,
  Settings2,
  Sparkles,
  Ticket,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { formatDate } from "@/lib/dates";
import {
  categoryLabel,
  eurCents,
  folgaLinkHref,
  folgaMonthName,
  monthOf,
  toCents,
  type FolgaAllowance,
  type FolgaCategory,
  type FolgaEntry,
  type FolgaMonth,
} from "@/lib/seo-folga";

const ICON: Record<FolgaCategory, LucideIcon> = {
  conteudo: FileText,
  design: Palette,
  backlinks: Link2,
  wikipedia: Globe,
  ferramentas: Wrench,
  horas: Clock,
  visita: MapPin,
  outro: Sparkles,
};

const FILTERS = [
  { id: "all", label: "Tudo" },
  { id: "folga", label: "Saiu da folga" },
  { id: "cobrado", label: "Cobrado" },
  { id: "voided", label: "Anulados" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

type Props = {
  slug: string;
  months: FolgaMonth[];
  entries: FolgaEntry[];
  allowances: FolgaAllowance[];
  me: string;
  isAdmin: boolean;
  readOnly: boolean;
};

export function FolgaLog({ slug, months, entries, allowances, me, isAdmin, readOnly }: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  const shown = useMemo(
    () =>
      entries.filter((e) =>
        filter === "all" ? true : filter === "voided" ? Boolean(e.voided) : !e.voided && e.kind === filter,
      ),
    [entries, filter],
  );
  const counts = {
    all: entries.length,
    folga: entries.filter((e) => !e.voided && e.kind === "folga").length,
    cobrado: entries.filter((e) => !e.voided && e.kind === "cobrado").length,
    voided: entries.filter((e) => e.voided).length,
  };

  return (
    <section className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-white">Registo do projeto</h2>
        <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`rounded-lg px-2.5 py-1 text-[12.5px] transition ${
                filter === f.id ? "bg-white/[0.12] text-white" : "text-white/50 hover:text-white"
              }`}
            >
              {f.label}
              <span className="ml-1 tabular-nums text-white/35">{counts[f.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-7">
        {[...months].reverse().map((m, i) => {
          const inMonth = shown
            .filter((e) => monthOf(e.date) === m.key)
            .sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at);
          const changes = filter === "all" ? allowances.filter((a) => a.from === m.key) : [];
          const live = i === 0;
          return (
            <div key={m.key}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/[0.07] pb-2">
                <p className="text-[14px] font-semibold capitalize text-white">
                  {folgaMonthName(m.key)} {m.key.slice(0, 4)}
                  {live && <span className="ml-2 text-[12px] font-medium normal-case text-[#c4a6ff]">em curso</span>}
                </p>
                <p className="text-[12.5px] tabular-nums text-white/45">
                  abriu {eurCents(m.opening)} · +{eurCents(m.credit)}
                  {m.spent > 0 && ` · −${eurCents(m.spent)}`} ·{" "}
                  <span className={m.closing < 0 ? "text-rose-200" : "text-white/75"}>
                    {live ? "fica" : "fechou"} {eurCents(m.closing)}
                  </span>
                </p>
              </div>
              <ul className="divide-y divide-white/[0.05]">
                {inMonth.map((e) => (
                  <EntryRow
                    key={e.id}
                    slug={slug}
                    entry={e}
                    canVoid={!readOnly && !e.voided && (isAdmin || e.by.username === me)}
                  />
                ))}
                {changes.map((a) => (
                  <li key={`a-${a.at}`} className="flex items-start gap-3 py-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
                      <Settings2 className="h-3.5 w-3.5 text-white/55" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] text-white/80">
                        Folga mensal passa a <span className="font-semibold">{eurCents(toCents(a.eur))}</span>
                      </p>
                      <p className="text-[12px] text-white/40">
                        {a.by.name} · {formatDate(a.at)}
                      </p>
                    </div>
                  </li>
                ))}
                {filter === "all" && m.credit > 0 && (
                  <li className="flex items-center gap-3 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/12">
                      <CircleDollarSign className="h-3.5 w-3.5 text-emerald-300" />
                    </span>
                    <p className="min-w-0 flex-1 text-[13.5px] text-white/70">
                      Folga de {folgaMonthName(m.key)}
                      <span className="block text-[12px] text-white/40">entrou a 01/{m.key.slice(5)}/{m.key.slice(0, 4)}</span>
                    </p>
                    <span className="text-[14px] font-semibold tabular-nums text-emerald-300">+{eurCents(m.credit)}</span>
                  </li>
                )}
                {inMonth.length === 0 && changes.length === 0 && !(filter === "all" && m.credit > 0) && (
                  <li className="py-3 text-[13px] text-white/35">Nada neste mês.</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EntryRow({ slug, entry: e, canVoid }: { slug: string; entry: FolgaEntry; canVoid: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Icon = ICON[e.category];
  const cents = toCents(e.eur);

  async function voidIt() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/seo/folga/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: e.id, reason }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Não foi possível anular.");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="flex items-start gap-3 py-3">
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          e.voided ? "bg-white/[0.04]" : e.kind === "folga" ? "bg-[#783DF5]/20" : "bg-sky-500/15"
        }`}
      >
        <Icon className={`h-3.5 w-3.5 ${e.voided ? "text-white/30" : e.kind === "folga" ? "text-[#c4a6ff]" : "text-sky-300"}`} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-[13.5px] ${e.voided ? "text-white/35 line-through" : "text-white/90"}`}>{e.title}</p>
        <p className="text-[12px] text-white/40">
          {categoryLabel(e.category)} · {e.by.name} · {formatDate(`${e.date}T12:00:00`)}
          {e.kind === "cobrado" && !e.voided && <span className="ml-1.5 rounded-full bg-sky-500/15 px-1.5 py-px text-[10.5px] font-medium text-sky-200">cobrado ao cliente</span>}
        </p>
        {e.link && (
          <Link
            href={folgaLinkHref(slug, e.link)}
            className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11.5px] text-white/65 transition hover:border-white/25 hover:text-white"
          >
            {e.link.kind === "ticket" ? <Ticket className="h-3 w-3 shrink-0" /> : <ListTodo className="h-3 w-3 shrink-0" />}
            <span className="truncate">{e.link.label}</span>
          </Link>
        )}
        {e.note && <p className="mt-1 text-[12.5px] leading-snug text-white/55">{e.note}</p>}
        {e.voided && (
          <p className="mt-1 text-[12px] text-rose-200/70">
            Anulado por {e.voided.name} a {formatDate(e.voided.at)}: {e.voided.reason}
          </p>
        )}
        {canVoid && !open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-1 text-[12px] text-white/35 underline-offset-2 transition hover:text-rose-200 hover:underline"
          >
            Anular
          </button>
        )}
        {open && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              autoFocus
              value={reason}
              onChange={(ev) => setReason(ev.target.value)}
              placeholder="Porque anulas?"
              maxLength={300}
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[13px] text-white placeholder:text-white/30 focus:border-rose-300/50 focus:outline-none"
            />
            <button
              type="button"
              onClick={voidIt}
              disabled={saving || reason.trim().length < 3}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/20 px-3 py-1.5 text-[12.5px] font-medium text-rose-100 transition hover:bg-rose-500/30 disabled:opacity-40"
            >
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              Anular extra
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-[12.5px] text-white/45 hover:text-white">
              Cancelar
            </button>
            {error && <p className="w-full text-[12px] text-rose-300">{error}</p>}
          </div>
        )}
      </div>
      <span
        className={`shrink-0 text-[14px] font-semibold tabular-nums ${
          e.voided ? "text-white/30 line-through" : e.kind === "folga" ? "text-white" : "text-sky-200/80"
        }`}
      >
        {e.kind === "folga" ? `−${eurCents(cents)}` : eurCents(cents)}
      </span>
    </li>
  );
}
