// /documentacao/ineficacias — o sistema de Ineficácias explicado (v78.19;
// reescrita mais curta em v78.21, com a regra do reinício no 1:1).
//
// Tudo o que é número sai de lib/ineficacias/shared.ts — as mesmas
// constantes com que a app conta. A calculadora da folha RH-04 é só da
// direção (a app nunca a mostra ao consultor): aqui também só aparece a
// SuperAdmins.

import Link from "next/link";
import type { ReactNode } from "react";
import { PageShell } from "@/components/page-shell";
import { DocHero, DocSection, DocsClosed, ExecutiveSummary, Note, Rows, StageFlow, SubHeading } from "@/components/documentacao/doc-ui";
import { SectionNav } from "@/components/documentacao/section-nav";
import { LevelStairs, PhaseReset, PointsScale, ScenarioCard } from "@/components/documentacao/ineficacias-visuals";
import { formatDate } from "@/lib/dates";
import { getDocsContext } from "@/lib/documentacao/server";
import {
  ERROR_TYPES,
  IMPACTS,
  MAX_POINTS,
  NOTICED_OPTIONS,
  REASONS,
  REPORT_LOOKBACK_DAYS,
  SCORE_RULES,
  suggestScore,
  thresholdToReach,
} from "@/lib/ineficacias/shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Ineficácias — Documentação",
};

const BLOCK_ID = "ineficacias";

const NAV = [
  { id: "o-sistema", label: "O sistema" },
  { id: "reportar", label: "Reportar" },
  { id: "pontos", label: "Pontos" },
  { id: "pa-e-no", label: "PA e NO" },
  { id: "niveis", label: "Níveis" },
  { id: "cenarios", label: "Cenários" },
  { id: "objetivo", label: "Objetivo semestral" },
];
const NAV_ALL = [...NAV, { id: "resumo", label: "Resumo" }];
const NAV_ADMIN = [...NAV, { id: "calculadora", label: "Calculadora" }, { id: "resumo", label: "Resumo" }];

const L1 = thresholdToReach(1);
const L2 = thresholdToReach(2);

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

// O exemplo da calculadora sai da própria calculadora.
const EXAMPLE = suggestScore({
  impacts: ["cliente"],
  reason: "atencao",
  firstTime: false,
  errorType: "recorrencia",
  noticed: "cliente",
});

const FIELDS = [
  "O que aconteceu",
  "Cliente ou projeto",
  "Motivo",
  "Como devias ter feito",
  "Primeira vez?",
  "Data",
  "Quem deu pelo erro",
  "Gravidade de 0 a 10, na tua avaliação",
];

const EXAMPLES = ["Prazo falhado sem aviso", "Trabalho refeito mais de uma vez", "Erro visível para o cliente", "Processo não seguido", "Report não enviado"];

export default async function IneficaciasDocPage() {
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
  const admin = reader.isAdmin;

  return (
    <PageShell backHref="/documentacao" backLabel="Documentação">
      <DocHero
        block={block.title}
        title="Ineficácias"
        lead="Cada erro fica registado, com data e peso. Os que se acumulam fazem subir na escala."
        meta={`Atualizado a ${formatDate(block.updatedAt)}.${admin ? ` Visível para SuperAdmin e ${block.audienceLabel}.` : ""}`}
        tabs={{ pages: block.pages, current: "/documentacao/ineficacias" }}
      />

      <div className="mt-6 flex flex-wrap gap-2.5">
        {admin ? (
          <>
            <CtaLink href="/admin/ineficacias/registar" primary>
              Registar ineficácia
            </CtaLink>
            <CtaLink href="/admin/ineficacias">Ineficácias da equipa</CtaLink>
          </>
        ) : (
          <>
            <CtaLink href="/ineficacias" primary>
              Reportar um erro
            </CtaLink>
            <CtaLink href="/ineficacias/painel">O meu painel</CtaLink>
          </>
        )}
      </div>

      <SectionNav items={admin ? NAV_ADMIN : NAV_ALL} />

      <div className="mt-8 space-y-14 pb-10">
        <DocSection id="o-sistema" title="Aprendizagem ou recorrência">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
              <p className="text-[1.3rem] font-semibold text-white">Erro de aprendizagem</p>
              <p className="mt-2 text-[15px] leading-relaxed text-white/70">Tarefa ainda nova. Faz parte de aprender.</p>
            </div>
            <div
              className="rounded-3xl p-6 shadow-[0_24px_70px_-30px_rgba(197,53,201,0.8)]"
              style={{ background: "linear-gradient(135deg, rgba(120,61,245,0.55), rgba(197,53,201,0.45))" }}
            >
              <p className="text-[1.3rem] font-semibold text-white">Erro de recorrência</p>
              <p className="mt-2 text-[15px] leading-relaxed text-white/90">
                Já sabias fazer, ou já tinha acontecido. É o que faz subir na escala.
              </p>
            </div>
          </div>
          <StageFlow
            stages={[
              { title: "Ineficácias", body: "Os erros, um a um, com data e peso." },
              { title: "Escala", body: "Os erros acumulados fazem subir de nível." },
              {
                title: "Probation",
                body: "O fim da escala, ou uma falha grave.",
                foot: (
                  <Link href="/documentacao/probation" className="text-[14px] font-medium text-[#c4a6ff] hover:text-white">
                    Como funciona o probation
                  </Link>
                ),
              },
            ]}
          />
        </DocSection>

        <DocSection id="reportar" title="Como se reporta" lead="Reportar primeiro conta a teu favor.">
          <StageFlow
            stages={[
              { title: "Reportas", body: `No RH-03, quando quiseres. Erros dos últimos ${REPORT_LOOKBACK_DAYS} dias.` },
              { title: "A direção pontua", body: `De 0 a ${MAX_POINTS} pontos. Recebes um aviso no sino.` },
              { title: "Conta no PA e NO", body: "Um erro com 0 pontos não conta." },
            ]}
          />

          <div>
            <SubHeading>Por cada erro</SubHeading>
            <Pills items={FIELDS} />
          </div>

          <div>
            <SubHeading>Os quatro motivos</SubHeading>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {REASONS.map((r) => (
                <div key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#783DF5]/25 text-[14px] font-semibold text-[#e2d6ff]">
                    {r.letter}
                  </span>
                  <p className="mt-3 text-[15px] font-semibold text-white">{r.label}</p>
                  {r.id !== "outro" && <p className="mt-1 text-[14px] leading-snug text-white/65">{r.hint}</p>}
                </div>
              ))}
            </div>
          </div>

          <p className="max-w-3xl text-[15px] leading-relaxed text-white/75">
            Assinas com o teu nome completo. Só tu e a direção veem o relatório, nunca os colegas. A direção também pode
            registar um erro diretamente: conta como os outros.
          </p>
        </DocSection>

        <DocSection id="pontos" title="Quanto vale um erro" lead={`De 0 a ${MAX_POINTS} pontos, dados pela direção.`}>
          <PointsScale />
          <div>
            <SubHeading>Exemplos</SubHeading>
            <Pills items={EXAMPLES} />
          </div>
        </DocSection>

        <DocSection
          id="pa-e-no"
          title="PA e NO"
          lead="PA é a soma dos pontos. NO é o número de erros. Acumulam até ao próximo 1:1 de nível."
        >
          <PhaseReset />
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { t: "Só o 1:1 põe a zero", d: "Sempre que há um 1:1 de nível, PA e NO recomeçam do zero para a fase seguinte." },
              { t: "O nível não desce", d: "A progressão é linear e cumulativa." },
              { t: "Nada se apaga", d: "Os contadores recomeçam; os erros ficam no histórico." },
            ].map((x) => (
              <div key={x.t} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <p className="text-[15.5px] font-semibold text-white">{x.t}</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-white/65">{x.d}</p>
              </div>
            ))}
          </div>
        </DocSection>

        <DocSection id="niveis" title="Os níveis" lead="Passa o limiar e sobe-se um nível. Cada nível tem a sua medida.">
          <LevelStairs />
          <Note tone="warn" title="Falha grave">
            Uma falha grave sozinha pode levar a probation direto. Decide a direção, com justificação.
          </Note>
        </DocSection>

        <DocSection id="cenarios" title="Três cenários">
          <div className="grid gap-4 lg:grid-cols-3">
            <ScenarioCard title="A gravidade basta" context="Um erro de 4 pontos e outro de 2." points={[4, 2]} limit={L1} result="PA 6: nível 1." />
            <ScenarioCard title="A recorrência basta" context="Três erros leves, de 1 ponto." points={[1, 1, 1]} limit={L1} result="NO 3: nível 1." />
            <ScenarioCard
              title="A progressão acumula"
              context="Depois do 1:1 do nível 2, do zero: dois erros leves."
              points={[1, 1]}
              limit={L2}
              result="NO 2: probation."
              top
            />
          </div>
        </DocSection>

        <DocSection id="objetivo" title="Objetivo semestral">
          <div className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:flex-row sm:items-center sm:p-7">
            <div className="shrink-0">
              <p className="text-[13px] text-white/55">Por mês, menos de</p>
              <p className="text-[3.2rem] font-semibold leading-none tracking-[-0.02em] text-white">
                X <span className="text-[1.2rem] font-medium text-white/70">ineficácias</span>
              </p>
            </div>
            <div className="sm:border-l sm:border-white/10 sm:pl-6">
              <p className="text-[15.5px] leading-relaxed text-white/80">
                Além da escala, é um dos objetivos do semestre. Se não for cumprido, tem impacto no bónus semestral.
              </p>
              <span className="mt-3 inline-block rounded-full border border-amber-400/40 bg-amber-400/15 px-2.5 py-1 text-[12.5px] font-medium text-amber-200">
                X por definir pela direção
              </span>
            </div>
          </div>
        </DocSection>

        {admin && (
          <DocSection
            id="calculadora"
            title="Como a direção pontua"
            lead="A calculadora do RH-04 sugere; a direção decide. Os consultores não veem esta secção."
          >
            <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
              <Rows
                rows={[
                  {
                    term: "Ponto de partida",
                    detail: `O impacto mais pesado: ${IMPACTS.map((i) => `${i.label.toLowerCase()} ${i.base}`).join(", ")}. Sem impacto: ${SCORE_RULES.noImpactBase}.`,
                  },
                  {
                    term: "Mais impactos",
                    detail: `${signed(SCORE_RULES.extraImpact)} cada, até ${signed(SCORE_RULES.extraImpact * SCORE_RULES.extraImpactCap)}.`,
                  },
                  { term: "Motivo", detail: REASONS.map((r) => `${r.letter} ${signed(SCORE_RULES.reason[r.id])}`).join(" · ") },
                  { term: "Repetido", detail: signed(SCORE_RULES.repeated) },
                  {
                    term: "Tipo de erro",
                    detail: ERROR_TYPES.map(
                      (t) => `${t.id === "aprendizagem" ? "Aprendizagem" : "Recorrência"} ${signed(SCORE_RULES.errorType[t.id])}`,
                    ).join(" · "),
                  },
                  {
                    term: "Quem deu pelo erro",
                    detail: `${NOTICED_OPTIONS.map(
                      (n) => `${n.id === "proprio" ? "O próprio" : n.id === "equipa" ? "colega ou líder" : "o cliente"} ${signed(SCORE_RULES.noticed[n.id])}`,
                    ).join(" · ")}. O cliente conta também como «chegou ao cliente».`,
                  },
                  { term: "Total", detail: `Entre 1 e ${MAX_POINTS}. A direção pode dar outro valor, incluindo 0.` },
                ]}
              />
              <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
                <SubHeading aside="Exemplo">Erro repetido que o cliente apontou</SubHeading>
                <ul className="mt-3 divide-y divide-white/[0.07]">
                  {EXAMPLE.lines.map((l, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-4 py-2.5 text-[14px]">
                      <span className="text-white/70">{l.label}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-white">{l.base ? l.value : signed(l.value)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-white/15 pt-3">
                  <span className="text-[14px] text-white/70">
                    Soma {EXAMPLE.raw}
                    {EXAMPLE.raw !== EXAMPLE.points && `, fica em ${MAX_POINTS}`}
                  </span>
                  <span className="text-[1.6rem] font-semibold tabular-nums text-white">
                    {EXAMPLE.points} <span className="text-[14px] font-medium text-white/60">· {EXAMPLE.band.label}</span>
                  </span>
                </div>
              </div>
            </div>
            <Note title="Registar o 1:1">
              Em «Ineficácias da equipa», com a data, quem o conduziu e as 1 a 3 ações. É esse registo que põe PA e NO a zero.
            </Note>
          </DocSection>
        )}

        <ExecutiveSummary
          updatedAt={block.updatedAt}
          title="As ineficácias, por extenso"
          paragraphs={[
            <>
              As ineficácias são o registo, erro a erro, das falhas de execução de cada pessoa da equipa: um prazo falhado sem
              aviso, um trabalho que teve de ser refeito, um erro que chegou ao cliente, um processo que não foi seguido. O
              objetivo não é castigar o erro, que faz parte de aprender, mas separar o erro de aprendizagem — natural numa
              tarefa nova — do erro de recorrência, que acontece com algo que já se sabia fazer ou que já tinha acontecido. É a
              recorrência que o sistema existe para tornar visível e corrigir cedo.
            </>,
            <>
              O registo começa no próprio consultor. Quando quiser, e sobre erros dos últimos {REPORT_LOOKBACK_DAYS} dias, assina
              um relatório (RH-03) em que descreve, por cada erro, o que aconteceu, em que cliente, o motivo, como devia ter
              feito, se foi a primeira vez, a data, quem deu pelo erro e a gravidade na sua própria avaliação, de 0 a{" "}
              {MAX_POINTS}. O relatório fica assinado com o nome completo e não se altera depois; só o próprio e a direção o
              veem. A direção também pode registar um erro diretamente, e esse registo conta como os outros.
            </>,
            <>
              Cada erro recebe da direção uma pontuação de 0 a {MAX_POINTS}: de 1 a 3 é baixo e recuperável no próprio dia, de 4
              a 6 é médio e obriga alguém a refazer trabalho, 7 ou 8 é alto e tem impacto direto no cliente ou na equipa, e 9
              ou 10 é crítico, com risco real para o negócio; 0 quer dizer que não conta. Os erros pontuados alimentam dois
              contadores, o PA, que é a soma dos pontos, e o NO, que é o número de erros. Acumulam até ao próximo 1:1 de nível
              e só aí voltam a zero; os erros nunca se apagam e ficam no histórico.
            </>,
            <>
              Quando os contadores passam o limiar, sobe-se um nível, e cada nível tem a sua medida. O nível 1 chega com PA ≥{" "}
              {L1.pa} ou NO ≥ {L1.no} e traz um 1:1 com o líder direto e um plano de 1 a 3 ações. O nível 2, depois do 1, chega
              com PA ≥ {L2.pa} ou NO ≥ {L2.no} e traz um 1:1 com o nível acima e medidas extra. O nível 3, depois do 2, com o
              mesmo limiar, é o probation. A progressão é linear e cumulativa — o nível nunca desce — e uma falha grave sozinha
              pode levar diretamente ao probation, por decisão fundamentada da direção.
            </>,
            <>
              Além da escala há um objetivo semestral: ficar abaixo de um número de ineficácias por mês, ainda a definir pela
              direção, que, se não for cumprido, tem impacto no bónus semestral. O que protege cada pessoa é reportar cedo e com
              transparência: um erro que o próprio reporta pesa menos do que um apontado por outros, e um padrão identificado a
              tempo resolve-se num 1:1 antes de chegar ao fim da escala.
            </>,
          ]}
        />
      </div>
    </PageShell>
  );
}

function Pills({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {items.map((x) => (
        <li key={x} className="rounded-full border border-white/12 px-3.5 py-1.5 text-[14px] text-white/80">
          {x}
        </li>
      ))}
    </ul>
  );
}

function CtaLink({ href, primary = false, children }: { href: string; primary?: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-flex h-11 items-center rounded-2xl px-5 text-[14px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5] ${
        primary ? "bg-white text-[#07080d] hover:bg-white/90" : "border border-white/15 text-white/80 hover:border-white/30 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
