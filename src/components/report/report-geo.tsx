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
import type {
  GeoIntelBlock,
  GeoReadinessBlock,
  GeoReadinessCheck,
  GeoReadinessPillar,
} from "@/lib/report/report-types";

type Variant = "internal" | "client";

/** Quantas perguntas entram na tabela do cliente. O consultor vê tudo o que
 *  foi guardado — é dele o trabalho de escolher os próximos alvos. */
const CLIENT_PROMPT_CAP = 30;

const PILLARS: { key: GeoReadinessPillar; pt: string; en: string; blurb: [string, string] }[] = [
  {
    key: "access",
    pt: "Acesso",
    en: "Access",
    blurb: [
      "Os motores conseguem ler o site?",
      "Can the engines read the site?",
    ],
  },
  {
    key: "understanding",
    pt: "Compreensão",
    en: "Understanding",
    blurb: [
      "Percebem quem somos e o que fazemos?",
      "Do they understand who we are?",
    ],
  },
  {
    key: "extraction",
    pt: "Extração",
    en: "Extraction",
    blurb: [
      "O conteúdo tem a forma que uma resposta cita?",
      "Is the content shaped to be quoted?",
    ],
  },
  {
    key: "trust",
    pt: "Confiança",
    en: "Trust",
    blurb: [
      "Há autor, data, morada, língua?",
      "Author, date, address, language?",
    ],
  },
];

function num(n: number, lang: "pt" | "en"): string {
  return new Intl.NumberFormat(lang === "pt" ? "pt-PT" : "en-GB").format(
    Math.round(n),
  );
}

function pct(n: number): string {
  if (n === 0) return "0%";
  return n < 1 ? `${n.toFixed(1)}%` : `${Math.round(n)}%`;
}

/** Meia-lua de 0 a 100. Um número grande num anel lê-se num segundo; o
 *  mesmo número numa tabela lê-se em cinco. */
function ScoreDial({ score, label }: { score: number; label: string }) {
  const r = 34;
  const circ = Math.PI * r; // meia circunferência
  const filled = (Math.max(0, Math.min(100, score)) / 100) * circ;
  const tone = score >= 75 ? "good" : score >= 50 ? "mid" : "bad";
  return (
    <div className={`wa-geo-dial ${tone}`}>
      <svg viewBox="0 0 88 52" className="wa-geo-dial-svg" aria-hidden>
        <path
          d="M 10 46 A 34 34 0 0 1 78 46"
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          className="wa-geo-dial-track"
        />
        <path
          d="M 10 46 A 34 34 0 0 1 78 46"
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          className="wa-geo-dial-fill"
          strokeDasharray={`${filled} ${circ}`}
        />
      </svg>
      <div className="wa-geo-dial-v">{score}</div>
      <div className="wa-geo-dial-l">{label}</div>
    </div>
  );
}

function StatusMark({ status }: { status: GeoReadinessCheck["status"] }) {
  const glyph =
    status === "pass" ? "✓" : status === "warn" ? "!" : status === "fail" ? "✗" : "?";
  return <span className={`wa-geo-mark ${status}`}>{glyph}</span>;
}

export function ReportGeoSection({
  intel,
  readiness,
  lang,
  variant,
  sectionNumber,
}: {
  intel?: GeoIntelBlock;
  readiness?: GeoReadinessBlock;
  lang: "pt" | "en";
  variant: Variant;
  /** Número no índice do relatório. 0 = a secção não entrou no índice. */
  sectionNumber?: number;
}) {
  if (!intel && !readiness) return null;
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

  const failing = (readiness?.checks ?? [])
    .filter((c) => c.status === "fail" || c.status === "warn")
    .sort(
      (a, b) =>
        b.weight - a.weight ||
        (a.status === "fail" ? -1 : 1) - (b.status === "fail" ? -1 : 1),
    );

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
          "Um motor de resposta não tem uma lista de dez lugares: tem uma resposta e três a oito fontes citadas. Estar lá dentro é uma coisa binária. Esta secção mede as duas metades do problema — o mercado (que perguntas se fazem e quem é citado hoje) e o site (se está preparado para ser a fonte escolhida).",
          "An answer engine doesn't have ten ranked slots: it has one answer and three to eight cited sources. Being inside it is binary. This section measures both halves — the market (which questions get asked and who is cited today) and the site (whether it is ready to be the chosen source).",
        )}
      </p>

      {/* ——— Painel de topo ——————————————————————————————— */}
      <div className="wa-geo-hero">
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
        {readiness && (
          <div className="wa-geo-stat wa-geo-stat-dial">
            <ScoreDial
              score={readiness.score}
              label={t("prontidão do site", "site readiness")}
            />
          </div>
        )}
        {intel && intel.competitors.length > 0 && (
          <div className="wa-geo-stat">
            <div className="wa-geo-stat-v wa-geo-stat-sm">
              {intel.competitors[0].domain}
            </div>
            <div className="wa-geo-stat-l">
              {t("fonte mais citada no tema", "most-cited source in the topic")}
            </div>
            <div className="wa-geo-stat-s">
              {t(
                `presente em ${pct(intel.competitors[0].coverage)} do volume`,
                `present in ${pct(intel.competitors[0].coverage)} of the volume`,
              )}
            </div>
          </div>
        )}
      </div>

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
      {prompts.length > 0 && (
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

      {/* ——— Quem ocupa o lugar ————————————————————————— */}
      {intel && intel.competitors.length > 0 && (
        <>
          <h3 className="wa-h3 wa-geo-h">
            {t("Quem a IA cita neste tema", "Who AI cites in this topic")}
          </h3>
          <p className="wa-method">
            {t(
              "Percentagem do volume de perguntas em cujas respostas cada domínio aparece. Cada resposta cita várias fontes ao mesmo tempo, por isso a coluna não soma 100 — o que interessa é a distância entre nós e quem está sempre lá.",
              "Share of the question volume whose answers cite each domain. Every answer cites several sources at once, so the column does not add up to 100 — what matters is the distance between us and whoever is always there.",
            )}
          </p>
          <div className="wa-geo-comp">
            {intel.competitors.slice(0, 10).map((c) => (
              <div
                className={`wa-geo-comp-row${c.isClient ? " me" : ""}`}
                key={c.domain}
              >
                <span className="wa-geo-comp-d">
                  {c.isClient && <span className="wa-geo-star">★</span>}
                  {c.domain}
                </span>
                <span className="wa-geo-comp-bar">
                  <i
                    style={{
                      width: `${Math.max(2, Math.min(100, c.coverage))}%`,
                    }}
                  />
                </span>
                <span className="wa-geo-comp-v">{pct(c.coverage)}</span>
              </div>
            ))}
            {!intel.competitors.some((c) => c.isClient) && (
              <p className="wa-geo-absent">
                {t(
                  "O domínio deste cliente ainda não aparece em nenhuma das respostas analisadas. É exatamente esse o trabalho que a auditoria abaixo prioriza.",
                  "This client's domain doesn't appear in any of the analysed answers yet. That is precisely the work the audit below prioritises.",
                )}
              </p>
            )}
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

      {/* ——— Auditoria de prontidão ————————————————————— */}
      {readiness && (
        <>
          <h3 className="wa-h3 wa-geo-h">
            {t(
              "Está o site preparado para ser citado?",
              "Is the site ready to be cited?",
            )}
          </h3>
          <p className="wa-method">
            {readiness.unreachable
              ? t(
                  `O site não respondeu a um rastreio de ${readiness.domain} no momento da verificação. Enquanto isso acontecer, nenhum motor de resposta o consegue citar — é a primeira coisa a resolver.`,
                  `The site did not respond to a crawl of ${readiness.domain} at check time. While that lasts, no answer engine can cite it — it is the first thing to fix.`,
                )
              : t(
                  `${readiness.checks.length} verificações em ${readiness.pagesAudited.length} página${readiness.pagesAudited.length === 1 ? "" : "s"}, a ${formatDate(readiness.checkedOn)}. Cada uma pesa consoante o efeito que tem em ser escolhido como fonte.`,
                  `${readiness.checks.length} checks across ${readiness.pagesAudited.length} page${readiness.pagesAudited.length === 1 ? "" : "s"}, on ${formatDate(readiness.checkedOn)}. Each is weighted by how much it affects being picked as a source.`,
                )}
          </p>

          {!readiness.unreachable && (
            <div className="wa-geo-pillars">
              {PILLARS.map((p) => (
                <div className="wa-geo-pillar" key={p.key}>
                  <div className="wa-geo-pillar-h">
                    <span className="wa-geo-pillar-n">{pt ? p.pt : p.en}</span>
                    <span
                      className={`wa-geo-pillar-v ${
                        readiness.pillarScores[p.key] >= 75
                          ? "good"
                          : readiness.pillarScores[p.key] >= 50
                            ? "mid"
                            : "bad"
                      }`}
                    >
                      {readiness.pillarScores[p.key]}
                    </span>
                  </div>
                  <div className="wa-geo-pillar-bar">
                    <i style={{ width: `${readiness.pillarScores[p.key]}%` }} />
                  </div>
                  <div className="wa-geo-pillar-b">
                    {pt ? p.blurb[0] : p.blurb[1]}
                  </div>
                </div>
              ))}
            </div>
          )}

          <ul className="wa-geo-checks">
            {readiness.checks.map((c) => (
              <li key={c.id} className={`wa-geo-check ${c.status}`}>
                <StatusMark status={c.status} />
                <div className="wa-geo-check-b">
                  <div className="wa-geo-check-t">
                    {c.label}
                    {c.weight === 3 && (
                      <span className="wa-geo-w">
                        {t("decisivo", "decisive")}
                      </span>
                    )}
                  </div>
                  <div className="wa-geo-check-d">{c.detail}</div>
                  {c.status !== "pass" && (
                    <div className="wa-geo-check-w">{c.why}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {/* Bots — a tabela que ninguém olha até ao dia em que explica tudo */}
          {!readiness.unreachable && (
            <div className="wa-geo-bots">
              <div className="wa-geo-bots-l">
                {t("Agentes de IA e o que o robots.txt lhes diz", "AI agents and what robots.txt tells them")}
              </div>
              <div className="wa-geo-bots-grid">
                {readiness.bots.map((b) => (
                  <span
                    key={b.name}
                    className={`wa-geo-bot ${
                      b.allowed === null ? "unknown" : b.allowed ? "ok" : "blocked"
                    }${b.critical ? " crit" : ""}`}
                  >
                    <b>{b.allowed === null ? "?" : b.allowed ? "✓" : "✗"}</b>
                    {b.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ——— Plano de ação ————————————————————————————— */}
      {failing.length > 0 && (
        <>
          <h3 className="wa-h3 wa-geo-h">
            {t("O que fazer a seguir", "What to do next")}
          </h3>
          <ol className="wa-geo-plan">
            {failing.slice(0, 6).map((c) => (
              <li key={c.id}>
                <span className="wa-geo-plan-t">{c.label}</span>
                <span className="wa-geo-plan-f">{c.fix || c.why}</span>
              </li>
            ))}
          </ol>
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
