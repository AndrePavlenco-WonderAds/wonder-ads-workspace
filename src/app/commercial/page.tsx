import { Handshake } from "lucide-react";
import { DepartmentPage } from "@/components/department-page";

export const metadata = {
  title: "COMMERCIAL DPT — Wonder Ads Workspace",
};

export default function CommercialPage() {
  return (
    <DepartmentPage
      title="COMMERCIAL DPT"
      tagline="Sales pipeline, partnerships and client success. Lead flow, accounts, contracts and ongoing client work all live here."
      Icon={Handshake}
    />
  );
}
