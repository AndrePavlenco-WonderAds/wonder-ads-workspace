// Decrypt a single stored client-vault credential on demand — the client
// registry mirror of /api/web/projects/[id]/reveal. This is the only path
// that turns a client's vault ciphertext back into plaintext, server-side,
// for an authenticated Web-access user, one credential id at a time.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { accessibleDepts } from "@/lib/auth/credentials";
import { decryptSecret } from "@/lib/web-creds";
import { getClient, webStorageConfigured } from "@/lib/web-clients-store";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const employee = await getCurrentEmployee();
  if (!employee || !accessibleDepts(employee).includes("web")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!webStorageConfigured) {
    return NextResponse.json(
      { error: "KV storage is not configured." },
      { status: 503 },
    );
  }
  const { slug } = await ctx.params;
  const client = await getClient(slug);
  if (!client) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const credentialId =
    typeof (body as { credentialId?: unknown })?.credentialId === "string"
      ? (body as { credentialId: string }).credentialId
      : "";
  const cred = client.assets.credentials.find((c) => c.id === credentialId);
  if (!cred) {
    return NextResponse.json({ error: "Credential not found" }, { status: 404 });
  }
  if (!cred.secretEnc) {
    return NextResponse.json({ secret: "" });
  }
  const secret = decryptSecret(cred.secretEnc);
  if (secret === null) {
    return NextResponse.json(
      { error: "Could not decrypt — the signing secret may have rotated." },
      { status: 500 },
    );
  }
  return NextResponse.json({ secret });
}
