// /passagem/<id>/<slug> — a ficha de um projeto na passagem (v80.39).
// Quem sai escreve; quem entra lê, pergunta e assume; a direção vê e
// escreve. Qualquer outra pessoa recebe 404. Com «Ver como» mostra o lado da
// pessoa vista, só para ler (o middleware recusa as escritas).

import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { FichaWorkspace } from "@/components/passagem/ficha-workspace";
import { PageHeader, PersonAvatar } from "@/components/passagem/ui";
import { getCurrentEmployee } from "@/lib/auth/server";
import { formatDate } from "@/lib/dates";
import { getTeamAvatar } from "@/lib/team-avatars";
import { projectFacts } from "@/lib/passagem/facts";
import { getFicha, getPassagem, getSigns, listQuestions, roleIn } from "@/lib/passagem/store";
import { formatISODate } from "@/lib/passagem/shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Ficha de passagem — Wonder Ads Workspace" };

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-2.5">
      <p className="text-[11px] uppercase tracking-[0.12em] text-white/35">{label}</p>
      <p className="mt-0.5 text-[14px] font-medium text-white">{value}</p>
    </div>
  );
}

export default async function FichaPage({ params }: { params: Promise<{ id: string; slug: string }> }) {
  const me = await getCurrentEmployee();
  if (!me || me.viewerOf || me.docsOnly) notFound();
  const { id, slug } = await params;
  const p = await getPassagem(id);
  if (!p) notFound();
  const access = roleIn(p, { username: me.username, isAdmin: me.isAdmin });
  if (!access || !access.slugs.includes(slug)) notFound();
  const project = p.projects.find((x) => x.slug === slug)!;

  const [ficha, signs, questions, facts] = await Promise.all([
    getFicha(p.id, slug),
    getSigns(p.id, [slug]),
    listQuestions(p.id),
    projectFacts(slug),
  ]);

  const back =
    access.role === "admin"
      ? { href: `/admin/passagens/${p.id}`, label: "cockpit", prefix: "Voltar ao" }
      : { href: "/passagem", label: "passagem", prefix: "Voltar à" };

  return (
    <PageShell backHref={back.href} backLabel={back.label} backPrefix={back.prefix}>
      <PageHeader
        eyebrow={access.role === "incoming" ? "Projeto que vais receber" : "Ficha de passagem"}
        title={project.title}
        lead={
          access.role === "incoming"
            ? `Escrita por ${p.outgoing.name}. Lê tudo, pergunta o que não estiver claro e assume quando estiveres pronto.`
            : `Tudo o que quem entra tem de saber para continuar sem perder nada. Prazo: ${formatISODate(p.endDate)}.`
        }
      >
        <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
          <PersonAvatar name={p.outgoing.name} avatar={getTeamAvatar(p.outgoing.username)} size={34} />
          <ArrowRight className="h-4 w-4 text-white/30" />
          {project.incoming ? (
            <PersonAvatar name={project.incoming.name} avatar={getTeamAvatar(project.incoming.username)} size={34} />
          ) : (
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-dashed border-white/25 text-[13px] text-white/40">
              ?
            </span>
          )}
          <span className="ml-1 text-[13px] leading-tight text-white/70">
            {p.outgoing.name.split(" ")[0]} → {project.incoming?.name ?? "por decidir"}
          </span>
        </div>
      </PageHeader>

      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Fact label="Plano" value={facts.tier ?? "—"} />
        <Fact label="Cliente desde" value={formatISODate(facts.startedAt)} />
        <Fact label="Último NPS" value={facts.lastNps ? `${String(facts.lastNps.score).replace(".", ",")} · ${formatDate(facts.lastNps.at)}` : "Sem respostas"} />
        <Fact label="Língua" value={facts.lang === "en" ? "Inglês" : "Português"} />
      </div>
      {p.note && access.role !== "incoming" && (
        <p className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] px-5 py-3.5 text-[14px] leading-relaxed text-white/80">
          <span className="font-semibold text-amber-200">Nota da direção:</span> {p.note}
        </p>
      )}

      <div className="mt-6 pb-14">
        <FichaWorkspace
          passagemId={p.id}
          slug={slug}
          clientTitle={project.title}
          role={access.role}
          meUsername={me.username}
          closed={p.status !== "ativa"}
          outgoing={p.outgoing}
          incoming={project.incoming}
          endDate={p.endDate}
          initialFicha={ficha}
          sign={signs[slug] ?? null}
          questions={questions.filter((q) => q.slug === slug)}
          vaultCount={facts.vaultCount}
          lang={facts.lang}
        />
      </div>
    </PageShell>
  );
}
