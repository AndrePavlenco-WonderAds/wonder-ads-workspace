"use client";

// O registo das faltas já lançadas — quem, quando, porquê, e se a pessoa já
// acusou a receção. Uma linha por falta, aberta em detalhe a pedido.
//
// O filtro por classificação existe por uma razão prática: no fim do mês o
// que interessa a RH são as INJUSTIFICADAS, e procurá-las à vista numa lista
// misturada é a forma mais fácil de descontar um dia a mais a alguém.

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, ShieldCheck } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/dates";
import {
  absenceDurationLine,
  absencePeriodLine,
  justifiedLabel,
  type AbsenceRequest,
} from "@/lib/absences-shared";

type Filter = "all" | "unjustified" | "justified";

export function FaltaRegistry({ faltas }: { faltas: AbsenceRequest[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const shown = useMemo(
    () =>
      faltas.filter((f) =>
        filter === "all"
          ? true
          : filter === "justified"
            ? f.justified === true
            : f.justified !== true,
      ),
    [faltas, filter],
  );

  const year = new Date().getFullYear();
  const thisYear = faltas.filter((f) => f.startDate.startsWith(String(year)));
  const unjustifiedDays = thisYear
    .filter((f) => f.justified !== true)
    .reduce((s, f) => s + f.businessDays, 0);

  if (faltas.length === 0) {
    return (
      <section aria-label="Registo de faltas" className="mt-14">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-6 py-10 text-center">
          <ShieldCheck className="mx-auto h-6 w-6 text-emerald-400/50" />
          <p className="mt-3 text-[13.5px] font-semibold text-white/70">
            Nenhuma falta registada
          </p>
          <p className="mx-auto mt-1 max-w-[420px] text-[12px] leading-relaxed text-white/40">
            As faltas que lançares aqui ficam nesta lista, no histórico da pessoa e no
            #ausencias — e entram no resumo mensal que a RH recebe no dia 1.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Registo de faltas" className="mt-14">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-white/85">
            Registo · {faltas.length}
          </h2>
          <p className="tabular mt-0.5 text-[11.5px] text-white/40">
            {unjustifiedDays > 0
              ? `${unjustifiedDays} dias úteis injustificados em ${year}`
              : `Nenhum dia injustificado em ${year}`}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-1">
          {(
            [
              { id: "all", label: "Todas" },
              { id: "unjustified", label: "Injustificadas" },
              { id: "justified", label: "Justificadas" },
            ] as { id: Filter; label: string }[]
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                filter === f.id
                  ? "bg-white/[0.1] text-white"
                  : "text-white/45 hover:text-white/75"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {shown.map((f) => (
          <li key={f.id}>
            <FaltaRow f={f} />
          </li>
        ))}
        {shown.length === 0 && (
          <li className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-6 text-center text-[12px] text-white/40">
            Nenhuma falta com esta classificação.
          </li>
        )}
      </ul>
    </section>
  );
}

function FaltaRow({ f }: { f: AbsenceRequest }) {
  const justified = f.justified === true;
  return (
    <details className="group rounded-xl border border-white/[0.06] bg-white/[0.015] transition open:border-white/[0.12] open:bg-white/[0.03]">
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 marker:content-['']">
        <span
          aria-hidden
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${
            justified ? "bg-emerald-600/70" : "bg-amber-600/80"
          }`}
        >
          {f.name.trim().charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-white/85">
            {f.name} · {f.reasonLabel}
          </span>
          <span className="tabular block truncate text-[10.5px] text-white/40">
            {absencePeriodLine(f)} · {absenceDurationLine(f)}
          </span>
        </span>
        <span
          className={`stamp-static inline-block shrink-0 rounded border-2 px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase tracking-[0.18em] ${
            justified
              ? "border-emerald-400/60 text-emerald-300"
              : "border-amber-400/60 text-amber-300"
          }`}
        >
          {justifiedLabel(f.justified)}
        </span>
        <span className="font-mono shrink-0 text-[10px] font-bold tracking-[0.08em] text-white/30">
          {f.ref}
        </span>
      </summary>
      <div className="border-t border-white/[0.06] px-4 py-3.5">
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <Line label="Departamento" value={`${f.role || "—"} · ${f.dept || "—"}`} />
          <Line
            label="Registada por"
            value={
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                {f.decidedByName ?? "—"}
                {f.decidedAt ? ` · ${formatDateTime(f.decidedAt)}` : ""}
              </span>
            }
          />
          {f.attachment && (
            <Line
              label="Documento"
              value={
                <a
                  href={f.attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-[#c3aaff] underline-offset-2 hover:underline"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {f.attachment.name}
                </a>
              }
            />
          )}
          <Line
            label="Entendido pelo próprio"
            value={
              f.acknowledgedAt ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-300/90">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Sim · {formatDate(f.acknowledgedAt)}
                </span>
              ) : (
                <span className="text-white/40">ainda não</span>
              )
            }
          />
        </div>
        {f.details && (
          <p className="mt-3 border-l-2 border-white/10 pl-3 text-[12px] leading-relaxed text-white/50">
            {f.details}
          </p>
        )}
        <p className="font-signature mt-3 text-[22px] leading-none text-white/40">
          {f.signatureName}
        </p>
      </div>
    </details>
  );
}

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-white/35">
        {label}
      </p>
      <div className="mt-0.5 text-[12.5px] text-white/70">{value}</div>
    </div>
  );
}
