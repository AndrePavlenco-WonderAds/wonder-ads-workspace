"use client";

// O inquérito de satisfação que o CLIENTE abre — um passo por secção.
//
// DESENHO (v76.68) — isto é a única peça da Wonder Ads que um cliente usa
// sozinho, sem ninguém ao lado a explicar. Por isso pede outra coisa que o
// resto do workspace: não é um painel de trabalho, é um objeto que tem de
// dar vontade de chegar ao fim. As decisões que daí saem:
//
//  • SEM ATALHOS PARA OUTRAS SECÇÕES. Antes o topo era uma grelha clicável
//    com as dez secções: dava para saltar por cima de perguntas e chegar ao
//    fim sem responder, e mostrava logo de entrada dez etapas por fazer, que
//    é a melhor forma de convencer alguém a fechar o separador. Agora o topo
//    diz onde se está e quanto falta, e nada mais.
//  • O PERCURSO É DELE, NÃO DO CATÁLOGO. As perguntas que não dizem respeito
//    aos serviços do cliente não aparecem — e as secções que ficam sem
//    perguntas nenhumas desaparecem do contador. Quem só tem Ads nunca vê a
//    palavra «orgânico».
//  • A ESCALA 0–10 RESPONDE DE VOLTA. Ganha cor conforme a nota (vermelho →
//    âmbar → verde) e escreve por extenso o que a nota significa. Uma fila de
//    onze quadrados cinzentos não diz a ninguém o que está a escolher.
//  • O PEDIDO DE REVIEW É CONDICIONAL. Só quem deu 7+ na satisfação vê o
//    convite para a Google Review; abaixo disso, pedir uma review pública é
//    pedir uma review má — e soa a que ninguém leu o que a pessoa escreveu.
//
// Publica em /api/nps/[slug]/submit, que revalida tudo do lado interno.

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  MessageSquareQuote,
  Star,
  X,
  Sparkles,
} from "lucide-react";
import {
  isMulti,
  isOpen,
  isPersonOpen,
  isPersonScale,
  isQuestionVisible,
  isScale10,
  isSingle,
  otherTextKey,
  personLabel,
  personPhoto,
  personQuestionText,
  personScaleKey,
  qualifiesForGoogleReview,
  visibleSections,
  type NpsMultiQuestion,
  type NpsOpenQuestion,
  type NpsPersonOpenQuestion,
  type NpsPersonScaleQuestion,
  type NpsQuestion,
  type NpsScaleWordSet,
  type NpsSingleQuestion,
} from "@/lib/nps-questions";
import type { PublicLang } from "@/lib/public-i18n";

const BRAND_GRADIENT =
  "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)";

/** Wonder Ads' Google Business review link. Shown on the thank-you screen. */
const GOOGLE_REVIEW_URL = "https://g.page/r/CSxgxSWM0p4VEAE/review";

const COPY = {
  pt: {
    progress: (a: number, b: number) => `${a} de ${b} respondidas`,
    stepOf: (a: number, b: number) => `Passo ${a} de ${b}`,
    back: "Anterior",
    next: "Continuar",
    submit: "Enviar avaliação",
    sending: "A enviar…",
    missing: (n: number) => `Falta${n > 1 ? "m" : ""} ${n} nesta secção`,
    ready: "Tudo respondido nesta secção",
    maxReached: (n: number) => `Máximo de ${n} opções`,
    otherPlaceholder: "Qual? Escreve aqui…",
    noPeople:
      "Volta atrás e seleciona quem te acompanhou para avaliar cada pessoa.",
    scaleHint: "Toca num número (ou usa as setas do teclado)",
    doneMark: "— Avaliação registada —",
    doneTitle: "Obrigado pelo teu tempo.",
    doneBody:
      "A tua avaliação ficou registada e segue já para a equipa que acompanha a tua conta.",
    doneReviewLead:
      "Ajuda-nos a crescer — deixa a tua avaliação no Google (30 segundos):",
    doneNoReviewLead:
      "O que apontaste como menos bom é por onde vamos começar. Se preferires falar disto ao vivo, diz e marcamos.",
    googleReview: "Deixar review no Google",
    closeHint: "Já podes fechar esta janela.",
    errorRetry: "Não foi possível enviar. Tenta novamente.",
    optional: "opcional",
    scaleWords: {
      quality: [
        "Péssimo",
        "Muito mau",
        "Mau",
        "Fraco",
        "Insuficiente",
        "Assim-assim",
        "Razoável",
        "Bom",
        "Muito bom",
        "Excelente",
        "Excecional",
      ],
      satisfaction: [
        "Nada satisfeito",
        "Muito insatisfeito",
        "Insatisfeito",
        "Pouco satisfeito",
        "Aquém do esperado",
        "Neutro",
        "Razoável",
        "Satisfeito",
        "Muito satisfeito",
        "Excelente",
        "Totalmente satisfeito",
      ],
      likelihood: [
        "Nada provável",
        "Muito improvável",
        "Improvável",
        "Pouco provável",
        "Duvidoso",
        "Talvez",
        "Possível",
        "Provável",
        "Muito provável",
        "Quase certo",
        "Certeza",
      ],
    },
  },
  en: {
    progress: (a: number, b: number) => `${a} of ${b} answered`,
    stepOf: (a: number, b: number) => `Step ${a} of ${b}`,
    back: "Back",
    next: "Continue",
    submit: "Submit evaluation",
    sending: "Sending…",
    missing: (n: number) => `${n} left in this section`,
    ready: "This section is complete",
    maxReached: (n: number) => `Max ${n} options`,
    otherPlaceholder: "Which one? Type here…",
    noPeople: "Go back and select who accompanied you to rate each person.",
    scaleHint: "Tap a number (or use the arrow keys)",
    doneMark: "— Evaluation recorded —",
    doneTitle: "Thank you for your time.",
    doneBody:
      "Your evaluation has been recorded and goes straight to the team looking after your account.",
    doneReviewLead:
      "Help us grow — leave your review on Google (30 seconds):",
    doneNoReviewLead:
      "What you flagged as falling short is where we'll start. If you'd rather talk it through, just say the word.",
    googleReview: "Leave a Google review",
    closeHint: "You can now close this window.",
    errorRetry: "Couldn't submit. Please try again.",
    optional: "optional",
    scaleWords: {
      quality: [
        "Terrible",
        "Very poor",
        "Poor",
        "Weak",
        "Not enough",
        "So-so",
        "Fair",
        "Good",
        "Very good",
        "Excellent",
        "Outstanding",
      ],
      satisfaction: [
        "Not at all satisfied",
        "Very dissatisfied",
        "Dissatisfied",
        "Somewhat dissatisfied",
        "Below expectations",
        "Neutral",
        "Fair",
        "Satisfied",
        "Very satisfied",
        "Excellent",
        "Completely satisfied",
      ],
      likelihood: [
        "Not at all likely",
        "Very unlikely",
        "Unlikely",
        "Doubtful",
        "Uncertain",
        "Maybe",
        "Possible",
        "Likely",
        "Very likely",
        "Almost certain",
        "Certain",
      ],
    },
  },
} as const;

const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

/** A cor de uma nota 0–10. Vermelho → âmbar → verde: a escala passa a
 *  responder de volta em vez de ser onze caixas iguais. */
function toneFor(n: number): { solid: string; soft: string; glow: string } {
  if (n <= 4) return { solid: "#e11d48", soft: "rgba(225,29,72,0.10)", glow: "rgba(225,29,72,0.45)" };
  if (n <= 6) return { solid: "#d97706", soft: "rgba(217,119,6,0.10)", glow: "rgba(217,119,6,0.45)" };
  if (n <= 8) return { solid: "#0d9488", soft: "rgba(13,148,136,0.10)", glow: "rgba(13,148,136,0.4)" };
  return { solid: "#059669", soft: "rgba(5,150,105,0.12)", glow: "rgba(5,150,105,0.45)" };
}

function Scale10({
  value,
  onChange,
  lowCap,
  highCap,
  lang,
  words = "quality",
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  lowCap: string;
  highCap: string;
  lang: PublicLang;
  /** Vocabulário da etiqueta — ver NpsScaleWordSet. */
  words?: NpsScaleWordSet;
}) {
  const t = COPY[lang];
  const vocab = t.scaleWords[words];
  const ticks = Array.from({ length: 11 }, (_, i) => i);
  const picked = typeof value === "number";
  const tone = picked ? toneFor(value) : null;

  function onKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(Math.min(10, (value ?? -1) + 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(Math.max(0, (value ?? 11) - 1));
    } else if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      onChange(Number(e.key));
    }
  }

  return (
    <div>
      <div
        role="radiogroup"
        tabIndex={0}
        onKeyDown={onKey}
        className="grid grid-cols-11 gap-1 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5]/35 sm:gap-1.5"
      >
        {ticks.map((n) => {
          const selected = value === n;
          const dim = picked && !selected;
          const nTone = toneFor(n);
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(n)}
              aria-label={String(n)}
              className="group flex items-center justify-center rounded-md py-0.5 outline-none"
            >
              <span
                className={`flex h-9 w-full items-center justify-center rounded-lg border text-[12.5px] font-bold transition-all duration-200 group-hover:-translate-y-1 sm:h-11 sm:text-[13.5px] ${
                  selected ? "nps-pop" : ""
                }`}
                style={{
                  borderColor: selected ? "transparent" : "rgba(0,0,0,0.13)",
                  background: selected ? nTone.solid : "#ffffff",
                  color: selected ? "#fff" : dim ? "rgba(0,0,0,0.32)" : "rgba(0,0,0,0.55)",
                  transform: selected ? "scale(1.1)" : undefined,
                  boxShadow: selected
                    ? `0 10px 24px -8px ${nTone.glow}`
                    : "0 1px 2px rgba(0,0,0,0.04)",
                  opacity: dim ? 0.72 : 1,
                }}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium text-black/45">{lowCap}</span>
        {picked && tone ? (
          <span
            key={value}
            className="nps-pop rounded-full px-2.5 py-1 text-[11.5px] font-bold"
            style={{ background: tone.soft, color: tone.solid }}
          >
            {value}/10 · {vocab[value]}
          </span>
        ) : (
          <span className="hidden text-[10.5px] text-black/30 sm:inline">
            {t.scaleHint}
          </span>
        )}
        <span className="text-[11px] font-medium text-black/45">{highCap}</span>
      </div>
    </div>
  );
}

/** A cara da pessoa, quando ela tem foto publicada; a inicial quando não.
 *
 *  Nem toda a equipa tem retrato no site — quem não tem aparece lá com uma
 *  silhueta genérica, a MESMA para várias pessoas. Uma inicial com a cor da
 *  marca distingue-as; duas silhuetas iguais não. */
function PersonBadge({
  label,
  photo,
  size = 28,
}: {
  label: string;
  photo?: string | null;
  size?: number;
}) {
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt=""
        aria-hidden
        loading="lazy"
        width={size}
        height={size}
        className="shrink-0 rounded-full border border-black/10 bg-white object-cover"
        style={{
          width: size,
          height: size,
          // Os retratos são 3:4 (cabeça e tronco). Num círculo, o corte
          // centrado dava no peito — encostar ao topo põe a cara na moldura.
          objectPosition: "center top",
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        background: BRAND_GRADIENT,
        width: size,
        height: size,
        fontSize: size * 0.4,
      }}
    >
      {label.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** One 0–10 scale per person selected earlier, each labelled with the
 *  person's name. */
function PersonScale({
  q,
  lang,
  people,
  get,
  onChange,
  emptyText,
}: {
  q: NpsPersonScaleQuestion;
  lang: PublicLang;
  people: { value: string; label: string; photo: string | null }[];
  get: (personValue: string) => number | undefined;
  onChange: (personValue: string, v: number) => void;
  emptyText: string;
}) {
  if (people.length === 0) {
    return <p className="text-sm text-black/45">{emptyText}</p>;
  }
  return (
    <div className="flex flex-col gap-5">
      {people.map((p) => (
        <div
          key={p.value}
          className="rounded-2xl border border-black/[0.07] bg-[#fbfaf7] p-4"
        >
          <div className="mb-3 flex items-center gap-2.5 text-[14.5px] font-semibold text-black/80">
            <PersonBadge label={p.label} photo={p.photo} size={34} />
            {p.label}
          </div>
          <Scale10
            value={get(p.value)}
            onChange={(v) => onChange(p.value, v)}
            lowCap={q.capLow[lang]}
            highCap={q.capHigh[lang]}
            lang={lang}
          />
        </div>
      ))}
    </div>
  );
}

/** Uma caixa de texto por pessoa, com o nome dentro da pergunta. */
function PersonOpen({
  q,
  lang,
  people,
  get,
  onChange,
  emptyText,
}: {
  q: NpsPersonOpenQuestion;
  lang: PublicLang;
  people: { value: string; label: string; photo: string | null }[];
  get: (personValue: string) => string;
  onChange: (personValue: string, v: string) => void;
  emptyText: string;
}) {
  if (people.length === 0) {
    return <p className="text-sm text-black/45">{emptyText}</p>;
  }
  return (
    <div className="flex flex-col gap-5">
      {people.map((p) => (
        <div key={p.value}>
          <label className="mb-2 flex items-start gap-2.5 text-[14px] font-medium leading-snug text-black/75">
            <PersonBadge label={p.label} photo={p.photo} size={32} />
            <span className="pt-1">
              {personQuestionText(q, p.label, lang)}
            </span>
          </label>
          <textarea
            value={get(p.value)}
            onChange={(e) => onChange(p.value, e.target.value)}
            placeholder={q.placeholder?.[lang]}
            className="min-h-[88px] w-full resize-y rounded-xl border border-black/12 bg-[#fbfaf7] px-3.5 py-3 text-sm text-black/80 outline-none transition-all duration-200 focus:-translate-y-[1px] focus:border-[#783DF5]/50 focus:bg-white focus:ring-2 focus:ring-[#783DF5]/15"
          />
        </div>
      ))}
    </div>
  );
}

/** Retrato na lista da equipa: retângulo 3:4, não círculo. Os ficheiros em
 *  `public/team/avatar/` são 300×400 com a cabeça a ~40% da altura, ou seja
 *  cabeça e tronco — um círculo cortava-lhes tudo menos a cara. Manter o
 *  mesmo rácio da imagem para não haver corte nenhum na caixa. */
const AVATAR_W = 60;
const AVATAR_H = 80;

function OptionRow({
  on,
  onClick,
  disabled,
  badge,
  square,
  children,
  note,
  person,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  badge?: string;
  square: boolean;
  children: React.ReactNode;
  note?: string;
  /** Lista de pessoas: retrato (ou a inicial, para quem ainda não tem foto)
   *  em vez da letra/caixa. Toda a lista fica com o mesmo peso visual — uma
   *  letra posicional («B», «K») ao lado de caras não diz nada ao cliente. */
  person?: { photo?: string | null; name: string };
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      disabled={disabled && !on}
      className="group flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition-all duration-200 hover:-translate-y-[1px] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
      style={{
        borderColor: on ? "transparent" : "rgba(0,0,0,0.12)",
        background: on ? "rgba(120,61,245,0.07)" : "#fff",
        boxShadow: on
          ? "inset 0 0 0 1.5px #783DF5, 0 10px 24px -14px rgba(120,61,245,0.6)"
          : "0 1px 2px rgba(0,0,0,0.03)",
      }}
    >
      {person ? (
        <span className="relative shrink-0">
          {person.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={person.photo}
              alt={person.name}
              loading="lazy"
              width={AVATAR_W}
              height={AVATAR_H}
              className={`rounded-[10px] border-2 bg-white object-cover transition-all duration-200 ${
                on
                  ? "border-[#783DF5]"
                  : "border-black/15 group-hover:border-black/25"
              }`}
              style={{
                width: AVATAR_W,
                height: AVATAR_H,
                // Sem dessaturar: a foto de quem ainda não foi escolhido tem
                // de estar tão legível como a dos escolhidos, senão o cliente
                // decide sobre caras esbatidas.
                boxShadow: on
                  ? "0 6px 14px -8px rgba(120,61,245,0.65)"
                  : "0 3px 8px -4px rgba(0,0,0,0.3)",
              }}
            />
          ) : (
            <span
              aria-hidden
              className={`flex items-center justify-center rounded-[10px] border-2 font-bold text-white transition-all duration-200 ${
                on ? "border-[#783DF5]" : "border-transparent"
              }`}
              style={{
                background: BRAND_GRADIENT,
                width: AVATAR_W,
                height: AVATAR_H,
                fontSize: AVATAR_W * 0.4,
              }}
            >
              {person.name.trim().charAt(0).toUpperCase()}
            </span>
          )}
          {/* O visto encostado à foto — sem ele, uma lista de caras não diz
              quais estão escolhidas a quem não vê a cor de fundo. */}
          {on && (
            <span
              aria-hidden
              className="nps-pop absolute -bottom-1 -right-1 flex h-[20px] w-[20px] items-center justify-center rounded-full border-2 border-white"
              style={{ background: BRAND_GRADIENT }}
            >
              <Check className="h-3 w-3 text-white" strokeWidth={4} />
            </span>
          )}
        </span>
      ) : badge ? (
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-[10px] font-bold transition-all duration-200 ${
            on ? "nps-pop" : ""
          }`}
          style={{
            background: on ? BRAND_GRADIENT : "rgba(0,0,0,0.06)",
            color: on ? "#fff" : "rgba(0,0,0,0.5)",
          }}
        >
          {badge}
        </span>
      ) : (
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center border transition-all duration-200 ${
            square ? "rounded-[6px]" : "rounded-full"
          } ${on ? "nps-pop" : ""}`}
          style={{
            borderColor: on ? "transparent" : "rgba(0,0,0,0.25)",
            background: on ? BRAND_GRADIENT : "transparent",
          }}
        >
          {on &&
            (square ? (
              <Check className="h-3.5 w-3.5 text-white" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-white" />
            ))}
        </span>
      )}
      <span className="flex flex-col">
        <span className={on ? "text-black/85" : "text-black/70"}>{children}</span>
        {note && (
          <span className="mt-0.5 text-[11px] text-[#A9834F]">{note}</span>
        )}
      </span>
    </button>
  );
}

function SingleChoice({
  q,
  lang,
  value,
  onPick,
}: {
  q: NpsSingleQuestion;
  lang: PublicLang;
  value: string | undefined;
  onPick: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {q.options.map((o, i) => (
        <OptionRow
          key={o.value}
          on={value === o.value}
          onClick={() => onPick(o.value)}
          square={false}
          badge={q.lettered ? LETTERS[i] : undefined}
          note={o.note?.[lang]}
        >
          {o.label[lang]}
        </OptionRow>
      ))}
    </div>
  );
}

function MultiChoice({
  q,
  lang,
  selected,
  onToggle,
  maxNote,
  others,
  onOtherChange,
  otherPlaceholder,
}: {
  q: NpsMultiQuestion;
  lang: PublicLang;
  selected: string[];
  onToggle: (value: string) => void;
  maxNote?: string;
  others: Record<string, string>;
  onOtherChange: (optValue: string, v: string) => void;
  otherPlaceholder: string;
}) {
  const atMax = q.max !== undefined && selected.length >= q.max;
  // Lista de pessoas: basta uma opção com retrato para a pergunta inteira
  // passar a mostrar caras (e iniciais para quem não tem foto) em vez de
  // letras posicionais.
  const isPeople = q.options.some((o) => o.photo);
  return (
    <div>
      {q.hint && (
        <p className="mb-2.5 text-[12.5px] font-medium text-black/55">
          {q.hint[lang]}
        </p>
      )}
      <div className="flex flex-col gap-2">
        {q.options.map((o, i) => {
          const on = selected.includes(o.value);
          return (
            <div key={o.value} className="flex flex-col gap-2">
              <OptionRow
                on={on}
                onClick={() => onToggle(o.value)}
                disabled={atMax}
                square={!q.lettered}
                badge={q.lettered && !isPeople ? LETTERS[i] : undefined}
                person={
                  isPeople ? { photo: o.photo, name: o.label[lang] } : undefined
                }
              >
                {o.label[lang]}
              </OptionRow>
              {o.other && on && (
                <input
                  type="text"
                  value={others[o.value] ?? ""}
                  onChange={(e) => onOtherChange(o.value, e.target.value)}
                  placeholder={otherPlaceholder}
                  className="ml-8 w-[calc(100%-2rem)] rounded-lg border border-[#783DF5]/30 bg-[#f8f7f2] px-3 py-2 text-sm text-black/80 outline-none transition-all duration-200 focus:border-[#783DF5]/60 focus:bg-white focus:ring-2 focus:ring-[#783DF5]/15"
                />
              )}
            </div>
          );
        })}
      </div>
      {atMax && maxNote && (
        <p className="mt-2 text-[11px] font-medium text-[#783DF5]">{maxNote}</p>
      )}
    </div>
  );
}

function OpenText({
  q,
  lang,
  value,
  onChange,
  optionalWord,
}: {
  q: NpsOpenQuestion;
  lang: PublicLang;
  value: string;
  onChange: (v: string) => void;
  optionalWord: string;
}) {
  return (
    <div>
      {q.hint && (
        <p className="mb-2.5 text-[12.5px] font-medium leading-relaxed text-black/55">
          {q.hint[lang]}
        </p>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={q.placeholder?.[lang]}
        className="min-h-[96px] w-full resize-y rounded-xl border border-black/12 bg-[#fbfaf7] px-3.5 py-3 text-sm text-black/80 outline-none transition-all duration-200 focus:-translate-y-[1px] focus:border-[#783DF5]/50 focus:bg-white focus:ring-2 focus:ring-[#783DF5]/15"
      />
      {!q.required && (
        <p className="mt-1 text-[11px] text-black/35">{optionalWord}</p>
      )}
    </div>
  );
}

/** A régua do topo: onde estou, quanto falta — e NADA clicável.
 *  Os pontos contam os passos deste cliente (que não são os do catálogo). */
function ProgressRail({
  step,
  total,
  pct,
  label,
}: {
  step: number;
  total: number;
  pct: number;
  label: string;
}) {
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">
          {label}
        </span>
        <span className="font-mono text-[11px] font-semibold text-[#783DF5]">
          {pct}%
        </span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-black/[0.07]">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background: BRAND_GRADIENT,
            boxShadow: "0 0 14px -2px rgba(120,61,245,0.65)",
          }}
        />
      </div>
      <div className="mt-2 flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{
              background:
                i < step
                  ? "rgba(120,61,245,0.45)"
                  : i === step
                    ? "#783DF5"
                    : "rgba(0,0,0,0.09)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function NpsSurveyForm({
  slug,
  clientName,
  lang,
}: {
  slug: string;
  clientName: string;
  lang: PublicLang;
}) {
  const t = COPY[lang];
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [choices, setChoices] = useState<Record<string, string[]>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );

  // O PERCURSO DEPENDE DAS RESPOSTAS. As secções e as perguntas visíveis
  // recalculam-se a cada escolha — quem não tem Ads nunca vê a pergunta das
  // campanhas, e a secção que ficar vazia sai da contagem.
  const sections = useMemo(() => visibleSections(choices), [choices]);
  const total = sections.length;

  // Uma secção pode desaparecer debaixo dos pés (o cliente volta atrás e
  // desmarca um serviço). Sem este ajuste, o passo ficava fora do intervalo
  // e a página rebentava.
  useEffect(() => {
    setStep((s) => Math.min(s, Math.max(0, total - 1)));
  }, [total]);

  const safeStep = Math.min(step, Math.max(0, total - 1));
  const section = sections[safeStep];

  const isRequired = (q: NpsQuestion): boolean =>
    isScale10(q) ||
    isPersonScale(q) ||
    (isPersonOpen(q) && (q.required ?? true)) ||
    (isSingle(q) && (q.required ?? true)) ||
    (isOpen(q) && Boolean(q.required)) ||
    (isMulti(q) && Boolean(q.required));

  const isAnswered = (q: NpsQuestion): boolean => {
    if (isScale10(q)) return answers[q.name] !== undefined;
    if (isPersonScale(q)) {
      const people = choices[q.source] ?? [];
      return (
        people.length > 0 &&
        people.every((pv) => answers[personScaleKey(q.name, pv)] !== undefined)
      );
    }
    if (isPersonOpen(q)) {
      const people = choices[q.source] ?? [];
      return (
        people.length > 0 &&
        people.every(
          (pv) => (texts[personScaleKey(q.name, pv)]?.trim() ?? "") !== "",
        )
      );
    }
    if (isSingle(q)) return (choices[q.name]?.length ?? 0) > 0;
    if (isOpen(q)) return (texts[q.name]?.trim() ?? "") !== "";
    if (isMulti(q)) return !q.required || (choices[q.name]?.length ?? 0) > 0;
    return true;
  };

  /** As perguntas desta secção que este cliente vai mesmo ver. */
  const visibleQuestions = (s: (typeof sections)[number]) =>
    s.questions.filter((q) => isQuestionVisible(q, choices));

  const requiredQs = useMemo(
    () =>
      sections
        .flatMap((s) => s.questions.filter((q) => isQuestionVisible(q, choices)))
        .filter(isRequired),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sections, choices],
  );
  const answeredCount = requiredQs.filter(isAnswered).length;
  const totalRequired = requiredQs.length;

  const isLast = safeStep === total - 1;
  const stepQuestions = section ? visibleQuestions(section) : [];
  const missingInStep = stepQuestions.filter(
    (q) => isRequired(q) && !isAnswered(q),
  ).length;

  function goTo(target: number) {
    setDir(target >= safeStep ? 1 : -1);
    setStep(Math.max(0, Math.min(total - 1, target)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setAnswer(name: string, v: number) {
    setAnswers((prev) => ({ ...prev, [name]: v }));
  }
  function pickSingle(name: string, value: string) {
    setChoices((prev) => ({ ...prev, [name]: [value] }));
  }
  function toggleMulti(name: string, value: string, max?: number) {
    setChoices((prev) => {
      const cur = prev[name] ?? [];
      if (cur.includes(value)) {
        return { ...prev, [name]: cur.filter((v) => v !== value) };
      }
      if (max !== undefined && cur.length >= max) return prev;
      return { ...prev, [name]: [...cur, value] };
    });
  }
  function setText(name: string, v: string) {
    setTexts((prev) => ({ ...prev, [name]: v }));
  }

  async function submit() {
    setState("sending");
    try {
      const res = await fetch(`/api/nps/${slug}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answers,
          choices,
          texts,
          identification: null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setState("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setState("error");
    }
  }

  function next() {
    if (missingInStep > 0) return;
    if (isLast) {
      submit();
      return;
    }
    goTo(safeStep + 1);
  }

  const wantsReview = qualifiesForGoogleReview(answers);

  if (state === "done") {
    return (
      <div className="nps-done-in relative overflow-hidden rounded-3xl border border-black/8 bg-white px-6 py-14 text-center shadow-[0_30px_80px_-40px_rgba(0,0,0,0.35)]">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full opacity-[0.18] blur-3xl"
          style={{ background: BRAND_GRADIENT }}
        />
        {/* Confetes — só quando há mesmo o que celebrar. */}
        {wantsReview && (
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40">
            {Array.from({ length: 14 }, (_, i) => (
              <span
                key={i}
                className="nps-confetti"
                style={{
                  left: `${6 + i * 6.6}%`,
                  animationDelay: `${(i % 7) * 0.14}s`,
                  background:
                    i % 3 === 0 ? "#783DF5" : i % 3 === 1 ? "#C535C9" : "#343ED7",
                }}
              />
            ))}
          </span>
        )}

        <div
          className="nps-check-pop relative mx-auto flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: BRAND_GRADIENT }}
        >
          <Check className="h-8 w-8 text-white" strokeWidth={3} />
        </div>
        <div
          className="relative mt-5 text-sm font-semibold tracking-wide"
          style={{
            background: BRAND_GRADIENT,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
          }}
        >
          {t.doneMark}
        </div>
        <h2 className="relative mt-2 text-2xl font-semibold tracking-tight text-black/85">
          {t.doneTitle}
        </h2>
        <p className="relative mx-auto mt-2 max-w-sm text-sm leading-relaxed text-black/55">
          {t.doneBody}
        </p>

        {wantsReview ? (
          <div className="relative mx-auto mt-7 max-w-sm rounded-2xl border border-black/8 bg-[#f8f7f2] px-5 py-5">
            <p className="flex items-center justify-center gap-1.5 text-[13px] font-medium text-black/70">
              <Sparkles className="h-3.5 w-3.5 text-[#A9834F]" />
              {t.doneReviewLead}
            </p>
            <a
              href={GOOGLE_REVIEW_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#783DF5]/25 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
              style={{ background: BRAND_GRADIENT }}
            >
              <Star className="h-4 w-4 fill-white" />
              {t.googleReview}
            </a>
          </div>
        ) : (
          <div className="relative mx-auto mt-7 max-w-sm rounded-2xl border border-black/8 bg-[#f8f7f2] px-5 py-5">
            <p className="flex items-start gap-2 text-left text-[13px] leading-relaxed text-black/65">
              <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-[#783DF5]" />
              {t.doneNoReviewLead}
            </p>
          </div>
        )}

        <p className="relative mt-6 flex items-center justify-center gap-2 text-sm font-medium text-black/50">
          <X className="nps-x-pulse h-4 w-4 text-[#783DF5]" strokeWidth={2.5} />
          {t.closeHint}
        </p>
      </div>
    );
  }

  if (!section) return null;

  const pct = totalRequired
    ? Math.round((answeredCount / totalRequired) * 100)
    : 0;
  const ready = missingInStep === 0;

  return (
    <div>
      <ProgressRail
        step={safeStep}
        total={total}
        pct={pct}
        label={t.stepOf(safeStep + 1, total)}
      />

      {/* Section card — re-keyed per step so the slide animation replays */}
      <div
        key={`${section.key}-${safeStep}`}
        className={dir === 1 ? "nps-slide-right" : "nps-slide-left"}
      >
        <div className="relative overflow-hidden rounded-3xl border border-black/8 bg-white px-6 py-7 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.4)] sm:px-8 sm:py-8">
          {/* Fio de luz no topo do cartão — assina-o sem lhe pôr moldura. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
            style={{ background: BRAND_GRADIENT }}
          />

          <div className="mb-6 flex items-baseline gap-3 border-b border-black/8 pb-4">
            <span
              className="font-mono text-[13px] font-bold tracking-widest"
              style={{
                background: BRAND_GRADIENT,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
              }}
            >
              {section.tag}
            </span>
            <h2 className="text-xl font-semibold tracking-tight text-black/85">
              {section.title[lang]}
            </h2>
            <span className="ml-auto shrink-0 text-[11px] text-black/35">
              {t.stepOf(safeStep + 1, total)}
            </span>
          </div>

          <div className="space-y-8">
            {(section.noteAlt && !wantsReview
              ? section.noteAlt
              : section.note) && (
              <div className="nps-q-in flex items-start gap-3 rounded-2xl border border-[#783DF5]/20 bg-[#783DF5]/[0.05] px-4 py-3.5">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#783DF5]" />
                <p className="text-sm leading-relaxed text-black/70">
                  {(section.noteAlt && !wantsReview
                    ? section.noteAlt
                    : section.note)![lang]}
                </p>
              </div>
            )}

            {stepQuestions.map((q, qi) => (
              <div
                key={q.name}
                className="nps-q-in"
                style={{ animationDelay: `${qi * 70}ms` }}
              >
                {/* A pergunta por-pessoa traz o nome em cada caixa; um
                    cabeçalho genérico por cima seria a mesma frase duas
                    vezes seguidas. */}
                {!isPersonOpen(q) && (
                  <div className="mb-3.5 text-[15.5px] font-medium leading-snug text-black/80">
                    {q.q[lang]}
                  </div>
                )}
                {isScale10(q) && (
                  <Scale10
                    value={answers[q.name]}
                    onChange={(v) => setAnswer(q.name, v)}
                    lowCap={q.capLow[lang]}
                    highCap={q.capHigh[lang]}
                    lang={lang}
                    words={q.words}
                  />
                )}
                {isPersonScale(q) && (
                  <PersonScale
                    q={q}
                    lang={lang}
                    people={(choices[q.source] ?? []).map((v) => ({
                      value: v,
                      label: personLabel(q.source, v, lang),
                      photo: personPhoto(q.source, v),
                    }))}
                    get={(pv) => answers[personScaleKey(q.name, pv)]}
                    onChange={(pv, v) => setAnswer(personScaleKey(q.name, pv), v)}
                    emptyText={t.noPeople}
                  />
                )}
                {isPersonOpen(q) && (
                  <PersonOpen
                    q={q}
                    lang={lang}
                    people={(choices[q.source] ?? []).map((v) => ({
                      value: v,
                      label: personLabel(q.source, v, lang),
                      photo: personPhoto(q.source, v),
                    }))}
                    get={(pv) => texts[personScaleKey(q.name, pv)] ?? ""}
                    onChange={(pv, v) => setText(personScaleKey(q.name, pv), v)}
                    emptyText={t.noPeople}
                  />
                )}
                {isSingle(q) && (
                  <SingleChoice
                    q={q}
                    lang={lang}
                    value={choices[q.name]?.[0]}
                    onPick={(v) => pickSingle(q.name, v)}
                  />
                )}
                {isMulti(q) && (
                  <MultiChoice
                    q={q}
                    lang={lang}
                    selected={choices[q.name] ?? []}
                    onToggle={(v) => toggleMulti(q.name, v, q.max)}
                    maxNote={q.max ? t.maxReached(q.max) : undefined}
                    others={Object.fromEntries(
                      q.options
                        .filter((o) => o.other)
                        .map((o) => [
                          o.value,
                          texts[otherTextKey(q.name, o.value)] ?? "",
                        ]),
                    )}
                    onOtherChange={(ov, v) =>
                      setText(otherTextKey(q.name, ov), v)
                    }
                    otherPlaceholder={t.otherPlaceholder}
                  />
                )}
                {isOpen(q) && (
                  <OpenText
                    q={q}
                    lang={lang}
                    value={texts[q.name] ?? ""}
                    onChange={(v) => setText(q.name, v)}
                    optionalWord={t.optional}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {state === "error" && (
        <p className="mt-4 text-center text-sm text-rose-600">{t.errorRetry}</p>
      )}

      {/* Nav */}
      <div className="mt-6 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => goTo(safeStep - 1)}
          disabled={safeStep === 0}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-black/55 transition-all duration-200 hover:-translate-x-0.5 hover:bg-black/[0.04] hover:text-black/80 disabled:invisible"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.back}
        </button>

        <div className="flex items-center gap-4">
          <span className="hidden text-[11px] text-black/40 sm:inline">
            {t.progress(answeredCount, totalRequired)}
          </span>
          <button
            type="button"
            onClick={next}
            disabled={!ready || state === "sending"}
            className={`group inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#783DF5]/25 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0 ${
              ready && state !== "sending" ? "nps-cta-ready" : ""
            }`}
            style={{ background: BRAND_GRADIENT }}
          >
            {state === "sending" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.sending}
              </>
            ) : !ready ? (
              t.missing(missingInStep)
            ) : isLast ? (
              <>
                <Check className="h-4 w-4" />
                {t.submit}
              </>
            ) : (
              <>
                {t.next}
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Nome do cliente em rodapé discreto — quem preenche está a avaliar
          a SUA conta, e ver o próprio nome ancora isso. */}
      <p className="mt-5 text-center text-[11px] text-black/25">{clientName}</p>
    </div>
  );
}
