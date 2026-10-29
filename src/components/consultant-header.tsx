// O cabeçalho de um consultor SEO: retrato, nome (ou «Bom dia, Manuel» na
// página dele) e o resumo da semana. Partilhado pela página de cada consultor
// (/seo/roadmaps/<consultor>) e pela página com todos (/seo/roadmaps, v78.44),
// onde passa a h2 e ganha o atalho para a página só dele.

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Greeting } from "@/components/greeting";
import { formatDate } from "@/lib/dates";
import { findEmployeeByName } from "@/lib/proposals/consultant";
import type { ConsultantWeekView } from "@/lib/roadmap-admin-helpers";
import { getTeamAvatar } from "@/lib/team-avatars";

export function ConsultantHeader({
  view,
  own = false,
  href,
  heading = "h1",
}: {
  view: ConsultantWeekView;
  /** A página é do próprio consultor — cumprimenta-o em vez de o nomear. */
  own?: boolean;
  /** O atalho para a página só deste consultor (na página com todos). */
  href?: string;
  heading?: "h1" | "h2";
}) {
  const name = view.consultant;
  const firstName = name.split(/\s+/)[0].replace(/\.$/, "");
  const avatar = getTeamAvatar(findEmployeeByName(name)?.username);
  const projects = view.clients.filter((c) => c.hasRoadmap).length;
  const left = view.totals.thisWeekRemaining;
  const Heading = heading;

  return (
    <header className="flex flex-wrap items-center gap-5">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          alt=""
          className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-white/15 sm:h-[72px] sm:w-[72px]"
        />
      ) : (
        <span
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-semibold text-white sm:h-[72px] sm:w-[72px]"
          style={{ background: "var(--brand-gradient)" }}
        >
          {firstName.slice(0, 1)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <Heading className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          {own ? (
            <>
              <span className="brand-gradient-text">
                <Greeting name={firstName} />
              </span>{" "}
              <span aria-hidden>👋</span>
            </>
          ) : (
            <span className="brand-gradient-text">{name}</span>
          )}
        </Heading>
        <p className="mt-1.5 max-w-2xl text-[14px] text-white/55">
          {heading === "h1" && <>{formatDate(new Date())} · </>}
          {view.clients.length} {view.clients.length === 1 ? "projeto" : "projetos"} na carteira ·{" "}
          {left > 0 ? (
            <>
              <span className="font-semibold text-white/85">
                {left} {left === 1 ? "tarefa" : "tarefas"}
              </span>{" "}
              para esta semana em {projects} {projects === 1 ? "roadmap" : "roadmaps"}
            </>
          ) : (
            <>semana em dia</>
          )}
        </p>
      </div>
      {href && (
        <Link
          href={href}
          className="group inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-[12.5px] text-white/60 transition hover:border-white/25 hover:text-white"
        >
          Abrir só a página de {firstName}
          <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:-translate-y-px group-hover:translate-x-px" />
        </Link>
      )}
    </header>
  );
}
