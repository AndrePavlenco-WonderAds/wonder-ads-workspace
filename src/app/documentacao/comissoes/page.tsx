// /documentacao/comissoes — comissões da equipa de Delivery (v78.5, redesenho
// v78.7).
//
// Texto: «Renovações — Programa de Crescimento Orgânico», outubro 2026.
// Primeiro o que é da pessoa (o degrau onde está e o simulador), depois as
// regras pela ordem em que se usam numa renovação: o que propor, quanto se
// ganha, quando se recebe, como se sobe, o que vender. O tracking lê as
// propostas aceites do COMMERCIAL DPT (lib/documentacao/commissions-server.ts).

import { ArrowUpRight, ChevronDown, Lock, Mail, Search, Tv } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Bullets, DocHero, DocSection, DocsClosed, ExecutiveSummary, Note, Rows, Strong, SubHeading } from "@/components/documentacao/doc-ui";
import { SectionNav } from "@/components/documentacao/section-nav";
import { CommissionsTracker } from "@/components/documentacao/commissions-tracker";
import { CommissionSimulator } from "@/components/documentacao/commission-simulator";
import { formatDate } from "@/lib/dates";
import { getDocsContext } from "@/lib/documentacao/server";
import { buildCommissionsBoard } from "@/lib/documentacao/commissions-server";
import { seoConsultants } from "@/lib/documentacao/people";
import { COMMISSIONS_START, COMMISSION_TIERS, RENEWAL_RATE, formatRate } from "@/lib/documentacao/commissions";
import { ADS_DIRECTOR, CROSS_SELLS, MEDIA, PROOF_LINKS, TV, WEBSITES } from "@/lib/documentacao/sales-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Comissões — Documentação",
};

const BLOCK_ID = "remuneracao-variavel";

const NAV = [
  { id: "onde-estas", label: "Onde estás" },
  { id: "simulador", label: "Simulador" },
  { id: "renovar", label: "Renovar" },
  { id: "quanto-ganhas", label: "Quanto ganhas" },
  { id: "quando-recebes", label: "Quando recebes" },
  { id: "patamares", label: "Patamares" },
  { id: "cross-sells", label: "Cross-sells" },
  { id: "upsells", label: "Upsells" },
  { id: "resumo", label: "Resumo" },
];

const LOW = formatRate(COMMISSION_TIERS[0].rate);
const HIGH = formatRate(COMMISSION_TIERS[COMMISSION_TIERS.length - 1].rate);
const RANGE = `${LOW}–${HIGH}`;
const RENEWAL = formatRate(RENEWAL_RATE);
const LINK = "text-[#c4a6ff] underline-offset-2 hover:text-white hover:underline";

function eurK(n: number): string {
  return `${n.toLocaleString("de-DE")} €`;
}

export default async function ComissoesPage() {
  const ctx = await getDocsContext(BLOCK_ID);
  if (ctx.state === "no-session") return null;
  if (ctx.state !== "ok" || !ctx.block) {
    return (
      <PageShell backHref="/documentacao" backLabel="Documentação">
        <DocsClosed
          kind={ctx.state === "closed" ? "closed" : "forbidden"}
          name={ctx.state === "closed" ? ctx.name : ctx.state === "forbidden" ? ctx.reader.name : ""}
        />
      </PageShell>
    );
  }

  const { reader, block } = ctx;
  const board = await buildCommissionsBoard();
  const mine = board.find((r) => r.username === reader.username) ?? null;
  const myTier = mine?.tier.n ?? 1;

  return (
    <PageShell backHref="/documentacao" backLabel="Documentação">
      <DocHero
        block={block.title}
        title="Comissões"
        lead={
          <>
            Ganhas sobre o que fechas. Renovações: <Strong>{RENEWAL} fixos</Strong>. Cross-sells e upsells:{" "}
            <Strong>{LOW} a {HIGH}</Strong>, conforme o teu patamar.
          </>
        }
        meta={`Atualizado a ${formatDate(block.updatedAt)}.${reader.isAdmin ? ` Visível para SuperAdmin e ${block.audienceLabel}.` : ""}`}
        tabs={{ pages: block.pages, current: "/documentacao/comissoes" }}
      />

      <SectionNav items={NAV} />

      <div className="mt-8 space-y-14 pb-10">
        <section id="onde-estas" data-doc-section className="scroll-mt-40">
          <CommissionsTracker board={board} people={seoConsultants()} viewAll={reader.isAdmin} username={reader.username} />
        </section>

        <DocSection
          id="simulador"
          title="Simulador"
          lead="Escreve o valor do negócio e vê quanto recebes e quando. As contas seguem as regras desta página."
        >
          <CommissionSimulator defaultTier={myTier} />
        </DocSection>

        <DocSection
          id="renovar"
          title="O que propor numa renovação"
          lead="6 meses é a duração standard. Apresenta as opções por esta ordem: o dinheiro entra à cabeça e o cliente fica comprometido mais tempo."
        >
          <ol className="grid gap-3 md:grid-cols-3">
            {[
              { n: 1, name: "PIF 12 meses", rule: "Pagamento integral antecipado.", off: "−10%", note: "Só existe com pré-pagamento." },
              { n: 2, name: "PIF 6 meses", rule: "Pagamento integral antecipado.", off: "−5%", note: "Desconto sobre o total dos 6 meses." },
              { n: 3, name: "Mensal 6 meses", rule: "Pago mês a mês.", off: "0%", note: "Preço de tabela, sem desconto." },
            ].map((o) => (
              <li
                key={o.n}
                className={`relative rounded-2xl border p-5 ${o.n === 1 ? "border-[#783DF5]/50 bg-[#783DF5]/[0.08]" : "border-white/10 bg-white/[0.02]"}`}
              >
                <span className="text-[12.5px] text-white/45">{o.n}.ª a apresentar</span>
                <p className="mt-1 text-[17px] font-semibold text-white">{o.name}</p>
                <p className="mt-4 text-[2.6rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-white">{o.off}</p>
                <p className="mt-3 text-[13.5px] leading-snug text-white/60">
                  {o.rule} {o.note}
                </p>
              </li>
            ))}
          </ol>
          <div className="flex gap-4 rounded-2xl border border-amber-300/25 bg-amber-400/[0.06] p-5">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div className="text-[14px] leading-relaxed text-amber-50/80">
              <p className="font-semibold text-amber-100">Downsell para 3 meses: só com aprovação</p>
              É uma exceção, quando o projeto o justifica. Pede aprovação ao Diretor de Delivery <Strong>antes</Strong> de falar
              com o cliente. Sem aprovação, a proposta fica a 6 meses.
            </div>
          </div>
        </DocSection>

        <DocSection
          id="quanto-ganhas"
          title="Quanto ganhas"
          lead={`A comissão é individual, sobre o que fechas, calculada sem IVA. Renovação é receita que já existia: ${RENEWAL} fixos. Cross-sells e upsells são receita nova: ${RANGE}, conforme o patamar.`}
        >
          <Rows
            rows={[
              { term: "Renovação", tone: "accent", detail: "Valor faturado sem IVA, já com o desconto PIF.", value: `${RENEWAL} fixos` },
                { term: "Google Ads", detail: "Fee de agência faturada. O ad spend não conta.", value: RANGE },
                { term: "Meta Ads", detail: "Fee de agência faturada. O ad spend não conta. Com criativos externos, desconta-se o custo da produção.", value: RANGE },
                { term: "CRM", detail: "Margem: valor faturado menos o custo de execução.", value: RANGE },
                { term: "Websites", detail: "Valor faturado.", value: RANGE },
                { term: "Apps / plataformas", detail: "Margem: valor faturado menos o custo do parceiro.", value: RANGE },
                { term: "PR / Imprensa, Wikipedia", detail: "Margem: valor faturado menos o custo do parceiro.", value: RANGE },
                { term: "Expansão do programa", detail: "Valor faturado. Mais keywords, localizações ou content pillars.", value: RANGE },
            ]}
          />
        </DocSection>

        <DocSection
          id="quando-recebes"
          title="Quando recebes"
          lead="Há sempre 30 dias de período de reembolso antes da primeira comissão. Depois, recebes ao ritmo a que o cliente paga."
        >
          <div className="space-y-3">
            {[
              { who: "Cliente paga tudo à cabeça (PIF)", then: "Recebes a comissão toda, de uma vez." },
              { who: "Cliente paga ao mês", then: "Recebes a parte de cada mensalidade que o cliente paga." },
            ].map((r) => (
              <div key={r.who} className="grid items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:grid-cols-[1fr_auto_1fr]">
                <p className="text-[14px] font-medium text-white">{r.who}</p>
                <div className="flex items-center gap-2 text-[12.5px] text-white/50">
                  <span className="hidden h-px w-8 bg-white/25 sm:block" />
                  <span className="rounded-full border border-white/15 px-2.5 py-1">30 dias de reembolso</span>
                  <span className="hidden h-px w-8 bg-white/25 sm:block" />
                </div>
                <p className="text-[14px] text-emerald-200 sm:text-right">{r.then}</p>
              </div>
            ))}
          </div>
          <Note tone="warn" title="Se o cliente deixar de pagar">
            A comissão dos meses que ele não pagar não é paga.
          </Note>
        </DocSection>

        <DocSection
          id="patamares"
          title="Patamares"
          lead="A % dos cross-sells e upsells sobe com a tua faturação acumulada, sem IVA. O acumulado é teu, não da equipa."
        >
          <Rows
            rows={COMMISSION_TIERS.map((t) => ({
              term: `Patamar ${t.n}${!reader.isAdmin && t.n === myTier ? " · o teu" : ""}`,
              tone: !reader.isAdmin && t.n === myTier ? ("accent" as const) : undefined,
              detail: t.to === null ? `Acima de ${eurK(t.from)}` : t.from === 0 ? `Até ${eurK(t.to)}` : `De ${eurK(t.from)} a ${eurK(t.to)}`,
              value: formatRate(t.rate),
            }))}
          />
          <Bullets
            items={[
              <>Renovações, cross-sells e upsells contam todos para subir. As renovações são sempre pagas a {RENEWAL}.</>,
              <>Cada cross-sell ou upsell paga a % do patamar em que estás <Strong>no momento em que o fechas</Strong>.</>,
              <>Quando sobes, a nova % vale para os negócios seguintes. <Strong>Não é retroativa.</Strong></>,
            ]}
          />
          <div className="space-y-3">
            <SubHeading aside="valores ilustrativos">Exemplo: subir de patamar</SubHeading>
            <ol className="relative space-y-0 border-l border-white/15 pl-6">
              {[
                { step: "Ponto de partida", deal: "Acumulado de 48.000 €", tier: "Patamar 2 · 6%", pay: null },
                { step: "Fecha uma renovação", deal: "PIF 6 meses, 14.250 €. O acumulado passa a 62.250 €.", tier: "Sobe ao patamar 3 · 7%", pay: `427,50 € — renovação, a ${RENEWAL}` },
                { step: "Fecha um cross-sell", deal: "Google Ads, 6 meses × 1.000 € de fee. O acumulado passa a 68.250 €.", tier: "Patamar 3 · 7%", pay: "420,00 € — já a 7%, 70 € por mês pago" },
              ].map((s) => (
                <li key={s.step} className="relative pb-5 last:pb-0">
                  <span aria-hidden className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[#07080d] bg-[#a78bfa]" />
                  <p className="text-[14px] font-semibold text-white">{s.step}</p>
                  <p className="text-[13.5px] text-white/60">{s.deal}</p>
                  <p className="mt-1 text-[12.5px] text-[#c4a6ff]">{s.tier}</p>
                  {s.pay && <p className="mt-0.5 text-[13.5px] font-medium text-emerald-300">{s.pay}</p>}
                </li>
              ))}
            </ol>
          </div>
        </DocSection>

        <DocSection
          id="cross-sells"
          title="Cross-sells"
          lead="Em cada renovação, vê se o cliente tem potencial para um destes. Todos contam para a comissão e para o patamar. Usa os casos de referência, sobretudo os do mesmo setor do cliente."
        >
          <div className="flex gap-4 rounded-2xl border border-[#783DF5]/30 bg-[#783DF5]/[0.08] p-5">
            <Search className="mt-0.5 h-5 w-5 shrink-0 text-[#c4a6ff]" />
            <p className="text-[14px] leading-relaxed text-white/70">
              <Strong>Abre a conversa com uma auditoria gratuita.</Strong> Google Ads, Meta Ads e CRM. As de anúncios são
              feitas pelo nosso Diretor de Anúncios, {ADS_DIRECTOR.name}:{" "}
              <a href={`mailto:${ADS_DIRECTOR.email}`} className={`${LINK} inline-flex items-center gap-1`}>
                <Mail className="h-3.5 w-3.5" />
                {ADS_DIRECTOR.email}
              </a>
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {CROSS_SELLS.map((s) => (
              <article
                key={s.id}
                className={`rounded-2xl border border-white/10 bg-white/[0.02] p-5 ${s.id === "websites" ? "md:col-span-2 xl:col-span-3" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="text-[18px] font-semibold text-white">{s.name}</h3>
                  {s.freeAudit && (
                    <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-0.5 text-[12px] text-emerald-200">
                      Auditoria gratuita
                    </span>
                  )}
                </div>
                <p className="mt-3 text-[1.5rem] font-semibold leading-none tracking-[-0.02em] text-white">{s.minimum}</p>
                {s.minimumNote && <p className="mt-1 text-[12.5px] text-white/45">{s.minimumNote}</p>}
                <div className="mt-4">
                  <Bullets items={s.points} />
                </div>
                {s.references.length > 0 && (
                  <div className="mt-5 border-t border-white/[0.07] pt-4">
                    <p className="text-[12.5px] text-white/45">Já fizemos para</p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {s.references.map((r) => (
                        <li key={r} className="rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[12.5px] text-white/80">
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {s.id === "websites" && (
                  <div className="mt-5 border-t border-white/[0.07] pt-4">
                    <p className="text-[12.5px] text-white/45">Websites que fizemos</p>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {WEBSITES.map((w) => (
                        <li key={w.url}>
                          <a
                            href={w.url}
                            target="_blank"
                            rel="noreferrer"
                            className="group flex h-full items-start justify-between gap-3 rounded-xl border border-white/[0.08] px-3.5 py-3 transition hover:border-white/25 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5]"
                          >
                            <span className="min-w-0">
                              <span className="block text-[14px] font-medium text-white">{w.name}</span>
                              <span className="block text-[12.5px] leading-snug text-white/50">{w.about}</span>
                            </span>
                            <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-white/30 transition group-hover:text-white" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            ))}
          </div>

          <p className="text-[14px] text-white/60">
            Para enviar ao cliente:{" "}
            <a href={PROOF_LINKS.testimonials} target="_blank" rel="noreferrer" className={LINK}>
              testemunhos no website
            </a>{" "}
            e{" "}
            <a href={PROOF_LINKS.playlist} target="_blank" rel="noreferrer" className={LINK}>
              playlist de casos no YouTube
            </a>
            .
          </p>
        </DocSection>

        <DocSection id="upsells" title="Upsells" lead="Também contam para a comissão e para o patamar.">
          <div className="grid gap-4 lg:grid-cols-3">
            <article className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 lg:col-span-2">
              <h3 className="text-[18px] font-semibold text-white">PR / Imprensa</h3>
              <p className="mt-3 text-[1.5rem] font-semibold leading-none tracking-[-0.02em] text-white">A partir de ~500 €</p>
              <p className="mt-1 text-[12.5px] text-white/45">Avença mensal ou valor por presença em TV</p>
              <div className="mt-4">
                <Bullets
                  items={[
                    "TV, jornais, revistas, sites, rádios e podcasts.",
                    "Incluídos: artigos e entrevistas em jornais, revistas e sites, e o clipping, que o cliente usa nas redes e no site.",
                    "Em jornais, revistas e sites, o nome da clínica aparece por norma. Em TV nem sempre: orientamos o especialista a referi-lo de forma natural.",
                    "Foco na saúde. Fora da saúde, caso a caso.",
                  ]}
                />
              </div>
              <div className="mt-5">
                <Note tone="warn" title="Requisito antes de vender">
                  O cliente nomeia um ponto de contacto que responde rápido. Os convites dos meios chegam muitas vezes de um dia
                  para o outro e não esperam pelo fim do dia.
                </Note>
              </div>
              <details className="group mt-5 overflow-hidden rounded-xl border border-white/10 transition hover:border-white/25 open:border-white/15">
                <summary className="block cursor-pointer list-none px-4 py-3.5 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#783DF5] [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2.5 text-[14px] font-medium text-white">
                      <Tv className="h-4 w-4 text-[#c4a6ff]" />
                      Onde conseguimos pôr os especialistas
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1 text-[12.5px] font-medium text-white/85 transition group-hover:bg-white group-hover:text-[#07080d]">
                      <span className="group-open:hidden">Ver os {TV.length} canais</span>
                      <span className="hidden group-open:inline">Fechar</span>
                      <ChevronDown className="docs-nudge h-3.5 w-3.5 transition group-open:rotate-180 group-open:[animation:none]" />
                    </span>
                  </span>
                  {/* Os canais a correr, só com a caixa fechada — mostra que há
                      lista lá dentro antes de se clicar. */}
                  <span
                    aria-hidden
                    className="mt-3 block overflow-hidden group-open:hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]"
                  >
                    <span className="docs-marquee flex w-max gap-2">
                      {[...TV, ...TV].map((t, i) => (
                        <span key={i} className="whitespace-nowrap rounded-full border border-white/10 px-2.5 py-1 text-[12px] text-white/60">
                          {t.channel}
                        </span>
                      ))}
                    </span>
                  </span>
                </summary>
                <div className="space-y-6 border-t border-white/10 px-4 pb-5 pt-4">
                  <p className="text-[13px] text-white/55">Alguns programas aceitam participação online ou a partir de estúdios no Porto.</p>
                  <div className="space-y-2">
                    <p className="text-[13px] font-semibold text-white">Televisão</p>
                    <dl className="divide-y divide-white/[0.06]">
                      {TV.map((t) => (
                        <div key={t.channel} className="grid gap-x-4 py-2 sm:grid-cols-[11rem_1fr]">
                          <dt className="text-[13px] font-medium text-white/85">{t.channel}</dt>
                          <dd className="text-[13px] text-white/55">{t.shows}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  {MEDIA.map((g) => (
                    <div key={g.label} className="space-y-2">
                      <p className="text-[13px] font-semibold text-white">{g.label}</p>
                      <ul className="flex flex-wrap gap-1.5">
                        {g.items.map((m) => (
                          <li key={m} className="rounded-full border border-white/10 px-2.5 py-1 text-[12.5px] text-white/70">
                            {m}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </details>
            </article>
            <div className="space-y-4">
              <article className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <h3 className="text-[18px] font-semibold text-white">Wikipedia</h3>
                <p className="mt-3 text-[1.5rem] font-semibold leading-none tracking-[-0.02em] text-white">A partir de 750 €</p>
                <p className="mt-1 text-[12.5px] text-white/45">por língua</p>
                <div className="mt-4">
                  <Bullets
                    items={[
                      "Depende da autoridade do cliente: exige cerca de 30 menções em jornais.",
                      "Combina com PR / Imprensa, que gera essas menções.",
                    ]}
                  />
                </div>
              </article>
              <article className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <h3 className="text-[18px] font-semibold text-white">Expansão do programa</h3>
                <div className="mt-4">
                  <Bullets items={["Mais keywords trabalhadas.", "Mais áreas, serviços ou localizações.", "Novos content pillars."]} />
                </div>
              </article>
            </div>
          </div>
        </DocSection>

        <ExecutiveSummary
          updatedAt={block.updatedAt}
          title="As comissões, por extenso"
          paragraphs={[
            <>
              As comissões são a parte da remuneração que liga o consultor ao crescimento das contas que acompanha. A regra de
              fundo é que se ganha sobre o que se fecha: quando um cliente renova, quando passa a comprar um serviço novo
              (cross-sell) ou quando aumenta o que já tem (upsell), quem fechou o negócio recebe uma percentagem do valor,
              sempre calculada sem IVA. A comissão é individual e conta os negócios fechados desde {formatDate(COMMISSIONS_START)},
              pelo valor do cartão aceite no departamento comercial.
            </>,
            <>
              Uma renovação é receita que já existia e por isso paga {RENEWAL} fixos sobre o valor faturado, já com o desconto
              de pagamento antecipado. A duração standard é de 6 meses e as opções apresentam-se por uma ordem pensada para o
              dinheiro entrar à cabeça e o cliente ficar comprometido mais tempo: primeiro o PIF de 12 meses (−10%), depois o
              PIF de 6 meses (−5%) e só no fim o mensal de 6 meses, a preço de tabela. Um downsell para 3 meses é uma exceção e
              só se propõe com aprovação prévia do Diretor de Delivery.
            </>,
            <>
              Cross-sells e upsells são receita nova e pagam de {LOW} a {HIGH}, conforme o patamar. O patamar é dado pela tua
              faturação acumulada, sem IVA —{" "}
              {COMMISSION_TIERS.map((t) =>
                // Espaço inquebrável: o valor nunca parte antes do €.
                (t.to === null ? `${formatRate(t.rate)} acima de ${eurK(t.from)}` : `${formatRate(t.rate)} até ${eurK(t.to)}`).replace(/ €/g, "\u00a0€"),
              ).join(", ")}{" "}
              — e todos os negócios contam para subir, renovações incluídas. Cada negócio paga a percentagem do patamar em que
              estás no momento em que o fechas; quando sobes, a nova percentagem vale só para os negócios seguintes, nunca para
              trás. A base de cálculo depende do serviço: nos anúncios conta a fee de agência e não o investimento em media; no
              CRM, nas apps e na imprensa conta a margem; nos websites e na expansão do programa conta o valor faturado.
            </>,
            <>
              O pagamento segue o dinheiro. Há sempre 30 dias de período de reembolso antes da primeira comissão. Depois disso,
              se o cliente pagou tudo à cabeça, a comissão é paga de uma vez; se paga ao mês, recebes a parte de cada
              mensalidade que o cliente pagar. Se o cliente deixar de pagar, a comissão desses meses não é paga.
            </>,
            <>
              Na prática, cada renovação é também uma oportunidade de crescimento: olha para o cliente, vê se tem potencial
              para um dos cross-sells ou upsells desta página e usa os casos de referência do mesmo setor como prova. O painel
              no topo mostra o teu acumulado, o teu patamar e as tuas comissões, ligado às propostas aceites do departamento
              comercial, e o simulador mostra quanto e quando recebes antes de fechares.
            </>,
          ]}
        />

        <p className="border-t border-white/[0.07] pt-6 text-[13px] text-white/40">
          Estes termos podem ser alterados e personalizados caso a caso. Dúvidas: Diretor de Operações.
        </p>
      </div>
    </PageShell>
  );
}
