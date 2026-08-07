// Posição real na Google para as target keywords de um cliente, via
// DataForSEO SERP API.
//
// PORQUE É QUE ISTO EXISTE AO LADO DO GSC: o Search Console dá a posição
// MÉDIA sobre as impressões que a Google decidiu servir. Uma keyword sem
// impressões desaparece de lá — não é «não rankeia», é «não sabemos». Aqui
// pergunta-se a uma página de resultados fixa, e toda a keyword tem resposta.
//
// PORQUE É QUE SUBSTITUI O SE RANKING: o plano do SE Ranking tem um teto de
// 10 websites, o que deixava dez clientes de fora. Isto é pago à verificação
// ($0,0155 por keyword a depth 100), sem teto de projetos — a carteira toda,
// uma vez por mês, custa cerca de $10.
//
// Live mode de propósito: o relatório é gerado a pedido e uma fila
// assíncrona obrigaria a polling, a cron e a um sítio onde guardar tarefas a
// meio. A dois cêntimos por keyword, a fila não se paga.

import { getClientGeo } from "@/lib/client-geo";
import { isDataforSeoConfigured } from "./dataforseo";

const API_BASE = "https://api.dataforseo.com/v3";

/** Quantas keywords em voo ao mesmo tempo. A DataForSEO aceita muito mais,
 *  mas o relatório não fica melhor por chegar 2 segundos mais cedo e um
 *  cliente com 200 keywords não deve conseguir esgotar sozinho o rate limit
 *  de toda a gente. */
const CONCURRENCY = 8;

/** Profundidade da consulta. 100 porque metade do valor de um rank tracker
 *  está em ver uma keyword sair de 80 para 40 — o cliente não vê diferença
 *  nenhuma, mas é a prova de que a coisa está a andar. */
const DEPTH = 100;

export type DfsRank = {
  keyword: string;
  /** Posição orgânica (rank_group). null = fora do top 100. */
  position: number | null;
  /** URL que rankeia, quando rankeia. */
  url: string | null;
  /** Apareceu no pack local (mapa) — para uma clínica, muitas vezes é este
   *  que marca consultas, não o link azul. */
  inLocalPack: boolean;
  /** Posição no pack local, quando lá está. */
  localPackPosition: number | null;
};

export type DfsRankReport = {
  checkedOn: string; // ISO yyyy-mm-dd
  domain: string;
  locationCode: number;
  languageCode: string;
  ranks: DfsRank[];
  /** Custo real desta consulta, em USD. Vai para a vista interna — uma
   *  integração paga à chamada tem de dizer o que gastou. */
  costUsd: number;
  /** Keywords que a API recusou ou que rebentaram. Vazio no caso normal. */
  failed: string[];
};

type SerpItem = {
  type?: string;
  rank_group?: number;
  rank_absolute?: number;
  domain?: string;
  url?: string;
  items?: SerpItem[];
};

type SerpTask = {
  status_code?: number;
  status_message?: string;
  result?: { items?: SerpItem[] }[];
};

/** "https://www.whiteclinic.pt/x" → "whiteclinic.pt" */
export function bareDomain(input: string): string {
  const raw = input.trim();
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return raw.replace(/^www\./, "").toLowerCase();
  }
}

function matchesDomain(candidate: string | undefined, domain: string): boolean {
  if (!candidate) return false;
  const host = bareDomain(candidate);
  return host === domain || host.endsWith(`.${domain}`);
}

async function serpFor(
  keyword: string,
  domain: string,
  locationCode: number,
  languageCode: string,
): Promise<{ rank: DfsRank; cost: number }> {
  const auth = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`,
  ).toString("base64");
  const res = await fetch(`${API_BASE}/serp/google/organic/live/advanced`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify([
      {
        keyword,
        location_code: locationCode,
        language_code: languageCode,
        device: "desktop",
        depth: DEPTH,
      },
    ]),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SERP HTTP ${res.status}${text ? `: ${text.slice(0, 160)}` : ""}`);
  }
  const json = (await res.json()) as { cost?: number; tasks?: SerpTask[] };
  const task = json.tasks?.[0];
  if (task?.status_code && task.status_code >= 40000) {
    throw new Error(`SERP ${task.status_code} ${task.status_message ?? ""}`);
  }
  const items = task?.result?.[0]?.items ?? [];

  let position: number | null = null;
  let url: string | null = null;
  let inLocalPack = false;
  let localPackPosition: number | null = null;

  for (const item of items) {
    if (item.type === "organic" && position === null) {
      if (matchesDomain(item.domain ?? item.url, domain)) {
        position = item.rank_group ?? item.rank_absolute ?? null;
        url = item.url ?? null;
      }
    }
    // O pack local vem como um item com filhos; a nossa ficha pode estar em
    // qualquer um deles.
    if (item.type === "local_pack" && !inLocalPack) {
      const children = item.items ?? [item];
      children.forEach((child, i) => {
        if (!inLocalPack && matchesDomain(child.domain ?? child.url, domain)) {
          inLocalPack = true;
          localPackPosition = child.rank_group ?? i + 1;
        }
      });
    }
  }

  return {
    rank: { keyword, position, url, inLocalPack, localPackPosition },
    cost: json.cost ?? 0,
  };
}

/** Corre `tasks` com um teto de paralelismo, preservando a ordem. */
async function pooled<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        out[i] = { status: "fulfilled", value: await fn(items[i]) };
      } catch (reason) {
        out[i] = { status: "rejected", reason };
      }
    }
  });
  await Promise.all(workers);
  return out;
}

/** Posição real de cada keyword do plano de um cliente.
 *
 *  Best-effort por keyword: uma que rebente entra em `failed` e as outras
 *  saem na mesma. Um relatório inteiro não se perde porque uma pesquisa
 *  falhou. */
export async function fetchDfsRanks(
  slug: string,
  website: string,
  keywords: string[],
  opts: { max?: number } = {},
): Promise<DfsRankReport | null> {
  if (!isDataforSeoConfigured()) return null;
  const domain = bareDomain(website);
  if (!domain) return null;

  const list = Array.from(
    new Set(keywords.map((k) => k.trim().toLowerCase()).filter(Boolean)),
  ).slice(0, opts.max ?? 300);
  if (list.length === 0) return null;

  const geo = getClientGeo(slug);
  const settled = await pooled(list, CONCURRENCY, (kw) =>
    serpFor(kw, domain, geo.locationCode, geo.languageCode),
  );

  const ranks: DfsRank[] = [];
  const failed: string[] = [];
  let costUsd = 0;
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      ranks.push(r.value.rank);
      costUsd += r.value.cost;
    } else {
      failed.push(list[i]);
    }
  });

  // A rankear primeiro, por posição; as que ainda não aparecem no fim.
  ranks.sort((a, b) => {
    if (a.position === null && b.position === null) {
      return a.keyword.localeCompare(b.keyword, "pt");
    }
    if (a.position === null) return 1;
    if (b.position === null) return -1;
    return a.position - b.position;
  });

  return {
    checkedOn: new Date().toISOString().slice(0, 10),
    domain,
    locationCode: geo.locationCode,
    languageCode: geo.languageCode,
    ranks,
    costUsd: Math.round(costUsd * 10000) / 10000,
    failed,
  };
}
