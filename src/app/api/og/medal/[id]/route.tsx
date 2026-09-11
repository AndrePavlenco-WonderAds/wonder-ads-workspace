// GET /api/og/medal/<id>.png — a imagem de uma medalha, em PNG (v77.27).
//
// É o que o Slack mostra no #team-wins quando alguém ganha uma medalha:
// o emblema em grande, o nome, o material e o que a medalha pede. Gerado
// com next/og (satori + resvg) a partir do MESMO desenho SVG do header e
// da galeria, em modo estático (sem animações, sem elementos de texto),
// embutido como <img> em data-URI — o satori não desenha SVG inline, mas
// o resvg rasteriza uma imagem SVG. A string SVG sai de um serializador
// próprio (svg-string.ts): o Next não deixa importar react-dom/server aqui.
//
// Fica fora do matcher do middleware de propósito: o Slack vai buscar a
// imagem sem cookie. Não há nada de sensível aqui — é um emblema.

import { ImageResponse } from "next/og";
import { MedalArt } from "@/components/medals/medal-badge";
import { MEDAL_FAMILIES, medalById, tierAccent, tierLabel } from "@/lib/medals/catalog";
import { reactSvgToString } from "@/lib/medals/svg-string";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const medal = medalById(id.replace(/\.png$/i, ""));
  if (!medal) return new Response("Medalha desconhecida.", { status: 404 });
  const accent = tierAccent(medal);
  const family = MEDAL_FAMILIES.find((f) => f.id === medal.family)?.name ?? "";
  const height = medal.tier >= 4 ? 220 : 250;
  const width = medal.tier >= 4 ? height * 1.5 : height * 0.8;
  const svg = reactSvgToString(<MedalArt medal={medal} uid="og" size={height} animated={false} />);
  const src = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: "40px 56px",
          background: "linear-gradient(135deg, #0b0b12 0%, #171029 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 380,
            height: 340,
            borderRadius: 36,
            background: `radial-gradient(circle at 50% 45%, ${accent}40 0%, ${accent}10 45%, rgba(0,0,0,0) 72%)`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} width={width} height={height} alt="" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 48, flex: 1 }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 6, textTransform: "uppercase", color: accent, fontWeight: 700 }}>
            {tierLabel(medal)} · {family}
          </div>
          <div style={{ display: "flex", fontSize: 66, fontWeight: 800, marginTop: 10, lineHeight: 1.05 }}>{medal.name}</div>
          <div style={{ display: "flex", fontSize: 28, color: "rgba(255,255,255,0.72)", marginTop: 14 }}>{medal.requirement}</div>
          <div style={{ display: "flex", fontSize: 21, color: "rgba(255,255,255,0.42)", marginTop: 34, letterSpacing: 3, textTransform: "uppercase" }}>
            Wonder Ads · Medalhas
          </div>
        </div>
      </div>
    ),
    {
      width: 1000,
      height: 420,
      headers: { "cache-control": "public, max-age=3600, s-maxage=86400" },
    },
  );
}
