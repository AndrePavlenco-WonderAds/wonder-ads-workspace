"use client";

// FICHA DO PROSPECT (v80.0) — a página. Estado da ficha, envio das operações
// à API, aviso de edições por gravar, atualização sozinha quando outra pessoa
// grava, e o esqueleto: topo (identidade, etapa, passagem ao consultor, quão
// completa está) + coluna principal + coluna lateral.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CircleDashed,
  ClipboardList,
  Copy,
  Check,
  ExternalLink,
  Hourglass,
  Lightbulb,
  ListOrdered,
  Loader2,
  Lock,
  ShieldAlert,
  Swords,
  Target,
  AlertTriangle,
  Eye,
} from "lucide-react";
import {
  STAGE_LABEL,
  cleanUrl,
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

const STAGE_STYLE: Record<ProspectStage, string> = {
  onboarding: "border-amber-400/35 bg-amber-500/[0.1] text-amber-200",
  unassigned: "border-sky-400/35 bg-sky-500/[0.1] text-sky-200",
  assigned: "border-emerald-400/35 bg-emerald-500/[0.1] text-emerald-200",
  archived: "border-white/15 bg-white/[0.05] text-white/55",
};

const POLL_MS = 45_000;

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
  const dirty = useRef(new Set<string>());

  // Relógio para os «há 5 min» — de minuto a minuto chega.
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
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

  return (
    <ProspectCtx.Provider value={value}>
      <SaveToast saving={saving > 0} savedAt={savedAt} error={error} onClose={() => setError(null)} />
      <Hero ctx={ctx} logo={logo} owners={owners} reads={reads} loadFailed={loadFailed} />

      <SectionNav />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <div className="min-w-0 space-y-6">
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
              emptyCta="Escreve o resumo que gostavas de receber se fosses tu o consultor: quem é, porque nos escolheu, o que tem de correr bem."
            />
          </Card>

          <Card id="interesses">
            <SectionHead
              icon={Target}
              title="Interesses no programa"
              hint="O que o cliente quer tirar do programa — com as palavras dele"
            />
            <InterestTags />
            <TextBlock
              field="interests"
              placeholder="ex.: quer aparecer no Google Maps em Cascais para «fisioterapia desportiva»; ficou entusiasmado com a parte das IAs…"
              emptyCta="Que partes do programa o entusiasmaram? Que resultados espera ver?"
            />
          </Card>

          <Card id="prioridades">
            <SectionHead
              icon={ListOrdered}
              title="Prioridades"
              hint="Por ordem — a 1 é a que o consultor ataca primeiro"
            />
            <PrioritiesList />
          </Card>

          <OpportunitiesCard />
          <TimelineCard />
        </div>

        <aside className="min-w-0 space-y-6">
          <ProfileCard />
          <Card id="sucesso">
            <SectionHead icon={BadgeCheck} title="Expectativas e sucesso" hint="O que, para o cliente, conta como ter corrido bem" />
            <TextBlock
              field="expectations"
              minRows={3}
              placeholder="ex.: +30% de marcações em 6 meses; ficar à frente da clínica X em «osteopatia lisboa»…"
              emptyCta="Que números ou sinais vão fazer o cliente dizer que valeu a pena?"
            />
          </Card>
          <Card id="cuidados" tone="amber">
            <SectionHead
              icon={ShieldAlert}
              title="Cuidados e sensibilidades"
              tone="amber"
              hint="Objeções, más experiências com outras agências, temas a evitar"
            />
            <TextBlock
              field="concerns"
              minRows={3}
              placeholder="ex.: teve uma má experiência com outra agência — quer relatórios simples e reuniões curtas; não falar em preços por email…"
              emptyCta="Há alguma coisa que o consultor tem de saber para não pisar o risco?"
            />
          </Card>
          <Card id="concorrencia">
            <SectionHead icon={Swords} title="Concorrência e referências" hint="Quem o cliente vê como concorrente ou como exemplo" />
            <TextBlock
              field="competitors"
              minRows={3}
              placeholder="ex.: Clínica X (cliniquex.pt) — referência; Y está sempre à frente no Maps…"
              emptyCta="Quem são os concorrentes que o cliente mencionou?"
            />
          </Card>
          <LinksCard />
          <FilesCard />
          <ActivityCard />
        </aside>
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
}: {
  ctx: ProspectContextView;
  logo: ReactNode;
  owners: OwnerOption[];
  reads: Record<string, number>;
  loadFailed: boolean;
}) {
  const { file, viewer, people, send, now } = useProspect();
  const { pct, items } = prospectCompleteness(file);
  const missing = items.filter((i) => !i.done);
  const [ownerBusy, setOwnerBusy] = useState(false);
  const owner = file.owner ? personOf(people, file.owner) : null;
  const website = cleanUrl(file.profile.website);

  // Quem já abriu a ficha, mais recente primeiro.
  const readers = Object.entries(reads).sort((a, b) => b[1] - a[1]);
  const consultantRead = ctx.consultantUsername ? reads[ctx.consultantUsername] ?? null : null;
  const unreadUpdate = consultantRead !== null && file.updatedAt > consultantRead && file.updatedBy !== ctx.consultantUsername;

  return (
    <section className="animate-fade-up relative mt-4 overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(52,62,215,0.14),rgba(120,61,245,0.10)_45%,rgba(197,53,201,0.08))] p-5 sm:mt-6 sm:p-7">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(120,61,245,0.35),transparent)] blur-2xl"
      />
      {loadFailed && (
        <div className="relative mb-4 flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-100">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Não foi possível ler a ficha agora — o que vês pode estar incompleto. Recarrega daqui a pouco.
        </div>
      )}
      <div className="relative flex flex-wrap items-start justify-between gap-6">
        <div className="flex min-w-0 items-start gap-4 sm:gap-5">
          <div className="shrink-0">{logo}</div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/75">
                <ClipboardList className="h-3 w-3" />
                Ficha do prospect
              </span>
              <span className={`rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold ${STAGE_STYLE[ctx.stage]}`}>
                {ctx.stage === "assigned" && ctx.consultant ? `Cliente · ${ctx.consultant}` : STAGE_LABEL[ctx.stage]}
              </span>
              <span
                title="Só abre com sessão na workspace da WonderAds — nunca é enviada ao cliente."
                className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[10.5px] text-white/45"
              >
                <Lock className="h-3 w-3" />
                Privada · equipa WonderAds
              </span>
              {!viewer.canWrite && (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[10.5px] text-white/45">
                  <Eye className="h-3 w-3" />
                  {viewer.impersonating ? "Vista só de leitura" : "Só leitura"}
                </span>
              )}
            </div>
            <h1 className="mt-2 text-3xl font-semibold leading-[1.05] tracking-tight sm:text-[2.6rem]">
              <span className="brand-gradient-text">{ctx.title}</span>
            </h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[12px] text-white/55">
              {ctx.servicesLabel && (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5">{ctx.servicesLabel}</span>
              )}
              {website && (
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 transition hover:border-white/25 hover:text-white"
                >
                  {file.profile.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {ctx.onboardingCreatedAt && (
                <span className="px-1 text-white/40">Onboarding iniciado a {formatDate(ctx.onboardingCreatedAt)}</span>
              )}
            </div>

            {/* Pessoas: quem vendeu → quem recebe. */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#0b0b12]/40 py-1.5 pl-1.5 pr-3">
                {owner ? <Avatar person={owner} size={26} /> : <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-dashed border-white/20 text-white/30">?</span>}
                <span className="leading-tight">
                  <span className="block text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/40">Comercial</span>
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
                      className="-ml-1 cursor-pointer appearance-none bg-transparent pr-1 text-[12.5px] font-semibold text-white outline-none"
                    >
                      <option value="" className="bg-[#0b0b12]">Por definir</option>
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
                    <span className="block text-[12.5px] font-semibold text-white">{owner?.name ?? "Por definir"}</span>
                  )}
                </span>
                {ownerBusy && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/50" />}
              </div>
              <ArrowRight className="h-4 w-4 text-white/25" />
              <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#0b0b12]/40 py-1.5 pl-1.5 pr-3">
                {ctx.consultantUsername ? (
                  <Avatar person={personOf(people, ctx.consultantUsername)} size={26} />
                ) : (
                  <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-dashed border-white/20 text-white/30">?</span>
                )}
                <span className="leading-tight">
                  <span className="block text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/40">Consultor</span>
                  <span className="block text-[12.5px] font-semibold text-white">{ctx.consultant ?? "Por atribuir"}</span>
                </span>
                {ctx.consultantUsername &&
                  (consultantRead === null ? (
                    <span title="O consultor ainda não abriu a ficha" className="ml-1 inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-amber-200">
                      <Hourglass className="h-3 w-3" />
                      Por ler
                    </span>
                  ) : unreadUpdate ? (
                    <span title={`Leu a ${formatDateTime(consultantRead)} — houve alterações depois`} className="ml-1 inline-flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-sky-200">
                      <Hourglass className="h-3 w-3" />
                      Novidades por ler
                    </span>
                  ) : (
                    <span title={`Leu a ${formatDateTime(consultantRead)}`} className="ml-1 inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-200">
                      <Check className="h-3 w-3" />
                      Lida
                    </span>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quão completa está + atalhos. */}
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[250px]">
          <div className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-[#0b0b12]/45 p-3.5">
            <Ring pct={pct} />
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold text-white">
                {pct === 100 ? "Ficha completa" : `Ficha ${pct}% preenchida`}
              </p>
              {missing.length > 0 ? (
                <ul className="mt-1 space-y-0.5">
                  {missing.slice(0, 3).map((m) => (
                    <li key={m.key}>
                      <a href={`#${anchorFor(m.key)}`} className="inline-flex items-center gap-1.5 text-[11px] text-white/45 transition hover:text-white">
                        <CircleDashed className="h-3 w-3 shrink-0" />
                        {m.label}
                      </a>
                    </li>
                  ))}
                  {missing.length > 3 && <li className="pl-[18px] text-[11px] text-white/30">+ {missing.length - 3}</li>}
                </ul>
              ) : (
                <p className="mt-0.5 text-[11px] text-emerald-200/80">Tudo o que o consultor precisa está cá.</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {ctx.onBoard && (
              <Link
                href={`/seo/${ctx.slug}`}
                className="group inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-[12px] font-medium text-white/75 transition hover:border-white/25 hover:text-white"
              >
                Ficha no SEO DPT
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </Link>
            )}
            {ctx.onboardingPublicPath && <CopyOnboardingLink path={ctx.onboardingPublicPath} />}
          </div>
        </div>
      </div>

      {/* Rodapé do topo: criação, última alteração, quem leu. */}
      <div className="relative mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.07] pt-3.5 text-[11.5px] text-white/40">
        {file.createdAt > 0 ? (
          <span>
            Criada a {formatDate(file.createdAt)}
            {file.createdBy && people[file.createdBy] ? ` por ${people[file.createdBy].name}` : ""}
          </span>
        ) : (
          <span>Ficha ainda em branco — começa por onde souberes mais.</span>
        )}
        {file.updatedBy && (
          <span>
            Última alteração {relTime(file.updatedAt, now)} por {personOf(people, file.updatedBy).name}
          </span>
        )}
        {readers.length > 0 && (
          <span className="inline-flex items-center gap-2">
            Lida por
            <span className="flex -space-x-1.5">
              {readers.slice(0, 8).map(([u, at]) => (
                <span key={u} title={`${personOf(people, u).name} · ${formatDateTime(at)}`}>
                  <Avatar person={personOf(people, u)} size={20} ring />
                </span>
              ))}
            </span>
            {readers.length > 8 && <span>+{readers.length - 8}</span>}
          </span>
        )}
      </div>
    </section>
  );
}

function anchorFor(key: string): string {
  switch (key) {
    case "summary":
      return "resumo";
    case "interests":
      return "interesses";
    case "priorities":
      return "prioridades";
    case "opportunities":
      return "oportunidades";
    case "notes":
      return "reunioes";
    case "profile":
      return "perfil";
    case "expectations":
      return "sucesso";
    case "concerns":
      return "cuidados";
    default:
      return "resumo";
  }
}

function Ring({ pct }: { pct: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative flex h-14 w-14 shrink-0 items-center justify-center">
      <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90">
        <defs>
          <linearGradient id="prospect-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#343ED7" />
            <stop offset="54%" stopColor="#783DF5" />
            <stop offset="100%" stopColor="#C535C9" />
          </linearGradient>
        </defs>
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={pct === 100 ? "#34D399" : "url(#prospect-ring)"}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span className="text-[13px] font-bold tabular-nums text-white">{pct}%</span>
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
      className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-[12px] font-medium text-white/75 transition hover:border-white/25 hover:text-white"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copiado" : "Link do onboarding"}
    </button>
  );
}

// ── Navegação das secções ───────────────────────────────────────────────

const NAV = [
  ["resumo", "Resumo"],
  ["interesses", "Interesses"],
  ["prioridades", "Prioridades"],
  ["oportunidades", "Oportunidades"],
  ["reunioes", "Reuniões"],
  ["perfil", "Perfil"],
  ["cuidados", "Cuidados"],
  ["anexos", "Anexos"],
] as const;

function SectionNav() {
  const { file } = useProspect();
  const count: Record<string, number> = {
    prioridades: file.priorities.length,
    oportunidades: file.opportunities.length,
    reunioes: file.notes.length,
    anexos: file.files.length + file.notes.reduce((n, x) => n + x.attachments.length, 0),
  };
  return (
    <nav
      aria-label="Secções da ficha"
      className="sticky top-[4.5rem] z-20 sm:top-[5.25rem] -mx-1 mt-5 flex gap-1 overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0b0b12]/85 p-1 [scrollbar-width:none]"
    >
      {NAV.map(([id, label]) => (
        <a
          key={id}
          href={`#${id}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-medium text-white/55 transition hover:bg-white/[0.06] hover:text-white"
        >
          {label}
          {count[id] ? (
            <span className="rounded-full bg-white/[0.08] px-1.5 text-[10px] font-semibold tabular-nums text-white/60">{count[id]}</span>
          ) : null}
        </a>
      ))}
    </nav>
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
