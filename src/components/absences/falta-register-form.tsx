"use client";

// A folha de REGISTO DE FALTA — RH-02. O outro lado da RH-01: aqui não se
// pede nada, afirma-se um facto. Só o C-Level a abre (a página vive sob o
// gate de /admin e a API volta a verificar), e ela nasce já fechada — não há
// fila de aprovação, há uma pessoa a ser informada.
//
// É o MESMO PAPEL da folha de pedido, de propósito. Um registo de falta é o
// documento mais sensível que esta app escreve sobre uma pessoa; se fosse um
// formulário de cockpit, entre um dropdown e um toast, lançava-se uma falta
// com a mesma leveza com que se arquiva um ticket. Aqui há de assinar-se com
// o nome — à mão, letra a letra — e o carimbo diz REGISTADO.
//
// A DIFERENÇA DE TOM face à RH-01: o papel tem uma tarja âmbar no topo e a
// secção 5 diz por palavras o que vai acontecer a seguir — que a pessoa
// recebe isto no sino, com o motivo e o nome de quem assinou.

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import {
  AlertTriangle,
  CalendarRange,
  Check,
  Clock,
  DoorOpen,
  FileText,
  HeartPulse,
  Loader2,
  Paperclip,
  PenLine,
  Search,
  ShieldCheck,
  Sun,
  Sunrise,
  Sunset,
  X,
} from "lucide-react";
import {
  addDaysISO,
  fileSizeLabel,
  formatDatePT,
  SheetField,
  SheetSection,
  SignatureLine,
  todayISO,
} from "./sheet";
import {
  absenceDuration,
  FALTA_REASONS,
  faltaReasonById,
  formatDayCount,
  justifiedLabel,
  MAX_ABSENCE_CALENDAR_DAYS,
  validateFaltaDraft,
  type AbsenceAttachment,
  type AbsencePeriodKind,
  type AbsenceRequest,
  type FaltaReasonId,
} from "@/lib/absences-shared";

export type FaltaTarget = {
  username: string;
  name: string;
  role: string;
  dept: string;
};

const REASON_ICONS: Record<FaltaReasonId, typeof AlertTriangle> = {
  injustificada: AlertTriangle,
  justificada: FileText,
  atraso: Clock,
  "saida-antecipada": DoorOpen,
  "doenca-sem-aviso": HeartPulse,
  outro: PenLine,
};

type Phase = "fill" | "signing" | "done";

export function FaltaRegisterForm({
  people,
  registrar,
}: {
  people: FaltaTarget[];
  registrar: { username: string; name: string };
}) {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [query, setQuery] = useState("");
  const [periodKind, setPeriodKind] = useState<AbsencePeriodKind>("full-day");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState<FaltaReasonId | null>(null);
  const [justifiedChoice, setJustifiedChoice] = useState<boolean | null>(null);
  const [details, setDetails] = useState("");
  const [attachment, setAttachment] = useState<AbsenceAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [signatureName, setSignatureName] = useState("");
  const [phase, setPhase] = useState<Phase>("fill");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<AbsenceRequest | null>(null);
  const [showStamp, setShowStamp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const signatureZoneRef = useRef<HTMLDivElement | null>(null);

  const registerDate = useMemo(() => todayISO(), []);
  const single = periodKind !== "multi-day";
  const effectiveEnd = single ? startDate : endDate;

  const target = people.find((p) => p.username === username) ?? null;
  const reasonMeta = faltaReasonById(reason);
  // Nos motivos com marca fixa, é o catálogo que manda; só o "Outro motivo"
  // pergunta ao C-Level se conta como justificada.
  const justified =
    reasonMeta && reasonMeta.justified !== null
      ? reasonMeta.justified
      : justifiedChoice;

  const shownPeople = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.username.toLowerCase().includes(q) ||
        p.dept.toLowerCase().includes(q),
    );
  }, [people, query]);

  const duration = useMemo(
    () =>
      startDate && effectiveEnd
        ? absenceDuration(periodKind, startDate, effectiveEnd)
        : null,
    [periodKind, startDate, effectiveEnd],
  );
  const overLimit = Boolean(
    duration && duration.calendarDays > MAX_ABSENCE_CALENDAR_DAYS,
  );

  const draft = useMemo(
    () => ({
      username,
      periodKind,
      startDate,
      endDate: effectiveEnd,
      reason,
      justified,
      details,
      signatureName,
    }),
    [username, periodKind, startDate, effectiveEnd, reason, justified, details, signatureName],
  );

  const sectionOk = {
    person: Boolean(target),
    period: Boolean(
      startDate && effectiveEnd && duration && duration.calendarDays > 0 && !overLimit,
    ),
    reason: Boolean(reason && justified !== null),
    detail: Boolean(reason !== "outro" || details.trim().length >= 10),
    signature: signatureName.trim().length >= 3,
  };

  const readyProblem = validateFaltaDraft(draft);

  async function pickFile(file: File | null) {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const blob = await upload(`faltas/${username || "sem-pessoa"}/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/files/upload",
      });
      setAttachment({
        url: blob.url,
        name: file.name,
        size: file.size,
        contentType: file.type,
      });
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? `O upload falhou: ${err.message}`
          : "O upload falhou — tenta outra vez.",
      );
    } finally {
      setUploading(false);
    }
  }

  const submitFalta = useCallback(async (): Promise<
    { ok: true; record: AbsenceRequest } | { ok: false; message: string }
  > => {
    try {
      const res = await fetch("/api/absences/falta", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username,
          periodKind,
          startDate,
          endDate: effectiveEnd,
          reason,
          justified,
          details,
          attachment,
          signatureName,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        record?: AbsenceRequest;
        error?: string;
      };
      if (!res.ok || !data.record) {
        return {
          ok: false,
          message: data.error ?? "Não foi possível registar — tenta outra vez.",
        };
      }
      return { ok: true, record: data.record };
    } catch {
      return { ok: false, message: "Falha de rede — a falta não foi registada." };
    }
  }, [username, periodKind, startDate, effectiveEnd, reason, justified, details, attachment, signatureName]);

  const animationDoneRef = useRef<() => void>(() => {});
  const handleSign = useCallback(async () => {
    if (phase !== "fill") return;
    const problem = validateFaltaDraft(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setPhase("signing");
    signatureZoneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

    const animation = new Promise<void>((resolve) => {
      animationDoneRef.current = resolve;
    });
    const [outcome] = await Promise.all([submitFalta(), animation]);

    if (!outcome.ok) {
      setPhase("fill");
      setError(outcome.message);
      return;
    }
    setSubmitted(outcome.record);
    setShowStamp(true);
    setTimeout(() => {
      setPhase("done");
      router.refresh();
    }, 1100);
  }, [phase, draft, submitFalta, router]);

  function resetForm() {
    setUsername("");
    setQuery("");
    setPeriodKind("full-day");
    setStartDate(todayISO());
    setEndDate("");
    setReason(null);
    setJustifiedChoice(null);
    setDetails("");
    setAttachment(null);
    setSignatureName("");
    setSubmitted(null);
    setShowStamp(false);
    setError(null);
    setPhase("fill");
  }

  const signing = phase !== "fill";

  if (phase === "done" && submitted) {
    return <SuccessPanel record={submitted} onNew={resetForm} />;
  }

  return (
    <section
      aria-label="Folha de registo de falta"
      className="relative mx-auto w-full max-w-[860px]"
    >
      <div className="relative overflow-hidden rounded-[6px] bg-gradient-to-b from-[#fbfaf7] to-[#f0eee8] text-[#20202a] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.06)]">
        {/* Tarja âmbar — esta folha não é a mesma coisa que um pedido, e o
            papel diz isso à primeira vista. */}
        <div
          aria-hidden
          className="h-1.5 w-full"
          style={{ background: "linear-gradient(90deg,#f59e0b,#ef4444)" }}
        />

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
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "var(--brand-gradient)" }}
              >
                Ads
              </span>
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-black/45">
              Recursos Humanos · Direção
            </p>
          </div>
          <div className="rounded border border-amber-600/30 bg-amber-50/80 px-3.5 py-2 text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-800/70">
              Formulário RH-02
            </p>
            <p className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-amber-900">
              Registo de Falta
            </p>
            <p className="mt-0.5 font-mono text-[10.5px] text-amber-800/60">
              Ref.ª atribuída no registo · {formatDatePT(registerDate)}
            </p>
          </div>
        </header>

        <div className="relative px-6 py-6 sm:px-10 sm:py-8">
          {/* 1 — Colaborador */}
          <SheetSection n={1} title="Colaborador" done={sectionOk.person}>
            {people.length > 8 && (
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/30" />
                <input
                  type="text"
                  value={query}
                  disabled={signing}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Procurar por nome ou departamento…"
                  className="sheet-input pl-9"
                />
              </div>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {shownPeople.map((p) => {
                const active = username === p.username;
                return (
                  <button
                    key={p.username}
                    type="button"
                    disabled={signing}
                    onClick={() => setUsername(p.username)}
                    aria-pressed={active}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition ${
                      active
                        ? "border-[#783DF5] bg-[#783DF5]/[0.07] shadow-[inset_0_0_0_1px_#783DF5]"
                        : "border-black/15 bg-white/70 hover:border-[#783DF5]/50"
                    } disabled:opacity-60`}
                  >
                    <span
                      aria-hidden
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white ${
                        active ? "bg-[#5c2ed0]" : "bg-black/25"
                      }`}
                    >
                      {p.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-[12.5px] font-bold ${active ? "text-[#3d1f96]" : "text-black/75"}`}
                      >
                        {p.name}
                      </span>
                      <span className="block truncate text-[10px] uppercase tracking-[0.12em] text-black/40">
                        {p.role || "—"} · {p.dept || "—"}
                      </span>
                    </span>
                    {active && <Check className="h-3.5 w-3.5 shrink-0 text-[#5c2ed0]" />}
                  </button>
                );
              })}
              {shownPeople.length === 0 && (
                <p className="col-span-full py-3 text-center text-[12px] text-black/40">
                  Ninguém com esse nome.
                </p>
              )}
            </div>

            {target && (
              <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 border-t border-black/[0.07] pt-4 sm:grid-cols-2">
                <SheetField label="Nome completo" value={target.name} />
                <SheetField label="Função" value={target.role || "—"} />
                <SheetField label="Departamento" value={target.dept || "—"} />
                <SheetField label="Data do registo" value={formatDatePT(registerDate)} />
              </div>
            )}
          </SheetSection>

          {/* 2 — Período */}
          <SheetSection n={2} title="Período da falta" done={sectionOk.period}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  { kind: "morning", label: "Manhã", sub: "meio dia · 09h–13h", Icon: Sunrise },
                  { kind: "afternoon", label: "Tarde", sub: "meio dia · 14h–18h", Icon: Sunset },
                  { kind: "full-day", label: "Dia inteiro", sub: "1 dia", Icon: Sun },
                  { kind: "multi-day", label: "Vários dias", sub: `até ${MAX_ABSENCE_CALENDAR_DAYS} dias`, Icon: CalendarRange },
                ] as { kind: AbsencePeriodKind; label: string; sub: string; Icon: typeof Sun }[]
              ).map(({ kind, label, sub, Icon }) => {
                const active = periodKind === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    disabled={signing}
                    onClick={() => setPeriodKind(kind)}
                    aria-pressed={active}
                    className={`group rounded-lg border px-3 py-2.5 text-left transition ${
                      active
                        ? "border-[#783DF5] bg-[#783DF5]/[0.07] shadow-[inset_0_0_0_1px_#783DF5]"
                        : "border-black/15 bg-white/70 hover:border-[#783DF5]/50"
                    } disabled:opacity-60`}
                  >
                    <Icon
                      className={`h-4 w-4 ${active ? "text-[#5c2ed0]" : "text-black/40 group-hover:text-[#5c2ed0]/70"}`}
                    />
                    <span className={`mt-1 block text-[12.5px] font-bold ${active ? "text-[#3d1f96]" : "text-black/75"}`}>
                      {label}
                    </span>
                    <span className="block text-[10px] text-black/40">{sub}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="sheet-label">{single ? "Data da falta" : "De (primeiro dia)"}</span>
                <input
                  type="date"
                  value={startDate}
                  disabled={signing}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (!single && endDate && e.target.value > endDate) setEndDate(e.target.value);
                  }}
                  className="sheet-input mt-1"
                />
              </label>
              {!single && (
                <label className="block">
                  <span className="sheet-label">Até (último dia, inclusive)</span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    disabled={signing}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="sheet-input mt-1"
                  />
                </label>
              )}
            </div>

            {/* Uma falta lança-se quase sempre depois do facto — os atalhos
                são para trás, não para a frente. */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-black/40">
                Atalhos:
              </span>
              {[
                { label: "Hoje", days: 0 },
                { label: "Ontem", days: -1 },
                { label: "Anteontem", days: -2 },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  disabled={signing}
                  onClick={() => {
                    const day = addDaysISO(todayISO(), p.days);
                    setStartDate(day);
                    if (!single && (!endDate || endDate < day)) setEndDate(day);
                  }}
                  className="rounded-full border border-black/15 bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-black/60 transition hover:border-[#783DF5]/60 hover:text-[#5c2ed0]"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {duration && duration.calendarDays > 0 && (
              <div
                className={`mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-3.5 py-2.5 ${
                  overLimit
                    ? "border-rose-500/50 bg-rose-500/[0.06]"
                    : "border-black/12 bg-white/70"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/45">
                    Total registado
                  </p>
                  <p className={`text-[14px] font-extrabold ${overLimit ? "text-rose-600" : "text-[#20202a]"}`}>
                    {formatDayCount(duration.calendarDays)}
                    <span className="font-semibold text-black/45">
                      {" "}corridos · {formatDayCount(duration.businessDays)} úteis
                    </span>
                  </p>
                </div>
                {overLimit && (
                  <p className="w-full text-[11.5px] font-medium text-rose-600">
                    O máximo por registo são {MAX_ABSENCE_CALENDAR_DAYS} dias corridos. Lança em dois
                    registos.
                  </p>
                )}
              </div>
            )}
          </SheetSection>

          {/* 3 — Motivo */}
          <SheetSection n={3} title="Motivo da falta" done={sectionOk.reason}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {FALTA_REASONS.map((r) => {
                const Icon = REASON_ICONS[r.id];
                const active = reason === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    disabled={signing}
                    onClick={() => {
                      setReason(r.id);
                      if (r.justified !== null) setJustifiedChoice(null);
                    }}
                    aria-pressed={active}
                    className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition ${
                      active
                        ? "border-[#783DF5] bg-[#783DF5]/[0.07] shadow-[inset_0_0_0_1px_#783DF5]"
                        : "border-black/15 bg-white/70 hover:border-[#783DF5]/50"
                    } disabled:opacity-60`}
                  >
                    <Icon
                      className={`mt-0.5 h-4 w-4 shrink-0 ${active ? "text-[#5c2ed0]" : "text-black/40"}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-[12.5px] font-bold ${active ? "text-[#3d1f96]" : "text-black/75"}`}
                      >
                        {r.label}
                      </span>
                      <span className="block text-[10.5px] leading-snug text-black/40">
                        {r.hint}
                      </span>
                    </span>
                    {r.justified !== null && (
                      <span
                        className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${
                          r.justified
                            ? "border-emerald-600/40 text-emerald-700"
                            : "border-rose-600/40 text-rose-700"
                        }`}
                      >
                        {r.justified ? "Just." : "Injust."}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* A marca — fixa no catálogo, ou escolhida quando é "Outro". */}
            {reasonMeta && (
              <div className="mt-4 rounded-lg border border-black/12 bg-white/70 px-3.5 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/45">
                  Classificação
                </p>
                {reasonMeta.justified !== null ? (
                  <p className="mt-1 text-[13px] font-bold">
                    <span className={reasonMeta.justified ? "text-emerald-700" : "text-rose-700"}>
                      {justifiedLabel(reasonMeta.justified)}
                    </span>{" "}
                    <span className="font-medium text-black/40">
                      — definida pelo motivo escolhido.
                    </span>
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      { value: true, label: "Justificada" },
                      { value: false, label: "Injustificada" },
                    ].map((opt) => {
                      const active = justifiedChoice === opt.value;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          disabled={signing}
                          onClick={() => setJustifiedChoice(opt.value)}
                          aria-pressed={active}
                          className={`rounded-lg border px-3 py-1.5 text-[12px] font-bold transition ${
                            active
                              ? opt.value
                                ? "border-emerald-600 bg-emerald-600/10 text-emerald-800"
                                : "border-rose-600 bg-rose-600/10 text-rose-800"
                              : "border-black/15 bg-white/70 text-black/60 hover:border-black/35"
                          } disabled:opacity-60`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </SheetSection>

          {/* 4 — Detalhe e comprovativo */}
          <SheetSection n={4} title="Detalhe e comprovativo" done={sectionOk.detail}>
            <label className="block">
              <span className="sheet-label">
                Descrição da falta{" "}
                {reason === "outro" ? (
                  <em className="not-italic text-rose-600">— obrigatória</em>
                ) : (
                  <em className="not-italic text-black/35">
                    — opcional; a pessoa lê isto na notificação
                  </em>
                )}
              </span>
              <textarea
                value={details}
                disabled={signing}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="O que aconteceu, e o que foi combinado a seguir…"
                className="sheet-input mt-1 resize-y leading-relaxed"
              />
            </label>

            <div className="mt-4">
              {attachment ? (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-600/40 bg-emerald-500/[0.07] px-3.5 py-2.5">
                  <FileText className="h-4.5 w-4.5 shrink-0 text-emerald-700" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-bold text-emerald-900">
                      {attachment.name}
                    </span>
                    <span className="block text-[10.5px] text-emerald-800/70">
                      {fileSizeLabel(attachment.size)} · anexado à folha
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={signing}
                    onClick={() => setAttachment(null)}
                    aria-label="Remover anexo"
                    className="rounded-md p-1.5 text-emerald-900/50 transition hover:bg-emerald-600/10 hover:text-emerald-900"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={signing || uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2.5 rounded-lg border-2 border-dashed border-black/20 bg-white/50 px-4 py-4 text-[12.5px] font-semibold text-black/55 transition hover:border-[#783DF5]/60 hover:bg-[#783DF5]/[0.04] hover:text-[#5c2ed0] disabled:opacity-60"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      A carregar o ficheiro…
                    </>
                  ) : (
                    <>
                      <Paperclip className="h-4 w-4" />
                      Anexar documento (opcional — email, declaração, print…)
                    </>
                  )}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  void pickFile(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
              {uploadError && (
                <p className="mt-2 text-[11.5px] font-medium text-rose-600">{uploadError}</p>
              )}
            </div>
          </SheetSection>

          {/* 5 — Declaração e assinatura do C-Level */}
          <SheetSection n={5} title="Declaração e assinatura da direção" done={sectionOk.signature} last>
            <p className="flex items-start gap-2 rounded-lg border border-amber-600/35 bg-amber-500/[0.07] px-4 py-3 text-[11.5px] leading-relaxed text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Ao assinar, esta falta fica registada no histórico de{" "}
                <strong className="font-bold">{target?.name ?? "—"}</strong> e a pessoa recebe-a de
                imediato no sino da app, com o motivo, a classificação e o teu nome.{" "}
                <strong className="font-bold">Um registo não se apaga</strong> — confirma as datas
                antes de assinar.
              </span>
            </p>

            <div ref={signatureZoneRef} className="mt-5 grid grid-cols-1 items-end gap-6 sm:grid-cols-[1fr_auto]">
              <div>
                <label className="block">
                  <span className="sheet-label">Assinatura — escreve o teu nome completo</span>
                  <input
                    type="text"
                    value={signatureName}
                    disabled={signing}
                    onChange={(e) => setSignatureName(e.target.value)}
                    maxLength={120}
                    placeholder={registrar.name}
                    autoComplete="name"
                    className="sheet-input mt-1"
                  />
                </label>

                <SignatureLine
                  name={signatureName.trim()}
                  playing={signing}
                  showStamp={showStamp}
                  stampRef={submitted?.ref ?? null}
                  onDone={() => animationDoneRef.current()}
                  signatureLabel="Assinatura da direção"
                  stampLabel="Registado"
                  placeholder="A tua assinatura"
                />
              </div>

              <div className="pb-1 text-right sm:min-w-[150px]">
                <p className="border-b border-dotted border-black/30 pb-1 font-mono text-[12px] text-black/70">
                  {formatDatePT(registerDate)}
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-black/40">
                  Data
                </p>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-rose-500/45 bg-rose-500/[0.07] px-3.5 py-2.5 text-[12.5px] font-semibold text-rose-700"
              >
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => void handleSign()}
              disabled={signing || uploading}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3.5 text-[14px] font-bold text-white shadow-[0_14px_40px_-12px_rgba(239,68,68,0.55)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              style={{ background: "linear-gradient(90deg,#f59e0b,#ef4444)" }}
            >
              {signing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  A assinar a folha…
                </>
              ) : (
                <>
                  <PenLine className="h-4 w-4" />
                  Assinar e registar falta
                </>
              )}
            </button>
            <p className="mt-2 text-[10.5px] text-black/40">
              {!signing && readyProblem
                ? `Falta: ${readyProblem}`
                : `Ao carregar, a falta é gravada e ${target?.name ?? "a pessoa"} é notificada no sino da app.`}
            </p>
          </SheetSection>
        </div>

        <footer className="relative border-t border-black/10 bg-black/[0.025] px-6 py-4 sm:px-10">
          <p className="text-[9.5px] leading-relaxed text-black/30">
            Wonder Ads · Formulário RH-02 · Registo interno de assiduidade. Visível apenas ao próprio
            e ao C-Level, e conservado no histórico da pessoa em /ausencias.
          </p>
        </footer>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function SuccessPanel({
  record,
  onNew,
}: {
  record: AbsenceRequest;
  onNew: () => void;
}) {
  return (
    <section className="animate-fade-up relative mx-auto w-full max-w-[860px] overflow-hidden rounded-2xl border border-amber-400/25 bg-amber-500/[0.05] p-7 backdrop-blur-md sm:p-9">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-amber-500/15 blur-3xl"
      />
      <div className="relative flex flex-wrap items-start gap-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-500/15">
          <ShieldCheck className="h-6 w-6 text-amber-300" strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="readout text-amber-300/80">Falta registada</p>
          <h3 className="mt-1 text-[20px] font-semibold tracking-tight text-white">
            <span className="font-mono text-amber-300">{record.ref}</span> ficou no histórico de{" "}
            {record.name}
          </h3>
          <p className="mt-2 max-w-[560px] text-[13px] leading-relaxed text-white/60">
            {record.reasonLabel} · {justifiedLabel(record.justified).toLowerCase()} ·{" "}
            {formatDatePT(record.startDate)}
            {record.endDate !== record.startDate ? ` → ${formatDatePT(record.endDate)}` : ""} ·{" "}
            {formatDayCount(record.calendarDays)}. {record.name.split(" ")[0]} recebeu a notificação
            no sino 🔔 e só sai de lá quando carregar em «Entendido» — ficas a saber quando isso
            acontecer, aqui no registo em baixo.
          </p>
          <button
            type="button"
            onClick={onNew}
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 text-[12.5px] font-semibold text-white/75 transition hover:border-amber-400/50 hover:bg-white/[0.06] hover:text-white"
          >
            <PenLine className="h-3.5 w-3.5" />
            Registar outra falta
          </button>
        </div>
      </div>
    </section>
  );
}
