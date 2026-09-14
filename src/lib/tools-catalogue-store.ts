// O que os SuperAdmins mudam no catálogo de /tools, por cima da lista de
// base em código (tools-catalogue.ts).
//
// UM REGISTO SÓ: `{ custom, hidden }`.
//   - custom: as apps acrescentadas na página, pela ordem em que entraram.
//   - hidden: ids das apps DE BASE que foram removidas. Uma app de base não
//     se apaga do código a partir da app — esconde-se.
//
// A lista final é sempre `base − hidden + custom`, calculada a cada render.
// Nunca se grava a lista inteira: uma app de base nova num deploy aparece
// sem ninguém ter de mexer no KV.

import { kv } from "@vercel/kv";
import {
  BUILTIN_WORKSPACE_TOOLS,
  isHexColor,
  type WorkspaceTool,
} from "@/lib/tools-catalogue";
import { isHttpUrl } from "@/lib/tools-access-store";

const KEY = "tools:catalogue";

export const toolsCatalogueStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

type CatalogueOverlay = {
  custom: WorkspaceTool[];
  hidden: string[];
};

const BUILTIN_IDS = new Set(BUILTIN_WORKSPACE_TOOLS.map((t) => t.id));

/** O KV devolve o objeto cru — tudo o que sai daqui passa por aqui, para a
 *  página nunca ler `undefined` num registo antigo ou mal formado. */
function hydrateCustomTool(raw: unknown): WorkspaceTool | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id) return null;
  if (typeof o.name !== "string" || !o.name) return null;
  if (!isHttpUrl(o.url)) return null;
  return {
    id: o.id,
    name: o.name,
    category: typeof o.category === "string" ? o.category : "Outros",
    description: typeof o.description === "string" ? o.description : "",
    url: o.url as string,
    logo: isHttpUrl(o.logo) ? (o.logo as string) : null,
    logoFit: o.logoFit === "contain" ? "contain" : "cover",
    accent: isHexColor(o.accent) ? o.accent : "#783DF5",
    aliases: Array.isArray(o.aliases)
      ? o.aliases.filter((a): a is string => typeof a === "string")
      : [],
    custom: true,
  };
}

async function readOverlay(): Promise<CatalogueOverlay> {
  if (!toolsCatalogueStorageConfigured) return { custom: [], hidden: [] };
  try {
    const raw = await kv.get<Record<string, unknown>>(KEY);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { custom: [], hidden: [] };
    }
    const custom = Array.isArray(raw.custom)
      ? raw.custom
          .map(hydrateCustomTool)
          .filter((t): t is WorkspaceTool => t !== null)
      : [];
    const hidden = Array.isArray(raw.hidden)
      ? raw.hidden.filter((h): h is string => typeof h === "string")
      : [];
    return { custom, hidden };
  } catch (err) {
    console.error("tools catalogue read failed:", err);
    return { custom: [], hidden: [] };
  }
}

/** A lista que a página mostra: base − removidas + acrescentadas. */
export async function listWorkspaceTools(): Promise<WorkspaceTool[]> {
  const { custom, hidden } = await readOverlay();
  const hiddenSet = new Set(hidden);
  return [
    ...BUILTIN_WORKSPACE_TOOLS.filter((t) => !hiddenSet.has(t.id)),
    ...custom,
  ];
}

export async function getWorkspaceToolById(
  id: string,
): Promise<WorkspaceTool | null> {
  return (await listWorkspaceTools()).find((t) => t.id === id) ?? null;
}

/** Todos os ids já usados, incluindo os das apps de base removidas — um id
 *  reaproveitado herdava as credenciais antigas que ficassem em KV. */
export async function takenToolIds(): Promise<string[]> {
  const { custom } = await readOverlay();
  return [...BUILTIN_IDS, ...custom.map((t) => t.id)];
}

export async function addCustomTool(tool: WorkspaceTool): Promise<void> {
  const overlay = await readOverlay();
  await kv.set(KEY, {
    custom: [...overlay.custom, { ...tool, custom: true }],
    hidden: overlay.hidden,
  } satisfies CatalogueOverlay);
}

/** Remove uma app: as acrescentadas saem do registo, as de base passam a
 *  escondidas. Devolve a app removida (para limpar o logótipo no Blob) ou
 *  null se o id não estava na lista. */
export async function removeTool(id: string): Promise<WorkspaceTool | null> {
  const overlay = await readOverlay();
  const custom = overlay.custom.find((t) => t.id === id);
  if (custom) {
    await kv.set(KEY, {
      custom: overlay.custom.filter((t) => t.id !== id),
      hidden: overlay.hidden,
    } satisfies CatalogueOverlay);
    return custom;
  }
  const builtin = BUILTIN_WORKSPACE_TOOLS.find((t) => t.id === id);
  if (!builtin || overlay.hidden.includes(id)) return null;
  await kv.set(KEY, {
    custom: overlay.custom,
    hidden: [...overlay.hidden, id],
  } satisfies CatalogueOverlay);
  return builtin;
}
