"use client";

// O resumo mensal, visto de dentro da app — o mesmo mapa que a RH recebe no
// Slack no dia 1, com um botão para o enviar já.
//
// A PRÉ-VISUALIZAÇÃO existe por uma razão: a mensagem só sai uma vez por mês,
// e uma mensagem que só se vê uma vez por mês é uma mensagem que ninguém
// consegue afinar. Aqui vê-se o mês fechado a qualquer hora, e o botão serve
// tanto para testar como para reenviar se a RH pedir.

import { useState } from "react";
import { CalendarDays, Loader2, Send, TriangleAlert } from "lucide-react";
import { formatDayCount } from "@/lib/absences-shared";
import type { MonthlyDigest } from "@/lib/absences-monthly";

export function MonthlyDigestCard({
  digest,
  slackConfigured,
}: {
  digest: MonthlyDigest;
  slackConfigured: boolean;
}) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(
        `/api/cron/absences-monthly?year=${digest.year}&month=${digest.month}`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        delivered?: boolean;
      };
      if (!res.ok) throw new Error(data.error ?? "Não foi possível enviar.");
      setResult(
        data.delivered
          ? `Resumo de ${digest.label} enviado para o #ausencias.`
          : "O resumo foi calculado, mas o webhook do #ausencias ainda não está configurado — nada saiu.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar.");
    } finally {
      setSending(false);
    }
  }

  const { totals, people } = digest;

  return (
    <section
      aria-label="Resumo mensal de assiduidade"
      className="mt-14 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-white/85">
            <CalendarDays className="h-4 w-4 text-[color:var(--brand-purple)]" />
            Resumo mensal para a RH · {digest.label}
          </h2>
          <p className="mt-1 max-w-[600px] text-[12px] leading-relaxed text-white/45">
            Todo o dia 1, às 9h, esta mensagem sai sozinha para o #ausencias com a Alice
            identificada. Os dias vêm recortados ao mês — uma ausência a cavalo entre dois
            meses conta em cada um só a parte que lá caiu.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/15 px-3.5 py-2 text-[12px] font-semibold text-white/75 transition hover:border-[#783DF5]/50 hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
        >
          {sending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Enviar agora
        </button>
      </div>

      {!slackConfigured && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/[0.07] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-amber-200/90">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          O webhook do #ausencias (<code>SLACK_AUSENCIAS_WEBHOOK_URL</code>) ainda não está
          configurado na Vercel — o resumo calcula-se, mas não sai para o Slack.
        </p>
      )}

      <div className="mt-5 grid grid-cols-3 gap-3">
        {[
          {
            label: "Ausência aprovada",
            value: formatDayCount(totals.approvedBusinessDays),
            tone: "text-white",
          },
          {
            label: "Falta injustificada",
            value: formatDayCount(totals.faltaUnjustifiedDays),
            tone: totals.faltaUnjustifiedDays > 0 ? "text-rose-300" : "text-white",
          },
          {
            label: "Falta justificada",
            value: formatDayCount(totals.faltaJustifiedDays),
            tone: "text-white",
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
              {s.label} · dias úteis
            </p>
          </div>
        ))}
      </div>

      {people.length === 0 ? (
        <p className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-5 text-center text-[12px] text-white/40">
          Mês sem ausências nem faltas — a mensagem sai a dizer que não há nada a descontar.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.06]">
          {people.map((p) => (
            <li
              key={p.username}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-white/[0.015] px-4 py-2.5"
            >
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-white/80">
                {p.name}
              </span>
              {p.approvedBusinessDays > 0 && (
                <span className="tabular shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10.5px] text-white/55">
                  🌴 {formatDayCount(p.approvedBusinessDays)}
                </span>
              )}
              {p.faltaJustifiedDays > 0 && (
                <span className="tabular shrink-0 rounded-full border border-emerald-400/25 px-2 py-0.5 text-[10.5px] text-emerald-300/80">
                  📄 {formatDayCount(p.faltaJustifiedDays)}
                </span>
              )}
              {p.faltaUnjustifiedDays > 0 && (
                <span className="tabular shrink-0 rounded-full border border-rose-400/30 px-2 py-0.5 text-[10.5px] text-rose-300/90">
                  ⚠️ {formatDayCount(p.faltaUnjustifiedDays)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {result && (
        <p className="mt-3 text-[11.5px] font-medium text-emerald-300/90">{result}</p>
      )}
      {error && <p className="mt-3 text-[11.5px] font-medium text-rose-300">{error}</p>}
    </section>
  );
}
