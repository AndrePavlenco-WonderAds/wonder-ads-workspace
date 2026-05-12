import {
  Code2,
  LayoutTemplate,
  ShoppingCart,
  Plug,
  Gauge,
  Wrench,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { DepartmentHeader } from "@/components/department-header";
import { ProjectGrid } from "@/components/project-grid";
import type { Project } from "@/components/project-card";

export const metadata = {
  title: "WEB DPT — Wonder Ads Workspace",
};

const WEB_PROJECTS: Project[] = [
  { title: "Landing Pages", tagline: "Conversion-focused single-page builds.", Icon: LayoutTemplate },
  { title: "WordPress Sites", tagline: "Themes, ACF, custom blocks.", Icon: Wrench },
  { title: "Custom Builds", tagline: "Next.js, headless CMS, bespoke apps.", Icon: Code2 },
  { title: "E-commerce", tagline: "Shopify, WooCommerce, Stripe checkout.", Icon: ShoppingCart },
  { title: "Integrations", tagline: "CRMs, automations, analytics stacks.", Icon: Plug },
  { title: "Performance & SEO", tagline: "Core Web Vitals & on-page optimisation.", Icon: Gauge },
];

export default function WebPage() {
  return (
    <PageShell>
      <DepartmentHeader
        title="WEB DPT"
        tagline="High-converting websites, landing pages and dev work. Design systems, builds, integrations and post-launch optimisation all live here."
        Icon={Code2}
      />

      <div className="mt-12 sm:mt-16">
        <ProjectGrid projects={WEB_PROJECTS} label="Capabilities" />
      </div>
    </PageShell>
  );
}
