// Delete the most recent NPS submission. SuperAdmin-only (Alex, Alice,
// Andre) — everyone else gets a 403 with a clear message. Auth is enforced
// in-route because /api/nps is not matched by middleware.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/auth/server";
import { removeLatestNps } from "@/lib/nps-store";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const employee = await getCurrentEmployee();
  if (!employee) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }
  if (!employee.isAdmin) {
    return NextResponse.json(
      { error: "Não há permissões suficientes." },
      { status: 403 },
    );
  }

  const { slug } = await ctx.params;
  const removed = await removeLatestNps(slug);
  if (!removed) {
    return NextResponse.json(
      { error: "Não há avaliações para apagar." },
      { status: 404 },
    );
  }

  revalidatePath(`/seo/${slug}/nps`);
  revalidatePath(`/seo/${slug}`);
  return NextResponse.json({ ok: true, removedId: removed.id });
}
