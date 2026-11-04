// /admin/acessos — Acessos à app (v78.72). Só o André (COO): quem FEZ LOGIN
// e sem «Ver como». O layout do /admin já pede SuperAdmin, mas o layout não é
// fronteira de segurança — a página verifica ela própria e responde 404 a
// toda a gente (Alex e Alice incluídos), para nem se saber que existe.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { AccessConsole } from "@/components/access/access-console";
import { accessConsoleUser } from "@/lib/access/guard";
import { accessConfigured, loadAccessOverview, type AccessOverview } from "@/lib/access/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Acessos à app · SuperAdmin",
  robots: { index: false, follow: false },
};

export default async function AcessosPage() {
  const me = await accessConsoleUser();
  if (!me) notFound();

  let overview: AccessOverview | null = null;
  try {
    overview = await loadAccessOverview();
  } catch (err) {
    console.error("[acessos] leitura falhou", err);
  }

  return (
    <PageShell backHref="/admin" backLabel="Control Suite">
      {overview ? (
        <AccessConsole initialRows={overview.rows} initialEvents={overview.events} configured={accessConfigured} />
      ) : (
        <p className="mt-10 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-[12.5px] text-rose-100">
          Não foi possível ler os acessos agora (o KV não respondeu). Tenta daqui a pouco.
        </p>
      )}
    </PageShell>
  );
}
