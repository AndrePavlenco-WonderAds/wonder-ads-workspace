"use client";

// Tabela de consultores do Superadmin: pesquisa por nome, filtro por módulo e
// ordenação. Recebe as linhas já calculadas no servidor — não faz contas nem
// pedidos, só filtra e ordena o que lhe é dado.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { formatDateTime } from "@/lib/dates";

export type RosterTableRow = {
  username: string;
  name: string;
  role: string;
  dept: string;
  /** Nomes das especializações, já resolvidos no servidor. */
  trackNames: string[];
  trackSlugs: string[];
  derived: boolean;
  percent: number;
  currentLabel: string;
  watched: number;
  totalLessons: number;
  allLessons: number;
  quizzesPassed: number;
  quizzesTotal: number;
  attempts: number;
  failedAttempts: number;
  lastActivity: number;
  /** Exames de fase — o que decide a passagem e a efetividade. */
  examsPassed: number;
  examsTotal: number;
  /** Uma frase: "60 dias — faltam 12 dias", "Efetivo", … */
  examLine: string;
  examEffective: boolean;
  examBlocked: boolean;
};

type SortKey = "percent" | "name" | "activity" | "exams";

export function RosterTable({
  rows,
  trackOptions,
}: {
  rows: RosterTableRow[];
  trackOptions: { slug: string; name: string }[];
}) {
  const [query, setQuery] = useState("");
  const [track, setTrack] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("percent");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (track === "all") {
        // nada
      } else if (track === "none") {
        if (r.trackSlugs.length > 0) return false;
      } else if (!r.trackSlugs.includes(track)) {
        return false;
      }
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.username.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q) ||
        r.dept.toLowerCase().includes(q)
      );
    });
    return out.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "pt");
      if (sort === "activity") return b.lastActivity - a.lastActivity;
      if (sort === "exams")
        return (
          b.examsPassed - a.examsPassed || a.name.localeCompare(b.name, "pt")
        );
      return b.percent - a.percent || a.name.localeCompare(b.name, "pt");
    });
  }, [rows, query, track, sort]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Procurar por nome ou departamento…"
            className="w-full rounded-lg border border-white/12 bg-white/[0.04] py-2 pl-9 pr-3 text-[13px] text-white outline-none transition placeholder:text-white/30 focus:border-[#783DF5]/60"
          />
        </label>
        <select
          value={track}
          onChange={(e) => setTrack(e.target.value)}
          className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-[13px] text-white outline-none transition focus:border-[#783DF5]/60"
        >
          <option value="all">Todos os módulos</option>
          {trackOptions.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
            </option>
          ))}
          <option value="none">Sem especialização</option>
        </select>
        <button
          type="button"
          onClick={() =>
            setSort((s) =>
              s === "percent"
                ? "exams"
                : s === "exams"
                  ? "name"
                  : s === "name"
                    ? "activity"
                    : "percent",
            )
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-2 text-[12.5px] font-medium text-white/60 transition hover:border-white/25 hover:text-white"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {sort === "percent"
            ? "Progresso"
            : sort === "exams"
              ? "Exames"
              : sort === "name"
                ? "Nome"
                : "Atividade"}
        </button>
        <span className="ml-auto text-[11.5px] text-white/40">
          {filtered.length} de {rows.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[1120px] text-left text-[13px]">
          <thead className="bg-white/[0.03] text-[10.5px] uppercase tracking-[0.12em] text-white/45">
            <tr>
              <th className="px-4 py-3 font-semibold">Consultor</th>
              <th className="px-4 py-3 font-semibold">Especializações</th>
              <th className="px-4 py-3 font-semibold">Progresso</th>
              <th className="px-4 py-3 font-semibold">Capítulo atual</th>
              <th className="px-4 py-3 font-semibold">Aulas</th>
              <th className="px-4 py-3 font-semibold">Quizzes</th>
              <th className="px-4 py-3 font-semibold">Exames</th>
              <th className="px-4 py-3 font-semibold">Última atividade</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.username}
                className="border-t border-white/8 transition hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/formacao/admin/${r.username}`}
                    className="group flex items-center gap-2.5"
                  >
                    <span className="brand-gradient-bg flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white">
                      {r.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-white transition group-hover:text-[#c3aaff]">
                        {r.name}
                      </span>
                      <span className="block text-[10.5px] text-white/40">
                        {r.role} · {r.dept}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {r.trackNames.length === 0 ? (
                    <span className="text-white/30">—</span>
                  ) : (
                    <span className="flex flex-wrap items-center gap-1.5">
                      {r.trackNames.map((n) => (
                        <span
                          key={n}
                          className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[11.5px] text-white/70"
                        >
                          {n}
                        </span>
                      ))}
                      {r.derived && (
                        <span className="text-[10px] uppercase tracking-wide text-white/25">
                          por dept
                        </span>
                      )}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="brand-gradient-bg h-1.5 rounded-full"
                        style={{ width: `${r.percent}%` }}
                      />
                    </div>
                    <span className="text-[12px] font-semibold text-white/80">
                      {r.percent}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-white/60">{r.currentLabel}</td>
                <td className="px-4 py-3 text-white/60">
                  {r.watched} de {r.allLessons}
                </td>
                <td className="px-4 py-3">
                  <span className="text-white/60">
                    {r.quizzesPassed}/{r.quizzesTotal}
                  </span>
                  {r.failedAttempts > 0 && (
                    <span
                      title={`${r.failedAttempts} tentativa(s) chumbada(s)`}
                      className="ml-1.5 rounded-full bg-rose-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300"
                    >
                      {r.failedAttempts} ✗
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5">
                    {r.examEffective ? (
                      <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                    ) : r.examBlocked ? (
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-rose-300" />
                    ) : null}
                    <span
                      className={`tabular font-semibold ${
                        r.examEffective
                          ? "text-emerald-300"
                          : r.examBlocked
                            ? "text-rose-300"
                            : "text-white/70"
                      }`}
                    >
                      {r.examsPassed}/{r.examsTotal}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[10.5px] text-white/35">
                    {r.examLine}
                  </span>
                </td>
                <td className="tabular px-4 py-3 text-white/50">
                  {r.lastActivity ? (
                    formatDateTime(r.lastActivity)
                  ) : (
                    <span className="inline-flex items-center gap-1 text-white/30">
                      <TrendingUp className="h-3 w-3" />
                      ainda não começou
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-[13px] text-white/40"
                >
                  Ninguém corresponde a este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
