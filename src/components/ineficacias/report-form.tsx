"use client";

// A folha RH-03 — o relatório de ineficácias que o consultor assina quando
// quiser, a qualquer hora. Papel claro sobre a app escura, como as folhas de
// RH das ausências, porque isto é um DOCUMENTO: um ou mais erros, cada um com
// os seus campos obrigatórios, e no fim o nome completo tal como está na
// conta + «Assinar e submeter».
//
// v77.91 — a folha guia quem a preenche: a barra do topo enche com o que já
// está feito, cada erro mostra os seus 7 campos e fecha-se num resumo quando
// está completo, a data vem com «hoje», o cliente é um dropdown da carteira,
// e uma doca no fundo do ecrã diz o que falta e leva lá. A declaração deixou
// de ser uma caixa à parte: assinar É declarar (o texto continua dentro do
// hash do relatório).
//
// A assinatura reutiliza a escrita à mão das ausências (SignatureLine): o
// nome escreve-se letra a letra enquanto o POST segue, e o carimbo de
// SUBMETIDO só cai quando as duas coisas acabaram. Se o servidor recusar, a
// folha volta atrás inteira, com o erro à vista e nada perdido.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowDown,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Eye,
  FileQuestion,
  Lightbulb,
  Loader2,
  MoreHorizontal,
  PenLine,
  Plus,
  Repeat,
  RotateCcw,
  ScanEye,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { SignatureLine, formatDatePT } from "@/components/absences/sheet";
import { ClientPicker } from "@/components/ineficacias/client-picker";
import {
  LIMITS,
  NOTICED_OPTIONS,
  REASONS,
  REPORT_LOOKBACK_DAYS,
  addDaysISO,
  formatISODate,
  isISODate,
  nameMatches,
  reasonLabel,
  reportDateRange,
  validateReport,
  type ClientChoices,
  type IneficaciaItemDraft,
  type IneficaciaNoticed,
  type IneficaciaReason,
  type IneficaciaReport,
} from "@/lib/ineficacias/shared";

type LocalItem = IneficaciaItemDraft & { key: string };

/** A chave do primeiro erro é fixa: vai parar aos ids do HTML, e um UUID
 *  diferente no servidor e no browser parte a hidratação. */
function blankItem(today: string, key: string = crypto.randomUUID()): LocalItem {
  return {
    key,
    what: "",
    client: "",
    reason: null,
    reasonOther: "",
    shouldHave: "",
    firstTime: null,
    lastTime: "",
    // Quem abre a folha costuma vir reportar o que aconteceu hoje.
    occurredOn: today,
    noticed: null,
  };
}

/* ---------------------- os 7 campos de um erro ---------------------- */

type FieldKey = "occurredOn" | "client" | "what" | "reason" | "shouldHave" | "firstTime" | "noticed";

const FIELD_ORDER: FieldKey[] = ["occurredOn", "client", "what", "reason", "shouldHave", "firstTime", "noticed"];

const FIELD_MISSING: Record<FieldKey, string> = {
  occurredOn: "a data",
  client: "o cliente ou projeto",
  what: "o que aconteceu",
  reason: "o motivo",
  shouldHave: "como deverias ter feito",
  firstTime: "se foi a primeira vez",
  noticed: "se percebeste o erro",
};

function fieldOk(item: IneficaciaItemDraft, field: FieldKey, range: { min: string; max: string }): boolean {
  switch (field) {
    case "occurredOn":
      return isISODate(item.occurredOn) && item.occurredOn >= range.min && item.occurredOn <= range.max;
    case "client":
      return item.client.trim().length >= LIMITS.client.min;
    case "what":
      return item.what.trim().length >= LIMITS.what.min;
    case "reason":
      return item.reason !== null && (item.reason !== "outro" || item.reasonOther.trim().length >= LIMITS.reasonOther.min);
    case "shouldHave":
      return item.shouldHave.trim().length >= LIMITS.shouldHave.min;
    case "firstTime":
      return item.firstTime === true || (item.firstTime === false && item.lastTime.trim().length >= LIMITS.lastTime.min);
    case "noticed":
      return item.noticed !== null;
  }
}

function fieldId(itemKey: string, field: FieldKey): string {
  return `ine-${itemKey}-${field}`;
}

const REASON_ICONS: Record<IneficaciaReason, LucideIcon> = {
  atencao: ScanEye,
  protocolo: FileQuestion,
  tempo: Clock,
  outro: MoreHorizontal,
};

const NOTICED_ICONS: Record<IneficaciaNoticed, LucideIcon> = {
  proprio: UserCheck,
  equipa: Users,
  cliente: Building2,
};

const LAST_TIME_SUGGESTIONS = ["Esta semana", "Na semana passada", "Há umas semanas", "Há mais de um mês"];

type Phase = "fill" | "signing" | "done";
type Target = { kind: "field"; itemKey: string; n: number; field: FieldKey } | { kind: "signature" };

export function IneficaciaReportForm({
  employee,
  today,
  clients,
  readOnly = false,
}: {
  employee: { username: string; name: string; fullName: string; role: string; dept: string; avatar?: string | null };
  today: string;
  /** A carteira do consultor + os outros clientes, para o dropdown. */
  clients: ClientChoices;
  /** «Ver como» ativo — a folha mostra-se, mas não assina. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  // Um erro já aberto: quem abre a folha vem reportar alguma coisa.
  const [items, setItems] = useState<LocalItem[]>(() => [blankItem(today, "erro-1")]);
  // Os erros fechados num resumo (os completos, quando se abre outro).
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  // Um identificador por folha — o servidor recusa o mesmo envio duas vezes
  // (duplo clique, reenvio da rede), mas aceita quantos relatórios houver.
  const [nonce, setNonce] = useState(() => crypto.randomUUID());
  const [signatureName, setSignatureName] = useState("");
  const [phase, setPhase] = useState<Phase>("fill");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<IneficaciaReport | null>(null);
  const [showStamp, setShowStamp] = useState(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const signatureZoneRef = useRef<HTMLDivElement | null>(null);
  const signatureInputRef = useRef<HTMLInputElement | null>(null);
  const animationDoneRef = useRef<() => void>(() => {});

  const range = useMemo(() => reportDateRange(today), [today]);
  const nameOk = signatureName.trim().length > 0 && nameMatches(signatureName, employee.fullName);

  const checks = useMemo(
    () => items.map((it) => FIELD_ORDER.map((f) => fieldOk(it, f, range))),
    [items, range],
  );
  const itemsDone = checks.every((c) => c.every(Boolean));
  const totalSteps = items.length * FIELD_ORDER.length + 1;
  const doneSteps = checks.reduce((s, c) => s + c.filter(Boolean).length, 0) + (nameOk ? 1 : 0);
  const pct = Math.round((doneSteps / totalSteps) * 100);

  /** O que falta a seguir, por ordem da folha. */
  const next: Target | null = useMemo(() => {
    for (let i = 0; i < items.length; i += 1) {
      const miss = FIELD_ORDER.findIndex((_, j) => !checks[i][j]);
      if (miss >= 0) return { kind: "field", itemKey: items[i].key, n: i + 1, field: FIELD_ORDER[miss] };
    }
    return nameOk ? null : { kind: "signature" };
  }, [items, checks, nameOk]);

  const readyProblem = useMemo(
    () => validateReport({ items, declaration: true, signatureName }, { todayISO: today, expectedName: employee.fullName }),
    [items, signatureName, today, employee.fullName],
  );

  function updateItem(key: string, patch: Partial<IneficaciaItemDraft>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }
  function addItem() {
    const fresh = blankItem(today);
    // Os erros completos fecham-se num resumo — a folha não cresce sem fim.
    setCollapsed(new Set(items.filter((_, i) => checks[i].every(Boolean)).map((it) => it.key)));
    setItems((prev) => [...prev, fresh]);
    setTimeout(() => {
      document.getElementById(`ine-item-${fresh.key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }
  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }
  function toggleItem(key: string) {
    setCollapsed((prev) => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key);
      else s.add(key);
      return s;
    });
  }

  /** Leva o ecrã (e o cursor) ao que falta. */
  const goTo = useCallback((t: Target) => {
    if (t.kind === "signature") {
      signatureZoneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => signatureInputRef.current?.focus({ preventScroll: true }), 350);
      return;
    }
    setCollapsed((prev) => {
      if (!prev.has(t.itemKey)) return prev;
      const s = new Set(prev);
      s.delete(t.itemKey);
      return s;
    });
    setTimeout(() => {
      const el = document.getElementById(fieldId(t.itemKey, t.field));
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ine-attention");
      setTimeout(() => el.classList.remove("ine-attention"), 1400);
      const focusable = el.matches("input, textarea, button") ? el : el.querySelector<HTMLElement>("input, textarea, button");
      setTimeout(() => focusable?.focus({ preventScroll: true }), 350);
    }, 60);
  }, []);

  const submit = useCallback(async (): Promise<{ ok: true; report: IneficaciaReport } | { ok: false; message: string }> => {
    try {
      const res = await fetch("/api/ineficacias", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nonce,
          items: items.map((it) => ({
            what: it.what,
            client: it.client,
            reason: it.reason,
            reasonOther: it.reasonOther,
            shouldHave: it.shouldHave,
            firstTime: it.firstTime,
            lastTime: it.lastTime,
            occurredOn: it.occurredOn,
            noticed: it.noticed,
          })),
          // Assinar é declarar — o texto da declaração entra no hash.
          declaration: true,
          signatureName,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { report?: IneficaciaReport; error?: string };
      if (!res.ok || !data.report) return { ok: false, message: data.error ?? "Não foi possível submeter — tenta outra vez." };
      return { ok: true, report: data.report };
    } catch {
      return { ok: false, message: "Falha de rede — o relatório não foi submetido." };
    }
  }, [nonce, items, signatureName]);

  const handleSign = useCallback(async () => {
    if (phase !== "fill" || readOnly) return;
    if (readyProblem) {
      setError(readyProblem);
      if (next) goTo(next);
      return;
    }
    setError(null);
    setPhase("signing");
    signatureZoneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const animation = new Promise<void>((resolve) => {
      animationDoneRef.current = resolve;
    });
    const [outcome] = await Promise.all([submit(), animation]);
    if (!outcome.ok) {
      setPhase("fill");
      setError(outcome.message);
      return;
    }
    setSubmitted(outcome.report);
    setShowStamp(true);
    setTimeout(() => {
      setPhase("done");
      router.refresh();
    }, 1100);
  }, [phase, readOnly, readyProblem, next, goTo, submit, router]);

  /** Folha nova, em branco — para assinar outro relatório. */
  function resetForm() {
    setItems([blankItem(today)]);
    setCollapsed(new Set());
    setNonce(crypto.randomUUID());
    setSignatureName("");
    setSubmitted(null);
    setShowStamp(false);
    setError(null);
    setPhase("fill");
  }

  const signing = phase !== "fill";

  if (phase === "done" && submitted) {
    return <SuccessPanel report={submitted} onNew={resetForm} />;
  }

  return (
    <section aria-label="Relatório de ineficácias" className="relative mx-auto w-full max-w-[920px]">
      <div
        ref={sheetRef}
        className="relative rounded-[10px] bg-gradient-to-b from-[#fbfaf7] to-[#f0eee8] text-[#20202a] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.06)]"
      >
        {/* A barra do topo é o progresso da folha */}
        <div aria-hidden className="h-1.5 w-full overflow-hidden rounded-t-[10px] bg-black/[0.08]">
          <div className="h-full transition-[width] duration-500 ease-out" style={{ width: `${Math.max(pct, 2)}%`, background: "var(--brand-gradient)" }} />
        </div>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[10px]"
        >
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] select-none whitespace-nowrap text-[110px] font-extrabold tracking-[0.3em] text-black/[0.025]">
            WONDER ADS
          </span>
        </span>

        <header className="relative flex flex-wrap items-start justify-between gap-4 border-b border-black/10 px-5 pb-5 pt-6 sm:px-10">
          <div>
            <p className="text-[19px] font-extrabold tracking-tight">
              Wonder{" "}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--brand-gradient)" }}>
                Ads
              </span>
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-black/45">
              Operações · Team Inefficiency
            </p>
            <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-[10.5px] font-semibold text-black/55">
              <span className="tabular-nums text-[#4c2bb0]">{pct}%</span>
              preenchido
              <span className="text-black/25">·</span>
              {items.length} {items.length === 1 ? "erro" : "erros"}
            </p>
          </div>
          <div className="rounded-md border border-black/15 bg-white/70 px-3.5 py-2 text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/50">Formulário RH-03</p>
            <p className="text-[13px] font-extrabold uppercase tracking-[0.08em]">Relatório de ineficácias</p>
            <p className="mt-0.5 font-mono text-[10.5px] text-black/45">Ref.ª atribuída na submissão · {formatDatePT(today)}</p>
          </div>
        </header>

        {readOnly && (
          <p className="relative mx-5 mt-5 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-100/70 px-3.5 py-2.5 text-[12px] font-semibold text-amber-900 sm:mx-10">
            <Eye className="h-4 w-4" />
            Estás a ver a app como outra pessoa — podes experimentar a folha, mas só o próprio a assina e submete.
          </p>
        )}

        <div className="relative px-5 py-6 sm:px-10 sm:py-8">
          {/* 1 — Identificação */}
          <SectionHead n={1} title="Identificação" done />
          <IdentityStrip employee={employee} today={today} />

          {/* 2 — Erros */}
          <div className="mt-9">
            <SectionHead n={2} title="Erros a reportar" done={itemsDone} aside={`${checks.filter((c) => c.every(Boolean)).length}/${items.length} completos`} />
            <div className="flex items-start gap-3 rounded-xl border border-[#783DF5]/15 bg-[#783DF5]/[0.04] px-4 py-3">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#783DF5]" />
              <p className="text-[11.5px] leading-relaxed text-black/60">
                Podes assinar um relatório sempre que quiseres, com um ou mais erros dos últimos {REPORT_LOOKBACK_DAYS} dias.
                Por cada erro, descreve o que aconteceu e em que cliente, o motivo, como achas que deverias ter feito, se
                foi a primeira vez, a data e se te apercebeste do erro.
                <strong className="font-bold text-black/75"> Reportar é o que protege: erro de aprendizagem não é erro de recorrência.</strong>
              </p>
            </div>

            <div className="mt-5 space-y-4">
              {items.map((it, i) => (
                <ItemCard
                  key={it.key}
                  n={i + 1}
                  item={it}
                  checks={checks[i]}
                  collapsed={collapsed.has(it.key)}
                  canRemove={items.length > 1}
                  disabled={signing}
                  today={today}
                  range={range}
                  clients={clients}
                  onToggle={() => toggleItem(it.key)}
                  onChange={(patch) => updateItem(it.key, patch)}
                  onRemove={() => removeItem(it.key)}
                />
              ))}
            </div>

            <button
              type="button"
              disabled={signing || items.length >= LIMITS.maxItems}
              onClick={addItem}
              className="group mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#783DF5]/30 bg-white/40 px-4 py-3.5 text-[12.5px] font-bold text-[#4c2bb0] transition hover:border-[#783DF5]/60 hover:bg-[#783DF5]/[0.06] disabled:opacity-50"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#783DF5]/10 transition group-hover:scale-110 group-hover:bg-[#783DF5] group-hover:text-white">
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
              Registar outro erro neste relatório
            </button>
          </div>

          {/* 3 — Assinatura */}
          <div className="mt-9">
            <SectionHead n={3} title="Assinatura" done={nameOk} />
            <div ref={signatureZoneRef} className="rounded-xl border border-black/10 bg-white/55 p-4 sm:p-6">
              <div className="grid grid-cols-1 items-end gap-6 sm:grid-cols-[1fr_auto]">
                <div>
                  <label className="block">
                    <span className="sheet-label">Escreve o teu nome completo, exatamente como está na conta</span>
                    <div className="relative mt-1">
                      <PenLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />
                      <input
                        ref={signatureInputRef}
                        type="text"
                        value={signatureName}
                        disabled={signing || readOnly}
                        onChange={(e) => setSignatureName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleSign();
                          }
                        }}
                        maxLength={160}
                        placeholder={employee.fullName}
                        autoComplete="off"
                        className={`sheet-input !py-2.5 !pl-9 !text-[15px] ${signatureName && !nameOk ? "!border-rose-500/60" : nameOk ? "!border-emerald-600/60" : ""}`}
                      />
                      {nameOk && <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" strokeWidth={2.75} />}
                    </div>
                  </label>
                  {signatureName && !nameOk && (
                    <p className="mt-1 text-[10.5px] font-semibold text-rose-700">Tem de ser exatamente «{employee.fullName}».</p>
                  )}
                  {nameOk && (
                    <p className="mt-1 flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700">
                      <Check className="h-3 w-3" /> Nome confere com a conta.
                    </p>
                  )}
                  <SignatureLine
                    name={signatureName.trim()}
                    playing={signing}
                    showStamp={showStamp}
                    stampRef={submitted?.ref ?? null}
                    onDone={() => animationDoneRef.current()}
                    signatureLabel="Assinatura do consultor"
                    stampLabel="Submetido"
                  />
                </div>
                <div className="pb-1 text-right sm:min-w-[150px]">
                  <p className="border-b border-dotted border-black/30 pb-1 font-mono text-[12px] text-black/70">{formatDatePT(today)}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-black/40">Data</p>
                </div>
              </div>

              {error && (
                <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/45 bg-rose-500/[0.07] px-3.5 py-2.5 text-[12.5px] font-semibold text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => void handleSign()}
                  disabled={signing || readOnly}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-[14px] font-bold text-white shadow-[0_14px_40px_-12px_rgba(120,61,245,0.7)] transition hover:-translate-y-px hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  style={{ background: "var(--brand-gradient)" }}
                >
                  {signing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />A assinar o relatório…
                    </>
                  ) : (
                    <>
                      <PenLine className="h-4 w-4" />
                      Assinar e submeter
                    </>
                  )}
                </button>
                {!signing && readyProblem && (
                  <button
                    type="button"
                    onClick={() => next && goTo(next)}
                    className="text-left text-[11px] font-semibold text-black/45 underline decoration-dotted underline-offset-2 transition hover:text-[#4c2bb0]"
                  >
                    Falta: {readyProblem}
                  </button>
                )}
              </div>
              <p className="mt-3 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-black/40">
                <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" />
                Ao assinar, declaras que este relatório é completo e verdadeiro e que reportaste todos os erros de que tens
                conhecimento. Segue para a direção, que dá a cada erro uma pontuação de 0 a 10 antes de entrar no teu PA e NO.
              </p>
            </div>
          </div>
        </div>

        <footer className="relative rounded-b-[10px] border-t border-black/10 bg-black/[0.025] px-5 py-4 sm:px-10">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.22em] text-black/35">Reservado à direção</p>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {["Recebido", "Pontuação (0–10)", "Revisto por"].map((slot) => (
              <div key={slot} className="rounded border border-dashed border-black/20 px-2.5 py-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-black/35">{slot}</p>
                <p className="mt-1 font-mono text-[11px] text-black/30">—</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[9.5px] leading-relaxed text-black/30">
            Wonder Ads · Formulário RH-03 · Os dados desta folha destinam-se exclusivamente à gestão interna de pessoas e
            são visíveis apenas ao próprio e à direção. Nunca aos colegas.
          </p>
        </footer>
      </div>

      <ProgressDock
        sheetRef={sheetRef}
        signatureRef={signatureZoneRef}
        hidden={signing}
        pct={pct}
        next={next}
        onGo={() => (next ? goTo(next) : void handleSign())}
      />
    </section>
  );
}

/* ------------------------------------------------------------------ */

function SectionHead({ n, title, done, aside }: { n: number; title: string; done: boolean; aside?: string }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span
        aria-hidden
        className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11.5px] font-extrabold transition duration-300 ${
          done ? "scale-105 border-emerald-600 bg-emerald-600 text-white shadow-[0_6px_18px_-6px_rgba(5,150,105,0.7)]" : "border-black/25 bg-white/70 text-black/50"
        }`}
      >
        {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}
      </span>
      <h3 className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-black/65">{title}</h3>
      <span className="h-px flex-1 bg-black/[0.08]" />
      {aside && <span className="text-[10.5px] font-semibold tabular-nums text-black/40">{aside}</span>}
    </div>
  );
}

function IdentityStrip({
  employee,
  today,
}: {
  employee: { fullName: string; role: string; dept: string; avatar?: string | null };
  today: string;
}) {
  const initials = employee.fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .filter((_, i, a) => i === 0 || i === a.length - 1)
    .join("")
    .toUpperCase();
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border border-black/10 bg-white/55 px-4 py-4 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-[14px] font-extrabold text-white shadow-[0_8px_24px_-10px_rgba(120,61,245,0.8)]"
          style={{ background: "var(--brand-gradient)" }}
        >
          {employee.avatar ? (
            // Retrato 3:4 com a cabeça no topo → object-top, como no header.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={employee.avatar} alt="" className="h-full w-full object-cover object-top" />
          ) : (
            initials
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold tracking-tight">{employee.fullName}</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/40">Nome completo</p>
        </div>
      </div>
      {[
        { label: "Função", value: employee.role || "—" },
        { label: "Departamento", value: employee.dept || "—" },
        { label: "Data do relatório", value: formatDatePT(today) },
      ].map((f) => (
        <div key={f.label}>
          <p className="text-[13px] font-semibold">{f.value}</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/40">{f.label}</p>
        </div>
      ))}
    </div>
  );
}

function Counter({ value, min }: { value: string; min: number }) {
  const len = value.trim().length;
  const ok = len >= min;
  return (
    <span className={`text-[10px] font-semibold normal-case tracking-normal tabular-nums ${ok ? "text-emerald-700" : "text-black/35"}`}>
      {ok ? (
        <span className="inline-flex items-center gap-0.5">
          <Check className="h-3 w-3" strokeWidth={3} /> {len}
        </span>
      ) : (
        `${len}/${min} mín.`
      )}
    </span>
  );
}

/** Um campo da folha: rótulo com o seu visto, e o controlo por baixo. */
function Step({
  id,
  label,
  ok,
  aside,
  children,
  className = "",
}: {
  id?: string;
  label: string;
  ok: boolean;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div id={id} className={`ine-step rounded-lg transition ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
              ok ? "border-emerald-600 bg-emerald-600 text-white" : "border-black/25 bg-white"
            }`}
          >
            {ok && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
          </span>
          <span className="sheet-label">{label}</span>
        </span>
        {aside}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function AutoTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [props.value]);
  const { className, ...rest } = props;
  return <textarea ref={ref} rows={3} {...rest} className={`sheet-input resize-none overflow-hidden leading-relaxed ${className ?? ""}`} />;
}

function ItemCard({
  n,
  item,
  checks,
  collapsed,
  canRemove,
  disabled,
  today,
  range,
  clients,
  onToggle,
  onChange,
  onRemove,
}: {
  n: number;
  item: LocalItem;
  checks: boolean[];
  collapsed: boolean;
  canRemove: boolean;
  disabled: boolean;
  today: string;
  range: { min: string; max: string };
  clients: ClientChoices;
  onToggle: () => void;
  onChange: (patch: Partial<IneficaciaItemDraft>) => void;
  onRemove: () => void;
}) {
  const done = checks.filter(Boolean).length;
  const complete = done === checks.length;
  const ok = (f: FieldKey) => checks[FIELD_ORDER.indexOf(f)];
  const yesterday = addDaysISO(today, -1);

  return (
    <article
      id={`ine-item-${item.key}`}
      className={`scroll-mt-24 rounded-2xl border bg-white/65 shadow-[0_1px_0_rgba(0,0,0,0.04),0_10px_30px_-20px_rgba(20,10,40,0.35)] transition ${
        complete ? "border-emerald-600/25" : "border-black/12"
      }`}
    >
      <header className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold text-white transition ${
              complete ? "bg-emerald-600" : ""
            }`}
            style={complete ? undefined : { background: "var(--brand-gradient)" }}
          >
            {complete ? <Check className="h-4 w-4" strokeWidth={3} /> : n}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11.5px] font-extrabold uppercase tracking-[0.18em] text-black/65">Erro {n}</span>
            {collapsed ? (
              <span className="mt-0.5 block truncate text-[12px] text-black/55">
                {formatISODate(item.occurredOn)} · <strong className="font-semibold text-black/75">{item.client || "—"}</strong>
                {item.reason && ` · ${reasonLabel(item.reason, item.reasonOther)}`}
                {item.what && ` · ${item.what}`}
              </span>
            ) : (
              <span className="mt-0.5 block text-[11px] text-black/45">
                {complete ? "Completo" : `${done} de ${checks.length} campos`}
              </span>
            )}
          </span>
        </button>
        <span aria-hidden className="hidden items-center gap-1 sm:flex">
          {checks.map((c, i) => (
            <span key={i} className={`h-1.5 w-3.5 rounded-full transition ${c ? "bg-emerald-500" : "bg-black/10"}`} />
          ))}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            aria-label={`Remover o erro ${n}`}
            className="rounded-md p-1.5 text-rose-700/60 transition hover:bg-rose-500/10 hover:text-rose-700 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? `Abrir o erro ${n}` : `Fechar o erro ${n}`}
          className="rounded-md p-1.5 text-black/40 transition hover:bg-black/[0.05] hover:text-black/70"
        >
          <ChevronDown className={`h-4 w-4 transition ${collapsed ? "" : "rotate-180"}`} />
        </button>
      </header>

      {!collapsed && (
        <div className="space-y-6 border-t border-black/[0.07] px-4 pb-6 pt-5 sm:px-5">
          {/* Quando e onde */}
          <div className="grid grid-cols-1 gap-x-6 gap-y-6 md:grid-cols-2">
            <Step id={fieldId(item.key, "occurredOn")} label="Data em que ocorreu" ok={ok("occurredOn")}>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { iso: today, label: "Hoje" },
                  { iso: yesterday, label: "Ontem" },
                ].map((d) => {
                  const on = item.occurredOn === d.iso;
                  return (
                    <button
                      key={d.label}
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange({ occurredOn: d.iso })}
                      className={`rounded-lg border px-3 py-2 text-[12.5px] font-semibold transition ${
                        on ? "border-[#783DF5] bg-[#783DF5] text-white shadow-[0_6px_16px_-8px_rgba(120,61,245,0.9)]" : "border-black/15 bg-white/80 text-black/65 hover:border-black/35"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
                <div className="relative min-w-[150px] flex-1">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/35" />
                  <input
                    type="date"
                    value={item.occurredOn}
                    min={range.min}
                    max={range.max}
                    disabled={disabled}
                    onChange={(e) => onChange({ occurredOn: e.target.value })}
                    className="sheet-input !pl-8"
                  />
                </div>
              </div>
              <p className="mt-1 text-[10.5px] text-black/40">Até {REPORT_LOOKBACK_DAYS} dias atrás (desde {formatISODate(range.min)}).</p>
            </Step>

            <Step label="Cliente ou projeto" ok={ok("client")}>
              <ClientPicker
                id={fieldId(item.key, "client")}
                value={item.client}
                onChange={(v) => onChange({ client: v })}
                choices={clients}
                disabled={disabled}
              />
            </Step>
          </div>

          <Step
            id={fieldId(item.key, "what")}
            label="O erro que cometeste — o que aconteceu"
            ok={ok("what")}
            aside={<Counter value={item.what} min={LIMITS.what.min} />}
          >
            <AutoTextarea
              value={item.what}
              disabled={disabled}
              maxLength={LIMITS.what.max}
              onChange={(e) => onChange({ what: e.target.value })}
              placeholder="Descreve o que aconteceu, com factos: o quê, quando, o que ficou por fazer ou saiu mal."
            />
          </Step>

          <Step id={fieldId(item.key, "reason")} label="Qual o motivo" ok={ok("reason")}>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {REASONS.map((r) => {
                const on = item.reason === r.id;
                const Icon = REASON_ICONS[r.id];
                return (
                  <button
                    key={r.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange({ reason: r.id })}
                    aria-pressed={on}
                    className={`group relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition ${
                      on
                        ? "border-[#783DF5] bg-[#783DF5]/[0.07] shadow-[0_10px_24px_-16px_rgba(120,61,245,0.9)]"
                        : "border-black/12 bg-white/75 hover:-translate-y-px hover:border-black/30"
                    }`}
                  >
                    <span className="flex w-full items-center justify-between">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                          on ? "bg-[#783DF5] text-white" : "bg-black/[0.05] text-black/50 group-hover:text-black/70"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className={`font-mono text-[11px] font-bold ${on ? "text-[#783DF5]" : "text-black/30"}`}>{r.letter}</span>
                    </span>
                    <span>
                      <span className="block text-[12.5px] font-bold leading-snug text-black/85">{r.label}</span>
                      <span className="mt-0.5 block text-[10.5px] leading-snug text-black/45">{r.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {item.reason === "outro" && (
              <input
                type="text"
                value={item.reasonOther}
                disabled={disabled}
                maxLength={LIMITS.reasonOther.max}
                onChange={(e) => onChange({ reasonOther: e.target.value })}
                placeholder="Especifica o motivo"
                autoFocus
                className="sheet-input mt-2"
              />
            )}
          </Step>

          <Step
            id={fieldId(item.key, "shouldHave")}
            label="Como achas que deverias ter feito"
            ok={ok("shouldHave")}
            aside={<Counter value={item.shouldHave} min={LIMITS.shouldHave.min} />}
          >
            <AutoTextarea
              value={item.shouldHave}
              disabled={disabled}
              maxLength={LIMITS.shouldHave.max}
              onChange={(e) => onChange({ shouldHave: e.target.value })}
              placeholder="O que farias de diferente para não voltar a acontecer."
            />
          </Step>

          <Step id={fieldId(item.key, "firstTime")} label="Foi a primeira vez que cometeste este erro?" ok={ok("firstTime")}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                { v: true, label: "Sim, foi a primeira vez", Icon: Sparkles },
                { v: false, label: "Não, já me tinha acontecido", Icon: Repeat },
              ].map((o) => {
                const on = item.firstTime === o.v;
                return (
                  <button
                    key={o.label}
                    type="button"
                    disabled={disabled}
                    aria-pressed={on}
                    onClick={() => onChange({ firstTime: o.v, lastTime: o.v ? "" : item.lastTime })}
                    className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-[12.5px] font-semibold transition ${
                      on ? "border-[#783DF5] bg-[#783DF5]/[0.07] text-black/85" : "border-black/12 bg-white/75 text-black/65 hover:border-black/30"
                    }`}
                  >
                    <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${on ? "bg-[#783DF5] text-white" : "bg-black/[0.05] text-black/45"}`}>
                      <o.Icon className="h-3.5 w-3.5" />
                    </span>
                    {o.label}
                  </button>
                );
              })}
            </div>
            {item.firstTime === false && (
              <div className="mt-2.5 rounded-xl border border-black/10 bg-white/60 p-3">
                <p className="text-[10.5px] font-semibold text-black/50">Quando foi a última vez?</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {LAST_TIME_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange({ lastTime: s })}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                        item.lastTime === s ? "border-[#783DF5] bg-[#783DF5] text-white" : "border-black/15 bg-white text-black/55 hover:border-black/35"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={item.lastTime}
                  disabled={disabled}
                  maxLength={LIMITS.lastTime.max}
                  onChange={(e) => onChange({ lastTime: e.target.value })}
                  placeholder="Ou escreve: ex. «em agosto, no relatório da Fisio Restelo»"
                  className="sheet-input mt-2"
                />
              </div>
            )}
          </Step>

          <Step id={fieldId(item.key, "noticed")} label="Percebeste o erro que cometeste?" ok={ok("noticed")}>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {NOTICED_OPTIONS.map((o) => {
                const on = item.noticed === o.id;
                const Icon = NOTICED_ICONS[o.id];
                return (
                  <button
                    key={o.id}
                    type="button"
                    disabled={disabled}
                    aria-pressed={on}
                    onClick={() => onChange({ noticed: o.id })}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                      on ? "border-[#783DF5] bg-[#783DF5]/[0.07] shadow-[0_10px_24px_-16px_rgba(120,61,245,0.9)]" : "border-black/12 bg-white/75 hover:border-black/30"
                    }`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${on ? "bg-[#783DF5] text-white" : "bg-black/[0.05] text-black/45"}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span>
                      <span className="block text-[12px] font-bold leading-snug text-black/80">{o.label}</span>
                      <span className="mt-0.5 block text-[10.5px] leading-snug text-black/45">{o.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Step>
        </div>
      )}
    </article>
  );
}

/** A doca do fundo do ecrã: quanto falta e um botão que leva lá. Só aparece
 *  com a folha à vista e a zona da assinatura fora dela. Vai num portal
 *  porque o fade-up da página deixa um `transform` nos antepassados, e isso
 *  prende o `position: fixed` ao contentor em vez do ecrã. */
function ProgressDock({
  sheetRef,
  signatureRef,
  hidden,
  pct,
  next,
  onGo,
}: {
  sheetRef: RefObject<HTMLDivElement | null>;
  signatureRef: RefObject<HTMLDivElement | null>;
  hidden: boolean;
  pct: number;
  next: Target | null;
  onGo: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [sheetIn, setSheetIn] = useState(false);
  const [sigIn, setSigIn] = useState(false);

  useEffect(() => {
    setMounted(true);
    const sheet = sheetRef.current;
    const sig = signatureRef.current;
    if (!sheet || !sig || typeof IntersectionObserver === "undefined") return;
    const a = new IntersectionObserver(([e]) => setSheetIn(e.isIntersecting), { rootMargin: "-120px 0px -120px 0px" });
    const b = new IntersectionObserver(([e]) => setSigIn(e.isIntersecting), { threshold: 0.35 });
    a.observe(sheet);
    b.observe(sig);
    return () => {
      a.disconnect();
      b.disconnect();
    };
  }, [sheetRef, signatureRef]);

  if (!mounted) return null;
  const visible = sheetIn && !sigIn && !hidden;
  const label =
    next === null
      ? "Tudo pronto — falta só carregar em assinar"
      : next.kind === "signature"
        ? "Erros completos — falta a tua assinatura"
        : `Erro ${next.n}: falta ${FIELD_MISSING[next.field]}`;
  const r = 13;
  const c = 2 * Math.PI * r;

  return createPortal(
    <div
      aria-hidden={!visible}
      className={`pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4 transition duration-300 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      }`}
    >
      <div className="pointer-events-auto flex max-w-full items-center gap-3 rounded-full border border-white/12 bg-[#16141d]/90 py-1.5 pl-1.5 pr-1.5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
          <svg viewBox="0 0 32 32" className="absolute inset-0 h-full w-full -rotate-90">
            <defs>
              <linearGradient id="ine-dock-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#783DF5" />
                <stop offset="100%" stopColor="#C535C9" />
              </linearGradient>
            </defs>
            <circle cx="16" cy="16" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
            <circle
              cx="16"
              cy="16"
              r={r}
              fill="none"
              stroke="url(#ine-dock-grad)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - pct / 100)}
              className="transition-[stroke-dashoffset] duration-500"
            />
          </svg>
          <span className="relative text-[9.5px] font-bold tabular-nums text-white/85">{pct}%</span>
        </span>
        <p className="min-w-0 truncate text-[12.5px] font-medium text-white/80">{label}</p>
        <button
          type="button"
          tabIndex={visible ? 0 : -1}
          onClick={onGo}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-bold text-white transition hover:brightness-110"
          style={{ background: "var(--brand-gradient)" }}
        >
          {next === null ? (
            <>
              <PenLine className="h-3.5 w-3.5" /> Assinar
            </>
          ) : (
            <>
              Ir <ArrowDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
    </div>,
    document.body,
  );
}

function SuccessPanel({ report, onNew }: { report: IneficaciaReport; onNew: () => void }) {
  const n = report.items.length;
  return (
    <section className="animate-fade-up mx-auto w-full max-w-[920px] overflow-hidden rounded-3xl border border-emerald-400/25 bg-emerald-400/[0.05] p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300 shadow-[0_12px_40px_-14px_rgba(52,211,153,0.8)]">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="readout text-emerald-200/70">Submetido</p>
          <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-white">
            Relatório <span className="font-mono text-emerald-200">{report.ref}</span> assinado a {formatISODate(report.submittedOn)}
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-white/65">
            {n} {n === 1 ? "ocorrência segue" : "ocorrências seguem"} para a direção. Cada uma recebe uma pontuação de 0 a 10
            e só depois entra no teu PA e NO — recebes um aviso no sino quando estiver pontuado.
          </p>
          <p className="mt-3 text-[11.5px] text-white/40">
            O relatório fica em «Os meus relatórios», mais abaixo, com a assinatura e a impressão digital do conteúdo.
          </p>
          <button
            type="button"
            onClick={onNew}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.06] px-4 py-2 text-[12.5px] font-semibold text-white/85 transition hover:bg-white/[0.1]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Assinar outro relatório
          </button>
        </div>
      </div>
    </section>
  );
}
