"use client";

// Definições — automação, voz da marca, as cinco estratégias e a ligação ao
// Google. Tudo num rascunho local; a barra de guardar aparece quando há
// alterações.

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import {
  Bot,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Loader2,
  MapPin,
  RefreshCw,
  Info,
  RotateCcw,
  Save,
  Sparkles,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { formatDateTime } from "@/lib/dates";
import { DEFAULT_STRATEGIES } from "@/lib/reviews-hub/defaults";
import { REPLY_EXAMPLES, REPLY_GUIDE, REPLY_MODEL_LABEL } from "@/lib/reviews-hub/reply-guide";
import type { HubSettings, ResponseMode, StarLevel } from "@/lib/reviews-hub/types";
import { useHub } from "./hub-context";
import { LEVELS, LevelFace, Panel, StarRow, formatRating, relativeTime } from "./hub-ui";

const MODES: { key: ResponseMode; label: string; hint: string }[] = [
  { key: "auto", label: "Automático", hint: "publica logo no Google" },
  { key: "approval", label: "Com aprovação", hint: "deixa um rascunho para rever" },
  { key: "manual", label: "Manual", hint: "não faz nada sozinha" },
];

export function SettingsView() {
  const { settings, setSettings, slug, viewer, toast } = useHub();
  const [draft, setDraft] = useState<HubSettings>(settings);
  const [saving, setSaving] = useState(false);
  const readOnly = !viewer.canWrite;
  useEffect(() => setDraft(settings), [settings]);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(settings), [draft, settings]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/reviews-hub/${slug}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: draft }),
      });
      const j = (await res.json().catch(() => ({}))) as { settings?: HubSettings; error?: string };
      if (!res.ok || !j.settings) throw new Error(j.error ?? "Não foi possível guardar.");
      setSettings(j.settings);
      toast(
        j.settings.automation.enabled && !settings.automation.enabled
          ? "Automação ligada — as próximas reviews já são tratadas sozinhas."
          : "Definições guardadas.",
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível guardar.", "error");
    } finally {
      setSaving(false);
    }
  }

  const set = (patch: Partial<HubSettings>) => setDraft((d) => ({ ...d, ...patch }));
  const setStrategy = (l: StarLevel, patch: Partial<HubSettings["strategies"]["1"]>) =>
    setDraft((d) => ({ ...d, strategies: { ...d.strategies, [`${l}`]: { ...d.strategies[`${l}`], ...patch } } }));

  return (
    <div className="space-y-5 pb-24">
      <AutomationCard draft={draft} set={set} setStrategy={setStrategy} readOnly={readOnly} />
      <div className="grid gap-5 xl:grid-cols-2">
        <VoiceCard draft={draft} set={set} readOnly={readOnly} />
        <GoogleCard />
      </div>
      <StrategiesCard draft={draft} setStrategy={setStrategy} readOnly={readOnly} />
      <GuideCard signature={draft.signature} />

      <AnimatePresence>
        {dirty && !readOnly && (
          <motion.div
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="fixed inset-x-0 bottom-5 z-[70] mx-auto flex w-[min(560px,calc(100vw-2rem))] items-center gap-3 rounded-2xl border border-white/12 bg-[#14141f]/95 px-4 py-3 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="rhub-ping absolute inset-0 rounded-full bg-amber-400" />
              <span className="relative h-2.5 w-2.5 rounded-full bg-amber-400" />
            </span>
            <span className="flex-1 text-[13px] text-white/75">Tem alterações por guardar</span>
            <button
              onClick={() => setDraft(settings)}
              className="rounded-xl px-3 py-2 text-[13px] font-medium text-white/55 transition hover:bg-white/[0.06] hover:text-white"
            >
              Descartar
            </button>
            <button
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#4f46e5,#7c3aed_55%,#a855f7)] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_10px_30px_-12px_rgba(124,58,237,0.9)] disabled:opacity-70"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Automação ─────────────────────────────────────────────────────────
function AutomationCard({
  draft,
  set,
  setStrategy,
  readOnly,
}: {
  draft: HubSettings;
  set: (p: Partial<HubSettings>) => void;
  setStrategy: (l: StarLevel, p: Partial<HubSettings["strategies"]["1"]>) => void;
  readOnly: boolean;
}) {
  const { data } = useHub();
  const publishAvailable = Boolean(data.sync.publishAvailable);
  const on = draft.automation.enabled;
  const autoLevels = ([1, 2, 3, 4, 5] as StarLevel[]).filter((l) => draft.strategies[`${l}`].mode === "auto");
  return (
    <Panel className="relative overflow-hidden p-5 sm:p-6">
      <motion.span
        className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full blur-3xl"
        animate={{ background: on ? "rgba(52,211,153,0.18)" : "rgba(139,92,246,0.12)" }}
        transition={{ duration: 0.8 }}
        aria-hidden
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="flex items-center gap-2.5 text-lg font-semibold text-white">
            <Bot className="h-5 w-5 text-violet-300" /> Automação das respostas
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-white/55">
            A cada 30 minutos a plataforma vai buscar as reviews novas ao Google e trata-as segundo o modo de cada nível
            de estrelas. Só mexe em reviews recebidas <strong className="font-semibold text-white/75">depois</strong> de a
            automação ser ligada — nunca responde sozinha ao histórico.
          </p>
          <AnimatePresence mode="wait">
            <motion.p
              key={on ? "on" : "off"}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`mt-3 text-[13px] ${on ? "text-emerald-300" : "text-white/40"}`}
            >
              {on
                ? draft.automation.enabledAt
                  ? `Ativa desde ${formatDateTime(draft.automation.enabledAt)}${draft.automation.updatedBy ? ` · ${draft.automation.updatedBy}` : ""}`
                  : "Fica ativa assim que guardar."
                : "Em pausa — nenhuma resposta sai sozinha."}
            </motion.p>
          </AnimatePresence>
        </div>
        <Switch
          checked={on}
          disabled={readOnly}
          onChange={(v) => set({ automation: { ...draft.automation, enabled: v } })}
        />
      </div>

      <div className="relative mt-6 grid gap-2.5">
        {([1, 2, 3, 4, 5] as StarLevel[]).map((l) => {
          const s = draft.strategies[`${l}`];
          return (
            <div
              key={l}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 sm:flex-nowrap"
            >
              <LevelFace level={l} size={34} />
              <span className="min-w-[150px] flex-1">
                <span className="block text-[13px] font-semibold text-white/90">{LEVELS[l].label}</span>
                <span className="block text-[12px] text-white/40">{s.title}</span>
              </span>
              <LayoutGroup id={`rhub-mode-${l}`}>
                <div className="flex rounded-xl border border-white/[0.08] bg-black/20 p-1">
                  {MODES.map((m) => {
                    const active = s.mode === m.key;
                    return (
                      <button
                        key={m.key}
                        disabled={readOnly}
                        onClick={() => setStrategy(l, { mode: m.key })}
                        title={m.hint}
                        className={`relative rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition sm:px-3 ${
                          active ? "text-white" : "text-white/45 hover:text-white/75"
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId={`rhub-mode-pill-${l}`}
                            className={`absolute inset-0 rounded-lg ${
                              m.key === "auto"
                                ? "bg-emerald-500/20 ring-1 ring-emerald-400/30"
                                : m.key === "approval"
                                  ? "bg-amber-400/15 ring-1 ring-amber-300/30"
                                  : "bg-white/[0.08] ring-1 ring-white/15"
                            }`}
                            transition={{ type: "spring", stiffness: 480, damping: 36 }}
                          />
                        )}
                        <span className="relative">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </LayoutGroup>
            </div>
          );
        })}
      </div>
      {!publishAvailable && (
        <p className="relative mt-4 flex items-start gap-2 text-[12px] text-violet-100/70">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300" />
          Enquanto as reviews chegam em modo de leitura, o «Automático» deixa a resposta pronta à espera de aprovação —
          publicar exige a publicação direta ligada.
        </p>
      )}
      {on && autoLevels.length > 0 && publishAvailable && (
        <p className="relative mt-4 flex items-start gap-2 text-[12px] text-amber-100/70">
          <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
          As reviews novas de{" "}
          {autoLevels.length > 1
            ? `${autoLevels.slice(0, -1).join(", ")} e ${autoLevels[autoLevels.length - 1]}`
            : autoLevels[0]}{" "}
          {autoLevels.length === 1 && autoLevels[0] === 1 ? "estrela" : "estrelas"} vão ser respondidas e publicadas no
          Google sem revisão.
        </p>
      )}
    </Panel>
  );
}

function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-9 w-[68px] shrink-0 rounded-full border transition-colors duration-300 disabled:opacity-50 ${
        checked ? "border-emerald-400/50 bg-emerald-500/30" : "border-white/15 bg-white/[0.06]"
      }`}
    >
      <motion.span
        className={`absolute top-1 h-[26px] w-[26px] rounded-full shadow-lg ${checked ? "bg-emerald-300" : "bg-white/70"}`}
        animate={{ left: checked ? 36 : 4 }}
        transition={{ type: "spring", stiffness: 520, damping: 30 }}
      />
    </button>
  );
}

// ── Voz da marca ──────────────────────────────────────────────────────
function VoiceCard({
  draft,
  set,
  readOnly,
}: {
  draft: HubSettings;
  set: (p: Partial<HubSettings>) => void;
  readOnly: boolean;
}) {
  return (
    <Panel delay={0.05} className="p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-white">Voz da marca</h2>
      <p className="mt-1 text-[13px] text-white/45">Vale para todas as respostas, de qualquer nível.</p>
      <div className="mt-5 space-y-4">
        <Field label="Assinatura" hint="A última linha de cada resposta.">
          <input
            className="modal-input"
            value={draft.signature}
            disabled={readOnly}
            maxLength={120}
            onChange={(e) => set({ signature: e.target.value })}
          />
        </Field>
        <Field label="Tom de voz">
          <textarea
            className="modal-input min-h-[92px] resize-y"
            value={draft.tone}
            disabled={readOnly}
            maxLength={1200}
            onChange={(e) => set({ tone: e.target.value })}
          />
        </Field>
        <Field label="Contacto para os casos negativos" hint="Opcional. Sem contacto, a IA convida a falar no salão, sem inventar emails.">
          <input
            className="modal-input"
            value={draft.contactLine}
            disabled={readOnly}
            maxLength={200}
            placeholder="ex.: apoio@cidalia-cabeleireiros.com"
            onChange={(e) => set({ contactLine: e.target.value })}
          />
        </Field>
        <Field label="Regras adicionais">
          <textarea
            className="modal-input min-h-[92px] resize-y"
            value={draft.extraRules}
            disabled={readOnly}
            maxLength={2000}
            onChange={(e) => set({ extraRules: e.target.value })}
          />
        </Field>
      </div>
    </Panel>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/45">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-[11px] text-white/35">{hint}</span>}
    </label>
  );
}

// ── Estratégias ───────────────────────────────────────────────────────
function StrategiesCard({
  draft,
  setStrategy,
  readOnly,
}: {
  draft: HubSettings;
  setStrategy: (l: StarLevel, p: Partial<HubSettings["strategies"]["1"]>) => void;
  readOnly: boolean;
}) {
  const [open, setOpen] = useState<StarLevel | null>(1);
  return (
    <Panel delay={0.1} className="p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-white">Estratégia por nível de estrelas</h2>
      <p className="mt-1 text-[13px] text-white/45">
        O que a IA faz em cada caso. Escreva como explicaria a alguém novo na equipa.
      </p>
      <div className="mt-5 space-y-2.5">
        {([1, 2, 3, 4, 5] as StarLevel[]).map((l) => {
          const s = draft.strategies[`${l}`];
          const isOpen = open === l;
          const L = LEVELS[l];
          const changed = JSON.stringify({ ...s, mode: "x" }) !== JSON.stringify({ ...DEFAULT_STRATEGIES[`${l}`], mode: "x" });
          return (
            <div
              key={l}
              className={`overflow-hidden rounded-2xl border transition-colors ${isOpen ? "border-white/15 bg-white/[0.03]" : "border-white/[0.06] bg-white/[0.015]"}`}
            >
              <button onClick={() => setOpen(isOpen ? null : l)} className="flex w-full items-center gap-3.5 px-4 py-3 text-left">
                <LevelFace level={l} size={38} active={isOpen} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <StarRow value={l} size={12} color={L.color} />
                    <span className="text-[12px] text-white/40">{L.label}</span>
                  </span>
                  <span className="block truncate text-[15px] font-semibold text-white/90">{s.title}</span>
                </span>
                {changed && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-200">editada</span>}
                <motion.span animate={{ rotate: isOpen ? 180 : 0 }}>
                  <ChevronDown className="h-4 w-4 text-white/40" />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className="grid gap-4 border-t border-white/[0.06] px-4 py-4 md:grid-cols-2">
                      <Field label="Nome da estratégia">
                        <input
                          className="modal-input"
                          value={s.title}
                          disabled={readOnly}
                          maxLength={80}
                          onChange={(e) => setStrategy(l, { title: e.target.value })}
                        />
                      </Field>
                      <Field label="Resumo">
                        <input
                          className="modal-input"
                          value={s.description}
                          disabled={readOnly}
                          maxLength={300}
                          onChange={(e) => setStrategy(l, { description: e.target.value })}
                        />
                      </Field>
                      <div className="md:col-span-2">
                        <Field label="Instruções para a IA">
                          <textarea
                            className="modal-input min-h-[120px] resize-y"
                            value={s.guidelines}
                            disabled={readOnly}
                            maxLength={2000}
                            onChange={(e) => setStrategy(l, { guidelines: e.target.value })}
                          />
                        </Field>
                      </div>
                      {changed && !readOnly && (
                        <button
                          onClick={() => {
                            const d = DEFAULT_STRATEGIES[`${l}`];
                            setStrategy(l, { title: d.title, description: d.description, guidelines: d.guidelines });
                          }}
                          className="inline-flex items-center gap-1.5 justify-self-start text-[12px] font-medium text-white/45 transition hover:text-white"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Repor o texto original
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ── Ligação ao Google ─────────────────────────────────────────────────
function GoogleCard() {
  const { data, syncing, runSync, viewer } = useHub();
  const s = data.sync;
  const errors = data.locations.filter((l) => l.error);
  return (
    <Panel delay={0.08} className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Ligação ao Google</h2>
          <p className="mt-1 text-[13px] text-white/45">
            {data.locations.length} perfis Google Business · sincroniza a cada 30 minutos
          </p>
          {s.source && (
            <p className="mt-2 text-[12px] text-white/55">
              {s.source === "gbp" ? (
                <>
                  Fonte: <span className="font-semibold text-emerald-300">API da Google</span> — lê as reviews e publica as
                  respostas daqui.
                </>
              ) : (
                <>
                  Fonte: <span className="font-semibold text-violet-200">DataForSEO, temporariamente</span> — só até a API de
                  reviews da Google ser ativada; aí a plataforma passa sozinha para a Google. Publicar, por agora, com
                  «Copiar e responder no Google».
                  {s.dfsPending ? ` ${s.dfsPending} ${s.dfsPending === 1 ? "salão" : "salões"} a caminho.` : ""}
                  {viewer.kind === "team" && s.gbpFixUrl && (
                    <a href={s.gbpFixUrl} target="_blank" rel="noreferrer" className="ml-1 font-semibold text-violet-200 underline">
                      Ativar publicação direta →
                    </a>
                  )}
                </>
              )}
            </p>
          )}
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
            s.ok && s.lastSyncAt ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-200"
          }`}
        >
          {s.ok && s.lastSyncAt ? <CircleCheck className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}
          {s.ok && s.lastSyncAt ? (s.source === "dfs" ? "Ligado · leitura" : "Ligado") : s.lastSyncAt ? "Com avisos" : "Por ligar"}
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 text-[13px]">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <dt className="text-white/40">Última sincronização</dt>
          <dd className="mt-1 font-semibold text-white/85" title={s.lastSyncAt ? formatDateTime(s.lastSyncAt) : undefined}>
            {s.lastSyncAt ? relativeTime(s.lastSyncAt) : "—"}
          </dd>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <dt className="text-white/40">Reviews guardadas</dt>
          <dd className="mt-1 font-semibold text-white/85">{data.reviews.length.toLocaleString("pt-PT")}</dd>
        </div>
      </dl>

      {s.error && (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] px-3 py-2.5 text-[12px] text-amber-50/80">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
          <span>
            {viewer.kind === "team" ? s.error : "A última ligação ao Google falhou. A equipa Wonder Ads vê o detalhe técnico."}
            {viewer.kind === "team" && s.fixUrl && (
              <a href={s.fixUrl} target="_blank" rel="noreferrer" className="ml-1 font-semibold text-amber-200 underline">
                Ativar a API →
              </a>
            )}
          </span>
        </p>
      )}

      <div className="rhub-scroll mt-4 max-h-[260px] space-y-1 overflow-y-auto pr-1">
        {data.locations.map((l) => (
          <div key={l.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] hover:bg-white/[0.03]">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-white/30" />
            <span className="min-w-0 flex-1 truncate text-white/75">{l.short}</span>
            {l.error ? (
              <span title={l.error}>
                <TriangleAlert className="h-3.5 w-3.5 text-amber-300" />
              </span>
            ) : (
              <span className="text-[12px] tabular-nums text-white/45">
                {formatRating(l.average)} ★ · {(l.total ?? 0).toLocaleString("pt-PT")}
              </span>
            )}
          </div>
        ))}
        {errors.length === 0 && data.locations.length === 0 && (
          <p className="py-3 text-center text-[12px] text-white/35">Os perfis aparecem depois da primeira sincronização.</p>
        )}
      </div>

      {viewer.canWrite && (
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => void runSync(false)}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-xl border border-white/12 px-3.5 py-2 text-[13px] font-medium text-white/80 transition hover:border-white/25 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} /> Sincronizar agora
          </button>
          <button
            onClick={() => void runSync(true)}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium text-white/45 transition hover:text-white disabled:opacity-50"
            title="Volta a ler todos os perfis e todas as reviews"
          >
            Sincronização completa
          </button>
        </div>
      )}
    </Panel>
  );
}

// ── O guia que o Claude segue ─────────────────────────────────────────
function GuideCard({ signature }: { signature: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Panel delay={0.12} className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="flex items-center gap-2.5 text-lg font-semibold text-white">
            <Sparkles className="h-5 w-5 text-violet-300" /> O guia que o {REPLY_MODEL_LABEL} segue
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-white/50">
            As respostas são escritas pelo {REPLY_MODEL_LABEL} (Anthropic). Antes de cada resposta recebe este guia base
            da Wonder Ads e, por cima, a estratégia do nível de estrelas, o tom, o contacto e as regras desta página, e o
            brief da marca.
          </p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 px-3 py-1.5 text-[12px] font-medium text-white/70 transition hover:border-white/25 hover:text-white"
        >
          {open ? "Esconder o guia" : "Ver o guia"}
          <motion.span animate={{ rotate: open ? 180 : 0 }}>
            <ChevronDown className="h-3.5 w-3.5" />
          </motion.span>
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {REPLY_GUIDE.map((section, i) => (
                <motion.div
                  key={section.title}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + i * 0.05 }}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
                >
                  <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/45">{section.title}</p>
                  <ul className="mt-2.5 space-y-1.5">
                    {section.rules.map((r) => (
                      <li key={r} className="flex gap-2 text-[13px] leading-relaxed text-white/70">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-violet-300/70" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
            <p className="mt-6 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/45">Exemplos de tom</p>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {REPLY_EXAMPLES.map((e) => (
                <div key={e.review} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="flex items-center gap-2 text-[12px] text-white/50">
                    <StarRow value={e.stars} size={11} /> {e.review}
                  </p>
                  <p className="mt-2.5 whitespace-pre-line border-l-2 border-violet-400/40 pl-3 text-[13px] leading-relaxed text-white/75">
                    {e.reply.replace("{assinatura}", signature).replace("{contacto}", "pode falar connosco diretamente no salão")}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}
