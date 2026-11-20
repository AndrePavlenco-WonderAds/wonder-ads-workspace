"use client";

// Recrutamento (v80.13) — a lista de candidatos: números, filtros, pesquisa,
// cartões com a grade D–A, e o «Novo candidato».

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Euro,
  Loader2,
  MapPin,
  Mic,
  Plus,
  Search,
  Sparkles,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { fmtScore, summarize } from "@/lib/recrutamento/scoring";
import { fmtEuros, headlineInterview, stageOf, type Candidate, type CandidateStage } from "@/lib/recrutamento/shared";
import { DEFAULT_TEMPLATE_ID, getTemplate, INTERVIEW_TEMPLATES } from "@/lib/recrutamento/templates";
import { GradeBadge, Initials, scoreColor, StageChip } from "./ui";
import { practicalScore } from "@/lib/recrutamento/practical";

type Filter = "todos" | "pipeline" | "entrevistados" | "aceites" | "recusados";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "pipeline", label: "Por entrevistar" },
  { id: "entrevistados", label: "Entrevistados" },
  { id: "aceites", label: "Aceites" },
  { id: "recusados", label: "Recusados" },
];

function matches(f: Filter, s: CandidateStage): boolean {
  if (f === "todos") return true;
  if (f === "pipeline") return s === "por-entrevistar" || s === "em-entrevista";
  if (f === "entrevistados") return s === "entrevistado";
  if (f === "aceites") return s === "aceite";
  return s === "recusado";
}

function fmtDay(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function RecruitmentHub({ initial }: { initial: Candidate[] }) {
  const [filter, setFilter] = useState<Filter>("todos");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const rows = useMemo(
    () =>
      initial.map((c) => {
        const i = headlineInterview(c);
        const t = i ? getTemplate(i.templateId) : null;
        const sum = i && t ? summarize(t, i.answers, i.closing) : null;
        return { c, stage: stageOf(c), interview: i, sum };
      }),
    [initial],
  );

  const counts = useMemo(() => {
    const out: Record<Filter, number> = { todos: rows.length, pipeline: 0, entrevistados: 0, aceites: 0, recusados: 0 };
    for (const r of rows) for (const f of FILTERS) if (f.id !== "todos" && matches(f.id, r.stage)) out[f.id] += 1;
    return out;
  }, [rows]);

  const done = rows.filter((r) => r.c.interviews.some((i) => i.finishedAt));
  const avgFit = avgOf(done.map((r) => r.sum?.fit ?? null));
  const avgTech = avgOf(done.map((r) => r.sum?.tech ?? null));

  const visible = rows.filter((r) => {
    if (!matches(filter, r.stage)) return false;
    const q = norm(query);
    if (!q) return true;
    return norm(`${r.c.name} ${r.c.email} ${r.c.source} ${r.c.role} ${r.c.location} ${r.c.interests}`).includes(q);
  });

  return (
    <>
      <header className="animate-fade-up mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="readout flex items-center gap-1.5 text-amber-200/60">
            <Briefcase className="h-3 w-3" />
            SuperAdmin · RH
          </p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            <span className="brand-gradient-text">Recrutamento</span>
          </h1>
          <p className="mt-1.5 max-w-[640px] text-[12.5px] leading-relaxed text-white/45">
            Os candidatos a consultor, uma entrevista de cada vez. Cada pergunta tem o seu ecrã e a pontuação faz-se à medida
            que a conversa avança. No fim fica a ficha com a grade D–A. Quem for aceite entra logo no SEO DPT, com o seu login.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black shadow-[0_10px_40px_-12px_rgba(196,166,255,0.8)] transition hover:bg-[#ede4ff]"
        >
          <UserPlus className="h-4 w-4" />
          Novo candidato
        </button>
      </header>

      <section className="animate-fade-up mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={Users} value={String(counts.pipeline)} label="Por entrevistar" tone="text-white" />
        <Stat icon={Mic} value={String(done.length)} label="Já entrevistados" tone="text-sky-300" />
        <Stat
          icon={Sparkles}
          value={avgFit === null ? "—" : `${fmtScore(avgFit)} · ${fmtScore(avgTech)}`}
          label="Média Fit · Técnica"
          tone="text-[#c3aaff]"
        />
        <Stat icon={CheckCircle2} value={String(counts.aceites)} label="Aceites" tone="text-emerald-300" />
      </section>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-full border border-white/[0.08] bg-white/[0.02] p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                filter === f.id ? "bg-white/[0.1] text-white" : "text-white/45 hover:text-white/80"
              }`}
            >
              {f.label}
              <span className="tabular-nums text-[10.5px] text-white/35">{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <label className="flex w-full items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 sm:w-72">
          <Search className="h-3.5 w-3.5 text-white/35" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Procurar nome, zona, origem…"
            className="w-full bg-transparent text-[12.5px] text-white placeholder:text-white/30 focus:outline-none"
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-white/10 px-6 py-14 text-center">
          <Briefcase className="mx-auto h-7 w-7 text-white/20" />
          <p className="mt-3 text-[13.5px] font-semibold text-white/70">
            {rows.length === 0 ? "Ainda não há candidatos" : "Nenhum candidato neste filtro"}
          </p>
          <p className="mt-1 text-[12px] text-white/40">
            {rows.length === 0 ? "Cria o primeiro e começa a entrevista quando a pessoa entrar na call." : "Experimenta outro filtro ou pesquisa."}
          </p>
          {rows.length === 0 && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-[12.5px] font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/[0.04]"
            >
              <Plus className="h-4 w-4" />
              Novo candidato
            </button>
          )}
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map(({ c, stage, interview, sum }) => (
            <li key={c.id}>
              <Link
                href={`/admin/recrutamento/${c.id}`}
                className="group flex h-full flex-col rounded-3xl border border-white/[0.08] bg-white/[0.02] p-4 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.04]"
              >
                <div className="flex items-start gap-3">
                  <Initials name={c.name} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-white">{c.name}</p>
                    <p className="truncate text-[12px] text-white/45">
                      {c.role}
                      {c.source ? ` · ${c.source}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <StageChip stage={stage} />
                      {interview?.date && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-white/40">
                          <CalendarDays className="h-3 w-3" />
                          {fmtDay(interview.date)}
                        </span>
                      )}
                      {c.location && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-white/40">
                          <MapPin className="h-3 w-3" />
                          {c.location}
                        </span>
                      )}
                      {c.salaryMonthly !== null && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-white/40">
                          <Euro className="h-3 w-3" />
                          {fmtEuros(c.salaryMonthly)}/mês
                        </span>
                      )}
                    </div>
                  </div>
                  <GradeBadge cell={sum && interview?.finishedAt ? sum.cell : null} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Mini label="Fit Cultural" value={sum?.fit ?? null} />
                  <Mini label="Técnica" value={sum?.tech ?? null} />
                </div>
                <div className="mt-auto flex items-center justify-between pt-4 text-[11.5px] text-white/40">
                  <span>
                    {sum ? `${sum.scored}/${sum.total} perguntas pontuadas` : "Sem entrevista"}
                    {c.interviews.length + c.practicals.length > 1 ? ` · ${c.interviews.length + c.practicals.length} fases` : ""}
                    {(() => {
                      // Prática (v80.16): a nota da última, quando já tem.
                      const last = c.practicals[c.practicals.length - 1];
                      const sc = last ? practicalScore(last.review).final : null;
                      if (!last) return null;
                      return (
                        <>
                          {" · prática "}
                          <b className="tabular-nums" style={{ color: scoreColor(sc) }}>
                            {sc === null ? "por avaliar" : fmtScore(sc)}
                          </b>
                        </>
                      );
                    })()}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:text-white/80" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {creating && <NewCandidateModal onClose={() => setCreating(false)} />}
    </>
  );
}

function avgOf(list: Array<number | null>): number | null {
  const ns = list.filter((n): n is number => n !== null);
  return ns.length ? Math.round((ns.reduce((s, n) => s + n, 0) / ns.length) * 10) / 10 : null;
}

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function Stat({ icon: Icon, value, label, tone }: { icon: LucideIcon; value: string; label: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3.5">
      <p className={`text-[24px] font-bold leading-none tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-white/45">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[10.5px] uppercase tracking-[0.14em] text-white/35">{label}</span>
        <span className="tabular-nums text-[12.5px] font-bold" style={{ color: scoreColor(value) }}>
          {fmtScore(value)}
        </span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full" style={{ width: `${(value ?? 0) * 10}%`, background: scoreColor(value) }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Novo candidato
// ---------------------------------------------------------------------------

export function Modal({ children, onClose, wide = false }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-3 sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className={`animate-fade-up relative max-h-[92vh] w-full overflow-y-auto rounded-3xl border border-white/10 bg-[#11111a] shadow-[0_40px_120px_-30px_rgba(120,61,245,0.55)] ${
          wide ? "max-w-[620px]" : "max-w-[480px]"
        }`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-[11.5px] font-semibold text-white/55">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-[11px] text-white/30">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white placeholder:text-white/25 focus:border-[#c4a6ff]/60 focus:outline-none";

const SOURCES = ["LinkedIn", "Indeed", "Net-Empregos", "Indicação", "Candidatura espontânea"];

function NewCandidateModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    linkedin: "",
    source: "",
    templateId: DEFAULT_TEMPLATE_ID,
    role: getTemplate(DEFAULT_TEMPLATE_ID)?.role ?? "",
    date: new Date().toISOString().slice(0, 10),
    notes: "",
    location: "",
    salaryMonthly: "",
    salaryNote: "",
  });
  const [busy, setBusy] = useState<null | "ficha" | "entrevista">(null);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(then: "ficha" | "entrevista") {
    if (!form.name.trim()) {
      setError("Falta o nome.");
      return;
    }
    setBusy(then);
    setError(null);
    try {
      const res = await fetch("/api/admin/recrutamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = (await res.json().catch(() => ({}))) as { candidate?: Candidate; error?: string };
      if (!res.ok || !json.candidate) throw new Error(json.error || "Não foi possível criar.");
      const c = json.candidate;
      router.push(then === "entrevista" ? `/admin/recrutamento/${c.id}/entrevista/${c.interviews[0].id}` : `/admin/recrutamento/${c.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar.");
      setBusy(null);
    }
  }

  return (
    <Modal onClose={() => !busy && onClose()} wide>
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-6 py-5">
        <div>
          <p className="text-[16px] font-semibold text-white">Novo candidato</p>
          <p className="mt-0.5 text-[12px] text-white/45">A ficha nasce com a entrevista do template escolhido.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-1.5 text-white/40 hover:bg-white/[0.06] hover:text-white" aria-label="Fechar">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Nome completo *">
            <input autoFocus value={form.name} onChange={set("name")} className={inputCls} placeholder="Nome e apelido" />
          </Field>
        </div>
        <Field label="Email">
          <input type="email" value={form.email} onChange={set("email")} className={inputCls} placeholder="nome@email.com" />
        </Field>
        <Field label="Telefone">
          <input value={form.phone} onChange={set("phone")} className={inputCls} placeholder="9xx xxx xxx" />
        </Field>
        <Field label="LinkedIn">
          <input value={form.linkedin} onChange={set("linkedin")} className={inputCls} placeholder="linkedin.com/in/…" />
        </Field>
        <Field label="Origem">
          <input value={form.source} onChange={set("source")} className={inputCls} list="recrut-sources" placeholder="LinkedIn, indicação…" />
          <datalist id="recrut-sources">
            {SOURCES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label="Entrevista (template)">
          <select
            value={form.templateId}
            onChange={(e) => {
              const t = getTemplate(e.target.value);
              setForm((f) => ({ ...f, templateId: e.target.value, role: t?.role ?? f.role }));
            }}
            className={inputCls}
          >
            {INTERVIEW_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id} className="bg-[#11111a]">
                {t.title} — {t.phase}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Zona onde vive">
          <input value={form.location} onChange={set("location")} className={inputCls} placeholder="Ex.: Almada" />
        </Field>
        <Field label="Valor mensal pretendido (€)">
          <div className="flex gap-2">
            <input value={form.salaryMonthly} onChange={set("salaryMonthly")} inputMode="numeric" className={`${inputCls} w-28`} placeholder="1.300" />
            <input value={form.salaryNote} onChange={set("salaryNote")} className={inputCls} placeholder="bruto, negociável…" />
          </div>
        </Field>
        <Field label="Data da entrevista">
          <input type="date" value={form.date} onChange={set("date")} className={`${inputCls} [color-scheme:dark]`} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Vaga">
            <input value={form.role} onChange={set("role")} className={inputCls} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Notas (opcional)">
            <textarea value={form.notes} onChange={set("notes")} rows={3} className={`${inputCls} resize-none`} placeholder="CV, quem indicou, primeira impressão…" />
          </Field>
        </div>
        {error && <p className="sm:col-span-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-100">{error}</p>}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.06] px-6 py-4">
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => submit("ficha")}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-[12.5px] font-semibold text-white/80 transition hover:border-white/30 disabled:opacity-50"
        >
          {busy === "ficha" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Criar ficha
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => submit("entrevista")}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12.5px] font-semibold text-black transition hover:bg-[#ede4ff] disabled:opacity-50"
        >
          {busy === "entrevista" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mic className="h-3.5 w-3.5" />}
          Criar e começar entrevista
        </button>
      </div>
    </Modal>
  );
}
