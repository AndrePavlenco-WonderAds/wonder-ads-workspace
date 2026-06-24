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
import {
  getClient,
  normaliseClient,
  saveClient,
} from "@/lib/web-clients-store";

export const runtime = "nodejs";

/** True when a freshly-created project carries no vault data yet — the
 *  cue to seed it from the client profile rather than clobber a payload
 *  that already brought its own assets. */
function isEmptyAssets(p: import("@/lib/web-projects-store").WebProject): boolean {
  const a = p.assets;
  return (
    !a.notes &&
    a.dos.length === 0 &&
    a.donts.length === 0 &&
    !a.brandingKitUrl &&
    a.brandingFiles.length === 0 &&
    !a.onboardingFormUrl &&
    a.onboardingFiles.length === 0 &&
    a.files.length === 0 &&
    a.credentials.length === 0 &&
    a.resources.length === 0
  );
}

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
  let project = normaliseProject(body, id, null);

  // Client registry integration. When the project is tied to a client
  // slug, pull that client's saved profile so the team stops re-entering
  // the same data: seed the new project's vault from the client's, and
  // default the assignee to the client's preferred designer when the
  // create form didn't pick one. When the client isn't registered yet,
  // auto-create a lightweight stub so it shows up in the registry.
  if (project.clientSlug) {
    const client = await getClient(project.clientSlug);
    if (client) {
      if (isEmptyAssets(project)) {
        project = { ...project, assets: client.assets };
      }
      if (!project.assigneeUsername && client.defaultAssigneeUsername) {
        project = {
          ...project,
          assigneeUsername: client.defaultAssigneeUsername,
          assigneeName: client.defaultAssigneeName || project.assigneeName,
        };
      }
    } else if (project.clientName) {
      await saveClient(
        normaliseClient(
          {
            name: project.clientName,
            defaultAssigneeUsername: project.assigneeUsername,
            defaultAssigneeName: project.assigneeName,
          },
          project.clientSlug,
          null,
        ),
      );
    }
  }

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
