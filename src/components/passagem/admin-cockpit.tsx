"use client";

// O cockpit da direção numa passagem (v80.39): projeto a projeto, quem entra,
// o andamento e o botão para passar no SEO DPT (usa a migração que já existe,
// PUT /api/admin/seo-consultant/<slug>); a checklist de saída; o prazo, a
// nota e o fecho.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, CheckCircle2, FileText, Loader2, MessageCircleQuestion, Plus, Trash2 } from "lucide-react";
import { HealthDot, ProgressRing, StageChip } from "./ui";
import { formatDate } from "@/lib/dates";
import { formatISODate, type ExitItem, type Passagem, type ProjectStage } from "@/lib/passagem/shared";

export type CockpitProject = {
  slug: string;
  title: string;
  incoming: { username: string; name: string } | null;
  stage: ProjectStage;
  pct: number;
  next: string | null;
  health: "verde" | "amarelo" | "vermelho" | null;
  healthWhy: string;
  signedAt: number | null;
  transferred: boolean;
  owner: string;
  openQuestions: number;
};

type Props = {
  passagem: Passagem;
  projects: CockpitProject[];
  candidates: Array<{ username: string; name: string; count: number }>;
  addable: Array<{ slug: string; title: string }>;
  exitItems: ExitItem[];
};

async function patch(id: string, body: Record<string, unknown>): Promise<string | null> {
  const res = await fetch(`/api/admin/passagens/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error ?? "Não foi possível gravar.";
}

const btn =
  "inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-1.5 text-[12.5px] text-white/75 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

export function AdminCockpit({ passagem: p, projects, candidates, addable, exitItems }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [note, setNote] = useState(p.note);
  const closed = p.status !== "ativa";

  async function run(key: string, fn: () => Promise<string | null>) {
    setBusy(key);
    setError(null);
    const err = await fn().catch(() => "Sem ligação.");
    setBusy(null);
    setConfirm(null);
    if (err) setError(err);
    else router.refresh();
  }

  const transfer = (proj: CockpitProject) =>
    run(`transfer:${proj.slug}`, async () => {
      if (!proj.incoming) return "Escolhe primeiro quem fica com o projeto.";
      const res = await fetch(`/api/admin/seo-consultant/${proj.slug}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ consultant: proj.incoming.name }),
      });
      if (res.ok) return null;
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return data.error ?? "Não foi possível passar o projeto.";
    });

  const transferredAll = projects.length > 0 && projects.every((x) => x.transferred);
  const exitDone = exitItems.filter((i) => p.exit[i.id]).length;

  return (
    <div className="space-y-8">
      {error && <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2.5 text-[13.5px] text-rose-200">{error}</p>}

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-[18px] font-semibold text-white">Projetos</h2>
          <p className="text-[12.5px] text-white/45">
            Passa cada projeto depois de quem entra o assumir. O SEO DPT, os roadmaps, as páginas públicas e o NPS passam a mostrar o novo consultor.
          </p>
        </div>
        <ul className="space-y-2.5">
          {projects.map((proj) => {
            const key = `transfer:${proj.slug}`;
            return (
              <li key={proj.slug} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <ProgressRing pct={proj.pct} size={42} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <HealthDot health={proj.health} />
                      <p className="text-[15.5px] font-semibold text-white">{proj.title}</p>
                      <StageChip stage={proj.stage} />
                      {proj.openQuestions > 0 && (
                        <span className="inline-flex items-center gap-1 text-[12px] text-amber-200">
                          <MessageCircleQuestion className="h-3.5 w-3.5" /> {proj.openQuestions}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-white/45">
                      {proj.transferred
                        ? `No SEO DPT com ${proj.owner}.`
                        : proj.next
                          ? `Próximo: ${proj.next}`
                          : "Tudo feito do lado da ficha."}
                      {proj.health === "vermelho" && proj.healthWhy ? ` · Em risco: ${proj.healthWhy}` : ""}
                    </p>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <ArrowRight className="hidden h-4 w-4 text-white/25 sm:block" />
                    <select
                      value={proj.incoming?.username ?? ""}
                      disabled={closed || proj.transferred || busy !== null}
                      onChange={(e) => run(`inc:${proj.slug}`, () => patch(p.id, { op: "incoming", slug: proj.slug, incoming: e.target.value || null }))}
                      className="rounded-lg border border-white/12 bg-black/40 px-2.5 py-1.5 text-[13px] text-white outline-none focus:border-[#783DF5]/70 disabled:opacity-50"
                      aria-label={`Quem fica com ${proj.title}`}
                    >
                      <option value="">Por decidir</option>
                      {candidates.map((c) => (
                        <option key={c.username} value={c.username}>
                          {c.name} · {c.count} proj.
                        </option>
                      ))}
                    </select>
                    <Link href={`/passagem/${p.id}/${proj.slug}`} className={btn}>
                      <FileText className="h-3.5 w-3.5" /> Ficha
                    </Link>
                    {proj.transferred ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-400/15 px-3 py-1.5 text-[12.5px] text-emerald-200">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Passado
                      </span>
                    ) : confirm === key ? (
                      <span className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => transfer(proj)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#07080d] disabled:opacity-40"
                        >
                          {busy === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          Passar para {proj.incoming?.name.split(" ")[0]}
                        </button>
                        <button type="button" onClick={() => setConfirm(null)} className="text-[12px] text-white/45 hover:text-white">
                          Cancelar
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={closed || !proj.incoming || busy !== null}
                        onClick={() => setConfirm(key)}
                        title={!proj.incoming ? "Escolhe primeiro quem fica com o projeto" : !proj.signedAt ? "Ainda não foi assumido por quem entra" : undefined}
                        className={`${btn} ${proj.signedAt ? "border-emerald-300/40 text-emerald-200" : ""}`}
                      >
                        Passar no SEO DPT
                      </button>
                    )}
                  </div>
                </div>
                {confirm === key && !proj.signedAt && (
                  <p className="mt-2 text-[12.5px] text-amber-200">
                    {proj.incoming?.name ?? "Quem entra"} ainda não assinou «Li e assumo». Podes passar na mesma.
                  </p>
                )}
                {!closed && !proj.transferred && projects.length > 1 && (
                  <div className="mt-2 text-right">
                    {confirm === `rm:${proj.slug}` ? (
                      <span className="inline-flex items-center gap-2 text-[12px]">
                        <span className="text-white/55">Tirar da passagem? A ficha fica guardada.</span>
                        <button
                          type="button"
                          onClick={() => run(`rm:${proj.slug}`, () => patch(p.id, { op: "remove-project", slug: proj.slug }))}
                          className="text-rose-300 hover:underline"
                        >
                          Tirar
                        </button>
                        <button type="button" onClick={() => setConfirm(null)} className="text-white/45 hover:text-white">
                          Não
                        </button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setConfirm(`rm:${proj.slug}`)} className="inline-flex items-center gap-1 text-[11.5px] text-white/30 hover:text-white/70">
                        <Trash2 className="h-3 w-3" /> Tirar da passagem
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {!closed && addable.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-white/12 p-3">
            <span className="text-[12.5px] text-white/50">Na carteira de {p.outgoing.name.split(" ")[0]} e fora da passagem:</span>
            {addable.map((c) => (
              <button
                key={c.slug}
                type="button"
                disabled={busy !== null}
                onClick={() => run(`add:${c.slug}`, () => patch(p.id, { op: "add-project", slug: c.slug }))}
                className={btn}
              >
                <Plus className="h-3.5 w-3.5" /> {c.title}
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[16px] font-semibold text-white">Checklist de saída</h2>
            <span className="text-[12.5px] tabular-nums text-white/45">
              {exitDone}/{exitItems.length}
            </span>
          </div>
          <p className="mt-0.5 text-[12.5px] text-white/45">Da direção. A pessoa não vê esta lista.</p>
          <ul className="mt-4 space-y-1.5">
            {exitItems.map((item) => {
              const done = p.exit[item.id];
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={closed || busy !== null}
                    onClick={() => run(`exit:${item.id}`, () => patch(p.id, { op: "exit", item: item.id, done: !done }))}
                    className="flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.03] disabled:cursor-default"
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        done ? "border-emerald-400 bg-emerald-500" : "border-white/25"
                      }`}
                    >
                      {busy === `exit:${item.id}` ? (
                        <Loader2 className="h-3 w-3 animate-spin text-white" />
                      ) : (
                        done && <Check className="h-3.5 w-3.5 text-white" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-[14px] ${done ? "text-white/50 line-through" : "text-white"}`}>{item.label}</span>
                      <span className="block text-[12.5px] leading-relaxed text-white/45">
                        {done ? `Feito por ${done.by} a ${formatDate(done.at)}` : item.hint}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
          <h2 className="text-[16px] font-semibold text-white">Prazo, nota e fecho</h2>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] text-white/55">Último dia (começou a {formatISODate(p.startDate)})</span>
            <input
              type="date"
              defaultValue={p.endDate}
              min={p.startDate}
              disabled={closed}
              onBlur={(e) => {
                if (e.target.value && e.target.value !== p.endDate) void run("end", () => patch(p.id, { op: "end-date", endDate: e.target.value }));
              }}
              className="w-full rounded-xl border border-white/12 bg-black/30 px-3.5 py-2.5 text-[14px] text-white outline-none focus:border-[#783DF5]/70"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] text-white/55">Nota para {p.outgoing.name.split(" ")[0]}</span>
            <textarea
              value={note}
              disabled={closed}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => {
                if (note.trim() !== p.note) void run("note", () => patch(p.id, { op: "note", note }));
              }}
              rows={3}
              maxLength={1000}
              className="w-full resize-none rounded-xl border border-white/12 bg-black/30 px-3.5 py-2.5 text-[14px] text-white outline-none focus:border-[#783DF5]/70"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4">
            {closed ? (
              <button type="button" disabled={busy !== null} onClick={() => run("status", () => patch(p.id, { op: "status", status: "ativa" }))} className={btn}>
                Reabrir passagem
              </button>
            ) : confirm === "concluir" ? (
              <>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => run("status", () => patch(p.id, { op: "status", status: "concluida" }))}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-[13px] font-semibold text-[#07080d]"
                >
                  {busy === "status" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Confirmar conclusão
                </button>
                <button type="button" onClick={() => setConfirm(null)} className="text-[12.5px] text-white/45 hover:text-white">
                  Cancelar
                </button>
                {!transferredAll && <p className="w-full text-[12.5px] text-amber-200">Ainda há projetos por passar no SEO DPT.</p>}
              </>
            ) : confirm === "cancelar" ? (
              <>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => run("status", () => patch(p.id, { op: "status", status: "cancelada" }))}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300/40 px-3.5 py-2 text-[13px] text-rose-200"
                >
                  Confirmar cancelamento
                </button>
                <button type="button" onClick={() => setConfirm(null)} className="text-[12.5px] text-white/45 hover:text-white">
                  Não
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setConfirm("concluir")}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold text-white"
                  style={{ background: "linear-gradient(90deg,#783DF5,#E040A0)" }}
                >
                  <CheckCircle2 className="h-4 w-4" /> Concluir passagem
                </button>
                <button type="button" onClick={() => setConfirm("cancelar")} className="text-[12.5px] text-white/40 hover:text-white/80">
                  Cancelar passagem
                </button>
              </>
            )}
          </div>
          {closed && (
            <p className="text-[12.5px] text-white/45">
              {p.status === "concluida" ? "Concluída" : "Cancelada"}
              {p.closedBy ? ` por ${p.closedBy.name}` : ""}
              {p.closedAt ? ` a ${formatDate(p.closedAt)}` : ""}. As fichas ficam guardadas para consulta.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
