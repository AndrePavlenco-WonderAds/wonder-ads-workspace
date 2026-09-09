import { PauseCircle } from "lucide-react";
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
import {
  CONSULTANT_ORDER,
  resolveConsultant,
} from "@/lib/client-overrides";
import { TIER_RANK } from "@/lib/client-tiers";
import {
  displayDomain,
  getClientLogo,
  getClientWebsite,
  getLogoBgMode,
  getLogoSizing,
} from "@/lib/client-meta";
import { getLogoOverrides } from "@/lib/admin-client-logos-store";
import { getPausedSlugSet } from "@/lib/admin-paused-clients-store";
import { getLatestNpsSummaries, type NpsSummary } from "@/lib/nps-store";

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
  const pausedSet = await getPausedSlugSet().catch(() => new Set<string>());
  const activeClients = clients.filter((c) => !pausedSet.has(c.slug));
  const pausedClients = clients.filter((c) => pausedSet.has(c.slug));

  const consultantColumns = buildConsultantColumns(activeClients);
  const pausedColumns = buildConsultantColumns(pausedClients);

  // Department-wide organic visitors (GA4, Organic Search, last 30 days),
  // served from the KV snapshot and refreshed after the response — one KV
  // read on the render path, never ~20 live GA4 calls (v77.14). Paused
  // clients are excluded from the headline organic total.
  const organic = await getSeoOrganicVisitors30d(
    activeClients.map((c) => c.slug),
  );
  const organicTeam = buildOrganicTeamStats(organic, activeClients);

  // Custom uploaded logos override the static CLIENT_LOGOS map.
  const logoOverrides = await getLogoOverrides().catch(
    () => ({}) as Record<string, string>,
  );

  // Último NPS de cada cliente (índice de satisfação global), lido numa
  // única operação KV (mget) para toda a board — nunca um get por cartão.
  const npsSummaries = await getLatestNpsSummaries(clients.map((c) => c.slug));

  return (
    <PageShell>
      <DepartmentHeader
        title="SEO DPT"
        tagline="Crescimento orgânico no Google e nas IAs. Agência #1 de SEO & GEO em Portugal."
        count={activeClients.length || undefined}
        countLabel="clients"
        rightSlot={<WorldMap />}
        extra={
          <TypewriterPrompt text="Which project are we working on now, boss?" />
        }
        large
      />

      {organic.configured && (
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
      )}

      <div className="mt-12 lg:mt-16">
        <section aria-label="Clients by Head Consultant">
          {notionError ? (
            <NotionFallback message={notionError} />
          ) : (
            <SeoBoard
              columns={toBoardColumns(
                consultantColumns,
                logoOverrides,
                npsSummaries,
                employee.isAdmin,
                employee.name,
              )}
              isAdmin={employee.isAdmin}
            />
          )}
        </section>
      </div>

      {!notionError && pausedColumns.length > 0 && (
        <div className="mt-14 lg:mt-20">
          <section aria-label="Clientes Pausados / Suspensos">
            <header className="mb-6 flex items-center gap-3">
              <PauseCircle className="h-4 w-4 text-amber-300/80" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/60">
                Pausados / Suspensos
              </h2>
              <span className="rounded-full border border-amber-400/25 bg-amber-500/[0.08] px-2.5 py-0.5 text-xs font-medium uppercase tracking-[0.16em] text-amber-200/80">
                {pausedClients.length}
              </span>
            </header>
            <SeoBoard
              columns={toBoardColumns(
                pausedColumns,
                logoOverrides,
                npsSummaries,
                employee.isAdmin,
                employee.name,
              )}
              isAdmin={employee.isAdmin}
              paused
            />
          </section>
        </div>
      )}

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
 *  client-overrides.ts (ver `resolveConsultant`) — sem isso caíam em
 *  "Unassigned" e não apareciam em coluna nenhuma. Re-resolving here means any consultant rename
 *  ships instantly, even before the cache evicts. The bug it fixes:
 *  renaming a consultant to a shorter form dropped 5 clients off the board
 *  because the cached consultant string didn't match the new column name. */
function buildConsultantColumns(clients: NotionClient[]): ConsultantColumn[] {
  const grouped: Record<string, NotionClient[]> = {};
  for (const c of clients) {
    const consultant = resolveConsultant(c.slug, c.consultant);
    (grouped[consultant] ??= []).push({ ...c, consultant });
  }
  for (const list of Object.values(grouped)) {
    list.sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier]);
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
      clients: orphans.sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier]),
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
  npsSummaries: Record<string, NpsSummary>,
  isAdmin: boolean,
  employeeName: string,
): SeoBoardColumn[] {
  return columns.map((col) => ({
    name: col.name,
    roadmapHref:
      isAdmin || employeeName === col.name
        ? `/seo/roadmaps/${slugify(col.name)}`
        : null,
    clients: col.clients.map((c) => {
      const website = getClientWebsite(c.slug);
      return {
        slug: c.slug,
        title: c.title,
        icon: c.icon,
        logo: logoOverrides[c.slug] ?? getClientLogo(c.slug),
        logoBgMode: getLogoBgMode(c.slug),
        logoSizing: getLogoSizing(c.slug),
        palette: c.palette,
        tier: c.tier,
        npsOverall: npsSummaries[c.slug]?.overall ?? null,
        npsAt: npsSummaries[c.slug]?.submittedAt ?? null,
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
