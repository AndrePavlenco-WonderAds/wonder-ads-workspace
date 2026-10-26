// O portão de todas as páginas da Documentação, resolvido no servidor. Cada
// página chama isto e decide sozinha — o menu esconder o item não fecha
// nada (ver a lição do /admin: o layout não é fronteira de segurança).

import "server-only";
import { getCurrentEmployee, getCurrentSession } from "@/lib/auth/server";
import { getEmployeeDisplay } from "@/lib/auth/credentials";
import { docsAvailable, readerSees, type DocsReader } from "./access";
import { getBlock, type DocsBlock } from "./blocks";

export type DocsContext =
  | { state: "no-session" }
  | { state: "closed"; name: string }
  | { state: "forbidden"; reader: DocsReader }
  | { state: "ok"; reader: DocsReader; block: DocsBlock | null };

/** `blockId` = o bloco da página; omitido no hub. */
export async function getDocsContext(blockId?: string): Promise<DocsContext> {
  const [session, employee] = await Promise.all([getCurrentSession(), getCurrentEmployee()]);
  if (!session || !employee) return { state: "no-session" };
  if (!docsAvailable(session.u)) return { state: "closed", name: employee.name };
  const reader: DocsReader = {
    username: employee.username,
    name: employee.name,
    dept: employee.dept,
    isAdmin: employee.isAdmin,
    viewerOf: employee.viewerOf,
    tags: getEmployeeDisplay(employee.username)?.tags ?? [],
  };
  if (!blockId) return { state: "ok", reader, block: null };
  const block = getBlock(blockId);
  if (!block || !readerSees(reader, block.audience)) return { state: "forbidden", reader };
  return { state: "ok", reader, block };
}
