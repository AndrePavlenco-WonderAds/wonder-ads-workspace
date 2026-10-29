import Link from "next/link";
import { ArrowRight, PauseCircle, Users } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AccessDenied } from "@/components/access-denied";
import { getCurrentEmployee } from "@/lib/auth/server";
import { accessibleDepts, editableDepts } from "@/lib/auth/credentials";
import { DepartmentHeader } from "@/components/department-header";
import { KpisCard } from "@/components/kpis-card";
import { SeoDirectoriesCard } from "@/components/seo-directories-card";
import { SeoBoard, type SeoBoardColumn } from "@/components/seo-board";
import { hasKeywordGuarantee } from "@/lib/keyword-guarantee";
import { WorldMap } from "@/components/world-map";
import { TypewriterPrompt } from "@/components/typewriter-prompt";
import { getSeoClients, slugify, type NotionClient } from "@/lib/notion";
import {
  getSeoOrganicVisitors30d,
  type SeoOrganicRollup,
} from "@/lib/seo-organic-rollup";
import { OrganicPulse } from "@/components/seo/organic-pulse";
import { NpsTeamChip, type NpsTeamChipProps } from "@/components/seo/nps-team-chip";
import { buildNpsBonusMonths } from "@/lib/documentacao/nps-bonus-server";
import { NPS_BONUS_EXCLUDED_SLUGS, monthLabel, type NpsBonusMonth } from "@/lib/documentacao/nps-bonus";
import { lisbonMonthKey, shiftMonthKey } from "@/lib/dates";
import { CONSULTANT_ORDER } from "@/lib/client-overrides";
import {
  getConsultantResolver,
  type ConsultantResolver,
} from "@/lib/consultant-assignments";
import { getClientTier, tierRank } from "@/lib/client-tiers";
import { applyBoardOrder, getBoardOrder } from "@/lib/seo-board-order-store";
import {
  displayDomain,
  getClientLogo,
  getClientWebsite,
  getLogoBgMode,
  getLogoSizing,
} from "@/lib/client-meta";
import { getLogoOverrides } from "@/lib/admin-client-logos-store";
import { getTeamAvatar } from "@/lib/team-avatars";
import { findEmployeeByName } from "@/lib/proposals/consultant";
import { getPausedSlugSet } from "@/lib/admin-paused-clients-store";
import { getNpsRecordsFor, type NpsRecord } from "@/lib/nps-store";
import type { NpsMonthScore } from "@/components/client-card";

export const metadata = {
  title: "SEO DPT — Wonder Ads Workspace",
};

// ISR — re-fetch from Notion every 60s.
export const revalidate = 60;
// A primeira construção do snapshot orgânico (só quando o KV ainda não o
// tem) corre dentro do pedido; os refreshes seguintes vão para depois da
// resposta. Ver seo-organic-rollup.ts.
export const maxDuration = 120;

export default async function SeoPage() {
  // Dept gate — Web-only designers (Mike/Gustavo/Renan) can't open SEO.
  // SEO consultants + SuperAdmins pass; see accessibleDepts().
  const employee = await getCurrentEmployee();
  if (!employee || !accessibleDepts(employee).includes("seo")) {
    return (
      <PageShell>
        <AccessDenied
          title="No SEO access"
          description="The SEO department is open to SEO consultants and SuperAdmins. Web designers have access to the Web department instead."
          username={employee?.username}
        />
      </PageShell>
    );
  }

  // Web designers get read-only SEO access — they see the client roster
  // and can open project pages, but the department-level tools (KPIs,
  // Directories, per-consultant roadmap boards) are for the SEO team.
  const readOnly = !editableDepts(employee).includes("seo");

  // NPS da equipa (v78.32): o mês em curso e o anterior, numa só leitura,
  // começado já para correr ao lado do resto da página.
  const npsMonthNow = lisbonMonthKey(Date.now());
  const npsMonths = buildNpsBonusMonths([shiftMonthKey(npsMonthNow, -1), npsMonthNow]).catch((err) => {
    console.error("SEO DPT: NPS da equipa falhou:", err instanceof Error ? err.message : err);
    return null;
  });

  // As leituras que não dependem umas das outras correm em paralelo
  // (v78.34) — eram oito idas ao KV/Notion uma atrás da outra. A do
  // resolver fica com um .catch vazio só para a rejeição não ser dada como
  // «não tratada» enquanto se espera pelo Notion; o await abaixo relança-a.
  const canReorder = !employee.isAdmin && !readOnly;
  const resolverP = getConsultantResolver();
  resolverP.catch(() => {});
  const pausedP = getPausedSlugSet().catch(() => new Set<string>());
  const logosP = getLogoOverrides().catch(() => ({}) as Record<string, string>);
  const orderP = canReorder ? getBoardOrder(employee.username) : Promise.resolve<string[]>([]);

  let clients: NotionClient[] = [];
  let notionError: string | null = null;

  if (process.env.NOTION_API_KEY) {
    try {
      clients = await getSeoClients();
    } catch (err) {
      notionError =
        err instanceof Error ? err.message : "Failed to fetch clients";
    }
  } else {
    notionError = "NOTION_API_KEY not set";
  }

  // Paused / suspended clients live in a KV set (SuperAdmin-managed).
  // Split them out of the main grid — they render in a separate section
  // below, using the same consultant-column structure.
  const pausedSet = await pausedP;
  const activeClients = clients.filter((c) => !pausedSet.has(c.slug));
  const pausedClients = clients.filter((c) => pausedSet.has(c.slug));

  // Department-wide organic visitors (GA4, Organic Search, last 30 days),
  // served from the KV snapshot and refreshed after the response — one KV
  // read on the render path, never ~20 live GA4 calls (v77.14). Paused
  // clients are excluded from the headline organic total.
  // O NPS de cada cliente (índice de satisfação global), lido numa única
  // operação KV (mget) para toda a board — nunca um get por cartão. O cartão
  // mostra o mês anterior e o atual (v78.33); a lane, a média do último.
  const [organic, npsRecords, consultants, order, logoOverrides] = await Promise.all([
    getSeoOrganicVisitors30d(activeClients.map((c) => c.slug)),
    getNpsRecordsFor(clients.map((c) => c.slug)),
    resolverP,
    orderP,
    logosP,
  ]);
  const organicTeam = buildOrganicTeamStats(organic, activeClients);
  const npsCardMonths = [shiftMonthKey(npsMonthNow, -1), npsMonthNow];

  // Carteiras com as migrações do SuperAdmin aplicadas (uma leitura KV).
  const consultantColumns = buildConsultantColumns(activeClients, consultants);

  // Ordem pessoal da carteira (v78.4): só na lane de quem está a ver, e só
  // para ele — os outros continuam a ver a ordem por tier. Em «Ver como» o
  // SuperAdmin vê a ordem e o botão do consultor, mas a API recusa gravar.
  if (canReorder) {
    for (const col of consultantColumns) {
      if (col.name === employee.name) col.clients = applyBoardOrder(col.clients, order);
    }
  }
  const pausedColumns = buildConsultantColumns(pausedClients, consultants);

  const npsTeam = toNpsTeamChip(await npsMonths);

  return (
    // `wide`: a página ocupa a largura toda (v77.48), para os consultores
    // ficarem sempre numa só fila. Na v77.49 o cabeçalho passou a acompanhar
    // a board (a pedido do André); tudo partilha o mesmo teto de 1880px para
    // ecrãs ultra-largos não esticarem os cartões até ao ridículo.
    <PageShell wide>
      <div className="mx-auto w-full max-w-[1880px]">
      <DepartmentHeader
        title="SEO DPT"
        tagline={
          <>
            Crescimento orgânico no Google e nas IAs.
            <br />
            Agência #1 de SEO &amp; GEO em Portugal.
          </>
        }
        count={activeClients.length || undefined}
        countLabel="clients"
        countSuffix={
          <>
          {organic.configured ? (
            <OrganicPulse
              total={organic.total}
              prevTotal={organic.prevTotal}
              daily={organic.daily}
              clientsWithData={organic.clientsWithData}
              clientsStale={organic.clientsStale}
              computedAt={organic.computedAt}
              growing={organicTeam.growing}
              comparable={organicTeam.comparable}
              topClimber={organicTeam.topClimber}
            />
          ) : null}
          {npsTeam && <NpsTeamChip {...npsTeam} />}
          </>
        }
        rightSlot={<WorldMap />}
        extra={
          <TypewriterPrompt text="Em que projeto vamos trabalhar agora, chefe?" />
        }
        large
      />
      </div>

      {/* A board sai do contentor de 7xl: largura toda, com um teto para
          ecrãs ultra-largos não esticarem os cartões até ao ridículo. */}
      <div className="mx-auto mt-12 w-full max-w-[1880px] lg:mt-16">
        <section aria-label="Clients by Head Consultant">
          {/* A direção abre todos os consultores numa página só (v78.44). */}
          {!notionError && employee.isAdmin && (
            <div className="mb-4 flex justify-end">
              <Link
                href="/seo/roadmaps"
                className="group inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] py-1 pl-1 pr-3 text-[12.5px] text-white/65 transition hover:border-white/25 hover:text-white"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.08]">
                  <Users className="h-3.5 w-3.5" />
                </span>
                Todos os consultores
                <ArrowRight className="h-3.5 w-3.5 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white" />
              </Link>
            </div>
          )}
          {notionError ? (
            <div className="mx-auto max-w-7xl">
              <NotionFallback message={notionError} />
            </div>
          ) : (
            <SeoBoard
              columns={toBoardColumns(
                consultantColumns,
                logoOverrides,
                npsRecords,
                npsCardMonths,
                employee.isAdmin,
                employee.name,
              )}
              isAdmin={employee.isAdmin}
              canReorder={canReorder}
            />
          )}
        </section>
      </div>

      {/* Pausados / suspensos — discreto de propósito (v77.49): título
          pequeno e apagado, lanes compactas. Está cá para se saber, não para
          competir com a carteira ativa. */}
      {!notionError && pausedColumns.length > 0 && (
        <div className="mx-auto mt-10 w-full max-w-[1880px] lg:mt-14">
          <section aria-label="Clientes Pausados / Suspensos">
            <header className="mb-3 flex items-center gap-2">
              <PauseCircle className="h-3 w-3 text-amber-300/50" />
              <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-white/35">
                Pausados / Suspensos
              </h2>
              <span className="tabular rounded-full bg-white/[0.05] px-1.5 py-px text-[10px] font-medium text-white/40">
                {pausedClients.length}
              </span>
              <span className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
            </header>
            <SeoBoard
              columns={toBoardColumns(
                pausedColumns,
                logoOverrides,
                npsRecords,
                npsCardMonths,
                employee.isAdmin,
                employee.name,
              )}
              isAdmin={employee.isAdmin}
              paused
            />
          </section>
        </div>
      )}

      <div className="mx-auto w-full max-w-[1880px]">
      {!readOnly && (
        <section aria-label="SEO Directories" className="mt-12 sm:mt-16">
          <SeoDirectoriesCard />
        </section>
      )}

      {!readOnly && (
      <section aria-label="SEO DPT KPIs" className="mt-6 sm:mt-8">
        <KpisCard />
      </section>
      )}
      </div>
    </PageShell>
  );
}

type ConsultantColumn = { name: string; clients: NotionClient[] };

/** Group clients by consultant, then sort each column by tier
 *  (growth → core → lite).
 *  IMPORTANT: re-resolve consultant from slug rather than trusting
 *  c.consultant — getSeoClients() is wrapped in unstable_cache (1h TTL)
 *  and the cached value can lag behind code-level consultant renames in
 *  client-overrides.ts. O campo em cache só entra como REDE, para os
 *  clientes que entraram pelo onboarding e ainda não estão em
 *  client-overrides.ts (ver `ConsultantResolver.resolve`) — sem isso caíam em
 *  "Unassigned" e não apareciam em coluna nenhuma. Re-resolving here means any consultant rename
 *  ships instantly, even before the cache evicts. The bug it fixes:
 *  renaming a consultant to a shorter form dropped 5 clients off the board
 *  because the cached consultant string didn't match the new column name. */
function buildConsultantColumns(
  clients: NotionClient[],
  consultants: ConsultantResolver,
): ConsultantColumn[] {
  const grouped: Record<string, NotionClient[]> = {};
  for (const c of clients) {
    const consultant = consultants.resolve(c.slug, c.consultant);
    // O tier também se re-resolve pelo slug: o da cache de 1h ficava com as
    // tags antigas até expirar (v78.2).
    (grouped[consultant] ??= []).push({
      ...c,
      consultant,
      tier: getClientTier(c.slug),
    });
  }
  for (const list of Object.values(grouped)) {
    list.sort((a, b) => tierRank(a.tier) - tierRank(b.tier));
  }
  const columns: ConsultantColumn[] = CONSULTANT_ORDER.map((name) => ({
    name: name as string,
    clients: grouped[name] ?? [],
  })).filter((col) => col.clients.length > 0);

  // NENHUM CLIENTE PODE DESAPARECER DA BOARD (v76.47). As colunas eram
  // exatamente os nomes do `CONSULTANT_ORDER`, e tudo o que resolvesse para
  // outra coisa — "Unassigned", ou um nome escrito à mão que não bate certo
  // ("João Batista" em vez de "João B.") — era descartado em silêncio. Um
  // cliente que acabou de fazer o onboarding ficava invisível no
  // departamento, e ninguém tinha como dar por isso: não havia erro, não
  // havia coluna vazia, simplesmente não estava lá.
  //
  // Agora sobra sempre uma coluna com quem não coube. É feia de propósito:
  // um cliente aqui é uma atribuição por resolver, não um estado normal.
  const known = new Set<string>(CONSULTANT_ORDER);
  const orphans = Object.entries(grouped)
    .filter(([name]) => !known.has(name))
    .flatMap(([, list]) => list);
  if (orphans.length > 0) {
    columns.push({
      name: "Por atribuir",
      clients: orphans.sort((a, b) => tierRank(a.tier) - tierRank(b.tier)),
    });
  }
  return columns;
}

/** Resolve tudo o que precisa de código de servidor (logos, domínio,
 *  garantia, link do roadmap) para dados serializáveis que a board
 *  cliente (<SeoBoard/>, pesquisa + filtros) consegue receber. */
function toBoardColumns(
  columns: ConsultantColumn[],
  logoOverrides: Record<string, string>,
  npsRecords: Record<string, NpsRecord>,
  npsMonths: string[],
  isAdmin: boolean,
  employeeName: string,
): SeoBoardColumn[] {
  return columns.map((col) => ({
    name: col.name,
    roadmapHref:
      isAdmin || employeeName === col.name
        ? `/seo/roadmaps/${slugify(col.name)}`
        : null,
    // A lane realçada é a de quem está a ver; o SuperAdmin não tem carteira.
    isMine: !isAdmin && employeeName === col.name,
    // Retrato do consultor (v77.49) — pelo nome da coluna até à credencial e
    // daí ao ficheiro em public/team/avatar; null → inicial.
    avatar: getTeamAvatar(findEmployeeByName(col.name)?.username),
    clients: col.clients.map((c) => {
      const website = getClientWebsite(c.slug);
      const noNps = NPS_BONUS_EXCLUDED_SLUGS.has(c.slug);
      return {
        slug: c.slug,
        title: c.title,
        icon: c.icon,
        logo: logoOverrides[c.slug] ?? getClientLogo(c.slug),
        logoBgMode: getLogoBgMode(c.slug),
        logoSizing: getLogoSizing(c.slug),
        palette: c.palette,
        tier: c.tier,
        // A WonderAds é a própria agência: não faz NPS, nem conta para a média
        // da lane — o cartão fica sem pastilha (v78.34).
        npsOverall: noNps ? null : (npsRecords[c.slug]?.submissions[0]?.scores.overall ?? null),
        npsAt: noNps ? null : (npsRecords[c.slug]?.submissions[0]?.submittedAt ?? null),
        npsMonths: noNps ? [] : npsByMonth(npsRecords[c.slug], npsMonths),
        keywordGuarantee: hasKeywordGuarantee(c.slug),
        domain: website ? displayDomain(website) : null,
      };
    }),
  }));
}

function NotionFallback({ message }: { message: string }) {
  return (
    <div className="brand-gradient-border rounded-2xl bg-white/[0.035] p-6 backdrop-blur-md">
      <p className="text-sm uppercase tracking-[0.18em] text-white/45">
        Notion not connected
      </p>
      <p className="mt-3 max-w-xl text-white/70">
        Add <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">NOTION_API_KEY</code>{" "}
        as a Vercel environment variable and redeploy to load live client data
        from your SEO Space.
      </p>
      <p className="mt-3 text-xs text-white/35">Error: {message}</p>
    </div>
  );
}

/** Indicadores de equipa para o «Pulso orgânico»: quantos clientes estão
 *  acima do período anterior e qual subiu mais. A maior subida só conta
 *  clientes com pelo menos 100 visitantes no período anterior — 10 → 20 é
 *  +100 % e não diz nada. */
function buildOrganicTeamStats(
  rollup: SeoOrganicRollup,
  clients: NotionClient[],
): {
  growing: number;
  comparable: number;
  topClimber: { name: string; pct: number } | null;
} {
  const MIN_PREV = 100;
  const names = new Map(clients.map((c) => [c.slug, c.title]));
  const comparable = rollup.perClient.filter((c) => c.prevUsers > 0);
  const growing = comparable.filter((c) => c.users > c.prevUsers).length;
  let topClimber: { name: string; pct: number } | null = null;
  for (const c of comparable) {
    if (c.prevUsers < MIN_PREV) continue;
    const pct = ((c.users - c.prevUsers) / c.prevUsers) * 100;
    if (pct <= 0) continue;
    if (!topClimber || pct > topClimber.pct) {
      topClimber = { name: names.get(c.slug) ?? c.slug, pct };
    }
  }
  return { growing, comparable: comparable.length, topClimber };
}

/** A última resposta de cada mês — a mesma regra do bónus NPS: as
 *  submissões vêm da mais recente para a mais antiga, a primeira do mês é a
 *  que conta. */
function npsByMonth(record: NpsRecord | undefined, months: string[]): NpsMonthScore[] {
  const subs = record?.submissions ?? [];
  return months.map((key) => {
    const answer = subs.find((s) => lisbonMonthKey(s.submittedAt) === key);
    const name = monthLabel(key).split(" ")[0];
    return {
      label: name.slice(0, 3).toUpperCase(),
      name,
      score: answer ? answer.scores.overall : null,
      at: answer ? answer.submittedAt : null,
    };
  });
}

/** Os dois meses do NPS da equipa → a pílula do cabeçalho. */
function toNpsTeamChip(months: NpsBonusMonth[] | null): NpsTeamChipProps | null {
  if (!months || months.length < 2) return null;
  const [prev, now] = months;
  const month = (m: NpsBonusMonth) => ({
    key: m.month,
    name: monthLabel(m.month).split(" ")[0],
    average: m.teamAverage,
    filled: m.teamResponses,
    total: m.teamProjects,
  });
  return {
    previous: month(prev),
    current: month(now),
    projects: now.consultants.flatMap((c) =>
      c.projects.map((p) => ({ slug: p.slug, name: p.name, consultant: c.name, score: p.score, answeredAt: p.answeredAt })),
    ),
  };
}
