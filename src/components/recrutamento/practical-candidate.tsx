"use client";

// A prova prática do lado do CANDIDATO (Recrutamento, Fase 2 · Parte 2,
// v80.16) — /candidatura/<token>. Ecrã de boas-vindas → «Começar» (arranca
// o relógio de 240 min) → os 4 pontos do guião com as respostas → «Entregar».
//
// Grava sozinha: 800 ms depois da última mudança, e ao sair da página
// (pagehide / separador escondido) vai o que faltar com keepalive — a lição
// das autosaves do roadmap (v78.26). Depois de entregar fica só de leitura;
// só a WonderAds a pode reabrir.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { upload } from "@vercel/blob/client";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  Star,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import {
  emptyAnswers,
  fmtBytes,
  fmtDuration,
  getPracticalTemplate,
  IMPACTS,
  loomEmbed,
  MAX_CODE_ISSUES,
  MAX_KEYWORDS,
  MAX_LOOMS,
  MAX_PDF_BYTES,
  missingParts,
  type CodeIssue,
  type KeywordRow,
  type PracticalAnswers,
  type PracticalItem,
  type PracticalSubmission,
  type PracticalTextBlock,
} from "@/lib/recrutamento/practical";

const BRAND = "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)";
const field =
  "w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-[15px] text-black placeholder:text-black/30 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition focus:border-[#783DF5]/60 focus:outline-none focus:ring-4 focus:ring-[#783DF5]/10 disabled:bg-black/[0.03] disabled:text-black/60";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

function fmtClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function fmtWhen(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} às ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function PracticalCandidate({
  token,
  practicalId,
  templateId,
  site,
  firstName,
  initial,
  serverNow,
}: {
  token: string;
  practicalId: string;
  templateId: string;
  site: string;
  firstName: string;
  initial: PracticalSubmission;
  serverNow: number;
}) {
  const template = getPracticalTemplate(templateId)!;
  const api = `/api/candidatura/${encodeURIComponent(token)}`;
  const [answers, setAnswers] = useState<PracticalAnswers>(initial.answers ?? emptyAnswers());
  const [startedAt, setStartedAt] = useState<number | null>(initial.startedAt);
  const [submittedAt, setSubmittedAt] = useState<number | null>(initial.submittedAt);
  const [save, setSave] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Relógio do servidor: o tempo conta igual, seja qual for a hora do PC.
  const offset = useRef(serverNow - Date.now());
  const [now, setNow] = useState(() => serverNow);

  const answersRef = useRef(answers);
  const dirty = useRef(false);
  const inflight = useRef(false);
  const timer = useRef<number | null>(null);
  const locked = Boolean(submittedAt);

  // Abrir conta como «link aberto» — no browser, para os pré-visualizadores
  // de links (WhatsApp, Slack) não o marcarem.
  useEffect(() => {
    if (initial.openedAt) return;
    void fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "open" }) }).catch(() => {});
  }, [api, initial.openedAt]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => window.clearInterval(id);
  }, []);

  // ── gravação ────────────────────────────────────────────────────────────
  const flush = useCallback(
    async (keepalive = false): Promise<boolean> => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      if (!dirty.current) return true;
      if (inflight.current && !keepalive) {
        timer.current = window.setTimeout(() => void flush(), 400);
        return false;
      }
      dirty.current = false;
      inflight.current = true;
      setSave("saving");
      try {
        const res = await fetch(api, {
          method: "POST",
          keepalive,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save", answers: answersRef.current }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string; submission?: { submittedAt: number | null } };
        if (res.status === 409) {
          // Já entregue (noutro separador, ou fechada pela WonderAds).
          setSubmittedAt(json.submission?.submittedAt ?? Date.now());
          setError(json.error ?? "A prova já foi entregue.");
          return false;
        }
        if (!res.ok) throw new Error(json.error || String(res.status));
        setSave(dirty.current ? "dirty" : "saved");
        setError(null);
        return true;
      } catch (err) {
        dirty.current = true;
        setSave("error");
        setError(err instanceof Error && err.message.length > 3 ? err.message : "Sem ligação — tentamos outra vez daqui a nada.");
        if (!keepalive) timer.current = window.setTimeout(() => void flush(), 3000);
        return false;
      } finally {
        inflight.current = false;
        if (dirty.current && !timer.current && !keepalive) timer.current = window.setTimeout(() => void flush(), 800);
      }
    },
    [api],
  );

  useEffect(() => {
    const onHide = () => void flush(true);
    const onVis = () => document.visibilityState === "hidden" && void flush(true);
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVis);
      void flush(true);
    };
  }, [flush]);

  const update = useCallback(
    (fn: (a: PracticalAnswers) => PracticalAnswers) => {
      if (locked) return;
      const next = fn(answersRef.current);
      answersRef.current = next;
      setAnswers(next);
      dirty.current = true;
      setSave("dirty");
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), 800);
    },
    [flush, locked],
  );

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start" }) });
      const json = (await res.json().catch(() => ({}))) as { error?: string; submission?: { startedAt: number | null }; serverNow?: number };
      if (!res.ok) throw new Error(json.error || "Não foi possível começar.");
      if (json.serverNow) offset.current = json.serverNow - Date.now();
      setStartedAt(json.submission?.startedAt ?? Date.now() + offset.current);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível começar.");
    } finally {
      setStarting(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      const res = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", answers: answersRef.current }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; submission?: { submittedAt: number | null } };
      if (!res.ok) throw new Error(json.error || "Não foi possível entregar.");
      dirty.current = false;
      setSubmittedAt(json.submission?.submittedAt ?? Date.now());
      setConfirm(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entregar.");
    } finally {
      setSubmitting(false);
    }
  }

  const missing = useMemo(() => missingParts(answers), [answers]);

  // ── ecrãs ───────────────────────────────────────────────────────────────
  if (submittedAt) {
    return (
      <Shell>
        <div className="mx-auto max-w-xl py-20 text-center sm:py-28">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white shadow-[0_20px_50px_-15px_rgba(120,61,245,0.7)]" style={{ background: BRAND }}>
            <Check className="h-8 w-8" strokeWidth={2.5} />
          </div>
          <h1 className="mt-7 text-[30px] font-semibold leading-tight tracking-tight text-black sm:text-[36px]">
            Prova entregue{firstName ? `, ${firstName}` : ""}.
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-black/60">
            Recebemos tudo a {fmtWhen(submittedAt)}
            {startedAt ? ` — ${fmtDuration(submittedAt - startedAt)} desde que começaste` : ""}. Vamos ver com calma e
            damos-te notícias em breve.
          </p>
          <p className="mt-8 text-[13px] text-black/40">Já não dá para mudar a entrega. Obrigado pelo teu tempo!</p>
        </div>
      </Shell>
    );
  }

  if (!startedAt) {
    return (
      <Shell>
        <section className="mx-auto max-w-2xl py-14 sm:py-20">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#783DF5]">Recrutamento · {template.phase}</p>
          <h1 className="mt-3 text-[32px] font-semibold leading-[1.1] tracking-tight text-black sm:text-[44px]">
            {firstName ? `Olá, ${firstName}.` : "Olá."}
            <br />
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: BRAND }}>
              {template.title}
            </span>
          </h1>
          <p className="mt-4 text-[14px] italic text-black/50">{template.subtitle}</p>
          <div className="mt-8 space-y-3 text-[16px] leading-relaxed text-black/75">
            {template.intro.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <SiteCard site={site} />
          <ul className="mt-8 grid gap-2 text-[14px] text-black/65 sm:grid-cols-2">
            {template.sections.map((s) => (
              <li key={s.n} className="flex items-start gap-2.5 rounded-2xl border border-black/[0.07] bg-white px-4 py-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black text-[11px] font-bold text-white">{s.n}</span>
                <span>{s.title}</span>
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => void start()}
              disabled={starting}
              className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_18px_40px_-14px_rgba(120,61,245,0.75)] transition hover:brightness-110 disabled:opacity-60"
              style={{ background: BRAND }}
            >
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
              Começar — o relógio de {template.durationMin} min arranca
            </button>
            <span className="text-[13px] text-black/45">Tudo o que escreves fica guardado sozinho.</span>
          </div>
          {error && <p className="mt-4 text-[14px] text-rose-600">{error}</p>}
        </section>
      </Shell>
    );
  }

  const left = startedAt + template.durationMin * 60_000 - now;
  const over = left < 0;

  return (
    <Shell
      bar={
        <div className="flex items-center gap-2 sm:gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold tabular-nums ${
              over ? "bg-amber-100 text-amber-800" : left < 15 * 60_000 ? "bg-rose-50 text-rose-700" : "bg-black/[0.05] text-black/75"
            }`}
            title={over ? `Passaste os ${template.durationMin} min previstos — podes acabar e entregar na mesma.` : `Tempo que falta dos ${template.durationMin} min`}
          >
            <Clock className="h-3.5 w-3.5" />
            {over ? `+${fmtClock(-left)}` : fmtClock(left)}
          </span>
          <SaveBadge state={save} />
          <button
            type="button"
            onClick={() => {
              void flush();
              setConfirm(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold text-white transition hover:brightness-110"
            style={{ background: BRAND }}
          >
            Entregar
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      }
    >
      <header className="pb-2 pt-10 sm:pt-14">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#783DF5]">Recrutamento · {template.phase}</p>
        <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-black sm:text-[38px]">{template.title}</h1>
        <p className="mt-2 text-[14px] italic text-black/50">{template.subtitle}</p>
        <div className="mt-5 max-w-3xl space-y-2 text-[15px] leading-relaxed text-black/70">
          {template.intro.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        {error && (
          <p className="mt-5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[14px] text-rose-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
      </header>

      {template.sections.map((section) => (
        <section key={section.n} id={`ponto-${section.n}`} className="mt-10 scroll-mt-24">
          <h2 className="flex items-baseline gap-3 text-[22px] font-semibold tracking-tight text-[#2E5C9A] sm:text-[24px]">
            <span>{section.n}.</span>
            <span>{section.title}</span>
          </h2>
          {section.n === 1 && <SiteCard site={site} compact />}
          {section.lead && (
            <div className="mt-3">
              <Blocks blocks={section.lead} />
            </div>
          )}
          <div className="mt-4 space-y-5">
            {section.items.map((item) => (
              <ItemCard key={item.id} item={item}>
                <ItemAnswer
                  item={item}
                  answers={answers}
                  update={update}
                  token={token}
                  practicalId={practicalId}
                  onError={setError}
                />
              </ItemCard>
            ))}
          </div>
        </section>
      ))}

      <section className="mb-24 mt-12 rounded-3xl border border-black/[0.08] bg-white p-6 sm:p-8">
        <h2 className="text-[20px] font-semibold text-black">Pronto para entregar?</h2>
        <p className="mt-2 text-[15px] text-black/60">Depois de entregares já não consegues mudar nada.</p>
        {missing.length > 0 && <MissingList items={missing} />}
        <button
          type="button"
          onClick={() => {
            void flush();
            setConfirm(true);
          }}
          className="mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold text-white shadow-[0_18px_40px_-14px_rgba(120,61,245,0.75)] transition hover:brightness-110"
          style={{ background: BRAND }}
        >
          Entregar a prova
          <ArrowRight className="h-4 w-4" />
        </button>
      </section>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6" role="dialog" aria-modal="true">
          <button type="button" aria-label="Fechar" onClick={() => !submitting && setConfirm(false)} className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-7">
            <button
              type="button"
              onClick={() => !submitting && setConfirm(false)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-black/40 hover:bg-black/5 hover:text-black"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-[19px] font-semibold text-black">Entregar a prova?</h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-black/60">Depois de entregares já não consegues mudar nada.</p>
            {missing.length > 0 && <MissingList items={missing} />}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirm(false)}
                disabled={submitting}
                className="rounded-full px-4 py-2.5 text-[14px] font-semibold text-black/55 hover:text-black"
              >
                Continuar a trabalhar
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-60"
                style={{ background: BRAND }}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Entregar
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

// ── peças ─────────────────────────────────────────────────────────────────

function Shell({ children, bar }: { children: ReactNode; bar?: ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-40 border-b border-black/[0.06] bg-[#f4f4ed]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/wonder-ads-butterfly.png" alt="" className="h-7 w-7" />
            <span className="text-[15px] font-semibold tracking-tight text-black">WonderAds</span>
          </div>
          {bar}
        </div>
      </div>
      <main className="mx-auto max-w-5xl px-4 sm:px-6">{children}</main>
    </div>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const map: Record<Exclude<SaveState, "idle">, { label: string; cls: string; icon: ReactNode }> = {
    dirty: { label: "Por guardar", cls: "text-black/45", icon: <span className="h-1.5 w-1.5 rounded-full bg-black/30" /> },
    saving: { label: "A guardar…", cls: "text-black/45", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
    saved: { label: "Guardado", cls: "text-emerald-700", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    error: { label: "Sem ligação", cls: "text-rose-600", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  };
  const m = map[state];
  return (
    <span className={`hidden items-center gap-1.5 text-[12.5px] font-medium sm:inline-flex ${m.cls}`}>
      {m.icon}
      {m.label}
    </span>
  );
}

function SiteCard({ site, compact = false }: { site: string; compact?: boolean }) {
  let host = site;
  try {
    host = new URL(site).host.replace(/^www\./, "");
  } catch {
    /* fica o texto */
  }
  return (
    <a
      href={site}
      target="_blank"
      rel="noopener noreferrer"
      className={`group mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[#783DF5]/20 bg-white px-4 ${compact ? "py-3" : "py-4"} transition hover:border-[#783DF5]/45`}
    >
      <span className="min-w-0">
        <span className="block text-[12px] font-bold italic text-black/50">Site:</span>
        <span className="block truncate text-[17px] font-semibold text-black">{host}</span>
      </span>
      <ExternalLink className="h-4 w-4 shrink-0 text-[#783DF5] transition group-hover:translate-x-0.5" />
    </a>
  );
}

function Blocks({ blocks }: { blocks: PracticalTextBlock[] }) {
  return (
    <div className="space-y-2.5 text-[15.5px] leading-relaxed text-black/80">
      {blocks.map((b, i) => {
        if (b.kind === "p") return <p key={i}>{b.text}</p>;
        if (b.kind === "note") return <p key={i} className="text-[14.5px] text-black/55">{b.text}</p>;
        if (b.kind === "bullets")
          return (
            <ul key={i} className="list-disc space-y-1 pl-6">
              {b.items.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          );
        return (
          <div key={i}>
            <p className="text-[15.5px] text-black/80">{b.lead}</p>
            <pre className="mt-3 overflow-x-auto rounded-xl border border-black/10 bg-[#f3f3f3] p-4 text-[12.5px] leading-[1.55] text-black/85">
              <code>{b.code}</code>
            </pre>
          </div>
        );
      })}
    </div>
  );
}

function ItemCard({ item, children }: { item: PracticalItem; children: ReactNode }) {
  const codeBlock = item.body.find((b) => b.kind === "code");
  return (
    <article className="rounded-3xl border border-black/[0.07] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:p-7">
      {item.label && (
        <h3 className="text-[17px] font-semibold text-[#2E5C9A]">
          {item.label}
          {codeBlock && codeBlock.kind === "code" ? `  ${codeBlock.title}` : ""}
        </h3>
      )}
      <div className={item.label ? "mt-2" : ""}>
        <Blocks blocks={item.body} />
      </div>
      <div className="mt-6 border-t border-dashed border-black/10 pt-5">{children}</div>
    </article>
  );
}

function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-black/55">{children}</span>
      {hint && <span className="text-[12.5px] text-black/40">{hint}</span>}
    </div>
  );
}

/** Textarea que cresce com o texto. */
function Area({
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, rows * 26)}px`;
  }, [value, rows]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className={`${field} resize-none leading-relaxed`}
    />
  );
}

type UpdateFn = (fn: (a: PracticalAnswers) => PracticalAnswers) => void;

function ItemAnswer({
  item,
  answers: a,
  update,
  token,
  practicalId,
  onError,
}: {
  item: PracticalItem;
  answers: PracticalAnswers;
  update: UpdateFn;
  token: string;
  practicalId: string;
  onError: (e: string | null) => void;
}) {
  switch (item.id) {
    case "audit":
      return (
        <div className="space-y-5">
          <div>
            <Label hint="1 a 3 vídeos">Os teus vídeos (Loom)</Label>
            <div className="space-y-2">
              {a.looms.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Video className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />
                    <input
                      value={l}
                      onChange={(e) => update((x) => ({ ...x, looms: x.looms.map((v, j) => (j === i ? e.target.value : v)) }))}
                      placeholder="https://www.loom.com/share/…"
                      className={`${field} pl-10`}
                      inputMode="url"
                    />
                    {loomEmbed(l) && <CheckCircle2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />}
                  </div>
                  {a.looms.length > 1 && (
                    <button
                      type="button"
                      onClick={() => update((x) => ({ ...x, looms: x.looms.filter((_, j) => j !== i) }))}
                      className="rounded-full p-2 text-black/35 hover:bg-black/5 hover:text-rose-600"
                      aria-label="Remover vídeo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {a.looms.length < MAX_LOOMS && (
              <AddButton onClick={() => update((x) => ({ ...x, looms: [...x.looms, ""] }))}>Mais um vídeo</AddButton>
            )}
          </div>
          <div>
            <Label hint="opcional">Notas</Label>
            <Area value={a.auditNotes} onChange={(v) => update((x) => ({ ...x, auditNotes: v }))} rows={3} />
          </div>
        </div>
      );
    case "priorities":
      return (
        <div className="space-y-5">
          <div>
            <Label hint={`PDF · até ${fmtBytes(MAX_PDF_BYTES)}`}>O teu documento</Label>
            <PdfUpload
              file={a.prioritiesFile}
              token={token}
              practicalId={practicalId}
              onError={onError}
              onChange={(f) => update((x) => ({ ...x, prioritiesFile: f }))}
            />
          </div>
          <div>
            <Label hint="opcional">Nota</Label>
            <Area value={a.prioritiesNote} onChange={(v) => update((x) => ({ ...x, prioritiesNote: v }))} rows={2} />
          </div>
        </div>
      );
    case "fix":
      return (
        <div>
          <Label>A tua resposta</Label>
          <Area value={a.fix} onChange={(v) => update((x) => ({ ...x, fix: v }))} rows={8} />
        </div>
      );
    case "keywords":
      return <KeywordsAnswer a={a} update={update} />;
    case "roadmap":
      return (
        <div className="grid gap-4 lg:grid-cols-3">
          {a.roadmap.map((m, i) => (
            <div key={i} className="rounded-2xl border border-black/[0.08] bg-[#fafaf7] p-4">
              <p className="text-[15px] font-semibold text-black">Mês {i + 1}</p>
              <div className="mt-3">
                <Label>Focos</Label>
                <Area
                  value={m.focus}
                  onChange={(v) => update((x) => ({ ...x, roadmap: x.roadmap.map((r, j) => (j === i ? { ...r, focus: v } : r)) }))}
                  rows={4}
                />
              </div>
              <div className="mt-3">
                <Label>Entregáveis</Label>
                <Area
                  value={m.deliverables}
                  onChange={(v) => update((x) => ({ ...x, roadmap: x.roadmap.map((r, j) => (j === i ? { ...r, deliverables: v } : r)) }))}
                  rows={4}
                />
              </div>
            </div>
          ))}
        </div>
      );
    case "code":
      return <CodeAnswer a={a} update={update} />;
    default:
      return null;
  }
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-dashed border-black/20 px-3.5 py-2 text-[13.5px] font-semibold text-black/60 transition hover:border-[#783DF5]/50 hover:text-[#783DF5]"
    >
      <Plus className="h-4 w-4" />
      {children}
    </button>
  );
}

function PdfUpload({
  file,
  token,
  practicalId,
  onChange,
  onError,
}: {
  file: PracticalAnswers["prioritiesFile"];
  token: string;
  practicalId: string;
  onChange: (f: PracticalAnswers["prioritiesFile"]) => void;
  onError: (e: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const input = useRef<HTMLInputElement | null>(null);

  async function pick(f: File | undefined) {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      onError("O documento tem de ir em PDF.");
      return;
    }
    if (f.size > MAX_PDF_BYTES) {
      onError(`O PDF passa dos ${fmtBytes(MAX_PDF_BYTES)}.`);
      return;
    }
    setBusy(true);
    setProgress(0);
    onError(null);
    try {
      const safe = f.name.replace(/[^\w.\- ]+/g, "_").slice(-120) || "prioridades.pdf";
      const blob = await upload(`recrutamento/${practicalId}/${safe}`, f, {
        access: "public",
        contentType: "application/pdf",
        handleUploadUrl: `/api/candidatura/${encodeURIComponent(token)}/upload`,
        onUploadProgress: (e) => setProgress(Math.round(e.percentage)),
      });
      onChange({ url: blob.url, name: f.name.slice(0, 200), size: f.size, uploadedAt: Date.now() });
    } catch (err) {
      onError(err instanceof Error ? err.message : "O upload falhou. Tenta outra vez.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
          <a href={file.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-3">
            <FileText className="h-5 w-5 shrink-0 text-emerald-700" />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold text-black">{file.name}</span>
              <span className="block text-[12.5px] text-black/45">{fmtBytes(file.size)} · carregado</span>
            </span>
          </a>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
              className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-black/60 hover:bg-black/5 hover:text-black"
            >
              {busy ? `${progress}%` : "Trocar"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onChange(null)}
              className="rounded-full p-1.5 text-black/35 hover:bg-black/5 hover:text-rose-600"
              aria-label="Remover PDF"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void pick(e.dataTransfer.files?.[0]);
          }}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-black/15 bg-[#fafaf7] px-4 py-8 text-center transition hover:border-[#783DF5]/50 disabled:opacity-70"
        >
          {busy ? <Loader2 className="h-6 w-6 animate-spin text-[#783DF5]" /> : <Upload className="h-6 w-6 text-[#783DF5]" />}
          <span className="text-[15px] font-semibold text-black">{busy ? `A carregar… ${progress}%` : "Carregar o PDF"}</span>
          {!busy && <span className="text-[13px] text-black/45">Clica ou arrasta o ficheiro para aqui</span>}
        </button>
      )}
    </div>
  );
}

const EMPTY_KW: KeywordRow = { kw: "", volume: "", position: "", premium: false };

function KeywordsAnswer({ a, update }: { a: PracticalAnswers; update: UpdateFn }) {
  const rows = a.keywords.length ? a.keywords : [EMPTY_KW];
  const filled = a.keywords.filter((k) => k.kw.trim()).length;
  const premium = a.keywords.filter((k) => k.kw.trim() && k.premium).length;

  const setRow = (i: number, patch: Partial<KeywordRow>) =>
    update((x) => {
      const list = x.keywords.length ? [...x.keywords] : [{ ...EMPTY_KW }];
      list[i] = { ...list[i], ...patch };
      return { ...x, keywords: list };
    });

  // Colar várias linhas de uma folha de cálculo (keyword ⇥ volume ⇥ posição).
  const onPaste = (i: number, text: string): boolean => {
    if (!/[\n\t]/.test(text)) return false;
    const parsed = text
      .split(/\r?\n/)
      .map((line) => line.split("\t").map((c) => c.trim()))
      .filter((cols) => cols[0])
      .map((cols) => ({ kw: cols[0].slice(0, 160), volume: (cols[1] ?? "").slice(0, 20), position: (cols[2] ?? "").slice(0, 20), premium: false }));
    if (!parsed.length) return false;
    update((x) => {
      const list = x.keywords.length ? [...x.keywords] : [{ ...EMPTY_KW }];
      list.splice(i, list[i]?.kw.trim() ? 0 : 1, ...parsed);
      return { ...x, keywords: list.slice(0, MAX_KEYWORDS) };
    });
    return true;
  };

  return (
    <div className="space-y-5">
      <div>
        <Label hint={`${filled}/${MAX_KEYWORDS} keywords · ${premium} premium`}>As tuas keywords</Label>
        <div className="overflow-hidden rounded-2xl border border-black/[0.08]">
          <div className="hidden gap-2 border-b border-black/[0.06] bg-[#fafaf7] px-3 py-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-black/45 sm:grid sm:grid-cols-[minmax(0,1fr)_110px_90px_92px_40px]">
            <span>Keyword</span>
            <span>Volume</span>
            <span>Posição</span>
            <span className="text-center">Premium</span>
            <span />
          </div>
          <div className="divide-y divide-black/[0.05]">
            {rows.map((k, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_110px_90px_92px_40px] sm:py-2">
                <input
                  value={k.kw}
                  onChange={(e) => setRow(i, { kw: e.target.value })}
                  onPaste={(e) => {
                    if (onPaste(i, e.clipboardData.getData("text"))) e.preventDefault();
                  }}
                  placeholder={i === 0 ? "keyword (podes colar várias linhas)" : "keyword"}
                  className={`${field} col-span-4 py-2 text-[14px] sm:col-span-1`}
                />
                <input value={k.volume} onChange={(e) => setRow(i, { volume: e.target.value })} inputMode="numeric" placeholder="Volume" className={`${field} px-2.5 py-2 text-[14px]`} />
                <input value={k.position} onChange={(e) => setRow(i, { position: e.target.value })} inputMode="numeric" placeholder="Posição" className={`${field} px-2.5 py-2 text-[14px]`} />
                <button
                  type="button"
                  onClick={() => setRow(i, { premium: !k.premium })}
                  aria-pressed={k.premium}
                  title={k.premium ? "Premium" : "Marcar como premium"}
                  className={`mx-auto inline-flex h-9 w-9 items-center justify-center rounded-full border transition sm:w-auto sm:gap-1.5 sm:px-3 ${
                    k.premium ? "border-amber-300 bg-amber-100 text-amber-800" : "border-black/10 text-black/30 hover:text-amber-600"
                  }`}
                >
                  <Star className="h-4 w-4" fill={k.premium ? "currentColor" : "none"} />
                  <span className="hidden text-[12.5px] font-semibold sm:inline">{k.premium ? "Sim" : "Não"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => update((x) => ({ ...x, keywords: x.keywords.filter((_, j) => j !== i) }))}
                  className="rounded-full p-1.5 text-black/30 hover:bg-black/5 hover:text-rose-600"
                  aria-label="Remover keyword"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
        {a.keywords.length < MAX_KEYWORDS && (
          <AddButton onClick={() => update((x) => ({ ...x, keywords: [...(x.keywords.length ? x.keywords : [{ ...EMPTY_KW }]), { ...EMPTY_KW }] }))}>
            Mais uma keyword
          </AddButton>
        )}
      </div>
      <div>
        <Label>O critério que usaste para escolher as premium</Label>
        <Area value={a.premiumCriteria} onChange={(v) => update((x) => ({ ...x, premiumCriteria: v }))} rows={4} />
      </div>
    </div>
  );
}

const EMPTY_ISSUE: CodeIssue = { text: "", impact: "" };

function CodeAnswer({ a, update }: { a: PracticalAnswers; update: UpdateFn }) {
  const rows = a.codeIssues.length ? a.codeIssues : [EMPTY_ISSUE];
  const setRow = (i: number, patch: Partial<CodeIssue>) =>
    update((x) => {
      const list = x.codeIssues.length ? [...x.codeIssues] : [{ ...EMPTY_ISSUE }];
      list[i] = { ...list[i], ...patch };
      return { ...x, codeIssues: list };
    });
  return (
    <div className="space-y-5">
      <div>
        <Label hint="um problema por linha">Os problemas que encontraste</Label>
        <div className="space-y-2">
          {rows.map((c, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-2xl border border-black/[0.07] bg-[#fafaf7] p-2.5 sm:flex-row sm:items-center">
              <span className="hidden w-6 shrink-0 text-center text-[13px] font-semibold text-black/35 sm:block">{i + 1}</span>
              <input value={c.text} onChange={(e) => setRow(i, { text: e.target.value })} placeholder="O problema" className={`${field} py-2 text-[14.5px]`} />
              <div className="flex shrink-0 items-center gap-1">
                {IMPACTS.map((imp) => {
                  const on = c.impact === imp.id;
                  const tone =
                    imp.id === "critico"
                      ? on
                        ? "border-rose-300 bg-rose-100 text-rose-800"
                        : "hover:text-rose-700"
                      : imp.id === "medio"
                        ? on
                          ? "border-amber-300 bg-amber-100 text-amber-800"
                          : "hover:text-amber-700"
                        : on
                          ? "border-sky-300 bg-sky-100 text-sky-800"
                          : "hover:text-sky-700";
                  return (
                    <button
                      key={imp.id}
                      type="button"
                      onClick={() => setRow(i, { impact: on ? "" : imp.id })}
                      aria-pressed={on}
                      className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${on ? tone : `border-black/10 text-black/45 ${tone}`}`}
                    >
                      {imp.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => update((x) => ({ ...x, codeIssues: x.codeIssues.filter((_, j) => j !== i) }))}
                  className="ml-1 rounded-full p-1.5 text-black/30 hover:bg-black/5 hover:text-rose-600"
                  aria-label="Remover problema"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        {a.codeIssues.length < MAX_CODE_ISSUES && (
          <AddButton
            onClick={() => update((x) => ({ ...x, codeIssues: [...(x.codeIssues.length ? x.codeIssues : [{ ...EMPTY_ISSUE }]), { ...EMPTY_ISSUE }] }))}
          >
            Mais um problema
          </AddButton>
        )}
      </div>
      <div>
        <Label>Como corrigirias os críticos</Label>
        <Area value={a.codeFix} onChange={(v) => update((x) => ({ ...x, codeFix: v }))} rows={6} />
      </div>
    </div>
  );
}

function MissingList({ items }: { items: string[] }) {
  return (
    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="flex items-center gap-2 text-[13.5px] font-semibold text-amber-900">
        <AlertTriangle className="h-4 w-4" />
        Ainda falta:
      </p>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-9 text-[13.5px] text-amber-900/85">
        {items.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}
