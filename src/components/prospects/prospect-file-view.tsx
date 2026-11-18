"use client";

// FICHA DO PROSPECT — a página. Estado da ficha, envio das operações à API,
// aviso de edições por gravar e atualização sozinha quando outra pessoa grava.
//
// v80.2 — MENOS PARA O OLHO (pedido do André: «está muita coisa para o
// olho»). A v80.0 tinha 12 cartões seguidos em duas colunas. Agora:
//   • um topo compacto (quem é, etapa, Comercial → Consultor, % e o próximo
//     passo — uma só linha de «o que falta»);
//   • SEPARADORES: Visão geral (o essencial da passagem) · Reuniões ·
//     Contexto · Ficheiros · Histórico — só se vê uma coisa de cada vez;
//   • secções vazias numa linha «+ Escrever…», explicações nos tooltips.
// O separador fica no endereço (#reunioes…) para se poder partilhar.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  ClipboardList,
  Copy,
  Eye,
  Hourglass,
  Lightbulb,
  ListOrdered,
  Loader2,
  Lock,
  ShieldAlert,
  Swords,
  Target,
} from "lucide-react";
import {
  NOTE_TYPE_COLOR,
  NOTE_TYPE_LABEL,
  STAGE_LABEL,
  prospectCompleteness,
  type ProspectFile,
  type ProspectStage,
} from "@/lib/prospects/shared";
import type { ProspectOp } from "@/lib/prospects/ops";
import { formatDate, formatDateTime } from "@/lib/dates";
import {
  Avatar,
  Card,
  ProspectCtx,
  SectionHead,
  personOf,
  relTime,
  useProspect,
  type PersonView,
  type ProspectCtxValue,
  type ProspectViewer,
} from "./ui";
import { ActivityCard, InterestTags, LinksCard, PrioritiesList, ProfileCard, TextBlock } from "./sections";
import { OpportunitiesCard } from "./opportunities";
import { TimelineCard } from "./timeline";
import { FilesCard } from "./files-card";

export type ProspectContextView = {
  slug: string;
  title: string;
  services: string[];
  servicesLabel: string;
  stage: ProspectStage;
  consultant: string | null;
  consultantUsername: string | null;
  onBoard: boolean;
  onboardingCreatedAt: number | null;
  onboardingPublicPath: string | null;
};

export type OwnerOption = { username: string; name: string; group: string };

const STAGE_DOT: Record<ProspectStage, string> = {
  onboarding: "#FBBF24",
  unassigned: "#38BDF8",
  assigned: "#34D399",
  archived: "#94A3B8",
};

const POLL_MS = 45_000;

type TabKey = "geral" | "reunioes" | "contexto" | "ficheiros" | "historico";
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "geral", label: "Visão geral" },
  { key: "reunioes", label: "Reuniões" },
  { key: "contexto", label: "Contexto" },
  { key: "ficheiros", label: "Ficheiros" },
  { key: "historico", label: "Histórico" },
];
const TAB_KEYS = new Set<string>(TABS.map((t) => t.key));

/** Onde vive cada item do «o que falta» — separador + secção. */
const MISSING_TARGET: Record<string, [TabKey, string]> = {
  summary: ["geral", "resumo"],
  interests: ["geral", "interesses"],
  priorities: ["geral", "prioridades"],
  opportunities: ["geral", "oportunidades"],
  notes: ["reunioes", "reunioes"],
  profile: ["contexto", "perfil"],
  expectations: ["contexto", "sucesso"],
  concerns: ["contexto", "cuidados"],
};

export function ProspectFileView({
  ctx,
  initialFile,
  initialReads,
  viewer,
  people,
  owners,
  renderedAt,
  logo,
  loadFailed,
}: {
  ctx: ProspectContextView;
  initialFile: ProspectFile;
  initialReads: Record<string, number>;
  viewer: ProspectViewer;
  people: Record<string, PersonView>;
  owners: OwnerOption[];
  renderedAt: number;
  logo: ReactNode;
  loadFailed: boolean;
}) {
  const [file, setFile] = useState<ProspectFile>(initialFile);
  const [reads, setReads] = useState(initialReads);
  const [now, setNow] = useState(renderedAt);
  const [saving, setSaving] = useState(0);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("geral");
  const dirty = useRef(new Set<string>());

  // Relógio para os «há 5 min» — de minuto a minuto chega.
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // O separador vem do endereço (#reunioes…) e volta para lá a cada troca.
  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (TAB_KEYS.has(h)) setTab(h as TabKey);
  }, []);
  const goTo = useCallback((next: TabKey, anchor?: string) => {
    setTab(next);
    window.history.replaceState(null, "", `#${next}`);
    if (anchor) {
      window.setTimeout(() => {
        document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    }
  }, []);

  // Aviso ao sair com uma edição por gravar.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current.size === 0) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const setDirty = useCallback((key: string, on: boolean) => {
    if (on) dirty.current.add(key);
    else dirty.current.delete(key);
  }, []);

  // Outra pessoa a escrever na mesma ficha: puxa a versão nova quando a aba
  // volta a ter foco e de 45 em 45 s — mas nunca por cima de uma edição
  // aberta (o rascunho de quem está a escrever ganha).
  const refresh = useCallback(async () => {
    if (dirty.current.size > 0 || document.visibilityState !== "visible") return;
    try {
      const res = await fetch(`/api/prospects/${encodeURIComponent(ctx.slug)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { file: ProspectFile | null; reads: Record<string, number> };
      if (dirty.current.size > 0) return;
      if (data.file && data.file.updatedAt > 0) {
        setFile((cur) => (data.file!.updatedAt >= cur.updatedAt ? data.file! : cur));
      }
      setReads(data.reads ?? {});
    } catch {
      /* rede em baixo — fica a versão que temos */
    }
  }, [ctx.slug]);

  useEffect(() => {
    const t = setInterval(refresh, POLL_MS);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const send = useCallback(
    async (op: ProspectOp): Promise<boolean> => {
      setSaving((n) => n + 1);
      setError(null);
      try {
        const res = await fetch(`/api/prospects/${encodeURIComponent(ctx.slug)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(op),
        });
        const data = (await res.json().catch(() => ({}))) as { file?: ProspectFile; error?: string };
        if (!res.ok || !data.file) {
          setError(data.error ?? `Não foi possível gravar (HTTP ${res.status}).`);
          return false;
        }
        setFile(data.file);
        setSavedAt(Date.now());
        return true;
      } catch {
        setError("Sem ligação — a alteração não foi gravada.");
        return false;
      } finally {
        setSaving((n) => n - 1);
      }
    },
    [ctx.slug],
  );

  const value: ProspectCtxValue = useMemo(
    () => ({ slug: ctx.slug, file, viewer, people, send, setDirty, now }),
    [ctx.slug, file, viewer, people, send, setDirty, now],
  );

  const fileCount =
    file.links.length +
    file.files.length +
    file.notes.reduce((n, x) => n + x.attachments.length + (x.callUrl ? 1 : 0), 0);
  const counts: Partial<Record<TabKey, number>> = {
    reunioes: file.notes.length,
    ficheiros: fileCount,
  };

  return (
    <ProspectCtx.Provider value={value}>
      <SaveToast saving={saving > 0} savedAt={savedAt} error={error} onClose={() => setError(null)} />
      <Hero ctx={ctx} logo={logo} owners={owners} reads={reads} loadFailed={loadFailed} goTo={goTo} />

      {/* Separadores — só uma parte da ficha de cada vez. */}
      <nav
        aria-label="Partes da ficha"
        className="sticky top-[4.5rem] z-20 mt-5 flex justify-center sm:top-[5.25rem]"
      >
        <div
          role="tablist"
          className="flex max-w-full gap-0.5 overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0b0b12]/90 p-1 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9)] [scrollbar-width:none]"
        >
          {TABS.map((t) => {
            const active = tab === t.key;
            const n = counts[t.key];
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => goTo(t.key)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[12.5px] font-medium transition ${
                  active ? "bg-white/[0.1] text-white" : "text-white/50 hover:text-white"
                }`}
              >
                {t.label}
                {n ? (
                  <span
                    className={`rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${
                      active ? "bg-white/15 text-white/80" : "bg-white/[0.07] text-white/45"
                    }`}
                  >
                    {n}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="mx-auto mt-5 max-w-5xl" role="tabpanel">
        {tab === "geral" && (
          <div className="space-y-5">
            <Card id="resumo" tone="brand">
              <SectionHead
                icon={Lightbulb}
                title="Em 30 segundos"
                tone="brand"
                hint="O essencial para o consultor arrancar sem voltar a perguntar ao cliente"
              />
              <TextBlock
                field="summary"
                large
                minRows={4}
                placeholder="Quem é o cliente, porque nos escolheu, o que tem de correr bem nos primeiros 90 dias e o que nunca pode acontecer."
                emptyCta="Escrever o resumo"
              />
            </Card>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card id="prioridades">
                <SectionHead icon={ListOrdered} title="Prioridades" hint="Por ordem — a 1 é a que o consultor ataca primeiro" />
                <PrioritiesList />
              </Card>
              <Card id="interesses">
                <SectionHead icon={Target} title="Interesses" hint="O que o cliente quer tirar do programa — com as palavras dele" />
                <InterestTags />
                <TextBlock
                  field="interests"
                  placeholder="ex.: quer aparecer no Google Maps em Cascais para «fisioterapia desportiva»; ficou entusiasmado com a parte das IAs…"
                  emptyCta="Descrever os interesses"
                />
              </Card>
            </div>

            <OpportunitiesCard />

            <LatestMeeting onOpen={() => goTo("reunioes")} />
          </div>
        )}

        {tab === "reunioes" && (
          <TimelineCard />
        )}

        {tab === "contexto" && (
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <ProfileCard />
            <Card>
              <div id="sucesso" className="scroll-mt-32">
                <SectionHead icon={BadgeCheck} title="Expectativas e sucesso" hint="O que, para o cliente, conta como ter corrido bem" />
                <TextBlock
                  field="expectations"
                  minRows={3}
                  placeholder="ex.: +30% de marcações em 6 meses; ficar à frente da clínica X em «osteopatia lisboa»…"
                  emptyCta="Escrever as expectativas"
                />
              </div>
              <div id="cuidados" className="mt-5 scroll-mt-32 border-t border-white/[0.06] pt-5">
                <SectionHead
                  icon={ShieldAlert}
                  title="Cuidados e sensibilidades"
                  tone="amber"
                  hint="Objeções, más experiências com outras agências, temas a evitar"
                />
                <TextBlock
                  field="concerns"
                  minRows={3}
                  placeholder="ex.: teve uma má experiência com outra agência — quer relatórios simples e reuniões curtas…"
                  emptyCta="Escrever os cuidados"
                />
              </div>
              <div id="concorrencia" className="mt-5 scroll-mt-32 border-t border-white/[0.06] pt-5">
                <SectionHead icon={Swords} title="Concorrência" hint="Quem o cliente vê como concorrente ou como exemplo" />
                <TextBlock
                  field="competitors"
                  minRows={3}
                  placeholder="ex.: Clínica X (cliniquex.pt) — referência; Y está sempre à frente no Maps…"
                  emptyCta="Escrever a concorrência"
                />
              </div>
            </Card>
          </div>
        )}

        {tab === "ficheiros" && (
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <LinksCard />
            <FilesCard />
          </div>
        )}

        {tab === "historico" && (
          <div className="mx-auto max-w-2xl">
            {file.activity.length > 0 ? (
              <ActivityCard />
            ) : (
              <p className="py-10 text-center text-[13px] text-white/35">Ainda sem alterações.</p>
            )}
          </div>
        )}
      </div>
    </ProspectCtx.Provider>
  );
}

// ── Topo ────────────────────────────────────────────────────────────────

function Hero({
  ctx,
  logo,
  owners,
  reads,
  loadFailed,
  goTo,
}: {
  ctx: ProspectContextView;
  logo: ReactNode;
  owners: OwnerOption[];
  reads: Record<string, number>;
  loadFailed: boolean;
  goTo: (tab: TabKey, anchor?: string) => void;
}) {
  const { file, viewer, people, send, now } = useProspect();
  const { pct, items } = prospectCompleteness(file);
  const next = items.find((i) => !i.done) ?? null;
  const [ownerBusy, setOwnerBusy] = useState(false);
  const owner = file.owner ? personOf(people, file.owner) : null;

  const readers = Object.entries(reads).sort((a, b) => b[1] - a[1]);
  const consultantRead = ctx.consultantUsername ? reads[ctx.consultantUsername] ?? null : null;
  const unreadUpdate =
    consultantRead !== null && file.updatedAt > consultantRead && file.updatedBy !== ctx.consultantUsername;

  return (
    <section className="animate-fade-up relative mt-4 overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(52,62,215,0.12),rgba(120,61,245,0.08)_45%,rgba(197,53,201,0.06))] p-5 sm:mt-6 sm:p-6">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(closest-side,rgba(120,61,245,0.3),transparent)] blur-2xl"
      />
      {loadFailed && (
        <div className="relative mb-4 flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-100">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Não foi possível ler a ficha agora — recarrega daqui a pouco.
        </div>
      )}

      <div className="relative flex flex-wrap items-center gap-x-6 gap-y-4">
        <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-5">
          <div className="shrink-0">{logo}</div>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-white/45">
              <span className="inline-flex items-center gap-1 font-semibold uppercase tracking-[0.14em] text-white/55">
                <ClipboardList className="h-3.5 w-3.5" />
                Ficha do prospect
              </span>
              <span aria-hidden className="text-white/20">·</span>
              <span className="inline-flex items-center gap-1.5 text-white/70">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: STAGE_DOT[ctx.stage] }} />
                {STAGE_LABEL[ctx.stage]}
              </span>
              {ctx.servicesLabel && (
                <>
                  <span aria-hidden className="text-white/20">·</span>
                  <span>{ctx.servicesLabel}</span>
                </>
              )}
              <span title="Privada — só abre com sessão na workspace da WonderAds, nunca vai para o cliente.">
                <Lock className="h-3 w-3 text-white/35" />
              </span>
              {!viewer.canWrite && (
                <span className="inline-flex items-center gap-1 text-white/40">
                  <Eye className="h-3 w-3" />
                  só leitura
                </span>
              )}
            </p>
            <h1 className="mt-1 truncate text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl">
              <span className="brand-gradient-text">{ctx.title}</span>
            </h1>

            {/* Quem vendeu → quem recebe. */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0b0b12]/40 py-0.5 pl-0.5 pr-2.5">
                {owner ? (
                  <Avatar person={owner} size={22} />
                ) : (
                  <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-dashed border-white/20 text-[10px] text-white/30">?</span>
                )}
                <span className="text-white/40">Comercial</span>
                {viewer.canWrite ? (
                  <select
                    value={file.owner ?? ""}
                    disabled={ownerBusy}
                    onChange={async (e) => {
                      setOwnerBusy(true);
                      await send({ op: "owner", owner: e.target.value || null });
                      setOwnerBusy(false);
                    }}
                    aria-label="Comercial responsável"
                    className="cursor-pointer appearance-none bg-transparent font-semibold text-white outline-none hover:text-violet-100"
                  >
                    <option value="" className="bg-[#0b0b12]">por definir ▾</option>
                    {[...new Set(owners.map((o) => o.group))].map((g) => (
                      <optgroup key={g} label={g} className="bg-[#0b0b12]">
                        {owners
                          .filter((o) => o.group === g)
                          .map((o) => (
                            <option key={o.username} value={o.username} className="bg-[#0b0b12]">
                              {o.name}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                ) : (
                  <span className="font-semibold text-white">{owner?.name ?? "por definir"}</span>
                )}
                {ownerBusy && <Loader2 className="h-3 w-3 animate-spin text-white/50" />}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-white/25" />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0b0b12]/40 py-0.5 pl-0.5 pr-2.5">
                {ctx.consultantUsername ? (
                  <Avatar person={personOf(people, ctx.consultantUsername)} size={22} />
                ) : (
                  <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-dashed border-white/20 text-[10px] text-white/30">?</span>
                )}
                <span className="text-white/40">Consultor</span>
                <span className="font-semibold text-white">{ctx.consultant ?? "por atribuir"}</span>
                {ctx.consultantUsername &&
                  (consultantRead === null ? (
                    <span title="O consultor ainda não abriu a ficha" className="inline-flex items-center gap-1 text-amber-200">
                      <Hourglass className="h-3 w-3" />
                      por ler
                    </span>
                  ) : unreadUpdate ? (
                    <span title={`Leu a ${formatDateTime(consultantRead)} — houve alterações depois`} className="inline-flex items-center gap-1 text-sky-200">
                      <Hourglass className="h-3 w-3" />
                      novidades por ler
                    </span>
                  ) : (
                    <span title={`Leu a ${formatDateTime(consultantRead)}`} className="inline-flex items-center gap-1 text-emerald-200">
                      <Check className="h-3 w-3" />
                      lida
                    </span>
                  ))}
              </span>
            </div>
          </div>
        </div>

        {/* Quão completa está — e só o próximo passo, não a lista toda. */}
        <div className="flex items-center gap-3">
          <Ring pct={pct} />
          <div className="leading-tight">
            <p className="text-[13px] font-semibold text-white">{pct === 100 ? "Ficha completa" : `Ficha ${pct}%`}</p>
            {next ? (
              <button
                type="button"
                onClick={() => {
                  const target = MISSING_TARGET[next.key];
                  if (target) goTo(target[0], target[1]);
                }}
                className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] text-white/45 transition hover:text-white"
              >
                Próximo: {next.label}
                <ArrowRight className="h-3 w-3" />
              </button>
            ) : (
              <p className="mt-0.5 text-[11.5px] text-emerald-200/80">Pronta para o consultor</p>
            )}
          </div>
        </div>
      </div>

      {/* Rodapé do topo: alteração, quem leu, atalhos. */}
      <div className="relative mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-white/[0.07] pt-3 text-[11.5px] text-white/40">
        <span>
          {file.updatedBy
            ? `Atualizada ${relTime(file.updatedAt, now)} por ${personOf(people, file.updatedBy).name}`
            : file.createdAt > 0
              ? `Criada a ${formatDate(file.createdAt)}`
              : "Ficha em branco"}
        </span>
        <span className="flex flex-wrap items-center gap-3">
          {readers.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              Lida por
              <span className="flex -space-x-1.5">
                {readers.slice(0, 6).map(([u, at]) => (
                  <span key={u} title={`${personOf(people, u).name} · ${formatDateTime(at)}`}>
                    <Avatar person={personOf(people, u)} size={18} ring />
                  </span>
                ))}
              </span>
              {readers.length > 6 && <span>+{readers.length - 6}</span>}
            </span>
          )}
          {ctx.onBoard && (
            <Link href={`/seo/${ctx.slug}`} className="inline-flex items-center gap-1 transition hover:text-white">
              SEO DPT
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
          {ctx.onboardingPublicPath && <CopyOnboardingLink path={ctx.onboardingPublicPath} />}
        </span>
      </div>
    </section>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 19;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90">
        <defs>
          <linearGradient id="prospect-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#343ED7" />
            <stop offset="54%" stopColor="#783DF5" />
            <stop offset="100%" stopColor="#C535C9" />
          </linearGradient>
        </defs>
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4.5" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={pct === 100 ? "#34D399" : "url(#prospect-ring)"}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span className="text-[11.5px] font-bold tabular-nums text-white">{pct}%</span>
    </span>
  );
}

function CopyOnboardingLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const url = new URL(path, window.location.origin).toString();
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          window.prompt("Copiar link:", url);
        }
      }}
      title="Copia o link público do onboarding (o que se envia ao cliente)"
      className="inline-flex items-center gap-1 transition hover:text-white"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copiado" : "Link do onboarding"}
    </button>
  );
}

// ── A última reunião, na visão geral ────────────────────────────────────

function LatestMeeting({ onOpen }: { onOpen: () => void }) {
  const { file, people } = useProspect();
  const latest = [...file.notes].sort(
    (a, b) => (b.date || "").localeCompare(a.date || "") || b.createdAt - a.createdAt,
  )[0];
  if (!latest) return null;
  const color = NOTE_TYPE_COLOR[latest.type];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-left transition hover:border-white/20"
    >
      <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 text-[11.5px] text-white/45">
          <span className="font-semibold uppercase tracking-[0.12em] text-white/60">Última reunião</span>
          <span>· {NOTE_TYPE_LABEL[latest.type]}</span>
          {latest.date && (
            <span className="inline-flex items-center gap-1">
              · <CalendarDays className="h-3 w-3" /> {formatDate(`${latest.date}T12:00:00`)}
            </span>
          )}
          <span>· {personOf(people, latest.author).name}</span>
        </span>
        <span className="mt-1 line-clamp-2 block text-[13px] leading-relaxed text-white/70">
          {latest.title ? `${latest.title} — ` : ""}
          {latest.body.replace(/\s+/g, " ").trim() || "(sem texto)"}
        </span>
      </span>
      <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[11.5px] font-medium text-violet-200/70 transition group-hover:text-white">
        {file.notes.length > 1 ? `Ver as ${file.notes.length}` : "Abrir"}
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

// ── Aviso de gravação ───────────────────────────────────────────────────

function SaveToast({
  saving,
  savedAt,
  error,
  onClose,
}: {
  saving: boolean;
  savedAt: number | null;
  error: string | null;
  onClose: () => void;
}) {
  const [visibleSaved, setVisibleSaved] = useState(false);
  useEffect(() => {
    if (!savedAt) return;
    setVisibleSaved(true);
    const t = setTimeout(() => setVisibleSaved(false), 1800);
    return () => clearTimeout(t);
  }, [savedAt]);
  if (!saving && !visibleSaved && !error) return null;
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
      {error ? (
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-rose-400/40 bg-[#1a0d14] px-3.5 py-2 text-[12.5px] text-rose-100 shadow-2xl">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
          <button type="button" onClick={onClose} className="ml-1 rounded-md px-1.5 text-rose-200/70 hover:bg-white/10 hover:text-white">
            ✕
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-white/12 bg-[#0b0b12] px-3.5 py-2 text-[12.5px] text-white/80 shadow-2xl">
          {saving ? <Loader2 className="h-4 w-4 animate-spin text-violet-200" /> : <Check className="h-4 w-4 text-emerald-300" />}
          {saving ? "A gravar…" : "Guardado"}
        </div>
      )}
    </div>
  );
}
