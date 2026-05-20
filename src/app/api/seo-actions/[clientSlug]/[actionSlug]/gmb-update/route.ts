// PATCH a single GMB post within a generation — used by the inline edit
// UI on the result page (caption + CTA + status changes).

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  GMB_POST_STATUSES,
  updateGmbPost,
  type GmbCta,
  type GmbPost,
  type GmbPostStatus,
} from "@/lib/gmb-posts-store";

export const runtime = "nodejs";

type Body = {
  resultId?: string;
  postId?: string;
  patch?: Partial<GmbPost>;
};

const VALID_CTAS = new Set<GmbCta>([
  "Learn more",
  "Book",
  "Order online",
  "Buy",
  "Sign up",
  "Call now",
  null,
]);

export async function POST(
  req: Request,
  ctx: { params: Promise<{ clientSlug: string; actionSlug: string }> },
) {
  const { clientSlug } = await ctx.params;
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { resultId, postId, patch } = body;
  if (!resultId || !postId || !patch) {
    return NextResponse.json(
      { error: "resultId, postId, and patch are required." },
      { status: 400 },
    );
  }
  const cleaned: Partial<GmbPost> = {};
  if (typeof patch.caption === "string") {
    cleaned.caption = patch.caption.slice(0, 1500);
  }
  if (typeof patch.ctaUrl === "string" || patch.ctaUrl === null) {
    cleaned.ctaUrl = patch.ctaUrl;
  }
  if (patch.cta === null || (patch.cta && VALID_CTAS.has(patch.cta))) {
    cleaned.cta = patch.cta;
  }
  if (
    typeof patch.status === "string" &&
    (GMB_POST_STATUSES as readonly string[]).includes(patch.status)
  ) {
    cleaned.status = patch.status as GmbPostStatus;
  }
  const updated = await updateGmbPost(clientSlug, resultId, postId, cleaned);
  if (!updated) {
    return NextResponse.json({ error: "Result not found." }, { status: 404 });
  }
  revalidatePath(
    `/seo/${clientSlug}/actions/gmb-posts/results/${resultId}`,
  );
  return NextResponse.json({ ok: true, result: updated });
}
