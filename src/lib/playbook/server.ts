// O portão de todas as páginas do Playbook, resolvido no servidor. Cada
// página chama isto e decide sozinha — o menu esconder o item não fecha
// nada (ver a lição do /admin: o layout não é fronteira de segurança).

import "server-only";
import { getCurrentEmployee, getCurrentSession } from "@/lib/auth/server";
import { playbookAvailable, readerSees, type PlaybookReader } from "./access";
import { getBlock, type PlaybookBlock } from "./blocks";

export type PlaybookContext =
  | { state: "no-session" }
  | { state: "closed"; name: string }
  | { state: "forbidden"; reader: PlaybookReader }
  | { state: "ok"; reader: PlaybookReader; block: PlaybookBlock | null };

/** `blockId` = o bloco da página; omitido no hub. */
export async function getPlaybookContext(blockId?: string): Promise<PlaybookContext> {
  const [session, employee] = await Promise.all([getCurrentSession(), getCurrentEmployee()]);
  if (!session || !employee) return { state: "no-session" };
  if (!playbookAvailable(session.u)) return { state: "closed", name: employee.name };
  const reader: PlaybookReader = {
    username: employee.username,
    name: employee.name,
    dept: employee.dept,
    isAdmin: employee.isAdmin,
    viewerOf: employee.viewerOf,
  };
  if (!blockId) return { state: "ok", reader, block: null };
  const block = getBlock(blockId);
  if (!block || !readerSees(reader, block.audience)) return { state: "forbidden", reader };
  return { state: "ok", reader, block };
}
