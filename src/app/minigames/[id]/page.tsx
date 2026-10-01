// /minigames/[id] — uma sala de «Uma verdade, duas mentiras» (v77.71).
// O servidor entrega a primeira vista (já recortada para quem abre); daí
// para a frente é o polling da sala que a mantém ao vivo.

import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { OneTruthRoom } from "@/components/minigames/one-truth-room";
import { getCurrentEmployee } from "@/lib/auth/server";
import { getGameView } from "@/lib/minigames/one-truth-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Uma verdade, duas mentiras — Mini-games",
};

export default async function MinigameRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employee = await getCurrentEmployee();
  if (!employee) return null;
  const view = await getGameView(id, employee).catch(() => null);

  return (
    <PageShell backHref="/minigames" backLabel="Mini-games">
      <div className="mt-2 sm:mt-4">
        {view ? (
          <OneTruthRoom initial={view} />
        ) : (
          <div className="mx-auto mt-16 max-w-lg rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <h1 className="text-xl font-semibold text-white">Esta sala já não existe</h1>
            <p className="mt-2 text-sm text-white/55">Pode ter expirado. Vê no hub se há outra aberta.</p>
            <Link
              href="/minigames"
              className="mt-6 inline-flex rounded-full border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.08] hover:text-white"
            >
              Voltar aos Mini-games
            </Link>
          </div>
        )}
      </div>
    </PageShell>
  );
}
