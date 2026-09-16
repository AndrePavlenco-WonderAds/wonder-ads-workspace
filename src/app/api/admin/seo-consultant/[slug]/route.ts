// Migrar um cliente de SEO para outro consultor (v77.34). SuperAdmin only.
//   PUT { consultant } → o cliente passa para a carteira desse consultor.
//
// A migração vive no KV (consultant-assignments.ts) e é lida por TODAS as
// superfícies que mostram o consultor — board, roadmaps, rodapés das páginas
// públicas, PDFs/DOCX, relatório mensal, NPS, onboarding. Além disso,
// arrumam-se aqui os dois sítios que GUARDAM o nome do consultor:
//   • a linha SEO do /admin/clients (carteiras e valores em /admin/employees)
//   • o registo de onboarding, quando existe

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentEmployee, isCurrentUserAdmin } from "@/lib/auth/server";
import { CONSULTANT_ORDER, EXCLUDED_SLUGS } from "@/lib/client-overrides";
import { assignConsultant } from "@/lib/consultant-assignments";
import { getClientBySlug } from "@/lib/notion";
import { getAdminRecord, saveAdminRecord } from "@/lib/admin-clients-store";
import { getDepartmentOverrides } from "@/lib/admin-client-departments-store";
import { rosterNameKey } from "@/lib/admin-employees-store";
import {
  getOnboardingClient,
  patchOnboardingClient,
} from "@/lib/onboarding-clients-store";

export const runtime = "nodejs";

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json(
      { error: "Não há permissões suficientes." },
      { status: 403 },
    );
  }
  const { slug } = await ctx.params;
  if (!slug || EXCLUDED_SLUGS.has(slug)) {
    return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as { consultant?: unknown };
  const consultant =
    typeof body.consultant === "string" ? body.consultant.trim() : "";
  if (!(CONSULTANT_ORDER as readonly string[]).includes(consultant)) {
    return NextResponse.json(
      { error: "Escolhe um consultor da lista." },
      { status: 400 },
    );
  }

  const [employee, client, onboarding] = await Promise.all([
    getCurrentEmployee(),
    getClientBySlug(slug).catch(() => null),
    getOnboardingClient(slug).catch(() => null),
  ]);
  if (!client && !onboarding) {
    return NextResponse.json(
      { error: "Cliente não encontrado." },
      { status: 404 },
    );
  }

  let result: { previous: string; consultant: string };
  try {
    result = await assignConsultant(
      slug,
      consultant,
      employee?.username ?? "unknown",
      client?.consultant ?? onboarding?.consultant,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Os nomes guardados — best effort: a migração em si já está feita e é
  // ela que manda na leitura; isto só evita que o /admin mostre o antigo.
  const warnings: string[] = [];
  try {
    const departments = (await getDepartmentOverrides())[slug] ?? ["SEO"];
    const record = await getAdminRecord(slug, "SEO", departments);
    const prevKey = rosterNameKey(result.previous);
    const others = record.consultants.filter(
      (n) => rosterNameKey(n) !== prevKey && rosterNameKey(n) !== rosterNameKey(consultant),
    );
    const next = [consultant, ...others];
    const changed =
      next.length !== record.consultants.length ||
      next.some((n, i) => n !== record.consultants[i]);
    if (changed) {
      await saveAdminRecord(slug, "SEO", { consultants: next }, departments);
    }
  } catch (err) {
    console.error("seo-consultant: admin record update failed:", err);
    warnings.push("Não consegui atualizar a linha em /admin/clients.");
  }
  if (onboarding && onboarding.consultant !== consultant) {
    try {
      await patchOnboardingClient(slug, { consultant });
    } catch (err) {
      console.error("seo-consultant: onboarding record update failed:", err);
      warnings.push("Não consegui atualizar o registo de onboarding.");
    }
  }

  // Tudo o que mostra o consultor deste cliente, mais as vistas por consultor.
  revalidatePath("/seo");
  revalidatePath(`/seo/${slug}`, "layout");
  revalidatePath(`/${slug}`, "layout");
  revalidatePath("/seo/roadmaps/[consultant]", "page");
  revalidatePath("/seo/weekly-reports");
  revalidatePath("/admin", "layout");
  revalidatePath("/ads");

  return NextResponse.json({ ok: true, ...result, warnings });
}
