import {
  Megaphone,
  Sparkles,
  BarChart3,
  Image as ImageIcon,
} from "lucide-react";
import { SiGoogle, SiMeta, SiTiktok, SiLinkedin } from "@/components/brand-icons";
import { PageShell } from "@/components/page-shell";
import { DepartmentHeader } from "@/components/department-header";
import { ProjectGrid } from "@/components/project-grid";
import type { Project } from "@/components/project-card";

export const metadata = {
  title: "ADS DPT — Wonder Ads Workspace",
};

const ADS_PROJECTS: Project[] = [
  { title: "Google Ads", tagline: "Search, Performance Max, Display.", Icon: SiGoogle },
  { title: "Meta Ads", tagline: "Facebook + Instagram performance campaigns.", Icon: SiMeta },
  { title: "TikTok Ads", tagline: "Video-first campaigns & creator collabs.", Icon: SiTiktok },
  { title: "LinkedIn Ads", tagline: "B2B targeting & lead-gen forms.", Icon: SiLinkedin },
  { title: "Creative Production", tagline: "Static, video & UGC ad creative.", Icon: ImageIcon },
  { title: "Campaign Reporting", tagline: "ROAS, CAC, attribution & dashboards.", Icon: BarChart3 },
];

export default function AdsPage() {
  return (
    <PageShell>
      <DepartmentHeader
        title="ADS DPT"
        tagline="Paid media, performance campaigns and creative. Strategy, launch plans, creative briefs and active campaign monitoring all live here."
        Icon={Megaphone}
      />

      <div className="mt-12 sm:mt-16">
        <ProjectGrid projects={ADS_PROJECTS} label="Channels" />
      </div>
    </PageShell>
  );
}
