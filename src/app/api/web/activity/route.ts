// Web Dept activity feed — recent changes across all projects.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { accessibleDepts } from "@/lib/auth/credentials";
import { getActivity, webStorageConfigured } from "@/lib/web-projects-store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee || !accessibleDepts(employee).includes("web")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!webStorageConfigured) {
    return NextResponse.json({ activity: [], storageConfigured: false });
  }
  const url = new URL(req.url);
  const limit = Math.min(
    500,
    Math.max(1, Number(url.searchParams.get("limit")) || 200),
  );
  const activity = await getActivity(limit);
  return NextResponse.json({ activity, storageConfigured: true });
}
