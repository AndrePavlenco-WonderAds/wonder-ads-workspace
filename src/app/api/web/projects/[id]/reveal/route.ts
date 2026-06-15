// Decrypt a single stored credential secret on demand.
//
// This is the ONLY endpoint that turns vault ciphertext back into
// plaintext, and it only does so server-side, in response to an
// authenticated request from a Web-access user, for one credential id at
// a time. The secret is returned in the JSON response and never persisted
// anywhere new. A reveal is recorded in the activity log as a security
// trail (who unmasked which credential, when).

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { accessibleDepts } from "@/lib/auth/credentials";
import { decryptSecret } from "@/lib/web-creds";
import {
  getProject,
  logActivity,
  webStorageConfigured,
} from "@/lib/web-projects-store";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
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
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) {
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
  const cred = project.assets.credentials.find((c) => c.id === credentialId);
  if (!cred) {
    return NextResponse.json(
      { error: "Credential not found" },
      { status: 404 },
    );
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
  await logActivity({
    projectId: id,
    projectName: project.name,
    actorUsername: employee.username,
    actorName: employee.name,
    kind: "asset",
    message: `revealed the ${cred.label} credential on "${project.name}"`,
  });
  return NextResponse.json({ secret });
}
