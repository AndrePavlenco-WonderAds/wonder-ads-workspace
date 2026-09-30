"use client";

// O estado partilhado do Reviews Hub — dados, filtro de salão, navegação e
// as ações que mexem nos dados (publicar, rascunhos, sync).

import { createContext, useContext } from "react";
import type { HubStats } from "@/lib/reviews-hub/stats";
import type {
  HubActivity,
  HubDraft,
  HubLocation,
  HubReview,
  HubSettings,
  HubSyncState,
  HubViewer,
} from "@/lib/reviews-hub/types";

export type HubView = "dashboard" | "reviews" | "respostas" | "definicoes";
export const HUB_VIEWS: HubView[] = ["dashboard", "reviews", "respostas", "definicoes"];

export type InboxTab = "pending" | "approval" | "answered" | "all";

export type InboxPreset = {
  tab?: InboxTab;
  stars?: number[];
  reviewId?: string;
  /** Muda sempre — garante que o mesmo preset aplicado duas vezes reage. */
  nonce: number;
};

export type HubData = {
  locations: HubLocation[];
  reviews: HubReview[];
  drafts: Record<string, HubDraft>;
  sync: HubSyncState;
  activity: HubActivity[];
  running: boolean;
};

export type Toast = { id: number; tone: "ok" | "error" | "info"; text: string };

export type HubCtx = {
  slug: string;
  brand: string;
  logo: string | null;
  viewer: HubViewer;
  data: HubData;
  loaded: boolean;
  settings: HubSettings;
  setSettings: (s: HubSettings) => void;
  /** Filtro de salão — "all" ou o id do perfil. */
  loc: string;
  setLoc: (loc: string) => void;
  /** As reviews do salão escolhido (ou todas). */
  scoped: HubReview[];
  stats: HubStats;
  locationsById: Map<string, HubLocation>;
  view: HubView;
  go: (view: HubView, preset?: Omit<InboxPreset, "nonce">) => void;
  inboxPreset: InboxPreset | null;
  syncing: boolean;
  runSync: (full?: boolean) => Promise<void>;
  refresh: () => Promise<void>;
  toast: (text: string, tone?: Toast["tone"]) => void;
  applyReview: (review: HubReview) => void;
  setDraft: (reviewId: string, draft: HubDraft | null) => void;
};

export const HubContext = createContext<HubCtx | null>(null);

export function useHub(): HubCtx {
  const ctx = useContext(HubContext);
  if (!ctx) throw new Error("useHub fora do ReviewsHubApp");
  return ctx;
}
