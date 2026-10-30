// /documentacao/probation — o Probation explicado (v78.19): quando se ativa,
// como se monta, os 30 dias, os três desfechos, o check-in semanal, o apoio
// e como tudo chega ao consultor pela app. A secção «Para a direção» só
// aparece a SuperAdmins.
//
// O texto das regras é o do documento do plano (lib/probation/document.ts) e
// as constantes são as do editor (lib/probation/shared.ts).

import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { Bullets, DocHero, DocSection, DocsClosed, ExecutiveSummary, Note, Rows, StageFlow, Strong, SubHeading } from "@/components/documentacao/doc-ui";
import { SectionNav } from "@/components/documentacao/section-nav";
import { CheckinExample, OutcomeCards, ProbationTimeline } from "@/components/documentacao/probation-visuals";
import { formatDate } from "@/lib/dates";
import { getDocsContext } from "@/lib/documentacao/server";
import { thresholdToReach } from "@/lib/ineficacias/shared";
import { S01, S02, S03, S04, S05, S06, S07 } from "@/lib/probation/document";
import { STATUS_LABEL, WEEKS_PER_PERIOD } from "@/lib/probation/shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Probation — Documentação",
};

const BLOCK_ID = "ineficacias";

const NAV = [
  { id: "quando", label: "Quando se ativa" },
  { id: "como", label: "Como se monta" },
  { id: "os-30-dias", label: "Os 30 dias" },
  { id: "desfechos", label: "Os desfechos" },
  { id: "check-in", label: "O check-in" },
  { id: "apoio", label: "Apoio" },
  { id: "na-app", label: "Na app" },
];
const NAV_ALL = [...NAV, { id: "resumo", label: "Resumo" }];
const NAV_ADMIN = [...NAV, { id: "direcao", label: "Para a direção" }, { id: "resumo", label: "Resumo" }];

const L3 = thresholdToReach(3);

/** O que o plano diz em cada secção, numa linha. */
const DOC_SECTIONS: Array<{ n: string; title: string; hint: string }> = [
  { n: S01.n, title: S01.title, hint: "Consultor, função, responsável e as três datas." },
  { n: S02.n, title: S02.title, hint: "O que tem de mudar, e porquê." },
  { n: S03.n, title: S03.title, hint: "Cada KPI com a meta e a forma de medir." },
  { n: S04.n, title: S04.title, hint: "Resultados acumulados desde o dia 0." },
  { n: S05.n, title: S05.title, hint: "Extensão, recuperação ou saída." },
  { n: S06.n, title: S06.title, hint: "O que a WonderAds garante e o que te pedimos." },
  { n: S07.n, title: S07.title, hint: "Preenche-se em cada reunião, contigo presente." },
];

export default async function ProbationDocPage() {
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
        title="Probation"
        pageId="probation"
        lead="Não é o princípio do fim. É a última oportunidade estruturada: 30 dias, KPIs por escrito, um check-in todas as semanas e uma decisão com base nos resultados."
        meta={`Atualizado a ${formatDate(block.updatedAt)}.${admin ? ` Visível para SuperAdmin e ${block.audienceLabel}.` : ""}`}
        tabs={{ pages: block.pages, current: "/documentacao/probation" }}
      />

      <SectionNav items={admin ? NAV_ADMIN : NAV_ALL} />

      <div className="mt-8 space-y-14 pb-10">
        <DocSection id="quando" title="Quando se ativa">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
              <p className="text-[13px] font-medium text-white/45">Normalmente</p>
              <p className="mt-1 text-[1.25rem] font-semibold text-white">No fim da escala</p>
              <p className="mt-2 text-[14.5px] leading-relaxed text-white/60">
                O nível 3 das ineficácias: depois de subir ao nível 2, PA ≥ {L3.pa} ou NO ≥ {L3.no}, contados do zero desde
                essa subida. O fim do semestre não tira ninguém do nível 3: só a recuperação devolve o nível 0.
              </p>
              <Link href="/documentacao/ineficacias#escala" className="mt-4 inline-block text-[13.5px] font-medium text-[#c4a6ff] hover:text-white">
                Ver a escala das ineficácias
              </Link>
            </div>
            <div className="rounded-3xl border border-amber-300/25 bg-amber-400/[0.05] p-6">
              <p className="text-[13px] font-medium text-amber-200/70">Também</p>
              <p className="mt-1 text-[1.25rem] font-semibold text-white">Uma falha grave</p>
              <p className="mt-2 text-[14.5px] leading-relaxed text-white/60">
                Uma falha grave sozinha pode levar a probation direto, sem passar pelos outros níveis. Decide a direção, com
                justificação.
              </p>
            </div>
          </div>

          <blockquote className="max-w-3xl border-l-2 border-[#783DF5] pl-5 text-[1.15rem] font-medium leading-snug text-white/85">
            Este plano existe porque queremos que fiques na equipa. Não é uma formalidade nem um aviso disfarçado: é um acordo
            claro sobre o que tem de mudar, até quando, e como te vamos ajudar.
          </blockquote>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { t: "Sabes o que é esperado.", d: "Os KPIs estão escritos no plano, com meta e forma de medir. Não há critérios escondidos." },
              { t: "Sabes o que pode acontecer.", d: "Cada avaliação termina num de três desfechos. Não há quarta opção." },
              { t: "Não estás sozinho.", d: "A WonderAds compromete-se, por escrito, com o apoio que te dá." },
              { t: "Decidem os resultados.", d: "Avalia-se o que está escrito no plano, não impressões." },
            ].map((x) => (
              <div key={x.t} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-[14.5px] font-semibold text-white">{x.t}</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-white/55">{x.d}</p>
              </div>
            ))}
          </div>
        </DocSection>

        <DocSection id="como" title="Como se monta" lead="Três momentos, por esta ordem.">
          <StageFlow
            stages={[
              {
                title: "Kickoff",
                body: "Os factos dos últimos 30 dias, 2 a 3 competências a desenvolver, 3 a 5 KPIs para cada avaliação e as rotinas obrigatórias. Fica tudo escrito no plano.",
              },
              {
                title: "Acompanhamento",
                body: "Um check-in curto todas as semanas, formação e feedback sobre os KPIs na própria semana.",
              },
              {
                title: "Decisão",
                body: "Aos 15 e aos 30 dias, com semanas de evidência: extensão, recuperação ou saída.",
              },
            ]}
          />

          <div>
            <SubHeading aside="Enviado ao consultor e exportável em PDF">O plano, por escrito</SubHeading>
            <ol className="mt-3 divide-y divide-white/[0.07] border-y border-white/[0.07]">
              {DOC_SECTIONS.map((s) => (
                <li key={s.n} className="grid grid-cols-[2.5rem_1fr] gap-x-3 py-3 sm:grid-cols-[2.5rem_minmax(14rem,18rem)_1fr] sm:items-baseline">
                  <span className="text-[13px] font-semibold tabular-nums text-[#a78bfa]">{s.n}</span>
                  <span className="text-[14px] font-medium text-white">{s.title}</span>
                  <span className="col-start-2 text-[13.5px] text-white/55 sm:col-start-auto">{s.hint}</span>
                </li>
              ))}
            </ol>
          </div>
        </DocSection>

        <DocSection
          id="os-30-dias"
          title="Os 30 dias"
          lead={`Um período: ${WEEKS_PER_PERIOD} check-ins semanais e duas avaliações, aos 15 e aos 30 dias.`}
        >
          <ProbationTimeline />
          <Rows
            rows={[
              {
                term: "Check-in",
                detail:
                  "Uma vez por semana, 30 minutos, no dia combinado no plano. Com o teu responsável direto ou, sem chefia intermédia, com a direção.",
              },
              {
                term: "Avaliação dos 15 dias",
                detail: "Contam os KPIs dos 15 dias. O resultado e o «Cumprido» de cada KPI preenchem-se na reunião.",
              },
              {
                term: "Avaliação dos 30 dias",
                detail: "Contam os resultados acumulados desde o dia 0, salvo se a meta disser outra coisa.",
              },
              {
                term: "Extensão aos 30 dias",
                detail: "O período novo começa no dia 30. Os KPIs anteriores passam como ponto de partida, com os resultados em branco.",
              },
            ]}
          />
        </DocSection>

        <DocSection id="desfechos" title="Os três desfechos" lead={S05.intro.join("")}>
          <OutcomeCards />
          <Note title="Quem decide e como se comunica">
            O responsável direto e a direção (sem chefia intermédia, a direção sozinha). A decisão é dita na reunião de
            avaliação, cara a cara, e confirmada por escrito logo a seguir.
          </Note>
        </DocSection>

        <DocSection
          id="check-in"
          title="O check-in semanal"
          lead="O ponto de situação de cada KPI, com um semáforo: no caminho, em risco ou fora do caminho. E os próximos passos, que a semana seguinte confirma."
        >
          <CheckinExample />
        </DocSection>

        <DocSection id="apoio" title="Acompanhamento e apoio" lead="Um plano destes só é justo se vier com apoio a sério.">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <SubHeading>A WonderAds compromete-se a</SubHeading>
              <div className="mt-3">
                <Bullets
                  items={[
                    <>
                      <Strong>Check-in semanal de 30 minutos</Strong>, para rever números e desbloquear o que estiver a travar.
                    </>,
                    <>
                      <Strong>Feedback rápido e direto.</Strong> Se algo não está a correr bem, sabes na própria semana, não na
                      avaliação.
                    </>,
                    <>
                      <Strong>Recursos e formação</Strong> escritos no plano: formação, shadowing, ferramentas ou materiais.
                    </>,
                    <>
                      <Strong>Uma pessoa de apoio</Strong> para as dúvidas do dia a dia.
                    </>,
                  ]}
                />
              </div>
            </div>
            <div>
              <SubHeading>Do teu lado, pedimos</SubHeading>
              <div className="mt-3">
                <Bullets
                  items={[
                    "Que registes o teu trabalho na ferramenta combinada, para os KPIs se medirem sem discussão.",
                    "Que peças ajuda cedo. Um bloqueio partilhado no dia 3 resolve-se; no dia 14 já custa um KPI.",
                    "Que digas com franqueza se há algo, dentro ou fora do trabalho, a afetar o teu desempenho.",
                  ]}
                />
              </div>
            </div>
          </div>
        </DocSection>

        <DocSection id="na-app" title="Na app" lead="Tudo o que é teu chega pela app, e só o que a direção te enviou.">
          <Rows
            rows={[
              {
                term: "O meu probation",
                detail: "Aparece no menu do teu nome com o primeiro envio. Cada envio chega também com um aviso no sino.",
              },
              {
                term: "Os envios",
                detail: "O plano, cada check-in e cada avaliação. Confirmas que leste cada um, com um comentário se quiseres.",
              },
              {
                term: "Submeter para revisão",
                detail:
                  "Vais juntando o que fizeste (um documento, um link ou uma nota), ligado a um KPI. A direção vê-o no check-in dessa semana. Podes retirá-lo enquanto o check-in não estiver feito.",
              },
              {
                term: "Quando acaba",
                detail: "O item sai do menu quando uma avaliação fecha o probation (recuperação ou saída) e confirmas que a leste.",
              },
              {
                term: "O que não vês",
                detail: "O rascunho da direção e as notas internas. Vês sempre a versão que te foi enviada.",
              },
            ]}
          />
        </DocSection>

        {admin && (
          <DocSection id="direcao" title="Para a direção" lead="Só a direção vê esta secção.">
            <Rows
              rows={[
                {
                  term: "Criar",
                  detail: "Em /admin/probation, «Novo plano». Grava-se como rascunho e ativa-se à mão ou no primeiro envio.",
                },
                {
                  term: "Sem chefia intermédia",
                  detail: "A direção acompanha e decide sozinha; o documento ajusta-se.",
                },
                {
                  term: "Enviar",
                  detail:
                    "Cada envio mostra antes a pré-visualização do que o consultor vai ver, e envia-se exatamente isso. Se o plano mudar depois, aparece «alterado desde o envio».",
                },
                {
                  term: "Lembretes",
                  detail: "O sino avisa no dia de cada check-in e de cada avaliação, e quando o consultor confirma a leitura.",
                },
                { term: "PDF", detail: "Cada plano exporta em PDF. Há também o template em branco, para imprimir." },
                {
                  term: "Estados",
                  detail: `${Object.values(STATUS_LABEL).join(" · ")}. Saem das decisões registadas, nunca se escrevem à mão.`,
                },
              ]}
            />
            <Link
              href="/admin/probation"
              className="inline-flex h-11 w-fit items-center rounded-2xl bg-white px-5 text-[14px] font-semibold text-[#07080d] transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5]"
            >
              Abrir os planos de probation
            </Link>
          </DocSection>
        )}

        <ExecutiveSummary
          updatedAt={block.updatedAt}
          title="O probation, por extenso"
          paragraphs={[
            <>
              O probation é a última oportunidade estruturada que a WonderAds dá a alguém cujo desempenho ficou abaixo do
              esperado. Normalmente chega no fim da escala das ineficácias, no nível 3 — a que se sobe quando, depois do nível
              2, os contadores voltam a passar o limiar —, mas uma falha grave sozinha pode levar a ele diretamente. Não é uma formalidade nem um aviso disfarçado: é um acordo escrito sobre o que tem de mudar,
              até quando e com que apoio, feito porque a empresa quer que a pessoa fique e chegue ao nível de que é capaz.
            </>,
            <>
              Monta-se num kickoff: reúnem-se os factos dos últimos 30 dias, escolhem-se 2 a 3 competências a desenvolver,
              definem-se os KPIs de cada avaliação — com meta e forma de medir — e fixam-se as rotinas obrigatórias. Tudo fica
              num plano escrito com sete secções, enviado pela app e exportável em PDF: os dados do plano, o porquê, os KPIs
              dos 15 dias, os KPIs dos 30 dias, os três desfechos possíveis, o acompanhamento e apoio, e o registo das
              avaliações.
            </>,
            <>
              Um período dura 30 dias. Todas as semanas há um check-in de 30 minutos com o responsável direto — ou com a
              direção, quando não há chefia intermédia — em que se revê cada KPI com um semáforo (no caminho, em risco ou fora
              do caminho), se registam o que correu bem, os bloqueios e o apoio dado, e se combinam os próximos passos, que a
              semana seguinte confirma. Pelo meio, o consultor vai submetendo na app o que fez, ligado aos KPIs, para ser visto
              no check-in dessa semana.
            </>,
            <>
              Há duas avaliações, aos 15 e aos 30 dias, e cada uma termina obrigatoriamente numa de três decisões: extensão,
              recuperação para a equipa ou saída. Aos 15 dias, a extensão quer dizer seguir para a avaliação dos 30; aos 30,
              abre um novo período de 30 dias, com novas datas e novos KPIs. A recuperação fecha o probation e devolve a pessoa
              ao funcionamento normal da equipa, sem reservas, e ao nível 0 das ineficácias, com PA e NO a zero; a saída fecha-o com a saída da equipa, nos termos do contrato. A
              decisão é do responsável direto e da direção, dita cara a cara na reunião e confirmada por escrito logo a seguir.
            </>,
            <>
              Um plano destes só é justo se vier com apoio a sério. A WonderAds compromete-se com o check-in semanal, com
              feedback na própria semana, com recursos e formação escritos no plano e com uma pessoa de apoio para o dia a dia.
              Do lado do consultor, pede-se que registe o trabalho na ferramenta combinada, que peça ajuda cedo e que diga com
              franqueza o que estiver a afetar o seu desempenho. Tudo chega pela app — plano, check-ins e avaliações — e cada
              envio é confirmado como lido, para nunca haver dúvidas sobre o que foi combinado.
            </>,
          ]}
        />
      </div>
    </PageShell>
  );
}
