import {
  Search,
  FileSearch,
  Wrench,
  FileText,
  Link as LinkIcon,
  Users,
  MapPin,
  Code2,
  Network,
  Gauge,
  Smartphone,
  GitBranch,
  Calendar,
  TrendingUp,
  ShieldCheck,
  Globe,
  Languages,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { DepartmentHeader } from "@/components/department-header";
import { ClaudeChat } from "@/components/claude-chat";
import { KpisCard } from "@/components/kpis-card";
import { ProjectGrid } from "@/components/project-grid";
import type { Project } from "@/components/project-card";

export const metadata = {
  title: "SEO DPT — Wonder Ads Workspace",
};

const SEO_PROJECTS: Project[] = [
  { title: "Keyword Research", tagline: "Volume, intent, opportunity mapping.", Icon: Search },
  { title: "Technical Audit", tagline: "Crawl, index, render — full diagnostic.", Icon: Wrench },
  { title: "On-Page SEO", tagline: "Titles, meta, headings, copy optimisation.", Icon: FileText },
  { title: "Content Strategy", tagline: "Topical maps, briefs, editorial planning.", Icon: FileSearch },
  { title: "Backlinks", tagline: "Outreach, digital PR, link earning.", Icon: LinkIcon },
  { title: "Competitor Analysis", tagline: "Gap analysis, SERP mapping.", Icon: Users },
  { title: "Local SEO", tagline: "GMB, citations, local rankings.", Icon: MapPin },
  { title: "Schema Markup", tagline: "Structured data and rich results.", Icon: Code2 },
  { title: "Site Architecture", tagline: "URL, taxonomy, crawl hierarchy.", Icon: Network },
  { title: "Page Speed", tagline: "Core Web Vitals, performance budgets.", Icon: Gauge },
  { title: "Mobile UX", tagline: "Responsive, mobile-first audits.", Icon: Smartphone },
  { title: "Internal Linking", tagline: "PageRank flow, contextual links.", Icon: GitBranch },
  { title: "Content Calendar", tagline: "Publishing cadence per client.", Icon: Calendar },
  { title: "SERP Tracking", tagline: "Position monitoring & alerting.", Icon: TrendingUp },
  { title: "E-E-A-T", tagline: "Expertise, authority, trust signals.", Icon: ShieldCheck },
  { title: "International SEO", tagline: "hreflang, geo-targeting, locale SEO.", Icon: Languages },
];

export default function SeoPage() {
  return (
    <PageShell>
      <DepartmentHeader
        title="SEO DPT"
        tagline="Organic growth in Google and AIs. #1 SEO & GEO Agency in Portugal."
        Icon={Search}
      />

      <div className="mt-12 grid grid-cols-1 gap-10 lg:mt-16 lg:grid-cols-[1fr_420px]">
        <div className="order-2 space-y-10 lg:order-1">
          <ProjectGrid projects={SEO_PROJECTS} label="Projects" />
          <KpisCard />
        </div>
        <div className="order-1 lg:order-2 lg:sticky lg:top-6 lg:self-start">
          <ClaudeChat
            department="seo"
            placeholder="Ask SEO Claude — strategy, audits, briefs..."
          />
        </div>
      </div>
    </PageShell>
  );
}
