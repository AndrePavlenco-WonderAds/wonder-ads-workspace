"use client";

// A folha de pedido de ausência — desenhada como um formulário de RH de uma
// big corporate, de propósito: papel claro sobre a app escura, cabeçalho
// timbrado, secções numeradas, linhas pontilhadas e um rodapé "reservado à
// direção". A app à volta é um cockpit; isto é um DOCUMENTO, e a diferença
// de material é o que faz o pedido parecer o ato formal que é.
//
// A ASSINATURA é o momento da folha: a pessoa escreve o nome, carrega em
// «Assinar e submeter», e o nome escreve-se sozinho em manuscrito — letra a
// letra, com a caneta a acompanhar — enquanto o pedido segue para o
// servidor. O carimbo de SUBMETIDO só cai quando as duas coisas acabaram:
// a animação E o POST. Se o servidor recusar, a folha volta atrás inteira,
// com o erro à vista e nada perdido.

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import {
  Baby,
  Briefcase,
  CalendarRange,
  Check,
  FileText,
  Flower2,
  GraduationCap,
  HeartPulse,
  Loader2,
  Package,
  Paperclip,
  PartyPopper,
  PenLine,
  Phone,
  Stethoscope,
  Sun,
  Sunrise,
  Sunset,
  TreePalm,
  Users,
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
  ABSENCE_REASONS,
  absenceDuration,
  formatDayCount,
  MAX_ABSENCE_CALENDAR_DAYS,
  validateAbsenceDraft,
  type AbsenceAttachment,
  type AbsencePeriodKind,
  type AbsenceReasonId,
  type AbsenceRequest,
} from "@/lib/absences-shared";

const REASON_ICONS: Record<AbsenceReasonId, typeof TreePalm> = {
  ferias: TreePalm,
  doenca: HeartPulse,
  consulta: Stethoscope,
  familia: Users,
  luto: Flower2,
  casamento: PartyPopper,
  parentalidade: Baby,
  estudos: GraduationCap,
  mudanca: Package,
  pessoal: Briefcase,
  outro: PenLine,
};

type Phase = "fill" | "signing" | "done";

export function AbsenceRequestForm({
  employee,
}: {
  employee: { username: string; name: string; role: string; dept: string };
}) {
  const router = useRouter();

  const [periodKind, setPeriodKind] = useState<AbsencePeriodKind>("full-day");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState<AbsenceReasonId | null>(null);
  const [details, setDetails] = useState("");
  const [contact, setContact] = useState("");
  const [handover, setHandover] = useState("");
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

  const requestDate = useMemo(() => todayISO(), []);
  const single = periodKind !== "multi-day";
  const effectiveEnd = single ? startDate : endDate;

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

  const reasonMeta = ABSENCE_REASONS.find((r) => r.id === reason) ?? null;

  const draft = useMemo(
    () => ({
      periodKind,
      startDate,
      endDate: effectiveEnd,
      reason: (reason ?? "outro") as AbsenceReasonId,
      details,
      contact,
      handover,
      hasAttachment: Boolean(attachment),
      signatureName,
    }),
    [periodKind, startDate, effectiveEnd, reason, details, contact, handover, attachment, signatureName],
  );

  // Estado de cada secção — alimenta os números do lado esquerdo, que vão
  // ficando "carimbados" à medida que a folha se completa.
  const sectionOk = {
    period: Boolean(
      startDate && effectiveEnd && duration && duration.calendarDays > 0 && !overLimit,
    ),
    reason: Boolean(
      reason && (reason !== "outro" || details.trim().length >= 10),
    ),
    proof: Boolean(reasonMeta?.proof !== "required" || attachment),
    signature: signatureName.trim().length >= 3,
  };

  const readyProblem = reason
    ? validateAbsenceDraft(draft)
    : "Escolhe o motivo da ausência (secção 3).";

  async function pickFile(file: File | null) {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const blob = await upload(`ausencias/${employee.username}/${file.name}`, file, {
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

  const submitRequest = useCallback(async (): Promise<
    { ok: true; record: AbsenceRequest } | { ok: false; message: string }
  > => {
    try {
      const res = await fetch("/api/absences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          periodKind,
          startDate,
          endDate: effectiveEnd,
          reason,
          details,
          contact,
          handover,
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
          message: data.error ?? "Não foi possível submeter — tenta outra vez.",
        };
      }
      return { ok: true, record: data.record };
    } catch {
      return { ok: false, message: "Falha de rede — o pedido não foi submetido." };
    }
  }, [periodKind, startDate, effectiveEnd, reason, details, contact, handover, attachment, signatureName]);

  const animationDoneRef = useRef<() => void>(() => {});
  const handleSign = useCallback(async () => {
    if (phase !== "fill") return;
    if (!reason) {
      setError("Escolhe o motivo da ausência (secção 3).");
      return;
    }
    const problem = validateAbsenceDraft(draft);
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
    const [outcome] = await Promise.all([submitRequest(), animation]);

    if (!outcome.ok) {
      setPhase("fill");
      setError(outcome.message);
      return;
    }
    setSubmitted(outcome.record);
    setShowStamp(true);
    // O carimbo assenta e só depois a folha dá lugar ao painel de sucesso —
    // o momento merece o meio segundo.
    setTimeout(() => {
      setPhase("done");
      router.refresh();
    }, 1100);
  }, [phase, reason, draft, submitRequest, router]);

  function resetForm() {
    setPeriodKind("full-day");
    setStartDate("");
    setEndDate("");
    setReason(null);
    setDetails("");
    setContact("");
    setHandover("");
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
      aria-label="Folha de pedido de ausência"
      className="relative mx-auto w-full max-w-[860px]"
    >
      {/* A folha */}
      <div className="relative overflow-hidden rounded-[6px] bg-gradient-to-b from-[#fbfaf7] to-[#f0eee8] text-[#20202a] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.06)]">
        {/* Faixa timbrada */}
        <div aria-hidden className="h-1.5 w-full" style={{ background: "var(--brand-gradient)" }} />

        {/* Marca de água */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] select-none whitespace-nowrap text-[110px] font-extrabold tracking-[0.3em] text-black/[0.028]"
        >
          WONDER ADS
        </span>

        {/* Cabeçalho timbrado */}
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
              Recursos Humanos · Pessoas &amp; Cultura
            </p>
          </div>
          <div className="rounded border border-black/15 bg-white/70 px-3.5 py-2 text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/50">
              Formulário RH-01
            </p>
            <p className="text-[13px] font-extrabold uppercase tracking-[0.08em]">
              Pedido de Ausência
            </p>
            <p className="mt-0.5 font-mono text-[10.5px] text-black/45">
              Ref.ª atribuída na submissão · {formatDatePT(requestDate)}
            </p>
          </div>
        </header>

        <div className="relative px-6 py-6 sm:px-10 sm:py-8">
          {/* 1 — Identificação */}
          <SheetSection n={1} title="Identificação do colaborador" done>
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <SheetField label="Nome completo" value={employee.name} />
              <SheetField label="Função" value={employee.role || "—"} />
              <SheetField label="Departamento" value={employee.dept || "—"} />
              <SheetField label="Data do pedido" value={formatDatePT(requestDate)} />
            </div>
          </SheetSection>

          {/* 2 — Período */}
          <SheetSection n={2} title="Período da ausência" done={sectionOk.period}>
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
                <span className="sheet-label">{single ? "Data" : "De (primeiro dia)"}</span>
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

            {!single && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-black/40">
                  Atalhos:
                </span>
                {[
                  { label: "1 semana", days: 6 },
                  { label: "2 semanas", days: 13 },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    disabled={signing}
                    onClick={() => {
                      const base = startDate || addDaysISO(todayISO(), 1);
                      setStartDate(base);
                      setEndDate(addDaysISO(base, p.days));
                    }}
                    className="rounded-full border border-black/15 bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-black/60 transition hover:border-[#783DF5]/60 hover:text-[#5c2ed0]"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}

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
                    Total pedido
                  </p>
                  <p className={`text-[14px] font-extrabold ${overLimit ? "text-rose-600" : "text-[#20202a]"}`}>
                    {formatDayCount(duration.calendarDays)}
                    <span className="font-semibold text-black/45">
                      {" "}corridos · {formatDayCount(duration.businessDays)} úteis
                    </span>
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <div className="h-1.5 w-28 overflow-hidden rounded-full bg-black/10 sm:w-40">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (duration.calendarDays / MAX_ABSENCE_CALENDAR_DAYS) * 100)}%`,
                        background: overLimit
                          ? "#e11d48"
                          : duration.calendarDays > 10
                            ? "#d97706"
                            : "var(--brand-gradient)",
                      }}
                    />
                  </div>
                  <span className={`text-[10.5px] font-bold ${overLimit ? "text-rose-600" : "text-black/45"}`}>
                    máx. {MAX_ABSENCE_CALENDAR_DAYS}
                  </span>
                </div>
                {overLimit && (
                  <p className="w-full text-[11.5px] font-medium text-rose-600">
                    O máximo por pedido são {MAX_ABSENCE_CALENDAR_DAYS} dias corridos. Divide em dois
                    pedidos ou fala diretamente com o C-Level.
                  </p>
                )}
              </div>
            )}
          </SheetSection>

          {/* 3 — Motivo */}
          <SheetSection n={3} title="Motivo da ausência" done={sectionOk.reason}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ABSENCE_REASONS.map((r) => {
                const Icon = REASON_ICONS[r.id];
                const active = reason === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    disabled={signing}
                    onClick={() => setReason(r.id)}
                    aria-pressed={active}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition ${
                      active
                        ? "border-[#783DF5] bg-[#783DF5]/[0.07] shadow-[inset_0_0_0_1px_#783DF5]"
                        : "border-black/15 bg-white/70 hover:border-[#783DF5]/50"
                    } disabled:opacity-60`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[#5c2ed0]" : "text-black/40"}`} />
                    <span className={`min-w-0 flex-1 truncate text-[12px] font-semibold ${active ? "text-[#3d1f96]" : "text-black/70"}`}>
                      {r.label}
                    </span>
                    {active && <Check className="h-3.5 w-3.5 shrink-0 text-[#5c2ed0]" />}
                  </button>
                );
              })}
            </div>

            <label className="mt-4 block">
              <span className="sheet-label">
                Detalhe do motivo{" "}
                {reason === "outro" ? (
                  <em className="not-italic text-rose-600">— obrigatório</em>
                ) : (
                  <em className="not-italic text-black/35">— opcional, mas ajuda a decisão</em>
                )}
              </span>
              <textarea
                value={details}
                disabled={signing}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Contexto que o C-Level deva conhecer ao decidir…"
                className="sheet-input mt-1 resize-y leading-relaxed"
              />
            </label>
          </SheetSection>

          {/* 4 — Comprovativo & contactos */}
          <SheetSection
            n={4}
            title="Comprovativo e contactos"
            done={sectionOk.proof}
          >
            {reasonMeta?.proof === "required" && (
              <p className="mb-3 flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/[0.06] px-3 py-2 text-[12px] font-medium text-rose-700">
                <HeartPulse className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Em situações de saúde o comprovativo médico é obrigatório — a folha não segue sem ele.
              </p>
            )}
            {reasonMeta?.proof === "recommended" && (
              <p className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/[0.07] px-3 py-2 text-[12px] font-medium text-amber-700">
                <Paperclip className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Recomendado juntar comprovativo (declaração, convocatória…). Podes submeter sem ele e
                entregá-lo depois ao C-Level.
              </p>
            )}

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
                  aria-label="Remover comprovativo"
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
                className="flex w-full items-center justify-center gap-2.5 rounded-lg border-2 border-dashed border-black/20 bg-white/50 px-4 py-5 text-[12.5px] font-semibold text-black/55 transition hover:border-[#783DF5]/60 hover:bg-[#783DF5]/[0.04] hover:text-[#5c2ed0] disabled:opacity-60"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    A carregar o ficheiro…
                  </>
                ) : (
                  <>
                    <Paperclip className="h-4 w-4" />
                    Anexar comprovativo (PDF ou imagem)
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

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="sheet-label">
                  Contacto durante a ausência <em className="not-italic text-black/35">— opcional</em>
                </span>
                <div className="relative mt-1">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/30" />
                  <input
                    type="text"
                    value={contact}
                    disabled={signing}
                    onChange={(e) => setContact(e.target.value)}
                    maxLength={200}
                    placeholder="912 345 678 · só para urgências"
                    className="sheet-input pl-9"
                  />
                </div>
              </label>
              <label className="block">
                <span className="sheet-label">
                  Passagem de trabalho <em className="not-italic text-black/35">— opcional</em>
                </span>
                <input
                  type="text"
                  value={handover}
                  disabled={signing}
                  onChange={(e) => setHandover(e.target.value)}
                  maxLength={1000}
                  placeholder="Quem cobre o quê enquanto estás fora…"
                  className="sheet-input mt-1"
                />
              </label>
            </div>
          </SheetSection>

          {/* 5 — Declaração e assinatura */}
          <SheetSection n={5} title="Declaração e assinatura" done={sectionOk.signature} last>
            <p className="rounded-lg border border-black/10 bg-white/60 px-4 py-3 text-[11.5px] leading-relaxed text-black/60">
              Declaro que as informações constantes desta folha são verdadeiras e que o período
              indicado só será gozado <strong className="font-bold text-black/75">após aprovação do C-Level</strong>.
              Comprometo-me a assegurar a passagem do trabalho em curso e compreendo que esta
              submissão fica registada com data e hora para efeitos internos de RH.
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
                    placeholder={employee.name}
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
                />
              </div>

              <div className="pb-1 text-right sm:min-w-[150px]">
                <p className="border-b border-dotted border-black/30 pb-1 font-mono text-[12px] text-black/70">
                  {formatDatePT(requestDate)}
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
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3.5 text-[14px] font-bold text-white shadow-[0_14px_40px_-12px_rgba(120,61,245,0.7)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              style={{ background: "var(--brand-gradient)" }}
            >
              {signing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  A assinar a folha…
                </>
              ) : (
                <>
                  <PenLine className="h-4 w-4" />
                  Assinar e submeter pedido
                </>
              )}
            </button>
            <p className="mt-2 text-[10.5px] text-black/40">
              {!signing && readyProblem
                ? `Falta: ${readyProblem}`
                : "Ao carregar, a tua assinatura é escrita na folha e o pedido segue para o C-Level — recebes a resposta no sino da app."}
            </p>
          </SheetSection>
        </div>

        {/* Rodapé — reservado à direção */}
        <footer className="relative border-t border-black/10 bg-black/[0.025] px-6 py-4 sm:px-10">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.22em] text-black/35">
            Reservado à direção
          </p>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {["Recebido", "Decisão", "Assinatura C-Level"].map((slot) => (
              <div key={slot} className="rounded border border-dashed border-black/20 px-2.5 py-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-black/35">{slot}</p>
                <p className="mt-1 font-mono text-[11px] text-black/30">—</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[9.5px] leading-relaxed text-black/30">
            Wonder Ads · Formulário RH-01 · Os dados desta folha destinam-se exclusivamente à gestão
            interna de pessoas e são visíveis apenas ao próprio e ao C-Level.
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
    <section className="animate-fade-up relative mx-auto w-full max-w-[860px] overflow-hidden rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.05] p-7 backdrop-blur-md sm:p-9">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-emerald-500/15 blur-3xl"
      />
      <div className="relative flex flex-wrap items-start gap-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-500/15">
          <Check className="h-6 w-6 text-emerald-300" strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="readout text-emerald-300/80">Pedido submetido</p>
          <h3 className="mt-1 text-[20px] font-semibold tracking-tight text-white">
            A tua folha <span className="font-mono text-emerald-300">{record.ref}</span> seguiu para o C-Level
          </h3>
          <p className="mt-2 max-w-[560px] text-[13px] leading-relaxed text-white/60">
            {record.reasonLabel} · {formatDatePT(record.startDate)}
            {record.endDate !== record.startDate ? ` → ${formatDatePT(record.endDate)}` : ""} ·{" "}
            {formatDayCount(record.calendarDays)}. O André, o Alex e a Alice foram notificados — no
            sino da app e no Slack. Quando decidirem, recebes a resposta aqui no sino 🔔 e o pedido
            atualiza-se no teu histórico em baixo.
          </p>
          <button
            type="button"
            onClick={onNew}
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 text-[12.5px] font-semibold text-white/75 transition hover:border-[#783DF5]/50 hover:bg-white/[0.06] hover:text-white"
          >
            <PenLine className="h-3.5 w-3.5" />
            Preencher nova folha
          </button>
        </div>
      </div>
    </section>
  );
}
