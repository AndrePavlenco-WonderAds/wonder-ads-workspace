// Desbloqueios de um projeto em pausa (v80.36). SuperAdmin.
//   PUT    { units: UnlockUnitId[], days: 30 | 60 | 90 | null } → abre essas partes
//   DELETE { unit?: UnlockUnitId }                              → fecha uma (ou todas)
// O middleware vê a mudança em ≤ 15 s (cache por instância).

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { getPausedSlugSet } from "@/lib/admin-paused-clients-store";
import { grantUnlocks, revokeUnlock } from "@/lib/paused-unlocks-store";
import { UNLOCK_DURATIONS, unlockUnit, type UnlockUnitId } from "@/lib/paused-unlocks-shared";

export const runtime = "nodejs";

async function admin() {
  const employee = await getCurrentEmployee();
  return employee?.isAdmin ? employee : null;
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const employee = await admin();
  if (!employee) return NextResponse.json({ error: "Não há permissões suficientes." }, { status: 403 });
  const { slug } = await ctx.params;
  if (!(await getPausedSlugSet()).has(slug)) {
    return NextResponse.json({ error: "Este projeto não está em pausa." }, { status: 409 });
  }
  const body = await readBody(req);
  const units = (Array.isArray(body.units) ? body.units : [])
    .filter((u): u is string => typeof u === "string" && Boolean(unlockUnit(u))) as UnlockUnitId[];
  if (units.length === 0) return NextResponse.json({ error: "Escolhe o que desbloquear." }, { status: 400 });
  const days = body.days === null ? null : Number(body.days);
  if (!UNLOCK_DURATIONS.some((d) => d.days === days)) {
    return NextResponse.json({ error: "Escolhe o prazo: 30, 60, 90 dias ou sem prazo." }, { status: 400 });
  }
  try {
    const project = await grantUnlocks(slug, units, days, employee.name);
    return NextResponse.json({ ok: true, unlocks: project });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Falhou." }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const employee = await admin();
  if (!employee) return NextResponse.json({ error: "Não há permissões suficientes." }, { status: 403 });
  const { slug } = await ctx.params;
  const body = await readBody(req);
  const unit = typeof body.unit === "string" && unlockUnit(body.unit) ? (body.unit as UnlockUnitId) : undefined;
  try {
    const project = await revokeUnlock(slug, unit);
    return NextResponse.json({ ok: true, unlocks: project });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Falhou." }, { status: 500 });
  }
}
