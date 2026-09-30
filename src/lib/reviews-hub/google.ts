// Google Business Profile — o que o Reviews Hub precisa: descobrir os perfis
// do cliente, ler as reviews e publicar respostas.
//
// Autenticação: a MESMA conta de serviço do relatório mensal (google-auth.ts),
// a fazer-se passar por seo@wonder-ads.com, que gere os perfis dos clientes.
// Os perfis/contas vêm das APIs v1 (Account Management + Business
// Information); as reviews e as respostas só existem na API v4 antiga
// (mybusiness.googleapis.com), que continua a ser a oficial para isto.

import { getGoogleAccessToken, googleAuthConfigured } from "@/lib/google-auth";
import type { ReviewsHubClient } from "./config";
import type { HubLocation, HubReview, StarLevel, SyncErrorKind } from "./types";

const SCOPES = ["https://www.googleapis.com/auth/business.manage"];
const ACCOUNTS_API = "https://mybusinessaccountmanagement.googleapis.com/v1";
const INFO_API = "https://mybusinessbusinessinformation.googleapis.com/v1";
const V4_API = "https://mybusiness.googleapis.com/v4";

export const googleReviewsConfigured = googleAuthConfigured;

/** Um erro da Google já classificado para a página mostrar o que fazer. */
export class GbpError extends Error {
  kind: SyncErrorKind;
  status: number;
  fixUrl: string | null;
  constructor(message: string, kind: SyncErrorKind, status: number, fixUrl: string | null = null) {
    super(message);
    this.kind = kind;
    this.status = status;
    this.fixUrl = fixUrl;
  }
}

export async function gbpToken(): Promise<string> {
  if (!googleAuthConfigured) {
    throw new GbpError(
      "A conta de serviço da Google não está configurada neste ambiente.",
      "not-configured",
      0,
    );
  }
  return getGoogleAccessToken(SCOPES);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type GoogleErrorBody = {
  error?: {
    message?: string;
    status?: string;
    details?: { reason?: string; metadata?: Record<string, string> }[];
  };
};

async function toGbpError(res: Response, what: string): Promise<GbpError> {
  const text = await res.text().catch(() => "");
  let body: GoogleErrorBody = {};
  try {
    body = JSON.parse(text) as GoogleErrorBody;
  } catch {
    /* HTML (404 da v4) ou vazio */
  }
  const details = body.error?.details ?? [];
  const reason = details.find((d) => d.reason)?.reason ?? "";
  const meta = details.find((d) => d.metadata)?.metadata ?? {};
  const msg = body.error?.message ?? `HTTP ${res.status}`;

  if (res.status === 429 && meta.quota_limit_value === "0") {
    return new GbpError(
      `A Google ainda não aprovou o acesso à API do Business Profile para este projeto (quota 0). ${what}`,
      "quota",
      429,
    );
  }
  if (res.status === 429) {
    return new GbpError(
      `A Google limitou os pedidos por minuto — tenta outra vez daqui a pouco. ${what}`,
      "quota",
      429,
    );
  }
  if (reason === "SERVICE_DISABLED" || /has not been used|is disabled/i.test(msg)) {
    return new GbpError(
      `A API «${meta.serviceTitle ?? meta.service ?? "Google My Business API"}» está desligada no projeto da Google Cloud.`,
      "api-disabled",
      res.status,
      meta.activationUrl ?? null,
    );
  }
  if (res.status === 401 || res.status === 403) {
    return new GbpError(
      `Sem permissão na Google para ${what} (${msg}).`,
      "permission",
      res.status,
    );
  }
  return new GbpError(`${what}: ${msg}`, "other", res.status);
}

/** fetch com recuo exponencial nos 429/503 — a quota da GBP é curta. */
async function gfetch(
  url: string | URL,
  token: string,
  init: RequestInit = {},
  what = "pedido à Google",
): Promise<Response> {
  let attempt = 0;
  for (;;) {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
    if (res.ok) return res;
    const retriable = res.status === 503 || res.status === 500 || res.status === 429;
    if (!retriable || attempt >= 3) throw await toGbpError(res, what);
    // Quota zero não passa com espera — não vale a pena insistir.
    if (res.status === 429) {
      const peek = await res.clone().text().catch(() => "");
      if (peek.includes('"quota_limit_value": "0"') || peek.includes('"quota_limit_value":"0"')) {
        throw await toGbpError(res, what);
      }
    }
    const retryAfter = Number(res.headers.get("retry-after"));
    const wait =
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 800 * 2 ** attempt;
    await sleep(Math.min(wait, 8000));
    attempt++;
  }
}

// --- Perfis -----------------------------------------------------------------

type ApiLocation = {
  name: string;
  title?: string;
  websiteUri?: string;
  storefrontAddress?: { addressLines?: string[]; locality?: string; postalCode?: string };
  metadata?: { mapsUri?: string; newReviewUri?: string; placeId?: string };
};

/** «Cidália Cabeleireiros - Alma Shopping» → «Alma Shopping». Vazio quando o
 *  perfil tem só o nome da marca (quem chama usa a localidade). */
export function shortLocationName(title: string, brand: string): string {
  const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stripped = title
    .replace(new RegExp(`^\\s*${escaped}\\s*[-–—|·:]?\\s*`, "i"), "")
    .trim();
  return stripped;
}

/** Todos os perfis do cliente que a conta de serviço vê, com a conta de
 *  cada um. Poucos pedidos (1 por conta), mas feitos raramente — o resultado
 *  fica guardado e só se repete numa sync completa. */
export async function listClientLocations(
  token: string,
  cfg: ReviewsHubClient,
): Promise<HubLocation[]> {
  const accounts: string[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`${ACCOUNTS_API}/accounts`);
    url.searchParams.set("pageSize", "20");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await gfetch(url, token, {}, "listar as contas GMB");
    const json = (await res.json()) as { accounts?: { name?: string }[]; nextPageToken?: string };
    for (const a of json.accounts ?? []) if (a.name) accounts.push(a.name);
    pageToken = json.nextPageToken;
  } while (pageToken);

  const out = new Map<string, HubLocation>();
  for (const account of accounts) {
    let locToken: string | undefined;
    do {
      const url = new URL(`${INFO_API}/${account}/locations`);
      url.searchParams.set("readMask", "name,title,websiteUri,storefrontAddress,metadata");
      url.searchParams.set("pageSize", "100");
      if (locToken) url.searchParams.set("pageToken", locToken);
      let json: { locations?: ApiLocation[]; nextPageToken?: string };
      try {
        const res = await gfetch(url, token, {}, "listar os perfis GMB");
        json = (await res.json()) as typeof json;
      } catch (err) {
        // Uma conta sem permissão não pode impedir as outras.
        if (err instanceof GbpError && err.kind === "permission") break;
        throw err;
      }
      for (const l of json.locations ?? []) {
        const title = l.title ?? "";
        if (!cfg.matchTitle.test(title)) continue;
        const id = l.name.replace(/^locations\//, "");
        // O mesmo perfil pode aparecer em duas contas (grupo + pessoal) —
        // fica o primeiro, que é o que a conta de grupo devolve.
        if (out.has(id)) continue;
        const addr = l.storefrontAddress;
        out.set(id, {
          id,
          accountId: account.replace(/^accounts\//, ""),
          title,
          short: shortLocationName(title, cfg.brand) || addr?.locality || "Salão principal",
          locality: addr?.locality,
          address: addr?.addressLines?.join(", "),
          mapsUri: l.metadata?.mapsUri,
          newReviewUri: l.metadata?.newReviewUri,
          placeId: l.metadata?.placeId,
        });
      }
      locToken = json.nextPageToken;
      await sleep(150);
    } while (locToken);
  }
  return [...out.values()].sort((a, b) => a.short.localeCompare(b.short, "pt"));
}

// --- Reviews ----------------------------------------------------------------

type ApiReview = {
  name?: string;
  reviewId?: string;
  reviewer?: { profilePhotoUrl?: string; displayName?: string; isAnonymous?: boolean };
  starRating?: string;
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: { comment?: string; updateTime?: string };
};

const STARS: Record<string, StarLevel> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

/** A Google junta a tradução automática ao texto quando o idioma do autor é
 *  outro: «(Translated by Google) … (Original) …». Fica só o original. */
export function originalComment(raw: string | undefined): string {
  const text = (raw ?? "").trim();
  if (!text) return "";
  const original = text.match(/\(Original\)\s*([\s\S]*)$/);
  if (original) return original[1].trim();
  const translated = text.split(/\n*\(Translated by Google\)/)[0];
  return translated.trim();
}

export function normaliseReview(r: ApiReview, loc: string): HubReview | null {
  if (!r.reviewId) return null;
  const replyText = r.reviewReply?.comment ? originalComment(r.reviewReply.comment) : "";
  return {
    id: r.reviewId,
    loc,
    author: r.reviewer?.isAnonymous
      ? "Cliente anónimo"
      : r.reviewer?.displayName?.trim() || "Cliente Google",
    ...(r.reviewer?.profilePhotoUrl ? { photo: r.reviewer.profilePhotoUrl } : {}),
    ...(r.reviewer?.isAnonymous ? { anon: true } : {}),
    stars: STARS[r.starRating ?? ""] ?? 0,
    text: originalComment(r.comment),
    created: r.createTime ?? r.updateTime ?? new Date(0).toISOString(),
    updated: r.updateTime ?? r.createTime ?? new Date(0).toISOString(),
    ...(replyText
      ? { reply: { text: replyText, updated: r.reviewReply?.updateTime ?? r.updateTime ?? "" } }
      : {}),
  };
}

export type ReviewsPage = {
  reviews: HubReview[];
  averageRating: number | null;
  totalReviewCount: number | null;
  nextPageToken: string | null;
};

export async function fetchReviewsPage(
  token: string,
  loc: HubLocation,
  pageToken?: string,
): Promise<ReviewsPage> {
  const url = new URL(`${V4_API}/accounts/${loc.accountId}/locations/${loc.id}/reviews`);
  url.searchParams.set("pageSize", "50");
  url.searchParams.set("orderBy", "updateTime desc");
  if (pageToken) url.searchParams.set("pageToken", pageToken);
  const res = await gfetch(url, token, {}, `ler as reviews de ${loc.short}`);
  const json = (await res.json()) as {
    reviews?: ApiReview[];
    averageRating?: number;
    totalReviewCount?: number;
    nextPageToken?: string;
  };
  return {
    reviews: (json.reviews ?? [])
      .map((r) => normaliseReview(r, loc.id))
      .filter((r): r is HubReview => r !== null),
    averageRating: typeof json.averageRating === "number" ? json.averageRating : null,
    totalReviewCount: typeof json.totalReviewCount === "number" ? json.totalReviewCount : null,
    nextPageToken: json.nextPageToken ?? null,
  };
}

/** Publica (ou substitui) a resposta do proprietário a uma review. */
export async function putReply(
  token: string,
  loc: HubLocation,
  reviewId: string,
  text: string,
): Promise<{ text: string; updated: string }> {
  const url = `${V4_API}/accounts/${loc.accountId}/locations/${loc.id}/reviews/${encodeURIComponent(reviewId)}/reply`;
  const res = await gfetch(
    url,
    token,
    { method: "PUT", body: JSON.stringify({ comment: text }) },
    "publicar a resposta",
  );
  const json = (await res.json().catch(() => ({}))) as { comment?: string; updateTime?: string };
  return {
    text: json.comment ?? text,
    updated: json.updateTime ?? new Date().toISOString(),
  };
}
