// /admin/recrutamento/<id>/entrevista/<interviewId> — o modo entrevista
// (v80.13): uma pergunta por ecrã, pontuação ao vivo. SuperAdmins.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { InterviewRunner } from "@/components/recrutamento/interview-runner";
import { recruitmentUser } from "@/lib/recrutamento/guard";
import { getCandidate } from "@/lib/recrutamento/store";
import { getTemplate } from "@/lib/recrutamento/templates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Entrevista · Recrutamento",
  robots: { index: false, follow: false },
};

export default async function EntrevistaPage({
  params,
}: {
  params: Promise<{ id: string; interviewId: string }>;
}) {
  const me = await recruitmentUser();
  if (!me) notFound();
  const { id, interviewId } = await params;
  const candidate = await getCandidate(id).catch(() => null);
  const interview = candidate?.interviews.find((i) => i.id === interviewId) ?? null;
  const template = interview ? getTemplate(interview.templateId) : null;
  if (!candidate || !interview || !template) notFound();

  return (
    <PageShell backHref={`/admin/recrutamento/${candidate.id}`} backLabel="Ficha" hideFooter>
      <InterviewRunner candidate={candidate} interview={interview} template={template} />
    </PageShell>
  );
}
