// /documentacao/sop-comunicacao — o SOP de Comunicação do SEO DPT (v80.7).
//
// Escrito a partir da sessão Road to CEO da Scale Labs (16/11/2026, «SOP de
// comunicação»: objetivo, canais e formatos com tempo de resposta, momentos e
// horários, regras de escrita + ODE, pedidos ao líder) e adaptado à
// WonderAds com as respostas do André (19/11/2026): comunidade de WhatsApp
// do SEO DPT com 5 canais, Slack com um canal por cliente entre
// departamentos, Meet para bloqueios e reuniões, reuniões de segunda, quarta
// e sexta, sem janelas de envio, resposta até ao fim do dia útil.
//
// EM REVISÃO: o bloco não tem público (só SuperAdmins). Segue a estrutura base
// de um SOP do curso: objetivo → links → a regra que não falha → prática →
// tabela de consulta → histórico de versões → resumo executivo.

import Link from "next/link";
import type { ReactNode } from "react";
import { PageShell } from "@/components/page-shell";
import {
  Bullets,
  DocHero,
  DocSection,
  DocsClosed,
  ExecutiveSummary,
  Note,
  Rows,
  StageFlow,
  Strong,
  SubHeading,
} from "@/components/documentacao/doc-ui";
import { SectionNav } from "@/components/documentacao/section-nav";
import { CopyTextButton } from "@/components/documentacao/copy-text-button";
import { formatDate } from "@/lib/dates";
import { getDocsContext } from "@/lib/documentacao/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "SOP de Comunicação — Documentação",
};

const BLOCK_ID = "sop-comunicacao";

const NAV = [
  { id: "objetivo", label: "Objetivo" },
  { id: "onde-esta", label: "Onde está tudo" },
  { id: "canais", label: "Canais e formatos" },
  { id: "momentos", label: "Momentos e horários" },
  { id: "escrita", label: "Regras de escrita" },
  { id: "pedidos", label: "Pedidos à direção" },
  { id: "consulta", label: "Consulta rápida" },
  { id: "versoes", label: "Versões" },
  { id: "resumo", label: "Resumo" },
];

const REQUEST_TEMPLATE = [
  "Tipo: validar / debater / informar",
  "Contexto: o que se passa e o que já tentei",
  "Opções: A) … B) … e o que cada uma implica",
  "Recomendo: a opção …, porque … Risco: …",
  "Prazo: preciso de resposta até …",
].join("\n");

const REQUEST_EXAMPLE = [
  "Tipo: validar",
  "Contexto: a Clínica X tem 4 artigos por aprovar desde dia 3. Lembrei no grupo do cliente a 5 e a 10, sem resposta.",
  "Opções: A) avançar com os 2 que já comentou e passar os outros 2 para dezembro. B) ligar à responsável de marketing e marcar 15 minutos para os revermos juntos.",
  "Recomendo a B: desbloqueia os 4 de uma vez e o cliente sente o acompanhamento. Risco: pode não ter agenda esta semana.",
  "Prazo: até amanhã às 12h, para ligar antes da call de quinta.",
].join("\n");

const DAILY_EXAMPLE = [
  "Daily update – Maria 19/11",
  "",
  "Clínica X:",
  "• Publicados os 2 artigos do mês",
  "• Corrigidas as metas das 6 páginas de serviço",
  "",
  "Clínica Y:",
  "• Auditoria técnica: 14 erros 404 listados",
  "",
  "Por fazer (e porquê):",
  "• Checklist da Clínica Z (Pedidos à Equipa, prazo hoje às 17h): faltam os acessos ao WordPress, pedidos ao cliente às 11h. Programado para amanhã às 10h.",
].join("\n");

const CHANNELS: Array<{ icon: string; name: string; who: string; what: ReactNode; time?: string }> = [
  {
    icon: "📢",
    name: "Announcements",
    who: "Só a direção escreve",
    what: "Avisos, mudanças e regras novas. Ninguém responde lá.",
  },
  {
    icon: "💬",
    name: "WonderAds SEO DPT",
    who: "Toda a equipa",
    what: "Dúvidas entre colegas, partilhas, vitórias e a preparação das reuniões. Tudo o que não é pedido nem daily.",
  },
  {
    icon: "🔍",
    name: "Pedidos à Direção",
    who: "Consultor → André e Alex",
    what: (
      <>
        Aprovações, revisões, validações e decisões. Sempre com o template e <Strong>a tua proposta</Strong>.
      </>
    ),
    time: "Resposta até ao fim do dia útil",
  },
  {
    icon: "📥",
    name: "Pedidos à Equipa",
    who: "Direção → equipa",
    what: (
      <>
        Entregáveis com prazo e extras pedidos pela direção. Sempre em <Strong>ODE</Strong>. Quem recebe confirma com ✅.
      </>
    ),
  },
  {
    icon: "📊",
    name: "Daily Updates",
    who: "Toda a equipa, todos os dias",
    what: "O que fizeste, por cliente, e o que ficou por fazer. Até ao fim do teu dia.",
  },
];

const WEEK: Array<{ day: string; time: string; title: string; points: string[] }> = [
  {
    day: "Segunda",
    time: "15h30",
    title: "Bloqueios e revisão de calls",
    points: [
      "Avisos à navegação do Team Leader.",
      "20 minutos «9ams»: bloqueios, dúvidas e problemas.",
      "Revisão de uma call de um colega gravada no Fathom. A pessoa roda todas as semanas.",
      "Feedback construtivo: o que correu bem, e roleplay do que correu mal.",
    ],
  },
  {
    day: "Quarta",
    time: "14h00",
    title: "Deep dive aos projetos",
    points: [
      "Avisos à navegação do Team Leader.",
      "Revisão a fundo dos projetos de 3 dos 6 consultores, à vez: status, roadmap, pending reviews e atrasos, o que está bloqueado.",
      "Os colegas dão feedback construtivo e entreajudam-se.",
    ],
  },
  {
    day: "Sexta",
    time: "15h30",
    title: "Fecho da semana",
    points: [
      "Avisos à navegação do Team Leader.",
      "20 minutos «9ams»: bloqueios, dúvidas e problemas.",
      "Todos enviam pelo menos uma call da semana ao Team Leader.",
    ],
  },
];

const WRITING_RULES: Array<{ n: number; term: string; detail: ReactNode }> = [
  {
    n: 1,
    term: "Contexto total",
    detail: "Escreve como se a pessoa não soubesse nada: o cliente, o que se passa, o que já tentaste e os links.",
  },
  {
    n: 2,
    term: "Listas e frases curtas",
    detail: "Bullets e parágrafos curtos, com o essencial a negrito. Nunca um bloco de texto.",
  },
  {
    n: 3,
    term: "Sem áudios",
    detail: (
      <>
        Tudo por escrito, para se poder procurar e reler. É um{" "}
        <Link href="/documentacao/protocolos-proibidos" className="text-[#c4a6ff] underline-offset-4 hover:underline">
          Protocolo Proibido
        </Link>
        . Quando o cliente manda um áudio, resume-se o pedido por escrito.
      </>
    ),
  },
  {
    n: 4,
    term: "@ quem tem de agir",
    detail: "Sempre que alguém tem de fazer alguma coisa, @nome. Sem menção, ninguém sabe que é com ele.",
  },
  {
    n: 5,
    term: "✅ confirma",
    detail: (
      <>
        Uma reação ✅ diz que leste ou que ficou feito. Dispensa o «ok» e o «obrigado», e{" "}
        <Strong>ninguém leva a mal que não os escrevas</Strong>.
      </>
    ),
  },
];

function MonoBlock({ children }: { children: string }) {
  return (
    <pre className="whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-white/[0.03] p-5 font-mono text-[12.5px] leading-relaxed text-white/75">
      {children}
    </pre>
  );
}

function Compare({
  before,
  beforeNote,
  after,
  afterNote,
}: {
  before: string;
  beforeNote: ReactNode;
  after: string;
  afterNote: ReactNode;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <p className="text-[12.5px] font-medium text-white/45">Como chega hoje</p>
        <p className="mt-2 text-[15px] font-medium text-white/85">{before}</p>
        <div className="mt-3 text-[13.5px] leading-relaxed text-white/55">{beforeNote}</div>
      </div>
      <div className="rounded-2xl border border-[#783DF5]/35 bg-[#783DF5]/[0.07] p-5">
        <p className="text-[12.5px] font-medium text-[#c4a6ff]">Como deve chegar</p>
        <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed text-white/80">{after}</pre>
        <div className="mt-3 text-[13.5px] leading-relaxed text-white/60">{afterNote}</div>
      </div>
    </div>
  );
}

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
            Onde, quando e como o SEO DPT comunica, entre colegas e com a direção. Menos interrupções, respostas a horas certas e
            consultores que <Strong>chegam com a decisão pensada</Strong>.
          </>
        }
        meta={`Atualizado a ${formatDate(block.updatedAt)}. Em revisão: só os SuperAdmins veem esta página.`}
      />

      <SectionNav items={NAV} />

      <div className="mt-8 space-y-14 pb-10">
        <DocSection id="objetivo" title="Objetivo" lead="Toda a gente sabe onde, quando e como se comunica, sem interromper o trabalho de ninguém.">
          {/* A regra que não falha — em destaque logo no início (estrutura base
              de um SOP). O André pediu que ficasse realçada. */}
          <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] px-6 py-6 sm:px-8">
            <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: "var(--brand-gradient)" }} />
            <p className="text-[13px] font-medium text-[#c4a6ff]">A regra que não falha</p>
            <p className="mt-2 text-[1.35rem] font-semibold leading-snug tracking-[-0.01em] text-white sm:text-[1.55rem]">
              Nenhum pedido à direção chega sem a tua sugestão de solução.
            </p>
            <p className="mt-3 max-w-3xl text-[14.5px] leading-relaxed text-white/65">
              A direção pede-a sempre. Não há perguntas, dúvidas ou pedidos sem a proposta do consultor: é assim que se ganha
              capacidade de decisão. Pensas no problema, escolhes um caminho e a direção só valida.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { t: "Ganha a equipa", d: "Menos interrupções, mais tempo de foco e respostas com prazo conhecido." },
              { t: "Ganha a direção", d: "Deixa de ser o arquivo da empresa e decide em segundos, com tudo escrito." },
              { t: "Ganha o cliente", d: "Menos erros e decisões mais rápidas nos projetos." },
            ].map((x) => (
              <div key={x.t} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                <p className="text-[15px] font-semibold text-white">{x.t}</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/60">{x.d}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-5">
            <p className="text-[2.6rem] font-semibold leading-none tracking-[-0.03em] text-white">
              23<span className="ml-1 text-[1.1rem] font-medium text-white/55">min</span>
            </p>
            <p className="max-w-xl text-[14px] leading-relaxed text-white/60">
              É o tempo médio que quem é interrompido demora a voltar ao que estava a fazer. Cada pergunta solta custa isto a
              alguém.
            </p>
          </div>

          <Rows
            rows={[
              {
                term: "Aplica-se a",
                detail: "O SEO DPT: a comunidade de WhatsApp e o Slack, quando se fala com os outros departamentos.",
              },
              {
                term: "Não cobre",
                detail: (
                  <>
                    A comunicação com os clientes (call mensal, Weekly Report, Monthly Report), que está nos{" "}
                    <Link href="/documentacao/protocolos-obrigatorios" className="text-[#c4a6ff] underline-offset-4 hover:underline">
                      Protocolos Obrigatórios
                    </Link>
                    .
                  </>
                ),
              },
              {
                term: "Se não se cumpre",
                tone: "amber",
                detail: (
                  <>
                    Falhar uma regra deste SOP conta como{" "}
                    <Link href="/documentacao/ineficacias" className="text-[#c4a6ff] underline-offset-4 hover:underline">
                      ineficácia
                    </Link>{" "}
                    («Processo não seguido») desde o dia em que é publicado à equipa.
                  </>
                ),
              },
            ]}
          />
        </DocSection>

        <DocSection id="onde-esta" title="Onde está tudo" lead="As ferramentas deste SOP, num só sítio.">
          <Rows
            rows={[
              { term: "WhatsApp", detail: "A comunidade WonderAds SEO DPT: Announcements e os quatro grupos da equipa." },
              { term: "Slack", detail: "Um canal por cliente, partilhado pelos departamentos que trabalham com ele." },
              { term: "Google Meet", detail: "As reuniões da semana e os bloqueios. Grava-se com o Google Workspace." },
              { term: "Google Calendar", detail: "Qualquer reunião marcada, com convite." },
              { term: "Fathom", detail: "As gravações das calls com clientes, que a reunião de segunda revê." },
              { term: "Loom", detail: "Vídeos do ecrã para mostrar um processo ou um problema." },
              {
                term: "Documentação",
                detail: (
                  <>
                    As regras escritas da casa:{" "}
                    <Link href="/documentacao/protocolos-obrigatorios" className="text-[#c4a6ff] underline-offset-4 hover:underline">
                      Protocolos
                    </Link>
                    ,{" "}
                    <Link href="/documentacao/ineficacias" className="text-[#c4a6ff] underline-offset-4 hover:underline">
                      Ineficácias
                    </Link>
                    ,{" "}
                    <Link href="/documentacao/jornada-cliente" className="text-[#c4a6ff] underline-offset-4 hover:underline">
                      Jornada de Cliente
                    </Link>
                    . As decisões que mudam a forma de trabalhar ficam escritas na página a que dizem respeito, com aviso no
                    sino.
                  </>
                ),
              },
            ]}
          />
        </DocSection>

        <DocSection id="canais" title="Canais e formatos" lead="Mensagem escrita primeiro. Reunião em último recurso.">
          <div>
            <SubHeading aside="tempo de resposta">Os formatos</SubHeading>
            <div className="mt-3">
              <Rows
                rows={[
                  {
                    term: "Mensagem escrita",
                    detail: "O normal, para tudo o que não te bloqueia. Fica escrito e não interrompe ninguém.",
                    value: "Fim do dia útil",
                  },
                  {
                    term: "Loom",
                    detail: "Quando é preciso mostrar um ecrã, um processo ou um problema visual. O link vai no grupo certo, com contexto escrito.",
                    value: "48h úteis",
                  },
                  {
                    term: "Link do Google Meet",
                    tone: "accent",
                    detail: "Estás parado e não consegues avançar sozinho. Mandas o link a quem te pode desbloquear.",
                    value: "Na hora",
                  },
                  {
                    term: "Reunião",
                    detail: "Um debate ou uma decisão com impacto. Marcada no Google Calendar, com convite.",
                    value: "Marcada",
                  },
                ]}
              />
            </div>
            <p className="mt-4 text-[14px] text-white/55">
              O teste: <Strong>se cabe numa mensagem escrita com contexto, não é reunião.</Strong>
            </p>
          </div>

          <div>
            <SubHeading aside="WhatsApp">A comunidade WonderAds SEO DPT</SubHeading>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CHANNELS.map((c) => (
                <li key={c.name} className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-[20px]">
                      {c.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-white">{c.name}</p>
                      <p className="text-[12.5px] text-white/45">{c.who}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-white/65">{c.what}</p>
                  {c.time && <p className="mt-auto pt-3 text-[12.5px] font-medium text-[#c4a6ff]">{c.time}</p>}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <SubHeading aside="com os outros departamentos">Slack</SubHeading>
              <div className="mt-3">
                <Bullets
                  items={[
                    "Um canal por cliente, partilhado pelos departamentos que trabalham com ele (SEO, ADS, Web, Comercial).",
                    <>
                      Um pedido a outro departamento vai para o canal do cliente, com <Strong>@ de quem age</Strong> e em{" "}
                      <Strong>ODE</Strong>.
                    </>,
                    "As mesmas regras de escrita e o mesmo tempo de resposta: até ao fim do dia útil.",
                  ]}
                />
              </div>
            </div>
            <div>
              <SubHeading>Mensagens privadas</SubHeading>
              <div className="mt-3">
                <Bullets
                  items={[
                    "Só para o que é pessoal ou sensível: feedback individual, salários, saúde, férias.",
                    "O trabalho vai sempre para o grupo certo, mesmo que seja para uma só pessoa (com @). Assim a resposta serve a todos.",
                    <Strong key="duvida">Na dúvida, vai para o grupo.</Strong>,
                  ]}
                />
              </div>
            </div>
          </div>
        </DocSection>

        <DocSection id="momentos" title="Momentos e horários" lead="Os momentos fixos da semana e do dia.">
          <div>
            <SubHeading aside="Google Meet, gravado com o Google Workspace">A semana</SubHeading>
            <ol className="mt-4 grid gap-3 md:grid-cols-3">
              {WEEK.map((w) => (
                <li key={w.day} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="text-[17px] font-semibold text-white">{w.day}</span>
                    <span className="text-[15px] font-semibold tabular-nums text-[#c4a6ff]">{w.time}</span>
                  </p>
                  <p className="mt-0.5 text-[13px] text-white/50">{w.title}</p>
                  <div className="mt-4">
                    <Bullets items={w.points} />
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Note title="✋ Levantar a mão">
                Para perguntar a meio da fala de um colega, usa sempre «Levantar a mão» no Meet.
              </Note>
              <Note title="Team Leader">
                Enquanto o SEO DPT não tiver Team Leader, os avisos à navegação e as calls da semana são com o COO.
              </Note>
            </div>
          </div>

          <div>
            <SubHeading>O dia</SubHeading>
            <div className="mt-3">
              <Rows
                rows={[
                  {
                    term: "Daily Update",
                    detail: "No 📊 Daily Updates, todos os dias, até ao fim do teu dia de trabalho.",
                    value: "Fim do teu dia",
                  },
                  {
                    term: "Sem janelas de envio",
                    detail: "Escreve quando precisares. O que tem prazo é a resposta, não o envio.",
                  },
                  {
                    term: "Fora de horas e fins de semana",
                    detail: "Pode-se enviar, mas ninguém tem de ler nem responder até ao dia útil seguinte. Só as urgências interrompem.",
                  },
                ]}
              />
            </div>
          </div>

          <div>
            <SubHeading aside="o formato que o estúdio de Weekly Reports lê">O Daily Update</SubHeading>
            <div className="mt-4 grid gap-6 md:grid-cols-[1fr_1.2fr]">
              <Bullets
                items={[
                  "Cabeçalho com o teu nome e a data.",
                  <>
                    Um bloco por cliente: <Strong>o nome do cliente seguido de dois pontos</Strong> e, por baixo, um bullet por
                    tarefa feita.
                  </>,
                  <>
                    No fim, <Strong>«Por fazer (e porquê):»</Strong> os pedidos do 📥 Pedidos à Equipa que não ficaram feitos,
                    porquê, e para quando estão programados.
                  </>,
                  "O «Por fazer» fica para a equipa: não entra nos Weekly Reports dos clientes.",
                ]}
              />
              <MonoBlock>{DAILY_EXAMPLE}</MonoBlock>
            </div>
          </div>

          <Note tone="warn" title="Urgências: o que pode interromper a direção na hora">
            Só duas coisas, a qualquer hora: <Strong>um cliente a ponto de sair</Strong> (zangado, com uma reclamação séria ou a
            ameaçar cancelar) e <Strong>dados, acessos ou pagamentos</Strong> (acessos perdidos, fuga de dados, problema de
            faturação). Liga, ou manda um link do Meet, ao André ou ao Alex. Tudo o resto segue o tempo de resposta normal; se
            estás bloqueado, manda o link do Meet a quem te pode desbloquear.
          </Note>
        </DocSection>

        <DocSection id="escrita" title="Regras de escrita" lead="Cinco regras para qualquer mensagem, no WhatsApp e no Slack.">
          <ol className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
            {WRITING_RULES.map((r) => (
              <li key={r.n} className="grid gap-x-5 gap-y-1 py-4 sm:grid-cols-[2.25rem_minmax(10rem,13rem)_1fr] sm:items-baseline">
                <span className="text-[1.35rem] font-semibold tabular-nums text-[#c4a6ff]">{r.n}</span>
                <span className="text-[15px] font-semibold text-white">{r.term}</span>
                <span className="text-[14px] leading-relaxed text-white/60">{r.detail}</span>
              </li>
            ))}
          </ol>

          <div>
            <SubHeading aside="obrigatório em todos os pedidos">ODE: Objetivo, Data, Estrutura</SubHeading>
            <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-white/60">
              Em todos os pedidos do 📥 Pedidos à Equipa e nos pedidos entre colegas ou a outros departamentos, no Slack. Vale
              nos dois sentidos: a direção usa-o quando pede, a equipa usa-o quando pede.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { l: "O", t: "Objetivo", d: "O porquê do pedido. Quem recebe percebe para que serve." },
                { l: "D", t: "Data", d: "Dia e hora. Sem data, o pedido não tem prazo." },
                { l: "E", t: "Estrutura", d: "O que esperas receber e em que formato: uma lista, um documento, uma decisão." },
              ].map((x) => (
                <div key={x.l} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                  <p className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-[16px] font-bold text-white"
                      style={{ background: "var(--brand-gradient)" }}
                    >
                      {x.l}
                    </span>
                    <span className="text-[15px] font-semibold text-white">{x.t}</span>
                  </p>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-white/60">{x.d}</p>
                </div>
              ))}
            </div>
          </div>

          <Compare
            before="«Faz um artigo para a Clínica X.»"
            beforeNote="Para quê? Até quando? Em que formato? Quem recebe tem de perguntar três vezes, ou adivinha."
            after={[
              "Objetivo: ganhar posições em «implantes dentários Lisboa», onde a Clínica X está na 2.ª página.",
              "Data: quinta, 20/11, até às 17h.",
              "Estrutura: o artigo num Google Doc, com H1 e H2, meta title, meta description e 3 links internos. O link aqui no grupo.",
            ].join("\n")}
            afterNote="Quem recebe sabe o que fazer, para quando e como entregar. Confirma com ✅."
          />
        </DocSection>

        <DocSection id="pedidos" title="Pedidos à direção" lead="Pedir bem é chegar com o trabalho pensado.">
          <div>
            <SubHeading>Antes de pedir</SubHeading>
            <div className="mt-5">
              <StageFlow
                stages={[
                  {
                    title: "Procura",
                    body: "Na Documentação, na Formação, num Loom ou no histórico do grupo. A resposta pode já existir.",
                  },
                  {
                    title: "Pergunta a um colega",
                    body: "No 💬 WonderAds SEO DPT. Se alguém já resolveu isto, não precisa da direção.",
                  },
                  {
                    title: "Prepara a proposta",
                    body: "Cinco minutos para juntar o contexto, as opções e a tua recomendação. Só então, 🔍 Pedidos à Direção.",
                  },
                ]}
              />
            </div>
          </div>

          <div>
            <SubHeading aside="fixado no 🔍 Pedidos à Direção e na descrição do grupo">O template</SubHeading>
            <div className="mt-4 grid gap-6 md:grid-cols-[1.2fr_1fr]">
              <div>
                <MonoBlock>{REQUEST_TEMPLATE}</MonoBlock>
                <div className="mt-3">
                  <CopyTextButton text={REQUEST_TEMPLATE} label="Copiar o template" />
                </div>
              </div>
              <Rows
                rows={[
                  { term: "Validar", tone: "accent", detail: "Preciso de uma decisão." },
                  { term: "Debater", tone: "accent", detail: "Preciso de discutir as opções." },
                  { term: "Informar", tone: "accent", detail: "Não preciso de resposta. Um ✅ basta." },
                ]}
              />
            </div>
          </div>

          <Compare
            before="«A Clínica X não aprovou os artigos do mês. O que faço?»"
            beforeNote="A direção tem de perguntar desde quando, o que já foi dito ao cliente e o que se pode fazer. E acaba a decidir por ti: da próxima vez é igual."
            after={REQUEST_EXAMPLE}
            afterNote="Lê-se em 30 segundos. A resposta é «sim» ou «não, faz assim», e a decisão fica escrita."
          />

          <Rows
            rows={[
              { term: "Quem responde", detail: "O André ou o Alex." },
              { term: "Quando", detail: "Até ao fim do dia útil.", value: "Fim do dia útil" },
              {
                term: "Pedido sem proposta",
                tone: "amber",
                detail: "A direção devolve-o e pede a tua sugestão. Conta como ineficácia («Processo não seguido»).",
              },
            ]}
          />
        </DocSection>

        <DocSection id="consulta" title="Consulta rápida" lead="Para cada situação, onde e em quanto tempo.">
          <Rows
            rows={[
              { term: "Tenho uma dúvida de trabalho", detail: "Pergunta a um colega no 💬 WonderAds SEO DPT.", value: "Fim do dia útil" },
              {
                term: "Preciso de uma aprovação, revisão ou decisão",
                detail: "🔍 Pedidos à Direção, com o template e a tua proposta.",
                value: "Fim do dia útil",
              },
              { term: "Estou bloqueado", detail: "Link do Google Meet a quem te pode desbloquear.", value: "Na hora" },
              { term: "Tenho de mostrar um ecrã", detail: "Um Loom, no grupo certo, com contexto escrito.", value: "48h úteis" },
              {
                term: "Peço algo a outro departamento",
                detail: "No canal do cliente no Slack, com @ e em ODE.",
                value: "Fim do dia útil",
              },
              {
                term: "Cliente a ponto de sair; dados, acessos ou pagamentos",
                tone: "amber",
                detail: "Chamada ou link do Meet ao André ou ao Alex, a qualquer hora.",
                value: "Na hora",
              },
              { term: "O que fiz hoje", detail: "📊 Daily Updates, com o «Por fazer» no fim.", value: "Fim do teu dia" },
              { term: "Um assunto pessoal ou sensível", detail: "Mensagem privada." },
              { term: "Um aviso da direção", detail: "📢 Announcements. Não se responde lá." },
            ]}
          />
        </DocSection>

        <DocSection id="versoes" title="Histórico de versões">
          <Rows
            rows={[
              {
                term: "v1 · 19/11/2026",
                detail:
                  "Primeira versão, a partir da sessão Road to CEO da Scale Labs (16/11/2026), adaptada à WonderAds. Em revisão pela direção.",
                value: "André Pavlenco",
              },
            ]}
          />
        </DocSection>

        <ExecutiveSummary
          updatedAt={block.updatedAt}
          title="O SOP de Comunicação, por extenso"
          paragraphs={[
            <>
              O SOP de Comunicação define onde, quando e como o SEO DPT comunica, entre colegas e com a direção. Existe porque
              cada interrupção custa, em média, 23 minutos a quem a recebe, e porque uma equipa que pergunta tudo nunca aprende a
              decidir. A regra que não falha é esta: nenhum pedido à direção chega sem a sugestão de solução do consultor. A
              direção pede-a sempre, e é assim que cada consultor ganha capacidade de decisão.
            </>,
            <>
              A comunicação interna faz-se por escrito, na comunidade de WhatsApp WonderAds SEO DPT. No Announcements só a
              direção escreve: avisos, mudanças e regras novas. O grupo WonderAds SEO DPT é para as dúvidas entre colegas, as
              partilhas e a preparação das reuniões. O Pedidos à Direção leva as aprovações, revisões e decisões, sempre com o
              template e uma proposta, e tem resposta do André ou do Alex até ao fim do dia útil. O Pedidos à Equipa leva os
              entregáveis que a direção pede, sempre em ODE (objetivo, data e estrutura), e quem recebe confirma com ✅. O Daily
              Updates recebe, até ao fim do dia de cada um, o que se fez por cliente e o que ficou por fazer. Com os outros
              departamentos fala-se no Slack, num canal por cliente, com as mesmas regras. As mensagens privadas ficam para o
              que é pessoal ou sensível.
            </>,
            <>
              A mensagem escrita é o formato normal. Um Loom serve para mostrar um ecrã e tem resposta em até 48 horas úteis.
              Um link do Google Meet serve para quem está bloqueado e tem resposta na hora. A reunião é o último recurso e
              marca-se no Google Calendar. Há três momentos fixos por semana, no Meet: à segunda às 15h30, com os bloqueios e a
              revisão de uma call de um colega gravada no Fathom; à quarta às 14h, com o deep dive aos projetos de três
              consultores; e à sexta às 15h30, com o fecho da semana e uma call de cada um enviada ao Team Leader. Não há
              janelas de envio: escreve-se quando é preciso, e o que tem prazo é a resposta. Fora de horas pode-se enviar, mas
              ninguém tem de responder até ao dia útil seguinte. Só duas coisas interrompem a direção na hora: um cliente a
              ponto de sair, e dados, acessos ou pagamentos.
            </>,
            <>
              Cada mensagem segue cinco regras: contexto total, listas e frases curtas, nada de áudios, @ de quem tem de agir e
              ✅ para confirmar, sem «ok» nem «obrigado», que ninguém leva a mal. Antes de pedir ajuda, procura-se a resposta,
              pergunta-se a um colega e prepara-se a proposta. O pedido à direção tem cinco partes: o tipo (validar, debater ou
              informar), o contexto, duas opções, a recomendação com o risco e o prazo. Falhar uma regra deste SOP conta como
              ineficácia, «Processo não seguido», desde o dia em que é publicado à equipa.
            </>,
          ]}
        />
      </div>
    </PageShell>
  );
}
