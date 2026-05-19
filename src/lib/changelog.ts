// Workspace changelog — every version, newest first.
// When bumping the footer `workspace.v#`, prepend a new entry at the TOP of
// the CHANGELOG array (the page renders in order, so position 0 = latest).

export type ChangelogEntry = {
  /** Number or "68.1" string. While polishing SEO Audit we use minor
   *  versions (68.1, 68.2, …) instead of bumping the major. */
  version: number | string;
  date: string; // ISO YYYY-MM-DD
  title: string;
  highlights: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "70.1",
    date: "2026-05-19",
    title: "Workable 12-week SEO Roadmap board per client (with AI generation + live current-week marker)",
    highlights: [
      "**🗺️ New roadmap board at `/seo/[slug]/roadmap`.** 3 months × 4 weeks = 12 columns laid out exactly like the screenshot. Each column shows tasks as cards. Status-coloured backgrounds: ⚪ Not started, 🔵 In progress (sky), 🟠 Pending client review (amber), 🟢 Implemented (emerald). Each card carries a pillar chip (Technical / On-Page / Off-Page / Local / Content / Research).",
      "**📍 Live current-week marker.** The roadmap stores a `startDate` (Monday of week 1). The board computes `currentWeekIndex` from `Date.now()` and highlights that column with a purple ring + a `▶ Week N of 12` badge in the top bar — so consultants always know exactly where they should be. Editable start date inline; the highlight slides instantly.",
      "**🎯 Full edit in the app.** Click any card → inline form with title, description, status, pillar, and week-move dropdown. Add task per week column. Delete task. All edits auto-save 600ms after the last keystroke via PUT `/api/roadmaps/[slug]` — no Save button to click.",
      "**🤖 AI generation grounded in everything we know.** New POST `/api/roadmaps/[slug]/generate` asks Claude for strict JSON (12 weeks × 4–7 tasks each), grounded in: client brief Do's/Don'ts/Notes, onboarding form extracted text, 15 most-recent action history entries across every action, top 20 target keywords by volume, and the previous roadmap if there is one (so it doesn't re-propose already-shipped work). Old roadmap auto-archives (kept in KV for audit).",
      "**🚨 Warnings banner — dismissable.** Three triggers, computed server-side on every read: (a) any task pending client review for ≥ 7 days, (b) ≥ 2 tasks from past weeks still not implemented (escalates to critical at 5+), (c) the current week is empty or has nothing in flight. Each warning has a stable id; consultants dismiss with X, dismissal persists on the roadmap.",
      "**📌 Client-page header strip.** The old typewriter `What are we working on now, boss?` prompt is replaced with a live roadmap strip: `Week N of 12 · X tasks · Y in flight · Z pending review` + chips for the first 3 current-week tasks (status dots colour-coded) + link straight to the board. When no roadmap exists, falls back to a `No roadmap yet — generate a 12-week plan` CTA.",
      "**🧱 Plumbing for follow-ups.** New `src/lib/roadmap-store.ts` (Roadmap + RoadmapTask types, KV CRUD, archive, currentWeekIndex, weekStartDate, computeWarnings, normaliseRoadmap). Distinct from the `client-roadmap` markdown action shipped in v70.0 — that's the deliverable, this is the operational view. Both stay in the app.",
    ],
  },
  {
    version: "70.0",
    date: "2026-05-19",
    title: "Monthly Report + Client SEO Roadmap actions under Overall SEO",
    highlights: [
      "**📊 Monthly Report action.** New `/seo/[slug]/actions/monthly-report` action under Overall SEO. Fields: reporting period (28d / last full month / quarter), highlights to spotlight, next-month focus. Grounding pack pulls **recent action history across every SEO action for the client** (last 15 entries — audits, KW research, content, GMB work) so Claude writes from what was actually done, not generic templates. Output: client-facing markdown in EN/PT-PT depending on the brief, with sections for `Resumo do mês`, `O que se fez`, `O que mexeu`, `Foco do próximo período`, `Pedidos ao cliente`. PDF + DOCX exports via the same pipeline the other actions use.",
      "**🗺️ Client SEO Roadmap action.** New `/seo/[slug]/actions/client-roadmap` action under Overall SEO. Fields: horizon (3/6/12 months), strategic focus, constraints (blackouts, bandwidth, budget). Grounds in **recent action history + target keyword shortlist + onboarding form** so the roadmap doesn't propose work that's already shipped. Output: thesis → quarter-by-quarter milestone tables (initiative · pilar · esforço · métrica · responsável) → risks → 4-week quick wins → reading metrics → validation asks. Generate-then-edit workflow: consultant downloads DOCX, tweaks language, sends.",
      "**🧩 Cross-action history aggregator.** New `listRecentHistoryAcrossActions(clientSlug, slugs, limit)` walks every action slug's KV bucket and returns the N most-recent entries sorted newest-first. Used by both new actions; opens the door for future synthesis-driven actions that need to know everything that's been done on an account.",
      "**📝 Prompt specs added to `seo-claude-prompt.ts`.** Per-action output spec for both new actions follows the same template the other Overall-SEO actions use — explicit sections, structured tables, hard rules around honesty, brief compliance, language match (PT-PT when client materials are Portuguese), no fabricated metrics. Roadmap explicitly checks the history pack so it never re-proposes work already in flight.",
    ],
  },
  {
    version: "69.9",
    date: "2026-05-19",
    title: "Deliverables: consultant emails, no leaked timestamps, DOCX export, 3-layer KW enrichment",
    highlights: [
      "**📧 Consultant email replaces seo@wonder-ads.com on every deliverable.** PDF cover line + running footer + DOCX cover now pull from `getConsultantEmailForSlug(slug)` — Luana's clients → `luana@`, Fran's → `fran@`, Yenisey's → `yeni@`. Unassigned slugs still fall back to the shared inbox. Replies land in the inbox of the person actually managing the project.",
      "**🕒 Generated-date no longer leaks the minute the run kicked off.** Result-page header shows date only (`DD/MM/YYYY`) instead of `DD/MM/YYYY HH:mm`. PDF cover's Report ID drops the `HHMM` block — what was `2026-05-19-1610-ab` displays as `2026-05-19-ab`. Same on the action's history grid. The full id with `HHMM` is preserved in URLs + storage so existing bookmarks still work.",
      "**🎯 Three-layer KW enrichment — every keyword now arrives with vol/mo AND KD.** Stage 5 now runs `keyword_overview/live` → `bulk_keyword_difficulty/live` → `keywords_data/google_ads/search_volume/live` in sequence, hitting each only for rows still missing the field. Stage 6 then copies values between accent/plural variants inside the same pack so duplicates can't disagree (e.g. `clínica ermesinde` and `clinica ermesinde` end up with the same vol + KD). Save route uses the same comprehensive enricher for AI-cluster keywords. KD=0 is treated as missing throughout.",
      "**📝 Download DOCX next to Download PDF on every action result.** New `/api/seo-actions/[slug]/[action]/results/[id]/docx` route renders the same markdown analysis Claude produced into a Word document with a branded cover page (logo wordmark, dept, title, client, audited date, head consultant, consultant email, report id). Built with the `docx` npm package; markdown → DOCX conversion walks the mdast tree from `remark-parse` + `remark-gfm` so headings, lists, tables, bold/italic, links, blockquotes, code blocks all survive. Consultants can now tweak wording before sending without retyping the report.",
    ],
  },
  {
    version: "69.8",
    date: "2026-05-18",
    title: "KR polish: real KD, no CPC, dedup near-identical variants, monthly header + chooser typewriter",
    highlights: [
      "**🎯 Real Keyword Difficulty everywhere.** The per-seed `keyword_suggestions` / `keyword_ideas` Labs endpoints return KD=0 for most low-volume locale keywords (DataforSEO doesn't compute KD on every row). New bulk `/keyword_overview/live` enrichment fires after the initial fetches and backfills KD on every row in the pack. Also fills missing `searchVolume` so every keyword has a vol/mo figure — no more `—` placeholders for AI-cluster keywords.",
      "**AI-cluster keywords enriched at save time.** When Claude infers a 40-60 keyword universe across 6 clusters from the onboarding form + geo, those rows now also get enriched with DataforSEO volume + KD via the same bulk endpoint inside `/api/seo-actions/[slug]/[action]/save` (maxDuration bumped 30s → 60s to accommodate). So the dashboard table shows real vol/mo and KD on cluster rows instead of `—`.",
      "**🧹 Near-identical variants collapse to one row.** New `normalizeKwForDedup` strips Portuguese accents, plural `s` suffixes, parenthetical asides (`(variante acentuada)`), and punctuation — then groups by the normalized key and keeps the most informative row (highest volume + accented spelling preferred). So `clínica ermesinde` / `clinica ermesinde` / `clínicas ermesinde` / `clinicas ermesinde` become **one** row instead of four. Merges missing fields from the losers (cluster context, volume, intent) into the winner.",
      "**No more CPC column.** Wonder Ads SEO is organic-only — CPC was misleading noise on a paid-traffic metric. Dropped from the dashboard table, the CSV export header, the PDF report, the markdown fact pack sent to Claude, and the system prompt instructions.",
      "**Keyword Universe → Keyword Data for {Month} | {Year}.** Header badge now anchors the data freshness explicitly to the month it was pulled (e.g. `Keyword Data for May | 2026`), so consultants don't accidentally treat 6-month-old research as current.",
      "**Department chooser polish.** Header no longer sits inside a card-like sticky strip — on the landing page it's transparent and floats over the starfield. The `Choose a Department` heading is now `Choose Your Department` and types in with a brand-coloured caret (respects `prefers-reduced-motion`).",
    ],
  },
  {
    version: "69.7",
    date: "2026-05-17",
    title: "Claude clusters in the dashboard table + auto-continuation when Claude is cut off",
    highlights: [
      "**🎯 Claude's clusters now feed the dashboard table.** New `kw-cluster-parser.ts` parses the `## Cluster map` section out of Claude's markdown — every cluster's keyword rows (with intent, priority, suggested page, why) become first-class rows in the dashboard alongside the raw DataforSEO data. So when Claude analyses 45 keywords across 6 clusters, all 45 show up in the table — not just the 7 from DataforSEO.",
      "**New 'AI Clusters' tab** in the dashboard showing only the cluster keywords, with their counts in the tab label. Also a new **'Group by: Cluster'** option that splits any tab into cluster-named buckets with select-all per cluster.",
      "**Persisted on the HistoryEntry** as `kwClusters: KwCluster[]` — reopening the result page hydrates clusters from KV alongside the raw pack, no re-parse needed.",
      "**🔄 Auto-continuation when Claude is cut off.** Detects when the mandatory 'Verificação final' Portuguese checklist is missing from the stream output (signals Claude hit the 60s ceiling). Automatically fires a new `/continue-kw-research` call with the last 2000 chars of the partial output asking Claude to resume from exactly where it stopped. Up to 2 continuation attempts per run, so a complex report can total ~180s of Claude work split across 3 function calls.",
      "**New `/api/seo-actions/[slug]/keyword-research/continue-kw-research` endpoint** — same fact pack, same system prompt, same PDF attachment as `/run-kw-research`, but the user message contains the partial + instructions to continue.",
    ],
  },
  {
    version: "69.6",
    date: "2026-05-17",
    title: "Sticky header + verbose DataforSEO diagnostics + dual-endpoint pulls + smoke test",
    highlights: [
      "**Sticky page header** with backdrop blur — the back button now stays visible at all times no matter how far you've scrolled. The `#section-actions` anchor was scrolling the header off-screen so 'Back to SEO DPT' looked missing.",
      "**Per-seed call log** in the progress stream — every DataforSEO `keyword_suggestions` / `keyword_ideas` call is now logged with the seed, endpoint, count returned, and status code. Easy to see exactly which seeds worked, which returned empty, and which errored.",
      "**Dual-endpoint pulls** — for each expansion seed, run BOTH `keyword_suggestions` AND `keyword_ideas` in parallel. They have different DataforSEO query mechanics and one often returns data where the other doesn't. Up to 12 parallel calls per run, capped to stay under the function budget.",
      "**Smoke test fallback** — if `suggestions + ideas` still equals 0 after all expansion calls, one canonical language-specific seed is tried (`dentista` for PT/ES/IT, `dentiste` for FR, `zahnarzt` for DE, `dentist` for EN). If even THAT returns 0, a 🚨 'DataforSEO connectivity / subscription issue' warning is surfaced in the progress stream with a deep link to the diagnostics endpoint.",
      "**dfsPost is now lenient on no-results status codes** — DataforSEO returning `40400` / `40500` means 'no items found' (a valid empty response, not an error). Previously these were thrown as errors; now they return empty + the status code is logged in diagnostics for visibility.",
      "**`/api/diagnostics/dataforseo-test` extended** — now also tests `keyword_suggestions/live` + `keyword_ideas/live` (with `?seed=` / `?location_code=` / `?language_code=` query params). Use this to verify the DataforSEO Labs subscription covers the keyword expansion endpoints.",
    ],
  },
  {
    version: "69.5",
    date: "2026-05-17",
    title: "Persistent back nav + real keyword-shortage fix (per-seed suggestions + emergency fallback)",
    highlights: [
      "**Persistent 'Back to X' pill in the page header** on every nested page (client → 'Back to SEO DPT', action → 'Back to <client>', result → 'Back to <action>'). Sits next to the WonderAds logo top-left so it's always visible without scrolling. PageShell now takes `backHref`/`backLabel` props; removed the inline back-links scattered across pages.",
      "**🐛 Real fix for the 'still only 7 keywords' bug** — the v69.4 multi-seed `keyword_ideas` call was returning near-empty because DataforSEO appears to take the intersection of related ideas across diverse seeds (when seeds are very different, intersection is tiny). Replaced with **per-seed `keyword_suggestions` calls in parallel** (one per expansion seed, capped at 8). `keyword_suggestions` is the right tool for expansion — typically 50-300 keywords per seed. Should now consistently return 100s of keywords for any client with a website + ranked footprint.",
      "**Stage 3 emergency fallback** — when total is still under 30 (very narrow domains), `pickTopicNouns()` mines single-word topical nouns from the domain footprint + user seed + onboarding extracted text (filtering brand tokens + EN/PT stopwords). Each noun is then run through `keyword_suggestions` for an extra expansion pass. Catches narrow-brand-only clinics.",
      "**Thin-universe warning** in the progress stream when total < 30 — explains likely causes (sparse domain rankings, narrow seed, sparse DataforSEO market data) so the consultant can react.",
    ],
  },
  {
    version: "69.4",
    date: "2026-05-17",
    title: "Keyword Research — fix '3 keywords' bug, phase-split for 60s timeout, GSC label, nav rename",
    highlights: [
      "**🐛 FIX: the 'only 3 keywords' bug** — Clínica Mimus and any other client with a brand-name auto-seed was returning a tiny shortlist because the seed-word filter on DataforSEO `ranked_keywords` only kept rows containing the seed tokens. Two-stage rebuild: (1) pull the domain's **full unfiltered ranked footprint** (up to 500 keywords) as the foundation, then (2) mine the top **8 non-branded high-ETV keywords** from that footprint + competitor top branded queries to seed `keyword_ideas` for broad expansion. Brand tokens (e.g. 'mimus') are explicitly excluded from expansion seeds.",
      "**⏱ Phase-split for the 60s timeout** — Claude was getting cut off mid-sentence on heavy runs (big onboarding PDF + 5 competitors). Split into `/prep-kw-research` (DataforSEO + onboarding fetch, saves pack to KV) → `/run-kw-research` (loads pack, attaches PDF natively, streams Claude). Each phase gets its own 60s budget. Mirrors the SEO Audit 4-phase pattern. Progress block now shows `Phase 1 / 2 — pulling keyword data` then `Phase 2` for Claude.",
      "**🔎 Tracked Keywords now labels its data source** — added 'Live · Google Search Console' uppercase subtitle under the title and clarified the body copy: 'Top Google queries for X pulled live from GSC.' Hard to confuse with the curated Target Keywords list now.",
      "**🧭 Project section nav updated** — inserted **02 Keyword Research** between 01 Do's & Don'ts and Data & Quick Actions (now 03). Renamed last item to **SEO Actions** (was 'Actions'). The 02 entry scrolls to the Target Keywords panel I shipped in v69.1.",
    ],
  },
  {
    version: "69.3",
    date: "2026-05-17",
    title: "Keyword Research polish — already-targeted badges, PDF re-extract, graceful geo fallback",
    highlights: [
      "**'🎯 Already targeted' badge** on every row in the Keyword Research dashboard whose keyword already lives in the client's Target Keywords list. Checkbox is disabled, row tinted emerald, header surfaces a count chip. Group-by view shows per-bucket disabled-count too. Sending a batch optimistically grows the targeted set so the rows we just shipped become disabled immediately — no refetch.",
      "**'Re-extract' button** on the Onboarding Form panel. POST to `/api/onboarding/[slug]/re-extract` re-runs the PDF text extractor + competitor miner + suggestedSeed heuristic on the existing file, no re-upload needed. Useful as the extractor heuristics improve over time.",
      "**Graceful geo fallback** when a city target returns zero data from DataforSEO (bad city code or city too small for Google Keyword Planner). `runKeywordResearch` automatically retries with the parent country, records the attempt in `KwResearchPack.fallbackInfo`, and surfaces it in two places: a `> ⚠️ Geo fallback:` line in the progress stream AND a prompt-level instruction telling Claude to note in the Overview that 'city-level data is unavailable for this geo' while still baking the original city's modifier into recommended keywords.",
    ],
  },
  {
    version: "69.2",
    date: "2026-05-17",
    title: "Keyword Research — mandatory Pre-flight Checklist + hard brief compliance",
    highlights: [
      "**SEO Claude now ends every Keyword Research report with a Pre-flight Checklist** (Verificação final) in Portuguese — the exact verification list Andre uses to sign off on a report. Each box is ticked only if Claude can honestly confirm it; unticked boxes get a one-line explanation naming the offending keywords for consultant review.",
      "**Hard brief compliance** elevated from soft guidance to a non-negotiable rule. Every keyword recommendation must pass three gates: respect the **Do's**, **NEVER violate a Don't** (offending keywords are dropped, not softened), and **integrate the Notes** (when a Note shapes a recommendation, it's cited inline with _'Per client Note: …'_).",
      "**Generic-keyword filter** added — single-word/category terms like 'psicologia', 'tratamento', 'dental', 'wellness' are now explicitly rejected unless the client is a national leader defending the term. Silent filter on suggestions/ideas; no more vanity-volume noise in the shortlist.",
      "**YMYL/legal compliance rule** — keywords that would force the client to make medical claims they can't legally make (cure-for-X, guaranteed-treatment-Y) are dropped automatically.",
      "Self-check ends with either `✅ Pronto para entrega — todas as verificações passam.` or `⚠️ Revisão necessária — N item(s) above precisam de validação do consultor antes de partilhar com o cliente.`",
    ],
  },
  {
    version: "69.1",
    date: "2026-05-17",
    title: "Keyword Research polish — city geo targeting, Target Keywords panel, smart seed fill, group-by, history seed display",
    highlights: [
      "**Geo Target is now city-aware.** Replaced the free-text country field with a curated grouped select covering **30+ country and city targets** across Portugal (Lisbon, Porto, Algarve, Coimbra, Braga, Madeira), Spain (Madrid, Barcelona, Valencia), Brazil (São Paulo, Rio, BH), UK, US, Canada, Australia, France, Germany, Italy, Belgium. Each entry carries the real DataforSEO `location_code` so volumes get scoped to that market.",
      "**Localised keyword instruction baked into the prompt.** When a city target is selected, Claude receives a hard rule telling it to bake the local modifier (Lisboa, NYC, Berlin, Roma, etc.) into recommended keywords where intent demands. Example: target Lisbon → 'dentista lisboa', 'all-on-4 lisboa'. The geo + language code also flow through every DataforSEO call.",
      "**Target Keywords panel** on every client page below the brief/files grid. Surfaces everything queued via the dashboard's 'Send to Tracked' button: sortable by keyword/volume/KD/added-date, intent chips, deep-link back to the kw-research run, manual Add (one per line or comma-separated), remove, CSV export, refresh.",
      "**Smart seed-topic auto-fill.** PDF extraction now mines the onboarding form for 'primary keywords' / 'main services' / 'business focus' fields (EN + PT). The matched phrase is stored as `suggestedSeed` on the OnboardingDoc and pre-populates the Keyword Research form's seed field. No more starting from a blank box when the client already told us what to focus on.",
      "**Dashboard 'Group by' control** — None / Intent / Source. Inserts sticky group headers with per-bucket select-all checkbox so consultants can bulk-select an entire intent or competitor footprint in one click.",
      "**Past results cards** for Keyword Research now show **seed + geo + intent** as a chip + summary line instead of the first markdown sentence — way more scannable when comparing past runs.",
    ],
  },
  {
    version: 69,
    date: "2026-05-17",
    title: "Keyword Research phase — conditional seed topic, onboarding-aware form, pillar-organised footer",
    highlights: [
      "**Seed Topic is now conditional.** When an onboarding form is uploaded for the client, the field becomes **optional** — Claude reads the form for focus signals (services, objectives, audience, competitors). When NO form is uploaded, the field stays **required** (system needs *something* to anchor on). The change is driven by a server-side onboarding lookup, so the form reflects reality the moment you hit the page.",
      "**'Use data from onboarding form' tickbox** sits at the top of the Keyword Research form. Defaults to ON when a form is present. Untick to run a clean DataforSEO-only research (e.g. for a discovery comparison). When ON, the seed field switches to 'Additional focus (optional)' with new placeholder + help text explaining its softer role.",
      "**Onboarding state is surfaced in-form**: emerald banner when present (with file name + competitor count if any), rose banner with a deep link to upload when missing.",
      "**API: `useOnboarding` flag respected.** New synthetic input drives whether the run reads the onboarding form. When ON and no seed is provided, the run auto-derives one from the client name and lets Claude drive focus from the PDF.",
      "**'More actions for X' footer redesigned.** Was a flat chip-soup that pushed all 23 actions into one wrapping row. Now a clean **5-column grid grouped by pillar** (Overall SEO · On-Page · Off-Page · Local · Content) with the pillar icon as header, a bullet dot per action that gradient-tints on hover, and a top-right 'All actions →' link back to the project page.",
      "**Version phase:** v68.x was the SEO Audit polish phase (concluded at v68.9). v69 opens the Keyword Research polish phase — minor versions v69.1, v69.2… as the action evolves.",
    ],
  },
  {
    version: "68.9",
    date: "2026-05-17",
    title: "Keyword Research goes full-stack — native PDF, competitor section, interactive dashboard, CSV + Target Keywords",
    highlights: [
      "**Claude now reads the onboarding PDF natively** via Anthropic's document content type — sees the form's actual layout/tables (not just regex-extracted text). The catch-all `/run` route attaches the PDF as a `file` content block on the user message; Claude can cite specific lines.",
      "**Prompt mandates competitor analysis.** Two new required sections in the keyword-research output: **What the client told us** (top services, objectives, audience, brand voice — quoted from the form) and **Competitor analysis** (per-competitor footprint, strongest keywords they win, gaps to attack, verdict 🎯/⚠️/⛔). Plus a hard rule: cross-reference every competitor's keywords against the client's and suggest the best gap-attacks.",
      "**Interactive Keyword Research Dashboard** below the report — tabs (All / Suggestions / Ideas / Already-ranking / Competitors), intent filter, full-text search, sortable columns (Volume / KD / CPC / Keyword), per-row select checkboxes. Sticky header on the table. Renders 2k+ keywords smoothly.",
      "**CSV export** — selected rows or all-filtered. File name auto-stamped with date.",
      "**'Send to Tracked' button** — pushes selected keywords into the per-client Target Keywords list (new `target-keywords:{slug}` KV store + `/api/target-keywords/[slug]` GET/POST/DELETE). Dedupes by lowercase keyword. Returns added/skipped counts.",
      "**Dashboard data persists** — new `kw-research-prep-store.ts` holds the raw `KwResearchPack` between `/run` and `/save`, then attaches it to the `HistoryEntry`. Reopening a result page hydrates the dashboard from history instead of re-running DataforSEO.",
      "**PDF download for Keyword Research.** Same WonderAds-branded cover as SEO Audit (consultant, wonder-ads.com, Audited date). The body adds a printable Keyword Universe section: 4 stat cards (total keywords, total volume/mo, already-ranking count, competitors analysed) + top 25 opportunities table + top 20 already-ranking + a per-competitor table for each named competitor.",
    ],
  },
  {
    version: "68.8",
    date: "2026-05-17",
    title: "Hotfix: restore Yenisey column + onboarding doc polish (heartbeat badge, PDF extraction, competitor pull)",
    highlights: [
      "**HOTFIX — SEO DPT Yenisey column restored.** Renaming Yenisey → Yenisey R. in v68.5 dropped 5 clients off the board (White Clinic, IHN, Fisio Restelo, Monte Mar, CDT) because `getSeoClients()` is wrapped in a 1h `unstable_cache` that still held the old 'Yenisey' string. Two fixes: (a) re-resolve consultant from slug at render time in `/seo` so any future rename ships instantly without waiting on the cache, (b) bumped the cache key to `seo-clients-v2` so the stale entry evicts on next request.",
      "**Onboarding badge is now state-driven.** Green chip when uploaded, **red + heartbeat-pulsing chip when missing** — impossible to forget a client's intake doc. Heartbeat respects `prefers-reduced-motion`.",
      "**PDF text extraction wired in** via `unpdf` (serverless-friendly PDF.js fork). Runs server-side on upload; extracted text + auto-mined competitor URLs are stored alongside the doc in KV. AI actions can now cite specific lines from the client's intake form.",
      "**Competitor keyword pull** added to Keyword Research. For each competitor URL/domain found in the onboarding form, DataforSEO pulls `ranked_keywords` filtered to the seed theme and injects them into the prompt as a per-competitor table. Claude is instructed to cross-reference and surface gaps.",
    ],
  },
  {
    version: "68.7",
    date: "2026-05-17",
    title: "Keyword Research scaffold — DataforSEO Labs + onboarding-aware",
    highlights: [
      "Keyword Research action now wires three DataforSEO Labs endpoints in parallel: **keyword_suggestions/live** (same-stem expansions of the seed), **keyword_ideas/live** (broader semantic ideas), and **ranked_keywords/live** filtered to the seed theme (what the domain already ranks for — quick wins).",
      "All queries respect the per-client **geo + language** from `client-geo.ts` — Portugal/pt for clinics, Canada/en for IHN, etc. — so the keyword universe matches the client's actual market.",
      "**Onboarding form auto-injected** into the prompt when uploaded. Claude is instructed to weight the keywords/themes the client named heavily, and to call out gaps between what the client says they want and what the keyword data backs up.",
      "Brand-new Claude output spec for keyword research: **Overview · Cluster map** (H3 per cluster with table, intent, KD range, combined volume) · **Quick wins (top 10)** · **Strategic bets** · **Gaps the data reveals** · **Tracking shortlist** for the Tracked Keywords dashboard.",
      "Priority emoji tags: 🟢 Quick win · 🟡 Strategic · 🔵 Long bet · ⚪ Watch. Intent labels: informational / commercial / transactional / navigational.",
      "Surfaces partial errors per endpoint (e.g. 'keyword_ideas subscription not enabled') without nuking the whole run.",
    ],
  },
  {
    version: "68.6",
    date: "2026-05-17",
    title: "Per-client Onboarding Form upload (feeds AI actions)",
    highlights: [
      "New **Onboarding Form** panel on every client page (above Brief + Client Files). Single-slot upload for the doc the client filled out during onboarding — main keywords to focus on, target audience, services, geo, brand voice, etc.",
      "Accepts **PDF, DOC, DOCX, TXT, MD** up to 200 MB via Vercel Blob (same client-direct upload path used for client files — no Vercel function size limit).",
      "Persisted in Vercel KV at `onboarding:{slug}` so it survives across all preview deployments and team members. Replace/Remove actions wired up.",
      "Sets up **Keyword Research** (next action) — the AI will read this doc to anchor the keyword universe on what the client actually cares about, not just what they currently rank for.",
    ],
  },
  {
    version: "68.5",
    date: "2026-05-17",
    title: "PDF polish: brand-gradient Download button, readable tables, consultant + site on cover",
    highlights: [
      "**Download PDF** button now uses the WonderAds purple→pink gradient with shadow — pops off the page instead of fading into the dark UI.",
      "**Cover page** now includes **Head SEO Consultant** (auto-resolved per client via the SEO DPT consultant map) and a prominent **wonder-ads.com** link under the meta block.",
      "Renamed **'Generated:' → 'Audited:'** on the cover meta — more accurate language for an audit report.",
      "Fixed the **white-on-white tables** in the PDF body (e.g. the 'What it means' table). MarkdownView's `text-white/85` was beating the print CSS — added scoped `!important` overrides for everything inside `.seo-markdown` so cells, headings, links, and code render dark on the white PDF.",
      "Renamed **Yenisey → Yenisey R.** across the SEO DPT (column header + consultant resolver) to match the Fran. R. / Luana N. naming pattern.",
    ],
  },
  {
    version: "68.4",
    date: "2026-05-17",
    title: "Always-visible PDF button, keyword sort by rank, no more wall-of-text",
    highlights: [
      "Download PDF button now always renders top-right of the result page. Disabled with 'Download available soon' while the audit is running; enables to 'Download PDF' the moment the result saves.",
      "Keywords table default sort changed to **Position ascending** (top rankings first) — the most actionable order for an SEO consultant.",
      "Dropped the **CPC column** from the keywords table — irrelevant for organic SEO work.",
      "Prompt update: SEO Claude can no longer enumerate inside paragraphs as '(1) X (2) Y (3) Z'. Multi-item lists must be rendered as real markdown lists, one item per line. Kills the wall-of-text Overview blocks.",
    ],
  },
  {
    version: "68.3",
    date: "2026-05-17",
    title: "Quick Actions order persists across all deployments",
    highlights: [
      "Quick Actions store moved from localStorage to Vercel KV. Root cause of the persistent 'my order keeps reverting' bug: Vercel preview deployments each get a unique origin (wonder-ads-workspace-<hash>-...vercel.app), so localStorage was being orphaned on every push. KV makes the order persistent across deployments, devices, and team members — one shared list for the SEO Department.",
      "New /api/quick-actions endpoint (GET + POST). The panel still feels instant — localStorage is kept as an optimistic cache for first paint while the API call settles in the background.",
    ],
  },
  {
    version: "68.2",
    date: "2026-05-17",
    title: "Print mode bypasses the app — actually renders the PDF now",
    highlights: [
      "The previous PDF was capturing the entire app page (back link, dark UI, Download PDF button) and adding the print layout on top — the cover never filled the page and body pages came out blank white. Fixed by rendering the print layout server-side, directly from page.tsx, when ?print=true. PageShell is bypassed entirely.",
      "PrintLayout returns its own <html><body> so Next.js skips the root layout chrome on print routes. Every page now has the brand header with WonderAds + SEO Department + the action/client breadcrumb.",
      "AutoPrint helper waits for images (logo + astronaut) to load before firing window.print() so the PDF never goes out with missing imagery.",
      "Core Web Vitals table added to the printable report — mobile + desktop side-by-side with field/lab data.",
      "Cover gradient now full-bleed at proper A4 width (210mm) — no more cropped right edge.",
    ],
  },
  {
    version: "68.1",
    date: "2026-05-17",
    title: "PDF fix, branded cover, CWV panel, DD/MM/YYYY dates",
    highlights: [
      "**PDF rendering fix.** The previous PDF came out blank because Chrome's print engine drops background colours by default. Added `print-color-adjust: exact` so the cover gradient + every brand element prints reliably.",
      "**Branded PDF cover redesigned.** Top-left: WonderAds butterfly + 'WonderAds' wordmark (matching the app header). Top-right: 'SEO Department · Audit Report'. Astronaut in the bottom-right corner, **no rotation** now. Body pages get a slim WA-branded header so they're not blank white anymore.",
      "**Core Web Vitals panel** on the dashboard. Real-user (CrUX) field data for LCP / INP / CLS + FCP + TTFB, mobile + desktop side-by-side, colour-coded per Google's good / needs-improvement / poor thresholds. Lighthouse scores chips inline (Perf / SEO / A11y / BP).",
      "**Dates everywhere are now DD/MM/YYYY.** New `src/lib/dates.ts` helpers (`formatDate`, `formatDateTime`, `formatDateLong`); all existing call sites migrated.",
      "**Stop button removed** during an audit — DataforSEO + PSI charges are already incurred, so it was misleading.",
      "**Quick Actions persistence** rewritten with a simpler localStorage-first store. Adds explicit `console.error` if a save ever fails (private mode / disabled storage), so silent reverts to default are now diagnosable.",
      "**Versioning convention while polishing SEO Audit:** minor versions (v68.1, v68.2, …) until the action is complete, then v69.",
    ],
  },
  {
    version: 68,
    date: "2026-05-17",
    title: "Branded PDF, top-page Download button, KD column",
    highlights: [
      "Download PDF button moved to the top of the result page (next to Back). Re-generate and Copy removed — the result page IS the persistent artefact.",
      "PDF report fully rebranded as a Wonder Ads SEO Department deliverable. Full-bleed cover page with WonderAds gradient + logo + client name + report ID + generated date + seo@wonder-ads.com contact + a cameo of the WA astronaut in the corner. Running footer on every other page with the SEO Department line + page numbers.",
      "Print typography fixed — inline code no longer renders as ugly grey boxes that broke the previous layouts. A4 page setup with proper margins (18mm top/sides, 22mm bottom for the footer).",
      "New 'KD' column on the keywords table — Keyword Difficulty from DataforSEO's competition score (0-100%). Was returned by the API but never displayed.",
      "Test any existing audit's PDF immediately at /seo/<client>/actions/seo-audit/results/<id>?print=true — no regeneration needed.",
    ],
  },
  {
    version: 67,
    date: "2026-05-17",
    title: "Audit split into 4 phases — PSI gets its own budget",
    highlights: [
      "Phase split now: /prep (sitemap + crawl + GSC), /prep-psi (PSI mobile + desktop), /prep-dataforseo (Labs + LLM Mentions), /run (Claude). Each fits comfortably under the 60s Vercel cap.",
      "Heavy English-language sites (IHN, 506 URLs, slow WordPress) were busting v66's combined PSI+DataforSEO phase. Now each runs in isolation with full headroom.",
      "Full audit wall-clock time slightly longer (~3 mins) but every phase is stable — no more 'No prep data found' on bigger clients.",
    ],
  },
  {
    version: 66,
    date: "2026-05-17",
    title: "Audit split into 3 phases — fixes IHN timeout",
    highlights: [
      "SEO Audit now runs in three phases instead of two. Each phase has its own 60s function budget so the deeper DataforSEO pull (limit 1000 + historical_serp_mode) can't kill Phase 1 anymore — which was happening on heavy English-language sites like IHN.",
      "Phase 1 = sitemap + crawl + PageSpeed + Search Console. Phase 2 = DataforSEO Labs + LLM Mentions. Phase 3 = SEO Claude analysis. From the UI it still looks like one continuous run.",
      "Same per-phase fact-pack-to-KV pattern as before, just split: /prep saves Phase 1 data, /prep-dataforseo appends Phase 2, /run reads the merged result.",
    ],
  },
  {
    version: 65,
    date: "2026-05-17",
    title: "Way deeper keyword pull from DataforSEO",
    highlights: [
      "Bumped DataforSEO ranked_keywords limit from 200 → 1000 (the API max).",
      "Added historical_serp_mode: 'all' so we capture keywords this domain ranks for live AND has ranked for recently — closes the gap with Semrush exports that include lost/historical rankings.",
      "Added load_rank_absolute for absolute SERP positions alongside group rank.",
      "Each keyword now carries a 'status' field (live / lost) so future UI can distinguish current rankings from reclaim opportunities.",
    ],
  },
  {
    version: 64,
    date: "2026-05-17",
    title: "AI Visibility: dual-window (Local + Global English)",
    highlights: [
      "AI Visibility panel now shows TWO windows side by side: Local (client's actual market — e.g. Portugal/pt for White Clinic) and Global English (US/en baseline). Each window has its own stats, top cited pages, and co-cited competitors.",
      "Plain-language explanations baked into the UI: 'Local = audience that buys from this client. Global English = wider US/en signal — useful when local is sparse since the LLM corpus is densest in English.'",
      "Every stat card in the AI Visibility section has a one-line sublabel explaining what it means (no more guessing what 'ASV' or 'mentions' mean).",
      "When local mentions = 0, the panel now explicitly tells you to check the Global English baseline — instead of staring at a depressing 0.",
      "Audits where the client is already US/en (none right now, but future-proofed) only query once. Other clients pay ~$0.04 extra in DataforSEO for the second window — well worth it.",
    ],
  },
  {
    version: 63,
    date: "2026-05-17",
    title: "DataforSEO billing-error banner",
    highlights: [
      "When DataforSEO returns 40200 'Payment Required' on every call, the dashboard now shows a clear rose-coloured banner with the exact link to add credits at app.dataforseo.com/billing.",
    ],
  },
  {
    version: 62,
    date: "2026-05-17",
    title: "Per-client geo, sortable keywords, dashboard polish",
    highlights: [
      "Per-client geo + language config — DataforSEO and LLM Mentions queries now run against the client's actual market. White Clinic = Portugal/PT, IHN = Canada/EN, InSync Design = Australia/EN, HDS Learning = Brazil/PT. No more US/EN data for Portuguese clinics.",
      "Top keywords table: 200 keywords (was 40), sortable headers (click Keyword / Pos / Volume / CPC / ETV), button pagination (First / ← / 1/8 / → / Last) — no more mouse-scroll, no more 40-keyword cap.",
      "Dashboard during a running audit: shows a clear 'Loading domain intelligence…' state instead of the post-mortem 're-generate' message.",
      "Polish: dropped the 'NEW' chip on AI Visibility, softened the LLM Mentions chip and sublabel readability, country shown as a tag (Portugal · pt) instead of small grey text.",
    ],
  },
  {
    version: 61,
    date: "2026-05-17",
    title: "AI Visibility panel + colour-tiered Authority + Backlinks live",
    highlights: [
      "Backlinks data now flows (you activated the subscription) — Authority Score, Total Backlinks, Referring Domains, Broken Backlinks populate properly. Whiteclinic: Authority 25/100, 4.8k backlinks, 320 referring domains.",
      "Brand-new AI Visibility panel powered by DataforSEO LLM Mentions API — total brand mentions in Google AI Overview / AI Mode + ChatGPT, AI search volume, top cited pages from this domain, and co-cited competitor + source domains.",
      "Authority card now uses a colour-tiered gradient (rose → amber → sky → emerald) so you see at a glance whether a client is weak / developing / established / strong.",
      "Every stat card has an icon + coloured accent (Trophy / Search / Activity / Link / DollarSign / Sparkles / Bot / Globe2). Visual scan time dropped meaningfully.",
      "SEO Claude prompt now references AI visibility data and calls out specific opportunities (pages cited 0×, competitors we lose to in LLM answers).",
    ],
  },
  {
    version: 60,
    date: "2026-05-17",
    title: "Richer dashboard, full-page PDF, fixed DataforSEO error handling",
    highlights: [
      "Found the Authority + Referring Domains '—' bug: DataforSEO returns HTTP 200 with status_code 40204 for subscription errors, my code was silently swallowing it. Now surfaces a banner: 'Activate the DataforSEO Backlinks subscription'. Action item: activate at app.dataforseo.com/backlinks-subscription.",
      "8 stat cards on the Domain dashboard (was 4): Authority, Organic Keywords, Est. Traffic, Referring Domains, Total Backlinks, Broken Backlinks, Paid Keywords, Top 10 Keywords. Missing values get a softer style so it's obvious what's pending data.",
      "Top ranked keywords bumped from 15 → 100 entries, with a scrollable container (sticky header). Adds CPC + URL columns.",
      "Full-page PDF: Download PDF now renders the Domain dashboard stats + top 30 keywords table alongside the analysis. No more analysis-only export.",
      "Brief panel ('What SEO Claude knows about <client>') hidden on SEO Audit + Keyword Research — they're data audits, not content generation. Brief still feeds the prompt as context; it just doesn't take up screen real estate.",
      "Analysis formatting overhauled: priority issues + findings now render as breathable mini-blocks with severity emoji (🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low). More line-height, softer inline code background, larger heading spacing.",
    ],
  },
  {
    version: 59,
    date: "2026-05-17",
    title: "Dashboard populates live, before Claude finishes writing",
    highlights: [
      "Domain dashboard now appears the moment Phase 1 finishes — pulled from the saved prep — so you see Authority Score / keywords / traffic while SEO Claude is still writing the analysis underneath.",
      "Backup path: /save also returns the metrics, so the dashboard updates if the prep-fetch missed.",
      "New /api/seo-actions/[client]/[action]/prep-data endpoint exposes the cached prep (metrics + meta) for the client to read mid-generation.",
    ],
  },
  {
    version: 58,
    date: "2026-05-17",
    title: "Fix: audits now actually persist to history",
    highlights: [
      "Critical fix — every audit until now was being lost on save. Vercel was killing the function before the KV write completed, so 'past results' were just transient streamed state that vanished on refresh.",
      "Save moved to a separate /save endpoint that runs in ~100ms instead of competing with the Claude stream for the 60s budget. Past results grids now actually populate, result URLs are bookmarkable, PDFs survive a refresh.",
      "Same fix applied to the catch-all route for non-audit actions.",
    ],
  },
  {
    version: 57,
    date: "2026-05-17",
    title: "Audit: 5 priority issues, objective tone, Re-generate button",
    highlights: [
      "SEO Audit now lists the top 5 priority issues (was 10). If only 3 real Critical/High issues exist, it lists 3 — no padding.",
      "Tone rewritten to be objective and engineer-voiced: no evaluative language ('excellent', 'concerning'), no hedging, no narrative transitions. State measurement, gap, fix.",
      "Every result page has a one-click Re-generate button — reuses the same inputs to spawn a fresh result page. Use it when an audit ran before an integration was wired (e.g. DataforSEO) and you want to refresh.",
    ],
  },
  {
    version: 56,
    date: "2026-05-17",
    title: "Audit Phase 1 errors are now visible — plus a DataforSEO test endpoint",
    highlights: [
      "If Phase 1 of the SEO Audit fails (orchestrator crash, KV write fail), the error is now persisted to KV so Phase 2 surfaces a real message — 'Phase 1 failed at step <stage>: <error>' instead of the generic 'No prep data found'.",
      "New /api/diagnostics/dataforseo-test endpoint hits DataforSEO with one cheap call and returns the upstream response (HTTP status + their internal status_code + cost). Use this to confirm credentials work outside the audit flow.",
      "Domain dashboard now distinguishes 'Not connected' (env missing) from 'Not in this result' (env set but the audit run didn't capture metrics). Tells you which fix to apply.",
    ],
  },
  {
    version: 55,
    date: "2026-05-17",
    title: "Integration diagnostics — see what's wired at a glance",
    highlights: [
      "New /api/diagnostics/env endpoint reports which integration env vars are present + their length (no values leak). Hit it to verify what the runtime actually sees.",
      "Action page 'Live tools' chips are now colour-coded by status — green (configured), amber (optional, soft-degrades), red (missing). Hover for the exact env vars + a hint on what to fix.",
      "DataforSEO check moved from a module-load constant to a per-call function so any Vercel module caching can't bake in a stale 'not configured' value.",
    ],
  },
  {
    version: 54,
    date: "2026-05-17",
    title: "SEO Audit split into two phases — fits the 60s Hobby budget",
    highlights: [
      "SEO Audit now runs in two phases under the hood: /prep gathers all live data (sitemap, crawl, PSI, Search Console, DataforSEO) and stores it in KV; /run reads it and streams SEO Claude's analysis. Each phase has its own 60s budget so big audits no longer get killed mid-write.",
      "From the UI it still looks like one continuous run — the result page streams both phases back-to-back with the same progress bar and separator.",
      "Audit prep is cached in KV for an hour (auto-expires) so a failed analysis run can be retried without re-paying the DataforSEO + PSI bill.",
    ],
  },
  {
    version: 53,
    date: "2026-05-16",
    title: "Domain dashboard, deeper audit prompt, PDF fixes",
    highlights: [
      "Audit result page now leads with a Semrush-style Domain dashboard — Authority Score, Organic Keywords (+ top-3/top-10 counts), Estimated Organic Traffic, Referring Domains, and a Top Ranked Keywords table with position + intent + volume + ETV.",
      "Powered by DataforSEO (pay-per-use, ~$0.007 per audit). Set DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD in Vercel env to activate — until then the dashboard shows a 'Connect' CTA.",
      "SEO Audit prompt completely rewritten: 10 priority issues (was 3), proper executive summary (verdict + 2-3 paragraphs), Quick wins + Strategic bets sections, Scorecard now has a 'What it means' column for non-SEO readers.",
      "Tool-progress noise hidden from the result card — the saved analysis renders clean, the progress bar shows the steps.",
      "PDF download fixed: button only enables once KV save completes (was opening empty page), and the print stylesheet is now properly typeset (page breaks per H2, smaller table fonts, real margins).",
    ],
  },
  {
    version: 52,
    date: "2026-05-16",
    title: "Result pages, depth selector, progress bar, PDF download",
    highlights: [
      "Each generation now creates its own permanent page at /seo/<client>/actions/<action>/results/<resultId> (resultId = YYYY-MM-DD-HHMM-xx). Bookmark it, share it, come back to it.",
      "SEO Audit gets a Crawl depth selector — Quick (10 pages) / Standard (25) / Deep (50) / All (up to 100). Concurrency scales with depth so the audit stays fast.",
      "Real progress bar (%) on the result page — counts tool steps as they complete, then time-based estimate during SEO Claude's writing phase.",
      "Download PDF button on every result page — opens a print-styled view that auto-triggers your browser's Save-as-PDF dialog.",
      "Action page is now form + a 'Past results' grid (cards link to each result page) — the sidebar history is gone.",
    ],
  },
  {
    version: 51,
    date: "2026-05-16",
    title: "SEO Audit crawls 2× more pages",
    highlights: [
      "Sample crawl cap bumped from 12 → 25 pages so small/mid sites get fully (or almost fully) covered. Concurrency raised 5 → 8 so it stays fast.",
      "Progress label now shows the ratio — 'Sample crawl — 25 of 54 pages' instead of just '12 pages' — so you can see how much of the site we actually hit.",
    ],
  },
  {
    version: 50,
    date: "2026-05-16",
    title: "Friendlier action errors",
    highlights: [
      "Action runner now parses server error responses and shows only the human message instead of dumping the raw JSON envelope.",
    ],
  },
  {
    version: 49,
    date: "2026-05-16",
    title: "SEO Audit goes site-wide — sitemap, sample crawl & Search Console",
    highlights: [
      "SEO Audit is now site-wide: discovers the sitemap, samples up to 12 representative pages, crawls them all, runs PageSpeed (mobile + desktop) on the homepage, and pulls Search Console (28-day clicks/impressions/CTR/position + delta vs prev, top pages, top queries with movement, registered sitemaps + errors).",
      "Website URL field is pre-filled with the current client's domain so you can just hit Generate.",
      "Action page header tightened — small inline logo + breadcrumb, shorter blurb, no more orphaned big logo next to a wall of text.",
      "Live-tool chip row now lists Sitemap, Sample crawl, PSI Mobile, PSI Desktop, Search Console so you know exactly what's about to run.",
      "Tool progress streams to the page step by step (✓ Sitemap discovery — 189 URLs, 5 sitemap(s)), then SEO Claude's site-wide analysis follows — scorecard table (mobile vs desktop), Search Console signals, findings grouped by impact, 30/60/90 plan.",
    ],
  },
  {
    version: 48,
    date: "2026-05-16",
    title: "SEO Audit goes live — real PageSpeed + HTML measurements",
    highlights: [
      "SEO Audit now runs Google PageSpeed Insights (mobile + desktop) and a live HTML crawl of the target page before SEO Claude analyses it. Cites the exact Lighthouse scores, Core Web Vitals, failed audits and on-page facts.",
      "Tool progress streams to the page in real time (page fetch, PSI mobile, PSI desktop) so you see what's happening, then the analysis streams underneath.",
      "Mobile + desktop PSI run in parallel to stay inside the 60s function budget.",
      "Action pages now show a 'Live tools' chip row when an action runs real measurements (Page HTML, PSI Mobile, PSI Desktop).",
      "Add PAGESPEED_API_KEY to Vercel env to lift the shared-IP rate limit (free key at console.cloud.google.com → enable PageSpeed Insights API).",
      "Action pages load instantly — Notion client lookups now use Next.js cross-request cache (hourly revalidate) and a loading.tsx skeleton fills the gap on cold navigation.",
    ],
  },
  {
    version: 47,
    date: "2026-05-16",
    title: "SEO Claude per client — every action is now functional",
    highlights: [
      "Every one of the 22 SEO actions now has its own page at /seo/<client>/actions/<action>, with a live streaming output and full history of past generations.",
      "Spawned a 'SEO Claude — <client>' persona per client. Every generation is conditioned on that client's Do's, Don'ts, and Notes — and a built-in 2025–2026 SEO best-practice playbook (E-E-A-T, AI Overviews readiness, YMYL guardrails, local pack, link earning).",
      "Per-action input forms collect just what each action needs (e.g. Write Blog Article asks for topic + primary/secondary keywords + word count; GMB Reviews Responder asks for the review text + sentiment).",
      "Past generations are persisted to Vercel KV (last 30 per client per action) — expand any entry to review, copy, or delete it.",
      "Quick Actions and the pillar action cards now link directly to each action's page. Pinning is by slug under the hood (storage v2).",
      "Action output renders as full Markdown — headings, tables, lists, and fenced JSON-LD blocks for schema generations.",
    ],
  },
  {
    version: 46,
    date: "2026-05-16",
    title: "Editable Quick Actions & polish",
    highlights: [
      "Quick Actions is now editable in-app: click 'Edit' on the panel to add, remove, or reorder actions.",
      "Pin / unpin any action directly from the Actions pillars below — the pin icon syncs both lists live.",
      "Each pillar action now shows its parent pillar's icon (page, globe, map pin, pen, gauge) instead of a generic sparkle.",
      "On shared 'SEO & ADS' clients, the website chip is now pushed to the far right of the header tags.",
      "Quick Actions selection persists in your browser and syncs across tabs.",
    ],
  },
  {
    version: 45,
    date: "2026-05-15",
    title: "SEO actions reorg",
    highlights: [
      "New full-width 'Overall SEO' container at the top of every client's Actions, holding SEO Audit and Keyword Research.",
      "Keyword Research moved out of Local SEO into Overall SEO.",
      "Renamed Topic Cluster Plan → Blog Roadmap, and Review Response Drafts → GMB Reviews Responder.",
      "Refreshed pillar icons: On-Page SEO now uses a page icon, Off-Page SEO uses a globe.",
      "Removed the vertical guide line behind action rows for a cleaner look.",
    ],
  },
  {
    version: 44,
    date: "2026-05-14",
    title: "Clock & footer polish",
    highlights: [
      "The 'Working on this for' timer now counts seconds too (HH:MM:SS).",
      "Header clock shows a single, smaller milliseconds digit.",
      "Footer now points to andre@wonder-ads.com for bug reports and feedback.",
    ],
  },
  {
    version: 43,
    date: "2026-05-14",
    title: "Header clock, session timer & protected changelog",
    highlights: [
      "The header now shows a live local-time clock with milliseconds in place of the wonder-ads.com link.",
      "On SEO and ADS project pages, a 'Working on this for' timer counts up from when you opened the client.",
      "The changelog page is now behind a superadmin password.",
    ],
  },
  {
    version: 42,
    date: "2026-05-14",
    title: "Bigger client logo on project pages",
    highlights: [
      "The client logo chip on SEO and ADS project pages is larger, balancing the header with the tags and prompt beside it.",
    ],
  },
  {
    version: 41,
    date: "2026-05-14",
    title: "SEO Actions playbook + section nav",
    highlights: [
      "New Actions section on every SEO project — four pillars (On-Page, Off-Page, Local SEO, Content) of one-click workflows, animated as you scroll in.",
      "Replaced 'Open in Notion' with a numbered section nav (Do's & Don'ts · Data & Quick Actions · Actions) that tracks your scroll position and jumps to a section on click.",
    ],
  },
  {
    version: 40,
    date: "2026-05-14",
    title: "Richer GA4 trend chart + project prompts",
    highlights: [
      "GA4 trend chart is bigger and now interactive — gridlines, date axis, peak/total, and a hover tooltip showing each day's sessions.",
      "GA4 panel on SEO projects defaults to the Organic Search channel.",
      "Every project page now shows the animated 'What are we working on now, boss?' prompt under the client name.",
      "Department pages now ask 'Which project are we working on now, boss?'",
    ],
  },
  {
    version: 39,
    date: "2026-05-14",
    title: "Expanded GA4 Metrics panel",
    highlights: [
      "GA4 panel now has a date-range picker (7 days–12 months) and a channel filter — view all traffic or just Organic Search, Direct, Paid, Social, etc.",
      "Ten SEO metrics: users, new users, sessions, pageviews, pages/session, engagement, bounce rate, time per user, conversions and conversion rate — each with trend vs the previous period.",
    ],
  },
  {
    version: 38,
    date: "2026-05-14",
    title: "Don't cache failed analytics responses",
    highlights: [
      "GA4 and keyword API routes no longer CDN-cache error responses — a transient auth blip could otherwise freeze a panel on 'Access needed' for an hour.",
    ],
  },
  {
    version: 37,
    date: "2026-05-14",
    title: "Live GA4 Metrics on SEO projects",
    highlights: [
      "GA4 Metrics panel now pulls real Google Analytics 4 data — users, sessions, engagement, conversions, with 30-day trend arrows and a live sparkline.",
      "Each client's GA4 property is auto-detected by website domain; reuses the same Google service account as Search Console.",
    ],
  },
  {
    version: 36,
    date: "2026-05-14",
    title: "Sort & taller keyword list",
    highlights: [
      "Tracked Keywords can be sorted by top traffic, best position, or recent growth.",
      "Doubled the keyword list's scroll height so more rows are visible at once.",
    ],
  },
  {
    version: 35,
    date: "2026-05-14",
    title: "Keyword date ranges + project layout polish",
    highlights: [
      "Tracked Keywords has a date-range picker (7 days up to 12 months) and the list now scrolls — up to 50 keywords per client.",
      "Client Files panel stretches to match the brief column height.",
      "Moved the 'Synced across SEO & ADS' tag up to the client header, next to the website link.",
    ],
  },
  {
    version: 34,
    date: "2026-05-14",
    title: "Auto-detect each client's Search Console property",
    highlights: [
      "Tracked Keywords now looks up each client's actual Search Console property instead of assuming a domain property — so clients on URL-prefix properties (e.g. White Clinic, IHN) resolve correctly too.",
    ],
  },
  {
    version: 33,
    date: "2026-05-14",
    title: "Search Console via domain-wide delegation",
    highlights: [
      "Tracked Keywords now authenticates by impersonating a Workspace user that already owns every client property — no per-client access grant needed in Search Console.",
    ],
  },
  {
    version: 32,
    date: "2026-05-14",
    title: "Live keyword rankings + full-width project layout",
    highlights: [
      "Tracked Keywords now pulls live data from Google Search Console — top queries, average position, and 28-day position change.",
      "Project pages are full-width: Client Brief (Do's, Don'ts, Notes) on the left, Client Files on the right.",
      "Shared clients show a 'Synced across SEO & ADS' note on the brief so it's clear edits land in both departments.",
    ],
  },
  {
    version: 31,
    date: "2026-05-14",
    title: "Client Files + White Clinic in ADS DPT",
    highlights: [
      "New Client Files panel on every project page — upload images/videos or paste Google Drive links. Stays in sync across the SEO & ADS departments, just like the brief.",
      "White Clinic added to the ADS DPT (Germano C., Google + Meta).",
      "Shared clients now show a 'SEO & ADS Client' badge on their project page instead of a single-department tag.",
      "B-Life logo chip moved to a white background.",
      "Removed the redundant 'Not set' tag from the Client Brief header.",
    ],
  },
  {
    version: 30,
    date: "2026-05-14",
    title: "Homepage department order",
    highlights: [
      "Swapped WEB and ADS on the homepage grid — order is now SEO · ADS · WEB · COMMERCIAL.",
    ],
  },
  {
    version: 29,
    date: "2026-05-14",
    title: "Logo chip fixes — Clínica em Casa SVG + exact CDT orange",
    highlights: [
      "Clínica em Casa: swapped the framed apple-touch-icon for the clean SVG icon-logo — no more weird inner border on the white chip.",
      "CDT + IHN chip orange corrected to #F6A800 — the exact orange sampled from CDT's own logo asset.",
    ],
  },
  {
    version: 28,
    date: "2026-05-14",
    title: "Per-client logo chip — new colours, tighter padding, better sources",
    highlights: [
      "B-Life: swapped to the official green 'B♥LIFE' logo (no 'Care'). 900px wide, tight padding so it fills the chip.",
      "Clínica Mimus: re-fetched the 2025 logo — proper mark now visible.",
      "White Clinic and Clínica em Casa: tight padding so the logo fills the chip instead of sitting in a sea of whitespace.",
      "IHN + CDT: chip background is now CDT-brand orange (#F9B600).",
      "WonderAds: chip background is now dark (#10131a) so the butterfly pops.",
      "Senior Resort: chip background is now army green (#4B5320).",
      "LogoBgMode now accepts a custom hex colour; LogoSizing supports 'tight' for clients with sparse logos.",
    ],
  },
  {
    version: 27,
    date: "2026-05-14",
    title: "Logo chip contrast fix for B-Life and Monte Mar",
    highlights: [
      "B-Life and Monte Mar logos are white-on-transparent — invisible on the white chip in v26. Both now render on a dark near-black chip so the white marks are visible.",
      "New LOGO_BG_OVERRIDES map + getLogoBgMode helper — easy to flip any other client to a dark chip if needed.",
      "Brand-coloured glow behind each chip still shows the per-client palette.",
    ],
  },
  {
    version: 26,
    date: "2026-05-14",
    title: "Real brand logos on every client card and project page",
    highlights: [
      "Swapped the Notion emoji icons for each client's actual brand logo. Logos pulled directly from each client's website (apple-touch-icon → og:image → nav <img> in that order) and saved into /public/logos.",
      "All 16 SEO clients now show their real mark: Monte Mar got the proper SVG, Clínica Mimus, IHN, White Clinic, etc. all show their brand identity.",
      "New LogoChip component: white background + per-client brand-gradient glow behind. Contrast is universal — any logo's colours show cleanly.",
      "Cards on /seo, /ads, plus the icon chip on every /seo/[slug] and /ads/[slug] page all use it.",
      "Clínica Empatia (no website yet) keeps the 💗 emoji on a gradient chip until you provide a logo.",
    ],
  },
  {
    version: 25,
    date: "2026-05-14",
    title: "Website URL on project pages + 3-pane SEO project workspace",
    highlights: [
      "Every SEO and ADS client page now shows the client's website as a clickable chip next to the 'SEO/ADS DPT · CLIENT' tag.",
      "New three-column section under the Client Brief on every SEO project page:",
      "Left — Quick Actions: Write SEO Blog · Meta Title & Description · Keyword Research · On-Page Audit · Backlink Outreach · Schema Markup. Disabled until the per-project Claude chat lands.",
      "Middle — GA4 Metrics placeholder: 4 metric tiles + a ghost sparkline. Marked 'Not connected' until the GA4 Data API is wired.",
      "Right — Tracked Keywords placeholder: 5 ghost rows showing rank + trend. Marked 'Not connected' until DataForSEO lands.",
    ],
  },
  {
    version: 24,
    date: "2026-05-14",
    title: "ADS DPT: Core tier override + channel tags",
    highlights: [
      "All ADS DPT clients now show as 'Core' tier on the listing — per-department override so InSync Design stays 'Lite' on SEO.",
      "Each ADS card gets two channel tags: 'Google Ads' (multicolor gradient) and 'Meta Ads' (Meta-blue gradient).",
      "Per-client channel array — easy to drop one for a future client without code surgery.",
    ],
  },
  {
    version: 23,
    date: "2026-05-14",
    title: "Clean client pages — drop Notion content list & ADS placeholder",
    highlights: [
      "Removed the auto-rendered Notion sub-pages list from every /seo/[slug] page (Reports, Backlinks, etc. — those Notion-tagged rows).",
      "Removed the 'Coming soon' placeholder from every /ads/[slug] page.",
      "Each project page is now: header + Client Brief, with empty space ready for custom containers next.",
      "'Open in Notion' link on SEO pages kept for quick jumps back to the source page.",
    ],
  },
  {
    version: 22,
    date: "2026-05-14",
    title: "Fix stale brief render + ADS DPT header polish",
    highlights: [
      "Fix: edits to Do's/Don'ts now show up on refresh and across tabs immediately. The ClientBrief client component fetches the live KV record on mount, so the static-cached server render can't show stale data.",
      "ADS DPT: removed the gradient megaphone icon square in the header.",
      "ADS DPT tagline updated to: 'Strategy, propose creative plans, briefs and activate campaigns.'",
    ],
  },
  {
    version: 21,
    date: "2026-05-14",
    title: "ADS DPT polish + real-time brief sync",
    highlights: [
      "World map on the ADS DPT header — Canada · Portugal · Australia highlighted.",
      "Typewriter prompt 'What are we working on today, boss?' under the count badge.",
      "All 3 ADS clients now attributed to Germano C. (per-department consultant; the same client keeps its SEO-side consultant on /seo).",
      "Real-time brief sync across tabs via BroadcastChannel — add a Do on /seo/ihn and it appears instantly on /ads/ihn.",
      "30s polling backstop covers cross-device sync without burning the Upstash free tier.",
    ],
  },
  {
    version: 20,
    date: "2026-05-13",
    title: "Editable Client Brief, synced across departments",
    highlights: [
      "Do's, Don'ts, and Notes are now editable in the app — '+ Add' button, click any item to edit inline, hover to delete.",
      "Persistence backed by Vercel KV (Upstash Redis). Optimistic UI snaps instantly while the server confirms in the background.",
      "Shared clients (IHN, InSync Design) sync across /seo and /ads automatically — edits to either side update the same record.",
      "Server-side fallback: when the KV record is empty, the static defaults from client-briefs.ts still render.",
    ],
  },
  {
    version: 19,
    date: "2026-05-13",
    title: "Client page header — icon and title side-by-side",
    highlights: [
      "On every SEO and ADS client page, the gradient icon square now sits to the left of the badge + title (was stacked vertically).",
      "On SEO pages, the 'Open in Notion' link moves to the top-right of the header so the icon + title group can sit together.",
    ],
  },
  {
    version: 18,
    date: "2026-05-13",
    title: "ADS DPT clients + cross-department brief sync",
    highlights: [
      "Replaced the ADS DPT 'Channels' list with a Clients section: IHN, InSync Design, Clínica Empatia.",
      "Each ADS client now has its own /ads/[slug] page (mirrors /seo/[slug]).",
      "Briefs are shared by slug — IHN and InSync Design show the same Do's/Don'ts on both the SEO and ADS pages. Edit once, both update.",
      "Added Clínica Empatia (ADS-only) with a thematic peach→rose→magenta palette and 💗 icon.",
    ],
  },
  {
    version: 17,
    date: "2026-05-13",
    title: "Client Brief on every SEO project page",
    highlights: [
      "New Do's and Don'ts panels on every /seo/[slug] page — emerald for Do's, rose for Don'ts.",
      "Notes panel underneath when there are general instructions for the client.",
      "Briefs live in src/lib/client-briefs.ts — easy to edit and version-controlled.",
      "Single source of truth that v18 (per-project chat) and ADS DPT will both read from.",
    ],
  },
  {
    version: 16,
    date: "2026-05-13",
    title: "Typewriter prompt copy fix",
    highlights: [
      "Fixed missing 'we' in the typewriter prompt: now reads 'What are we working on today, boss?'.",
    ],
  },
  {
    version: 15,
    date: "2026-05-13",
    title: "Typewriter prompt on SEO DPT",
    highlights: [
      "Added a typewriter-animated prompt under the 16-clients badge that types out 'What are working on today, boss?' on every page load.",
      "Brand-gradient caret continues blinking after the text finishes typing.",
      "Respects prefers-reduced-motion (no caret blink for users who opted out).",
    ],
  },
  {
    version: 14,
    date: "2026-05-13",
    title: "Public changelog",
    highlights: [
      "Footer version is now a clickable link.",
      "New /changelog page with a timeline of every workspace release.",
      "The latest entry pulses; older entries fade in on a staggered timeline.",
    ],
  },
  {
    version: 13,
    date: "2026-05-13",
    title: "SEO DPT cleanup — 3 columns, no gradient effects, map fix",
    highlights: [
      "Dropped client C. Saccor (offboarded). André's column gone too.",
      "Switched to 3 consultant columns: Fran. R. · Yenisey · Luana N.",
      "Cards inside each column sort top → bottom by tier: Growth → Core → Lite.",
      "Removed gradient text effects from SEO DPT title and the count badge.",
      "Cropped Antarctica + colored bleed from the world map.",
    ],
  },
  {
    version: 12,
    date: "2026-05-13",
    title: "Remove homepage shooting stars",
    highlights: [
      "Pulled the meteors background effect off the department-selector page.",
      "Background goes back to soft brand gradient halos only.",
    ],
  },
  {
    version: 11,
    date: "2026-05-13",
    title: "Title polish, tier badges, 4 consultant columns",
    highlights: [
      "Dropped the shimmer animation on the SEO DPT title; scaled it ~10% smaller.",
      "Equalised the count-badge sizes — '17' and 'clients' now match.",
      "Renamed Institute of Holistic Nutrition → IHN, Corrida do Tempo → CDT.",
      "Added Lite · Core · Growth tier badges on every client card.",
      "Added consultant Luana N. (took over Aeger Prima, A. Domingos, Senior Resort, Safe Away, Clínica em Casa).",
    ],
  },
  {
    version: 10,
    date: "2026-05-12",
    title: "Real per-client brand colours",
    highlights: [
      "Extracted brand colours from each of the 17 client websites.",
      "Applied per-client gradients to the card icon, glow, and bottom accent.",
      "Where the site exposed too few colours, a thematic complement was chosen.",
    ],
  },
  {
    version: 9,
    date: "2026-05-12",
    title: "Layout polish + consultant overrides",
    highlights: [
      "Renamed Mimus Clínica Dentária → Clínica Mimus.",
      "Added per-client consultant overrides (Fran. R. and Yenisey).",
      "Moved the KPIs card to a full-width row below the clients grid.",
      "Tightened KPIs copy (no more duplicated 'framework').",
      "Made the SEO DPT title bigger with a rich 5-stop gradient.",
    ],
  },
  {
    version: 8,
    date: "2026-05-12",
    title: "Per-client palettes, world map, shooting stars",
    highlights: [
      "Thematic gradient palette per client (placeholders until real colours).",
      "Added a world map next to the SEO DPT header highlighting client countries.",
      "Shooting-star meteors on the homepage background.",
      "Animated count badge '17 clients' next to the title.",
      "Head Consultant André on every card.",
    ],
  },
  {
    version: 7,
    date: "2026-05-12",
    title: "Live Notion integration",
    highlights: [
      "Wired /seo to live Notion data — clients now load from the SEO Space.",
      "Each card opens a dynamic /seo/[slug] page rendering that client's Notion content.",
      "ISR re-fetches from Notion every 60s — Notion edits go live within a minute.",
    ],
  },
  {
    version: 6,
    date: "2026-05-12",
    title: "Tagline, layout, KPIs translation",
    highlights: [
      "New tagline: 'Organic growth in Google and AIs. #1 SEO & GEO Agency in Portugal.'",
      "KPIs hero moves below the project grid on /seo.",
      "Translated the SEO KPIs framework page from Portuguese to English.",
    ],
  },
  {
    version: 5,
    date: "2026-05-12",
    title: "Switch SEO Claude to direct Anthropic billing",
    highlights: [
      "Replaced the Vercel AI Gateway provider with @ai-sdk/anthropic.",
      "Chat now bills directly to your Anthropic account.",
      "Default model: claude-sonnet-4-6.",
    ],
  },
  {
    version: 4,
    date: "2026-05-12",
    title: "SEO Claude chat + project grids + KPIs page",
    highlights: [
      "SEO Claude streaming chat panel on /seo (Vercel AI Gateway).",
      "Project grids on /seo (16 cards), /ads (6), /web (6).",
      "SEO DPT KPIs hero card linking to /seo/kpis.",
      "New /seo/kpis page rendering the performance framework.",
    ],
  },
  {
    version: 3,
    date: "2026-05-12",
    title: "Footer copy fix",
    highlights: ["'All Copy Rights Reserved' → 'All Rights Reserved'."],
  },
  {
    version: 2,
    date: "2026-05-12",
    title: "Hero copy refinements",
    highlights: [
      "Capitalised the word 'Department' in the hero heading.",
      "Removed the descriptive paragraph below the heading.",
      "Updated footer copyright text.",
      "Tightened section margins (~5% less scroll).",
    ],
  },
  {
    version: 1,
    date: "2026-05-12",
    title: "Initial workspace",
    highlights: [
      "Next.js 15 + TypeScript + Tailwind v4 + App Router scaffold.",
      "Dark theme with hub-and-spoke layout and the Wonder Ads brand gradient.",
      "Four department cards: SEO · WEB · ADS · COMMERCIAL.",
      "Deployed on Vercel Hobby at wonder-ads-workspace.vercel.app.",
    ],
  },
];

export function getCurrentVersion(): number | string {
  return CHANGELOG[0]?.version ?? 1;
}
