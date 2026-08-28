"use client";

// O fecho do mês, visto de dentro da app — o mesmo balanço que o André e a
// Alice recebem no #ausencias no último dia do mês, com um botão para o
// enviar já.
//
// Mostra o mês corrente (o que vai sair) e o anterior (para reenviar se for
// preciso). A pré-visualização existe pela mesma razão do resumo do dia 1:
// uma mensagem que só se vê uma vez por mês é uma mensagem que ninguém
// consegue afinar.

import { useState } from "react";
import { CalendarCheck2, Loader2, Send, TriangleAlert } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { formatBusinessDays } from "@/lib/absences-shared";
import type { MonthCloseLine, MonthCloseOverview } from "@/lib/absences-month-close";

type Which = "current" | "previous";

function day(iso: string | null): string {
  return iso ? formatDate(`${iso}T00:00:00`) : "—";
}

function StatusPill({ status }: { status: MonthCloseLine["status"] }) {
  const map: Record<MonthCloseLine["status"], { label: string; cls: string }> = {
    approved: { label: "✅ aprovado", cls: "border-emerald-400/25 text-emerald-300/85" },
    rejected: { label: "❌ recusado", cls: "border-rose-400/30 text-rose-300/90" },
    pending: { label: "⏳ por decidir", cls: "border-amber-400/30 text-amber-200/90" },
    recorded: { label: "registado", cls: "border-white/10 text-white/50" },
  };
  const s = map[status];
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] ${s.cls}`}>
      {s.label}
    </span>
  );
}

function Group({
  title,
  lines,
  empty,
  detail,
}: {
  title: string;
  lines: MonthCloseLine[];
  empty: string;
  detail: (l: MonthCloseLine) => string;
}) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
        {title} · {lines.length}
      </h3>
      {lines.length === 0 ? (
        <p className="mt-2 rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-3 text-[12px] text-white/35">
          {empty}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.06]">
          {lines.map((l) => (
            <li
              key={`${title}-${l.id}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-white/[0.015] px-4 py-2.5"
            >
              <span className="tabular shrink-0 text-[11px] font-semibold text-[#c3aaff]">
                {l.ref}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-white/80">
                <span className="font-medium">{l.name}</span>
                <span className="text-white/45">
                  {" "}
                  — {l.reasonLabel} · {l.period}
                  {l.businessDays >= 1 ? ` · ${formatBusinessDays(l.businessDays)}` : ""}
                </span>
              </span>
              <span className="shrink-0 text-[10.5px] text-white/40">{detail(l)}</span>
              <StatusPill status={l.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MonthCloseCard({
  current,
  previous,
  slackConfigured,
}: {
  current: MonthCloseOverview;
  previous: MonthCloseOverview;
  slackConfigured: boolean;
}) {
  const [which, setWhich] = useState<Which>("current");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const o = which === "current" ? current : previous;
  const { totals } = o;

  async function send() {
    setSending(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(
        `/api/cron/absences-month-close?year=${o.year}&month=${o.month}`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        delivered?: boolean;
      };
      if (!res.ok) throw new Error(data.error ?? "Não foi possível enviar.");
      setResult(
        data.delivered
          ? `Fecho de ${o.label} enviado para o #ausencias.`
          : "O balanço foi calculado, mas o webhook do #ausencias ainda não está configurado — nada saiu.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section
      aria-label="Fecho do mês das ausências"
      className="mt-14 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-white/85">
            <CalendarCheck2 className="h-4 w-4 text-[color:var(--brand-purple)]" />
            Fecho do mês para o #ausencias · {o.label}
          </h2>
          <p className="mt-1 max-w-[620px] text-[12px] leading-relaxed text-white/45">
            No último dia de cada mês, ao fim da tarde, esta mensagem sai sozinha para o
            #ausencias com o André e a Alice identificados: quantos pedidos entraram, quantos
            foram aprovados e recusados, e o que ficou por decidir — com a lista de cada grupo.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-1">
            {(
              [
                { id: "current", label: current.label },
                { id: "previous", label: previous.label },
              ] as { id: Which; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setWhich(t.id);
                  setResult(null);
                  setError(null);
                }}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                  which === t.id
                    ? "bg-white/[0.1] text-white"
                    : "text-white/45 hover:text-white/80"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3.5 py-2 text-[12px] font-semibold text-white/75 transition hover:border-[#783DF5]/50 hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Enviar agora
          </button>
        </div>
      </div>

      {!slackConfigured && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/[0.07] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-amber-200/90">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          O webhook do #ausencias (<code>SLACK_AUSENCIAS_WEBHOOK_URL</code>) ainda não está
          configurado na Vercel — o balanço calcula-se, mas não sai para o Slack.
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Pedidos submetidos", value: String(totals.requested), tone: "text-white" },
          {
            label:
              totals.approved > 0
                ? `Aprovados · ${formatBusinessDays(totals.approvedBusinessDays)}`
                : "Aprovados",
            value: String(totals.approved),
            tone: totals.approved > 0 ? "text-emerald-300" : "text-white",
          },
          {
            label: "Recusados",
            value: String(totals.rejected),
            tone: totals.rejected > 0 ? "text-rose-300" : "text-white",
          },
          {
            label: "Por decidir",
            value: String(totals.pending),
            tone: totals.pending > 0 ? "text-amber-300" : "text-white",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3"
          >
            <p className={`tabular text-[16px] font-semibold leading-none ${s.tone}`}>
              {s.value}
            </p>
            <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-6">
        <Group
          title={`📥 Pedidos submetidos em ${o.label.toLowerCase()}`}
          lines={o.requested}
          empty="Nenhum pedido entrou este mês."
          detail={(l) => `pedido a ${day(l.requestedOn)}`}
        />
        <Group
          title={`✅ Aprovados em ${o.label.toLowerCase()}`}
          lines={o.approved}
          empty="Nenhuma aprovação este mês."
          detail={(l) => `por ${l.decidedByName ?? "—"} a ${day(l.decidedOn)}`}
        />
        <Group
          title={`❌ Recusados em ${o.label.toLowerCase()}`}
          lines={o.rejected}
          empty="Nenhuma recusa este mês."
          detail={(l) => `por ${l.decidedByName ?? "—"} a ${day(l.decidedOn)}`}
        />
        {o.pending.length > 0 && (
          <Group
            title="⏳ Ainda por decidir"
            lines={o.pending}
            empty=""
            detail={(l) => `pedido a ${day(l.requestedOn)}`}
          />
        )}
      </div>

      {result && (
        <p className="mt-4 text-[11.5px] font-medium text-emerald-300/90">{result}</p>
      )}
      {error && <p className="mt-4 text-[11.5px] font-medium text-rose-300">{error}</p>}
    </section>
  );
}
