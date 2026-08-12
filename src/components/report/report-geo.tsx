// A secção GEO do relatório mensal — «o que a IA responde quando alguém
// pergunta sobre isto, e quem é que ela cita».
//
// Vai no fim de propósito. O relatório de cima responde à pergunta que o
// cliente já sabe fazer («quantas leads, que posições»); esta responde à
// que ele ainda não sabe que tem de fazer, e por isso precisa de ter o
// contexto todo antes dela.
//
// Sem interatividade nenhuma: o mesmo markup tem de sair igual no ecrã, no
// PDF e no link público, e um acordeão que não abre em papel é pior do que
// uma tabela comprida.

import { formatDate } from "@/lib/dates";
import type { GeoIntelBlock } from "@/lib/report/report-types";

/** Uma keyword do Serpstat onde a Google mostra AI Overview. */
export type AioRow = {
  keyword: string;
  position: number | null;
  volume: number | null;
  citedInAio: boolean;
  inPlan: boolean;
};

type Variant = "internal" | "client";

/** Quantas perguntas entram na tabela do cliente. O consultor vê tudo o que
 *  foi guardado — é dele o trabalho de escolher os próximos alvos. */
const CLIENT_PROMPT_CAP = 30;

function num(n: number, lang: "pt" | "en"): string {
  return new Intl.NumberFormat(lang === "pt" ? "pt-PT" : "en-GB").format(
    Math.round(n),
  );
}

function pct(n: number): string {
  if (n === 0) return "0%";
  return n < 1 ? `${n.toFixed(1)}%` : `${Math.round(n)}%`;
}

export function ReportGeoSection({
  intel,
  aio = [],
  aioCheckedOn,
  lang,
  variant,
  sectionNumber,
}: {
  intel?: GeoIntelBlock;
  /** Keywords com AI Overview, do Serpstat — a mesma resposta que deu a
   *  tabela de posições, sem chamada nem custo extra. */
  aio?: AioRow[];
  aioCheckedOn?: string | null;
  lang: "pt" | "en";
  variant: Variant;
  /** Número no índice do relatório. 0 = a secção não entrou no índice. */
  sectionNumber?: number;
}) {
  if (!intel && aio.length === 0) return null;
  const aioCited = aio.filter((r) => r.citedInAio);
  const pt = lang === "pt";
  const t = (p: string, e: string) => (pt ? p : e);

  // O CLIENTE VÊ O MERCADO DELE. As perguntas de contexto (ensino, profissão,
  // dicionário, outro país) ficam para a vista interna: são úteis a quem
  // planeia conteúdo e são ruído para quem assina o relatório.
  const customerPrompts = (intel?.prompts ?? []).filter(
    (p) => p.audience === "customer",
  );
  const prompts =
    variant === "internal"
      ? (intel?.prompts ?? [])
      : customerPrompts.slice(0, CLIENT_PROMPT_CAP);
  const citedPrompts = customerPrompts.filter((p) => p.cited);
  // A citação que se mostra por extenso: a de maior volume onde já somos
  // fonte. É a prova concreta de que isto não é uma promessa.
  const showcase = citedPrompts[0] ?? null;

  return (
    <section className="wa-sec wa-geo2">
      <div className="wa-label">
        {sectionNumber ? (
          <span className="wa-secn">
            {String(sectionNumber).padStart(2, "0")}
          </span>
        ) : null}
        {t("GEO · SEO para IA", "GEO · SEO for AI")}
      </div>
      <h2 className="wa-h2">
        {t(
          "O que a inteligência artificial responde sobre este negócio",
          "What artificial intelligence answers about this business",
        )}
      </h2>
      <p className="wa-method">
        {t(
          "Um motor de resposta não tem uma lista de dez lugares: tem uma resposta e três a oito fontes citadas. Estar lá dentro é uma coisa binária. Aqui ficam as perguntas reais que se fazem neste mercado, e em quais delas a marca já é uma das fontes.",
          "An answer engine doesn't have ten ranked slots: it has one answer and three to eight cited sources. Being inside it is binary. Below are the real questions asked in this market, and which of them already cite the brand.",
        )}
      </p>

      {/* ——— Painel de topo ——————————————————————————————— */}
      <div className="wa-geo-hero">
        {aio.length > 0 && (
          <>
            <div className="wa-geo-stat">
              <div className="wa-geo-stat-v">
                {aioCited.length}
                <span className="wa-geo-stat-of">/{aio.length}</span>
              </div>
              <div className="wa-geo-stat-l">
                {t(
                  "keywords onde a IA nos cita",
                  "keywords where AI cites us",
                )}
              </div>
              <div className="wa-geo-stat-s">
                {t(
                  "das que já mostram AI Overview",
                  "of those already showing an AI Overview",
                )}
              </div>
            </div>
            <div className="wa-geo-stat">
              <div className="wa-geo-stat-v">{aio.length}</div>
              <div className="wa-geo-stat-l">
                {t("pesquisas com resposta da IA", "searches with an AI answer")}
              </div>
              <div className="wa-geo-stat-s">
                {t(
                  "onde o site já rankeia no top 100",
                  "where the site already ranks in the top 100",
                )}
              </div>
            </div>
          </>
        )}
        {intel && (
          <>
            <div className="wa-geo-stat">
              <div className="wa-geo-stat-v">{pct(intel.shareOfVoice)}</div>
              <div className="wa-geo-stat-l">
                {t("quota de voz em IA", "AI share of voice")}
              </div>
              <div className="wa-geo-stat-s">
                {t(
                  `${num(intel.volumeCited, lang)} de ${num(intel.volumeTotal, lang)} pesquisas/mês`,
                  `${num(intel.volumeCited, lang)} of ${num(intel.volumeTotal, lang)} searches/mo`,
                )}
              </div>
            </div>
            <div className="wa-geo-stat">
              <div className="wa-geo-stat-v">
                {intel.promptsCited}
                <span className="wa-geo-stat-of">/{intel.promptsTotal}</span>
              </div>
              <div className="wa-geo-stat-l">
                {t("perguntas em que somos citados", "questions citing us")}
              </div>
              <div className="wa-geo-stat-s">
                {t(
                  `no corpus de ${intel.countryLabel} · ${intel.languageCode}`,
                  `in the ${intel.countryLabel} · ${intel.languageCode} corpus`,
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ——— AI OVERVIEW, PELO SERPSTAT ——————————————————————
          A prova mais direta que existe de GEO, e vem de graça: a mesma
          resposta do Serpstat que dá as posições diz, por keyword, se a
          Google mostra resposta gerada e se é ESTE site que ela cita lá
          dentro. Uma pesquisa com AI Overview onde não somos citados é uma
          posição orgânica que passou a valer menos. */}
      {aio.length > 0 && (
        <>
          <h3 className="wa-h3 wa-geo-h">
            {t(
              "Pesquisas em que a Google já responde com IA",
              "Searches where Google already answers with AI",
            )}
          </h3>
          <p className="wa-method">
            {t(
              `Das pesquisas em que o site aparece nos primeiros 100 resultados, ${aio.length} já mostram uma resposta gerada pela Google por cima dos links azuis${
                aioCited.length > 0
                  ? `, e em ${aioCited.length} dela${aioCited.length === 1 ? "" : "s"} é este site uma das fontes citadas`
                  : ", e em nenhuma delas este site é ainda uma das fontes citadas"
              }. Onde a resposta aparece e não nos cita, o lugar orgânico continua lá mas vale menos: a pessoa lê a resposta e não desce.${
                aioCheckedOn ? "" : ""
              }`,
              `Of the searches where the site ranks in the top 100, ${aio.length} already show a Google-generated answer above the blue links${
                aioCited.length > 0
                  ? `, and in ${aioCited.length} of them this site is one of the cited sources`
                  : ", and in none of them is this site a cited source yet"
              }. Where the answer shows and doesn't cite us, the organic spot is still there but worth less: people read the answer and never scroll.`,
            )}
          </p>
          <div className="wa-tblwrap">
            <table className="wa-qtable wa-geo-tbl">
              <thead>
                <tr>
                  <th>Keyword</th>
                  <th className="n">{t("Posição", "Position")}</th>
                  <th className="n">{t("Pesquisas/mês", "Searches/mo")}</th>
                  <th className="c">{t("Citados na IA?", "Cited by AI?")}</th>
                </tr>
              </thead>
              <tbody>
                {aio.map((r) => (
                  <tr key={r.keyword} className={r.citedInAio ? "cited" : ""}>
                    <td>
                      {r.keyword}
                      {r.inPlan && (
                        <span className="wa-kw-plan">{t("plano", "plan")}</span>
                      )}
                    </td>
                    <td className="n">{r.position ?? "—"}</td>
                    <td className="n">
                      {r.volume === null
                        ? "—"
                        : num(r.volume, lang)}
                    </td>
                    <td className="c">
                      {r.citedInAio ? (
                        <span className="wa-geo-yes">✓</span>
                      ) : (
                        <span className="wa-geo-no">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {variant === "internal" && aioCheckedOn && (
            <p className="wa-method" style={{ marginTop: ".5rem" }}>
              Serpstat · sinais `ai_overview` / `snip_url_in_aio` /
              `snip_fqdn_in_aio` da mesma consulta de posições ·{" "}
              {formatDate(aioCheckedOn)}.
            </p>
          )}
        </>
      )}

      {/* ——— A resposta, tal como sai ————————————————————— */}
      {showcase && (
        <div className="wa-geo-show">
          <div className="wa-geo-show-h">
            {t(
              "Isto é o que a IA responde hoje — e cita-nos",
              "This is what AI answers today — and it cites us",
            )}
          </div>
          <div className="wa-geo-show-q">“{showcase.question}”</div>
          <p className="wa-geo-show-a">{showcase.answerExcerpt}</p>
          <div className="wa-geo-show-src">
            {showcase.sources.slice(0, 6).map((s) => (
              <span
                key={`${s.domain}-${s.position}`}
                className={`wa-geo-chip${
                  s.domain === intel?.domain || s.domain.endsWith(`.${intel?.domain}`)
                    ? " me"
                    : ""
                }`}
              >
                {s.domain}
              </span>
            ))}
          </div>
          <div className="wa-geo-show-f">
            {t(
              `Pergunta feita ${num(showcase.aiSearchVolume, lang)} vezes por mês. As fontes acima são as que a resposta cita, por ordem.`,
              `Asked ${num(showcase.aiSearchVolume, lang)} times a month. The sources above are the ones the answer cites, in order.`,
            )}
          </div>
        </div>
      )}

      {/* ——— Todas as prompts ————————————————————————————— */}
      {prompts.length > 0 && intel && (
        <>
          <h3 className="wa-h3 wa-geo-h">
            {t(
              `As perguntas reais deste mercado (${prompts.length}${
                prompts.length < intel!.promptsTotal
                  ? ` de ${intel!.promptsTotal}`
                  : ""
              })`,
              `The real questions in this market (${prompts.length}${
                prompts.length < intel!.promptsTotal
                  ? ` of ${intel!.promptsTotal}`
                  : ""
              })`,
            )}
          </h3>
          <p className="wa-method">
            {t(
              `Perguntas que pessoas em ${intel!.countryLabel} fizeram e a que um motor generativo respondeu, na língua do mercado. Estão ordenadas pelas que já nos citam, depois pelas que mais têm que ver com o plano de keywords. A coluna da direita diz quem a resposta cita hoje — é a lista de quem ocupa o lugar.`,
              `Questions people in ${intel!.countryLabel} asked and a generative engine answered, in the market's language. Sorted by the ones already citing us, then by how close they are to the keyword plan. The right column is who the answer cites today — the list of who holds the spot.`,
            )}
            {intel!.contextPrompts > 0 &&
              " " +
                t(
                  variant === "internal"
                    ? `Vêm marcadas ${intel!.contextPrompts} perguntas de CONTEXTO — ensino, profissão, dicionário ou outro país. Ficam fora de todas as contas e não aparecem na versão do cliente.`
                    : `Foram postas de lado ${intel!.contextPrompts} perguntas do mesmo tema que não são deste mercado (quem procura licenciaturas, salários ou o significado da palavra).`,
                  variant === "internal"
                    ? `${intel!.contextPrompts} CONTEXT questions are tagged — education, profession, dictionary or another country. They stay out of every calculation and never reach the client version.`
                    : `${intel!.contextPrompts} questions on the same topic were set aside because they are not this market (people looking for degrees, salaries or the meaning of the word).`,
                )}
          </p>
          <div className="wa-tblwrap">
            <table className="wa-qtable wa-geo-tbl">
              <thead>
                <tr>
                  <th>{t("Pergunta", "Question")}</th>
                  <th className="n">{t("Pesquisas/mês", "Searches/mo")}</th>
                  <th className="c">{t("Citados?", "Cited?")}</th>
                  <th>{t("Quem a resposta cita", "Who the answer cites")}</th>
                </tr>
              </thead>
              <tbody>
                {prompts.map((p, i) => (
                  <tr
                    key={`${p.question}-${i}`}
                    className={`${p.cited ? "cited" : ""}${
                      p.audience === "context" ? " ctx" : ""
                    }`}
                  >
                    <td>
                      {p.question}
                      {variant === "internal" && p.audience === "context" && (
                        <span className="wa-geo-ctx">contexto</span>
                      )}
                      {variant === "internal" && p.topic !== "—" && (
                        <span className="wa-geo-topic">{p.topic}</span>
                      )}
                    </td>
                    <td className="n">{num(p.aiSearchVolume, lang)}</td>
                    <td className="c">
                      {p.cited ? (
                        <span className="wa-geo-yes">
                          ✓{p.citedPosition ? ` #${p.citedPosition}` : ""}
                        </span>
                      ) : (
                        <span className="wa-geo-no">—</span>
                      )}
                    </td>
                    <td className="wa-geo-srcs">
                      {p.sources.length === 0
                        ? "—"
                        : p.sources
                            .slice(0, 3)
                            .map((s) => s.domain)
                            .join(" · ")}
                      {p.sources.length > 3 && (
                        <span className="wa-geo-more">
                          +{p.sources.length - 3}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ——— Sub-perguntas ————————————————————————————— */}
      {intel && intel.fanOut.length > 0 && (
        <>
          <h3 className="wa-h3 wa-geo-h">
            {t("As sub-perguntas que o motor gera", "The sub-questions the engine generates")}
          </h3>
          <p className="wa-method">
            {t(
              "Antes de responder, o motor parte a pergunta em várias. Cada uma destas é um parágrafo que o site pode passar a ter — e a forma mais barata de entrar numa resposta onde ainda não estamos.",
              "Before answering, the engine splits the question into several. Each of these is a paragraph the site could have — and the cheapest way into an answer we're not in yet.",
            )}
          </p>
          <div className="wa-geo-fan">
            {intel.fanOut.slice(0, 18).map((f) => (
              <span className="wa-geo-chip" key={f.query}>
                {f.query}
              </span>
            ))}
          </div>
        </>
      )}

      {/* ——— Keywords com procura em IA ——————————————————— */}
      {intel && intel.keywordVolumes.length > 0 && (
        <>
          <h3 className="wa-h3 wa-geo-h">
            {t(
              "Keywords do plano que já são perguntadas a uma IA",
              "Plan keywords already being asked to an AI",
            )}
          </h3>
          <p className="wa-method">
            {t(
              "Volume de pesquisa dentro de motores generativos, não na caixa de pesquisa. É a lista das keywords do plano onde vale a pena escrever para ser citado, e não só para posicionar.",
              "Search volume inside generative engines, not in the search box. These are the plan's keywords worth writing for citation, not only for ranking.",
            )}
          </p>
          <div className="wa-geo-kw">
            {intel.keywordVolumes.slice(0, 12).map((k) => (
              <span className="wa-geo-kwrow" key={k.keyword}>
                <b>{k.keyword}</b>
                <i>{num(k.aiSearchVolume, lang)}/{t("mês", "mo")}</i>
              </span>
            ))}
          </div>
        </>
      )}

      {variant === "internal" && intel && (
        <p className="wa-method wa-geo-prov">
          DataForSEO llm_mentions · {intel.domain} · {intel.countryLabel} (
          {intel.locationCode}/{intel.languageCode}) ·{" "}
          {intel.platforms.join(", ") || "—"} · tópicos:{" "}
          {intel.topics.map((x) => `${x.topic} (${x.prompts})`).join(", ")} · $
          {intel.costUsd} nesta verificação · verificado a{" "}
          {formatDate(intel.checkedOn)}.
        </p>
      )}
    </section>
  );
}

export const GEO_CSS = `
.wa-geo2{break-inside:auto;}
.wa-geo-h{margin-top:1.5rem;}

/* Painel de topo */
.wa-geo-hero{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:.7rem;margin:.9rem 0 .2rem;}
.wa-geo-stat{background:#fff;border:1px solid var(--line);border-radius:12px;padding:.85rem .95rem;position:relative;overflow:hidden;
  box-shadow:0 8px 24px -22px rgba(23,22,45,.55);break-inside:avoid;}
.wa-geo-stat::before{content:"";position:absolute;left:0;top:0;height:3px;width:100%;background:linear-gradient(90deg,#343ED7,#783DF5,#C535C9);}
.wa-geo-stat-v{font-size:1.75rem;font-weight:800;letter-spacing:-.03em;line-height:1.05;color:var(--ink);font-variant-numeric:tabular-nums;}
.wa-geo-stat-v.wa-geo-stat-sm{font-size:1rem;letter-spacing:-.01em;word-break:break-all;line-height:1.2;padding-top:.4rem;}
.wa-geo-stat-of{font-size:1rem;font-weight:700;color:#a9a4bd;}
.wa-geo-stat-l{margin-top:.3rem;font-size:.66rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--plum);line-height:1.3;}
.wa-geo-stat-s{margin-top:.2rem;font-size:.68rem;color:var(--muted);}
.wa-geo-stat-dial{display:flex;align-items:center;justify-content:center;}

/* Mostrador */
.wa-geo-dial{position:relative;text-align:center;width:100%;}
.wa-geo-dial-svg{width:100%;max-width:118px;display:block;margin:0 auto;}
.wa-geo-dial-track{stroke:rgba(23,22,45,.09);}
.wa-geo-dial .wa-geo-dial-fill{stroke:#0f8f62;}
.wa-geo-dial.mid .wa-geo-dial-fill{stroke:#c98a15;}
.wa-geo-dial.bad .wa-geo-dial-fill{stroke:#c93a52;}
.wa-geo-dial-v{position:absolute;left:0;right:0;top:1.35rem;font-size:1.5rem;font-weight:800;letter-spacing:-.03em;font-variant-numeric:tabular-nums;}
.wa-geo-dial-l{margin-top:-.15rem;font-size:.63rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--plum);}

/* A resposta em bruto */
.wa-geo-show{margin-top:1rem;border-radius:14px;padding:1rem 1.15rem;break-inside:avoid;
  background:linear-gradient(135deg,rgba(52,62,215,.07),rgba(197,53,201,.07));border:1px solid rgba(120,61,245,.18);}
.wa-geo-show-h{font-size:.62rem;letter-spacing:.13em;text-transform:uppercase;color:#6b34c9;font-weight:700;}
.wa-geo-show-q{margin-top:.4rem;font-size:1rem;font-weight:700;color:#2b2947;letter-spacing:-.01em;}
.wa-geo-show-a{margin:.5rem 0 .6rem;font-size:.82rem;line-height:1.6;color:#3b394f;}
.wa-geo-show-src{display:flex;flex-wrap:wrap;gap:.32rem;}
.wa-geo-show-f{margin-top:.55rem;font-size:.68rem;color:var(--muted);}
.wa-geo-chip{display:inline-block;padding:.2rem .5rem;border-radius:999px;font-size:.68rem;font-weight:600;
  background:#fff;border:1px solid var(--line);color:#4a4863;}
.wa-geo-chip.me{background:linear-gradient(135deg,#343ED7,#783DF5,#C535C9);color:#fff;border-color:transparent;}

/* Tabela de prompts */
.wa-geo-tbl td:first-child{max-width:19rem;}
.wa-geo-tbl th.c,.wa-geo-tbl td.c{text-align:center;}
.wa-geo-tbl tr.cited{background:rgba(15,143,98,.05);}
.wa-geo-yes{color:var(--up);font-weight:800;font-variant-numeric:tabular-nums;}
.wa-geo-no{color:#c0bbd0;}
.wa-geo-srcs{font-size:.7rem;color:var(--muted);}
.wa-geo-more{margin-left:.25rem;color:#b3aec4;}
.wa-geo-tbl tr.ctx td{opacity:.62;}
.wa-geo-ctx{margin-left:.4rem;padding:.05rem .3rem;border-radius:4px;font-size:.6rem;font-weight:700;
  background:rgba(23,22,45,.07);color:#6d6b86;text-transform:uppercase;letter-spacing:.05em;}
.wa-geo-topic{margin-left:.4rem;padding:.05rem .3rem;border-radius:4px;font-size:.6rem;font-weight:700;
  background:rgba(120,61,245,.1);color:#6b34c9;text-transform:uppercase;letter-spacing:.05em;}

/* Concorrência */
.wa-geo-comp{display:grid;gap:.4rem;margin-top:.5rem;}
.wa-geo-comp-row{display:grid;grid-template-columns:minmax(9rem,15rem) 1fr 3.2rem;gap:.6rem;align-items:center;font-size:.76rem;}
.wa-geo-comp-d{color:#45435c;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.wa-geo-comp-row.me .wa-geo-comp-d{font-weight:800;color:#5b21b6;}
.wa-geo-star{margin-right:.25rem;color:#783df5;}
.wa-geo-comp-bar{height:9px;border-radius:5px;background:rgba(23,22,45,.06);overflow:hidden;}
.wa-geo-comp-bar i{display:block;height:100%;border-radius:5px;background:#b9b3cd;}
.wa-geo-comp-row.me .wa-geo-comp-bar i{background:linear-gradient(90deg,#343ED7,#783DF5,#C535C9);}
.wa-geo-comp-v{text-align:right;font-weight:700;font-variant-numeric:tabular-nums;font-size:.74rem;}
.wa-geo-absent{margin:.6rem 0 0;font-size:.76rem;line-height:1.55;color:#8a5a1f;background:rgba(201,138,21,.09);
  border:1px solid rgba(201,138,21,.22);border-radius:9px;padding:.55rem .7rem;}

/* Fan-out + keywords */
.wa-geo-fan{display:flex;flex-wrap:wrap;gap:.32rem;margin-top:.3rem;}
.wa-geo-kw{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.35rem;margin-top:.3rem;}
.wa-geo-kwrow{display:flex;align-items:baseline;justify-content:space-between;gap:.5rem;font-size:.76rem;
  background:#fff;border:1px solid var(--line);border-radius:8px;padding:.35rem .55rem;}
.wa-geo-kwrow b{font-weight:600;color:#45435c;}
.wa-geo-kwrow i{font-style:normal;font-weight:700;font-variant-numeric:tabular-nums;color:var(--violet);}

/* Pilares */
.wa-geo-pillars{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.6rem;margin:.7rem 0 1rem;}
.wa-geo-pillar{background:#fff;border:1px solid var(--line);border-radius:11px;padding:.65rem .75rem;break-inside:avoid;}
.wa-geo-pillar-h{display:flex;align-items:baseline;justify-content:space-between;gap:.4rem;}
.wa-geo-pillar-n{font-size:.68rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--plum);}
.wa-geo-pillar-v{font-size:1.05rem;font-weight:800;font-variant-numeric:tabular-nums;}
.wa-geo-pillar-v.good{color:var(--up);} .wa-geo-pillar-v.mid{color:#c98a15;} .wa-geo-pillar-v.bad{color:var(--down);}
.wa-geo-pillar-bar{height:5px;border-radius:3px;background:rgba(23,22,45,.07);overflow:hidden;margin:.35rem 0 .35rem;}
.wa-geo-pillar-bar i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,#343ED7,#783DF5,#C535C9);}
.wa-geo-pillar-b{font-size:.66rem;line-height:1.4;color:var(--muted);}

/* Checklist */
.wa-geo-checks{list-style:none;margin:.3rem 0 0;padding:0;display:grid;gap:.4rem;}
.wa-geo-check{display:flex;gap:.55rem;align-items:flex-start;background:#fff;border:1px solid var(--line);
  border-radius:10px;padding:.55rem .7rem;break-inside:avoid;}
.wa-geo-check.fail{border-color:rgba(201,58,82,.3);background:rgba(201,58,82,.04);}
.wa-geo-check.warn{border-color:rgba(201,138,21,.28);background:rgba(201,138,21,.04);}
.wa-geo-mark{flex:0 0 1.15rem;height:1.15rem;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;
  font-size:.66rem;font-weight:800;color:#fff;margin-top:.05rem;}
.wa-geo-mark.pass{background:var(--up);} .wa-geo-mark.warn{background:#c98a15;}
.wa-geo-mark.fail{background:var(--down);} .wa-geo-mark.unknown{background:#a9a4bd;}
.wa-geo-check-b{min-width:0;}
.wa-geo-check-t{font-size:.78rem;font-weight:700;color:#2c2a45;}
.wa-geo-w{margin-left:.4rem;padding:.05rem .32rem;border-radius:4px;font-size:.58rem;font-weight:800;letter-spacing:.06em;
  text-transform:uppercase;background:rgba(120,61,245,.12);color:#6b34c9;}
.wa-geo-check-d{font-size:.74rem;color:#4a4863;margin-top:.1rem;}
.wa-geo-check-w{font-size:.71rem;color:var(--muted);margin-top:.18rem;line-height:1.5;}

/* Bots */
.wa-geo-bots{margin-top:.9rem;break-inside:avoid;}
.wa-geo-bots-l{font-size:.6rem;letter-spacing:.13em;text-transform:uppercase;color:var(--plum);font-weight:700;margin-bottom:.35rem;}
.wa-geo-bots-grid{display:flex;flex-wrap:wrap;gap:.3rem;}
.wa-geo-bot{display:inline-flex;align-items:center;gap:.3rem;padding:.2rem .5rem;border-radius:7px;font-size:.68rem;
  background:#fff;border:1px solid var(--line);color:#4a4863;}
.wa-geo-bot b{font-weight:800;}
.wa-geo-bot.ok b{color:var(--up);}
.wa-geo-bot.blocked{border-color:rgba(201,58,82,.35);background:rgba(201,58,82,.05);}
.wa-geo-bot.blocked b{color:var(--down);}
.wa-geo-bot.unknown b{color:#a9a4bd;}
.wa-geo-bot.crit{font-weight:600;}

/* Plano */
.wa-geo-plan{margin:.4rem 0 0;padding-left:1.15rem;display:grid;gap:.45rem;}
.wa-geo-plan li{font-size:.79rem;line-height:1.5;color:#3b394f;}
.wa-geo-plan-t{font-weight:700;color:#2c2a45;display:block;}
.wa-geo-plan-f{color:var(--muted);}
.wa-geo-prov{margin-top:.9rem;font-size:.68rem;}
`;
