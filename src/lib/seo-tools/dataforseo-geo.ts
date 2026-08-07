// GEO — em que perguntas feitas a um LLM o cliente já aparece, e em quais
// aparecem outros no lugar dele.
//
// Duas perguntas, dois pedidos ao mesmo endpoint (`llm_mentions/
// search_mentions/live`), que devolve perguntas reais feitas ao ChatGPT e à
// AI Overview da Google, com o volume de pesquisa e as fontes citadas:
//
//   1. ONDE JÁ APARECEMOS — filtra pelo domínio do cliente. É o número que
//      responde a «isto está a funcionar?».
//   2. ONDE PODÍAMOS APARECER — filtra pelo tópico das target keywords e
//      EXCLUI o domínio do cliente. Cada linha é uma pergunta que gente real
//      faz, sobre o que o cliente vende, onde hoje é outro que é citado. As
//      fontes dizem quem.
//
// ⚠️ COBERTURA: o corpus em português de Portugal é fino. Medido a 07/08/2026:
// "dental implants" (US/en) devolve 5977 perguntas, "fisioterapia" (PT/pt)
// devolve 48, e "dentista lisboa" ou "clínica dentária" devolvem ZERO. Não é
// um bug da integração — é o estado do mercado. Por isso esta secção só se
// desenha quando há mesmo dados (ver `hasSignal`), em vez de mostrar uma
// grelha de zeros que faria o cliente concluir que o trabalho não existe.

import { getClientGeo } from "@/lib/client-geo";
import { isDataforSeoConfigured } from "./dataforseo";
import { bareDomain } from "./dataforseo-ranks";

const API_BASE = "https://api.dataforseo.com/v3";

/** Quantas target keywords se usam como tópico das perguntas de oportunidade.
 *  Cada uma é um pedido a ~$0,10 — cinco chegam para um relatório e mantêm o
 *  custo por cliente na casa dos sessenta cêntimos. */
const GAP_TOPICS = 5;

/** A documentação admite até 120 s por pedido live. O relatório não tem esse
 *  tempo para dar — ao fim de 30 s a secção de GEO desiste e o resto do
 *  relatório sai na mesma. */
const REQUEST_TIMEOUT_MS = 30_000;

export type GeoPrompt = {
  /** "google" (AI Overview) ou "chat_gpt". */
  platform: string;
  /** A pergunta tal como é feita. */
  question: string;
  /** Pesquisas/mês que podem despoletar esta resposta. */
  aiSearchVolume: number;
  /** Domínios citados na resposta, por ordem. */
  sources: string[];
};

export type GeoReport = {
  checkedOn: string;
  domain: string;
  locationCode: number;
  languageCode: string;
  /** Perguntas onde o cliente JÁ é citado. */
  present: GeoPrompt[];
  /** Quantas ao todo (o `present` está truncado). */
  presentTotal: number;
  /** Perguntas sobre os tópicos do cliente onde ele NÃO é citado. */
  gaps: { topic: string; total: number; prompts: GeoPrompt[] }[];
  costUsd: number;
};

type MentionItem = {
  platform?: string;
  question?: string;
  ai_search_volume?: number;
  sources?: { domain?: string }[];
};

type MentionTask = {
  status_code?: number;
  status_message?: string;
  result?: { total_count?: number; items?: MentionItem[] }[];
};

type TargetEntity = {
  domain?: string;
  keyword?: string;
  search_filter: "include" | "exclude";
  search_scope?: string[];
  match_type?: string;
};

async function searchMentions(
  target: TargetEntity[],
  locationCode: number,
  languageCode: string,
  limit: number,
): Promise<{ total: number; items: GeoPrompt[]; cost: number }> {
  const auth = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`,
  ).toString("base64");
  const res = await fetch(
    `${API_BASE}/ai_optimization/llm_mentions/search_mentions/live`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify([
        {
          language_code: languageCode,
          location_code: locationCode,
          target,
          order_by: ["ai_search_volume,desc"],
          limit,
        },
      ]),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `LLM mentions HTTP ${res.status}${text ? `: ${text.slice(0, 160)}` : ""}`,
    );
  }
  const json = (await res.json()) as { cost?: number; tasks?: MentionTask[] };
  const task = json.tasks?.[0];
  if (task?.status_code && task.status_code >= 40000) {
    throw new Error(`LLM mentions ${task.status_code} ${task.status_message ?? ""}`);
  }
  const result = task?.result?.[0];
  return {
    total: result?.total_count ?? 0,
    items: (result?.items ?? []).map((it) => ({
      platform: it.platform ?? "—",
      question: it.question ?? "",
      aiSearchVolume: it.ai_search_volume ?? 0,
      sources: (it.sources ?? [])
        .map((s) => bareDomain(s.domain ?? ""))
        .filter(Boolean),
    })),
    cost: json.cost ?? 0,
  };
}

/** Palavras que não são tópico nenhum: ligação, e as cidades onde os
 *  clientes operam. "fisioterapia belém lisboa" é uma keyword de SEO local
 *  excelente e um tópico de LLM péssimo — ninguém pergunta ao ChatGPT
 *  "fisioterapia belém lisboa", perguntam sobre fisioterapia. */
const TOPIC_STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas", "a", "o",
  "as", "os", "e", "com", "para", "por", "um", "uma", "the", "in", "of",
  "for", "and", "best", "melhor", "melhores", "preço", "preços", "perto",
  "lisboa", "porto", "cascais", "belém", "belem", "restelo", "estoril",
  "oeiras", "sintra", "amadora", "almada", "london", "lisbon", "uk",
]);

/** Tópicos para as perguntas de oportunidade.
 *
 *  As target keywords são long-tail LOCAL por construção, e nenhum dos dois
 *  extremos serve:
 *
 *   • A keyword tal e qual devolve zero ("fisioterapia belém lisboa" → 0).
 *   • Uma palavra só devolve lixo. Medido a 07/08/2026 com "coluna",
 *     "tratamento" e "adolescentes" como tópicos: vieram "coluna worten",
 *     "unidade de tratamento intensivo" e "séries para adolescentes". São
 *     perguntas reais, com volume real, e nenhuma tem que ver com o cliente.
 *
 *  O meio-termo é a keyword SEM a cauda geográfica: "tratamento escoliose
 *  lisboa" → "tratamento escoliose". Mantém o serviço, perde o sítio — que é
 *  exatamente o que distingue uma pergunta feita a um LLM de uma pesquisa
 *  local. Preferem-se os tópicos com mais palavras: quanto mais específico,
 *  menos lixo entra. */
export function topicsFromKeywords(keywords: string[], max = GAP_TOPICS): string[] {
  const seen = new Map<string, number>();
  for (const kw of keywords) {
    const words = kw
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !TOPIC_STOPWORDS.has(w));
    if (words.length === 0) continue;
    const topic = words.join(" ");
    seen.set(topic, (seen.get(topic) ?? 0) + 1);
  }
  return Array.from(seen.entries())
    .sort((a, b) => {
      const wordsA = a[0].split(" ").length;
      const wordsB = b[0].split(" ").length;
      // Mais palavras primeiro (mais específico); depois o que mais se repete.
      if (wordsA !== wordsB) return wordsB - wordsA;
      return b[1] - a[1] || a[0].localeCompare(b[0]);
    })
    .slice(0, max)
    .map(([t]) => t);
}

/** True quando vale a pena mostrar a secção ao cliente. Zero perguntas em
 *  ambos os lados não é «má notícia», é ausência de mercado — e uma secção
 *  vazia num relatório lê-se como trabalho não feito. */
export function hasGeoSignal(report: GeoReport | null): boolean {
  if (!report) return false;
  return (
    report.presentTotal > 0 || report.gaps.some((g) => g.prompts.length > 0)
  );
}

export async function fetchGeoReport(
  slug: string,
  website: string,
  keywords: string[],
): Promise<GeoReport | null> {
  if (!isDataforSeoConfigured()) return null;
  const domain = bareDomain(website);
  if (!domain) return null;

  const geo = getClientGeo(slug);
  const topics = topicsFromKeywords(keywords);

  let costUsd = 0;

  // 1. Onde já aparecemos. Sem filtro de tópico de propósito: a pergunta é
  //    «onde é que este domínio é citado», não «onde é citado sobre X».
  const presentRes = await searchMentions(
    [{ domain, search_filter: "include", search_scope: ["any"] }],
    geo.locationCode,
    geo.languageCode,
    15,
  ).catch(() => null);
  costUsd += presentRes?.cost ?? 0;

  // 2. Onde podíamos aparecer, um tópico de cada vez.
  const gapResults = await Promise.all(
    topics.map(async (topic) => {
      const r = await searchMentions(
        [
          {
            keyword: topic,
            search_filter: "include",
            search_scope: ["question"],
            match_type: "partial_match",
          },
          { domain, search_filter: "exclude" },
        ],
        geo.locationCode,
        geo.languageCode,
        5,
      ).catch(() => null);
      return { topic, r };
    }),
  );

  const gaps = gapResults.map(({ topic, r }) => {
    costUsd += r?.cost ?? 0;
    return { topic, total: r?.total ?? 0, prompts: r?.items ?? [] };
  });

  return {
    checkedOn: new Date().toISOString().slice(0, 10),
    domain,
    locationCode: geo.locationCode,
    languageCode: geo.languageCode,
    present: presentRes?.items ?? [],
    presentTotal: presentRes?.total ?? 0,
    gaps: gaps.filter((g) => g.prompts.length > 0),
    costUsd: Math.round(costUsd * 10000) / 10000,
  };
}
