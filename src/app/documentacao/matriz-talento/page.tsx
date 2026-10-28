// /documentacao/matriz-talento — a Matriz de Talento Wonder (v78.14).
//
// Só SuperAdmins e Treinadores (etiqueta «Treinador» na credencial). A
// imagem da matriz abre a página; por baixo, o mesmo conteúdo em texto,
// arrumado pela ação — é o que se procura quando se está a avaliar alguém.

import Image from "next/image";
import { Maximize2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { DocHero, DocSection, DocsClosed, ExecutiveSummary, Note } from "@/components/documentacao/doc-ui";
import { formatDate } from "@/lib/dates";
import { getDocsContext } from "@/lib/documentacao/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Matriz de Talento Wonder — Documentação",
};

const BLOCK_ID = "matriz-talento";
const IMAGE = "/documentacao/matriz-talento.jpg";

type Player = { name: string; tecnica: "baixa" | "média" | "alta"; fit: "baixo" | "médio" | "alto"; action: string };

const GROUPS: Array<{ label: string; dot: string; text: string; players: Player[] }> = [
  {
    label: "Promover",
    dot: "bg-emerald-400",
    text: "text-emerald-200",
    players: [{ name: "A Player", tecnica: "alta", fit: "alto", action: "Promover e reconhecer em público." }],
  },
  {
    label: "Desenvolver",
    dot: "bg-sky-400",
    text: "text-sky-200",
    players: [
      { name: "B+ Player", tecnica: "média", fit: "alto", action: "Bom potencial: desenvolver a técnica para chegar a A." },
      { name: "B Player", tecnica: "alta", fit: "médio", action: "Focar no cultural fit." },
      { name: "B- em formação", tecnica: "baixa", fit: "alto", action: "Desenvolver com mentoria dos A-Players." },
      { name: "B- em formação", tecnica: "baixa", fit: "médio", action: "Prazo curto, reavaliar cedo." },
    ],
  },
  {
    label: "Manter",
    dot: "bg-white/50",
    text: "text-white/75",
    players: [{ name: "B Player", tecnica: "média", fit: "médio", action: "Growth path normal, sem intervenção." }],
  },
  {
    label: "Despedir",
    dot: "bg-rose-400",
    text: "text-rose-200",
    players: [
      { name: "C Player", tecnica: "alta", fit: "baixo", action: "Urgência alta: corrói os A-Players." },
      { name: "C Player", tecnica: "média", fit: "baixo", action: "Urgência média: o fit baixo corrói na mesma." },
      { name: "D Player", tecnica: "baixa", fit: "baixo", action: "Erro de contratação." },
    ],
  },
];

export default async function MatrizTalentoPage() {
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
        title="Matriz de Talento Wonder"
        lead="Cada pessoa avalia-se em dois eixos: capacidade técnica e cultural fit. O cruzamento diz que player é e o que fazer com ele."
        meta={`Atualizado a ${formatDate(block.updatedAt)}.${reader.isAdmin ? ` Visível para SuperAdmin e ${block.audienceLabel}.` : ""}`}
      />

      <figure className="mt-8">
        <a
          href={IMAGE}
          target="_blank"
          rel="noreferrer"
          className="group relative block overflow-hidden rounded-[28px] border border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5]"
        >
          <Image
            src={IMAGE}
            alt="Matriz de Talento: capacidade técnica (baixa, média, alta) cruzada com cultural fit (baixo, médio, alto), com o tipo de player e a ação de cada célula."
            width={2200}
            height={1228}
            priority
            sizes="(min-width: 1280px) 1216px, 100vw"
            className="h-auto w-full"
          />
          <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[12px] font-medium text-white opacity-0 backdrop-blur transition group-hover:opacity-100 group-focus-visible:opacity-100">
            <Maximize2 className="h-3.5 w-3.5" />
            Abrir em tamanho real
          </span>
        </a>
      </figure>

      <div className="mt-12 space-y-14 pb-10">
        <DocSection id="o-que-fazer" title="O que fazer com cada um" lead="A mesma matriz, arrumada pela ação.">
          {/* Colunas e não grelha: cada cartão fica com a sua altura, sem os
              grupos de um só player esticados ao lado dos grandes. */}
          <div className="gap-4 md:columns-2">
            {GROUPS.map((g) => (
              <div key={g.label} className="mb-4 break-inside-avoid rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <p className={`flex items-center gap-2 text-[15px] font-semibold ${g.text}`}>
                  <span aria-hidden className={`h-2 w-2 rounded-full ${g.dot}`} />
                  {g.label}
                </p>
                <ul className="mt-3 divide-y divide-white/[0.07]">
                  {g.players.map((p, i) => (
                    <li key={i} className="py-3">
                      <p className="text-[14.5px] font-semibold text-white">{p.name}</p>
                      <p className="mt-0.5 text-[12.5px] text-white/45">
                        Técnica {p.tecnica}, fit {p.fit}
                      </p>
                      <p className="mt-1 text-[14px] text-white/70">{p.action}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </DocSection>

        <DocSection id="regras" title="Duas regras">
          <Note tone="warn" title="Porquê o C antes do D?">
            O D-Player é um erro de contratação. O C-Player é pior: entrega, mas ignora os valores, e os A-Players deixam de ir o
            extra mile. É assim que a cultura morre.
          </Note>
          <Note title="«Em formação» é um prazo, não um estatuto">
            O B- ou evolui pelo menos para B, ou sai. Fit alto justifica mais tempo dedicado à formação e à mentoria; fit médio,
            menos. A técnica treina-se, o fit não. Por isso o B da direita exige vigilância: se descer, torna-se C.
          </Note>
        </DocSection>

        <ExecutiveSummary
          title="A Matriz de Talento, por extenso"
          paragraphs={[
            <>
              A Matriz de Talento Wonder é a grelha com que a direção e os treinadores avaliam cada pessoa da equipa. Cruza dois
              eixos que se medem separadamente: a capacidade técnica — o que a pessoa sabe fazer e a qualidade com que o faz — e
              o cultural fit — o quanto vive os valores da WonderAds no dia a dia, com clientes e com colegas. Cada eixo tem três
              níveis, baixo, médio e alto, e o cruzamento dá nove posições, cada uma com um tipo de player e uma ação.
            </>,
            <>
              No topo está o A Player, com técnica e fit altos: é quem se promove e se reconhece em público. Logo abaixo ficam os
              perfis a desenvolver. O B+ tem fit alto e técnica média, e com a técnica a crescer chega a A. O B de técnica alta e
              fit médio precisa de foco no cultural fit. Os B- em formação têm técnica baixa e desenvolvem-se com mentoria dos A
              Players — com mais tempo quando o fit é alto e com prazo curto quando é médio. O B de técnica e fit médios segue o
              seu growth path normal, sem intervenção.
            </>,
            <>
              Na base estão as posições de saída. O C Player tem fit baixo e técnica média ou alta: entrega, mas não vive os
              valores, e isso corrói os A Players à sua volta — com técnica alta a urgência é maior, porque o impacto é maior e
              mais difícil de ver. O D Player, com técnica e fit baixos, é um erro de contratação. A ordem é deliberada: o C sai
              antes do D, porque é o C que faz a cultura morrer.
            </>,
            <>
              A matriz é uma ferramenta de decisão, não um rótulo. Cada avaliação parte de factos — entregas, feedback de
              clientes, ineficácias, comportamento na equipa — e acaba numa ação concreta da coluna certa. «Em formação» é um
              prazo e não um estatuto: um B- ou evolui pelo menos para B ou sai, e um B de fit médio pede vigilância, porque se o
              fit descer passa a C. A técnica treina-se; o fit, não.
            </>,
          ]}
        />
      </div>
    </PageShell>
  );
}
