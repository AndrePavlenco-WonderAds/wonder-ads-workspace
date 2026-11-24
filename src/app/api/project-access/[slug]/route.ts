// O estado de acesso de um projeto, para a pastilha das páginas públicas do
// cliente (v80.36). Público, sem sessão: diz só se o projeto está em pausa e
// que partes continuam abertas até quando — o mesmo que a própria página
// «Projeto em pausa» já mostra.
//   GET → { paused: false } | { paused: true, lang, unlocks: ActiveUnlock[] }

import { NextResponse } from "next/server";
import { getPausedSlugSet } from "@/lib/admin-paused-clients-store";
import { getProjectUnlocks } from "@/lib/paused-unlocks-store";
import { activeUnlocks } from "@/lib/paused-unlocks-shared";
import { pickLang } from "@/lib/public-i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!(await getPausedSlugSet()).has(slug)) {
    return NextResponse.json({ paused: false }, { headers: NO_STORE });
  }
  const unlocks = activeUnlocks(await getProjectUnlocks(slug));
  return NextResponse.json({ paused: true, lang: pickLang(slug), unlocks }, { headers: NO_STORE });
}
