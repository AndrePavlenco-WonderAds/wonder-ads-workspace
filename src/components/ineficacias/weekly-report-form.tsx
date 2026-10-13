"use client";

// A folha RH-03 — o relatório semanal de ineficácias que o consultor
// assina. Papel claro sobre a app escura, como as folhas de RH das
// ausências, porque isto é um DOCUMENTO: zero ou mais erros, cada um com os
// seus campos obrigatórios, e no fim a declaração + o nome completo tal como
// está na conta + «Assinar e submeter».
//
// A assinatura reutiliza a escrita à mão das ausências (SignatureLine): o
// nome escreve-se letra a letra enquanto o POST segue, e o carimbo de
// SUBMETIDO só cai quando as duas coisas acabaram. Se o servidor recusar, a
// folha volta atrás inteira, com o erro à vista e nada perdido.

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CalendarDays,
  Check,
  Eye,
  Loader2,
  PenLine,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { SheetField, SheetSection, SignatureLine, formatDatePT } from "@/components/absences/sheet";
import {
  DECLARATION_TEXT,
  LIMITS,
  NOTICED_OPTIONS,
  REASONS,
  nameMatches,
  validateReport,
  weekLabel,
  weekRange,
  type IneficaciaItemDraft,
  type IneficaciaReport,
  type ReportDraft,
} from "@/lib/ineficacias/shared";

type LocalItem = IneficaciaItemDraft & { key: string };

function blankItem(): LocalItem {
  return {
    key: crypto.randomUUID(),
    what: "",
    client: "",
    reason: null,
    reasonOther: "",
    shouldHave: "",
    firstTime: null,
    lastTime: "",
    occurredOn: "",
    noticed: null,
  };
}

type Phase = "fill" | "signing" | "done";

export type WeekOption = { key: string; label: string; start: string; end: string };

export function WeeklyReportForm({
  employee,
  weeks,
  today,
  readOnly = false,
}: {
  employee: { username: string; name: string; fullName: string; role: string; dept: string };
  /** As semanas que ainda pode reportar (a anterior primeiro). */
  weeks: WeekOption[];
  today: string;
  /** «Ver como» ativo — a folha mostra-se, mas não assina. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [weekKey, setWeekKey] = useState(weeks[0]?.key ?? "");
  const [noErrors, setNoErrors] = useState(false);
  const [items, setItems] = useState<LocalItem[]>([]);
  const [declaration, setDeclaration] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [phase, setPhase] = useState<Phase>("fill");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<IneficaciaReport | null>(null);
  const [showStamp, setShowStamp] = useState(false);
  const signatureZoneRef = useRef<HTMLDivElement | null>(null);
  const animationDoneRef = useRef<() => void>(() => {});

  const week = useMemo(() => weekRange(weekKey), [weekKey]);
  const dateMax = week ? (week.end < today ? week.end : today) : today;

  const draft: ReportDraft = useMemo(
    () => ({ weekKey, noErrors, items, declaration, signatureName }),
    [weekKey, noErrors, items, declaration, signatureName],
  );
  const readyProblem = useMemo(
    () => validateReport(draft, { todayISO: today, expectedName: employee.fullName, allowedWeeks: weeks.map((w) => w.key) }),
    [draft, today, employee.fullName, weeks],
  );

  const sectionOk = {
    week: Boolean(week),
    items: noErrors ? items.length === 0 : items.length > 0 && !readyProblem?.startsWith("Erro "),
    signature: declaration && nameMatches(signatureName, employee.fullName),
  };
  const nameOk = signatureName.trim().length > 0 && nameMatches(signatureName, employee.fullName);

  function updateItem(key: string, patch: Partial<IneficaciaItemDraft>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setNoErrors(false);
    setItems((prev) => [...prev, blankItem()]);
  }
  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }

  const submit = useCallback(async (): Promise<{ ok: true; report: IneficaciaReport } | { ok: false; message: string }> => {
    try {
      const res = await fetch("/api/ineficacias", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          weekKey,
          noErrors,
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
          declaration,
          signatureName,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { report?: IneficaciaReport; error?: string };
      if (!res.ok || !data.report) return { ok: false, message: data.error ?? "Não foi possível submeter — tenta outra vez." };
      return { ok: true, report: data.report };
    } catch {
      return { ok: false, message: "Falha de rede — o relatório não foi submetido." };
    }
  }, [weekKey, noErrors, items, declaration, signatureName]);

  const handleSign = useCallback(async () => {
    if (phase !== "fill" || readOnly) return;
    if (readyProblem) {
      setError(readyProblem);
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
  }, [phase, readOnly, readyProblem, submit, router]);

  const signing = phase !== "fill";

  if (phase === "done" && submitted) {
    return <SuccessPanel report={submitted} />;
  }

  if (weeks.length === 0) {
    return (
      <div className="animate-fade-up rounded-3xl border border-dashed border-white/12 px-6 py-10 text-center">
        <ShieldCheck className="mx-auto h-7 w-7 text-emerald-300/70" />
        <p className="mt-3 text-[14px] font-medium text-white/80">Tudo em dia.</p>
        <p className="mt-1 text-[12.5px] text-white/45">
          Não há nenhum relatório por assinar. O da semana corrente abre na sexta-feira e fica disponível até à
          segunda-feira seguinte.
        </p>
      </div>
    );
  }

  return (
    <section aria-label="Relatório semanal de ineficácias" className="relative mx-auto w-full max-w-[900px]">
      <div className="relative overflow-hidden rounded-[6px] bg-gradient-to-b from-[#fbfaf7] to-[#f0eee8] text-[#20202a] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.06)]">
        <div aria-hidden className="h-1.5 w-full" style={{ background: "var(--brand-gradient)" }} />
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] select-none whitespace-nowrap text-[110px] font-extrabold tracking-[0.3em] text-black/[0.028]"
        >
          WONDER ADS
        </span>

        <header className="relative flex flex-wrap items-start justify-between gap-4 border-b border-black/10 px-6 pb-5 pt-6 sm:px-10">
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
          </div>
          <div className="rounded border border-black/15 bg-white/70 px-3.5 py-2 text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/50">Formulário RH-03</p>
            <p className="text-[13px] font-extrabold uppercase tracking-[0.08em]">Relatório semanal de ineficácias</p>
            <p className="mt-0.5 font-mono text-[10.5px] text-black/45">Ref.ª atribuída na submissão · {formatDatePT(today)}</p>
          </div>
        </header>

        {readOnly && (
          <p className="relative mx-6 mt-5 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-100/70 px-3.5 py-2.5 text-[12px] font-semibold text-amber-900 sm:mx-10">
            <Eye className="h-4 w-4" />
            Estás a ver a app como outra pessoa — podes experimentar a folha, mas só o próprio a assina e submete.
          </p>
        )}

        <div className="relative px-6 py-6 sm:px-10 sm:py-8">
          {/* 1 — Identificação + semana */}
          <SheetSection n={1} title="Identificação e semana" done={sectionOk.week}>
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <SheetField label="Nome completo" value={employee.fullName} />
              <SheetField label="Função" value={employee.role || "—"} />
              <SheetField label="Departamento" value={employee.dept || "—"} />
              <div>
                <span className="sheet-label">Semana do relatório</span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {weeks.map((w) => {
                    const on = w.key === weekKey;
                    return (
                      <button
                        key={w.key}
                        type="button"
                        disabled={signing}
                        onClick={() => {
                          setWeekKey(w.key);
                          // As datas dos erros são da semana — mudar de semana limpa-as.
                          setItems((prev) => prev.map((it) => ({ ...it, occurredOn: "" })));
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition ${
                          on
                            ? "border-[#783DF5] bg-[#783DF5]/10 text-[#4c2bb0]"
                            : "border-black/15 bg-white/70 text-black/60 hover:border-black/30"
                        }`}
                      >
                        <CalendarDays className="h-3.5 w-3.5" />
                        {w.label}
                      </button>
                    );
                  })}
                </div>
                {week && week.end >= today && (
                  <p className="mt-1.5 text-[10.5px] text-black/40">
                    A semana ainda está a decorrer — só podes registar erros até hoje ({formatDatePT(today)}).
                  </p>
                )}
              </div>
            </div>
          </SheetSection>

          {/* 2 — Ocorrências */}
          <SheetSection n={2} title="Erros cometidos esta semana" done={sectionOk.items}>
            <p className="text-[11.5px] leading-relaxed text-black/55">
              Cada relatório tem zero ou mais erros. Por cada erro, descreve o que aconteceu e em que cliente, o
              motivo, como achas que deverias ter feito, se foi a primeira vez, a data e se te apercebeste do erro.
              <strong className="font-bold text-black/70"> Reportar é o que protege: erro de aprendizagem não é erro de recorrência.</strong>
            </p>

            <div className="mt-4 space-y-4">
              {items.map((it, i) => (
                <ItemCard
                  key={it.key}
                  n={i + 1}
                  item={it}
                  disabled={signing}
                  dateMin={week?.start ?? ""}
                  dateMax={dateMax}
                  onChange={(patch) => updateItem(it.key, patch)}
                  onRemove={() => removeItem(it.key)}
                />
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={signing || items.length >= LIMITS.maxItems}
                onClick={addItem}
                className="inline-flex items-center gap-2 rounded-lg border border-[#783DF5]/40 bg-[#783DF5]/[0.06] px-3.5 py-2 text-[12.5px] font-bold text-[#4c2bb0] transition hover:bg-[#783DF5]/[0.12] disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {items.length === 0 ? "Registar um erro" : "Registar outro erro"}
              </button>
              {items.length === 0 && (
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-black/12 bg-white/70 px-3.5 py-2 text-[12.5px] font-semibold text-black/70">
                  <input
                    type="checkbox"
                    checked={noErrors}
                    disabled={signing}
                    onChange={(e) => setNoErrors(e.target.checked)}
                    className="h-4 w-4 accent-[#783DF5]"
                  />
                  <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                  Não cometi nenhum erro de que tenha conhecimento esta semana
                </label>
              )}
            </div>
          </SheetSection>

          {/* 3 — Declaração e assinatura */}
          <SheetSection n={3} title="Declaração e assinatura" done={sectionOk.signature} last>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-black/10 bg-white/60 px-4 py-3">
              <input
                type="checkbox"
                checked={declaration}
                disabled={signing}
                onChange={(e) => setDeclaration(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#783DF5]"
              />
              <span className="text-[12px] leading-relaxed text-black/70">
                <strong className="font-bold text-black/85">{DECLARATION_TEXT}</strong>
                <span className="mt-1 block text-[10.5px] text-black/45">
                  A submissão fica registada com a data e hora (UTC), o teu utilizador, o IP, o browser e uma impressão
                  digital SHA-256 do conteúdo — o relatório não pode ser alterado depois de assinado.
                </span>
              </span>
            </label>

            <div ref={signatureZoneRef} className="mt-5 grid grid-cols-1 items-end gap-6 sm:grid-cols-[1fr_auto]">
              <div>
                <label className="block">
                  <span className="sheet-label">Assinatura — escreve o teu nome completo, exatamente como está na conta</span>
                  <input
                    type="text"
                    value={signatureName}
                    disabled={signing || readOnly}
                    onChange={(e) => setSignatureName(e.target.value)}
                    maxLength={160}
                    placeholder="Nome completo"
                    autoComplete="off"
                    className={`sheet-input mt-1 ${signatureName && !nameOk ? "!border-rose-500/60" : nameOk ? "!border-emerald-600/60" : ""}`}
                  />
                </label>
                {signatureName && !nameOk && (
                  <p className="mt-1 text-[10.5px] font-semibold text-rose-700">
                    Tem de ser exatamente «{employee.fullName}».
                  </p>
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

            <button
              type="button"
              onClick={() => void handleSign()}
              disabled={signing || readOnly}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3.5 text-[14px] font-bold text-white shadow-[0_14px_40px_-12px_rgba(120,61,245,0.7)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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
            <p className="mt-2 text-[10.5px] text-black/40">
              {!signing && readyProblem
                ? `Falta: ${readyProblem}`
                : "Ao carregar, a tua assinatura é escrita na folha e o relatório segue para a direção — cada ocorrência recebe uma pontuação de 0 a 10 antes de entrar no teu PA e NO."}
            </p>
          </SheetSection>
        </div>

        <footer className="relative border-t border-black/10 bg-black/[0.025] px-6 py-4 sm:px-10">
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
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Counter({ value, min }: { value: string; min: number }) {
  const len = value.trim().length;
  const ok = len >= min;
  return (
    <span className={`text-[10px] tabular-nums ${ok ? "text-emerald-700" : "text-black/35"}`}>
      {ok ? <Check className="inline h-3 w-3" /> : `${len}/${min}`}
    </span>
  );
}

function ItemCard({
  n,
  item,
  disabled,
  dateMin,
  dateMax,
  onChange,
  onRemove,
}: {
  n: number;
  item: LocalItem;
  disabled: boolean;
  dateMin: string;
  dateMax: string;
  onChange: (patch: Partial<IneficaciaItemDraft>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-black/12 bg-white/55 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[11.5px] font-extrabold uppercase tracking-[0.18em] text-black/60">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#783DF5] text-[11px] text-white">{n}</span>
          Erro {n}
        </p>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold text-rose-700/80 transition hover:bg-rose-500/10 hover:text-rose-700 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remover
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <label className="block">
          <span className="sheet-label">Data em que ocorreu (dentro da semana)</span>
          <input
            type="date"
            value={item.occurredOn}
            min={dateMin}
            max={dateMax}
            disabled={disabled}
            onChange={(e) => onChange({ occurredOn: e.target.value })}
            className="sheet-input mt-1"
          />
        </label>
        <label className="block">
          <span className="sheet-label">Cliente ou projeto</span>
          <input
            type="text"
            value={item.client}
            disabled={disabled}
            maxLength={LIMITS.client.max}
            onChange={(e) => onChange({ client: e.target.value })}
            placeholder="Ex.: Fisio Restelo · relatório mensal — ou «Interno»"
            className="sheet-input mt-1"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="sheet-label flex items-center justify-between">
            <span>O erro que cometeste — o que aconteceu</span>
            <Counter value={item.what} min={LIMITS.what.min} />
          </span>
          <textarea
            value={item.what}
            disabled={disabled}
            maxLength={LIMITS.what.max}
            rows={3}
            onChange={(e) => onChange({ what: e.target.value })}
            placeholder="Descreve o que aconteceu, com factos: o quê, quando, o que ficou por fazer ou saiu mal."
            className="sheet-input mt-1 resize-y"
          />
        </label>

        <div className="sm:col-span-2">
          <span className="sheet-label">Qual o motivo</span>
          <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {REASONS.map((r) => {
              const on = item.reason === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ reason: r.id })}
                  className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition ${
                    on ? "border-[#783DF5] bg-[#783DF5]/[0.08]" : "border-black/12 bg-white/70 hover:border-black/30"
                  }`}
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-extrabold ${on ? "bg-[#783DF5] text-white" : "bg-black/[0.06] text-black/60"}`}>
                    {r.letter}
                  </span>
                  <span>
                    <span className="block text-[12.5px] font-semibold text-black/80">{r.label}</span>
                    <span className="block text-[10.5px] text-black/45">{r.hint}</span>
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
              className="sheet-input mt-2"
            />
          )}
        </div>

        <label className="block sm:col-span-2">
          <span className="sheet-label flex items-center justify-between">
            <span>Como achas que deverias ter feito</span>
            <Counter value={item.shouldHave} min={LIMITS.shouldHave.min} />
          </span>
          <textarea
            value={item.shouldHave}
            disabled={disabled}
            maxLength={LIMITS.shouldHave.max}
            rows={3}
            onChange={(e) => onChange({ shouldHave: e.target.value })}
            placeholder="O que farias de diferente para não voltar a acontecer."
            className="sheet-input mt-1 resize-y"
          />
        </label>

        <div>
          <span className="sheet-label">Foi a primeira vez que cometeste este erro?</span>
          <div className="mt-1.5 inline-flex overflow-hidden rounded-lg border border-black/15 bg-white/70">
            {[
              { v: true, label: "Sim" },
              { v: false, label: "Não" },
            ].map((o) => {
              const on = item.firstTime === o.v;
              return (
                <button
                  key={o.label}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ firstTime: o.v, lastTime: o.v ? "" : item.lastTime })}
                  className={`px-4 py-1.5 text-[12.5px] font-semibold transition ${on ? "bg-[#783DF5] text-white" : "text-black/60 hover:bg-black/[0.04]"}`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          {item.firstTime === false && (
            <input
              type="text"
              value={item.lastTime}
              disabled={disabled}
              maxLength={LIMITS.lastTime.max}
              onChange={(e) => onChange({ lastTime: e.target.value })}
              placeholder="Quando foi a última vez?"
              className="sheet-input mt-2"
            />
          )}
        </div>

        <div>
          <span className="sheet-label">Percebeste o erro que cometeste?</span>
          <div className="mt-1.5 space-y-1.5">
            {NOTICED_OPTIONS.map((o) => {
              const on = item.noticed === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ noticed: o.id })}
                  className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-[12px] transition ${
                    on ? "border-[#783DF5] bg-[#783DF5]/[0.08] text-black/85" : "border-black/12 bg-white/70 text-black/65 hover:border-black/30"
                  }`}
                >
                  <span className={`h-3 w-3 shrink-0 rounded-full border-2 ${on ? "border-[#783DF5] bg-[#783DF5]" : "border-black/30"}`} />
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SuccessPanel({ report }: { report: IneficaciaReport }) {
  const n = report.items.length;
  return (
    <section className="animate-fade-up mx-auto w-full max-w-[900px] rounded-3xl border border-emerald-400/25 bg-emerald-400/[0.05] p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300 shadow-[0_12px_40px_-14px_rgba(52,211,153,0.8)]">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="readout text-emerald-200/70">Submetido</p>
          <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-white">
            Relatório <span className="font-mono text-emerald-200">{report.ref}</span> assinado — {weekLabel(report.weekKey)}
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-white/65">
            {report.noErrors
              ? "Declaraste que não houve erros esta semana. A direção vai confirmar a receção."
              : `${n} ${n === 1 ? "ocorrência" : "ocorrências"} ${n === 1 ? "segue" : "seguem"} para a direção. Cada uma recebe uma pontuação de 0 a 10 e só depois entra no teu PA e NO — recebes um aviso no sino quando estiver pontuado.`}
          </p>
          <p className="mt-3 text-[11.5px] text-white/40">
            O relatório fica em «Os meus relatórios», mais abaixo, com a assinatura e a impressão digital do conteúdo.
          </p>
        </div>
      </div>
    </section>
  );
}
