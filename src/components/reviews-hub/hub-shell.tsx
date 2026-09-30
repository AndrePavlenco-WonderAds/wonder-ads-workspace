"use client";

// A moldura do Reviews Hub: barra lateral, navegação móvel, escolha do
// salão, cabeçalho de cada vista e os avisos (toasts).

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import {
  Check,
  ChevronDown,
  CircleAlert,
  House,
  Info,
  LogOut,
  MapPin,
  MessageSquareText,
  MessagesSquare,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Store,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { formatDateTime } from "@/lib/dates";
import { useHub, type HubView, type Toast } from "./hub-context";
import { formatRating, relativeTime, STAR_GOLD } from "./hub-ui";

const NAV: { view: HubView; label: string; Icon: LucideIcon }[] = [
  { view: "dashboard", label: "Dashboard", Icon: House },
  { view: "reviews", label: "Reviews", Icon: MessageSquareText },
  { view: "respostas", label: "Respostas", Icon: MessagesSquare },
  { view: "definicoes", label: "Definições", Icon: Settings },
];

function useNavBadges() {
  const { stats, data, loc } = useHub();
  const awaiting = Object.values(data.drafts).filter(
    (d) => d.status === "awaiting_approval" && (loc === "all" || d.loc === loc),
  ).length;
  return { reviews: stats.unanswered, awaiting };
}

// ── Logótipo ──────────────────────────────────────────────────────────
function BrandTile({ compact = false }: { compact?: boolean }) {
  const { logo, brand } = useHub();
  return (
    <motion.div
      whileHover={{ rotate: -1.5, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 18 }}
      className={`relative flex items-center justify-center rounded-2xl bg-white shadow-[0_16px_40px_-18px_rgba(120,61,245,0.7)] ${
        compact ? "h-11 w-16 p-1.5" : "h-[104px] w-[150px] p-4"
      }`}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={brand} className="max-h-full max-w-full object-contain" />
      ) : (
        <span className="text-sm font-semibold text-black">{brand}</span>
      )}
    </motion.div>
  );
}

// ── Barra lateral (desktop) ───────────────────────────────────────────
export function Sidebar() {
  const { view, go } = useHub();
  const badges = useNavBadges();
  return (
    <aside className="sticky top-0 hidden h-screen w-[268px] shrink-0 flex-col border-r border-white/[0.06] bg-white/[0.012] px-5 py-8 lg:flex">
      <div className="px-2">
        <BrandTile />
      </div>
      <LayoutGroup id="rhub-side">
        <nav className="mt-10 flex flex-col gap-1.5">
          {NAV.map(({ view: v, label, Icon }, i) => {
            const active = view === v;
            const badge = v === "reviews" ? badges.reviews : 0;
            return (
              <motion.button
                key={v}
                onClick={() => go(v)}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 + i * 0.05, duration: 0.4 }}
                className={`group relative flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-left text-[15px] transition-colors ${
                  active ? "text-white" : "text-white/55 hover:text-white/90"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="rhub-nav-pill"
                    className="absolute inset-0 rounded-xl border border-violet-400/25 bg-[linear-gradient(135deg,rgba(99,102,241,0.22),rgba(139,92,246,0.18))] shadow-[0_8px_30px_-12px_rgba(139,92,246,0.6)]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <Icon
                  className={`relative h-[18px] w-[18px] transition-transform duration-300 group-hover:scale-110 ${
                    active ? "text-violet-200" : ""
                  }`}
                />
                <span className="relative font-medium">{label}</span>
                {badge > 0 && (
                  <motion.span
                    key={badge}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative ml-auto rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-200 ring-1 ring-rose-400/30"
                  >
                    {badge > 999 ? "999+" : badge}
                  </motion.span>
                )}
                {v === "reviews" && badges.awaiting > 0 && (
                  <span
                    className="relative rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-200 ring-1 ring-amber-300/30"
                    title="Respostas à espera de aprovação"
                  >
                    {badges.awaiting}
                  </span>
                )}
              </motion.button>
            );
          })}
        </nav>
      </LayoutGroup>

      <div className="mt-auto">
        <p className="px-2 text-[12px] font-medium text-white/40">Perfil da empresa</p>
        <div className="mt-2">
          <LocationPicker placement="up" />
        </div>
        <ViewerFooter />
      </div>
    </aside>
  );
}

function ViewerFooter() {
  const { viewer, slug } = useHub();
  const router = useRouter();
  if (viewer.kind === "team") {
    return (
      <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[12px] text-white/50">
        <ShieldCheck className="h-4 w-4 shrink-0 text-violet-300" />
        <span className="truncate">
          Equipa Wonder Ads · <span className="text-white/75">{viewer.name}</span>
          {!viewer.canWrite && " · só leitura"}
        </span>
      </div>
    );
  }
  return (
    <button
      onClick={async () => {
        await fetch(`/api/reviews-hub/${slug}/auth`, { method: "DELETE" });
        router.refresh();
      }}
      className="mt-5 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] text-white/45 transition hover:bg-white/[0.04] hover:text-white/80"
    >
      <LogOut className="h-4 w-4" /> Sair
    </button>
  );
}

// ── Escolha do salão ──────────────────────────────────────────────────
export function LocationPicker({ placement = "down" }: { placement?: "up" | "down" }) {
  const { data, loc, setLoc, brand, logo } = useHub();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unansweredByLoc = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data.reviews) if (!r.reply) m.set(r.loc, (m.get(r.loc) ?? 0) + 1);
    return m;
  }, [data.reviews]);

  const current = loc === "all" ? null : data.locations.find((l) => l.id === loc);
  const list = data.locations.filter(
    (l) => !q || `${l.short} ${l.locality ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
          open ? "border-violet-400/40 bg-white/[0.06]" : "border-white/10 bg-white/[0.03] hover:border-white/20"
        }`}
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white p-1">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <Store className="h-4 w-4 text-black" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-white/90">
            {current ? current.short : brand}
          </span>
          <span className="block truncate text-[11px] text-white/40">
            {current ? current.locality ?? "Salão" : `Todos os salões · ${data.locations.length}`}
          </span>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }}>
          <ChevronDown className="h-4 w-4 text-white/45" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: placement === "up" ? 10 : -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: placement === "up" ? 6 : -6, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute z-50 w-[300px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#11111a]/95 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl ${
              placement === "up" ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2"
            }`}
          >
            {data.locations.length > 7 && (
              <div className="flex items-center gap-2 border-b border-white/[0.06] px-3.5 py-2.5">
                <Search className="h-3.5 w-3.5 text-white/35" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Procurar salão…"
                  className="w-full bg-transparent text-[13px] text-white outline-none placeholder:text-white/30"
                />
              </div>
            )}
            <div className="rhub-scroll max-h-[340px] overflow-y-auto p-1.5">
              {!q && (
                <PickerRow
                  active={loc === "all"}
                  title="Todos os salões"
                  sub={`${data.locations.length} perfis Google`}
                  onClick={() => {
                    setLoc("all");
                    setOpen(false);
                  }}
                />
              )}
              {list.map((l, i) => (
                <motion.div
                  key={l.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i, 12) * 0.02 }}
                >
                  <PickerRow
                    active={loc === l.id}
                    title={l.short}
                    sub={l.locality ?? l.address ?? ""}
                    rating={l.average ?? null}
                    badge={unansweredByLoc.get(l.id) ?? 0}
                    error={Boolean(l.error)}
                    onClick={() => {
                      setLoc(l.id);
                      setOpen(false);
                      setQ("");
                    }}
                  />
                </motion.div>
              ))}
              {list.length === 0 && (
                <p className="px-3 py-4 text-center text-[13px] text-white/40">
                  {data.locations.length === 0 ? "Ainda sem perfis — sincroniza com o Google." : "Nenhum salão encontrado."}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PickerRow({
  active,
  title,
  sub,
  rating,
  badge = 0,
  error = false,
  onClick,
}: {
  active: boolean;
  title: string;
  sub: string;
  rating?: number | null;
  badge?: number;
  error?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${
        active ? "bg-violet-500/15" : "hover:bg-white/[0.05]"
      }`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
          active ? "bg-violet-400/20 text-violet-200" : "bg-white/[0.05] text-white/45"
        }`}
      >
        {active ? <Check className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-white/90">{title}</span>
        {sub && <span className="block truncate text-[11px] text-white/40">{sub}</span>}
      </span>
      {error && <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-300" />}
      {typeof rating === "number" && (
        <span className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-white/75">
          <span style={{ color: STAR_GOLD }}>★</span>
          {formatRating(rating)}
        </span>
      )}
      {badge > 0 && (
        <span className="shrink-0 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-200">
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Navegação móvel ───────────────────────────────────────────────────
export function MobileNav() {
  const { view, go } = useHub();
  const badges = useNavBadges();
  return (
    <div className="lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <BrandTile compact />
        <div className="w-[62%] max-w-[300px]">
          <LocationPicker placement="down" />
        </div>
      </div>
      <LayoutGroup id="rhub-mobile">
        <nav className="rhub-scroll -mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {NAV.map(({ view: v, label, Icon }) => {
            const active = view === v;
            return (
              <button
                key={v}
                onClick={() => go(v)}
                className={`relative flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-medium transition ${
                  active ? "text-white" : "text-white/55"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="rhub-mobile-pill"
                    className="absolute inset-0 rounded-full border border-violet-400/30 bg-violet-500/20"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <Icon className="relative h-4 w-4" />
                <span className="relative">{label}</span>
                {v === "reviews" && badges.reviews > 0 && (
                  <span className="relative rounded-full bg-rose-500/20 px-1.5 text-[10px] font-semibold text-rose-200">
                    {badges.reviews}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </LayoutGroup>
    </div>
  );
}

// ── Cabeçalho de cada vista ───────────────────────────────────────────
const HEADINGS: Record<HubView, { eyebrow: string; title: string; sub: string }> = {
  dashboard: {
    eyebrow: "Visão geral",
    title: "Reviews dos salões",
    sub: "Tudo o que os clientes dizem no Google, salão a salão.",
  },
  reviews: {
    eyebrow: "Reviews",
    title: "Caixa de reviews",
    sub: "Leia, responda e publique no Google — sem sair daqui.",
  },
  respostas: {
    eyebrow: "Reviews",
    title: "Respostas a Reviews",
    sub: "Crie respostas profissionais e personalizadas para cada avaliação.",
  },
  definicoes: {
    eyebrow: "Definições",
    title: "Definições",
    sub: "O tom, as regras e a automação das respostas.",
  },
};

export function PageHeader() {
  const { view, loc, setLoc, data } = useHub();
  const h = HEADINGS[view];
  const current = loc === "all" ? null : data.locations.find((l) => l.id === loc);
  return (
    <header className="mt-6 lg:mt-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <span className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.035] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
                {h.eyebrow}
              </span>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
                <h1 className="text-[34px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[44px]">
                  {h.title}
                </h1>
                <AutomationPill />
              </div>
              <p className="mt-2.5 text-[15px] text-white/55 sm:text-base">{h.sub}</p>
            </motion.div>
          </AnimatePresence>
          <AnimatePresence>
            {current && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => setLoc("all")}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-[12px] font-medium text-violet-100 transition hover:bg-violet-500/20"
                title="Ver todos os salões"
              >
                <MapPin className="h-3.5 w-3.5" /> {current.short}
                <X className="h-3.5 w-3.5 opacity-60" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        <SyncStatus />
      </div>
      <SyncBanner />
    </header>
  );
}

function AutomationPill() {
  const { settings, go } = useHub();
  const on = settings.automation.enabled;
  return (
    <motion.button
      onClick={() => go("definicoes")}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      className={`inline-flex items-center gap-2.5 rounded-full border px-4 py-2 text-[14px] font-medium transition ${
        on
          ? "border-emerald-400/25 bg-emerald-400/[0.07] text-white"
          : "border-white/12 bg-white/[0.035] text-white/65 hover:text-white"
      }`}
      title={on ? "As reviews novas são tratadas sozinhas — ver Definições" : "Ligar a automação em Definições"}
    >
      <span className="relative flex h-2.5 w-2.5">
        {on && <span className="rhub-ping absolute inset-0 rounded-full bg-emerald-400" />}
        <span className={`relative h-2.5 w-2.5 rounded-full ${on ? "bg-emerald-400" : "bg-white/30"}`} />
      </span>
      {on ? "Automação ativa" : "Automação em pausa"}
    </motion.button>
  );
}

function SyncStatus() {
  const { data, syncing, runSync, viewer } = useHub();
  const last = data.sync.lastSyncAt;
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/[0.03] py-1 pl-3.5 pr-1 text-[12px] text-white/50">
      <span className="flex items-center gap-1.5" title={last ? `Última sincronização: ${formatDateTime(last)}` : undefined}>
        <span className={`h-1.5 w-1.5 rounded-full ${data.sync.ok ? "bg-emerald-400" : "bg-amber-400"}`} />
        {syncing ? "A sincronizar com o Google…" : last ? `Google · ${relativeTime(last)}` : "Ainda sem sincronização"}
      </span>
      {viewer.canWrite && (
        <button
          onClick={() => void runSync()}
          disabled={syncing}
          className="flex h-7 w-7 items-center justify-center rounded-full text-white/55 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-wait"
          aria-label="Sincronizar agora"
          title="Sincronizar agora"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
        </button>
      )}
    </div>
  );
}

function SyncBanner() {
  const { data, viewer, go } = useHub();
  const s = data.sync;
  if (s.ok || !s.error) return null;
  const team = viewer.kind === "team";
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] px-4 py-3 text-[13px] text-amber-50/90"
    >
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-amber-100">
          {data.reviews.length > 0
            ? "A ligação ao Google falhou na última tentativa — os dados podem não estar atualizados."
            : "Ainda não foi possível ligar ao Google."}
        </p>
        <p className="mt-0.5 text-amber-50/70">
          {team ? s.error : "A equipa Wonder Ads vê os detalhes técnicos deste aviso na mesma página."}
        </p>
        {team && s.fixUrl && (
          <a href={s.fixUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block font-semibold text-amber-200 underline underline-offset-2">
            Ativar a API na Google Cloud →
          </a>
        )}
      </div>
      <button onClick={() => go("definicoes")} className="shrink-0 text-[12px] font-semibold text-amber-200/80 hover:text-amber-100">
        Detalhes
      </button>
    </motion.div>
  );
}

// ── Avisos ────────────────────────────────────────────────────────────
export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[80] flex w-[min(380px,calc(100vw-2.5rem))] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 text-[13px] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl ${
              t.tone === "error"
                ? "border-rose-400/30 bg-[#2a1118]/90 text-rose-50"
                : t.tone === "info"
                  ? "border-sky-400/25 bg-[#0f1a26]/90 text-sky-50"
                  : "border-emerald-400/25 bg-[#0d1f19]/90 text-emerald-50"
            }`}
          >
            {t.tone === "error" ? (
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
            ) : t.tone === "info" ? (
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
            ) : (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            )}
            <span className="leading-snug">{t.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
