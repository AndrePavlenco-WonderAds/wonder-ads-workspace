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
import { AccessDenied } from "@/components/access-denied";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";

export const metadata = {
  title: "SEO DPT KPIs — Wonder Ads Workspace",
};

const PILLAR_1_KPIS = [
  "Client NPS score — satisfaction rating filled out by the client",
  "Absence of critical errors that cause crisis or confusion",
  "Weekly updates delivered clearly (Thursday or Friday)",
  "Monthly SEO calls held with the client",
  "Response time to questions (< 24 hours)",
  "First-contact resolution rate (without escalating)",
  "Complete monthly report sent to the client",
];

const PILLAR_2_KPIS = [
  "Organic traffic growth (visitors vs previous month)",
  "% of keywords in top 50, top 10 and top 3 of Google",
  "Keywords with position progress — how many moved up",
  "SEO-ready documents delivered (blog posts, GMB posts, audits)",
  "Leads generated organically (Google Search and AIs)",
  "Client revenue / ROI",
  "Technical optimisations (Core Web Vitals, crawlability, indexing)",
  "Quality backlinks built",
];

const PILLAR_3_KPIS = [
  "Leadership on SEO calls across the consultant's 5 projects",
  "Independent problem-solving — without escalating",
  "Quality of documentation sent to the client",
  "Up-to-date technical knowledge (algorithms, AIs, trends)",
  "Meeting internal deadlines (Miro roadmap, tasks)",
  "Mentoring junior consultants on the team",
  "Innovation — proposing new strategies and tests",
];

const TEAM_LEADER_CRITERIA = [
  "Overall score ≥ 2.33 / 3.0",
  "Pillar 3 (Culture & Leadership) score ≥ 2.5",
  "Mentor mindset — helps others without dropping their own projects",
  "Proactive in proposing new strategies",
  "Consistency — high scores across multiple months",
  "High energy and alignment with the company's values",
];

const COO_NOTES = [
  "This framework is reviewed monthly for calibration. This version is in effect but may change — I'll let you know if it does.",
  "I'll give individual feedback to each consultant after the evaluation and will always be available for any questions or issues.",
  "Areas for improvement should be addressed and should not create friction — that's not the goal.",
  "A history of scores and frameworks like this one help identify knowledge gaps when bringing new people onto the team.",
];

export default async function SeoKpisPage() {
  // SEO-editor only — Web designers get read-only SEO project pages but
  // not the department KPI dashboard.
  const employee = await getCurrentEmployee();
  if (!employee || !editableDepts(employee).includes("seo")) {
    return (
      <PageShell>
        <AccessDenied
          title="No SEO access"
          description="The SEO KPIs are open to the SEO team and SuperAdmins."
          username={employee?.username}
        />
      </PageShell>
    );
  }
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
              Monthly Performance Evaluation
            </span>
          </h1>
          <p className="mt-3 max-w-2xl text-base text-white/65 sm:text-lg">
            SEO Department KPIs · WonderAds
          </p>
        </div>
      </section>

      <Section title="1. Framework Objectives" Icon={Target} delay={0.15}>
        <p className="text-white/75">
          This document defines the monthly performance evaluation framework for
          SEO consultants. The goals are to identify:
        </p>
        <ul className="mt-4 space-y-2 text-white/75">
          {[
            "Consultants with the best overall performance",
            "Sustained client satisfaction and results delivery",
            "Areas of improvement and development per consultant",
            "Candidates for Team Leader and for the Quarterly Bonus",
          ].map((item) => (
            <Bullet key={item}>{item}</Bullet>
          ))}
        </ul>
        <p className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/75">
          The fifth goal — the most important — is to understand failures and
          improve, not to be discouraged. We want to be the best team and
          therefore the best SEO agency in Portugal. This is the internal
          structure that gets us there.
        </p>
      </Section>

      <Section
        title="2. The Three Evaluation Pillars"
        Icon={Award}
        delay={0.2}
      >
        <p className="text-white/75">
          Evaluation is structured around 3 KPI pillars of equal weight (33.3%
          each). Each month, every consultant gets a score in each pillar. At
          the end of each quarter, the 3 monthly scores are averaged — the
          quarterly score determines eligibility for the quarterly bonus on top
          of the base salary.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <PillarCard
            number="1"
            title="Client Satisfaction"
            weight="33.3%"
            emoji="😀"
            Icon={Smile}
            kpis={PILLAR_1_KPIS}
            description="How the client's experience went throughout the month."
          />
          <PillarCard
            number="2"
            title="Client Delivery"
            weight="33.3%"
            emoji="📈"
            Icon={TrendingUp}
            kpis={PILLAR_2_KPIS}
            description="The actual results delivered to clients."
          />
          <PillarCard
            number="3"
            title="Culture & Leadership"
            weight="33.3%"
            emoji="🤎"
            Icon={HeartHandshake}
            kpis={PILLAR_3_KPIS}
            description="Culture, communication, leadership, technical knowledge and team development."
          />
        </div>
      </Section>

      <Section title="3. Evaluation Scale" Icon={Target} delay={0.25}>
        <p className="text-white/75">
          Each KPI inside the three pillars is scored on a 3-point scale:
        </p>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              level: "Below Expectations",
              desc: "Did not meet objectives. Improvement needed.",
              value: "1 point",
            },
            {
              level: "Expected",
              desc: "Met objectives as expected.",
              value: "2 points",
            },
            {
              level: "Above Expectations",
              desc: "Exceeded objectives with high quality or innovation.",
              value: "3 points",
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
            <span className="font-semibold">Monthly Final Score</span> = (Pillar
            1 + Pillar 2 + Pillar 3) / 3
          </p>
          <p className="mt-2 text-white/65">
            <span className="font-semibold">Quarterly Score</span> = average of
            the 3 monthly scores
          </p>
        </div>
      </Section>

      <Section
        title="4. Team Leader Candidate Criteria"
        Icon={Award}
        delay={0.3}
      >
        <p className="text-white/75">
          A consultant must meet the following criteria to be considered a Team
          Leader candidate:
        </p>
        <ul className="mt-4 space-y-2 text-white/75">
          {TEAM_LEADER_CRITERIA.map((item) => (
            <Bullet key={item}>{item}</Bullet>
          ))}
        </ul>
      </Section>

      <Section title="5. Additional Notes from the COO" Icon={Info} delay={0.35}>
        <ul className="space-y-2 text-white/75">
          {COO_NOTES.map((note) => (
            <Bullet key={note}>{note}</Bullet>
          ))}
        </ul>
        <p className="mt-6 text-sm text-white/55">
          Thanks and talk soon —{" "}
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
          Pillar No. {number}
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
