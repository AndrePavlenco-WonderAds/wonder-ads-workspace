import {
  FileText,
  Globe,
  MapPin,
  PenLine,
  Gauge,
  type LucideIcon,
} from "lucide-react";

export type ActionFieldType = "text" | "textarea" | "select";

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
};

export type ActionToolName =
  | "crawl-page"
  | "pagespeed-mobile"
  | "pagespeed-desktop"
  | "sitemap-discovery"
  | "crawl-sample"
  | "gsc-site-data";

export type ActionDef = {
  slug: string;
  label: string;
  blurb: string;
  fields: ActionField[];
  /** Optional live-data tools to run before the LLM generation. */
  tools?: ActionToolName[];
  /** Which input field carries the URL the tools should target. Default "pageUrl". */
  toolUrlField?: string;
};

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
        slug: "seo-audit",
        label: "SEO Audit",
        blurb:
          "Site-wide audit — sitemap, sample crawl, PageSpeed and Search Console pulled live.",
        tools: [
          "sitemap-discovery",
          "crawl-page",
          "crawl-sample",
          "pagespeed-mobile",
          "pagespeed-desktop",
          "gsc-site-data",
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
            type: "text",
            defaultValue: "Portugal",
            placeholder: "Country, region, or city",
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
        label: "Meta Title & Description",
        blurb: "SERP snippets engineered for click-through.",
        fields: [
          URL_FIELD,
          PRIMARY_KEYWORD,
          {
            key: "uniqueAngle",
            label: "Unique selling angle",
            type: "textarea",
            rows: 2,
            placeholder:
              "What makes this page / offer different? Price, speed, expertise, location...",
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
            type: "text",
            defaultValue: "Portugal",
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
        blurb: "Map-pack-friendly Google Posts that read like real updates.",
        fields: [
          {
            key: "postGoal",
            label: "Post type",
            type: "select",
            required: true,
            options: ["Update", "Offer", "Event", "Product"],
            defaultValue: "Update",
          },
          {
            key: "details",
            label: "What's the news?",
            type: "textarea",
            required: true,
            rows: 4,
            placeholder: "Dates, offer details, CTA, link.",
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
            type: "text",
            defaultValue: "Portugal",
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
          "Long-form, E-E-A-T-grade article aligned to a primary keyword.",
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
