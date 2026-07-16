"use client";

// Client-facing SEO onboarding form, in QUIZ mode: one question (or small
// logical group) per step, a grouped ruler progress bar, animated slide
// transitions and a final confirmation screen that sends the client back to
// the onboarding hub. Lives on the public /[slug]/onboarding/form page (no
// app chrome, no auth). Posts to /api/onboarding-intake/[slug]/submit.

import { useMemo, useState } from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Paperclip,
  Upload,
  X,
} from "lucide-react";
import {
  sectionsOf,
  requiredNames,
  isShort,
  isLong,
  isCheckbox,
  isFile,
  otherTextKey,
  type OnbField,
  type OnbStep,
  type OnbCheckboxField,
} from "@/lib/onboarding-questions";

const BRAND_GRADIENT =
  "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)";

type UploadedFile = { url: string; name: string };

function ShortInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-black/12 bg-[#f8f7f2] px-3.5 py-3 text-sm text-black/80 outline-none transition-all duration-200 focus:-translate-y-[1px] focus:border-[#783DF5]/50 focus:bg-white focus:ring-2 focus:ring-[#783DF5]/15"
    />
  );
}

function LongInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="min-h-[120px] w-full resize-y rounded-xl border border-black/12 bg-[#f8f7f2] px-3.5 py-3 text-sm text-black/80 outline-none transition-all duration-200 focus:-translate-y-[1px] focus:border-[#783DF5]/50 focus:bg-white focus:ring-2 focus:ring-[#783DF5]/15"
    />
  );
}

function CheckboxGroup({
  field,
  selected,
  onToggle,
  others,
  onOtherChange,
}: {
  field: OnbCheckboxField;
  selected: string[];
  onToggle: (value: string) => void;
  others: Record<string, string>;
  onOtherChange: (optValue: string, v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {field.options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <div key={o.value} className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => onToggle(o.value)}
              aria-pressed={on}
              className="group flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-all duration-200 hover:-translate-y-[1px] active:scale-[0.99]"
              style={{
                borderColor: on ? "transparent" : "rgba(0,0,0,0.12)",
                background: on ? "rgba(120,61,245,0.08)" : "#fff",
                boxShadow: on
                  ? "inset 0 0 0 1.5px #783DF5, 0 8px 20px -12px rgba(120,61,245,0.5)"
                  : "0 1px 2px rgba(0,0,0,0.03)",
              }}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border transition-all duration-200 ${
                  on ? "nps-pop" : ""
                }`}
                style={{
                  borderColor: on ? "transparent" : "rgba(0,0,0,0.25)",
                  background: on ? BRAND_GRADIENT : "transparent",
                }}
              >
                {on && <Check className="h-3.5 w-3.5 text-white" />}
              </span>
              <span className={on ? "text-black/85" : "text-black/70"}>
                {o.label}
              </span>
            </button>
            {o.other && on && (
              <input
                type="text"
                value={others[o.value] ?? ""}
                onChange={(e) => onOtherChange(o.value, e.target.value)}
                placeholder="Qual? Escreva aqui…"
                className="ml-8 w-[calc(100%-2rem)] rounded-lg border border-[#783DF5]/30 bg-[#f8f7f2] px-3 py-2 text-sm text-black/80 outline-none transition-all duration-200 focus:border-[#783DF5]/60 focus:bg-white focus:ring-2 focus:ring-[#783DF5]/15"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FileUpload({
  files,
  onAdd,
  onRemove,
}: {
  files: UploadedFile[];
  onAdd: (f: UploadedFile) => void;
  onRemove: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setErr(false);
    setBusy(true);
    try {
      for (const file of Array.from(list)) {
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/files/upload",
        });
        onAdd({ url: blob.url, name: file.name });
      }
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label
        className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-black/20 bg-[#f8f7f2] px-4 py-6 text-sm font-medium text-black/55 transition-all duration-200 hover:border-[#783DF5]/50 hover:bg-white hover:text-black/75"
        style={busy ? { pointerEvents: "none", opacity: 0.6 } : undefined}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {busy ? "A carregar…" : "Escolher ficheiro(s)"}
        <input
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>
      {err && (
        <p className="mt-2 text-[12px] text-rose-600">
          Não foi possível carregar. Tente novamente.
        </p>
      )}
      {files.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {files.map((f) => (
            <li
              key={f.url}
              className="flex items-center gap-2 rounded-lg border border-black/8 bg-white px-3 py-2 text-sm text-black/70"
            >
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-[#783DF5]" />
              <span className="flex-1 truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => onRemove(f.url)}
                aria-label="Remover"
                className="rounded-md p-1 text-black/35 transition hover:bg-black/[0.05] hover:text-black/70"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function OnboardingIntakeForm({
  slug,
  hubHref,
  steps,
  track = "seo",
  lessonId = "form",
}: {
  slug: string;
  hubHref: string;
  steps: OnbStep[];
  track?: string;
  lessonId?: string;
}) {
  const total = steps.length;
  const sections = useMemo(() => sectionsOf(steps), [steps]);
  const sectionFirstStep = useMemo(() => {
    const out: Record<string, number> = {};
    steps.forEach((s, i) => {
      if (!(s.section in out)) out[s.section] = i;
    });
    return out;
  }, [steps]);
  const requiredNameList = useMemo(() => requiredNames(steps), [steps]);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<string, string[]>>({});
  const [files, setFiles] = useState<Record<string, UploadedFile[]>>({});
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );

  const isAnswered = (f: OnbField): boolean => {
    if (!f.required) return true;
    if (isShort(f) || isLong(f)) return (texts[f.name]?.trim() ?? "") !== "";
    if (isCheckbox(f)) return (choices[f.name]?.length ?? 0) > 0;
    if (isFile(f)) return (files[f.name]?.length ?? 0) > 0;
    return true;
  };

  const answeredCount = useMemo(() => {
    const req = new Set(requiredNameList);
    return steps
      .flatMap((s) => s.fields)
      .filter((f) => req.has(f.name) && isAnswered(f)).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texts, choices, files, steps, requiredNameList]);
  const totalRequired = requiredNameList.length;

  const current = steps[step];
  const isLast = step === total - 1;
  const missingInStep = current.fields.filter(
    (f) => f.required && !isAnswered(f),
  ).length;

  const currentSectionIdx = sections.findIndex(
    (s) => s.key === current.section,
  );

  function goTo(target: number) {
    setDir(target >= step ? 1 : -1);
    setStep(Math.max(0, Math.min(total - 1, target)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const setText = (name: string, v: string) =>
    setTexts((p) => ({ ...p, [name]: v }));
  function toggle(name: string, value: string) {
    setChoices((p) => {
      const cur = p[name] ?? [];
      return cur.includes(value)
        ? { ...p, [name]: cur.filter((v) => v !== value) }
        : { ...p, [name]: [...cur, value] };
    });
  }
  const addFile = (name: string, f: UploadedFile) =>
    setFiles((p) => ({ ...p, [name]: [...(p[name] ?? []), f] }));
  const removeFile = (name: string, url: string) =>
    setFiles((p) => ({
      ...p,
      [name]: (p[name] ?? []).filter((f) => f.url !== url),
    }));

  async function submit() {
    setState("sending");
    try {
      const res = await fetch(`/api/onboarding-intake/${slug}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ texts, choices, files, track, lessonId }),
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
    goTo(step + 1);
  }

  if (state === "done") {
    return (
      <div className="nps-done-in rounded-2xl border border-black/8 bg-white px-6 py-14 text-center shadow-sm">
        <div
          className="nps-check-pop mx-auto flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: BRAND_GRADIENT }}
        >
          <Check className="h-7 w-7 text-white" strokeWidth={3} />
        </div>
        <h2 className="mt-5 text-2xl font-semibold text-black/85">
          Formulário enviado!
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-black/55">
          A Wonder Ads agradece o envio do seu formulário. Já pode voltar ao
          processo de onboarding e continuar para os próximos passos.
        </p>
        <Link
          href={hubHref}
          className="mt-7 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#783DF5]/25 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
          style={{ background: BRAND_GRADIENT }}
        >
          Voltar ao onboarding
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const pct = totalRequired
    ? Math.round((answeredCount / totalRequired) * 100)
    : 0;

  return (
    <div>
      {/* Ruler progress — grouped by section */}
      <div className="mb-8">
        <div className="mb-2 grid grid-cols-3 gap-x-2 gap-y-1 text-[9.5px] font-medium uppercase tracking-[0.1em] sm:grid-cols-6">
          {sections.map((s, i) => {
            const activeSection = i === currentSectionIdx;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => goTo(sectionFirstStep[s.key] ?? 0)}
                className={`rounded-md px-1.5 py-1 text-center leading-tight transition-colors duration-200 ${
                  activeSection ? "bg-black/[0.05]" : "hover:bg-black/[0.03]"
                }`}
                style={{
                  color: activeSection ? "#1B2430" : "rgba(0,0,0,0.42)",
                  fontWeight: activeSection ? 700 : 500,
                }}
              >
                {s.key}
              </button>
            );
          })}
        </div>
        <div className="relative h-1.5 overflow-hidden rounded-full bg-black/8">
          <div
            className="absolute left-0 top-0 h-1.5 rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${pct}%`,
              background: BRAND_GRADIENT,
              boxShadow: "0 0 12px -2px rgba(120,61,245,0.6)",
            }}
          />
        </div>
      </div>

      {/* Step card — re-keyed per step so the slide animation replays */}
      <div key={step} className={dir === 1 ? "nps-slide-right" : "nps-slide-left"}>
        <div className="rounded-2xl border border-black/8 bg-white px-6 py-7 shadow-sm sm:px-8">
          <div className="mb-6 flex items-baseline gap-2.5 border-b border-black/8 pb-4">
            <span className="font-mono text-[11px] tracking-widest text-[#783DF5]">
              {current.sectionTag}
            </span>
            <span className="text-lg font-semibold text-black/85">
              {current.section}
            </span>
            <span className="ml-auto text-[11px] text-black/40">
              Passo {step + 1} de {total}
            </span>
          </div>

          <div className="space-y-7">
            {current.fields.map((f, fi) => (
              <div
                key={f.name}
                className="nps-q-in"
                style={{ animationDelay: `${fi * 60}ms` }}
              >
                <div className="mb-1.5 text-[15px] font-medium leading-snug text-black/80">
                  {f.label}
                  {!f.required && (
                    <span className="ml-1.5 text-[11px] font-normal text-black/35">
                      (opcional)
                    </span>
                  )}
                </div>
                {f.help && (
                  <p className="mb-3 text-[12.5px] leading-relaxed text-black/50">
                    {f.help}
                  </p>
                )}
                {!f.help && <div className="mb-3" />}
                {isShort(f) && (
                  <ShortInput
                    value={texts[f.name] ?? ""}
                    onChange={(v) => setText(f.name, v)}
                    placeholder={f.placeholder}
                  />
                )}
                {isLong(f) && (
                  <LongInput
                    value={texts[f.name] ?? ""}
                    onChange={(v) => setText(f.name, v)}
                    placeholder={f.placeholder}
                  />
                )}
                {isCheckbox(f) && (
                  <CheckboxGroup
                    field={f}
                    selected={choices[f.name] ?? []}
                    onToggle={(v) => toggle(f.name, v)}
                    others={Object.fromEntries(
                      f.options
                        .filter((o) => o.other)
                        .map((o) => [
                          o.value,
                          texts[otherTextKey(f.name, o.value)] ?? "",
                        ]),
                    )}
                    onOtherChange={(ov, v) =>
                      setText(otherTextKey(f.name, ov), v)
                    }
                  />
                )}
                {isFile(f) && (
                  <FileUpload
                    files={files[f.name] ?? []}
                    onAdd={(uf) => addFile(f.name, uf)}
                    onRemove={(url) => removeFile(f.name, url)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {state === "error" && (
        <p className="mt-4 text-center text-sm text-rose-600">
          Não foi possível enviar. Tente novamente.
        </p>
      )}

      {/* Nav */}
      <div className="mt-6 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => goTo(step - 1)}
          disabled={step === 0}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-black/55 transition-all duration-200 hover:-translate-x-0.5 hover:bg-black/[0.04] hover:text-black/80 disabled:invisible"
        >
          <ArrowLeft className="h-4 w-4" />
          Anterior
        </button>

        <div className="flex items-center gap-4">
          <span className="hidden text-[11px] text-black/40 sm:inline">
            {answeredCount} de {totalRequired} respondidas
          </span>
          <button
            type="button"
            onClick={next}
            disabled={missingInStep > 0 || state === "sending"}
            className="group inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#783DF5]/25 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0"
            style={{ background: BRAND_GRADIENT }}
          >
            {state === "sending" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                A enviar…
              </>
            ) : missingInStep > 0 ? (
              `Falta${missingInStep > 1 ? "m" : ""} ${missingInStep} nesta secção`
            ) : isLast ? (
              <>
                <Check className="h-4 w-4" />
                Enviar formulário
              </>
            ) : (
              <>
                Continuar
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
