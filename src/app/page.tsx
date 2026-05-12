import type { ReactNode } from "react";

type Department = {
  title: string;
  tagline: string;
  icon: ReactNode;
};

const DEPARTMENTS: Department[] = [
  {
    title: "SEO DPT",
    tagline: "Organic growth, technical SEO & content strategy",
    icon: <SeoIcon />,
  },
  {
    title: "WEB DPT",
    tagline: "Websites, landing pages & conversion-focused builds",
    icon: <WebIcon />,
  },
  {
    title: "ADS DPT",
    tagline: "Paid media, performance campaigns & creative",
    icon: <AdsIcon />,
  },
  {
    title: "COMMERCIAL DPT",
    tagline: "Sales pipeline, partnerships & client success",
    icon: <CommercialIcon />,
  },
];

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      <BackgroundDecor />

      <main className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-16 sm:px-10 sm:py-24">
        <header className="mb-14 flex flex-col items-start gap-4 sm:mb-20">
          <span className="inline-flex items-center rounded-full border border-[color:var(--border)] bg-white/70 px-3 py-1 text-xs font-medium tracking-wide text-[color:var(--foreground)]/70 backdrop-blur">
            WONDER ADS WORKSPACE
          </span>
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Choose a <span className="brand-gradient-text">department</span>
          </h1>
          <p className="max-w-xl text-base text-[color:var(--foreground)]/65 sm:text-lg">
            Internal hub for the Wonder Ads team. Pick a department to jump into
            its tools, briefs and ongoing work.
          </p>
        </header>

        <section
          aria-label="Departments"
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6"
        >
          {DEPARTMENTS.map((dept) => (
            <DepartmentCard key={dept.title} dept={dept} />
          ))}
        </section>

        <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 text-sm text-[color:var(--foreground)]/55 sm:mt-24">
          <span>© {new Date().getFullYear()} Wonder Ads</span>
          <span>wonder-ads.com</span>
        </footer>
      </main>
    </div>
  );
}

function DepartmentCard({ dept }: { dept: Department }) {
  return (
    <article className="brand-gradient-border group relative flex flex-col overflow-hidden rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(11,12,18,0.04),0_12px_40px_-12px_rgba(52,62,215,0.18)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_1px_2px_rgba(11,12,18,0.04),0_24px_60px_-12px_rgba(120,61,245,0.32)] sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-70 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "var(--brand-gradient)" }}
      />

      <div className="relative z-10 flex h-32 w-full items-center justify-center rounded-2xl bg-gradient-to-br from-[#f4f3ff] via-[#faf2fb] to-[#fef0fb] sm:h-40">
        <div className="h-16 w-16 sm:h-20 sm:w-20">{dept.icon}</div>
      </div>

      <div className="relative z-10 mt-6 flex flex-1 flex-col">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          <span className="brand-gradient-text">{dept.title}</span>
        </h2>
        <p className="mt-2 text-sm text-[color:var(--foreground)]/65 sm:text-base">
          {dept.tagline}
        </p>

        <div className="mt-6 flex items-center gap-2 text-sm font-medium text-[color:var(--foreground)]/80">
          <span>Enter</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className="transition-transform duration-300 group-hover:translate-x-1"
            aria-hidden
          >
            <path
              d="M3 8h10M9 4l4 4-4 4"
              stroke="url(#arrow-grad)"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <defs>
              <linearGradient
                id="arrow-grad"
                x1="0"
                y1="0"
                x2="16"
                y2="16"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0" stopColor="#343ED7" />
                <stop offset="0.5365" stopColor="#783DF5" />
                <stop offset="1" stopColor="#C535C9" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </article>
  );
}

function BackgroundDecor() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full opacity-30 blur-[120px]"
        style={{ background: "var(--brand-gradient)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-48 -right-32 h-[520px] w-[520px] rounded-full opacity-25 blur-[140px]"
        style={{ background: "var(--brand-gradient)" }}
      />
    </>
  );
}

function GradientStops() {
  return (
    <defs>
      <linearGradient
        id="wa-grad"
        x1="0"
        y1="0"
        x2="48"
        y2="48"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#343ED7" />
        <stop offset="0.5365" stopColor="#783DF5" />
        <stop offset="1" stopColor="#C535C9" />
      </linearGradient>
    </defs>
  );
}

function SeoIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="h-full w-full" aria-hidden>
      <GradientStops />
      <circle
        cx="20"
        cy="20"
        r="11"
        stroke="url(#wa-grad)"
        strokeWidth="2.5"
      />
      <path
        d="M28.5 28.5L40 40"
        stroke="url(#wa-grad)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M14 23l4-4 3 3 5-6"
        stroke="url(#wa-grad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WebIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="h-full w-full" aria-hidden>
      <GradientStops />
      <rect
        x="5"
        y="8"
        width="38"
        height="28"
        rx="3"
        stroke="url(#wa-grad)"
        strokeWidth="2.5"
      />
      <path d="M5 15h38" stroke="url(#wa-grad)" strokeWidth="2.5" />
      <circle cx="10" cy="11.5" r="1.2" fill="url(#wa-grad)" />
      <circle cx="14" cy="11.5" r="1.2" fill="url(#wa-grad)" />
      <circle cx="18" cy="11.5" r="1.2" fill="url(#wa-grad)" />
      <path
        d="M18 42h12M24 36v6"
        stroke="url(#wa-grad)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AdsIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="h-full w-full" aria-hidden>
      <GradientStops />
      <path
        d="M8 20v8a2 2 0 002 2h4l3 8h4l-3-8 14-4V14L18 18h-8a2 2 0 00-2 2z"
        stroke="url(#wa-grad)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M38 18v12"
        stroke="url(#wa-grad)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CommercialIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="h-full w-full" aria-hidden>
      <GradientStops />
      <path
        d="M8 38l8-8 6 6 10-12 8 8"
        stroke="url(#wa-grad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M40 22V14h-8"
        stroke="url(#wa-grad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
