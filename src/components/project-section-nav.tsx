"use client";

import { useEffect, useState } from "react";

const SECTIONS = [
  { id: "section-brief", n: "01", label: "Do's & Don'ts" },
  { id: "section-data", n: "02", label: "Data & Quick Actions" },
  { id: "section-actions", n: "03", label: "Actions" },
];

/** Numbered section nav for a project page — highlights the section in view
 *  and smooth-scrolls to a section on click. */
export function ProjectSectionNav() {
  const [active, setActive] = useState(SECTIONS[0].id);

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          );
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  function jump(id: string) {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav
      aria-label="Project sections"
      className="flex flex-col gap-2 sm:items-end"
    >
      {SECTIONS.map((s) => {
        const isActive = active === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => jump(s.id)}
            aria-current={isActive ? "true" : undefined}
            className={`group flex items-center gap-2.5 text-xs font-medium uppercase tracking-[0.18em] transition ${
              isActive ? "text-white" : "text-white/35 hover:text-white/70"
            }`}
          >
            <span
              className={`font-mono text-[11px] ${
                isActive
                  ? "brand-gradient-text"
                  : "text-white/30 group-hover:text-white/55"
              }`}
            >
              {s.n}
            </span>
            <span
              aria-hidden
              className={`h-px transition-all ${
                isActive
                  ? "brand-gradient-bg w-7"
                  : "w-4 bg-white/15 group-hover:w-5 group-hover:bg-white/30"
              }`}
            />
            {s.label}
          </button>
        );
      })}
    </nav>
  );
}
