// Atribuição das especializações de um consultor. SuperAdmin apenas.
//   POST { username, trackSlugs: [...] } — atribui ([] = sem especialização)
//   POST { username, clear: true }       — remove a atribuição, volta ao dept
//
// Uma pessoa pode ter mais do que uma especialização, daí a lista.
// Quem atribuiu fica gravado a partir da sessão, nunca do payload.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/auth/server";
import {
  clearEnrollment,
  setEnrollment,
} from "@/lib/training/enrollments-store";
import {
  SPECIALIZATION_SLUGS,
  type SpecializationSlug,
} from "@/lib/training/catalog";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee?.isAdmin) {
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
  const { username, trackSlugs, clear } = (body ?? {}) as {
    username?: unknown;
    trackSlugs?: unknown;
    clear?: unknown;
  };
  if (typeof username !== "string" || !username.trim()) {
    return NextResponse.json({ error: "username em falta" }, { status: 400 });
  }

  // `clear` remove a atribuição e devolve a pessoa ao default do departamento.
  if (clear === true) {
    try {
      const map = await clearEnrollment(username.trim().toLowerCase());
      revalidatePath("/formacao/admin");
      revalidatePath("/formacao/admin/inscricoes");
      return NextResponse.json({ ok: true, enrollments: map });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
  if (!Array.isArray(trackSlugs)) {
    return NextResponse.json(
      { error: "trackSlugs tem de ser uma lista." },
      { status: 400 },
    );
  }
  // Um slug desconhecido é rejeitado em vez de silenciosamente descartado —
  // gravar menos especializações do que o C-Level escolheu seria pior do que
  // falhar de forma visível.
  const invalid = trackSlugs.filter(
    (s) =>
      typeof s !== "string" ||
      !(SPECIALIZATION_SLUGS as readonly string[]).includes(s),
  );
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: "Especialização inválida." },
      { status: 400 },
    );
  }

  try {
    const map = await setEnrollment(
      username.trim().toLowerCase(),
      trackSlugs as SpecializationSlug[],
      employee.username,
      Date.now(),
    );
    revalidatePath("/formacao/admin");
    revalidatePath("/formacao/admin/inscricoes");
    return NextResponse.json({ ok: true, enrollments: map });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
