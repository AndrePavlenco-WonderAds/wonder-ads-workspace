// /documentacao/bonus-nps — o bónus NPS dos consultores SEO (v78.5, redesenho
// v78.7): o mês primeiro, depois as regras. As réguas e as contas saem das
// mesmas constantes (lib/documentacao/nps-bonus.ts).

import { PageShell } from "@/components/page-shell";
import { DocHero, DocSection, DocsClosed, ExecutiveSummary, Note, Rows, Strong } from "@/components/documentacao/doc-ui";
import { SectionNav } from "@/components/documentacao/section-nav";
import { NpsBonusTracker } from "@/components/documentacao/nps-bonus-tracker";
import { ScoreScale } from "@/components/documentacao/score-scale";
import { formatDate } from "@/lib/dates";
import { getDocsContext } from "@/lib/documentacao/server";
import { buildNpsBonusMonth } from "@/lib/documentacao/nps-bonus-server";
import {
  INDIVIDUAL_MIN_PROJECTS,
  INDIVIDUAL_TIERS,
  MIN_FILL_RATE,
  NPS_BONUS_FIRST_MONTH,
  TEAM_TIERS,
  isMonthKey,
  lisbonMonthKey,
  shiftMonth,
} from "@/lib/documentacao/nps-bonus";
import { formatEur } from "@/lib/proposals/value";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Bónus NPS — Documentação",
};

const BLOCK_ID = "remuneracao-variavel";

const NAV = [
  { id: "o-mes", label: "O mês" },
  { id: "como-se-mede", label: "Como se mede" },
  { id: "individual", label: "Bónus individual" },
  { id: "equipa", label: "Bónus de equipa" },
  { id: "exemplos", label: "Exemplos" },
  { id: "resumo", label: "Resumo" },
];

const FILL = `${Math.round(MIN_FILL_RATE * 100)}%`;

/** «8,00 dá 25 €, 8,50 dá 50 €… e 10,00 dá 300 €» — os patamares por extenso. */
function tiersInWords(tiers: typeof INDIVIDUAL_TIERS): string {
  // Espaço inquebrável: «100 €» nunca parte entre o número e o €.
  const up = [...tiers].reverse().map((t) => `${t.min.toFixed(2).replace(".", ",")} dá ${formatEur(t.eur).replace(" ", "\u00a0")}`);
  return `${up.slice(0, -1).join(", ")} e ${up.at(-1)}`;
}
const TOP_INDIVIDUAL = INDIVIDUAL_TIERS[0].eur;
const TOP_TEAM = TEAM_TIERS[0].eur;

function Condition({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <p className="text-[15px] font-semibold text-white">{title}</p>
      <p className="mt-1 text-[13.5px] leading-snug text-white/55">{detail}</p>
    </div>
  );
}

export default async function BonusNpsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
  const sp = await searchParams;
  const current = lisbonMonthKey(Date.now());
  const lastClosed = shiftMonth(current, -1);
  const fallback = lastClosed < NPS_BONUS_FIRST_MONTH ? NPS_BONUS_FIRST_MONTH : lastClosed;
  const asked = isMonthKey(sp.mes) ? sp.mes : fallback;
  const month = asked < NPS_BONUS_FIRST_MONTH ? NPS_BONUS_FIRST_MONTH : asked > current ? current : asked;
  const data = await buildNpsBonusMonth(month);
  const prev = month > NPS_BONUS_FIRST_MONTH ? shiftMonth(month, -1) : null;
  const next = month < current ? shiftMonth(month, 1) : null;

  return (
    <PageShell backHref="/documentacao" backLabel="Documentação">
      <DocHero
        block={block.title}
        title="Bónus NPS"
        lead={
          <>
            Todos os meses, dois bónus sobre o NPS dos teus clientes: até <Strong>{formatEur(TOP_INDIVIDUAL)} teus</Strong> e até{" "}
            <Strong>{formatEur(TOP_TEAM)} da equipa</Strong>. Conta o mês anterior — em outubro apura-se setembro.
          </>
        }
        meta={`Atualizado a ${formatDate(block.updatedAt)}.${reader.isAdmin ? ` Visível para SuperAdmin e ${block.audienceLabel}.` : ""}`}
        tabs={{ pages: block.pages, current: "/documentacao/bonus-nps" }}
      />

      <SectionNav items={NAV} />

      <div className="mt-8 space-y-14 pb-10">
        <section id="o-mes" data-doc-section className="scroll-mt-40">
          <NpsBonusTracker
            data={data}
            prev={prev}
            next={next}
            inProgress={month === current}
            viewAll={reader.isAdmin}
            username={reader.username}
          />
        </section>

        <DocSection id="como-se-mede" title="Como se mede">
          <Rows
            rows={[
              { term: "Todos os meses", detail: "Cada cliente responde ao NPS uma vez por mês. Se responder duas vezes, conta a última." },
              { term: "Nota de um projeto", detail: "O Índice de satisfação (0–10) da resposta desse mês." },
              { term: "Sem resposta", detail: "O projeto não entra na média. Entra só na taxa de preenchimento." },
              {
                term: "Taxa de preenchimento",
                detail: "Projetos com resposta a dividir pelos projetos ativos da tua carteira. Pausados, terminados e a WonderAds não contam.",
              },
              { term: "Média", detail: "Com 2 casas decimais, sem arredondar: 8,49 não chega aos 8,50." },
              { term: "Apuramento", detail: "O mês fecha no último dia e apura-se no mês seguinte." },
            ]}
          />
          <Note title="Envia no início do mês">
            SMS com o link, uma semana de espera, follow-up, mais uma semana e chamada. Quanto mais cedo sai, mais tempo há para
            a resposta entrar no mês.
          </Note>
        </DocSection>

        <DocSection id="individual" title="Bónus individual" lead="A média dos teus projetos no mês.">
          <ScoreScale tiers={INDIVIDUAL_TIERS} />
          <div>
            <p className="mb-3 text-[14px] text-white/60">
              Só ganhas se cumprires <Strong>as duas</Strong>. Falha uma e o individual é 0 €.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Condition
                title={`${INDIVIDUAL_MIN_PROJECTS} ou mais projetos`}
                detail="Projetos SEO ativos na tua carteira. A WonderAds não conta: é a empresa, não um cliente."
              />
              <Condition title={`${FILL} ou mais de respostas`} detail="Dos teus projetos ativos, no mês." />
            </div>
          </div>
        </DocSection>

        <DocSection
          id="equipa"
          title="Bónus de equipa"
          lead="A média de todas as respostas da equipa SEO no mês. Sobe e desce para todos."
        >
          <ScoreScale tiers={TEAM_TIERS} />
          <div>
            <p className="mb-3 text-[14px] text-white/60">
              Só ganhas se <Strong>a equipa e tu</Strong> chegarem aos {FILL}. Se a equipa não chegar, ninguém recebe o de
              equipa, por muito boa que seja a média.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Condition
                title={`A equipa: ${FILL} ou mais de respostas`}
                detail="Dos projetos ativos de toda a equipa SEO, no mês."
              />
              <Condition
                title={`Tu: ${FILL} ou mais de respostas`}
                detail={`Dos teus projetos. Quem tem menos de ${INDIVIDUAL_MIN_PROJECTS} também entra: com 2 projetos, basta 1 resposta.`}
              />
            </div>
          </div>
        </DocSection>

        <DocSection
          id="exemplos"
          title="Exemplos"
          lead="Num mês em que a equipa teve 62% de respostas e média 9,03: 50 € de bónus de equipa para quem também chegou aos 50%."
        >
          <Rows
            rows={[
              { term: "8 projetos, 5 respostas", detail: "63% de respostas, média 9,12. Individual 100 € + equipa 50 €.", value: "150 €" },
              { term: "6 projetos, 4 respostas", detail: "67% de respostas, média 9,61. Individual 150 € + equipa 50 €.", value: "200 €" },
              { term: "4 projetos, 4 respostas", detail: "100% de respostas, média 10,00. Individual 300 € + equipa 50 €.", value: "350 €" },
              { term: "3 projetos, 2 respostas", detail: "67% de respostas, média 9,05. Individual 100 € + equipa 50 €.", value: "150 €" },
              { term: "2 projetos, 2 respostas", detail: "Média 9,80, mas menos de 3 projetos: sem individual. Equipa 50 €.", value: "50 €" },
              { term: "7 projetos, 3 respostas", detail: "43% de respostas: abaixo de 50%, não ganha nenhum dos dois.", value: "0 €" },
              {
                term: "Equipa com 33% de respostas",
                detail: "Mesmo com média 9,50, ninguém recebe o de equipa. O individual de cada um mantém-se.",
                value: "0 € de equipa",
              },
            ]}
          />
        </DocSection>

        <ExecutiveSummary
          updatedAt={block.updatedAt}
          title="O Bónus NPS, por extenso"
          paragraphs={[
            <>
              O Bónus NPS é a forma como a WonderAds premeia, todos os meses, a satisfação dos clientes de SEO. Parte de uma
              ideia simples: um cliente satisfeito fica mais tempo, renova, recomenda e compra mais, e quem cuida dessa relação
              no dia a dia deve ganhar com isso. Por isso cada cliente ativo responde uma vez por mês ao inquérito NPS, e o
              Índice de satisfação dessa resposta, de 0 a 10, é a nota do projeto nesse mês. Se o cliente responder duas vezes,
              conta a última; se não responder, o projeto fica fora da média, mas continua a pesar na taxa de preenchimento.
            </>,
            <>
              O apuramento é mensal e faz-se sempre sobre o mês anterior: em outubro apura-se setembro. Para cada consultor,
              soma-se a nota dos projetos com resposta e divide-se pelo número de respostas, com duas casas decimais e sem
              arredondar para cima — 8,49 não chega aos 8,50. Conta a carteira de projetos SEO ativos atribuídos ao consultor;
              os pausados, os terminados e a própria WonderAds ficam de fora, porque não são clientes ativos. A taxa de
              preenchimento é o número de projetos com resposta a dividir pelo número de projetos dessa carteira.
            </>,
            <>
              O bónus individual depende da média dos teus projetos: {tiersInWords(INDIVIDUAL_TIERS)}. Para lhe teres direito
              tens de cumprir duas condições ao mesmo tempo: ter pelo menos {INDIVIDUAL_MIN_PROJECTS} projetos ativos na
              carteira e ter resposta em pelo menos {FILL} deles. Quem tem 3 clientes precisa, por isso, de 2 respostas no mês
              (67%); com uma só resposta fica nos 33% e o individual desse mês é {"0\u00a0€"}, por melhor que seja a nota.
            </>,
            <>
              O bónus de equipa olha para a média de todas as respostas da equipa SEO no mês — {tiersInWords(TEAM_TIERS)} — e
              existe para que cada consultor tenha interesse no trabalho dos colegas: sobe e desce para todos. Também tem duas
              portas. A equipa inteira tem de ter resposta em pelo menos {FILL} dos projetos ativos; se não tiver, ninguém
              recebe o bónus de equipa, por melhor que seja a média. E o próprio consultor tem de chegar aos {FILL} na sua
              carteira, seja qual for o número de projetos.
            </>,
            <>
              Na prática, o trabalho do consultor é garantir que o inquérito sai cedo e que a resposta entra dentro do mês:
              SMS no início do mês, uma semana de espera, follow-up, mais uma semana e chamada. O painel no topo desta página
              mostra, mês a mês, a média, a taxa de preenchimento e o valor de cada bónus, com o motivo sempre que um deles não
              é atribuído. Os valores são apurados pela direção, e estes termos podem ser revistos por ela.
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
