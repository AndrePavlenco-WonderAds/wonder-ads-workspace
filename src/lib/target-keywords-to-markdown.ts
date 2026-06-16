// Render a client-facing, read-only markdown table of a client's Target
// Keywords list. Fed into PublicReportView (same branded report chrome as
// every other deliverable) so the client can review + approve the keyword
// targets, with a Download PDF button — no editing.

import type { TargetKeyword } from "./target-keywords-store";

type Lang = "pt" | "en";

const COPY: Record<
  Lang,
  {
    keyword: string;
    volume: string;
    kd: string;
    intent: string;
    count: string;
    empty: string;
    intro: string;
  }
> = {
  pt: {
    keyword: "Palavra-chave",
    volume: "Vol/mês",
    kd: "Dificuldade",
    intent: "Intenção",
    count: "palavras-chave alvo",
    empty: "Ainda não há palavras-chave alvo nesta lista.",
    intro:
      "Lista de palavras-chave que vamos trabalhar para este projeto. Volume mensal de pesquisas e dificuldade (KD) estimados pelo DataforSEO.",
  },
  en: {
    keyword: "Keyword",
    volume: "Vol/mo",
    kd: "Difficulty",
    intent: "Intent",
    count: "target keywords",
    empty: "No target keywords on this list yet.",
    intro:
      "The keywords we'll be working on for this project. Monthly search volume and difficulty (KD) estimated by DataforSEO.",
  },
};

const INTENT_LABEL: Record<string, Record<Lang, string>> = {
  transactional: { pt: "Transacional", en: "Transactional" },
  commercial: { pt: "Comercial", en: "Commercial" },
  informational: { pt: "Informacional", en: "Informational" },
  navigational: { pt: "Navegacional", en: "Navigational" },
};

function intentLabel(intent: string | null | undefined, lang: Lang): string {
  if (!intent) return "—";
  return INTENT_LABEL[intent]?.[lang] ?? intent;
}

function num(v: number | null | undefined): string {
  return typeof v === "number" && Number.isFinite(v) ? v.toLocaleString() : "—";
}

/** Escape Markdown table-breaking pipes inside a cell. */
function cell(s: string): string {
  return s.replace(/\|/g, "\\|");
}

export function targetKeywordsToMarkdown(
  keywords: TargetKeyword[],
  lang: Lang = "pt",
): string {
  const c = COPY[lang];
  const lines: string[] = [];
  lines.push(`**${keywords.length} ${c.count}**`, "", `*${c.intro}*`, "");

  if (keywords.length === 0) {
    lines.push(c.empty);
    return lines.join("\n");
  }

  // Highest volume first (nulls last), so the client reads the biggest
  // opportunities at the top.
  const sorted = [...keywords].sort(
    (a, b) => (b.searchVolume ?? -1) - (a.searchVolume ?? -1),
  );

  lines.push(`| ${c.keyword} | ${c.volume} | ${c.kd} | ${c.intent} |`);
  lines.push(`| --- | ---: | ---: | --- |`);
  for (const k of sorted) {
    lines.push(
      `| ${cell(k.keyword)} | ${num(k.searchVolume)} | ${num(k.difficulty)} | ${intentLabel(k.intent, lang)} |`,
    );
  }

  return lines.join("\n").trim();
}
