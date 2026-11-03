"use client";

// Origem de Pacientes — a página da receção (/<slug>/origem).
//
// Dois separadores: «Registar» (o ecrã do tablet: escolher a origem, tocar em
// Registar, e anular nos 20 s seguintes) e «Relatórios» (mês a mês, por
// clínica). A clínica do aparelho fica guardada no próprio browser; um
// `?clinica=<id>` no link fixa-a (útil para o favorito do tablet).

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { BarChart3, Check, ChevronRight, Eye, Loader2, LogOut, MapPin, PenLine, Undo2 } from "lucide-react";
import type { OrigemClient } from "@/lib/origem/config";
import { lisbonParts, type MonthStats } from "@/lib/origem/stats";
import { OrigemReports } from "./origem-reports";
import { BrandBackdrop, BumpNumber, CHANNEL_ICONS, LogoPlate, MadeBy, SOURCE_ICONS, WA_GRADIENT, tint } from "./origem-ui";

export type OrigemBootstrap = {
  slug: string;
  cfg: OrigemClient;
  logo: string | null;
  viewer: { kind: "client" | "team"; name: string | null; canWrite: boolean };
  history: MonthStats[];
};

const UNDO_SECONDS = 20;
const POLL_MS = 30_000;

type Tab = "registar" | "relatorios";
type Toast =
  | { kind: "ok"; id: string; source: string; channel: string | null; until: number }
  | { kind: "undone" }
  | { kind: "error"; text: string };

function useDeviceId(): string {
  const [id, setId] = useState("");
  useEffect(() => {
    const make = () => `d${Math.random().toString(36).slice(2, 12)}`;
    try {
      let v = localStorage.getItem("origem-device");
      if (!v || !/^d[a-z0-9]{6,20}$/.test(v)) {
        v = make();
        localStorage.setItem("origem-device", v);
      }
      setId(v);
    } catch {
      setId(make());
    }
  }, []);
  return id;
}

export function OrigemApp({ bootstrap }: { bootstrap: OrigemBootstrap }) {
  const { slug, cfg, logo, viewer } = bootstrap;
  const router = useRouter();
  const device = useDeviceId();
  const [tab, setTab] = useState<Tab>("registar");
  const [history, setHistory] = useState<Record<string, MonthStats>>(() =>
    Object.fromEntries(bootstrap.history.map((m) => [m.month, m])),
  );
  const [site, setSite] = useState<string | null>(cfg.sites.length === 1 ? cfg.sites[0].id : null);
  const [siteReady, setSiteReady] = useState(cfg.sites.length === 1);
  const [source, setSource] = useState<string | null>(null);
  const [channel, setChannel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const siteKey = `origem:${slug}:site`;

  // A clínica deste aparelho: o link manda, depois o que ficou guardado.
  useEffect(() => {
    if (cfg.sites.length === 1) return;
    const fromUrl = new URLSearchParams(window.location.search).get("clinica");
    let chosen: string | null = null;
    if (fromUrl && cfg.sites.some((s) => s.id === fromUrl)) chosen = fromUrl;
    else {
      try {
        const saved = localStorage.getItem(siteKey);
        if (saved && cfg.sites.some((s) => s.id === saved)) chosen = saved;
      } catch {
        /* sem armazenamento: pergunta sempre */
      }
    }
    setSite(chosen);
    setSiteReady(true);
  }, [cfg.sites, siteKey]);

  const chooseSite = (id: string | null) => {
    setSite(id);
    setSource(null);
    setChannel(null);
    setToast(null);
    try {
      if (id) localStorage.setItem(siteKey, id);
      else localStorage.removeItem(siteKey);
    } catch {
      /* ignora */
    }
  };

  const merge = useCallback((stats: MonthStats | undefined) => {
    if (stats) setHistory((h) => ({ ...h, [stats.month]: stats }));
  }, []);

  // O mês em curso refresca-se sozinho — outro tablet pode estar a registar.
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      setNow(Date.now());
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/origem/${slug}/data`, { cache: "no-store" });
        if (res.status === 401) {
          router.refresh();
          return;
        }
        if (!res.ok || stop) return;
        const j = (await res.json()) as { stats?: MonthStats };
        merge(j.stats);
      } catch {
        /* sem rede: tenta no próximo ciclo */
      }
    };
    const t = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      stop = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [slug, merge, router]);

  // A contagem decrescente do «Anular».
  useEffect(() => {
    if (toast?.kind !== "ok") return;
    const t = setInterval(() => {
      if (Date.now() >= toast.until) setToast(null);
      else setNow(Date.now());
    }, 250);
    return () => clearInterval(t);
  }, [toast]);

  const today = lisbonParts(now);
  const todayCount = site ? (history[today.month]?.sites[site]?.days[today.day - 1] ?? 0) : 0;
  const siteObj = cfg.sites.find((s) => s.id === site) ?? null;
  const readOnly = !viewer.canWrite;

  async function submit() {
    if (!site || !source || saving || readOnly || !device) return;
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch(`/api/origem/${slug}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site, source, channel, device }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; vote?: { id: string }; stats?: MonthStats };
      if (res.status === 401) {
        router.refresh();
        return;
      }
      if (!res.ok || !j.vote) throw new Error(j.error ?? "Não foi possível guardar. Verifique a ligação e tente outra vez.");
      merge(j.stats);
      setToast({ kind: "ok", id: j.vote.id, source, channel, until: Date.now() + UNDO_SECONDS * 1000 });
      setSource(null);
      setChannel(null);
    } catch (err) {
      setToast({ kind: "error", text: err instanceof Error ? err.message : "Não foi possível guardar." });
    } finally {
      setSaving(false);
    }
  }

  async function undo() {
    if (toast?.kind !== "ok") return;
    const { id } = toast;
    setToast(null);
    try {
      const res = await fetch(`/api/origem/${slug}/undo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, device }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; stats?: MonthStats };
      if (!res.ok) throw new Error(j.error ?? "Não foi possível anular.");
      merge(j.stats);
      setToast({ kind: "undone" });
      setTimeout(() => setToast((t) => (t?.kind === "undone" ? null : t)), 3000);
    } catch (err) {
      setToast({ kind: "error", text: err instanceof Error ? err.message : "Não foi possível anular." });
    }
  }

  async function signOut() {
    await fetch(`/api/origem/${slug}/auth`, { method: "DELETE" }).catch(() => null);
    router.refresh();
  }

  return (
    <div className="relative min-h-screen text-white">
      <BrandBackdrop />

      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#07080d]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <LogoPlate logo={logo} brand={cfg.brand} />
          <div className="hidden min-w-0 border-l border-white/10 pl-3 md:block">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">{cfg.brand}</p>
            <p className="truncate text-sm font-semibold">Origem dos {cfg.person.many}</p>
          </div>

          <nav className="ml-auto flex rounded-2xl border border-white/10 bg-white/[0.03] p-1" aria-label="Secções">
            {(
              [
                { id: "registar", label: "Registar", Icon: PenLine },
                { id: "relatorios", label: "Relatórios", Icon: BarChart3 },
              ] as const
            ).map(({ id, label, Icon }) => {
              const on = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  aria-current={on ? "page" : undefined}
                  className={`relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition sm:px-4 ${
                    on ? "text-white" : "text-white/50 hover:text-white/80"
                  }`}
                >
                  {on && (
                    <motion.span
                      layoutId="origem-tab"
                      className="absolute inset-0 rounded-xl"
                      style={{ background: "linear-gradient(135deg,rgba(52,62,215,.55),rgba(120,61,245,.55) 55%,rgba(197,53,201,.5))" }}
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <Icon className="relative h-4 w-4" />
                  <span className="relative">{label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-40 pt-8 sm:px-6 sm:pt-10">
        {viewer.kind === "team" && (
          <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-xs text-white/55">
            <Eye className="h-3.5 w-3.5 text-violet-300" />
            {readOnly ? (
              <span>Equipa WonderAds · só consulta.</span>
            ) : (
              <span>
                Equipa WonderAds · {viewer.name}. Os registos que fizer aqui contam nos números do cliente: use para testar e anule logo a seguir.
              </span>
            )}
          </div>
        )}

        {tab === "registar" ? (
          !siteReady ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-white/40" />
            </div>
          ) : !siteObj ? (
            <SitePicker cfg={cfg} onPick={chooseSite} />
          ) : (
            <RegisterView
              cfg={cfg}
              site={siteObj}
              canChangeSite={cfg.sites.length > 1}
              onChangeSite={() => chooseSite(null)}
              todayCount={todayCount}
              source={source}
              channel={channel}
              onSource={(id) => {
                setSource(id);
                if (toast?.kind === "error") setToast(null);
              }}
              onChannel={setChannel}
              saving={saving}
              readOnly={readOnly}
              onSubmit={submit}
            />
          )
        ) : (
          <OrigemReports cfg={cfg} history={history} now={now} />
        )}

        <footer className="mt-16 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/30">
          <MadeBy />
          {viewer.kind === "client" && (
            <button type="button" onClick={signOut} className="inline-flex items-center gap-1 transition hover:text-white/60">
              <LogOut className="h-3 w-3" /> Terminar sessão neste aparelho
            </button>
          )}
        </footer>
      </main>

      <AnimatePresence>
        {toast && tab === "registar" && (
          <ToastBar key={toast.kind === "ok" ? toast.id : toast.kind} toast={toast} cfg={cfg} now={now} onUndo={undo} onClose={() => setToast(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function SitePicker({ cfg, onPick }: { cfg: OrigemClient; onPick: (id: string) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8CC2D0]">Antes de começar</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Em que {cfg.place.one} está?</h1>
      <p className="mt-2 text-sm text-white/55">Este aparelho fica a registar para {cfg.place.the} que escolher. Pode mudar quando quiser.</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {cfg.sites.map((s, i) => (
          <motion.button
            key={s.id}
            type="button"
            onClick={() => onPick(s.id)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            whileTap={{ scale: 0.98 }}
            className="group flex items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-left transition hover:border-[#6EC1D6]/50 hover:bg-white/[0.05]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#6EC1D6]/12 text-[#8CC2D0]">
              <MapPin className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-semibold leading-tight">{s.name}</span>
              <span className="mt-0.5 block text-sm text-white/45">{s.short}</span>
            </span>
            <ChevronRight className="h-5 w-5 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white/70" />
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

function RegisterView({
  cfg,
  site,
  canChangeSite,
  onChangeSite,
  todayCount,
  source,
  channel,
  onSource,
  onChannel,
  saving,
  readOnly,
  onSubmit,
}: {
  cfg: OrigemClient;
  site: OrigemClient["sites"][number];
  canChangeSite: boolean;
  onChangeSite: () => void;
  todayCount: number;
  source: string | null;
  channel: string | null;
  onSource: (id: string) => void;
  onChannel: (id: string | null) => void;
  saving: boolean;
  readOnly: boolean;
  onSubmit: () => void;
}) {
  const picked = cfg.sources.find((s) => s.id === source) ?? null;
  const submitRef = useRef<HTMLButtonElement>(null);
  const canSubmit = Boolean(picked) && !saving && !readOnly;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#6EC1D6]/25 bg-[#6EC1D6]/[0.07] py-1.5 pl-3 pr-1.5 text-sm">
          <MapPin className="h-3.5 w-3.5 text-[#8CC2D0]" />
          <span className="font-semibold">{site.name}</span>
          {canChangeSite && (
            <button type="button" onClick={onChangeSite} className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white/50 transition hover:bg-white/10 hover:text-white">
              Mudar
            </button>
          )}
        </div>
        <div className="flex items-baseline gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-2">
          <span className="text-xs text-white/45">Hoje {cfg.place.inThis}</span>
          <BumpNumber value={todayCount} className="text-xl font-semibold" />
        </div>
      </div>

      <div className="mt-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8CC2D0]">{cap(cfg.person.one)} novo</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-[42px] sm:leading-[1.1]">Como nos conheceu?</h1>
        <p className="mt-2 text-sm text-white/55 sm:text-base">Pergunte a cada {cfg.person.one} novo e toque na resposta.</p>
      </div>

      {readOnly && (
        <p className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100/90">
          Este perfil só pode consultar. Os botões ficam visíveis para ver o ecrã da receção.
        </p>
      )}

      <fieldset className="mt-7">
        <legend className="sr-only">Origem do {cfg.person.one}</legend>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {cfg.sources.map((s, i) => {
            const Icon = SOURCE_ICONS[s.id] ?? SOURCE_ICONS.outro;
            const on = source === s.id;
            return (
              <motion.button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  onSource(s.id);
                  requestAnimationFrame(() => submitRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.03 * i }}
                whileTap={{ scale: 0.97 }}
                className="relative flex min-h-[124px] flex-col items-start gap-3 rounded-3xl border p-4 text-left transition-colors sm:p-5"
                style={{
                  borderColor: on ? s.color : "rgba(255,255,255,0.09)",
                  background: on ? tint(s.color, 0.13) : "rgba(255,255,255,0.025)",
                  boxShadow: on ? `0 0 0 3px ${tint(s.color, 0.18)}, 0 18px 40px -22px ${tint(s.color, 0.8)}` : undefined,
                }}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: tint(s.color, on ? 0.28 : 0.14), color: s.color }}>
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-[16px] font-semibold leading-snug sm:text-[17px]">{s.label}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-white/45">{s.hint}</span>
                </span>
                <AnimatePresence>
                  {on && (
                    <motion.span
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0 }}
                      className="absolute right-3.5 top-3.5 flex h-6 w-6 items-center justify-center rounded-full text-[#07080d]"
                      style={{ background: s.color }}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-8">
        <legend className="text-sm font-semibold text-white/80">
          E como fez o contacto? <span className="font-normal text-white/40">(opcional)</span>
        </legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {cfg.channels.map((c) => {
            const Icon = CHANNEL_ICONS[c.id] ?? CHANNEL_ICONS.online;
            const on = channel === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChannel(on ? null : c.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                  on ? "border-[#8CC2D0] bg-[#6EC1D6]/15 text-white" : "border-white/10 bg-white/[0.03] text-white/65 hover:border-white/25 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {c.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <motion.button
        ref={submitRef}
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        whileTap={canSubmit ? { scale: 0.985 } : undefined}
        className="mt-9 flex h-16 w-full scroll-mb-32 items-center justify-center gap-2 rounded-2xl text-[17px] font-semibold text-white shadow-[0_18px_40px_-16px_rgba(120,61,245,0.8)] transition disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none sm:mx-auto sm:max-w-md"
        style={{ background: WA_GRADIENT }}
      >
        {saving ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : picked ? (
          <span>
            Registar · {picked.label}
            {channel && <span className="font-normal text-white/75"> · {cfg.channels.find((c) => c.id === channel)?.label}</span>}
          </span>
        ) : (
          "Escolha a origem para registar"
        )}
      </motion.button>
    </div>
  );
}

function ToastBar({
  toast,
  cfg,
  now,
  onUndo,
  onClose,
}: {
  toast: Toast;
  cfg: OrigemClient;
  now: number;
  onUndo: () => void;
  onClose: () => void;
}) {
  const src = toast.kind === "ok" ? cfg.sources.find((s) => s.id === toast.source) : null;
  const ch = toast.kind === "ok" && toast.channel ? cfg.channels.find((c) => c.id === toast.channel) : null;
  const left = toast.kind === "ok" ? Math.max(0, toast.until - now) : 0;
  const frac = left / (UNDO_SECONDS * 1000);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(16px,env(safe-area-inset-bottom))]"
      role="status"
    >
      <div
        className={`relative mx-auto flex max-w-xl items-center gap-3 overflow-hidden rounded-3xl border p-3.5 pl-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] ${
          toast.kind === "error" ? "border-rose-400/40 bg-[#1d0f15]" : "border-white/10 bg-[#11131b]"
        }`}
      >
        {toast.kind === "ok" ? (
          <>
            <motion.span
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-[#07080d]"
              style={{ background: "linear-gradient(135deg,#8CC2D0,#C9D22B)" }}
            >
              <Check className="h-5 w-5" strokeWidth={3} />
            </motion.span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Registado</p>
              <p className="truncate text-xs text-white/55">
                {src?.label ?? "—"}
                {ch ? ` · ${ch.label}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={onUndo}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 px-3.5 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10"
            >
              <Undo2 className="h-4 w-4" /> Anular <span className="tabular-nums text-white/40">{Math.ceil(left / 1000)}</span>
            </button>
            <span className="absolute bottom-0 left-0 h-[3px] origin-left" style={{ width: `${frac * 100}%`, background: WA_GRADIENT }} />
          </>
        ) : toast.kind === "undone" ? (
          <p className="py-1.5 text-sm text-white/75">Registo anulado.</p>
        ) : (
          <>
            <p className="flex-1 py-1 text-sm text-rose-200">{toast.text}</p>
            <button type="button" onClick={onClose} className="rounded-xl px-3 py-1.5 text-sm text-white/60 hover:bg-white/10">
              Fechar
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
