// A carteira de um consultor SEO, projeto a projeto (v78.42) — o que a página
// /seo/roadmaps/<consultor> mostra além do roadmap: o NPS do mês anterior e do
// mês em curso, a folga de custos de hoje e o logo. Lê tudo em paralelo: os
// NPS numa leitura só, as folgas uma por projeto.

import "server-only";
import { getLogoOverrides } from "@/lib/admin-client-logos-store";
import {
  getClientLogo,
  getLogoBgMode,
  getLogoSizing,
  type LogoBgMode,
  type LogoSizing,
} from "@/lib/client-meta";
import { getClientPalette, paletteToGradient } from "@/lib/client-colors";
import { getClientTier, type ClientTier } from "@/lib/client-tiers";
import { lisbonMonthKey, shiftMonthKey } from "@/lib/dates";
import { NPS_BONUS_EXCLUDED_SLUGS } from "@/lib/documentacao/nps-bonus";
import { getNpsRecordsFor, npsMonthStatus, type NpsRecord } from "@/lib/nps-store";
import { baseAllowance, folgaMonthShort, summarizeFolga, type FolgaState } from "@/lib/seo-folga";
import { getFolga } from "@/lib/seo-folga-store";

export type PortfolioNpsMonth = {
  key: string;
  /** «SET» */
  short: string;
  score: number | null;
};

export type PortfolioRow = {
  slug: string;
  tier: ClientTier | null;
  logo: { src: string | null; bgMode: LogoBgMode; sizing: LogoSizing; gradient: string };
  nps: {
    /** A WonderAds não preenche NPS — é a própria agência. */
    excluded: boolean;
    previous: PortfolioNpsMonth;
    current: PortfolioNpsMonth & { state: "respondido" | "enviado" | "por-enviar" };
  };
  folga: {
    state: FolgaState;
    /** Cêntimos — o que fica este mês (pode ser negativo). */
    remaining: number;
    available: number;
    /** 0–100, ou negativo acima da folga; null sem folga (Lite / por definir). */
    pctFree: number | null;
  };
};

function monthScore(record: NpsRecord | undefined, key: string): number | null {
  // Do mais recente para o mais antigo: a primeira do mês é a última resposta dele.
  const answer = record?.submissions.find((s) => lisbonMonthKey(s.submittedAt) === key);
  return answer ? answer.scores.overall : null;
}

export async function getConsultantPortfolio(
  slugs: string[],
  now: number = Date.now(),
): Promise<Record<string, PortfolioRow>> {
  const nowKey = lisbonMonthKey(now);
  const prevKey = shiftMonthKey(nowKey, -1);
  const [npsRecords, logoOverrides, folgas] = await Promise.all([
    getNpsRecordsFor(slugs).catch(() => ({}) as Record<string, NpsRecord>),
    getLogoOverrides().catch(() => ({}) as Record<string, string>),
    Promise.all(slugs.map((s) => getFolga(s))),
  ]);

  const out: Record<string, PortfolioRow> = {};
  slugs.forEach((slug, i) => {
    const tier = getClientTier(slug);
    const record = npsRecords[slug];
    const status = record ? npsMonthStatus(record, now).state : "por-enviar";
    const f = summarizeFolga(folgas[i], baseAllowance(slug, tier), tier, nowKey);
    const noFolga = f.state === "lite" || f.state === "unset";
    out[slug] = {
      slug,
      tier,
      logo: {
        src: logoOverrides[slug] ?? getClientLogo(slug),
        bgMode: getLogoBgMode(slug),
        sizing: getLogoSizing(slug),
        gradient: paletteToGradient(getClientPalette(slug)),
      },
      nps: {
        excluded: NPS_BONUS_EXCLUDED_SLUGS.has(slug),
        previous: { key: prevKey, short: folgaMonthShort(prevKey), score: monthScore(record, prevKey) },
        current: { key: nowKey, short: folgaMonthShort(nowKey), score: monthScore(record, nowKey), state: status },
      },
      folga: {
        state: f.state,
        remaining: f.remaining,
        available: f.available,
        pctFree: noFolga || f.available <= 0 ? null : Math.round((f.remaining / f.available) * 100),
      },
    };
  });
  return out;
}
