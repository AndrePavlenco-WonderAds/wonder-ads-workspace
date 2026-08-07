// Banco de ensaio do DataForSEO — corre a posição real e o GEO de um cliente
// e mostra o resultado cru, antes de qualquer coisa disto entrar no relatório
// que vai para o cliente.
//
// PORQUE É QUE ISTO EXISTE COMO PÁGINA E NÃO COMO SCRIPT: cada corrida gasta
// dinheiro a sério (cêntimos, mas dinheiro), e a decisão de trocar o SE
// Ranking por isto é de quem paga. Ver os números de três clientes reais numa
// página é o que torna essa decisão possível sem ter de acreditar em mim.
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
  fetchGeoReport,
  hasGeoSignal,
  topicsFromKeywords,
} from "@/lib/seo-tools/dataforseo-geo";
import { getClientGeo } from "@/lib/client-geo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "DataForSEO — banco de ensaio",
};

/** Teto de keywords por corrida. A ~1,5 cêntimos cada, 15 keywords são 22
 *  cêntimos — chega para julgar a qualidade sem transformar um clique
 *  distraído numa fatura. */
const MAX_KEYWORDS = 15;

export default async function DataForSeoTestPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; geo?: string }>;
}) {
  const { slug, geo: runGeo } = await searchParams;
  const configured = isDataforSeoConfigured();

  const slugs = Object.keys(CLIENT_WEBSITES).sort();
  const website = slug ? CLIENT_WEBSITES[slug] : null;

  let keywords: string[] = [];
  if (slug) {
    keywords = (await listTargetKeywords(slug).catch(() => [])).map(
      (k) => k.keyword,
    );
  }

  const ranks =
    configured && slug && website && keywords.length
      ? await fetchDfsRanks(slug, website, keywords, {
          max: MAX_KEYWORDS,
        }).catch((e) => ({ error: String(e) }) as never)
      : null;

  const geo =
    configured && slug && website && keywords.length && runGeo === "1"
      ? await fetchGeoReport(slug, website, keywords).catch(
          (e) => ({ error: String(e) }) as never,
        )
      : null;

  const clientGeo = slug ? getClientGeo(slug) : null;
  const ranked = ranks?.ranks?.filter((r) => r.position !== null) ?? [];

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
          <span className="brand-gradient-text">DataForSEO — banco de ensaio</span>
        </h1>
        <p className="mt-1.5 max-w-3xl text-[12px] text-white/45">
          Corre a posição real na Google e a visibilidade em LLMs de um cliente,
          com dados a sério e a custo a sério. Não grava nada.
        </p>
      </header>

      {!configured && (
        <p className="mt-6 rounded-xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-200">
          <AlertTriangle className="mr-1.5 inline h-4 w-4" />
          <code>DATAFORSEO_LOGIN</code> / <code>DATAFORSEO_PASSWORD</code> não
          estão no ambiente desta deployment.
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
            {keywords.length} target keywords · analisa as primeiras{" "}
            {MAX_KEYWORDS} · {clientGeo?.countryLabel} / {clientGeo?.languageCode}
          </span>
        )}
      </form>

      {slug && keywords.length === 0 && (
        <p className="mt-6 text-[13px] text-amber-200">
          Este cliente não tem target keywords guardadas — não há nada para
          verificar.
        </p>
      )}

      {/* --- Posição real --- */}
      {ranks && "error" in ranks && (
        <p className="mt-6 rounded-xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-[12.5px] text-rose-200">
          {String(ranks.error)}
        </p>
      )}
      {ranks && !("error" in ranks) && (
        <section className="mt-9">
          <h2 className="text-xl font-semibold tracking-tight text-white">
            Posição real na Google
          </h2>
          <p className="mt-1 text-[12px] text-white/45">
            {ranks.domain} · verificado a {ranks.checkedOn} ·{" "}
            <strong className="text-white/70">
              {ranked.length}/{ranks.ranks.length}
            </strong>{" "}
            no top 100 · custo desta corrida{" "}
            <strong className="text-white/70">${ranks.costUsd}</strong> (
            {(ranks.costUsd / Math.max(1, ranks.ranks.length)).toFixed(4)} por
            keyword)
            {ranks.failed.length > 0 && ` · ${ranks.failed.length} falharam`}
          </p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/8 bg-white/[0.02]">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/8 bg-black/30 text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                  <th className="px-4 py-2.5">Keyword</th>
                  <th className="px-3 py-2.5">Posição</th>
                  <th className="px-3 py-2.5">Mapa</th>
                  <th className="px-3 py-2.5">URL</th>
                </tr>
              </thead>
              <tbody>
                {ranks.ranks.map((r) => (
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
                    <td className="px-3 py-2.5 text-[12px] text-white/60">
                      {r.inLocalPack ? `#${r.localPackPosition}` : "—"}
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
