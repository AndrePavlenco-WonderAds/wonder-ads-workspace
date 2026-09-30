// Automação do Reviews Hub — corre no cron, a seguir à sync.
//
// Só mexe em reviews SEM resposta criadas DEPOIS de a automação ser ligada
// (settings.automation.enabledAt): ligar a automação nunca faz a plataforma
// responder sozinha ao histórico. Para cada uma, o modo do nível de estrelas
// decide: «auto» publica logo no Google, «approval» deixa um rascunho à
// espera de aprovação, «manual» não faz nada. Em modo só de leitura (reviews
// pela DataForSEO) o «auto» vira «approval».

import { generateReply } from "./ai";
import { putReply, gbpToken } from "./google";
import {
  applyReplyToStoredReview,
  getAllReviews,
  getDrafts,
  getLocations,
  getSettings,
  getSyncState,
  logActivity,
  refreshSummary,
  updateDrafts,
} from "./store";
import { levelKey } from "./defaults";
import type { HubDraft } from "./types";

/** Teto por corrida — limita tempo e custo se entrar uma avalanche. */
const MAX_PER_RUN = 12;

export type AutomationResult = {
  enabled: boolean;
  published: number;
  drafted: number;
  failed: number;
};

export async function runAutomation(slug: string): Promise<AutomationResult> {
  const settings = await getSettings(slug);
  const result: AutomationResult = { enabled: settings.automation.enabled, published: 0, drafted: 0, failed: 0 };
  if (!settings.automation.enabled || !settings.automation.enabledAt) return result;
  const since = settings.automation.enabledAt;

  // Sem a API v4 da Google (modo leitura pela DataForSEO) não há como
  // publicar sozinho: o «Automático» deixa a resposta pronta para aprovar.
  const canPublish = Boolean((await getSyncState(slug)).publishAvailable);
  const locations = await getLocations(slug);
  const byId = new Map(locations.map((l) => [l.id, l]));
  const [reviews, drafts] = await Promise.all([getAllReviews(slug, locations), getDrafts(slug)]);

  const queue = reviews
    .filter((r) => !r.reply && r.stars > 0 && Date.parse(r.created) >= since && !drafts[r.id])
    .sort((a, b) => a.created.localeCompare(b.created))
    .slice(0, MAX_PER_RUN);
  if (queue.length === 0) return result;

  let token: string | null = null;
  for (const review of queue) {
    const key = levelKey(review.stars);
    const loc = byId.get(review.loc);
    if (!key || !loc) continue;
    const configured = settings.strategies[key].mode;
    if (configured === "manual") continue;
    const mode = configured === "auto" && !canPublish ? "approval" : configured;

    let text: string;
    try {
      text = await generateReply(slug, settings, {
        salon: loc.title,
        author: review.author,
        anonymous: review.anon,
        stars: review.stars,
        text: review.text,
        created: review.created,
      });
      if (!text) throw new Error("A IA devolveu uma resposta vazia.");
    } catch (err) {
      result.failed++;
      console.error("[reviews-hub] automation generate failed:", err);
      continue;
    }

    if (mode === "approval") {
      const now = Date.now();
      const draft: HubDraft = {
        reviewId: review.id,
        loc: review.loc,
        text,
        status: "awaiting_approval",
        source: "auto",
        createdAt: now,
        updatedAt: now,
      };
      await updateDrafts(slug, (d) => ({ ...d, [review.id]: draft }));
      await logActivity(slug, {
        at: now,
        kind: "auto-draft",
        text: `Rascunho à espera de aprovação para ${review.author} (${review.stars}★ · ${loc.short})`,
        reviewId: review.id,
        loc: review.loc,
      });
      result.drafted++;
      continue;
    }

    try {
      token ??= await gbpToken();
      const published = await putReply(token, loc, review.id, text);
      await applyReplyToStoredReview(slug, review.loc, review.id, {
        text: published.text,
        updated: published.updated,
        via: "auto",
      });
      await logActivity(slug, {
        at: Date.now(),
        kind: "auto-reply",
        text: `Resposta automática publicada a ${review.author} (${review.stars}★ · ${loc.short})`,
        reviewId: review.id,
        loc: review.loc,
      });
      result.published++;
    } catch (err) {
      // A resposta não se perde: fica como rascunho falhado para alguém
      // publicar à mão.
      const now = Date.now();
      await updateDrafts(slug, (d) => ({
        ...d,
        [review.id]: {
          reviewId: review.id,
          loc: review.loc,
          text,
          status: "failed",
          source: "auto",
          createdAt: now,
          updatedAt: now,
          error: err instanceof Error ? err.message : String(err),
        },
      }));
      result.failed++;
    }
  }

  if (result.published || result.drafted || result.failed) await refreshSummary(slug);
  return result;
}
