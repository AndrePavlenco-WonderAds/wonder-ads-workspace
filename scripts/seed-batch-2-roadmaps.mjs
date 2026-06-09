// Batch 2 — 6 more SEO clients seeded from Andre's FigJam (2026-06-09).
// Mirror of seed-all-roadmaps.mjs; see that file for the status-colour
// mapping notes.
//
// Week math:
//   Five of the six clients have a "Re-starting Date: 20/04/2026" sticky
//   in the FigJam (the original Starting Date is preserved as
//   `onboardingDate`). 2026-04-20 is a Monday; today (2026-06-09 Tue)
//   = day 50 since restart → floor(50/7)+1 = Week 8.
//
//   Spine Center is the only one without a reset — onboarded on Mon
//   2026-06-01 → today is Week 2.
//
// Run: node --env-file=.env.local scripts/seed-batch-2-roadmaps.mjs

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
  //  WhiteClinic  ·  Tier 2  ·  Onboarded 30/03/2026  ·  Re-start 20/04/2026
  //                ·  Currently Week 8
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "white-clinic",
    label: "WhiteClinic",
    onboardingDate: "2026-03-30",
    startDate: "2026-04-20", // Re-starting Date — Week 8 today
    auditSummary:
      "Clínica White Clinic (Lisboa) — odontologia premium liderada pelo Dr. Miguel Stanley. Após o re-arranque de 20/04, o ciclo arrancou com auditoria técnica completa (4xx/redirects, H1 em falta, CWV, llms.txt, duplicate titles/metas, orphaned pages) — quase tudo já implementado. Foco actual: (1) E-E-A-T do blog com Author Signature + Person Schema (Dr. Miguel Stanley e equipa); (2) GBP — vídeos, posts, planeamento mensal; (3) Conteúdo bilingue (EN+PT) com FAQ Schema nas páginas de serviço; (4) Otimização da página Longevidade + GPT personalizado; (5) Tracking de visibilidade em IA. Month 3 reserva o trabalho de off-page (backlinks médicos), audit do Dr. Stanley e reporting trimestral.",
    tasks: [
      // ─ Month 1 (mostly green, KW research in flight) ─────────────────────
      task(1, "Corrigir erros 4XX / criar redirects", "implemented", "technical"),
      task(1, "Corrigir H1 em falta", "implemented", "technical"),
      task(1, "Instalar tag Google Analytics", "implemented", "research"),
      task(1, "Keyword Research", "in_progress", "research"),

      task(2, "Criar meta descriptions em falta", "implemented", "on-page"),
      task(2, "Melhorar slow load speed & identificar problemas de CWV", "implemented", "technical"),
      task(2, "Criar ficheiro llms.txt", "implemented", "technical"),
      task(2, "Corrigir duplicate title tags", "implemented", "on-page"),
      task(2, "Corrigir duplicate meta descriptions", "implemented", "on-page"),
      task(2, "Reduzir title tags muito longas", "implemented", "on-page"),

      task(3, "Melhorar slow load speed & identificar problemas de CWV (ronda 2)", "implemented", "technical"),
      task(3, "More than one H1 tag", "implemented", "technical"),
      task(3, "Tracking de visibilidade em IA", "implemented", "research"),
      task(3, "Corrigir links HTTPS que apontam para HTTP", "implemented", "technical"),
      task(3, "Check orphaned pages in sitemaps", "implemented", "technical"),
      task(3, "Copy da página Longevidade", "implemented", "content"),

      task(4, "Blog Roadmap", "in_progress", "content"),
      task(4, "Organização do Blog por categorias", "implemented", "content"),
      task(4, "Schema markup nas páginas de serviço (início)", "implemented", "technical"),
      task(4, "GBP Audit", "implemented", "local"),
      task(4, "Configurar GPT White Clinic", "implemented", "research"),
      task(4, "Adicionar categorias secundárias no GBP", "implemented", "local"),
      task(4, "Identificar a causa do INP > 200 em mobile", "in_progress", "technical"),

      // ─ Month 2 — Week 8 is current ───────────────────────────────────────
      task(5, "Otimizar estrutura de headings (H1, H2, H3)", "in_progress", "on-page"),
      task(5, "E-E-A-T Author Signature para o Blog", "in_progress", "on-page"),
      task(5, "Implementar Person Schema na página Dr. Miguel Stanley e equipa", "in_progress", "technical"),
      task(5, "Implementar Internal Linking", "in_progress", "on-page"),
      task(5, "Planning GBP posts", "in_progress", "local"),
      task(5, "Adicionar vídeos no GBP", "implemented", "local"),

      task(6, "Imagens com Alt text em falta", "in_progress", "technical"),
      task(6, "Otimização GBP", "in_progress", "local"),
      task(6, "Report mensal Maio", "implemented", "research"),
      task(6, "Blog Roadmap (ronda 2)", "pending_review", "content"),
      task(6, "Planning GBP posts (ronda 2)", "pending_review", "local"),

      task(7, "Research de FAQs para páginas de serviço prioritárias pt1", "in_progress", "research"),
      task(7, "Tradução da página medicina oral integrativa e formatação em EN", "implemented", "content"),
      task(7, "Otimizar imagens pesadas", "implemented", "technical"),
      task(7, "Otimização GBP (ronda 2)", "in_progress", "local"),
      task(7, 'Adicionar "Longevidade" ao menu', "pending_review", "on-page"),

      task(8, "Integração de keywords no conteúdo", "in_progress", "on-page"),
      task(8, "Criação das respostas para as FAQs de serviço pt 1", "in_progress", "content"),
      task(8, "Adicionar FAQ Schema nas páginas de serviço otimizadas", "pending_review", "technical"),
      task(8, "1 blog post (EN + PT)", "not_started", "content"),
      task(8, "1 post GBP", "not_started", "local"),

      // ─ Month 3 ───────────────────────────────────────────────────────────
      task(9, "Analisar keywords em posições 5-20", "in_progress", "research"),
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

      task(11, "Melhorar CTR (titles + meta descriptions)", "in_progress", "on-page"),
      task(11, "Reforçar linking interno nas páginas otimizadas", "not_started", "on-page"),
      task(11, "Audit e otimização da página do Dr. Miguel Stanley", "not_started", "on-page"),
      task(11, "1 blog post (EN + PT)", "not_started", "content"),
      task(11, "1 GBP post", "not_started", "local"),

      task(12, "Reporting trimestral", "in_progress", "research"),
      task(12, "Analisar rankings + tráfego + leads", "not_started", "research"),
      task(12, "Revisão do GPT personalizado", "not_started", "research"),
      task(12, "1 blog post (EN + PT)", "not_started", "content"),
      task(12, "1 GBP post", "not_started", "local"),
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  //  IHN  ·  Tier 2  ·  Onboarded 30/03/2026  ·  Re-start 20/04/2026
  //       ·  Currently Week 8
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "ihn",
    label: "IHN",
    onboardingDate: "2026-03-30",
    startDate: "2026-04-20",
    auditSummary:
      "IHN (Institute of Holistic Nutrition) — escola de nutrição holística com cursos online. O ciclo abriu com saneamento técnico forte (40x, redirect loops, canonical, WWW/HTTPS, duplicate content em texto + título + páginas, external links problemáticos) — Month 1 quase 100% implementado. Foco actual: (1) Conteúdo + E-E-A-T — Author Signature IHN em posts relacionados, refresh de 3 posts antigos, audit de conteúdo do blog; (2) Schema courses + organization + FAQs na homepage; (3) GBP audit + posts; (4) llms.txt + estrutura para LP Generator. Month 3 dedica-se a páginas em striking distance (5-20), backlinks, internal linking, página About IHN.",
    tasks: [
      // ─ Month 1 — all green ───────────────────────────────────────────────
      task(1, "Corrigir páginas com erros 40x", "implemented", "technical"),
      task(1, "Resolver redirect loops / redirection issues", "implemented", "technical"),
      task(1, "Corrigir canonical issues", "implemented", "technical"),
      task(1, "Corrigir redirect to broken URL", "implemented", "technical"),

      task(2, "Validar e corrigir: WWW redirect / HTTPS redirect", "implemented", "technical"),
      task(2, "Resolver identical HTML pages", "implemented", "technical"),
      task(2, "Keyword Research", "implemented", "research"),
      task(2, "Corrigir external links com erros 40x", "implemented", "technical"),
      task(2, "Reescrever e melhorar 3 posts (depois do feedback)", "implemented", "content"),

      task(3, "Resolver duplicate text blocks", "implemented", "content"),
      task(3, "Corrigir duplicate page titles", "implemented", "on-page"),
      task(3, "Corrigir duplicate content", "implemented", "content"),
      task(3, "Problematic external links", "implemented", "technical"),
      task(3, "Slow load speed pages", "in_progress", "technical"),
      task(3, "Atualizar imagens em 2 posts (pedido do cliente)", "implemented", "content"),
      task(3, "1 blog post", "implemented", "content"),

      task(4, "Organização do Blog por categorias", "implemented", "content"),
      task(4, "Criar ficheiro llms.txt", "implemented", "technical"),
      task(4, "Fixed black overlay that appeared when closing the form", "implemented", "technical"),
      task(4, "E-E-A-T Author Signature", "implemented", "on-page"),

      // ─ Month 2 — Week 8 current ──────────────────────────────────────────
      task(5, "Blog Roadmap", "pending_review", "content"),
      task(5, "Melhorar estrutura de headings", "implemented", "on-page"),
      task(5, "Limpeza do sitemap e robots.txt", "implemented", "technical"),
      task(5, "Criar meta tags em falta", "pending_review", "on-page"),
      task(5, "1 blog post", "implemented", "content"),

      task(6, "Otimizar imagens e recursos pesados", "implemented", "technical"),
      task(6, "Aplicar E-E-A-T IHN Signature nos posts relacionados", "implemented", "on-page"),
      task(6, "Audit de conteúdo do blog", "in_progress", "content"),
      task(6, "Melhorar meta tags dos posts com CTR baixo", "pending_review", "on-page"),
      task(6, "1 blog post", "implemented", "content"),
      task(6, "Report mensal Maio", "implemented", "research"),
      task(6, "Estrutura para LP Generator", "implemented", "content"),

      task(7, "Adicionar ALT text em imagens", "implemented", "technical"),
      task(7, "Otimizar imagens e recursos pesados (ronda 2)", "implemented", "technical"),
      task(7, "Adicionar internal linking nos blog posts antigos", "in_progress", "on-page"),
      task(7, "GBP audit", "implemented", "local"),

      task(8, "Research de FAQs para páginas dos cursos", "implemented", "research"),
      task(8, "Melhorar CTR (titles + meta descriptions)", "pending_review", "on-page"),
      task(8, "Criar E-E-A-T author Signature", "not_started", "on-page"),
      task(8, "Adicionar Schema courses", "implemented", "technical"),
      task(8, "Adicionar Schema organization & FAQs na homepage", "implemented", "technical"),
      task(8, "1 blog post", "implemented", "content"),

      // ─ Month 3 — all not started ─────────────────────────────────────────
      task(9, "Otimizar páginas com keywords em posições 5-20", "not_started", "on-page"),
      task(9, "Adicionar FAQs em páginas principais", "not_started", "content"),
      task(9, "Otimizar blog posts com pior desempenho", "not_started", "content"),
      task(9, "Adicionar FAQ schema nas páginas de cursos", "not_started", "technical"),
      task(9, "1 blog post", "not_started", "content"),

      task(10, "Estratégia de link building", "not_started", "off-page"),
      task(10, "Backlink audit / toxic backlinks / disavow", "not_started", "off-page"),
      task(10, "Melhorar páginas com conteúdo insuficiente", "not_started", "content"),
      task(10, "Report mensal Junho", "not_started", "research"),

      task(11, "Internal Linking", "not_started", "on-page"),
      task(11, "Prompt / AI visibility review", "not_started", "research"),
      task(11, 'Criar / optimizar página "About IHN"', "not_started", "content"),
      task(11, "1 blog post", "not_started", "content"),

      task(12, "Revisão de páginas com baixo desempenho", "not_started", "on-page"),
      task(12, "Otimizar páginas com pouco tráfego orgânico", "not_started", "on-page"),
      task(12, "Reporting trimestral", "not_started", "research"),
      task(12, "Refresh dos 3 posts mais antigos do blog", "not_started", "content"),
      task(12, "1 blog post", "not_started", "content"),
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  //  Spine Center  ·  Tier 2  ·  Onboarded 01/06/2026  ·  No reset
  //                ·  Currently Week 2
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "spine-center",
    label: "Spine Center",
    onboardingDate: "2026-06-01",
    startDate: "2026-06-01", // Onboarding IS the start — Week 2 today
    auditSummary:
      "Spine Center — clínica de coluna em arranque. Cliente novo (1ª semana com a agência foi 01/06/2026). Plano dos primeiros 4 semanas: setup foundational — Keyword Research, GBP audit, instalação de Analytics, website SEO audit, SEO roadmap completo, llms.txt, correções de erros do website audit. Trabalho de blog roadmap + planeamento de GBP posts entra a partir da Week 3.",
    tasks: [
      task(1, "Keyword research", "pending_review", "research"),
      task(1, "GBP audit", "implemented", "local"),
      task(1, "Instalar Google Analytics", "in_progress", "research"),

      task(2, "Website SEO audit", "not_started", "technical"),
      task(2, "SEO roadmap", "not_started", "research"),
      task(2, "Ficheiro LLMs.txt", "not_started", "technical"),
      task(2, "Corrigir erros — Website audit", "not_started", "technical"),

      task(3, "Blog roadmap", "pending_review", "content"),
      task(3, "Planning GBP posts", "not_started", "local"),
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  //  FisioRestelo  ·  Tier 1  ·  Onboarded 12/02/2026  ·  Re-start 20/04/2026
  //                ·  Currently Week 8
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "fisio-restelo",
    label: "FisioRestelo",
    onboardingDate: "2026-02-12",
    startDate: "2026-04-20",
    auditSummary:
      "FisioRestelo — fisioterapia em Restelo (Lisboa). Re-arranque em 20/04 com base técnica robusta: internal links broken, H1, Google Analytics, meta descriptions, low word count, orphaned pages, Image Alt Tags — Month 1 implementado. Foco actual: (1) Schema Local Business + Service; (2) GBP — feedback da Sandrina, novo planeamento, vídeos; (3) Páginas de serviço — análise de oportunidades, planeamento de novos textos, página dedicada de Escoliose; (4) Revisão AI visibility + llms.txt. Month 3: keywords em striking distance, FAQ schema, backlinks locais, citations.",
    tasks: [
      // ─ Month 1 — all green ───────────────────────────────────────────────
      task(1, "Corrigir internal links broken", "in_progress", "on-page"),
      task(1, "Corrigir páginas com missing H1 heading", "implemented", "technical"),
      task(1, "Ajustar pages with multiple H1 tags", "implemented", "technical"),
      task(1, "Instalar tag Google Analytics", "implemented", "research"),

      task(2, "Corrigir missing meta descriptions", "implemented", "on-page"),
      task(2, "Ajustar titles demasiado longos", "implemented", "on-page"),
      task(2, "Melhorar páginas com low word count", "implemented", "content"),

      task(3, "Otimizar imagens pesadas", "in_progress", "technical"),
      task(3, "Identificar low HTML Ratio Pages", "implemented", "technical"),
      task(3, "Scan and Optimize all Image Alt Tags", "implemented", "technical"),
      task(3, "Corrigir orphaned pages no sitemap", "implemented", "technical"),

      task(4, "Rever internal linking no site", "implemented", "on-page"),
      task(4, "Otimizar páginas com necessidade de conteúdo", "implemented", "content"),
      task(4, "Verificar GBP audit já feita", "implemented", "local"),

      // ─ Month 2 — Week 8 current ──────────────────────────────────────────
      task(5, "Adicionar Schema Local Business & Service", "implemented", "technical"),
      task(5, "Sugestão de descrição para GBP", "implemented", "local"),
      task(5, "Analisar feedback da Sandrina GBP posts", "implemented", "local"),
      task(5, "1 blog post", "implemented", "content"),
      task(5, "Aplicar novas meta tags", "implemented", "on-page"),
      task(5, "Aplicar texto nas páginas com pouco conteúdo", "implemented", "content"),
      task(5, "Novo planeamento GBP posts", "implemented", "local"),

      task(6, "Analisar oportunidades de páginas de serviço", "in_progress", "research"),
      task(6, "Melhorar ficheiro llms.txt", "implemented", "technical"),
      task(6, "1 GBP post", "implemented", "local"),
      task(6, "Report mensal Maio", "implemented", "research"),
      task(6, "Atualizar robot.txt", "implemented", "technical"),

      task(7, "Revisão AI visibility", "in_progress", "research"),
      task(7, "Planeamento nova página Escoliose", "implemented", "content"),
      task(7, "Planeamento otimização página testimonials", "pending_review", "content"),
      task(7, "1 blog post", "pending_review", "content"),
      task(7, "1 GBP post", "implemented", "local"),

      task(8, "Atualizar conteúdo página testemunhos", "not_started", "content"),
      task(8, "Planeamento novos textos páginas de serviços", "in_progress", "content"),
      task(8, "1 GBP post", "in_progress", "local"),

      // ─ Month 3 ───────────────────────────────────────────────────────────
      task(9, "Otimizar páginas com keywords posições 5-20", "in_progress", "on-page"),
      task(9, "Adicionar FAQ schema nas páginas de serviço", "in_progress", "technical"),
      task(9, "Melhorar CTR (titles + metas)", "in_progress", "on-page"),
      task(9, "1 blog post", "not_started", "content"),
      task(9, "1 GBP post", "not_started", "local"),

      task(10, "Backlink audit / toxic backlinks / disavow", "not_started", "off-page"),
      task(10, "Report mensal Junho", "not_started", "research"),
      task(10, "1 blog post", "not_started", "content"),
      task(10, "1 GBP post", "not_started", "local"),

      task(11, "Criar backlinks locais", "in_progress", "off-page"),
      task(11, "Revisão mensal AI visibility", "in_progress", "research"),
      task(11, "Criar citations locais", "not_started", "off-page"),

      task(12, "Reporting trimestral", "not_started", "research"),
      task(12, "Analisar rankings + tráfego + leads", "not_started", "research"),
      task(12, "1 blog post", "not_started", "content"),
      task(12, "1 GBP post", "not_started", "local"),
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  //  Monte Mar  ·  Tier 0  ·  Onboarded 23/03/2026  ·  Re-start 20/04/2026
  //             ·  Currently Week 8
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "monte-mar",
    label: "Monte Mar",
    onboardingDate: "2026-03-23",
    startDate: "2026-04-20",
    auditSummary:
      "Restaurante Monte Mar (Cascais). Tier 0 — sem keywords premium acompanhadas. Re-arranque em 20/04 com saneamento técnico (mixed content HTTP→HTTPS, duplicates de title/meta, criar metas em falta, resize images, H1, llms.txt, ALT text, redirects de duplicadas). Foco actual: (1) Local SEO forte — auditoria dos 3 GBP, schema Organization/Restaurant, hreflang multilíngue (EN+PT), corrigir 404 GSC + canonical URLs; (2) Conteúdo — integração de keywords nas páginas principais, blog roadmap + posts bilíngues; (3) Off-page Month 3 — backlinks + outreach (timeout.pt, lisboasecreta.co, ordem dos restaurantes), NAP/citações.",
    tasks: [
      // ─ Month 1 ───────────────────────────────────────────────────────────
      task(1, "Remover referências ao restaurante de Lagos", "in_progress", "content"),
      task(1, "Resolver mixed content (HTTP para HTTPS)", "implemented", "technical"),
      task(1, "Keyword Research", "implemented", "research"),

      task(2, "Corrigir duplicate title tags", "implemented", "on-page"),
      task(2, "Corrigir duplicate meta descriptions", "implemented", "on-page"),
      task(2, "Criar meta descriptions em falta", "implemented", "on-page"),
      task(2, "Resize images", "implemented", "technical"),

      task(3, "Corrigir links HTTPS que apontam para HTTP", "implemented", "technical"),
      task(3, "Adicionar H1 nas páginas em falta", "implemented", "technical"),
      task(3, "Corrigir formatting issues no llms.txt", "implemented", "technical"),

      task(4, "Blog Roadmap", "implemented", "content"),
      task(4, "Adicionar ALT text em imagens", "implemented", "technical"),
      task(4, "Corrigir páginas com H1 multiple", "implemented", "technical"),
      task(4, "Redirects para corrigir páginas duplicadas", "implemented", "technical"),

      // ─ Month 2 — Week 8 current ──────────────────────────────────────────
      task(5, "Auditoria dos 3 GBP", "in_progress", "local"),
      task(5, "Testar keywords que ativam o Local Pack", "implemented", "research"),
      task(5, "Adicionar blog ao menu principal", "implemented", "on-page"),
      task(5, "1 blog post (PT + EN)", "implemented", "content"),

      task(6, "Corrigir Orphan pages", "implemented", "technical"),
      task(6, "Schema markup Organization / Restaurant", "in_progress", "technical"),
      task(6, "Report mensal Maio", "implemented", "research"),
      task(6, "Corrigir erros 404 GSC", "implemented", "technical"),
      task(6, "Adicionar Canonical URLs do site", "in_progress", "technical"),

      task(7, "Hreflang: missing X-default", "in_progress", "technical"),
      task(7, "Integração de keywords no conteúdo", "pending_review", "on-page"),
      task(7, "Planeamento GBP posts", "pending_review", "local"),
      task(7, "1 blog post (PT + EN)", "pending_review", "content"),

      task(8, "Otimizar conteúdo das páginas principais", "pending_review", "on-page"),
      task(8, "1 blog post (PT + EN)", "pending_review", "content"),

      // ─ Month 3 ───────────────────────────────────────────────────────────
      task(9, "Otimizar páginas com keywords posições 5-20", "not_started", "on-page"),
      task(9, "Melhorar CTR (titles + meta descriptions)", "not_started", "on-page"),
      task(9, "Monitorizar rankings locais", "not_started", "research"),
      task(9, "Implementar melhorias no GBP", "not_started", "local"),
      task(9, "1 GBP post", "not_started", "local"),

      task(10, "Backlink audit / toxic backlinks / disavow", "not_started", "off-page"),
      task(10, "Auditar e corrigir citações / NAP", "not_started", "off-page"),
      task(10, "Identificar 5-10 diretórios locais prioritários", "not_started", "off-page"),
      task(10, "1 blog post", "not_started", "content"),
      task(10, "1 GBP post", "not_started", "local"),
      task(10, "Report mensal Junho", "not_started", "research"),

      task(11, "Conseguir 2-3 backlinks locais / citations", "not_started", "off-page"),
      task(11, "Outreach para timeout.pt e lisboasecreta.co", "not_started", "off-page"),
      task(11, "Submeter / corrigir listings em diretórios", "not_started", "off-page"),
      task(11, "1 blog post", "not_started", "content"),
      task(11, "1 GBP post", "not_started", "local"),

      task(12, "Reporting trimestral", "not_started", "research"),
      task(12, "Analisar rankings + tráfego + leads", "not_started", "research"),
      task(12, "Análise de visibilidade em LLMs", "not_started", "research"),
      task(12, "1 GBP post", "not_started", "local"),
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  //  CDT (Corrida do Tempo)  ·  Occasionally  ·  Onboarded 23/03/2026
  //                          ·  Re-start 20/04/2026  ·  Currently Week 8
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "cdt",
    label: "CDT (Corrida do Tempo)",
    onboardingDate: "2026-03-23",
    startDate: "2026-04-20",
    auditSummary:
      "Corrida do Tempo (CDT) — agência de viagens com versões em múltiplos idiomas (/es, /pt-BR, /fr). Engajamento ocasional. Re-arranque em 20/04 com saneamento técnico forte (domínios, duplicate content, internal links broken, erros 5XX, duplicate titles/metas, temporary redirects, canonical, ALT text, H1, sitemap.xml/robots.txt, imagens pesadas). Foco actual: (1) Internal Linking + GBP Audit + Blog Roadmap; (2) Schema LocalBusiness + Service; (3) Revisão das versões multi-idioma + eliminar blog posts duplicados/teste; (4) Melhorar CTR + GBP completo (logo, fotos). Month 3 cobre off-page (backlinks + citations locais) + reporting.",
    tasks: [
      // ─ Month 1 ───────────────────────────────────────────────────────────
      task(1, "CORRIGIR DOMÍNIOS ANTES DA OTIMIZAÇÃO TÉCNICA", "pending_review", "technical"),
      task(1, "Corrigir páginas com duplicate content issues", "implemented", "content"),
      task(1, "Corrigir internal links broken", "implemented", "on-page"),
      task(1, "Corrigir páginas com erro 5XX", "implemented", "technical"),

      task(2, "Corrigir duplicate title tags", "implemented", "on-page"),
      task(2, "Corrigir duplicate meta descriptions", "implemented", "on-page"),
      task(2, "Corrigir temporary redirects", "in_progress", "technical"),
      task(2, "Corrigir canonical URL em falta", "implemented", "technical"),

      task(3, "Adicionar ALT text às imagens", "implemented", "technical"),
      task(3, "Adicionar H1 nas páginas em falta", "in_progress", "technical"),
      task(3, "Corrigir sitemap.xml no robots.txt", "implemented", "technical"),
      task(3, "Otimizar imagens pesadas", "implemented", "technical"),

      task(4, "Blog roadmap", "implemented", "content"),
      task(4, "Keyword Research", "implemented", "research"),
      task(4, "H1 multiple", "in_progress", "technical"),

      // ─ Month 2 — Week 8 current ──────────────────────────────────────────
      task(5, "Melhorar Internal Linking", "in_progress", "on-page"),
      task(5, "GBP Audit", "implemented", "local"),
      task(5, "1 Blog post", "implemented", "content"),

      task(6, "Adicionar Schema LocalBusiness + Service", "in_progress", "technical"),
      task(6, "Planning GBP posts", "implemented", "local"),
      task(6, "Report mensal Maio", "implemented", "research"),
      task(6, "Revisão das versões de idioma (/es, /pt-BR, /fr)", "in_progress", "technical"),

      task(7, "Eliminar / ocultar blog posts duplicados e de teste", "in_progress", "content"),
      task(7, "Otimizar conteúdo já existente no blog", "implemented", "content"),
      task(7, "1 Blog post", "implemented", "content"),
      task(7, "1 GBP post", "implemented", "local"),

      task(8, "Melhorar CTR (titles + meta descriptions)", "in_progress", "on-page"),
      task(8, "Adicionar logo e fotos no GBP", "implemented", "local"),
      task(8, "1 GBP post", "implemented", "local"),

      // ─ Month 3 — all not started ─────────────────────────────────────────
      task(9, "Otimizar páginas com keywords posições 5-20", "not_started", "on-page"),
      task(9, "Melhorar conteúdo das páginas", "not_started", "content"),
      task(9, "Publicar 1 Blog post", "not_started", "content"),

      task(10, "Backlink audit / toxic backlinks / disavow", "not_started", "off-page"),
      task(10, "Report mensal Junho", "not_started", "research"),
      task(10, "1 GBP post", "not_started", "local"),

      task(11, "Criar backlinks locais", "not_started", "off-page"),
      task(11, "Criar citations locais", "not_started", "off-page"),
      task(11, "Publicar 1 Blog post", "not_started", "content"),

      task(12, "Reporting trimestral", "not_started", "research"),
      task(12, "Analisar rankings + tráfego + leads", "not_started", "research"),
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
      `  · archived existing roadmap with ${existing.tasks?.length ?? 0} tasks`,
    );
  } else {
    console.log("  · no existing roadmap on file — clean seed");
  }

  const roadmap = {
    id: `${Date.now().toString(36)}-${client.slug}-seed`,
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
  console.log(`  ✓ wrote ${KEY}`);
  console.log(`    ${roadmap.tasks.length} tasks · status mix:`, byStatus);
  console.log(
    `    startDate: ${client.startDate}  ·  onboarded: ${client.onboardingDate}`,
  );
}

async function main() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    console.error(
      "Missing KV_REST_API_URL / KV_REST_API_TOKEN — run with `node --env-file=.env.local …`",
    );
    process.exit(1);
  }
  for (const client of CLIENTS) {
    console.log(`\n══ ${client.label}  (${client.slug}) ══`);
    await seedClient(client);
  }
  console.log("\n✓ all done");
}

main().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
