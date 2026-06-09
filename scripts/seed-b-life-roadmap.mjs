// One-off seed for B-life's roadmap — Month 1 + Month 2 (weeks 1-8).
//
// Re-transcribed 2026-06-09 from Andre's FigJam (close-up screenshots).
// The first pass got the GREEN tasks wrong — I had them as `in_progress`
// when they should have been `implemented` (the GREEN colour means DONE
// in the FigJam legend, not "ongoing"). This file is the corrected mix.
//
// Status colour → workspace status:
//
//   GRAY    Task Not Started               → "not_started"
//   YELLOW  Task Ongoing                   → "in_progress"
//   VIOLET  Task Pending Clients Review    → "pending_review"
//   GREEN   Task Done                      → "implemented"
//
// (Note: there are ZERO YELLOW tasks in months 1-2 of the corrected
//  FigJam — everything is either done, awaiting client review, or not
//  yet started.)
//
// Run from the repo root with the local .env.local loaded:
//
//   node --env-file=.env.local scripts/seed-b-life-roadmap.mjs

import { kv } from "@vercel/kv";

const SLUG = "b-life";
// v74.23.3: B-life is currently in Week 6 (Andre confirmed). With today
// = 2026-06-09 (Tue) and the week formula `floor((now - start) / 7) +
// 1`, Week 1 needs to start on the Monday 5 weeks ago → 2026-05-04.
// The roadmap was reset on that Monday; the original agency-engagement
// date stays pinned via `onboardingDate` below so the chip on the board
// still reads "Onboarded 09/02/2026".
const START_DATE = "2026-05-04";
const ONBOARDING_DATE = "2026-02-09";
const NOW = Date.now();
const KEY = `roadmap:current:${SLUG}`;
const ARCHIVE_KEY = `roadmap:archive:${SLUG}`;

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
  // Week 1 — all DONE (9 tasks, all GREEN in FigJam)
  task(1, 0, "Audit e redirect URLs 404", "implemented", "technical"),
  task(
    1,
    1,
    "Landing Page para Maristela — Dia das Mães",
    "implemented",
    "content",
  ),
  task(
    1,
    2,
    'Auditoria mensal das 14 páginas "Descobertas — não indexadas" para identificar bloqueios',
    "implemented",
    "technical",
  ),
  task(1, 3, "Blog Roadmap — expandido", "implemented", "content"),
  task(1, 4, "GMB Audit", "implemented", "local"),
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

  // Week 2 — 4 done + 1 pending review (GMB Post)
  task(
    2,
    0,
    "Mapeamento semântico (LSI) e termos relacionados a peptídeos",
    "implemented",
    "research",
  ),
  task(
    2,
    1,
    "Ajuste de LCP Mobile (Core Web Vitals) nas 18 URLs críticas — compressão e prioridade",
    "implemented",
    "technical",
  ),
  task(
    2,
    2,
    "Análise de necessidade e refresh de Meta Descriptions das Top 5 páginas para aumento de CTR",
    "implemented",
    "on-page",
  ),
  task(2, 3, "Blog Article", "implemented", "content"),
  task(2, 4, "GMB Post", "pending_review", "local"),

  // Week 3 — 4 done + 1 pending review (GMB Post)
  task(
    3,
    0,
    "Levantamento de intenção de busca local (Cascais / Lisboa) para termos transacionais",
    "implemented",
    "research",
  ),
  task(
    3,
    1,
    "Correção das 7 cadeias de redirecionamento (Redirect Chains)",
    "implemented",
    "technical",
  ),
  task(3, 2, "Blog Article", "implemented", "content"),
  task(3, 3, "GMB Post", "pending_review", "local"),
  task(3, 4, "Blog Article — Publicação", "implemented", "content"),

  // Week 4 — 3 done + 2 pending review (GMB Post + FAQ Schema)
  task(
    4,
    0,
    "Análise de Keyword Gap vs. concorrentes",
    "implemented",
    "research",
  ),
  task(4, 1, "Blog Article", "implemented", "content"),
  task(4, 2, "GMB Post", "pending_review", "local"),
  task(
    4,
    3,
    "Implementação de FAQ Schema na página de Full Body Scan",
    "pending_review",
    "technical",
  ),
  task(
    4,
    4,
    "Keyword research para topic cluster — Full Body Scan (SEMRush, PAA, fóruns)",
    "implemented",
    "research",
  ),

  // ─── Month 2 ──────────────────────────────────────────────────────
  // Week 5 — 3 done + 2 pending review (Bio Page Dra. Joana + GMB Post)
  task(
    5,
    0,
    "Submissão de novo XML Sitemap e validação de correções no GSC",
    "implemented",
    "technical",
  ),
  task(
    5,
    1,
    'Levantamento de perguntas de pacientes sobre "Biomarcadores e Sangue"',
    "implemented",
    "research",
  ),
  task(
    5,
    2,
    "Redação e estruturação da Bio Page da Dra. Joana Costa (Experiência, Clínica)",
    "pending_review",
    "content",
  ),
  task(5, 3, "Blog Article", "implemented", "content"),
  task(5, 4, "GMB Post", "pending_review", "local"),

  // Week 6 — 2 done + 1 pending review + 2 not started
  task(
    6,
    0,
    'Mapeamento de entidades médicas (YMYL) necessárias para rankear em "Medicina Preventiva"',
    "implemented",
    "content",
  ),
  task(
    6,
    1,
    "Redação e edição da Bio Page de membro da clínica",
    "pending_review",
    "content",
  ),
  task(6, 2, "Blog Article", "not_started", "content"),
  task(6, 3, "GMB Post", "not_started", "local"),
  task(
    6,
    4,
    "Implementação de Schema Physician e MedicalOrganization",
    "implemented",
    "technical",
  ),

  // Week 7 — all NOT STARTED (4 tasks, all GRAY in FigJam)
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

  // Week 8 — all NOT STARTED (4 tasks, all GRAY in FigJam)
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
  onboardingDate: ONBOARDING_DATE,
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
  console.log(`  startDate:       ${START_DATE}  (Week 1 = this Monday)`);
  console.log(`  onboardingDate:  ${ONBOARDING_DATE}  (original engagement)`);
}

main().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
