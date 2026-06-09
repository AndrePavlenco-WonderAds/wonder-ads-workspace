// One-off seed for B-life's roadmap — Month 1 + Month 2 (weeks 1-8).
//
// Pulled from Andre's hand-drawn FigJam roadmap (2026-06-09). Status
// colours map onto the workspace's 4-state model as:
//
//   GRAY    Task Not Started               → "not_started"
//   YELLOW  Task Ongoing                   → "in_progress"
//   VIOLET  Task Pending Clients Review    → "pending_review"
//   GREEN   Task Done                      → "implemented"
//
// (The BLUE "Tier 2 client task" + ORANGE "Pending André/José decision"
//  legend colours don't apply here — B-life is Tier 1 and nothing in
//  Months 1-2 is internally-blocked.)
//
// Run from the repo root with the local .env.local loaded — it carries
// the production KV REST creds, so writes go to the same cluster prod
// reads from:
//
//   node --env-file=.env.local scripts/seed-b-life-roadmap.mjs

import { kv } from "@vercel/kv";

const SLUG = "b-life";
const START_DATE = "2026-02-09"; // Monday — matches FigJam
const NOW = Date.now();
const KEY = `roadmap:current:${SLUG}`;
const ARCHIVE_KEY = `roadmap:archive:${SLUG}`;

/** Build a task with stable id + timestamps. */
function task(week, order, title, status, pillar, description = undefined) {
  return {
    id: `t_${week}_${order}_${Math.random().toString(36).slice(2, 7)}`,
    week,
    title,
    description,
    status,
    pillar,
    order,
    statusChangedAt: NOW,
    createdAt: NOW,
  };
}

const TASKS = [
  // ─── Month 1 ──────────────────────────────────────────────────────
  // Week 1
  task(1, 0, "Audit e redirect URLs 404", "in_progress", "technical"),
  task(
    1,
    1,
    "Landing Page para Maristela — Dia das Mães",
    "in_progress",
    "content",
  ),
  task(
    1,
    2,
    'Auditoria mensal das páginas "Descobertas — não indexadas" para identificar bloqueios',
    "in_progress",
    "technical",
  ),
  task(1, 3, "Blog Roadmap — expandido", "in_progress", "content"),
  task(1, 4, "GMB Audit", "in_progress", "local"),
  task(1, 5, "Revisão e ajuste de sitemap", "implemented", "technical"),
  task(1, 6, "Revisão e ajuste de robots.txt", "implemented", "technical"),
  task(
    1,
    7,
    "Revisão e ajuste solicitado pelo cliente",
    "implemented",
    "content",
  ),
  task(
    1,
    8,
    "Postagem de textos solicitados pelo cliente",
    "implemented",
    "content",
  ),

  // Week 2
  task(
    2,
    0,
    "Mapeamento semântico (LSI) e termos relacionados a peptídeos",
    "in_progress",
    "research",
  ),
  task(
    2,
    1,
    "Ajuste de LCP Mobile (Core Web Vitals) nas 18 URLs críticas — compressão e prioridade",
    "in_progress",
    "technical",
  ),
  task(
    2,
    2,
    "Análise de necessidade e refresh de Meta Descriptions das Top 5 páginas para aumento de CTR",
    "in_progress",
    "on-page",
  ),
  task(2, 3, "Blog Article", "implemented", "content"),
  task(2, 4, "GMB Post", "pending_review", "local"),

  // Week 3
  task(
    3,
    0,
    "Levantamento de intenção de busca local (Cascais / Lisboa) para termos transacionais",
    "pending_review",
    "research",
  ),
  task(
    3,
    1,
    "Correção das 7 cadeias de redirecionamento (Redirect Chains)",
    "pending_review",
    "technical",
  ),
  task(3, 2, "Blog Article", "implemented", "content"),
  task(3, 3, "GMB Post", "pending_review", "local"),
  task(3, 4, "Blog Article — Publicação", "pending_review", "content"),

  // Week 4
  task(
    4,
    0,
    "Análise de Keyword Gap vs. concorrentes",
    "pending_review",
    "research",
  ),
  task(4, 1, "Blog Article", "pending_review", "content"),
  task(
    4,
    2,
    "Implementação de FAQ Schema na página de Full Body Scan",
    "pending_review",
    "technical",
  ),
  task(
    4,
    3,
    "Keyword research para topic cluster — Full Body Scan (SEMRush, PAA, fóruns)",
    "pending_review",
    "research",
  ),

  // ─── Month 2 ──────────────────────────────────────────────────────
  // Week 5
  task(
    5,
    0,
    "Submissão de novo XML Sitemap e validação de correções no GSC",
    "in_progress",
    "technical",
  ),
  task(
    5,
    1,
    'Levantamento de perguntas de pacientes sobre "Biomarcadores e Sangue"',
    "in_progress",
    "research",
  ),
  task(
    5,
    2,
    "Redação e estruturação da Bio Page da Dra. Joana Costa (Experiência, Clínica)",
    "in_progress",
    "content",
  ),
  task(5, 3, "Blog Article", "in_progress", "content"),
  task(5, 4, "GMB Post", "in_progress", "local"),

  // Week 6
  task(
    6,
    0,
    'Mapeamento de entidades médicas (YMYL) necessárias para rankear em "Medicina Preventiva"',
    "in_progress",
    "content",
  ),
  task(
    6,
    1,
    "Redação e edição da Bio Page de membro da clínica",
    "in_progress",
    "content",
  ),
  task(6, 2, "Blog Article", "not_started", "content"),
  task(6, 3, "GMB Post", "not_started", "local"),
  task(
    6,
    4,
    "Implementação de Schema Physician e MedicalOrganization",
    "not_started",
    "technical",
  ),

  // Week 7
  task(
    7,
    0,
    "Auditoria de Conteúdo Legado (GA4) — identificar posts com baixo tempo de permanência",
    "not_started",
    "content",
  ),
  task(
    7,
    1,
    'Refresh de 3 artigos antigos com "Information Gain" (novos dados médicos)',
    "not_started",
    "content",
  ),
  task(7, 2, "Blog Article", "not_started", "content"),
  task(7, 3, "GMB Post", "not_started", "local"),

  // Week 8
  task(
    8,
    0,
    'Mapeamento de Keywords "Quick Wins" (posições 11-20 no Search Console)',
    "not_started",
    "research",
  ),
  task(
    8,
    1,
    'Verificação da existência do selo "Conteúdo Revisto Medicamente" e orientação YMYL em todos os artigos do blog',
    "not_started",
    "content",
  ),
  task(8, 2, "Blog Article", "not_started", "content"),
  task(8, 3, "GMB Post", "not_started", "local"),
];

const AUDIT_SUMMARY = [
  "Clínica de medicina preventiva no Squarespace (Cascais / Lisboa) com",
  "duas linhas de autoridade fortes: peptídeos (Dra. Joana Costa) e",
  "diagnóstico avançado via Full Body Scan. O brief Q1-Q2 ataca três",
  "frentes em paralelo: (1) técnicas — LCP mobile em 18 URLs críticas,",
  "404s e cadeias de redirect, sitemap/robots, indexação; (2) Local SEO",
  "— GMB, intenção transacional Cascais/Lisboa, posts mensais; (3)",
  "Content + E-E-A-T — Bio Pages dos médicos, schema Physician /",
  "MedicalOrganization, FAQ no Full Body Scan, refresh de artigos com",
  "Information Gain, selo Conteúdo Revisto Medicamente em todos os",
  "posts YMYL. Eventos sazonais (Dia das Mães, IRON MAN) entram como",
  "landing pages pontuais. Meta dos 6 meses: 3 keywords premium em top-3.",
].join(" ");

const ROADMAP = {
  id: `${Date.now().toString(36)}-seed`,
  clientSlug: SLUG,
  startDate: START_DATE,
  generatedAt: NOW,
  tasks: TASKS,
  dismissedWarnings: [],
  auditSummary: AUDIT_SUMMARY,
};

async function main() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    console.error(
      "Missing KV_REST_API_URL / KV_REST_API_TOKEN — run with `node --env-file=.env.local …`",
    );
    process.exit(1);
  }
  // Archive whatever's currently at roadmap:current:b-life so we never
  // destroy work the consultant might already have entered. If there's
  // nothing yet, the archive write is a no-op.
  const existing = await kv.get(KEY);
  if (existing) {
    const archive = (await kv.get(ARCHIVE_KEY)) ?? [];
    const updated = [existing, ...archive].slice(0, 12);
    await kv.set(ARCHIVE_KEY, updated);
    console.log(
      `· archived existing roadmap with ${existing.tasks?.length ?? 0} tasks`,
    );
  } else {
    console.log("· no existing roadmap on file — clean seed");
  }

  await kv.set(KEY, ROADMAP);
  const byStatus = TASKS.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`✓ wrote ${KEY}`);
  console.log(`  ${TASKS.length} tasks across weeks 1-8`);
  console.log(`  status mix:`, byStatus);
  console.log(`  startDate: ${START_DATE}`);
}

main().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
