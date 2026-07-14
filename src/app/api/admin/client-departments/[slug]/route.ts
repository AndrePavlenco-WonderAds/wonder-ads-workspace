// Set the department (service) list for an existing client. Admin-gated.
// Writes an authoritative override consumed by buildAdminClientViews so the
// client's rows in the finance table match the chosen services.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/auth/server";
import { setClientDepartments } from "@/lib/admin-client-departments-store";
import { CLIENT_DEPARTMENTS, type ClientDepartment } from "@/lib/admin-clients-store";

export const runtime = "nodejs";

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const { slug } = await ctx.params;
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const departments = Array.isArray(body.departments)
    ? (body.departments.filter((d): d is ClientDepartment =>
        (CLIENT_DEPARTMENTS as readonly string[]).includes(d as string),
      ) as ClientDepartment[])
    : [];
  if (departments.length === 0) {
    return NextResponse.json(
      { error: "Escolhe pelo menos um departamento." },
      { status: 400 },
    );
  }
  try {
    const saved = await setClientDepartments(slug, departments);
    revalidatePath("/admin/projects");
    revalidatePath("/admin/finances");
    revalidatePath("/admin/calendar");
    return NextResponse.json({ ok: true, departments: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
