// /seo/[slug]/folga — a Folga de custos de um projeto SEO (v78.37).
//
// O topo mostra quanto há este mês para extras e o que já saiu; ao lado,
// lança-se um extra; por baixo fica o registo do projeto, mês a mês. As
// regras e as contas estão em lib/seo-folga.ts.
//
// Só para quem pode editar o SEO (consultores e direção). Com «Ver como»
// vê-se tudo, mas não se lança nem se anula nada.

import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { DocsGuideChip } from "@/components/documentacao/docs-guide-chip";
import { FolgaHero } from "@/components/seo-folga/folga-hero";
import { FolgaAdd, type FolgaLinkOption } from "@/components/seo-folga/folga-add";
import { FolgaLog } from "@/components/seo-folga/folga-log";
import { FolgaAllowanceEditor } from "@/components/seo-folga/folga-allowance";
import { FolgaPricesEditor } from "@/components/seo-folga/folga-prices";
import { getClientBySlug } from "@/lib/notion";
import { getCurrentEmployee, getImpersonation } from "@/lib/auth/server";
import { canEditDept } from "@/lib/auth/credentials";
import { getClientTier } from "@/lib/client-tiers";
import { lisbonMonthKey } from "@/lib/dates";
import {
  baseAllowance,
  eurCents,
  folgaMonthName,
  summarizeFolga,
  toCents,
  type FolgaCategory,
  type FolgaSummary,
} from "@/lib/seo-folga";
import { getFolga, getFolgaPrices } from "@/lib/seo-folga-store";
import { getCurrentRoadmap } from "@/lib/roadmap-store";
import { getAllTickets } from "@/lib/web-tickets-store";

/** As tarefas do roadmap em curso, por mês, para ligar um extra (v78.40). */
async function taskOptions(slug: string): Promise<FolgaLinkOption[]> {
  const roadmap = await getCurrentRoadmap(slug).catch(() => null);
  if (!roadmap) return [];
  return [...roadmap.tasks]
    .sort((a, b) => a.week - b.week || a.order - b.order)
    .map((t) => ({ id: t.id, label: `Semana ${t.week} · ${t.title}`, group: `Mês ${Math.ceil(t.week / 4)}` }));
}

/** Os tickets do Web deste cliente, os abertos primeiro. */
async function ticketOptions(slug: string): Promise<FolgaLinkOption[]> {
  const all = await getAllTickets().catch(() => []);
  const open = (s: string) => s !== "done" && s !== "closed";
  return all
    .filter((t) => t.clientSlug === slug)
    .sort((a, b) => Number(open(b.status)) - Number(open(a.status)) || b.createdAt - a.createdAt)
    .map((t) => ({ id: t.id, label: `#${t.seq} ${t.title}`, group: open(t.status) ? "Em aberto" : "Fechados" }));
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const client = await getClientBySlug(slug).catch(() => null);
  return { title: client ? `Folga de custos — ${client.title} · Wonder Ads` : "Folga de custos · Wonder Ads" };
}

const CATEGORY_COLOR: Record<FolgaCategory, string> = {
  conteudo: "#783DF5",
  design: "#C535C9",
  backlinks: "#343ED7",
  wikipedia: "#e2e8f0",
  ferramentas: "#38bdf8",
  horas: "#f59e0b",
  visita: "#34d399",
  outro: "#94a3b8",
};

export default async function FolgaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();

  const [employee, impersonation] = await Promise.all([getCurrentEmployee(), getImpersonation()]);
  if (!employee || !canEditDept(employee.username, "seo")) {
    return (
      <PageShell backHref={`/seo/${slug}`} backLabel={client.title}>
        <p className="mt-10 rounded-2xl border border-dashed border-white/15 p-8 text-center text-[14px] text-white/50">
          A folga de custos é só para os consultores de SEO e a direção.
        </p>
      </PageShell>
    );
  }
  const readOnly = Boolean(impersonation);

  const tier = getClientTier(slug);
  const [record, priceList, tasks, tickets] = await Promise.all([
    getFolga(slug),
    getFolgaPrices(),
    readOnly ? Promise.resolve([]) : taskOptions(slug),
    readOnly ? Promise.resolve([]) : ticketOptions(slug),
  ]);
  const nowKey = lisbonMonthKey(Date.now());
  const s = summarizeFolga(record, baseAllowance(slug, tier), tier, nowKey);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(Date.now());
  const [y, m, d] = today.split("-").map(Number);
  const daysLeft = new Date(Date.UTC(y, m, 0)).getUTCDate() - d;
  const month = folgaMonthName(nowKey);
  const prev = s.months.length > 1 ? s.months[s.months.length - 2] : null;

  return (
    <PageShell backHref={`/seo/${slug}`} backLabel={client.title}>
      <header className="animate-fade-up mt-4 sm:mt-6">
        <p className="text-[13px] text-white/45">{client.title}</p>
        <h1 className="mt-1 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
          <span className="brand-gradient-text">Folga de custos</span>
        </h1>
        <p className="mt-3 max-w-2xl text-[14.5px] text-white/55">
          O que o projeto tem, por mês, para extras que oferecemos ao cliente. O que não se gasta passa para o mês
          seguinte.
        </p>
        <div className="mt-4">
          <DocsGuideChip blockId="folga-custos" href="/documentacao/folga-custos" label="Como atribuir extras" />
        </div>
      </header>

      <div className="animate-fade-up mt-8">
        <FolgaHero s={s} daysLeft={daysLeft} />
      </div>

      <section className="animate-fade-up mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Folga mensal"
          value={
            s.allowanceNow === null ? "Por definir" : s.state === "lite" ? "0 € · Lite" : eurCents(toCents(s.allowanceNow))
          }
        />
        <Stat
          label={prev ? `Transitou de ${folgaMonthName(prev.key)}` : "Transitou"}
          value={prev ? eurCents(s.current.opening) : "Primeiro mês"}
          tone={s.current.opening < 0 ? "bad" : "default"}
        />
        <Stat label={`Oferecido em ${month}`} value={eurCents(s.current.spent)} />
        <Stat label={`Cobrado ao cliente em ${month}`} value={eurCents(s.current.charged)} />
      </section>

      <div className="mt-8 grid items-start gap-6 pb-12 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="order-2 min-w-0 space-y-6 lg:order-1">
          <FolgaLog
            slug={slug}
            months={s.months}
            entries={record.entries}
            allowances={record.allowances}
            me={employee.username}
            isAdmin={employee.isAdmin}
            readOnly={readOnly}
          />
          <div className="grid gap-6 md:grid-cols-2">
            <Breakdown s={s} />
            <section className="rounded-[26px] border border-white/10 p-5 text-[13px] leading-relaxed text-white/55 sm:p-6">
              <h2 className="text-[15px] font-semibold text-white">Como funciona</h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-4">
                <li>A folga do mês entra a dia 1.</li>
                <li>O que sobra passa para o mês seguinte, e o que se gasta a mais também.</li>
                <li>«Cobrado ao cliente» fica no registo, mas não gasta folga.</li>
                <li>Algumas categorias têm um preço de referência: o valor preenche-se ao escolhê-las e pode mudar-se.</li>
                <li>Clientes Lite não têm folga: os extras são todos cobrados.</li>
                <li>Um extra lançado por engano anula-se com o motivo. Nada se apaga.</li>
              </ul>
            </section>
          </div>
        </div>
        <aside className="order-1 space-y-6 lg:sticky lg:top-24 lg:order-2">
          {readOnly ? (
            <p className="rounded-[26px] border border-amber-400/25 bg-amber-500/[0.06] p-5 text-[13.5px] text-amber-100/85">
              Estás a ver a app como outra pessoa: aqui não se lançam nem se anulam extras.
            </p>
          ) : (
            <FolgaAdd
              slug={slug}
              tasks={tasks}
              tickets={tickets}
              remaining={s.remaining}
              available={s.available}
              chargeOnly={s.state === "lite" || s.allowanceNow === null}
              today={today}
              prices={priceList.prices}
            />
          )}
          {employee.isAdmin && !readOnly && (
            <>
              <FolgaAllowanceEditor slug={slug} nowKey={nowKey} current={s.allowanceNow} />
              <FolgaPricesEditor list={priceList} />
            </>
          )}
        </aside>
      </div>
    </PageShell>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "bad" }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
      <p className="text-[12px] text-white/45">{label}</p>
      <p className={`mt-1 text-[1.35rem] font-semibold tabular-nums tracking-tight ${tone === "bad" ? "text-rose-200" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

/** Para onde foi a folga, desde o início — por categoria. */
function Breakdown({ s }: { s: FolgaSummary }) {
  if (s.state === "lite") return null;
  return (
    <section className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <h2 className="text-[15px] font-semibold text-white">Para onde vai a folga</h2>
      {s.totalOffered === 0 ? (
        <p className="mt-2 text-[13px] text-white/45">Ainda não saiu nada da folga.</p>
      ) : (
        <>
          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
            {s.byCategory.map((c) => (
              <span
                key={c.id}
                title={`${c.label}: ${eurCents(c.cents)}`}
                style={{ width: `${(c.cents / s.totalOffered) * 100}%`, background: CATEGORY_COLOR[c.id] }}
              />
            ))}
          </div>
          <ul className="mt-3 space-y-1.5 text-[13px]">
            {s.byCategory.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-white/65">
                  <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLOR[c.id] }} />
                  {c.label}
                </span>
                <span className="tabular-nums text-white/85">
                  {eurCents(c.cents)}
                  <span className="ml-1.5 text-white/35">{Math.round((c.cents / s.totalOffered) * 100)}%</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-white/40">
            Desde outubro de 2026: {eurCents(s.totalOffered)} oferecidos
            {s.totalCharged > 0 && ` e ${eurCents(s.totalCharged)} cobrados ao cliente`}.
          </p>
        </>
      )}
    </section>
  );
}
