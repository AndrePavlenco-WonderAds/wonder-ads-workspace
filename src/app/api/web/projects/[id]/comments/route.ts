// Add a timestamped status update / comment to a project. Author is
// taken from the session — never trusted from the client — so the log
// can't be spoofed.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { accessibleDepts } from "@/lib/auth/credentials";
import { normaliseCommentAttachments } from "@/lib/web-shared";
import {
  getProject,
  logActivity,
  newId,
  saveProject,
  toPublicProject,
  webStorageConfigured,
  type WebComment,
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
  const text =
    typeof (body as { body?: unknown })?.body === "string"
      ? (body as { body: string }).body.trim()
      : "";
  // Anexos já carregados para o Blob pelo browser (v77.33).
  const attachments = normaliseCommentAttachments(
    (body as { attachments?: unknown })?.attachments,
  );
  if (!text && attachments.length === 0) {
    return NextResponse.json(
      { error: "Comment body is required." },
      { status: 400 },
    );
  }
  const comment: WebComment = {
    id: newId("m"),
    authorUsername: employee.username,
    authorName: employee.name,
    body: text,
    createdAt: Date.now(),
    ...(attachments.length > 0 ? { attachments } : {}),
  };
  project.comments.push(comment);
  project.updatedAt = Date.now();
  await saveProject(project);
  await logActivity({
    projectId: id,
    projectName: project.name,
    actorUsername: employee.username,
    actorName: employee.name,
    kind: "comment",
    message: `commented on "${project.name}"`,
  });
  return NextResponse.json({ project: toPublicProject(project) });
}
