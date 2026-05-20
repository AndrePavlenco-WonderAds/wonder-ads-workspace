// Inline-edit endpoint for a single MetaTagsRow. Called by the table
// component on every debounced edit (optimizedTitle / optimizedMeta).

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { updateMetaTagsRow, type MetaTagsRow } from "@/lib/meta-tags-store";

export const runtime = "nodejs";

type Body = {
  resultId?: string;
  rowId?: string;
  patch?: Partial<MetaTagsRow>;
};

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
  const { resultId, rowId, patch } = body;
  if (!resultId || !rowId || !patch) {
    return NextResponse.json(
      { error: "resultId, rowId, and patch are required." },
      { status: 400 },
    );
  }
  // Whitelist only the fields the UI is allowed to edit. The public
  // preview is read-only so this path is consultant-side only — still,
  // belt-and-braces.
  const cleaned: Partial<MetaTagsRow> = {};
  if (typeof patch.optimizedTitle === "string") {
    cleaned.optimizedTitle = patch.optimizedTitle.slice(0, 200);
  }
  if (typeof patch.optimizedMeta === "string") {
    cleaned.optimizedMeta = patch.optimizedMeta.slice(0, 300);
  }
  if (typeof patch.primaryKeyword === "string" || patch.primaryKeyword === null) {
    cleaned.primaryKeyword =
      typeof patch.primaryKeyword === "string"
        ? patch.primaryKeyword.slice(0, 120)
        : null;
  }
  const updated = await updateMetaTagsRow(clientSlug, resultId, rowId, cleaned);
  if (!updated) {
    return NextResponse.json({ error: "Row not found" }, { status: 404 });
  }
  revalidatePath(
    `/seo/${clientSlug}/actions/meta-title-description/results/${resultId}`,
  );
  revalidatePath(`/${clientSlug}/preview/meta-tags/${resultId}`);
  return NextResponse.json({ ok: true });
}
