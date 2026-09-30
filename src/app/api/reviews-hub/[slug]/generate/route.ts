// POST /api/reviews-hub/<slug>/generate — escreve uma resposta com a IA e
// devolve-a em streaming de texto (a página mostra-a a ser escrita).
//
// Corpo: { reviewId, loc } para uma review real, ou { sample } para o
// exemplo da página «Respostas» quando ainda não há reviews sincronizadas.
// `previous` pede uma alternativa diferente da versão atual.

import { NextResponse } from "next/server";
import { streamReplyResponse } from "@/lib/reviews-hub/ai";
import { hubGate, readJson } from "@/lib/reviews-hub/route-helpers";
import { getLocations, getReviewsForLocation, getSettings } from "@/lib/reviews-hub/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  reviewId?: string;
  loc?: string;
  previous?: string;
  sample?: { author?: string; stars?: number; text?: string; salon?: string };
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const gate = await hubGate(slug, { write: true });
  if (gate instanceof NextResponse) return gate;
  const body = await readJson<Body>(req);
  if (!body) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });

  const settings = await getSettings(slug);
  const previous = str(body.previous, 4000);

  if (body.reviewId && body.loc) {
    const [locations, reviews] = await Promise.all([
      getLocations(slug),
      getReviewsForLocation(slug, body.loc),
    ]);
    const loc = locations.find((l) => l.id === body.loc);
    const review = reviews.find((r) => r.id === body.reviewId);
    if (!loc || !review) {
      return NextResponse.json({ error: "Review não encontrada." }, { status: 404 });
    }
    return streamReplyResponse(slug, settings, {
      salon: loc.title,
      author: review.author,
      anonymous: review.anon,
      stars: review.stars || 5,
      text: review.text,
      created: review.created,
      previous,
      published: review.reply?.text,
    });
  }

  const stars = Number(body.sample?.stars);
  if (!body.sample || !(stars >= 1 && stars <= 5)) {
    return NextResponse.json({ error: "Falta a review." }, { status: 400 });
  }
  return streamReplyResponse(slug, settings, {
    salon: str(body.sample.salon, 200) || gate.cfg.brand,
    author: str(body.sample.author, 120) || "Cliente",
    stars: Math.round(stars),
    text: str(body.sample.text, 4000),
    previous,
  });
}
