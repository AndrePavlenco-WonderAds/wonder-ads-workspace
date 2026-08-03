// Gravar / repor o catálogo da Formação (CMS interno). SuperAdmin apenas.
//   POST   { data }  → grava o catálogo inteiro (validado e normalizado)
//   DELETE           → repõe o catálogo original do código
//
// Mesmo contrato do editor de onboarding de clientes: o servidor normaliza e
// recusa estruturas inválidas, por isso uma edição má nunca consegue partir a
// formação de quem está a meio dela.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/auth/server";
import {
  resetTrainingCatalog,
  saveTrainingCatalog,
} from "@/lib/training/content-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json(
      { error: "Não há permissões suficientes." },
      { status: 403 },
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { data } = (body ?? {}) as { data?: unknown };
  try {
    const saved = await saveTrainingCatalog(data);
    revalidatePath("/formacao", "layout");
    return NextResponse.json({ ok: true, data: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json(
      { error: "Não há permissões suficientes." },
      { status: 403 },
    );
  }
  try {
    await resetTrainingCatalog();
    revalidatePath("/formacao", "layout");
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
