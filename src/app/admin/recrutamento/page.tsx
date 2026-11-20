// /admin/recrutamento — Recrutamento (v80.13). SuperAdmins. A página
// verifica ela própria (o layout do /admin não é fronteira de segurança).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { RecruitmentHub } from "@/components/recrutamento/hub";
import { recruitmentUser } from "@/lib/recrutamento/guard";
import { listCandidates, recruitmentConfigured } from "@/lib/recrutamento/store";
import type { Candidate } from "@/lib/recrutamento/shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Recrutamento · SuperAdmin",
  robots: { index: false, follow: false },
};

export default async function RecrutamentoPage() {
  const me = await recruitmentUser();
  if (!me) notFound();
  let candidates: Candidate[] = [];
  let failed = false;
  try {
    candidates = await listCandidates();
  } catch (err) {
    console.error("[recrutamento] lista", err);
    failed = true;
  }
  return (
    <PageShell backHref="/admin" backLabel="Control Suite">
      {!recruitmentConfigured && (
        <p className="mt-6 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-[12.5px] text-amber-100">
          O armazenamento (KV) não está configurado neste ambiente.
        </p>
      )}
      {failed && (
        <p className="mt-6 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-[12.5px] text-rose-100">
          Não foi possível ler os candidatos agora (o KV não respondeu). Tenta daqui a pouco.
        </p>
      )}
      <RecruitmentHub initial={candidates} />
    </PageShell>
  );
}
