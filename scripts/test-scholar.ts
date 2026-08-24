// Live integration check for the Blog Writer's academic-source search.
//
//   npx tsx scripts/test-scholar.ts
//
// Hits the real OpenAlex / Europe PMC APIs — no key needed for those. The
// query-translation step needs ANTHROPIC_API_KEY; where that is unset the
// translation assertions report SKIP and the fallback path is asserted
// instead (that is the case on most laptops — the key is Vercel-only).

import * as fs from "node:fs";

function readEnvFile(): string {
  try {
    return fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    return "";
  }
}

// Load .env.local so the translation path runs when a key is present.
// Values are never printed.
for (const line of readEnvFile().split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

import {
  searchScholarlySources,
  buildAcademicQueries,
  looksMedical,
  formatScholarSourcesForPrompt,
  formatScholarSourcesForStream,
} from "../src/lib/seo-tools/scholar";

let pass = 0, fail = 0, skip = 0;
const HAS_KEY = Boolean((process.env.ANTHROPIC_API_KEY ?? "").trim());
function skipped(name: string, why: string) { skip++; console.log(`  SKIP  ${name} — ${why}`); }
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${detail}`); }
}

async function main() {
  console.log("\n=== looksMedical ===");
  check("PT medical topic", looksMedical("tratamento de escoliose em Lisboa"));
  check("PT dental topic", looksMedical("implantes dentários all-on-4"));
  check("non-medical topic", !looksMedical("melhor software de faturação para PME"));

  console.log("\n=== buildAcademicQueries (heuristic fallback, no API key) ===");
  const savedKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  const heurRes = await buildAcademicQueries({
    topic: "Tratamento de escoliose em Lisboa",
    primaryKeyword: "tratamento escoliose lisboa",
  });
  const heur = heurRes.queries;
  console.log("  ->", JSON.stringify(heur), "fallback:", heurRes.fallback);
  check("returns at least one query", heur.length >= 1);
  check("flags itself as fallback", heurRes.fallback === true);
  check("strips city name", !heur.join(" ").toLowerCase().includes("lisboa"), JSON.stringify(heur));
  if (savedKey) process.env.ANTHROPIC_API_KEY = savedKey;

  console.log("\n=== buildAcademicQueries (translation model) ===");
  const trans = await buildAcademicQueries({
    topic: "Tratamento de escoliose em Lisboa: o que funciona mesmo",
    primaryKeyword: "tratamento escoliose lisboa",
    signal: AbortSignal.timeout(60_000),
  });
  console.log("  ->", JSON.stringify(trans.queries), "fallback:", trans.fallback);
  if (HAS_KEY) {
    check("translation path used (not fallback)", trans.fallback === false);
    check("produced 1-3 queries", trans.queries.length >= 1 && trans.queries.length <= 3);
    check("queries are English (no PT stopwords)", !/\b(de|em|para|com|tratamento)\b/i.test(trans.queries.join(" ")), JSON.stringify(trans.queries));
    check("city stripped", !trans.queries.join(" ").toLowerCase().includes("lisbo"));
  } else {
    skipped("translation model assertions", "ANTHROPIC_API_KEY is empty in .env.local (Vercel-only); prod exercises this path");
    check("degrades to fallback without a key", trans.fallback === true);
    check("still returns a usable query", trans.queries.length >= 1);
  }

  console.log("\n=== buildAcademicQueries with empty seed ===");
  const none = await buildAcademicQueries({});
  check("empty seed -> no queries", none.queries.length === 0);

  console.log("\n=== searchScholarlySources: medical (dental) ===");
  const dental = await searchScholarlySources({
    topic: "Implantes dentários: quanto tempo duram",
    primaryKeyword: "implantes dentarios duracao",
    max: 5,
    signal: AbortSignal.timeout(90_000),
  });
  console.log("  queries:", dental.queries);
  console.log("  providers:", dental.providers, "| found:", dental.found, "| unverified:", dental.unverified);
  check("ok", dental.ok, dental.reason ?? "");
  check("<= max papers", dental.papers.length <= 5);
  check("every paper has a title", dental.papers.every(p => p.title.length > 0));
  check("every paper has resolvable url", dental.papers.every(p => /^https?:\/\//.test(p.url)));
  check("every paper has a DOI or scholar link", dental.papers.every(p => p.doi !== null || p.provider === "google-scholar"));
  check("no duplicate keys", new Set(dental.papers.map(p => p.key)).size === dental.papers.length);
  check("authority score in 0..100", dental.papers.every(p => p.authorityScore >= 0 && p.authorityScore <= 100));
  check("sorted by authority desc", dental.papers.every((p, i) => i === 0 || dental.papers[i-1].authorityScore >= p.authorityScore));
  check("respects minYear (>= currentYear-8)", dental.papers.every(p => p.year === null || p.year >= new Date().getFullYear() - 8), JSON.stringify(dental.papers.map(p=>p.year)));
  if (HAS_KEY) check("did not use fallback query", dental.usedFallbackQuery === false);
  else skipped("did not use fallback query", "no API key locally");
  check("every paper has a venue", dental.papers.every(p => p.venue !== null), JSON.stringify(dental.papers.map(p=>p.venue)));
  for (const p of dental.papers) {
    console.log(`   • [${p.authorityScore}] ${p.title.slice(0,64)} | ${p.venue} ${p.year} | cites ${p.citationCount} | h ${p.topAuthorHIndex} | ${p.provider}`);
  }

  console.log("\n=== English query path (what the translation step emits) ===");
  const eng = await searchScholarlySources({
    topic: "dental implant survival rate long-term outcomes",
    primaryKeyword: "dental implant survival",
    max: 5,
    signal: AbortSignal.timeout(120_000),
  });
  console.log("  queries:", eng.queries, "| providers:", eng.providers, "| found:", eng.found, "| unverified:", eng.unverified);
  check("english path ok", eng.ok, eng.reason ?? "");
  check("openalex contributed", eng.providers.includes("openalex"));
  check("h-index resolved for >=1 paper", eng.papers.some(p => p.topAuthorHIndex !== null), JSON.stringify(eng.papers.map(p=>p.topAuthorHIndex)));
  check("every paper has a venue", eng.papers.every(p => p.venue !== null));
  check("every paper has authors", eng.papers.every(p => p.authors.length > 0));
  check("no retracted flag leaked", eng.papers.every(p => p.doi !== null));
  check("results are on-topic (title mentions implant/dental)", eng.papers.filter(p => /implant|dental|periodont|oral/i.test(p.title)).length >= Math.ceil(eng.papers.length / 2), JSON.stringify(eng.papers.map(p=>p.title.slice(0,40))));
  for (const p of eng.papers) {
    console.log(`   • [${p.authorityScore}] ${p.title.slice(0,60)}`);
    console.log(`       ${p.venue} ${p.year} | cites ${p.citationCount} | topH ${p.topAuthorHIndex} | OA ${p.isOpenAccess} | ${p.provider}`);
    console.log(`       authors: ${p.authors.map(a=>`${a.name}${a.hIndex!==null?` (h${a.hIndex})`:""}`).join(", ")}`);
  }
  const engBlock = formatScholarSourcesForPrompt(eng);
  if (HAS_KEY) check("english block has no fallback warning", !engBlock.includes("NOT translated"));
  else skipped("english block has no fallback warning", "no key -> heuristic path, flag correctly true");
  check("fallback warning presence matches the flag", engBlock.includes("NOT translated") === eng.usedFallbackQuery);

  console.log("\n=== prompt block ===");
  const block = formatScholarSourcesForPrompt(dental);
  check("prompt block names the closed list rule", block.includes("ONLY academic sources"));
  check("prompt block contains every url", dental.papers.every(p => block.includes(p.url)));
  console.log(block.split("\n").slice(0, 8).join("\n"));

  console.log("\n=== stream table ===");
  const table = formatScholarSourcesForStream(dental);
  check("stream table has a row per paper", table.split("\n").length === dental.papers.length + 2);
  console.log(table);

  console.log("\n=== non-medical topic (OpenAlex only) ===");
  const nm = await searchScholarlySources({
    topic: "Impacto do teletrabalho na produtividade das equipas",
    primaryKeyword: "teletrabalho produtividade",
    max: 3,
    signal: AbortSignal.timeout(90_000),
  });
  console.log("  queries:", nm.queries, "| providers:", nm.providers);
  check("non-medical returns results", nm.ok, nm.reason ?? "");
  check("non-medical did NOT hit europepmc", !nm.providers.includes("europepmc"));
  for (const p of nm.papers) console.log(`   • [${p.authorityScore}] ${p.title.slice(0,64)} | ${p.year}`);

  console.log("\n=== nonsense topic degrades gracefully ===");
  const junk = await searchScholarlySources({
    topic: "zzzqqqxxwv nonexistent topic zzz",
    primaryKeyword: "zzzqqqxxwv",
    max: 3,
    signal: AbortSignal.timeout(60_000),
  });
  check("no crash on junk", typeof junk.ok === "boolean");
  const junkBlock = formatScholarSourcesForPrompt(junk);
  check("junk -> anti-hallucination instruction", junkBlock.includes("Do NOT invent"));
  console.log("  ok:", junk.ok, "| papers:", junk.papers.length, "| reason:", junk.reason);

  console.log(`\n=========== ${pass} passed, ${fail} failed, ${skip} skipped ===========`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2); });
