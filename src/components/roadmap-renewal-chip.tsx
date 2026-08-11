"use client";

// Chip de RENOVAÇÃO na barra do roadmap, ao lado do «Onboarded».
//
// PORQUE FICA AQUI E NÃO SÓ NO ADMIN: a renovação é a única data do contrato
// que muda o que o consultor faz — nas semanas antes dela o trabalho é
// mostrar resultado, não abrir frentes novas. Estar na barra do roadmap põe
// a data onde o plano é feito, em vez de a deixar numa tabela de finanças
// que o consultor abre uma vez por trimestre.
//
// A CONTAGEM É O PONTO. «Renova a 15/09» não diz nada a quem abre a página a
// meio de uma semana cheia; «faltam 21 dias» diz. Por isso o chip muda de
// cor à medida que se aproxima — âmbar a 30 dias, vermelho a 7 — e continua
// a contar depois de passar, porque uma renovação vencida sem ninguém falar
// com o cliente é a pior das situações e não pode ficar cinzenta.

import { useEffect, useRef, useState } from "react";
import { CalendarClock, Check, Loader2, X } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { RENEWAL_TERMS } from "@/lib/client-renewal-store";

type Props = {
  clientSlug: string;
  initialRenewalDate: string | null;
  initialTermMonths: number;
  readOnly?: boolean;
};

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const target = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function RoadmapRenewalChip({
  clientSlug,
  initialRenewalDate,
  initialTermMonths,
  readOnly = false,
}: Props) {
  const [date, setDate] = useState(initialRenewalDate ?? "");
  const [term, setTerm] = useState<number>(initialTermMonths);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora e com Esc — é um popover, não um modal: não deve
  // prender quem só o abriu para espreitar a data.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function save(patch: { renewalDate?: string | null; termMonths?: number }) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/seo/renewal/${clientSlug}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const left = daysUntil(date || null);
  const tone =
    left === null
      ? "border-white/10 bg-white/[0.02] text-white/55"
      : left < 0
        ? "border-rose-400/45 bg-rose-500/[0.12] text-rose-100"
        : left <= 7
          ? "border-rose-400/35 bg-rose-500/[0.08] text-rose-100/90"
          : left <= 30
            ? "border-amber-400/35 bg-amber-500/[0.08] text-amber-100/90"
            : "border-white/10 bg-white/[0.02] text-white/70";

  const countdown =
    left === null
      ? null
      : left < 0
        ? `há ${Math.abs(left)}d`
        : left === 0
          ? "hoje"
          : `${left}d`;

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => !readOnly && setOpen((v) => !v)}
        disabled={readOnly}
        title={
          date
            ? `Renova a ${formatDate(date)} · contrato de ${term} meses`
            : "Definir a data de renovação do contrato"
        }
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] transition ${tone} ${
          readOnly ? "cursor-default" : "hover:brightness-125"
        }`}
      >
        <CalendarClock className="h-3 w-3 shrink-0 opacity-70" />
        <span className="text-[9px] uppercase tracking-[0.13em] opacity-70">
          Renovação
        </span>
        {date ? (
          <>
            <span className="font-medium">{formatDate(date)}</span>
            <span className="opacity-60">· {term}m</span>
            {countdown && (
              <span className="tabular rounded-full bg-black/25 px-1.5 py-0.5 text-[9px] font-bold">
                {countdown}
              </span>
            )}
          </>
        ) : (
          <span className="font-medium opacity-80">definir</span>
        )}
      </button>

      {open && !readOnly && (
        <div className="absolute left-0 top-full z-40 mt-2 w-64 rounded-xl border border-white/12 bg-[color:var(--background)] p-3 shadow-[0_18px_60px_-12px_rgba(0,0,0,0.8)]">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold text-white">
              Renovação do contrato
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="rounded p-0.5 text-white/40 transition hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <label className="block text-[10px] uppercase tracking-[0.12em] text-white/45">
            Data de renovação
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              void save({ renewalDate: e.target.value || null });
            }}
            className="mt-1 w-full rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-white outline-none [color-scheme:dark] focus:border-[#783DF5]/60"
          />

          <label className="mt-3 block text-[10px] uppercase tracking-[0.12em] text-white/45">
            Renova por
          </label>
          <div className="mt-1 grid grid-cols-4 gap-1">
            {RENEWAL_TERMS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setTerm(m);
                  void save({ termMonths: m });
                }}
                className={`rounded-lg border px-1 py-1.5 text-[11px] font-semibold transition ${
                  term === m
                    ? "border-[#783DF5]/60 bg-[#783DF5]/20 text-white"
                    : "border-white/12 text-white/60 hover:border-white/30 hover:text-white"
                }`}
              >
                {m}m
              </button>
            ))}
          </div>

          <div className="mt-2.5 flex min-h-[16px] items-center gap-1.5 text-[10.5px]">
            {saving && (
              <span className="inline-flex items-center gap-1 text-white/45">
                <Loader2 className="h-3 w-3 animate-spin" /> A guardar…
              </span>
            )}
            {saved && !saving && (
              <span className="inline-flex items-center gap-1 text-emerald-300">
                <Check className="h-3 w-3" /> Guardado
              </span>
            )}
            {error && <span className="text-rose-300">{error}</span>}
            {!saving && !saved && !error && date && (
              <span className="text-white/35">
                Contrato de {term} meses a terminar em {formatDate(date)}.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
