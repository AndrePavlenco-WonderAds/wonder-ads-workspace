// Web Dept client registry — collection endpoints.
//
// GET  → every registered client (browser-safe: credential ciphertext
//        stripped).
// POST → create / upsert a client. The slug is derived from the name (or
//        an explicit `slug`), so re-posting the same client edits it
//        rather than duplicating.
//
// Gated to users with Web access, same as the project board.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { accessibleDepts } from "@/lib/auth/credentials";
import {
  clientSlug,
  getAllClients,
  getClient,
  normaliseClient,
  saveClient,
  toPublicClient,
  webStorageConfigured,
} from "@/lib/web-clients-store";

export const runtime = "nodejs";

async function gate() {
  const employee = await getCurrentEmployee();
  if (!employee || !accessibleDepts(employee).includes("web")) return null;
  return employee;
}

export async function GET() {
  if (!(await gate())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!webStorageConfigured) {
    return NextResponse.json({ clients: [], storageConfigured: false });
  }
  const clients = await getAllClients();
  return NextResponse.json({
    clients: clients.map(toPublicClient),
    storageConfigured: true,
  });
}

export async function POST(req: Request) {
  if (!(await gate())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!webStorageConfigured) {
    return NextResponse.json(
      { error: "KV storage is not configured." },
      { status: 503 },
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const o = (body ?? {}) as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name : "";
  const slug = clientSlug(
    typeof o.slug === "string" && o.slug.trim() ? o.slug : name,
  );
  if (!slug) {
    return NextResponse.json(
      { error: "O nome do cliente é obrigatório." },
      { status: 400 },
    );
  }
  // Upsert: merge onto the existing record so a re-post preserves vault
  // ciphertext + createdAt rather than wiping them.
  const prev = await getClient(slug);
  const client = normaliseClient(body, slug, prev);
  await saveClient(client);
  return NextResponse.json({ client: toPublicClient(client) });
}
