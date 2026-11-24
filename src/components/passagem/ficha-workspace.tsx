"use client";

// A ficha de um projeto na passagem (v80.39).
//
//   • Quem sai (e a direção) escreve: acessos, semáforo, as 7 secções, o
//     aviso ao cliente e a reunião a três. Grava sozinho (1 s depois de
//     parar de escrever) e ao sair da página — nunca se perde texto.
//   • Quem entra lê tudo, pergunta e, com a ficha pronta, assina «Li e
//     assumo». A direção pode escrever, perguntar e responder.
//
// O progresso à esquerda é calculado do que está no ecrã, ao vivo.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  LockKeyhole,
  MessageCircleQuestion,
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
  sectionFilled,
  type AccessState,
  type Ficha,
  type Person,
  type Question,
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

const input =
  "w-full rounded-xl border border-white/12 bg-black/30 px-3.5 py-2.5 text-[14.5px] leading-relaxed text-white outline-none transition placeholder:text-white/25 focus:border-[#783DF5]/70 focus:ring-2 focus:ring-[#783DF5]/30 disabled:opacity-60";

function AutoTextarea({
  value,
  onChange,
  max,
  minRows = 4,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  max: number;
  minRows?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={minRows}
      maxLength={max}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${input} resize-none overflow-hidden`}
    />
  );
}

function Card({ id, title, lead, done, children }: { id: string; title: string; lead?: string; done?: boolean; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold text-white">{title}</h2>
          {lead && <p className="mt-0.5 text-[13.5px] leading-relaxed text-white/50">{lead}</p>}
        </div>
        {done !== undefined && (
          <span
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
              done ? "bg-emerald-500 text-white" : "border border-dashed border-white/20"
            }`}
            aria-label={done ? "Feito" : "Por fazer"}
          >
            {done && <Check className="h-3.5 w-3.5" />}
          </span>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ReadText({ text }: { text: string | undefined }) {
  const t = (text ?? "").trim();
  return t ? (
    <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-white/80">{t}</p>
  ) : (
    <p className="text-[13.5px] italic text-white/35">Ainda por escrever.</p>
  );
}

export function FichaWorkspace(props: Props) {
  const { passagemId, slug, role, closed, outgoing, incoming, sign, questions, vaultCount, lang } = props;
  const router = useRouter();
  const canEdit = role !== "incoming" && !closed;
  const canAsk = role !== "outgoing" && !closed;
  const canAnswer = role !== "incoming" && !closed;
  const canSign = role === "incoming" && incoming?.username === props.meUsername && !closed;

  const [ficha, setFicha] = useState<Ficha>(props.initialFicha);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const latest = useRef(ficha);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<boolean> | null>(null);

  latest.current = ficha;

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

  // Ao esconder o separador, ao sair da página ou ao navegar na app: grava.
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
    setActionBusy(key);
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
      setActionBusy(null);
    }
  }

  const steps = fichaSteps(ficha, sign);
  const progress = fichaProgress(ficha, sign);
  const message = clientMessageDraft(lang, incoming?.name ?? null, formatISODate(props.endDate));
  const firstOut = outgoing.name.split(" ")[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
      {/* ── Coluna do progresso ─────────────────────────────────────── */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex items-center gap-3">
            <ProgressRing pct={progress.pct} size={52} />
            <div>
              <p className="text-[14px] font-semibold text-white">
                {progress.done} de {progress.total} passos
              </p>
              <p className="text-[12px] text-white/45">
                {save.kind === "saving"
                  ? "A gravar…"
                  : save.kind === "dirty"
                    ? "Por gravar…"
                    : save.kind === "error"
                      ? save.message
                      : save.kind === "saved"
                        ? `Gravado ${formatDateTime(save.at).slice(-5)}`
                        : canEdit
                          ? "Grava sozinho"
                          : closed
                            ? "Passagem fechada"
                            : "Só leitura"}
              </p>
            </div>
          </div>
          <ol className="mt-4 space-y-1.5">
            {steps.map((s) => (
              <li key={s.id} className="flex items-start gap-2 text-[12.5px]">
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                    s.done ? "bg-emerald-500 text-white" : "border border-white/20"
                  }`}
                >
                  {s.done && <Check className="h-2.5 w-2.5" />}
                </span>
                <span className={s.done ? "text-white/45" : "text-white/80"}>{s.label}</span>
              </li>
            ))}
          </ol>
          <nav className="mt-4 hidden border-t border-white/[0.06] pt-3 lg:block" aria-label="Secções da ficha">
            {[
              { id: "acessos", t: "Acessos" },
              { id: "semaforo", t: "Semáforo" },
              ...FICHA_SECTIONS.map((s) => ({ id: `s-${s.id}`, t: s.title })),
              { id: "cliente", t: "Cliente e reunião" },
              { id: "perguntas", t: `Perguntas${questions.length ? ` (${questions.length})` : ""}` },
            ].map((n) => (
              <a key={n.id} href={`#${n.id}`} className="block rounded-lg px-2 py-1 text-[12.5px] text-white/50 transition hover:bg-white/[0.04] hover:text-white">
                {n.t}
              </a>
            ))}
          </nav>
        </div>
      </aside>

      {/* ── A ficha ──────────────────────────────────────────────────── */}
      <div className="min-w-0 space-y-4">
        {save.kind === "error" && canEdit && (
          <p className="flex items-center justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2.5 text-[13.5px] text-rose-200">
            {save.message}
            <button type="button" onClick={() => void flush()} className="rounded-lg border border-rose-300/40 px-2.5 py-1 text-[12.5px]">
              Tentar outra vez
            </button>
          </p>
        )}

        <Card
          id="acessos"
          title="Acessos e contas"
          lead="Quem entra tem de conseguir entrar em tudo sem depender de ti. Garantido = está na conta da agência ou no cofre do cliente."
          done={steps[0].done}
        >
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#783DF5]/25 bg-[#783DF5]/[0.07] px-4 py-3">
            <KeyRound className="h-4 w-4 shrink-0 text-[#c4a6ff]" />
            <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-white/70">
              <span className="font-semibold text-white">
                {vaultCount} acesso{vaultCount === 1 ? "" : "s"} no cofre deste cliente.
              </span>{" "}
              As passwords vão para o cofre, nunca para esta ficha.
            </p>
            <a href={`/seo/${slug}#section-accesses`} className="text-[12.5px] font-medium text-[#c4a6ff] underline-offset-4 hover:underline">
              Abrir o cofre
            </a>
          </div>
          <ul className="divide-y divide-white/[0.06]">
            {ACCESS_ITEMS.map((a) => {
              const state = ficha.accesses[a.id];
              return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span className="text-[14px] text-white/85">{a.label}</span>
                  {canEdit ? (
                    <span className="inline-flex overflow-hidden rounded-lg border border-white/12" role="radiogroup" aria-label={a.label}>
                      {ACCESS_STATES.map((s) => {
                        const on = state === s.id;
                        const tone =
                          s.id === "ok"
                            ? "bg-emerald-500/80 text-white"
                            : s.id === "falta"
                              ? "bg-rose-500/80 text-white"
                              : "bg-white/20 text-white";
                        return (
                          <button
                            key={s.id}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            title={s.hint}
                            onClick={() =>
                              update((f) => ({ ...f, accesses: { ...f.accesses, [a.id]: on ? undefined : (s.id as AccessState) } }))
                            }
                            className={`px-2.5 py-1 text-[12px] transition ${on ? tone : "text-white/50 hover:bg-white/[0.06] hover:text-white"}`}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </span>
                  ) : (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[12px] ${
                        state === "ok"
                          ? "bg-emerald-400/15 text-emerald-200"
                          : state === "falta"
                            ? "bg-rose-400/15 text-rose-200"
                            : state === "na"
                              ? "bg-white/10 text-white/55"
                              : "border border-dashed border-white/20 text-white/40"
                      }`}
                    >
                      {ACCESS_STATES.find((s) => s.id === state)?.label ?? "Por verificar"}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-4">
            <p className="mb-1.5 text-[12.5px] text-white/55">Notas sobre os acessos (2FA, quem é o dono, a quem pedir)</p>
            {canEdit ? (
              <AutoTextarea
                value={ficha.accessNotes}
                max={ACCESS_NOTES_MAX}
                minRows={2}
                onChange={(v) => update((f) => ({ ...f, accessNotes: v }))}
                placeholder="Ex.: o GBP está na conta do dono; o código 2FA do WordPress chega ao telemóvel da rececionista."
              />
            ) : (
              <ReadText text={ficha.accessNotes} />
            )}
          </div>
        </Card>

        <Card id="semaforo" title="Semáforo do projeto" lead="Como está a relação com o cliente neste momento. A direção vê os vermelhos logo no topo." done={steps[1].done}>
          <div className="grid gap-2 sm:grid-cols-3">
            {HEALTH.map((h) => {
              const on = ficha.health === h.id;
              return (
                <button
                  key={h.id}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => update((f) => ({ ...f, health: on ? null : h.id }))}
                  className={`rounded-xl border p-3 text-left transition disabled:cursor-default ${
                    on ? "bg-white/[0.06]" : "border-white/10 hover:border-white/25"
                  } ${!canEdit && !on ? "opacity-40" : ""}`}
                  style={on ? { borderColor: `${h.color}99` } : undefined}
                >
                  <span className="flex items-center gap-2 text-[14px] font-semibold text-white">
                    <HealthDot health={h.id} /> {h.label}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] leading-relaxed text-white/50">{h.hint}</span>
                </button>
              );
            })}
          </div>
          {(ficha.health === "amarelo" || ficha.health === "vermelho") && (
            <div className="mt-3">
              {canEdit ? (
                <input
                  value={ficha.healthWhy}
                  maxLength={HEALTH_WHY_MAX}
                  onChange={(e) => update((f) => ({ ...f, healthWhy: e.target.value }))}
                  placeholder="Porquê, numa frase."
                  className={input}
                />
              ) : (
                <ReadText text={ficha.healthWhy} />
              )}
            </div>
          )}
        </Card>

        {FICHA_SECTIONS.map((s) => (
          <Card key={s.id} id={`s-${s.id}`} title={s.title} lead={s.lead} done={sectionFilled(ficha.sections[s.id])}>
            <ul className="mb-3 flex flex-wrap gap-1.5">
              {s.prompts.map((p) => (
                <li key={p} className="rounded-full border border-white/10 px-2.5 py-0.5 text-[12px] text-white/50">
                  {p}
                </li>
              ))}
            </ul>
            {canEdit ? (
              <>
                <AutoTextarea
                  value={ficha.sections[s.id] ?? ""}
                  max={SECTION_MAX}
                  onChange={(v) => update((f) => ({ ...f, sections: { ...f.sections, [s.id]: v } }))}
                  placeholder="Escreve como se explicasses a um colega ao café: concreto, com nomes e datas."
                />
                <p className="mt-1 text-right text-[11.5px] tabular-nums text-white/30">
                  {(ficha.sections[s.id] ?? "").length}/{SECTION_MAX}
                </p>
              </>
            ) : (
              <ReadText text={ficha.sections[s.id]} />
            )}
          </Card>
        ))}

        <Card id="cliente" title="Cliente e reunião a três" lead="O cliente deve saber da mudança por quem ele já conhece, e conhecer quem entra antes do último dia.">
          <div className="space-y-5">
            <div>
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={ficha.clientInformed}
                  disabled={!canEdit}
                  onChange={(e) => update((f) => ({ ...f, clientInformed: e.target.checked }))}
                  className="h-4 w-4 accent-[#783DF5]"
                />
                <span className="text-[14px] text-white">O cliente já sabe quem é o novo consultor</span>
              </label>
              {canEdit && (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-white/40">
                      Rascunho da mensagem · {lang === "en" ? "inglês" : "português"}
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
                  {!incoming && <p className="mt-2 text-[12px] text-amber-200">A direção ainda não escolheu quem entra.</p>}
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-end">
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] text-white/55">Reunião a três (tu, quem entra e o cliente)</span>
                <input
                  type="date"
                  value={ficha.meetingDate ?? ""}
                  disabled={!canEdit}
                  onChange={(e) => update((f) => ({ ...f, meetingDate: e.target.value || null }))}
                  className={input}
                />
              </label>
              <label className="flex cursor-pointer items-center gap-3 pb-2.5">
                <input
                  type="checkbox"
                  checked={ficha.meetingDone}
                  disabled={!canEdit}
                  onChange={(e) => update((f) => ({ ...f, meetingDone: e.target.checked }))}
                  className="h-4 w-4 accent-[#783DF5]"
                />
                <span className="text-[14px] text-white">Reunião feita</span>
              </label>
            </div>
          </div>
        </Card>

        <Questions
          questions={questions}
          canAsk={canAsk}
          canAnswer={canAnswer}
          busy={actionBusy}
          firstOut={firstOut}
          onAsk={(q) => action("ask", { action: "ask", q })}
          onAnswer={(qid, a) => action(`answer:${qid}`, { action: "answer", qid, a })}
        />

        {/* ── Fecho: pronta / assumir ──────────────────────────────── */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
          {actionError && <p className="mb-3 text-[13px] text-rose-300">{actionError}</p>}
          {role !== "incoming" ? (
            ficha.readyAt ? (
              <div className="flex flex-wrap items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                <p className="min-w-0 flex-1 text-[14px] text-white">
                  Ficha pronta desde {formatDateTime(ficha.readyAt)}.{" "}
                  <span className="text-white/55">
                    {sign
                      ? `${sign.by.name} assumiu o projeto a ${formatDateTime(sign.at)}.`
                      : incoming
                        ? `À espera de ${incoming.name} ler e assumir.`
                        : "Falta a direção escolher quem entra."}
                  </span>
                </p>
                {canEdit && !sign && (
                  <button
                    type="button"
                    disabled={actionBusy !== null}
                    onClick={() => action("unready", { action: "unready" }, (d) => d.ficha && setFicha((f) => ({ ...f, readyAt: d.ficha!.readyAt })))}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-1.5 text-[12.5px] text-white/70 hover:text-white"
                  >
                    <Undo2 className="h-3.5 w-3.5" /> Voltar a editar
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={!canEdit || actionBusy !== null}
                    onClick={() => action("ready", { action: "ready" }, (d) => d.ficha && setFicha((f) => ({ ...f, readyAt: d.ficha!.readyAt })))}
                    className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ background: "linear-gradient(90deg,#783DF5,#E040A0)" }}
                  >
                    {actionBusy === "ready" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Marcar ficha como pronta
                  </button>
                  <p className="text-[12.5px] leading-relaxed text-white/45">
                    {incoming ? `${incoming.name} recebe aviso no sino para ler e assumir.` : "Quem entrar recebe aviso no sino."}
                  </p>
                </div>
                {steps.slice(0, 5).some((s) => !s.done) && (
                  <p className="mt-3 flex items-start gap-2 text-[12.5px] text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Ainda falta: {steps.slice(0, 5).filter((s) => !s.done).map((s) => s.label.replace(/ \(.*\)$/, "").toLowerCase()).join(", ")}.
                  </p>
                )}
              </div>
            )
          ) : sign ? (
            <div className="flex flex-wrap items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
              <p className="min-w-0 flex-1 text-[14px] text-white">Assumiste o projeto a {formatDateTime(sign.at)}. A direção passa-o para ti no SEO DPT.</p>
              {canSign && (
                <button
                  type="button"
                  disabled={actionBusy !== null}
                  onClick={() => action("unsign", { action: "unsign" })}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-1.5 text-[12.5px] text-white/70 hover:text-white"
                >
                  <Undo2 className="h-3.5 w-3.5" /> Desfazer
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!canSign || !ficha.readyAt || actionBusy !== null}
                onClick={() => action("sign", { action: "sign" })}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: "linear-gradient(90deg,#783DF5,#E040A0)" }}
              >
                {actionBusy === "sign" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                Li e assumo o projeto
              </button>
              <p className="text-[12.5px] leading-relaxed text-white/45">
                {ficha.readyAt
                  ? "Assina quando tiveres lido tudo e as tuas perguntas estiverem respondidas."
                  : `${firstOut} ainda está a escrever a ficha. Já podes ler e perguntar.`}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Questions({
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
  const open = questions.filter((q) => !q.a).length;
  return (
    <section id="perguntas" className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <MessageCircleQuestion className="mt-0.5 h-5 w-5 shrink-0 text-[#c4a6ff]" />
        <div>
          <h2 className="text-[17px] font-semibold text-white">Perguntas de quem entra</h2>
          <p className="mt-0.5 text-[13.5px] leading-relaxed text-white/50">
            {open > 0 ? `${open} por responder. ` : ""}As respostas ficam na ficha para sempre, para quem vier depois.
          </p>
        </div>
      </div>
      {questions.length > 0 && (
        <ul className="mt-4 space-y-3">
          {questions.map((q) => (
            <li key={q.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-[12px] text-white/40">
                {q.by.name} · {formatDateTime(q.at)}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[14.5px] font-medium leading-relaxed text-white">{q.q}</p>
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
      )}
      {questions.length === 0 && !canAsk && <p className="mt-4 text-[13.5px] text-white/40">Ainda não há perguntas.</p>}
      {canAsk && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
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
    </section>
  );
}
