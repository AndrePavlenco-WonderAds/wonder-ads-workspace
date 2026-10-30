// As páginas de Protocolos — Obrigatórios e Recomendados (v78.46, bloco do SEO
// DPT) e Proibidos (v78.51, bloco de toda a equipa). A mesma forma de
// documento: a lista primeiro (editável pela direção), depois como se aplica,
// o resumo e, no fim, «Sugerir à direção» (v78.51). Só o texto e o bloco mudam
// entre elas.

import { PageShell } from "@/components/page-shell";
import { DocHero, DocSection, DocsClosed, ExecutiveSummary, Rows, Strong } from "@/components/documentacao/doc-ui";
import { ProtocolListEditor } from "@/components/documentacao/protocol-list";
import { ProtocolSuggest } from "@/components/documentacao/protocol-suggest";
import { SectionNav } from "@/components/documentacao/section-nav";
import { getImpersonation } from "@/lib/auth/server";
import { formatDate } from "@/lib/dates";
import { getProtocols } from "@/lib/documentacao/editable-store";
import { PROTOCOL_META, type ProtocolList } from "@/lib/documentacao/protocolos";
import { listProtocolSuggestions } from "@/lib/documentacao/protocol-suggestions";
import { getDocsContext } from "@/lib/documentacao/server";

const NAV = [
  { id: "lista", label: "A lista" },
  { id: "aplicar", label: "Como se aplicam" },
  { id: "resumo", label: "Resumo" },
  { id: "sugerir", label: "Sugerir" },
];

const COPY: Record<
  ProtocolList,
  {
    lead: React.ReactNode;
    listLead: string;
    rows: Array<{ term: string; detail: string; tone?: "accent" | "amber" }>;
    summaryTitle: string;
    summary: React.ReactNode[];
  }
> = {
  obrigatorios: {
    lead: (
      <>
        O mínimo que se cumpre <Strong>em todos os projetos do SEO DPT</Strong>, sem exceção. É o que o cliente pode sempre
        esperar de nós, seja qual for o consultor.
      </>
    ),
    listLead: "O que se cumpre em todos os projetos, sem exceção.",
    rows: [
      { term: "Em todos os projetos", tone: "accent", detail: "Aplicam-se a todos os clientes ativos da carteira, do primeiro mês ao último." },
      { term: "Na agenda", detail: "O que tem data marca-se com antecedência no calendário, com o cliente convidado — não fica à memória." },
      { term: "A direção verifica", detail: "São o mínimo que a direção espera ver cumprido em cada projeto." },
      { term: "Mudar a lista", detail: "Só a direção acrescenta, muda ou retira protocolos. Sugestões: em «Sugerir à direção», no fim desta página." },
    ],
    summaryTitle: "Os protocolos obrigatórios, por extenso",
    summary: [
      <>
        Os protocolos obrigatórios são o mínimo que se cumpre em todos os projetos do SEO DPT. Garantem que qualquer cliente
        da WonderAds tem o mesmo acompanhamento, seja qual for o consultor: fala connosco com regularidade, sabe o que se fez e
        recebe os resultados a horas.
      </>,
      <>
        Aplicam-se a todos os clientes ativos, do primeiro mês ao último. O que tem data — uma call, um relatório — marca-se
        com antecedência no calendário, com o cliente convidado, em vez de ficar à memória.
      </>,
      <>
        A lista é mantida pela direção, que acrescenta ou retira protocolos à medida que o método evolui. Por cima destes, os
        protocolos recomendados são o que distingue um serviço bom de um excelente.
      </>,
    ],
  },
  recomendados: {
    lead: (
      <>
        O que <Strong>eleva o serviço</Strong> acima do mínimo: hábitos que tornam a relação com o cliente mais próxima e os
        resultados mais visíveis.
      </>
    ),
    listLead: "O que distingue um serviço bom de um serviço excelente.",
    rows: [
      { term: "Por cima dos obrigatórios", tone: "accent", detail: "Não substituem nenhum protocolo obrigatório: juntam-se a eles." },
      { term: "Com critério", detail: "Nem todos encaixam em todos os clientes: escolhe os que fazem diferença em cada projeto." },
      { term: "Podem passar a obrigatórios", detail: "Quando um recomendado se prova em todos os projetos, a direção pode passá-lo para a lista dos obrigatórios." },
      { term: "Mudar a lista", detail: "Só a direção acrescenta, muda ou retira protocolos. Sugestões: em «Sugerir à direção», no fim desta página." },
    ],
    summaryTitle: "Os protocolos recomendados, por extenso",
    summary: [
      <>
        Os protocolos recomendados são o que eleva o serviço acima do mínimo. Não são obrigatórios, mas são os hábitos que
        tornam a relação com o cliente mais próxima: mais contacto, mais boas notícias partilhadas, mais ideias que vão além do
        roadmap.
      </>,
      <>
        Juntam-se aos protocolos obrigatórios, nunca os substituem, e aplicam-se com critério: cada consultor escolhe os que
        fazem diferença em cada projeto.
      </>,
      <>
        A lista é mantida pela direção. Quando um recomendado se prova em todos os projetos, pode passar para a lista dos
        obrigatórios.
      </>,
    ],
  },
  proibidos: {
    lead: (
      <>
        O que <Strong>nunca se faz na WonderAds</Strong>, seja qual for o departamento ou o projeto.
      </>
    ),
    listLead: "O que não se faz, sem exceção.",
    rows: [
      { term: "Toda a equipa", tone: "accent", detail: "Aplicam-se a todos, em todos os departamentos: SEO, ADS, Web e Comercial." },
      { term: "Sem exceção", tone: "amber", detail: "Não dependem do cliente, do projeto nem da pressa: o que está nesta lista não se faz." },
      { term: "Na dúvida, pergunta", detail: "Se não tens a certeza se algo cabe aqui, pergunta à direção antes de o fazer." },
      { term: "Mudar a lista", detail: "Só a direção acrescenta, muda ou retira protocolos. Sugestões: em «Sugerir à direção», no fim desta página." },
    ],
    summaryTitle: "Os protocolos proibidos, por extenso",
    summary: [
      <>
        Os protocolos proibidos são o que nunca se faz na WonderAds. Ao contrário dos obrigatórios e dos recomendados, que são
        do SEO DPT, aplicam-se a toda a equipa, em todos os departamentos.
      </>,
      <>
        A lista é mantida pela direção, que acrescenta ou retira protocolos. Na dúvida sobre se algo cabe aqui, pergunta antes
        de o fazer.
      </>,
    ],
  },
};

export async function ProtocolPage({ list }: { list: ProtocolList }) {
  const copy = COPY[list];
  const meta = PROTOCOL_META[list];
  const ctx = await getDocsContext(meta.blockId);
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
  const [doc, impersonating, suggestions] = await Promise.all([
    getProtocols(list),
    getImpersonation(),
    reader.isAdmin
      ? listProtocolSuggestions().catch((err) => {
          console.error("docs protocol suggestions read failed:", err);
          return [];
        })
      : Promise.resolve([]),
  ]);
  const href = `/documentacao/protocolos-${list}`;
  const updated = doc.updatedAt ? new Date(doc.updatedAt).toISOString().slice(0, 10) : block.updatedAt;

  return (
    <PageShell backHref="/documentacao" backLabel="Documentação">
      <DocHero
        block={block.title}
        title={meta.title}
        pageId={`protocolos-${list}`}
        lead={copy.lead}
        meta={`Atualizado a ${formatDate(updated)}.${reader.isAdmin ? ` Visível para SuperAdmin e ${block.audienceLabel}.` : ""}`}
        tabs={
          block.pages.length > 1
            ? { pages: block.pages.map((p) => ({ href: p.href, label: p.label.replace("Protocolos ", "") })), current: href }
            : undefined
        }
      />

      <SectionNav items={NAV} />

      <div className="mt-8 space-y-14 pb-10">
        <DocSection id="lista" title="A lista" lead={copy.listLead}>
          <ProtocolListEditor
            doc={`protocolos-${list}`}
            initial={doc}
            canEdit={reader.isAdmin && !impersonating}
            tone={list === "obrigatorios" ? "obrigatorio" : list === "proibidos" ? "proibido" : "recomendado"}
          />
        </DocSection>

        <DocSection id="aplicar" title="Como se aplicam">
          <Rows rows={copy.rows} />
        </DocSection>

        <ExecutiveSummary updatedAt={updated} title={copy.summaryTitle} paragraphs={copy.summary} />

        <DocSection id="sugerir" title="Sugerir à direção">
          <ProtocolSuggest
            doc={`protocolos-${list}`}
            canSend={!impersonating}
            received={
              reader.isAdmin
                ? suggestions
                    .filter((x) => x.list === list)
                    .slice(0, 20)
                    .map(({ id, name, text, at }) => ({ id, name, text, at }))
                : null
            }
          />
        </DocSection>

        <p className="border-t border-white/[0.07] pt-6 text-[13px] text-white/40">
          Estes protocolos podem ser revistos pela direção. Dúvidas: Diretor de Operações.
        </p>
      </div>
    </PageShell>
  );
}
