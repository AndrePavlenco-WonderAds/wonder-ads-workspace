// Hub da Formação — WonderAds Consultants University.
//
// DESENHO — TRÊS PERGUNTAS, TRÊS ZONAS, POR ESTA ORDEM.
//
//   "Onde estou?"      → IDENTIDADE. Nome, data de entrada, dia N na casa,
//                        percentagem global, situação. Quem entra aqui quer
//                        primeiro saber em que ponto do caminho está.
//   "O que faço já?"   → AGORA. Uma ação, uma só, grande. Se houver um exame
//                        aberto é ele; senão é a próxima aula ou quiz. Não é
//                        uma lista de sugestões: é o passo seguinte.
//   "E o resto?"       → PERCURSO (o que falta aprender), EXAMES (o que
//                        decide) e REVER (o que já foi dado e se pode
//                        revisitar).
//
// CONTRASTE. O workspace é escuro e a Formação vivia em cinzentos sobre
// cinzentos — legível para quem já sabia o que procurava, opaco para todos os
// outros. As manchas de cor CLARA (as pastilhas pastel da tabela de Pending
// Review do lado do cliente, ver `BrightPill`) são agora as únicas do ecrã, e
// carregam sempre a mesma informação: o ESTADO. O olho aprende isso numa
// visita e a partir daí lê a página em três segundos.
//
// Vocabulário: os testes de capítulo são QUIZZES (ensinam, repetem-se); os
// seis marcos são EXAMES (decidem, com cronómetro). A distinção é a espinha da
// página e está escrita em todo o lado — mudar uma palavra aqui obriga a mudar
// as outras.

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Film,
  GraduationCap,
  Library,
  Lock,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { ExamRail, NextExamCard } from "@/components/training/exam-rail";
import {
  ReviewLibrary,
  type LibraryEntry,
} from "@/components/training/review-library";
import {
  BrightPill,
  LessonRibbon,
  LessonRibbonLegend,
  LessonThumb,
  LessonTypeBadge,
  ProgressRing,
  StatTile,
} from "@/components/training/training-ui";
import { getTrainingContext, userTracks } from "@/lib/training/server";
import { overallPercent } from "@/lib/training/progress";
import type { TrackState } from "@/lib/training/progress";
import { championQuote } from "@/lib/training/champion";
import { lessonMinutes } from "@/lib/training/catalog";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Formação · Wonder Ads Workspace",
};

/** Dias inteiros desde a data de entrada, contando o próprio dia 1 como 1.
 *  É a leitura humana ("estou no dia 24"), não a aritmética ("23 dias"). */
function dayInHouse(startISO: string | null, now: Date): number | null {
  if (!startISO) return null;
  const start = new Date(`${startISO}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  return diff < 0 ? null : diff + 1;
}

export default async function FormacaoPage() {
  const ctx = await getTrainingContext();
  if (!ctx) redirect("/login?next=/formacao");

  const { employee, common, specializations, exams } = ctx;
  const global = overallPercent(common, specializations);
  // Sorteada a cada entrada — a página é force-dynamic, por isso muda mesmo.
  const quote = championQuote();
  const tracks = userTracks(ctx);
  const now = new Date();
  const day = dayInHouse(exams.startedAt, now);

  const watched = tracks.reduce((s, t) => s + t.watchedLessons, 0);
  // Denominador = programa inteiro, não só o que já está gravado. Enquanto os
  // vídeos não existem, "0/0 aulas" não dizia a ninguém quanto é o curso.
  const totalLessons = tracks.reduce((s, t) => s + t.allLessons, 0);
  const quizzesTotal = tracks.reduce(
    (s, t) => s + t.modules.filter((m) => m.quizRequired).length,
    0,
  );
  const quizzesPassed = tracks.reduce(
    (s, t) => s + t.modules.filter((m) => m.quizRequired && m.quizPassed).length,
    0,
  );
  const minutesLeft = tracks.reduce((s, t) => s + t.minutesLeft, 0);
  const missing = tracks.reduce((s, t) => s + t.missingVideos, 0);

  // O próximo passo real, seja aula ou quiz, no primeiro módulo aberto.
  const active = tracks.find(
    (t) => !t.lockedReason && (t.nextLesson || t.nextQuizModule),
  );
  const nextLesson = active?.nextLesson ?? null;
  const nextQuiz = !nextLesson ? (active?.nextQuizModule ?? null) : null;
  const nextHref = nextLesson
    ? `/formacao/${active!.track.slug}/aula/${nextLesson.lesson.id}`
    : nextQuiz
      ? `/formacao/${active!.track.slug}/teste/${nextQuiz.id}`
      : null;

  // Um exame aberto ganha SEMPRE ao resto. É a única coisa nesta página com
  // prazo a andar e com consequência de carreira; deixá-lo em quarto lugar,
  // por baixo de uma aula de 12 minutos, seria pôr o urgente por baixo do
  // rotineiro.
  const openExam = exams.exams.find((e) => e.status === "available") ?? null;

  // Índice de revisão: todas as aulas do programa, pela ordem do catálogo.
  const library: LibraryEntry[] = tracks.flatMap((t) =>
    t.modules.flatMap((m) =>
      m.lessons.map((l) => ({
        id: `${t.track.slug}:${l.lesson.id}`,
        href: `/formacao/${t.track.slug}/aula/${l.lesson.id}`,
        title: l.lesson.title,
        trackName: t.track.name,
        moduleTitle: m.module.title,
        type: l.lesson.type,
        minutes: lessonMinutes(l.lesson),
        watched: l.watched,
        comingSoon: l.comingSoon,
      })),
    ),
  );

  const commonTrack = tracks.find((t) => t.track.isCommon) ?? null;
  const otherTracks = tracks.filter((t) => !t.track.isCommon);

  return (
    <PageShell backHref="/" backLabel="Workspace" wide>
      {/* ===== 1 · Identidade ===== */}
      <section className="animate-fade-up relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-9">
        {/* Duas fontes de luz em vez de uma: a fria à esquerda ancora o nome,
            a quente à direita ancora o anel. O olho lê nome → progresso. */}
        <span
          aria-hidden
          className="pointer-events-none absolute -left-28 -top-36 h-[26rem] w-[26rem] rounded-full opacity-[0.2] blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(52,62,215,0.9), transparent 70%)",
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-44 h-[30rem] w-[30rem] rounded-full opacity-[0.18] blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(197,53,201,0.9), transparent 70%)",
          }}
        />
        {/* Fio de luz no topo — assina o cartão sem lhe pôr moldura. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(120,61,245,0.7), rgba(197,53,201,0.4), transparent)",
          }}
        />

        <div className="relative flex flex-col gap-9 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <span className="readout inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-white/55">
              <GraduationCap className="h-3 w-3 text-[color:var(--brand-purple)]" />
              Consultants University
            </span>
            <h1 className="mt-4 text-[2.1rem] font-bold leading-[1.05] tracking-[-0.025em] sm:text-[3rem]">
              <span className="text-white/60">Bem-vindo, </span>
              <span className="brand-gradient-text">{employee.name}</span>
            </h1>

            {/* ---- A linha do onboarding ----
                Quem entrou quando, e em que dia do percurso está hoje. É a
                âncora de tudo o que esta página decide: os seis exames abrem
                contados a partir daqui. */}
            <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-2">
              <BrightPill tone="indigo">{employee.role}</BrightPill>
              {exams.startedAt ? (
                <>
                  <BrightPill
                    tone="purple"
                    icon={<CalendarDays className="h-2.5 w-2.5" />}
                  >
                    Entrou a {formatDate(`${exams.startedAt}T00:00:00`)}
                  </BrightPill>
                  {day !== null && (
                    <span className="tabular text-[12.5px] font-medium text-white/60">
                      dia {day} na WonderAds
                    </span>
                  )}
                </>
              ) : (
                <BrightPill
                  tone="amber"
                  icon={<CalendarDays className="h-2.5 w-2.5" />}
                >
                  Data de entrada por definir
                </BrightPill>
              )}
              {exams.effective && (
                <BrightPill
                  tone="green"
                  icon={<ShieldCheck className="h-2.5 w-2.5" />}
                >
                  Efetivo
                </BrightPill>
              )}
            </div>

            {/* Frase à sorte a cada entrada (v76.42). Com autor: sem o nome
                de quem a disse, uma frase forte lê-se como slogan; com ele,
                lê-se como uma ideia já provada por alguém. */}
            <figure className="mt-4 max-w-xl">
              <blockquote className="text-[13.5px] leading-relaxed text-white/70">
                “{quote.text}”
              </blockquote>
              <figcaption className="mt-1 text-[11.5px] font-medium uppercase tracking-[0.14em] text-white/35">
                {quote.author}
              </figcaption>
            </figure>

            {!exams.startedAt && (
              <p className="mt-3 text-[12px] leading-relaxed text-amber-200/70">
                O relógio dos exames só arranca quando a tua data de entrada
                estiver registada.{" "}
                {employee.isAdmin ? (
                  <Link
                    href="/admin/employees"
                    className="underline decoration-amber-200/40 underline-offset-2 hover:text-amber-100"
                  >
                    Define-a no Team Roster
                  </Link>
                ) : (
                  "Fala com o Andre, o Alex ou a Alice"
                )}
                .
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-5 lg:pr-2">
            <ProgressRing percent={global} label="progresso" size={150} />
          </div>
        </div>
      </section>

      {/* ===== 2 · Agora ===== */}
      {/* Uma ação, a mais importante, do tamanho da sua importância. */}
      {openExam ? (
        <Link
          href={`/formacao/exame/${openExam.exam.id}`}
          className="animate-fade-up group mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-[#C535C9]/45 bg-[#C535C9]/[0.09] p-5 transition hover:border-[#C535C9]/70 hover:bg-[#C535C9]/[0.14]"
        >
          <span className="animate-node-halo flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#C535C9]/40 bg-[#C535C9]/12 text-[#f0a8ee]">
            <Target className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <BrightPill tone="rose">Exame aberto</BrightPill>
            <p className="mt-1.5 text-[15px] font-semibold text-white">
              {openExam.exam.title}
            </p>
            <p className="mt-0.5 text-[11.5px] text-white/55">
              60 minutos, sem pausas · mínimo {openExam.exam.passingScore}% ·{" "}
              {openExam.attemptsLeft} tentativa
              {openExam.attemptsLeft === 1 ? "" : "s"} · {openExam.exam.gate}
            </p>
          </div>
          <span className="brand-gradient-bg inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition group-hover:brightness-110">
            Ver o exame
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      ) : nextHref && active ? (
        <Link
          href={nextHref}
          className="animate-fade-up group mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-[#783DF5]/35 bg-[#783DF5]/[0.09] p-5 transition hover:border-[#783DF5]/60 hover:bg-[#783DF5]/[0.14]"
        >
          {nextLesson ? (
            <LessonThumb type={nextLesson.lesson.type} />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#783DF5]/30 bg-[#783DF5]/10 text-[#c3aaff]">
              <ClipboardCheck className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <BrightPill
              tone="purple"
              icon={<Sparkles className="h-2.5 w-2.5" />}
            >
              {watched === 0 && quizzesPassed === 0
                ? "Começa por aqui"
                : "Continuar onde ficaste"}
            </BrightPill>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[15px] font-semibold text-white">
              {nextLesson ? nextLesson.lesson.title : nextQuiz?.quiz.title}
              {nextLesson && <LessonTypeBadge type={nextLesson.lesson.type} />}
            </p>
            <p className="mt-0.5 text-[11.5px] text-white/55">
              {active.track.name} ·{" "}
              {nextLesson
                ? `${nextLesson.module.title} · ~${lessonMinutes(nextLesson.lesson)} min`
                : `${nextQuiz?.title} · ${nextQuiz?.quiz.questions.length} perguntas`}
            </p>
          </div>
          <span className="brand-gradient-bg inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition group-hover:brightness-110">
            Retomar
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      ) : tracks.length > 0 ? (
        <div className="animate-fade-up mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.07] p-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <BrightPill tone="green">Em dia</BrightPill>
            <p className="mt-1.5 text-[15px] font-semibold text-white">
              Não tens nada por fazer na matéria.
            </p>
            <p className="mt-0.5 text-[11.5px] text-white/55">
              O que falta é o relógio dos exames. Até lá, revê o que quiseres
              mais abaixo.
            </p>
          </div>
        </div>
      ) : null}

      {/* ===== 3 · Números ===== */}
      {tracks.length > 0 && (
        <div className="animate-fade-up mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <StatTile
            label="Aulas vistas"
            value={`${watched}/${totalLessons}`}
            icon={<Film className="h-3 w-3" />}
          />
          <StatTile
            label="Quizzes passados"
            value={`${quizzesPassed}/${quizzesTotal}`}
            hint="por capítulo · repetíveis"
            icon={<ClipboardCheck className="h-3 w-3" />}
          />
          <StatTile
            label="Módulos"
            value={tracks.length}
            hint={
              specializations.length > 0
                ? `comum + ${specializations.length} especializaç${specializations.length === 1 ? "ão" : "ões"}`
                : "só o comum"
            }
            icon={<BookOpen className="h-3 w-3" />}
          />
          {missing > 0 ? (
            <StatTile
              label="Brevemente"
              value={missing}
              hint="aulas por publicar"
              tone="warn"
              icon={<Clock className="h-3 w-3" />}
            />
          ) : (
            <StatTile
              label="Tempo restante"
              value={
                minutesLeft >= 60
                  ? `${Math.floor(minutesLeft / 60)}h${minutesLeft % 60 ? ` ${minutesLeft % 60}m` : ""}`
                  : `${minutesLeft} min`
              }
              icon={<Clock className="h-3 w-3" />}
            />
          )}
          {/* Quando é o próximo exame — e, se já passou os 90 dias, o selo
              de efetivo em verde. */}
          <NextExamCard journey={exams} />
        </div>
      )}

      {/* ===== 4 · Exames de fase ===== */}
      <ExamRail journey={exams} />

      {/* ===== 5 · O percurso ===== */}
      {tracks.length === 0 ? (
        <div className="animate-fade-up mt-10 rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-10 text-center text-sm text-white/45">
          Ainda não tens nenhum módulo atribuído. Fala com o Andre, o Alex ou a
          Alice.
        </div>
      ) : (
        <>
          <SectionRule
            icon={<Route className="h-3 w-3" />}
            title="O teu percurso"
            hint={`${tracks.length} módulo${tracks.length === 1 ? "" : "s"} · ${totalLessons} aulas`}
          />

          {/* A Categoria Comum ocupa a linha inteira. Não é uma decisão de
              grelha — é a hierarquia: é o módulo que toda a gente faz, o que
              tranca os outros, e o único que diz o que a casa é. Metade de uma
              linha, ao lado de uma especialização, dizia o contrário. */}
          {commonTrack && (
            <div className="mt-5">
              <TrackCard state={commonTrack} wide />
            </div>
          )}

          {otherTracks.length > 0 && (
            <section className="animate-fade-up mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {otherTracks.map((t) => (
                <TrackCard key={t.track.slug} state={t} />
              ))}
            </section>
          )}
        </>
      )}

      {common && !common.completed && specializations.length > 0 && (
        <p className="animate-fade-up mt-5 inline-flex items-center gap-2 text-[12px] text-white/50">
          <Lock className="h-3.5 w-3.5" />
          {specializations.length === 1
            ? `A tua especialização (${specializations[0].track.name}) desbloqueia`
            : `As tuas especializações (${specializations.map((s) => s.track.name).join(", ")}) desbloqueiam`}{" "}
          quando o {common.track.name} estiver 100% concluído — vídeos vistos e
          quizzes passados.
        </p>
      )}

      {/* ===== 6 · Rever ===== */}
      {library.length > 0 && (
        <>
          <SectionRule
            icon={<Library className="h-3 w-3" />}
            title="Rever"
            hint="o índice de tudo o que já foi dado"
          />
          <div className="animate-fade-up mt-5">
            <ReviewLibrary entries={library} />
          </div>
        </>
      )}
    </PageShell>
  );
}

/** Separador de secção — a régua que diz onde acaba uma zona e começa outra.
 *  Sem isto, a página é uma coluna de cartões todos com o mesmo peso. */
function SectionRule({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="animate-fade-up mt-10 flex flex-wrap items-center gap-3">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">
        {icon}
        {title}
      </span>
      {hint && (
        <span className="tabular text-[11px] font-medium text-white/35">
          {hint}
        </span>
      )}
      <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
    </div>
  );
}

function TrackCard({
  state,
  /** A Categoria Comum ocupa a linha toda e ganha a fita de aulas em tamanho
   *  grande — é o módulo que mais gente lê e o que mais vezes se consulta. */
  wide = false,
}: {
  state: TrackState;
  wide?: boolean;
}) {
  const locked = state.lockedReason !== null;
  const href = `/formacao/${state.track.slug}`;
  const modulesDone = state.modules.filter(
    (m) => m.status === "completed" && m.hasContent,
  ).length;
  const activeModule = state.modules.find((m) => m.status === "in_progress");

  return (
    <div
      className={`brand-gradient-border relative flex flex-col overflow-hidden rounded-2xl bg-white/[0.045] p-6 backdrop-blur-md transition-all duration-300 ${
        locked ? "opacity-70" : "hover:bg-white/[0.07]"
      }`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full opacity-25 blur-3xl"
        style={{ background: "var(--brand-gradient)" }}
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className={`font-semibold tracking-tight text-white ${
                wide ? "text-[1.6rem] sm:text-[1.9rem]" : "text-xl"
              }`}
            >
              {state.track.name}
            </h2>
            {state.track.isCommon && (
              <BrightPill tone="indigo">Obrigatório</BrightPill>
            )}
            {state.completed && state.hasContent && (
              <BrightPill
                tone="green"
                icon={<CheckCircle2 className="h-2.5 w-2.5" />}
              >
                {state.missingVideos === 0 ? "Concluído" : "Em dia"}
              </BrightPill>
            )}
            {!state.hasContent && (
              <BrightPill tone="amber" icon={<Clock className="h-2.5 w-2.5" />}>
                Em preparação
              </BrightPill>
            )}
          </div>
          <p
            className={`mt-2 text-[12.5px] leading-relaxed text-white/55 ${
              wide ? "max-w-3xl" : "line-clamp-2"
            }`}
          >
            {state.track.description}
          </p>
        </div>
        <span
          className={`tabular shrink-0 font-bold text-white/90 ${
            wide ? "text-4xl" : "text-2xl"
          }`}
        >
          {state.percent}%
        </span>
      </div>

      {/* Fita de aulas — uma marca por aula, agrupadas por capítulo. É a única
          coisa nesta página que responde a "quantas aulas faltam" com um
          número que se conta com o dedo. */}
      <div className="relative mt-6">
        <LessonRibbon
          modules={state.modules}
          size={wide ? "md" : "sm"}
          withLabels={wide}
        />
        <div className="mt-3">
          <LessonRibbonLegend
            watched={state.watchedLessons}
            total={state.allLessons}
            comingSoon={state.missingVideos}
          />
        </div>
        <p className="tabular mt-1.5 text-[11.5px] text-white/40">
          {modulesDone}/{state.modules.length} capítulos concluídos
          {activeModule && !locked && ` · agora: ${activeModule.module.title}`}
        </p>
      </div>

      {locked ? (
        <p className="relative mt-5 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-white/55">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          {state.lockedReason}
        </p>
      ) : (
        // Um único destino: a sequência do módulo. O atalho para retomar a
        // aula exata vive no cartão "Agora", no topo — ter aqui dois links
        // para sítios diferentes só obrigava a escolher.
        <div className="relative mt-5 flex flex-wrap items-center gap-3">
          <Link
            href={href}
            className="brand-gradient-bg group inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_30px_-12px_rgba(120,61,245,0.7)] transition hover:brightness-110"
          >
            Estudar módulo
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          {state.minutesLeft > 0 && (
            <span className="tabular text-[11.5px] text-white/40">
              ~
              {state.minutesLeft >= 60
                ? `${Math.floor(state.minutesLeft / 60)}h${state.minutesLeft % 60 ? ` ${state.minutesLeft % 60}m` : ""}`
                : `${state.minutesLeft} min`}{" "}
              por ver
            </span>
          )}
        </div>
      )}
    </div>
  );
}
