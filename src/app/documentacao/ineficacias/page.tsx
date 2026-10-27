// /documentacao/ineficacias — o sistema de Ineficácias explicado (v78.19):
// aprendizagem vs recorrência, como se reporta (RH-03), quanto vale (0–10),
// PA e NO na janela dos 30 dias, a escala dos níveis e três cenários.
//
// Tudo o que é número sai de lib/ineficacias/shared.ts — as mesmas
// constantes com que a app conta. A calculadora da folha RH-04 é só da
// direção (a app nunca a mostra ao consultor): aqui também só aparece a
// SuperAdmins.

import Link from "next/link";
import type { ReactNode } from "react";
import { PageShell } from "@/components/page-shell";
import { Bullets, DocHero, DocSection, DocsClosed, Note, Rows, StageFlow, Strong, SubHeading } from "@/components/documentacao/doc-ui";
import { SectionNav } from "@/components/documentacao/section-nav";
import { LevelStairs, PointsScale, ScenarioCard, WindowTimeline } from "@/components/documentacao/ineficacias-visuals";
import { formatDate } from "@/lib/dates";
import { getDocsContext } from "@/lib/documentacao/server";
import {
  DIRECT_LOOKBACK_DAYS,
  ERROR_TYPES,
  IMPACTS,
  LIMITS,
  MAX_POINTS,
  NOTICED_OPTIONS,
  REASONS,
  REPORT_LOOKBACK_DAYS,
  SCORE_RULES,
  WINDOW_DAYS,
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
  { id: "quanto-vale", label: "Quanto vale" },
  { id: "pa-e-no", label: "PA e NO" },
  { id: "escala", label: "A escala" },
  { id: "cenarios", label: "Cenários" },
];
const NAV_ADMIN = [...NAV, { id: "calculadora", label: "Calculadora" }];

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

const ERROR_KIND = Object.fromEntries(ERROR_TYPES.map((t) => [t.id, t])) as Record<
  (typeof ERROR_TYPES)[number]["id"],
  (typeof ERROR_TYPES)[number]
>;

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
        lead="Errar faz parte de aprender; repetir o mesmo erro, não. Cada erro fica registado com data e peso, e o que se acumula sobe na escala."
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

      <SectionNav items={admin ? NAV_ADMIN : NAV} />

      <div className="mt-8 space-y-14 pb-10">
        <DocSection id="o-sistema" title="Aprendizagem ou recorrência" lead="É a diferença que o sistema existe para medir.">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
              <p className="text-[13px] font-medium text-sky-200/80">Faz parte</p>
              <p className="mt-1 text-[1.35rem] font-semibold tracking-[-0.01em] text-white">{ERROR_KIND.aprendizagem.label}</p>
              <p className="mt-2 text-[14.5px] leading-relaxed text-white/60">
                {ERROR_KIND.aprendizagem.hint} Reportas, corriges, aprendes.
              </p>
            </div>
            <div
              className="rounded-3xl p-6 text-white shadow-[0_24px_70px_-30px_rgba(197,53,201,0.8)]"
              style={{ background: "linear-gradient(135deg, rgba(120,61,245,0.55), rgba(197,53,201,0.45))" }}
            >
              <p className="text-[13px] font-medium text-white/75">Não devia acontecer</p>
              <p className="mt-1 text-[1.35rem] font-semibold tracking-[-0.01em]">{ERROR_KIND.recorrencia.label}</p>
              <p className="mt-2 text-[14.5px] leading-relaxed text-white/85">
                {ERROR_KIND.recorrencia.hint} É o que faz subir na escala.
              </p>
            </div>
          </div>

          <div>
            <SubHeading>Três peças, três papéis</SubHeading>
            <div className="mt-5">
              <StageFlow
                stages={[
                  {
                    title: "As ineficácias",
                    body: "Os erros, registados um a um, com data e peso. O termómetro do dia a dia.",
                  },
                  {
                    title: "A escala",
                    body: "Quando os erros se acumulam, sobe-se de nível. Cada nível tem a sua medida.",
                  },
                  {
                    title: "O probation",
                    body: "Normalmente, o fim da escala. Uma falha grave sozinha pode levar lá direto.",
                    foot: (
                      <Link href="/documentacao/probation" className="text-[13.5px] font-medium text-[#c4a6ff] hover:text-white">
                        Como funciona o probation
                      </Link>
                    ),
                  },
                ]}
              />
            </div>
          </div>
          <p className="max-w-2xl text-[1.15rem] font-medium leading-snug text-white/85">
            A escala mede o que se repete. O probation trata o que já não se resolve sozinho.
          </p>
        </DocSection>

        <DocSection
          id="reportar"
          title="Como se reporta"
          lead="Quem dá pelo erro primeiro és tu. Reportá-lo é o que te protege: um erro que reportas pesa menos do que um que outra pessoa aponta."
        >
          <StageFlow
            stages={[
              {
                title: "Reportas",
                body: `No formulário RH-03, quando quiseres. Um relatório leva um ou mais erros (até ${LIMITS.maxItems}) dos últimos ${REPORT_LOOKBACK_DAYS} dias.`,
              },
              {
                title: "A direção pontua",
                body: `Cada erro recebe de 0 a ${MAX_POINTS} pontos. Recebes um aviso no sino quando estiver pontuado.`,
              },
              {
                title: "Conta na escala",
                body: "Só então entra no teu PA e NO. Um erro com 0 pontos não entra nas contas.",
              },
            ]}
          />

          <div>
            <SubHeading>Por cada erro</SubHeading>
            <div className="mt-3">
              <Rows
                rows={[
                  { term: "O que aconteceu", detail: "Com factos: o quê, quando, o que ficou por fazer ou saiu mal." },
                  { term: "Cliente ou projeto", detail: "O cliente onde aconteceu, ou «Interno»." },
                  { term: "O motivo", detail: "Um de quatro — em baixo." },
                  { term: "Como devias ter feito", detail: "O que farias de diferente para não voltar a acontecer." },
                  { term: "Primeira vez?", detail: "Se não foi, quando foi a última vez." },
                  { term: "A data", detail: `Até ${REPORT_LOOKBACK_DAYS} dias atrás.` },
                  { term: "Quem deu pelo erro", detail: "Tu, um colega ou líder, ou o cliente." },
                ]}
              />
            </div>
          </div>

          <div>
            <SubHeading>Os quatro motivos</SubHeading>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {REASONS.map((r) => (
                <div key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#783DF5]/20 text-[14px] font-semibold text-[#d9c8ff]">
                    {r.letter}
                  </span>
                  <p className="mt-3 text-[14.5px] font-semibold text-white">{r.label}</p>
                  <p className="mt-1 text-[13px] leading-snug text-white/55">{r.hint}</p>
                </div>
              ))}
            </div>
          </div>

          <Rows
            rows={[
              {
                term: "Assinatura",
                detail:
                  "Confirmas a declaração e escreves o teu nome completo, exatamente como está na conta. O relatório fica com data, hora e uma impressão digital do conteúdo: não se altera depois.",
              },
              { term: "Quem vê", detail: <>Só tu e a direção. <Strong>Nunca os colegas.</Strong></> },
              {
                term: "Registo da direção",
                detail: `A direção também pode registar um erro diretamente (folha RH-04), até ${DIRECT_LOOKBACK_DAYS} dias atrás. Aparece-te em «Ocorrências registadas pela direção» e conta como os outros.`,
              },
            ]}
          />
        </DocSection>

        <DocSection id="quanto-vale" title="O que conta e quanto vale" lead={`Cada erro vale de 0 a ${MAX_POINTS} pontos. Quem os dá é a direção.`}>
          <PointsScale />
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <SubHeading>Exemplos de ineficácias</SubHeading>
              <div className="mt-3">
                <Bullets
                  items={[
                    "Prazo não cumprido, sem aviso",
                    "Trabalho devolvido para refazer mais do que uma vez",
                    "Erro visível para o cliente",
                    "Processo não seguido",
                    "Report não enviado",
                  ]}
                />
              </div>
            </div>
            <div>
              <SubHeading>O que pesa nos pontos</SubHeading>
              <div className="mt-3">
                <Bullets
                  items={[
                    "O impacto: obrigou a refazer, atrasou um prazo, chegou ao cliente ou pôs o negócio em risco",
                    "Se é a primeira vez ou se é repetido",
                    "Se é de aprendizagem ou de recorrência",
                    "O motivo",
                    "Quem deu pelo erro",
                  ]}
                />
              </div>
            </div>
          </div>
        </DocSection>

        <DocSection
          id="pa-e-no"
          title="PA e NO"
          lead={`Os dois contadores da escala, sempre sobre os últimos ${WINDOW_DAYS} dias. Cada erro pontuado conta a partir do dia em que aconteceu e sai ${WINDOW_DAYS} dias depois.`}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
              <p className="text-[2.4rem] font-semibold leading-none tracking-[-0.02em] text-white">PA</p>
              <p className="mt-2 text-[15px] font-medium text-white">Pontos acumulados</p>
              <p className="mt-1 text-[14px] text-white/55">A soma dos pontos dos erros que contam.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
              <p className="text-[2.4rem] font-semibold leading-none tracking-[-0.02em] text-white">NO</p>
              <p className="mt-2 text-[15px] font-medium text-white">Número de ocorrências</p>
              <p className="mt-1 text-[14px] text-white/55">Quantos erros contam, pese cada um o que pesar.</p>
            </div>
          </div>
          <WindowTimeline />
          <Rows
            rows={[
              { term: `${WINDOW_DAYS} dias sem erros`, detail: "PA e NO voltam a zero." },
              { term: "O histórico", detail: "Fica sempre. Os contadores reiniciam, os erros não se apagam." },
              { term: "O teu painel", detail: "Mostra o teu PA, o teu NO e o dia em que cada erro deixa de contar." },
            ]}
          />
        </DocSection>

        <DocSection id="escala" title="A escala" lead="Passa o limiar e sobe-se um nível. Cada nível tem uma medida, e cada medida abre uma fase nova.">
          <LevelStairs />
          <Rows
            rows={[
              {
                term: "O limiar",
                detail: `Nível 1: PA ≥ ${L1.pa} ou NO ≥ ${L1.no}. Níveis 2 e 3: PA ≥ ${L2.pa} ou NO ≥ ${L2.no}, contados depois do nível anterior.`,
              },
              {
                term: "Depois de cada 1:1",
                detail: "PA e NO voltam a zero para a fase seguinte. O nível fica: a progressão é linear e cumulativa.",
              },
              {
                term: "Medida por aplicar",
                detail: "Passado o limiar, a medida fica por aplicar até a direção a registar, mesmo que entretanto os erros saiam da janela.",
              },
              {
                term: "Falha grave",
                tone: "amber",
                detail: "Uma falha grave sozinha pode levar a probation direto. A direção define o nível, com justificação.",
              },
            ]}
          />
        </DocSection>

        <DocSection id="cenarios" title="Três cenários na prática">
          <div className="grid gap-4 lg:grid-cols-3">
            <ScenarioCard
              title="A gravidade basta"
              context="Dois erros: um de 4 pontos e outro de 2."
              points={[4, 2]}
              limit={L1}
              result={`PA = 6: sobe ao nível 1.`}
            />
            <ScenarioCard
              title="A recorrência basta"
              context="Três erros leves, de 1 ponto cada. O PA é baixo, mas o NO chega a 3."
              points={[1, 1, 1]}
              limit={L1}
              result="NO = 3: sobe ao nível 1."
            />
            <ScenarioCard
              title="A progressão é cumulativa"
              context="Depois do 1:1 do nível 2, com os contadores a zero: dois erros leves."
              points={[1, 1]}
              limit={L2}
              result="NO = 2: probation."
              top
            />
          </div>
        </DocSection>

        {admin && (
          <DocSection
            id="calculadora"
            title="Como a direção pontua"
            lead="A calculadora da folha RH-04 sugere uma pontuação; a direção decide. Só a direção vê esta secção — a app nunca mostra a calculadora ao consultor."
          >
            <Rows
              rows={[
                {
                  term: "Ponto de partida",
                  detail: (
                    <>
                      O impacto mais pesado assinalado.{" "}
                      {IMPACTS.map((i) => `${i.label} ${i.base}`).join(" · ")} · sem impacto {SCORE_RULES.noImpactBase}.
                    </>
                  ),
                },
                {
                  term: "Mais impactos",
                  detail: `${signed(SCORE_RULES.extraImpact)} por cada impacto a mais, até ${signed(SCORE_RULES.extraImpact * SCORE_RULES.extraImpactCap)}.`,
                },
                {
                  term: "Motivo",
                  detail: REASONS.map((r) => `${r.letter} ${signed(SCORE_RULES.reason[r.id])}`).join(" · "),
                },
                { term: "Repetido", detail: `${signed(SCORE_RULES.repeated)} (primeira vez: 0).` },
                {
                  term: "Tipo de erro",
                  detail: ERROR_TYPES.map((t) => `${t.label.replace("Erro de ", "")} ${signed(SCORE_RULES.errorType[t.id])}`).join(" · "),
                },
                {
                  term: "Quem deu pelo erro",
                  detail: `${NOTICED_OPTIONS.map((n) => `${n.read} ${signed(SCORE_RULES.noticed[n.id])}`).join(" · ")}. Se foi o cliente, conta também como «chegou ao cliente».`,
                },
                {
                  term: "O total",
                  detail: `Fica entre 1 e ${MAX_POINTS}. A direção pode escolher outro valor, incluindo 0 (não conta).`,
                },
              ]}
            />

            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
              <SubHeading aside="Exemplo">Um erro repetido que o cliente apontou</SubHeading>
              <ul className="mt-4 divide-y divide-white/[0.07]">
                {EXAMPLE.lines.map((l, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-4 py-2.5 text-[14px]">
                    <span className="text-white/65">{l.label}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-white">{l.base ? l.value : signed(l.value)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-white/15 pt-3">
                <span className="text-[14px] text-white/65">
                  Soma {EXAMPLE.raw}
                  {EXAMPLE.raw !== EXAMPLE.points && `, limitada a ${MAX_POINTS}`}
                </span>
                <span className="text-[1.6rem] font-semibold tabular-nums text-white">
                  {EXAMPLE.points} <span className="text-[14px] font-medium text-white/55">· {EXAMPLE.band.label}</span>
                </span>
              </div>
            </div>

            <Note title="A medida de cada nível">
              Em cada nível, a direção regista o 1:1 em «Ineficácias da equipa»: a data, quem o conduziu e as 1 a 3 ações combinadas.
              É esse registo que abre a fase seguinte e põe PA e NO a zero.
            </Note>
          </DocSection>
        )}
      </div>
    </PageShell>
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
