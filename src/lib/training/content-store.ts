// Override editável do catálogo da Formação — mesmo padrão do curso de
// onboarding de clientes (`onboarding-content-store.ts`): um único blob em KV
// com a estrutura completa; ausente ou inválido → defaults em código.
//
// Isto é o que substitui "migrações + seed" num backend sem SQL: o seed é o
// ficheiro `catalog.ts`, portanto uma instalação limpa funciona sem escrever
// uma única chave em KV.

import { kv } from "@vercel/kv";
import {
  DEFAULT_TRAINING_TRACKS,
  normalizeCatalog,
  type TrainingTrack,
} from "@/lib/training/catalog";

const CATALOG_KEY = "training-course";

export const trainingStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

/** Catálogo em vigor — override de KV quando válido, senão o default. */
export async function getTrainingCatalog(): Promise<TrainingTrack[]> {
  if (!trainingStorageConfigured) return DEFAULT_TRAINING_TRACKS;
  try {
    const stored = await kv.get<unknown>(CATALOG_KEY);
    if (stored == null) return DEFAULT_TRAINING_TRACKS;
    return normalizeCatalog(stored) ?? DEFAULT_TRAINING_TRACKS;
  } catch (err) {
    console.error("KV training-course read failed:", err);
    return DEFAULT_TRAINING_TRACKS;
  }
}

/** True quando existe um override gravado (o CMS mostra "personalizado"). */
export async function trainingCatalogIsCustom(): Promise<boolean> {
  if (!trainingStorageConfigured) return false;
  try {
    return (await kv.get<unknown>(CATALOG_KEY)) != null;
  } catch {
    return false;
  }
}

export async function saveTrainingCatalog(
  raw: unknown,
): Promise<TrainingTrack[]> {
  if (!trainingStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const normalized = normalizeCatalog(raw);
  if (!normalized) {
    throw new Error(
      "Estrutura do catálogo inválida (falta a track comum, ou há ids de aula repetidos).",
    );
  }
  await kv.set(CATALOG_KEY, normalized);
  return normalized;
}

/** Repõe o catálogo original (apaga o override). */
export async function resetTrainingCatalog(): Promise<void> {
  if (!trainingStorageConfigured) return;
  await kv.del(CATALOG_KEY);
}
