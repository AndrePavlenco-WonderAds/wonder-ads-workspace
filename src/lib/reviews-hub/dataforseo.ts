// DataForSEO — a segunda fonte de reviews do Reviews Hub.
//
// Porquê: as reviews (e as respostas) só existem na API v4 da Google
// («Google My Business API»). Enquanto essa API estiver desligada no projeto
// da conta de serviço, as reviews de cada salão vêm do Google Reviews API da
// DataForSEO, pelo place_id que a própria Google nos dá na lista de perfis.
// É só leitura: publicar passa a «Copiar e responder no Google» (abre a
// review certa no Google Maps). Quando a v4 responder, a sync volta sozinha
// à Google e a publicação com um clique.
//
// Custo (standard): 0,00075 $ por cada 10 reviews devolvidas; prioridade
// (resposta em ~1 min): 0,0015 $. A leitura completa inicial dos 14 salões
// fica na casa dos cêntimos; as leituras de manutenção pedem só as 10 mais
// recentes de cada salão, e só de 2 em 2 horas.

import type { HubLocation, HubReview, StarLevel } from "./types";

const API = "https://api.dataforseo.com/v3/business_data/google/reviews";
const PORTUGAL = 2620;

export function dfsConfigured(): boolean {
  return Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);
}

function authHeader(): string {
  return `Basic ${Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`,
  ).toString("base64")}`;
}

export type DfsTask = {
  id: string;
  postedAt: number;
  depth: number;
  priority: 1 | 2;
  /** Leitura completa (substitui a lista) ou só as mais recentes (junta). */
  full: boolean;
};

/** Cria uma tarefa por salão, num só pedido. Devolve locId → tarefa. */
export async function postReviewTasks(
  items: { loc: HubLocation; depth: number; priority: 1 | 2; full: boolean }[],
): Promise<Record<string, DfsTask>> {
  const withPlace = items.filter((i) => i.loc.placeId);
  if (withPlace.length === 0) return {};
  const res = await fetch(`${API}/task_post`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(
      withPlace.map((i) => ({
        place_id: i.loc.placeId,
        location_code: PORTUGAL,
        language_code: "pt",
        depth: i.depth,
        sort_by: "newest",
        priority: i.priority,
        tag: i.loc.id,
      })),
    ),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as {
    status_code?: number;
    status_message?: string;
    tasks?: { id?: string; status_code?: number; status_message?: string; data?: { tag?: string } }[];
  };
  if (!res.ok || (json.status_code && json.status_code >= 40000)) {
    throw new Error(`DataForSEO: ${json.status_message ?? `HTTP ${res.status}`}`);
  }
  const out: Record<string, DfsTask> = {};
  const now = Date.now();
  for (const t of json.tasks ?? []) {
    const locId = t.data?.tag;
    const spec = withPlace.find((i) => i.loc.id === locId);
    if (!t.id || !locId || !spec || (t.status_code ?? 0) >= 40000) continue;
    out[locId] = { id: t.id, postedAt: now, depth: spec.depth, priority: spec.priority, full: spec.full };
  }
  return out;
}

type DfsItem = {
  review_id?: string;
  review_text?: string | null;
  original_review_text?: string | null;
  timestamp?: string | null;
  rating?: { value?: number | null } | null;
  profile_name?: string | null;
  profile_image_url?: string | null;
  review_url?: string | null;
  owner_answer?: string | null;
  original_owner_answer?: string | null;
  owner_timestamp?: string | null;
};

export type DfsTaskResult =
  | { status: "pending" }
  | { status: "error"; message: string }
  | { status: "done"; reviews: HubReview[]; total: number | null; average: number | null };

/** «2024-05-12 10:23:45 +00:00» → ISO. */
function dfsDate(v: string | null | undefined): string | null {
  if (!v) return null;
  const iso = v.trim().replace(" ", "T").replace(" +", "+").replace(" -", "-");
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function toReview(item: DfsItem, loc: string): HubReview | null {
  if (!item.review_id) return null;
  const created = dfsDate(item.timestamp) ?? new Date(0).toISOString();
  const stars = Math.round(item.rating?.value ?? 0);
  const replyText = (item.original_owner_answer ?? item.owner_answer ?? "").trim();
  return {
    id: item.review_id,
    loc,
    author: item.profile_name?.trim() || "Cliente Google",
    ...(item.profile_image_url ? { photo: item.profile_image_url } : {}),
    stars: (stars >= 1 && stars <= 5 ? stars : 0) as 0 | StarLevel,
    text: (item.original_review_text ?? item.review_text ?? "").trim(),
    created,
    updated: created,
    ...(item.review_url ? { url: item.review_url } : {}),
    ...(replyText
      ? { reply: { text: replyText, updated: dfsDate(item.owner_timestamp) ?? created } }
      : {}),
  };
}

export async function getReviewTask(taskId: string, loc: string): Promise<DfsTaskResult> {
  const res = await fetch(`${API}/task_get/${encodeURIComponent(taskId)}`, {
    headers: { Authorization: authHeader() },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as {
    tasks?: {
      status_code?: number;
      status_message?: string;
      result?: {
        reviews_count?: number | null;
        rating?: { value?: number | null } | null;
        items?: DfsItem[] | null;
      }[] | null;
    }[];
  };
  const task = json.tasks?.[0];
  const code = task?.status_code ?? 0;
  // 40601 «Task Handed» / 40602 «Task In Queue» — ainda a correr.
  if (code === 40601 || code === 40602 || code === 20100) return { status: "pending" };
  if (!res.ok || code !== 20000) {
    return { status: "error", message: task?.status_message ?? `HTTP ${res.status}` };
  }
  const result = task?.result?.[0];
  const reviews = (result?.items ?? [])
    .map((i) => toReview(i, loc))
    .filter((r): r is HubReview => r !== null);
  return {
    status: "done",
    reviews,
    total: typeof result?.reviews_count === "number" ? result.reviews_count : null,
    average: typeof result?.rating?.value === "number" ? result.rating.value : null,
  };
}
