// Web Dept project board — collection endpoints.
//
// GET  → every project (browser-safe: credential ciphertext stripped),
//        newest-activity columns are assembled client-side.
// POST → create a new project. Logs a "created" activity entry.
//
// Both are gated to users with Web access (web designers + SEO
// consultants + SuperAdmins) via accessibleDepts().

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { accessibleDepts } from "@/lib/auth/credentials";
import {
  getAllProjects,
  logActivity,
  newId,
  normaliseProject,
  saveProject,
  toPublicProject,
  webStorageConfigured,
} from "@/lib/web-projects-store";

export const runtime = "nodejs";

export async function GET() {
  const employee = await getCurrentEmployee();
  if (!employee || !accessibleDepts(employee).includes("web")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!webStorageConfigured) {
    return NextResponse.json({ projects: [], storageConfigured: false });
  }
  const projects = await getAllProjects();
  return NextResponse.json({
    projects: projects.map(toPublicProject),
    storageConfigured: true,
  });
}

export async function POST(req: Request) {
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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const id = newId("p");
  const project = normaliseProject(body, id, null);
  await saveProject(project);
  await logActivity({
    projectId: id,
    projectName: project.name,
    actorUsername: employee.username,
    actorName: employee.name,
    kind: "created",
    message: `created project "${project.name}"${
      project.clientName ? ` for ${project.clientName}` : ""
    }`,
    to: project.status,
  });
  return NextResponse.json({ project: toPublicProject(project) });
}
