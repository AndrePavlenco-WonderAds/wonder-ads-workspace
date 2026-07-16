"use client";

// SuperAdmin editor for the onboarding CONTENT — the lessons "course" and the
// intake FORM. Edits are held in local state and saved as a whole structure to
// /api/admin/onboarding-content (the server normalises + validates). Reorder is
// via up/down buttons (robust, no drag-drop deps).

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  Loader2,
  Save,
  RotateCcw,
  GraduationCap,
  ClipboardList,
} from "lucide-react";
import type {
  OnboardingCategory,
  Lesson,
  LessonBlock,
  LessonKind,
} from "@/lib/onboarding-lessons";
import type {
  OnbStep,
  OnbField,
  OnbCheckboxOption,
} from "@/lib/onboarding-questions";
import type { OnbTrack } from "@/lib/onboarding-tracks";

// ---- immutable array helpers ----
function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = arr.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
const removeAt = <T,>(arr: T[], i: number): T[] => arr.filter((_, k) => k !== i);
const updateAt = <T,>(arr: T[], i: number, v: T): T[] =>
  arr.map((x, k) => (k === i ? v : x));

// ---- UI atoms ----
const inputCls =
  "w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#783DF5]/60 focus:bg-white/[0.06] placeholder:text-white/30";

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40">
        {label}
      </span>
      {children}
    </label>
  );
}

function RowTools({
  onUp,
  onDown,
  onDelete,
  deleteLabel = "Remover",
}: {
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
  deleteLabel?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onUp}
        title="Mover para cima"
        className="rounded-md p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white/80"
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onDown}
        title="Mover para baixo"
        className="rounded-md p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white/80"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        title={deleteLabel}
        className="rounded-md p-1.5 text-rose-300/70 transition hover:bg-rose-500/15 hover:text-rose-300"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function AddBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/15 px-3 py-1.5 text-[12px] font-medium text-white/55 transition hover:border-[#783DF5]/40 hover:text-white/80"
    >
      <Plus className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

// ---- About blocks editor (lesson content) ----
function AboutEditor({
  blocks,
  onChange,
}: {
  blocks: LessonBlock[];
  onChange: (b: LessonBlock[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {blocks.map((block, bi) => (
        <div
          key={bi}
          className="rounded-lg border border-white/8 bg-white/[0.02] p-3"
        >
          <div className="mb-2 flex items-center justify-between">
            <select
              value={block.type}
              onChange={(e) => {
                const t = e.target.value as LessonBlock["type"];
                const nb: LessonBlock =
                  t === "p"
                    ? { type: "p", text: "" }
                    : t === "bullets"
                      ? { type: "bullets", intro: "", items: [""] }
                      : { type: "emails", intro: "", emails: [""] };
                onChange(updateAt(blocks, bi, nb));
              }}
              className="rounded-md border border-white/12 bg-white/[0.04] px-2 py-1 text-[12px] text-white"
            >
              <option value="p">Parágrafo</option>
              <option value="bullets">Lista</option>
              <option value="emails">Emails</option>
            </select>
            <RowTools
              onUp={() => onChange(move(blocks, bi, -1))}
              onDown={() => onChange(move(blocks, bi, 1))}
              onDelete={() => onChange(removeAt(blocks, bi))}
            />
          </div>

          {block.type === "p" && (
            <textarea
              value={block.text}
              onChange={(e) =>
                onChange(updateAt(blocks, bi, { ...block, text: e.target.value }))
              }
              placeholder="Texto do parágrafo…"
              className={`${inputCls} min-h-[64px] resize-y`}
            />
          )}

          {(block.type === "bullets" || block.type === "emails") && (
            <div className="flex flex-col gap-2">
              <input
                value={block.intro}
                onChange={(e) =>
                  onChange(
                    updateAt(blocks, bi, { ...block, intro: e.target.value }),
                  )
                }
                placeholder={
                  block.type === "emails"
                    ? "Introdução (ex: Emails para adicionar…)"
                    : "Introdução (opcional)"
                }
                className={inputCls}
              />
              {(block.type === "bullets" ? block.items : block.emails).map(
                (item, ii) => {
                  const list =
                    block.type === "bullets" ? block.items : block.emails;
                  const setList = (l: string[]) =>
                    onChange(
                      updateAt(
                        blocks,
                        bi,
                        block.type === "bullets"
                          ? { ...block, items: l }
                          : { ...block, emails: l },
                      ),
                    );
                  return (
                    <div key={ii} className="flex items-center gap-1.5">
                      <input
                        value={item}
                        onChange={(e) => setList(updateAt(list, ii, e.target.value))}
                        placeholder={
                          block.type === "emails" ? "email@wonder-ads.com" : "Item…"
                        }
                        className={inputCls}
                      />
                      <button
                        type="button"
                        onClick={() => setList(removeAt(list, ii))}
                        className="rounded-md p-1.5 text-rose-300/70 transition hover:bg-rose-500/15"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                },
              )}
              <AddBtn
                label={block.type === "emails" ? "Adicionar email" : "Adicionar item"}
                onClick={() => {
                  const list =
                    block.type === "bullets" ? block.items : block.emails;
                  onChange(
                    updateAt(
                      blocks,
                      bi,
                      block.type === "bullets"
                        ? { ...block, items: [...list, ""] }
                        : { ...block, emails: [...list, ""] },
                    ),
                  );
                }}
              />
            </div>
          )}
        </div>
      ))}
      <AddBtn
        label="Adicionar bloco"
        onClick={() => onChange([...blocks, { type: "p", text: "" }])}
      />
    </div>
  );
}

// ---- Lesson editor ----
function LessonEditor({
  lesson,
  onChange,
  onUp,
  onDown,
  onDelete,
}: {
  lesson: Lesson;
  onChange: (l: Lesson) => void;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
}) {
  const set = (patch: Partial<Lesson>) => onChange({ ...lesson, ...patch });
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            value={lesson.emoji}
            onChange={(e) => set({ emoji: e.target.value })}
            className="w-12 rounded-lg border border-white/12 bg-white/[0.04] px-2 py-2 text-center text-lg"
          />
          <input
            value={lesson.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="Título da lição"
            className={`${inputCls} min-w-[200px]`}
          />
        </div>
        <RowTools onUp={onUp} onDown={onDown} onDelete={onDelete} deleteLabel="Remover lição" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Labeled label="ID (usado no URL)">
          <input
            value={lesson.id}
            onChange={(e) => set({ id: e.target.value })}
            className={`${inputCls} font-mono text-[12px]`}
          />
        </Labeled>
        <Labeled label="Tipo">
          <select
            value={lesson.kind}
            onChange={(e) => set({ kind: e.target.value as LessonKind })}
            className={inputCls}
          >
            <option value="video">Vídeo</option>
            <option value="form">Formulário</option>
            <option value="info">Info / Final</option>
          </select>
        </Labeled>
        <Labeled label="Track (serviço)">
          <select
            value={lesson.track ?? "seo"}
            onChange={(e) => set({ track: e.target.value as OnbTrack })}
            className={inputCls}
          >
            <option value="common">Comum (todos)</option>
            <option value="seo">SEO</option>
            <option value="ads">Ads</option>
          </select>
        </Labeled>
      </div>

      <div className="mt-3">
        <Labeled label="Resumo (mostrado no hub)">
          <input
            value={lesson.summary}
            onChange={(e) => set({ summary: e.target.value })}
            className={inputCls}
          />
        </Labeled>
      </div>

      {lesson.kind !== "form" && (
        <div className="mt-3">
          <Labeled label="Link do vídeo (embed URL)">
            <input
              value={lesson.videoUrl ?? ""}
              onChange={(e) =>
                set({ videoUrl: e.target.value.trim() ? e.target.value : null })
              }
              placeholder="https://www.youtube.com/embed/…  (vazio = placeholder)"
              className={`${inputCls} font-mono text-[12px]`}
            />
          </Labeled>
        </div>
      )}

      <div className="mt-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40">
          Sobre este passo
        </p>
        <AboutEditor blocks={lesson.about} onChange={(b) => set({ about: b })} />
      </div>
    </div>
  );
}

// ---- Course editor ----
function CourseEditor({
  cats,
  onChange,
}: {
  cats: OnboardingCategory[];
  onChange: (c: OnboardingCategory[]) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {cats.map((cat, ci) => {
        const setCat = (patch: Partial<OnboardingCategory>) =>
          onChange(updateAt(cats, ci, { ...cat, ...patch }));
        return (
          <div
            key={ci}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="grid flex-1 gap-2 sm:grid-cols-[2fr_1fr]">
                <input
                  value={cat.title}
                  onChange={(e) => setCat({ title: e.target.value })}
                  placeholder="Nome da categoria"
                  className={`${inputCls} text-base font-semibold`}
                />
                <input
                  value={cat.key}
                  onChange={(e) => setCat({ key: e.target.value })}
                  placeholder="key"
                  className={`${inputCls} font-mono text-[12px]`}
                />
              </div>
              <RowTools
                onUp={() => onChange(move(cats, ci, -1))}
                onDown={() => onChange(move(cats, ci, 1))}
                onDelete={() => onChange(removeAt(cats, ci))}
                deleteLabel="Remover categoria"
              />
            </div>

            <div className="flex flex-col gap-3">
              {cat.lessons.map((lesson, li) => (
                <LessonEditor
                  key={li}
                  lesson={lesson}
                  onChange={(l) =>
                    setCat({ lessons: updateAt(cat.lessons, li, l) })
                  }
                  onUp={() => setCat({ lessons: move(cat.lessons, li, -1) })}
                  onDown={() => setCat({ lessons: move(cat.lessons, li, 1) })}
                  onDelete={() => setCat({ lessons: removeAt(cat.lessons, li) })}
                />
              ))}
              <AddBtn
                label="Adicionar lição"
                onClick={() =>
                  setCat({
                    lessons: [
                      ...cat.lessons,
                      {
                        id: `licao-${Date.now()}`,
                        category: cat.key,
                        title: "Nova lição",
                        kind: "video",
                        emoji: "📄",
                        videoUrl: null,
                        summary: "",
                        about: [{ type: "p", text: "" }],
                      },
                    ],
                  })
                }
              />
            </div>
          </div>
        );
      })}
      <AddBtn
        label="Adicionar categoria"
        onClick={() =>
          onChange([
            ...cats,
            { key: `cat-${Date.now()}`, title: "Nova categoria", lessons: [] },
          ])
        }
      />
    </div>
  );
}

// ---- Options editor (checkbox field) ----
function OptionsEditor({
  options,
  onChange,
}: {
  options: OnbCheckboxOption[];
  onChange: (o: OnbCheckboxOption[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((o, oi) => (
        <div key={oi} className="flex items-center gap-1.5">
          <input
            value={o.label}
            onChange={(e) =>
              onChange(updateAt(options, oi, { ...o, label: e.target.value }))
            }
            placeholder="Texto da opção"
            className={inputCls}
          />
          <input
            value={o.value}
            onChange={(e) =>
              onChange(updateAt(options, oi, { ...o, value: e.target.value }))
            }
            placeholder="value"
            className={`${inputCls} w-28 font-mono text-[11px]`}
          />
          <label
            className="flex shrink-0 items-center gap-1 text-[11px] text-white/50"
            title='Revela um campo "Outro" de texto livre'
          >
            <input
              type="checkbox"
              checked={Boolean(o.other)}
              onChange={(e) =>
                onChange(
                  updateAt(options, oi, {
                    ...o,
                    other: e.target.checked || undefined,
                  }),
                )
              }
            />
            Outro
          </label>
          <button
            type="button"
            onClick={() => onChange(removeAt(options, oi))}
            className="rounded-md p-1.5 text-rose-300/70 transition hover:bg-rose-500/15"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <AddBtn
        label="Adicionar opção"
        onClick={() => onChange([...options, { value: "", label: "" }])}
      />
    </div>
  );
}

// ---- Field editor ----
function FieldEditor({
  field,
  onChange,
  onUp,
  onDown,
  onDelete,
}: {
  field: OnbField;
  onChange: (f: OnbField) => void;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
}) {
  function changeKind(kind: OnbField["kind"]) {
    const base = { name: field.name, label: field.label, help: field.help, required: field.required };
    if (kind === "checkbox") {
      onChange({ ...base, kind, options: [] });
    } else if (kind === "file") {
      onChange({ kind, name: base.name, label: base.label, help: base.help, required: base.required });
    } else {
      onChange({ ...base, kind, placeholder: undefined });
    }
  }
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <input
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          placeholder="Pergunta"
          className={`${inputCls} flex-1`}
        />
        <RowTools onUp={onUp} onDown={onDown} onDelete={onDelete} deleteLabel="Remover pergunta" />
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Labeled label="ID (chave)">
          <input
            value={field.name}
            onChange={(e) => onChange({ ...field, name: e.target.value })}
            className={`${inputCls} font-mono text-[12px]`}
          />
        </Labeled>
        <Labeled label="Tipo">
          <select
            value={field.kind}
            onChange={(e) => changeKind(e.target.value as OnbField["kind"])}
            className={inputCls}
          >
            <option value="short">Texto curto</option>
            <option value="long">Texto longo</option>
            <option value="checkbox">Escolha múltipla</option>
            <option value="file">Ficheiro</option>
          </select>
        </Labeled>
        <label className="flex items-end gap-1.5 pb-2 text-[12px] text-white/60">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onChange({ ...field, required: e.target.checked })}
          />
          Obrigatório
        </label>
      </div>

      <div className="mt-3">
        <Labeled label="Ajuda / descrição (opcional)">
          <input
            value={field.help ?? ""}
            onChange={(e) =>
              onChange({ ...field, help: e.target.value || undefined })
            }
            className={inputCls}
          />
        </Labeled>
      </div>

      {field.kind === "checkbox" && (
        <div className="mt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40">
            Opções
          </p>
          <OptionsEditor
            options={field.options}
            onChange={(o) => onChange({ ...field, options: o })}
          />
        </div>
      )}
    </div>
  );
}

// ---- Form editor ----
function FormEditor({
  steps,
  onChange,
}: {
  steps: OnbStep[];
  onChange: (s: OnbStep[]) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {steps.map((step, si) => {
        const setStep = (patch: Partial<OnbStep>) =>
          onChange(updateAt(steps, si, { ...step, ...patch }));
        return (
          <div
            key={si}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="grid flex-1 gap-2 sm:grid-cols-[auto_2fr_2fr_auto]">
                <input
                  value={step.sectionTag}
                  onChange={(e) => setStep({ sectionTag: e.target.value })}
                  placeholder="01"
                  className={`${inputCls} w-16 text-center font-mono text-[12px]`}
                />
                <input
                  value={step.section}
                  onChange={(e) => setStep({ section: e.target.value })}
                  placeholder="Secção"
                  className={inputCls}
                />
                <input
                  value={step.title}
                  onChange={(e) => setStep({ title: e.target.value })}
                  placeholder="Título do passo"
                  className={inputCls}
                />
                <select
                  value={step.track ?? "seo"}
                  onChange={(e) => setStep({ track: e.target.value as OnbTrack })}
                  className={`${inputCls} sm:w-28`}
                  title="Formulário a que este passo pertence"
                >
                  <option value="seo">SEO</option>
                  <option value="ads">Ads</option>
                </select>
              </div>
              <RowTools
                onUp={() => onChange(move(steps, si, -1))}
                onDown={() => onChange(move(steps, si, 1))}
                onDelete={() => onChange(removeAt(steps, si))}
                deleteLabel="Remover passo"
              />
            </div>

            <div className="flex flex-col gap-3">
              {step.fields.map((field, fi) => (
                <FieldEditor
                  key={fi}
                  field={field}
                  onChange={(f) => setStep({ fields: updateAt(step.fields, fi, f) })}
                  onUp={() => setStep({ fields: move(step.fields, fi, -1) })}
                  onDown={() => setStep({ fields: move(step.fields, fi, 1) })}
                  onDelete={() => setStep({ fields: removeAt(step.fields, fi) })}
                />
              ))}
              <AddBtn
                label="Adicionar pergunta"
                onClick={() =>
                  setStep({
                    fields: [
                      ...step.fields,
                      {
                        kind: "short",
                        name: `campo_${Date.now()}`,
                        label: "Nova pergunta",
                        required: false,
                      },
                    ],
                  })
                }
              />
            </div>
          </div>
        );
      })}
      <AddBtn
        label="Adicionar passo"
        onClick={() =>
          onChange([
            ...steps,
            {
              key: `passo-${Date.now()}`,
              section: "Nova secção",
              sectionTag: "",
              title: "Novo passo",
              fields: [],
            },
          ])
        }
      />
    </div>
  );
}

// ---- Main ----
export function OnboardingEditor({
  initialCourse,
  initialForm,
  courseCustom,
  formCustom,
}: {
  initialCourse: OnboardingCategory[];
  initialForm: OnbStep[];
  courseCustom: boolean;
  formCustom: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"course" | "form">("course");
  const [cats, setCats] = useState<OnboardingCategory[]>(initialCourse);
  const [steps, setSteps] = useState<OnbStep[]>(initialForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(kind: "course" | "form") {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/onboarding-content", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          data: kind === "course" ? cats : steps,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      if (kind === "course") setCats(data.data);
      else setSteps(data.data);
      setMsg({ ok: true, text: "Guardado." });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Erro." });
    } finally {
      setSaving(false);
    }
  }

  async function reset(kind: "course" | "form") {
    if (
      !window.confirm(
        "Repor o conteúdo original? As alterações personalizadas serão apagadas.",
      )
    )
      return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/onboarding-content?kind=${kind}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMsg({ ok: true, text: "Reposto para o original." });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Erro." });
    } finally {
      setSaving(false);
    }
  }

  const isCustom = tab === "course" ? courseCustom : formCustom;

  return (
    <div>
      {/* Tabs */}
      <div className="mb-6 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTab("course")}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            tab === "course"
              ? "brand-gradient-bg text-white shadow-sm shadow-[#783DF5]/30"
              : "border border-white/12 text-white/60 hover:text-white"
          }`}
        >
          <GraduationCap className="h-4 w-4" />
          Curso ({cats.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("form")}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            tab === "form"
              ? "brand-gradient-bg text-white shadow-sm shadow-[#783DF5]/30"
              : "border border-white/12 text-white/60 hover:text-white"
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          Formulário ({steps.length})
        </button>
      </div>

      {/* Action bar */}
      <div className="sticky top-2 z-10 mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-[#0d0d14]/80 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => save(tab)}
          disabled={saving}
          className="brand-gradient-bg inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-[#783DF5]/30 transition hover:brightness-110 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Guardar {tab === "course" ? "curso" : "formulário"}
        </button>
        {isCustom && (
          <button
            type="button"
            onClick={() => reset(tab)}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg border border-white/12 px-3 py-2 text-[13px] font-medium text-white/60 transition hover:text-white disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Repor original
          </button>
        )}
        <span className="text-[11px] text-white/40">
          {isCustom ? "Conteúdo personalizado" : "Conteúdo original (default)"}
        </span>
        {msg && (
          <span
            className={`ml-auto text-[12px] font-medium ${
              msg.ok ? "text-emerald-300" : "text-rose-300"
            }`}
          >
            {msg.text}
          </span>
        )}
      </div>

      {tab === "course" ? (
        <CourseEditor cats={cats} onChange={setCats} />
      ) : (
        <FormEditor steps={steps} onChange={setSteps} />
      )}
    </div>
  );
}
