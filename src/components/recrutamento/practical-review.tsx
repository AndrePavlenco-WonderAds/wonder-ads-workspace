"use client";

// A prova prática na FICHA do candidato (Recrutamento, Fase 2 · Parte 2,
// v80.16): o link para partilhar, o site, o estado ao vivo, o que o candidato
// entregou ponto a ponto e a avaliação — nota 0–10 + notas por ponto (o
// guião não tem grelha; nada de critérios inventados) e «a minha nota».
//
// A avaliação grava sozinha (700 ms; flush keepalive ao sair). As respostas
// do candidato vivem noutra chave, por isso avaliar nunca pisa o que ele está
// a escrever; enquanto a prova decorre, a ficha relê-as a cada 15 s.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Lock,
  LockOpen,
  RefreshCw,
  RotateCcw,
  Star,
  Trash2,
  Video,
} from "lucide-react";
import {
  fmtBytes,
  fmtDuration,
  getPracticalTemplate,
  IMPACTS,
  loomEmbed,
  practicalItems,
  practicalScore,
  practicalStage,
  PRACTICAL_STAGE_LABEL,
  type PracticalAnswers,
  type PracticalItem,
  type PracticalItemId,
  type PracticalReview as Review,
  type PracticalStage,
  type PracticalSubmission,
  type PracticalTextBlock,
  type Practical,
} from "@/lib/recrutamento/practical";
import { fmtScore } from "@/lib/recrutamento/scoring";
import type { Candidate } from "@/lib/recrutamento/shared";
import { inputCls } from "./hub";
import { scoreColor, ScoreBar, ScoreRing } from "./ui";

type OpFn = (body: Record<string, unknown>, key: string) => Promise<Candidate | null>;

const STAGE_TONE: Record<PracticalStage, string> = {
  "por-abrir": "border-white/15 bg-white/[0.04] text-white/60",
  aberto: "border-sky-300/30 bg-sky-400/10 text-sky-100",
  "em-curso": "border-amber-300/35 bg-amber-400/10 text-amber-100",
  entregue: "border-violet-300/35 bg-violet-400/10 text-violet-100",
  avaliada: "border-emerald-300/35 bg-emerald-400/10 text-emerald-100",
};

function fmtWhen(ms: number | null): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function PracticalStageChip({ stage }: { stage: PracticalStage }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${STAGE_TONE[stage]}`}>
      {stage === "em-curso" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />}
      {PRACTICAL_STAGE_LABEL[stage]}
    </span>
  );
}

export function PracticalReviewPanel({
  candidate,
  practical: p,
  initialSub,
  op,
  busy,
  onCandidate,
  nameOf,
}: {
  candidate: Candidate;
  practical: Practical;
  initialSub: PracticalSubmission | null;
  op: OpFn;
  busy: string | null;
  /** O candidato devolvido por uma gravação da avaliação (sem «busy»). */
  onCandidate: (c: Candidate) => void;
  nameOf: (u: string | null | undefined) => string;
}) {
  const template = getPracticalTemplate(p.templateId);
  const items = useMemo(() => (template ? practicalItems(template) : []), [template]);
  const [sub, setSub] = useState<PracticalSubmission | null>(initialSub);
  const [review, setReview] = useState<Review>(p.review);
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [lastPoll, setLastPoll] = useState<number>(Date.now());
  const [polling, setPolling] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [site, setSite] = useState(p.site);
  const [confirmNewLink, setConfirmNewLink] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const stage = practicalStage(p, sub);
  const locked = candidate.status === "aceite";
  const closed = Boolean(p.reviewedAt);
  const score = practicalScore(review);
  const link = `${origin}/candidatura/${p.token}`;

  useEffect(() => setOrigin(window.location.origin), []);

  // ── ao vivo: reler as respostas enquanto a prova não está entregue ─────
  const poll = useCallback(async () => {
    setPolling(true);
    try {
      const res = await fetch(`/api/admin/recrutamento/${candidate.id}/pratica/${p.id}`, { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as { submission?: PracticalSubmission };
      if (res.ok && json.submission) {
        setSub(json.submission);
        setLastPoll(Date.now());
      }
    } finally {
      setPolling(false);
    }
  }, [candidate.id, p.id]);

  useEffect(() => {
    if (sub?.submittedAt) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, 15_000);
    return () => window.clearInterval(id);
  }, [poll, sub?.submittedAt]);

  // ── gravação da avaliação ───────────────────────────────────────────────
  const reviewRef = useRef(review);
  const dirty = useRef(false);
  const inflight = useRef(false);
  const timer = useRef<number | null>(null);
  const url = `/api/admin/recrutamento/${candidate.id}`;

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
      setSaveState("saving");
      try {
        const res = await fetch(url, {
          method: "PATCH",
          keepalive,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: "practical-review", practicalId: p.id, review: reviewRef.current }),
        });
        const json = (await res.json().catch(() => ({}))) as { candidate?: Candidate };
        if (!res.ok) throw new Error(String(res.status));
        if (json.candidate && !keepalive) onCandidate(json.candidate);
        setSaveState(dirty.current ? "dirty" : "saved");
        return true;
      } catch {
        dirty.current = true;
        setSaveState("error");
        if (!keepalive) timer.current = window.setTimeout(() => void flush(), 3000);
        return false;
      } finally {
        inflight.current = false;
        if (dirty.current && !timer.current && !keepalive) timer.current = window.setTimeout(() => void flush(), 700);
      }
    },
    [url, p.id, onCandidate],
  );

  useEffect(() => {
    const onHide = () => void flush(true);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      void flush(true);
    };
  }, [flush]);

  const edit = (fn: (r: Review) => Review) => {
    if (locked) return;
    const next = fn(reviewRef.current);
    reviewRef.current = next;
    setReview(next);
    dirty.current = true;
    setSaveState("dirty");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 700);
  };

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* o campo fica selecionável */
    }
  }

  if (!template) return <p className="mt-8 text-[13px] text-white/45">O template desta prática já não existe.</p>;

  const a = sub?.answers ?? null;
  const took = sub?.startedAt ? (sub.submittedAt ?? Date.now()) - sub.startedAt : null;

  return (
    <div className="animate-fade-up">
      {/* Link, site e estado */}
      <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">{template.phase} · prática</p>
            <PracticalStageChip stage={stage} />
          </div>

          <p className="mt-4 text-[12px] font-semibold text-white/55">Link para o candidato</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <input readOnly value={origin ? link : ""} onFocus={(e) => e.currentTarget.select()} className={`${inputCls} min-w-0 flex-1 font-mono text-[12px]`} />
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[12.5px] font-semibold text-black hover:bg-[#ede4ff]"
            >
              {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-2 text-[12.5px] font-semibold text-white/70 hover:border-white/30 hover:text-white"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir
            </a>
          </div>
          <p className="mt-1.5 text-[11.5px] text-white/35">Quem tem o link faz a prova — sem login. Abrir aqui não começa o relógio.</p>

          <p className="mt-5 text-[12px] font-semibold text-white/55">Site a auditar</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <input
              value={site}
              onChange={(e) => setSite(e.target.value)}
              disabled={locked}
              placeholder="https://…"
              className={`${inputCls} min-w-0 flex-1`}
            />
            {site.trim() !== p.site && (
              <button
                type="button"
                disabled={busy === "pr-site" || locked}
                onClick={() => void op({ op: "practical-meta", practicalId: p.id, site }, "pr-site").then((c) => {
                  const np = c?.practicals.find((x) => x.id === p.id);
                  if (np) setSite(np.site);
                })}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[12.5px] font-semibold text-black hover:bg-[#ede4ff] disabled:opacity-50"
              >
                {busy === "pr-site" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Guardar
              </button>
            )}
          </div>
          {sub?.startedAt && site.trim() !== p.site && (
            <p className="mt-1.5 text-[11.5px] text-amber-200/80">O candidato já começou — mudar o site agora muda-o a meio da prova.</p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-white/[0.06] pt-4 text-[12px] sm:grid-cols-4">
            <Stamp label="Abriu" value={fmtWhen(sub?.openedAt ?? null)} />
            <Stamp label="Começou" value={fmtWhen(sub?.startedAt ?? null)} />
            <Stamp label="Entregou" value={fmtWhen(sub?.submittedAt ?? null)} />
            <Stamp
              label="Tempo"
              value={took === null ? "—" : `${fmtDuration(took)}${took > template.durationMin * 60_000 ? " ⚠︎" : ""}`}
              hint={`previsto: ${template.durationMin} min`}
            />
          </div>

          {!sub?.submittedAt && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-[12px] text-white/50">
              <span className="flex items-center gap-2">
                {stage === "em-curso" ? <span className="h-2 w-2 animate-pulse rounded-full bg-amber-300" /> : <Clock className="h-3.5 w-3.5" />}
                {stage === "em-curso" ? "Ao vivo — " : ""}atualiza a cada 15 s · última leitura {fmtWhen(lastPoll).slice(11)}
              </span>
              <button type="button" onClick={() => void poll()} className="inline-flex items-center gap-1 font-semibold text-white/65 hover:text-white">
                <RefreshCw className={`h-3.5 w-3.5 ${polling ? "animate-spin" : ""}`} />
                Atualizar
              </button>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2 text-[12px]">
            {!confirmNewLink ? (
              <button
                type="button"
                disabled={locked}
                onClick={() => setConfirmNewLink(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-1.5 font-semibold text-white/50 hover:border-white/30 hover:text-white disabled:opacity-40"
              >
                <Link2 className="h-3.5 w-3.5" />
                Gerar link novo
              </button>
            ) : (
              <span className="inline-flex flex-wrap items-center gap-2 rounded-full border border-amber-300/30 bg-amber-400/[0.06] px-3 py-1.5 text-amber-100/90">
                O link atual deixa de funcionar.
                <button
                  type="button"
                  disabled={busy === "pr-link"}
                  onClick={() => void op({ op: "practical-new-link", practicalId: p.id }, "pr-link").then(() => setConfirmNewLink(false))}
                  className="font-semibold text-white underline-offset-2 hover:underline"
                >
                  Gerar
                </button>
                <button type="button" onClick={() => setConfirmNewLink(false)} className="text-white/50 hover:text-white">
                  Cancelar
                </button>
              </span>
            )}
            {sub?.submittedAt && !locked && (
              <button
                type="button"
                disabled={busy === "pr-unlock"}
                onClick={() =>
                  void op({ op: "practical-unlock", practicalId: p.id }, "pr-unlock").then((c) => {
                    if (c) void poll();
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-1.5 font-semibold text-white/50 hover:border-white/30 hover:text-white"
                title="O candidato volta a poder mexer na entrega e entregar de novo."
              >
                <LockOpen className="h-3.5 w-3.5" />
                Deixar o candidato voltar a editar
              </button>
            )}
          </div>
        </div>

        {/* Nota */}
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">Nota da prática</p>
            <SaveHint state={saveState} />
          </div>
          <div className="mt-4 flex items-center gap-5">
            <ScoreRing value={score.final} size={112} />
            <div className="min-w-0 text-[12.5px] text-white/55">
              <p>
                Média dos pontos: <b className="text-white/85">{fmtScore(score.avg)}</b> ({score.scored}/{items.length} avaliados)
              </p>
              <p className="mt-2 text-[12px] font-semibold text-white/55">A minha nota</p>
              <ScorePicker value={review.overall} disabled={locked} onPick={(v) => edit((r) => ({ ...r, overall: v }))} size="sm" />
              <p className="mt-1 text-[11px] text-white/30">Quando escolhida, ganha à média.</p>
            </div>
          </div>
          <div className="mt-5 space-y-3 border-t border-white/[0.06] pt-4">
            {items.map((it) => (
              <ScoreBar key={it.id} label={`${it.code} · ${it.short}`} value={review.scores[it.id] ?? null} />
            ))}
          </div>
          {p.reviewer && (
            <p className="mt-4 text-[11.5px] text-white/35">
              Avaliada por {nameOf(p.reviewer)}
              {p.reviewedAt ? ` · fechada a ${fmtWhen(p.reviewedAt)}` : " · em curso"}
            </p>
          )}
        </div>
      </section>

      {/* Ponto a ponto */}
      <section className="mt-6 space-y-4">
        {template.sections.map((section) =>
          section.items.map((it, idx) => (
            <ItemReview
              key={it.id}
              item={it}
              sectionTitle={idx === 0 ? `${section.n}. ${section.title}` : null}
              lead={idx === 0 ? section.lead : undefined}
              site={section.n === 1 ? p.site : null}
              answers={a}
              score={review.scores[it.id] ?? null}
              note={review.notes[it.id] ?? ""}
              disabled={locked}
              onScore={(v) => edit((r) => ({ ...r, scores: { ...r.scores, [it.id]: v } }))}
              onNote={(v) => edit((r) => ({ ...r, notes: { ...r.notes, [it.id]: v } }))}
            />
          )),
        )}
      </section>

      {/* Fecho */}
      <section className="mt-6 rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">Notas finais</p>
        <textarea
          value={review.summary}
          disabled={locked}
          onChange={(e) => edit((r) => ({ ...r, summary: e.target.value }))}
          rows={4}
          className={`${inputCls} mt-3 leading-relaxed`}
          placeholder="O que fica desta prática"
        />
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px]">
          {!closed ? (
            <button
              type="button"
              disabled={busy === "pr-close" || locked}
              onClick={async () => {
                await flush();
                await op({ op: "practical-close", practicalId: p.id }, "pr-close");
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400 px-4 py-2 text-[12.5px] font-semibold text-black hover:bg-emerald-300 disabled:opacity-50"
            >
              {busy === "pr-close" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
              Fechar avaliação
            </button>
          ) : (
            !locked && (
              <button
                type="button"
                disabled={busy === "pr-reopen"}
                onClick={() => void op({ op: "practical-reopen", practicalId: p.id }, "pr-reopen")}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-1.5 font-semibold text-white/60 hover:border-white/30 hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reabrir avaliação
              </button>
            )
          )}
          {!locked &&
            (!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-1.5 font-semibold text-white/45 hover:border-rose-300/40 hover:text-rose-200"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Apagar esta fase
              </button>
            ) : (
              <span className="inline-flex flex-wrap items-center gap-2 rounded-full border border-rose-300/30 bg-rose-500/[0.07] px-3 py-1.5 text-rose-100/90">
                Apaga o link, a entrega e a avaliação.
                <button
                  type="button"
                  disabled={busy === "pr-del"}
                  onClick={() => void op({ op: "delete-practical", practicalId: p.id }, "pr-del")}
                  className="font-semibold text-white underline-offset-2 hover:underline"
                >
                  Apagar
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="text-white/50 hover:text-white">
                  Cancelar
                </button>
              </span>
            ))}
        </div>
      </section>
    </div>
  );
}

// ── peças ─────────────────────────────────────────────────────────────────

function Stamp({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/30">{label}</p>
      <p className="mt-0.5 tabular-nums text-white/75">{value}</p>
      {hint && <p className="text-[10.5px] text-white/30">{hint}</p>}
    </div>
  );
}

function SaveHint({ state }: { state: "idle" | "dirty" | "saving" | "saved" | "error" }) {
  if (state === "idle") return null;
  const label = { dirty: "Por guardar", saving: "A guardar…", saved: "Guardado", error: "Erro — a tentar outra vez" }[state];
  return <span className={`text-[11px] ${state === "error" ? "text-rose-300" : "text-white/40"}`}>{label}</span>;
}

function ScorePicker({
  value,
  onPick,
  disabled,
  size = "md",
}: {
  value: number | null;
  onPick: (v: number | null) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-7 w-7 text-[11.5px]" : "h-8 w-8 text-[12.5px]";
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {Array.from({ length: 11 }, (_, n) => {
        const on = value === n;
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onPick(on ? null : n)}
            aria-pressed={on}
            className={`${dim} rounded-full border font-bold tabular-nums transition disabled:opacity-50 ${
              on ? "text-black" : "border-white/10 text-white/50 hover:border-white/30 hover:text-white"
            }`}
            style={on ? { background: scoreColor(n), borderColor: scoreColor(n) } : undefined}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

function DarkBlocks({ blocks, showCode }: { blocks: PracticalTextBlock[]; showCode: boolean }) {
  return (
    <div className="space-y-2 text-[13px] leading-relaxed text-white/60">
      {blocks.map((b, i) => {
        if (b.kind === "p") return <p key={i}>{b.text}</p>;
        if (b.kind === "note") return <p key={i} className="text-white/40">{b.text}</p>;
        if (b.kind === "bullets")
          return (
            <ul key={i} className="list-disc space-y-0.5 pl-5">
              {b.items.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          );
        return (
          <div key={i}>
            <p>{b.lead}</p>
            {showCode && (
              <pre className="mt-2 overflow-x-auto rounded-xl border border-white/[0.08] bg-black/40 p-3 text-[11.5px] leading-[1.55] text-white/75">
                <code>{b.code}</code>
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}

const Empty = () => <p className="text-[12.5px] italic text-white/30">— sem resposta —</p>;

function Text({ value }: { value: string }) {
  if (!value.trim()) return <Empty />;
  return <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-white/85">{value}</p>;
}

function AnswerHead({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white/35">{children}</p>;
}

function ItemReview({
  item,
  sectionTitle,
  lead,
  site,
  answers: a,
  score,
  note,
  disabled,
  onScore,
  onNote,
}: {
  item: PracticalItem;
  sectionTitle: string | null;
  lead?: PracticalTextBlock[];
  site: string | null;
  answers: PracticalAnswers | null;
  score: number | null;
  note: string;
  disabled: boolean;
  onScore: (v: number | null) => void;
  onNote: (v: string) => void;
}) {
  const [brief, setBrief] = useState(false);
  const hasCode = item.body.some((b) => b.kind === "code");
  return (
    <article className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
      {sectionTitle && <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#c4a6ff]/70">{sectionTitle}</p>}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[16px] font-semibold text-white">
          {item.code} · {item.short}
        </h3>
        <button
          type="button"
          onClick={() => setBrief((v) => !v)}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-white/45 hover:text-white"
        >
          {brief ? "Esconder enunciado" : hasCode ? "Ver enunciado e snippet" : "Ver enunciado"}
          <ChevronDown className={`h-3.5 w-3.5 transition ${brief ? "rotate-180" : ""}`} />
        </button>
      </div>
      {brief && (
        <div className="mt-3 rounded-2xl border border-white/[0.06] bg-black/20 p-4">
          {site && (
            <p className="mb-2 text-[13px] text-white/60">
              <b className="italic">Site:</b>{" "}
              <a href={site} target="_blank" rel="noopener noreferrer" className="text-[#c4a6ff] hover:underline">
                {site}
              </a>
            </p>
          )}
          {lead && (
            <div className="mb-2">
              <DarkBlocks blocks={lead} showCode />
            </div>
          )}
          <DarkBlocks blocks={item.body} showCode />
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">{a ? <AnswerView item={item.id} a={a} /> : <Empty />}</div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5">
          <div className="flex items-baseline justify-between">
            <p className="text-[12px] font-semibold text-white/55">Nota</p>
            <span className="tabular-nums text-[15px] font-bold" style={{ color: scoreColor(score) }}>
              {fmtScore(score)}
              <span className="ml-0.5 text-[10.5px] font-medium text-white/30">/10</span>
            </span>
          </div>
          <ScorePicker value={score} onPick={onScore} disabled={disabled} size="sm" />
          <textarea
            value={note}
            disabled={disabled}
            onChange={(e) => onNote(e.target.value)}
            rows={3}
            placeholder="Notas"
            className={`${inputCls} mt-3 text-[12.5px] leading-relaxed`}
          />
        </div>
      </div>
    </article>
  );
}

function AnswerView({ item, a }: { item: PracticalItemId; a: PracticalAnswers }) {
  switch (item) {
    case "audit": {
      const looms = a.looms.filter((l) => l.trim());
      return (
        <div className="space-y-4">
          <div>
            <AnswerHead>Vídeos ({looms.length})</AnswerHead>
            {looms.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {looms.map((l, i) => {
                  const embed = loomEmbed(l);
                  return (
                    <div key={i} className="min-w-0">
                      {embed && (
                        <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-black" style={{ aspectRatio: "16 / 9" }}>
                          <iframe src={embed} title={`Vídeo ${i + 1}`} allowFullScreen className="absolute inset-0 h-full w-full" />
                        </div>
                      )}
                      <a
                        href={/^https?:\/\//i.test(l) ? l : `https://${l}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 flex items-center gap-1.5 truncate text-[12px] text-[#c4a6ff] hover:underline"
                      >
                        <Video className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{l}</span>
                      </a>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty />
            )}
          </div>
          {a.auditNotes.trim() && (
            <div>
              <AnswerHead>Notas</AnswerHead>
              <Text value={a.auditNotes} />
            </div>
          )}
        </div>
      );
    }
    case "priorities":
      return (
        <div className="space-y-3">
          {a.prioritiesFile ? (
            <>
              <a
                href={a.prioritiesFile.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-[12.5px] text-white/80 hover:border-white/25"
              >
                <FileText className="h-4 w-4 text-[#c4a6ff]" />
                {a.prioritiesFile.name}
                <span className="text-white/35">· {fmtBytes(a.prioritiesFile.size)}</span>
                <ExternalLink className="h-3.5 w-3.5 text-white/40" />
              </a>
              <object data={a.prioritiesFile.url} type="application/pdf" className="h-[620px] w-full rounded-xl border border-white/[0.08] bg-white">
                <p className="p-4 text-[12.5px] text-black/60">O browser não mostra o PDF aqui — abre-o pelo link acima.</p>
              </object>
            </>
          ) : (
            <Empty />
          )}
          {a.prioritiesNote.trim() && (
            <div>
              <AnswerHead>Nota</AnswerHead>
              <Text value={a.prioritiesNote} />
            </div>
          )}
        </div>
      );
    case "fix":
      return <Text value={a.fix} />;
    case "keywords": {
      const rows = a.keywords.filter((k) => k.kw.trim());
      const premium = rows.filter((k) => k.premium).length;
      return (
        <div className="space-y-4">
          <div>
            <AnswerHead>
              {rows.length} keywords · {premium} premium
            </AnswerHead>
            {rows.length ? (
              <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
                <table className="w-full min-w-[420px] text-left text-[12.5px]">
                  <thead className="bg-white/[0.03] text-[10.5px] uppercase tracking-[0.1em] text-white/40">
                    <tr>
                      <th className="px-3 py-2 font-semibold">#</th>
                      <th className="px-3 py-2 font-semibold">Keyword</th>
                      <th className="px-3 py-2 text-right font-semibold">Volume</th>
                      <th className="px-3 py-2 text-right font-semibold">Posição</th>
                      <th className="px-3 py-2 text-center font-semibold">Premium</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {rows.map((k, i) => (
                      <tr key={i} className={k.premium ? "bg-amber-400/[0.06]" : undefined}>
                        <td className="px-3 py-1.5 tabular-nums text-white/35">{i + 1}</td>
                        <td className="px-3 py-1.5 text-white/85">{k.kw}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-white/60">{k.volume || "—"}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-white/60">{k.position || "—"}</td>
                        <td className="px-3 py-1.5 text-center">
                          {k.premium ? <Star className="mx-auto h-3.5 w-3.5 text-amber-300" fill="currentColor" /> : <span className="text-white/20">·</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty />
            )}
          </div>
          <div>
            <AnswerHead>Critério das premium</AnswerHead>
            <Text value={a.premiumCriteria} />
          </div>
        </div>
      );
    }
    case "roadmap":
      return (
        <div className="grid gap-3 md:grid-cols-3">
          {a.roadmap.map((m, i) => (
            <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5">
              <p className="text-[13px] font-semibold text-white">Mês {i + 1}</p>
              <div className="mt-2">
                <AnswerHead>Focos</AnswerHead>
                <Text value={m.focus} />
              </div>
              <div className="mt-3">
                <AnswerHead>Entregáveis</AnswerHead>
                <Text value={m.deliverables} />
              </div>
            </div>
          ))}
        </div>
      );
    case "code": {
      const list = a.codeIssues.map((c, i) => ({ ...c, n: i + 1 })).filter((c) => c.text.trim());
      const groups = [
        ...IMPACTS.map((imp) => ({ id: imp.id as string, label: imp.label, rows: list.filter((c) => c.impact === imp.id) })),
        { id: "", label: "Sem impacto marcado", rows: list.filter((c) => !c.impact) },
      ].filter((g) => g.rows.length);
      const tone: Record<string, string> = {
        critico: "text-rose-300",
        medio: "text-amber-300",
        baixo: "text-sky-300",
        "": "text-white/40",
      };
      return (
        <div className="space-y-4">
          <div>
            <AnswerHead>{list.length} problemas</AnswerHead>
            {groups.length ? (
              <div className="space-y-3">
                {groups.map((g) => (
                  <div key={g.id || "none"}>
                    <p className={`text-[12px] font-bold ${tone[g.id]}`}>
                      {g.label} ({g.rows.length})
                    </p>
                    <ul className="mt-1 space-y-1">
                      {g.rows.map((c) => (
                        <li key={c.n} className="flex gap-2 text-[13px] text-white/85">
                          <span className="w-5 shrink-0 text-right tabular-nums text-white/30">{c.n}.</span>
                          <span>{c.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <Empty />
            )}
          </div>
          <div>
            <AnswerHead>Como corrigiria os críticos</AnswerHead>
            <Text value={a.codeFix} />
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}
