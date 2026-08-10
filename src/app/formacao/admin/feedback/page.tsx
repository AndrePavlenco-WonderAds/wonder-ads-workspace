// Formação → Feedback: tudo o que a equipa disse sobre a formação, do mais
// recente para o mais antigo.
//
// O sino leva um resumo com as notas e os textos; esta página é o arquivo,
// onde nada expira. As duas coisas servem momentos diferentes: o sino diz
// «isto acabou de chegar», a página responde a «o que é que a malta tem
// dito?» três meses depois.
//
// As médias no topo existem para uma pergunta só: das três coisas que se
// avaliam — o formador, o vídeo e o processo — qual é a que está a puxar a
// formação para baixo? Uma média única não respondia a isso.
//
// Gated pelo layout de /formacao/admin (isAdmin).

import Link from "next/link";
import { ArrowLeft, MessageSquareQuote, Star } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { TrainingAdminNav } from "@/components/training/admin-nav";
import { listTrainingFeedback } from "@/lib/training/feedback-store";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Feedback da Formação · Wonder Ads Workspace",
};

function avg(values: number[]): number | null {
  const clean = values.filter((v) => v > 0);
  if (clean.length === 0) return null;
  return clean.reduce((s, v) => s + v, 0) / clean.length;
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3 w-3 ${n <= value ? "text-amber-300" : "text-white/15"}`}
          fill={n <= value ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

function ScoreTile({
  label,
  value,
  count,
}: {
  label: string;
  value: number | null;
  count: number;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <p className="readout text-white/35">{label}</p>
      <p className="tabular mt-1.5 text-[26px] font-bold leading-none text-white">
        {value === null ? "—" : value.toFixed(1)}
        {value !== null && (
          <span className="ml-1 text-[13px] font-medium text-white/35">/5</span>
        )}
      </p>
      <p className="mt-1.5 text-[11px] text-white/35">
        {count} {count === 1 ? "resposta" : "respostas"}
      </p>
    </div>
  );
}

export default async function TrainingFeedbackPage() {
  const entries = await listTrainingFeedback();

  return (
    <PageShell backHref="/formacao/admin" backLabel="Formação · Superadmin" wide>
      <Link
        href="/formacao/admin"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Formação · Superadmin
      </Link>

      <div className="animate-fade-up mt-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          <span className="brand-gradient-text">Feedback da Formação</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/55">
          O que a equipa diz sobre o formador, os vídeos e o processo, enquanto
          o está a fazer. É a única fonte que sabe onde a formação falha antes
          de o próximo consultor tropeçar no mesmo sítio.
        </p>
      </div>

      <div className="animate-fade-up mt-6">
        <TrainingAdminNav />
      </div>

      <div className="animate-fade-up mt-6 grid gap-3 sm:grid-cols-3">
        <ScoreTile
          label="Formadores"
          value={avg(entries.map((e) => e.ratings.instructor))}
          count={entries.length}
        />
        <ScoreTile
          label="Vídeos"
          value={avg(entries.map((e) => e.ratings.video))}
          count={entries.length}
        />
        <ScoreTile
          label="Processo"
          value={avg(entries.map((e) => e.ratings.process))}
          count={entries.length}
        />
      </div>

      <section className="animate-fade-up mt-8">
        {entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-12 text-center">
            <MessageSquareQuote className="mx-auto h-6 w-6 text-white/25" />
            <p className="mt-3 text-[13px] font-semibold text-white/70">
              Ainda ninguém deu feedback
            </p>
            <p className="mt-1 text-[12px] text-white/40">
              A zona de feedback aparece na barra lateral de cada aula e começa
              a piscar ao fim de 15 aulas vistas sem resposta.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {entries.map((e) => (
              <li
                key={e.id}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5"
              >
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-white">
                      {e.name}
                      <span className="ml-2 text-[11.5px] font-normal text-white/40">
                        {e.role}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-white/45">
                      na aula «{e.lessonTitle}»
                      {e.presenter ? ` · formador: ${e.presenter}` : ""} ·{" "}
                      {e.lessonsWatchedAtTime} aulas vistas
                    </p>
                  </div>
                  <p className="tabular shrink-0 text-[11px] text-white/30">
                    {formatDate(e.createdAt)}
                  </p>
                </header>

                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                  {(
                    [
                      ["Formador", e.ratings.instructor],
                      ["Vídeo", e.ratings.video],
                      ["Processo", e.ratings.process],
                    ] as const
                  ).map(([label, value]) => (
                    <span key={label} className="inline-flex items-center gap-2">
                      <span className="text-[11px] uppercase tracking-[0.12em] text-white/35">
                        {label}
                      </span>
                      <Stars value={value} />
                    </span>
                  ))}
                </div>

                {(e.whatWorked || e.whatMissing || e.suggestions) && (
                  <dl className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
                    {(
                      [
                        ["O que funcionou", e.whatWorked],
                        ["O que faltou", e.whatMissing],
                        ["O que mudaria", e.suggestions],
                      ] as const
                    )
                      .filter(([, v]) => Boolean(v))
                      .map(([label, value]) => (
                        <div key={label}>
                          <dt className="readout text-[#d8b98a]">{label}</dt>
                          <dd className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-white/70">
                            {value}
                          </dd>
                        </div>
                      ))}
                  </dl>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
