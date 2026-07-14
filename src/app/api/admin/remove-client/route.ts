// Cancel/remove a client from the Admin → Clients (finances) roster.
// Admin-gated. Marks the slug as removed (so Notion/ADS/Web-sourced
// clients drop off the roster) and also deletes any manually-added
// extra-client entry for the same slug.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/auth/server";
import { addRemovedSlug } from "@/lib/admin-removed-clients-store";
import { deleteExtraClient, getExtraClients } from "@/lib/admin-extra-clients-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  try {
    await addRemovedSlug(slug);
    // Tidy up the extra-clients store if this was a manually-added client.
    const extras = await getExtraClients().catch(() => []);
    if (extras.some((c) => c.slug === slug)) {
      await deleteExtraClient(slug);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  revalidatePath("/admin/projects");
  revalidatePath("/admin/finances");
  revalidatePath("/admin/calendar");
  return NextResponse.json({ ok: true });
}
