// Posição atual das target keywords de um cliente, via Serpstat.
//
// PORQUE SERPSTAT E NÃO O SERP AO VIVO: o getDomainKeywords devolve, numa
// única chamada, todas as keywords para que o domínio rankeia no top-100 da
// base regional (google.pt para a carteira), com posição, URL e volume de
// pesquisa. Cruzar isso com a lista de target keywords da client file dá a
// tabela inteira do relatório por ~centenas de créditos, em vez de uma
// pesquisa SERP paga por keyword.
//
// A base é NACIONAL (g_pt = google.pt), com o domínio completo incluindo
// subdomínios — exatamente a pesquisa «Domain with subdomains» + Portugal
// que se faria à mão no site do Serpstat.
//
// Uma target keyword que não venha na resposta não rankeia no top-100 dessa
// base — entra na tabela como posição null, porque a lista do plano
// mostra-se inteira, não só as vitórias.

import { getClientGeo } from "@/lib/client-geo";
import { bareDomain } from "./dataforseo-ranks";

const API_URL = "https://api.serpstat.com/v4/";

/** Teto por pedido — o relatório corre dentro de uma função com orçamento de
 *  tempo; uma chamada pendurada não pode levar o relatório atrás dela. */
const REQUEST_TIMEOUT_MS = 20_000;

/** Máximo de linhas por página da API (limite do Serpstat). */
const PAGE_SIZE = 1000;

/** Teto de páginas. 5000 keywords chegam para qualquer cliente da carteira;
 *  um domínio gigante não deve poder queimar créditos sem fim. */
const MAX_PAGES = 5;

/** Base regional do Serpstat a partir do geo já configurado por cliente
 *  (client-geo.ts usa códigos de localização da Google). */
const SE_BY_LOCATION: Record<number, string> = {
  2620: "g_pt",
  2826: "g_uk",
  2124: "g_ca",
  2036: "g_au",
  2076: "g_br",
  2840: "g_us",
  2724: "g_es",
  2250: "g_fr",
  2276: "g_de",
  2380: "g_it",
  2056: "g_be",
};

export function isSerpstatConfigured(): boolean {
  return Boolean(process.env.SERPSTAT_API_TOKEN);
}

export type SerpstatRank = {
  keyword: string;
  /** Posição orgânica na base regional. null = fora do top 100. */
  position: number | null;
  /** URL que rankeia, quando rankeia. */
  url: string | null;
  /** Pesquisas/mês na região (region_queries_count), quando conhecido. */
  volume: number | null;
};

export type SerpstatRankReport = {
  checkedOn: string; // ISO yyyy-mm-dd
  domain: string;
  /** Base regional consultada ("g_pt"). */
  se: string;
  /** Uma linha por TARGET keyword pedida — incluindo as que não rankeiam. */
  ranks: SerpstatRank[];
  /** O domínio tinha mais keywords do que o teto de páginas cobriu — as
   *  posições null podem ser falta de cobertura, não ausência de ranking. */
  truncated: boolean;
};

type SerpstatRow = {
  keyword?: string;
  position?: number;
  url?: string;
  region_queries_count?: number;
};

type SerpstatResponse = {
  result?: {
    data?: SerpstatRow[];
    summary_info?: { total?: number; page?: number; left_lines?: number };
  };
  error?: { code?: number; message?: string };
};

/** "pilates clínico" → "pilates clinico" — para casar targets escritas sem
 *  acentos com keywords da base que os têm, e vice-versa. */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPage(
  domain: string,
  se: string,
  page: number,
): Promise<SerpstatRow[]> {
  const token = process.env.SERPSTAT_API_TOKEN ?? "";
  const res = await fetch(`${API_URL}?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      id: "1",
      method: "SerpstatDomainProcedure.getDomainKeywords",
      params: {
        domain,
        se,
        withSubdomains: true,
        page,
        size: PAGE_SIZE,
        sort: { position: "asc" },
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Serpstat HTTP ${res.status}${text ? `: ${text.slice(0, 160)}` : ""}`,
    );
  }
  const json = (await res.json()) as SerpstatResponse;
  if (json.error) {
    throw new Error(
      `Serpstat ${json.error.code ?? ""} ${json.error.message ?? "erro"}`,
    );
  }
  return json.result?.data ?? [];
}

/** Posição atual de cada target keyword do plano de um cliente na base
 *  regional certa (google.pt por omissão), domínio + subdomínios.
 *
 *  null = não configurado / sem domínio / sem keywords. Erros da API sobem —
 *  o chamador decide o fallback. */
export async function fetchSerpstatRanks(
  slug: string,
  website: string,
  keywords: string[],
): Promise<SerpstatRankReport | null> {
  if (!isSerpstatConfigured()) return null;
  const domain = bareDomain(website);
  if (!domain) return null;

  const targets = Array.from(
    new Set(keywords.map((k) => k.trim().toLowerCase()).filter(Boolean)),
  );
  if (targets.length === 0) return null;

  const geo = getClientGeo(slug);
  const se = SE_BY_LOCATION[geo.locationCode] ?? "g_pt";

  // Melhor posição do domínio por keyword — exata primeiro, sem acentos como
  // rede. Com subdomínios a mesma keyword pode vir mais do que uma vez; fica
  // a melhor (menor) posição.
  const exact = new Map<string, SerpstatRow>();
  const folded = new Map<string, SerpstatRow>();
  const keep = (map: Map<string, SerpstatRow>, key: string, row: SerpstatRow) => {
    const prev = map.get(key);
    if (!prev || (row.position ?? Infinity) < (prev.position ?? Infinity)) {
      map.set(key, row);
    }
  };

  let truncated = false;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const rows = await fetchPage(domain, se, page);
    for (const row of rows) {
      const kw = row.keyword?.trim().toLowerCase();
      if (!kw) continue;
      keep(exact, kw, row);
      keep(folded, fold(kw), row);
    }
    if (rows.length < PAGE_SIZE) break;
    if (page === MAX_PAGES) truncated = true;
  }

  const ranks: SerpstatRank[] = targets.map((kw) => {
    const row = exact.get(kw) ?? folded.get(fold(kw));
    return {
      keyword: kw,
      position: row?.position ?? null,
      url: row?.url ?? null,
      volume: row?.region_queries_count ?? null,
    };
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
    se,
    ranks,
    truncated,
  };
}
