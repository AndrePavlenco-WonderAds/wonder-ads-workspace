// /documentacao/sop-comunicacao — o SOP de Comunicação do SEO DPT.
//
// v80.7: escrito a partir da sessão Road to CEO da Scale Labs (16/11/2026) e
// adaptado à WonderAds com as respostas do André (19/11/2026): comunidade de
// WhatsApp do SEO DPT com 5 canais, Slack com um canal por cliente entre
// departamentos, Meet para bloqueios e reuniões, reuniões de segunda, quarta
// e sexta, sem janelas de envio, resposta até ao fim do dia útil.
//
// v80.8 (UX): a página corrida tinha «muita coisa para o olho de uma vez».
// Passou à organização da apresentação da Scale Labs: capítulos numerados,
// um de cada vez (SopChapters), e em cada capítulo blocos curtos com UMA
// ideia: título-afirmação, um visual, e a conclusão numa faixa por baixo.
//
// EM REVISÃO: o bloco não tem público (só SuperAdmins).

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Clapperboard,
  FileText,
  MessageSquareText,
  MessagesSquare,
  PlayCircle,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { DocHero, DocsClosed, ExecutiveSummary, Rows, Strong } from "@/components/documentacao/doc-ui";
import { CopyTextButton } from "@/components/documentacao/copy-text-button";
import { SopChapters } from "@/components/documentacao/sop-chapters";
import { SopChatRoleplay } from "@/components/documentacao/sop-chat-roleplay";
import { SopWeekCalendar } from "@/components/documentacao/sop-week-calendar";
import { formatDate } from "@/lib/dates";
import { getDocsContext } from "@/lib/documentacao/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "SOP de Comunicação — Documentação",
};

const BLOCK_ID = "sop-comunicacao";

/* ------------------------------------------------------------------ */
/*  Textos                                                             */
/* ------------------------------------------------------------------ */

const REQUEST_TEMPLATE = [
  "Tipo: validar / debater / informar",
  "Contexto: o que se passa e o que já tentei",
  "Opções: A) … B) … e o que cada uma implica",
  "Recomendo: a opção …, porque … Risco: …",
  "Prazo: preciso de resposta até …",
].join("\n");

// v80.9: sem nomes de pessoas nem «Clínica» — «Cliente X» serve qualquer setor.
const DAILY_EXAMPLE = [
  "Daily update – [o teu nome] 19/11",
  "",
  "Cliente X:",
  "• Publicados os 2 artigos do mês",
  "• Corrigidas as metas das 6 páginas de serviço",
  "",
  "Cliente Y:",
  "• Auditoria técnica: 14 erros 404 listados",
  "",
  "Por fazer (e porquê):",
  "• Checklist do Cliente Z (prazo hoje às 17h): faltam os acessos ao WordPress. Programado para amanhã às 10h.",
].join("\n");

/* ------------------------------------------------------------------ */
/*  Peças visuais (o vocabulário da apresentação)                       */
/* ------------------------------------------------------------------ */

/** Um «slide»: título-afirmação, um visual e, opcionalmente, a conclusão. */
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

/** A faixa de conclusão por baixo de cada slide: o início a negrito. */
function Takeaway({ lead, children }: { lead: string; children?: ReactNode }) {
  return (
    <p className="rounded-xl bg-[#783DF5]/[0.16] px-5 py-3.5 text-[14.5px] leading-relaxed text-white/70">
      <span className="font-semibold text-white">{lead}</span>
      {children ? <> {children}</> : null}
    </p>
  );
}

/** A frase-chave de um slide, com mais peso do que a faixa normal: moldura no
 *  gradiente da marca que corre devagar e o início em texto animado (v80.9 —
 *  o «teste», o ODE, a autonomia). */
function HighlightRule({ lead, children }: { lead: string; children?: ReactNode }) {
  return (
    <div className="sop-glow">
      <div className="rounded-[16.5px] bg-[#0c0a18] px-6 py-5 sm:px-7">
        <p className="text-[18px] leading-snug text-white/80 sm:text-[21px]">
          <span className="docs-brand-flow-text font-bold">{lead}</span>
          {children ? <> {children}</> : null}
        </p>
      </div>
    </div>
  );
}

const CARD = "rounded-2xl border border-[#783DF5]/20 bg-[#783DF5]/[0.06]";

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${CARD} p-5 ${className}`}>{children}</div>;
}

function CardTitle({ icon: Icon, emoji, title, sub }: { icon?: LucideIcon; emoji?: string; title: string; sub?: string }) {
  return (
    <div>
      {Icon && <Icon className="mb-3 h-5 w-5 text-[#c4a6ff]" strokeWidth={1.75} />}
      {emoji && (
        <span aria-hidden className="mb-3 block text-[22px] leading-none">
          {emoji}
        </span>
      )}
      <p className="text-[18px] font-semibold leading-tight text-white">{title}</p>
      {sub && <p className="mt-1 text-[12.5px] font-semibold text-[#c4a6ff]">{sub}</p>}
    </div>
  );
}

/** O rodapé dos cartões de formato: «Resposta esperada» + o prazo. */
function ResponseFoot({ value }: { value: string }) {
  return (
    <div className="mt-auto border-t border-white/10 pt-3">
      <p className="text-[12px] text-white/40">Resposta esperada</p>
      <p className="mt-0.5 text-[15px] font-semibold text-white">{value}</p>
    </div>
  );
}

function Numbered({ items }: { items: Array<{ term: string; detail: ReactNode }> }) {
  return (
    <ol className="space-y-2.5">
      {items.map((it, i) => (
        <li key={it.term} className={`${CARD} grid items-center gap-x-5 gap-y-1 px-4 py-3.5 sm:grid-cols-[2.25rem_11rem_1fr]`}>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#783DF5]/45 text-[14px] font-semibold text-white">
            {i + 1}
          </span>
          <span className="text-[15px] font-semibold text-white">{it.term}</span>
          <span className="text-[14px] leading-relaxed text-white/60">{it.detail}</span>
        </li>
      ))}
    </ol>
  );
}

function Mono({ children }: { children: string }) {
  return <pre className="whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed text-white/80">{children}</pre>;
}

const linkCls = "text-[#c4a6ff] underline-offset-4 hover:underline";

/* ------------------------------------------------------------------ */
/*  Capítulos                                                          */
/* ------------------------------------------------------------------ */

function ChapterIntro() {
  const questions = [
    { n: "01", q: "Onde se comunica?", sub: "Canais e formatos", d: "Que grupo e que formato para cada tema.", href: "#canais" },
    { n: "02", q: "Quando se comunica?", sub: "Momentos e horários", d: "As reuniões da semana e o fim do dia.", href: "#momentos" },
    { n: "03", q: "Como se escreve?", sub: "Regras de escrita", d: "O padrão de qualquer mensagem.", href: "#escrita" },
    { n: "04", q: "Como se pede ajuda?", sub: "Pedidos à direção", d: "O que se faz antes de pedir, e como se pede.", href: "#pedidos" },
  ];
  return (
    <>
      <Slide eyebrow="A regra que não falha" title="Nenhum pedido à direção chega sem a tua sugestão de solução.">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-5">
          <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: "var(--brand-gradient)" }} />
          <p className="max-w-3xl text-[15.5px] leading-relaxed text-white/70">
            A direção pede-a sempre. Não há perguntas, dúvidas ou pedidos sem a proposta do consultor.{" "}
            <Strong>
              Pensas no problema, escolhes uma proposta de solução (no máximo duas) e a direção valida e apoia. É assim que se
              constrói autonomia.
            </Strong>
          </p>
        </div>
      </Slide>

      <Slide
        title="Cada interrupção tem um custo"
        takeaway={
          <Takeaway lead="Não são 23 minutos parados.">É o tempo médio até voltar ao foco total na tarefa interrompida.</Takeaway>
        }
      >
        <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
          <p className="leading-none">
            <span className="text-[5.5rem] font-bold tracking-[-0.05em] text-[#c4a6ff] sm:text-[7rem]">23</span>
            <span className="mt-1 block text-[18px] font-semibold text-[#c4a6ff]">minutos</span>
          </p>
          <p className="max-w-xl pt-3 text-[19px] font-semibold leading-snug text-white sm:text-[22px]">
            Em média, quem é interrompido demora cerca de 23 minutos a voltar ao que estava a fazer.
          </p>
        </div>
      </Slide>

      <Slide
        title="O SOP responde a quatro perguntas"
        takeaway={
          <Takeaway lead="Conta como ineficácia.">
            Falhar uma regra deste SOP é «Processo não seguido», desde o dia em que é publicado à equipa.
          </Takeaway>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {questions.map((x) => (
            <a key={x.n} href={x.href} className={`${CARD} group flex flex-col p-5 transition hover:border-[#783DF5]/45`}>
              <span className="text-[2rem] font-bold leading-none text-[#c4a6ff]">{x.n}</span>
              <span className="mt-3 text-[17px] font-semibold leading-tight text-white">{x.q}</span>
              <span className="mt-1 text-[12.5px] font-semibold text-[#c4a6ff]">{x.sub}</span>
              <span className="mt-2 text-[13.5px] leading-relaxed text-white/55">{x.d}</span>
              <span className="mt-auto inline-flex items-center gap-1 pt-4 text-[12.5px] text-white/40 transition group-hover:text-white">
                Abrir <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </a>
          ))}
        </div>
      </Slide>
    </>
  );
}

function ChapterChannels() {
  const formats: Array<{ icon: LucideIcon; title: string; sub: string; d: string; time: string }> = [
    { icon: MessageSquareText, title: "Mensagem", sub: "O normal", d: "Tudo o que não te bloqueia. Fica escrito e não interrompe.", time: "Até ao fim do dia útil" },
    // v80.9: o Meet rápido é ligar e entrar na hora; a reunião é agendada
    // para debater uma decisão. Não se confundem.
    {
      icon: Video,
      title: "Meet rápido",
      sub: "Ligar e entrar, sem agendar",
      d: "Ligar para entrar num Meet rápido, quando estás parado e não consegues avançar sozinho.",
      time: "Na hora",
    },
    { icon: PlayCircle, title: "Loom", sub: "Vídeo do ecrã", d: "É preciso ver um ecrã ou um processo. Fica guardado.", time: "48h úteis" },
    {
      icon: Users,
      title: "Reunião",
      sub: "Agendada, último recurso",
      d: "Para debater uma decisão com impacto. Agenda-se no Google Calendar, com convite.",
      time: "Agendada",
    },
  ];
  const groups: Array<{ emoji: string; title: string; sub: string; d: ReactNode }> = [
    { emoji: "🔍", title: "Pedidos à Direção", sub: "Consultor → chefia", d: <>Aprovações, revisões e decisões. Com o template e <Strong>a tua proposta</Strong>.</> },
    { emoji: "📥", title: "Pedidos à Equipa", sub: "Chefia → equipa", d: <>Entregáveis com prazo e extras. Sempre em <Strong>ODE</Strong>; confirma-se com ✅.</> },
    { emoji: "📊", title: "Daily Updates", sub: "Toda a equipa, todos os dias", d: "O que fizeste por cliente e o que ficou por fazer." },
    { emoji: "💬", title: "WonderAds SEO DPT", sub: "Toda a equipa", d: "Dúvidas entre colegas, partilhas e preparação das reuniões." },
    { emoji: "📢", title: "Announcements", sub: "Só a direção escreve", d: "Avisos, mudanças e regras novas. Não se responde lá." },
  ];
  return (
    <>
      <Slide
        title="Mensagem primeiro, reunião em último recurso"
        takeaway={<HighlightRule lead="O teste:">se cabe numa mensagem escrita com contexto, não é reunião.</HighlightRule>}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {formats.map((f) => (
            <Card key={f.title} className="flex flex-col">
              <CardTitle icon={f.icon} title={f.title} sub={f.sub} />
              <p className="mb-5 mt-2 text-[14px] leading-relaxed text-white/60">{f.d}</p>
              <ResponseFoot value={f.time} />
            </Card>
          ))}
        </div>
      </Slide>

      <Slide
        title="Cada tema tem o seu grupo"
        lead="A comunidade WonderAds SEO DPT, no WhatsApp."
        takeaway={<Takeaway lead="Na dúvida, vai para o grupo.">Se interessa a mais de uma pessoa, não vai por privado.</Takeaway>}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <Card key={g.title}>
              <CardTitle emoji={g.emoji} title={g.title} sub={g.sub} />
              <p className="mt-2 text-[14px] leading-relaxed text-white/60">{g.d}</p>
            </Card>
          ))}
        </div>
      </Slide>

      <Slide
        title="Fora do grupo, só duas portas"
        takeaway={<Takeaway lead="Mesmas regras, mesmo prazo.">No Slack também se responde até ao fim do dia útil.</Takeaway>}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardTitle icon={MessagesSquare} title="Slack" sub="Com os outros departamentos" />
            <p className="mt-2 text-[14px] leading-relaxed text-white/60">
              Um canal por cliente, partilhado pelo SEO, ADS, Web e Comercial. O pedido vai para o canal do cliente, com @ de quem
              age e em ODE.
            </p>
          </Card>
          <Card>
            <CardTitle icon={MessageSquareText} title="Mensagem privada" sub="Só uma pessoa" />
            <p className="mt-2 text-[14px] leading-relaxed text-white/60">
              Só o que é pessoal ou sensível: feedback individual, salários, saúde, férias. O trabalho vai para o grupo, com @,
              mesmo que seja para uma só pessoa.
            </p>
          </Card>
        </div>
      </Slide>
    </>
  );
}

function ChapterMoments() {
  const agendas = [
    {
      day: "Segunda · 15h30",
      title: "Bloqueios e calls",
      points: ["20 min «9ams»: bloqueios, dúvidas e problemas", "Uma call de um colega no Fathom, à vez", "O que correu bem, e roleplay do que correu mal"],
    },
    {
      day: "Quarta · 14h00",
      title: "Deep dive",
      points: ["Os projetos de 3 dos 6 consultores, à vez", "Status, roadmap, pending reviews e atrasos", "O que está bloqueado, e como os colegas ajudam"],
    },
    {
      day: "Sexta · 15h30",
      title: "Fecho da semana",
      points: ["20 min «9ams»: bloqueios, dúvidas e problemas", "Cada um envia pelo menos uma call da semana ao Team Leader"],
    },
  ];
  return (
    <>
      <Slide
        title="Se não está no calendário, não existe"
        lead="Um exemplo de semana de um consultor. Reuniões no Google Meet, gravadas com o Google Workspace."
        takeaway={<Takeaway lead="Cada momento tem dia e hora.">Nada de reuniões soltas.</Takeaway>}
      >
        <SopWeekCalendar />
      </Slide>

      <Slide
        title="Três reuniões, cada uma com a sua estrutura"
        lead="Todas abrem com os avisos à navegação do Team Leader (enquanto não houver, da chefia)."
        takeaway={<Takeaway lead="✋ Levantar a mão.">Para perguntar a meio da fala de um colega, usa sempre «Levantar a mão» no Meet.</Takeaway>}
      >
        <div className="grid gap-3 md:grid-cols-3">
          {agendas.map((a) => (
            <Card key={a.day}>
              <p className="text-[12.5px] font-semibold text-[#c4a6ff]">{a.day}</p>
              <p className="mt-1 text-[18px] font-semibold text-white">{a.title}</p>
              <ul className="mt-3 space-y-2 text-[14px] leading-relaxed text-white/60">
                {a.points.map((p) => (
                  <li key={p} className="flex gap-2.5">
                    <span aria-hidden className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-[#c4a6ff]" />
                    {p}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </Slide>

      <Slide
        title="Daily Update: o fecho do teu dia"
        takeaway={
          <Takeaway lead="Até ao fim do teu dia, no 📊 Daily Updates.">
            O «Por fazer» fica para a equipa: não entra nos Weekly Reports dos clientes.
          </Takeaway>
        }
      >
        <div className="grid gap-3 md:grid-cols-[1fr_1.25fr]">
          <Card>
            <p className="text-[12.5px] font-semibold text-[#c4a6ff]">Estrutura</p>
            <ol className="mt-3 space-y-3 text-[14.5px] leading-relaxed text-white/80">
              <li>1. O teu nome e a data.</li>
              <li>
                2. Um bloco por cliente: <Strong>o nome com dois pontos</Strong> e um bullet por tarefa feita.
              </li>
              <li>
                3. <Strong>Por fazer (e porquê):</Strong> os pedidos da direção que não ficaram feitos e para quando estão
                programados.
              </li>
            </ol>
          </Card>
          <div className="rounded-2xl border border-[#c4a6ff]/45 bg-[#783DF5]/[0.1] p-5">
            <p className="mb-3 text-[12.5px] font-semibold text-[#c4a6ff]">Exemplo</p>
            <Mono>{DAILY_EXAMPLE}</Mono>
          </div>
        </div>
      </Slide>

      <Slide
        title="Sem janelas de envio: o prazo é da resposta"
        takeaway={
          <Takeaway lead="Estás bloqueado?">
            Liga para entrar num Meet rápido com um colega que te possa desbloquear. A chefia só se interrompe nos três casos de
            urgência.
          </Takeaway>
        }
      >
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardTitle title="Escreves quando precisas" sub="Durante o dia" />
            <p className="mt-2 text-[14px] leading-relaxed text-white/60">Não há horas de envio. A resposta chega até ao fim do dia útil.</p>
          </Card>
          <Card>
            <CardTitle title="Fora de horas" sub="E fins de semana" />
            <p className="mt-2 text-[14px] leading-relaxed text-white/60">
              Pode-se enviar, mas ninguém tem de ler nem responder até ao dia útil seguinte.
            </p>
          </Card>
          <div className="rounded-2xl border border-amber-300/30 bg-amber-400/[0.07] p-5">
            <p className="text-[18px] font-semibold leading-tight text-white">Urgência</p>
            <p className="mt-1 text-[12.5px] font-semibold text-amber-200">Só isto interrompe a chefia, a qualquer hora</p>
            <ul className="mt-3 space-y-1.5 text-[14px] font-semibold text-white">
              <li>⚠️ Cliente a ponto de sair</li>
              <li>⚠️ Urgência grave</li>
              <li>⚠️ Acessos comprometidos</li>
            </ul>
            <p className="mt-3 text-[13px] leading-relaxed text-white/55">Só estes três, mais nenhum. Liga à chefia.</p>
          </div>
        </div>
      </Slide>
    </>
  );
}

function ChapterWriting() {
  return (
    <>
      <Slide
        title="Regras base para qualquer mensagem"
        lead="No WhatsApp e no Slack."
      >
        <Numbered
          items={[
            { term: "Contexto total", detail: "Escreve como se a pessoa não soubesse nada: cliente, o que se passa, o que já tentaste, links." },
            { term: "Formato", detail: "Listas e frases curtas, o essencial a negrito. Nunca blocos de texto." },
            {
              term: "Sem áudios",
              detail: (
                <>
                  Tudo por escrito, para se poder procurar e reler (
                  <Link href="/documentacao/protocolos-proibidos" className={linkCls}>
                    Protocolo Proibido
                  </Link>
                  ).
                </>
              ),
            },
            { term: "Menções", detail: "@nome sempre que alguém tem de agir." },
            { term: "Confirmação", detail: "Uma reação ✅ confirma que leste ou que ficou feito." },
          ]}
        />
      </Slide>

      {/* v80.9: o ✅ encenado — o André quer isto com ênfase e animação. */}
      <Slide
        eyebrow="O ✅ chega"
        title="Cinco mensagens que podiam ser duas e um ✅"
        lead="Ninguém leva a mal que não escrevas «ok», «obrigado» ou «de nada». O objetivo é ser proativo: menos mensagens, mais trabalho feito."
        takeaway={
          <HighlightRule lead="Parabéns a quem consegue:">
            transformar 5 mensagens (ok, obrigado, de nada…) em apenas 2 mensagens e 1 reação.
          </HighlightRule>
        }
      >
        <SopChatRoleplay />
      </Slide>

      <Slide
        title={
          <>
            ODE: objetivo, data e estrutura <span className="docs-brand-flow-text">em qualquer pedido</span>
          </>
        }
        lead="Obrigatório. Sem O, D e E, não é um pedido."
        takeaway={
          <HighlightRule lead="Em qualquer pedido, nos dois sentidos.">
            A chefia usa-o no 📥 Pedidos à Equipa; a equipa usa-o quando pede a um colega ou a outro departamento.
          </HighlightRule>
        }
      >
        <div className="grid gap-6 md:grid-cols-2 md:items-start">
          <ul className="space-y-5">
            {[
              { l: "O", t: "Objetivo", d: "O porquê do pedido. Quem recebe percebe para que serve." },
              { l: "D", t: "Data", d: "Dia e hora. Sem data, o pedido não tem prazo." },
              { l: "E", t: "Estrutura", d: "O que esperas receber e em que formato: uma lista, um documento, uma decisão." },
            ].map((x) => (
              <li key={x.l} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#783DF5]/45 text-[15px] font-bold text-white">
                  {x.l}
                </span>
                <span>
                  <span className="block text-[16px] font-semibold text-white">{x.t}</span>
                  <span className="mt-0.5 block text-[14px] leading-relaxed text-white/60">{x.d}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="rounded-2xl border border-[#c4a6ff]/45 bg-[#783DF5]/[0.1] p-5">
            <p className="text-[12.5px] font-semibold text-[#c4a6ff]">Sem ODE</p>
            <p className="mt-1 text-[15px] italic text-white/75">«Faz um artigo para o Cliente X.»</p>
            <p className="mt-5 text-[12.5px] font-semibold text-[#c4a6ff]">Com ODE</p>
            <div className="mt-1 space-y-1.5 text-[14px] leading-relaxed text-white/65">
              <p>
                <Strong>Objetivo:</Strong> ganhar posições em «implantes dentários Lisboa», onde está na 2.ª página.
              </p>
              <p>
                <Strong>Data:</Strong> quinta, 20/11, até às 17h.
              </p>
              <p>
                <Strong>Estrutura:</Strong> o artigo num Google Doc com H1, H2, metas e 3 links internos. O link aqui no grupo.
              </p>
            </div>
          </div>
        </div>
      </Slide>
    </>
  );
}

function ChapterRequests() {
  return (
    <>
      <Slide
        title="Antes de pedir ajuda, três passos"
        takeaway={
          <HighlightRule lead="Autonomia não é desenrascar sozinho.">É chegar à chefia com o trabalho pensado.</HighlightRule>
        }
      >
        <div className="grid gap-3 md:grid-cols-4">
          {[
            { n: "1", t: "Procura", d: "Na Documentação, na Formação, num Loom ou no histórico do grupo." },
            { n: "2", t: "Pergunta a um colega", d: "No 💬 WonderAds SEO DPT. Se alguém já resolveu, não precisa da direção." },
            { n: "3", t: "Prepara a proposta", d: "Cinco minutos para juntar o contexto e a tua solução: uma, no máximo duas." },
          ].map((s) => (
            <Card key={s.n}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#783DF5]/45 text-[14px] font-semibold text-white">
                {s.n}
              </span>
              <p className="mt-3 text-[16px] font-semibold text-white">{s.t}</p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/60">{s.d}</p>
            </Card>
          ))}
          <div className="flex flex-col justify-center rounded-2xl bg-[#c4a6ff] p-5 text-[#120f24]">
            <p className="text-[13px] font-semibold">Só então</p>
            <p className="mt-1 text-[17px] font-bold leading-tight">🔍 Pedidos à Direção</p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#120f24]/75">O pedido chega com proposta e a decisão leva segundos.</p>
          </div>
        </div>
      </Slide>

      <Slide
        title="Todo o pedido à direção tem cinco partes"
        takeaway={<Takeaway lead="Fixado no 🔍 Pedidos à Direção">e na descrição do grupo. A chefia responde até ao fim do dia útil.</Takeaway>}
      >
        <div className="grid gap-6 md:grid-cols-[1fr_1fr] md:items-start">
          <ol className="space-y-4">
            {[
              { t: "Tipo de pedido", d: "Validar (preciso de uma decisão), debater (preciso de discutir) ou informar (um ✅ basta)." },
              { t: "Contexto", d: "Uma ou duas frases, e o que já tentaste." },
              { t: "Opções", d: "Uma hipótese concreta, no máximo duas. Nunca «o que faço?»." },
              { t: "Recomendação e risco", d: "Qual escolhes e porquê. É aqui que deixas de executar e começas a decidir." },
              { t: "Prazo", d: "Até quando precisas de resposta." },
            ].map((x, i) => (
              <li key={x.t} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#783DF5]/45 text-[13.5px] font-semibold text-white">
                  {i + 1}
                </span>
                <span>
                  <span className="block text-[15.5px] font-semibold text-white">{x.t}</span>
                  <span className="mt-0.5 block text-[14px] leading-relaxed text-white/60">{x.d}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="rounded-2xl border border-[#c4a6ff]/45 bg-[#783DF5]/[0.1] p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[12.5px] font-semibold text-[#c4a6ff]">Template de pedido</p>
              <CopyTextButton text={REQUEST_TEMPLATE} label="Copiar" />
            </div>
            <Mono>{REQUEST_TEMPLATE}</Mono>
          </div>
        </div>
      </Slide>

      <Slide
        title="A diferença está no trabalho feito antes de perguntar"
        takeaway={
          <Takeaway lead="Pedido sem proposta volta para trás.">A chefia pede a tua sugestão, e conta como ineficácia.</Takeaway>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <p className="text-[12.5px] font-semibold text-rose-200/80">Um exemplo errado</p>
            <p className="mt-2 text-[16px] font-semibold italic text-white/85">«O Cliente X não aprovou os artigos do mês. O que faço?»</p>
            <ul className="mt-4 space-y-1.5 text-[13.5px] leading-relaxed text-white/55">
              <li>• A chefia tem de perguntar desde quando.</li>
              <li>• Tem de perguntar o que já foi dito ao cliente.</li>
              <li>• Decide por ti, e da próxima vez é igual.</li>
            </ul>
          </Card>
          <div className="rounded-2xl border border-[#c4a6ff]/45 bg-[#783DF5]/[0.1] p-5">
            <p className="text-[12.5px] font-semibold text-[#c4a6ff]">Como os Consultores Wonder fazem</p>
            <div className="mt-2 space-y-1.5 text-[13.5px] leading-relaxed text-white/70">
              <p>
                <Strong>Tipo:</Strong> validar
              </p>
              <p>
                <Strong>Contexto:</Strong> 4 artigos por aprovar desde dia 3. Lembrei a 5 e a 10, sem resposta.
              </p>
              <p>
                <Strong>Opções:</Strong> A) avançar com os 2 que já comentou. B) marcar 15 min com a responsável para os rever.
              </p>
              <p>
                <Strong>Recomendo a B:</Strong> desbloqueia os 4 de uma vez. Risco: pode não ter agenda esta semana.
              </p>
              <p>
                <Strong>Prazo:</Strong> amanhã às 12h, antes da call de quinta.
              </p>
            </div>
          </div>
        </div>
      </Slide>
    </>
  );
}

function ChapterSummary({ updatedAt }: { updatedAt: string }) {
  const tools: Array<{ icon: LucideIcon; t: string; d: string }> = [
    { icon: MessageSquareText, t: "WhatsApp", d: "A comunidade WonderAds SEO DPT" },
    { icon: MessagesSquare, t: "Slack", d: "Um canal por cliente, entre departamentos" },
    { icon: Video, t: "Google Meet", d: "Reuniões e bloqueios, com gravação" },
    { icon: CalendarDays, t: "Google Calendar", d: "Qualquer reunião marcada" },
    { icon: Clapperboard, t: "Fathom", d: "As calls com clientes, revistas à segunda" },
    { icon: PlayCircle, t: "Loom", d: "Vídeos do ecrã" },
    { icon: FileText, t: "Documentação", d: "As regras, e as decisões na página certa" },
  ];
  return (
    <>
      <Slide title="Consulta rápida" lead="Para cada situação, onde e em quanto tempo.">
        <Rows
          rows={[
            { term: "Uma dúvida de trabalho", detail: "Pergunta a um colega no 💬 WonderAds SEO DPT.", value: "Fim do dia útil" },
            { term: "Aprovação, revisão ou decisão", detail: "🔍 Pedidos à Direção, com o template e a tua proposta.", value: "Fim do dia útil" },
            { term: "Estou bloqueado", detail: "Liga para entrar num Meet rápido com um colega que te possa desbloquear.", value: "Na hora" },
            { term: "Debater uma decisão", detail: "Reunião agendada no Google Calendar, com convite.", value: "Agendada" },
            { term: "Mostrar um ecrã", detail: "Um Loom, no grupo certo, com contexto escrito.", value: "48h úteis" },
            { term: "Pedido a outro departamento", detail: "Canal do cliente no Slack, com @ e em ODE.", value: "Fim do dia útil" },
            {
              term: "Cliente a ponto de sair, urgência grave ou acessos comprometidos",
              tone: "amber",
              detail: "Só estes três casos interrompem a chefia: liga, a qualquer hora.",
              value: "Na hora",
            },
            { term: "O que fiz hoje", detail: "📊 Daily Updates, com o «Por fazer» no fim.", value: "Fim do teu dia" },
            { term: "Pessoal ou sensível", detail: "Mensagem privada." },
          ]}
        />
      </Slide>

      <Slide title="Onde está tudo">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tools.map((x) => (
            <Card key={x.t} className="p-4">
              <x.icon className="h-[18px] w-[18px] text-[#c4a6ff]" strokeWidth={1.75} />
              <p className="mt-2.5 text-[15px] font-semibold text-white">{x.t}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-white/55">{x.d}</p>
            </Card>
          ))}
        </div>
      </Slide>

      <Slide title="Histórico de versões">
        <Rows
          rows={[
            {
              term: "v1 · 19/11/2026",
              detail: "Primeira versão, a partir da sessão Road to CEO da Scale Labs, adaptada à WonderAds. Em revisão pela direção.",
              value: "André Pavlenco",
            },
          ]}
        />
      </Slide>

      <ExecutiveSummary
        updatedAt={updatedAt}
        signedBy="André Pavlenco"
        title="O SOP de Comunicação, por extenso"
        paragraphs={[
          <>
            O SOP de Comunicação define onde, quando e como a equipa comunica, entre colegas e com a chefia. Existe porque cada
            interrupção custa, em média, 23 minutos até voltar ao foco total na tarefa interrompida, e porque uma equipa que
            pergunta tudo nunca aprende a decidir. A regra que não falha é esta: nenhum pedido à direção chega sem a sugestão de
            solução do consultor. Pensa-se no problema, escolhe-se uma proposta de solução, no máximo duas, e a direção valida e
            apoia. É assim que se constrói autonomia.
          </>,
          <>
            A comunicação interna faz-se por escrito, na comunidade de WhatsApp WonderAds SEO DPT. No Announcements só a direção
            escreve. O grupo WonderAds SEO DPT é para as dúvidas entre colegas, as partilhas e a preparação das reuniões. O Pedidos
            à Direção leva as aprovações, revisões e decisões, sempre com o template e a proposta do consultor, e a chefia responde
            até ao fim do dia útil. O Pedidos à Equipa leva os entregáveis que a chefia pede, sempre em ODE, e quem recebe confirma
            com ✅. O Daily Updates recebe, até ao fim do dia de cada um, o que se fez por cliente e o que ficou por fazer. Com os
            outros departamentos fala-se no Slack, num canal por cliente, com as mesmas regras. As mensagens privadas ficam para o
            que é pessoal ou sensível.
          </>,
          <>
            A mensagem escrita é o formato normal. Um Loom serve para mostrar um ecrã e tem resposta em até 48 horas úteis. Quem
            está parado liga para entrar num Meet rápido com quem o pode desbloquear, e isso é diferente de uma reunião: a reunião
            é o último recurso, agenda-se no Google Calendar e serve para debater uma decisão. Há três momentos fixos por semana, no
            Meet: segunda às 15h30, quarta às 14h e sexta às 15h30, e o resto da agenda protege o foco. Não há janelas de envio:
            escreve-se quando é preciso, e o que tem prazo é a resposta. Fora de horas pode-se enviar, mas ninguém tem de
            responder até ao dia útil seguinte. Só três casos interrompem a chefia, a qualquer hora: um cliente a ponto de sair,
            uma urgência grave ou acessos comprometidos.
          </>,
          <>
            Cada mensagem segue cinco regras: contexto total, listas e frases curtas, nada de áudios, @ de quem tem de agir e ✅
            para confirmar. Ninguém leva a mal que não se escreva «ok» nem «obrigado»: o objetivo é ser proativo, e parabenizamos
            quem consegue transformar cinco mensagens em duas e uma reação. Qualquer pedido leva ODE: objetivo, data e estrutura.
          </>,
          <>
            Antes de pedir ajuda, procura-se a resposta, pergunta-se a um colega e prepara-se a proposta, porque autonomia não é
            desenrascar sozinho: é chegar à chefia com o trabalho pensado. O pedido à direção tem cinco partes: o tipo, o contexto,
            as opções, a recomendação com o risco e o prazo. Um pedido sem proposta volta para trás, e falhar uma regra deste SOP
            conta como ineficácia, «Processo não seguido», desde o dia em que é publicado à equipa.
          </>,
        ]}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Página                                                             */
/* ------------------------------------------------------------------ */

export default async function SopComunicacaoPage() {
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
  const { block } = ctx;

  return (
    <PageShell backHref="/documentacao" backLabel="Documentação">
      <DocHero
        block={block.title}
        title="SOP de Comunicação"
        pageId="sop-comunicacao"
        lead={
          <>
            Onde, quando e como a equipa comunica.
          </>
        }
        meta={`Atualizado a ${formatDate(block.updatedAt)}. Em revisão: só os SuperAdmins veem esta página.`}
      />

      <SopChapters
        chapters={[
          { id: "objetivo", label: "Objetivo", content: <ChapterIntro /> },
          { id: "canais", num: 1, label: "Canais e formatos", content: <ChapterChannels /> },
          { id: "momentos", num: 2, label: "Momentos e horários", content: <ChapterMoments /> },
          { id: "escrita", num: 3, label: "Regras de escrita", content: <ChapterWriting /> },
          { id: "pedidos", num: 4, label: "Pedidos à direção", content: <ChapterRequests /> },
          { id: "resumo-sop", label: "Resumo", content: <ChapterSummary updatedAt={block.updatedAt} /> },
        ]}
      />
    </PageShell>
  );
}
