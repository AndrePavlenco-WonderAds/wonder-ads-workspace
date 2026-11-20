// /admin/recrutamento/<id> — a ficha do candidato (v80.13). SuperAdmins.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { CandidateFile } from "@/components/recrutamento/candidate-file";
import { accessConsoleUser } from "@/lib/access/guard";
import { getEmployeeDisplay } from "@/lib/auth/credentials";
import { recruitmentUser } from "@/lib/recrutamento/guard";
import { getCandidate, getPracticalSubmissions } from "@/lib/recrutamento/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Candidato · Recrutamento",
  robots: { index: false, follow: false },
};

export default async function CandidatoPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await recruitmentUser();
  if (!me) notFound();
  const { id } = await params;
  const candidate = await getCandidate(id).catch(() => null);
  if (!candidate) notFound();

  const usernames = new Set<string>([candidate.createdBy]);
  for (const i of candidate.interviews) if (i.interviewer) usernames.add(i.interviewer);
  for (const p of candidate.practicals) if (p.reviewer) usernames.add(p.reviewer);
  if (candidate.decision?.by) usernames.add(candidate.decision.by);
  const names: Record<string, string> = {};
  for (const u of usernames) {
    if (!u) continue;
    names[u] = getEmployeeDisplay(u)?.name ?? u;
  }
  const canSeeAccess = Boolean(await accessConsoleUser().catch(() => null));
  // Prática (v80.16): o que o candidato já escreveu em cada uma.
  const subs = await getPracticalSubmissions(candidate.practicals.map((p) => p.id)).catch(() => ({}));

  return (
    <PageShell backHref="/admin/recrutamento" backLabel="Recrutamento">
      <CandidateFile initial={candidate} canSeeAccess={canSeeAccess} names={names} subs={subs} />
    </PageShell>
  );
}
