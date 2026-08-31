// Proposta de Renovação — Fisio Restelo · Setembro 2026 – Fevereiro 2027.
//
// FONTES: «Fisiorestelo_Resultados_6_meses_atualizado.pdf» (relatório de
// resultados fev–ago 2026) e «Fisiorestelo_Roadmap_6_meses.pdf» (roadmap
// set 2026 – fev 2027), ambos preparados pela WonderAds em agosto de 2026.
// Todos os números vêm desses dois documentos. A estrutura segue a proposta
// original aceite em janeiro de 2026 (planos → o que está incluído →
// plataforma → importância → risco zero → contactos), com os resultados e
// o roadmap à frente — numa renovação, o argumento é o trabalho feito.
//
// Dois pontos pedidos expressamente para esta renovação:
//   • foco em escoliose: Top 1–3 em todas as palavras-chave do cluster;
//   • configuração e ligação do CRM (valor médio 1.200 €, normalmente à
//     parte) incluída sem custo.

import {
  Bullets,
  Callout,
  CheckList,
  DataTable,
  GoalCard,
  GradientText,
  MonthCard,
  Pill,
  PriceCard,
  Prose,
  Section,
  StatGrid,
  SubTitle,
  BRAND_GRADIENT,
} from "../proposal-primitives";
import type { ProposalBodyProps, ProposalRender } from "./types";

const PLAN_PRICE = "4.500 €";
const CRM_VALUE = "1.200 €";

function Body({ consultantName, consultantEmail }: ProposalBodyProps) {
  const confirmHref = `mailto:info@wonder-ads.com?cc=${encodeURIComponent(consultantEmail)}&subject=${encodeURIComponent("Fisio Restelo — confirmação da renovação (set 2026 – fev 2027)")}&body=${encodeURIComponent("Olá,\n\nConfirmamos a renovação da parceria com a WonderAds por 6 meses (setembro 2026 – fevereiro 2027), nas condições da proposta.\n\nCumprimentos,\nFisio Restelo")}`;
  const talkHref = `mailto:${consultantEmail}?subject=${encodeURIComponent("Fisio Restelo — dúvidas sobre a proposta de renovação")}`;

  return (
    <>
      {/* ============ 1. RESULTADOS ============ */}
      <Section
        id="resultados"
        eyebrow="Resultados · Fevereiro a agosto de 2026"
        title="1. Os primeiros 6 meses em números"
        lead="Em seis meses, a Fisio Restelo passou de uma presença digital residual para um canal de captação ativo. O tráfego orgânico cresceu de 28 para 262 cliques mensais e esse crescimento já se traduz em ações concretas de potenciais pacientes: chamadas, pedidos de direções e formulários de marcação."
      >
        <StatGrid
          cols={3}
          items={[
            { value: "+9x", label: "tráfego orgânico mensal", sub: "28 → 262 cliques/mês (fevereiro → julho)" },
            { value: "1.056", label: "cliques na Pesquisa Google", sub: "últimos 6 meses · 33.410 impressões" },
            { value: "65 → 112", label: "palavras-chave orgânicas", sub: "+72% · Semrush, 24/08/2026" },
            { value: "396 → 944", label: "visitas/mês estimadas", sub: "+138%" },
            { value: "57", label: "domínios de referência", sub: "119 backlinks" },
            { value: "63 → 86", label: "palavras-chave na watchlist", sub: "+36,5% · acompanhadas de perto" },
          ]}
        />

        <SubTitle>Tráfego orgânico — evolução mês a mês</SubTitle>
        <Prose>
          Crescimento contínuo nos seis meses, sem quedas. É um padrão de trabalho consistente, não de pico isolado.
        </Prose>
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
          note="Medição atualizada a 24 de agosto: na janela dos últimos 6 meses fechada nessa data, o total é de 1.056 cliques e 33.410 impressões. Agosto ainda estava em curso, pelo que a tabela usa apenas meses completos para a leitura de tendência."
        />
        <Bullets
          items={[
            <>Valor equivalente em mídia paga substituído por SEO: de <strong>13 $</strong> (fevereiro) para <strong>302 $</strong> (julho).</>,
            <>Curva de posicionamento em subida consistente nas faixas de <strong>Top 3</strong> e <strong>Top 10</strong>.</>,
            <>O domínio foi de 65 para 112 palavras-chave a gerar tráfego orgânico — não é um pico em duas ou três palavras-chave, é uma <strong>base de posicionamento que mais do que dobrou</strong>.</>,
            <>Authority Score estável em <strong>10</strong> — saudável para um domínio local desta dimensão. É o indicador que o próximo ciclo trabalha a seguir, agora que a base de conteúdo existe.</>,
          ]}
        />
        <Callout title="Leitura em uma frase">
          O trabalho de SEO deixou de ser apenas visibilidade: já existe procura direta a chegar à clínica por telefone, por direções e por formulário. O passo seguinte é medir quantas dessas ações se convertem em consulta marcada — e isso é a primeira ação do roadmap do próximo ciclo.
        </Callout>
      </Section>

      {/* ============ 2. DO TRÁFEGO AO PACIENTE ============ */}
      <Section
        id="paciente"
        eyebrow="Conversão · O que acontece depois do clique"
        title="2. Do tráfego ao paciente"
        lead="Cliques e posições medem visibilidade. O que interessa a uma clínica é o que acontece a seguir: quantas pessoas ligam, quantas pedem direções e quantas pedem marcação. Esta secção junta as três fontes de dados que respondem a essa pergunta."
      >
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
        <Prose>
          Os pedidos de direções — o sinal com maior intenção física de todos — foram o indicador com maior crescimento no período. As chamadas mantiveram-se num patamar estável, entre as mais fortes do perfil. A procura nova está a entrar sobretudo pelo canal digital, sem retirar volume ao telefone.
        </Prose>
        <Callout tone="green" title="97% de quem começa o formulário conclui-o">
          Foram iniciados 59 formulários e submetidos 57. O formulário não é um obstáculo — quem chega com intenção, avança. O trabalho a fazer está a montante: levar mais pessoas certas até à página de marcação.
        </Callout>

        <SubTitle>Notoriedade da marca vs. pesquisas por serviço</SubTitle>
        <DataTable
          head={["Tipo de pesquisa", "Impressões", "Cliques", "Leitura"]}
          numeric={[1, 2]}
          rows={[
            ["Por nome da clínica (marca)", "4.279", "441", "Notoriedade consolidada"],
            ["Por serviço (não-marca)", "15.230", "91", "Visibilidade conquistada, por converter"],
          ]}
          note="Separação apurada sobre as 1.000 pesquisas com maior volume dos últimos 6 meses (Search Console)."
        />
        <Prose>
          A pesquisa por marca cresceu de forma expressiva — «fisiorestelo» +46% e «fisio restelo» +113% em cliques só em julho — e é hoje o motor dos cliques. As pesquisas por serviço geram quase quatro vezes mais impressões e um quinto dos cliques, porque a maioria está entre a 10.ª e a 14.ª posição. É visibilidade já conquistada e ainda por converter — <strong>a matéria-prima do plano dos próximos 6 meses</strong>.
        </Prose>
        <div className="my-4 flex flex-wrap gap-2">
          {[
            ["fisioterapeuta perto de mim", "#1"],
            ["marta gameiro", "#1"],
            ["fisioterapeuta ombro", "#1"],
            ["pilates restelo", "#3"],
            ["fisioterapia belem", "#4"],
          ].map(([k, p]) => (
            <span
              key={k}
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1 text-[12.5px] text-black/75"
            >
              {k}
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
                style={{ background: BRAND_GRADIENT }}
              >
                {p}
              </span>
            </span>
          ))}
        </div>

        <SubTitle>Presença em assistentes de inteligência artificial</SubTitle>
        <Prose>
          Uma parte crescente das pesquisas de saúde já acontece dentro de assistentes de IA (ChatGPT, Perplexity, Gemini, resumos de IA do Google), que citam fontes em vez de listar links. No período medido, o site recebeu 22 sessões com origem identificada no ChatGPT — mas o número de sessões é a parte menos relevante da história.
        </Prose>
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
        />
        <Callout title="A maior oportunidade do próximo trimestre: Pilates Clínico">
          A página de Pilates Clínico é a segunda página mais vista pelo Google em todo o site — 9.216 impressões — mas converte 0,76% disso em visitas, na posição 11,5. Se essa página passar para a posição 4 com uma taxa de clique de 4%, o mesmo volume de procura passa a gerar cerca de <strong>370 cliques em vez de 70</strong> — sem uma única pesquisa nova. É por isso que a reformulação desta página, já em produção, é a prioridade número um.
        </Callout>
        <Callout tone="amber" title="Procura por acordos e comparticipações — um pedido repetido">
          32 pesquisas distintas trouxeram pessoas ao site à procura de fisioterapia com acordo SNS ou ADSE. São pesquisas com intenção comercial elevada e o site não tem hoje uma página que lhes responda. Criá-la é uma ação de baixo esforço e retorno direto — e esclarece à partida os casos em que não há acordo, evitando contactos desalinhados que consomem tempo da equipa ao telefone.
        </Callout>
      </Section>

      {/* ============ 3. ROADMAP ============ */}
      <Section
        id="roadmap"
        eyebrow="Roadmap SEO e Visibilidade em IA · Setembro 2026 – Fevereiro 2027"
        title="3. O plano dos próximos 6 meses"
        lead="Os primeiros 6 meses construíram a base — o site passou a ser encontrado, a marca consolidou-se e a clínica já é citada por assistentes de IA. Os próximos 6 meses são de amplificação: levar ao topo a procura já conquistada e instalar a medição que a traduz em pacientes marcados."
      >
        <div
          className="avoid-break rounded-2xl p-[2px]"
          style={{ background: BRAND_GRADIENT }}
        >
          <div className="rounded-[15px] bg-white px-6 py-6 sm:px-8 sm:py-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5b21b6]">
              O compromisso deste roadmap
            </p>
            <p className="mt-3 text-xl font-semibold leading-snug tracking-tight text-black/88 sm:text-2xl">
              Em 6 meses, a Fisio Restelo é a primeira escolha do Google e dos assistentes de IA para quem procura fisioterapia especializada em Lisboa — e o relatório mensal passa a mostrar isso em pacientes marcados, não apenas em visitas.
            </p>
          </div>
        </div>

        <SubTitle>As quatro metas que resumem tudo</SubTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <GoalCard n="1" title="Medição de contactos ativa" text="Chamadas, WhatsApp e formulários medidos e reportados por canal de origem — o relatório passa a responder «quantos pacientes trouxe o SEO este mês»." />
          <GoalCard n="2" title="Cliques não-branded a multiplicar por 5" text="De ~15–20 para 90–120 cliques/mês em pesquisas de serviço — a procura de quem ainda não conhece a Fisio Restelo." />
          <GoalCard n="3" title="Pilates Clínico e RPG no top 5" text="As duas maiores bolsas de procura por converter do site (5.024 + 1.179 impressões) saem da posição 11–13 para a zona onde as pessoas clicam." />
          <GoalCard n="4" title="Escoliose no Top 1–3" text="Todas as palavras-chave do cluster de escoliose entre a 1.ª e a 3.ª posição do Google — o eixo que distingue a clínica e o que a IA mais cita." accent />
        </div>

        <SubTitle>A procura já conquistada — a matéria-prima deste ciclo</SubTitle>
        <Prose>
          Além das pesquisas por nome, o trabalho dos primeiros 6 meses colocou a clínica no radar de quem procura os serviços sem a conhecer. Essa visibilidade está concentrada entre a 9.ª e a 14.ª posição — à porta da zona onde as pessoas clicam. O que falta é distância de posição, não visibilidade nova.
        </Prose>
        <DataTable
          head={["Frente de trabalho", "Procura já conquistada", "Posição atual", "Alvo fev 2027"]}
          numeric={[1, 2]}
          highlightRows={[2]}
          rows={[
            ["Pilates clínico (todas as variantes)", "5.024 impressões", "~12–13", "Top 5"],
            ["Reeducação postural global e RPG", "1.179 impressões", "~11", "Top 5"],
            [<strong key="e">Escoliose e coluna (cluster)</strong>, "918 impressões", "~7–9", <strong key="e2">Top 1–3</strong>],
            ["Fisioterapia (termo genérico)", "728 impressões", "10,2", "Top 5"],
            ["Massagem terapêutica", "701 impressões", "10,8", "Top 8"],
            ["Fisioterapia perto de mim", "233 impressões", "10,5", "Top 5"],
          ]}
        />

        <SubTitle>O plano numa página — quatro pilares, seis meses</SubTitle>
        <DataTable
          head={["Pilar", "Set", "Out", "Nov ✓", "Dez", "Jan", "Fev ✓"]}
          rows={[
            [<strong key="p1">Medição e prova de retorno</strong>, "Eventos de contacto ativos; baselines formais; CRM ligado", "Atribuição por canal validada", "Relatório T1 com contactos por origem", "Painel mensal estabilizado", "Série de 3 meses comparável", "Relatório final em contactos e euros"],
            [<strong key="p2">Conversão da procura existente</strong>, "Pilates Clínico e RPG publicadas; títulos corrigidos", "Striking distance 8–20; página de zona", "Pilates Clínico no top 8", "Massagem e osteopatia", "2.ª vaga striking distance", "Pilates e RPG no top 5"],
            [<strong key="p3">Autoridade clínica e IA · escoliose</strong>, "Escoliose no regresso às aulas", "Baseline de citabilidade", "AEO nas páginas de prompt; schema clínico; SEAS, adultos, lombar", "Conteúdo assinado; casos clínicos", "Iteração de prompts", "Escoliose no Top 1–3 · mention rate 50–60%"],
            [<strong key="p4">Local e prova social</strong>, "Auditoria do perfil Google", "Marcação direta ativa; fluxo de reviews", "+10–15 reviews novas", "Posts semanais; Q&A", "Pico de janeiro trabalhado", "+25–35 reviews acumuladas"],
          ]}
          note="✓ = checkpoint com relatório formal e revisão de trajetória (novembro e fevereiro)."
        />

        <SubTitle>Mês a mês</SubTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <MonthCard
            index={1}
            month="Setembro 2026"
            title="Medir para provar"
            bullets={[
              "Ativação da medição de contactos: cliques no telefone, no WhatsApp e submissão de formulário, com atribuição de canal — e ligação ao CRM.",
              "Baselines formais documentadas: Search Console, Semrush (Authority Score 10, 112 palavras-chave, 57 domínios, AI Visibility 14), Searchable (34%) e perfil Google.",
              "Publicação das páginas de Pilates Clínico e Reeducação Postural Global, no padrão editorial da página de Escoliose.",
              "O padrão de título e descrição do artigo Schroth (3,78% de CTR no 1.º mês) aplicado a todo o cluster de escoliose e às páginas de serviço.",
              "Conteúdo de escoliose em adolescentes publicado no início do mês, alinhado com o regresso às aulas e os rastreios escolares.",
              "Consolidação técnica: páginas herdadas do site antigo e páginas duplicadas resolvidas.",
            ]}
          />
          <MonthCard
            index={2}
            month="Outubro 2026"
            title="Converter a procura que já existe"
            bullets={[
              "Striking distance: otimização das pesquisas entre as posições 8 e 20 com volume relevante — o trabalho de maior retorno por hora do ciclo.",
              "Página de zona (Belém · Restelo · Ajuda · Algés): «fisioterapia belem» já está na posição 4; «fisioterapia perto de mim» tem 233 impressões na 10,5.",
              "Página de acordos e comparticipações, com posicionamento de transparência — qualifica à entrada e poupa tempo ao telefone.",
              "Ativação da marcação direta no perfil Google e revisão completa do perfil (categorias, serviços, fotos, horários).",
              "Arranque do fluxo de reviews, encaixado no acompanhamento pós-alta por WhatsApp que a clínica já faz (3 semanas e 3 meses).",
            ]}
          />
          <MonthCard
            index={3}
            month="Novembro 2026"
            title="Primeiro checkpoint"
            checkpoint
            bullets={[
              "Relatório trimestral T1 contra as baselines de setembro — o primeiro relatório da conta a apresentar contactos por canal de origem.",
              "Checkpoint com decisão registada: se a trajetória dos cliques não-branded estiver abaixo do previsto, a realocação de esforço fica escrita no relatório.",
              "Otimização de citabilidade (AEO) nas páginas que já ranqueiam para perguntas em formato de prompt: resposta direta até 50 palavras, listas extraíveis, schema clínico com autoria.",
              "Alargamento do cluster de escoliose: método SEAS (hoje sem conteúdo), escoliose em adultos e escoliose lombar.",
            ]}
          />
          <MonthCard
            index={4}
            month="Dezembro 2026"
            title="Autoridade clínica"
            bullets={[
              "Conteúdo assinado pelas fisioterapeutas — as páginas da equipa têm as melhores taxas de clique do site (Sandrina Lourenço 5,87%, Nídia Gonçalves 5,3%).",
              "Aquisição de domínios de referência de qualidade: associações profissionais, entidades ligadas à escoliose, publicações de saúde e a rede de médicos prescritores.",
              "Casos clínicos estruturados e testemunhos com resultados descritos — o formato mais citado pela IA e o mais persuasivo para quem decide.",
              "Segunda vaga de conversão: massagem terapêutica e osteopatia (mais de 700 impressões cada, posições 8 a 11).",
            ]}
          />
          <MonthCard
            index={5}
            month="Janeiro 2027"
            title="Pico de procura"
            bullets={[
              "Janeiro é o pico anual de pilates e postura: conteúdo, perfil Google e páginas de serviço preparados em dezembro e ativados na primeira semana.",
              "Segunda vaga de striking distance sobre as pesquisas que subiram para as posições 5 a 10 no primeiro trimestre.",
              "Iteração de prompts de IA com base na medição de novembro: conteúdo dirigido às perguntas onde a clínica ainda não é citada.",
              "Reforço do fluxo de reviews e publicação dos testemunhos recolhidos no trimestre.",
            ]}
          />
          <MonthCard
            index={6}
            month="Fevereiro 2027"
            title="Fecho e ciclo seguinte"
            checkpoint
            bullets={[
              "Relatório final de 6 meses: todas as metas contra as baselines de setembro, com dados verificáveis de Search Console, Semrush, Searchable, CRM e medição de contactos.",
              "Preparação do calendário seguinte: aniversário da clínica a 3 de março e época da Páscoa.",
              "Plano do ciclo seguinte construído sobre resultados reais — com avaliação de expansão para reabilitação desportiva.",
            ]}
          />
        </div>

        <SubTitle>Porquê agora</SubTitle>
        <Bullets
          items={[
            <><strong>Os dois picos de procura do ano caem dentro deste ciclo.</strong> Setembro é o regresso às rotinas e aos rastreios escolares; janeiro é o pico anual de pilates e postura. Começar em setembro apanha os dois — com as páginas de Pilates Clínico e RPG já publicadas.</>,
            <><strong>A janela de vantagem em IA é temporária.</strong> A Fisio Restelo é citada hoje em perguntas onde a maioria das clínicas de Lisboa ainda nem mede presença. Quem chega primeiro consolida a posição, quem chega depois disputa-a.</>,
            <><strong>A medição só produz valor com série temporal.</strong> Ativá-la em setembro significa três meses comparáveis no checkpoint de novembro e seis no relatório final.</>,
          ]}
        />

        <Callout title="Da visibilidade ao paciente — projeção prudente, com premissas explícitas">
          Hoje a clínica recebe cerca de 19 formulários e 50 chamadas por mês através do perfil Google. As metas deste roadmap acrescentam, no cenário prudente, <strong>20 a 30 contactos qualificados por mês</strong> até fevereiro. Com 30% a converter em primeira consulta e um valor de tempo de vida por paciente de 1.200 € (dado fornecido pela clínica no onboarding), isso equivale a <strong>6 a 9 novos pacientes por mês</strong> — 7.200 € a 10.800 € em valor acrescentado por mês de operação. São estimativas com premissas declaradas, não garantias; é precisamente por isso que a medição é a primeira ação do plano.
        </Callout>

        <SubTitle>Metas e indicadores — quadro de referência</SubTitle>
        <DataTable
          head={["Indicador", "Baseline (ago 2026)", "Meta T1 (nov 2026)", "Meta T2 (fev 2027)"]}
          numeric={[1, 2, 3]}
          highlightRows={[4]}
          rows={[
            ["Cliques orgânicos / mês", "262", "340–400", "450–550"],
            ["Cliques não-branded / mês", "~15–20", "45–60", "90–120"],
            ["Impressões / mês", "8.827", "11–13 mil", "15–18 mil"],
            ["Pilates Clínico — posição", "11,5", "6–8", "3–5"],
            [<strong key="esc">Escoliose e coluna — posição do cluster</strong>, "~7–9", "Top 3–5", <strong key="esc2">Top 1–3</strong>],
            ["Pilates Clínico — taxa de clique", "0,76%", "2,0–2,5%", "3,5–4,5%"],
            ["Palavras-chave orgânicas (Semrush)", "112", "130–145", "155–180"],
            ["Authority Score (Semrush)", "10", "11–12", "12–14"],
            ["Domínios de referência", "57", "65–70", "75–85"],
            ["AI Visibility (Semrush)", "14", "22–28", "35–45"],
            ["Mention rate em IA (Searchable)", "34%", "40–45%", "50–60%"],
            ["Formulários submetidos / mês", "~19", "26–32", "38–48"],
            ["Chamadas via perfil Google / mês", "50", "60–70", "75–90"],
            ["Contactos atribuídos a canal", "a ativar", "medição ativa · 1.º número", "série de 3 meses"],
            ["Avaliações novas", "fluxo inativo", "+10–15", "+25–35 acumuladas"],
          ]}
          note="Baselines de agosto de 2026 (Search Console, Semrush em 24/08/2026, Searchable de julho, perfil Google). A medição é mensal e reportada trimestralmente. As metas de Authority Score e domínios de referência dependem da cadência de aquisição e são revistas no checkpoint de novembro."
        />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-black/8 bg-white p-5">
            <Pill tone="soft">Trimestre 1 · set–nov 2026</Pill>
            <p className="mt-2 text-[15px] font-semibold text-black/85">Medir e converter</p>
            <Bullets
              items={[
                "Medição de contactos ativa e a reportar por canal, com três meses de série comparável.",
                "Pilates Clínico e RPG publicadas, com Pilates Clínico no top 8 e CTR acima de 2%.",
                "Cliques não-branded a triplicar face à média do ciclo anterior.",
                "Marcação direta no perfil Google ativa; 10 a 15 avaliações novas.",
                "Páginas de zona e de acordos publicadas; páginas herdadas resolvidas.",
              ]}
            />
          </div>
          <div className="rounded-xl border border-black/8 bg-white p-5">
            <Pill tone="soft">Trimestre 2 · dez 2026–fev 2027</Pill>
            <p className="mt-2 text-[15px] font-semibold text-black/85">Consolidar e provar</p>
            <Bullets
              items={[
                "Pilates Clínico e RPG no top 5; núcleo de fisioterapia e massagem no top 10.",
                "Cluster de escoliose no Top 1–3; mention rate em IA entre 50% e 60%; AI Visibility de 14 para 35–45.",
                "Cliques não-branded a multiplicar por 5 face ao ponto de partida.",
                "25 a 35 avaliações novas acumuladas; casos clínicos publicados.",
                "Relatório final capaz de apresentar contactos e valor estimado, não apenas tráfego.",
              ]}
            />
          </div>
        </div>
        <Callout tone="neutral" title="Sobre a natureza deste plano">
          As atividades mês a mês são o caminho previsto à data de hoje — e é natural que algumas mudem: o Google atualiza os algoritmos várias vezes por ano, os assistentes de IA evoluem depressa e os resultados de cada mês informam o seguinte. O que não muda é o essencial: as quatro frentes de trabalho, as metas do quadro de referência e o compromisso de medir tudo contra as baselines de setembro. Qualquer troca é apresentada e justificada na reunião mensal ou no checkpoint, com a decisão registada no relatório — nunca alterada em silêncio.
        </Callout>
      </Section>

      {/* ============ 4. ESCOLIOSE ============ */}
      <Section
        id="escoliose"
        eyebrow="Foco prioritário · O eixo que distingue a Fisio Restelo"
        title={<>4. Escoliose: <GradientText>Top 1–3</GradientText> em todas as palavras-chave</>}
        lead="A escoliose é o tema em que a Fisio Restelo já compete de igual para igual com grupos muito maiores: é a página de maior qualidade técnica e clínica do site, o artigo sobre a técnica Schroth gerou 28 cliques logo no primeiro mês com 3,78% de taxa de clique, e é o tema com maior taxa de menção em respostas de IA (68%). O cluster está hoje entre a 7.ª e a 9.ª posição, com 918 impressões. O compromisso deste ciclo é continuar a empurrá-lo até às posições 1 a 3 do Google — em todas as palavras-chave de escoliose — e mantê-lo lá."
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
          <div className="rounded-xl border border-[#c4b5fd] bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5b21b6]">
              Palavras-chave do cluster a levar ao Top 1–3
            </p>
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
            <p className="mt-2 text-[12px] text-black/50">
              Lista de partida. A lista fechada — com a posição atual de cada termo — é fixada com as baselines de setembro e revista em cada checkpoint.
            </p>
          </div>
          <div className="rounded-xl border border-black/8 bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/50">
              Como lá chegamos
            </p>
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
        </div>
        <Callout title="Porque é que este tema conta a dobrar">
          Nas pesquisas em forma de pergunta a resposta é dada pelo assistente e a fonte é citada, não clicada. Conteúdo de escoliose profundo e assinado por profissionais identificados sobe no Google e, ao mesmo tempo, é o que os assistentes de IA citam — o mesmo trabalho rende nos dois canais. É uma frente em que uma unidade especializada compete de igual para igual com grupos muito maiores, porque o que pesa é profundidade clínica e autoria — exatamente o que a Fisio Restelo tem e a maioria das clínicas de Lisboa ainda não publica.
        </Callout>
      </Section>

      {/* ============ 5. CRM ============ */}
      <Section
        id="crm"
        eyebrow={`Novo neste ciclo · valor médio ${CRM_VALUE} · incluído`}
        title="5. CRM: configuração e ligação — incluído"
        lead="O relatório mostra 57 formulários, 299 chamadas e 714 pedidos de direções — mas hoje ninguém consegue dizer quantos viraram consulta. A configuração e ligação do CRM fecha esse circuito: cada contacto entra num só sítio, com a origem registada, e segue até à marcação sem se perder pelo caminho."
      >
        <div className="avoid-break grid gap-3 rounded-2xl border border-black/10 bg-white p-5 sm:grid-cols-3 sm:p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/50">Serviço</p>
            <p className="mt-1 text-[15px] font-semibold text-black/85">Configuração e ligação do CRM</p>
            <p className="mt-1 text-[12.5px] text-black/55">Plataforma WonderAds · setup completo no Mês 1</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/50">Valor médio</p>
            <p className="mt-1 text-[22px] font-bold text-black/40 line-through decoration-black/40">{CRM_VALUE}</p>
            <p className="mt-1 text-[12.5px] text-black/55">Cobrado à parte fora desta renovação</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5b21b6]">Nesta proposta</p>
            <p className="mt-1 text-[22px] font-bold">
              <GradientText>Incluído · 0 €</GradientText>
            </p>
            <p className="mt-1 text-[12.5px] text-black/55">Sem custo adicional na renovação de 6 meses</p>
          </div>
        </div>
        <SubTitle>O que inclui</SubTitle>
        <CheckList
          columns={2}
          items={[
            "Configuração da plataforma WonderAds (CRM) para a Fisio Restelo — contas, equipa e permissões.",
            "Centralização dos contactos: formulário do site, chamadas, WhatsApp, chat widget e perfil Google numa única lista.",
            "Pipeline de marcações: novo contacto → contactado → 1.ª consulta marcada → paciente, com motivo registado quando não avança.",
            "Ligação ao site e ao perfil Google — cada contacto chega com a origem (pesquisa orgânica, marca, IA, perfil Google).",
            "Automações: confirmação imediata ao paciente, notificação à equipa, «missed-call text-back» e follow-up quando não há resposta.",
            "Convite à avaliação Google disparado a partir do CRM no acompanhamento pós-alta (3 semanas / 3 meses) que a clínica já faz.",
            "Ligação à medição de contactos do Mês 1 — o CRM passa a ser a fonte do «quantos pacientes trouxe o SEO este mês».",
            "Formação da equipa (1 sessão) e acompanhamento na reunião mensal.",
          ]}
        />
        <Callout tone="green" title="Sem licenciamento adicional">
          A plataforma WonderAds (97 €/mês quando contratada em separado) continua incluída no plano. O CRM vive nela — não há uma ferramenta nova para pagar nem uma senha nova para a equipa decorar.
        </Callout>
      </Section>

      {/* ============ 6. PLANO E INVESTIMENTO ============ */}
      <Section
        id="investimento"
        eyebrow="Planos · Exclusivamente personalizados para a Fisio Restelo"
        title="6. Plano e investimento"
        lead="A renovação mantém as condições do plano aceite em janeiro e acrescenta o que este ciclo pede: o roadmap de 6 meses acima, o foco em escoliose, a medição de contactos e a configuração e ligação do CRM."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <PriceCard
            highlight
            eyebrow="Renovação · Plano de Crescimento Orgânico"
            name="Plano de 6 meses"
            price={PLAN_PRICE}
            priceNote="Setembro 2026 – Fevereiro 2027 · mesmas condições do plano aceite em janeiro de 2026"
            featuresTitle="O que está incluído"
            features={[
              "Auditorias regulares de SEO;",
              "SEO Roadmap personalizado — o plano de 6 meses desta proposta, com checkpoints em novembro e fevereiro;",
              "Otimização da velocidade do website;",
              "15 palavras-chave prioritárias — cluster de escoliose (Top 1–3) + frentes de serviço (pilates clínico, RPG, fisioterapia, massagem terapêutica, «perto de mim»);",
              "Blogs e landing pages personalizados — Pilates Clínico, RPG, zona, acordos e comparticipações, escoliose (SEAS, adultos, lombar, adolescentes);",
              "Otimização das imagens;",
              "300 backlinks + aquisição de domínios de referência de qualidade;",
              "SEO técnico — erros do Google Search Console e limpeza das páginas herdadas do site antigo;",
              "Google Analytics 4 + medição de contactos por canal (telefone, WhatsApp, formulário);",
              "Criação e instalação do chat widget; redirecionamento das leads para o CRM e emails comerciais, com notificação de sucesso para a lead;",
              "Perfil Google: marcação direta, revisão completa, posts semanais e fluxo de reviews;",
              "Monitorização da presença em IA (Searchable + AI Visibility) e otimização de citabilidade (AEO);",
              "Relatório mensal (SEO) + relatórios trimestrais em novembro e fevereiro;",
              <><strong>NOVO · Configuração e ligação do CRM</strong> (valor médio {CRM_VALUE}) — <strong>incluído</strong>.</>,
            ]}
            extraTitle="On-Page SEO incluído"
            extra={[
              "Titulação otimizada das páginas;",
              "Construção de links internos;",
              "Construção de links externos;",
              "Otimização dos URLs;",
              "Títulos e descrições meta;",
              "Alt tags para as imagens;",
              "Plataforma WonderAds.",
            ]}
          />
          <PriceCard
            eyebrow="Alternativa · Para uma fase de expansão"
            name="Plano Avançado"
            price="Sob consulta"
            priceNote="Para trabalhar até 3 serviços/valências em simultâneo"
            intro={
              <Bullets
                items={[
                  "Mais palavras-chave trabalhadas, o que garante maior presença no Google em várias áreas.",
                  "Maior previsibilidade de crescimento, com várias fontes de leads qualificadas.",
                  "Ideal para clínicas em fase de expansão — por exemplo, se a reabilitação desportiva entrar no plano.",
                ]}
              />
            }
            featuresTitle="O que está incluído"
            features={[
              "Equipa com histórico comprovado em +10 indústrias, incluindo Saúde e Bem-Estar;",
              "Contacto direto com C-Level;",
              "Marketing digital centralizado;",
              "Relatórios transparentes;",
              "Aumento das leads orgânicas — plano SEO;",
              "Geração de leads via anúncios;",
              "Campanhas no topo e no fundo do funil;",
              "Sistemas de IA para automatizar tarefas;",
              "Software «Missed-Call Text-Back»;",
              "Landing pages;",
              "Automatização de emails e nutrição de leads;",
              "Plataforma WonderAds.",
            ]}
          />
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-black/8 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[15px] font-semibold text-black/85">Tudo centralizado numa plataforma</p>
            <p className="mt-1 text-[13px] text-black/60">
              Contactos, CRM, automações, relatórios e chat widget num só sítio — a plataforma WonderAds.
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[12px] text-black/50">Custo isolado da plataforma à parte</p>
            <p className="text-[15px] font-semibold text-black/80">97 €/mês · <GradientText>incluída em qualquer plano</GradientText></p>
          </div>
        </div>

        <Callout title="Importância">
          A Fisio Restelo vai continuar a ter um aumento consistente e confiável do fluxo de tráfego orgânico — agora sobre uma base que já está paga e a render. Vai reforçar a reputação da marca, o conhecimento e a imagem social. E vamos gerar mais leads qualificadas de forma automatizada, que se tornam em pacientes de alto valor todos os meses — sem terem de se preocupar com nada de marketing.
        </Callout>
      </Section>

      {/* ============ 7. GOVERNANÇA ============ */}
      <Section
        id="acompanhamento"
        eyebrow="Governança do plano"
        title="7. Como acompanhamos"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-xl border border-black/8 bg-white p-5">
            <p className="text-[15px] font-semibold text-black/85">Do lado da WonderAds</p>
            <Bullets
              items={[
                <><strong>Cadência:</strong> reunião mensal de acompanhamento de 30 minutos e relatório trimestral formal em novembro e fevereiro. Formato fixo — metas contra baselines, sem alteração de critérios a meio.</>,
                <><strong>Checkpoints com decisão:</strong> em novembro, qualquer indicador fora da trajetória gera uma decisão de realocação tomada e registada nessa reunião.</>,
                <><strong>Fontes de dados fixas:</strong> Search Console, Semrush, Searchable, CRM e medição do site — os mesmos instrumentos do início ao fim.</>,
                <><strong>Tempo de resposta:</strong> resposta a qualquer contacto da clínica dentro de 30 minutos em horário útil.</>,
              ]}
            />
          </div>
          <div className="rounded-xl border border-black/8 bg-white p-5">
            <p className="text-[15px] font-semibold text-black/85">Do lado da Fisio Restelo</p>
            <p className="mt-1 text-[13px] text-black/55">
              O plano foi desenhado para minimizar a carga sobre a equipa clínica. O que é pedido limita-se a quatro pontos:
            </p>
            <Bullets
              items={[
                "Aprovação de conteúdos em até 5 dias úteis (Sandrina ou Milene), para manter a cadência de publicação.",
                "Revisão clínica de 30 minutos por semana do conteúdo técnico — o compromisso já assumido no onboarding.",
                "Inclusão do convite à avaliação no acompanhamento pós-alta por WhatsApp — uma frase acrescentada a um contacto que já existe.",
                "Acesso de gestão ao perfil Google e à ferramenta de medição no Mês 1 (e 1 sessão de formação do CRM).",
              ]}
            />
          </div>
        </div>
      </Section>

      {/* ============ 8. RISCO ZERO ============ */}
      <Section id="garantia" eyebrow="Garantia" title="8. Risco zero">
        <div className="avoid-break rounded-2xl p-[2px]" style={{ background: BRAND_GRADIENT }}>
          <div className="grid gap-6 rounded-[15px] bg-white px-6 py-7 sm:grid-cols-[1.2fr_1fr] sm:px-8">
            <div>
              <p className="text-2xl font-semibold leading-snug tracking-tight text-black/88 sm:text-3xl">
                Se não estiver satisfeito com alguma coisa — seja em 30 segundos ou 30 dias — devolvemos o valor na totalidade.
              </p>
            </div>
            <div className="border-t border-black/8 pt-5 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#5b21b6]">
                30 dias de garantia
              </p>
              <CheckList
                items={[
                  "Os melhores resultados que já teve.",
                  "O melhor serviço que já teve.",
                  "A maior transparência que já teve.",
                ]}
              />
            </div>
          </div>
        </div>
      </Section>

      {/* ============ 9. PRÓXIMOS PASSOS ============ */}
      <Section id="proximos-passos" eyebrow="Para avançar" title="9. Próximos passos">
        <div className="grid gap-3 sm:grid-cols-3">
          <GoalCard n="1" title="Confirmar a renovação" text="Uma resposta por email chega. As condições são as desta página; a fatura segue com o arranque do Mês 1." />
          <GoalCard n="2" title="Mês 1 arranca em setembro" text="Medição de contactos e CRM ligados, baselines documentadas e as páginas de Pilates Clínico e RPG publicadas." />
          <GoalCard n="3" title="Primeiro checkpoint em novembro" text="Relatório T1 com contactos por canal de origem — a primeira vez que o SEO é medido em pacientes, não só em visitas." />
        </div>
        <div className="no-print mt-6 flex flex-col gap-3 sm:flex-row">
          <a
            href={confirmHref}
            className="inline-flex items-center justify-center rounded-lg px-6 py-3 text-[14px] font-semibold text-white shadow-lg shadow-[#783DF5]/25 transition hover:brightness-110"
            style={{ background: BRAND_GRADIENT }}
          >
            Confirmar a renovação
          </a>
          <a
            href={talkHref}
            className="inline-flex items-center justify-center rounded-lg border border-black/15 bg-white px-6 py-3 text-[14px] font-semibold text-black/75 transition hover:border-black/30 hover:text-black"
          >
            Falar com {consultantName.split(" ")[0]}
          </a>
        </div>

        <details className="mt-10 rounded-xl border border-black/8 bg-white/70 px-5 py-4 text-[12.5px] leading-relaxed text-black/60">
          <summary className="cursor-pointer text-[13px] font-semibold text-black/75">Nota metodológica — fontes e períodos</summary>
          <Bullets
            items={[
              "Pesquisa Google (cliques, impressões, posições): série mensal de fevereiro a julho de 2026, com meses completos. Os totais de 1.056 cliques e 33.410 impressões correspondem à janela móvel dos últimos 6 meses fechada a 24 de agosto de 2026, e por isso não coincidem com a soma da tabela mensal.",
              "Separação entre pesquisas de marca e de serviço: apurada sobre as 1.000 pesquisas com maior volume do período.",
              "Perfil da clínica no Google (chamadas, direções, cliques): março a julho de 2026.",
              "Comportamento no site: desde a ativação da medição, no final de abril de 2026, até 3 de agosto.",
              "Palavras-chave, Authority Score, domínios de referência e AI Visibility: Semrush, Domain Overview de 24 de agosto de 2026.",
              "Menções em respostas de IA: Searchable, medição de julho de 2026 sobre 10 prompts não-branded.",
              "Valor equivalente em mídia paga: estimativa de ferramenta de mercado, usada como indicador de tendência e não como valor contabilístico.",
              "Projeções de contactos e valor: estimativas com premissas declaradas, a recalibrar no checkpoint de novembro com dados de medição real.",
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
    { id: "garantia", label: "Garantia" },
  ],
  hero: {
    eyebrow: "Proposta de Renovação · Set 2026 – Fev 2027",
    title: "Fisio Restelo",
    subtitle:
      "Seis meses construíram a base: o site passou a ser encontrado, a marca consolidou-se e a clínica já é citada por assistentes de IA. Os próximos seis levam essa base ao topo — e traduzem-na em pacientes marcados.",
    context: (
      <>
        A parceria arrancou em <strong>fevereiro de 2026</strong>, com a proposta aceite em janeiro. Este documento fecha o primeiro ciclo com os resultados medidos, apresenta o plano dos próximos 6 meses e as condições de renovação — incluindo o foco em <strong>escoliose no Top 1–3</strong> do Google e a <strong>configuração e ligação do CRM</strong>, sem custo adicional.
      </>
    ),
    stats: [
      { value: "1.056", label: "cliques na Pesquisa Google", sub: "últimos 6 meses" },
      { value: "299", label: "chamadas via perfil Google", sub: "março a julho" },
      { value: "714", label: "pedidos de direções", sub: "março a julho" },
      { value: "57", label: "formulários submetidos", sub: "97% de conclusão" },
    ],
  },
  Body,
};
