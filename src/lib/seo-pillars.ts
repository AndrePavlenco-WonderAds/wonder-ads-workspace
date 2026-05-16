import {
  FileText,
  Globe,
  MapPin,
  PenLine,
  Gauge,
  type LucideIcon,
} from "lucide-react";

export type Pillar = {
  name: string;
  Icon: LucideIcon;
  blurb: string;
  actions: string[];
  fullWidth?: boolean;
};

export const PILLARS: Pillar[] = [
  {
    name: "Overall SEO",
    Icon: Gauge,
    blurb: "High-level audits and strategic research.",
    actions: ["SEO Audit", "Keyword Research"],
    fullWidth: true,
  },
  {
    name: "On-Page SEO",
    Icon: FileText,
    blurb: "Optimise what's on the page itself.",
    actions: [
      "Generate Header Tags",
      "Meta Title & Description",
      "Image Alt Text",
      "Internal Linking Suggestions",
      "Schema Markup (JSON-LD)",
      "Content Gap Analysis",
    ],
  },
  {
    name: "Off-Page SEO",
    Icon: Globe,
    blurb: "Build authority from outside the site.",
    actions: [
      "Find Backlink Directories",
      "Outreach Email Drafts",
      "Competitor Backlink Gap",
      "Broken-Link Building",
      "Digital PR Angles",
    ],
  },
  {
    name: "Local SEO",
    Icon: MapPin,
    blurb: "Win the map pack and local searches.",
    actions: [
      "GMB Profile Audit",
      "GMB Posts Creation",
      "Local Citation Check",
      "GMB Reviews Responder",
    ],
  },
  {
    name: "Content",
    Icon: PenLine,
    blurb: "Plan and produce content that ranks.",
    actions: [
      "Write Blog Article",
      "Content Calendar",
      "Blog Roadmap",
      "Refresh Existing Content",
      "FAQ Section Generator",
    ],
  },
];

export type ActionEntry = {
  label: string;
  pillar: Pillar;
};

export const ALL_ACTIONS: ActionEntry[] = PILLARS.flatMap((pillar) =>
  pillar.actions.map((label) => ({ label, pillar })),
);

export function findAction(label: string): ActionEntry | undefined {
  return ALL_ACTIONS.find((a) => a.label === label);
}
