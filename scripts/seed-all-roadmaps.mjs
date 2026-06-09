// One-off seed for the 5 remaining SEO clients (HDS Learning, Mimus,
// InSync, Sea Yourself, Wonder Ads). Mirrors the B-life seed pattern:
//
//   • Tasks + statuses transcribed from Andre's FigJam screenshots
//     (2026-06-09).
//   • Status colour → workspace status:
//        GRAY    → "not_started"
//        YELLOW  → "in_progress"
//        VIOLET  → "pending_review"
//        GREEN   → "implemented"
//     Salmon/red FigJam boxes that don't match the canonical legend
//     are mapped to `pending_review` (closest in feel to a "stuck"
//     state) — Andre can hand-correct on the board if any are off.
//   • startDate is computed so the consultant's current FigJam week
//     lands on the right column today (2026-06-09 Tue). Math:
//        Week 5 → startDate = 2026-05-11 (Mon, 4w ago)
//        Week 6 → startDate = 2026-05-04 (Mon, 5w ago)
//   • onboardingDate is preserved from each client's FigJam Starting-
//     date sticky note (the historical engagement date, distinct from
//     the per-cycle startDate).
//
// Run from the repo root with the local .env.local loaded:
//
//   node --env-file=.env.local scripts/seed-all-roadmaps.mjs

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
    order: 0, // back-filled per-week below
    statusChangedAt: NOW,
    createdAt: NOW,
  };
}

// Helper: set sequential .order inside each week so the column renders
// in the same top-down sequence we wrote the array in.
function withOrders(tasks) {
  const byWeek = new Map();
  return tasks.map((t) => {
    const next = (byWeek.get(t.week) ?? -1) + 1;
    byWeek.set(t.week, next);
    return { ...t, order: next };
  });
}

// ============================================================================
//  CLIENTS
// ============================================================================

const CLIENTS = [
  // ──────────────────────────────────────────────────────────────────────────
  //  HDS Learning  ·  Tier 2  ·  Onboarded 07/01/2026  ·  Currently Week 5
  //                  (FigJam Month 2 peach tag positioned at Week 5 start)
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "hds-learning",
    label: "HDS Learning",
    onboardingDate: "2026-01-07",
    startDate: "2026-05-11", // Mon — puts the consultant on Week 5 today
    auditSummary:
      "HDS Learning é uma consultora de Experiential Learning B2B com sede em Dubai e expansão para KSA. O roadmap Q2/Q3 ataca em paralelo: (1) Técnico — WebP, robots/llm.txt, saneamento de 74 URLs Rastreadas/não-indexadas, fix de 404s, schema Service/Course; (2) E-E-A-T — páginas de autor (Ana Sofia + consultores), Experience Anchors em produto, case study Papa Johns; (3) Content — pillar pages 'Corporate Team Building in Dubai' + 'Leadership Development', blog quinzenal alinhado a queries de decisão; (4) GMB — atualização de perfil Dubai, FAQ local, prova social, expansão KSA (Riyadh/Jeddah).",
    tasks: [
      // ─ Month 1 — mostly green, blog series ongoing ───────────────────────
      task(1, "[Técnico] Otimização de imagens: converter ativos para WebP", "implemented", "technical"),
      task(1, '[Blog] Artigo: "O que é Experiential Learning e como ele acelera a aprendizagem"', "in_progress", "content"),
      task(1, "[GMB] Atualização de perfil: otimizar descrição da unidade Dubai", "pending_review", "local"),
      task(1, "[Estratégia] Audit de intenção no GSC para a página Gold of the Desert", "implemented", "research"),
      task(1, "[Técnico] Robots.txt", "implemented", "technical"),
      task(1, "[Técnico] LLM.txt", "implemented", "technical"),
      task(1, "[Técnico] Atualização de plugins no WordPress", "implemented", "technical"),
      task(1, "[Técnico] Ajuste das URLs com data e automação para que não se repita", "implemented", "technical"),

      task(2, "[E-E-A-T] Criação das páginas de autor (Ana Sofia + consultores)", "implemented", "on-page"),
      task(2, '[Blog] Artigo: "5 tendências de treinamento de equipa para 2026"', "in_progress", "content"),
      task(2, "[GMB] Post de engajamento: foto de workshop real com equipa cliente", "pending_review", "local"),
      task(2, "[Técnico] JS cleanup: adiar scripts de terceiros que travam a renderização", "implemented", "technical"),

      task(3, '[Técnico] Saneamento de indexação: resolver as 74 URLs "Rastreadas, não indexadas"', "implemented", "technical"),
      task(3, '[Blog] Artigo: "ROI em Treinamento Corporativo: como medir o impacto"', "in_progress", "content"),
      task(3, "[GMB] Atualização de serviços: listar cada jogo (Windjammer, etc.) como serviço", "pending_review", "local"),
      task(3, '[E-E-A-T] Inserção de "Experience Anchors" (fotos e métricas reais) nas páginas de produto', "implemented", "on-page"),

      task(4, "[GEO] Pirâmide invertida: reescrever introdução da página Gold of the Desert", "implemented", "on-page"),
      task(4, '[Blog] Artigo: "Soft Skills vs. IA: por que as habilidades humanas são insubstituíveis"', "in_progress", "content"),
      task(4, "[GMB] FAQ local: inserir e responder 3 perguntas frequentes sobre Dubai", "implemented", "local"),
      task(4, "[Técnico] Fix de erros 404: redirecionar URLs quebradas para as canónicas", "implemented", "technical"),

      // ─ Month 2 — Week 5 is the active week (peach tag) ───────────────────
      task(5, '[Conteúdo] Draft da Pillar Page: "Corporate Team Building in Dubai: The Definitive Guide"', "pending_review", "content"),
      task(5, '[Blog] Artigo: "Vision 2030 e o desenvolvimento de lideranças na Arábia Saudita"', "pending_review", "content"),
      task(5, "[GMB] Post de oferta: teaser para agendamento de sessões", "pending_review", "local"),
      task(5, "[Técnico] Implementação de Schema de Service e Course", "implemented", "technical"),

      task(6, "[Técnico] Implementação de Schema de Service e Course (KSA scope)", "implemented", "technical"),
      task(6, '[Blog] Deep Dive: "Rattlesnake Canyon: lições de negociação e estratégia"', "pending_review", "content"),
      task(6, "[GMB] Prova social: postar depoimento de cliente (ex.: Papa Johns)", "pending_review", "local"),
      task(6, '[Conteúdo] Inserção de "Video Companion" na primeira página da Pillar', "not_started", "content"),

      task(7, "[Técnico] Configuração de conversão GA4: rastrear cliques em botões de contacto", "not_started", "technical"),
      task(7, '[Blog] Artigo: "Eventos corporativos em Abu Dhabi: como escolher a sede certa"', "pending_review", "content"),
      task(7, "[GMB] Update visual: subir 5 novas fotos nítidas da equipa em sessão", "pending_review", "local"),
      task(7, "[Conteúdo] Otimização de snippets: transformar parágrafos em listas <ul>", "not_started", "content"),

      task(8, "[Off-Page] Auditoria de backlinks e identificação de oportunidades de outreach", "pending_review", "off-page"),
      task(8, '[Blog] Artigo: "Experiential Learning vs. Workshops Tradicionais: diferenças"', "pending_review", "content"),
      task(8, '[GMB] Post informativo: "Por que a HDS Learning escolheu Dubai como sede"', "pending_review", "local"),
      task(8, "[Estratégia] Relatório de fechamento Q2: comparação de posições antes/depois", "not_started", "research"),

      // ─ Month 3 — all not started ─────────────────────────────────────────
      task(9, '[Conteúdo] Lançamento da Pillar Page: "Leadership Development in the GCC"', "not_started", "content"),
      task(9, '[Blog] Artigo: "O futuro da gestão em Riyadh: desenvolvendo líderes para Vision 2030"', "not_started", "content"),
      task(9, "[GMB] Otimização KSA: atualizar áreas de serviço para incluir Riyadh e Jeddah", "not_started", "local"),
      task(9, "[Técnico] Implementação de Local Business Schema focado no mercado KSA", "not_started", "technical"),

      task(10, "[Estratégia] Competitor Content Gap: analisar termos que concorrentes rankeiam e nós não", "not_started", "research"),
      task(10, '[Blog] Artigo: "Treinamento Experiencial em Jeddah: estudo de caso prático"', "not_started", "content"),
      task(10, '[GMB] Post de relevância local: "HDS Learning agora atendendo Riyadh"', "not_started", "local"),
      task(10, "[Técnico] Verificação de velocidade: garantir que o LCP se mantém abaixo de 2.5s", "not_started", "technical"),

      task(11, '[E-E-A-T] Publicação do case study completo: "Caso Papa Johns: ROI documentado"', "not_started", "on-page"),
      task(11, '[Blog] Artigo: "Como jogos de negócios podem integrar equipes remotas"', "not_started", "content"),
      task(11, "[GMB] Post de autoridade: vídeo curto da Ana Sofia Domingues a apresentar a empresa", "not_started", "local"),
      task(11, "[Técnico] Transcrição de vídeos: adicionar texto otimizado para SEO", "not_started", "technical"),

      task(12, "[Técnico] Implementação de Review Schema: marcação de estrelas nas páginas de produto", "not_started", "technical"),
      task(12, '[Blog] Artigo: "Nuances culturais: adaptando treinamentos de soft skills ao GCC"', "not_started", "content"),
      task(12, '[GMB] Post de evento: anunciar "Live Demo" ou próximo evento corporativo', "not_started", "local"),
      task(12, "[Estratégia] Interlinking KSA: criar fluxo de links dos blogs informativos para Pillars", "not_started", "research"),
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  //  Clínica Mimus  ·  Onboarded 04/05/2026  ·  Currently Week 6
  //                   (Onboarded Mon = no reset needed; week 6 = natural)
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "clinica-mimus",
    label: "Clínica Mimus",
    onboardingDate: "2026-05-04",
    startDate: "2026-05-04", // No reset — onboarding Mon IS the roadmap start
    auditSummary:
      "Clínica dentária Mimus (Portugal) em arranque SEO. Q2/Q3 ataca: (1) Técnico — slugs em PT, sitemap/robots, Yoast, llm.txt, schema MedicalBusiness + Dentist, redirects, LCP, WebP; (2) Conteúdo + AEO — Refresh dos perfis dos clínicos (E-E-A-T), AEO Pyramid framework, FAQ Schema nas páginas de tratamento, blog roadmap (Alinhadores, Harmonização, Cheque Dentista, Odontopediatria); (3) GMB — fotos + serviços + descrição, post semanal, Q&A; (4) Off-page — submissão a directórios de saúde portugueses (3 fases) + Ordem dos Médicos Dentistas.",
    tasks: [
      // ─ Month 1 — heavy violet (most work done, awaiting client review) ───
      task(1, "Localização de slugs e redirecionamento (Técnica): traduzir URLs para PT", "pending_review", "technical"),
      task(1, "Saneamento de directivas de rastreio (Técnica): atualizar o robots.txt", "pending_review", "technical"),
      task(1, "Consolidação de protocolo e canonical (Técnica): unificar HTTP/HTTPS + www", "pending_review", "technical"),
      task(1, "Atualização e instalação de plugins no WordPress", "implemented", "technical"),
      task(1, "Implementação do Yoast SEO e ajustes (logo, nome do site, etc.)", "implemented", "technical"),
      task(1, "Robots.txt — análise e correção. Implementado e validado", "implemented", "technical"),
      task(1, "Implementação de llm.txt", "implemented", "technical"),

      task(2, "Arquitetura de Dados Estruturados da Equipa (Técnica): implementar Person schema", "pending_review", "technical"),
      task(2, "Refresh de autoridade nos perfis clínicos (Conteúdo): atualizar as bios", "pending_review", "content"),
      task(2, "Ancoragem de prova social (Conteúdo): transpor os depoimentos do site antigo", "pending_review", "content"),
      task(2, "Configuração do GSC", "implemented", "technical"),
      task(2, "Solução para sitemaps antigos", "implemented", "technical"),

      task(3, "Otimização semântica de headings (Conteúdo): reestruturar a hierarquia H1-H3", "implemented", "content"),
      task(3, "Implementação do Framework AEO Pyramid (Conteúdo): introduzir blocos AEO", "pending_review", "content"),
      task(3, "Refino de Click-Through Rate — CTR (Pesquisa): atualizar as Meta Descriptions", "pending_review", "research"),

      task(4, "Refresh de conteúdo de alta margem (Conteúdo): injetar dados primários e estudos", "pending_review", "content"),
      task(4, "Auditoria de versão e UX (Pesquisa): validar a integridade técnica dos templates", "pending_review", "research"),
      task(4, "Configuração de monitorização de KPIs (Pesquisa): estabelecer o painel base", "implemented", "research"),

      // ─ Month 2 — Week 6 is current (peach tag at top of Month 2) ─────────
      task(5, "Schema Markup — MedicalBusiness + Dentist", "implemented", "technical"),
      task(5, "Optimização GBP — fotos, serviços e descrição", "pending_review", "local"),
      task(5, "Submissão a directórios de saúde portugueses — 1ª fase", "implemented", "off-page"),
      task(5, "Blog Roadmap", "pending_review", "content"),

      task(6, "Optimização de meta titles e meta descriptions de todas as páginas", "pending_review", "on-page"),
      task(6, "CTA nas páginas de tratamento existentes: adicionar bloco de conversão", "pending_review", "on-page"),
      task(6, "Instalação de botão WhatsApp flutuante (Plugin WP Social Chat)", "pending_review", "technical"),

      task(7, "Optimização de Title Tags e Meta Descriptions — reescrever titles e metas restantes", "not_started", "on-page"),
      task(7, "Optimização da página de Cheque Dentista — criar ou melhorar secção", "not_started", "content"),

      task(8, "Blog post — Odontopediatria (página orientada para pais)", "not_started", "content"),
      task(8, "Report mensal de KPIs — Junho", "not_started", "research"),

      // ─ Month 3 — all not started ─────────────────────────────────────────
      task(9, 'Criação de conteúdo — Blog post: "Quanto custa um implante dentário em Portugal"', "not_started", "content"),
      task(9, "Implementação de FAQ Schema nas páginas de tratamento", "not_started", "technical"),

      task(10, 'Criação de conteúdo — Blog post: "Alinhadores invisíveis vs. aparelho metálico"', "not_started", "content"),
      task(10, "Criação de página dedicada — Seguros de Saúde", "not_started", "content"),
      task(10, "Submissão a directórios — 3ª fase (Registo na Ordem dos Médicos Dentistas)", "not_started", "off-page"),

      task(11, 'Criação de conteúdo — Blog post: "Harmonização facial — dúvidas frequentes"', "not_started", "content"),
      task(11, "GBP — post semanal + activação de perguntas e respostas", "not_started", "local"),
      task(11, "Remover viewport maximum-scale=1 (corrigir restrição de zoom)", "not_started", "technical"),

      task(12, "Auditoria técnica completa — mid-quarter (crawlability, erros)", "not_started", "technical"),
      task(12, "Optimização de imagens — conversão para WebP", "not_started", "technical"),
      task(12, "Report mensal de KPIs — Julho", "not_started", "research"),
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  //  InSync Design  ·  Tier 0  ·  Onboarded 23/01/2026  ·  Currently Week 5
  //                   (FigJam Month 2 peach tag at Week 5 start)
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "insync-design",
    label: "InSync Design",
    onboardingDate: "2026-01-23",
    startDate: "2026-05-11", // Mon — puts current week on Week 5
    auditSummary:
      "InSync Design (Austrália, e-commerce de joalharia em aço cirúrgico 316L). Tier 0 — sem keywords premium. Foco do ciclo actual: (1) Técnico crítico — debug de 741 erros de renderização JS para bots, reintegração de 495 páginas órfãs, sitemap + robots.txt, llms.txt; (2) Conteúdo / AEO — AEO Pyramid aplicada às coleções principais (Earrings & Necklaces) e top-10 produtos; (3) E-E-A-T — Schema de Autor (JSON-LD) + biografias técnicas; (4) Content satelite — blog técnico de materiais + estudos de caso de uso ('InSync in Architecture'). Projecto AI SEO R. arrancou 23/03/2026 em paralelo.",
    tasks: [
      // ─ Month 1 — mostly pending review + 1 done ─────────────────────────
      task(1, "[Técnica] Debug de JavaScript crítico — identificar e corrigir os 741 erros de renderização para bots", "pending_review", "technical"),
      task(1, "[GMB] Post de actualização de marca", "pending_review", "local"),

      task(2, "[GMB] Post de actualização de marca (segunda ronda)", "pending_review", "local"),
      task(2, "[Técnica] Mapeamento e reintegração das 495 páginas órfãs à arquitectura", "pending_review", "technical"),

      task(3, "New blog roadmap", "implemented", "content"),
      task(3, "[Conteúdo] AEO Pyramid aplicada às colecções principais (Earrings & Necklaces)", "pending_review", "content"),

      task(4, '[Blog] Satellite post: "How to style industrial earrings" (foco em uso casual)', "pending_review", "content"),
      task(4, "[Técnica] Higienização de Sitemaps e Robots.txt (validação do acesso para crawlers)", "pending_review", "technical"),

      // ─ Month 2 — Week 5 active, all not_started in FigJam ────────────────
      task(5, "[Blog] Post de bastidores (processo de criação) — sinais de experiência", "not_started", "content"),
      task(5, "[E-E-A-T] Implementação de Schema de Autor (JSON-LD) e biografias técnicas", "not_started", "on-page"),

      task(6, '[Blog] Guia técnico de materiais: "316L Stainless Steel vs. traditional alloys"', "not_started", "content"),
      task(6, "[Técnica] Implementação dos ficheiros llms.txt e llms-full.txt no directório raiz", "not_started", "technical"),

      task(7, "[GMB] Update de catálogo no Google Business Profile com fotos de alta resolução", "not_started", "local"),
      task(7, "[Conteúdo] AEO Pyramid aplicada aos 10 produtos com maior volume de busca", "not_started", "content"),

      task(8, '[Blog] Estudo de caso: "InSync in Architecture — the geometric collection"', "not_started", "content"),
      task(8, "[Técnica] Auditoria de Core Web Vitals (foco em INP e LCP nas páginas de produto)", "not_started", "technical"),
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  //  Sea Yourself  ·  Onboarded 14/01/2026  ·  Currently Week 6
  //                  (Month 2 has the active mix; Weeks 7-8 all gray)
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "sea-yourself",
    label: "Sea Yourself",
    onboardingDate: "2026-01-14",
    startDate: "2026-05-04", // Mon — puts current week on Week 6
    auditSummary:
      "Sea Yourself — psicóloga clínica em Nazaré com foco em saúde mental, terapia online para portugueses no exterior, e regulação emocional. Q2/Q3 ataca: (1) Técnico — GSC/GA4 validation, Schema MedicalBusiness, LCP na Home, acessibilidade Alt-text, links órfãos; (2) E-E-A-T — bios ricas + Schema de autor + Meta-tags de autor para Rita, referências científicas externas; (3) Conteúdo — série de blogs sobre emoção/cognição (Tristeza vs. Depressão Clínica, Ansiedade vs. Performance, Sistema Nervoso); (4) GMB — Boas-vindas + FAQ Local + Sigilo + Saúde Mental adolescente. AEO Pyramid começou a ser aplicada na Week 3.",
    tasks: [
      // ─ Month 1 — mostly green + violet ───────────────────────────────────
      task(1, "Técnica: Audit do GSC e GA4 (validação de indexação e eventos)", "implemented", "technical"),
      task(1, "Blog: correção dos textos pendentes", "implemented", "content"),
      task(1, 'GMB: Post de boas-vindas focando em "Psicologia Clínica na Nazaré" (entity)', "pending_review", "local"),
      task(1, "Conteúdo: revisão técnica de SEO (H1-H3, Meta Tags) e postagem", "implemented", "content"),

      task(2, 'E-E-A-T: estruturação da página "Sobre" com biografias ricas em sinais', "pending_review", "on-page"),
      task(2, "Conteúdo: revisão e postagem dos conteúdos da semana", "implemented", "content"),
      task(2, "Blog: Texto 10.1 e 10.2", "implemented", "content"),

      task(3, "Técnica: implementação de Schema Markup MedicalBusiness", "implemented", "technical"),
      task(3, 'GMB: FAQ Local — "Como funciona o reembolso de seguros de saúde em terapia"', "pending_review", "local"),
      task(3, 'Blog: "Contorno emocional vs. compulsão: onde traçamos a linha?" (AEO)', "pending_review", "content"),
      task(3, "Técnica: otimização de LCP na Home para reduzir a taxa de rejeição", "implemented", "technical"),
      task(3, "Conteúdo: revisão final e postagem", "implemented", "content"),

      task(4, "E-E-A-T: inserção de referências científicas (links externos para estudos)", "implemented", "on-page"),
      task(4, 'Blog: "Terapia na Nazaré — o impacto do ambiente físico na regulação emocional"', "pending_review", "content"),
      task(4, "GMB: post informativo sobre sigilo ético e proteção de dados em terapia", "pending_review", "local"),
      task(4, "Conteúdo: revisão e postagem", "implemented", "content"),

      // ─ Month 2 — Week 6 is current ───────────────────────────────────────
      task(5, "Técnica: validação do arquivo llms.txt na raiz do site para crawlers AI", "pending_review", "technical"),
      task(5, 'Blog: "Ansiedade e performance — quando o stress deixa de ser útil"', "pending_review", "content"),
      task(5, "Conteúdo: revisão e postagem", "implemented", "content"),

      task(6, "Técnica: auditoria de acessibilidade (Alt-text)", "implemented", "technical"),
      task(6, 'Blog: "A diferença entre tristeza e depressão clínica" (estrutura em AEO)', "pending_review", "content"),
      task(6, 'GMB: post sobre "Saúde mental na infância e adolescência: como a Sea Yourself trabalha"', "pending_review", "local"),
      task(6, "E-E-A-T: atualização de Bio nas Meta-tags de autor do blog para Rita", "pending_review", "on-page"),
      task(6, "Técnica: correção de links internos órfãos", "implemented", "technical"),
      task(6, "Conteúdo: revisão e postagem", "pending_review", "content"),

      task(7, "Técnica: identificar termos em Striking Distance (posições 11-20)", "not_started", "research"),
      task(7, 'Blog: "Saúde mental para portugueses no exterior: o papel da terapia online"', "not_started", "content"),
      task(7, 'GMB: FAQ — "Posso fazer terapia online de qualquer país?"', "not_started", "local"),
      task(7, "Conteúdo: revisão e postagem", "not_started", "content"),
      task(7, "Optimização de performance — compressão de imagens", "pending_review", "technical"),

      task(8, 'Blog: "Regulação do sistema nervoso — ferramentas práticas"', "not_started", "content"),
      task(8, 'GMB: post focado em "Ambiente seguro e acolhedor na Nazaré"', "not_started", "local"),
      task(8, "Conteúdo: revisão e postagem", "not_started", "content"),
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  //  Wonder Ads  ·  Tier 2  ·  Onboarded 30/03/2026  ·  Currently Week 5
  //               (FigJam teal "Wonder Ads" tag at top of Month 2)
  // ──────────────────────────────────────────────────────────────────────────
  {
    slug: "wonderads",
    label: "Wonder Ads",
    onboardingDate: "2026-03-30",
    startDate: "2026-05-11", // Mon — puts current week on Week 5
    auditSummary:
      "Wonder Ads — Agência de SEO pharma/clínicas YMYL em Lisboa. Tier 2. Q2/Q3 ataca: (1) Técnico — head cleanup em 50 páginas, noindex removal de Pillar Pages, robots.txt + sitemaps, fetchpriority LCP, INP, Schema V30 Granular, llms-full.txt, Speakable; (2) E-E-A-T — bios de Alice + Alex Santos, Experience Anchors no blog, página Sobre Nós com transparência; (3) Conteúdo / GEO — Pillar /seo-agencia-lisboa, artigo GEO 'SEO para Academias', Refresh de 5 artigos thin, Guia 'Marketing para Clínicas YMYL'; (4) GMB — NAP consistency, agendamento semanal, avaliações de alto perfil, FAQ Page schema, chat directo no GBP, posts mensais.",
    tasks: [
      // ─ Month 1 ───────────────────────────────────────────────────────────
      task(1, "Técnico: correção manual do <head> em 50 páginas (remover <img> e tags inválidas)", "not_started", "technical"),
      task(1, "Técnico: remoção de directivas noindex das Pillar Pages comerciais", "implemented", "technical"),
      task(1, "Técnico: revisão de robots e sitemaps", "implemented", "technical"),

      task(2, "Conteúdo: otimização da URL /seo-agencia-lisboa/ (38k impressões, 0.06% CTR)", "not_started", "content"),
      task(2, "Técnico: configuração de robots.txt para permitir OAI-SearchBot", "implemented", "technical"),
      task(2, "GMB: auditoria de consistência de NAP (Nome, Endereço, Telefone)", "implemented", "local"),

      task(3, "E-E-A-T: criação de infraestrutura de Bios para Alice e Alex Santos", "pending_review", "on-page"),
      task(3, "GMB: configuração de agendamento de postagens semanais", "not_started", "local"),
      task(3, 'Técnico: implementação de fetchpriority="high" no elemento LCP', "implemented", "technical"),
      task(3, 'Técnico: correção de textos âncora genéricos (ex.: "click here")', "in_progress", "technical"),
      task(3, "GMB: solicitação de 3 novas avaliações a clientes de alto perfil", "pending_review", "local"),

      task(4, 'Conteúdo: produção de artigo GEO — "SEO para Academias em 2026"', "pending_review", "content"),
      task(4, "Técnico: compressão massiva de imagens para formato AVIF", "not_started", "technical"),
      task(4, 'E-E-A-T: injeção de "Experience Anchors" no blog (dados primários)', "not_started", "on-page"),
      task(4, "GMB: postagem", "implemented", "local"),

      // ─ Month 2 — Week 5 active, all not_started in FigJam ────────────────
      task(5, "Técnico: otimização de INP — identificar e fragmentar as 20 Long Tasks", "not_started", "technical"),
      task(5, "Técnico: implementação de Schema V30.0 Granular (Organization + Person)", "not_started", "technical"),
      task(5, "Correção do sitemap", "not_started", "technical"),

      task(6, "Conteúdo: atualização de 5 artigos antigos (Thin Content) injetando dados", "not_started", "content"),
      task(6, "GMB: ativação de marcação de produtos/serviços", "not_started", "local"),
      task(6, "Técnico: correção de cadeias de redirecionamento 301", "not_started", "technical"),

      task(7, "GMB: responder a todas as avaliações pendentes usando termos técnicos", "not_started", "local"),
      task(7, "Técnico: implementação de Schema FAQPage na URL de serviços", "not_started", "technical"),
      task(7, 'E-E-A-T: atualização da página "Sobre Nós" com políticas de transparência', "not_started", "on-page"),
      task(7, "Técnico: validação de segurança HTTPS/HSTS para elevar o Trust Score", "not_started", "technical"),

      task(8, 'Conteúdo: produção de estudo de caso GEO-Ready: "Como escalámos"', "not_started", "content"),
      task(8, "GMB: publicação de vídeo curto (15s) no Perfil da Empresa sobre processos", "not_started", "local"),
      task(8, "Técnico: limpeza de URLs repetitivas detectadas no Screaming Frog", "not_started", "technical"),

      // ─ Month 3 — all not started ─────────────────────────────────────────
      task(9, "Técnico: implementação de Schema Speakable e Actions para otimização de voice search", "not_started", "technical"),
      task(9, "Técnico: auditoria de Crawl Budget (configurar parâmetros de URL no GSC)", "not_started", "technical"),

      task(10, 'Conteúdo: otimização para "pharma seo agency" (pos. 23.94)', "not_started", "content"),
      task(10, "E-E-A-T: obter uma menção de marca em publicação de autoridade do nicho", "not_started", "off-page"),
      task(10, 'GMB: oferta especial de "Auditoria SEO Gratuita" listada como evento no GBP', "not_started", "local"),

      task(11, "Técnico: verificação final de acessibilidade mobile (dimensões de cliques e fontes)", "not_started", "technical"),
      task(11, "GMB: adição de 10 fotos originais do escritório/equipa", "not_started", "local"),
      task(11, "Técnico: implementação de llms-full.txt para indexar subdiretórios", "not_started", "technical"),
      task(11, "GMB: ativação do chat directo no GBP para reduzir a fricção", "not_started", "local"),
      task(11, 'Técnico: monitorização do "Share of Voice" em AI Overviews', "not_started", "technical"),

      task(12, 'Conteúdo: produção de guia — "Marketing para Clínicas YMYL"', "not_started", "content"),
      task(12, "Técnico: auditoria de Core Web Vitals de fechamento de ciclo", "not_started", "technical"),
      task(12, "Estratégia: geração de relatório de ROI correlacionando a queda de CAC", "not_started", "research"),
    ],
  },
];

// ============================================================================
//  WRITE
// ============================================================================

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
