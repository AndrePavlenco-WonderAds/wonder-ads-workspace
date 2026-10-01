// Servidor: lê o ponteiro da sala aberta (um GET de KV) e entrega-o ao aviso
// do header. Sem sessão não lê nada — o /login também usa o PageShell.

import { getCurrentEmployee } from "@/lib/auth/server";
import { getActiveGame } from "@/lib/minigames/one-truth-store";
import { LiveGamePill } from "./live-game-pill";

export async function HeaderLiveGame() {
  const employee = await getCurrentEmployee().catch(() => null);
  if (!employee) return null;
  const active = await getActiveGame();
  return <LiveGamePill initial={active ? { id: active.id, hostName: active.hostName } : null} />;
}
