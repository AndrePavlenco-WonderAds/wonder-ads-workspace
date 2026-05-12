import { Code2 } from "lucide-react";
import { DepartmentPage } from "@/components/department-page";

export const metadata = {
  title: "WEB DPT — Wonder Ads Workspace",
};

export default function WebPage() {
  return (
    <DepartmentPage
      title="WEB DPT"
      tagline="High-converting websites, landing pages and dev work. Design systems, builds, integrations and post-launch optimisation all live here."
      Icon={Code2}
    />
  );
}
