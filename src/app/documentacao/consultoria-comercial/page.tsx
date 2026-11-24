// /documentacao/consultoria-comercial — o cross-sell «Consultoria Comercial»
// por extenso (v80.32).
//
// Texto: «Consultoria Comercial WonderAds — Estrutura do Serviço» (PDF do
// André, documento interno, 24/11/2026), tal e qual, arrumado em capítulos
// como o SOP de Comunicação (um de cada vez, uma ideia por bloco). Não é uma
// página do hub: entra-se pelo cartão do serviço nos cross-sells das
// Comissões, e lê-a quem lê as Comissões (bloco «remuneracao-variavel»).

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Check, Square } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { DocHero, DocsClosed, Strong } from "@/components/documentacao/doc-ui";
import { SopChapters } from "@/components/documentacao/sop-chapters";
import { formatDate } from "@/lib/dates";
import { getDocsContext } from "@/lib/documentacao/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Consultoria Comercial — Documentação",
};

const BLOCK_ID = "remuneracao-variavel";
const UPDATED_AT = "2026-11-24";
const BRAND = ["#343ED7", "#783DF5", "#C535C9"];

/* ------------------------------------------------------------------ */
/*  Peças visuais                                                      */
/* ------------------------------------------------------------------ */

function Slide({
  eyebrow,
  title,
  lead,
  takeaway,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  takeaway?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-white/[0.06] py-12 first:border-t-0 first:pt-10 sm:py-14">
      {eyebrow && <p className="text-[13px] font-semibold text-[#c4a6ff]">{eyebrow}</p>}
      <h2 className="mt-1 max-w-4xl text-[1.75rem] font-semibold leading-[1.1] tracking-[-0.025em] text-white sm:text-[2.2rem]">
        {title}
      </h2>
      {lead && <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-white/55">{lead}</p>}
      <div className="mt-7">{children}</div>
      {takeaway && <div className="mt-6">{takeaway}</div>}
    </section>
  );
}

/** Título em duas cores, como no PDF: a segunda parte no gradiente. */
function Split({ a, b }: { a: string; b: string }) {
  return (
    <>
      {a} <span className="docs-brand-flow-text">{b}</span>
    </>
  );
}

function Takeaway({ lead, children }: { lead: string; children?: ReactNode }) {
  return (
    <p className="rounded-xl bg-[#783DF5]/[0.16] px-5 py-3.5 text-[14.5px] leading-relaxed text-white/70">
      <span className="font-semibold text-white">{lead}</span>
      {children ? <> {children}</> : null}
    </p>
  );
}

function HighlightRule({ lead, children }: { lead: string; children?: ReactNode }) {
  return (
    <div className="sop-glow">
      <div className="rounded-[16.5px] bg-[#0c0a18] px-6 py-5 sm:px-7">
        <p className="text-[17px] leading-snug text-white/80 sm:text-[20px]">
          <span className="docs-brand-flow-text font-bold">{lead}</span>
          {children ? <> {children}</> : null}
        </p>
      </div>
    </div>
  );
}

function Warn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-amber-300/25 bg-amber-400/[0.06] px-5 py-4 text-[14px] leading-relaxed text-amber-50/80">
      <p className="mb-1 text-[12.5px] font-semibold text-amber-200">{title}</p>
      {children}
    </div>
  );
}

const CARD = "rounded-2xl border border-[#783DF5]/20 bg-[#783DF5]/[0.06]";

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${CARD} p-5 ${className}`}>{children}</div>;
}

function Label({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "muted" }) {
  return (
    <p className={`text-[12.5px] font-semibold ${tone === "accent" ? "text-[#c4a6ff]" : "text-white/45"}`}>{children}</p>
  );
}

function Chips({ items, tone = "default" }: { items: string[]; tone?: "default" | "accent" }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((c) => (
        <li
          key={c}
          className={`rounded-full border px-3 py-1.5 text-[13px] ${
            tone === "accent" ? "border-[#c4a6ff]/35 bg-[#783DF5]/15 text-[#e4d6ff]" : "border-white/12 bg-white/[0.03] text-white/75"
          }`}
        >
          {c}
        </li>
      ))}
    </ul>
  );
}

/** Tabela que se lê no telemóvel: em ecrã pequeno cada linha empilha as
 *  colunas, com o nome da coluna por cima de cada valor. */
function Table({
  head,
  rows,
  cols,
  highlight,
}: {
  head: string[];
  rows: ReactNode[][];
  /** grid-template-columns a partir de sm. */
  cols: string;
  /** Índices das linhas a destacar. */
  highlight?: number[];
}) {
  return (
    <div className="border-y border-white/[0.08]">
      <div className="hidden gap-x-5 border-b border-white/[0.12] py-2.5 text-[12px] font-semibold text-white/45 sm:grid" style={{ gridTemplateColumns: cols }}>
        {head.map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>
      <div className="divide-y divide-white/[0.07]">
        {rows.map((r, i) => (
          <div
            key={i}
            className={`grid gap-x-5 gap-y-1.5 py-3.5 sm:[grid-template-columns:var(--cols)] ${
              highlight?.includes(i) ? "-mx-3 rounded-xl bg-[#783DF5]/[0.12] px-3" : ""
            }`}
            style={{ ["--cols" as string]: cols }}
          >
            {r.map((cell, j) => (
              <div key={j} className={j === 0 ? "text-[14px] font-semibold text-white" : "text-[14px] leading-relaxed text-white/65"}>
                {j > 0 && <span className="mb-0.5 block text-[11.5px] font-medium text-white/35 sm:hidden">{head[j]}</span>}
                {cell}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Quote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-white/10 bg-[#0c0a18] px-4 py-3.5 text-[14px] leading-relaxed text-white/85">{children}</p>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[12.5px] text-[#c4a6ff]">{children}</span>;
}

function Arrows({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-1.5 text-[14px] leading-relaxed text-white/70">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <ArrowRight className="mt-[0.3em] h-3.5 w-3.5 shrink-0 text-[#a78bfa]" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

/** O número de uma sessão, num círculo no gradiente («01», «P»). */
function SessionBadge({ n }: { n: string }) {
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-mono text-[13px] font-semibold text-white"
      style={{ background: "linear-gradient(135deg,#783DF5,#C535C9)" }}
    >
      {n}
    </span>
  );
}

/** A linha que sobe do Mês 1 ao Mês 3 (a capa do PDF). */
function GrowthLine() {
  return (
    <svg viewBox="0 0 680 120" className="h-auto w-full" role="img" aria-label="Linha que sobe do mês 1 ao mês 3">
      <defs>
        <linearGradient id="cc-line" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#343ED7" />
          <stop offset="0.55" stopColor="#783DF5" />
          <stop offset="1" stopColor="#C535C9" />
        </linearGradient>
      </defs>
      <polyline
        points="0,100 150,100 240,76 400,76 480,42 580,42 625,28 680,10"
        fill="none"
        stroke="url(#cc-line)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {[
        { x: 240, y: 76, label: "Mês 1", ly: 104 },
        { x: 480, y: 42, label: "Mês 2", ly: 70 },
        { x: 625, y: 28, label: "Mês 3", ly: 56 },
      ].map((p, i) => (
        <g key={p.label}>
          <circle cx={p.x} cy={p.y} r="7" fill="#07080d" stroke={BRAND[i]} strokeWidth="3" />
          <text x={p.x} y={p.ly} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="13">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Capítulos                                                          */
/* ------------------------------------------------------------------ */

function ChapterService() {
  const stats = [
    { big: "3 meses", small: "12 semanas, 3 fases" },
    { big: "10", small: "sessões online de 60 a 90 min" },
    { big: "1 dia", small: "presencial no cliente" },
    { big: "Semanal", small: "revisão de guiões e chamadas" },
  ];
  return (
    <>
      <Slide
        eyebrow="Resumo do serviço"
        title={<Split a="O guia diz o que fazer." b="A consultoria põe a equipa a fazê-lo." />}
        lead="Em 3 meses implementamos, com a equipa do cliente, o método do Guia Prático de Gestão Comercial: 10 sessões online, 1 dia presencial e revisão semanal de guiões e chamadas. Medimos o antes e o depois com os números reais do negócio."
      >
        <div className="max-w-3xl">
          <GrowthLine />
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.big}>
              <p className="docs-brand-flow-text text-[2rem] font-bold leading-none tracking-[-0.03em]">{s.big}</p>
              <p className="mt-2 text-[13.5px] leading-snug text-white/60">{s.small}</p>
            </Card>
          ))}
        </div>
      </Slide>

      <Slide
        title="Para quem é e o que resolve"
        takeaway={<Takeaway lead="O método mantém-se;">mudam os exemplos, os guiões e a escala.</Takeaway>}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <Label>Para quem</Label>
            <p className="mt-2 text-[15px] leading-relaxed text-white/75">
              Clínicas, óticas e outras redes de saúde e bem-estar com atendimento ativo e alguém a apresentar planos ou
              orçamentos. De uma localização a redes com dezenas de lojas.
            </p>
          </Card>
          <Card>
            <Label>O problema que resolve</Label>
            <p className="mt-2 text-[15px] leading-relaxed text-white/75">
              <Strong>A maioria não tem falta de clientes: perde-os pelo caminho.</Strong> Contactos sem resposta, consultas
              ou exames que não acontecem, orçamentos sem follow-up.
            </p>
          </Card>
        </div>
      </Slide>

      <Slide title="O formato">
        <Table
          head={["Elemento", "Como é", "Nota"]}
          cols="minmax(10rem,13rem) 1fr minmax(10rem,14rem)"
          rows={[
            ["Duração", "3 meses (12 semanas), em 3 fases", "Mais tempo = renovação"],
            ["Sessões online", "10 sessões de 60 a 90 min", "Semanas 4 e 10 livres"],
            ["Dia presencial", "1 dia no cliente, entre a semana 3 e a 5", "Numa rede: loja piloto"],
            ["Revisão de chamadas", "Semanal, por escrito e discutida em sessão", "A partir da sessão 4"],
            ["Suporte entre sessões", "WhatsApp, resposta em 48 h úteis", "Opcional"],
          ]}
        />
      </Slide>

      <Slide
        title="O que nunca sai do programa"
        takeaway={<Takeaway lead="O resto ajusta-se">ao que o diagnóstico mostrar.</Takeaway>}
      >
        <Chips
          tone="accent"
          items={[
            "Diagnóstico e números de base",
            "Papéis: quem capta e quem fecha",
            "Guião de atendimento",
            "Follow-up de orçamentos",
            "Dia presencial",
            "Revisão de chamadas",
            "Sessão de resultados",
          ]}
        />
      </Slide>
    </>
  );
}

function ChapterPhases() {
  const phases = [
    {
      title: "Diagnóstico e fundações",
      when: "Mês 1 · sessões 1 a 3",
      topics: ["Funil, meta e baseline", "Planeamento ao contrário", "Papéis: quem capta e quem fecha", "Dia presencial (semanas 3 a 5)"],
      point: "Ponto 1 · fim do mês 1",
      check: "Baseline dos KPIs medido · Folha de registo de contactos em uso",
    },
    {
      title: "Implementação",
      when: "Mês 2 · sessões 4 a 7",
      topics: ["Guião de atendimento", "Comparência e faltas", "Apresentação do plano ou orçamento", "Objeções e follow-up 30 dias"],
      point: "Ponto 2 · fim do mês 2",
      check: "Guiões novos em uso · Follow-up D+0 a D+30 ativo",
    },
    {
      title: "Consolidação e autonomia",
      when: "Mês 3 · sessões 8 a 10",
      topics: ["Canais, reviews e reativação", "Afinação do ponto mais fraco", "Resultados e 90 dias seguintes"],
      point: "Ponto 3 · fim do programa",
      check: "KPIs comparados com o baseline · Rotina semanal autónoma",
    },
  ];
  return (
    <Slide
      eyebrow="Estrutura por fases"
      title={<Split a="Medir, mudar, consolidar." b="Cada mês fecha com um ponto de controlo." />}
      takeaway={
        <HighlightRule lead="Regra:">
          se um ponto de controlo falha, a fase seguinte começa por fechá-lo: não se passa aos guiões sem números de base.
        </HighlightRule>
      }
    >
      <ol className="grid gap-4 lg:grid-cols-3">
        {phases.map((p, i) => (
          <li key={p.title} className={`${CARD} flex flex-col p-5`}>
            <div className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-white"
                style={{ background: BRAND[i] }}
              >
                {i + 1}
              </span>
              <div>
                <p className="text-[17px] font-semibold leading-tight text-white">{p.title}</p>
                <p className="text-[12.5px] text-white/45">{p.when}</p>
              </div>
            </div>
            <div className="mt-4">
              <Chips items={p.topics} />
            </div>
            <div
              className={`mt-auto rounded-xl px-4 py-3 ${i === 2 ? "border border-[#c4a6ff]/30 bg-[#0c0a18]" : "bg-white/[0.04]"}`}
              style={{ marginTop: "1.25rem" }}
            >
              <p className="text-[12px] font-semibold text-[#c4a6ff]">{p.point}</p>
              <p className="mt-1 text-[13.5px] leading-snug text-white/80">{p.check}</p>
            </div>
          </li>
        ))}
      </ol>
    </Slide>
  );
}

function ChapterPlan() {
  const rows: Array<[string, string, string, string, string]> = [
    ["01", "1", "Kick-off e diagnóstico comercial", "Introdução · O que vemos", "Mapa do funil, meta do mês e dono de cada etapa"],
    ["02", "2", "Números de base e planeamento", "Cap. 01 · Métricas, 5 passos, medir contactos", "Folha de registo em uso, baseline e modelo mensal"],
    ["03", "3", "Quem capta e quem fecha", "Cap. 04 · Papéis", "Matriz de papéis com a métrica de cada um"],
    ["P", "3 a 5", "Dia presencial", "Cap. 03 e 04", "Observação real, formação ao vivo e 3 prioridades"],
    ["04", "5", "Guião de atendimento", "Cap. 04 · Guião da receção", "Guião adaptado e 1.ª revisão de chamadas"],
    ["05", "6", "Comparência", "Cap. 03", "Sequência de confirmação, faltas e lista de espera"],
    ["06", "7", "Apresentação do plano ou orçamento", "Cap. 04 · 6 movimentos", "Guião com 3 opções e valor mensal"],
    ["07", "8", "Objeções e follow-up de 30 dias", "Cap. 04 · Objeções e 30 dias", "Biblioteca de objeções e sequência D+0 a D+30"],
    ["08", "9", "Canais, reviews e reativação", "Cap. 02 e 05", "Custo por cliente por canal, reviews, 1.ª reativação"],
    ["09", "11", "Afinação do ponto mais fraco", "O que o funil pedir", "Plano de correção da etapa com mais perdas"],
    ["10", "12", "Resultados e próximos 90 dias", "Cap. 05 · Checklist da direção", "Relatório antes/depois e rotina autónoma"],
  ];
  return (
    <>
      <Slide
        eyebrow="Plano de sessões"
        title={<Split a="10 sessões e 1 dia presencial." b="Cada uma fecha com um entregável em uso." />}
        takeaway={
          <Link href="#sessao-a-sessao" className="inline-flex items-center gap-2 text-[14px] font-medium text-[#c4a6ff] underline-offset-4 hover:underline">
            Cada sessão por extenso, com exemplos <ArrowRight className="h-4 w-4" />
          </Link>
        }
      >
        <Table
          head={["#", "Sem.", "Tema · capítulo do guia", "Entregável"]}
          cols="2.5rem 3.5rem 1.1fr 1fr"
          highlight={[3]}
          rows={rows.map(([n, w, t, cap, out]) => [
            <Mono key="n">{n}</Mono>,
            <span key="w" className="tabular-nums">{w}</span>,
            <span key="t">
              <span className="block font-semibold text-white">{t}</span>
              <span className="block text-[12.5px] text-white/45">{cap}</span>
            </span>,
            out,
          ])}
        />
      </Slide>

      <Slide title="Duas semanas sem sessão, e o presencial no meio">
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <Label tone="muted">Semanas livres</Label>
            <p className="mt-2 text-[14.5px] leading-relaxed text-white/75">
              A semana 4 fica para o dia presencial e a 10 é folga de agenda, para o cliente pôr em prática antes da afinação.
            </p>
          </Card>
          <Card>
            <Label>Porquê o presencial aqui</Label>
            <p className="mt-2 text-[14.5px] leading-relaxed text-white/75">
              Depois de haver números (sessão 2) e antes de mexer nos guiões (sessão 4): formamos a equipa com base no
              atendimento real.
            </p>
          </Card>
        </div>
      </Slide>
    </>
  );
}

function ChapterReview() {
  return (
    <>
      <Slide
        eyebrow="Revisão de guiões e chamadas"
        title={<Split a="Semanal a partir da sessão 4:" b="amostra, feedback em 48 h, padrões em sessão." />}
        takeaway={
          <Takeaway lead="Mystery calls na semana 1 (baseline) e na semana 12 (resultado),">
            com o mesmo cenário. Numa rede, a amostra roda entre localizações.
          </Takeaway>
        }
      >
        <Table
          head={["O que se revê", "Como chega até nós", "Por semana"]}
          cols="minmax(11rem,15rem) 1fr 7rem"
          rows={[
            ["Chamadas de atendimento", "Gravação do sistema telefónico ou mystery call", <Mono key="a">3 a 5</Mono>],
            ["Apresentações de plano ou orçamento", "Gravação com consentimento ou role-play em sessão", <Mono key="b">1 a 2</Mono>],
            ["Mensagens de WhatsApp", "Capturas de confirmação e follow-up", <Mono key="c">5 a 10</Mono>],
            ["Guiões escritos", "Documento partilhado", "Quando mudam"],
          ]}
        />
      </Slide>

      <Slide title="Dois scorecards, de 0 a 2 por passo">
        <div className="grid gap-3 md:grid-cols-2">
          {[
            {
              title: "Scorecard do atendimento",
              sub: "0 a 2 por passo · máximo 16",
              color: "#8b93ff",
              items: [
                "Atendeu com o nome da marca e o seu",
                "Percebeu o motivo e deixou falar",
                "Perguntou «como nos conheceu?»",
                "Explicou a consulta ou o exame",
                "Propôs duas opções de data",
                "Pediu um sim claro",
                "Confirmou o WhatsApp e enviou confirmação",
                "Tratou o preço sem perder a marcação",
              ],
            },
            {
              title: "Scorecard do plano",
              sub: "0 a 2 por movimento · máximo 12",
              color: "#e08af0",
              items: [
                "Começou pelo que o cliente disse",
                "Mostrou o plano e o resultado",
                "Deu valor ao que está em jogo",
                "Apresentou 3 opções",
                "Falou em mensalidade",
                "Pediu a decisão",
              ],
            },
          ].map((s) => (
            <Card key={s.title}>
              <p className="text-[17px] font-semibold text-white">{s.title}</p>
              <p className="mt-0.5 font-mono text-[12px] text-[#c4a6ff]">{s.sub}</p>
              <ol className="mt-4 space-y-1.5">
                {s.items.map((it, i) => (
                  <li key={it} className="flex gap-3 text-[14px] leading-snug text-white/75">
                    <span className="w-4 shrink-0 text-right font-semibold tabular-nums" style={{ color: s.color }}>
                      {i + 1}
                    </span>
                    {it}
                  </li>
                ))}
              </ol>
            </Card>
          ))}
        </div>
      </Slide>

      <Slide
        title="Cada revisão volta por escrito"
        takeaway={
          <Warn title="Antes de gravar · RGPD">
            O cliente tem de avisar quem liga de que a chamada é gravada. Confirmar isto no kick-off.
          </Warn>
        }
      >
        <Card>
          <Label>Exemplo de feedback escrito</Label>
          <div className="mt-3">
            <Quote>
              Chamada 3 · 11 pontos em 16. Bom: atendeu com nome e explicou o exame. Falhou: não perguntou a origem e deu uma só
              data. Para a semana: duas opções de data em todas as chamadas.
            </Quote>
          </div>
        </Card>
      </Slide>
    </>
  );
}

function ChapterGuide() {
  const chapters = [
    {
      n: "01",
      t: "Planeamento comercial",
      d: "Funil em 7 etapas, 5 passos do planeamento, 8 métricas, folha de registo",
      a: "percentagens reais, valor médio, meta mensal",
      s: "Sessões 1, 2 e 9",
    },
    { n: "02", t: "Canais de aquisição", d: "9 canais em 3 prioridades, Google e ChatGPT, sistema de reviews", a: "canais ativos, orçamento, concorrentes", s: "Sessão 8" },
    { n: "03", t: "Comparência", d: "Regras ao marcar, sequência anti-falta, protocolo de faltas", a: "canais de lembrete, sinal, lista de espera", s: "Sessão 5 · presencial" },
    {
      n: "04",
      t: "Atendimento e fecho",
      d: "Papéis, guião de atendimento, 6 movimentos, objeções, follow-up 30 dias",
      a: "quem faz o quê, financiamento, casos",
      s: "3, 4, 6, 7 · presencial",
    },
    { n: "05", t: "Recuperação de receita", d: "Continuidade, 6 segmentos de reativação, checklist da direção", a: "segmentos da base, ofertas, rotina semanal", s: "Sessões 8 e 10" },
  ];
  return (
    <Slide
      eyebrow="Conteúdo base · o guia comercial"
      title={<Split a="O guia é o programa." b="Cada guião é a versão 0 que adaptamos." />}
      lead="O cliente recebe o guia no kick-off. Está escrito para clínicas; noutros negócios, como óticas, mantém-se a estrutura e trocam-se os exemplos e as palavras dos guiões."
      takeaway={
        <HighlightRule lead="O que acrescentamos ao guia:">
          os números reais do cliente, a revisão das chamadas e a responsabilização semanal. É isso que o cliente não consegue
          fazer sozinho com o PDF.
        </HighlightRule>
      }
    >
      <ol className="space-y-2.5">
        {chapters.map((c, i) => (
          <li key={c.n} className={`${CARD} grid gap-x-5 gap-y-2 px-5 py-4 sm:grid-cols-[3rem_1fr_auto] sm:items-start`}>
            <span className="font-mono text-[1.6rem] font-semibold leading-none" style={{ color: ["#8b93ff", "#9d7bff", "#b277f7", "#c86fe8", "#d86ad6"][i] }}>
              {c.n}
            </span>
            <div className="min-w-0">
              <p className="text-[16px] font-semibold text-white">{c.t}</p>
              <p className="mt-0.5 text-[14px] leading-relaxed text-white/65">{c.d}</p>
              <p className="mt-1 text-[12.5px] text-white/40">Adapta-se: {c.a}</p>
            </div>
            <span className="self-start rounded-full bg-[#783DF5]/25 px-3 py-1 text-[12px] text-[#e4d6ff]">{c.s}</span>
          </li>
        ))}
      </ol>
    </Slide>
  );
}

/* ---------------------------- Sessão a sessão ---------------------------- */

type Session = {
  n: string;
  title: string;
  when: string;
  /** Só onde o PDF a tem (as sessões 08 a 10 não têm). */
  goal?: string;
  out: string[];
  result: string;
  example: ReactNode;
};

function MiniTable({ head, rows, cols }: { head: string[]; rows: ReactNode[][]; cols: string }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[32rem]">
        <div className="grid gap-x-4 border-b border-white/10 pb-2 text-[11.5px] font-semibold text-white/40" style={{ gridTemplateColumns: cols }}>
          {head.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid gap-x-4 border-b border-white/[0.05] py-2 text-[13.5px] leading-snug text-white/70 last:border-0" style={{ gridTemplateColumns: cols }}>
            {r.map((c, j) => (
              <span key={j}>{c}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ExampleBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-[#783DF5]/[0.08] p-4 sm:p-5">
      <p className="mb-3 text-[12px] font-semibold text-[#c4a6ff]">{title}</p>
      {children}
    </div>
  );
}

const SESSIONS: Session[] = [
  {
    n: "01",
    title: "Kick-off e diagnóstico comercial",
    when: "Semana 1 · Introdução do guia",
    goal: "perceber onde o negócio perde clientes e dar um dono a cada etapa do funil.",
    out: ["Funil em 7 etapas com o dono de cada uma", "Meta do mês escrita e partilhada com a equipa", "As 3 maiores fugas, por ordem"],
    result: "A direção diz, etapa a etapa, quem é o responsável e onde se perdem mais clientes.",
    example: (
      <ExampleBox title="Exemplo · funil com dono">
        <MiniTable
          head={["Etapa", "Número que a mede", "Dono"]}
          cols="1.2fr 1.3fr 0.8fr"
          rows={[
            ["1 · Contacto entra", "Tempo até à 1.ª resposta", "Atendimento"],
            ["2 · Contacto qualificado", "Taxa de marcação", "Atendimento"],
            ["3 · Consulta ou exame marcado", "Comparência", "Atendimento"],
            ["4 · Consulta ou exame feito", "Planos apresentados", "Clínico ou técnico"],
            ["5 · Plano ou orçamento", "Aceitação e valor médio", "Quem fecha"],
            ["6 · Venda aceite", "Pagamento e tempo até à entrega", "Quem fecha"],
            ["7 · Concluído", "Regresso e indicações", "Direção"],
          ]}
        />
      </ExampleBox>
    ),
  },
  {
    n: "02",
    title: "Números de base e planeamento ao contrário",
    when: "Semana 2 · Cap. 01 do guia",
    goal: "ter números reais e fazer as contas da meta até aos contactos necessários.",
    out: ["Folha de registo de contactos (15 min/dia)", "Baseline dos 6 KPIs", "Modelo de planeamento mensal"],
    result: "100% dos contactos registados com a origem, e a equipa sabe quantos contactos a meta pede.",
    example: (
      <div className="space-y-3">
        <ExampleBox title="Exemplo · folha de registo">
          <MiniTable
            head={["Data", "Canal", "Como nos conheceu", "Motivo", "Marcou?"]}
            cols="0.6fr 0.9fr 1.1fr 1.1fr 1fr"
            rows={[
              ["12/11", "Chamada", "Google", "Exame de visão", <Strong key="a">Sim · 14/11</Strong>],
              ["12/11", "WhatsApp", "Instagram", "Branqueamento", <Strong key="b">Não · pediu preço</Strong>],
              ["12/11", "Formulário", "ChatGPT", "Ortodontia", <Strong key="c">Sim · 15/11</Strong>],
            ]}
          />
        </ExampleBox>
        <ExampleBox title="Exemplo · contas ao contrário">
          <p className="text-[14px] leading-relaxed text-white/75">
            Meta 60.000 € ÷ 2.500 € = <Strong>24 vendas</Strong> → ÷ 40% aceitação = <Strong>60 planos</Strong> → ÷ 75% comparência ={" "}
            <Strong>80 marcações</Strong> → ÷ 40% marcação = <Strong>200 contactos</Strong>. Com 60% de aceitação, bastam 135.
          </p>
        </ExampleBox>
      </div>
    ),
  },
  {
    n: "03",
    title: "Quem capta e quem fecha",
    when: "Semana 3 · Cap. 04 do guia",
    goal: "separar quem marca de quem fecha, com um número por pessoa.",
    out: ["Matriz de papéis, com a métrica de cada um", "Quem apresenta planos e orçamentos, e quando"],
    result: "Cada pessoa sabe o seu papel e o número pelo qual responde. Quem diagnostica não negoceia preço.",
    example: (
      <ExampleBox title="Exemplo · matriz de papéis">
        <MiniTable
          head={["Papel", "Faz", "Mede"]}
          cols="0.8fr 1.6fr 1.2fr"
          rows={[
            [<Strong key="a">Atendimento</Strong>, "Responde em minutos, qualifica, marca e confirma", "Tempo de resposta, marcação, comparência"],
            [<Strong key="b">Quem fecha</Strong>, "Apresenta o plano ou orçamento, conduz a decisão, trata do financiamento", "Aceitação, valor médio"],
            [<Strong key="c">Clínico ou técnico</Strong>, "Diagnostica, explica e cria confiança", "Casos avaliados, satisfação"],
          ]}
        />
        <p className="mt-3 text-[12.5px] text-white/50">Equipa pequena: a mesma pessoa pode ter dois papéis, mas não no mesmo momento.</p>
      </ExampleBox>
    ),
  },
  {
    n: "P",
    title: "Dia presencial",
    when: "Semanas 3 a 5 · numa rede, na localização piloto",
    goal: "ver o atendimento real e formar a equipa com base nele.",
    out: ["Observações com exemplos reais", "Equipa treinada no guião, com role-plays", "3 prioridades acordadas com a direção"],
    result: "A equipa ouviu-se a si própria e saiu com uma mudança concreta para aplicar já no dia seguinte.",
    example: (
      <ExampleBox title="Exemplo · agenda tipo do dia">
        <dl className="space-y-2.5">
          {[
            ["Manhã", "Observar o atendimento: chamadas, WhatsApp e balcão. Assistir a 1 ou 2 apresentações de plano ou orçamento."],
            ["Início da tarde", "Formação ao vivo com o guião de atendimento, usando casos que vimos de manhã."],
            ["Fim da tarde", "Role-plays de objeções e fecho com a direção: as 3 prioridades até ao fim do mês 2."],
          ].map(([t, d]) => (
            <div key={t} className="grid gap-x-4 sm:grid-cols-[8rem_1fr]">
              <dt>
                <Mono>{t}</Mono>
              </dt>
              <dd className="text-[14px] leading-relaxed text-white/75">{d}</dd>
            </div>
          ))}
        </dl>
      </ExampleBox>
    ),
  },
  {
    n: "04",
    title: "Guião de atendimento",
    when: "Semana 5 · Cap. 04 do guia · início da revisão de chamadas",
    goal: "nenhum contacto termina sem uma data na agenda ou um próximo contacto combinado.",
    out: ["Guião adaptado ao tom da marca", "1.ª revisão de chamadas, com scorecard", "Resposta-padrão para a pergunta do preço"],
    result: "Scorecard médio do atendimento registado e a subir. A equipa usa as duas opções de data em todas as chamadas.",
    example: (
      <div className="space-y-3">
        <ExampleBox title="Exemplo · o guião em 8 passos (adaptar as palavras, manter a ordem)">
          <ol className="space-y-2">
            {[
              ["Atender com nome", "«{Marca}, bom dia, fala a {nome}. Em que posso ajudar?»"],
              ["Perceber o motivo", "«Conte-me um pouco: o que o fez procurar-nos?» E deixar falar."],
              ["Perguntar a origem", "«Já agora, como nos conheceu?» Registar sempre na folha."],
              ["Explicar o que acontece", "O que se faz, quem o vai ver, quanto tempo demora e o que leva consigo."],
              ["Propor duas opções", "«Tenho quarta às 10h ou quinta às 17h. Qual lhe dá mais jeito?»"],
              ["Confirmar o sim", "«Fica marcado para quinta às 17h. Consegue garantir?»"],
              ["Pedir o WhatsApp", "«Vou enviar-lhe a confirmação com a morada. É este o número?»"],
              ["Se perguntar o preço", "Dizer o valor da consulta ou do exame; o da solução depende da avaliação."],
            ].map(([t, d], i) => (
              <li key={t} className="grid gap-x-4 gap-y-0.5 sm:grid-cols-[2rem_11rem_1fr]">
                <Mono>{String(i + 1).padStart(2, "0")}</Mono>
                <span className="text-[14px] font-semibold text-white">{t}</span>
                <span className="text-[14px] leading-relaxed text-white/70">{d}</span>
              </li>
            ))}
          </ol>
        </ExampleBox>
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <Label tone="muted">Na clínica</Label>
            <p className="mt-2 text-[14px] leading-relaxed text-white/75">
              «Clínica {"{Nome}"}, bom dia, fala a Ana. […] Na consulta de avaliação, o Dr. {"{nome}"} vê o seu caso e explica-lhe as
              opções. Conte com {"{duração}"}.»
            </p>
          </Card>
          <Card>
            <Label tone="muted">Na ótica</Label>
            <p className="mt-2 text-[14px] leading-relaxed text-white/75">
              «Ótica {"{Nome}"}, bom dia, fala o Rui. […] No exame de visão, o optometrista avalia a sua graduação e ajuda a escolher a
              solução. Conte com {"{duração}"}.»
            </p>
          </Card>
        </div>
        <Takeaway lead="Regra:">nenhuma chamada termina sem uma data na agenda ou um próximo contacto combinado.</Takeaway>
      </div>
    ),
  },
  {
    n: "05",
    title: "Comparência",
    when: "Semana 6 · Cap. 03 do guia",
    goal: "prevenir a falta no momento em que se marca, não no dia.",
    out: ["Sequência: ao marcar, 48 h, 24 h, no dia", "Protocolo de faltas e lista de espera ativa"],
    result: "Sequência ativa em todas as marcações e comparência medida todas as semanas.",
    example: (
      <div className="grid gap-3 md:grid-cols-3">
        {[
          ["Ao marcar", "«Olá {Nome}, ficou marcado para {dia} às {hora}, na {Marca} ({morada}). {Profissional} vai avaliar {motivo}; conte com {duração}. Até lá!»"],
          ["24 h antes", "«Olá {Nome}, bom dia! Estamos à sua espera amanhã às {hora}. Responda SIM para confirmar. Se precisar de mudar, diga-nos.»"],
          ["Se faltou", "«Olá {Nome}, tínhamos a sua marcação hoje às {hora}. Está tudo bem? Guardo-lhe vaga para {dia} ou {dia}?»"],
        ].map(([t, q]) => (
          <ExampleBox key={t} title={t}>
            <Quote>{q}</Quote>
          </ExampleBox>
        ))}
      </div>
    ),
  },
  {
    n: "06",
    title: "Apresentação do plano ou orçamento",
    when: "Semana 7 · Cap. 04 do guia",
    goal: "o cliente escolhe entre soluções, não entre sim e não.",
    out: ["Guião em 6 movimentos", "3 opções por tipo de caso, do essencial ao completo", "Tabela de valores mensais"],
    result: "Todas as apresentações com 3 opções e o valor mensal ao lado do total. Scorecard do plano registado.",
    example: (
      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <ExampleBox title="Exemplo · pergunta de fecho">
            <Quote>
              «Pelo que me contou, a opção {"{X}"} resolve {"{problema}"} e encaixa no que quer investir. Avançamos e marcamos já o
              próximo passo?»
            </Quote>
          </ExampleBox>
          <ExampleBox title="Exemplo · 3 opções numa ótica">
            <ol className="space-y-1 text-[14px] text-white/75">
              <li>1 · Progressivas, gama essencial</li>
              <li>2 · Progressivas com tratamentos</li>
              <li>3 · Progressivas premium personalizadas</li>
            </ol>
            <p className="mt-2 text-[12.5px] text-white/50">Sempre com o valor por mês ao lado do total.</p>
          </ExampleBox>
        </div>
        <div className="rounded-2xl bg-white/[0.03] p-4">
          <p className="mb-2.5 text-[12px] font-semibold text-white/45">Antes de apresentar, confirmar</p>
          <Chips items={["Quem decide está presente", "Financiamento pronto", "2 ou 3 casos semelhantes à mão"]} />
        </div>
      </div>
    ),
  },
  {
    n: "07",
    title: "Objeções e follow-up de 30 dias",
    when: "Semana 8 · Cap. 04 do guia",
    goal: "nenhum orçamento sai sem próximo passo, e nenhum fica esquecido.",
    out: [
      "Biblioteca de objeções com a resposta de cada uma",
      "Sequência D+0 a D+30 ativa",
      "Lista de orçamentos em aberto, cada um na sua etapa",
    ],
    result: "Todos os orçamentos em aberto estão numa etapa da sequência, com data do próximo contacto.",
    example: (
      <div className="space-y-3">
        <ExampleBox title="Exemplo · biblioteca de objeções">
          <dl className="divide-y divide-white/[0.06]">
            {[
              ["«É caro»", "Mostrar o valor por mês e o faseamento. Lembrar o custo de não resolver."],
              ["«Vou pensar»", "Perguntar o que falta para decidir e fechar um próximo passo com data."],
              ["«Tenho medo»", "Explicar passo a passo, mostrar casos reais e o acompanhamento depois."],
              ["«Tenho de falar com…»", "Convidar a outra pessoa e marcar uma conversa com os dois."],
              ["«Vou ver outros sítios»", "Reforçar o que distingue a marca. Não entrar em guerra de preço."],
              ["«Agora não é a altura»", "Perguntar o que muda daqui a uns meses. Muitas vezes, só o problema cresce."],
            ].map(([o, r]) => (
              <div key={o} className="grid gap-x-4 gap-y-0.5 py-2 sm:grid-cols-[13rem_1fr]">
                <dt className="text-[14px] font-semibold text-white">{o}</dt>
                <dd className="text-[14px] leading-relaxed text-white/70">{r}</dd>
              </div>
            ))}
          </dl>
        </ExampleBox>
        <ExampleBox title="Exemplo · resposta a «vou pensar»">
          <Quote>
            «Claro, é uma decisão importante. Para o poder ajudar: o que é que ainda precisa de saber para decidir? É o valor, a
            solução em si ou o momento?»
          </Quote>
        </ExampleBox>
        <ExampleBox title="Exemplo · sequência de 30 dias">
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["D+0", "WhatsApp", "Agradecer e enviar o resumo"],
              ["D+1", "Chamada", "Primeiras dúvidas"],
              ["D+3", "WhatsApp", "Caso semelhante"],
              ["D+7", "Chamada", "Objeção real e financiamento"],
              ["D+14", "WhatsApp", "Valor e condição com prazo"],
              ["D+30", "Chamada", "Último contacto direto"],
            ].map(([d, c, t]) => (
              <li key={d} className="rounded-xl border border-white/10 bg-[#0c0a18] p-3">
                <Mono>{d}</Mono>
                <p className="mt-1 text-[12px] text-white/45">{c}</p>
                <p className="mt-1 text-[13px] leading-snug text-white/80">{t}</p>
              </li>
            ))}
          </ol>
        </ExampleBox>
        <ExampleBox title="Exemplo · mensagem D+0">
          <Quote>
            «Olá {"{Nome}"}, obrigado pela visita de hoje! Como combinado, envio-lhe o resumo: {"{resumo}"}. Qualquer dúvida, estou
            por aqui. Falamos na {"{dia}"} para ver o que decidiu?»
          </Quote>
        </ExampleBox>
      </div>
    ),
  },
  {
    n: "08",
    title: "Canais, reviews e reativação",
    when: "Semana 9 · Cap. 02 e 05 do guia",
    out: ["Custo por cliente de cada canal", "Sistema de reviews (inquérito 0 a 5)", "1.ª campanha de reativação lançada"],
    result: "Pedido de review a todos os que concluem e um segmento da base reativado, com quantos voltaram a marcar.",
    example: (
      <div className="grid gap-3 md:grid-cols-2">
        <ExampleBox title="Exemplo · review">
          <Quote>
            «Olá {"{Nome}"}, obrigado pela confiança na {"{Marca}"}! De 0 a 5, como avalia a experiência?» Com 4 ou 5: «Se puder deixar
            a sua opinião no Google, ajuda outras pessoas: {"{link}"}.»
          </Quote>
        </ExampleBox>
        <ExampleBox title="Exemplo · reativação">
          <Quote>
            «Olá {"{Nome}"}, fala a {"{nome}"}, da {"{Marca}"}. Já passou algum tempo desde a sua última visita. Temos vagas para uma
            revisão na próxima semana. Quer que lhe reserve uma?»
          </Quote>
        </ExampleBox>
      </div>
    ),
  },
  {
    n: "09",
    title: "Afinação do ponto mais fraco",
    when: "Semana 11 · Cap. 01 do guia",
    out: ["Motivo registado em cada orçamento perdido", "Plano de correção da etapa com mais perdas"],
    result: "A fuga n.º 1 tem uma causa, um responsável e uma ação com prazo.",
    example: (
      <ExampleBox title="Exemplo · motivos de perda e como ler">
        <Chips items={["Preço", "Sem urgência", "Medo", "Indecisão", "Concorrência", "Agenda", "Deixou de responder", "Saúde"]} />
        <p className="mt-3 text-[13.5px] leading-relaxed text-white/70">
          Se os contactos sobem e as marcações não, o problema está no atendimento, não na publicidade.
        </p>
      </ExampleBox>
    ),
  },
  {
    n: "10",
    title: "Resultados e próximos 90 dias",
    when: "Semana 12 · Cap. 05 do guia",
    out: ["Relatório antes/depois dos 6 KPIs", "Plano dos 90 dias seguintes", "Proposta de continuidade"],
    result: "A direção faz sozinha a revisão semanal de 30 min, com os números à frente.",
    example: (
      <ExampleBox title="Exemplo · checklist semanal da direção">
        <ul className="space-y-1.5">
          {[
            "Números do funil: contactos, marcações, comparência, planos, aceitação, valor médio",
            "Tempo de resposta da semana · Orçamentos em aberto e etapa de cada um",
            "Ocupação da agenda da semana seguinte · Motivo de cada cliente perdido",
          ].map((t) => (
            <li key={t} className="flex gap-2.5 text-[14px] leading-relaxed text-white/75">
              <Check className="mt-[0.25em] h-4 w-4 shrink-0 text-emerald-300" />
              {t}
            </li>
          ))}
        </ul>
      </ExampleBox>
    ),
  },
];

function ChapterSessions() {
  return (
    <Slide
      eyebrow="Sessão a sessão"
      title="O que sai de cada sessão, com exemplos"
      lead="Abre uma sessão para ver o que sai, o resultado que procuramos e o exemplo."
    >
      <div className="space-y-2.5">
        {SESSIONS.map((s, i) => (
          <details key={s.n} open={i === 0} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] transition open:border-[#783DF5]/35 open:bg-[#783DF5]/[0.04] hover:border-white/20">
            <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-3.5 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#783DF5] sm:px-5 [&::-webkit-details-marker]:hidden">
              <SessionBadge n={s.n} />
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold leading-tight text-white">{s.title}</span>
                <span className="mt-0.5 block text-[12.5px] text-white/45">{s.when}</span>
              </span>
              <span className="shrink-0 rounded-full bg-white/[0.08] px-3 py-1 text-[12px] font-medium text-white/75 transition group-hover:bg-white group-hover:text-[#07080d]">
                <span className="group-open:hidden">Abrir</span>
                <span className="hidden group-open:inline">Fechar</span>
              </span>
            </summary>
            <div className="space-y-5 border-t border-white/[0.07] px-4 pb-5 pt-4 sm:px-5">
              {s.goal && (
                <p className="text-[15px] leading-relaxed text-white/80">
                  <Strong>Objetivo:</Strong> {s.goal}
                </p>
              )}
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <Label tone="muted">O que sai</Label>
                  <div className="mt-2">
                    <Arrows items={s.out} />
                  </div>
                </div>
                <div>
                  <Label>Resultado que procuramos</Label>
                  <p className="mt-2 text-[14px] leading-relaxed text-white/75">{s.result}</p>
                </div>
              </div>
              {s.example}
            </div>
          </details>
        ))}
      </div>
    </Slide>
  );
}

function ChapterAdapt() {
  return (
    <>
      <Slide
        eyebrow="Adaptar a cada negócio"
        title={<Split a="O método é o mesmo." b="Mudam as palavras, os exemplos e a escala." />}
      >
        <Table
          head={["No funil", "Clínica", "Ótica", "Fisio e bem-estar"]}
          cols="minmax(8rem,10rem) 1fr 1fr 1fr"
          rows={[
            ["1.ª marcação", "Consulta de avaliação", "Exame de visão", "Avaliação inicial"],
            ["Quem avalia", "Médico ou clínico", "Optometrista", "Fisioterapeuta ou técnico"],
            ["O que se apresenta", "Plano de tratamento", "Orçamento de óculos ou lentes", "Plano de sessões ou pack"],
            ["Quem fecha", "Coordenador de tratamento", "Consultor de loja", "Coordenador ou receção"],
            ["Conclusão", "Tratamento concluído", "Entrega e ajuste", "Pack concluído"],
            ["Regresso", "Revisão e manutenção", "Novo exame, lentes de contacto", "Manutenção"],
          ]}
        />
      </Slide>

      <Slide
        title="Ajustar ao que o diagnóstico mostra"
        lead="Ajusta-se na sessão 2, já com números de base. Núcleo fixo: sessões 1, 2, 3, 4, 7 e 10, o dia presencial e a revisão de chamadas."
      >
        <Table
          head={["O diagnóstico mostra", "Reforçar", "Pode encurtar"]}
          cols="1.1fr 1.2fr minmax(7rem,10rem)"
          rows={[
            ["Ninguém conta contactos nem a origem", "Sessão 2 em dobro: medição e folha de registo", "Canais"],
            ["Comparência abaixo de 75%", "Comparência e lista de espera", "Reativação"],
            ["Aceitação baixa ou orçamentos parados", "Sessões 6 e 7, com mais role-plays", "Canais e reviews"],
            ["Contactos a mais e mal atendidos", "Guião de atendimento e tempo de resposta", "Canais"],
            ["Poucos contactos, funil saudável", "Canais, Google e ChatGPT, reviews", "Comparência"],
            ["Base grande de clientes inativos", "Reativação com 2 a 3 campanhas", "Canais pagos"],
            ["Equipa pequena, uma pessoa com dois papéis", "Avaliação e plano em momentos separados", "Matriz completa"],
            [
              "Várias localizações",
              <>
                Piloto, padrão e expansão (
                <Link href="#adaptar-rede" className="text-[#c4a6ff] underline-offset-4 hover:underline">
                  ver exemplo
                </Link>
                )
              </>,
              <span key="n" className="font-semibold text-[#c4a6ff]">Nada</span>,
            ],
          ]}
        />
      </Slide>

      <div id="adaptar-rede" className="scroll-mt-40" />
      <Slide
        eyebrow="Exemplo · grupo de óticas com 20 lojas"
        title={<Split a="20 lojas, um padrão:" b="piloto, afinação, expansão." />}
        lead="Não se faz o programa 20 vezes. Construímos o padrão em 2 a 3 lojas piloto e levamo-lo à rede através dos gestores de loja, com os mesmos 10 encontros e o mesmo método."
        takeaway={<Takeaway lead="Valor: sob consulta com o Alex,">sempre acima do programa de 1 localização.</Takeaway>}
      >
        <div className="grid gap-3 lg:grid-cols-3">
          {[
            {
              when: "Mês 1 · sessões 1 a 3",
              t: "Diagnóstico da rede e lojas piloto",
              items: ["Números de base das 20 lojas", "Folha de registo em todas", "Papéis: optometrista e consultor", "Dia presencial numa loja piloto"],
            },
            {
              when: "Mês 2 · sessões 4 a 7",
              t: "Padrão afinado nas lojas piloto",
              items: ["Guião de marcação do exame", "Comparência ao exame", "Orçamento com 3 opções", "Follow-up de 30 dias", "Formação dos gestores de loja"],
            },
            {
              when: "Mês 3 · sessões 8 a 10",
              t: "Expansão à rede",
              items: ["Padrão nas restantes lojas", "Ranking semanal por loja", "Reativação de clientes sem exame há mais de 12 meses", "Rotina da direção da rede"],
            },
          ].map((m, i) => (
            <Card key={m.t}>
              <p className="font-mono text-[12.5px]" style={{ color: ["#8b93ff", "#b277f7", "#e08af0"][i] }}>
                {m.when}
              </p>
              <p className="mt-1.5 text-[17px] font-semibold leading-tight text-white">{m.t}</p>
              <div className="mt-3">
                <Arrows items={m.items} />
              </div>
            </Card>
          ))}
        </div>
      </Slide>

      <Slide title="O que muda numa rede">
        <Table
          head={["O que muda", "1 localização", "Grupo de 20 lojas"]}
          cols="minmax(9rem,12rem) 1fr 1.2fr"
          rows={[
            ["Nas sessões", "Direção, atendimento e quem fecha", "Direção comercial, gestores de loja e marketing"],
            ["Dia presencial", "1 dia no cliente", "1 dia numa loja piloto; mais dias sob consulta"],
            ["Revisão de chamadas", "Amostra semanal", "Amostra semanal que roda entre lojas"],
            ["KPIs", "Do negócio", "Por loja, com ranking e média da rede"],
          ]}
        />
      </Slide>

      <Slide title="Numa ótica: os KPIs e o que perguntar no diagnóstico">
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <Label>KPIs numa ótica</Label>
            <div className="mt-3">
              <Chips
                tone="accent"
                items={["Tempo de resposta", "Marcação de exames", "Comparência ao exame", "Exame → venda", "Valor médio por venda", "Orçamentos em follow-up"]}
              />
            </div>
          </Card>
          <Warn title="Perguntar no diagnóstico">
            <Arrows
              items={[
                "Marcação centralizada ou por loja?",
                "Que sistema de agenda e gestão usam?",
                "Quem apresenta o orçamento?",
                "Que números já existem por loja?",
              ]}
            />
          </Warn>
        </div>
      </Slide>

      <Slide
        eyebrow="Entregáveis, KPIs e checklist interna"
        title={<Split a="Os mesmos 6 KPIs," b="medidos na sessão 2 e na sessão 10." />}
        lead="Os alvos definem-se com o cliente na sessão 2, a partir dos números reais. Numa rede, por localização."
      >
        <div className="border-y border-white/[0.08]">
          <div className="grid grid-cols-[1fr_6.5rem_6.5rem] gap-x-3 border-b border-white/[0.12] py-2.5 text-[11.5px] font-semibold text-white/45 sm:grid-cols-[1fr_10rem_10rem]">
            <span>KPI</span>
            <span>Baseline · sessão 2</span>
            <span>Final · sessão 10</span>
          </div>
          {[
            "Tempo até à 1.ª resposta (min)",
            "Taxa de marcação (%)",
            "Comparência à consulta ou exame (%)",
            "Aceitação de planos ou orçamentos (%)",
            "Valor médio por cliente (€)",
            "Orçamentos em follow-up ativo (%)",
          ].map((k) => (
            <div key={k} className="grid grid-cols-[1fr_6.5rem_6.5rem] items-center gap-x-3 border-b border-white/[0.06] py-2.5 last:border-0 sm:grid-cols-[1fr_10rem_10rem]">
              <span className="text-[14px] text-white/80">{k}</span>
              <span aria-hidden className="h-8 rounded-lg border border-dashed border-white/15 bg-white/[0.02]" />
              <span aria-hidden className="h-8 rounded-lg border border-dashed border-white/15 bg-white/[0.02]" />
            </div>
          ))}
        </div>
      </Slide>

      <Slide
        title="O que fica com o cliente, e a nossa checklist"
        takeaway={
          <Warn title="Questões em aberto">
            Quem entrega as sessões (Alex ou um closer) · Que ferramenta grava as chamadas · Se as deslocações entram no preço.
          </Warn>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <Label>Fica com o cliente</Label>
            <div className="mt-3">
              <Arrows
                items={[
                  "Modelo de planeamento mensal e folha de registo",
                  "Matriz de papéis e métricas por pessoa",
                  "Guiões: atendimento, confirmação, faltas, plano, objeções, follow-up e reativação",
                  "Scorecards e histórico das revisões",
                  "Relatório antes/depois e plano dos 90 dias seguintes",
                ]}
              />
            </div>
          </Card>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <Label tone="muted">Checklist interna</Label>
            <ul className="mt-3 space-y-2">
              {[
                "Contrato assinado e 1.º pagamento recebido",
                "Guia enviado e pedido de dados feito",
                "A 1.ª sessão marcada no calendário na semana 1",
                "Aviso de gravação (RGPD) confirmado",
                "Mystery call de baseline feita",
                "Baseline dos KPIs registado na sessão 2",
                "Feedback de cada revisão em 48 h úteis",
                "Ponto de situação no fim do mês 1 e do mês 2",
                "Mystery call final e relatório antes/depois",
                "Proposta de continuidade ou SEO, GEO, Ads na sessão 10",
              ].map((t) => (
                <li key={t} className="flex gap-2.5 text-[14px] leading-snug text-white/75">
                  <Square className="mt-[0.15em] h-4 w-4 shrink-0 text-[#a78bfa]" strokeWidth={2} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Slide>
    </>
  );
}

function ChapterAnswers() {
  const clientFaq: Array<[string, ReactNode]> = [
    ["«O que é, ao certo?»", "Três meses a pôr em prática, com a sua equipa, um método que tapa as fugas entre o contacto e a venda."],
    ["«Isto é só para clínicas?»", "Não. O método é o mesmo em clínicas, óticas e outros negócios de saúde; mudam os exemplos e os guiões."],
    ["«Quanto tempo demora?»", "3 meses: 10 sessões online e 1 dia presencial."],
    ["«Temos várias lojas ou clínicas.»", "Começamos em 2 ou 3 localizações piloto e levamos o padrão às restantes com os seus gestores."],
    ["«Quanto tempo exige da equipa?»", "Uma sessão por semana de 60 a 90 min e 15 min por dia na folha de registo."],
    ["«Têm de ouvir as nossas chamadas?»", "Sim, uma amostra por semana, com aviso de gravação a quem liga."],
    ["«Que resultados posso esperar?»", "Medimos 6 indicadores na sessão 2 e comparamos na sessão 10; os objetivos definem-se com os seus números."],
    ["«Isto substitui o marketing?»", "Não. Tapa as fugas antes de investir mais, para que cada contacto que já paga renda mais."],
    ["«E depois dos 3 meses?»", "Pode renovar com acompanhamento prolongado, ou seguir sozinho com a rotina que deixamos montada."],
    ["«Quem dá as sessões?»", <span key="q" className="font-mono text-[13px] text-amber-200">[A DEFINIR: Alex ou closer]</span>],
  ];
  const internalFaq: Array<[string, ReactNode]> = [
    [
      "Como explico o programa em 30 segundos?",
      "Medimos onde se perdem clientes, damos um dono a cada etapa e pomos a equipa a usar guiões que revemos todas as semanas. Ao fim de 3 meses comparamos os números.",
    ],
    [
      "O cliente não é uma clínica. Muda alguma coisa?",
      "O método não. Trocam-se as palavras do funil (ver «Adaptar e medir») e os exemplos dos guiões. O diagnóstico da sessão 1 diz onde está a fuga, seja qual for o negócio.",
    ],
    [
      "Rede com muitas localizações: como corremos as sessões?",
      "As 10 sessões são com a direção e os gestores. O padrão nasce em 2 ou 3 localizações piloto e passa às restantes no mês 3 (ver o exemplo das 20 lojas).",
    ],
    [
      "Em que números temos de estar atentos?",
      "Nos 6 KPIs, todas as semanas. Sinais de alarme: comparência abaixo de 75%, tempo de resposta acima do combinado, aceitação a descer e orçamentos fora da sequência de 30 dias.",
    ],
    [
      "E se o cliente não enviar dados ou chamadas?",
      "Assinalar na sessão seguinte e registar no ponto de situação do mês. Sem números não há antes/depois, e isso tem de ficar claro desde o kick-off.",
    ],
    ["O cliente quer mais de 3 meses.", "O programa fecha na sessão 10 com o relatório antes/depois. O tempo extra entra como renovação com acompanhamento prolongado."],
    ["Quando propor SEO, GEO ou Ads?", "Na sessão 10, ou antes se o funil estiver saudável e o problema for falta de contactos."],
    ["Equipa pequena, sem quem feche?", "Segue o programa com papéis adaptados: a mesma pessoa avalia e apresenta, mas em momentos separados."],
  ];
  return (
    <>
      <Slide
        eyebrow="FAQ · respostas rápidas"
        title={<Split a="O que dizer ao cliente," b="numa frase." />}
        lead={
          <>
            As perguntas sobre preço estão nos{" "}
            <Link href="#valores" className="text-[#c4a6ff] underline-offset-4 hover:underline">
              Valores
            </Link>
            .
          </>
        }
      >
        <Table head={["O cliente pergunta", "Resposta rápida"]} cols="minmax(12rem,17rem) 1fr" rows={clientFaq.map(([q, a]) => [q, a])} />
      </Slide>

      <Slide eyebrow="FAQ interna" title={<Split a="Como explicar, adaptar" b="e acompanhar." />}>
        <ol className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
          {internalFaq.map(([q, a], i) => (
            <li key={q} className="grid gap-x-5 gap-y-1 py-4 sm:grid-cols-[2.5rem_1fr]">
              <Mono>{String(i + 1).padStart(2, "0")}</Mono>
              <div>
                <p className="text-[15.5px] font-semibold text-white">{q}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-white/65">{a}</p>
              </div>
            </li>
          ))}
        </ol>
      </Slide>
    </>
  );
}

function ChapterPricing() {
  return (
    <>
      <Slide
        eyebrow="Valores · a última coisa"
        title={<Split a="Primeiro, o que é e como vai ser feito." b="Só depois, o valor." />}
        lead="Sem descontos. Tudo o que não é o programa de 1 localização passa pelo Alex e fica sempre acima de 7.500 € a pronto e de 9.000 € em prestações. Valores + IVA; em prestações, 3.000 € no início de cada mês."
      >
        <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[#0c0a18]">
          <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: "var(--brand-gradient)" }} />
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full opacity-40 blur-3xl"
            style={{ background: "#343ED7" }}
          />
          <div className="relative grid md:grid-cols-[1.2fr_1fr]">
            <div className="p-6 sm:p-8">
              <p className="text-[12.5px] font-semibold text-[#c4a6ff]">Programa · 1 localização</p>
              <p className="mt-3 max-w-sm text-[17px] leading-relaxed text-white/85">
                3 meses, 10 sessões, 1 dia presencial, revisão semanal de guiões e chamadas.
              </p>
            </div>
            <div className="border-t border-white/10 p-6 sm:p-8 md:border-l md:border-t-0">
              <p className="text-[12.5px] font-medium text-white/50">A pronto (PIF)</p>
              <p className="docs-brand-flow-text mt-1 text-[3.2rem] font-bold leading-none tracking-[-0.04em] tabular-nums">7.500 €</p>
              <p className="mt-6 text-[12.5px] font-medium text-white/50">Em 3 prestações</p>
              <p className="mt-1 text-[2rem] font-semibold leading-none tracking-[-0.03em] text-white tabular-nums">
                9.000 € <span className="text-[14px] font-normal text-white/50">3 × 3.000 €</span>
              </p>
            </div>
          </div>
        </div>
      </Slide>

      <Slide title="Fora do programa de 1 localização, fala-se com o Alex">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { k: "Entrada", t: "Acompanhamento de números", d: "1 localização: acompanhar o funil e assinalar onde está a fuga." },
            { k: "Escala", t: "Várias localizações ou equipas", d: "Ex.: grupo de óticas com 20 lojas, com piloto e expansão." },
            { k: "Continuidade", t: "Depois dos 3 meses", d: "Renovação com acompanhamento prolongado: números e chamadas." },
          ].map((c) => (
            <Card key={c.k} className="flex flex-col">
              <Label>{c.k}</Label>
              <p className="mt-1.5 text-[17px] font-semibold leading-tight text-white">{c.t}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-white/60">{c.d}</p>
              <p className="mt-auto pt-4 text-[13.5px] font-semibold text-white">Sob consulta com o Alex</p>
            </Card>
          ))}
        </div>
      </Slide>

      <Slide title="Respostas sobre preço">
        <Table
          head={["O cliente pergunta", "Resposta"]}
          cols="minmax(12rem,17rem) 1fr"
          rows={[
            ["«Quanto custa?»", "7.500 € a pronto ou 9.000 € em 3 prestações, para 1 localização."],
            ["«Porque é mais caro em prestações?»", "A pronto tem 1.500 € de vantagem por pagar de uma vez."],
            ["«Temos várias lojas. Quanto fica?»", "Depende do número de localizações e do formato. O Alex prepara a proposta."],
            ["«Fazem desconto?»", "Não. O valor paga o acompanhamento semanal e a medição do antes e depois."],
          ]}
        />
      </Slide>

      <Slide
        title="O que sobe o valor"
        takeaway={
          <Link
            href="/documentacao/comissoes#cross-sells"
            className="inline-flex items-center gap-2 text-[14px] font-medium text-[#c4a6ff] underline-offset-4 hover:underline"
          >
            Voltar aos cross-sells das Comissões <ArrowRight className="h-4 w-4" />
          </Link>
        }
      >
        <Chips
          items={[
            "Mais localizações ou equipas",
            "Mais tempo (renovação)",
            "Mais dias presenciais",
            "Deslocações fora da Grande Lisboa",
            "Volume alto de chamadas",
            "CRM ou automações",
          ]}
        />
      </Slide>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Página                                                             */
/* ------------------------------------------------------------------ */

export default async function ConsultoriaComercialPage() {
  const ctx = await getDocsContext(BLOCK_ID);
  if (ctx.state === "no-session") return null;
  if (ctx.state !== "ok" || !ctx.block) {
    return (
      <PageShell backHref="/documentacao" backLabel="Documentação" backPrefix="Voltar a">
        <DocsClosed
          kind={ctx.state === "closed" ? "closed" : "forbidden"}
          name={ctx.state === "closed" ? ctx.name : ctx.state === "forbidden" ? ctx.reader.name : ""}
        />
      </PageShell>
    );
  }
  const { reader, block } = ctx;

  return (
    <PageShell backHref="/documentacao/comissoes#cross-sells" backLabel="Comissões" backPrefix="Voltar a">
      <DocHero
        block="Comissões · Cross-sells"
        title="Consultoria Comercial"
        lead="Um programa de 3 meses em que implementamos, com a equipa do cliente, um método comercial que tapa as fugas entre o primeiro contacto e a venda."
        meta={`Documento interno. Atualizado a ${formatDate(UPDATED_AT)}.${reader.isAdmin ? ` Visível para SuperAdmin e ${block.audienceLabel}.` : ""}`}
      />

      <SopChapters
        chapters={[
          { id: "servico", label: "O serviço", content: <ChapterService /> },
          { id: "fases", num: 1, label: "Fases", content: <ChapterPhases /> },
          { id: "sessoes", num: 2, label: "Plano de sessões", content: <ChapterPlan /> },
          { id: "revisao", num: 3, label: "Revisão de chamadas", content: <ChapterReview /> },
          { id: "guia", num: 4, label: "O guia comercial", content: <ChapterGuide /> },
          { id: "sessao-a-sessao", num: 5, label: "Sessão a sessão", content: <ChapterSessions /> },
          { id: "adaptar", num: 6, label: "Adaptar e medir", content: <ChapterAdapt /> },
          { id: "responder", num: 7, label: "Responder", content: <ChapterAnswers /> },
          { id: "valores", num: 8, label: "Valores", content: <ChapterPricing /> },
        ]}
      />
    </PageShell>
  );
}
