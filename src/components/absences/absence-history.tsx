"use client";

// O histórico de ausências do próprio, em DUAS LISTAS separadas:
//
//   • «Os meus pedidos» — as folhas RH-01 que a pessoa submeteu: pendentes,
//     aprovadas e recusadas, da mais recente para a mais antiga.
//   • «Faltas registadas» — as folhas RH-02 que o C-Level lhe lançou.
//
// Separadas de propósito. Misturá-las numa lista só punha um ato do próprio
// («pedi férias») ao lado de um ato sobre o próprio («foi-me registada uma
// falta») com o mesmo peso visual — e a segunda lista é a que a pessoa vai
// querer conferir ao fim do mês, quando a RH descontar dias.
//
// Um registo por «entender» traz o botão aqui também, não só no sino: quem
// abre a página para VER não devia ter de ir ao sino para o acusar.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  History,
  Hourglass,
  Loader2,
  MessageSquareQuote,
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/dates";
import {
  absenceDurationLine,
  absencePeriodLine,
  justifiedLabel,
  type AbsenceRequest,
} from "@/lib/absences-shared";

export function AbsenceHistory({ initial }: { initial: AbsenceRequest[] }) {
  const requests = initial.filter((a) => a.kind !== "falta");
  const faltas = initial.filter((a) => a.kind === "falta");

  return (
    <>
      <section aria-label="Os meus pedidos de ausência">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-tight text-white">
            <History className="h-4 w-4 text-[color:var(--brand-purple)]" />
            Os meus pedidos
          </h2>
          {requests.length > 0 && (
            <span className="tabular text-[11px] text-white/35">
              {requests.length} no total
            </span>
          )}
        </div>

        {requests.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-6 py-12 text-center">
            <Hourglass className="mx-auto h-6 w-6 text-white/20" />
            <p className="mt-3 text-[13.5px] font-semibold text-white/70">
              Ainda não pediste nenhuma ausência
            </p>
            <p className="mx-auto mt-1 max-w-[380px] text-[12px] leading-relaxed text-white/40">
              Quando submeteres a primeira folha, ela aparece aqui com o estado do pedido —
              pendente, aprovado ou recusado — e a resposta do C-Level.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {requests.map((a) => (
              <li key={a.id}>
                <AbsenceCard a={a} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* As faltas só existem na página de quem levou alguma — a secção não
          aparece a quem nunca teve nenhuma. */}
      {faltas.length > 0 && (
        <section aria-label="Faltas registadas" className="mt-12">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-tight text-white">
              <AlertTriangle className="h-4 w-4 text-amber-300" />
              Faltas registadas
            </h2>
            <span className="tabular text-[11px] text-white/35">
              {faltas.length} no total
            </span>
          </div>
          <p className="mt-1.5 max-w-[560px] text-[12px] leading-relaxed text-white/40">
            Lançadas pelo C-Level. Se alguma não bater certo com o que combinaste, fala
            diretamente com quem a assinou — o registo fica como está.
          </p>
          <ul className="mt-4 space-y-3">
            {faltas.map((a) => (
              <li key={a.id}>
                <FaltaCard a={a} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** O «Entendido» — a mesma mecânica para um pedido decidido e para uma falta
 *  lançada: um POST ao registo, e a notificação do sino evapora-se com ele. */
function useAcknowledge(a: AbsenceRequest) {
  const router = useRouter();
  const [acking, setAcking] = useState(false);
  const [acked, setAcked] = useState(Boolean(a.acknowledgedAt));
  const [error, setError] = useState<string | null>(null);

  async function acknowledge() {
    setAcking(true);
    setError(null);
    try {
      const res = await fetch(`/api/absences/${a.id}/ack`, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Não foi possível gravar.");
      }
      setAcked(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gravar.");
    } finally {
      setAcking(false);
    }
  }

  return { acking, acked, error, acknowledge };
}

function AckButton({
  acking,
  onClick,
}: {
  acking: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={acking}
      className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[11.5px] font-semibold text-white/75 transition hover:border-emerald-400/50 hover:bg-emerald-500/[0.08] hover:text-emerald-200 disabled:opacity-50"
    >
      {acking ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <CheckCircle2 className="h-3.5 w-3.5" />
      )}
      Entendido
    </button>
  );
}

function StatusStamp({ status }: { status: AbsenceRequest["status"] }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/[0.1] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200">
        <span aria-hidden className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-300" />
        </span>
        À espera do C-Level
      </span>
    );
  }
  const approved = status === "approved";
  return (
    <span
      className={`stamp-static inline-block rounded border-2 px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.2em] ${
        approved
          ? "border-emerald-400/60 text-emerald-300"
          : "border-rose-400/60 text-rose-300"
      }`}
    >
      {approved ? "Aprovado" : "Recusado"}
    </span>
  );
}

function AbsenceCard({ a }: { a: AbsenceRequest }) {
  const { acking, acked, error, acknowledge } = useAcknowledge(a);
  const needsAck = a.status !== "pending" && !acked;

  return (
    <article
      className={`rounded-2xl border p-4 transition sm:p-5 ${
        a.status === "pending"
          ? "border-amber-400/[0.18] bg-amber-500/[0.025]"
          : "border-white/[0.07] bg-white/[0.02]"
      }`}
    >
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="font-mono text-[10.5px] font-bold tracking-[0.08em] text-white/40">
              {a.ref}
            </span>
            <StatusStamp status={a.status} />
          </div>
          <h3 className="mt-1.5 text-[15px] font-semibold tracking-tight text-white">
            {a.reasonLabel}
          </h3>
          <p className="mt-0.5 text-[12.5px] text-white/55">
            {absencePeriodLine(a)}{" "}
            <span className="text-white/35">· {absenceDurationLine(a)}</span>
          </p>
          {a.details && (
            <p className="mt-2 border-l-2 border-white/10 pl-3 text-[12px] leading-relaxed text-white/45">
              {a.details}
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {a.attachment && (
              <a
                href={a.attachment.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[#c3aaff] underline-offset-2 hover:underline"
              >
                <FileText className="h-3.5 w-3.5" />
                {a.attachment.name}
              </a>
            )}
            <span className="font-signature text-[19px] leading-none text-white/45">
              {a.signatureName}
            </span>
            <span className="tabular text-[10.5px] text-white/30">
              submetido {formatDateTime(a.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {a.status !== "pending" && (
        <div
          className={`mt-3.5 rounded-xl border px-3.5 py-3 ${
            a.status === "approved"
              ? "border-emerald-400/20 bg-emerald-500/[0.05]"
              : "border-rose-400/20 bg-rose-500/[0.05]"
          }`}
        >
          <p className="text-[12px] font-medium text-white/75">
            {a.status === "approved" ? "✅ Aprovado" : "❌ Recusado"} por{" "}
            <strong className="font-semibold">{a.decidedByName ?? "C-Level"}</strong>
            {a.decidedVia === "slack" ? " (via Slack)" : ""} ·{" "}
            <span className="tabular text-white/45">
              {a.decidedAt ? formatDate(a.decidedAt) : "—"}
            </span>
          </p>
          {a.decisionNote && (
            <p className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-relaxed text-white/55">
              <MessageSquareQuote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/30" />
              {a.decisionNote}
            </p>
          )}
          {needsAck && (
            <AckButton acking={acking} onClick={() => void acknowledge()} />
          )}
          {error && (
            <p className="mt-2 text-[11px] font-medium text-rose-300">{error}</p>
          )}
        </div>
      )}
    </article>
  );
}

/** A falta lançada pelo C-Level, vista pelo lado de quem a levou.
 *
 *  Papel âmbar, não vermelho: isto é um registo de assiduidade, não uma
 *  repreensão — e a diferença entre justificada e injustificada é a única
 *  coisa que muda de cor, porque é a única que muda o que a RH desconta. */
function FaltaCard({ a }: { a: AbsenceRequest }) {
  const { acking, acked, error, acknowledge } = useAcknowledge(a);
  const justified = a.justified === true;

  return (
    <article
      className={`rounded-2xl border p-4 transition sm:p-5 ${
        justified
          ? "border-white/[0.07] bg-white/[0.02]"
          : "border-amber-400/[0.2] bg-amber-500/[0.03]"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="font-mono text-[10.5px] font-bold tracking-[0.08em] text-white/40">
          {a.ref}
        </span>
        <span
          className={`stamp-static inline-block rounded border-2 px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.2em] ${
            justified
              ? "border-emerald-400/60 text-emerald-300"
              : "border-amber-400/60 text-amber-300"
          }`}
        >
          {justifiedLabel(a.justified)}
        </span>
      </div>

      <h3 className="mt-1.5 text-[15px] font-semibold tracking-tight text-white">
        {a.reasonLabel}
      </h3>
      <p className="mt-0.5 text-[12.5px] text-white/55">
        {absencePeriodLine(a)}{" "}
        <span className="text-white/35">· {absenceDurationLine(a)}</span>
      </p>
      {a.details && (
        <p className="mt-2 border-l-2 border-white/10 pl-3 text-[12px] leading-relaxed text-white/45">
          {a.details}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {a.attachment && (
          <a
            href={a.attachment.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[#c3aaff] underline-offset-2 hover:underline"
          >
            <FileText className="h-3.5 w-3.5" />
            {a.attachment.name}
          </a>
        )}
        <span className="text-[11.5px] text-white/50">
          Registada por{" "}
          <strong className="font-semibold text-white/70">
            {a.decidedByName ?? "C-Level"}
          </strong>{" "}
          <span className="tabular text-white/35">
            · {a.decidedAt ? formatDateTime(a.decidedAt) : formatDate(a.createdAt)}
          </span>
        </span>
      </div>

      {!acked && (
        <div className="mt-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-3">
          <p className="text-[12px] leading-relaxed text-white/60">
            Confirma que leste este registo. Fica no sino até o fazeres.
          </p>
          <AckButton acking={acking} onClick={() => void acknowledge()} />
          {error && (
            <p className="mt-2 text-[11px] font-medium text-rose-300">{error}</p>
          )}
        </div>
      )}
      {acked && a.acknowledgedAt && (
        <p className="tabular mt-3 text-[11px] text-emerald-300/70">
          ✓ Acusaste a receção em {formatDate(a.acknowledgedAt)}
        </p>
      )}
    </article>
  );
}
