// Desbloqueios de projetos em pausa — escrita e leitura no servidor (v80.36).
// Uma chave só (`seo-paused-unlocks`): { <slug>: { <parte>: { until,
// grantedAt, grantedBy } } }. O middleware lê a mesma chave por REST
// (paused-projects.ts), com 15 s de cache por instância.

import "server-only";
import { kv } from "@vercel/kv";
import {
  UNLOCKS_KEY,
  parseUnlocks,
  type ProjectUnlocks,
  type UnlockUnitId,
  type UnlocksMap,
} from "./paused-unlocks-shared";

const DAY = 24 * 60 * 60 * 1000;

export async function getAllUnlocks(): Promise<UnlocksMap> {
  try {
    return parseUnlocks(await kv.get(UNLOCKS_KEY));
  } catch (err) {
    console.error("seo-paused-unlocks read failed:", err);
    return {};
  }
}

export async function getProjectUnlocks(slug: string): Promise<ProjectUnlocks> {
  return (await getAllUnlocks())[slug] ?? {};
}

/** Abre estas partes do projeto por `days` dias a contar de agora (null =
 *  sem prazo). Substitui o prazo que cada parte tivesse. */
export async function grantUnlocks(
  slug: string,
  units: UnlockUnitId[],
  days: number | null,
  by: string,
): Promise<ProjectUnlocks> {
  const all = await getAllUnlocks();
  const now = Date.now();
  const project: ProjectUnlocks = { ...(all[slug] ?? {}) };
  for (const u of units) {
    project[u] = { until: days === null ? null : now + days * DAY, grantedAt: now, grantedBy: by };
  }
  all[slug] = project;
  await kv.set(UNLOCKS_KEY, all);
  return project;
}

/** Volta a fechar uma parte (ou todas, sem `unit`). */
export async function revokeUnlock(slug: string, unit?: UnlockUnitId): Promise<ProjectUnlocks> {
  const all = await getAllUnlocks();
  const project: ProjectUnlocks = { ...(all[slug] ?? {}) };
  if (unit) delete project[unit];
  if (!unit || Object.keys(project).length === 0) delete all[slug];
  else all[slug] = project;
  await kv.set(UNLOCKS_KEY, all);
  return unit ? project : {};
}
