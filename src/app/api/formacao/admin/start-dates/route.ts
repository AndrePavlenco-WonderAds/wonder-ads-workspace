// Data de entrada de um consultor — a âncora dos exames de fase.
// SuperAdmin apenas.
//   POST { username, date: "yyyy-mm-dd" } — define
//   POST { username, clear: true }        — volta ao default da credencial
//
// Quem definiu fica gravado a partir da sessão, nunca do payload. Mexer nesta
// data desloca os seis exames da pessoa, por isso o gate é o mesmo das
// inscrições e a rota volta a verificar as permissões por si — um layout só
// protege o que é renderizado, não protege um pedido feito à mão.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/auth/server";
import {
  clearStartDate,
  setStartDate,
} from "@/lib/training/start-dates-store";

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
  const { username, date, clear } = (body ?? {}) as {
    username?: unknown;
    date?: unknown;
    clear?: unknown;
  };
  if (typeof username !== "string" || !username.trim()) {
    return NextResponse.json({ error: "username em falta" }, { status: 400 });
  }
  const user = username.trim().toLowerCase();

  try {
    const map =
      clear === true
        ? await clearStartDate(user)
        : await setStartDate(
            user,
            typeof date === "string" ? date : "",
            employee.username,
            Date.now(),
          );
    revalidatePath("/formacao");
    revalidatePath("/formacao/admin");
    revalidatePath("/formacao/admin/inscricoes");
    revalidatePath(`/formacao/admin/${user}`);
    return NextResponse.json({ ok: true, startDates: map });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
