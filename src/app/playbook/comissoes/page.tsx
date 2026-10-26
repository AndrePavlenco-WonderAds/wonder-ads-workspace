// /playbook/comissoes — comissões da equipa de Delivery (v78.5).
//
// Texto: «Renovações — Programa de Crescimento Orgânico», outubro 2026.
// O tracking do topo lê as propostas aceites do COMMERCIAL DPT
// (lib/playbook/commissions-server.ts); as tabelas de taxas e patamares
// desenham-se das mesmas constantes que fazem as contas.

import { PageShell } from "@/components/page-shell";
import {
  BlockTabs,
  Bullets,
  Callout,
  DocHeader,
  DocToc,
  PlaybookClosed,
  RuleTable,
  Section,
  SubTitle,
} from "@/components/playbook/doc-ui";
import { CommissionsTracker } from "@/components/playbook/commissions-tracker";
import { formatDate } from "@/lib/dates";
import { getPlaybookContext } from "@/lib/playbook/server";
import { buildCommissionsBoard } from "@/lib/playbook/commissions-server";
import { COMMISSION_TIERS, RENEWAL_RATE, formatRate } from "@/lib/playbook/commissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Comissões — Playbook",
};

const BLOCK_ID = "remuneracao-variavel";

const TOC = [
  { id: "tracking", label: "O teu patamar" },
  { id: "resumo", label: "Resumo" },
  { id: "renovacao", label: "Regras de renovação" },
  { id: "pagamento", label: "Condições de pagamento" },
  { id: "comissoes", label: "Comissões" },
  { id: "cross-sells", label: "Cross-sells" },
  { id: "referencias", label: "Casos de referência" },
  { id: "upsells", label: "Upsells" },
  { id: "meios", label: "Anexo · Meios" },
];

const LOW = formatRate(COMMISSION_TIERS[0].rate);
const HIGH = formatRate(COMMISSION_TIERS[COMMISSION_TIERS.length - 1].rate);
const RANGE = `${LOW} a ${HIGH}`;
const RENEWAL = formatRate(RENEWAL_RATE);

const A = "text-[#c4a6ff] underline-offset-2 hover:text-white hover:underline";

const WEBSITES: Array<[string, string, string]> = [
  ["Paulo Malo Dental", "https://paulomalo.pt/", "Malo Dental, com mais de 16 clínicas"],
  ["Bambuse Clinic", "https://bambuse.pt/", "Clínica de estética"],
  ["Quantum Global Care", "https://quantum.pt/", "Clínica de wellness e longevidade"],
  ["FaceMi", "https://face-mi.com", "Medicina estética: de 50 para mais de 470 reviews no Google"],
  ["FisioRestelo", "https://fisiorestelo.pt/", "Fisioterapia: de 20 para 220 reviews no Google"],
  ["SportsGuard", "https://sportsguard.com/", "Proteção dental desportiva"],
  ["Abbey Dental Supplies", "https://www.abbeydentalsupplies.com/", "Distribuidor dentário no Reino Unido"],
  ["Institute of Holistic Nutrition", "https://instituteofholisticnutrition.com/", "Universidade no Canadá: mais de 200 leads/mês só com SEO"],
  ["Kings Gyms", "https://kingsgyms.com/", "Cadeia de ginásios + eCommerce"],
  ["JHOMEA Invest", "https://jhomea.com/", "Agência imobiliária"],
  ["Blooming Skin", "https://bloomingskin.pt/", "Clínica de estética com 5 localizações; vende skincare online e em loja"],
];

const TV: Array<[string, string]> = [
  ["RTP", "Praça da Alegria · A Nossa Tarde · Portugal em Rede · Jornais Informativos"],
  ["RTP 2", "Sociedade Civil"],
  ["RTP Notícias", "Jornais Informativos"],
  ["RTP Madeira / RTP Açores", "Madeira Viva · Olhar Clínico"],
  ["SIC", "Casa Feliz · Júlia · Alô Portugal · Jornais Informativos"],
  ["SIC Notícias", "Jornais Informativos"],
  ["SIC Mulher", "Médico da Casa · What's Up TV · Chica Esperta"],
  ["SIC Radical", "Curto Circuito"],
  ["TVI", "Diário da Manhã · Dois às 10 · Em Família · Jornais Informativos"],
  ["CNN Portugal", "Jornais Informativos"],
  ["V+", "Bom Dia Alegria · Para Si"],
  ["CMTV", "Olá, Bom Dia · Jornais Informativos"],
  ["NOW", "Jornais Informativos"],
  ["Porto Canal", "Consultório · Por Perto · Filhos & Cadilhos"],
  ["Record TV", "Fala Portugal"],
  ["Conta Lá", "Intercidades · Jornais Informativos"],
];

const MEDIA_GROUPS: Array<[string, string[]]> = [
  [
    "Jornais e revistas",
    [
      "Correio da Manhã", "Jornal de Notícias / Notícias Magazine", "Diário de Notícias", "Público", "Expresso",
      "Observador", "Sábado / Domingo", "Vogue / Esquire Portugal", "Visão / Visão Saúde",
      "Men's Health / Women's Health", "Saúde e Bem Estar", "Lux Woman", "Saber Viver",
      "Revista Mariana / TOP Novelas / TV Já", "Jornal Nascer do Sol / Revista i", "VIP", "Máxima / Must",
      "Business Portugal", "Exklusiva", "Forbes", "Luso Jornal",
    ],
  ],
  ["Rádios", ["Renascença", "Comercial", "Observador", "M80", "Mega Hits", "Rádio CMR (Correio da Manhã)", "Outras rádios regionais"]],
  [
    "Podcasts e videocasts",
    [
      "«Diz-me Lá»", "«Conversas Saudáveis»", "«Consulta Aberta»", "«Inteligência Emocional»", "«Somos Todos Malucos»",
      "Outros de empresas e particulares",
    ],
  ],
  [
    "Sites",
    [
      "NIT", "MAGG", "Versa", "Notícias ao Minuto", "Atlas da Saúde", "Sapo Lifestyle", "Saúde Online", "CNN Portugal",
      "SIC Notícias", "Conta Lá", "Viral", "HealthNews", "Líder Magazine", "Hall Magazine", "Motivo", "Blog Eu Sou Gira",
      "Alguns sites internacionais",
    ],
  ],
  [
    "Eventos",
    [
      "Selfcare Market & Summit", "Foyer Health & Beauty Summit", "Eventos, palestras, workshops e congressos",
      "Outros eventos na área da saúde (editoriais e comerciais)",
    ],
  ],
];

function Chips({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((m) => (
        <li key={m} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[12px] text-white/70">
          {m}
        </li>
      ))}
    </ul>
  );
}

const b = (s: string) => <strong className="text-white">{s}</strong>;

export default async function ComissoesPage() {
  const ctx = await getPlaybookContext(BLOCK_ID);
  if (ctx.state === "no-session") return null;
  if (ctx.state !== "ok" || !ctx.block) {
    return (
      <PageShell backHref="/playbook" backLabel="Playbook">
        <PlaybookClosed
          kind={ctx.state === "closed" ? "closed" : "forbidden"}
          name={ctx.state === "closed" ? ctx.name : ctx.state === "forbidden" ? ctx.reader.name : ""}
        />
      </PageShell>
    );
  }

  const { reader, block } = ctx;
  const board = await buildCommissionsBoard();
  const mine = board.find((r) => r.username === reader.username) ?? null;
  const myTierIndex = reader.isAdmin ? null : COMMISSION_TIERS.findIndex((t) => t.n === (mine?.tier.n ?? 1));

  return (
    <PageShell backHref="/playbook" backLabel="Playbook">
      <div className="grid gap-10 xl:grid-cols-[1fr_11rem]">
        <div className="min-w-0">
          <DocHeader
            eyebrow={`Playbook · ${block.title}`}
            title="Comissões"
            lead={
              <>
                Ganhas sobre o que fechas. Renovações: {b(`${RENEWAL} fixos`)}. Cross-sells e upsells: {b(RANGE)},
                conforme o teu patamar.
              </>
            }
            meta={<>Atualizado {formatDate(block.updatedAt)} · SuperAdmin + {block.audienceLabel}</>}
          />
          <BlockTabs pages={block.pages} current="/playbook/comissoes" />

          <div className="mt-10 space-y-10">
            <section id="tracking" className="animate-fade-up scroll-mt-24">
              <CommissionsTracker board={board} viewAll={reader.isAdmin} username={reader.username} />
            </section>

            <Section id="resumo" n="01" title="Resumo">
              <RuleTable
                head={["Tema", "Regra"]}
                rows={[
                  ["Duração da renovação", "6 meses (standard) · 12 meses só com pré-pagamento"],
                  ["Downsell para 3 meses", "Só com aprovação do Diretor de Delivery"],
                  ["Desconto PIF", "6 meses: 5% · 12 meses: 10%"],
                  ["Comissão", `Renovações: ${RENEWAL} fixos · Cross-sells e upsells: ${RANGE} (por patamar)`],
                  ["Base da comissão", "Valor faturado sem IVA (ou a margem, nos serviços com custo externo)"],
                  ["Pagamento da comissão", "PIF: após os 30 dias do período de reembolso · Mensal: à medida que o cliente paga"],
                  ["Cross-sells", "Google Ads · Meta Ads · CRM (auditoria gratuita nos três) · Websites e apps / plataformas"],
                  ["Upsells", "PR / Imprensa · Wikipedia · Expansão do programa"],
                ]}
              />
            </Section>

            <Section id="renovacao" n="02" title="Regras de renovação">
              <RuleTable
                head={["Duração", "Regra"]}
                rows={[
                  ["6 meses", "O standard. Toda a renovação é proposta a 6 meses por defeito."],
                  ["12 meses", "Só com pagamento integral antecipado. 10% de desconto sobre o total dos 12 meses."],
                  [
                    "3 meses (downsell)",
                    "Exceção, quando o projeto o justifica. Precisa de aprovação do Diretor de Delivery ANTES de chegar ao cliente. Sem aprovação, fica a 6 meses.",
                  ],
                ]}
              />
            </Section>

            <Section id="pagamento" n="03" title="Condições de pagamento">
              <RuleTable
                head={["Modalidade", "Condição"]}
                rows={[
                  ["PIF 12 meses", "10% de desconto sobre o total dos 12 meses"],
                  ["PIF 6 meses", "5% de desconto sobre o total dos 6 meses"],
                  ["Mensal (6 meses)", "Preço sem desconto, pago mês a mês"],
                ]}
              />
              <Callout>
                {b("Apresenta sempre o PIF primeiro, começando pelos 12 meses.")} O dinheiro entra à cabeça e o cliente
                fica comprometido mais tempo.
              </Callout>
            </Section>

            <Section
              id="comissoes"
              n="04"
              title="Comissões"
              lead={`Comissão individual sobre o que fechas. Renovações pagam ${RENEWAL} fixos — é receita que já existia. Cross-sells e upsells são receita nova e pagam ${RANGE}, conforme o patamar.`}
            >
              <SubTitle>Taxa e base de cálculo</SubTitle>
              <RuleTable
                head={["Negócio", "Comissão", "Base de cálculo"]}
                rows={[
                  ["Renovação", `${RENEWAL} fixos`, "Valor faturado sem IVA, já com o desconto PIF"],
                  ["Cross-sell: Google Ads", RANGE, "Fee de agência faturada, sem IVA. O ad spend não conta."],
                  ["Cross-sell: Meta Ads", RANGE, "Fee de agência faturada, sem IVA. O ad spend não conta. Com criativos externos, desconta-se o custo da produção."],
                  ["Cross-sell: CRM", RANGE, "Margem: valor faturado sem IVA − custo de execução"],
                  ["Cross-sell: websites", RANGE, "Valor faturado sem IVA"],
                  ["Cross-sell: apps / plataformas (com parceiro)", RANGE, "Margem: valor faturado sem IVA − custo do parceiro"],
                  ["Upsell: PR / Imprensa, Wikipedia", RANGE, "Margem: valor faturado sem IVA − custo do parceiro"],
                  ["Upsell: expansão do programa", RANGE, "Valor faturado sem IVA"],
                ]}
              />

              <SubTitle>Quando recebes</SubTitle>
              <RuleTable
                head={["O cliente paga", "A comissão é paga"]}
                rows={[
                  ["Pré-pagamento (PIF)", "De uma vez, após os 30 dias do período de reembolso"],
                  [
                    "Mensal",
                    "Mês a mês, à medida que o cliente paga cada mensalidade (a 1.ª após os 30 dias de reembolso). Se o cliente deixar de pagar, a comissão desses meses não é paga.",
                  ],
                ]}
              />

              <SubTitle>Patamares (cross-sells e upsells)</SubTitle>
              <RuleTable
                head={["Patamar", "Faturação acumulada, sem IVA", "Comissão"]}
                highlight={myTierIndex}
                rows={COMMISSION_TIERS.map((t) => [
                  t.n === 1 ? "1 · Base" : String(t.n),
                  t.to === null
                    ? `Acima de ${t.from.toLocaleString("de-DE")} €`
                    : t.from === 0
                      ? `Até ${t.to.toLocaleString("de-DE")} €`
                      : `${t.from.toLocaleString("de-DE")} € a ${t.to.toLocaleString("de-DE")} €`,
                  formatRate(t.rate),
                ])}
              />
              <Bullets
                items={[
                  <>As renovações {b("contam para subir de patamar")}, mas são sempre pagas a {RENEWAL}.</>,
                  <>O acumulado é {b("individual")}, por consultor.</>,
                  <>A % de cada cross-sell ou upsell é a do patamar em que estás {b("no momento em que o fechas")}.</>,
                  <>Ao subir, a nova % vale para os negócios seguintes. {b("Não é retroativa.")}</>,
                ]}
              />

              <SubTitle>Exemplo 1 — renovação com fee de 2.500 €/mês sem IVA</SubTitle>
              <RuleTable
                head={["", "PIF 12 meses", "PIF 6 meses", "Mensal 6 meses"]}
                rows={[
                  ["Valor de tabela", "30.000 €", "15.000 €", "15.000 €"],
                  ["Desconto", "− 3.000 € (10%)", "− 750 € (5%)", "—"],
                  ["Valor faturado sem IVA", "27.000 €", "14.250 €", "15.000 €"],
                  [`Comissão (${RENEWAL})`, b("810,00 €"), b("427,50 €"), <>{b("450,00 €")} (75 €/mês)</>],
                  ["Pagamento", "Ao dia 30, após reembolso", "Ao dia 30, após reembolso", "75 € por mensalidade paga"],
                ]}
              />

              <SubTitle>Exemplo 2 — subida de patamar</SubTitle>
              <RuleTable
                head={["Momento", "Negócio (sem IVA)", "Acumulado", "Patamar", "Comissão"]}
                rows={[
                  ["Antes", "—", "48.000 €", "2 · 6%", "—"],
                  ["Fecha renovação", "PIF 6 meses: 14.250 €", "62.250 €", "3 · 7%", `427,50 € (${RENEWAL})`],
                  ["Fecha cross-sell", "Google Ads, 6 × 1.000 € de fee", "68.250 €", "3 · 7%", "420,00 € (70 €/mês)"],
                ]}
              />
              <p className="text-[12.5px] leading-relaxed text-white/50">
                A renovação leva-te ao patamar 3, mas é paga a {RENEWAL}. O cross-sell seguinte já é pago a 7%, mês a mês,
                à medida que o cliente paga.
              </p>
            </Section>

            <Section
              id="cross-sells"
              n="05"
              title="Cross-sells a procurar"
              lead="Em cada renovação, vê se o cliente tem potencial para um destes. Todos contam para a comissão e para o patamar."
            >
              <RuleTable
                head={["Serviço", "Investimento mínimo", "Para a conversa"]}
                rows={[
                  [
                    "Google Ads",
                    "2.000 €/mês (1.000 € fee + 1.000 € ad spend mínimo)",
                    <Bullets
                      key="g"
                      items={[
                        "Serviço mais técnico e um dos nossos pontos fortes.",
                        "Diretor de Anúncios com 10 anos de carreira e mais de 10 M€ geridos em ad spend.",
                        "Especialidade em lead generation; também fazemos eCommerce.",
                        "Temos contactos dentro da rede Google.",
                        "Auditoria gratuita da conta.",
                      ]}
                    />,
                  ],
                  [
                    "Meta Ads",
                    "2.000 €/mês (1.000 € fee + 1.000 € ad spend mínimo)",
                    <Bullets
                      key="m"
                      items={[
                        "Auditoria gratuita da conta.",
                        "Não fazemos captação de imagem nem vídeo: precisa de parceiro (externo ou interno) para X criativos/mês, consoante o investimento.",
                      ]}
                    />,
                  ],
                  [
                    "CRM",
                    "Orçamento personalizado",
                    <Bullets
                      key="c"
                      items={[
                        "Instalação de raiz ou melhoria do sistema existente.",
                        "Auditoria gratuita do sistema atual, sempre antes de orçamentar.",
                        "Programa de 3 meses.",
                      ]}
                    />,
                  ],
                  [
                    "Websites e apps / plataformas",
                    "Orçamento personalizado",
                    <Bullets
                      key="w"
                      items={[
                        "Vários websites, incluindo com custom code.",
                        "Apps e plataformas fazemos menos, mas temos parceiros que as desenvolvem.",
                        "Portefólio na secção 06.",
                      ]}
                    />,
                  ],
                ]}
              />
              <Callout>
                {b("A auditoria gratuita é a porta de entrada.")} Google Ads, Meta Ads e CRM. As de anúncios são feitas
                pelo nosso Diretor de Anúncios, Hugo —{" "}
                <a href="mailto:hugo@wonder-ads.com" className={A}>
                  hugo@wonder-ads.com
                </a>
                .
              </Callout>
            </Section>

            <Section
              id="referencias"
              n="06"
              title="Casos de referência"
              lead="Clientes com quem já fizemos cada serviço. Menciona-os — sobretudo se forem do mesmo setor."
            >
              <RuleTable
                head={["Serviço", "Clientes"]}
                rows={[
                  ["CRM", "White Clinic · IFA · IHN · Abbey Dental Supplies"],
                  ["Google Ads", "White Clinic · António Gaspar · PhysioHub · MyDermaCare · IHN · IFA"],
                  ["Meta Ads", "White Clinic · IHN · IFA · InSync Design · Wellnest Nutrition"],
                ]}
              />
              <p className="text-[13px] text-white/60">
                Para enviar ao cliente:{" "}
                <a href="https://wonder-ads.com/testimonials/" target="_blank" rel="noreferrer" className={A}>
                  testemunhos no website
                </a>{" "}
                e{" "}
                <a
                  href="https://www.youtube.com/watch?v=-tJJ04qq6gA&list=PLmEMvmywC1OuVnDAKuqd6e03NxV_iL90q"
                  target="_blank"
                  rel="noreferrer"
                  className={A}
                >
                  playlist de casos no YouTube
                </a>
                .
              </p>
              <Callout>
                {b("Destaque CRM — White Clinic:")} ligámos o Newsoft ao CRM e todas as leads passaram a estar num só
                sistema. Usa este exemplo quando o cliente não sabe de onde vêm as leads nem o que lhes acontece.
              </Callout>

              <SubTitle>Websites que fizemos</SubTitle>
              <RuleTable
                head={["Cliente", "Sobre o cliente"]}
                dense
                rows={WEBSITES.map(([name, url, about]) => [
                  <a key={name} href={url} target="_blank" rel="noreferrer" className={A}>
                    {name}
                  </a>,
                  about,
                ])}
              />
            </Section>

            <Section id="upsells" n="07" title="Upsells" lead="Todos contam para a comissão e para o patamar.">
              <SubTitle>PR / Imprensa</SubTitle>
              <Bullets
                items={[
                  "TV, jornais, revistas, sites, rádios e podcasts — lista completa no anexo.",
                  "Dois modelos: avença mensal ou valor por presença em TV.",
                  "Orçamento personalizado, a partir de cerca de 500 €.",
                  "Incluídos: artigos e entrevistas em jornais, revistas e sites, e o clipping (o cliente usa nas redes e no site).",
                  "Jornais, revistas e sites: o nome da clínica aparece por norma. Em TV nem sempre — orientamos o especialista a referi-lo de forma natural.",
                  "Foco na área da saúde. Fora da saúde, caso a caso.",
                ]}
              />
              <Callout tone="warn">
                {b("Requisito:")} o cliente nomeia um ponto de contacto com resposta rápida. Os convites dos meios chegam
                muitas vezes de um dia para o outro e não esperam pelo fim do dia.
              </Callout>

              <SubTitle>Wikipedia</SubTitle>
              <Bullets
                items={[
                  "Depende da autoridade do cliente: exige cerca de 30 menções em jornais.",
                  "A partir de 750 € por língua.",
                  "Combina com PR / Imprensa, que gera as menções.",
                ]}
              />

              <SubTitle>Expansão do Programa de Crescimento Orgânico</SubTitle>
              <Bullets items={["Mais keywords trabalhadas.", "Mais áreas / serviços / localizações.", "Novos content pillars."]} />
            </Section>

            <Section
              id="meios"
              n="08"
              title="Anexo · Meios"
              lead="Onde conseguimos pôr os especialistas dos clientes. Alguns programas de TV aceitam participação online ou a partir de estúdios no Porto."
            >
              <details className="group rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <summary className="cursor-pointer list-none text-[13px] font-medium text-white marker:hidden">
                  Ver a lista completa <span className="text-white/40 group-open:hidden">({TV.length} canais de TV + imprensa, rádio, podcasts, sites e eventos)</span>
                </summary>
                <div className="mt-5 space-y-6">
                  <div className="space-y-3">
                    <SubTitle>Televisão</SubTitle>
                    <RuleTable head={["Canal", "Programas"]} dense rows={TV.map(([c, p]) => [c, p])} />
                  </div>
                  {MEDIA_GROUPS.map(([label, items]) => (
                    <div key={label} className="space-y-3">
                      <SubTitle>{label}</SubTitle>
                      <Chips items={items} />
                    </div>
                  ))}
                </div>
              </details>
            </Section>

            <p className="border-t border-white/[0.07] pt-6 text-[12px] text-white/40">
              Estes termos podem ser alterados e personalizados caso a caso. Dúvidas: Diretor de Operações.
            </p>
          </div>
        </div>
        <DocToc items={TOC} />
      </div>
    </PageShell>
  );
}
