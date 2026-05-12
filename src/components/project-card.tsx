import type { ComponentType } from "react";
import { ArrowUpRight } from "lucide-react";

export type Project = {
  title: string;
  tagline: string;
  Icon: ComponentType<{ className?: string; strokeWidth?: number | string }>;
};

export function ProjectCard({
  project,
  index = 0,
}: {
  project: Project;
  index?: number;
}) {
  const { Icon } = project;

  return (
    <article
      className="brand-gradient-border animate-fade-up group relative flex flex-col gap-4 rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md transition-all duration-500 hover:-translate-y-1 hover:bg-white/[0.06]"
      style={{ animationDelay: `${0.05 + index * 0.04}s` }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-2xl opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-50"
        style={{ background: "var(--brand-gradient)" }}
      />

      <div className="flex items-start justify-between">
        <div className="relative">
          <div
            className="brand-gradient-bg flex h-9 w-9 items-center justify-center rounded-lg shadow-[0_6px_20px_-4px_rgba(120,61,245,0.55)] transition-transform duration-500 group-hover:scale-110"
            aria-hidden
          >
            <Icon className="h-4 w-4 text-white" strokeWidth={2.25} />
          </div>
          <div
            aria-hidden
            className="absolute inset-0 -z-10 rounded-lg opacity-40 blur-lg"
            style={{ background: "var(--brand-gradient)" }}
          />
        </div>
        <ArrowUpRight
          className="h-4 w-4 text-white/30 transition-all duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white"
          aria-hidden
        />
      </div>

      <div>
        <h3 className="text-base font-semibold tracking-tight text-white">
          {project.title}
        </h3>
        <p className="mt-1 text-xs text-white/50 sm:text-sm">
          {project.tagline}
        </p>
      </div>
    </article>
  );
}
