"use client";

// Recrutamento (v80.13) — a ficha do candidato: a grade D–A, as notas de cada
// pergunta, o fecho do entrevistador, as fases e a decisão. Aceitar pede a
// frase «confirmar e aceitar» e cria a conta na app (SEO DPT).

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Ban,
  Briefcase,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Euro,
  ExternalLink,
  Flag,
  GraduationCap,
  Heart,
  KeyRound,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Mic,
  PenLine,
  Phone,
  Plus,
  Quote,
  RotateCcw,
  StickyNote,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Undo2,
  UserCheck,
  X,
} from "lucide-react";
import { ADVANCE_META, fmtScore, isScored, questionScore, summarize } from "@/lib/recrutamento/scoring";
import {
  ACCEPT_PHRASE,
  fmtEuros,
  headlineInterview,
  normalizePhrase,
  shortName,
  stageOf,
  suggestUsername,
  USERNAME_RE,
  type Candidate,
  type Interview,
} from "@/lib/recrutamento/shared";
import { getTemplate, INTERVIEW_TEMPLATES, isScreening, type InterviewTemplate } from "@/lib/recrutamento/templates";
import {
  getPracticalTemplate,
  PRACTICAL_TEMPLATES,
  practicalScore,
  practicalStage,
  type PracticalSubmission,
} from "@/lib/recrutamento/practical";
import { PracticalReviewPanel } from "./practical-review";
import { accessMessage } from "@/lib/access/shared";
import { Field, inputCls, Modal } from "./hub";
import { GradeBadge, GradeMatrix, Initials, scoreColor, ScoreBar, StageChip, TONE } from "./ui";

function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtWhen(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("en-GB", {
    timeZone: "Europe/Lisbon",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function duration(i: Interview): string | null {
  if (!i.startedAt || !i.finishedAt) return null;
  const min = Math.round((i.finishedAt - i.startedAt) / 60000);
  return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`;
}

type Accepted = { username: string; password: string | null; name: string; fullName: string };

export function CandidateFile({
  initial,
  canSeeAccess,
  names,
  subs = {},
}: {
  initial: Candidate;
  /** O que o candidato já escreveu em cada prática (v80.16), por id. */
  subs?: Record<string, PracticalSubmission>;
  /** Quem está a ver abre /admin/acessos (só o André). */
  canSeeAccess: boolean;
  /** username → nome de quem entrevistou/decidiu. */
  names: Record<string, string>;
}) {
  const router = useRouter();
  const [c, setC] = useState<Candidate>(initial);
  const head = headlineInterview(c);
  const [selected, setSelected] = useState<string | null>(head?.id ?? c.practicals[c.practicals.length - 1]?.id ?? null);
  // Uma prática selecionada (v80.16) toma o lugar do resumo da entrevista.
  const practical = c.practicals.find((p) => p.id === selected) ?? null;
  const interview = practical ? null : (c.interviews.find((i) => i.id === selected) ?? head);
  const template = interview ? getTemplate(interview.templateId) : null;
  const sum = useMemo(
    () => (interview && template ? summarize(template, interview.answers, interview.closing) : null),
    [interview, template],
  );
  const stage = stageOf(c);
  // «Nova fase» sugere a primeira fase do processo que o candidato ainda não
  // tem (Fase 1 → Fase 2 · Parte 1 → prática), v80.22.
  const nextPhase = useMemo(() => {
    const have = new Set([...c.interviews.map((i) => i.templateId), ...c.practicals.map((p) => `pratica:${p.templateId}`)]);
    const order = [...INTERVIEW_TEMPLATES.map((t) => t.id), ...PRACTICAL_TEMPLATES.map((t) => `pratica:${t.id}`)];
    return order.find((id) => !have.has(id)) ?? order[0] ?? "";
  }, [c.interviews, c.practicals]);
  const [modal, setModal] = useState<null | "accept" | "reject" | "delete" | "edit" | "phase">(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<Accepted | null>(null);

  async function op(body: Record<string, unknown>, key: string): Promise<Candidate | null> {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(`/api/admin/recrutamento/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { candidate?: Candidate; error?: string };
      if (!res.ok || !json.candidate) throw new Error(json.error || "Não foi possível guardar.");
      setC(json.candidate);
      return json.candidate;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível guardar.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  const nameOf = (u: string | null | undefined) => (u ? names[u] ?? u : "—");
  const runHref = (i: Interview) => `/admin/recrutamento/${c.id}/entrevista/${i.id}`;

  return (
    <>
      {/* Cabeçalho */}
      <header className="animate-fade-up mt-2 flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 items-center gap-4">
          <Initials name={c.name} size={64} />
          <div className="min-w-0">
            <p className="readout text-amber-200/60">Recrutamento · ficha do candidato</p>
            <h1 className="mt-1 truncate text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">{c.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-white/50">
              <StageChip stage={stage} />
              <span>{c.role}</span>
              {c.source && <span>· {c.source}</span>}
              <span>· criado a {fmtWhen(c.createdAt).slice(0, 10)}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setModal("edit")}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3.5 py-2 text-[12.5px] font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
          >
            <PenLine className="h-3.5 w-3.5" />
            Editar
          </button>
          {interview && c.status !== "aceite" && (
            <Link
              href={runHref(interview)}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12.5px] font-semibold text-black shadow-[0_10px_40px_-12px_rgba(196,166,255,0.8)] transition hover:bg-[#ede4ff]"
            >
              <Mic className="h-4 w-4" />
              {interview.finishedAt ? "Rever entrevista" : interview.startedAt ? "Continuar entrevista" : "Começar entrevista"}
            </Link>
          )}
        </div>
      </header>

      {error && (
        <p className="mt-5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-[12.5px] text-rose-100">{error}</p>
      )}

      {accepted && <AcceptedBanner accepted={accepted} canSeeAccess={canSeeAccess} onClose={() => setAccepted(null)} />}
      {!accepted && c.status === "aceite" && c.decision && (
        <div className="animate-fade-up mt-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-emerald-300/30 bg-emerald-400/[0.07] px-5 py-4">
          <p className="flex items-center gap-2 text-[13px] text-emerald-100">
            <UserCheck className="h-4 w-4 text-emerald-300" />
            Aceite a {fmtWhen(c.decision.at)} por {nameOf(c.decision.by)}. Conta na app: <b>{c.decision.username}</b>
            {c.decision.startDate ? ` · entra a ${fmtDay(c.decision.startDate)}` : ""}.
          </p>
          <div className="flex gap-2">
            <Link href="/seo" className="inline-flex items-center gap-1 rounded-full border border-emerald-300/30 px-3 py-1.5 text-[12px] font-semibold text-emerald-100 hover:bg-emerald-400/10">
              Ver no SEO DPT <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            {canSeeAccess && (
              <Link href="/admin/acessos" className="inline-flex items-center gap-1 rounded-full border border-emerald-300/30 px-3 py-1.5 text-[12px] font-semibold text-emerald-100 hover:bg-emerald-400/10">
                <KeyRound className="h-3.5 w-3.5" /> Acessos
              </Link>
            )}
          </div>
        </div>
      )}
      {c.status === "recusado" && c.decision && (
        <div className="animate-fade-up mt-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-rose-300/25 bg-rose-500/[0.06] px-5 py-4">
          <p className="flex items-center gap-2 text-[13px] text-rose-100/90">
            <Ban className="h-4 w-4 text-rose-300" />
            Recusado a {fmtWhen(c.decision.at)} por {nameOf(c.decision.by)}
            {c.decision.note ? ` — ${c.decision.note}` : "."}
          </p>
          <button
            type="button"
            disabled={busy === "undo"}
            onClick={() => void op({ op: "undo-reject" }, "undo")}
            className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-[12px] font-semibold text-white/70 hover:border-white/30"
          >
            <Undo2 className="h-3.5 w-3.5" /> Voltar ao processo
          </button>
        </div>
      )}

      {/* Perfil: contactos, zona, valor pretendido, gostos, formações,
          experiências e anotações (v80.13, pedido do André). */}
      <ProfileSection candidate={c} onPatch={(patch, key) => op({ op: "profile", patch }, key)} busyKey={busy} />

      {/* Fases */}
      {(c.interviews.length > 0 || c.practicals.length > 0) && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {c.interviews.map((i) => {
            const t = getTemplate(i.templateId);
            const on = interview?.id === i.id;
            return (
              <button
                key={i.id}
                type="button"
                onClick={() => setSelected(i.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                  on ? "border-white/30 bg-white/[0.08] text-white" : "border-white/10 text-white/50 hover:text-white/80"
                }`}
              >
                {i.finishedAt ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> : <Clock className="h-3.5 w-3.5 text-amber-300/80" />}
                {t ? t.phase : "Entrevista"}
                {i.date && <span className="font-normal text-white/40">{fmtDay(i.date)}</span>}
              </button>
            );
          })}
          {c.practicals.map((p) => {
            const t = getPracticalTemplate(p.templateId);
            const on = practical?.id === p.id;
            const st = practicalStage(p, subs[p.id] ?? null);
            const sc = practicalScore(p.review).final;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                  on ? "border-white/30 bg-white/[0.08] text-white" : "border-white/10 text-white/50 hover:text-white/80"
                }`}
              >
                {st === "avaliada" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                ) : st === "entregue" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-violet-300" />
                ) : (
                  <Clock className="h-3.5 w-3.5 text-amber-300/80" />
                )}
                {t ? t.phase : "Prática"} · prática
                {sc !== null ? (
                  <span className="font-normal tabular-nums" style={{ color: scoreColor(sc) }}>
                    {fmtScore(sc)}
                  </span>
                ) : (
                  p.date && <span className="font-normal text-white/40">{fmtDay(p.date)}</span>
                )}
              </button>
            );
          })}
          {c.status !== "aceite" && (
            <button
              type="button"
              onClick={() => setModal("phase")}
              className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-white/15 px-3 py-1.5 text-[12px] font-semibold text-white/50 transition hover:border-white/35 hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova fase
            </button>
          )}
        </div>
      )}

      {practical ? (
        <>
          <PracticalReviewPanel
            key={practical.id}
            candidate={c}
            practical={practical}
            initialSub={subs[practical.id] ?? null}
            op={op}
            busy={busy}
            onCandidate={setC}
            nameOf={nameOf}
          />
        </>
      ) : interview && template && sum ? (
        <>
          {isScreening(template) ? (
            <ScreeningSummary
              interview={interview}
              interviewer={nameOf(interview.interviewer)}
              answered={template.questions.filter((q) => interview.answers[q.id]?.notes.trim()).length}
              total={template.questions.length}
              canAdvance={c.status === "pipeline" && nextPhase !== "" && nextPhase !== interview.templateId}
              canReject={c.status === "pipeline"}
              onNewPhase={() => setModal("phase")}
              onReject={() => setModal("reject")}
            />
          ) : (
          <>
          {/* Resumo: grade + eixos + matriz */}
          <section className="animate-fade-up mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[340px_minmax(0,1fr)_minmax(0,1.1fr)]">
            <GradeCard sum={sum} finished={Boolean(interview.finishedAt)} closingNext={interview.closing.nextStep} />
            <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">Por bloco</p>
              <div className="mt-4 space-y-4">
                <ScoreBar label="Média Hard Skills" value={sum.hard} />
                <ScoreBar label="Coachability" value={sum.coach} />
                <ScoreBar label="Média Soft Skills" value={sum.soft} />
                <ScoreBar label="Atenção ao detalhe" value={sum.detail} />
                <ScoreBar label="Perguntas do candidato" value={sum.questions} />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-4 text-[11.5px] text-white/45">
                <span>
                  <Mic className="mr-1 inline h-3 w-3" />
                  {nameOf(interview.interviewer)}
                </span>
                <span className="text-right">{duration(interview) ?? (interview.startedAt ? "Em curso" : "Por começar")}</span>
                <span>
                  {sum.scored}/{sum.total} pontuadas
                </span>
                <span className="text-right">{interview.finishedAt ? fmtWhen(interview.finishedAt) : fmtDay(interview.date)}</span>
              </div>
            </div>
            <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
              <GradeMatrix fit={sum.fit} tech={sum.tech} compact />
            </div>
          </section>

          {/* Fecho do entrevistador */}
          <ClosingSection interview={interview} />
          </>
          )}

          {/* Pergunta a pergunta */}
          <QuestionsSection template={template} interview={interview} />

          {/* Ações da fase */}
          <div className="mt-6 flex flex-wrap items-center gap-2 text-[12px]">
            {interview.finishedAt && c.status !== "aceite" && (
              <button
                type="button"
                disabled={busy === "reopen"}
                onClick={() => void op({ op: "reopen", interviewId: interview.id }, "reopen")}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-1.5 font-semibold text-white/60 hover:border-white/30 hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reabrir esta fase
              </button>
            )}
            {c.interviews.length > 1 && c.status !== "aceite" && (
              <button
                type="button"
                disabled={busy === "del-phase"}
                onClick={() => {
                  void op({ op: "delete-interview", interviewId: interview.id }, "del-phase").then((n) => n && setSelected(headlineInterview(n)?.id ?? null));
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-1.5 font-semibold text-white/45 hover:border-rose-300/40 hover:text-rose-200"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Apagar esta fase
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="mt-8 text-[13px] text-white/45">Este candidato ainda não tem entrevista.</p>
      )}

      {/* Decisão */}
      <section className="mt-8">
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">Decisão</p>
          {c.status === "pipeline" ? (
            <>
              <p className="mt-3 text-[13px] leading-relaxed text-white/60">
                Ao aceitar, a pessoa ganha login na app, entra na equipa do C-Suite e aparece no SEO DPT com uma coluna sua,
                pronta para receber clientes.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setModal("accept")}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-2 text-[13px] font-semibold text-black shadow-[0_14px_44px_-14px_rgba(52,211,153,0.8)] transition hover:bg-emerald-300"
                >
                  <UserCheck className="h-4 w-4" />
                  Aceitar
                </button>
                <button
                  type="button"
                  onClick={() => setModal("reject")}
                  className="inline-flex items-center gap-2 rounded-full border border-rose-300/30 px-4 py-2 text-[13px] font-semibold text-rose-200/90 transition hover:bg-rose-500/10"
                >
                  <Ban className="h-4 w-4" />
                  Recusar
                </button>
              </div>
            </>
          ) : (
            <p className="mt-3 text-[13px] text-white/55">
              {c.status === "aceite" ? "Aceite — a conta já existe na app." : "Recusado."}
            </p>
          )}
          {c.status !== "aceite" && (
            <button
              type="button"
              onClick={() => setModal("delete")}
              className="mt-6 inline-flex items-center gap-1.5 text-[11.5px] text-white/30 transition hover:text-rose-200"
            >
              <Trash2 className="h-3 w-3" />
              Apagar candidato
            </button>
          )}
        </div>
      </section>

      {modal === "accept" && (
        <AcceptModal
          candidate={c}
          onClose={() => setModal(null)}
          onDone={(cand, acc) => {
            setC(cand);
            setAccepted(acc);
            setModal(null);
            router.refresh();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
      {modal === "reject" && (
        <RejectModal
          busy={busy === "reject"}
          onClose={() => setModal(null)}
          onConfirm={async (note) => {
            const n = await op({ op: "reject", note }, "reject");
            if (n) setModal(null);
          }}
        />
      )}
      {modal === "delete" && (
        <DeleteModal
          name={c.name}
          onClose={() => setModal(null)}
          onDone={() => {
            router.push("/admin/recrutamento");
            router.refresh();
          }}
          id={c.id}
        />
      )}
      {modal === "edit" && (
        <EditModal
          candidate={c}
          busy={busy === "edit"}
          onClose={() => setModal(null)}
          onSave={async (patch) => {
            const n = await op({ op: "profile", patch }, "edit");
            if (n) setModal(null);
          }}
        />
      )}
      {modal === "phase" && (
        <PhaseModal
          initialChoice={nextPhase}
          busy={busy === "phase"}
          onClose={() => setModal(null)}
          error={error}
          onCreate={async (choice, date, site) => {
            if (choice.startsWith("pratica:")) {
              const n = await op({ op: "new-practical", site, date }, "phase");
              if (n) {
                setModal(null);
                const last = n.practicals[n.practicals.length - 1];
                if (last) setSelected(last.id);
                router.refresh();
              }
              return;
            }
            const n = await op({ op: "new-interview", templateId: choice, date }, "phase");
            if (n) {
              setModal(null);
              const last = n.interviews[n.interviews.length - 1];
              if (last) setSelected(last.id);
            }
          }}
        />
      )}
    </>
  );
}

function Contact({
  icon,
  value,
  href,
  external,
  placeholder,
}: {
  icon: ReactNode;
  value: string;
  href?: string;
  external?: boolean;
  placeholder?: string;
}) {
  return (
    <li className="flex items-center gap-2">
      <span className="text-white/35">{icon}</span>
      {value ? (
        href ? (
          <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className="truncate hover:text-white hover:underline">
            {value}
            {external && <ExternalLink className="ml-1 inline h-3 w-3 text-white/30" />}
          </a>
        ) : (
          <span className="truncate">{value}</span>
        )
      ) : (
        <span className="text-white/25">{placeholder ?? "—"}</span>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------

type PatchFn = (patch: Record<string, unknown>, key: string) => Promise<Candidate | null>;

function ProfileSection({ candidate: c, onPatch, busyKey }: { candidate: Candidate; onPatch: PatchFn; busyKey: string | null }) {
  return (
    <section className="animate-fade-up mt-6">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">Perfil</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
            <ul className="space-y-2 text-[13px] text-white/70">
              <Contact icon={<Mail className="h-3.5 w-3.5" />} value={c.email} href={c.email ? `mailto:${c.email}` : undefined} />
              <Contact icon={<Phone className="h-3.5 w-3.5" />} value={c.phone} href={c.phone ? `tel:${c.phone.replace(/\s+/g, "")}` : undefined} />
              <Contact
                icon={<Link2 className="h-3.5 w-3.5" />}
                value={c.linkedin}
                href={c.linkedin ? (c.linkedin.startsWith("http") ? c.linkedin : `https://${c.linkedin}`) : undefined}
                external
              />
              <Contact icon={<MapPin className="h-3.5 w-3.5" />} value={c.location} placeholder="Zona onde vive por preencher" />
            </ul>
          </div>
          <SalaryCard candidate={c} onPatch={onPatch} busy={busyKey === "salary"} />
        </div>
        <EditableText
          title="Focos e gostos pessoais"
          icon={<Heart className="h-3.5 w-3.5 text-pink-300" />}
          value={c.interests}
          placeholder="Hobbies, o que lhe dá energia, temas de que fala com entusiasmo…"
          onSave={(v) => onPatch({ interests: v }, "interests")}
          busy={busyKey === "interests"}
        />
        <NotesCard candidate={c} onPatch={onPatch} />
        <EditableText
          title="Formações"
          icon={<GraduationCap className="h-3.5 w-3.5 text-sky-300" />}
          value={c.education}
          placeholder={"Uma por linha. Ex.:\nLicenciatura em Marketing (2019)\nCurso de SEO técnico (2023)"}
          onSave={(v) => onPatch({ education: v }, "education")}
          busy={busyKey === "education"}
          timeline
        />
        <div className="lg:col-span-2">
          <EditableText
            title="Experiências passadas"
            icon={<Briefcase className="h-3.5 w-3.5 text-amber-300" />}
            value={c.experience}
            placeholder={"Uma por linha. Ex.:\nSEO numa agência (2022–2025): 12 clientes, e-commerce e saúde"}
            onSave={(v) => onPatch({ experience: v }, "experience")}
            busy={busyKey === "experience"}
            timeline
          />
        </div>
      </div>
    </section>
  );
}

function SalaryCard({ candidate: c, onPatch, busy }: { candidate: Candidate; onPatch: PatchFn; busy: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(c.salaryMonthly === null ? "" : String(c.salaryMonthly));
  const [note, setNote] = useState(c.salaryNote);
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-[radial-gradient(120%_120%_at_100%_0%,rgba(52,211,153,0.1),transparent_60%)] p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-white/60">
          <Euro className="h-3.5 w-3.5 text-emerald-300" />
          Valor mensal pretendido
        </p>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="rounded-full p-1 text-white/30 hover:bg-white/[0.06] hover:text-white" aria-label="Editar valor">
            <PenLine className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} inputMode="numeric" placeholder="1.300" className={`${inputCls} w-32`} />
            <span className="text-[13px] text-white/45">€ / mês</span>
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="bruto ou líquido, negociável, intervalo…" className={inputCls} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="rounded-full px-3 py-1.5 text-[12px] text-white/50 hover:text-white">
              Cancelar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                const n = await onPatch({ salaryMonthly: value, salaryNote: note }, "salary");
                if (n) setEditing(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-black hover:bg-[#ede4ff] disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3 w-3 animate-spin" />}
              Guardar
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className={`mt-2 text-[28px] font-black tabular-nums ${c.salaryMonthly === null ? "text-white/20" : "text-emerald-200"}`}>
            {fmtEuros(c.salaryMonthly)}
            {c.salaryMonthly !== null && <span className="ml-1 text-[13px] font-semibold text-white/35">/ mês</span>}
          </p>
          {c.salaryNote && <p className="text-[12px] text-white/50">{c.salaryNote}</p>}
        </>
      )}
    </div>
  );
}

function EditableText({
  title,
  icon,
  value,
  placeholder,
  onSave,
  busy,
  timeline,
}: {
  title: string;
  icon: ReactNode;
  value: string;
  placeholder: string;
  onSave: (v: string) => Promise<Candidate | null>;
  busy: boolean;
  timeline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const lines = value.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <div className="flex h-full flex-col rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-white/60">
          {icon}
          {title}
        </p>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(value);
              setEditing(true);
            }}
            className="rounded-full p-1 text-white/30 hover:bg-white/[0.06] hover:text-white"
            aria-label={`Editar ${title}`}
          >
            <PenLine className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="mt-3 flex flex-1 flex-col gap-2">
          <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} placeholder={placeholder} className={`${inputCls} flex-1 resize-y leading-relaxed`} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="rounded-full px-3 py-1.5 text-[12px] text-white/50 hover:text-white">
              Cancelar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                const n = await onSave(draft);
                if (n) setEditing(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-black hover:bg-[#ede4ff] disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3 w-3 animate-spin" />}
              Guardar
            </button>
          </div>
        </div>
      ) : lines.length === 0 ? (
        <button
          type="button"
          onClick={() => {
            setDraft("");
            setEditing(true);
          }}
          className="mt-3 flex-1 rounded-2xl border border-dashed border-white/10 px-4 py-5 text-left text-[12px] text-white/30 transition hover:border-white/25 hover:text-white/60"
        >
          <Plus className="mr-1 inline h-3 w-3" />
          Adicionar
        </button>
      ) : timeline ? (
        <ol className="relative mt-3 space-y-2.5 border-l border-white/10 pl-4">
          {lines.map((l, i) => (
            <li key={i} className="relative text-[13px] leading-snug text-white/80">
              <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b0b12] bg-white/40" />
              {l}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-white/75">{value}</p>
      )}
    </div>
  );
}

/** Anotações livres — gravam sozinhas, 900 ms depois da última tecla e ao sair. */
function NotesCard({ candidate: c, onPatch }: { candidate: Candidate; onPatch: PatchFn }) {
  const [text, setText] = useState(c.notes);
  const [state, setState] = useState<"idle" | "dirty" | "saving" | "saved">("idle");
  const timer = useRef<number | null>(null);
  const latest = useRef(c.notes);
  const saved = useRef(c.notes);

  const flush = useCallback(
    async (keepalive = false) => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      const v = latest.current;
      if (v === saved.current) return;
      saved.current = v;
      if (keepalive) {
        void fetch(`/api/admin/recrutamento/${c.id}`, {
          method: "PATCH",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: "profile", patch: { notes: v } }),
        }).catch(() => {});
        return;
      }
      setState("saving");
      const n = await onPatch({ notes: v }, "notes");
      setState(n ? "saved" : "dirty");
      if (!n) saved.current = "";
    },
    [c.id, onPatch],
  );

  useEffect(() => {
    const onHide = () => void flush(true);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      void flush(true);
    };
  }, [flush]);

  return (
    <div className="flex h-full flex-col rounded-3xl border border-[#c4a6ff]/20 bg-[#783DF5]/[0.05] p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-white/70">
          <StickyNote className="h-3.5 w-3.5 text-[#c4a6ff]" />
          Anotações
        </p>
        <span className="text-[10.5px] text-white/35">
          {state === "saving" ? "A gravar…" : state === "saved" ? "Guardado" : state === "dirty" ? "Por gravar…" : "Grava sozinho"}
        </span>
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          latest.current = e.target.value;
          setState("dirty");
          if (timer.current) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => void flush(), 900);
        }}
        onBlur={() => void flush()}
        rows={7}
        placeholder="Tudo o que queres lembrar: impressões, combinado na call, referências…"
        className="mt-3 w-full flex-1 resize-y rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-[13px] leading-relaxed text-white placeholder:text-white/25 focus:border-[#c4a6ff]/50 focus:outline-none"
      />
    </div>
  );
}

function GradeCard({ sum, finished, closingNext }: { sum: ReturnType<typeof summarize>; finished: boolean; closingNext: string }) {
  const cell = sum.cell;
  const t = cell ? TONE[cell.tone] : null;
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border p-5 ${t ? t.border : "border-white/[0.08]"}`}
      style={t ? { background: `radial-gradient(120% 100% at 0% 0%, ${t.glow}, transparent 62%)` } : undefined}
    >
      <div className="flex items-center gap-4">
        <GradeBadge cell={cell} size="lg" />
        <div className="min-w-0">
          <p className={`text-[20px] font-bold ${t ? t.text : "text-white/50"}`}>{cell ? cell.grade : "Sem grade"}</p>
          <p className="text-[12px] leading-snug text-white/55">{cell ? cell.line : "A grade aparece com notas de Fit e de Técnica."}</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <AxisMini label="Fit Cultural" value={sum.fit} calc={sum.fitCalc} />
        <AxisMini label="Técnica" value={sum.tech} calc={sum.techCalc} />
      </div>
      {cell && (
        <p className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-semibold ${t!.bg} ${t!.text}`}>
          → {cell.decision}
        </p>
      )}
      {closingNext && <p className="mt-3 text-[12px] text-white/60">Próximo passo: {closingNext}</p>}
      {!finished && <p className="mt-3 text-[11px] text-amber-200/70">Entrevista ainda não terminada: a grade pode mudar.</p>}
    </div>
  );
}

/** Fase 1 (v80.22): sem grade — a decisão «avança para a Fase 2?» e o porquê. */
function ScreeningSummary({
  interview,
  interviewer,
  answered,
  total,
  canAdvance,
  canReject,
  onNewPhase,
  onReject,
}: {
  interview: Interview;
  interviewer: string;
  answered: number;
  total: number;
  canAdvance: boolean;
  canReject: boolean;
  onNewPhase: () => void;
  onReject: () => void;
}) {
  const cl = interview.closing;
  const m = cl.advance ? ADVANCE_META[cl.advance] : null;
  const t = m ? TONE[m.tone] : null;
  return (
    <section className="animate-fade-up mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div
        className={`relative overflow-hidden rounded-3xl border p-5 ${t ? t.border : "border-white/[0.08]"}`}
        style={t ? { background: `radial-gradient(120% 100% at 0% 0%, ${t.glow}, transparent 62%)` } : undefined}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">Fase 1 · decisão</p>
        <p className={`mt-2 flex items-center gap-2 text-[22px] font-bold ${t ? t.text : "text-white/45"}`}>
          {cl.advance === "sim" ? <ThumbsUp className="h-5 w-5" /> : cl.advance === "nao" ? <ThumbsDown className="h-5 w-5" /> : null}
          {m ? m.label : "Por decidir"}
        </p>
        {cl.advanceWhy && <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-white/75">{cl.advanceWhy}</p>}
        {cl.nextStep && <p className="mt-3 text-[12px] text-white/60">Próximo passo: {cl.nextStep}</p>}
        {!interview.finishedAt && <p className="mt-3 text-[11px] text-amber-200/70">Fase 1 ainda não terminada.</p>}
        {(cl.advance === "sim" && canAdvance) || (cl.advance === "nao" && canReject) ? (
          <div className="mt-4">
            {cl.advance === "sim" ? (
              <button
                type="button"
                onClick={onNewPhase}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[12px] font-semibold text-black hover:bg-[#ede4ff]"
              >
                <Plus className="h-3.5 w-3.5" />
                Marcar a fase seguinte
              </button>
            ) : (
              <button
                type="button"
                onClick={onReject}
                className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/30 px-3.5 py-1.5 text-[12px] font-semibold text-rose-200/90 hover:bg-rose-500/10"
              >
                <Ban className="h-3.5 w-3.5" />
                Recusar candidato
              </button>
            )}
          </div>
        ) : null}
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-4 text-[11.5px] text-white/45">
          <span>
            <Mic className="mr-1 inline h-3 w-3" />
            {interviewer}
          </span>
          <span className="text-right">{duration(interview) ?? (interview.startedAt ? "Em curso" : "Por começar")}</span>
          <span>
            {answered}/{total} com notas
          </span>
          <span className="text-right">{interview.finishedAt ? fmtWhen(interview.finishedAt) : fmtDay(interview.date)}</span>
        </div>
      </div>
      <div className="space-y-3">
        {cl.doubts ? (
          <TextBox title="Dúvidas por esclarecer" text={cl.doubts} />
        ) : (
          <div className="rounded-3xl border border-dashed border-white/[0.08] px-5 py-4 text-[12.5px] text-white/35">
            Sem dúvidas anotadas. O salário, a zona, o percurso e os hobbies ditos na conversa estão no perfil, em cima.
          </div>
        )}
      </div>
    </section>
  );
}

function AxisMini({ label, value, calc }: { label: string; value: number | null; calc: number | null }) {
  const mine = value !== null && calc !== value;
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5">
      <p className="text-[10.5px] uppercase tracking-[0.14em] text-white/40">{label}</p>
      <p className="mt-0.5 text-[24px] font-black tabular-nums" style={{ color: scoreColor(value) }}>
        {fmtScore(value)}
      </p>
      <p className="text-[10.5px] text-white/35">{mine ? `nota do entrevistador · calc. ${fmtScore(calc)}` : "calculado"}</p>
    </div>
  );
}

function ClosingSection({ interview }: { interview: Interview }) {
  const cl = interview.closing;
  const strengths = cl.strengths.filter((s) => s.trim());
  const weaknesses = cl.weaknesses.filter((s) => s.trim());
  if (!strengths.length && !weaknesses.length && !cl.remember && !cl.quote && !cl.doubts) return null;
  return (
    <section className="animate-fade-up mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ListBox tone="emerald" icon={<ThumbsUp className="h-4 w-4" />} title="Pontos fortes" items={strengths} />
        <ListBox tone="rose" icon={<ThumbsDown className="h-4 w-4" />} title="Pontos fracos" items={weaknesses} />
      </div>
      <div className="space-y-3">
        {cl.quote && (
          <blockquote className="relative rounded-3xl border border-[#c4a6ff]/25 bg-[#783DF5]/[0.07] px-5 py-4">
            <Quote className="absolute right-4 top-3 h-6 w-6 text-[#c4a6ff]/30" />
            <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#c4a6ff]/70">Frase que me ficou</p>
            <p className="mt-1.5 text-[16px] italic leading-snug text-white/90">«{cl.quote}»</p>
          </blockquote>
        )}
        {cl.remember && <TextBox title="Como me lembro dele/a" text={cl.remember} />}
        {cl.doubts && <TextBox title="Dúvidas por esclarecer" text={cl.doubts} />}
      </div>
    </section>
  );
}

function ListBox({ tone, icon, title, items }: { tone: "emerald" | "rose"; icon: ReactNode; title: string; items: string[] }) {
  const t = TONE[tone];
  return (
    <div className={`rounded-3xl border p-4 ${t.border} bg-white/[0.015]`}>
      <p className={`flex items-center gap-2 text-[13px] font-semibold ${t.text}`}>
        {icon}
        {title}
      </p>
      {items.length ? (
        <ul className="mt-2 space-y-1.5">
          {items.map((s, i) => (
            <li key={i} className="flex gap-2 text-[13px] leading-snug text-white/80">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: t.solid }} />
              {s}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[12px] text-white/30">—</p>
      )}
    </div>
  );
}

function TextBox({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] px-5 py-4">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/40">{title}</p>
      <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-white/75">{text}</p>
    </div>
  );
}

function QuestionsSection({ template, interview }: { template: InterviewTemplate; interview: Interview }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="animate-fade-up mt-6 rounded-3xl border border-white/[0.08] bg-white/[0.02] p-2 sm:p-3">
      <p className="px-3 pb-2 pt-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">Pergunta a pergunta</p>
      {template.sections.map((sec) => {
        const qs = template.questions.filter((q) => q.section === sec.id);
        return (
          <div key={sec.id} className="mt-1">
            <p className="px-3 pb-1 pt-3 text-[11.5px] font-semibold text-white/55">{sec.label}</p>
            <ul>
              {qs.map((q) => {
                const a = interview.answers[q.id];
                const scored = !q.unscored && isScored(a);
                const score = scored ? questionScore(q, a) : null;
                const flagged = (a?.flags.length ?? 0) > 0;
                const isOpen = open === q.id;
                return (
                  <li key={q.id} className="rounded-2xl transition hover:bg-white/[0.025]">
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : q.id)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                      aria-expanded={isOpen}
                    >
                      <span className="w-7 shrink-0 text-[11px] font-bold text-white/35">{q.code}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-white/80">{q.title}</span>
                      {flagged && <Flag className="h-3.5 w-3.5 shrink-0 text-rose-300" />}
                      {a?.notes && <PenLine className="h-3.5 w-3.5 shrink-0 text-white/30" />}
                      {q.unscored ? (
                        <span className="w-[10.5rem] shrink-0 text-right text-[11px] text-white/30 max-sm:w-auto">só notas</span>
                      ) : (
                        <>
                          <span className="hidden w-28 shrink-0 sm:block">
                            <span className="block h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                              <span className="block h-full rounded-full" style={{ width: `${(score ?? 0) * 10}%`, background: scoreColor(score) }} />
                            </span>
                          </span>
                          <span className="w-10 shrink-0 text-right text-[13px] font-bold tabular-nums" style={{ color: scoreColor(score) }}>
                            {fmtScore(score)}
                          </span>
                        </>
                      )}
                      <ChevronDown className={`h-4 w-4 shrink-0 text-white/30 transition ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen && (
                      <div className="grid grid-cols-1 gap-4 px-3 pb-4 pl-12 lg:grid-cols-2">
                        <ul className="space-y-1">
                          {q.criteria.map((cr) => {
                            const on = a?.checked.includes(cr.id) ?? false;
                            return (
                              <li key={cr.id} className={`flex items-start gap-2 text-[12.5px] ${on ? "text-white/85" : "text-white/35"}`}>
                                <span
                                  className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                    on ? "border-emerald-300 bg-emerald-400 text-black" : "border-white/15"
                                  }`}
                                >
                                  {on && <Check className="h-3 w-3" strokeWidth={3} />}
                                </span>
                                <span className="flex-1">{cr.label}</span>
                                <span className="tabular-nums text-white/35">{cr.pts}</span>
                              </li>
                            );
                          })}
                          {q.penalties.map((p) =>
                            a?.flags.includes(p.id) ? (
                              <li key={p.id} className="flex items-start gap-2 text-[12.5px] text-rose-200">
                                <Flag className="mt-0.5 h-4 w-4 shrink-0" />
                                {p.label}
                              </li>
                            ) : null,
                          )}
                          {a && a.override !== null && <li className="text-[11.5px] text-amber-200/80">Nota ajustada à mão: {a.override}</li>}
                        </ul>
                        <div className="text-[12.5px] leading-relaxed text-white/70">
                          {a?.notes ? <p className="whitespace-pre-wrap">{a.notes}</p> : <p className="text-white/30">Sem notas.</p>}
                          {a && a.timeMs > 0 && <p className="mt-2 text-[11px] text-white/30">Tempo nesta pergunta: {Math.round(a.timeMs / 60000)} min</p>}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Modais
// ---------------------------------------------------------------------------

function ModalHead({ title, sub, onClose }: { title: string; sub?: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-6 py-5">
      <div>
        <p className="text-[16px] font-semibold text-white">{title}</p>
        {sub && <p className="mt-0.5 text-[12px] leading-relaxed text-white/45">{sub}</p>}
      </div>
      <button type="button" onClick={onClose} className="rounded-full p-1.5 text-white/40 hover:bg-white/[0.06] hover:text-white" aria-label="Fechar">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function AcceptModal({
  candidate,
  onClose,
  onDone,
}: {
  candidate: Candidate;
  onClose: () => void;
  onDone: (c: Candidate, a: Accepted) => void;
}) {
  const [username, setUsername] = useState(suggestUsername(candidate.name));
  const [name, setName] = useState(shortName(candidate.name));
  const [role, setRole] = useState(candidate.role || "Consultor de SEO");
  const [startDate, setStartDate] = useState("");
  const [note, setNote] = useState("");
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phraseOk = normalizePhrase(phrase) === ACCEPT_PHRASE;
  const userOk = USERNAME_RE.test(username);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/recrutamento/${candidate.id}/aceitar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase, username, name, role, startDate: startDate || null, note }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        candidate?: Candidate;
        account?: { username: string; name: string; fullName: string };
        password?: string | null;
        error?: string;
      };
      if (!res.ok || !json.candidate || !json.account) throw new Error(json.error || "Não foi possível aceitar.");
      onDone(json.candidate, {
        username: json.account.username,
        name: json.account.name,
        fullName: json.account.fullName,
        password: json.password ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível aceitar.");
      setBusy(false);
    }
  }

  return (
    <Modal onClose={() => !busy && onClose()} wide>
      <ModalHead title={`Aceitar ${candidate.name}`} sub="Isto cria a conta na app agora. Confirma os dados." onClose={onClose} />
      <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
        <Field label="Utilizador (login)" hint="Letras minúsculas, números e hífens.">
          <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, "-"))} className={`${inputCls} font-mono`} />
        </Field>
        <Field label="Nome na app" hint="É também o nome da coluna no SEO DPT.">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Cargo">
          <input value={role} onChange={(e) => setRole(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Data de entrada" hint="O dia 1: arranca os exames da Formação.">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${inputCls} [color-scheme:dark]`} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Nota (opcional)">
            <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="Condições, mentor, prazo…" />
          </Field>
        </div>
        <ul className="space-y-1.5 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[12.5px] text-white/65 sm:col-span-2">
          <li className="flex gap-2"><KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#c4a6ff]" />Login <b className="font-mono text-white/85">{username || "…"}</b>, com password gerada e guardada no cofre dos Acessos.</li>
          <li className="flex gap-2"><UserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />Entra na equipa do C-Suite (SEO{startDate ? `, a partir de ${fmtDay(startDate)}` : ""}).</li>
          <li className="flex gap-2"><ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300" />Coluna nova no SEO DPT, «{name || "…"}», pronta para receber clientes.</li>
        </ul>
        <div className="sm:col-span-2">
          <Field label={`Para confirmar, escreve «${ACCEPT_PHRASE}»`}>
            <input
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              className={`${inputCls} ${phraseOk ? "border-emerald-300/60" : ""}`}
              placeholder={ACCEPT_PHRASE}
              autoComplete="off"
            />
          </Field>
        </div>
        {error && <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-100 sm:col-span-2">{error}</p>}
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-6 py-4">
        <button type="button" onClick={onClose} disabled={busy} className="rounded-full px-4 py-2 text-[12.5px] font-semibold text-white/55 hover:text-white">
          Cancelar
        </button>
        <button
          type="button"
          disabled={!phraseOk || !userOk || !name.trim() || busy}
          onClick={() => void submit()}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-2 text-[12.5px] font-semibold text-black transition hover:bg-emerald-300 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
          Aceitar e criar conta
        </button>
      </div>
    </Modal>
  );
}

function AcceptedBanner({ accepted, canSeeAccess, onClose }: { accepted: Accepted; canSeeAccess: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const message = accessMessage({ name: accepted.name, fullName: accepted.fullName, username: accepted.username }, accepted.password);
  return (
    <div className="animate-fade-up relative mt-6 overflow-hidden rounded-3xl border border-emerald-300/35 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(52,211,153,0.2),transparent_60%)] p-6">
      <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full p-1.5 text-white/40 hover:bg-white/[0.06] hover:text-white" aria-label="Fechar">
        <X className="h-4 w-4" />
      </button>
      <p className="flex items-center gap-2 text-[18px] font-semibold text-emerald-100">
        <CheckCircle2 className="h-5 w-5 text-emerald-300" />
        Bem-vindo/a à WonderAds, {accepted.name.split(" ")[0]}!
      </p>
      <p className="mt-1 text-[13px] text-white/60">
        A conta <b className="font-mono text-white/85">{accepted.username}</b> já existe e a coluna já está no SEO DPT.
        {accepted.password ? " Copia o acesso agora: a password só aparece aqui (e em Acessos à app)." : " A password já estava no cofre dos Acessos."}
      </p>
      <pre className="mt-4 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-[12.5px] leading-relaxed text-white/80">{message}</pre>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(message).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            });
          }}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12.5px] font-semibold text-black hover:bg-[#ede4ff]"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copiado" : "Copiar acesso"}
        </button>
        <Link href="/seo" className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-[12.5px] font-semibold text-white/80 hover:border-white/30">
          Ver no SEO DPT <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        {canSeeAccess && (
          <Link href="/admin/acessos" className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-[12.5px] font-semibold text-white/80 hover:border-white/30">
            <KeyRound className="h-3.5 w-3.5" /> Acessos à app
          </Link>
        )}
      </div>
    </div>
  );
}

function RejectModal({ busy, onClose, onConfirm }: { busy: boolean; onClose: () => void; onConfirm: (note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <Modal onClose={() => !busy && onClose()}>
      <ModalHead title="Recusar candidato" sub="Fica registado na ficha. Podes voltar atrás." onClose={onClose} />
      <div className="px-6 py-5">
        <Field label="Porquê (opcional)">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="Ex.: fit cultural baixo" />
        </Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-white/[0.06] px-6 py-4">
        <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-[12.5px] font-semibold text-white/55 hover:text-white">
          Cancelar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onConfirm(note)}
          className="inline-flex items-center gap-2 rounded-full bg-rose-400 px-4 py-2 text-[12.5px] font-semibold text-black hover:bg-rose-300 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Recusar
        </button>
      </div>
    </Modal>
  );
}

function DeleteModal({ id, name, onClose, onDone }: { id: string; name: string; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal onClose={() => !busy && onClose()}>
      <ModalHead title={`Apagar ${name}?`} sub="Apaga a ficha e todas as entrevistas. Não dá para desfazer." onClose={onClose} />
      {error && <p className="mx-6 mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-100">{error}</p>}
      <div className="flex justify-end gap-2 px-6 py-4">
        <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-[12.5px] font-semibold text-white/55 hover:text-white">
          Cancelar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const res = await fetch(`/api/admin/recrutamento/${id}`, { method: "DELETE" }).catch(() => null);
            if (res?.ok) onDone();
            else {
              const j = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
              setError(j?.error || "Não foi possível apagar.");
              setBusy(false);
            }
          }}
          className="inline-flex items-center gap-2 rounded-full bg-rose-400 px-4 py-2 text-[12.5px] font-semibold text-black hover:bg-rose-300 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          Apagar
        </button>
      </div>
    </Modal>
  );
}

function EditModal({
  candidate,
  busy,
  onClose,
  onSave,
}: {
  candidate: Candidate;
  busy: boolean;
  onClose: () => void;
  onSave: (patch: Record<string, string>) => void;
}) {
  const [f, setF] = useState({
    name: candidate.name,
    email: candidate.email,
    phone: candidate.phone,
    linkedin: candidate.linkedin,
    source: candidate.source,
    role: candidate.role,
    location: candidate.location,
    salaryMonthly: candidate.salaryMonthly === null ? "" : String(candidate.salaryMonthly),
    salaryNote: candidate.salaryNote,
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal onClose={() => !busy && onClose()} wide>
      <ModalHead title="Editar candidato" onClose={onClose} />
      <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Nome completo">
            <input value={f.name} onChange={set("name")} className={inputCls} />
          </Field>
        </div>
        <Field label="Email">
          <input value={f.email} onChange={set("email")} className={inputCls} />
        </Field>
        <Field label="Telefone">
          <input value={f.phone} onChange={set("phone")} className={inputCls} />
        </Field>
        <Field label="LinkedIn">
          <input value={f.linkedin} onChange={set("linkedin")} className={inputCls} />
        </Field>
        <Field label="Origem">
          <input value={f.source} onChange={set("source")} className={inputCls} />
        </Field>
        <Field label="Zona onde vive">
          <input value={f.location} onChange={set("location")} className={inputCls} />
        </Field>
        <Field label="Vaga">
          <input value={f.role} onChange={set("role")} className={inputCls} />
        </Field>
        <Field label="Valor mensal pretendido (€)">
          <input value={f.salaryMonthly} onChange={set("salaryMonthly")} inputMode="numeric" className={inputCls} placeholder="1.300" />
        </Field>
        <Field label="Sobre o valor">
          <input value={f.salaryNote} onChange={set("salaryNote")} className={inputCls} placeholder="bruto, negociável…" />
        </Field>
        <p className="text-[11.5px] text-white/35 sm:col-span-2">Gostos, formações, experiências e anotações editam-se direto na ficha.</p>
      </div>
      <div className="flex justify-end gap-2 border-t border-white/[0.06] px-6 py-4">
        <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-[12.5px] font-semibold text-white/55 hover:text-white">
          Cancelar
        </button>
        <button
          type="button"
          disabled={busy || !f.name.trim()}
          onClick={() => onSave(f)}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12.5px] font-semibold text-black hover:bg-[#ede4ff] disabled:opacity-50"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Guardar
        </button>
      </div>
    </Modal>
  );
}

function PhaseModal({
  initialChoice,
  busy,
  error,
  onClose,
  onCreate,
}: {
  initialChoice: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  /** `choice` = id de um template de entrevista, ou «pratica:<id>». */
  onCreate: (choice: string, date: string | null, site: string) => void;
}) {
  const [choice, setChoice] = useState(initialChoice || (INTERVIEW_TEMPLATES[0]?.id ?? ""));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [site, setSite] = useState("");
  const isPractical = choice.startsWith("pratica:");
  return (
    <Modal onClose={() => !busy && onClose()}>
      <ModalHead
        title="Nova fase"
        sub={
          isPractical
            ? "A prova prática: o candidato faz num link teu, e a avaliação fica aqui na ficha."
            : "Uma entrevista nova para este candidato, com o seu template."
        }
        onClose={onClose}
      />
      <div className="space-y-4 px-6 py-5">
        <Field label="Template">
          <select value={choice} onChange={(e) => setChoice(e.target.value)} className={inputCls}>
            {INTERVIEW_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id} className="bg-[#11111a]">
                {t.title} — {t.phase}
              </option>
            ))}
            {PRACTICAL_TEMPLATES.map((t) => (
              <option key={t.id} value={`pratica:${t.id}`} className="bg-[#11111a]">
                {t.title} — link para o candidato
              </option>
            ))}
          </select>
        </Field>
        {isPractical && (
          <Field label="Site a auditar" hint="O ponto 1 do guião — o candidato vê-o no link.">
            <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="https://…" className={inputCls} autoFocus />
          </Field>
        )}
        <Field label="Data">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} [color-scheme:dark]`} />
        </Field>
        {error && <p className="text-[12px] text-rose-300">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-white/[0.06] px-6 py-4">
        <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-[12.5px] font-semibold text-white/55 hover:text-white">
          Cancelar
        </button>
        <button
          type="button"
          disabled={busy || (isPractical && !site.trim())}
          onClick={() => onCreate(choice, date || null, site)}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12.5px] font-semibold text-black hover:bg-[#ede4ff] disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarDays className="h-3.5 w-3.5" />}
          Criar fase
        </button>
      </div>
    </Modal>
  );
}
