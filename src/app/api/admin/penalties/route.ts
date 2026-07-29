// Disciplinary entries — SuperAdmin only.
//
//   GET    → every entry (newest incident first)
//   POST   → log an entry
//   PATCH  → soft-remove (?) / restore an entry
//
// Removal is a soft delete carrying a reason and an author: a disciplinary
// log that can be silently erased has no evidential value.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin, getCurrentEmployee } from "@/lib/auth/server";
import {
  listPenalties,
  addPenalty,
  removePenalty,
  restorePenalty,
  PENALTY_SEVERITIES,
  type PenaltySeverity,
} from "@/lib/admin-penalties-store";

export const runtime = "nodejs";

const DENY = NextResponse.json(
  { error: "Não há permissões suficientes." },
  { status: 403 },
);

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

async function author(): Promise<string> {
  const e = await getCurrentEmployee().catch(() => null);
  return e?.name || e?.username || "SuperAdmin";
}

export async function GET() {
  if (!(await isCurrentUserAdmin())) return DENY;
  return NextResponse.json(await listPenalties());
}

export async function POST(req: Request) {
  if (!(await isCurrentUserAdmin())) return DENY;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const employeeId =
    typeof body.employeeId === "string" ? body.employeeId.trim() : "";
  const employeeName =
    typeof body.employeeName === "string" ? body.employeeName.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const severityRaw = Number(body.severity);
  const occurredOn =
    typeof body.occurredOn === "string" && ISO_DAY.test(body.occurredOn)
      ? body.occurredOn
      : new Date().toISOString().slice(0, 10);

  if (!employeeId || !employeeName) {
    return NextResponse.json({ error: "Escolhe o colaborador." }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: "O título é obrigatório." }, { status: 400 });
  }
  if (!PENALTY_SEVERITIES.includes(severityRaw as PenaltySeverity)) {
    return NextResponse.json({ error: "Gravidade inválida." }, { status: 400 });
  }
  // A future incident date is a typo, not a record.
  if (occurredOn > new Date().toISOString().slice(0, 10)) {
    return NextResponse.json(
      { error: "A data da ocorrência não pode estar no futuro." },
      { status: 400 },
    );
  }

  try {
    const entry = await addPenalty({
      employeeId,
      employeeName,
      departments: Array.isArray(body.departments)
        ? body.departments.filter((d): d is string => typeof d === "string")
        : [],
      severity: severityRaw as PenaltySeverity,
      title,
      description,
      occurredOn,
      createdBy: await author(),
      nowMs: Date.now(),
    });
    revalidatePath("/admin/penalties");
    revalidatePath("/admin");
    return NextResponse.json({ ok: true, entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  if (!(await isCurrentUserAdmin())) return DENY;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  const action = body.action === "restore" ? "restore" : "remove";
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  try {
    const ok =
      action === "restore"
        ? await restorePenalty(id)
        : await removePenalty(
            id,
            await author(),
            typeof body.reason === "string" ? body.reason.trim() : "",
            Date.now(),
          );
    if (!ok) {
      return NextResponse.json(
        { error: "Registo não encontrado ou já nesse estado." },
        { status: 404 },
      );
    }
    revalidatePath("/admin/penalties");
    revalidatePath("/admin");
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
