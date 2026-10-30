// Os desenhos da página do Probation (v78.19): a linha dos 30 dias com as
// duas avaliações, o que cada decisão faz aos 15 e aos 30 dias, e um
// check-in semanal de exemplo. Servidor, sem estado. Os nomes, as cores e os
// semáforos são os do documento e do editor (lib/probation).

import { Lock } from "lucide-react";
import { S05 } from "@/lib/probation/document";
import { PULSE_TONE } from "@/lib/probation/published";
import { PULSE_LABEL, WEEKS_PER_PERIOD, type ProbationDecision, type WeekPulse } from "@/lib/probation/shared";

const OUTCOME = Object.fromEntries(S05.outcomes.map((o) => [o.id, o])) as Record<ProbationDecision, (typeof S05.outcomes)[number]>;

const SHORT: Record<ProbationDecision, string> = { extensao: "Extensão", recuperacao: "Recuperação", saida: "Saída" };

/* ------------------------------------------------------------------ */
/*  A linha dos 30 dias                                                 */
/* ------------------------------------------------------------------ */

function pos(day: number): string {
  return `${(day / 30) * 100}%`;
}

const CHECKINS = Array.from({ length: WEEKS_PER_PERIOD }, (_, i) => ({ n: i + 1, day: (i + 1) * 7 }));

export function ProbationTimeline() {
  return (
    <figure aria-label="Os 30 dias do probation" className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 sm:p-7">
      <div className="-mx-5 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
        <div className="relative mx-6 h-40 min-w-[540px]">
          {/* A linha: o gradiente da marca a andar com os dias. */}
          <div className="absolute inset-x-0 top-[4.5rem] h-1.5 -translate-y-1/2 rounded-full" style={{ background: "var(--brand-gradient)" }} />

          {/* Início e avaliações: o nome por cima, o ponto na linha */}
          {[
            { day: 0, title: "Dia 0", sub: "Início" },
            { day: 15, title: "Dia 15", sub: "1.ª avaliação" },
            { day: 30, title: "Dia 30", sub: "2.ª avaliação" },
          ].map((m) => (
            <div key={m.day}>
              <div
                className={`absolute top-0 ${m.day === 0 ? "-translate-x-2 text-left" : m.day === 30 ? "-translate-x-[calc(100%-0.5rem)] text-right" : "-translate-x-1/2 text-center"}`}
                style={{ left: pos(m.day) }}
              >
                <p className="whitespace-nowrap text-[14px] font-semibold text-white">{m.title}</p>
                <p className="whitespace-nowrap text-[12px] text-white/50">{m.sub}</p>
              </div>
              <span
                className={`absolute top-[4.5rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-4 ring-[#0b0c12] ${m.day === 0 ? "h-4 w-4" : "h-6 w-6"}`}
                style={{ left: pos(m.day), ...(m.day === 0 ? {} : { boxShadow: "0 0 0 2px #783DF5, 0 0 24px rgba(197,53,201,0.7)" }) }}
              />
            </div>
          ))}

          {/* Os check-ins, por baixo */}
          {CHECKINS.map((c) => (
            <div key={c.n} className="absolute top-[4.5rem] -translate-x-1/2 text-center" style={{ left: pos(c.day) }}>
              <span className="mx-auto mt-3 block h-3 w-px bg-white/40" />
              <p className="mt-1 whitespace-nowrap text-[12px] font-medium text-white/70">Semana {c.n}</p>
              <p className="whitespace-nowrap text-[11px] text-white/40">check-in</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <DecisionCard
          title="Aos 15 dias"
          sub="KPIs dos 15 dias"
          rows={[
            { id: "extensao", text: "Segue para a avaliação dos 30 dias." },
            { id: "recuperacao", text: "O probation termina aqui. Voltas à equipa e ao nível 0 das ineficácias." },
            { id: "saida", text: "Deixas a equipa." },
          ]}
        />
        <DecisionCard
          title="Aos 30 dias"
          sub="KPIs dos 30 dias"
          rows={[
            { id: "extensao", text: "Abre um novo período de 30 dias, com novas datas e novos KPIs." },
            { id: "recuperacao", text: "O probation termina. Voltas à equipa, sem reservas, e ao nível 0 das ineficácias." },
            { id: "saida", text: "Deixas a equipa." },
          ]}
        />
      </div>
    </figure>
  );
}

function DecisionCard({ title, sub, rows }: { title: string; sub: string; rows: Array<{ id: ProbationDecision; text: string }> }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b0c12] p-4 sm:p-5">
      <p className="text-[15px] font-semibold text-white">
        {title} <span className="font-normal text-white/45">· {sub}</span>
      </p>
      <ul className="mt-3 space-y-2.5">
        {rows.map((r) => (
          <li key={r.id} className="flex gap-3 text-[13.5px] leading-snug">
            <span
              className="mt-px shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold text-white"
              style={{ background: OUTCOME[r.id].color }}
            >
              {SHORT[r.id]}
            </span>
            <span className="text-white/65">{r.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Os três desfechos                                                   */
/* ------------------------------------------------------------------ */

/** A cor de cada desfecho, mais clara, para texto no fundo escuro. */
const LIGHT: Record<ProbationDecision, string> = { extensao: "#8f97ff", recuperacao: "#b99bff", saida: "#ef8cf1" };

export function OutcomeCards() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {S05.outcomes.map((o) => (
        <article key={o.id} className="flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
          <div className="h-1.5" style={{ background: o.color }} />
          <div className="flex flex-1 flex-col p-5 sm:p-6">
            <p className="text-[12.5px] font-medium text-white/45">{o.k}</p>
            <h3 className="mt-0.5 text-[1.2rem] font-semibold leading-tight text-white">{o.title}</h3>
            <p className="mt-4 text-[12.5px] font-medium" style={{ color: LIGHT[o.id] }}>
              {S05.whenLabel}
            </p>
            <p className="mt-1 text-[14px] leading-relaxed text-white/70">{o.when}</p>
            <p className="mt-4 text-[12.5px] font-medium text-white/45">{S05.whatLabel}</p>
            <p className="mt-1 text-[14px] leading-relaxed text-white/70">{o.what}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Um check-in semanal de exemplo                                      */
/* ------------------------------------------------------------------ */

function Pulse({ pulse }: { pulse: WeekPulse }) {
  const t = PULSE_TONE[pulse];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold text-white" style={{ background: t.bg, boxShadow: `inset 0 0 0 1px ${t.ring}` }}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: t.dot }} />
      {PULSE_LABEL[pulse]}
    </span>
  );
}

const EXAMPLE_KPIS: Array<{ kpi: string; value: string; pulse: WeekPulse }> = [
  { kpi: "Relatórios mensais enviados a tempo", value: "4 de 4", pulse: "no-caminho" },
  { kpi: "Tarefas do roadmap fechadas na semana", value: "6 de 10", pulse: "em-risco" },
  { kpi: "Respostas a clientes em menos de 24 h", value: "70%", pulse: "fora" },
];

export function CheckinExample() {
  return (
    <figure aria-label="Exemplo de check-in semanal" className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4 sm:px-6">
        <div>
          <p className="text-[12px] text-white/40">Exemplo</p>
          <p className="text-[16px] font-semibold text-white">Check-in · semana 2</p>
        </div>
        <Pulse pulse="em-risco" />
      </header>

      <ul className="divide-y divide-white/[0.07] px-5 sm:px-6">
        {EXAMPLE_KPIS.map((k) => (
          <li key={k.kpi} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-3">
            <span className="min-w-0 text-[14px] text-white/80">{k.kpi}</span>
            <span className="flex items-center gap-3">
              <span className="text-[14px] font-semibold tabular-nums text-white">{k.value}</span>
              <Pulse pulse={k.pulse} />
            </span>
          </li>
        ))}
      </ul>

      <div className="grid gap-px border-t border-white/[0.07] bg-white/[0.07] sm:grid-cols-2">
        {[
          { label: "O que correu bem", text: "Os quatro relatórios saíram no dia certo, sem revisões." },
          { label: "Bloqueios", text: "Duas tarefas à espera de acessos do cliente." },
          { label: "O apoio da WonderAds", text: "Sessão de 1 hora sobre a priorização do roadmap." },
          { label: "O comentário do consultor", text: "Os acessos já foram pedidos; fecho as duas tarefas até quarta." },
        ].map((f) => (
          <div key={f.label} className="bg-[#0b0c12] px-5 py-4 sm:px-6">
            <p className="text-[12.5px] font-medium text-white/45">{f.label}</p>
            <p className="mt-1 text-[14px] leading-relaxed text-white/75">{f.text}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-white/[0.07] px-5 py-4 sm:px-6">
        <p className="text-[12.5px] font-medium text-white/45">Próximos passos</p>
        <ul className="mt-2 space-y-1.5 text-[14px] text-white/75">
          {["Responder a todos os pedidos no próprio dia", "Pedir os acessos em falta logo no arranque de cada tarefa"].map((a) => (
            <li key={a} className="flex items-center gap-2.5">
              <span aria-hidden className="h-4 w-4 shrink-0 rounded-[5px] border border-white/30" />
              {a}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] text-white/40">Na semana seguinte confirma-se se foram feitos.</p>
      </div>

      <footer className="flex items-center gap-2 border-t border-dashed border-white/[0.12] px-5 py-3.5 text-[12.5px] text-white/45 sm:px-6">
        <Lock className="h-3.5 w-3.5 shrink-0" />
        Nota interna da direção: nunca chega ao consultor.
      </footer>
    </figure>
  );
}
