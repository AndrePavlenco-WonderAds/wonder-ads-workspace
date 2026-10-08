// Public read + append endpoint for the Pending Review table.
// READ: no auth — the URL is the access control. This is intentional;
// the slug IS the share secret as far as the client side is
// concerned, mirroring how share-link Drive files work. Os carimbos de
// autoria (quem adicionou / quem pôs para aprovação) só saem para quem tem
// sessão com acesso à consola interna.
// APPEND (v77.79): só utilizadores da app — o cliente nunca adiciona
// linhas, e cada linha nova fica assinada por quem a pôs.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  appendReviewItem,
  filterPublicItems,
  listReviewItems,
  REVIEW_CATEGORIES,
  REVIEW_STATUSES,
  toPublicReviewItem,
  type ReviewCategory,
  type ReviewStatus,
} from "@/lib/review-store";
import {
  IMPERSONATION_WRITE_ERROR,
  getReviewRequester,
} from "@/lib/review-requester";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const url = new URL(req.url);
  // The internal review page opts in with ?includeArchived=1 so the
  // Archive tab + auto-poll see archived rows. The public client page
  // omits the param and gets a filtered list — clients never see
  // archived work.
  const includeArchived = url.searchParams.get("includeArchived") === "1";
  const [raw, requester] = await Promise.all([
    listReviewItems(slug),
    getReviewRequester(),
  ]);
  const visible = includeArchived ? raw : filterPublicItems(raw);
  const items = requester.access
    ? visible
    : visible.map(toPublicReviewItem);
  return NextResponse.json({ items });
}

/** Append a single new item. Body schema:
 *    { task: string, status?, category?, docLink?, sourceType?, sourceUrl?, approvalDate?, publishingDate?, notes? }
 *  Called from internal "Send to Review" buttons on action result
 *  pages. The public table writes to /items/[id], not here. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const requester = await getReviewRequester();
  if (!requester.actor || !requester.access) {
    return NextResponse.json(
      { error: "Só a equipa pode adicionar linhas a esta tabela." },
      { status: requester.actor ? 403 : 401 },
    );
  }
  if (requester.impersonating) {
    return NextResponse.json({ error: IMPERSONATION_WRITE_ERROR }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const task = typeof body.task === "string" ? body.task.trim() : "";
  if (!task) {
    return NextResponse.json({ error: "task is required" }, { status: 400 });
  }
  const status: ReviewStatus =
    typeof body.status === "string" &&
    (REVIEW_STATUSES as readonly string[]).includes(body.status)
      ? (body.status as ReviewStatus)
      : "For Approval";
  const category: ReviewCategory =
    typeof body.category === "string" &&
    (REVIEW_CATEGORIES as readonly string[]).includes(body.category)
      ? (body.category as ReviewCategory)
      : "Other";
  const partial: Parameters<typeof appendReviewItem>[1] = {
    task: task.slice(0, 240),
    status,
    category,
    approvalDate:
      typeof body.approvalDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(body.approvalDate)
        ? body.approvalDate
        : null,
    publishingDate:
      typeof body.publishingDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(body.publishingDate)
        ? body.publishingDate
        : null,
    docLink:
      typeof body.docLink === "string" && /^https?:\/\//i.test(body.docLink)
        ? body.docLink.slice(0, 1000)
        : null,
    notes: typeof body.notes === "string" ? body.notes.slice(0, 4000) : null,
    sourceType: typeof body.sourceType === "string" ? body.sourceType : undefined,
    sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl : undefined,
  };
  const created = await appendReviewItem(slug, partial, requester.actor);
  // Bust both the public + internal page caches so the new item shows
  // up immediately.
  revalidatePath(`/${slug}/pendingreview`);
  revalidatePath(`/seo/${slug}/review`);
  revalidatePath(`/seo/${slug}`);
  return NextResponse.json({ item: created });
}
