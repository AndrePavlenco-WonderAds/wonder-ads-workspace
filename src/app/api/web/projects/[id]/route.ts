// Web Dept project board — single-project endpoints.
//
// GET    → one project (browser-safe).
// PUT    → replace project state (board drag, edits, asset changes). The
//          route diffs prev vs next to emit the right activity entries
//          (status move vs field edit vs asset change), so the log stays
//          truthful no matter which UI surface made the change.
// DELETE → remove a project + log it.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { accessibleDepts } from "@/lib/auth/credentials";
import {
  deleteProject,
  getProject,
  logActivity,
  normaliseProject,
  saveProject,
  toPublicProject,
  webStorageConfigured,
  WEB_STATUS_LABEL,
  type WebProject,
} from "@/lib/web-projects-store";

export const runtime = "nodejs";

async function gate() {
  const employee = await getCurrentEmployee();
  if (!employee || !accessibleDepts(employee).includes("web")) return null;
  return employee;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await gate())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ project: toPublicProject(project) });
}

/** Summarise what changed between two project states into human-readable
 *  activity entries. Keeps the log faithful regardless of which field the
 *  consultant touched. */
function diffEntries(prev: WebProject, next: WebProject): string[] {
  const out: string[] = [];
  if (prev.name !== next.name) out.push(`renamed to "${next.name}"`);
  if (prev.clientName !== next.clientName)
    out.push(`set client to ${next.clientName || "—"}`);
  if (prev.assigneeUsername !== next.assigneeUsername)
    out.push(`reassigned to ${next.assigneeName}`);
  if (prev.priority !== next.priority)
    out.push(`changed priority to ${next.priority}`);
  if (prev.startDate !== next.startDate)
    out.push(`updated start date`);
  if (prev.deadline !== next.deadline) out.push(`updated launch date`);
  return out;
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const employee = await gate();
  if (!employee) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!webStorageConfigured) {
    return NextResponse.json(
      { error: "KV storage is not configured." },
      { status: 503 },
    );
  }
  const { id } = await ctx.params;
  const prev = await getProject(id);
  if (!prev) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const next = normaliseProject(body, id, prev);
  await saveProject(next);

  const actor = { actorUsername: employee.username, actorName: employee.name };

  // 1) Column move (status change) — the headline board event.
  if (prev.status !== next.status) {
    await logActivity({
      projectId: id,
      projectName: next.name,
      ...actor,
      kind: "moved",
      from: prev.status,
      to: next.status,
      message: `moved "${next.name}" from ${WEB_STATUS_LABEL[prev.status]} to ${WEB_STATUS_LABEL[next.status]}`,
    });
  }

  // 2) Field edits.
  const edits = diffEntries(prev, next);
  if (edits.length > 0) {
    await logActivity({
      projectId: id,
      projectName: next.name,
      ...actor,
      kind: "edited",
      message: `${edits.join(", ")} on "${next.name}"`,
    });
  }

  // 3) Asset / credential changes (counts only — never the secrets).
  const prevAssetSig = assetSignature(prev);
  const nextAssetSig = assetSignature(next);
  if (prevAssetSig !== nextAssetSig) {
    await logActivity({
      projectId: id,
      projectName: next.name,
      ...actor,
      kind: "asset",
      message: `updated assets / credentials on "${next.name}"`,
    });
  }

  return NextResponse.json({ project: toPublicProject(next) });
}

/** A cheap fingerprint of the asset bundle so we can tell "assets
 *  changed" without diffing every field. Excludes the comments + core
 *  card fields (those are handled separately) and never includes
 *  decrypted secrets. */
function assetSignature(p: WebProject): string {
  const a = p.assets;
  return JSON.stringify({
    notes: a.notes,
    dos: a.dos,
    donts: a.donts,
    brandingKitUrl: a.brandingKitUrl,
    brandingFiles: a.brandingFiles.map((f) => f.id),
    onboardingFormUrl: a.onboardingFormUrl,
    onboardingFiles: a.onboardingFiles.map((f) => f.id),
    files: a.files.map((f) => f.id),
    resources: a.resources.map((r) => `${r.id}:${r.label}:${r.url}`),
    credentials: a.credentials.map(
      (c) => `${c.id}:${c.label}:${c.kind}:${c.url ?? ""}:${c.username ?? ""}:${Boolean(c.secretEnc)}:${c.notes ?? ""}`,
    ),
  });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const employee = await gate();
  if (!employee) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const prev = await getProject(id);
  if (!prev) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await deleteProject(id);
  await logActivity({
    projectId: id,
    projectName: prev.name,
    actorUsername: employee.username,
    actorName: employee.name,
    kind: "deleted",
    message: `deleted project "${prev.name}"`,
  });
  return NextResponse.json({ ok: true });
}
