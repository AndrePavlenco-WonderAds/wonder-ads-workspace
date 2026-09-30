// Portão comum das APIs do Reviews Hub: o slug tem de ter hub, e quem pede
// tem de ser o cliente (cookie da password) ou alguém da equipa com sessão.

import { NextResponse } from "next/server";
import { getHubViewer, viewerLabel } from "./access";
import { getHubConfig, type ReviewsHubClient } from "./config";
import { hubStoreConfigured } from "./store";
import type { HubViewer } from "./types";

export type HubGateOk = { cfg: ReviewsHubClient; viewer: HubViewer; actor: string };

export async function hubGate(
  slug: string,
  opts: { write?: boolean } = {},
): Promise<HubGateOk | NextResponse> {
  const cfg = getHubConfig(slug);
  if (!cfg) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  if (!hubStoreConfigured) {
    return NextResponse.json({ error: "Armazenamento indisponível." }, { status: 503 });
  }
  const viewer = await getHubViewer(slug);
  if (!viewer) {
    return NextResponse.json({ error: "Sessão expirada — volta a entrar com a password." }, { status: 401 });
  }
  if (opts.write && !viewer.canWrite) {
    return NextResponse.json({ error: "Este perfil só pode ver." }, { status: 403 });
  }
  return { cfg, viewer, actor: viewerLabel(viewer, cfg.brand) };
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
