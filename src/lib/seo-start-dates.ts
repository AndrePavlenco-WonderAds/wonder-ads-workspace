// Data de arranque de cada cliente SEO, por slug (yyyy-mm-dd ou null).
//
// Vem do registo do SuperAdmin (C-Suite › Clients), que já cai para
// `DEFAULT_STARTING_DATES` quando ninguém lhe mexeu, atrás de uma cache de
// 30 minutos: é uma leitura por cliente e a data de arranque de um contrato
// muda uma vez na vida. Usada pelo sino (regras com janela) e, desde a
// v80.19, pelo NPS da equipa — quem entrou no mês não conta para a %.
//
// Bumpar a chave da cache ao mudar a forma do valor.

import "server-only";
import { unstable_cache } from "next/cache";
import { getSeoClients } from "@/lib/notion";
import {
  adminRecordKey,
  getAdminRecords,
  DEFAULT_STARTING_DATES,
} from "@/lib/admin-clients-store";

const cachedSeoStartDates = unstable_cache(
  async (): Promise<Record<string, string | null>> => {
    const out: Record<string, string | null> = {};
    let all: Awaited<ReturnType<typeof getSeoClients>>;
    try {
      all = await getSeoClients();
    } catch {
      return out;
    }
    const rows = all.map((c) => ({
      slug: c.slug,
      departments: ["SEO" as const],
    }));
    try {
      const records = await getAdminRecords(rows);
      for (const c of all) {
        out[c.slug] =
          records[adminRecordKey(c.slug, "SEO")]?.startingDate ??
          DEFAULT_STARTING_DATES[c.slug] ??
          null;
      }
    } catch {
      // KV em baixo — os defaults em código ainda dão uma janela certa para
      // a maioria dos clientes.
      for (const c of all) out[c.slug] = DEFAULT_STARTING_DATES[c.slug] ?? null;
    }
    return out;
  },
  ["seo-start-dates-v3"],
  { revalidate: 1800 },
);

/** O mapa inteiro. Um cliente acabado de entrar pode ainda não estar na
 *  cache (até 30 min): para esse cai-se no default em código. */
export async function getSeoStartDates(): Promise<Record<string, string | null>> {
  const cached = await cachedSeoStartDates();
  return { ...DEFAULT_STARTING_DATES, ...cached };
}
