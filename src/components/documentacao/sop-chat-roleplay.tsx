"use client";

// A encenação do ✅ no SOP de Comunicação (v80.9): a mesma conversa escrita
// de duas maneiras, lado a lado. À esquerda, 5 mensagens («ok», «obrigado»,
// «de nada»); à direita, como os Consultores Wonder fazem: 2 mensagens e uma
// reação. As mensagens entram uma a uma quando o bloco aparece no ecrã
// (o capítulo pode estar escondido até ser aberto) e «Ver outra vez» repete.
// Sem nomes de pessoas: só «Chefia» e «Consultor».

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";

type Msg = { from: "chefia" | "consultor"; text: ReactNode; react?: boolean };

const WRONG: Msg[] = [
  { from: "chefia", text: "Consegues enviar-me o relatório do Cliente X hoje?" },
  { from: "consultor", text: "Ok" },
  { from: "consultor", text: "Já está, enviei-te por email" },
  { from: "chefia", text: "Obrigado!" },
  { from: "consultor", text: "De nada 🙂" },
];

const WONDER: Msg[] = [
  {
    from: "chefia",
    react: true,
    text: (
      <>
        <span className="font-semibold text-[#cdbdff]">@Consultor</span> relatório do Cliente X.
        <br />
        <b>Objetivo:</b> levá-lo à call de amanhã.
        <br />
        <b>Data:</b> hoje até às 17h.
        <br />
        <b>Estrutura:</b> o PDF aqui no grupo.
      </>
    ),
  },
  {
    from: "consultor",
    text: (
      <>
        <span className="font-semibold text-[#cdbdff]">@Chefia</span> relatório do Cliente X: 📎 PDF. Destaque do mês: +18% de cliques
        face a outubro.
      </>
    ),
  },
];

const STEP = 0.55; // segundos entre mensagens

function Bubble({ m, delay, reactDelay }: { m: Msg; delay: number; reactDelay?: number }) {
  const mine = m.from === "consultor";
  return (
    <div className={`sop-msg flex ${mine ? "justify-end" : "justify-start"}`} style={{ "--d": `${delay}s` } as CSSProperties}>
      <div className={`relative max-w-[85%] ${m.react ? "mb-3" : ""}`}>
        <p className={`mb-1 text-[11px] font-semibold ${mine ? "text-right text-emerald-200/70" : "text-[#cdbdff]/80"}`}>
          {mine ? "Consultor" : "Chefia"}
        </p>
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${
            mine ? "rounded-tr-md bg-emerald-500/[0.16] text-white/85" : "rounded-tl-md bg-white/[0.07] text-white/85"
          }`}
        >
          {m.text}
        </div>
        {m.react && reactDelay !== undefined && (
          <span
            className="sop-react absolute -bottom-3 right-3 flex h-7 items-center gap-1 rounded-full border border-white/15 bg-[#14122a] px-2 text-[13px] shadow-lg"
            style={{ "--d": `${reactDelay}s` } as CSSProperties}
            aria-label="Reação do consultor: ✅"
          >
            ✅
          </span>
        )}
      </div>
    </div>
  );
}

function Chat({
  title,
  tone,
  msgs,
  count,
  start,
}: {
  title: string;
  tone: "bad" | "good";
  msgs: Msg[];
  count: ReactNode;
  start: number;
}) {
  // A reação do consultor salta antes da mensagem seguinte dele.
  let t = start;
  const items = msgs.map((m) => {
    const delay = t;
    t += STEP;
    let reactDelay: number | undefined;
    if (m.react) {
      reactDelay = t;
      t += STEP;
    }
    return { m, delay, reactDelay };
  });
  return (
    <div
      className={`flex flex-col rounded-2xl border p-5 ${
        tone === "good" ? "border-[#c4a6ff]/45 bg-[#783DF5]/[0.1]" : "border-white/10 bg-white/[0.025]"
      }`}
    >
      <p className={`text-[12.5px] font-semibold ${tone === "good" ? "text-[#c4a6ff]" : "text-white/45"}`}>{title}</p>
      <div className="mt-4 flex-1 space-y-3">
        {items.map(({ m, delay, reactDelay }, i) => (
          <Bubble key={i} m={m} delay={delay} reactDelay={reactDelay} />
        ))}
      </div>
      <div
        className={`sop-msg mt-5 rounded-xl px-4 py-2.5 text-center text-[14px] font-semibold ${
          tone === "good" ? "bg-[#c4a6ff] text-[#120f24]" : "bg-rose-500/[0.12] text-rose-100/90"
        }`}
        style={{ "--d": `${t}s` } as CSSProperties}
      >
        {count}
      </div>
    </div>
  );
}

export function SopChatRoleplay() {
  const ref = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setRun((r) => r || 1);
          obs.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref}>
      <div key={run} data-play={run > 0 ? "1" : "0"} className="sop-chat grid gap-3 md:grid-cols-2">
        <Chat title="Um exemplo errado" tone="bad" msgs={WRONG} count="5 mensagens" start={0.2} />
        <Chat title="Como os Consultores Wonder fazem" tone="good" msgs={WONDER} count="2 mensagens + 1 ✅" start={0.5} />
      </div>
      <button
        type="button"
        onClick={() => setRun((r) => r + 1)}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[12.5px] text-white/45 transition hover:text-white"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Ver outra vez
      </button>
    </div>
  );
}
