import Link from "next/link";
import {
  ArrowLeft,
  Activity,
  Smile,
  TrendingUp,
  HeartHandshake,
  Target,
  Award,
  Info,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";

export const metadata = {
  title: "SEO DPT KPIs — Wonder Ads Workspace",
};

const PILLAR_1_KPIS = [
  "NPS Score do cliente — Rating de satisfação preenchido pelo cliente",
  "Ausência de erros críticos que causem crise ou confusão",
  "Updates semanais entregues com clareza (5ª ou 6ª feira)",
  "Monthly calls de SEO realizadas com o cliente",
  "Tempo de resposta a dúvidas (< 24 horas)",
  "Taxa de resolução de questões na 1ª interação",
  "Relatório mensal completo enviado ao cliente",
];

const PILLAR_2_KPIS = [
  "Crescimento de tráfego orgânico (visitors vs mês anterior)",
  "% de keywords em top 50, top 10 e top 3 do Google",
  "Keywords com progresso de posição — quantas saltaram?",
  "Documentos entregues SEO-ready (blog posts, GMB posts, audits)",
  "Leads geradas organicamente (Google Searches) e AIs",
  "Revenue / ROI do cliente",
  "Otimizações técnicas (Core Web Vitals, crawlability, indexação)",
  "Backlinks de qualidade criados",
];

const PILLAR_3_KPIS = [
  "Liderança em calls de SEO com os 5 projetos",
  "Problem-solving independente — sem escalar",
  "Qualidade de documentação enviada ao cliente",
  "Conhecimento técnico atualizado (algoritmos, AIs, tendências)",
  "Cumprimento de deadlines internos (Miro roadmap, tarefas)",
  "Mentorias a consultores juniores",
  "Inovação — propostas de estratégias novas e testes",
];

const TEAM_LEADER_CRITERIA = [
  "Score geral ≥ 2.33 / 3.0",
  "Pilar 3 (Cultura & Leadership) com score ≥ 2.5",
  "Mentalidade de mentor — ajuda outros sem deixar os seus projetos",
  "Proatividade em propor estratégias novas",
  "Consistência — scores elevados em múltiplos meses",
  "Energia e alinhamento alto com os valores da empresa",
];

const COO_NOTES = [
  "Este framework é mensalmente revisitado para calibração. Esta versão está em vigor mas pode ter alterações — irei avisar caso haja.",
  "Darei feedback individual a cada consultor após avaliação e estarei sempre disponível para qualquer questão ou problema.",
  "Áreas de melhoria devem ser melhoradas e não devem criar atrito — não é esse o objetivo.",
  "Histórico de scores e frameworks como esta ajudam a identificar gaps de conhecimento para novas pessoas na equipa.",
];

export default function SeoKpisPage() {
  return (
    <PageShell>
      <Link
        href="/seo"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to SEO DPT
      </Link>

      <section className="animate-fade-up mt-10 flex flex-col items-start gap-6 sm:mt-14">
        <div className="relative">
          <div
            className="brand-gradient-bg flex h-16 w-16 items-center justify-center rounded-2xl shadow-[0_10px_40px_-8px_rgba(120,61,245,0.7)]"
            aria-hidden
          >
            <Activity className="h-7 w-7 text-white" strokeWidth={2.25} />
          </div>
          <div
            aria-hidden
            className="absolute inset-0 -z-10 rounded-2xl opacity-60 blur-2xl"
            style={{ background: "var(--brand-gradient)" }}
          />
        </div>

        <div>
          <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/70">
            Framework
          </span>
          <h1 className="mt-3 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            <span className="brand-gradient-text">
              Avaliação Mensal de Performance
            </span>
          </h1>
          <p className="mt-3 max-w-2xl text-base text-white/65 sm:text-lg">
            KPIs do Departamento de SEO · WonderAds
          </p>
        </div>
      </section>

      <Section
        title="1. Objetivos da Framework"
        Icon={Target}
        delay={0.15}
      >
        <p className="text-white/75">
          Este documento define o framework de avaliação mensal de performance
          dos consultores de SEO. O objetivo é identificar:
        </p>
        <ul className="mt-4 space-y-2 text-white/75">
          {[
            "Consultores com melhor performance geral",
            "Garantir satisfação do cliente e entrega de resultados",
            "Áreas de melhoria e desenvolvimento por consultor",
            "Candidatos à posição de Team Leader e a Bónus Trimestral",
          ].map((item) => (
            <Bullet key={item}>{item}</Bullet>
          ))}
        </ul>
        <p className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/75">
          O objetivo nº5, o mais importante, é entender as falhas e melhorar,
          não desanimar. Queremos ser a melhor equipa e portanto agência de SEO
          em Portugal — isto é a estrutura interna para tal.
        </p>
      </Section>

      <Section
        title="2. Os Três Pilares de Avaliação"
        Icon={Award}
        delay={0.2}
      >
        <p className="text-white/75">
          A avaliação estrutura-se em 3 pilares de KPIs com igual importância
          (33.3% cada). Mensalmente, cada consultor tem uma classificação em
          cada pilar. Ao final de cada trimestre, agrega-se a média dos 3 meses
          — o score trimestral determina a elegibilidade para o bónus
          trimestral.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <PillarCard
            number="1"
            title="Client Satisfaction"
            weight="33.3%"
            emoji="😀"
            Icon={Smile}
            kpis={PILLAR_1_KPIS}
            description="Avalia a satisfação e a experiência do cliente durante o mês."
          />
          <PillarCard
            number="2"
            title="Client Delivery"
            weight="33.3%"
            emoji="📈"
            Icon={TrendingUp}
            kpis={PILLAR_2_KPIS}
            description="Avalia os resultados entregues aos clientes."
          />
          <PillarCard
            number="3"
            title="Cultura & Leadership"
            weight="33.3%"
            emoji="🤎"
            Icon={HeartHandshake}
            kpis={PILLAR_3_KPIS}
            description="Cultura, comunicação, liderança, conhecimento técnico e desenvolvimento."
          />
        </div>
      </Section>

      <Section
        title="3. Escala de Avaliação"
        Icon={Target}
        delay={0.25}
      >
        <p className="text-white/75">
          Cada KPI dos pilares é avaliado em 3 níveis:
        </p>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              level: "Abaixo do Esperado",
              desc: "Não atendeu aos objetivos. Necessária melhoria.",
              value: "1 valor",
            },
            {
              level: "Esperado",
              desc: "Atendeu aos objetivos conforme esperado.",
              value: "2 valores",
            },
            {
              level: "Acima do Esperado",
              desc: "Superou objetivos com alta qualidade ou inovação.",
              value: "3 valores",
            },
          ].map((row) => (
            <div
              key={row.level}
              className="brand-gradient-border rounded-xl bg-white/[0.035] p-4 backdrop-blur-md"
            >
              <p className="text-xs uppercase tracking-[0.15em] text-white/45">
                {row.level}
              </p>
              <p className="mt-2 text-sm text-white/80">{row.desc}</p>
              <p className="mt-3 text-sm font-semibold text-white">
                <span className="brand-gradient-text">{row.value}</span>
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-white/80">
          <p>
            <span className="font-semibold">Score Final Mês</span> = (Pilar 1 +
            Pilar 2 + Pilar 3) / 3
          </p>
          <p className="mt-2 text-white/65">
            Score Trimestre = média dos scores dos 3 meses
          </p>
        </div>
      </Section>

      <Section
        title="4. Critérios para Candidato a Team Leader"
        Icon={Award}
        delay={0.3}
      >
        <p className="text-white/75">
          Um consultor deve reunir os seguintes critérios para ser considerado
          candidato a Team Leader:
        </p>
        <ul className="mt-4 space-y-2 text-white/75">
          {TEAM_LEADER_CRITERIA.map((item) => (
            <Bullet key={item}>{item}</Bullet>
          ))}
        </ul>
      </Section>

      <Section
        title="5. Notas Adicionais do COO"
        Icon={Info}
        delay={0.35}
      >
        <ul className="space-y-2 text-white/75">
          {COO_NOTES.map((note) => (
            <Bullet key={note}>{note}</Bullet>
          ))}
        </ul>
        <p className="mt-6 text-sm text-white/55">
          Obrigado e até já! —{" "}
          <a
            href="mailto:andre@wonder-ads.com"
            className="brand-gradient-text font-semibold hover:underline"
          >
            andre@wonder-ads.com
          </a>
        </p>
      </Section>
    </PageShell>
  );
}

function Section({
  title,
  Icon,
  children,
  delay = 0.2,
}: {
  title: string;
  Icon: typeof Target;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <section
      className="animate-fade-up mt-14 sm:mt-20"
      style={{ animationDelay: `${delay}s` }}
    >
      <header className="mb-6 flex items-center gap-3">
        <span
          aria-hidden
          className="brand-gradient-bg flex h-8 w-8 items-center justify-center rounded-lg shadow-[0_6px_20px_-4px_rgba(120,61,245,0.55)]"
        >
          <Icon className="h-4 w-4 text-white" strokeWidth={2.25} />
        </span>
        <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
          {title}
        </h2>
      </header>
      <div>{children}</div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="brand-gradient-bg mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
      />
      <span>{children}</span>
    </li>
  );
}

function PillarCard({
  number,
  title,
  weight,
  emoji,
  Icon,
  kpis,
  description,
}: {
  number: string;
  title: string;
  weight: string;
  emoji: string;
  Icon: typeof Smile;
  kpis: string[];
  description: string;
}) {
  return (
    <article className="brand-gradient-border relative flex flex-col rounded-2xl bg-white/[0.04] p-6 backdrop-blur-md">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-30 blur-3xl"
        style={{ background: "var(--brand-gradient)" }}
      />

      <div className="relative z-10 flex items-center justify-between">
        <span
          aria-hidden
          className="brand-gradient-bg flex h-10 w-10 items-center justify-center rounded-xl shadow-[0_6px_24px_-4px_rgba(120,61,245,0.55)]"
        >
          <Icon className="h-5 w-5 text-white" strokeWidth={2.25} />
        </span>
        <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/65">
          {weight}
        </span>
      </div>

      <div className="relative z-10 mt-5">
        <p className="text-xs uppercase tracking-[0.18em] text-white/45">
          Pilar nº {number}
        </p>
        <h3 className="mt-1 text-xl font-semibold tracking-tight text-white">
          {title} <span aria-hidden>{emoji}</span>
        </h3>
        <p className="mt-2 text-sm text-white/65">{description}</p>
      </div>

      <ul className="relative z-10 mt-5 space-y-2 text-sm text-white/75">
        {kpis.map((kpi) => (
          <li key={kpi} className="flex gap-2.5">
            <span
              aria-hidden
              className="brand-gradient-bg mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
            />
            <span>{kpi}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
