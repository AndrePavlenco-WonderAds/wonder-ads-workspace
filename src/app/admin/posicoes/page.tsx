// Banco de ensaio das posições — corre a posição atual das target keywords
// de um cliente e o GEO, e mostra o resultado cru, antes de qualquer coisa
// disto entrar no relatório que vai para o cliente.
//
// As posições vêm do MESMO caminho que o relatório mensal usa: Serpstat
// primeiro (base regional google.pt, domínio + subdomínios), DataForSEO como
// fallback quando o token não está configurado. Ensaiar por outro caminho
// seria testar uma coisa e entregar outra.
//
// Nada aqui escreve seja o que for: sem KV, sem relatórios, sem cache. É uma
// leitura, mostrada, e esquecida.

import Link from "next/link";
import { ArrowLeft, Zap, AlertTriangle } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { CLIENT_WEBSITES } from "@/lib/client-meta";
import { listTargetKeywords } from "@/lib/target-keywords-store";
import { isDataforSeoConfigured } from "@/lib/seo-tools/dataforseo";
import { fetchDfsRanks } from "@/lib/seo-tools/dataforseo-ranks";
import {
  fetchSerpstatRanks,
  isSerpstatConfigured,
} from "@/lib/seo-tools/serpstat";
import {
  fetchGeoReport,
  hasGeoSignal,
  topicsFromKeywords,
} from "@/lib/seo-tools/dataforseo-geo";
import { getClientGeo } from "@/lib/client-geo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Posições — banco de ensaio",
};

/** Teto de keywords por corrida no fallback DataForSEO. A ~1,5 cêntimos por
 *  keyword, 15 são 22 cêntimos — chega para julgar a qualidade sem
 *  transformar um clique distraído numa fatura. O Serpstat não precisa de
 *  teto: uma corrida cobre a lista inteira numa chamada. */
const MAX_DFS_KEYWORDS = 15;

type RankRow = {
  keyword: string;
  position: number | null;
  url: string | null;
  volume: number | null;
  localPack: string | null;
};

export default async function PositionsTestPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; geo?: string }>;
}) {
  const { slug, geo: runGeo } = await searchParams;
  const serpstatOk = isSerpstatConfigured();
  const dfsOk = isDataforSeoConfigured();

  const slugs = Object.keys(CLIENT_WEBSITES).sort();
  const website = slug ? CLIENT_WEBSITES[slug] : null;

  let keywords: string[] = [];
  if (slug) {
    keywords = (await listTargetKeywords(slug).catch(() => [])).map(
      (k) => k.keyword,
    );
  }

  // O mesmo caminho do relatório: Serpstat primeiro, DataForSEO a seguir.
  let rows: RankRow[] | null = null;
  let sourceLine: string | null = null;
  let runError: string | null = null;
  if (slug && website && keywords.length && (serpstatOk || dfsOk)) {
    try {
      const serp = serpstatOk
        ? await fetchSerpstatRanks(slug, website, keywords)
        : null;
      if (serp) {
        rows = serp.ranks.map((r) => ({
          keyword: r.keyword,
          position: r.position,
          url: r.url,
          volume: r.volume,
          localPack: null,
        }));
        sourceLine = `Serpstat · base ${serp.se} · domínio + subdomínios · ${serp.domain} · verificado a ${serp.checkedOn}${serp.truncated ? " · ⚠ cobertura truncada" : ""}`;
      } else if (dfsOk) {
        const dfs = await fetchDfsRanks(slug, website, keywords, {
          max: MAX_DFS_KEYWORDS,
        });
        if (dfs) {
          rows = dfs.ranks.map((r) => ({
            keyword: r.keyword,
            position: r.position,
            url: r.url,
            volume: null,
            localPack: r.inLocalPack ? `#${r.localPackPosition}` : null,
          }));
          sourceLine = `DataForSEO (fallback) · ${dfs.domain} · verificado a ${dfs.checkedOn} · $${dfs.costUsd} nesta corrida${dfs.failed.length ? ` · ${dfs.failed.length} falharam` : ""}`;
        }
      }
    } catch (e) {
      runError = String(e);
    }
  }

  const geo =
    dfsOk && slug && website && keywords.length && runGeo === "1"
      ? await fetchGeoReport(slug, website, keywords).catch(
          (e) => ({ error: String(e) }) as never,
        )
      : null;

  const clientGeo = slug ? getClientGeo(slug) : null;
  const ranked = rows?.filter((r) => r.position !== null) ?? [];

  return (
    <PageShell wide>
      <Link
        href="/admin"
        className="group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to Admin
      </Link>

      <header className="mt-6">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          <span className="brand-gradient-text">Posições — banco de ensaio</span>
        </h1>
        <p className="mt-1.5 max-w-3xl text-[12px] text-white/45">
          Corre a posição atual das target keywords de um cliente (Serpstat,
          google.pt, domínio + subdomínios — o mesmo caminho do relatório
          mensal) e a visibilidade em LLMs. Não grava nada.
        </p>
      </header>

      {!serpstatOk && (
        <p className="mt-6 rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-200">
          <AlertTriangle className="mr-1.5 inline h-4 w-4" />
          <code>SERPSTAT_API_TOKEN</code> não está no ambiente desta deployment
          {dfsOk
            ? " — as posições correm pelo fallback DataForSEO."
            : "."}
        </p>
      )}
      {!dfsOk && (
        <p className="mt-3 rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-200">
          <AlertTriangle className="mr-1.5 inline h-4 w-4" />
          <code>DATAFORSEO_LOGIN</code> / <code>DATAFORSEO_PASSWORD</code> não
          estão no ambiente desta deployment — sem fallback de posições nem
          GEO.
        </p>
      )}

      {/* Escolha do cliente — GET puro, para o resultado ser um link que se
          pode partilhar e recarregar. */}
      <form method="get" className="mt-7 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
            Cliente
          </span>
          <select
            name="slug"
            defaultValue={slug ?? ""}
            className="mt-1.5 block w-64 rounded-md border border-white/12 bg-white/[0.05] px-3 py-2 text-[12.5px] text-white outline-none focus:border-white/30"
          >
            <option value="">— escolher —</option>
            {slugs.map((s) => (
              <option key={s} value={s} className="bg-[#111]">
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-[12px] text-white/70">
          <input
            type="checkbox"
            name="geo"
            value="1"
            defaultChecked={runGeo === "1"}
            className="h-3.5 w-3.5"
          />
          incluir GEO (+~$0,60)
        </label>
        <button
          type="submit"
          className="brand-gradient-bg inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[12px] font-semibold text-white transition hover:opacity-90"
        >
          <Zap className="h-3.5 w-3.5" />
          Correr
        </button>
        {slug && (
          <span className="pb-2 text-[11px] text-white/40">
            {keywords.length} target keywords · {clientGeo?.countryLabel} /{" "}
            {clientGeo?.languageCode}
          </span>
        )}
      </form>

      {slug && keywords.length === 0 && (
        <p className="mt-6 text-[13px] text-amber-200">
          Este cliente não tem target keywords guardadas — não há nada para
          verificar.
        </p>
      )}

      {/* --- Posição atual --- */}
      {runError && (
        <p className="mt-6 rounded-xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-[12.5px] text-rose-200">
          {runError}
        </p>
      )}
      {rows && (
        <section className="mt-9">
          <h2 className="text-xl font-semibold tracking-tight text-white">
            Posição atual na Google
          </h2>
          <p className="mt-1 text-[12px] text-white/45">
            {sourceLine} ·{" "}
            <strong className="text-white/70">
              {ranked.length}/{rows.length}
            </strong>{" "}
            no top 100
          </p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/8 bg-white/[0.02]">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/8 bg-black/30 text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                  <th className="px-4 py-2.5">Keyword</th>
                  <th className="px-3 py-2.5">Posição</th>
                  <th className="px-3 py-2.5">Pesquisas/mês</th>
                  <th className="px-3 py-2.5">Mapa</th>
                  <th className="px-3 py-2.5">URL</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.keyword} className="border-b border-white/5">
                    <td className="px-4 py-2.5 text-[12.5px] text-white/85">
                      {r.keyword}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.position === null ? (
                        <span className="text-[12px] italic text-white/30">
                          fora do top 100
                        </span>
                      ) : (
                        <span
                          className={`inline-flex min-w-[2.2rem] justify-center rounded-md border px-2 py-0.5 text-[12.5px] font-bold tabular-nums ${
                            r.position <= 3
                              ? "border-emerald-400/40 bg-emerald-500/12 text-emerald-200"
                              : r.position <= 10
                                ? "border-sky-400/40 bg-sky-500/12 text-sky-200"
                                : "border-white/15 bg-white/[0.05] text-white/70"
                          }`}
                        >
                          {r.position}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] tabular-nums text-white/60">
                      {r.volume ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-white/60">
                      {r.localPack ?? "—"}
                    </td>
                    <td className="max-w-[320px] truncate px-3 py-2.5 text-[11px] text-white/40">
                      {r.url ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* --- GEO --- */}
      {geo && "error" in geo && (
        <p className="mt-6 rounded-xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-[12.5px] text-rose-200">
          {String(geo.error)}
        </p>
      )}
      {geo && !("error" in geo) && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight text-white">
            GEO — visibilidade em LLMs
          </h2>
          <p className="mt-1 text-[12px] text-white/45">
            ChatGPT + AI Overview da Google · custo desta corrida{" "}
            <strong className="text-white/70">${geo.costUsd}</strong> ·{" "}
            {hasGeoSignal(geo) ? (
              <span className="text-emerald-300">há sinal</span>
            ) : (
              <span className="text-amber-300">sem sinal neste mercado</span>
            )}
          </p>
          <p className="mt-2 max-w-3xl text-[11.5px] text-white/35">
            Tópicos usados para procurar oportunidades:{" "}
            {topicsFromKeywords(keywords).join(" · ") || "—"}
          </p>

          <h3 className="mt-6 text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">
            Perguntas onde {geo.domain} já é citado ({geo.presentTotal})
          </h3>
          {geo.present.length === 0 ? (
            <p className="mt-2 text-[12.5px] italic text-white/35">
              Nenhuma. O domínio ainda não é citado por nenhum LLM neste
              mercado.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {geo.present.map((p, i) => (
                <li
                  key={`${p.question}-${i}`}
                  className="rounded-lg border border-emerald-400/25 bg-emerald-500/[0.06] px-3 py-2 text-[12.5px] text-white/85"
                >
                  <span className="mr-2 text-[10px] uppercase tracking-wider text-emerald-300/80">
                    {p.platform}
                  </span>
                  “{p.question}” ·{" "}
                  <span className="tabular-nums text-white/50">
                    {p.aiSearchVolume}/mês
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="mt-7 text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">
            Onde podíamos aparecer
          </h3>
          {geo.gaps.length === 0 ? (
            <p className="mt-2 max-w-3xl text-[12.5px] italic text-white/35">
              Nenhuma pergunta encontrada nos tópicos deste cliente. Não é uma
              falha da integração — o corpus de perguntas em português ainda é
              curto para tópicos específicos.
            </p>
          ) : (
            <div className="mt-2 space-y-4">
              {geo.gaps.map((g) => (
                <div key={g.topic}>
                  <div className="text-[12px] font-semibold text-white/70">
                    {g.topic}{" "}
                    <span className="font-normal text-white/35">
                      — {g.total} perguntas sem nós
                    </span>
                  </div>
                  <ul className="mt-1.5 space-y-1.5">
                    {g.prompts.map((p, i) => (
                      <li
                        key={`${p.question}-${i}`}
                        className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[12.5px] text-white/80"
                      >
                        “{p.question}” ·{" "}
                        <span className="tabular-nums text-white/45">
                          {p.aiSearchVolume}/mês
                        </span>
                        <div className="mt-0.5 truncate text-[11px] text-white/35">
                          citados hoje: {p.sources.slice(0, 5).join(", ") || "—"}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </PageShell>
  );
}
