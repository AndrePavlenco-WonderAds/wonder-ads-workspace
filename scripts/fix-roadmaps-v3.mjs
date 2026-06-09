// v3 corrections — re-read every FigJam image, focused ONLY on the
// background colour of each task box. Comment bubbles (Y/1/2 chips in
// the corners) and user avatars are explicitly ignored.
//
// Calibration: Andre pointed out WhiteClinic Week 2 has only 2 green
// tasks even though I'd marked all 6 implemented. That was the tell
// that I was conflating the FigJam's LIGHT-VIOLET hue with green
// across the entire board. This pass shifts the majority of those
// uncertain tasks → `pending_review`, keeps the clearly-vibrant-green
// ones as `implemented`, and leans `not_started` for the muted grays.
//
// This script regenerates the FULL roadmap per client (same id rebuild
// as the earlier seeds) — the previous (wrong) blob is auto-archived
// to roadmap:archive:<slug>. Re-running is idempotent.

import { kv } from "@vercel/kv";

const NOW = Date.now();
let idCounter = 0;

function task(week, title, status, pillar) {
  return {
    id: `t_${week}_${(idCounter++).toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 6)}`,
    week,
    title,
    status,
    pillar,
    order: 0,
    statusChangedAt: NOW,
    createdAt: NOW,
  };
}

function withOrders(tasks) {
  const byWeek = new Map();
  return tasks.map((t) => {
    const next = (byWeek.get(t.week) ?? -1) + 1;
    byWeek.set(t.week, next);
    return { ...t, order: next };
  });
}

const CLIENTS = [
  // ──────────────────────────────────────────────────────────────────────────
  //  WhiteClinic  ·  Tier 2  ·  Re-start 20/04/2026  ·  Week 8
  //
  //  v3 calibration: most Month 1 "technical-fix" lines I'd marked
  //  implemented are actually LIGHT-VIOLET → pending_review. Only the
  //  bright-green boxes stay implemented.
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "white-clinic",
    onboardingDate: "2026-03-30",
    startDate: "2026-04-20",
    auditSummary:
      "Clínica White Clinic (Lisboa) — odontologia premium liderada pelo Dr. Miguel Stanley. Após o re-arranque de 20/04, o ciclo arrancou com auditoria técnica completa (4xx/redirects, H1 em falta, CWV, llms.txt, duplicate titles/metas, orphaned pages) — uma boa parte enviada para revisão do cliente, alguns blocos já fechados. Foco actual: E-E-A-T do blog + Author Signature, Person Schema (Dr. Miguel Stanley e equipa), GBP (vídeos, posts, planeamento mensal), conteúdo bilingue (EN+PT) com FAQ Schema, página Longevidade + GPT personalizado, tracking de visibilidade em IA. Month 3 reserva off-page (backlinks médicos), audit Dr. Stanley e reporting trimestral.",
    tasks: [
      // ─ Month 1 ───────────────────────────────────────────────────────────
      // Week 1 — all 4 GREEN
      task(1, "Corrigir erros 4XX / criar redirects", "implemented", "technical"),
      task(1, "Corrigir H1 em falta", "implemented", "technical"),
      task(1, "Instalar tag Google Analytics", "implemented", "research"),
      task(1, "Keyword Research", "implemented", "research"),

      // Week 2 — 2 GREEN (Melhorar slow load + Criar ficheiro llms.txt),
      // other 4 are light-violet → pending_review.
      task(2, "Criar meta descriptions em falta", "pending_review", "on-page"),
      task(2, "Melhorar slow load speed & identificar problemas de CWV", "implemented", "technical"),
      task(2, "Criar ficheiro llms.txt", "implemented", "technical"),
      task(2, "Corrigir duplicate title tags", "pending_review", "on-page"),
      task(2, "Corrigir duplicate meta descriptions", "pending_review", "on-page"),
      task(2, "Reduzir title tags muito longas", "pending_review", "on-page"),

      // Week 3 — 5 GREEN + 1 VIOLET (only Copy da página Longevidade)
      task(3, "Melhorar slow load speed & identificar problemas de CWV (ronda 2)", "implemented", "technical"),
      task(3, "More than one H1 tag", "implemented", "technical"),
      task(3, "Tracking de visibilidade em IA", "implemented", "research"),
      task(3, "Corrigir links HTTPS que apontam para HTTP", "implemented", "technical"),
      task(3, "Check orphaned pages in sitemaps", "implemented", "technical"),
      task(3, "Copy da página Longevidade", "pending_review", "content"),

      // Week 4 — 5 GREEN + 2 VIOLET (Blog Roadmap + Organização do Blog)
      task(4, "Blog Roadmap", "pending_review", "content"),
      task(4, "Organização do Blog por categorias", "pending_review", "content"),
      task(4, "Schema markup nas páginas de serviço (início)", "implemented", "technical"),
      task(4, "GBP Audit", "implemented", "local"),
      task(4, "Configurar GPT White Clinic", "implemented", "research"),
      task(4, "Adicionar categorias secundárias no GBP", "implemented", "local"),
      task(4, "Identificar a causa do INP > 200 em mobile", "implemented", "technical"),

      // ─ Month 2 — Week 8 current ──────────────────────────────────────────
      // Week 5 — 4 GREEN + 2 VIOLET (EEAT Author Signature + Planning GBP)
      task(5, "Otimizar estrutura de headings (H1, H2, H3)", "implemented", "on-page"),
      task(5, "E-E-A-T Author Signature para o Blog", "pending_review", "on-page"),
      task(5, "Implementar Person Schema na página Dr. Miguel Stanley e equipa", "implemented", "technical"),
      task(5, "Implementar Internal Linking", "implemented", "on-page"),
      task(5, "Planning GBP posts", "pending_review", "local"),
      task(5, "Adicionar vídeos no GBP", "implemented", "local"),

      // Week 6 — 3 GREEN + 2 VIOLET
      task(6, "Imagens com Alt text em falta", "implemented", "technical"),
      task(6, "Otimização GBP", "implemented", "local"),
      task(6, "Report mensal Maio", "implemented", "research"),
      task(6, "Blog Roadmap (ronda 2)", "pending_review", "content"),
      task(6, "Planning GBP posts (ronda 2)", "pending_review", "local"),

      // Week 7 — all 5 GREEN → implemented.
      task(7, "Research de FAQs para páginas de serviço prioritárias pt1", "implemented", "research"),
      task(7, "Tradução da página medicina oral integrativa e formatação em EN", "implemented", "content"),
      task(7, "Otimizar imagens pesadas", "implemented", "technical"),
      task(7, "Otimização GBP (ronda 2)", "implemented", "local"),
      task(7, 'Adicionar "Longevidade" ao menu', "implemented", "on-page"),

      // Week 8 — all 5 GRAY → not_started. (Y user-chips on the first
      // two tasks tricked me into reading them as green; the box body
      // is the same gray as the bottom three.)
      task(8, "Integração de keywords no conteúdo", "not_started", "on-page"),
      task(8, "Criação das respostas para as FAQs de serviço pt 1", "not_started", "content"),
      task(8, "Adicionar FAQ Schema nas páginas de serviço otimizadas", "not_started", "technical"),
      task(8, "1 blog post (EN + PT)", "not_started", "content"),
      task(8, "1 post GBP", "not_started", "local"),

      // ─ Month 3 — all gray ────────────────────────────────────────────────
      task(9, "Analisar keywords em posições 5-20", "not_started", "research"),
      task(9, "Otimizar páginas com keywords melhor posicionadas", "not_started", "on-page"),
      task(9, "Análise de gap de conteúdo vs. concorrentes", "not_started", "research"),
      task(9, "1 blog post (EN + PT)", "not_started", "content"),
      task(9, "1 GBP post", "not_started", "local"),

      task(10, "Backlink audit / toxic backlinks / disavow", "not_started", "off-page"),
      task(10, "Estratégia de link building para autoridade médica", "not_started", "off-page"),
      task(10, "Verificar e otimizar presença em diretórios de saúde locais", "not_started", "off-page"),
      task(10, "1 blog post (EN + PT)", "not_started", "content"),
      task(10, "1 GBP post", "not_started", "local"),
      task(10, "Report mensal Junho", "not_started", "research"),

      task(11, "Melhorar CTR (titles + meta descriptions)", "not_started", "on-page"),
      task(11, "Reforçar linking interno nas páginas otimizadas", "not_started", "on-page"),
      task(11, "Audit e otimização da página do Dr. Miguel Stanley", "not_started", "on-page"),
      task(11, "1 blog post (EN + PT)", "not_started", "content"),
      task(11, "1 GBP post", "not_started", "local"),

      task(12, "Reporting trimestral", "not_started", "research"),
      task(12, "Analisar rankings + tráfego + leads", "not_started", "research"),
      task(12, "Revisão do GPT personalizado", "not_started", "research"),
      task(12, "1 blog post (EN + PT)", "not_started", "content"),
      task(12, "1 GBP post", "not_started", "local"),
    ],
  },
];

async function seedClient(client) {
  const KEY = `roadmap:current:${client.slug}`;
  const ARCHIVE_KEY = `roadmap:archive:${client.slug}`;
  const existing = await kv.get(KEY);
  if (existing) {
    const archive = (await kv.get(ARCHIVE_KEY)) ?? [];
    const updated = [existing, ...archive].slice(0, 12);
    await kv.set(ARCHIVE_KEY, updated);
    console.log(
      `  · archived previous roadmap with ${existing.tasks?.length ?? 0} tasks`,
    );
  }
  const roadmap = {
    id: `${Date.now().toString(36)}-${client.slug}-v3`,
    clientSlug: client.slug,
    startDate: client.startDate,
    onboardingDate: client.onboardingDate,
    generatedAt: NOW,
    tasks: withOrders(client.tasks),
    dismissedWarnings: [],
    auditSummary: client.auditSummary,
  };
  await kv.set(KEY, roadmap);
  const byStatus = roadmap.tasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`  ✓ wrote ${KEY} · ${roadmap.tasks.length} tasks`, byStatus);
}

async function main() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    console.error("Missing KV env vars");
    process.exit(1);
  }
  for (const c of CLIENTS) {
    console.log(`\n══ ${c.slug} ══`);
    await seedClient(c);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
