// /playbook/bonus-nps — o bónus NPS dos consultores SEO (v78.5): as regras
// e o tracking do mês. As tabelas desenham-se das mesmas constantes que
// fazem as contas (lib/playbook/nps-bonus.ts).

import { PageShell } from "@/components/page-shell";
import { BlockTabs, Bullets, Callout, DocHeader, DocToc, PlaybookClosed, RuleTable, Section } from "@/components/playbook/doc-ui";
import { NpsBonusTracker } from "@/components/playbook/nps-bonus-tracker";
import { formatDate } from "@/lib/dates";
import { getPlaybookContext } from "@/lib/playbook/server";
import { buildNpsBonusMonth } from "@/lib/playbook/nps-bonus-server";
import {
  INDIVIDUAL_TIERS,
  NPS_BONUS_FIRST_MONTH,
  TEAM_TIERS,
  isMonthKey,
  lisbonMonthKey,
  shiftMonth,
} from "@/lib/playbook/nps-bonus";
import { formatEur } from "@/lib/proposals/value";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Bónus NPS — Playbook",
};

const BLOCK_ID = "remuneracao-variavel";

const TOC = [
  { id: "tracking", label: "O mês" },
  { id: "como-se-mede", label: "Como se mede" },
  { id: "individual", label: "Bónus individual" },
  { id: "equipa", label: "Bónus de equipa" },
  { id: "exemplos", label: "Exemplos" },
];

const two = (n: number) => n.toFixed(2).replace(".", ",");

/** Faixas fechadas, de baixo para cima: «Abaixo de 8,00», «8,00 – 8,49», …, «10,00». */
function tierRows(tiers: { min: number; eur: number }[]): string[][] {
  const up = [...tiers].reverse();
  return [
    [`Abaixo de ${two(up[0].min)}`, "0 €"],
    ...up.map((t, i) => {
      const next = up[i + 1];
      const range = next ? `${two(t.min)} – ${two(next.min - 0.01)}` : two(t.min);
      return [range, formatEur(t.eur)];
    }),
  ];
}

export default async function BonusNpsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getPlaybookContext(BLOCK_ID);
  if (ctx.state === "no-session") return null;
  if (ctx.state !== "ok" || !ctx.block) {
    return (
      <PageShell backHref="/playbook" backLabel="Playbook">
        <PlaybookClosed
          kind={ctx.state === "closed" ? "closed" : "forbidden"}
          name={ctx.state === "closed" ? ctx.name : ctx.state === "forbidden" ? ctx.reader.name : ""}
        />
      </PageShell>
    );
  }

  const { reader, block } = ctx;
  const sp = await searchParams;
  const current = lisbonMonthKey(Date.now());
  const fallback = shiftMonth(current, -1) < NPS_BONUS_FIRST_MONTH ? NPS_BONUS_FIRST_MONTH : shiftMonth(current, -1);
  const asked = isMonthKey(sp.mes) ? sp.mes : fallback;
  const month = asked < NPS_BONUS_FIRST_MONTH ? NPS_BONUS_FIRST_MONTH : asked > current ? current : asked;
  const data = await buildNpsBonusMonth(month);
  const prev = month > NPS_BONUS_FIRST_MONTH ? shiftMonth(month, -1) : null;
  const next = month < current ? shiftMonth(month, 1) : null;

  return (
    <PageShell backHref="/playbook" backLabel="Playbook">
      <div className="grid gap-10 xl:grid-cols-[1fr_11rem]">
        <div className="min-w-0">
          <DocHeader
            eyebrow={`Playbook · ${block.title}`}
            title="Bónus NPS"
            lead={
              <>
                Dois bónus por mês, sobre o NPS dos teus clientes: <strong className="text-white">um teu</strong> e{" "}
                <strong className="text-white">um da equipa</strong>. Conta sempre o mês anterior — em outubro apura-se
                setembro.
              </>
            }
            meta={<>Atualizado {formatDate(block.updatedAt)} · SuperAdmin + {block.audienceLabel}</>}
          />
          <BlockTabs pages={block.pages} current="/playbook/bonus-nps" />

          <div className="mt-10 space-y-10">
            <section id="tracking" className="animate-fade-up scroll-mt-24">
              <NpsBonusTracker
                data={data}
                prev={prev}
                next={next}
                inProgress={month === current}
                viewAll={reader.isAdmin}
                username={reader.username}
              />
            </section>

            <Section id="como-se-mede" n="01" title="Como se mede">
              <Bullets
                items={[
                  <>
                    <strong className="text-white">Mensal.</strong> Cada mês fecha no último dia; o bónus apura-se no mês
                    seguinte.
                  </>,
                  <>
                    <strong className="text-white">Nota de um projeto</strong> = o Índice de satisfação (0–10) da resposta
                    NPS desse mês. Se o cliente respondeu duas vezes, conta a última.
                  </>,
                  <>
                    <strong className="text-white">Projeto sem resposta não entra na média.</strong> Entra só na taxa de
                    preenchimento.
                  </>,
                  <>
                    <strong className="text-white">Taxa de preenchimento</strong> = projetos com resposta ÷ projetos
                    ativos na tua carteira. Pausados e terminados não contam.
                  </>,
                  <>
                    <strong className="text-white">A média conta com 2 casas, sem arredondar.</strong> 8,49 não é 8,5.
                  </>,
                ]}
              />
            </Section>

            <Section
              id="individual"
              n="02"
              title="Bónus individual"
              lead="A média dos teus projetos no mês."
            >
              <RuleTable
                head={["Média do mês", "Bónus"]}
                rows={tierRows(INDIVIDUAL_TIERS)}
              />
              <Callout>
                <strong className="text-white">Só ganha quem cumpre as duas:</strong> mais de 4 projetos ativos (5 ou mais){" "}
                <strong className="text-white">e</strong> pelo menos 50% de preenchimento no mês. Falha uma, o individual
                é 0 €.
              </Callout>
            </Section>

            <Section
              id="equipa"
              n="03"
              title="Bónus de equipa"
              lead="A média de todas as respostas da equipa SEO no mês. Sobe e desce para todos."
            >
              <RuleTable
                head={["Média da equipa", "Bónus por pessoa"]}
                rows={tierRows(TEAM_TIERS)}
              />
              <Callout>
                <strong className="text-white">Ganha quem teve pelo menos 50% de preenchimento</strong>, seja qual for o
                n.º de projetos — quem tem menos de 5 também entra. Com 2 projetos, basta 1 resposta.
              </Callout>
            </Section>

            <Section id="exemplos" n="04" title="Exemplos" lead="Média da equipa no mês: 9,03 → 50 € de bónus de equipa.">
              <RuleTable
                head={["Consultor", "Projetos", "Respostas", "Média", "Individual", "Equipa", "Total"]}
                rows={[
                  ["A", "8", "5 (63%)", "9,12", "100 €", "50 €", <strong key="a" className="text-white">150 €</strong>],
                  ["B", "4", "3 (75%)", "9,80", "0 € — menos de 5 projetos", "50 €", <strong key="b" className="text-white">50 €</strong>],
                  ["C", "7", "3 (43%)", "9,50", "0 € — abaixo de 50%", "0 € — abaixo de 50%", <strong key="c" className="text-white">0 €</strong>],
                  ["D", "6", "6 (100%)", "10,00", "300 €", "50 €", <strong key="d" className="text-white">350 €</strong>],
                ]}
              />
            </Section>

            <p className="border-t border-white/[0.07] pt-6 text-[12px] text-white/40">
              Estes termos podem ser revistos pela direção. Dúvidas: Diretor de Operações.
            </p>
          </div>
        </div>
        <DocToc items={TOC} />
      </div>
    </PageShell>
  );
}
