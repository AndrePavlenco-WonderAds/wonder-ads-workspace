// /documentacao/bonus-semestral — o Bónus semestral (v78.30): até 500 € duas
// vezes por ano, conforme as ineficácias do semestre. O semestre de cada um
// primeiro, depois a tabela e as regras. Os números saem de
// lib/documentacao/semestral-bonus.ts — os mesmos com que o painel conta.

import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { DocHero, DocSection, DocsClosed, ExecutiveSummary, Rows, Strong } from "@/components/documentacao/doc-ui";
import { SectionNav } from "@/components/documentacao/section-nav";
import { SemesterTiers, SemesterTracker } from "@/components/documentacao/semestral-bonus-visuals";
import { formatDate } from "@/lib/dates";
import { getDocsContext } from "@/lib/documentacao/server";
import { buildSemesterBoard } from "@/lib/documentacao/semestral-bonus-server";
import { SEMESTER_TIERS, tierForSemester, tierRange } from "@/lib/documentacao/semestral-bonus";
import { todayLisbonISO } from "@/lib/probation/progress";
import { formatEur } from "@/lib/proposals/value";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Bónus semestral — Documentação",
};

const BLOCK_ID = "bonus-semestral";

const NAV = [
  { id: "o-semestre", label: "O semestre" },
  { id: "tabela", label: "A tabela" },
  { id: "como-se-conta", label: "Como se conta" },
  { id: "exemplos", label: "Exemplos" },
  { id: "resumo", label: "Resumo" },
];

const TOP = formatEur(SEMESTER_TIERS[0].eur);
const eur = (n: number) => formatEur(n).replace(" ", " ");

/** O valor do escalão `i`, por extenso — os textos seguem a tabela. */
const tierEur = (i: number) => eur(SEMESTER_TIERS[i].eur);

/** Os exemplos são calculados com a mesma função do painel. */
const EXAMPLES: Array<{ no: number; pa: number; why: string }> = [
  { no: 1, pa: 3, why: "Dentro dos dois limites do primeiro escalão." },
  { no: 2, pa: 12, why: `O NO dava ${tierEur(0)}, mas o PA de 12 já é do escalão de baixo.` },
  { no: 3, pa: 8, why: `O PA dava ${tierEur(0)}, mas a 3.ª ineficácia já desce o escalão.` },
  { no: 5, pa: 14, why: `5 ineficácias põem-no nos ${tierEur(2)}, mesmo com o PA dos ${tierEur(1)}.` },
  { no: 4, pa: 22, why: "Com 21 pontos ou mais não há bónus, seja qual for o NO." },
];

/** «com 0 a 2 ineficácias e 0 a 9 pontos o bónus é de 500 €; …» — a tabela por extenso. */
function tableInWords(): string {
  return SEMESTER_TIERS.map((t, i) => {
    const no = tierRange(i, "no");
    const pa = tierRange(i, "pa");
    return i === 0
      ? `com ${no} ineficácias e ${pa} pontos o bónus é de ${eur(t.eur)}`
      : t.eur === 0
        ? `a partir de ${no.replace(" ou mais", "")} ineficácias ou de ${pa.replace(" ou mais", "")} pontos não há bónus`
        : `com ${no} ineficácias ou ${pa} pontos é de ${eur(t.eur)}`;
  }).join("; ");
}

export default async function BonusSemestralPage() {
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
  const board = await buildSemesterBoard({ username: reader.username, all: reader.isAdmin, todayISO: todayLisbonISO() });
  const { semester } = board;

  return (
    <PageShell backHref="/documentacao" backLabel="Documentação">
      <DocHero
        block={block.title}
        title="Bónus semestral"
        pageId="bonus-semestral"
        lead={
          <>
            Duas vezes por ano, até <Strong>{TOP}</Strong> por trabalhares com poucas ineficácias. Conta o semestre inteiro: de
            janeiro a junho e de julho a dezembro.
          </>
        }
        meta={`Atualizado a ${formatDate(block.updatedAt)}.${reader.isAdmin ? ` Visível para SuperAdmin e ${block.audienceLabel}.` : ""}`}
      />

      <SectionNav items={NAV} />

      <div className="mt-8 space-y-14 pb-10">
        <section id="o-semestre" data-doc-section className="scroll-mt-40">
          <SemesterTracker board={board} viewAll={reader.isAdmin} />
        </section>

        <DocSection id="tabela" title="A tabela" lead="Quatro escalões. Conta o pior dos dois contadores.">
          <SemesterTiers />
        </DocSection>

        <DocSection id="como-se-conta" title="Como se conta">
          <Rows
            rows={[
              {
                term: "O semestre",
                detail: "De janeiro a junho, avaliado em junho. De julho a dezembro, avaliado em dezembro.",
              },
              { term: "NO", detail: "O número de ineficácias pontuadas pela direção, com data dentro do semestre." },
              { term: "PA", detail: "A soma dos pontos dessas ineficácias." },
              {
                term: "O pior dos dois",
                tone: "accent",
                detail: "Para ficar num escalão tens de cumprir os dois limites. Basta um passar para desceres.",
              },
              {
                term: "Sem reinício",
                detail: "Ao contrário da escala, subir de nível não põe estes contadores a zero: conta o semestre inteiro.",
              },
              { term: "Por pontuar", detail: "Só entra quando a direção a pontuar. Com 0 pontos, não conta." },
            ]}
          />
          <p className="text-[14.5px] text-white/65">
            As ineficácias e a escala estão explicadas em{" "}
            <Link href="/documentacao/ineficacias" className="font-medium text-[#c4a6ff] hover:text-white">
              Ineficácias
            </Link>
            .
          </p>
        </DocSection>

        <DocSection id="exemplos" title="Exemplos">
          <Rows
            rows={EXAMPLES.map((x) => ({
              term: `NO ${x.no}, PA ${x.pa}`,
              detail: x.why,
              value: formatEur(tierForSemester(x.no, x.pa).eur),
            }))}
          />
        </DocSection>

        <ExecutiveSummary
          updatedAt={block.updatedAt}
          title="O bónus semestral, por extenso"
          paragraphs={[
            <>
              O bónus semestral premeia, duas vezes por ano, quem trabalha com poucas ineficácias. É a outra face do sistema de
              ineficácias: a escala trata o que se repete, com 1:1 e medidas; o bónus semestral recompensa quem, ao longo de seis
              meses, quase não erra, ou erra pouco e com pouco peso. Vale até {TOP} por semestre e aplica-se ao SEO DPT.
            </>,
            <>
              O ano divide-se em dois semestres: de janeiro a junho, avaliado em junho, e de julho a dezembro, avaliado em
              dezembro. Em cada um contam as ineficácias pontuadas pela direção cuja data cai dentro do semestre: o NO é o número
              delas e o PA é a soma dos pontos. Ao contrário da escala, estes contadores não voltam a zero quando se sobe de nível, porque
              conta o semestre inteiro. Uma ineficácia por pontuar só entra quando a direção a pontuar, e uma com 0 pontos não
              conta.
            </>,
            <>
              A tabela é simples: {tableInWords()}. Conta sempre o pior dos dois. Para ficar num escalão é preciso cumprir os dois
              limites, e basta um deles passar para descer: com 2 ineficácias mas 12 pontos, o bónus é de {tierEur(1)}.
            </>,
            <>
              O que mais protege o bónus é o mesmo que protege na escala: reportar cedo e com transparência, porque um erro
              reportado pelo próprio pesa menos, e não repetir o mesmo erro. O painel no topo desta página mostra o{" "}
              {semester.label} até hoje — o NO, o PA e o escalão em que estás — e a direção apura o valor no fim de cada
              semestre.
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
