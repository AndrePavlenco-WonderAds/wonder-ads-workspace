// O topo da página da Folga de custos (v78.37): quanto há este mês, uma barra
// que mostra o que já saiu do que havia (transitado + folga do mês) e a linha
// dos meses — o que fechou em cada um e o que entra no próximo.
//
// A barra anima uma vez, ao abrir; é o único movimento da página.

import { Check } from "lucide-react";
import {
  FOLGA_STATE_LABEL,
  eurCents,
  folgaMonthName,
  folgaMonthShort,
  type FolgaSummary,
} from "@/lib/seo-folga";

const STATE_PILL: Record<FolgaSummary["state"], string> = {
  ok: "border-emerald-400/35 bg-emerald-500/12 text-emerald-200",
  low: "border-amber-400/40 bg-amber-500/15 text-amber-200",
  out: "border-rose-400/40 bg-rose-500/15 text-rose-200",
  over: "border-rose-400/50 bg-rose-500/20 text-rose-100",
  lite: "border-amber-400/40 bg-amber-500/15 text-amber-200",
  unset: "border-white/15 bg-white/[0.06] text-white/65",
};

const GLOW: Record<FolgaSummary["state"], string> = {
  ok: "var(--brand-gradient)",
  low: "linear-gradient(135deg,#f59e0b,#C535C9)",
  out: "linear-gradient(135deg,#f43f5e,#C535C9)",
  over: "linear-gradient(135deg,#f43f5e,#be123c)",
  lite: "linear-gradient(135deg,#f59e0b,#783DF5)",
  unset: "linear-gradient(135deg,#475569,#783DF5)",
};

export function FolgaHero({ s, daysLeft }: { s: FolgaSummary; daysLeft: number }) {
  const month = folgaMonthName(s.current.key);
  const prev = s.months.length > 1 ? s.months[s.months.length - 2] : null;
  const noFolga = s.state === "lite" || s.state === "unset";

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#0f0d19] p-6 sm:p-9">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-56 h-[30rem] w-[30rem] rounded-full opacity-[0.22] blur-3xl"
        style={{ background: GLOW[s.state] }}
      />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[13.5px] text-white/50">
              {noFolga ? `Extras em ${month}` : `Disponível para extras em ${month}`}
            </p>
            <p
              className={`mt-1.5 text-[3.2rem] font-semibold leading-none tracking-[-0.045em] tabular-nums sm:text-[4.4rem] ${
                s.remaining < 0 ? "text-rose-200" : "text-white"
              }`}
            >
              {noFolga ? (s.state === "lite" ? "Cobrar tudo" : "Por definir") : eurCents(s.remaining)}
            </p>
            <p className="mt-3 text-[14px] text-white/55">
              {s.state === "lite"
                ? "Cliente Lite: não tem folga. Todos os extras pedidos são cobrados ao cliente."
                : s.state === "unset"
                  ? "A direção ainda não definiu a folga mensal deste projeto."
                  : `de ${eurCents(s.available)}${
                      s.current.opening !== 0 && prev
                        ? ` · ${eurCents(s.current.opening)} ${s.current.opening > 0 ? "transitaram" : "em falta"} de ${folgaMonthName(prev.key)}`
                        : ""
                    }`}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span className={`rounded-full border px-3 py-1 text-[12.5px] font-semibold ${STATE_PILL[s.state]}`}>
              {FOLGA_STATE_LABEL[s.state]}
            </span>
            <p className="text-[12.5px] text-white/45">
              {daysLeft === 0 ? `${month} fecha hoje` : `${month} fecha daqui a ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}`}
            </p>
          </div>
        </div>

        <Meter s={s} />
        <MonthSteps s={s} />
      </div>
    </section>
  );
}

function Meter({ s }: { s: FolgaSummary }) {
  if (s.state === "lite") {
    // Lite: a barra já nasce preenchida — não há folga para gastar.
    return (
      <div className="mt-8">
        <div className="relative flex h-7 items-center justify-center overflow-hidden rounded-full bg-gradient-to-r from-amber-500/80 via-amber-400/80 to-[#C535C9]/70 ring-1 ring-inset ring-amber-300/30">
          <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#1a1206]">Preenchida · topped up</span>
        </div>
        <p className="mt-2 text-[12.5px] text-white/45">
          Lança os extras como «cobrado ao cliente» para ficarem no registo do projeto.
        </p>
      </div>
    );
  }
  if (s.state === "unset") {
    return (
      <div className="mt-8">
        <div
          className="h-4 rounded-full border border-white/10"
          style={{
            background:
              "repeating-linear-gradient(135deg, rgba(255,255,255,0.07) 0 8px, rgba(255,255,255,0.02) 8px 16px)",
          }}
        />
        <p className="mt-2 text-[12.5px] text-white/45">
          Até a direção definir a folga, os extras deste projeto são cobrados ao cliente.
        </p>
      </div>
    );
  }

  const over = s.remaining < 0;
  // A barra é o que FICA: começa cheia e esvazia à medida que se lançam
  // extras, até 0 € — e passa a vermelho quando se vai além da folga.
  const leftPct = over ? 0 : s.available > 0 ? Math.min(100, Math.max(0, (s.remaining / s.available) * 100)) : 0;
  // A bolha não sai da barra: encosta-se às pontas.
  const bubbleLeft = over ? 50 : Math.min(94, Math.max(6, leftPct));

  return (
    <div className="mt-9">
      <div className="relative pt-9">
        <span className="absolute top-0 -translate-x-1/2" style={{ left: `${bubbleLeft}%` }}>
          <span
            className="folga-bubble relative block whitespace-nowrap rounded-lg px-2 py-1 text-[11.5px] font-bold tabular-nums text-white shadow-lg"
            style={{ background: over ? "#e11d48" : "linear-gradient(135deg,#343ED7,#783DF5)" }}
          >
            {over ? `${eurCents(-s.remaining)} acima da folga` : `${Math.round(leftPct)}% livre`}
            <span
              aria-hidden
              className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[5px] border-x-transparent"
              style={{ borderTopColor: over ? "#e11d48" : "#5a3de6" }}
            />
          </span>
        </span>
        <div
          role="meter"
          aria-valuemin={0}
          aria-valuemax={s.available / 100}
          aria-valuenow={Math.max(0, s.remaining) / 100}
          aria-label="Folga que ainda há este mês"
          className="relative h-4 overflow-hidden rounded-full ring-1 ring-inset ring-white/[0.06]"
          style={{
            background: over
              ? "repeating-linear-gradient(135deg, rgba(225,29,72,0.55) 0 10px, rgba(190,18,60,0.4) 10px 20px)"
              : "repeating-linear-gradient(135deg, rgba(255,255,255,0.07) 0 6px, rgba(255,255,255,0.025) 6px 12px)",
          }}
        >
          {!over && leftPct > 0 && (
            <span
              className="folga-fill absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${leftPct}%`,
                background: "var(--brand-gradient)",
                boxShadow: "0 0 18px rgba(120,61,245,0.55)",
              }}
            />
          )}
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-[12.5px]">
        <span className={over ? "font-semibold text-rose-200" : "text-white/55"}>
          {over ? (
            "Passou a folga: cobra os próximos extras"
          ) : (
            <>
              Fica <span className="font-semibold tabular-nums text-white/85">{eurCents(s.remaining)}</span>
            </>
          )}
        </span>
        <span className="text-white/55">
          Oferecido este mês <span className="font-semibold tabular-nums text-white/85">{eurCents(s.current.spent)}</span>
        </span>
      </div>
    </div>
  );
}

function MonthSteps({ s }: { s: FolgaSummary }) {
  const past = s.months.slice(-4, -1);
  const steps = [
    ...past.map((m) => ({ key: m.key, kind: "past" as const, value: m.closing })),
    { key: s.current.key, kind: "now" as const, value: s.remaining },
    { key: s.nextKey, kind: "next" as const, value: Math.round((s.allowanceNext ?? 0) * 100) },
  ];

  return (
    <ol className="mt-9 grid gap-y-3" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((st, i) => (
        <li key={st.key} className="relative flex flex-col items-center text-center">
          {i > 0 && (
            <span
              aria-hidden
              className={`absolute right-1/2 top-[15px] h-[2px] w-full ${
                st.kind === "next" ? "border-t-2 border-dashed border-white/15 bg-transparent" : "bg-gradient-to-r from-[#343ED7] to-[#783DF5]"
              }`}
            />
          )}
          <span
            className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ${
              st.kind === "past"
                ? "bg-gradient-to-br from-[#343ED7] to-[#783DF5] text-white"
                : st.kind === "now"
                  ? "border-2 border-[#a78bfa] bg-[#1b1530] text-white shadow-[0_0_0_5px_rgba(120,61,245,0.18)]"
                  : "border-2 border-dashed border-white/20 bg-[#0f0d19] text-white/45"
            }`}
          >
            {st.kind === "past" ? (
              <Check className="h-4 w-4" strokeWidth={3} />
            ) : st.kind === "now" ? (
              <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#c4a6ff]" />
            ) : null}
          </span>
          <span className={`mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] ${st.kind === "now" ? "text-white" : "text-white/45"}`}>
            {folgaMonthShort(st.key)}
            {st.kind === "now" && <span className="text-[#c4a6ff]"> · agora</span>}
          </span>
          <span
            className={`mt-0.5 text-[12.5px] tabular-nums ${
              st.value < 0 ? "text-rose-200" : st.kind === "next" ? "text-white/45" : "text-white/75"
            }`}
          >
            {st.kind === "past"
              ? `fechou ${eurCents(st.value)}`
              : st.kind === "now"
                ? s.state === "lite" || s.state === "unset"
                  ? "—"
                  : eurCents(st.value)
                : s.state === "lite" && st.value === 0
                  ? "sem folga"
                  : `+${eurCents(st.value)} a dia 1`}
          </span>
        </li>
      ))}
    </ol>
  );
}
