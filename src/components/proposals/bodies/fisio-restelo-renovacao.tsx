// Proposta de Renovação — Fisio Restelo · Setembro 2026 – Fevereiro 2027.
//
// FONTES: «Fisiorestelo_Resultados_6_meses_atualizado.pdf» (resultados
// fev–ago 2026) e «Fisiorestelo_Roadmap_6_meses.pdf» (roadmap set 2026 –
// fev 2027), preparados pela WonderAds em agosto de 2026. Todos os números
// vêm desses documentos.
//
// v76.94/95 — revisões do André: a proposta lê-se pelos números e pelos
// visuais, com o mínimo de texto de ligação. Ficaram sete secções:
// resultados (tiles + gráficos), do tráfego ao paciente (tabelas), o plano
// (compromisso + escada de posições + quadro de metas), escoliose, CRM,
// plano de 4.500 € e o fecho «Confirmar a renovação».

import type { ReactNode } from "react";
import {
  BarChart3,
  Bot,
  Crosshair,
  FileText,
  GraduationCap,
  Inbox,
  Link2,
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
  GradientText,
  Pill,
  Section,
  StatGrid,
  SubTitle,
  BRAND_GRADIENT,
} from "../proposal-primitives";
import { CountUp, Reveal } from "../proposal-motion";
import { GrowthBar, MonthlyGrowthChart, PositionLadder } from "../charts";
import { KpiBoard } from "../kpi-board";
import { ConfirmRenewal } from "../confirm-renewal";
import type { ProposalBodyProps, ProposalRender } from "./types";

const PLAN_MONTHLY = "6.000 €";
const PLAN_MONTHLY_PER = "1.000 €/mês × 6";
const PLAN_PREPAID = "5.400 €";
const PLAN_SAVING = "600 €";
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

function Chip({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  if (strong) {
    return (
      <span className="inline-flex items-center rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-white" style={{ background: BRAND_GRADIENT }}>
        {children}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-black/8 bg-black/[0.03] px-3 py-1.5 text-[12.5px] text-black/75">
      {children}
    </span>
  );
}

function Body({ consultantName, consultantEmail }: ProposalBodyProps) {
  return (
    <>
      {/* ============ 1. RESULTADOS ============ */}
      <Section id="resultados" eyebrow="Resultados · Fevereiro a agosto de 2026" title="1. Os primeiros 6 meses em números">
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
          <div className="rounded-3xl p-[2px]" style={{ background: BRAND_GRADIENT }}>
            <div className="relative overflow-hidden rounded-[22px] bg-white p-6 sm:p-8">
              <div aria-hidden className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full opacity-[0.12] blur-3xl" style={{ background: BRAND_GRADIENT }} />
              <div className="relative grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-center">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ background: BRAND_GRADIENT }}>
                      <Workflow className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-[20px] font-semibold leading-tight text-black/88">Configuração e ligação do CRM</p>
                      <p className="text-[12.5px] text-black/55">Plataforma WonderAds · setup completo no Mês 1</p>
                    </div>
                  </div>
                  <p className="mt-4 max-w-md text-[13.5px] leading-relaxed text-black/65">
                    Todos os contactos num só sítio, com a origem registada e acompanhados até à consulta marcada.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {["Formulário do site", "Telefone", "WhatsApp", "Chat widget", "Perfil Google"].map((c) => (
                      <Chip key={c}>{c}</Chip>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-[#e9d5ff] bg-[#f5f0ff] p-5 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/45">Valor médio</p>
                  <p className="mt-1 text-[26px] font-bold text-black/35 line-through decoration-black/30">{CRM_VALUE}</p>
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5b21b6]">Nesta renovação</p>
                  <p className="mt-1 text-[44px] font-bold leading-none tracking-tight">
                    <GradientText>0 €</GradientText>
                  </p>
                  <span className="mt-3 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-800">
                    Incluído · poupança de {CRM_VALUE}
                  </span>
                </div>
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
            <div className="relative overflow-hidden rounded-[22px] bg-white">
              <div aria-hidden className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full opacity-[0.12] blur-3xl" style={{ background: BRAND_GRADIENT }} />
              <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-32 h-96 w-96 rounded-full opacity-[0.10] blur-3xl" style={{ background: BRAND_GRADIENT }} />
              <div className="relative grid md:grid-cols-[1fr_1.55fr]">
                {/* ----- preço ----- */}
                <div className="border-b border-black/8 p-7 sm:p-9 md:border-b-0 md:border-r">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill>Renovação · 6 meses</Pill>
                    <Pill tone="green">Tudo incluído</Pill>
                  </div>
                  <h3 className="mt-5 text-[24px] font-semibold leading-tight tracking-tight text-black/88">Plano de Crescimento Orgânico</h3>
                  <p className="mt-1.5 text-[13px] text-black/55">Setembro 2026 – Fevereiro 2027 · 6 meses · duas modalidades de pagamento</p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-black/10 bg-white p-4">
                      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-black/50">Plano mensal</p>
                      <p className="mt-2 text-[38px] font-bold leading-none tracking-tight">
                        <GradientText>{PLAN_MONTHLY}</GradientText>
                      </p>
                      <p className="mt-2 text-[12.5px] text-black/60">{PLAN_MONTHLY_PER} meses</p>
                    </div>
                    <div className="rounded-2xl p-[2px]" style={{ background: BRAND_GRADIENT }}>
                      <div className="h-full rounded-[14px] bg-white p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#5b21b6]">Pré-pago</p>
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-bold text-emerald-800">Poupa {PLAN_SAVING}</span>
                        </div>
                        <p className="mt-2 text-[38px] font-bold leading-none tracking-tight">
                          <GradientText>{PLAN_PREPAID}</GradientText>
                        </p>
                        <p className="mt-2 text-[12.5px] text-black/60">pagamento único, tudo à cabeça</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-7 space-y-2.5 rounded-2xl border border-[#e9d5ff] bg-[#f5f0ff] p-4">
                    {[
                      { Icon: Workflow, text: <>CRM configurado e ligado — <strong>{CRM_VALUE} incluídos</strong></> },
                      { Icon: Sparkles, text: <>Plataforma WonderAds incluída <span className="text-black/50">(97 €/mês à parte)</span></> },
                      { Icon: FileText, text: <>Relatório mensal + checkpoints em novembro e fevereiro</> },
                      { Icon: PhoneCall, text: <>Resposta em 30 minutos, em horário útil</> },
                    ].map((b, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-[13px] text-black/78">
                        <span className="mt-[1px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white" style={{ background: BRAND_GRADIENT }}>
                          <b.Icon className="h-3 w-3" />
                        </span>
                        <span>{b.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* ----- o que está incluído ----- */}
                <div className="grid gap-6 p-7 sm:grid-cols-2 sm:p-9">
                  {[
                    { Icon: FileText, title: "Conteúdo & SEO", items: ["Auditorias regulares", "Roadmap de 6 meses", "15 palavras-chave prioritárias", "Blogs e landing pages", "Pilates Clínico · RPG · zona · acordos · escoliose", "Velocidade e imagens", "SEO técnico", "300 backlinks", "Domínios de referência"] },
                    { Icon: Workflow, title: "Medição & CRM", items: ["GA4", "Medição de contactos por canal", "NOVO · CRM configurado e ligado", "Chat widget → CRM", "Relatório mensal", "Checkpoints nov · fev"] },
                    { Icon: Bot, title: "Google & IA", items: ["Marcação direta no perfil Google", "Posts e reviews", "Presença em IA (Searchable + AI Visibility)", "Citabilidade (AEO)"] },
                    { Icon: Link2, title: "On-page incluído", items: ["Títulos e descrições meta", "URLs", "Alt tags", "Links internos e externos"] },
                  ].map((g) => (
                    <div key={g.title}>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-white" style={{ background: BRAND_GRADIENT }}>
                          <g.Icon className="h-3.5 w-3.5" />
                        </span>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5b21b6]">{g.title}</p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {g.items.map((it) => (
                          <Chip key={it} strong={it.startsWith("NOVO")}>{it}</Chip>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </Section>

      {/* ============ 7. AVANÇAR ============ */}
      <Section id="avancar" eyebrow="Para avançar" title="7. Próximos passos">
        <Reveal>
          <ConfirmRenewal
            proposalSlug="fisio-restelo-renovacao"
            clientName="Fisio Restelo"
            toEmail={ANDRE_EMAIL}
            ccEmail={consultantEmail}
            consultantFirst={consultantName.split(" ")[0]}
            pricing={{ monthly: PLAN_MONTHLY, monthlyPer: PLAN_MONTHLY_PER, prepaid: PLAN_PREPAID, saving: PLAN_SAVING }}
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
    stats: [
      { value: <CountUp to={1056} />, label: "cliques na Pesquisa Google", sub: "últimos 6 meses" },
      { value: <CountUp to={299} />, label: "chamadas via perfil Google", sub: "março a julho" },
      { value: <CountUp to={714} />, label: "pedidos de direções", sub: "março a julho" },
      { value: <CountUp to={57} />, label: "formulários submetidos", sub: "97% de conclusão" },
    ],
  },
  Body,
};
