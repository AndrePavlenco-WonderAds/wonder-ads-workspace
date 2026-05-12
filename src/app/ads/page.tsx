import { Megaphone } from "lucide-react";
import { DepartmentPage } from "@/components/department-page";

export const metadata = {
  title: "ADS DPT — Wonder Ads Workspace",
};

export default function AdsPage() {
  return (
    <DepartmentPage
      title="ADS DPT"
      tagline="Paid media, performance campaigns and creative. Strategy, launch plans, creative briefs and active campaign monitoring all live here."
      Icon={Megaphone}
    />
  );
}
