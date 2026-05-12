import Link from "next/link";
import {
  Search,
  Code2,
  Megaphone,
  Handshake,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";

type Department = {
  title: string;
  tagline: string;
  href: string;
  Icon: LucideIcon;
};

const DEPARTMENTS: Department[] = [
  {
    title: "SEO DPT",
    tagline: "Organic growth, technical SEO & content strategy.",
    href: "/seo",
    Icon: Search,
  },
  {
    title: "WEB DPT",
    tagline: "High-converting websites, landing pages & dev work.",
    href: "/web",
    Icon: Code2,
  },
  {
    title: "ADS DPT",
    tagline: "Paid media, performance campaigns & creative.",
    href: "/ads",
    Icon: Megaphone,
  },
  {
    title: "COMMERCIAL DPT",
    tagline: "Sales pipeline, partnerships & client success.",
    href: "/commercial",
    Icon: Handshake,
  },
];

export default function Home() {
  return (
    <PageShell>
      <section className="mx-auto mb-10 max-w-3xl text-center sm:mb-14">
        <span className="animate-fade-up inline-flex items-center rounded-full border border-[color:var(--border)] bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/70 backdrop-blur">
          Wonder Ads Workspace
        </span>
        <h1 className="animate-fade-up mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Choose a <span className="brand-gradient-text">Department</span>
        </h1>
      </section>

      <HubSection />
    </PageShell>
  );
}

function HubSection() {
  return (
    <section
      aria-label="Departments"
      className="relative mx-auto w-full max-w-5xl"
    >
      <BeamsOverlay />

      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 z-0 hidden h-56 w-56 -translate-x-1/2 -translate-y-1/2 sm:block"
      >
        <div className="orb-glow animate-orb-pulse h-full w-full rounded-full" />
        <div className="brand-gradient-bg absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_24px_8px_rgba(120,61,245,0.55)]" />
      </div>

      <div className="relative z-10 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-10">
        {DEPARTMENTS.map((dept, i) => (
          <DepartmentCard key={dept.title} dept={dept} index={i} />
        ))}
      </div>
    </section>
  );
}

function DepartmentCard({
  dept,
  index,
}: {
  dept: Department;
  index: number;
}) {
  const { Icon } = dept;

  return (
    <Link
      href={dept.href}
      className="brand-gradient-border animate-fade-up group relative flex flex-col gap-6 rounded-2xl bg-white/[0.035] p-6 backdrop-blur-md transition-all duration-500 hover:-translate-y-1 hover:bg-white/[0.06] sm:p-7"
      style={{ animationDelay: `${0.1 + index * 0.08}s` }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-2xl opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-60"
        style={{ background: "var(--brand-gradient)" }}
      />

      <div className="flex items-start justify-between">
        <div className="relative">
          <div
            className="brand-gradient-bg flex h-11 w-11 items-center justify-center rounded-xl shadow-[0_8px_30px_-6px_rgba(120,61,245,0.6)] transition-transform duration-500 group-hover:scale-110"
            aria-hidden
          >
            <Icon className="h-5 w-5 text-white" strokeWidth={2.25} />
          </div>
          <div
            aria-hidden
            className="absolute inset-0 -z-10 rounded-xl opacity-50 blur-xl"
            style={{ background: "var(--brand-gradient)" }}
          />
        </div>

        <ArrowUpRight
          className="h-5 w-5 text-white/40 transition-all duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white"
          aria-hidden
        />
      </div>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {dept.title}
        </h2>
        <p className="mt-2 text-sm text-white/55 sm:text-base">
          {dept.tagline}
        </p>
      </div>

      <div
        aria-hidden
        className="brand-gradient-bg pointer-events-none absolute bottom-0 left-6 right-6 h-px origin-left scale-x-0 rounded-full opacity-0 transition-all duration-500 group-hover:scale-x-100 group-hover:opacity-90 sm:left-7 sm:right-7"
      />
    </Link>
  );
}

function BeamsOverlay() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full sm:block"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="beam-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#343ED7" />
          <stop offset="0.5365" stopColor="#783DF5" />
          <stop offset="1" stopColor="#C535C9" />
        </linearGradient>
      </defs>
      <line
        x1="32"
        y1="32"
        x2="50"
        y2="50"
        stroke="url(#beam-grad)"
        strokeWidth="0.6"
        strokeLinecap="round"
        className="animate-beam"
      />
      <line
        x1="68"
        y1="32"
        x2="50"
        y2="50"
        stroke="url(#beam-grad)"
        strokeWidth="0.6"
        strokeLinecap="round"
        className="animate-beam"
        style={{ animationDelay: "0.6s" }}
      />
      <line
        x1="32"
        y1="68"
        x2="50"
        y2="50"
        stroke="url(#beam-grad)"
        strokeWidth="0.6"
        strokeLinecap="round"
        className="animate-beam"
        style={{ animationDelay: "1.2s" }}
      />
      <line
        x1="68"
        y1="68"
        x2="50"
        y2="50"
        stroke="url(#beam-grad)"
        strokeWidth="0.6"
        strokeLinecap="round"
        className="animate-beam"
        style={{ animationDelay: "1.8s" }}
      />
    </svg>
  );
}
