import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";

export function DepartmentHeader({
  title,
  tagline,
  Icon,
}: {
  title: string;
  tagline: string;
  Icon: LucideIcon;
}) {
  return (
    <>
      <Link
        href="/"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to workspace
      </Link>

      <section className="animate-fade-up mt-10 flex flex-col items-start gap-6 sm:mt-14">
        <div className="relative">
          <div
            className="brand-gradient-bg flex h-16 w-16 items-center justify-center rounded-2xl shadow-[0_10px_40px_-8px_rgba(120,61,245,0.7)]"
            aria-hidden
          >
            <Icon className="h-7 w-7 text-white" strokeWidth={2.25} />
          </div>
          <div
            aria-hidden
            className="absolute inset-0 -z-10 rounded-2xl opacity-60 blur-2xl"
            style={{ background: "var(--brand-gradient)" }}
          />
        </div>

        <div>
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            <span className="brand-gradient-text">{title}</span>
          </h1>
          <p className="mt-3 max-w-2xl text-base text-white/65 sm:text-lg">
            {tagline}
          </p>
        </div>
      </section>
    </>
  );
}
