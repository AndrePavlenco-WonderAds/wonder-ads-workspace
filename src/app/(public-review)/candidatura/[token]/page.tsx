// /candidatura/<token> — a prova prática do candidato (Recrutamento, Fase 2 ·
// Parte 2, v80.16). Pública: o link é a chave. Sem chrome da workspace; o
// layout do (public-review) já põe o fundo claro e o noindex.

import type { Metadata } from "next";
import { PracticalCandidate } from "@/components/recrutamento/practical-candidate";
import { getPracticalTemplate } from "@/lib/recrutamento/practical";
import {
  getPracticalSubmission,
  practicalLinkClosed,
  resolvePracticalToken,
} from "@/lib/recrutamento/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Prova prática · WonderAds",
  robots: { index: false, follow: false },
};

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

export default async function CandidaturaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await resolvePracticalToken(token).catch(() => null);
  const template = r ? getPracticalTemplate(r.practical.templateId) : null;
  if (!r || !template || practicalLinkClosed(r.candidate)) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-black/40">WonderAds</p>
          <h1 className="mt-3 text-2xl font-semibold text-black">Este link já não está ativo</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-black/60">
            Se achas que é um engano, fala com quem te enviou o link.
          </p>
        </div>
      </main>
    );
  }
  const sub = await getPracticalSubmission(r.practical.id);
  return (
    <PracticalCandidate
      token={token}
      practicalId={r.practical.id}
      templateId={template.id}
      site={r.practical.site}
      firstName={firstName(r.candidate.name)}
      initial={sub}
      serverNow={Date.now()}
    />
  );
}
