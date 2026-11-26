// GET /api/admin/recrutamento/materiais/<id> (v80.55) — os PDFs do teste de
// atenção ao detalhe. Só SuperAdmins (recruitmentUser): a versão marcada e as
// soluções nunca podem chegar a um candidato. ?download=1 descarrega; sem
// ele, abre no browser. Os ficheiros entram no bundle da função por
// outputFileTracingIncludes (next.config.ts).

import { readFile } from "node:fs/promises";
import path from "node:path";
import { recruitmentUser } from "@/lib/recrutamento/guard";
import { isMaterialId, MATERIALS } from "@/lib/recrutamento/materials";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await recruitmentUser();
  if (!me) return new Response("Not found", { status: 404 });
  const { id } = await params;
  if (!isMaterialId(id)) return new Response("Not found", { status: 404 });
  const m = MATERIALS[id];
  let buf: Buffer;
  try {
    buf = await readFile(path.join(process.cwd(), "private", "recrutamento", m.file));
  } catch {
    return new Response("Ficheiro em falta.", { status: 404 });
  }
  const download = new URL(req.url).searchParams.get("download") === "1";
  const ascii = m.downloadName.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/"/g, "");
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(m.downloadName)}`,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
