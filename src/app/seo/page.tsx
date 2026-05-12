import { Search } from "lucide-react";
import { DepartmentPage } from "@/components/department-page";

export const metadata = {
  title: "SEO DPT — Wonder Ads Workspace",
};

export default function SeoPage() {
  return (
    <DepartmentPage
      title="SEO DPT"
      tagline="Organic growth, technical SEO & content strategy. Audits, keyword research, on-page work and ongoing reporting all live here."
      Icon={Search}
    />
  );
}
