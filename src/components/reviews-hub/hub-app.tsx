"use client";

// A plataforma de respostas a reviews — o esqueleto: barra lateral, cabeçalho
// e as quatro vistas (Dashboard, Reviews, Respostas, Definições). Carrega as
// reviews depois do primeiro desenho e, se ainda nunca houve sync, liga-se ao
// Google sozinha.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MotionConfig, motion } from "motion/react";
import { computeStats } from "@/lib/reviews-hub/stats";
import type { HubBootstrap, HubDraft, HubReview } from "@/lib/reviews-hub/types";
import {
  HUB_VIEWS,
  HubContext,
  type HubCtx,
  type HubData,
  type HubView,
  type InboxPreset,
  type Toast,
} from "./hub-context";
import { HairStrands } from "./hub-ui";
import { MobileNav, PageHeader, Sidebar, Toasts } from "./hub-shell";
import { DashboardView } from "./hub-dashboard";
import { InboxView } from "./hub-inbox";
import { PlaybookView } from "./hub-playbook";
import { SettingsView } from "./hub-settings";

export function ReviewsHubApp({ bootstrap }: { bootstrap: HubBootstrap }) {
  const router = useRouter();
  const { slug, brand, logo, viewer } = bootstrap;
  const [view, setView] = useState<HubView>("dashboard");
  const [inboxPreset, setInboxPreset] = useState<InboxPreset | null>(null);
  const [loc, setLoc] = useState("all");
  const [settings, setSettings] = useState(bootstrap.settings);
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [data, setData] = useState<HubData>({
    locations: bootstrap.locations,
    reviews: [],
    drafts: bootstrap.drafts,
    sync: bootstrap.sync,
    activity: bootstrap.activity,
    running: false,
  });
  const autoSynced = useRef(false);

  const toast = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/reviews-hub/${slug}/data`, { cache: "no-store" });
    if (res.status === 401) {
      router.refresh();
      return;
    }
    if (!res.ok) throw new Error("Não foi possível carregar as reviews.");
    const meta = (await res.json()) as Omit<HubData, "reviews">;
    // As reviews vêm salão a salão, em paralelo — nenhuma resposta fica grande.
    const lists = await Promise.all(
      meta.locations.map(async (l) => {
        const r = await fetch(`/api/reviews-hub/${slug}/reviews?loc=${encodeURIComponent(l.id)}`, {
          cache: "no-store",
        });
        if (!r.ok) return [] as HubReview[];
        return ((await r.json()) as { reviews: HubReview[] }).reviews;
      }),
    );
    const reviews = lists.flat().sort((a, b) => b.created.localeCompare(a.created));
    setData({ ...meta, reviews });
    setLoaded(true);
  }, [slug, router]);

  const runSync = useCallback(
    async (full = false) => {
      if (!viewer.canWrite) return;
      setSyncing(true);
      try {
        const res = await fetch(`/api/reviews-hub/${slug}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ full }),
        });
        const j = (await res.json().catch(() => ({}))) as {
          status?: string;
          newReviews?: number;
          sync?: { error?: string | null };
        };
        if (j.status === "running") toast("Já está uma sincronização a correr — os dados chegam já a seguir.", "info");
        else if (j.status === "error") toast(j.sync?.error ?? "A sincronização falhou.", "error");
        else if (j.newReviews) toast(`${j.newReviews} ${j.newReviews === 1 ? "review nova" : "reviews novas"} do Google`);
        else toast("Tudo em dia com o Google.");
        await refresh();
      } catch {
        toast("A sincronização falhou — tenta outra vez.", "error");
      } finally {
        setSyncing(false);
      }
    },
    [slug, viewer.canWrite, refresh, toast],
  );

  // Carregamento inicial + primeira sync automática.
  useEffect(() => {
    refresh().catch(() => toast("Não foi possível carregar as reviews.", "error"));
  }, [refresh, toast]);
  useEffect(() => {
    if (autoSynced.current || !loaded) return;
    autoSynced.current = true;
    if (!data.sync.lastSyncAt && !data.running && viewer.canWrite) void runSync();
  }, [loaded, data.sync.lastSyncAt, data.running, viewer.canWrite, runSync]);

  // Uma sync a correr noutro lado (o cron, outra pessoa) — espreita até acabar.
  useEffect(() => {
    if (!data.running || syncing) return;
    const t = setTimeout(() => void refresh().catch(() => undefined), 5000);
    return () => clearTimeout(t);
  }, [data.running, syncing, refresh, data.sync.lastSyncAt]);

  // A vista vive no #hash — dá para partilhar «…/reviews#respostas».
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1) as HubView;
      if (HUB_VIEWS.includes(h)) setView(h);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const go = useCallback((v: HubView, preset?: Omit<InboxPreset, "nonce">) => {
    setView(v);
    if (preset) setInboxPreset({ ...preset, nonce: Date.now() });
    window.history.replaceState(null, "", `#${v}`);
    document.getElementById("rhub-main")?.scrollTo?.({ top: 0 });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const applyReview = useCallback((review: HubReview) => {
    setData((d) => ({
      ...d,
      reviews: d.reviews.map((r) => (r.id === review.id ? review : r)),
    }));
  }, []);

  const setDraft = useCallback((reviewId: string, draft: HubDraft | null) => {
    setData((d) => {
      const drafts = { ...d.drafts };
      if (draft) drafts[reviewId] = draft;
      else delete drafts[reviewId];
      return { ...d, drafts };
    });
  }, []);

  const locationsById = useMemo(
    () => new Map(data.locations.map((l) => [l.id, l])),
    [data.locations],
  );
  const scoped = useMemo(
    () => (loc === "all" ? data.reviews : data.reviews.filter((r) => r.loc === loc)),
    [data.reviews, loc],
  );
  const stats = useMemo(
    () =>
      computeStats(
        scoped,
        loc === "all" ? data.locations : data.locations.filter((l) => l.id === loc),
      ),
    [scoped, data.locations, loc],
  );

  const ctx: HubCtx = {
    slug,
    brand,
    logo,
    viewer,
    data,
    loaded,
    settings,
    setSettings,
    loc,
    setLoc,
    scoped,
    stats,
    locationsById,
    view,
    go,
    inboxPreset,
    syncing: syncing || data.running,
    runSync,
    refresh,
    toast,
    applyReview,
    setDraft,
  };

  return (
    <HubContext.Provider value={ctx}>
      <MotionConfig reducedMotion="user">
        <div className="relative min-h-screen">
          <div className="relative flex min-h-screen">
            <Sidebar />
            <main id="rhub-main" className="relative min-w-0 flex-1">
              <HairStrands subtle />
              <div className="relative mx-auto w-full max-w-[1320px] px-4 pb-20 pt-4 sm:px-6 lg:px-10 lg:pt-10">
                <MobileNav />
                <PageHeader />
                {/* Só entrada, sem saída: com AnimatePresence «wait» a vista
                    antiga ficava presa a meio da saída (as vistas têm
                    dezenas de filhos animados) e a nova nunca aparecia. */}
                <motion.div
                  key={view}
                  initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                  className="mt-7"
                >
                  {view === "dashboard" && <DashboardView />}
                  {view === "reviews" && <InboxView />}
                  {view === "respostas" && <PlaybookView />}
                  {view === "definicoes" && <SettingsView />}
                </motion.div>
                <p className="mt-16 text-right text-xs text-white/30">
                  made by <span className="font-semibold text-white/55">WonderAds</span>
                </p>
              </div>
            </main>
          </div>
          <Toasts toasts={toasts} />
        </div>
      </MotionConfig>
    </HubContext.Provider>
  );
}
