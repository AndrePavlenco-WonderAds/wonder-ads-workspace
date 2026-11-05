"use client";

// Origem de Pacientes — a página da receção (/<slug>/origem), v78.69.
//
// O registo faz-se em dois toques: a origem (uma tecla grande) e o canal
// (numa folha que sobe; «sem indicar o canal» também regista). A cruz da
// marca monta-se a cada registo e o «Anular» fica 20 s no fundo do ecrã. À
// direita (ou por baixo, no tablet na vertical), os registos de hoje nesta
// clínica.
//
// A clínica do aparelho fica guardada no próprio browser; um `?clinica=<id>`
// no link fixa-a (útil para o favorito do tablet). Até haver clínica, o ecrã
// é o da escolha da clínica.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, BarChart3, Check, ChevronDown, Eye, Loader2, LogOut, MapPin, PenLine, Search, Undo2, X } from "lucide-react";
import type { OrigemClient, OrigemSite, OrigemSource } from "@/lib/origem/config";
import { placeWords, siteFromQuery } from "@/lib/origem/words";
import { dayLabel, lisbonClock, lisbonGreeting, lisbonParts, type MonthStats, type TodayVote } from "@/lib/origem/stats";
import { OrigemReports } from "./origem-reports";
import { BrandMark, BumpNumber, CHANNEL_ICONS, ClientLogo, SOURCE_ICONS, tint } from "./origem-ui";
import { WonderAdsFooter } from "./wonder-ads-signature";

export type OrigemBootstrap = {
  slug: string;
  cfg: OrigemClient;
  logo: string | null;
  viewer: { kind: "client" | "team"; name: string | null; canWrite: boolean };
  history: MonthStats[];
  today: TodayVote[];
  serverNow: number;
};

const UNDO_SECONDS = 20;
const POLL_MS = 30_000;
const SUCCESS_MS = 1300;

type Tab = "registar" | "relatorios";
type Toast =
  | { kind: "ok"; id: string; source: string; channel: string | null; until: number }
  | { kind: "undone" }
  | { kind: "error"; text: string };
type SheetState =
  | { step: "channel"; source: string }
  | { step: "done"; source: string; channel: string | null; n: number };

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

/** «Google, por telefone» / «Google». */
function phraseOf(cfg: OrigemClient, source: string, channel: string | null): string {
  const s = cfg.sources.find((x) => x.id === source)?.label ?? "Outra";
  const c = channel ? cfg.channels.find((x) => x.id === channel)?.phrase : null;
  return c ? `${s}, ${c}` : s;
}

export function OrigemApp({ bootstrap }: { bootstrap: OrigemBootstrap }) {
  const { slug, cfg, logo, viewer } = bootstrap;
  const router = useRouter();
  const device = useDeviceId();
  const [tab, setTab] = useState<Tab>("registar");
  const [history, setHistory] = useState<Record<string, MonthStats>>(() =>
    Object.fromEntries(bootstrap.history.map((m) => [m.month, m])),
  );
  const [today, setToday] = useState<TodayVote[]>(bootstrap.today);
  const single = cfg.sites.length === 1;
  const [site, setSite] = useState<string | null>(single ? cfg.sites[0].id : null);
  const [siteReady, setSiteReady] = useState(single);
  const [picking, setPicking] = useState(false);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [now, setNow] = useState(bootstrap.serverNow);
  const registered = useRef(0);
  const siteKey = `origem:${slug}:site`;

  // O local deste aparelho: o link manda (?clinica=, ?loja=, ?salao=…),
  // depois o que ficou guardado.
  useEffect(() => {
    setNow(Date.now());
    if (single) return;
    let chosen = siteFromQuery(cfg, new URLSearchParams(window.location.search));
    if (!chosen) {
      try {
        const saved = localStorage.getItem(siteKey);
        if (saved && cfg.sites.some((s) => s.id === saved)) chosen = saved;
      } catch {
        /* sem armazenamento: pergunta sempre */
      }
    }
    setSite(chosen);
    setSiteReady(true);
  }, [cfg, siteKey, single]);

  const chooseSite = (id: string) => {
    setSite(id);
    setPicking(false);
    setSheet(null);
    setToast(null);
    setTab("registar");
    try {
      localStorage.setItem(siteKey, id);
    } catch {
      /* ignora */
    }
    window.scrollTo({ top: 0 });
  };

  const merge = useCallback((j: { stats?: MonthStats; today?: TodayVote[] }) => {
    const stats = j.stats;
    if (stats) setHistory((h) => ({ ...h, [stats.month]: stats }));
    if (Array.isArray(j.today)) setToday(j.today);
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
        merge((await res.json()) as { stats?: MonthStats; today?: TodayVote[] });
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

  // O «Registado» da folha fecha-se sozinho.
  useEffect(() => {
    if (sheet?.step !== "done") return;
    const t = setTimeout(() => setSheet((s) => (s?.step === "done" ? null : s)), SUCCESS_MS);
    return () => clearTimeout(t);
  }, [sheet]);

  const siteObj = cfg.sites.find((s) => s.id === site) ?? null;
  const siteToday = useMemo(() => (site ? today.filter((v) => v.site === site) : []), [today, site]);
  const readOnly = !viewer.canWrite;
  const closeSheet = useCallback(() => {
    if (!saving) setSheet(null);
  }, [saving]);

  async function register(channel: string | null) {
    if (sheet?.step !== "channel" || !site || saving || readOnly || !device) return;
    const source = sheet.source;
    setSaving(channel ?? "none");
    setToast(null);
    try {
      const res = await fetch(`/api/origem/${slug}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site, source, channel, device }),
      });
      if (res.status === 401) {
        router.refresh();
        return;
      }
      const j = (await res.json().catch(() => ({}))) as { error?: string; vote?: { id: string }; stats?: MonthStats; today?: TodayVote[] };
      if (!res.ok || !j.vote) throw new Error(j.error ?? "Não foi possível guardar. Verifique a ligação e tente outra vez.");
      merge(j);
      registered.current += 1;
      setSheet({ step: "done", source, channel, n: registered.current });
      setToast({ kind: "ok", id: j.vote.id, source, channel, until: Date.now() + UNDO_SECONDS * 1000 });
    } catch (err) {
      setSheet(null);
      setToast({ kind: "error", text: err instanceof Error ? err.message : "Não foi possível guardar." });
    } finally {
      setSaving(null);
    }
  }

  async function undo() {
    if (toast?.kind !== "ok") return;
    const { id } = toast;
    setToast(null);
    setSheet(null);
    try {
      const res = await fetch(`/api/origem/${slug}/undo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, device }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; stats?: MonthStats; today?: TodayVote[] };
      if (!res.ok) throw new Error(j.error ?? "Não foi possível anular.");
      merge(j);
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

  const showPicker = tab === "registar" && siteReady && (!siteObj || picking);

  return (
    <div className="relative isolate flex min-h-[100dvh] flex-col">
      {viewer.kind === "team" && (
        <div className="flex items-center justify-center gap-2 bg-[var(--o-ink)] px-4 py-2 text-center text-[13px] text-white/85">
          <Eye className="h-3.5 w-3.5 shrink-0 text-[#B9A6FF]" />
          {readOnly ? (
            <span>Está a ver como equipa WonderAds. Este perfil só pode consultar.</span>
          ) : (
            <span>
              Está a ver como equipa WonderAds{viewer.name ? ` (${viewer.name})` : ""}. Os registos feitos aqui contam nos números {cfg.brandOf}.
            </span>
          )}
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-[var(--o-line)] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-[68px] max-w-[1240px] items-center gap-3 px-4 sm:h-[76px] sm:gap-5 sm:px-8">
          {typeof cfg.theme.mark === "object" && !single ? (
            // No telemóvel, com o botão do local ao lado, um wordmark largo não
            // cabe: fica o símbolo da marca (o logótipo inteiro volta a 480 px).
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cfg.theme.mark.src} alt={cfg.brand} className="h-9 w-9 shrink-0 object-contain min-[480px]:hidden" />
              <ClientLogo logo={logo} brand={cfg.brand} size="header" className="hidden shrink-0 min-[480px]:block" />
            </>
          ) : (
            <ClientLogo logo={logo} brand={cfg.brand} size="header" className="shrink-0" />
          )}
          {siteObj && !showPicker && tab === "registar" && !single && (
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="group ml-1 flex min-w-0 items-center gap-2 rounded-[var(--o-pill)] border border-[var(--o-line)] bg-[var(--o-paper)] py-2 pl-3 pr-2.5 text-[15px] font-bold transition hover:border-[var(--o-primary)] sm:ml-2"
              aria-label={`${siteObj.name}. Mudar de ${cfg.place.one}`}
            >
              <MapPin className="h-4 w-4 shrink-0 text-[var(--o-deep)]" />
              <span className="truncate">
                <span className="sm:hidden">{siteObj.short}</span>
                <span className="hidden sm:inline">{siteObj.name}</span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-[var(--o-muted)] transition group-hover:translate-y-0.5" />
            </button>
          )}

          <nav className="ml-auto flex shrink-0 rounded-[var(--o-pill)] bg-[var(--o-paper)] p-1 ring-1 ring-[var(--o-line)]" aria-label="Secções">
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
                  onClick={() => {
                    setTab(id);
                    setSheet(null);
                    window.scrollTo({ top: 0 });
                  }}
                  aria-current={on ? "page" : undefined}
                  aria-label={label}
                  className={`relative flex items-center gap-2 rounded-[var(--o-pill)] px-3.5 py-2 text-[14px] font-bold transition sm:px-5 ${
                    on ? "text-[var(--o-ink)]" : "text-[var(--o-muted)] hover:text-[var(--o-ink)]"
                  }`}
                >
                  {on && (
                    <motion.span
                      layoutId="origem-tab"
                      className="absolute inset-0 rounded-[var(--o-pill)] bg-white shadow-[0_1px_2px_rgba(var(--o-ink-rgb),0.12),0_4px_14px_-6px_rgba(var(--o-ink-rgb),0.25)]"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <Icon className="relative h-4 w-4" />
                  <span className="relative hidden min-[440px]:inline">{label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 pb-32 pt-7 sm:px-8 sm:pt-10">
        {tab === "relatorios" ? (
          <OrigemReports cfg={cfg} history={history} now={now} onRegister={() => setTab("registar")} />
        ) : !siteReady ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--o-muted)]" />
          </div>
        ) : showPicker ? (
          <SitePicker cfg={cfg} now={now} current={siteObj?.id ?? null} onPick={chooseSite} onCancel={siteObj ? () => setPicking(false) : null} />
        ) : siteObj ? (
          <RegisterView
            cfg={cfg}
            site={siteObj}
            today={siteToday}
            now={now}
            readOnly={readOnly}
            lastId={toast?.kind === "ok" ? toast.id : null}
            onPick={(id) => {
              setSheet({ step: "channel", source: id });
              if (toast?.kind === "error") setToast(null);
            }}
          />
        ) : null}
      </main>

      <WonderAdsFooter>
        {viewer.kind === "client" && (
          <button type="button" onClick={signOut} className="inline-flex items-center gap-1.5 text-[13px] text-white/55 transition hover:text-white">
            <LogOut className="h-3.5 w-3.5" /> Terminar sessão neste aparelho
          </button>
        )}
      </WonderAdsFooter>

      <AnimatePresence>
        {sheet && siteObj && tab === "registar" && (
          <ChannelSheet key="sheet" cfg={cfg} sheet={sheet} saving={saving} onRegister={register} onClose={closeSheet} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && tab === "registar" && (
          <ToastBar key={toast.kind === "ok" ? toast.id : toast.kind} toast={toast} cfg={cfg} now={now} onUndo={undo} onClose={() => setToast(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───────────────────────── Escolher o local ───────────────────────── */

/** Sem acentos nem maiúsculas — «evora» encontra «Évora Plaza». */
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function SitePicker({
  cfg,
  now,
  current,
  onPick,
  onCancel,
}: {
  cfg: OrigemClient;
  now: number;
  current: string | null;
  onPick: (id: string) => void;
  onCancel: (() => void) | null;
}) {
  const reduce = useReducedMotion();
  // Até 4 locais: o ecrã de boas-vindas com cartões grandes (o da MyMedic).
  // Mais do que isso (lojas, salões, clínicas de uma rede): uma grelha
  // compacta e, a partir de 9, uma pesquisa.
  const many = cfg.sites.length > 4;
  const [query, setQuery] = useState("");
  const q = fold(query.trim());
  const shown = q ? cfg.sites.filter((s) => fold([s.name, s.short, ...(s.address ?? [])].join(" ")).includes(q)) : cfg.sites;

  const intro = (
    <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="mb-6 inline-flex items-center gap-2 rounded-[var(--o-pill)] py-1.5 pr-3 text-[15px] font-bold text-[var(--o-deep)] transition hover:gap-2.5"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao registo
        </button>
      )}
      <p className="text-[19px] font-semibold text-[var(--o-muted)]">{lisbonGreeting(now)}.</p>
      <h1 className={`o-display mt-2 text-[38px] leading-[1.04] tracking-[-0.035em] sm:text-[54px] ${many ? "max-w-[20ch]" : "max-w-[13ch]"}`}>
        Em que {cfg.place.one} fica este tablet?
      </h1>
      <p className="mt-5 max-w-[40ch] text-[17px] leading-relaxed text-[var(--o-muted)]">
        Os registos feitos neste aparelho contam para {cfg.place.the} que escolher. Pode trocar mais tarde, no topo do ecrã.
      </p>
    </motion.div>
  );

  const item = (s: OrigemSite, i: number) => (
    <motion.li
      key={s.id}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.06 + (many ? 0.025 : 0.07) * Math.min(i, 14), ease: [0.16, 1, 0.3, 1] }}
    >
      <SiteCard site={s} brand={cfg.brand} current={s.id === current} compact={many} onPick={() => onPick(s.id)} />
    </motion.li>
  );

  if (!many) {
    return (
      <div className="grid min-h-[58vh] content-center gap-8 lg:min-h-[62vh] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center lg:gap-16">
        {intro}
        <ul className="grid gap-4" role="list">
          {cfg.sites.map(item)}
        </ul>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        {intro}
        {cfg.sites.length > 8 && (
          <label className="relative block w-full sm:w-[360px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--o-muted)]" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Procurar ${cfg.place.one}…`}
              aria-label={`Procurar ${cfg.place.one}`}
              className="h-14 w-full rounded-[var(--o-pill)] border border-[var(--o-line)] bg-white pl-12 pr-4 text-[17px] outline-none transition placeholder:text-[var(--o-muted)] focus:border-[var(--o-deep)]"
            />
          </label>
        )}
      </div>
      <p className="mt-8 text-[14px] font-semibold text-[var(--o-muted)]">
        {shown.length === cfg.sites.length
          ? `${cfg.sites.length} ${cfg.place.many} ${cfg.brandShort}`
          : `${shown.length} de ${cfg.sites.length} ${cfg.place.many}`}
      </p>
      {shown.length > 0 ? (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3" role="list">
          {shown.map(item)}
        </ul>
      ) : (
        <p className="mt-6 text-[17px] text-[var(--o-muted)]">
          {placeWords(cfg).none} {cfg.place.one} com «{query.trim()}».
        </p>
      )}
    </div>
  );
}

function SiteCard({
  site,
  brand,
  current,
  compact,
  onPick,
}: {
  site: OrigemSite;
  brand: string;
  current: boolean;
  compact: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`group relative flex h-full w-full touch-manipulation items-center overflow-hidden border-2 bg-white text-left transition-[border-color,box-shadow,transform] duration-200 active:scale-[0.99] ${
        compact ? "gap-4 rounded-[calc(24px*var(--o-rs))] p-5" : "gap-5 rounded-[calc(28px*var(--o-rs))] p-6 sm:p-8"
      } ${
        current
          ? "border-[var(--o-deep)] shadow-[0_18px_40px_-26px_rgba(var(--o-ink-rgb),0.55)]"
          : "border-transparent shadow-[0_1px_0_var(--o-line),0_14px_34px_-28px_rgba(var(--o-ink-rgb),0.5)] hover:border-[var(--o-primary)]"
      }`}
    >
      <span className="min-w-0 flex-1">
        {!compact && <span className="block text-[14px] font-semibold text-[var(--o-muted)]">{brand}</span>}
        <span
          className={`block font-extrabold leading-[1.08] tracking-[-0.03em] ${compact ? "text-[22px] sm:text-[24px]" : "mt-0.5 text-[30px] sm:text-[38px]"}`}
        >
          {compact ? site.name : site.short}
        </span>
        {site.address && (
          <span className={`block leading-snug text-[var(--o-muted)] ${compact ? "mt-1.5 text-[14px]" : "mt-3 text-[15px]"}`}>
            {site.address.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </span>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-2">
        {current && <span className="rounded-[var(--o-pill)] bg-[var(--o-paper)] px-2.5 py-1 text-[12px] font-bold text-[var(--o-deep)]">Atual</span>}
        <span
          className={`flex items-center justify-center rounded-full transition-all duration-200 ${compact ? "h-11 w-11" : "h-14 w-14"} ${
            current
              ? "bg-[var(--o-deep)] text-white"
              : "bg-[var(--o-paper)] text-[var(--o-deep)] group-hover:bg-[var(--o-deep)] group-hover:text-white"
          }`}
        >
          {current ? (
            <Check className={compact ? "h-5 w-5" : "h-6 w-6"} strokeWidth={3} />
          ) : (
            <ArrowRight className={`${compact ? "h-5 w-5" : "h-6 w-6"} transition group-hover:translate-x-0.5`} />
          )}
        </span>
      </span>
    </button>
  );
}

/* ───────────────────────────── Registar ───────────────────────────── */

function RegisterView({
  cfg,
  site,
  today,
  now,
  readOnly,
  lastId,
  onPick,
}: {
  cfg: OrigemClient;
  site: OrigemSite;
  today: TodayVote[];
  now: number;
  readOnly: boolean;
  lastId: string | null;
  onPick: (id: string) => void;
}) {
  const main = cfg.sources.filter((s) => s.id !== "outro");
  const other = cfg.sources.find((s) => s.id === "outro") ?? null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="o-display text-[34px] leading-[1.05] tracking-[-0.035em] sm:text-[48px]">Como nos conheceu?</h1>
            <p className="mt-2.5 text-[17px] text-[var(--o-muted)]">Pergunte a cada {cfg.person.one} novo e toque na resposta.</p>
          </div>
          <TodayChip count={today.length} className="lg:hidden" />
        </div>

        {readOnly && (
          <p className="mt-6 rounded-[calc(16px*var(--o-rs))] border border-amber-300/60 bg-amber-50 px-4 py-3 text-[15px] text-amber-900">
            Este perfil só pode consultar: vê o ecrã de registo, mas as teclas não registam.
          </p>
        )}

        <fieldset className="mt-7 sm:mt-9" disabled={readOnly}>
          <legend className="sr-only">Origem do {cfg.person.one}</legend>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-6">
            {main.map((s, i) => (
              <SourceKey key={s.id} source={s} className={keySpan(main.length, i)} onPick={() => onPick(s.id)} disabled={readOnly} />
            ))}
          </div>
          {other && (
            <button
              type="button"
              onClick={() => onPick(other.id)}
              disabled={readOnly}
              className="mt-3 flex w-full touch-manipulation select-none items-center gap-4 rounded-[calc(22px*var(--o-rs))] border border-dashed border-[var(--o-line-strong)] px-5 py-4 text-left transition hover:border-[var(--o-deep)] hover:bg-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:mt-4"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[calc(16px*var(--o-rs))] bg-white text-[var(--o-muted)] ring-1 ring-[var(--o-line)]">
                <SourceIcon id={other.id} className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[18px] font-bold">Outra resposta</span>
                <span className="block truncate text-[14px] text-[var(--o-muted)]">{other.hint}</span>
              </span>
            </button>
          )}
        </fieldset>
      </div>

      <TodayPanel cfg={cfg} site={site} today={today} now={now} lastId={lastId} />
    </div>
  );
}

function SourceIcon({ id, className }: { id: string; className?: string }) {
  const Icon = SOURCE_ICONS[id] ?? SOURCE_ICONS.outro;
  return <Icon className={className} />;
}

/** As teclas das origens em linhas cheias. No ecrã largo (6 colunas): 6 = 3+3,
 *  5 = 3+2, 4 = 2+2. No telemóvel, duas por linha e a última ocupa a linha
 *  toda quando sobra. */
function keySpan(n: number, i: number): string {
  const lastAlone = n % 2 === 1 && i === n - 1 ? "col-span-2 " : "";
  const wide = n === 4 || (n === 5 && i >= 3) ? "md:col-span-3" : "md:col-span-2";
  return lastAlone + wide;
}

function SourceKey({
  source,
  className,
  onPick,
  disabled,
}: {
  source: OrigemSource;
  className: string;
  onPick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      className={`${className} group relative flex min-h-[150px] touch-manipulation select-none flex-col justify-between rounded-[calc(26px*var(--o-rs))] border border-[var(--o-line)] bg-white p-4 text-left shadow-[0_2px_0_var(--o-line),0_16px_30px_-26px_rgba(var(--o-ink-rgb),0.55)] transition-[transform,box-shadow,border-color] duration-150 hover:border-[var(--sc)] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[172px] sm:p-6`}
      style={{ ["--sc" as string]: source.color }}
    >
      <span
        className="flex h-12 w-12 items-center justify-center rounded-[calc(16px*var(--o-rs))] transition-transform duration-200 group-hover:scale-105 sm:h-14 sm:w-14"
        style={{ background: tint(source.color, 0.12), color: source.color }}
      >
        <SourceIcon id={source.id} className="h-6 w-6 sm:h-7 sm:w-7" />
      </span>
      <span className="mt-4 block">
        <span className="block text-[18px] font-extrabold leading-tight tracking-[-0.01em] sm:text-[22px]">{source.label}</span>
        <span className="mt-1 block text-[13px] leading-snug text-[var(--o-muted)] sm:text-[14.5px]">{source.hint}</span>
      </span>
    </button>
  );
}

function TodayChip({ count, className = "" }: { count: number; className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-2 rounded-[var(--o-pill)] bg-white px-4 py-2 text-[14px] font-semibold text-[var(--o-muted)] ring-1 ring-[var(--o-line)] ${className}`}>
      Hoje
      <BumpNumber value={count} className="text-[20px] font-extrabold text-[var(--o-ink)]" />
    </span>
  );
}

function TodayPanel({
  cfg,
  site,
  today,
  now,
  lastId,
}: {
  cfg: OrigemClient;
  site: OrigemSite;
  today: TodayVote[];
  now: number;
  lastId: string | null;
}) {
  const { month, day } = lisbonParts(now);
  const known = (id: string) => (cfg.sources.some((x) => x.id === id) ? id : "outro");
  const bySource = cfg.sources
    .map((o) => ({ o, n: today.filter((v) => known(v.source) === o.id).length }))
    .filter((x) => x.n > 0);
  const sourceOf = (id: string) => cfg.sources.find((s) => s.id === known(id)) ?? cfg.sources[cfg.sources.length - 1];
  const channelOf = (id: string | null) => (id ? cfg.channels.find((c) => c.id === id)?.label ?? null : null);

  return (
    <aside className="lg:sticky lg:top-[100px] lg:self-start" aria-label="Registos de hoje">
      <div className="overflow-hidden rounded-[calc(28px*var(--o-rs))] bg-white ring-1 ring-[var(--o-line)]">
        <div className="relative p-6">
          <p className="text-[15px] font-bold">{cfg.sites.length > 1 ? `Hoje em ${site.short}` : "Hoje"}</p>
          <p className="text-[13px] text-[var(--o-muted)]">{dayLabel(month, day)}</p>
          <div className="mt-4 flex items-end gap-3">
            <BumpNumber value={today.length} className="o-display text-[64px] leading-[0.9] tracking-[-0.04em]" />
            <span className="pb-1.5 text-[15px] font-semibold leading-tight text-[var(--o-muted)]">
              {today.length === 1 ? `${cfg.person.one} novo` : `${cfg.person.many} novos`}
            </span>
          </div>
          <BrandMark mark={cfg.theme.mark} play={today.length} still={today.length === 0} className="absolute right-5 top-5 h-14 w-14" />

          {bySource.length > 0 && (
            <div className="mt-5 flex h-2.5 gap-[2px] overflow-hidden rounded-full" aria-hidden>
              {bySource.map(({ o, n }) => (
                <motion.span key={o.id} layout className="h-full" style={{ flex: n, background: o.color }} />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--o-line)]">
          {today.length === 0 ? (
            <p className="px-6 py-6 text-[14.5px] leading-relaxed text-[var(--o-muted)]">
              Ainda sem registos hoje. O primeiro {cfg.person.one} novo aparece aqui.
            </p>
          ) : (
            <ol className="max-h-[360px] overflow-y-auto py-2" aria-label="Últimos registos">
              <AnimatePresence initial={false}>
                {today.slice(0, 40).map((v) => {
                  const s = sourceOf(v.source);
                  const ch = channelOf(v.channel);
                  return (
                    <motion.li
                      key={v.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className={`flex items-center gap-3 px-6 py-2.5 transition-colors ${v.id === lastId ? "bg-[var(--o-paper)]" : ""}`}
                    >
                      <span className="w-11 shrink-0 text-[13px] font-semibold tabular-nums text-[var(--o-muted)]">{lisbonClock(v.at)}</span>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{s.label}</span>
                      {ch && <span className="shrink-0 text-[13px] text-[var(--o-muted)]">{ch}</span>}
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ol>
          )}
        </div>
      </div>
    </aside>
  );
}

/* ────────────────────────── A folha do canal ────────────────────────── */

function ChannelSheet({
  cfg,
  sheet,
  saving,
  onRegister,
  onClose,
}: {
  cfg: OrigemClient;
  sheet: SheetState;
  saving: string | null;
  onRegister: (channel: string | null) => void;
  onClose: () => void;
}) {
  const source = cfg.sources.find((s) => s.id === sheet.source) ?? cfg.sources[0];
  const firstRef = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (sheet.step === "channel") firstRef.current?.focus({ preventScroll: true });
  }, [sheet.step]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 cursor-default bg-[rgba(var(--o-ink-rgb),0.45)]" tabIndex={-1} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="origem-sheet-title"
        className="relative w-full max-w-[600px] rounded-t-[calc(32px*var(--o-rs))] bg-white px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-6 shadow-[0_40px_80px_-30px_rgba(var(--o-ink-rgb),0.6)] sm:rounded-[calc(32px*var(--o-rs))] sm:p-8"
        initial={reduce ? { opacity: 0 } : { y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={reduce ? { opacity: 0 } : { y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 36 }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {sheet.step === "channel" ? (
            <motion.div key="channel" exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.12 }}>
              <div className="flex items-start gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[calc(16px*var(--o-rs))]" style={{ background: tint(source.color, 0.12), color: source.color }}>
                  <SourceIcon id={source.id} className="h-7 w-7" />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h2 id="origem-sheet-title" className="text-[26px] font-extrabold leading-tight tracking-[-0.02em]">
                    {source.label}
                  </h2>
                  <p className="text-[15px] text-[var(--o-muted)]">{source.hint}</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={Boolean(saving)}
                  className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--o-muted)] transition hover:bg-[var(--o-paper)] hover:text-[var(--o-ink)]"
                  aria-label="Cancelar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="mt-7 text-[18px] font-bold">E como entrou em contacto?</p>
              <p className="text-[14.5px] text-[var(--o-muted)]">Toque no canal para registar.</p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {cfg.channels.map((c, i) => {
                  const Icon = CHANNEL_ICONS[c.id] ?? CHANNEL_ICONS.online;
                  const busy = saving === c.id;
                  return (
                    <button
                      key={c.id}
                      ref={i === 0 ? firstRef : undefined}
                      type="button"
                      onClick={() => onRegister(c.id)}
                      disabled={Boolean(saving)}
                      className="flex h-[84px] touch-manipulation select-none items-center gap-2.5 rounded-[calc(22px*var(--o-rs))] border border-[var(--o-line)] bg-[var(--o-paper)] px-3 text-left outline-none sm:gap-3 transition hover:border-[var(--o-deep)] hover:bg-white focus-visible:ring-2 focus-visible:ring-[var(--o-deep)] focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-60 sm:h-[92px] sm:px-5"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[var(--o-deep)] ring-1 ring-[var(--o-line)] sm:h-11 sm:w-11">
                        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
                      </span>
                      <span className="text-[16px] font-bold leading-tight min-[400px]:text-[17px] sm:text-[18px]">{c.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => onRegister(null)}
                disabled={Boolean(saving)}
                className="mt-3 flex h-14 w-full touch-manipulation items-center justify-center gap-2 rounded-[calc(20px*var(--o-rs))] text-[16px] font-bold text-[var(--o-deep)] ring-1 ring-inset ring-[var(--o-line)] transition hover:bg-[var(--o-paper)] disabled:opacity-60"
              >
                {saving === "none" ? <Loader2 className="h-5 w-5 animate-spin" /> : "Registar sem indicar o canal"}
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="done"
              type="button"
              onClick={onClose}
              className="flex w-full flex-col items-center py-6 text-center sm:py-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
            >
              <BrandMark mark={cfg.theme.mark} play={sheet.n} className="h-28 w-28" />
              <h2 id="origem-sheet-title" className="o-display mt-6 text-[30px] tracking-[-0.02em]">
                Registado
              </h2>
              <p className="mt-1 text-[17px] text-[var(--o-muted)]">{phraseOf(cfg, sheet.source, sheet.channel)}.</p>
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/* ───────────────────────────── O aviso ───────────────────────────── */

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
  const left = toast.kind === "ok" ? Math.max(0, toast.until - now) : 0;
  const frac = left / (UNDO_SECONDS * 1000);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(16px,env(safe-area-inset-bottom))]"
      role="status"
    >
      <div
        className={`relative mx-auto flex max-w-[560px] items-center gap-3 overflow-hidden rounded-[calc(24px*var(--o-rs))] p-3 pl-4 text-white shadow-[0_24px_50px_-20px_rgba(var(--o-ink-rgb),0.55)] ${
          toast.kind === "error" ? "bg-[#7A1F2E]" : "bg-[var(--o-ink)]"
        }`}
      >
        {toast.kind === "ok" ? (
          <>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--o-accent)] text-[var(--o-ink)]">
              <Check className="h-5 w-5" strokeWidth={3} />
            </span>
            <p className="min-w-0 flex-1 truncate text-[15px]">
              <strong className="font-bold">Registado:</strong> <span className="text-white/80">{phraseOf(cfg, toast.source, toast.channel)}</span>
            </p>
            <button
              type="button"
              onClick={onUndo}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[var(--o-pill)] bg-white/10 px-4 text-[15px] font-bold transition hover:bg-white/20"
            >
              <Undo2 className="h-4 w-4" /> Anular
              <span className="w-5 text-right tabular-nums text-white/55">{Math.ceil(left / 1000)}</span>
            </button>
            <span className="absolute bottom-0 left-0 h-[3px] bg-[var(--o-accent)]" style={{ width: `${frac * 100}%` }} />
          </>
        ) : toast.kind === "undone" ? (
          <p className="py-2 pl-1 text-[15px] text-white/85">Registo anulado. Não conta nos números.</p>
        ) : (
          <>
            <p className="flex-1 py-1 text-[15px]">{toast.text}</p>
            <button type="button" onClick={onClose} className="h-10 rounded-[var(--o-pill)] px-4 text-[15px] font-bold text-white/80 hover:bg-white/10">
              Fechar
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
