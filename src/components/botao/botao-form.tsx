"use client";

// «Acionar o Botão» — o formulário do consultor (v80.34). Três passos na
// mesma página: o cliente (ou «Problema interno»), o problema em 2 linhas e
// 1–2 sugestões de solução. Depois, enviar só para análise, ou enviar e
// marcar reunião — a marcação do Google Calendar abre aqui, embutida.

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Building2, CalendarClock, Check, Loader2, Plus, Send, X } from "lucide-react";
import {
  BOTAO_BOOKING_EMBED_URL,
  BOTAO_BOOKING_URL,
  BOTAO_INTERNAL,
  BOTAO_PROBLEM_MAX,
  BOTAO_SOLUTION_MAX,
  validateBotaoDraft,
  type BotaoClientOption,
} from "@/lib/botao/shared";

/** Um emoji curto do Notion; um URL de ícone não serve num chip. */
function emojiOf(icon: string | null): string | null {
  return icon && icon.length <= 4 && !icon.startsWith("http") ? icon : null;
}

function Step({
  n,
  title,
  hint,
  locked,
  done,
  children,
}: {
  n: number;
  title: string;
  hint?: ReactNode;
  locked: boolean;
  done: boolean;
  children: ReactNode;
}) {
  return (
    <section
      inert={locked}
      className={`relative rounded-2xl border p-5 transition sm:p-6 ${
        locked ? "pointer-events-none border-white/[0.06] opacity-45" : "border-white/10 bg-white/[0.025]"
      }`}
    >
      <div className="flex items-start gap-3.5">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white"
          style={{ background: done ? "#10b981" : "linear-gradient(135deg,#783DF5,#C535C9)" }}
        >
          {done ? <Check className="h-4 w-4" /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold leading-tight text-white">{title}</h2>
          {hint && <p className="mt-1 text-[13.5px] leading-relaxed text-white/50">{hint}</p>}
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

function ShortText({
  value,
  onChange,
  max,
  placeholder,
  label,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  max: number;
  placeholder: string;
  label: string;
  autoFocus?: boolean;
}) {
  const left = max - value.length;
  return (
    <div>
      <textarea
        aria-label={label}
        value={value}
        rows={2}
        maxLength={max}
        autoFocus={autoFocus}
        placeholder={placeholder}
        // Uma frase: Enter não parte a linha.
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        onChange={(e) => onChange(e.target.value.replace(/[\r\n]+/g, " "))}
        className="block w-full resize-none rounded-xl border border-white/12 bg-black/30 px-4 py-3 text-[15px] leading-relaxed text-white outline-none transition placeholder:text-white/25 focus:border-[#783DF5]/70 focus:ring-2 focus:ring-[#783DF5]/30"
      />
      <p className={`mt-1.5 text-right text-[11.5px] tabular-nums ${left <= 20 ? "text-amber-300" : "text-white/35"}`}>
        {value.length}/{max}
      </p>
    </div>
  );
}

export function BotaoForm({ clients, firstName }: { clients: BotaoClientOption[]; firstName: string }) {
  const router = useRouter();
  const [client, setClient] = useState("");
  const [problem, setProblem] = useState("");
  const [sol1, setSol1] = useState("");
  const [sol2, setSol2] = useState("");
  const [showSol2, setShowSol2] = useState(false);
  const [sending, setSending] = useState<null | "analise" | "reuniao">(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { meeting: boolean; label: string }>(null);

  const solutions = [sol1, showSol2 ? sol2 : ""].map((s) => s.trim()).filter(Boolean);
  const step1 = client !== "";
  const step2 = problem.trim().length >= 10;
  const step3 = solutions.length > 0;
  const invalid = validateBotaoDraft({ client, problem, solutions });
  const clientLabel =
    client === BOTAO_INTERNAL ? "Problema interno" : clients.find((c) => c.slug === client)?.title ?? "";

  async function send(meeting: boolean) {
    if (invalid || sending) return;
    setSending(meeting ? "reuniao" : "analise");
    setError(null);
    try {
      const res = await fetch("/api/botao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client, problem, solutions, meeting }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Não foi possível enviar.");
      setDone({ meeting, label: clientLabel });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar.");
    } finally {
      setSending(null);
    }
  }

  function reset() {
    setClient("");
    setProblem("");
    setSol1("");
    setSol2("");
    setShowSol2(false);
    setDone(null);
    setError(null);
  }

  if (done) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.07] p-5 sm:p-6">
          <div className="flex items-start gap-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Check className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[17px] font-semibold text-white">Pedido enviado à direção</p>
              <p className="mt-1 text-[14px] leading-relaxed text-white/65">
                {done.label}.{" "}
                {done.meeting
                  ? "Escolhe agora a hora da reunião: a direção já tem o problema e as tuas sugestões por escrito."
                  : "A direção vai analisar e responde-te aqui e no sino."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-white/15 px-4 py-2 text-[13px] font-medium text-white/75 transition hover:border-white/30 hover:text-white"
          >
            Acionar outro
          </button>
        </div>

        {done.meeting && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <CalendarClock className="h-5 w-5 text-[#c4a6ff]" />
                <h2 className="text-[18px] font-semibold text-white">Marca a reunião</h2>
              </div>
              <a
                href={BOTAO_BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] text-[#c4a6ff] underline-offset-4 hover:underline"
              >
                Abrir no Google Calendar <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white">
              <iframe
                src={BOTAO_BOOKING_EMBED_URL}
                title="Marcar reunião com a direção"
                className="block h-[720px] w-full border-0"
                loading="lazy"
              />
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Step
        n={1}
        title="De quem é o problema?"
        hint="Escolhe um dos teus clientes, ou «Problema interno» se não é de nenhum."
        locked={false}
        done={step1}
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setClient(BOTAO_INTERNAL)}
            aria-pressed={client === BOTAO_INTERNAL}
            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[13.5px] transition ${
              client === BOTAO_INTERNAL
                ? "border-[#c4a6ff] bg-[#c4a6ff] font-semibold text-[#120f24]"
                : "border-white/12 text-white/75 hover:border-white/30 hover:text-white"
            }`}
          >
            <Building2 className="h-4 w-4" />
            Problema interno
          </button>
          {clients.map((c) => {
            const on = client === c.slug;
            const emoji = emojiOf(c.icon);
            return (
              <button
                key={c.slug}
                type="button"
                onClick={() => setClient(c.slug)}
                aria-pressed={on}
                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[13.5px] transition ${
                  on
                    ? "border-[#c4a6ff] bg-[#c4a6ff] font-semibold text-[#120f24]"
                    : "border-white/12 text-white/75 hover:border-white/30 hover:text-white"
                }`}
              >
                {emoji && <span aria-hidden>{emoji}</span>}
                {c.title}
              </button>
            );
          })}
        </div>
        {clients.length === 0 && (
          <p className="mt-3 text-[12.5px] text-white/40">Não tens clientes atribuídos: só podes acionar para um problema interno.</p>
        )}
      </Step>

      <Step
        n={2}
        title="O problema, em 2 linhas"
        hint="Quanto mais resumido e desconstruído estiver, por escrito, mais fácil é veres que o consegues resolver."
        locked={!step1}
        done={step2}
      >
        <ShortText
          label="O problema"
          value={problem}
          onChange={setProblem}
          max={BOTAO_PROBLEM_MAX}
          placeholder="O que está a acontecer, numa frase."
        />
      </Step>

      <Step
        n={3}
        title="A tua sugestão de solução"
        hint="Uma ou duas. A direção valida e apoia a que fizer mais sentido."
        locked={!step1 || !step2}
        done={step3}
      >
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-[12.5px] font-medium text-white/55">Sugestão 1</p>
            <ShortText label="Sugestão 1" value={sol1} onChange={setSol1} max={BOTAO_SOLUTION_MAX} placeholder="O que farias para resolver." />
          </div>
          {showSol2 ? (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[12.5px] font-medium text-white/55">Sugestão 2</p>
                <button
                  type="button"
                  onClick={() => {
                    setShowSol2(false);
                    setSol2("");
                  }}
                  className="inline-flex items-center gap-1 text-[12px] text-white/45 transition hover:text-white"
                >
                  <X className="h-3.5 w-3.5" /> Tirar
                </button>
              </div>
              <ShortText label="Sugestão 2" value={sol2} onChange={setSol2} max={BOTAO_SOLUTION_MAX} placeholder="Uma alternativa." autoFocus />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSol2(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-white/15 px-3.5 py-2 text-[13px] text-white/60 transition hover:border-white/30 hover:text-white"
            >
              <Plus className="h-4 w-4" /> Acrescentar uma 2.ª sugestão
            </button>
          )}
        </div>
      </Step>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => send(false)}
            disabled={Boolean(invalid) || sending !== null}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-[14px] font-semibold text-[#07080d] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending === "analise" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar para análise
          </button>
          <button
            type="button"
            onClick={() => send(true)}
            disabled={Boolean(invalid) || sending !== null}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "var(--brand-gradient)" }}
          >
            {sending === "reuniao" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
            Enviar e marcar reunião
          </button>
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-white/45">
          {invalid && !error
            ? `${firstName}, ${invalid.charAt(0).toLowerCase()}${invalid.slice(1)}`
            : "Nos dois casos a direção recebe o pedido por escrito. Em «Marcar reunião», escolhes a hora logo a seguir, nesta página."}
        </p>
        {error && <p className="mt-2 text-[13px] text-rose-300">{error}</p>}
      </div>
    </div>
  );
}
