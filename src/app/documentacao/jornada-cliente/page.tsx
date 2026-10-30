// /documentacao/jornada-cliente — a Jornada de Cliente do SEO DPT (v78.46): o
// caminho de um projeto, mês a mês (semana a semana até à v78.56), desenhado
// como uma estrada que se acende à medida que se lê. A direção edita-a na própria
// página (components/documentacao/journey-road.tsx); o conteúdo de partida e
// os processos estão em lib/documentacao/jornada.ts.

import { PageShell } from "@/components/page-shell";
import { DocHero, DocsClosed, ExecutiveSummary, Strong } from "@/components/documentacao/doc-ui";
import { JourneyRoad } from "@/components/documentacao/journey-road";
import { getImpersonation } from "@/lib/auth/server";
import { formatDate } from "@/lib/dates";
import { getJourney } from "@/lib/documentacao/editable-store";
import { getDocsContext } from "@/lib/documentacao/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Jornada de Cliente — Documentação",
};

const BLOCK_ID = "jornada-cliente";

export default async function JornadaClientePage() {
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
  const [journey, impersonating] = await Promise.all([getJourney(), getImpersonation()]);
  const updated = journey.updatedAt ? new Date(journey.updatedAt).toISOString().slice(0, 10) : block.updatedAt;

  return (
    <PageShell backHref="/documentacao" backLabel="Documentação">
      <DocHero
        block={block.title}
        title="Jornada de Cliente"
        pageId="jornada-cliente"
        lead={
          <>
            O roadmap de cada cliente é personalizado e vê-se na ficha do cliente. Aqui detalhamos{" "}
            <Strong>o que é obrigatório e comum a todos os projetos</Strong>, mês a mês.
          </>
        }
        meta={`Atualizado a ${formatDate(updated)}.${reader.isAdmin ? ` Visível para SuperAdmin e ${block.audienceLabel}.` : ""}`}
      />

      <JourneyRoad initial={journey} canEdit={reader.isAdmin && !impersonating} />

      <div className="mt-16 space-y-10 pb-10">
        <ExecutiveSummary
          updatedAt={updated}
          title="A jornada de cliente, por extenso"
          paragraphs={[
            <>
              O roadmap de cada cliente é personalizado e vê-se na ficha do cliente. A jornada de cliente é a parte comum a
              todos os projetos SEO da WonderAds: as tarefas obrigatórias de cada mês, do contrato à renovação, seja qual
              for o cliente e seja qual for o consultor.
            </>,
            <>
              Os meses contam-se como nos roadmaps da app: o mês 2 da jornada é o mês 2 do roadmap do cliente (as semanas 5 a
              8). Em cada mês vê-se o título de cada tarefa; carregar nele abre ao lado a explicação do que se faz e de como se
              faz.
            </>,
            <>
              Algumas tarefas têm um processo com o passo a passo — como o registo de leads do mês 2, sem o qual não se
              conseguem medir os resultados do projeto.
            </>,
            <>A jornada é mantida pela direção, que acrescenta, muda e retira tarefas à medida que o método evolui.</>,
          ]}
        />
        <p className="border-t border-white/[0.07] pt-6 text-[13px] text-white/40">
          A jornada pode ser revista pela direção. Dúvidas: Diretor de Operações.
        </p>
      </div>
    </PageShell>
  );
}
