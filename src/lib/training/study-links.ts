// Onde voltar a estudar depois de errar uma pergunta de exame (v78.63): a
// aula que a pergunta avalia (`lessonId`) e, para as que não a têm, a
// primeira aula do capítulo. Módulo leve de propósito — a correção no browser
// usa-o sem arrastar o banco de perguntas para o bundle.

import type { TrainingTrack } from "@/lib/training/catalog";

export type StudyLink = { href: string; label: string };

export type StudyLinks = {
  lessons: Record<string, StudyLink>;
  chapters: Record<string, StudyLink>;
};

/** Só aulas publicadas — um link para uma aula por gravar não ajuda ninguém. */
export function studyLinks(tracks: TrainingTrack[], trackSlug: string): StudyLinks {
  const track = tracks.find((t) => t.slug === trackSlug);
  const out: StudyLinks = { lessons: {}, chapters: {} };
  const modules = [...(track?.modules ?? [])].sort((a, b) => a.order - b.order);
  modules.forEach((m, i) => {
    const published = m.lessons.filter((l) => l.isPublished).sort((a, b) => a.order - b.order);
    for (const l of published) {
      out.lessons[l.id] = { href: `/formacao/${trackSlug}/aula/${l.id}`, label: `Rever a aula «${l.title}»` };
    }
    if (published[0]) {
      out.chapters[m.id] = { href: `/formacao/${trackSlug}/aula/${published[0].id}`, label: `Rever o capítulo ${i + 1}` };
    }
  });
  return out;
}

export function reviewFor(
  links: StudyLinks | null | undefined,
  lessonId: string | null | undefined,
  topicKey: string | null | undefined,
): StudyLink | null {
  if (!links) return null;
  return (lessonId ? links.lessons[lessonId] : undefined) ?? (topicKey ? links.chapters[topicKey] : undefined) ?? null;
}
