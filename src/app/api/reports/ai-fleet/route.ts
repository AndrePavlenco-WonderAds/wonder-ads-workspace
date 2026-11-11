// Painel «IA no site» (v78.92): GET = o último resultado; POST = verificar
// todos os clientes agora. Editores do SEO DPT apenas. Nada sai da chave do
// plugin para o browser.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { getFleetSnapshot, runFleetCheck } from "@/lib/report/ai-fleet";
import { getFleetClients } from "@/lib/report/ai-fleet-roster";

export const runtime = "nodejs";
export const maxDuration = 300;

async function allowed() {
  const employee = await getCurrentEmployee();
  return Boolean(employee && editableDepts(employee).includes("seo"));
}

export async function GET() {
  if (!(await allowed())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(await getFleetSnapshot());
}

export async function POST() {
  if (!(await allowed())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const clients = await getFleetClients();
  return NextResponse.json(await runFleetCheck(clients));
}
