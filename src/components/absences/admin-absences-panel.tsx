"use client";

// O painel de decisão do C-Level — a fila de pendentes em cima, com TUDO o
// que a pessoa preencheu na folha (nada de abrir noutra página para poder
// decidir), e o registo dos decididos em baixo.
//
// APROVAR é um clique; RECUSAR abre um campo de justificação primeiro —
// recusa sem uma palavra é o tipo de gestão que cria mais conversas do que
// evita. A nota é opcional na mesma (às vezes já se falou pessoalmente),
// mas o caminho convida a escrevê-la.
//
// Quem decidir em segundo lugar (o outro superadmin, aqui ou no Slack)
// recebe o 409 da API e o painel recarrega com a decisão verdadeira — a
// primeira palavra é a que conta.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  FileText,
  Inbox,
  Loader2,
  MessageSquareQuote,
  Phone,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Users,
  X,
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/dates";
import {
  absenceDurationLine,
  absencePeriodLine,
  formatDayCount,
  type AbsenceRequest,
} from "@/lib/absences-shared";

type Filter = "all" | "approved" | "rejected";

export function AdminAbsencesPanel({ initial }: { initial: AbsenceRequest[] }) {
  const pending = initial.filter((a) => a.status === "pending");
  const decided = initial.filter((a) => a.status !== "pending");
  const [filter, setFilter] = useState<Filter>("all");

  const shown = useMemo(
    () => decided.filter((a) => filter === "all" || a.status === filter),
    [decided, filter],
  );

  const approvedDays = decided
    .filter((a) => a.status === "approved")
    .reduce((s, a) => s + a.businessDays, 0);

  return (
    <div className="animate-fade-up mt-2">
      <header>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          <span className="brand-gradient-text">Ausências</span>
        </h1>
        <p className="mt-1.5 max-w-[640px] text-[12.5px] leading-relaxed text-white/45">
          Os pedidos da equipa, com a folha completa à vista. Decidir aqui (ou no Slack,
          no #ausencias) resolve a notificação de todos os superadmins e avisa logo a
          pessoa no sino dela.{" "}
          <Link
            href="/admin/faltas"
            className="font-medium text-amber-300/90 underline-offset-2 hover:underline"
          >
            Para lançar uma falta a alguém, é na folha RH-02 →
          </Link>
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] ${
              pending.length > 0
                ? "border-amber-400/40 bg-amber-500/[0.1] text-amber-200"
                : "border-emerald-400/30 bg-emerald-500/[0.08] text-emerald-200"
            }`}
          >
            {pending.length > 0 ? (
              <Inbox className="h-3.5 w-3.5" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            {pending.length > 0
              ? `${pending.length} ${pending.length === 1 ? "pedido" : "pedidos"} por decidir`
              : "Nada por decidir"}
          </span>
          <span className="tabular inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/50">
            <Users className="h-3.5 w-3.5 text-white/35" />
            {formatDayCount(approvedDays)} úteis aprovados no total
          </span>
        </div>
      </header>

      {/* Fila de pendentes */}
      <section aria-label="Pedidos pendentes" className="mt-8">
        {pending.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-6 py-10 text-center">
            <ShieldCheck className="mx-auto h-6 w-6 text-emerald-400/50" />
            <p className="mt-3 text-[13.5px] font-semibold text-white/70">
              Fila limpa — não há pedidos à espera
            </p>
            <p className="mx-auto mt-1 max-w-[400px] text-[12px] leading-relaxed text-white/40">
              Quando alguém submeter uma folha nova, ela aparece aqui, no sino e no Slack
              (#ausencias) com os botões de decisão.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {pending.map((a) => (
              <li key={a.id}>
                <PendingCard a={a} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Registo dos decididos */}
      {decided.length > 0 && (
        <section aria-label="Pedidos decididos" className="mt-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold tracking-tight text-white/85">
              Registo · {decided.length}
            </h2>
            <div className="flex gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-1">
              {(
                [
                  { id: "all", label: "Todos" },
                  { id: "approved", label: "Aprovados" },
                  { id: "rejected", label: "Recusados" },
                ] as { id: Filter; label: string }[]
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                    filter === f.id
                      ? "bg-white/[0.1] text-white"
                      : "text-white/45 hover:text-white/75"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            {shown.map((a) => (
              <li key={a.id}>
                <DecidedRow a={a} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PersonBadge({ a }: { a: AbsenceRequest }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="brand-gradient-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
      >
        {a.name.trim().charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[14.5px] font-semibold text-white">{a.name}</p>
        <p className="truncate text-[10.5px] uppercase tracking-[0.14em] text-white/40">
          {a.role || "—"} · {a.dept || "—"}
        </p>
      </div>
    </div>
  );
}

function PendingCard({ a }: { a: AbsenceRequest }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function decide(action: "approve" | "reject") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/absences/${a.id}/decide`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, note: note.trim() || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        // 409 = o outro superadmin foi mais rápido — recarrega e mostra a
        // decisão verdadeira em vez de deixar o botão a mentir.
        setError(data.error ?? "Não foi possível gravar a decisão.");
        if (res.status === 409) router.refresh();
        return;
      }
      router.refresh();
    } catch {
      setError("Falha de rede — tenta outra vez.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-amber-400/[0.22] bg-amber-500/[0.03]">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <PersonBadge a={a} />
        <div className="text-right">
          <p className="font-mono text-[10.5px] font-bold tracking-[0.08em] text-white/40">
            {a.ref}
          </p>
          <p className="tabular mt-0.5 text-[10.5px] text-white/35">
            submetido {formatDateTime(a.createdAt)}
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <SheetLine label="Motivo" value={a.reasonLabel} strong />
          <SheetLine label="Período" value={absencePeriodLine(a)} strong />
          <SheetLine label="Duração" value={absenceDurationLine(a)} />
          <SheetLine
            label="Comprovativo"
            value={
              a.attachment ? (
                <a
                  href={a.attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-[#c3aaff] underline-offset-2 hover:underline"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {a.attachment.name}
                </a>
              ) : (
                <span className="text-white/35">— sem anexo</span>
              )
            }
          />
          {a.contact && (
            <SheetLine
              label="Contacto na ausência"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3 w-3 text-white/35" />
                  {a.contact}
                </span>
              }
            />
          )}
          {a.handover && <SheetLine label="Passagem de trabalho" value={a.handover} />}
        </div>

        {a.details && (
          <p className="w-full rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[12.5px] leading-relaxed text-white/60">
            <span className="mb-1 block text-[9.5px] font-bold uppercase tracking-[0.18em] text-white/35">
              Detalhe do motivo
            </span>
            {a.details}
          </p>
        )}

        <div className="flex w-full flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3.5">
          <span className="font-signature text-[24px] leading-none text-white/55">
            {a.signatureName}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
            Assinatura do colaborador
          </span>
        </div>
      </div>

      {/* Barra de decisão */}
      <div className="border-t border-white/[0.07] bg-black/25 px-5 py-4">
        {rejecting ? (
          <div>
            <label className="block">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-rose-300/80">
                Justificação da recusa — a pessoa vai lê-la na notificação
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                autoFocus
                placeholder="Ex.: sobreposição com a entrega da White Clinic — combina outra semana com a equipa…"
                className="mt-1.5 w-full resize-y rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-[12.5px] text-white outline-none transition placeholder:text-white/25 focus:border-rose-400/60"
              />
            </label>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void decide("reject")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-rose-500 disabled:opacity-60"
              >
                {busy === "reject" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ThumbsDown className="h-3.5 w-3.5" />
                )}
                Confirmar recusa
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  setRejecting(false);
                  setNote("");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-4 py-2 text-[12.5px] font-semibold text-white/60 transition hover:border-white/25 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void decide("approve")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-[12.5px] font-bold text-white shadow-[0_8px_24px_-8px_rgba(16,185,129,0.6)] transition hover:bg-emerald-500 disabled:opacity-60"
            >
              {busy === "approve" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ThumbsUp className="h-3.5 w-3.5" />
              )}
              Aprovar
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => setRejecting(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/40 px-4 py-2 text-[12.5px] font-bold text-rose-300 transition hover:bg-rose-500/[0.1] disabled:opacity-60"
            >
              <ThumbsDown className="h-3.5 w-3.5" />
              Recusar…
            </button>
            <span className="ml-auto text-[10.5px] text-white/30">
              A decisão avisa a pessoa no sino e fecha a notificação dos três superadmins.
            </span>
          </div>
        )}
        {error && (
          <p className="mt-2.5 text-[12px] font-semibold text-rose-300">{error}</p>
        )}
      </div>
    </article>
  );
}

function SheetLine({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-white/35">
        {label}
      </p>
      <p
        className={`mt-0.5 text-[13px] ${strong ? "font-semibold text-white" : "text-white/70"}`}
      >
        {value}
      </p>
    </div>
  );
}

function DecidedRow({ a }: { a: AbsenceRequest }) {
  const approved = a.status === "approved";
  return (
    <details className="group rounded-xl border border-white/[0.06] bg-white/[0.015] transition open:border-white/[0.12] open:bg-white/[0.03]">
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 marker:content-['']">
        <span
          aria-hidden
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${
            approved ? "bg-emerald-600/80" : "bg-rose-600/80"
          }`}
        >
          {a.name.trim().charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-white/85">
            {a.name} · {a.reasonLabel}
          </span>
          <span className="tabular block truncate text-[10.5px] text-white/40">
            {absencePeriodLine(a)} · {absenceDurationLine(a)}
          </span>
        </span>
        <span
          className={`stamp-static inline-block shrink-0 rounded border-2 px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase tracking-[0.18em] ${
            approved
              ? "border-emerald-400/60 text-emerald-300"
              : "border-rose-400/60 text-rose-300"
          }`}
        >
          {approved ? "Aprovado" : "Recusado"}
        </span>
        <span className="tabular shrink-0 text-[10.5px] text-white/30">
          {a.decidedAt ? formatDate(a.decidedAt) : "—"}
        </span>
      </summary>
      <div className="border-t border-white/[0.06] px-4 py-3.5">
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <SheetLine label="Referência" value={a.ref} />
          <SheetLine
            label="Decidido por"
            value={
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2
                  className={`h-3.5 w-3.5 ${approved ? "text-emerald-400" : "text-rose-400"}`}
                />
                {a.decidedByName ?? "—"}
                {a.decidedVia === "slack" ? " · via Slack" : " · na app"}
                {a.decidedAt ? ` · ${formatDateTime(a.decidedAt)}` : ""}
              </span>
            }
          />
          {a.attachment && (
            <SheetLine
              label="Comprovativo"
              value={
                <a
                  href={a.attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-[#c3aaff] underline-offset-2 hover:underline"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {a.attachment.name}
                </a>
              }
            />
          )}
          {a.contact && <SheetLine label="Contacto na ausência" value={a.contact} />}
          {a.handover && <SheetLine label="Passagem de trabalho" value={a.handover} />}
          <SheetLine
            label="Entendido pelo próprio"
            value={
              a.acknowledgedAt ? (
                <span className="text-emerald-300/90">
                  Sim · {formatDate(a.acknowledgedAt)}
                </span>
              ) : (
                <span className="text-white/40">ainda não</span>
              )
            }
          />
        </div>
        {a.details && (
          <p className="mt-3 border-l-2 border-white/10 pl-3 text-[12px] leading-relaxed text-white/50">
            {a.details}
          </p>
        )}
        {a.decisionNote && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-white/[0.03] px-3 py-2 text-[12px] leading-relaxed text-white/60">
            <MessageSquareQuote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/30" />
            {a.decisionNote}
          </p>
        )}
        <p className="font-signature mt-3 text-[22px] leading-none text-white/40">
          {a.signatureName}
        </p>
      </div>
    </details>
  );
}
