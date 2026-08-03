// Gravar / repor as regras de notificação. SuperAdmin apenas.
//   POST   { data }  → grava a lista inteira (validada e normalizada)
//   DELETE           → repõe as regras de origem definidas em código
//
// O layout do /admin já protege a página, mas a rota volta a verificar por si:
// um layout só protege o que é renderizado, não protege um pedido feito à mão.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/auth/server";
import {
  resetNotificationRules,
  saveNotificationRules,
} from "@/lib/notifications/rules-store";

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
    const saved = await saveNotificationRules(data);
    revalidatePath("/", "layout");
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
    await resetNotificationRules();
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
