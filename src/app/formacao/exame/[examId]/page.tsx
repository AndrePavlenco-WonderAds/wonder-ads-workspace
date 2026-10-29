// /formacao/exame/<id> — o endereço antigo dos exames de fase. Desde a v78.54
// cada exame vive dentro da especialização dona dele
// (/formacao/<track>/exame/<id>); aqui só se reencaminha, para os links já
// enviados (sino, mensagens) continuarem a funcionar.

import { notFound, redirect } from "next/navigation";
import { examHref, findExam } from "@/lib/training/exams";

export const dynamic = "force-dynamic";

export default async function OldExamPath({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const exam = findExam(examId);
  if (!exam) notFound();
  redirect(examHref(exam));
}
