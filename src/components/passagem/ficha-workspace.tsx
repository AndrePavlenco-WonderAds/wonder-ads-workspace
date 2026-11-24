"use client";

// A ficha de um projeto na passagem (v80.39; capítulos e documento v80.40).
//
//   • A ESCREVER (quem sai e a direção): um capítulo de cada vez — acessos,
//     semáforo, as 7 secções, cliente e reunião, perguntas — com «Anterior /
//     Seguinte», a coluna do progresso sempre à vista e o «Marcar ficha como
//     pronta» lá. Grava sozinha 1 s depois de parar de escrever e ao sair.
//     «Ver como documento» mostra o que quem entra vai ler.
//   • A LER (quem entra): a ficha como um documento — resumo no topo
//     (semáforo, acessos, reunião), as secções seguidas, as perguntas — e a
//     barra de baixo com «Perguntar» e «Li e assumo».
//
// O progresso é calculado do que está no ecrã, ao vivo.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  LockKeyhole,
  MessageCircleQuestion,
  PenLine,
  Plus,
  Send,
  Undo2,
} from "lucide-react";
import { HealthDot, ProgressRing } from "./ui";
import { formatDateTime } from "@/lib/dates";
import {
  ACCESS_ITEMS,
  ACCESS_NOTES_MAX,
  ACCESS_STATES,
  ANSWER_MAX,
  FICHA_SECTIONS,
  HEALTH,
  HEALTH_WHY_MAX,
  QUESTION_MAX,
  SECTION_MAX,
  clientMessageDraft,
  fichaProgress,
  fichaSteps,
  formatISODate,
  healthOf,
  sectionFilled,
  type AccessState,
  type Ficha,
  type Person,
  type Question,
  type SectionId,
  type Sign,
} from "@/lib/passagem/shared";

type Role = "admin" | "outgoing" | "incoming";

type Props = {
  passagemId: string;
  slug: string;
  clientTitle: string;
  role: Role;
  meUsername: string;
  closed: boolean;
  outgoing: Person;
  incoming: Person | null;
  endDate: string;
  initialFicha: Ficha;
  sign: Sign | null;
  questions: Question[];
  vaultCount: number;
  lang: "pt" | "en";
};

type SaveState = { kind: "idle" } | { kind: "dirty" } | { kind: "saving" } | { kind: "saved"; at: number } | { kind: "error"; message: string };

type ChapterId = "acessos" | "semaforo" | `s-${SectionId}` | "cliente" | "perguntas";
type Chapter = { id: ChapterId; group: string; title: string; done: boolean };

const input =
  "w-full rounded-xl border border-white/12 bg-black/30 px-3.5 py-2.5 text-[14.5px] leading-relaxed text-white outline-none transition placeholder:text-white/25 focus:border-[#783DF5]/70 focus:ring-2 focus:ring-[#783DF5]/30 disabled:opacity-60";

const gradient = { background: "linear-gradient(90deg,#783DF5,#E040A0)" };

/* ------------------------------------------------------------------ */
/*  Peças                                                              */
/* ------------------------------------------------------------------ */

function AutoTextarea({
  value,
  onChange,
  max,
  minRows = 5,
  placeholder,
  textareaRef,
}: {
  value: string;
  onChange: (v: string) => void;
  max: number;
  minRows?: number;
  placeholder?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const own = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef ?? own;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value, ref]);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={minRows}
      maxLength={max}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${input} resize-none overflow-hidden`}
    />
  );
}

function ReadText({ text, empty = "Ainda por escrever." }: { text: string | undefined; empty?: string }) {
  const t = (text ?? "").trim();
  return t ? (
    <p className="whitespace-pre-wrap text-[15px] leading-[1.7] text-white/80">{t}</p>
  ) : (
    <p className="text-[13.5px] italic text-white/35">{empty}</p>
  );
}

function AccessPill({ state }: { state: AccessState | undefined }) {
  const cls =
    state === "ok"
      ? "bg-emerald-400/15 text-emerald-200"
      : state === "falta"
        ? "bg-rose-400/15 text-rose-200"
        : state === "na"
          ? "bg-white/10 text-white/55"
          : "border border-dashed border-white/20 text-white/40";
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] ${cls}`}>
      {ACCESS_STATES.find((s) => s.id === state)?.label ?? "Por verificar"}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Ficha                                                              */
/* ------------------------------------------------------------------ */

export function FichaWorkspace(props: Props) {
  const { passagemId, slug, role, closed, outgoing, incoming, sign, questions, vaultCount, lang } = props;
  const router = useRouter();
  const canEdit = role !== "incoming" && !closed;
  const canAsk = role !== "outgoing" && !closed;
  const canAnswer = role !== "incoming" && !closed;
  const canSign = role === "incoming" && incoming?.username === props.meUsername && !closed;

  const [ficha, setFicha] = useState<Ficha>(props.initialFicha);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [view, setView] = useState<"editar" | "documento">(canEdit ? "editar" : "documento");
  const [chapter, setChapter] = useState<ChapterId>("acessos");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const latest = useRef(ficha);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  latest.current = ficha;

  /* ----------------------------- gravar ----------------------------- */

  const flush = useCallback(
    async (opts: { keepalive?: boolean } = {}): Promise<boolean> => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      if (inFlight.current) await inFlight.current;
      if (!dirty.current) return true;
      dirty.current = false;
      const body = JSON.stringify({ ficha: latest.current });
      const run = (async () => {
        setSave({ kind: "saving" });
        try {
          const res = await fetch(`/api/passagem/${passagemId}/${slug}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body,
            keepalive: opts.keepalive && body.length < 60_000,
          });
          const data = (await res.json().catch(() => ({}))) as { ficha?: Ficha; error?: string };
          if (!res.ok || !data.ficha) {
            dirty.current = true;
            setSave({ kind: "error", message: data.error ?? "Não foi possível gravar." });
            return false;
          }
          const saved = data.ficha;
          setFicha((f) => ({ ...f, readyAt: saved.readyAt, updatedAt: saved.updatedAt }));
          setSave(dirty.current ? { kind: "dirty" } : { kind: "saved", at: saved.updatedAt });
          return true;
        } catch {
          dirty.current = true;
          setSave({ kind: "error", message: "Sem ligação — ainda não gravado." });
          return false;
        }
      })();
      inFlight.current = run;
      const ok = await run;
      inFlight.current = null;
      return ok;
    },
    [passagemId, slug],
  );

  const update = useCallback(
    (fn: (f: Ficha) => Ficha) => {
      if (!canEdit) return;
      setFicha((f) => fn(f));
      dirty.current = true;
      setSave({ kind: "dirty" });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 1000);
    },
    [canEdit, flush],
  );

  useEffect(() => {
    if (!canEdit) return;
    const onHide = () => {
      if (document.visibilityState === "hidden" && dirty.current) void flush({ keepalive: true });
    };
    const onPageHide = () => {
      if (dirty.current) void flush({ keepalive: true });
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      if (dirty.current) void flush({ keepalive: true });
    };
  }, [canEdit, flush]);

  async function action(key: string, body: Record<string, unknown>, after?: (data: { ficha?: Ficha }) => void) {
    setBusy(key);
    setActionError(null);
    try {
      if (canEdit) await flush();
      const res = await fetch(`/api/passagem/${passagemId}/${slug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { ficha?: Ficha; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Não foi possível gravar.");
      after?.(data);
      router.refresh();
      return true;
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Não foi possível gravar.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  const markReady = () => action("ready", { action: "ready" }, (d) => d.ficha && setFicha((f) => ({ ...f, readyAt: d.ficha!.readyAt })));
  const unready = () => action("unready", { action: "unready" }, (d) => d.ficha && setFicha((f) => ({ ...f, readyAt: d.ficha!.readyAt })));

  /* ---------------------------- capítulos --------------------------- */

  const steps = fichaSteps(ficha, sign);
  const progress = fichaProgress(ficha, sign);
  const open = questions.filter((q) => !q.a).length;
  const chapters: Chapter[] = [
      { id: "acessos", group: "Inventário", title: "Acessos e contas", done: steps[0].done },
      { id: "semaforo", group: "Inventário", title: "Semáforo", done: steps[1].done },
      ...FICHA_SECTIONS.map((s) => ({
        id: `s-${s.id}` as ChapterId,
        group: "Ficha",
        title: s.title,
        done: sectionFilled(ficha.sections[s.id]),
      })),
      { id: "cliente", group: "Apresentação", title: "Cliente e reunião", done: ficha.clientInformed && ficha.meetingDone },
    { id: "perguntas", group: "Apresentação", title: open > 0 ? `Perguntas (${open})` : "Perguntas", done: open === 0 },
  ];
  const idx = Math.max(0, chapters.findIndex((c) => c.id === chapter));
  const current = chapters[idx];

  // O hash abre o capítulo certo (links do sino e da página da passagem).
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1);
      if (chapters.some((c) => c.id === h)) setChapter(h as ChapterId);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function go(id: ChapterId) {
    setChapter(id);
    window.history.replaceState(null, "", `#${id}`);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const saveLabel =
    save.kind === "saving"
      ? "A gravar…"
      : save.kind === "dirty"
        ? "Por gravar…"
        : save.kind === "error"
          ? save.message
          : save.kind === "saved"
            ? `Gravado às ${formatDateTime(save.at).slice(-5)}`
            : canEdit
              ? "Grava sozinha"
              : closed
                ? "Passagem fechada"
                : "Só leitura";

  const firstOut = outgoing.name.split(" ")[0];
  const missingBeforeReady = steps.slice(0, 5).filter((s) => !s.done);

  /* ----------------------------- vistas ----------------------------- */

  if (view === "documento") {
    return (
      <DocumentView
        ficha={ficha}
        questions={questions}
        sign={sign}
        incoming={incoming}
        firstOut={firstOut}
        canAsk={canAsk}
        canAnswer={canAnswer}
        canSign={canSign}
        canEdit={canEdit}
        busy={busy}
        actionError={actionError}
        progressPct={progress.pct}
        onEdit={() => setView("editar")}
        onAsk={(q) => action("ask", { action: "ask", q })}
        onAnswer={(qid, a) => action(`answer:${qid}`, { action: "answer", qid, a })}
        onSign={() => action("sign", { action: "sign" })}
        onUnsign={() => action("unsign", { action: "unsign" })}
      />
    );
  }

  return (
    <div ref={topRef} className="grid scroll-mt-24 grid-cols-1 gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
      {/* ── A coluna: progresso, capítulos e o «pronta» ─────────────── */}
      <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center gap-3">
            <ProgressRing pct={progress.pct} size={50} />
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-white">
                {progress.done} de {progress.total} passos
              </p>
              <p className={`truncate text-[12px] ${save.kind === "error" ? "text-rose-300" : "text-white/45"}`}>
                {save.kind === "saving" && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}
                {saveLabel}
              </p>
            </div>
          </div>

          {/* Capítulos: no telemóvel, uma fila que desliza. */}
          <nav className="-mx-1 mt-4 flex gap-1.5 overflow-x-auto pb-1 lg:mx-0 lg:block lg:space-y-3 lg:overflow-visible lg:pb-0" aria-label="Capítulos da ficha">
            {["Inventário", "Ficha", "Apresentação"].map((group) => (
              <div key={group} className="contents lg:block">
                <p className="hidden px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/30 lg:block">{group}</p>
                {chapters
                  .filter((c) => c.group === group)
                  .map((c) => {
                    const on = c.id === current.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => go(c.id)}
                        aria-current={on ? "step" : undefined}
                        className={`flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] transition lg:w-full ${
                          on ? "bg-[#783DF5]/20 text-white" : "text-white/60 hover:bg-white/[0.04] hover:text-white"
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                            c.done ? "bg-emerald-500 text-white" : on ? "border-2 border-[#c4a6ff]" : "border border-white/25"
                          }`}
                        >
                          {c.done && <Check className="h-2.5 w-2.5" />}
                        </span>
                        <span className="whitespace-nowrap lg:truncate lg:whitespace-normal">{c.title}</span>
                      </button>
                    );
                  })}
              </div>
            ))}
          </nav>

          <div className="mt-4 hidden border-t border-white/[0.06] pt-4 lg:block">
            <ReadyBox
              ficha={ficha}
              sign={sign}
              incoming={incoming}
              canEdit={canEdit}
              busy={busy}
              missing={missingBeforeReady.map((s) => s.todo)}
              onReady={markReady}
              onUnready={unready}
            />
          </div>
          <button
            type="button"
            onClick={() => setView("documento")}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[12px] text-white/55 transition hover:border-white/25 hover:text-white"
          >
            <BookOpenText className="h-3.5 w-3.5" /> Ver como documento
          </button>
        </div>
      </aside>

      {/* ── O capítulo ───────────────────────────────────────────────── */}
      <div className="min-w-0 space-y-4">
        {actionError && <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2.5 text-[13.5px] text-rose-200">{actionError}</p>}
        {save.kind === "error" && (
          <p className="flex items-center justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2.5 text-[13.5px] text-rose-200">
            {save.message}
            <button type="button" onClick={() => void flush()} className="rounded-lg border border-rose-300/40 px-2.5 py-1 text-[12.5px]">
              Tentar outra vez
            </button>
          </p>
        )}

        <section key={current.id} className="animate-fade-up rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c4a6ff]">
            {current.group} · {idx + 1} de {chapters.length}
          </p>
          <ChapterBody
            id={current.id}
            ficha={ficha}
            update={update}
            canEdit={canEdit}
            vaultCount={vaultCount}
            slug={slug}
            lang={lang}
            incoming={incoming}
            endDate={props.endDate}
            questions={questions}
            canAsk={canAsk}
            canAnswer={canAnswer}
            busy={busy}
            firstOut={firstOut}
            onAsk={(q) => action("ask", { action: "ask", q })}
            onAnswer={(qid, a) => action(`answer:${qid}`, { action: "answer", qid, a })}
          />
          <div className="mt-7 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-5">
            <button
              type="button"
              disabled={idx === 0}
              onClick={() => go(chapters[idx - 1].id)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 px-4 py-2 text-[13px] text-white/70 transition hover:border-white/30 hover:text-white disabled:invisible"
            >
              <ArrowLeft className="h-4 w-4" /> Anterior
            </button>
            {idx < chapters.length - 1 ? (
              <button
                type="button"
                onClick={() => go(chapters[idx + 1].id)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-[13px] font-semibold text-[#07080d] transition hover:bg-white/90"
              >
                {chapters[idx + 1].title.replace(/ \(\d+\)$/, "")} <ArrowRight className="h-4 w-4" />
              </button>
            ) : canEdit && !ficha.readyAt ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={markReady}
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
                style={gradient}
              >
                {busy === "ready" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Marcar ficha como pronta
              </button>
            ) : (
              <span />
            )}
          </div>
        </section>

        {/* No telemóvel, o «pronta» vem depois do capítulo. */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 lg:hidden">
          <ReadyBox
            ficha={ficha}
            sign={sign}
            incoming={incoming}
            canEdit={canEdit}
            busy={busy}
            missing={missingBeforeReady.map((s) => s.todo)}
            onReady={markReady}
            onUnready={unready}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  «Pronta»                                                           */
/* ------------------------------------------------------------------ */

function ReadyBox({
  ficha,
  sign,
  incoming,
  canEdit,
  busy,
  missing,
  onReady,
  onUnready,
}: {
  ficha: Ficha;
  sign: Sign | null;
  incoming: Person | null;
  canEdit: boolean;
  busy: string | null;
  missing: string[];
  onReady: () => void;
  onUnready: () => void;
}) {
  if (ficha.readyAt) {
    return (
      <div>
        <p className="flex items-center gap-2 text-[13px] font-semibold text-emerald-200">
          <CheckCircle2 className="h-4 w-4" /> Pronta desde {formatDateTime(ficha.readyAt).slice(0, 10)}
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-white/50">
          {sign
            ? `${sign.by.name} assumiu a ${formatDateTime(sign.at).slice(0, 10)}.`
            : incoming
              ? `À espera de ${incoming.name} ler e assumir.`
              : "Falta a direção escolher quem entra."}
        </p>
        {canEdit && !sign && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={onUnready}
            className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-white/50 transition hover:text-white"
          >
            <Undo2 className="h-3.5 w-3.5" /> Voltar a editar
          </button>
        )}
      </div>
    );
  }
  return (
    <div>
      <button
        type="button"
        disabled={!canEdit || busy !== null}
        onClick={onReady}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        style={gradient}
      >
        {busy === "ready" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        Marcar ficha como pronta
      </button>
      {missing.length > 0 ? (
        <p className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-amber-200/90">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> Ainda falta: {missing.join(", ").toLowerCase()}.
        </p>
      ) : (
        <p className="mt-2 text-[11.5px] leading-relaxed text-white/45">
          {incoming ? `${incoming.name} recebe aviso no sino.` : "Quem entrar recebe aviso no sino."}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  O conteúdo de cada capítulo                                        */
/* ------------------------------------------------------------------ */

function ChapterTitle({ title, lead }: { title: string; lead: string }) {
  return (
    <div className="mt-1.5">
      <h2 className="text-[22px] font-semibold leading-tight tracking-tight text-white">{title}</h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-white/55">{lead}</p>
    </div>
  );
}

function ChapterBody(p: {
  id: ChapterId;
  ficha: Ficha;
  update: (fn: (f: Ficha) => Ficha) => void;
  canEdit: boolean;
  vaultCount: number;
  slug: string;
  lang: "pt" | "en";
  incoming: Person | null;
  endDate: string;
  questions: Question[];
  canAsk: boolean;
  canAnswer: boolean;
  busy: string | null;
  firstOut: string;
  onAsk: (q: string) => Promise<boolean>;
  onAnswer: (qid: string, a: string) => Promise<boolean>;
}) {
  const { id, ficha, update, canEdit } = p;

  if (id === "acessos") {
    const decided = ACCESS_ITEMS.filter((a) => ficha.accesses[a.id]).length;
    const missing = ACCESS_ITEMS.filter((a) => ficha.accesses[a.id] === "falta").length;
    return (
      <>
        <ChapterTitle
          title="Acessos e contas"
          lead="Quem entra tem de conseguir entrar em tudo sem depender de ti. «Garantido» quer dizer que está na conta da agência ou no cofre do cliente."
        />
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-[#783DF5]/25 bg-[#783DF5]/[0.07] px-4 py-3">
          <KeyRound className="h-4 w-4 shrink-0 text-[#c4a6ff]" />
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-white/70">
            <span className="font-semibold text-white">
              {p.vaultCount} acesso{p.vaultCount === 1 ? "" : "s"} no cofre deste cliente.
            </span>{" "}
            As passwords vão para o cofre, nunca para esta ficha.
          </p>
          <a href={`/seo/${p.slug}#section-accesses`} className="text-[12.5px] font-medium text-[#c4a6ff] underline-offset-4 hover:underline">
            Abrir o cofre
          </a>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-[12.5px] text-white/45">
            {decided}/{ACCESS_ITEMS.length} verificados{missing > 0 ? ` · ${missing} em falta` : ""}
          </p>
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${(decided / ACCESS_ITEMS.length) * 100}%` }} />
          </div>
        </div>
        <ul className="mt-2 divide-y divide-white/[0.06]">
          {ACCESS_ITEMS.map((a) => {
            const state = ficha.accesses[a.id];
            return (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="text-[14px] text-white/85">{a.label}</span>
                {canEdit ? (
                  <span className="inline-flex overflow-hidden rounded-lg border border-white/12" role="radiogroup" aria-label={a.label}>
                    {ACCESS_STATES.map((s) => {
                      const on = state === s.id;
                      const tone = s.id === "ok" ? "bg-emerald-500/85 text-white" : s.id === "falta" ? "bg-rose-500/85 text-white" : "bg-white/20 text-white";
                      return (
                        <button
                          key={s.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          title={s.hint}
                          onClick={() => update((f) => ({ ...f, accesses: { ...f.accesses, [a.id]: on ? undefined : (s.id as AccessState) } }))}
                          className={`px-2.5 py-1 text-[12px] transition ${on ? tone : "text-white/50 hover:bg-white/[0.06] hover:text-white"}`}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </span>
                ) : (
                  <AccessPill state={state} />
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-5">
          <p className="mb-1.5 text-[12.5px] text-white/55">Notas sobre os acessos (2FA, quem é o dono, a quem pedir)</p>
          {canEdit ? (
            <AutoTextarea
              value={ficha.accessNotes}
              max={ACCESS_NOTES_MAX}
              minRows={2}
              onChange={(v) => update((f) => ({ ...f, accessNotes: v }))}
              placeholder="Ex.: o Business Profile está na conta do dono; o código 2FA do WordPress chega ao telemóvel da receção."
            />
          ) : (
            <ReadText text={ficha.accessNotes} empty="Sem notas." />
          )}
        </div>
      </>
    );
  }

  if (id === "semaforo") {
    return (
      <>
        <ChapterTitle title="Semáforo do projeto" lead="Como está a relação com o cliente neste momento. A direção vê os vermelhos logo no sino." />
        <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
          {HEALTH.map((h) => {
            const on = ficha.health === h.id;
            return (
              <button
                key={h.id}
                type="button"
                disabled={!canEdit}
                onClick={() => update((f) => ({ ...f, health: on ? null : h.id }))}
                className={`rounded-2xl border p-4 text-left transition disabled:cursor-default ${on ? "bg-white/[0.06]" : "border-white/10 hover:border-white/25"} ${
                  !canEdit && !on ? "opacity-40" : ""
                }`}
                style={on ? { borderColor: `${h.color}aa`, boxShadow: `0 0 0 1px ${h.color}55 inset` } : undefined}
              >
                <span className="flex items-center gap-2 text-[15px] font-semibold text-white">
                  <HealthDot health={h.id} /> {h.label}
                </span>
                <span className="mt-1 block text-[12.5px] leading-relaxed text-white/50">{h.hint}</span>
              </button>
            );
          })}
        </div>
        {(ficha.health === "amarelo" || ficha.health === "vermelho") && (
          <div className="mt-4">
            <p className="mb-1.5 text-[12.5px] text-white/55">Porquê, numa frase</p>
            {canEdit ? (
              <input
                value={ficha.healthWhy}
                maxLength={HEALTH_WHY_MAX}
                onChange={(e) => update((f) => ({ ...f, healthWhy: e.target.value }))}
                placeholder="Ex.: pediu para rever o orçamento em janeiro."
                className={input}
              />
            ) : (
              <ReadText text={ficha.healthWhy} empty="Sem motivo escrito." />
            )}
          </div>
        )}
      </>
    );
  }

  if (id === "cliente") {
    return <ClientChapter {...p} />;
  }

  if (id === "perguntas") {
    return (
      <>
        <ChapterTitle
          title="Perguntas de quem entra"
          lead={`${p.incoming ? `${p.incoming.name} pergunta aqui` : "Quem entrar pergunta aqui"} o que a ficha não explica. As respostas ficam guardadas para quem vier depois.`}
        />
        <div className="mt-5">
          <QuestionList
            questions={p.questions}
            canAsk={p.canAsk}
            canAnswer={p.canAnswer}
            busy={p.busy}
            firstOut={p.firstOut}
            onAsk={p.onAsk}
            onAnswer={p.onAnswer}
          />
        </div>
      </>
    );
  }

  const section = FICHA_SECTIONS.find((s) => `s-${s.id}` === id)!;
  return <SectionChapter section={section} ficha={ficha} update={update} canEdit={canEdit} />;
}

function SectionChapter({
  section,
  ficha,
  update,
  canEdit,
}: {
  section: (typeof FICHA_SECTIONS)[number];
  ficha: Ficha;
  update: (fn: (f: Ficha) => Ficha) => void;
  canEdit: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const value = ficha.sections[section.id] ?? "";
  /** Um clique numa pista acrescenta-a como linha a preencher. */
  function addPrompt(prompt: string) {
    const line = `${prompt}: `;
    const next = value.trim() ? `${value.replace(/\s+$/, "")}\n${line}` : line;
    update((f) => ({ ...f, sections: { ...f.sections, [section.id]: next.slice(0, SECTION_MAX) } }));
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }
  const used = (prompt: string) => value.includes(`${prompt}:`);
  return (
    <>
      <ChapterTitle title={section.title} lead={section.lead} />
      <div className="mt-5">
        <p className="mb-2 text-[12px] text-white/40">{canEdit ? "Não te esqueças de — clica para acrescentar como linha:" : "O que esta secção cobre:"}</p>
        <ul className="flex flex-wrap gap-1.5">
          {section.prompts.map((pr) => (
            <li key={pr}>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => addPrompt(pr)}
                  disabled={used(pr)}
                  className="inline-flex items-center gap-1 rounded-full border border-white/12 px-2.5 py-1 text-[12px] text-white/65 transition hover:border-[#783DF5]/60 hover:text-white disabled:border-emerald-400/30 disabled:text-emerald-200/70"
                >
                  {used(pr) ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />} {pr}
                </button>
              ) : (
                <span className="rounded-full border border-white/10 px-2.5 py-1 text-[12px] text-white/50">{pr}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4">
        {canEdit ? (
          <>
            <AutoTextarea
              textareaRef={ref}
              value={value}
              max={SECTION_MAX}
              minRows={7}
              onChange={(v) => update((f) => ({ ...f, sections: { ...f.sections, [section.id]: v } }))}
              placeholder="Escreve como se explicasses a um colega ao café: concreto, com nomes e datas."
            />
            <div className="mt-1.5 flex items-center justify-between text-[11.5px]">
              <span className={sectionFilled(value) ? "text-emerald-300/80" : "text-white/35"}>
                {sectionFilled(value) ? "✓ Conta como escrita" : "Escreve pelo menos umas linhas para contar como feita"}
              </span>
              <span className="tabular-nums text-white/30">
                {value.length}/{SECTION_MAX}
              </span>
            </div>
          </>
        ) : (
          <ReadText text={value} />
        )}
      </div>
    </>
  );
}

function ClientChapter(p: {
  ficha: Ficha;
  update: (fn: (f: Ficha) => Ficha) => void;
  canEdit: boolean;
  lang: "pt" | "en";
  incoming: Person | null;
  endDate: string;
}) {
  const { ficha, update, canEdit } = p;
  const [copied, setCopied] = useState(false);
  const message = clientMessageDraft(p.lang, p.incoming?.name ?? null, formatISODate(p.endDate));
  return (
    <>
      <ChapterTitle
        title="Cliente e reunião a três"
        lead="O cliente deve saber da mudança por quem ele já conhece, e conhecer quem entra antes do teu último dia."
      />
      <ol className="mt-6 space-y-5">
        <li className="flex gap-4">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${ficha.clientInformed ? "bg-emerald-500 text-white" : "bg-white/10 text-white"}`}>
            {ficha.clientInformed ? <Check className="h-3.5 w-3.5" /> : 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-white">Avisar o cliente</p>
            {canEdit && (
              <div className="mt-2.5 rounded-xl border border-white/10 bg-black/25 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/40">
                    Rascunho · {p.lang === "en" ? "inglês" : "português"}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(message).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1800);
                      });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-2.5 py-1 text-[12px] text-white/70 transition hover:border-white/30 hover:text-white"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                </div>
                <p className="text-[13.5px] leading-relaxed text-white/70">{message}</p>
                {!p.incoming && <p className="mt-2 text-[12px] text-amber-200">A direção ainda não escolheu quem entra.</p>}
              </div>
            )}
            <label className="mt-3 flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={ficha.clientInformed}
                disabled={!canEdit}
                onChange={(e) => update((f) => ({ ...f, clientInformed: e.target.checked }))}
                className="h-4 w-4 accent-[#783DF5]"
              />
              <span className="text-[14px] text-white/85">O cliente já sabe quem é o novo consultor</span>
            </label>
          </div>
        </li>
        <li className="flex gap-4">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${ficha.meetingDone ? "bg-emerald-500 text-white" : "bg-white/10 text-white"}`}>
            {ficha.meetingDone ? <Check className="h-3.5 w-3.5" /> : 2}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-white">Reunião a três</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-white/50">Tu, {p.incoming?.name ?? "quem entra"} e o cliente. 20 minutos chegam para apresentar e passar o testemunho.</p>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <input
                type="date"
                value={ficha.meetingDate ?? ""}
                disabled={!canEdit}
                onChange={(e) => update((f) => ({ ...f, meetingDate: e.target.value || null }))}
                className={`${input} w-auto`}
                aria-label="Data da reunião a três"
              />
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={ficha.meetingDone}
                  disabled={!canEdit}
                  onChange={(e) => update((f) => ({ ...f, meetingDone: e.target.checked }))}
                  className="h-4 w-4 accent-[#783DF5]"
                />
                <span className="text-[14px] text-white/85">Reunião feita</span>
              </label>
            </div>
          </div>
        </li>
      </ol>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Perguntas                                                          */
/* ------------------------------------------------------------------ */

function QuestionList({
  questions,
  canAsk,
  canAnswer,
  busy,
  firstOut,
  onAsk,
  onAnswer,
}: {
  questions: Question[];
  canAsk: boolean;
  canAnswer: boolean;
  busy: string | null;
  firstOut: string;
  onAsk: (q: string) => Promise<boolean>;
  onAnswer: (qid: string, a: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  return (
    <div>
      {questions.length > 0 ? (
        <ul className="space-y-3">
          {questions.map((q) => (
            <li key={q.id} className={`rounded-xl border p-4 ${q.a ? "border-white/10 bg-black/20" : "border-amber-300/25 bg-amber-300/[0.04]"}`}>
              <p className="text-[12px] text-white/40">
                {q.by.name} · {formatDateTime(q.at)}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[15px] font-medium leading-relaxed text-white">{q.q}</p>
              {q.a ? (
                <div className="mt-3 border-l-2 border-emerald-400/50 pl-3">
                  <p className="text-[12px] text-white/40">
                    {q.aBy?.name ?? firstOut} · {q.aAt ? formatDateTime(q.aAt) : ""}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[14px] leading-relaxed text-white/75">{q.a}</p>
                </div>
              ) : canAnswer ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <textarea
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers((m) => ({ ...m, [q.id]: e.target.value }))}
                    rows={2}
                    maxLength={ANSWER_MAX}
                    placeholder="A tua resposta"
                    className={`${input} resize-none`}
                  />
                  <button
                    type="button"
                    disabled={busy !== null || !(answers[q.id] ?? "").trim()}
                    onClick={async () => {
                      if (await onAnswer(q.id, answers[q.id] ?? "")) setAnswers((m) => ({ ...m, [q.id]: "" }));
                    }}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-[13px] font-semibold text-[#07080d] disabled:opacity-40"
                  >
                    {busy === `answer:${q.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Responder
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-[12.5px] text-amber-200">À espera de resposta de {firstOut}.</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-white/12 px-4 py-6 text-center">
          <MessageCircleQuestion className="mx-auto h-5 w-5 text-white/30" />
          <p className="mt-2 text-[13.5px] text-white/45">Ainda não há perguntas.</p>
        </div>
      )}
      {canAsk && (
        <div id="perguntar" className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            maxLength={QUESTION_MAX}
            placeholder={`Pergunta a ${firstOut} o que a ficha não explica.`}
            className={`${input} resize-none`}
          />
          <button
            type="button"
            disabled={busy !== null || draft.trim().length < 3}
            onClick={async () => {
              if (await onAsk(draft)) setDraft("");
            }}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-[13px] font-semibold text-[#07080d] disabled:opacity-40"
          >
            {busy === "ask" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Perguntar
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  A ficha como documento (quem entra; pré-visualização de quem sai)  */
/* ------------------------------------------------------------------ */

function DocumentView(p: {
  ficha: Ficha;
  questions: Question[];
  sign: Sign | null;
  incoming: Person | null;
  firstOut: string;
  canAsk: boolean;
  canAnswer: boolean;
  canSign: boolean;
  canEdit: boolean;
  busy: string | null;
  actionError: string | null;
  progressPct: number;
  onEdit: () => void;
  onAsk: (q: string) => Promise<boolean>;
  onAnswer: (qid: string, a: string) => Promise<boolean>;
  onSign: () => void;
  onUnsign: () => void;
}) {
  const { ficha } = p;
  const h = healthOf(ficha.health);
  const ok = ACCESS_ITEMS.filter((a) => ficha.accesses[a.id] === "ok");
  const missing = ACCESS_ITEMS.filter((a) => ficha.accesses[a.id] === "falta");
  const unknown = ACCESS_ITEMS.filter((a) => !ficha.accesses[a.id]);
  const open = p.questions.filter((q) => !q.a).length;

  return (
    <div className="mx-auto max-w-3xl pb-28">
      {p.canEdit && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#783DF5]/30 bg-[#783DF5]/[0.08] px-4 py-2.5">
          <p className="text-[13px] text-white/75">É isto que {p.incoming?.name ?? "quem entra"} vai ler.</p>
          <button type="button" onClick={p.onEdit} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#07080d]">
            <PenLine className="h-3.5 w-3.5" /> Voltar a escrever
          </button>
        </div>
      )}
      {!ficha.readyAt && !p.canEdit && (
        <p className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[13px] text-white/60">
          {p.firstOut} ainda está a escrever esta ficha ({p.progressPct}%). Já podes ler e perguntar; o «Li e assumo» abre quando estiver pronta.
        </p>
      )}

      {/* Resumo */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/40">Semáforo</p>
          <p className="mt-2 flex items-center gap-2 text-[16px] font-semibold text-white">
            <HealthDot health={ficha.health} /> {h ? h.label : "Por definir"}
          </p>
          {ficha.healthWhy && h?.id !== "verde" && <p className="mt-1 text-[12.5px] leading-relaxed text-white/55">{ficha.healthWhy}</p>}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/40">Acessos</p>
          <p className="mt-2 text-[16px] font-semibold text-white">
            {ok.length} garantidos
            {missing.length > 0 && <span className="text-rose-300"> · {missing.length} em falta</span>}
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-white/55">
            {missing.length > 0 ? `Em falta: ${missing.map((a) => a.label).join(", ")}.` : unknown.length > 0 ? `${unknown.length} por verificar.` : "Tudo verificado."}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/40">Reunião a três</p>
          <p className="mt-2 text-[16px] font-semibold text-white">
            {ficha.meetingDone ? "Feita" : ficha.meetingDate ? formatISODate(ficha.meetingDate) : "Por marcar"}
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-white/55">
            {ficha.clientInformed ? "O cliente já sabe da mudança." : "O cliente ainda não foi avisado."}
          </p>
        </div>
      </div>

      {/* Secções */}
      <article className="mt-8 space-y-9">
        {FICHA_SECTIONS.map((s, i) => (
          <section key={s.id} id={`s-${s.id}`} className="scroll-mt-24">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c4a6ff]/80">{String(i + 1).padStart(2, "0")}</p>
            <h2 className="mt-1 text-[21px] font-semibold tracking-tight text-white">{s.title}</h2>
            <div className="mt-3">
              <ReadText text={ficha.sections[s.id]} />
            </div>
          </section>
        ))}
        <section id="acessos" className="scroll-mt-24">
          <h2 className="text-[21px] font-semibold tracking-tight text-white">Acessos, um a um</h2>
          <ul className="mt-3 divide-y divide-white/[0.06] rounded-2xl border border-white/10 px-4">
            {ACCESS_ITEMS.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-[14px] text-white/80">{a.label}</span>
                <AccessPill state={ficha.accesses[a.id]} />
              </li>
            ))}
          </ul>
          {ficha.accessNotes.trim() && <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-white/65">{ficha.accessNotes}</p>}
        </section>
        <section id="perguntas" className="scroll-mt-24">
          <h2 className="text-[21px] font-semibold tracking-tight text-white">Perguntas{open > 0 ? ` · ${open} por responder` : ""}</h2>
          <div className="mt-3">
            <QuestionList
              questions={p.questions}
              canAsk={p.canAsk}
              canAnswer={p.canAnswer}
              busy={p.busy}
              firstOut={p.firstOut}
              onAsk={p.onAsk}
              onAnswer={p.onAnswer}
            />
          </div>
        </section>
      </article>

      {/* Barra de baixo de quem entra */}
      {(p.canSign || p.sign) && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#07080d]/95 px-4 py-3">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
            {p.actionError && <p className="w-full text-[12.5px] text-rose-300">{p.actionError}</p>}
            {p.sign ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                <p className="min-w-0 flex-1 text-[13.5px] text-white">
                  {p.canSign ? "Assumiste" : `${p.sign.by.name} assumiu`} o projeto a {formatDateTime(p.sign.at)}.
                </p>
                {p.canSign && (
                  <button type="button" disabled={p.busy !== null} onClick={p.onUnsign} className="inline-flex items-center gap-1.5 text-[12.5px] text-white/50 hover:text-white">
                    <Undo2 className="h-3.5 w-3.5" /> Desfazer
                  </button>
                )}
              </>
            ) : (
              <>
                <a href="#perguntar" className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 px-4 py-2.5 text-[13px] text-white/75 hover:border-white/30 hover:text-white">
                  <MessageCircleQuestion className="h-4 w-4" /> Perguntar
                </a>
                <button
                  type="button"
                  disabled={!ficha.readyAt || p.busy !== null}
                  onClick={p.onSign}
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13.5px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  style={gradient}
                >
                  {p.busy === "sign" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                  Li e assumo o projeto
                </button>
                <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-white/45">
                  {ficha.readyAt
                    ? open > 0
                      ? `Ainda há ${open} pergunta${open === 1 ? "" : "s"} por responder.`
                      : "Assina quando tiveres lido tudo."
                    : "Abre quando a ficha estiver pronta."}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
