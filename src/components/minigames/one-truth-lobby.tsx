"use client";

// Lobby de «Uma verdade, duas mentiras»: cada pessoa escreve as suas 3
// frases e marca a verdadeira; ao lado, quem está na sala e quem já está
// pronto. O rascunho fica no localStorage até ser gravado — um refresh a
// meio não apaga o que se escreveu.

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Lightbulb, Loader2, Pencil, X } from "lucide-react";
import { STATEMENT_MAX, STATEMENT_MIN, type GameView } from "@/lib/minigames/types";
import { Avatar, LETTERS, STATEMENT_TONES, firstName } from "./ui";

type Act = (action: string, payload?: Record<string, unknown>) => Promise<boolean>;

const STARTERS = [
  "Já conheci pessoalmente…",
  "Uma vez perdi…",
  "Já fui expulso/a de…",
  "Já comi…",
  "Tenho medo de…",
  "Já ganhei um prémio de…",
  "Já viajei sozinho/a para…",
  "Sei tocar…",
  "Já dormi em…",
  "Já apareci na televisão…",
  "Em criança, eu…",
  "Nunca na vida…",
];

const EXAMPLE = [
  "Já perdi um voo por estar no terminal errado.",
  "Já fui figurante numa novela portuguesa.",
  "Sei dizer o alfabeto ao contrário em menos de 10 segundos.",
];

function isValid(s: string) {
  const t = s.trim();
  return t.length >= STATEMENT_MIN && t.length <= STATEMENT_MAX;
}

export function OneTruthLobby({ view, act, busy }: { view: GameView; act: Act; busy: string | null }) {
  const ready = view.players.find((p) => p.username === view.me.username)?.ready ?? false;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
      <div>
        {view.me.joined && (ready ? <ReadyCard view={view} act={act} busy={busy} /> : <EntryEditor view={view} act={act} busy={busy} />)}
      </div>
      <PlayersPanel view={view} act={act} busy={busy} />
    </div>
  );
}

function EntryEditor({ view, act, busy }: { view: GameView; act: Act; busy: string | null }) {
  const draftKey = `mg-draft:${view.id}`;
  const [statements, setStatements] = useState<string[]>(() => view.myEntry?.statements ?? ["", "", ""]);
  const [truth, setTruth] = useState<number | null>(() => view.myEntry?.truth ?? null);
  const [showExample, setShowExample] = useState(false);
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const lastFocus = useRef(0);
  const draftLoaded = useRef(false);

  // O rascunho só se lê depois de montar: o HTML do servidor não conhece o
  // localStorage, e lê-lo no primeiro render dava um erro de hidratação.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      const d = raw ? (JSON.parse(raw) as { s?: string[]; t?: number | null }) : null;
      // Só quando nada foi gravado ainda — depois de «Tudo pronto» manda o servidor.
      if (d && Array.isArray(d.s) && d.s.length === 3 && !statements.some((x) => x.trim())) {
        setStatements(d.s);
        if (typeof d.t === "number") setTruth(d.t);
      }
    } catch {}
    draftLoaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    if (!draftLoaded.current) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ s: statements, t: truth }));
    } catch {}
  }, [draftKey, statements, truth]);

  const valid = statements.map(isValid);
  const dupes = new Set(statements.map((s) => s.trim().toLowerCase()).filter(Boolean)).size !== statements.filter((s) => s.trim()).length;
  const missing = useMemo(() => {
    const list: string[] = [];
    const empty = valid.filter((v) => !v).length;
    if (empty) list.push(empty === 3 ? "Escreve as 3 frases" : `Falta${empty > 1 ? "m" : ""} ${empty} frase${empty > 1 ? "s" : ""}`);
    if (truth === null) list.push("Marca qual é a verdade");
    if (dupes) list.push("As frases têm de ser diferentes");
    return list;
  }, [valid, truth, dupes]);
  const canSave = missing.length === 0;

  function setAt(i: number, value: string) {
    setStatements((prev) => prev.map((s, k) => (k === i ? value.slice(0, STATEMENT_MAX) : s)));
  }

  function applyStarter(starter: string) {
    const text = starter.replace(/…$/, " ");
    const target = statements[lastFocus.current]?.trim() ? statements.findIndex((s) => !s.trim()) : lastFocus.current;
    const i = target === -1 ? lastFocus.current : target;
    setAt(i, text);
    requestAnimationFrame(() => {
      const el = refs.current[i];
      if (el) {
        el.focus();
        el.setSelectionRange(text.length, text.length);
      }
    });
  }

  async function save() {
    const ok = await act("save", { statements: statements.map((s) => s.trim()), truth });
    if (ok) {
      try {
        localStorage.removeItem(draftKey);
      } catch {}
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white sm:text-2xl">As tuas 3 frases</h2>
          <p className="mt-1 max-w-xl text-sm text-white/55">
            Uma <span className="font-semibold text-emerald-300">verdade</span> sobre ti e duas{" "}
            <span className="font-semibold text-rose-300">mentiras</span> bem convincentes. Cada pessoa que enganares vale pontos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowExample((v) => !v)}
          className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/[0.08] hover:text-white"
        >
          {showExample ? "Esconder exemplo" : "Ver um exemplo"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showExample && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-2xl border border-dashed border-white/12 bg-black/20 p-4 text-sm text-white/70">
              {EXAMPLE.map((s, i) => (
                <p key={s} className="flex gap-2 py-0.5">
                  <span className="font-bold" style={{ color: STATEMENT_TONES[i].text }}>{LETTERS[i]}</span>
                  {s}
                </p>
              ))}
              <p className="mt-2 text-xs text-white/40">Qual é a verdade? Só quem escreveu sabe — é esse o jogo.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-5 space-y-3">
        {statements.map((s, i) => {
          const isTruth = truth === i;
          const tone = STATEMENT_TONES[i];
          return (
            <motion.div
              key={i}
              layout
              className={`relative rounded-2xl border p-3 transition sm:p-4 ${
                isTruth
                  ? "border-emerald-400/60 bg-emerald-400/[0.06] shadow-[0_0_0_1px_rgba(52,211,153,0.25),0_12px_40px_-18px_rgba(52,211,153,0.6)]"
                  : truth !== null
                    ? "border-rose-400/20 bg-rose-400/[0.025]"
                    : "border-white/10 bg-black/20 focus-within:border-white/25"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold"
                  style={{ background: tone.soft, color: tone.text, boxShadow: `inset 0 0 0 1px ${tone.ring}55` }}
                >
                  {LETTERS[i]}
                </span>
                <div className="min-w-0 flex-1">
                  <textarea
                    ref={(el) => {
                      refs.current[i] = el;
                    }}
                    value={s}
                    onFocus={() => {
                      lastFocus.current = i;
                    }}
                    onChange={(e) => setAt(i, e.target.value.replace(/\n/g, " "))}
                    rows={2}
                    placeholder={["Ex.: Já conheci um jogador da seleção num elevador.", "Ex.: Tenho uma coleção de 200 ímanes de frigorífico.", "Ex.: Já fiz um mergulho com tubarões."][i]}
                    className="w-full resize-none bg-transparent text-[15px] leading-snug text-white outline-none placeholder:text-white/25 sm:text-base"
                  />
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <span className={`text-[11px] tabular-nums ${s.length > STATEMENT_MAX - 20 ? "text-amber-300" : "text-white/30"}`}>
                      {s.trim().length}/{STATEMENT_MAX}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTruth(isTruth ? null : i)}
                      aria-pressed={isTruth}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                        isTruth
                          ? "bg-emerald-400 text-emerald-950 shadow-[0_6px_20px_-6px_rgba(52,211,153,0.8)]"
                          : truth !== null
                            ? "border border-rose-400/25 bg-rose-400/[0.06] text-rose-200/80 hover:border-emerald-400/50 hover:text-emerald-200"
                            : "border border-white/15 bg-white/[0.04] text-white/70 hover:border-emerald-400/50 hover:bg-emerald-400/10 hover:text-emerald-200"
                      }`}
                    >
                      {isTruth ? (
                        <>
                          <Check className="h-3.5 w-3.5" strokeWidth={3} /> É a verdade
                        </>
                      ) : truth !== null ? (
                        "Mentira"
                      ) : (
                        "Esta é a verdade"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 inline-flex items-center gap-1 text-xs text-white/45">
          <Lightbulb className="h-3.5 w-3.5 text-amber-300" /> Sem ideias?
        </span>
        {STARTERS.map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => applyStarter(st)}
            className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11.5px] text-white/60 transition hover:border-[#A35BFF]/50 hover:bg-[#783DF5]/10 hover:text-white"
          >
            {st}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-white/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-h-[20px] text-xs text-white/45">
          {canSave ? (
            <span className="text-emerald-300/90">Tudo certo — carrega no botão para fechar as tuas frases.</span>
          ) : (
            missing.join(" · ")
          )}
        </div>
        <button
          type="button"
          onClick={save}
          disabled={!canSave || busy === "save"}
          className="brand-gradient-bg inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_40px_-14px_rgba(120,61,245,0.9)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={3} />}
          Tudo pronto
        </button>
      </div>
    </section>
  );
}

function ReadyCard({ view, act, busy }: { view: GameView; act: Act; busy: string | null }) {
  const entry = view.myEntry;
  return (
    <motion.section
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="relative overflow-hidden rounded-3xl border border-emerald-400/30 bg-emerald-400/[0.04] p-5 sm:p-7"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="flex items-start gap-4">
        <motion.span
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-400 text-emerald-950"
        >
          <Check className="h-6 w-6" strokeWidth={3} />
        </motion.span>
        <div>
          <h2 className="text-xl font-semibold text-white sm:text-2xl">Tudo pronto!</h2>
          <p className="mt-1 text-sm text-white/55">
            As tuas frases estão guardadas. Agora é esperar que o anfitrião comece — e treinar a cara de poker.
          </p>
        </div>
      </div>
      <div className="mt-5 space-y-2">
        {entry?.statements.map((s, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
              entry.truth === i ? "border-emerald-400/40 bg-emerald-400/[0.07] text-white" : "border-white/8 bg-black/20 text-white/70"
            }`}
          >
            <span className="font-bold" style={{ color: STATEMENT_TONES[i].text }}>{LETTERS[i]}</span>
            <span className="flex-1">{s}</span>
            <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider ${entry.truth === i ? "text-emerald-300" : "text-rose-300/70"}`}>
              {entry.truth === i ? "verdade" : "mentira"}
            </span>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => act("unready")}
        disabled={busy === "unready"}
        className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
      >
        {busy === "unready" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
        Editar as frases
      </button>
    </motion.section>
  );
}

function PlayersPanel({ view, act, busy }: { view: GameView; act: Act; busy: string | null }) {
  const readyCount = view.players.filter((p) => p.ready).length;
  return (
    <aside className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Na sala</h2>
        <span className="text-xs text-white/45">
          <span className="font-semibold text-emerald-300">{readyCount}</span> de {view.players.length} com as frases prontas
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className="h-full rounded-full bg-emerald-400"
          animate={{ width: `${view.players.length ? (readyCount / view.players.length) * 100 : 0}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>

      <ul className="mt-4 space-y-1.5">
        <AnimatePresence initial={false}>
          {view.players.map((p) => {
            const isMe = p.username === view.me.username;
            return (
              <motion.li
                key={p.username}
                layout
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16, height: 0 }}
                className="group flex items-center gap-3 rounded-2xl px-2 py-1.5 transition hover:bg-white/[0.03]"
              >
                <span className="relative">
                  <Avatar name={p.name} avatar={p.avatar} size={40} />
                  <AnimatePresence>
                    {p.ready && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 20 }}
                        className="absolute -bottom-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-emerald-400 text-emerald-950 ring-2 ring-[#0b0c12]"
                      >
                        <Check className="h-3 w-3" strokeWidth={3.5} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-white/90">
                    {p.name}
                    {isMe && <span className="ml-1.5 text-xs font-normal text-white/40">(tu)</span>}
                  </span>
                  <span className="block text-[11px]">
                    {p.ready ? (
                      <span className="text-emerald-300/90">Frases prontas</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-white/40">
                        a escrever
                        <TypingDots />
                      </span>
                    )}
                  </span>
                </span>
                {view.me.canHost && !isMe && (
                  <button
                    type="button"
                    onClick={() => act("kick", { target: p.username })}
                    disabled={busy === "kick"}
                    className="rounded-full p-1.5 text-white/30 opacity-0 transition hover:bg-rose-500/15 hover:text-rose-300 focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={`Tirar ${p.name} da sala`}
                    title="Tirar da sala"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {!view.me.canHost && (
        <div className="mt-5 flex items-center gap-2.5 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-xs text-white/55">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#A35BFF]" />
          À espera de {firstName(view.hostName)} para começar o jogo…
        </div>
      )}
      {view.me.joined && (
        <button
          type="button"
          onClick={() => act("leave")}
          disabled={busy === "leave"}
          className="mt-4 text-[11px] text-white/35 underline-offset-2 transition hover:text-rose-300 hover:underline"
        >
          Sair da sala
        </button>
      )}
    </aside>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1 w-1 rounded-full bg-white/40"
          animate={{ opacity: [0.2, 1, 0.2], y: [0, -2, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}
