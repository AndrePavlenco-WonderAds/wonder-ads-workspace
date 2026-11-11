// Ficha de atualização do plugin WordPress «WonderAds — IA no site» —
// PÚBLICA (fora do portão de login): é o WordPress de cada cliente que a lê
// para saber se há versão nova. Formato: o que o WordPress espera de uma
// «plugin_information» (ver includes/updater.php no plugin).

import { NextResponse } from "next/server";
import { IA_PLUGIN_RELEASE, iaPluginZipPath } from "@/lib/report/wp-plugin-release";

export const dynamic = "force-static";

const ORIGIN = "https://workspace.wonder-ads.com";

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function GET() {
  const r = IA_PLUGIN_RELEASE;
  const changelog = r.changes
    .map(
      (c) =>
        `<h4>${c.version}</h4><ul>${c.items.map((i) => `<li>${escape(i)}</li>`).join("")}</ul>`,
    )
    .join("");
  return NextResponse.json(
    {
      name: "WonderAds — IA no site",
      slug: r.slug,
      version: r.version,
      download_url: `${ORIGIN}${iaPluginZipPath()}`,
      requires: r.requires,
      requires_php: r.requiresPhp,
      tested: r.tested,
      last_updated: r.lastUpdated,
      sections: {
        description:
          "<p>Conta as vezes que o ChatGPT, o Claude, o Perplexity e o Mistral abrem páginas do site para responder a alguém — também nas apps do telemóvel. Os números entram no relatório mensal da WonderAds. Não guarda dados de pessoas.</p>",
        changelog,
      },
    },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
  );
}
