"use client";

// Estúdio de Weekly Reports — cola-se a semana de daily updates, sai um
// weekly report por cliente, pronto a colar no grupo de WhatsApp dele.
//
// DESENHO
//
// • CINCO BLOCOS, UM POR DIA ÚTIL. Podia ser uma caixa só, mas o consultor
//   não tem a semana num sítio — tem-na espalhada por cinco mensagens que
//   escreveu em cinco dias. A caixa por dia é a forma do material de
//   origem, não uma exigência da app: cola-se dia a dia sem ter de juntar
//   nada primeiro, e vê-se logo qual é o dia que falta.
//
// • O DIA VAZIO NÃO É ERRO. Feriados, férias, dias sem update. Só entram os
//   blocos com texto.
//
// • O QUE SAI É EDITÁVEL. A mensagem vai para um cliente que paga; o
//   consultor é o último a ler antes de enviar, e tem de poder corrigir uma
//   palavra sem voltar a gerar tudo.
//
// • OS AVISOS FICAM NO CARTÃO. Cliente que não bate com a carteira, roadmap
//   sem semana seguinte — aparece no cartão do próprio cliente, não numa
//   barra geral que se lê uma vez e se esquece.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ClipboardPaste,
  Copy,
  Loader2,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Wand2,
} from "lucide-react";

type Card = {
  slug: string | null;
  title: string;
  rawName: string;
  message: string;
  source: { day: string; text: string }[];
  nextWeek: string[];
  warnings: string[];
};

export function WeeklyReportStudio({
  days,
}: {
  days: { label: string; date: string }[];
}) {
  const [texts, setTexts] = useState<string[]>(() => days.map(() => ""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [instructions, setInstructions] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);

  const filled = texts.filter((t) => t.trim()).length;

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/seo/weekly-reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          blocks: days.map((d, i) => ({
            label: `${d.label} ${d.date}`,
            text: texts[i] ?? "",
          })),
          ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setCards(data.cards as Card[]);
      const d: Record<string, string> = {};
      for (const c of data.cards as Card[]) {
        d[c.slug ?? c.rawName] = c.message;
      }
      setDrafts(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [days, texts, instructions]);

  return (
    <>
      {/* ---------- Entrada: a semana em cinco blocos ---------- */}
      <section className="animate-fade-up mt-8">
        <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-white">
              1 · Cola os daily updates da semana
            </h2>
            <p className="mt-0.5 text-[12px] text-white/50">
              Um bloco por dia, tal como o escreveste no grupo interno. Dias
              sem update ficam em branco.
            </p>
          </div>
          <span className="tabular text-[11.5px] text-white/45">
            {filled} de {days.length} dias preenchidos
          </span>
        </header>

        <div className="grid gap-3 lg:grid-cols-5">
          {days.map((d, i) => (
            <div
              key={d.label}
              className={`rounded-2xl border p-3 transition ${
                texts[i]?.trim()
                  ? "border-[#783DF5]/35 bg-white/[0.05]"
                  : "border-white/[0.10] bg-white/[0.025]"
              }`}
            >
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="text-[12.5px] font-semibold text-white/85">
                  {d.label}
                </span>
                <span className="tabular text-[11px] text-white/40">
                  {d.date}
                </span>
              </div>
              <textarea
                value={texts[i] ?? ""}
                onChange={(e) =>
                  setTexts((cur) => {
                    const next = [...cur];
                    next[i] = e.target.value;
                    return next;
                  })
                }
                rows={10}
                placeholder={
                  i === 0
                    ? "White Clinic:\n• A tratar da questão dos apontamentos DNS\n\nSentir Saúde:\n• Criada página MBST em inglês"
                    : "Cola aqui o daily update deste dia…"
                }
                className="w-full resize-y rounded-lg border border-white/12 bg-black/25 px-2.5 py-2 text-[12px] leading-relaxed text-white/90 outline-none transition placeholder:text-white/22 focus:border-[#783DF5]/60"
              />
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void generate()}
            disabled={loading || filled === 0}
            className="brand-gradient-bg inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-[#783DF5]/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {loading ? "A mastigar a semana…" : "Gerar weekly reports"}
          </button>
          <button
            type="button"
            onClick={() => setShowInstructions((s) => !s)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-[12.5px] font-medium transition ${
              showInstructions
                ? "border-[#783DF5]/60 bg-[#783DF5]/15 text-white"
                : "border-white/15 bg-white/[0.04] text-white/80 hover:border-white/30 hover:text-white"
            }`}
          >
            <Wand2 className="h-3.5 w-3.5" />
            Instruções extra
          </button>
          {texts.some((t) => t.trim()) && (
            <button
              type="button"
              onClick={() => {
                setTexts(days.map(() => ""));
                setCards(null);
                setError(null);
              }}
              className="text-[12px] text-white/40 underline-offset-2 transition hover:text-white/70 hover:underline"
            >
              Limpar tudo
            </button>
          )}
        </div>

        {showInstructions && (
          <div className="mt-3 rounded-xl border border-white/12 bg-white/[0.025] p-3">
            <label className="readout block text-white/50">
              Instruções para a IA (aplicam-se a todos os clientes)
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              placeholder="ex.: tom mais caloroso; menciona que estamos disponíveis para call; não uses a palavra «otimizar» duas vezes…"
              className="mt-1.5 w-full resize-y rounded-lg border border-white/12 bg-black/25 px-2.5 py-2 text-[12px] text-white/90 outline-none placeholder:text-white/25 focus:border-[#783DF5]/60"
            />
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/[0.08] px-3.5 py-2.5 text-[12.5px] text-rose-100">
            {error}
          </p>
        )}
      </section>

      {/* ---------- Saída: um cartão por cliente ---------- */}
      {cards && cards.length > 0 && (
        <section className="animate-fade-up mt-10">
          <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-white">
                2 · {cards.length} weekly report
                {cards.length === 1 ? "" : "s"} — um por cliente
              </h2>
              <p className="mt-0.5 text-[12px] text-white/50">
                Lê antes de enviar. Cada mensagem vai para o grupo de WhatsApp
                do cliente respetivo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void generate()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-white/80 transition hover:border-white/30 hover:text-white disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              Regenerar todos
            </button>
          </header>

          <div className="grid gap-4 xl:grid-cols-2">
            {cards.map((c) => (
              <ReportCard
                key={c.slug ?? c.rawName}
                card={c}
                draft={drafts[c.slug ?? c.rawName] ?? ""}
                onDraft={(v) =>
                  setDrafts((d) => ({ ...d, [c.slug ?? c.rawName]: v }))
                }
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function ReportCard({
  card,
  draft,
  onDraft,
}: {
  card: Card;
  draft: string;
  onDraft: (v: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showSource, setShowSource] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.12] bg-white/[0.04]">
      <header className="flex flex-wrap items-center gap-2.5 border-b border-white/[0.08] px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-200">
          <MessageCircle className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-white">
            {card.title}
          </p>
          <p className="text-[11px] text-white/45">
            {card.source.length} tarefa{card.source.length === 1 ? "" : "s"} nos
            daily updates · {card.nextWeek.length} no roadmap da próxima semana
          </p>
        </div>
        {card.slug && (
          <Link
            href={`/seo/${card.slug}/roadmap`}
            className="shrink-0 rounded-lg border border-white/12 px-2.5 py-1 text-[11px] text-white/60 transition hover:border-white/30 hover:text-white"
          >
            Roadmap
          </Link>
        )}
      </header>

      {card.warnings.length > 0 && (
        <div className="border-b border-amber-400/20 bg-amber-500/[0.07] px-4 py-2.5">
          {card.warnings.map((w, i) => (
            <p
              key={i}
              className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-amber-100"
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              {w}
            </p>
          ))}
        </div>
      )}

      <div className="p-4">
        <textarea
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          rows={16}
          className="w-full resize-y rounded-lg border border-white/12 bg-black/25 px-3 py-2.5 text-[12.5px] leading-relaxed text-white/90 outline-none focus:border-[#783DF5]/60"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(draft);
                setCopied(true);
              } catch {
                /* a área de texto continua selecionável */
              }
            }}
            disabled={!draft}
            className="brand-gradient-bg inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-semibold text-white transition hover:brightness-110 disabled:opacity-45"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copiar mensagem
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowSource((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-2 text-[12px] text-white/60 transition hover:border-white/30 hover:text-white"
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            {showSource ? "Esconder origem" : "Ver origem"}
          </button>
        </div>

        {showSource && (
          <div className="mt-3 space-y-3 rounded-lg border border-white/[0.08] bg-black/20 p-3">
            <div>
              <p className="readout text-white/40">Dos daily updates</p>
              <ul className="mt-1.5 space-y-1">
                {card.source.map((s, i) => (
                  <li key={i} className="flex gap-2 text-[11.5px] text-white/65">
                    <span className="shrink-0 text-white/30">{s.day}</span>
                    <span>{s.text}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="readout text-white/40">
                Do roadmap · próxima semana
              </p>
              {card.nextWeek.length > 0 ? (
                <ul className="mt-1.5 space-y-1">
                  {card.nextWeek.map((t, i) => (
                    <li key={i} className="text-[11.5px] text-white/65">
                      • {t}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-amber-200/70">
                  Nada registado.
                  {card.slug && (
                    <Link
                      href={`/seo/${card.slug}/roadmap`}
                      className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                    >
                      Abrir roadmap
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
