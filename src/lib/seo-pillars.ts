import {
  FileText,
  Globe,
  MapPin,
  PenLine,
  Gauge,
  type LucideIcon,
} from "lucide-react";

export type ActionFieldType =
  | "text"
  | "textarea"
  | "select"
  | "location"
  | "date"
  | "segmented"
  | "files";

export type ActionField = {
  key: string;
  label: string;
  type: ActionFieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  rows?: number;
  defaultValue?: string;
  /** Render the field label underlined — used to draw the eye to a
   *  high-priority optional input (e.g. the KW research strategic
   *  "Comments / Additions" box). */
  underline?: boolean;
  /** Conditional rendering: only show this field when another field
   *  has one of the listed values. Used in GMB Posts to surface Offer-
   *  specific / Event-specific fields only when those types are
   *  selected. */
  showWhen?: { field: string; equals: string | string[] };
};

export type ActionToolName =
  | "crawl-page"
  | "pagespeed-mobile"
  | "pagespeed-desktop"
  | "sitemap-discovery"
  | "crawl-sample"
  | "gsc-site-data"
  | "dataforseo-domain";

export type ActionDef = {
  slug: string;
  label: string;
  blurb: string;
  fields: ActionField[];
  /** Optional live-data tools to run before the LLM generation. */
  tools?: ActionToolName[];
  /** Which input field carries the URL the tools should target. Default "pageUrl". */
  toolUrlField?: string;
  /** Whether the client brief (Do's / Don'ts / Notes) is relevant for this
   *  action. Defaults to true. Set false for data-driven audits that don't
   *  generate content (SEO Audit, Keyword Research) — the brief is still
   *  in the prompt as context but we hide the panel on the action page. */
  usesBrief?: boolean;
  /** Optional override for the URL the pillar card + quick-actions panel
   *  link to. When omitted, defaults to `/seo/[clientSlug]/actions/[slug]`.
   *  Used for the Roadmap entry, which points at the live `/roadmap`
   *  board instead of the markdown action page. */
  href?: (clientSlug: string) => string;
  /** Optional title for the new-generation form. `{client}` is
   *  substituted with the client name. Default:
   *  `New generation for {client}`. */
  titleTemplate?: string;
  /** Optional override for the Generate button label. Default: `Generate`. */
  generateButtonLabel?: string;
};

/** Single source of truth for the URL an action card links to. Every
 *  consumer that wants to navigate to an action MUST go through this —
 *  prevents the pillar list and the quick-actions panel from drifting
 *  out of sync on routes like `/roadmap` that don't follow the default
 *  `/seo/[slug]/actions/[slug]` convention. */
export function actionHref(clientSlug: string, action: ActionDef): string {
  return (
    action.href?.(clientSlug) ??
    `/seo/${clientSlug}/actions/${action.slug}`
  );
}

export type Pillar = {
  name: string;
  slug: string;
  Icon: LucideIcon;
  blurb: string;
  actions: ActionDef[];
  fullWidth?: boolean;
};

const URL_FIELD: ActionField = {
  key: "pageUrl",
  label: "Page URL",
  type: "text",
  placeholder: "https://client-site.com/page",
};

const PRIMARY_KEYWORD: ActionField = {
  key: "primaryKeyword",
  label: "Primary keyword",
  type: "text",
  required: true,
  placeholder: "e.g. dentist london",
};

export const PILLARS: Pillar[] = [
  {
    name: "Overall SEO",
    slug: "overall-seo",
    Icon: Gauge,
    blurb: "High-level audits and strategic research.",
    fullWidth: true,
    actions: [
      {
        // NOTE: slug stays "client-roadmap" so older history entries
        // saved at /seo/[slug]/actions/client-roadmap still resolve. The
        // pillar card + quick-actions panel link to the LIVE roadmap
        // board instead (via the `href` override below) — that's the
        // operational view consultants actually work in day-to-day.
        slug: "client-roadmap",
        label: "Roadmap",
        blurb:
          "Live 12-week operational board — Claude fills it, you edit, status moves with the work.",
        usesBrief: true,
        href: (clientSlug) => `/seo/${clientSlug}/roadmap`,
        fields: [
          {
            key: "horizon",
            label: "Horizon",
            type: "select",
            options: ["3 months", "6 months", "12 months"],
            defaultValue: "6 months",
          },
          {
            key: "strategicFocus",
            label: "Strategic focus (optional)",
            type: "textarea",
            rows: 4,
            placeholder:
              "Anything that overrides defaults — e.g. \"push local SEO hard for the new Lisbon clinic\" or \"start a link-building sprint in Q3\".",
          },
          {
            key: "constraints",
            label: "Constraints (optional)",
            type: "textarea",
            rows: 3,
            placeholder:
              "Budget, team bandwidth, blackout periods, anything that shapes timing.",
          },
        ],
      },
      {
        slug: "seo-audit",
        label: "SEO Audit",
        blurb:
          "Site-wide audit — sitemap, sample crawl, PageSpeed and Search Console pulled live.",
        usesBrief: false,
        tools: [
          "sitemap-discovery",
          "crawl-page",
          "crawl-sample",
          "pagespeed-mobile",
          "pagespeed-desktop",
          "gsc-site-data",
          "dataforseo-domain",
        ],
        toolUrlField: "pageUrl",
        fields: [
          {
            key: "pageUrl",
            label: "Website URL",
            type: "text",
            required: true,
            placeholder: "https://client-site.com/",
            helpText:
              "Defaults to this client's website. We'll discover the sitemap, crawl a sample of pages, run PageSpeed Insights on the homepage, and pull Search Console — then SEO Claude analyses the whole site.",
          },
          {
            key: "depth",
            label: "Crawl depth",
            type: "select",
            options: ["Quick", "Standard", "Deep", "All"],
            defaultValue: "Standard",
            helpText:
              "Quick = 10 pages, Standard = 25, Deep = 50, All = up to 100. Deeper audits give richer findings but push the 60s function limit.",
          },
          {
            key: "focus",
            label: "Focus",
            type: "select",
            options: [
              "Everything",
              "Technical",
              "On-Page",
              "Content",
              "Off-Page",
            ],
            defaultValue: "Everything",
          },
          {
            key: "observations",
            label: "What's bothering you?",
            type: "textarea",
            rows: 3,
            placeholder:
              "Anything you've already noticed — rankings dropping, slow pages, indexation issues...",
          },
        ],
      },
      {
        slug: "keyword-research",
        label: "Keyword Research",
        blurb:
          "Cluster a topic into intent-mapped, prioritised target keywords.",
        usesBrief: false,
        fields: [
          {
            key: "seedTopic",
            label: "Seed topic or service",
            type: "textarea",
            required: true,
            rows: 2,
            placeholder:
              "e.g. all-on-4 dental implants in Lisbon for high-income adults",
          },
          {
            key: "geo",
            label: "Geo target",
            type: "location",
            defaultValue: "Portugal (national)",
            helpText:
              "Country or city. City targets sharpen DataforSEO volumes to that market AND tell Claude to bake the local modifier into recommended keywords (e.g. 'Dentista Lisboa' for Lisbon).",
          },
          {
            key: "intent",
            label: "Intent filter",
            type: "select",
            options: [
              "All intents",
              "Informational",
              "Commercial",
              "Transactional",
              "Navigational",
            ],
            defaultValue: "All intents",
          },
          {
            key: "comments",
            label: "Comments or Additions to Consider",
            type: "textarea",
            required: false,
            underline: true,
            rows: 3,
            placeholder:
              "Contexto estratégico (opcional, mas tido em conta ANTES de qualquer API): serviços/produtos a priorizar, oportunidades sazonais, concorrentes a vigiar, tópicos a excluir, serviços que mais faturam…",
            helpText:
              "Lido primeiro e usado em todo o research — influencia a expansão de keywords e o scoring de prioridade.",
          },
          {
            key: "files",
            label: "Ficheiros de apoio",
            type: "files",
            required: false,
            helpText:
              "Listas de keywords, exports de concorrentes, planos de conteúdo, briefings (CSV, TXT, MD, PDF). São lidos e integrados no contexto ANTES das APIs externas.",
          },
        ],
      },
      {
        slug: "monthly-report",
        label: "Monthly Report",
        blurb:
          "Client-facing monthly synthesis — what was done, what moved, what's next.",
        usesBrief: true,
        fields: [
          {
            key: "reportingPeriod",
            label: "Reporting period",
            type: "select",
            options: ["Last 28 days", "Last full month", "Last quarter"],
            defaultValue: "Last full month",
          },
          {
            key: "highlights",
            label: "Highlights / numbers to spotlight",
            type: "textarea",
            rows: 5,
            placeholder:
              "Anything you want to spotlight — ranking moves, traffic delta, content shipped, links earned. The system already pulls recent action history + brief; add what the data won't show.",
          },
          {
            key: "nextMonthFocus",
            label: "What's the focus for next month?",
            type: "textarea",
            rows: 3,
            placeholder:
              "The angle the next period should push — keep it short, one or two sentences.",
          },
        ],
      },
    ],
  },
  {
    name: "On-Page SEO",
    slug: "on-page-seo",
    Icon: FileText,
    blurb: "Optimise what's on the page itself.",
    actions: [
      {
        slug: "header-tags",
        label: "Generate Header Tags",
        blurb: "H1/H2/H3 outline aligned to search intent and topical depth.",
        fields: [
          URL_FIELD,
          PRIMARY_KEYWORD,
          {
            key: "pageGoal",
            label: "Page goal",
            type: "textarea",
            rows: 2,
            placeholder:
              "What should a visitor do or learn? E.g. book a consultation.",
          },
        ],
      },
      {
        slug: "meta-title-description",
        label: "Meta Titles & Descriptions",
        titleTemplate: "Optimize Meta Tags for {client}",
        generateButtonLabel: "Scan current Meta Tags and SEO Optimize",
        blurb:
          "Crawls every page, audits the current title + meta, drafts SERP-optimised rewrites from the latest Keyword Research.",
        usesBrief: false,
        fields: [
          {
            key: "pageUrl",
            label: "Website URL",
            type: "text",
            required: true,
            placeholder: "https://client-site.com/",
            helpText:
              "Defaults to this client's website. We'll discover the sitemap, crawl the pages, and propose optimised meta tags per URL.",
          },
          {
            key: "depth",
            label: "Pages to scan",
            type: "select",
            required: true,
            options: ["Quick (10)", "Standard (25)", "Deep (50)"],
            defaultValue: "Standard (25)",
            helpText:
              "Quick = top 10 pages, Standard = 25, Deep = 50. Pages are sampled in sitemap order. Deep takes ~40-50s.",
          },
          {
            key: "focusKeywords",
            label: "Focus keywords (optional)",
            type: "textarea",
            rows: 3,
            placeholder:
              "Anything the rewrites must lean into beyond what's in the latest Keyword Research — service names, geo modifiers, brand terms. Leave blank to let Claude pick purely from the KW research clusters.",
          },
        ],
      },
      {
        slug: "image-alt-text",
        label: "Image Alt Text",
        blurb: "Descriptive, accessible, lightly keyword-aware alt copy.",
        fields: [
          {
            key: "imageDescription",
            label: "What's in the image?",
            type: "textarea",
            required: true,
            rows: 3,
            placeholder:
              "Describe the subject, setting, people, products visible.",
          },
          {
            key: "pageContext",
            label: "Page context",
            type: "textarea",
            rows: 2,
            placeholder: "What page does it live on? What's the topic?",
          },
          {
            key: "primaryKeyword",
            label: "Primary keyword (optional)",
            type: "text",
            placeholder: "Only include if the image actually depicts it.",
          },
        ],
      },
      {
        slug: "internal-linking",
        label: "Internal Linking Suggestions",
        blurb:
          "Find descriptive-anchor internal link opportunities for the page.",
        fields: [
          URL_FIELD,
          {
            key: "pageTopic",
            label: "Page topic",
            type: "textarea",
            required: true,
            rows: 2,
            placeholder: "Briefly: what is this page about?",
          },
          {
            key: "knownPages",
            label: "Other pages on the site (optional)",
            type: "textarea",
            rows: 4,
            placeholder: "Paste URLs + titles, one per line.",
          },
        ],
      },
      {
        slug: "schema-markup",
        label: "Schema Markup (JSON-LD)",
        blurb: "Strict, valid JSON-LD schema for the page.",
        fields: [
          {
            key: "schemaType",
            label: "Schema type",
            type: "select",
            required: true,
            options: [
              "LocalBusiness",
              "MedicalClinic",
              "Dentist",
              "Article",
              "FAQPage",
              "Service",
              "Product",
              "BreadcrumbList",
              "Review",
              "Organization",
              "Person",
              "Event",
            ],
            defaultValue: "LocalBusiness",
          },
          URL_FIELD,
          {
            key: "pageContent",
            label: "Source content / facts",
            type: "textarea",
            required: true,
            rows: 6,
            placeholder:
              "Paste the page copy, opening hours, addresses, services, FAQs, etc. The richer the input, the richer the schema.",
          },
        ],
      },
      {
        slug: "content-gap-analysis",
        label: "Content Gap Analysis",
        blurb: "Find what competitors cover that this page misses.",
        fields: [
          {
            key: "pageTopic",
            label: "Page or cluster topic",
            type: "textarea",
            required: true,
            rows: 2,
          },
          {
            key: "competitors",
            label: "Competitor URLs",
            type: "textarea",
            required: true,
            rows: 4,
            placeholder: "One competitor URL per line.",
          },
          {
            key: "targetKeywords",
            label: "Target keywords",
            type: "textarea",
            rows: 3,
          },
        ],
      },
    ],
  },
  {
    name: "Off-Page SEO",
    slug: "off-page-seo",
    Icon: Globe,
    blurb: "Build authority from outside the site.",
    actions: [
      {
        slug: "backlink-directories",
        label: "Find Backlink Directories",
        blurb:
          "Relevant, niche directories worth a citation — no spammy lists.",
        fields: [
          {
            key: "topic",
            label: "Niche / service",
            type: "textarea",
            required: true,
            rows: 2,
            placeholder: "e.g. private dental clinic in Lisbon, all-on-4",
          },
          {
            key: "geo",
            label: "Geo target",
            type: "location",
            defaultValue: "Portugal (national)",
          },
        ],
      },
      {
        slug: "outreach-email",
        label: "Outreach Email Drafts",
        blurb: "Personalised, useful outreach emails — not templates.",
        fields: [
          {
            key: "targetSite",
            label: "Target site / contact",
            type: "text",
            required: true,
            placeholder: "Domain + writer/editor name if you have it.",
          },
          {
            key: "reason",
            label: "Reason to reach out",
            type: "textarea",
            required: true,
            rows: 3,
            placeholder:
              "e.g. they covered a related topic; broken link they could fix; we have data they'd find useful.",
          },
          {
            key: "offer",
            label: "What we're offering",
            type: "textarea",
            rows: 3,
          },
        ],
      },
      {
        slug: "competitor-backlink-gap",
        label: "Competitor Backlink Gap",
        blurb: "Spot link types competitors earn that we don't.",
        fields: [
          {
            key: "competitors",
            label: "Competitors",
            type: "textarea",
            required: true,
            rows: 3,
            placeholder: "Competitor domains, one per line.",
          },
          {
            key: "focusTopic",
            label: "Focus topic / service",
            type: "textarea",
            rows: 2,
          },
        ],
      },
      {
        slug: "broken-link-building",
        label: "Broken-Link Building",
        blurb:
          "Find broken-link replacement opportunities pointing to our content.",
        fields: [
          {
            key: "topic",
            label: "Resource topic",
            type: "textarea",
            required: true,
            rows: 2,
          },
          {
            key: "targetResource",
            label: "Our resource to pitch (URL or description)",
            type: "textarea",
            rows: 3,
          },
        ],
      },
      {
        slug: "digital-pr-angles",
        label: "Digital PR Angles",
        blurb:
          "Story hooks journalists actually pick up. Data-led where possible.",
        fields: [
          {
            key: "newsHook",
            label: "What's newsworthy?",
            type: "textarea",
            required: true,
            rows: 3,
          },
          {
            key: "targetAudience",
            label: "Target audience / publications",
            type: "textarea",
            rows: 2,
          },
        ],
      },
    ],
  },
  {
    name: "Local SEO",
    slug: "local-seo",
    Icon: MapPin,
    blurb: "Win the map pack and local searches.",
    actions: [
      {
        slug: "gmb-profile-audit",
        label: "GMB Profile Audit",
        blurb:
          "Audit a Google Business Profile against current best practice.",
        fields: [
          {
            key: "gmbProfileUrl",
            label: "GMB profile URL",
            type: "text",
            placeholder: "Paste the Google Maps share link or business name.",
          },
          {
            key: "observations",
            label: "Notes / current state",
            type: "textarea",
            rows: 4,
            placeholder:
              "Categories used, posting cadence, review count + recency, photos, services listed.",
          },
        ],
      },
      {
        slug: "gmb-posts",
        label: "GMB Posts Creation",
        titleTemplate: "Create GMB Posts for {client}",
        blurb:
          "Generates 1–3 on-brand Google Posts. Pick whether the image comes from the client's own photos (faster, always on-brand) or is AI-generated (more flexible). Caption + CTA always come from Claude.",
        fields: [
          {
            key: "imageSource",
            label: "Where should the image come from?",
            type: "segmented",
            required: true,
            options: ["Use client's photos", "AI-generate (Gemini)"],
            defaultValue: "Use client's photos",
            helpText:
              "Client's photos: app picks a random image from uploads + Drive folders and Claude writes a caption that matches it. AI-generate: Gemini creates a new image using the client's photos as brand reference.",
          },
          {
            key: "postCount",
            label: "How many posts?",
            type: "select",
            required: true,
            options: ["1", "2", "3"],
            defaultValue: "2",
            helpText:
              "1 = single hero post. 2–3 = a small content batch (different angles) you can schedule across the week.",
          },
          {
            key: "postGoal",
            label: "Post type",
            type: "select",
            required: true,
            options: ["Update", "Offer", "Event", "Product"],
            defaultValue: "Update",
            helpText:
              "Choosing Offer / Event / Product surfaces extra fields below so the post includes real specifics (discount, dates, price).",
          },
          // ===== Shared: theme/focus + CTA URL =====
          {
            key: "theme",
            label: "Theme / focus (optional)",
            type: "textarea",
            rows: 3,
            placeholder:
              "Anything specific you want the posts to cover this week — a service push, a clinic anniversary, a local event, a holiday tie-in. Leave blank and Claude will pick angles from the brief + onboarding.",
          },
          // ===== Update-specific =====
          {
            key: "updateDetails",
            label: "Anything to spotlight (optional)",
            type: "textarea",
            rows: 3,
            placeholder:
              "News, milestones, hires, new equipment, opening-hours changes — anything the caption should state literally.",
            showWhen: { field: "postGoal", equals: "Update" },
          },
          // ===== Offer-specific =====
          {
            key: "offerTitle",
            label: "Offer headline",
            type: "text",
            required: true,
            placeholder: "e.g. 20% off first consultation",
            showWhen: { field: "postGoal", equals: "Offer" },
          },
          {
            key: "offerDiscount",
            label: "Discount (amount or %)",
            type: "text",
            placeholder: "e.g. 20%, €30, BOGO, free with first session",
            showWhen: { field: "postGoal", equals: "Offer" },
          },
          {
            key: "offerValidFrom",
            label: "Valid from",
            type: "date",
            showWhen: { field: "postGoal", equals: "Offer" },
          },
          {
            key: "offerValidUntil",
            label: "Valid until",
            type: "date",
            showWhen: { field: "postGoal", equals: "Offer" },
          },
          {
            key: "offerTerms",
            label: "Terms / conditions (optional)",
            type: "textarea",
            rows: 2,
            placeholder:
              "Anything that needs to be in fine print — new clients only, max 1 per person, etc.",
            showWhen: { field: "postGoal", equals: "Offer" },
          },
          // ===== Event-specific =====
          {
            key: "eventTitle",
            label: "Event title",
            type: "text",
            required: true,
            placeholder: "e.g. Open Day · Mental Health Awareness Workshop",
            showWhen: { field: "postGoal", equals: "Event" },
          },
          {
            key: "eventStart",
            label: "Event start (date)",
            type: "date",
            required: true,
            showWhen: { field: "postGoal", equals: "Event" },
          },
          {
            key: "eventEnd",
            label: "Event end (date)",
            type: "date",
            showWhen: { field: "postGoal", equals: "Event" },
          },
          {
            key: "eventTime",
            label: "Event time (optional)",
            type: "text",
            placeholder: "e.g. 14:00–16:00",
            showWhen: { field: "postGoal", equals: "Event" },
          },
          {
            key: "eventLocation",
            label: "Event location (optional)",
            type: "text",
            placeholder:
              "Defaults to the clinic. Override if it's held elsewhere.",
            showWhen: { field: "postGoal", equals: "Event" },
          },
          {
            key: "eventDetails",
            label: "Event details (optional)",
            type: "textarea",
            rows: 3,
            placeholder:
              "Speakers, agenda, what attendees will learn / experience, dress code, registration link.",
            showWhen: { field: "postGoal", equals: "Event" },
          },
          // ===== Product-specific =====
          {
            key: "productName",
            label: "Product / service name",
            type: "text",
            required: true,
            placeholder: "e.g. Avaliação inicial · Pacote 6 sessões",
            showWhen: { field: "postGoal", equals: "Product" },
          },
          {
            key: "productPrice",
            label: "Price (optional)",
            type: "text",
            placeholder: "e.g. €60 · Starting at €120",
            showWhen: { field: "postGoal", equals: "Product" },
          },
          {
            key: "productHighlights",
            label: "Key highlights (optional)",
            type: "textarea",
            rows: 3,
            placeholder:
              "What makes this product/service notable — duration, who it's for, included sessions, etc.",
            showWhen: { field: "postGoal", equals: "Product" },
          },
          // ===== Shared CTA =====
          {
            key: "ctaUrl",
            label: "Default CTA URL (optional)",
            type: "text",
            placeholder: "https://client-site.com/book",
          },
        ],
      },
      {
        slug: "local-citation-check",
        label: "Local Citation Check",
        blurb:
          "Checklist of citations to verify for NAP consistency in this geo.",
        fields: [
          {
            key: "businessName",
            label: "Business name (exact)",
            type: "text",
            required: true,
          },
          {
            key: "nap",
            label: "NAP block",
            type: "textarea",
            required: true,
            rows: 4,
            placeholder: "Name + full address + phone — exactly as on the GMB.",
          },
          {
            key: "geo",
            label: "Geo target",
            type: "location",
            defaultValue: "Portugal (national)",
          },
        ],
      },
      {
        slug: "gmb-reviews-responder",
        label: "GMB Reviews Responder",
        blurb: "Reply drafts that follow YMYL + brand-voice guardrails.",
        fields: [
          {
            key: "reviewText",
            label: "Review text",
            type: "textarea",
            required: true,
            rows: 5,
          },
          {
            key: "sentiment",
            label: "Sentiment",
            type: "select",
            options: ["Positive", "Neutral", "Negative"],
            defaultValue: "Positive",
          },
          {
            key: "responseGoal",
            label: "Response goal (optional)",
            type: "textarea",
            rows: 2,
            placeholder:
              "e.g. encourage a return visit, move the conversation off-platform.",
          },
        ],
      },
    ],
  },
  {
    name: "Content",
    slug: "content",
    Icon: PenLine,
    blurb: "Plan and produce content that ranks.",
    actions: [
      {
        slug: "write-blog-article",
        label: "Write Blog Article",
        blurb:
          "Dedicated long-form writer agent. Triple-checks client brief, researches references, plans internal links, then drafts and self-audits.",
        titleTemplate: "New article for {client}",
        generateButtonLabel: "Brief → Research → Draft",
        fields: [
          {
            key: "topic",
            label: "Article topic",
            type: "textarea",
            required: true,
            rows: 2,
            placeholder: "Working title or angle.",
          },
          PRIMARY_KEYWORD,
          {
            key: "secondaryKeywords",
            label: "Secondary keywords",
            type: "textarea",
            rows: 3,
            placeholder: "One per line.",
          },
          {
            key: "lsiKeywords",
            label: "LSI keywords (optional)",
            type: "textarea",
            rows: 3,
            placeholder:
              "One per line. Used 1–2× each, often in H3s, so Google can disambiguate the topic.",
          },
          {
            key: "wordCount",
            label: "Target length",
            type: "select",
            options: ["800", "1200", "1800", "2500"],
            defaultValue: "1500",
          },
          {
            key: "audience",
            label: "Audience (optional)",
            type: "textarea",
            rows: 2,
          },
          {
            key: "internalLinkInventory",
            label: "Internal link inventory (optional)",
            type: "textarea",
            rows: 5,
            placeholder:
              "Paste real URLs or page titles from the client's site so the writer can plan accurate internal links. One per line. If left empty, the writer infers candidates and flags them for verification.",
          },
          {
            key: "referenceFocus",
            label: "Reference focus (optional)",
            type: "textarea",
            rows: 3,
            placeholder:
              "Specific authoritative sources or angles the client wants cited (e.g. \"SNS guidelines on lower-back pain\", \"PubMed 2024 meta-analysis on dental implants\").",
          },
          {
            key: "ctaTarget",
            label: "Primary CTA target (optional)",
            type: "text",
            placeholder:
              "URL or slug for the bottom-funnel CTA — booking page, service page, lead magnet.",
          },
        ],
      },
      {
        slug: "content-calendar",
        label: "Content Calendar",
        blurb:
          "Cadenced editorial calendar built around topical authority clusters.",
        fields: [
          {
            key: "timeframe",
            label: "Timeframe",
            type: "select",
            required: true,
            options: ["1 month", "3 months", "6 months"],
            defaultValue: "3 months",
          },
          {
            key: "themes",
            label: "Themes / clusters",
            type: "textarea",
            required: true,
            rows: 4,
            placeholder: "Topic pillars you want covered.",
          },
          {
            key: "cadence",
            label: "Publishing cadence",
            type: "select",
            options: ["Weekly", "Bi-weekly", "Monthly"],
            defaultValue: "Weekly",
          },
        ],
      },
      {
        slug: "blog-roadmap",
        label: "Blog Roadmap",
        blurb:
          "Hub + spoke topic cluster: pillar page + supporting article titles + internal link map.",
        fields: [
          {
            key: "topicCluster",
            label: "Pillar topic",
            type: "text",
            required: true,
            placeholder: "e.g. dental implants",
          },
          {
            key: "audience",
            label: "Audience",
            type: "textarea",
            rows: 2,
          },
          {
            key: "goals",
            label: "Business goals",
            type: "textarea",
            rows: 2,
          },
        ],
      },
      {
        slug: "refresh-existing-content",
        label: "Refresh Existing Content",
        blurb:
          "Diagnose + rewrite plan for a page that's lost rankings or freshness.",
        fields: [
          URL_FIELD,
          {
            key: "currentIssues",
            label: "Current issues",
            type: "textarea",
            rows: 4,
            placeholder:
              "What's wrong? Outdated info? Thin coverage? Lost rankings? Paste anything you know.",
          },
          {
            key: "targetKeyword",
            label: "Target keyword",
            type: "text",
          },
        ],
      },
      {
        slug: "faq-section-generator",
        label: "FAQ Section Generator",
        blurb:
          "PAA-mining FAQs that win featured snippets and FAQPage schema slots.",
        fields: [
          {
            key: "topic",
            label: "Page or product topic",
            type: "textarea",
            required: true,
            rows: 2,
          },
          {
            key: "audience",
            label: "Audience (optional)",
            type: "textarea",
            rows: 2,
          },
          {
            key: "tone",
            label: "Tone",
            type: "select",
            options: ["Friendly", "Professional", "Conversational"],
            defaultValue: "Professional",
          },
        ],
      },
    ],
  },
];

export type ActionEntry = {
  action: ActionDef;
  pillar: Pillar;
};

export const ALL_ACTIONS: ActionEntry[] = PILLARS.flatMap((pillar) =>
  pillar.actions.map((action) => ({ action, pillar })),
);

export function findAction(slugOrLabel: string): ActionEntry | undefined {
  return (
    ALL_ACTIONS.find((a) => a.action.slug === slugOrLabel) ??
    ALL_ACTIONS.find((a) => a.action.label === slugOrLabel)
  );
}

export function findPillar(slug: string): Pillar | undefined {
  return PILLARS.find((p) => p.slug === slug);
}
