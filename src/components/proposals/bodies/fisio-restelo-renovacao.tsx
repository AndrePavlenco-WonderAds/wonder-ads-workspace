// Proposta de Renovação — Fisio Restelo · Setembro 2026 – Fevereiro 2027.
//
// FONTES: «Fisiorestelo_Resultados_6_meses_atualizado.pdf» (resultados
// fev–ago 2026) e «Fisiorestelo_Roadmap_6_meses.pdf» (roadmap set 2026 –
// fev 2027), preparados pela WonderAds em agosto de 2026. Todos os números
// vêm desses documentos. Estrutura da proposta original aceite em janeiro
// (plano → incluído → plataforma → importância), com resultados e roadmap
// à frente — numa renovação, o argumento é o trabalho feito.
//
// v76.94: revisão do André — texto de ligação cortado (a página lê-se pelos
// números e pelos visuais), resultados com gráficos e contadores, frentes
// de trabalho numa escada de posições, plano mês a mês em acordeão, metas
// num quadro por tema, CRM e plano único de 4.500 € redesenhados, garantia
// e plano avançado fora, e o fecho com «Confirmar a renovação» a notificar
// o André (email + sino da app).

import type { ReactNode } from "react";
import {
  BarChart3,
  Bot,
  Crosshair,
  GraduationCap,
  Inbox,
  Link2,
  MessageSquareHeart,
  PhoneCall,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  Bullets,
  Callout,
  CheckList,
  DataTable,
  GoalCard,
  GradientText,
  Pill,
  Section,
  StatGrid,
  SubTitle,
  BRAND_GRADIENT,
} from "../proposal-primitives";
import { CountUp, Reveal } from "../proposal-motion";
import { GrowthBar, MonthlyGrowthChart, PositionLadder } from "../charts";
import { MonthTimeline } from "../month-timeline";
import { KpiBoard } from "../kpi-board";
import { ConfirmRenewal } from "../confirm-renewal";
import type { ProposalBodyProps, ProposalRender } from "./types";

const PLAN_PRICE = "4.500 €";
const CRM_VALUE = "1.200 €";
const PERIOD = "setembro 2026 – fevereiro 2027";
const ANDRE_EMAIL = "andre@wonder-ads.com";

const MONTHS = [
  { label: "Fev", clicks: 28, impressions: 821 },
  { label: "Mar", clicks: 126, impressions: 3907 },
  { label: "Abr", clicks: 148, impressions: 4145 },
  { label: "Mai", clicks: 157, impressions: 4224 },
  { label: "Jun", clicks: 181, impressions: 5921 },
  { label: "Jul", clicks: 262, impressions: 8827 },
];

function HeroTile({
  Icon,
  color,
  value,
  label,
  sub,
  delta,
  delay = 0,
}: {
  Icon: LucideIcon;
  color: string;
  value: ReactNode;
  label: string;
  sub: string;
  delta?: string;
  delay?: number;
}) {
  return (
    <Reveal delay={delay}>
      <div className="relative overflow-hidden rounded-2xl border border-black/8 bg-white p-5">
        <div aria-hidden className="absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-[0.12] blur-2xl" style={{ background: color }} />
        <div className="flex items-center justify-between">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: color }}>
            <Icon className="h-4.5 w-4.5" />
          </span>
          {delta && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">{delta}</span>
          )}
        </div>
        <div className="mt-4 text-[2.1rem] font-bold leading-none tracking-tight text-black/90">{value}</div>
        <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/55">{label}</div>
        <div className="mt-1 text-[12px] text-black/50">{sub}</div>
      </div>
    </Reveal>
  );
}

function SmallTile({
  from,
  to,
  label,
  sub,
  delay = 0,
}: {
  from: number;
  to: number;
  label: string;
  sub: string;
  delay?: number;
}) {
  return (
    <Reveal delay={delay}>
      <div className="rounded-2xl border border-black/8 bg-white p-4">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-medium text-black/45 line-through decoration-black/30">{from}</span>
          <span className="text-black/30">→</span>
          <span className="text-2xl font-bold tracking-tight text-black/90">
            <CountUp to={to} from={from} />
          </span>
        </div>
        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/55">{label}</div>
        <GrowthBar from={from} to={to} />
        <div className="mt-1.5 text-[12px] text-black/50">{sub}</div>
      </div>
    </Reveal>
  );
}

function CrmFeature({ Icon, title, text }: { Icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-black/8 bg-white p-4">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: BRAND_GRADIENT }}>
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-[14px] font-semibold text-black/85">{title}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-black/60">{text}</p>
      </div>
    </div>
  );
}

function Body({ consultantName, consultantEmail }: ProposalBodyProps) {
  return (
    <>
      {/* ============ 1. RESULTADOS ============ */}
      <Section
        id="resultados"
        eyebrow="Resultados · Fevereiro a agosto de 2026"
        title="1. Os primeiros 6 meses em números"
        lead="Em seis meses, a Fisio Restelo passou de uma presença digital residual para um canal de captação ativo. O tráfego orgânico cresceu de 28 para 262 cliques mensais e esse crescimento já se traduz em ações concretas de potenciais pacientes: chamadas, pedidos de direções e formulários de marcação."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <HeroTile Icon={TrendingUp} color="#783DF5" value={<CountUp to={9} prefix="+" suffix="x" />} label="tráfego orgânico mensal" sub="28 → 262 cliques/mês (fev → jul)" delta="+836%" />
          <HeroTile Icon={BarChart3} color="#343ED7" value={<CountUp to={1056} />} label="cliques na Pesquisa Google" sub="últimos 6 meses · 33.410 impressões" delay={80} />
          <HeroTile Icon={Crosshair} color="#C535C9" value={<CountUp to={112} />} label="palavras-chave orgânicas" sub="eram 65 · Semrush, 24/08/2026" delta="+72%" delay={160} />
        </div>

        <div className="mt-4">
          <Reveal>
            <MonthlyGrowthChart months={MONTHS} />
          </Reveal>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SmallTile from={396} to={944} label="visitas/mês estimadas" sub="+138% · Semrush" />
          <SmallTile from={13} to={302} label="valor em mídia paga substituído ($/mês)" sub="de 13 $ em fevereiro para 302 $ em julho" delay={80} />
          <SmallTile from={63} to={86} label="palavras-chave na watchlist" sub="+36,5% · acompanhadas de perto · 57 domínios de referência, 119 backlinks" delay={160} />
        </div>

        <details className="mt-4 rounded-2xl border border-black/8 bg-white/70 px-5 py-3 text-[13px] text-black/65">
          <summary className="cursor-pointer text-[13px] font-semibold text-black/75">Ver os números mês a mês (tabela)</summary>
          <DataTable
            head={["Mês", "Cliques", "Impressões"]}
            numeric={[1, 2]}
            lastRowBold
            rows={[
              ["Fevereiro", "28", "821"],
              ["Março", "126", "3.907"],
              ["Abril", "148", "4.145"],
              ["Maio", "157", "4.224"],
              ["Junho", "181", "5.921"],
              ["Julho", "262", "8.827"],
              ["Total (fev–jul, meses completos)", "903", "28.036"],
            ]}
            note="Na janela dos últimos 6 meses fechada a 24 de agosto, o total é de 1.056 cliques e 33.410 impressões; agosto ainda estava em curso, pelo que a tabela usa só meses completos."
          />
        </details>

        <Bullets
          items={[
            <>Crescimento contínuo nos seis meses, <strong>sem uma única queda</strong> — padrão de trabalho, não pico isolado.</>,
            <>De 65 para 112 palavras-chave a gerar tráfego: uma <strong>base de posicionamento que mais do que dobrou</strong>, não duas ou três palavras-chave.</>,
            <>Authority Score estável em <strong>10</strong> — o indicador que o próximo ciclo trabalha, agora que a base de conteúdo existe.</>,
          ]}
        />
      </Section>

      {/* ============ 2. DO TRÁFEGO AO PACIENTE ============ */}
      <Section id="paciente" eyebrow="Conversão · O que acontece depois do clique" title="2. Do tráfego ao paciente">
        <div className="grid gap-4 lg:grid-cols-2">
          <DataTable
            caption="Perfil da clínica no Google · março a julho"
            head={["Ação no perfil Google", "Total no período"]}
            numeric={[1]}
            lastRowBold
            rows={[
              ["Pedidos de direções para a clínica", "714"],
              ["Chamadas telefónicas", "299"],
              ["Cliques para o site", "357"],
              ["Cliques em conversa/chat", "29"],
              ["Total de interações", "1.399"],
            ]}
          />
          <DataTable
            caption="Comportamento no site · final de abril a 3 de agosto"
            head={["Indicador", "Valor"]}
            numeric={[1]}
            rows={[
              ["Sessões totais", "1.675"],
              ["Sessões vindas de pesquisa orgânica", "946 (56%)"],
              ["Novos visitantes", "1.202"],
              ["Formulários iniciados", "59"],
              ["Formulários submetidos", "57"],
              ["Utilizadores ativos por semana (início → fim)", "79 → 130"],
            ]}
          />
        </div>
        <Callout tone="green" title="97% de quem começa o formulário conclui-o">
          Foram iniciados 59 formulários e submetidos 57. O formulário não é um obstáculo — quem chega com intenção, avança. O trabalho a fazer está a montante: levar mais pessoas certas até à página de marcação.
        </Callout>

        <p className="mb-2 mt-8 text-[11px] font-semibold uppercase tracking-[0.14em] text-black/50">Posições fortes já conquistadas</p>
        <div className="mb-2 flex flex-wrap gap-2">
          {[
            ["fisioterapeuta perto de mim", "#1"],
            ["marta gameiro", "#1"],
            ["fisioterapeuta ombro", "#1"],
            ["pilates restelo", "#3"],
            ["fisioterapia belem", "#4"],
          ].map(([k, p]) => (
            <span key={k} className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1 text-[12.5px] text-black/75">
              {k}
              <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: BRAND_GRADIENT }}>
                {p}
              </span>
            </span>
          ))}
        </div>

        <SubTitle>Presença em assistentes de inteligência artificial</SubTitle>
        <StatGrid
          cols={3}
          items={[
            { value: "34%", label: "menção em respostas de IA", sub: "Searchable, julho · 10 prompts não-branded" },
            { value: "68%", label: "pico — tratamento conservador da escoliose", sub: "o tema com maior tração em IA" },
            { value: "14", label: "AI Visibility (Semrush, 24/08)", sub: "4 menções · 5 páginas citadas · ChatGPT, Gemini, Google AI Mode" },
          ]}
        />
        <DataTable
          caption="Pesquisas em forma de pergunta onde a Fisio Restelo já aparece"
          head={["Pergunta", "Impressões", "Posição"]}
          numeric={[1, 2]}
          rows={[
            ["quais são as referências em lisboa no tratamento conservador da escoliose?", "58", "6,9"],
            ["que clínicas em lisboa utilizam tecnologia 3d para avaliação postural ou da coluna?", "58", "3,5"],
            ["que profissionais em lisboa têm maior especialização em escoliose e coluna?", "57", "6,7"],
            ["quais são as clínicas mais especializadas em escoliose em lisboa?", "52", "8,5"],
          ]}
          note="Search Console, últimos 6 meses até 24/08/2026. Neste tipo de pesquisa a resposta é dada pelo assistente e a fonte é citada, não clicada."
        />

        <SubTitle>Onde está a maior oportunidade</SubTitle>
        <DataTable
          caption="Distribuição por página · últimos 6 meses"
          head={["Página", "Impressões", "Cliques", "CTR", "Posição"]}
          numeric={[1, 2, 3, 4]}
          highlightRows={[1]}
          rows={[
            ["Página inicial", "14.629", "557", "3,81%", "8,5"],
            ["Pilates Clínico", "9.216", "70", "0,76%", "11,5"],
            ["Quem Somos", "3.681", "36", "0,98%", "4,4"],
            ["A Equipa", "3.064", "88", "2,87%", "4,0"],
            ["Fisioterapia", "2.859", "37", "1,29%", "3,6"],
            ["Serviços de Saúde e Bem-Estar", "2.823", "61", "2,16%", "9,2"],
            ["Contactos", "2.720", "42", "1,54%", "3,9"],
            ["Marcações", "2.526", "34", "1,35%", "4,7"],
            ["Reeducação Postural Global", "2.406", "26", "1,08%", "11,1"],
          ]}
          note="Pilates Clínico: 9.216 impressões na posição 11,5 com 0,76% de cliques — na posição 4 com 4% de CTR seriam ~370 cliques em vez de 70, sem uma pesquisa nova."
        />
      </Section>

      {/* ============ 3. ROADMAP ============ */}
      <Section id="roadmap" eyebrow="Roadmap SEO e Visibilidade em IA · Setembro 2026 – Fevereiro 2027" title="3. O plano dos próximos 6 meses">
        <Reveal>
          <div className="avoid-break rounded-2xl p-[2px]" style={{ background: BRAND_GRADIENT }}>
            <div className="rounded-[15px] bg-white px-6 py-6 sm:px-8 sm:py-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5b21b6]">O compromisso deste roadmap</p>
              <p className="mt-3 text-xl font-semibold leading-snug tracking-tight text-black/88 sm:text-2xl">
                Em 6 meses, a Fisio Restelo é a primeira escolha do Google e dos assistentes de IA para quem procura fisioterapia especializada em Lisboa — e o relatório mensal passa a mostrar isso em pacientes marcados, não apenas em visitas.
              </p>
            </div>
          </div>
        </Reveal>

        <SubTitle>As quatro metas que resumem tudo</SubTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { n: "1", title: "Medição de contactos ativa", text: "Chamadas, WhatsApp e formulários medidos e reportados por canal de origem — o relatório passa a responder «quantos pacientes trouxe o SEO este mês»." },
            { n: "2", title: "Cliques não-branded a multiplicar por 5", text: "De ~15–20 para 90–120 cliques/mês em pesquisas de serviço — a procura de quem ainda não conhece a Fisio Restelo." },
            { n: "3", title: "Pilates Clínico e RPG no top 5", text: "As duas maiores bolsas de procura por converter do site (5.024 + 1.179 impressões) saem da posição 11–13 para a zona onde as pessoas clicam." },
            { n: "4", title: "Escoliose no Top 1–3", text: "Todas as palavras-chave do cluster de escoliose entre a 1.ª e a 3.ª posição do Google — o eixo que distingue a clínica e o que a IA mais cita.", accent: true },
          ].map((g, i) => (
            <Reveal key={g.n} delay={i * 70}>
              <GoalCard n={g.n} title={g.title} text={g.text} accent={g.accent} />
            </Reveal>
          ))}
        </div>

        <SubTitle>A procura já conquistada — onde está e onde vai estar</SubTitle>
        <PositionLadder
          rows={[
            { label: "Pilates clínico (todas as variantes)", impressions: 5024, current: 12.5, currentLabel: "~12–13", target: 5, targetLabel: "Top 5" },
            { label: "Reeducação postural global e RPG", impressions: 1179, current: 11, currentLabel: "~11", target: 5, targetLabel: "Top 5" },
            { label: "Escoliose e coluna (cluster)", impressions: 918, current: 8, currentLabel: "~7–9", target: 2, targetLabel: "Top 1–3", accent: true },
            { label: "Fisioterapia (termo genérico)", impressions: 728, current: 10.2, currentLabel: "10,2", target: 5, targetLabel: "Top 5" },
            { label: "Massagem terapêutica", impressions: 701, current: 10.8, currentLabel: "10,8", target: 8, targetLabel: "Top 8" },
            { label: "Fisioterapia perto de mim", impressions: 233, current: 10.5, currentLabel: "10,5", target: 5, targetLabel: "Top 5" },
          ]}
        />

        <SubTitle>Mês a mês</SubTitle>
        <MonthTimeline
          months={[
            {
              index: 1,
              month: "Setembro 2026",
              title: "Medir para provar",
              summary: "Entra-se no mês de maior procura do ano com a medição ligada, o CRM configurado e as duas páginas de maior potencial publicadas.",
              tags: ["Medição de contactos", "CRM configurado", "Pilates Clínico + RPG publicadas", "Escoliose adolescentes", "Baselines"],
              bullets: [
                "Ativação da medição de contactos: cliques no telefone, no WhatsApp e submissão de formulário, com atribuição de canal — e ligação ao CRM.",
                "Baselines formais documentadas: Search Console, Semrush (Authority Score 10, 112 palavras-chave, 57 domínios, AI Visibility 14), Searchable (34%) e perfil Google.",
                "Publicação das páginas de Pilates Clínico e Reeducação Postural Global, no padrão editorial e visual da página de Escoliose.",
                "O padrão de título e descrição do artigo Schroth (3,78% de CTR no 1.º mês) aplicado a todo o cluster de escoliose e às páginas de serviço.",
                "Conteúdo de escoliose em adolescentes publicado no início do mês, alinhado com o regresso às aulas e os rastreios escolares.",
                "Consolidação técnica: páginas herdadas do site antigo e páginas duplicadas resolvidas.",
              ],
            },
            {
              index: 2,
              month: "Outubro 2026",
              title: "Converter a procura que já existe",
              summary: "As pesquisas entre as posições 8 e 20 sobem; entram a página de zona e a de acordos; o perfil Google passa a aceitar marcações.",
              tags: ["Striking distance 8–20", "Página de zona", "Acordos e comparticipações", "Marcação direta no Google", "Fluxo de reviews"],
              bullets: [
                "Striking distance: otimização das pesquisas entre as posições 8 e 20 com volume relevante — o trabalho de maior retorno por hora do ciclo.",
                "Página de zona (Belém · Restelo · Ajuda · Algés): «fisioterapia belem» já está na posição 4; «fisioterapia perto de mim» tem 233 impressões na 10,5.",
                "Página de acordos e comparticipações, com posicionamento de transparência — qualifica à entrada e poupa tempo ao telefone.",
                "Ativação da marcação direta no perfil Google e revisão completa do perfil (categorias, serviços, fotos, horários).",
                "Arranque do fluxo de reviews, disparado pelo CRM no acompanhamento pós-alta que a clínica já faz (3 semanas e 3 meses).",
              ],
            },
            {
              index: 3,
              month: "Novembro 2026",
              title: "Primeiro checkpoint",
              summary: "O primeiro relatório da conta com contactos por canal de origem — e o cluster de escoliose alargado.",
              tags: ["Relatório T1", "Contactos por canal", "AEO / citabilidade", "SEAS · adultos · lombar"],
              checkpoint: true,
              bullets: [
                "Relatório trimestral T1 contra as baselines de setembro — o primeiro relatório da conta a apresentar contactos por canal de origem.",
                "Checkpoint com decisão registada: se a trajetória dos cliques não-branded estiver abaixo do previsto, a realocação de esforço fica escrita no relatório.",
                "Otimização de citabilidade (AEO) nas páginas que já ranqueiam para perguntas em formato de prompt: resposta direta até 50 palavras, listas extraíveis, schema clínico com autoria.",
                "Alargamento do cluster de escoliose: método SEAS (hoje sem conteúdo), escoliose em adultos e escoliose lombar.",
              ],
            },
            {
              index: 4,
              month: "Dezembro 2026",
              title: "Autoridade clínica",
              summary: "Mês de menor procura, aproveitado para o trabalho de fundo: autoria, casos clínicos e domínios de referência.",
              tags: ["Conteúdo assinado", "Casos clínicos", "Domínios de referência", "Massagem + osteopatia"],
              bullets: [
                "Conteúdo assinado pelas fisioterapeutas — as páginas da equipa têm as melhores taxas de clique do site (Sandrina Lourenço 5,87%, Nídia Gonçalves 5,3%).",
                "Aquisição de domínios de referência de qualidade: associações profissionais, entidades ligadas à escoliose, publicações de saúde e a rede de médicos prescritores.",
                "Casos clínicos estruturados e testemunhos com resultados descritos — o formato mais citado pela IA e o mais persuasivo para quem decide.",
                "Segunda vaga de conversão: massagem terapêutica e osteopatia (mais de 700 impressões cada, posições 8 a 11).",
              ],
            },
            {
              index: 5,
              month: "Janeiro 2027",
              title: "Pico de procura",
              summary: "O pico anual de pilates e postura apanhado com tudo preparado em dezembro e ativado na primeira semana.",
              tags: ["Pico de pilates e postura", "2.ª vaga striking distance", "Iteração de prompts de IA", "Testemunhos"],
              bullets: [
                "Janeiro é o pico anual de pilates e postura: conteúdo, perfil Google e páginas de serviço preparados em dezembro e ativados na primeira semana.",
                "Segunda vaga de striking distance sobre as pesquisas que subiram para as posições 5 a 10 no primeiro trimestre.",
                "Iteração de prompts de IA com base na medição de novembro: conteúdo dirigido às perguntas onde a clínica ainda não é citada.",
                "Reforço do fluxo de reviews e publicação dos testemunhos recolhidos no trimestre.",
              ],
            },
            {
              index: 6,
              month: "Fevereiro 2027",
              title: "Fecho e ciclo seguinte",
              summary: "Relatório final em contactos e euros, com a série de meses do CRM — e o plano seguinte construído sobre resultados reais.",
              tags: ["Relatório final", "Contactos e euros", "Aniversário 3 de março", "Reabilitação desportiva"],
              checkpoint: true,
              bullets: [
                "Relatório final de 6 meses: todas as metas contra as baselines de setembro, com dados verificáveis de Search Console, Semrush, Searchable, CRM e medição de contactos.",
                "Preparação do calendário seguinte: aniversário da clínica a 3 de março e época da Páscoa.",
                "Plano do ciclo seguinte construído sobre resultados reais — com avaliação de expansão para reabilitação desportiva.",
              ],
            },
          ]}
        />

        <Callout title="Da visibilidade ao paciente — projeção prudente, com premissas explícitas">
          Hoje a clínica recebe cerca de 19 formulários e 50 chamadas por mês através do perfil Google. As metas deste roadmap acrescentam, no cenário prudente, <strong>20 a 30 contactos qualificados por mês</strong> até fevereiro. Com 30% a converter em primeira consulta e um valor de tempo de vida por paciente de 1.200 € (dado fornecido pela clínica no onboarding), isso equivale a <strong>6 a 9 novos pacientes por mês</strong> — 7.200 € a 10.800 € em valor acrescentado por mês de operação. São estimativas com premissas declaradas, não garantias; é precisamente por isso que a medição é a primeira ação do plano.
        </Callout>

        <SubTitle>Metas e indicadores — hoje → novembro → fevereiro</SubTitle>
        <KpiBoard
          groups={[
            {
              title: "Tráfego orgânico",
              Icon: TrendingUp,
              rows: [
                { label: "Cliques orgânicos / mês", baseline: "262", t1: "340–400", t2: "450–550" },
                { label: "Cliques não-branded / mês", baseline: "~15–20", t1: "45–60", t2: "90–120" },
                { label: "Impressões / mês", baseline: "8.827", t1: "11–13 mil", t2: "15–18 mil" },
              ],
            },
            {
              title: "Posições",
              Icon: Target,
              rows: [
                { label: "Escoliose e coluna — posição do cluster", baseline: "~7–9", t1: "Top 3–5", t2: "Top 1–3", accent: true },
                { label: "Pilates Clínico — posição", baseline: "11,5", t1: "6–8", t2: "3–5" },
                { label: "Pilates Clínico — taxa de clique", baseline: "0,76%", t1: "2,0–2,5%", t2: "3,5–4,5%" },
              ],
            },
            {
              title: "Autoridade do domínio",
              Icon: Link2,
              rows: [
                { label: "Palavras-chave orgânicas (Semrush)", baseline: "112", t1: "130–145", t2: "155–180" },
                { label: "Authority Score (Semrush)", baseline: "10", t1: "11–12", t2: "12–14" },
                { label: "Domínios de referência", baseline: "57", t1: "65–70", t2: "75–85" },
              ],
            },
            {
              title: "Visibilidade em IA",
              Icon: Bot,
              rows: [
                { label: "AI Visibility (Semrush)", baseline: "14", t1: "22–28", t2: "35–45" },
                { label: "Mention rate em IA (Searchable)", baseline: "34%", t1: "40–45%", t2: "50–60%" },
              ],
            },
            {
              title: "Contactos e pacientes",
              Icon: PhoneCall,
              rows: [
                { label: "Formulários submetidos / mês", baseline: "~19", t1: "26–32", t2: "38–48" },
                { label: "Chamadas via perfil Google / mês", baseline: "50", t1: "60–70", t2: "75–90" },
                { label: "Contactos atribuídos a canal (CRM)", baseline: "a ativar", t1: "1.º número", t2: "3 meses de série" },
                { label: "Avaliações novas no Google", baseline: "fluxo inativo", t1: "+10–15", t2: "+25–35" },
              ],
            },
          ]}
        />
        <p className="mt-3 text-[12px] leading-relaxed text-black/50">
          Baselines de agosto de 2026 (Search Console, Semrush em 24/08/2026, Searchable de julho, perfil Google). Medição mensal, reportada trimestralmente; as metas de Authority Score e domínios de referência são revistas no checkpoint de novembro.
        </p>
      </Section>

      {/* ============ 4. ESCOLIOSE ============ */}
      <Section
        id="escoliose"
        eyebrow="Foco prioritário · O eixo que distingue a Fisio Restelo"
        title={<>4. Escoliose: <GradientText>Top 1–3</GradientText> em todas as palavras-chave</>}
      >
        <StatGrid
          cols={3}
          items={[
            { value: "~7–9", label: "posição atual do cluster", sub: "918 impressões · Search Console" },
            { value: "3,78%", label: "CTR do artigo Schroth no 1.º mês", sub: "28 cliques · o padrão a replicar" },
            { value: "68%", label: "menção em IA · tratamento conservador", sub: "pico dos 10 prompts medidos (Searchable)" },
          ]}
        />
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-2xl border border-[#c4b5fd] bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5b21b6]">Palavras-chave do cluster a levar ao Top 1–3</p>
              <CheckList
                items={[
                  "escoliose lisboa · clínica de escoliose lisboa",
                  "tratamento conservador da escoliose",
                  "fisioterapia para escoliose",
                  "método Schroth · fisioterapia Schroth Lisboa",
                  "método SEAS (hoje sem qualquer conteúdo no site)",
                  "escoliose em adolescentes · rastreio escolar",
                  "escoliose em adultos",
                  "escoliose lombar",
                  "exercícios para escoliose",
                  "as 4 pesquisas em forma de pergunta já posicionadas (referências, tecnologia 3D, especialistas e clínicas de escoliose em Lisboa)",
                ]}
              />
              <p className="mt-2 text-[12px] text-black/50">Lista de partida — fechada com a baseline de setembro e revista em cada checkpoint.</p>
            </div>
          </Reveal>
          <Reveal delay={90}>
            <div className="h-full rounded-2xl border border-black/8 bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/50">Como lá chegamos</p>
              <Bullets
                items={[
                  <><strong>Setembro</strong> — conteúdo de escoliose em adolescentes no regresso às aulas; padrão de título e descrição do Schroth aplicado a todo o cluster.</>,
                  <><strong>Novembro</strong> — SEAS, escoliose em adultos e lombar publicados; otimização de citabilidade (resposta direta, listas extraíveis, schema clínico com autoria).</>,
                  <><strong>Dezembro</strong> — conteúdo assinado pelas fisioterapeutas, casos clínicos de escoliose e domínios de referência ligados ao tema.</>,
                  <><strong>Janeiro</strong> — iteração de prompts com base na medição de novembro; links internos de todo o site a convergir para o cluster.</>,
                  <><strong>Fevereiro</strong> — relatório final: cluster no Top 1–3 e mention rate em IA de 50–60%.</>,
                ]}
              />
            </div>
          </Reveal>
        </div>
      </Section>

      {/* ============ 5. CRM ============ */}
      <Section id="crm" eyebrow={`Novo neste ciclo · valor médio ${CRM_VALUE} · incluído`} title="5. CRM: configuração e ligação — incluído">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-[#0B0C12] p-6 text-white sm:p-8">
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full opacity-40 blur-3xl" style={{ background: BRAND_GRADIENT }} />
            <div className="relative grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-center">
              <div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ background: BRAND_GRADIENT }}>
                    <Workflow className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[20px] font-semibold leading-tight">Configuração e ligação do CRM</p>
                    <p className="text-[12.5px] text-white/55">Plataforma WonderAds · setup completo no Mês 1</p>
                  </div>
                </div>
                <p className="mt-4 max-w-md text-[13.5px] leading-relaxed text-white/65">
                  Todos os contactos num só sítio, com a origem registada e acompanhados até à consulta marcada.
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {["Formulário do site", "Telefone", "WhatsApp", "Chat widget", "Perfil Google"].map((c) => (
                    <span key={c} className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/80">{c}</span>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Valor médio</p>
                <p className="mt-1 text-[26px] font-bold text-white/35 line-through decoration-white/40">{CRM_VALUE}</p>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200">Nesta renovação</p>
                <p className="mt-1 text-[44px] font-bold leading-none tracking-tight">
                  <GradientText>0 €</GradientText>
                </p>
                <span className="mt-3 inline-flex rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-bold text-emerald-200">
                  Incluído · poupança de {CRM_VALUE}
                </span>
              </div>
            </div>
          </div>
        </Reveal>

        <SubTitle>O que inclui</SubTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { Icon: Inbox, title: "Um só sítio", text: "Formulário, chamadas, WhatsApp, chat e perfil Google numa lista única." },
            { Icon: Workflow, title: "Pipeline de marcações", text: "Novo → contactado → 1.ª consulta → paciente, com motivo quando não avança." },
            { Icon: Crosshair, title: "Origem de cada lead", text: "Orgânico, marca, IA ou perfil Google — registado automaticamente." },
            { Icon: Zap, title: "Automações", text: "Confirmação imediata, «missed-call text-back» e follow-up quando não há resposta." },
            { Icon: Star, title: "Reviews pós-alta", text: "Convite à avaliação Google disparado às 3 semanas e aos 3 meses." },
            { Icon: GraduationCap, title: "Formação e acompanhamento", text: "1 sessão à equipa + revisão do pipeline na reunião mensal." },
          ].map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <CrmFeature Icon={f.Icon} title={f.title} text={f.text} />
            </Reveal>
          ))}
        </div>
        <p className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12.5px] text-emerald-900">
          <Sparkles className="h-3.5 w-3.5" /> Sem licenciamento adicional — a plataforma WonderAds (97 €/mês à parte) continua incluída no plano.
        </p>
      </Section>

      {/* ============ 6. PLANO E INVESTIMENTO ============ */}
      <Section id="investimento" eyebrow="Plano · Exclusivamente personalizado para a Fisio Restelo" title="6. Plano e investimento">
        <Reveal>
          <div className="rounded-3xl p-[2px] shadow-2xl shadow-[#783DF5]/15" style={{ background: BRAND_GRADIENT }}>
            <div className="grid gap-0 rounded-[22px] bg-white md:grid-cols-[1fr_1.6fr]">
              <div className="border-b border-black/8 p-6 sm:p-8 md:border-b-0 md:border-r">
                <Pill>Renovação · 6 meses</Pill>
                <h3 className="mt-4 text-[22px] font-semibold tracking-tight text-black/88">Plano de Crescimento Orgânico</h3>
                <p className="mt-1 text-[13px] text-black/55">Setembro 2026 – Fevereiro 2027 · mesmas condições do plano aceite em janeiro</p>
                <p className="mt-6 text-[52px] font-bold leading-none tracking-tight">
                  <GradientText>{PLAN_PRICE}</GradientText>
                </p>
                <p className="mt-2 text-[13px] text-black/55">6 meses · equivale a 750 €/mês</p>
                <div className="mt-6 space-y-2">
                  {[
                    `CRM configurado e ligado — ${CRM_VALUE} incluídos`,
                    "Plataforma WonderAds incluída (97 €/mês à parte)",
                    "Relatório mensal + 2 checkpoints trimestrais",
                    "Resposta em 30 minutos, em horário útil",
                  ].map((b) => (
                    <div key={b} className="flex items-start gap-2 text-[13px] text-black/75">
                      <span className="mt-[3px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white" style={{ background: BRAND_GRADIENT }}>
                        <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                      </span>
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
                {[
                  { title: "Conteúdo & SEO", items: ["Auditorias regulares de SEO", "Roadmap de 6 meses com checkpoints", "15 palavras-chave prioritárias (escoliose + serviços)", "Blogs e landing pages — Pilates Clínico, RPG, zona, acordos, escoliose", "Velocidade, imagens e SEO técnico", "300 backlinks + domínios de referência"] },
                  { title: "Medição & CRM", items: ["GA4 + medição de contactos por canal", "NOVO · CRM configurado e ligado", "Chat widget com leads para o CRM", "Relatório mensal + trimestrais (nov, fev)"] },
                  { title: "Google & IA", items: ["Marcação direta, posts e reviews no perfil Google", "Presença em IA (Searchable + AI Visibility)", "Otimização de citabilidade (AEO)"] },
                  { title: "On-page incluído", items: ["Títulos e descrições meta", "URLs e alt tags", "Links internos e externos"] },
                ].map((g) => (
                  <div key={g.title}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5b21b6]">{g.title}</p>
                    <ul className="mt-2 space-y-1.5">
                      {g.items.map((it) => (
                        <li key={it} className="flex gap-2 text-[13px] leading-snug text-black/75">
                          <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: BRAND_GRADIENT }} />
                          <span className={it.startsWith("NOVO") ? "font-semibold text-black/88" : ""}>{it}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>

        <SubTitle>Os quatro focos deste ciclo</SubTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { Icon: Workflow, title: "CRM configurado e ligado", text: "Todos os contactos num só sítio, desde o primeiro dia do ciclo." },
            { Icon: Crosshair, title: "Tracking perfeito de cada lead", text: "Origem, estado e acompanhamento até à consulta marcada — e o relatório em pacientes, não em visitas." },
            { Icon: Target, title: "Escoliose no Top 1–3", text: "O tema onde a Fisio Restelo já lidera, levado ao topo do Google e das respostas de IA." },
            { Icon: MessageSquareHeart, title: "Mais web design nas páginas que faltam", text: "Pilates Clínico, RPG, zona, acordos e escoliose com o padrão editorial e visual da página de Escoliose." },
          ].map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <div className="h-full rounded-2xl border border-black/8 bg-white p-4">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: BRAND_GRADIENT }}>
                  <f.Icon className="h-4 w-4" />
                </span>
                <p className="mt-3 text-[14px] font-semibold text-black/85">{f.title}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-black/60">{f.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Callout title="Importância">
          Este ciclo não é «mais do mesmo». Com o CRM ligado e cada lead seguida até à consulta, a Fisio Restelo passa a ver em pacientes o que hoje só vê em visitas; com a escoliose no Top 1–3 e as páginas que faltam desenhadas ao nível da de Escoliose, o crescimento orgânico continua consistente sobre uma base já paga. Resultado: mais leads qualificadas, de forma automatizada, a tornarem-se pacientes de alto valor todos os meses — sem a clínica se preocupar com marketing.
        </Callout>
      </Section>

      {/* ============ 7. GOVERNANÇA ============ */}
      <Section id="acompanhamento" eyebrow="Governança do plano" title="7. Como acompanhamos">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-black/8 bg-white p-5">
            <p className="text-[15px] font-semibold text-black/85">Do lado da WonderAds</p>
            <Bullets
              items={[
                <><strong>Reunião mensal</strong> de 30 min + relatório trimestral em novembro e fevereiro.</>,
                <><strong>Checkpoint em novembro</strong> com decisões registadas no relatório.</>,
                <><strong>As mesmas fontes</strong> do início ao fim: Search Console, Semrush, Searchable, CRM.</>,
                <><strong>Resposta em 30 minutos</strong>, em horário útil.</>,
              ]}
            />
          </div>
          <div className="rounded-2xl border border-black/8 bg-white p-5">
            <p className="text-[15px] font-semibold text-black/85">Do lado da Fisio Restelo</p>
            <Bullets
              items={[
                <><strong>Aprovar conteúdos</strong> em 5 dias úteis (Sandrina ou Milene).</>,
                <><strong>30 min por semana</strong> de revisão clínica.</>,
                <><strong>Uma frase</strong> de convite à avaliação no WhatsApp pós-alta.</>,
                <><strong>Acessos</strong> ao perfil Google e à medição no Mês 1.</>,
              ]}
            />
          </div>
        </div>
      </Section>

      {/* ============ 8. AVANÇAR ============ */}
      <Section id="avancar" eyebrow="Para avançar" title="8. Próximos passos">
        <Reveal>
          <ConfirmRenewal
            proposalSlug="fisio-restelo-renovacao"
            clientName="Fisio Restelo"
            toEmail={ANDRE_EMAIL}
            ccEmail={consultantEmail}
            consultantFirst={consultantName.split(" ")[0]}
            price={`${PLAN_PRICE} · 6 meses`}
            period={PERIOD}
          />
        </Reveal>

        <details className="mt-8 rounded-2xl border border-black/8 bg-white/70 px-5 py-4 text-[12.5px] leading-relaxed text-black/60">
          <summary className="cursor-pointer text-[13px] font-semibold text-black/75">Nota metodológica — fontes e períodos</summary>
          <Bullets
            items={[
              "Pesquisa Google (cliques, impressões, posições): série mensal de fevereiro a julho de 2026, com meses completos. Os totais de 1.056 cliques e 33.410 impressões correspondem à janela móvel dos últimos 6 meses fechada a 24 de agosto de 2026.",
              "Perfil da clínica no Google (chamadas, direções, cliques): março a julho de 2026.",
              "Comportamento no site: desde a ativação da medição, no final de abril de 2026, até 3 de agosto.",
              "Palavras-chave, Authority Score, domínios de referência e AI Visibility: Semrush, Domain Overview de 24 de agosto de 2026.",
              "Menções em respostas de IA: Searchable, medição de julho de 2026 sobre 10 prompts não-branded.",
              "Valor equivalente em mídia paga: estimativa de ferramenta de mercado, usada como indicador de tendência.",
              "Projeções de contactos e valor: estimativas com premissas declaradas, a recalibrar no checkpoint de novembro.",
            ]}
          />
        </details>
      </Section>
    </>
  );
}

export const FISIO_RESTELO_RENOVACAO: ProposalRender = {
  nav: [
    { id: "resultados", label: "Resultados" },
    { id: "roadmap", label: "Roadmap" },
    { id: "escoliose", label: "Escoliose" },
    { id: "crm", label: "CRM" },
    { id: "investimento", label: "Investimento" },
    { id: "avancar", label: "Avançar" },
  ],
  hero: {
    eyebrow: "Proposta de Renovação · Set 2026 – Fev 2027",
    title: "Fisio Restelo",
    subtitle:
      "Seis meses construíram a base: o site passou a ser encontrado, a marca consolidou-se e a clínica já é citada por assistentes de IA. Os próximos seis levam essa base ao topo — e traduzem-na em pacientes marcados.",
    stats: [
      { value: <CountUp to={1056} />, label: "cliques na Pesquisa Google", sub: "últimos 6 meses" },
      { value: <CountUp to={299} />, label: "chamadas via perfil Google", sub: "março a julho" },
      { value: <CountUp to={714} />, label: "pedidos de direções", sub: "março a julho" },
      { value: <CountUp to={57} />, label: "formulários submetidos", sub: "97% de conclusão" },
    ],
  },
  Body,
};
