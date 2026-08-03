"use client";

// CMS da Formação — CRUD de módulos, capítulos, aulas e quizzes, sem tocar em
// código. Mesmo modelo do editor de onboarding de clientes: o catálogo inteiro
// vive em estado local e é gravado de uma vez; o servidor normaliza e recusa
// estruturas inválidas, por isso uma edição má não consegue partir a formação
// de quem está a meio dela.
//
// Reordenar é por setas (sem dependências de drag-and-drop, e funciona em
// teclado). Os ids das aulas e das perguntas são visíveis mas NÃO editáveis:
// é por eles que o progresso e as respostas de toda a gente estão guardados.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Film,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import {
  LESSON_TYPES,
  LESSON_TYPE_LABEL,
  VIDEO_PROVIDERS,
  detectProvider,
  type TrainingLesson,
  type TrainingLessonType,
  type TrainingModule,
  type TrainingQuestion,
  type TrainingQuiz,
  type TrainingTrack,
  type VideoProvider,
} from "@/lib/training/catalog";

// ---- helpers imutáveis ----
function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = arr.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next.map((x, k) => ({ ...(x as object), order: k + 1 }) as T);
}
const removeAt = <T,>(arr: T[], i: number): T[] =>
  arr.filter((_, k) => k !== i).map((x, k) => ({ ...(x as object), order: k + 1 }) as T);
const updateAt = <T,>(arr: T[], i: number, v: T): T[] =>
  arr.map((x, k) => (k === i ? v : x));

const inputCls =
  "w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#783DF5]/60 focus:bg-white/[0.06]";

function Labeled({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[10.5px] text-white/30">{hint}</span>}
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
    <div className="flex shrink-0 items-center gap-1">
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
      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/15 px-3 py-1.5 text-[12px] font-medium text-white/55 transition hover:border-[#783DF5]/40 hover:text-white/85"
    >
      <Plus className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

/** Ids novos precisam de ser estáveis e únicos. Deriva-se do id do pai + um
 *  sufixo incremental, e confirma-se que ainda não existe. */
function nextId(prefix: string, existing: string[]): string {
  let n = existing.length + 1;
  let candidate = `${prefix}-${n}`;
  const set = new Set(existing);
  while (set.has(candidate)) {
    n += 1;
    candidate = `${prefix}-${n}`;
  }
  return candidate;
}

export function TrainingCms({
  initial,
  isCustom,
}: {
  initial: TrainingTrack[];
  isCustom: boolean;
}) {
  const router = useRouter();
  const [tracks, setTracks] = useState<TrainingTrack[]>(initial);
  const [openTrack, setOpenTrack] = useState<string | null>(
    initial[0]?.slug ?? null,
  );
  const [openModule, setOpenModule] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  function apply(next: TrainingTrack[]) {
    setTracks(next);
    setDirty(true);
    setMessage(null);
  }

  function patchTrack(ti: number, patch: Partial<TrainingTrack>) {
    apply(updateAt(tracks, ti, { ...tracks[ti], ...patch }));
  }
  function patchModule(ti: number, mi: number, patch: Partial<TrainingModule>) {
    const t = tracks[ti];
    patchTrack(ti, {
      modules: updateAt(t.modules, mi, { ...t.modules[mi], ...patch }),
    });
  }
  function patchLesson(
    ti: number,
    mi: number,
    li: number,
    patch: Partial<TrainingLesson>,
  ) {
    const m = tracks[ti].modules[mi];
    patchModule(ti, mi, {
      lessons: updateAt(m.lessons, li, { ...m.lessons[li], ...patch }),
    });
  }
  function patchQuiz(ti: number, mi: number, patch: Partial<TrainingQuiz>) {
    const m = tracks[ti].modules[mi];
    patchModule(ti, mi, { quiz: { ...m.quiz, ...patch } });
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/formacao/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: tracks }),
      });
      const data = (await res.json()) as {
        error?: string;
        data?: TrainingTrack[];
      };
      if (!res.ok) {
        setMessage({ kind: "err", text: data.error ?? "Não foi possível gravar." });
        return;
      }
      if (data.data) setTracks(data.data);
      setDirty(false);
      setMessage({ kind: "ok", text: "Conteúdo gravado." });
      router.refresh();
    } catch {
      setMessage({ kind: "err", text: "Falha de rede — tenta outra vez." });
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (
      !window.confirm(
        "Repor o programa original definido em código? As tuas edições de conteúdo são descartadas. O progresso e as tentativas dos consultores NÃO são apagados.",
      )
    )
      return;
    setSaving(true);
    try {
      const res = await fetch("/api/formacao/admin/content", {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setMessage({ kind: "err", text: data.error ?? "Não foi possível repor." });
        return;
      }
      setMessage({ kind: "ok", text: "Programa reposto. A recarregar…" });
      setDirty(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const totals = tracks.reduce(
    (acc, t) => {
      for (const m of t.modules) {
        acc.modules += 1;
        acc.lessons += m.lessons.length;
        acc.questions += m.quiz.questions.length;
        acc.missing += m.lessons.filter((l) => !l.videoUrl).length;
      }
      return acc;
    },
    { modules: 0, lessons: 0, questions: 0, missing: 0 },
  );

  return (
    <div>
      {/* Barra de ações */}
      <div className="sticky top-16 z-30 mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-[color:var(--background)]/92 px-4 py-3 backdrop-blur-md">
        <span className="text-[12px] text-white/50">
          {tracks.length} módulos · {totals.modules} capítulos · {totals.lessons}{" "}
          aulas · {totals.questions} perguntas
          {totals.missing > 0 && (
            <span className="text-amber-200/70"> · {totals.missing} brevemente</span>
          )}
        </span>
        {isCustom && (
          <span className="rounded-full border border-[#783DF5]/35 bg-[#783DF5]/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#c3aaff]">
            personalizado
          </span>
        )}
        {message && (
          <span
            className={`text-[12px] ${
              message.kind === "ok" ? "text-emerald-300" : "text-rose-300"
            }`}
          >
            {message.text}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-2 text-[12px] font-medium text-white/60 transition hover:border-rose-400/40 hover:text-rose-200 disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Repor original
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="brand-gradient-bg inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {dirty ? "Guardar alterações" : "Guardado"}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {tracks.map((track, ti) => {
          const isOpen = openTrack === track.slug;
          return (
            <section
              key={track.slug}
              className="rounded-2xl border border-white/10 bg-white/[0.022]"
            >
              <header className="flex flex-wrap items-center gap-3 p-4">
                <button
                  type="button"
                  onClick={() => setOpenTrack(isOpen ? null : track.slug)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-white/40 transition ${isOpen ? "" : "-rotate-90"}`}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-white">
                      {track.name}
                    </span>
                    <span className="block text-[11px] text-white/40">
                      {track.slug} · {track.modules.length} capítulos ·{" "}
                      {track.modules.reduce((s, m) => s + m.lessons.length, 0)}{" "}
                      aulas
                      {track.isCommon && " · obrigatória"}
                    </span>
                  </span>
                </button>
                <RowTools
                  onUp={() => apply(move(tracks, ti, -1))}
                  onDown={() => apply(move(tracks, ti, 1))}
                  onDelete={() => {
                    if (
                      window.confirm(
                        `Remover o módulo "${track.name}" e tudo o que está dentro?`,
                      )
                    )
                      apply(removeAt(tracks, ti));
                  }}
                  deleteLabel="Remover capítulo"
                />
              </header>

              {isOpen && (
                <div className="border-t border-white/8 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Labeled label="Nome">
                      <input
                        className={inputCls}
                        value={track.name}
                        onChange={(e) => patchTrack(ti, { name: e.target.value })}
                      />
                    </Labeled>
                    <Labeled
                      label="Slug"
                      hint="Muda o URL do módulo. Evita alterar depois de a equipa começar."
                    >
                      <input
                        className={inputCls}
                        value={track.slug}
                        onChange={(e) => patchTrack(ti, { slug: e.target.value })}
                      />
                    </Labeled>
                    <div className="sm:col-span-2">
                      <Labeled label="Descrição">
                        <textarea
                          className={inputCls}
                          rows={2}
                          value={track.description}
                          onChange={(e) =>
                            patchTrack(ti, { description: e.target.value })
                          }
                        />
                      </Labeled>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {track.modules.map((mod, mi) => {
                      const modOpen = openModule === mod.id;
                      return (
                        <div
                          key={mod.id}
                          className="rounded-xl border border-white/10 bg-white/[0.02]"
                        >
                          <header className="flex flex-wrap items-center gap-3 p-3">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenModule(modOpen ? null : mod.id)
                              }
                              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                            >
                              <ChevronDown
                                className={`h-3.5 w-3.5 shrink-0 text-white/35 transition ${modOpen ? "" : "-rotate-90"}`}
                              />
                              <span className="min-w-0">
                                <span className="block truncate text-[13.5px] font-medium text-white/90">
                                  {mi + 1}. {mod.title}
                                </span>
                                <span className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-white/35">
                                  <span className="inline-flex items-center gap-1">
                                    <Film className="h-2.5 w-2.5" />
                                    {mod.lessons.length}
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <ClipboardCheck className="h-2.5 w-2.5" />
                                    {mod.quiz.questions.length}
                                  </span>
                                  {mod.section && <span>· {mod.section}</span>}
                                </span>
                              </span>
                            </button>
                            <RowTools
                              onUp={() =>
                                patchTrack(ti, {
                                  modules: move(track.modules, mi, -1),
                                })
                              }
                              onDown={() =>
                                patchTrack(ti, {
                                  modules: move(track.modules, mi, 1),
                                })
                              }
                              onDelete={() => {
                                if (
                                  window.confirm(
                                    `Remover o capítulo "${mod.title}"?`,
                                  )
                                )
                                  patchTrack(ti, {
                                    modules: removeAt(track.modules, mi),
                                  });
                              }}
                              deleteLabel="Remover capítulo"
                            />
                          </header>

                          {modOpen && (
                            <div className="border-t border-white/8 p-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <Labeled label="Título">
                                  <input
                                    className={inputCls}
                                    value={mod.title}
                                    onChange={(e) =>
                                      patchModule(ti, mi, {
                                        title: e.target.value,
                                      })
                                    }
                                  />
                                </Labeled>
                                <Labeled
                                  label="Secção"
                                  hint='Agrupa capítulos seguidos (ex.: "Service Delivery"). Vazio = sem agrupamento.'
                                >
                                  <input
                                    className={inputCls}
                                    value={mod.section ?? ""}
                                    onChange={(e) =>
                                      patchModule(ti, mi, {
                                        section: e.target.value || null,
                                      })
                                    }
                                  />
                                </Labeled>
                                <div className="sm:col-span-2">
                                  <Labeled label="Descrição">
                                    <textarea
                                      className={inputCls}
                                      rows={2}
                                      value={mod.description}
                                      onChange={(e) =>
                                        patchModule(ti, mi, {
                                          description: e.target.value,
                                        })
                                      }
                                    />
                                  </Labeled>
                                </div>
                              </div>

                              {/* Aulas */}
                              <h4 className="mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#A9834F]">
                                Aulas
                              </h4>
                              <div className="mt-2 space-y-2">
                                {mod.lessons.map((lesson, li) => (
                                  <LessonEditor
                                    key={lesson.id}
                                    lesson={lesson}
                                    onChange={(patch) =>
                                      patchLesson(ti, mi, li, patch)
                                    }
                                    onUp={() =>
                                      patchModule(ti, mi, {
                                        lessons: move(mod.lessons, li, -1),
                                      })
                                    }
                                    onDown={() =>
                                      patchModule(ti, mi, {
                                        lessons: move(mod.lessons, li, 1),
                                      })
                                    }
                                    onDelete={() => {
                                      if (
                                        window.confirm(
                                          `Remover a aula "${lesson.title}"? O progresso já registado nesta aula deixa de contar.`,
                                        )
                                      )
                                        patchModule(ti, mi, {
                                          lessons: removeAt(mod.lessons, li),
                                        });
                                    }}
                                  />
                                ))}
                                <AddBtn
                                  label="Adicionar aula"
                                  onClick={() =>
                                    patchModule(ti, mi, {
                                      lessons: [
                                        ...mod.lessons,
                                        {
                                          id: nextId(
                                            `${mod.id}-a`,
                                            mod.lessons.map((l) => l.id),
                                          ),
                                          title: "Nova aula",
                                          description: "",
                                          order: mod.lessons.length + 1,
                                          type: "formacao",
                                          presenter: null,
                                          videoUrl: null,
                                          videoProvider: null,
                                          keyPoints: [],
                                          isPublished: true,
                                        },
                                      ],
                                    })
                                  }
                                />
                              </div>

                              {/* Quiz */}
                              <h4 className="mt-6 text-[10px] font-bold uppercase tracking-[0.14em] text-[#A9834F]">
                                Quiz do capítulo
                              </h4>
                              <div className="mt-2 grid gap-3 sm:grid-cols-4">
                                <div className="sm:col-span-2">
                                  <Labeled label="Título">
                                    <input
                                      className={inputCls}
                                      value={mod.quiz.title}
                                      onChange={(e) =>
                                        patchQuiz(ti, mi, {
                                          title: e.target.value,
                                        })
                                      }
                                    />
                                  </Labeled>
                                </div>
                                <Labeled label="Nota mínima (%)">
                                  <input
                                    type="number"
                                    min={1}
                                    max={100}
                                    className={inputCls}
                                    value={mod.quiz.passingScore}
                                    onChange={(e) =>
                                      patchQuiz(ti, mi, {
                                        passingScore: Number(e.target.value),
                                      })
                                    }
                                  />
                                </Labeled>
                                <Labeled
                                  label="Máx. tentativas"
                                  hint="Vazio = ilimitadas"
                                >
                                  <input
                                    type="number"
                                    min={1}
                                    className={inputCls}
                                    value={mod.quiz.maxAttempts ?? ""}
                                    onChange={(e) =>
                                      patchQuiz(ti, mi, {
                                        maxAttempts: e.target.value
                                          ? Number(e.target.value)
                                          : null,
                                      })
                                    }
                                  />
                                </Labeled>
                                <label className="flex items-center gap-2 text-[12px] text-white/60 sm:col-span-4">
                                  <input
                                    type="checkbox"
                                    checked={mod.quiz.shuffleQuestions}
                                    onChange={(e) =>
                                      patchQuiz(ti, mi, {
                                        shuffleQuestions: e.target.checked,
                                      })
                                    }
                                  />
                                  Baralhar a ordem das perguntas em cada
                                  tentativa
                                </label>
                              </div>

                              <div className="mt-3 space-y-2">
                                {mod.quiz.questions.map((question, qi) => (
                                  <QuestionEditor
                                    key={question.id}
                                    question={question}
                                    index={qi}
                                    onChange={(patch) =>
                                      patchQuiz(ti, mi, {
                                        questions: updateAt(
                                          mod.quiz.questions,
                                          qi,
                                          { ...question, ...patch },
                                        ),
                                      })
                                    }
                                    onUp={() =>
                                      patchQuiz(ti, mi, {
                                        questions: move(
                                          mod.quiz.questions,
                                          qi,
                                          -1,
                                        ),
                                      })
                                    }
                                    onDown={() =>
                                      patchQuiz(ti, mi, {
                                        questions: move(
                                          mod.quiz.questions,
                                          qi,
                                          1,
                                        ),
                                      })
                                    }
                                    onDelete={() =>
                                      patchQuiz(ti, mi, {
                                        questions: removeAt(
                                          mod.quiz.questions,
                                          qi,
                                        ),
                                      })
                                    }
                                  />
                                ))}
                                <AddBtn
                                  label="Adicionar pergunta"
                                  onClick={() =>
                                    patchQuiz(ti, mi, {
                                      questions: [
                                        ...mod.quiz.questions,
                                        {
                                          id: nextId(
                                            `${mod.id}-q`,
                                            mod.quiz.questions.map((q) => q.id),
                                          ),
                                          prompt: "Nova pergunta",
                                          type: "multiple_choice",
                                          order: mod.quiz.questions.length + 1,
                                          points: 1,
                                          options: [
                                            {
                                              id: `${mod.id}-q${mod.quiz.questions.length + 1}-o1`,
                                              text: "Opção correta",
                                              isCorrect: true,
                                            },
                                            {
                                              id: `${mod.id}-q${mod.quiz.questions.length + 1}-o2`,
                                              text: "Opção errada",
                                              isCorrect: false,
                                            },
                                          ],
                                          explanation: null,
                                        },
                                      ],
                                    })
                                  }
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <AddBtn
                      label="Adicionar capítulo"
                      onClick={() => {
                        const id = nextId(
                          `${track.slug}-m`,
                          track.modules.map((m) => m.id),
                        );
                        patchTrack(ti, {
                          modules: [
                            ...track.modules,
                            {
                              id,
                              title: "Novo capítulo",
                              description: "",
                              order: track.modules.length + 1,
                              section: null,
                              lessons: [],
                              quiz: {
                                id: `${id}-quiz`,
                                title: "Quiz do capítulo",
                                passingScore: 80,
                                maxAttempts: null,
                                shuffleQuestions: true,
                                questions: [],
                              },
                            },
                          ],
                        });
                      }}
                    />
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function LessonEditor({
  lesson,
  onChange,
  onUp,
  onDown,
  onDelete,
}: {
  lesson: TrainingLesson;
  onChange: (patch: Partial<TrainingLesson>) => void;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.015]">
      <div className="flex flex-wrap items-center gap-2 p-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-white/30 transition ${open ? "" : "-rotate-90"}`}
          />
          <span className="min-w-0">
            <span className="block truncate text-[13px] text-white/85">
              {lesson.title}
            </span>
            <span className="block truncate text-[10.5px] text-white/35">
              {LESSON_TYPE_LABEL[lesson.type]} ·{" "}
              {lesson.presenter ?? "sem apresentador"} ·{" "}
              {lesson.videoUrl ? "com vídeo" : "brevemente"} ·{" "}
              {lesson.keyPoints.filter(Boolean).length > 0 ? (
                `${lesson.keyPoints.filter(Boolean).length} pontos`
              ) : (
                <span className="text-amber-200/60">sem Remember</span>
              )}
            </span>
          </span>
        </button>
        <RowTools onUp={onUp} onDown={onDown} onDelete={onDelete} />
      </div>
      {open && (
        <div className="grid gap-3 border-t border-white/8 p-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Labeled label="Título">
              <input
                className={inputCls}
                value={lesson.title}
                onChange={(e) => onChange({ title: e.target.value })}
              />
            </Labeled>
          </div>
          <div className="sm:col-span-2">
            <Labeled label="Descrição">
              <textarea
                className={inputCls}
                rows={3}
                value={lesson.description}
                onChange={(e) => onChange({ description: e.target.value })}
              />
            </Labeled>
          </div>
          <div className="sm:col-span-2">
            <Labeled
              label="Remember — pontos a reter"
              hint="Uma linha por ponto. Aparecem ao lado do vídeo, numerados. Deixa vazio enquanto a aula não estiver destilada."
            >
              <textarea
                className={inputCls}
                rows={4}
                placeholder={
                  "O padrão é ser o melhor consultor que aquele cliente já teve.\nErro assumido cedo é um contratempo; descoberto pelo cliente é uma quebra de confiança."
                }
                value={lesson.keyPoints.join("\n")}
                // Guardam-se as linhas cruas (incluindo as vazias) para o
                // Enter funcionar enquanto se escreve. As vazias caem na
                // normalização do servidor, ao gravar.
                onChange={(e) =>
                  onChange({ keyPoints: e.target.value.split("\n") })
                }
              />
            </Labeled>
          </div>
          <Labeled label="Tipo">
            <select
              className={inputCls}
              value={lesson.type}
              onChange={(e) =>
                onChange({ type: e.target.value as TrainingLessonType })
              }
            >
              {LESSON_TYPES.map((t) => (
                <option key={t} value={t}>
                  {LESSON_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Apresentador" hint="Vazio = por atribuir">
            <input
              className={inputCls}
              value={lesson.presenter ?? ""}
              placeholder="Alice / Alex / André"
              onChange={(e) => onChange({ presenter: e.target.value || null })}
            />
          </Labeled>
          <div className="sm:col-span-2">
            <Labeled
              label="Link do vídeo"
              hint="YouTube (unlisted), Vimeo, Loom ou ficheiro. O provider é detetado automaticamente."
            >
              <input
                className={inputCls}
                value={lesson.videoUrl ?? ""}
                placeholder="https://www.youtube.com/watch?v=…"
                onChange={(e) => {
                  const url = e.target.value.trim();
                  onChange({
                    videoUrl: url || null,
                    videoProvider: url ? detectProvider(url) : null,
                  });
                }}
              />
            </Labeled>
          </div>
          <Labeled label="Provider">
            <select
              className={inputCls}
              value={lesson.videoProvider ?? ""}
              onChange={(e) =>
                onChange({
                  videoProvider: (e.target.value || null) as VideoProvider | null,
                })
              }
            >
              <option value="">— detetar —</option>
              {VIDEO_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Duração estimada (min)">
            <input
              type="number"
              min={1}
              className={inputCls}
              value={lesson.estMinutes ?? ""}
              onChange={(e) =>
                onChange({
                  estMinutes: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </Labeled>
          <label className="flex items-center gap-2 text-[12px] text-white/60">
            <input
              type="checkbox"
              checked={lesson.isPublished}
              onChange={(e) => onChange({ isPublished: e.target.checked })}
            />
            Publicada
          </label>
          <p className="self-center text-[10.5px] text-white/25 sm:text-right">
            id: {lesson.id}
          </p>
        </div>
      )}
    </div>
  );
}

function QuestionEditor({
  question,
  index,
  onChange,
  onUp,
  onDown,
  onDelete,
}: {
  question: TrainingQuestion;
  index: number;
  onChange: (patch: Partial<TrainingQuestion>) => void;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const correct = question.options.filter((o) => o.isCorrect).length;
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.015]">
      <div className="flex flex-wrap items-center gap-2 p-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-white/30 transition ${open ? "" : "-rotate-90"}`}
          />
          <span className="min-w-0">
            <span className="block truncate text-[13px] text-white/85">
              {index + 1}. {question.prompt}
            </span>
            <span className="block text-[10.5px] text-white/35">
              {question.type} · {question.options.length} opções · {correct}{" "}
              correta(s)
              {correct === 0 && (
                <span className="text-rose-300">
                  {" "}
                  — sem resposta certa, será descartada ao gravar
                </span>
              )}
            </span>
          </span>
        </button>
        <RowTools
          onUp={onUp}
          onDown={onDown}
          onDelete={onDelete}
          deleteLabel="Remover pergunta"
        />
      </div>
      {open && (
        <div className="space-y-3 border-t border-white/8 p-3">
          <Labeled label="Enunciado">
            <textarea
              className={inputCls}
              rows={2}
              value={question.prompt}
              onChange={(e) => onChange({ prompt: e.target.value })}
            />
          </Labeled>
          <div className="grid gap-3 sm:grid-cols-3">
            <Labeled label="Tipo">
              <select
                className={inputCls}
                value={question.type}
                onChange={(e) =>
                  onChange({
                    type: e.target.value as TrainingQuestion["type"],
                  })
                }
              >
                <option value="multiple_choice">Escolha múltipla</option>
                <option value="multi_select">Múltipla seleção</option>
                <option value="true_false">Verdadeiro / Falso</option>
                <option value="open_text">
                  Resposta aberta (não conta para a nota)
                </option>
              </select>
            </Labeled>
            <Labeled label="Pontos">
              <input
                type="number"
                min={1}
                className={inputCls}
                value={question.points}
                onChange={(e) => onChange({ points: Number(e.target.value) })}
              />
            </Labeled>
            <p className="self-end pb-2 text-[10.5px] text-white/25">
              id: {question.id}
            </p>
          </div>

          {question.type !== "open_text" && (
            <div>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40">
                Opções — marca a(s) correta(s)
              </span>
              <div className="space-y-1.5">
                {question.options.map((o, oi) => (
                  <div key={o.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={o.isCorrect}
                      title="Correta"
                      onChange={(e) =>
                        onChange({
                          options: updateAt(question.options, oi, {
                            ...o,
                            isCorrect: e.target.checked,
                          }),
                        })
                      }
                    />
                    <input
                      className={inputCls}
                      value={o.text}
                      onChange={(e) =>
                        onChange({
                          options: updateAt(question.options, oi, {
                            ...o,
                            text: e.target.value,
                          }),
                        })
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          options: question.options.filter((_, k) => k !== oi),
                        })
                      }
                      className="rounded-md p-1.5 text-rose-300/70 transition hover:bg-rose-500/15"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2">
                <AddBtn
                  label="Adicionar opção"
                  onClick={() =>
                    onChange({
                      options: [
                        ...question.options,
                        {
                          id: nextId(
                            `${question.id}-o`,
                            question.options.map((o) => o.id),
                          ),
                          text: "",
                          isCorrect: false,
                        },
                      ],
                    })
                  }
                />
              </div>
            </div>
          )}

          <Labeled
            label="Explicação"
            hint="Mostrada na correção, depois de submeter."
          >
            <textarea
              className={inputCls}
              rows={2}
              value={question.explanation ?? ""}
              onChange={(e) =>
                onChange({ explanation: e.target.value || null })
              }
            />
          </Labeled>
        </div>
      )}
    </div>
  );
}
