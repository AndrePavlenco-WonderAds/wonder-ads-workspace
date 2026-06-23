// Run the Keyword Research backtest for a client: compare the last
// research's DataforSEO predictions against real GSC performance, persist
// the confidence report (so the next research run can learn from it), and
// return a markdown report for the consultant.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { canAccessDept } from "@/lib/auth/credentials";
import {
  runKwBacktest,
  formatBacktestMarkdown,
} from "@/lib/seo-tools/kw-backtest";
import { saveKwBacktest } from "@/lib/kw-backtest-store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const employee = await getCurrentEmployee();
  if (!employee || !canAccessDept(employee.username, "seo")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await runKwBacktest(slug);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await saveKwBacktest(slug, result);

  return NextResponse.json({
    report: result,
    markdown: formatBacktestMarkdown(result),
  });
}
