// Gera src/lib/training/seo-geo-questions.ts a partir do documento de
// especificação docs/formacao/especializacao-seo-geo.md.
//
//   node scripts/formacao/build-seo-geo-questions.mjs
//
// O documento é a fonte de verdade das perguntas dos 11 módulos da
// Especialização SEO/GEO (272 perguntas). Regras de parse (Anexo E do doc):
//   • `## Módulo N — …` abre um módulo; `### Quiz Módulo N` abre o banco.
//   • `Qn [single|multi|vf] enunciado` abre uma pergunta; `[vf]` termina em
//     `→ V` / `→ F`; `[single]`/`[multi]` têm opções `- [x]` / `- [ ]`.
//   • Linhas "Aula X.Y — …" / "Aulas X.Y–X.Z — …" entre perguntas dizem a que
//     aula pertencem as perguntas seguintes.
//   • `⚠️ CONFIRMAR (nota)` → needsReview + reviewNote (badge no CMS, não
//     bloqueia a publicação).
//
// Os ids são estáveis: `<módulo>-q<n>` pela numeração do documento. Se o
// documento for reordenado, os ids mudam — e com eles as respostas já dadas.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const SRC = resolve(root, "docs/formacao/especializacao-seo-geo.md");
const OUT = resolve(root, "src/lib/training/seo-geo-questions.ts");

/** Id de módulo por número do documento. Tem de bater com catalog.ts. */
const MODULE_IDS = {
  1: "seo-01-mindset",
  2: "seo-02-reporting",
  3: "seo-03-situacoes",
  4: "seo-04-auditoria",
  5: "seo-05-roadmap",
  6: "seo-06-onpage",
  7: "seo-07-estrategia",
  8: "seo-08-conteudo",
  9: "seo-09-local",
  10: "seo-10-backlinks",
  11: "seo-11-crescimento",
};

/** Id de aula por código do documento (X.Y). Tem de bater com catalog.ts —
 *  os ids das aulas que já existiam são preservados (é por eles que o
 *  progresso está guardado). */
const LESSON_IDS = {
  "1.1": "seo-m2-a1",
  "1.2": "seo-cd-app",
  "1.3": "seo-gmail-assinatura",
  "1.4": "seo-fathom",
  "1.5": "seo-agendar-reuniao",
  "1.6": "seo-pedido-ausencia",
  "2.1": "seo-cd-daily",
  "2.2": "seo-cd-weekly",
  "2.3": "seo-m5-a1",
  "2.4": "seo-com-mr-rp",
  "2.5": "seo-mr-ecommerce",
  "2.6": "seo-com-news-rp",
  "2.7": "seo-com-nps",
  "2.8": "seo-com-nps-rp",
  "3.1": "seo-com-aprov",
  "3.2": "seo-com-admin",
  "3.3": "seo-cd-tecnico",
  "3.4": "seo-cd-ticket",
  "4.1": "seo-audit-1",
  "4.2": "seo-audit-2",
  "4.3": "seo-screamingfrog",
  "4.4": "seo-kw-1",
  "4.5": "seo-kw-2",
  "4.6": "seo-kw-3",
  "5.1": "seo-cd-roadmap",
  "5.2": "seo-m4-a1",
  "5.3": "seo-m4-a2",
  "5.4": "seo-searchable-setup",
  "5.5": "seo-cd-ga4",
  "6.1": "seo-header-tags",
  "6.2": "seo-meta-tags",
  "6.3": "seo-alt-text",
  "6.4": "seo-internal-linking",
  "6.5": "seo-schema",
  "7.1": "seo-searchable-topics",
  "7.2": "seo-content-gap",
  "7.3": "seo-content-calendar",
  "8.1": "seo-cd-artigo",
  "8.2": "seo-publicar-html",
  "8.3": "seo-faq",
  "8.4": "seo-content-refresh",
  "9.1": "seo-gmb-audit",
  "9.2": "seo-gmb-posts",
  "9.3": "seo-gmb-publicar",
  "9.4": "seo-gmb-reviews",
  "10.1": "seo-backlinks-1",
  "10.2": "seo-backlinks-2",
  "10.3": "seo-backlink-doctoralia",
  "10.4": "seo-backlink-gap",
  "10.5": "seo-broken-links",
  "11.1": "seo-com-upsell",
  "11.2": "seo-com-upsell-rp",
  "11.3": "seo-registar-cross",
  "11.4": "seo-renovacao",
};

const REVIEW_RE = /\s*⚠️\s*CONFIRMAR\s*\((.*)\)\s*$/u;

function splitReview(text) {
  const m = text.match(REVIEW_RE);
  if (!m) return { text: text.trim(), note: null };
  return { text: text.replace(REVIEW_RE, "").trim(), note: m[1].trim() };
}

/** "(A) Texto" → "Texto". As letras são do documento, não da UI. */
function stripLetter(text) {
  return text.replace(/^\(([A-Z])\)\s+/, "").trim();
}

const lines = readFileSync(SRC, "utf8").split("\n");

const modules = new Map(); // num → { questions: [] }
let currentModule = null;
let inQuiz = false;
let currentLesson = null;
let current = null;

function closeQuestion() {
  if (!current) return;
  modules.get(currentModule).questions.push(current);
  current = null;
}

for (const raw of lines) {
  const line = raw.replace(/\s+$/, "");

  const mod = line.match(/^## Módulo (\d+) — /);
  if (mod) {
    closeQuestion();
    currentModule = Number(mod[1]);
    modules.set(currentModule, { questions: [] });
    inQuiz = false;
    currentLesson = null;
    continue;
  }
  if (/^## Anexo/.test(line)) {
    closeQuestion();
    currentModule = null;
    inQuiz = false;
    continue;
  }
  if (currentModule === null) continue;

  if (/^### Quiz Módulo/.test(line)) {
    inQuiz = true;
    continue;
  }
  if (!inQuiz) continue;

  if (line === "---") {
    closeQuestion();
    inQuiz = false;
    continue;
  }

  const q = line.match(/^Q(\d+) \[(single|multi|vf)\] (.*)$/);
  if (q) {
    closeQuestion();
    const n = Number(q[1]);
    const kind = q[2];
    let body = q[3];
    const { text, note } = splitReview(body);
    body = text;
    const question = {
      n,
      kind,
      lessonCode: currentLesson,
      prompt: body,
      options: [],
      answer: null,
      note,
    };
    if (kind === "vf") {
      const vf = body.match(/^(.*?)\s*→\s*([VF])\s*$/u);
      if (!vf) throw new Error(`M${currentModule} Q${n}: V/F sem resposta → ${body}`);
      question.prompt = vf[1].trim();
      question.answer = vf[2] === "V";
    }
    current = question;
    continue;
  }

  const opt = line.match(/^- \[( |x)\] (.*)$/);
  if (opt && current) {
    current.options.push([stripLetter(opt[2]), opt[1] === "x"]);
    continue;
  }

  // Linha "Aula 1.3 — …", "Aulas 2.7–2.8 — …" ou "Protocolos gerais (aulas 2.1–2.3)".
  const lesson = line.match(/(?:^|\()(?:Aulas?|aulas)\s+(\d+\.\d+)/u);
  if (lesson && !current) {
    currentLesson = lesson[1];
    continue;
  }
  if (line.startsWith("Sem perguntas")) {
    closeQuestion();
    continue;
  }
}
closeQuestion();

// ---- validação ----
const EXPECTED = { 1: 19, 2: 12, 3: 25, 4: 26, 5: 37, 6: 31, 7: 20, 8: 31, 9: 15, 10: 35, 11: 21 };
let total = 0;
let review = 0;
for (const [num, { questions }] of modules) {
  if (questions.length !== EXPECTED[num]) {
    throw new Error(`Módulo ${num}: ${questions.length} perguntas, esperava ${EXPECTED[num]}`);
  }
  for (const q of questions) {
    if (!q.lessonCode || !LESSON_IDS[q.lessonCode]) {
      throw new Error(`M${num} Q${q.n}: aula desconhecida (${q.lessonCode})`);
    }
    if (q.kind === "vf") {
      if (q.options.length) throw new Error(`M${num} Q${q.n}: V/F com opções`);
    } else {
      const correct = q.options.filter(([, c]) => c).length;
      if (!q.options.length) throw new Error(`M${num} Q${q.n}: sem opções`);
      if (correct === 0) throw new Error(`M${num} Q${q.n}: sem resposta certa`);
      if (q.kind === "single" && correct !== 1) {
        throw new Error(`M${num} Q${q.n}: single com ${correct} certas`);
      }
      if (q.kind === "multi" && correct < 2) {
        console.warn(`aviso: M${num} Q${q.n} é multi com só ${correct} certa`);
      }
    }
    total += 1;
    if (q.note) review += 1;
  }
}
if (total !== 272) throw new Error(`Total ${total}, esperava 272`);

// ---- emissão ----
const esc = (s) => JSON.stringify(s);
const out = [];
out.push(`// Banco de perguntas da Especialização SEO/GEO — 11 módulos, ${total} perguntas.`);
out.push(`//`);
out.push(`// FICHEIRO GERADO por scripts/formacao/build-seo-geo-questions.mjs a partir`);
out.push(`// de docs/formacao/especializacao-seo-geo.md. Não editar à mão: corrige o`);
out.push(`// documento e volta a correr o script — ou edita no CMS (/formacao/admin/cms),`);
out.push(`// que grava um override em KV por cima disto.`);
out.push(`//`);
out.push(`// Cada pergunta traz a aula a que pertence (\`lessonId\`) e, quando o`);
out.push(`// documento original não tinha resposta marcada, \`needsReview\` + a nota com`);
out.push(`// a resposta assumida (${review} perguntas). O CMS mostra-as com um badge`);
out.push(`// «a confirmar» e deixa marcá-las como confirmadas; não bloqueiam nada.`);
out.push(``);
out.push(`import type { TrainingQuestion } from "@/lib/training/catalog";`);
out.push(``);
out.push(`type Seed = {`);
out.push(`  /** Aula do catálogo que a pergunta avalia. */`);
out.push(`  l: string;`);
out.push(`  /** mc = escolha única · ms = escolha múltipla · vf = verdadeiro/falso */`);
out.push(`  t: "mc" | "ms" | "vf";`);
out.push(`  p: string;`);
out.push(`  /** Opções [texto, correta] (mc/ms). */`);
out.push(`  o?: [string, boolean][];`);
out.push(`  /** Resposta (vf). */`);
out.push(`  a?: boolean;`);
out.push(`  /** Nota de revisão — presente quando a resposta está por confirmar. */`);
out.push(`  r?: string;`);
out.push(`};`);
out.push(``);
out.push(`function bank(moduleId: string, seeds: Seed[]): TrainingQuestion[] {`);
out.push(`  return seeds.map((s, i) => {`);
out.push(`    const id = \`\${moduleId}-q\${i + 1}\`;`);
out.push(`    const options =`);
out.push(`      s.t === "vf"`);
out.push(`        ? [`);
out.push(`            { id: \`\${id}-v\`, text: "Verdadeiro", isCorrect: s.a === true },`);
out.push(`            { id: \`\${id}-f\`, text: "Falso", isCorrect: s.a !== true },`);
out.push(`          ]`);
out.push(`        : (s.o ?? []).map(([text, isCorrect], k) => ({`);
out.push(`            id: \`\${id}-o\${k + 1}\`,`);
out.push(`            text,`);
out.push(`            isCorrect,`);
out.push(`          }));`);
out.push(`    return {`);
out.push(`      id,`);
out.push(`      prompt: s.p,`);
out.push(`      type:`);
out.push(`        s.t === "vf"`);
out.push(`          ? "true_false"`);
out.push(`          : s.t === "ms"`);
out.push(`            ? "multi_select"`);
out.push(`            : "multiple_choice",`);
out.push(`      order: i + 1,`);
out.push(`      points: 1,`);
out.push(`      options,`);
out.push(`      explanation: null,`);
out.push(`      lessonId: s.l,`);
out.push(`      ...(s.r ? { needsReview: true, reviewNote: s.r } : {}),`);
out.push(`    };`);
out.push(`  });`);
out.push(`}`);
out.push(``);
out.push(`/** Perguntas por id de módulo — juntam-se a TRAINING_QUESTIONS em questions.ts. */`);
out.push(`export const SEO_GEO_QUESTIONS: Record<string, TrainingQuestion[]> = {`);
for (const [num, { questions }] of [...modules].sort((a, b) => a[0] - b[0])) {
  const moduleId = MODULE_IDS[num];
  out.push(`  // Módulo ${num} · ${questions.length} perguntas`);
  out.push(`  ${esc(moduleId)}: bank(${esc(moduleId)}, [`);
  for (const q of questions) {
    const t = q.kind === "vf" ? "vf" : q.kind === "multi" ? "ms" : "mc";
    out.push(`    {`);
    out.push(`      l: ${esc(LESSON_IDS[q.lessonCode])},`);
    out.push(`      t: ${esc(t)},`);
    out.push(`      p: ${esc(q.prompt)},`);
    if (q.kind === "vf") {
      out.push(`      a: ${q.answer},`);
    } else {
      out.push(`      o: [`);
      for (const [text, ok] of q.options) {
        out.push(`        [${esc(text)}, ${ok}],`);
      }
      out.push(`      ],`);
    }
    if (q.note) out.push(`      r: ${esc(q.note)},`);
    out.push(`    },`);
  }
  out.push(`  ]),`);
}
out.push(`};`);
out.push(``);

writeFileSync(OUT, out.join("\n"));
console.log(`OK — ${total} perguntas (${review} a confirmar) → ${OUT}`);
