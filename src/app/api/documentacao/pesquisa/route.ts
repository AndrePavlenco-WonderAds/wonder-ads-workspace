// GET /api/documentacao/pesquisa — o que a pesquisa da Documentação (v80.46)
// não consegue ler no HTML das páginas:
//   - as tarefas da Jornada de Cliente (a explicação só abre no painel
//     lateral, não vem na página);
//   - as aulas da Formação de quem pesquisa (título, descrição, pontos do
//     «Remember», caixas de texto, anexos). As perguntas dos testes e dos
//     exames NUNCA entram.
//
// Fora do matcher do middleware, como o resto de /api/documentacao: a sessão
// e o acesso verificam-se aqui. Só leituras.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { getJourney } from "@/lib/documentacao/editable-store";
import { JOURNEY_GUIDES } from "@/lib/documentacao/jornada";
import type { SearchDoc } from "@/lib/documentacao/search";
import { getDocsContext } from "@/lib/documentacao/server";
import { getBlock } from "@/lib/documentacao/blocks";
import { readerSeesBlock } from "@/lib/documentacao/access";
import { COMMON_TRACK_HIDDEN, lessonMinutes } from "@/lib/training/catalog";
import { getTrainingCatalog } from "@/lib/training/content-store";
import { getEnrollments, resolveTrackSlugs } from "@/lib/training/enrollments-store";
import { getTrainingProgress } from "@/lib/training/progress-store";
import { getQuizAttempts } from "@/lib/training/attempts-store";
import { computeTrackState, computeUserTraining, type TrackState } from "@/lib/training/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function journeyDocs(): Promise<SearchDoc[]> {
  const journey = await getJourney();
  const out: SearchDoc[] = [];
  journey.months.forEach((m, mi) => {
    const n = mi + 1;
    const where = m.title ? `Mês ${n} · ${m.title}` : `Mês ${n}`;
    for (const b of m.blocks) {
      if (b.placeholder || !b.title.trim()) continue;
      const g = b.guide ? JOURNEY_GUIDES[b.guide] : undefined;
      const text = [
        b.detail,
        g?.lead,
        g?.why,
        ...(g?.questions ?? []),
        ...(g?.steps ?? []),
        g?.tool ? `${g.tool.title}. ${g.tool.intro}` : "",
        g?.download ? `${g.download.label}. ${g.download.note}` : "",
      ]
        .filter(Boolean)
        .join(" ");
      out.push({
        key: `jornada:${b.id}`,
        kind: "doc",
        group: "jornada-cliente",
        groupLabel: "Jornada de Cliente",
        block: "Jornada de Cliente",
        href: `/documentacao/jornada-cliente?tarefa=${encodeURIComponent(b.id)}`,
        anchor: `mes-${n}`,
        section: where,
        heading: b.title,
        text: text || b.title,
        meta: { image: "/documentacao/jornada-cliente-capa.jpg" },
      });
    }
  });
  return out;
}

async function lessonDocs(username: string, dept: string, isAdmin: boolean): Promise<SearchDoc[]> {
  const [tracks, enrollments, progress, attempts] = await Promise.all([
    getTrainingCatalog(),
    getEnrollments(),
    getTrainingProgress(username),
    getQuizAttempts(username),
  ]);
  let states: TrackState[];
  if (isAdmin) {
    // A direção abre qualquer aula («só ver»): procura em todas.
    states = tracks
      .filter((t) => !(t.isCommon && COMMON_TRACK_HIDDEN))
      .map((t) => computeTrackState(t, progress, attempts));
  } else {
    const slugs = resolveTrackSlugs(username, dept, enrollments);
    const { common, specializations } = computeUserTraining(tracks, slugs, progress, attempts);
    states = [common, ...specializations].filter((t): t is TrackState => t !== null);
  }

  const out: SearchDoc[] = [];
  for (const st of states) {
    st.modules.forEach((m, mi) => {
      const locked = !isAdmin && (m.status === "locked" || st.lockedReason !== null);
      for (const l of m.lessons) {
        const lesson = l.lesson;
        if (!lesson.isPublished) continue;
        const text = [
          lesson.description,
          ...lesson.keyPoints,
          ...(lesson.copyBoxes ?? []).map((c) => `${c.label}. ${c.text}`),
          ...(lesson.attachments ?? []).map((a) => a.label),
          lesson.presenter ? `Com ${lesson.presenter}.` : "",
        ]
          .filter(Boolean)
          .join(" ");
        out.push({
          key: `aula:${st.track.slug}:${lesson.id}`,
          kind: "aula",
          group: st.track.slug,
          groupLabel: st.track.name,
          block: "Formação",
          href: `/formacao/${st.track.slug}/aula/${lesson.id}`,
          anchor: null,
          section: `Capítulo ${mi + 1} · ${m.module.title}`,
          heading: lesson.title,
          text,
          meta: {
            video: Boolean(lesson.videoUrl),
            soon: l.comingSoon,
            minutes: lessonMinutes(lesson),
            locked,
            watched: l.watched,
            presenter: lesson.presenter,
          },
        });
      }
    });
  }
  return out;
}

export async function GET() {
  const ctx = await getDocsContext();
  if (ctx.state !== "ok") return NextResponse.json({ error: "Sem acesso." }, { status: ctx.state === "no-session" ? 401 : 403 });
  const { reader } = ctx;

  const jornada = getBlock("jornada-cliente");
  const seesJourney = jornada ? readerSeesBlock(reader, jornada) : false;
  // Contas «só Documentação» e perfis de leitura não têm Formação.
  const hasTraining = !reader.docsOnly && !reader.viewerOf;

  const employee = hasTraining ? await getCurrentEmployee() : null;
  const [journey, lessons] = await Promise.all([
    seesJourney
      ? journeyDocs().catch((err) => {
          console.error("pesquisa: jornada", err instanceof Error ? err.message : err);
          return [] as SearchDoc[];
        })
      : Promise.resolve([] as SearchDoc[]),
    employee
      ? lessonDocs(employee.username, employee.dept, employee.isAdmin).catch((err) => {
          console.error("pesquisa: formação", err instanceof Error ? err.message : err);
          return [] as SearchDoc[];
        })
      : Promise.resolve([] as SearchDoc[]),
  ]);

  return NextResponse.json(
    { docs: [...journey, ...lessons], lessons: lessons.length },
    { headers: { "cache-control": "private, no-store" } },
  );
}
