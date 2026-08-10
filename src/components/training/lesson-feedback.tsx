"use client";

// «Dar feedback sobre este processo» — o cartão por baixo do instrutor, e o
// formulário que ele abre.
//
// DESENHO
//
// • FICA NA AULA, NÃO NO FIM DO CURSO. Um inquérito no fim mede a memória de
//   quem já esqueceu o que o confundiu na aula 4. Aqui pergunta-se enquanto a
//   pessoa está lá dentro, e o formulário já sabe qual é a aula e quem a deu —
//   ninguém tem de escrever isso.
//
// • TRÊS NOTAS, TRÊS COISAS DIFERENTES: o formador, o vídeo e o processo até
//   ali. Juntá-las numa só dava uma média que não se consegue acionar — um 3
//   pode ser um bom formador com um vídeo mau, e a correção é oposta em cada
//   caso.
//
// • O PISCA-PISCA É UMA DÍVIDA, NÃO UM ANÚNCIO. Só começa depois de 15 aulas
//   vistas sem feedback, e volta a acender 15 aulas depois da última resposta.
//   Um pedido que está sempre ligado ensina-se a ignorar; um que aparece
//   quando a pessoa já tem mesmo o que dizer, não.
//
// • CAMPOS DE TEXTO OPCIONAIS, NOTAS OBRIGATÓRIAS. Exigir texto faz aparecer
//   «tudo bem» — que é pior do que nada, porque conta como resposta.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Loader2,
  MessageSquarePlus,
  Star,
  X,
} from "lucide-react";

type Props = {
  trackSlug: string;
  lessonId: string;
  lessonTitle: string;
  presenter: string | null;
  /** Já viu 15+ aulas desde o último feedback — a zona pisca a vermelho. */
  shouldNudge: boolean;
  /** Aulas vistas desde a última resposta (mostrado no aviso). */
  watchedSinceFeedback: number;
  /** Quantas vezes já respondeu — muda o texto de «dar» para «voltar a dar». */
  submissions: number;
};

const RATING_FIELDS = [
  {
    key: "instructor" as const,
    label: "O formador",
    hint: "Explicou bem? Deu exemplos? Soube responder ao que ficou por dizer?",
  },
  {
    key: "video" as const,
    label: "O vídeo desta aula",
    hint: "Ritmo, imagem, som, duração. O que se vê no ecrã ajuda a perceber?",
  },
  {
    key: "process" as const,
    label: "O processo de formação até aqui",
    hint: "A ordem das aulas, o que já sabias fazer no fim, o que ficou a faltar.",
  },
];

export function LessonFeedback({
  trackSlug,
  lessonId,
  lessonTitle,
  presenter,
  shouldNudge,
  watchedSinceFeedback,
  submissions,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState("");
  const [ratings, setRatings] = useState({
    instructor: 0,
    video: 0,
    process: 0,
  });
  const [whatWorked, setWhatWorked] = useState("");
  const [whatMissing, setWhatMissing] = useState("");
  const [suggestions, setSuggestions] = useState("");

  useEffect(() => setMounted(true), []);

  // Esc fecha, e o body deixa de rolar por trás do painel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const complete =
    ratings.instructor > 0 && ratings.video > 0 && ratings.process > 0;

  async function submit() {
    if (!complete || state === "saving") return;
    setState("saving");
    setError("");
    try {
      const res = await fetch("/api/formacao/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          trackSlug,
          lessonId,
          lessonTitle,
          presenter,
          ratings,
          whatWorked,
          whatMissing,
          suggestions,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setState("done");
      // Deixa o «obrigado» respirar antes de recarregar — a página tem de
      // voltar sem o pisca-pisca, e isso vem do servidor.
      setTimeout(() => window.location.reload(), 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar.");
      setState("error");
    }
  }

  return (
    <>
      <section
        className={`overflow-hidden rounded-2xl border transition ${
          shouldNudge
            ? "animate-feedback-nudge border-rose-400/45 bg-rose-500/[0.07]"
            : "border-white/[0.07] bg-white/[0.018]"
        }`}
      >
        <header className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
              shouldNudge
                ? "border-rose-400/40 bg-rose-500/15 text-rose-200"
                : "border-[#783DF5]/30 bg-[#783DF5]/10 text-[#c3aaff]"
            }`}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="readout text-white/40">Feedback</p>
            <p className="text-[10.5px] text-white/30">
              ajuda a melhorar esta formação
            </p>
          </div>
        </header>

        <div className="px-4 py-4">
          {shouldNudge && (
            <p className="mb-3 rounded-lg border border-rose-400/25 bg-rose-500/[0.08] px-3 py-2 text-[11.5px] leading-relaxed text-rose-100">
              Já viste <strong>{watchedSinceFeedback} aulas</strong>
              {submissions > 0 ? " desde a última vez" : ""} e ainda não deste
              feedback sobre a formação. Dois minutos teus mudam o curso de quem
              entrar a seguir.
            </p>
          )}
          <p className="text-[12px] leading-relaxed text-white/50">
            O que achaste do formador, do vídeo e do processo até aqui. Vai
            direto para o C-Level.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[12.5px] font-semibold text-white transition ${
              shouldNudge
                ? "bg-rose-500 hover:bg-rose-400"
                : "brand-gradient-bg hover:brightness-110"
            }`}
          >
            <MessageSquarePlus className="h-4 w-4" />
            {submissions > 0
              ? "Dar feedback outra vez"
              : "Dar feedback sobre este processo"}
          </button>
        </div>
      </section>

      {open &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-label="Feedback sobre a formação"
          >
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => setOpen(false)}
              className="fixed inset-0 h-full w-full cursor-default bg-black/65 backdrop-blur-[2px]"
            />

            <div className="animate-fade-up relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-white/12 bg-[color:var(--background)] shadow-[0_30px_90px_-20px_rgba(0,0,0,0.9)]">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(120,61,245,0.7), rgba(197,53,201,0.4), transparent)",
                }}
              />

              <header className="flex items-start justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
                <div className="min-w-0">
                  <p className="readout text-white/35">Formação</p>
                  <h2 className="mt-0.5 text-[16px] font-semibold tracking-tight text-white">
                    Feedback sobre este processo
                  </h2>
                  <p className="mt-0.5 truncate text-[11.5px] text-white/45">
                    {lessonTitle}
                    {presenter ? ` · ${presenter}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fechar"
                  className="shrink-0 rounded-lg border border-white/10 p-1.5 text-white/50 transition hover:border-white/25 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              {state === "done" ? (
                <div className="px-5 py-12 text-center">
                  <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                    <Check className="h-5 w-5" />
                  </span>
                  <p className="mt-3 text-[14px] font-semibold text-white">
                    Obrigado. Chegou ao C-Level.
                  </p>
                  <p className="mt-1 text-[12px] text-white/50">
                    É com isto que a formação do próximo consultor fica melhor
                    do que a tua.
                  </p>
                </div>
              ) : (
                <>
                  <div className="max-h-[65vh] space-y-5 overflow-y-auto px-5 py-5">
                    {RATING_FIELDS.map((f) => (
                      <div key={f.key}>
                        <p className="text-[13px] font-semibold text-white/85">
                          {f.label}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-white/40">
                          {f.hint}
                        </p>
                        <div className="mt-2 flex gap-1.5">
                          {[1, 2, 3, 4, 5].map((n) => {
                            const on = ratings[f.key] >= n;
                            return (
                              <button
                                key={n}
                                type="button"
                                aria-label={`${n} de 5`}
                                onClick={() =>
                                  setRatings((r) => ({ ...r, [f.key]: n }))
                                }
                                className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                                  on
                                    ? "border-amber-400/50 bg-amber-500/20 text-amber-300"
                                    : "border-white/10 text-white/25 hover:border-white/25 hover:text-white/50"
                                }`}
                              >
                                <Star
                                  className="h-4 w-4"
                                  fill={on ? "currentColor" : "none"}
                                />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    <Field
                      label="O que funcionou bem?"
                      value={whatWorked}
                      onChange={setWhatWorked}
                      placeholder="O que te fez perceber mesmo a matéria."
                    />
                    <Field
                      label="O que faltou ou ficou mal explicado?"
                      value={whatMissing}
                      onChange={setWhatMissing}
                      placeholder="Onde tiveste de perguntar a alguém para conseguires avançar."
                    />
                    <Field
                      label="O que mudarias?"
                      value={suggestions}
                      onChange={setSuggestions}
                      placeholder="Uma aula que falta, uma que sobra, outra ordem…"
                    />
                  </div>

                  <footer className="flex items-center justify-between gap-3 border-t border-white/[0.07] px-5 py-4">
                    <p className="text-[11px] text-white/35">
                      {complete
                        ? "As três notas estão dadas."
                        : "Dá as três notas para enviar."}
                    </p>
                    <button
                      type="button"
                      onClick={submit}
                      disabled={!complete || state === "saving"}
                      className="brand-gradient-bg inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {state === "saving" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MessageSquarePlus className="h-4 w-4" />
                      )}
                      Enviar feedback
                    </button>
                  </footer>
                  {state === "error" && (
                    <p className="border-t border-rose-400/20 bg-rose-500/[0.08] px-5 py-2.5 text-[12px] text-rose-200">
                      {error}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-white/85">
        {label}
        <span className="ml-1.5 text-[10.5px] font-normal text-white/30">
          opcional
        </span>
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        maxLength={2000}
        className="mt-1.5 w-full resize-y rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-[12.5px] leading-relaxed text-white outline-none transition placeholder:text-white/25 focus:border-[#783DF5]/60 focus:bg-white/[0.06]"
      />
    </div>
  );
}
