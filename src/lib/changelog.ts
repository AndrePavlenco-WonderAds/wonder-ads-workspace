// Workspace changelog — every version, newest first.
// When bumping the footer `workspace.v#`, prepend a new entry at the TOP of
// the CHANGELOG array (the page renders in order, so position 0 = latest).

export type ChangelogEntry = {
  version: number;
  date: string; // ISO YYYY-MM-DD
  title: string;
  highlights: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
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

export function getCurrentVersion(): number {
  return CHANGELOG[0]?.version ?? 1;
}
