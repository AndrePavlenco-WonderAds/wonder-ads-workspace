// Atribuição da trilha de especialização de um consultor. C-Level apenas.
//   POST { username, trackSlug }        — atribui (null = sem especialização)
//   POST { username, clear: true }       — remove a atribuição, volta ao dept
//
// Quem atribuiu fica gravado a partir da sessão, nunca do payload.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/auth/server";
import {
  clearEnrollment,
  setEnrollment,
} from "@/lib/training/enrollments-store";
import { SPECIALIZATION_SLUGS } from "@/lib/training/catalog";

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
  const { username, trackSlug, clear } = (body ?? {}) as {
    username?: unknown;
    trackSlug?: unknown;
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
  const slug =
    trackSlug === null || trackSlug === ""
      ? null
      : typeof trackSlug === "string" &&
          (SPECIALIZATION_SLUGS as readonly string[]).includes(trackSlug)
        ? (trackSlug as (typeof SPECIALIZATION_SLUGS)[number])
        : undefined;
  if (slug === undefined) {
    return NextResponse.json(
      { error: "Trilha de especialização inválida." },
      { status: 400 },
    );
  }

  try {
    const map = await setEnrollment(
      username.trim().toLowerCase(),
      slug,
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
