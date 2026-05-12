import { ProjectCard, type Project } from "./project-card";

export function ProjectGrid({
  projects,
  label = "Projects",
}: {
  projects: Project[];
  label?: string;
}) {
  return (
    <section aria-label={label}>
      <header className="mb-5 flex items-baseline justify-between">
        <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-white/55">
          {label}
        </h2>
        <span className="text-xs text-white/35">{projects.length}</span>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {projects.map((project, i) => (
          <ProjectCard key={project.title} project={project} index={i} />
        ))}
      </div>
    </section>
  );
}
