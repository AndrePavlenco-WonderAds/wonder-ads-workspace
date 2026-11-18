"use client";

// A lista das Fichas do prospect (v80.0): pesquisa, filtro por etapa e um
// cartão por cliente com o que importa à primeira vista — quem vendeu, quem
// recebe, quão preenchida está e se o consultor já a leu.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ClipboardList,
  Hourglass,
  Layers,
  Lock,
  MessagesSquare,
  Search,
  Sparkles,
} from "lucide-react";
import { STAGE_LABEL, prospectPath, type ProspectStage } from "@/lib/prospects/shared";
import { relTime } from "./ui";

export type ProspectIndexItem = {
  slug: string;
  title: string;
  stage: ProspectStage;
  consultant: string | null;
  consultantAvatar: string | null;
  consultantRead: boolean;
  ownerName: string | null;
  ownerAvatar: string | null;
  services: string;
  pct: number;
  notes: number;
  opportunities: number;
  updatedAt: number;
  updatedByName: string | null;
  summary: string;
  forMe: boolean;
  logo: ReactNode;
};

const FILTERS: Array<{ key: "all" | ProspectStage; label: string }> = [
  { key: "all", label: "Todas" },
  { key: "onboarding", label: "Em onboarding" },
  { key: "unassigned", label: "Por atribuir" },
  { key: "assigned", label: "Com consultor" },
  { key: "archived", label: "Arquivadas" },
];

const STAGE_DOT: Record<ProspectStage, string> = {
  onboarding: "#FBBF24",
  unassigned: "#38BDF8",
  assigned: "#34D399",
  archived: "#94A3B8",
};

function Face({ src, name, size = 22 }: { src: string | null; name: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#343ED7] via-[#783DF5] to-[#C535C9] text-[10px] font-semibold text-white ring-2 ring-[#0b0b12]"
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover object-top" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  );
}

export function ProspectsIndex({
  items,
  canWrite,
  renderedAt,
}: {
  items: ProspectIndexItem[];
  canWrite: boolean;
  renderedAt: number;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | ProspectStage>("all");
  const [now, setNow] = useState(renderedAt);
  useEffect(() => setNow(Date.now()), []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const i of items) c[i.stage] = (c[i.stage] ?? 0) + 1;
    return c;
  }, [items]);

  const shown = useMemo(() => {
    const needle = q
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
    return items.filter((i) => {
      if (filter !== "all" && i.stage !== filter) return false;
      if (!needle) return true;
      const hay = `${i.title} ${i.consultant ?? ""} ${i.ownerName ?? ""} ${i.services} ${i.summary}`
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [items, q, filter]);

  const forMe = items.filter((i) => i.forMe).length;

  return (
    <div className="mt-4 sm:mt-8">
      <header className="animate-fade-up flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
            <Lock className="h-3 w-3" />
            Privado · equipa WonderAds
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
            <span className="brand-gradient-text">Fichas do prospect</span>
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-white/55">
            O que o Comercial sabe de cada cliente novo — interesses, prioridades, cross-sells,
            upsells e as notas das reuniões — passado ao consultor que fica com ele.
            {canWrite ? " Cada onboarding criado no C-Suite abre uma ficha aqui." : ""}
          </p>
        </div>
        {forMe > 0 && (
          <span className="inline-flex items-center gap-2 rounded-xl border border-[#783DF5]/40 bg-[#783DF5]/[0.12] px-3 py-2 text-[12.5px] font-semibold text-violet-100">
            <Sparkles className="h-4 w-4" />
            {forMe} ficha{forMe === 1 ? "" : "s"} com novidades para ti
          </span>
        )}
      </header>

      <div className="animate-fade-up mt-7 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Procurar cliente, consultor, comercial…"
            aria-label="Procurar fichas"
            className="w-full rounded-xl border border-white/12 bg-white/[0.04] py-2 pl-9 pr-3 text-[13px] text-white placeholder:text-white/35 outline-none transition focus:border-[#783DF5]/60 focus:bg-white/[0.06]"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.filter((f) => f.key === "all" || counts[f.key]).map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition ${
                filter === f.key ? "border-white/25 bg-white/[0.09] text-white" : "border-white/10 text-white/50 hover:text-white"
              }`}
            >
              {f.key !== "all" && (
                <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: STAGE_DOT[f.key] }} />
              )}
              {f.label}
              <span className="tabular-nums text-white/35">{counts[f.key] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="animate-fade-up mt-8 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-white/12 px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-violet-200">
            <ClipboardList className="h-6 w-6" />
          </span>
          <p className="text-[15px] font-semibold text-white/85">Ainda não há fichas</p>
          <p className="max-w-md text-[13px] text-white/45">
            Uma ficha nasce sempre que um SuperAdmin inicia um onboarding no C-Suite.
          </p>
        </div>
      ) : shown.length === 0 ? (
        <p className="mt-10 text-center text-[13px] text-white/45">Nenhuma ficha com esse filtro.</p>
      ) : (
        <ul className="animate-fade-up mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((i) => (
            <li key={i.slug}>
              <Link
                href={prospectPath(i.slug)}
                className={`group flex h-full flex-col rounded-2xl border bg-white/[0.025] p-5 transition hover:-translate-y-0.5 hover:bg-white/[0.04] ${
                  i.forMe
                    ? "border-[#783DF5]/50 shadow-[0_18px_50px_-24px_rgba(120,61,245,0.9)]"
                    : "border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0">{i.logo}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-[15.5px] font-semibold tracking-tight text-white">{i.title}</h2>
                      {i.forMe && (
                        <span className="brand-gradient-bg shrink-0 rounded-full px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-white">
                          Nova
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-white/50">
                      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: STAGE_DOT[i.stage] }} />
                      {i.stage === "assigned" && i.consultant ? `Cliente · ${i.consultant}` : STAGE_LABEL[i.stage]}
                      {i.services && <span className="truncate text-white/35">· {i.services}</span>}
                    </p>
                  </div>
                </div>

                {i.summary ? (
                  <p className="mt-3.5 line-clamp-3 text-[12.5px] leading-relaxed text-white/60">{i.summary}</p>
                ) : (
                  <p className="mt-3.5 text-[12.5px] italic text-white/30">Sem resumo ainda.</p>
                )}

                <div className="mt-4">
                  <div className="flex items-center justify-between text-[10.5px] text-white/40">
                    <span>Ficha preenchida</span>
                    <span className="font-semibold tabular-nums text-white/65">{i.pct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className={`h-full rounded-full ${i.pct === 100 ? "bg-emerald-400" : "brand-gradient-bg"}`}
                      style={{ width: `${Math.max(i.pct, 3)}%` }}
                    />
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex -space-x-1.5">
                      {i.ownerName && <Face src={i.ownerAvatar} name={i.ownerName} />}
                      {i.consultant && <Face src={i.consultantAvatar} name={i.consultant} />}
                    </span>
                    <span className="truncate text-[11px] text-white/45">
                      {i.ownerName ?? "Sem comercial"}
                      {i.consultant ? ` → ${i.consultant}` : ""}
                    </span>
                    {/* Lida / por ler só quando já há alguma coisa para ler. */}
                    {i.consultant &&
                      i.pct > 0 &&
                      (i.consultantRead ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-label="Lida pelo consultor" />
                      ) : (
                        <Hourglass className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-label="Por ler pelo consultor" />
                      ))}
                  </div>
                  <span className="flex shrink-0 items-center gap-2.5 text-[11px] text-white/40">
                    <span className="inline-flex items-center gap-1" title="Reuniões e notas">
                      <MessagesSquare className="h-3.5 w-3.5" />
                      {i.notes}
                    </span>
                    <span className="inline-flex items-center gap-1" title="Cross-sells e upsells">
                      <Layers className="h-3.5 w-3.5" />
                      {i.opportunities}
                    </span>
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3 text-[10.5px] text-white/35">
                  <span>
                    {i.updatedByName ? `${i.updatedByName} · ` : ""}
                    {i.updatedAt ? relTime(i.updatedAt, now) : "—"}
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-violet-200/70 transition group-hover:text-white">
                    Abrir
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
