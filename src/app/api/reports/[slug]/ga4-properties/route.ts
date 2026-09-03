// A que propriedade GA4 está este cliente ligado — e quais podia estar.
//
// Alimenta o seletor «Propriedade GA4» do editor do relatório mensal
// (v77.9). Nasceu do Kings Gyms: a conta tem várias propriedades criadas e
// vazias, o matcher por domínio apanhou uma delas, e o relatório saiu com
// «0 utilizadores orgânicos» debaixo de um chip «GA4 ligado». A correção
// existia (config.ga4PropertyId) mas não tinha porta na app.
//
//   GET → { ok, stored, resolution: { propertyId, matchedBy, matchedName },
//           properties: [{ propertyId, displayName }] }
//
// Session-gated pelo middleware (/api/reports/:path*) e, por baixo, pela
// mesma regra da config: só quem edita SEO.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { explainGa4Resolution, listVisibleGa4Properties } from "@/lib/ga4";
import { googleAuthConfigured } from "@/lib/google-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const employee = await getCurrentEmployee();
  if (!employee || !editableDepts(employee).includes("seo")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { slug } = await params;

  if (!googleAuthConfigured) {
    return NextResponse.json({
      ok: false,
      reason: "Sem service account Google neste deployment.",
      stored: null,
      resolution: null,
      properties: [],
    });
  }

  try {
    const [resolution, properties] = await Promise.all([
      explainGa4Resolution(slug),
      listVisibleGa4Properties(),
    ]);
    const nameOf = new Map(properties.map((p) => [p.propertyId, p.displayName]));
    return NextResponse.json({
      ok: true,
      stored: resolution.stored,
      resolution: {
        propertyId: resolution.propertyId,
        matchedBy: resolution.matchedBy,
        matchedName:
          resolution.matchedName ??
          (resolution.propertyId ? (nameOf.get(resolution.propertyId) ?? null) : null),
      },
      properties: [...properties].sort((a, b) =>
        a.displayName.localeCompare(b.displayName, "pt"),
      ),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        reason: err instanceof Error ? err.message : "A Google não respondeu.",
        stored: null,
        resolution: null,
        properties: [],
      },
      { status: 200 },
    );
  }
}
