"use client";

// Gestão das regras de notificação — Superadmin.
//
// Mesmo contrato do CMS da Formação: as regras vivem em estado local, gravam-se
// todas de uma vez, e o servidor normaliza e recusa estruturas inválidas. Uma
// edição má não consegue partir o sino de quem está a trabalhar.
//
// O que se vê por regra é o que decide se ela dispara: quem recebe, sobre o
// quê, quando, e para onde vai o botão. Tudo o resto seria configuração a
// fingir.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellOff,
  ChevronDown,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import {
  DEPT_OPTIONS,
  type NotificationRule,
  type NotificationScope,
} from "@/lib/notifications/rules";

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
      {hint && (
        <span className="mt-1 block text-[10.5px] text-white/30">{hint}</span>
      )}
    </label>
  );
}

const SCOPE_LABEL: Record<NotificationScope, string> = {
  user: "Uma por pessoa",
  "seo-client": "Uma por cliente SEO da carteira",
};

function audienceText(rule: NotificationRule): string {
  switch (rule.audience.kind) {
    case "all":
      return "Toda a equipa";
    case "dept":
      return rule.audience.dept === "All"
        ? "Toda a equipa"
        : `DPT ${rule.audience.dept}`;
    case "users":
      return rule.audience.usernames.length
        ? rule.audience.usernames.join(", ")
        : "ninguém";
  }
}

function scheduleText(rule: NotificationRule): string {
  if (rule.schedule.kind === "monthly") {
    return `dia ${rule.schedule.dayOfMonth} de cada mês`;
  }
  if (rule.schedule.kind === "client-month") {
    const m = rule.schedule.months;
    return `última semana do mês ${m.join(", ")} de cada cliente`;
  }
  if (rule.schedule.kind === "weekly") {
    const names = [
      "domingo",
      "segunda",
      "terça",
      "quarta",
      "quinta",
      "sexta",
      "sábado",
    ];
    return `todas as semanas, à ${names[rule.schedule.weekday] ?? "sexta"}`;
  }
  return `a partir de ${rule.schedule.date}`;
}

export function NotificationRulesPanel({
  initial,
  isCustom,
  currentUser,
}: {
  initial: NotificationRule[];
  isCustom: boolean;
  currentUser: string;
}) {
  const router = useRouter();
  const [rules, setRules] = useState<NotificationRule[]>(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  function apply(next: NotificationRule[]) {
    setRules(next);
    setDirty(true);
    setMessage(null);
  }

  function patch(i: number, p: Partial<NotificationRule>) {
    apply(rules.map((r, k) => (k === i ? { ...r, ...p } : r)));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: rules }),
      });
      const data = (await res.json()) as {
        error?: string;
        data?: NotificationRule[];
      };
      if (!res.ok) {
        setMessage({
          kind: "err",
          text: data.error ?? "Não foi possível gravar.",
        });
        return;
      }
      if (data.data) setRules(data.data);
      setDirty(false);
      setMessage({ kind: "ok", text: "Regras gravadas." });
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
        "Repor as regras de origem? As tuas alterações são descartadas. O que os consultores já marcaram como concluído NÃO é apagado.",
      )
    )
      return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/notifications", { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setMessage({
          kind: "err",
          text: data.error ?? "Não foi possível repor.",
        });
        return;
      }
      setMessage({ kind: "ok", text: "Regras repostas. A recarregar…" });
      setDirty(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function addRule() {
    const base = "regra";
    let n = rules.length + 1;
    const ids = new Set(rules.map((r) => r.id));
    while (ids.has(`${base}-${n}`)) n += 1;
    const id = `${base}-${n}`;
    apply([
      ...rules,
      {
        id,
        title: "Novo lembrete",
        body: "",
        audience: { kind: "dept", dept: "SEO" },
        scope: "user",
        schedule: { kind: "monthly", dayOfMonth: 1 },
        actionLabel: "Abrir",
        actionHref: "",
        enabled: true,
        createdAt: Date.now(),
        createdBy: currentUser,
      },
    ]);
    setOpenId(id);
  }

  const active = rules.filter((r) => r.enabled).length;

  return (
    <div>
      <div className="sticky top-16 z-30 mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-[color:var(--background)]/92 px-4 py-3 backdrop-blur-md">
        <span className="text-[12px] text-white/50">
          {rules.length} {rules.length === 1 ? "regra" : "regras"} · {active}{" "}
          ativa{active === 1 ? "" : "s"}
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
            Repor originais
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

      <div className="space-y-3">
        {rules.map((rule, i) => {
          const open = openId === rule.id;
          return (
            <section
              key={rule.id}
              className={`rounded-2xl border bg-white/[0.022] transition ${
                rule.enabled ? "border-white/10" : "border-white/[0.06] opacity-60"
              }`}
            >
              <header className="flex flex-wrap items-center gap-3 p-4">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : rule.id)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-white/40 transition ${open ? "" : "-rotate-90"}`}
                  />
                  <span
                    aria-hidden
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                      rule.enabled
                        ? "border-[#783DF5]/30 bg-[#783DF5]/10 text-[#c3aaff]"
                        : "border-white/10 bg-white/[0.03] text-white/30"
                    }`}
                  >
                    {rule.enabled ? (
                      <Bell className="h-4 w-4" />
                    ) : (
                      <BellOff className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-white">
                      {rule.title}
                    </span>
                    <span className="block truncate text-[11px] text-white/40">
                      {audienceText(rule)} · {SCOPE_LABEL[rule.scope]} ·{" "}
                      {scheduleText(rule)}
                    </span>
                  </span>
                </button>

                <label className="flex shrink-0 items-center gap-2 text-[11.5px] text-white/55">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) => patch(i, { enabled: e.target.checked })}
                  />
                  Ativa
                </label>
                <button
                  type="button"
                  title="Remover regra"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Remover a regra "${rule.title}"? Deixa de aparecer a toda a gente.`,
                      )
                    )
                      apply(rules.filter((_, k) => k !== i));
                  }}
                  className="shrink-0 rounded-md p-1.5 text-rose-300/70 transition hover:bg-rose-500/15 hover:text-rose-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </header>

              {open && (
                <div className="grid gap-3 border-t border-white/8 p-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Labeled label="Título">
                      <input
                        className={inputCls}
                        value={rule.title}
                        onChange={(e) => patch(i, { title: e.target.value })}
                      />
                    </Labeled>
                  </div>
                  <div className="sm:col-span-2">
                    <Labeled
                      label="Contexto"
                      hint="A frase que aparece por baixo do título, no painel."
                    >
                      <textarea
                        className={inputCls}
                        rows={2}
                        value={rule.body}
                        onChange={(e) => patch(i, { body: e.target.value })}
                      />
                    </Labeled>
                  </div>

                  <Labeled label="Quem recebe">
                    <select
                      className={inputCls}
                      value={
                        rule.audience.kind === "dept"
                          ? `dept:${rule.audience.dept}`
                          : rule.audience.kind === "all"
                            ? "all"
                            : "users"
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "all") patch(i, { audience: { kind: "all" } });
                        else if (v === "users")
                          patch(i, {
                            audience: { kind: "users", usernames: [] },
                          });
                        else
                          patch(i, {
                            audience: {
                              kind: "dept",
                              dept: v.replace("dept:", ""),
                            },
                          });
                      }}
                    >
                      <option value="all">Toda a equipa</option>
                      {DEPT_OPTIONS.filter((d) => d !== "All").map((d) => (
                        <option key={d} value={`dept:${d}`}>
                          Departamento {d}
                        </option>
                      ))}
                      <option value="users">Pessoas específicas</option>
                    </select>
                  </Labeled>

                  {rule.audience.kind === "users" ? (
                    <Labeled
                      label="Usernames"
                      hint="Separados por vírgula (ex.: manuel-s, fran-r)."
                    >
                      <input
                        className={inputCls}
                        value={rule.audience.usernames.join(", ")}
                        onChange={(e) =>
                          patch(i, {
                            audience: {
                              kind: "users",
                              usernames: e.target.value
                                .split(",")
                                .map((u) => u.trim())
                                .filter(Boolean),
                            },
                          })
                        }
                      />
                    </Labeled>
                  ) : (
                    <Labeled
                      label="Sobre o quê"
                      hint="Por cliente = uma linha por cliente SEO da carteira da pessoa."
                    >
                      <select
                        className={inputCls}
                        value={rule.scope}
                        onChange={(e) =>
                          patch(i, {
                            scope: e.target.value as NotificationScope,
                          })
                        }
                      >
                        <option value="user">Uma por pessoa</option>
                        <option value="seo-client">
                          Uma por cliente SEO da carteira
                        </option>
                      </select>
                    </Labeled>
                  )}

                  {rule.audience.kind === "users" && (
                    <div className="sm:col-span-2">
                      <Labeled label="Sobre o quê">
                        <select
                          className={inputCls}
                          value={rule.scope}
                          onChange={(e) =>
                            patch(i, {
                              scope: e.target.value as NotificationScope,
                            })
                          }
                        >
                          <option value="user">Uma por pessoa</option>
                          <option value="seo-client">
                            Uma por cliente SEO da carteira
                          </option>
                        </select>
                      </Labeled>
                    </div>
                  )}

                  <Labeled label="Quando">
                    <select
                      className={inputCls}
                      value={rule.schedule.kind}
                      onChange={(e) =>
                        patch(i, {
                          schedule:
                            e.target.value === "once"
                              ? { kind: "once", date: "" }
                              : e.target.value === "client-month"
                                ? { kind: "client-month", months: [3, 4, 5, 6] }
                                : e.target.value === "weekly"
                                  ? { kind: "weekly", weekday: 5 }
                                  : { kind: "monthly", dayOfMonth: 1 },
                        })
                      }
                    >
                      <option value="monthly">Todos os meses</option>
                      <option value="weekly">Todas as semanas</option>
                      <option value="client-month">
                        Última semana do mês N do cliente
                      </option>
                      <option value="once">Numa data</option>
                    </select>
                  </Labeled>

                  {rule.schedule.kind === "client-month" ? (
                    <Labeled
                      label="Meses de acompanhamento"
                      hint="Separados por vírgula. Conta a partir da data de início de CADA cliente, não do calendário."
                    >
                      <input
                        className={inputCls}
                        value={rule.schedule.months.join(", ")}
                        onChange={(e) =>
                          patch(i, {
                            schedule: {
                              kind: "client-month",
                              months: e.target.value
                                .split(",")
                                .map((v) => Number(v.trim()))
                                .filter(
                                  (v) => Number.isFinite(v) && v >= 1 && v <= 36,
                                ),
                            },
                          })
                        }
                      />
                    </Labeled>
                  ) : rule.schedule.kind === "monthly" ? (
                    <Labeled
                      label="Dia do mês"
                      hint="1 a 28 — para que todos os meses tenham esse dia."
                    >
                      <input
                        type="number"
                        min={1}
                        max={28}
                        className={inputCls}
                        value={rule.schedule.dayOfMonth}
                        onChange={(e) =>
                          patch(i, {
                            schedule: {
                              kind: "monthly",
                              dayOfMonth: Number(e.target.value) || 1,
                            },
                          })
                        }
                      />
                    </Labeled>
                  ) : rule.schedule.kind === "weekly" ? (
                    <Labeled label="Dia da semana">
                      <select
                        className={inputCls}
                        value={rule.schedule.weekday}
                        onChange={(e) =>
                          patch(i, {
                            schedule: {
                              kind: "weekly",
                              weekday: Number(e.target.value),
                            },
                          })
                        }
                      >
                        {[
                          "Domingo",
                          "Segunda",
                          "Terça",
                          "Quarta",
                          "Quinta",
                          "Sexta",
                          "Sábado",
                        ].map((d, wi) => (
                          <option key={d} value={wi}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </Labeled>
                  ) : (
                    <Labeled label="Data (AAAA-MM-DD)">
                      <input
                        type="date"
                        className={inputCls}
                        value={rule.schedule.kind === "once" ? rule.schedule.date : ""}
                        onChange={(e) =>
                          patch(i, {
                            schedule: { kind: "once", date: e.target.value },
                          })
                        }
                      />
                    </Labeled>
                  )}

                  <Labeled label="Texto do botão">
                    <input
                      className={inputCls}
                      value={rule.actionLabel}
                      onChange={(e) => patch(i, { actionLabel: e.target.value })}
                    />
                  </Labeled>
                  <Labeled
                    label="Destino do botão"
                    hint="{slug} é substituído pelo slug do cliente. Vazio = sem botão."
                  >
                    <input
                      className={inputCls}
                      placeholder="/seo/{slug}/report"
                      value={rule.actionHref}
                      onChange={(e) => patch(i, { actionHref: e.target.value })}
                    />
                  </Labeled>

                  <p className="self-center text-[10.5px] text-white/25 sm:col-span-2">
                    id: {rule.id} — é por ele que se guarda quem já marcou como
                    concluído. Mudar o id faz o lembrete reaparecer a toda a
                    gente.
                  </p>
                </div>
              )}
            </section>
          );
        })}

        <button
          type="button"
          onClick={addRule}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/15 px-3 py-2 text-[12px] font-medium text-white/55 transition hover:border-[#783DF5]/40 hover:text-white/85"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar regra
        </button>
      </div>
    </div>
  );
}
