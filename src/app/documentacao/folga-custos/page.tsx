// /documentacao/folga-custos — o protocolo da Folga de custos (v78.40): o que
// é, como se lança um extra, o que acontece quando se passa a folga. As regras
// vêm de lib/seo-folga.ts — o exemplo é calculado com a mesma função da
// página do projeto, por isso nunca diverge dela.

import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import {
  Bullets,
  DocHero,
  DocSection,
  DocsClosed,
  ExecutiveSummary,
  Note,
  Rows,
  StageFlow,
  Strong,
} from "@/components/documentacao/doc-ui";
import { SectionNav } from "@/components/documentacao/section-nav";
import { formatDate } from "@/lib/dates";
import { getDocsContext } from "@/lib/documentacao/server";
import {
  FOLGA_CATEGORIES,
  eurCents,
  folgaMonthName,
  summarizeFolga,
  type FolgaEntry,
} from "@/lib/seo-folga";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Folga de custos — Documentação",
};

const BLOCK_ID = "folga-custos";

const NAV = [
  { id: "como-funciona", label: "Como funciona" },
  { id: "regras", label: "As regras" },
  { id: "lancar", label: "Lançar um extra" },
  { id: "passar", label: "Passar a folga" },
  { id: "exemplo", label: "Exemplo" },
  { id: "resumo", label: "Resumo" },
];

/** Um projeto de 100 € por mês, de outubro a janeiro — calculado com a mesma
 *  função da página do projeto. */
const EXAMPLE_MONTHLY = 100;
const exampleEntry = (date: string, eur: number, title: string): FolgaEntry => ({
  id: `ex-${date}-${eur}`,
  date,
  eur,
  title,
  category: "conteudo",
  kind: "folga",
  note: null,
  link: null,
  by: { username: "", name: "" },
  at: 0,
  voided: null,
});
const EXAMPLE = summarizeFolga(
  {
    allowances: [],
    entries: [
      exampleEntry("2026-10-15", 40, "2 artigos extra"),
      exampleEntry("2026-12-03", 200, "Sessão fotográfica"),
      exampleEntry("2026-12-18", 80, "Página de serviço extra"),
    ],
  },
  EXAMPLE_MONTHLY,
  "core",
  "2027-01",
).months;
const EXAMPLE_TEXT: Record<string, string> = {
  "2026-10": "Entram 100 €. Oferecem-se 2 artigos extra (40 €).",
  "2026-11": "Entram mais 100 €. Não se oferece nada: tudo transita.",
  "2026-12": "Entram 100 €. Oferecem-se uma sessão fotográfica (200 €) e uma página extra (80 €): passa a folga e a direção é avisada.",
  "2027-01": "Entram 100 €, mas os 20 € a mais de dezembro saem daqui.",
};

export default async function FolgaCustosDocPage() {
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

  return (
    <PageShell backHref="/documentacao" backLabel="Documentação">
      <DocHero
        block={block.title}
        title="Folga de custos"
        lead={
          <>
            Cada projeto SEO tem um valor por mês para <Strong>extras que oferecemos ao cliente</Strong> sem os cobrar. O que
            não se gasta passa para o mês seguinte; quando a folga acaba, os extras passam a ser cobrados.
          </>
        }
        meta={`Atualizado a ${formatDate(block.updatedAt)}.${reader.isAdmin ? ` Visível para SuperAdmin e ${block.audienceLabel}.` : ""}`}
      />

      <SectionNav items={NAV} />

      <div className="mt-8 space-y-14 pb-10">
        <DocSection id="como-funciona" title="Como funciona" lead="Três momentos, todos os meses.">
          <StageFlow
            stages={[
              {
                title: "Entra a folga",
                body: "A dia 1 entra a folga do mês do projeto, somada ao que sobrou do mês anterior. Os clientes Lite não têm folga.",
              },
              {
                title: "Lança-se o extra",
                body: "Quem oferece o extra regista-o na página da folga do cliente: o que foi, quanto custa, quem paga e a que tarefa ou ticket corresponde.",
              },
              {
                title: "Sobra ou cobra-se",
                body: "O que sobra passa para o mês seguinte. Se o saldo ficar negativo, a direção recebe um aviso e os extras seguintes são cobrados.",
              },
            ]}
          />
        </DocSection>

        <DocSection id="regras" title="As regras">
          <Rows
            rows={[
              { term: "Folga mensal", detail: "Um valor por projeto, definido pela direção. Entra a dia 1 de cada mês." },
              {
                term: "Acumulável",
                tone: "accent",
                detail: "O que não se gasta passa para o mês seguinte. Não há reinício: o saldo é a soma das folgas menos os extras.",
              },
              {
                term: "Saldo negativo",
                tone: "amber",
                detail: "Gastar a mais também transita: um saldo de −20 € come 20 € da folga do mês seguinte.",
              },
              {
                term: "Sai da folga",
                detail: "Um extra oferecido ao cliente. Desconta no saldo.",
              },
              {
                term: "Cobrado ao cliente",
                detail: "Um extra que o cliente paga. Fica no registo do projeto, mas não desconta na folga.",
              },
              {
                term: "Clientes Lite",
                detail: "Não têm folga. O bloco aparece preenchido e todos os extras pedidos são cobrados.",
              },
              {
                term: "Por definir",
                detail: "Um projeto sem folga definida ainda não tem saldo: até a direção a definir, os extras são cobrados.",
              },
              {
                term: "Nada se apaga",
                detail: "Um extra lançado por engano é anulado, com o motivo, por quem o lançou ou pela direção. Fica riscado no registo.",
              },
              {
                term: "Mudar a folga",
                detail: "Só a direção, a partir do mês em curso ou de um dos dois seguintes. Os meses que já passaram não mudam.",
              },
              { term: "Quem vê", detail: "Os consultores de SEO e a direção." },
            ]}
          />
        </DocSection>

        <DocSection id="lancar" title="Lançar um extra" lead="Antes de oferecer, vê quanto há. Depois de oferecer, lança logo.">
          <Bullets
            items={[
              <>
                Na ficha do cliente, o chip <Strong>Folga</Strong> (ao lado do Pending Review) mostra a percentagem da folga do mês
                que ainda está livre. Abre-o para ver o valor em euros e o registo do projeto.
              </>,
              <>
                Em <Strong>Lançar um extra</Strong>: o que foi, o valor, a data, a categoria (
                {FOLGA_CATEGORIES.map((c) => c.label).join(", ")}) e quem paga.
              </>,
              <>
                Liga o extra à <Strong>tarefa do roadmap</Strong> ou ao <Strong>ticket</Strong> a que corresponde, para se saber
                sempre que trabalho foi oferecido.
              </>,
              <>
                Antes de gravar, a página mostra <Strong>como fica o saldo</Strong>. Se for passar a folga, avisa — confirma com a
                direção ou lança o extra como cobrado ao cliente.
              </>,
            ]}
          />
          <p className="text-[14.5px] text-white/65">
            A folga de cada projeto está em <span className="text-white">SEO DPT › cliente › Folga</span>. Por exemplo,{" "}
            <Link href="/seo" className="font-medium text-[#c4a6ff] hover:text-white">
              abre o SEO DPT
            </Link>{" "}
            e escolhe o cliente.
          </p>
        </DocSection>

        <DocSection id="passar" title="Passar a folga">
          <Note tone="warn" title="A direção é avisada">
            Sempre que um extra que sai da folga deixa o saldo negativo, a direção recebe um aviso no sino: o projeto, o extra,
            quem o lançou e o saldo do mês. Se o extra for anulado, o aviso desaparece.
          </Note>
          <Bullets
            items={[
              "A partir daí, os extras seguintes desse projeto são cobrados ao cliente ou aprovados pela direção.",
              "O saldo negativo transita: o mês seguinte começa com menos folga.",
              "Melhor do que passar a folga é falar com a direção antes de oferecer.",
            ]}
          />
        </DocSection>

        <DocSection
          id="exemplo"
          title="Exemplo"
          lead={`Um projeto com ${eurCents(EXAMPLE_MONTHLY * 100)} de folga por mês, de outubro a janeiro.`}
        >
          <Rows
            rows={EXAMPLE.map((m) => ({
              term: folgaMonthName(m.key).replace(/^./, (c) => c.toUpperCase()),
              detail: EXAMPLE_TEXT[m.key],
              value: `${m.key === "2027-01" ? "abre com" : "fica"} ${eurCents(m.key === "2027-01" ? m.opening + m.credit : m.closing)}`,
              tone: m.closing < 0 ? ("amber" as const) : undefined,
            }))}
          />
        </DocSection>

        <ExecutiveSummary
          updatedAt={block.updatedAt}
          title="A folga de custos, por extenso"
          paragraphs={[
            <>
              A folga de custos é o valor que cada projeto SEO tem, por mês, para extras que oferecemos ao cliente sem os cobrar:
              um artigo a mais, uma sessão fotográfica, uma página extra, um backlink. Serve para o consultor poder surpreender o
              cliente com critério, sabendo até onde pode ir, e para a direção ver onde vai o dinheiro de cada conta.
            </>,
            <>
              A folga entra a dia 1 de cada mês e é acumulável: o que não se gasta passa para o mês seguinte, e o que se gasta a
              mais também, porque o saldo é sempre a soma das folgas menos os extras oferecidos. Os clientes Lite não têm folga, e
              nesses todos os extras pedidos são cobrados.
            </>,
            <>
              Cada extra é lançado na página da folga do cliente, com o que foi, o valor, a categoria, quem paga e a tarefa do
              roadmap ou o ticket a que corresponde. Um extra cobrado ao cliente fica no registo mas não desconta na folga. Nada se
              apaga: um extra lançado por engano é anulado com o motivo e continua visível no registo do projeto.
            </>,
            <>
              Quando um extra deixa o saldo negativo, a direção é avisada no sino, e a partir daí os extras desse projeto são
              cobrados ou aprovados pela direção. Só a direção muda a folga mensal de um projeto, e só para a frente: os meses que já
              passaram não se reescrevem.
            </>,
          ]}
        />

        <p className="border-t border-white/[0.07] pt-6 text-[13px] text-white/40">
          Estes termos podem ser revistos pela direção. Dúvidas: Diretor de Operações.
        </p>
      </div>
    </PageShell>
  );
}
