// Motor das notificações — server-only. Junta regras + calendário + carteira
// do consultor + estado de "concluída" e devolve a lista pronta para o sino.
//
// A carteira SEO é re-resolvida a partir do slug (`resolveConsultant`) e não
// do campo `consultant` que vem em cache: `getSeoClients()` está dentro de um
// `unstable_cache` de 1h, e uma passagem de cliente entre consultores ficaria
// a apontar à pessoa errada durante uma hora. O campo em cache entra apenas
// como rede para os clientes vindos do onboarding, que ainda não existem em
// client-overrides.ts. O mesmo cuidado que a board do SEO já tem.

import "server-only";
import { unstable_cache } from "next/cache";
import { getSeoClients } from "@/lib/notion";
import {
  adminRecordKey,
  getAdminRecords,
  DEFAULT_STARTING_DATES,
} from "@/lib/admin-clients-store";
import { resolveConsultant } from "@/lib/client-overrides";
import { getPausedSlugSet } from "@/lib/admin-paused-clients-store";
import { getNpsRecord } from "@/lib/nps-store";
import {
  currentWeekIndex,
  getCurrentRoadmap,
  roadmapWeeks,
} from "@/lib/roadmap-store";
import { EMPLOYEE_CREDENTIALS, isAdminUsername } from "@/lib/auth/credentials";
import { listTrainingFeedback } from "@/lib/training/feedback-store";
import { getNotificationRules } from "@/lib/notifications/rules-store";
import {
  getNotificationState,
  getNotificationStateMany,
  type NotificationState,
} from "@/lib/notifications/state-store";
import {
  audienceMatches,
  clientMonthOccurrences,
  notificationId,
  occurrencesFor,
  resolveHref,
  type NotificationOccurrence,
  type NotificationRule,
} from "@/lib/notifications/rules";

export type UserNotification = {
  id: string;
  ruleId: string;
  title: string;
  body: string;
  /** Rótulo do período a que diz respeito ("julho de 2026"). */
  periodLabel: string;
  /** Quando passou a estar em aberto. */
  dueAt: number;
  /** Cliente, quando a notificação é por cliente. */
  client: { slug: string; title: string; icon: string | null } | null;
  actionLabel: string;
  /** Já com o slug substituído. Vazio = notificação sem botão. */
  actionHref: string;
  resolved: boolean;
  resolvedAt: number | null;
};

type Viewer = { username: string; name: string; dept: string };

type ClientRef = {
  slug: string;
  title: string;
  icon: string | null;
  /** Início do acompanhamento (ISO yyyy-mm-dd) — o relógio das regras
   *  `client-month`. null quando ninguém o preencheu ainda. */
  startedAt: string | null;
};

/** Toda a carteira SEO indexada por consultor, numa leitura só. Clientes em
 *  pausa saem — pedir o relatório de uma conta suspensa é ruído, não é
 *  lembrete. O consultor é RE-RESOLVIDO a partir do slug e nunca do campo
 *  em cache (ver o cabeçalho do ficheiro). */
async function seoBooksByConsultant(
  withStartDates: boolean,
): Promise<Map<string, ClientRef[]>> {
  const out = new Map<string, ClientRef[]>();
  let all: Awaited<ReturnType<typeof getSeoClients>>;
  try {
    all = await getSeoClients();
  } catch (err) {
    console.error("Notificações: getSeoClients falhou:", err);
    return out;
  }
  let paused = new Set<string>();
  try {
    paused = await getPausedSlugSet();
  } catch {
    /* KV em baixo — mais vale a lista completa do que lista nenhuma */
  }
  // Só se paga o preço das datas de início quando há uma regra a precisar
  // delas. O sino corre em TODAS as páginas; uma leitura por cliente por
  // render seria a coisa mais cara da app a servir uma regra opcional.
  const startDates = withStartDates ? await getSeoStartDates() : {};
  for (const c of all) {
    if (paused.has(c.slug)) continue;
    const consultant = resolveConsultant(c.slug, c.consultant);
    if (!consultant) continue;
    const list = out.get(consultant) ?? [];
    list.push({
      slug: c.slug,
      title: c.title,
      icon: c.icon,
      startedAt: startDates[c.slug] ?? null,
    });
    out.set(consultant, list);
  }
  return out;
}

/** Data de início de cada cliente SEO, por slug.
 *
 *  Vem do registo do SuperAdmin (que já cai para `DEFAULT_STARTING_DATES`
 *  quando ninguém lhe mexeu), atrás de uma cache de 30 minutos: é uma leitura
 *  por cliente e a data de arranque de um contrato muda uma vez na vida.
 *  Bumpar a chave da cache ao mudar a forma do valor. */
const getSeoStartDates = unstable_cache(
  async (): Promise<Record<string, string | null>> => {
    const out: Record<string, string | null> = {};
    let all: Awaited<ReturnType<typeof getSeoClients>>;
    try {
      all = await getSeoClients();
    } catch {
      return out;
    }
    const rows = all.map((c) => ({
      slug: c.slug,
      departments: ["SEO" as const],
    }));
    try {
      const records = await getAdminRecords(rows);
      for (const c of all) {
        out[c.slug] =
          records[adminRecordKey(c.slug, "SEO")]?.startingDate ??
          DEFAULT_STARTING_DATES[c.slug] ??
          null;
      }
    } catch {
      // KV em baixo — os defaults em código ainda dão uma janela certa para
      // a maioria dos clientes.
      for (const c of all) out[c.slug] = DEFAULT_STARTING_DATES[c.slug] ?? null;
    }
    return out;
  },
  ["notifications-seo-start-dates-v1"],
  { revalidate: 1800 },
);

/** O cálculo em si — sem I/O, para poder ser corrido uma vez por pessoa a
 *  partir de leituras já feitas. É esta função que garante que o sino de um
 *  consultor e o painel de equipa do C-Level nunca divergem: é a mesma. */
function buildNotifications(
  viewer: Viewer,
  rules: NotificationRule[],
  state: NotificationState,
  book: ClientRef[],
  now: Date,
): UserNotification[] {
  const applicable = rules.filter(
    (r) => r.enabled && audienceMatches(r.audience, viewer),
  );
  if (applicable.length === 0) return [];

  const out: UserNotification[] = [];
  const push = (
    rule: NotificationRule,
    occ: NotificationOccurrence,
    client: ClientRef | null,
  ) => {
    const id = notificationId(rule.id, occ.periodKey, client?.slug ?? "-");
    const entry = state[id];
    out.push({
      id,
      ruleId: rule.id,
      title: rule.title,
      body: rule.body,
      periodLabel: occ.periodLabel,
      dueAt: occ.dueAt,
      client: client
        ? { slug: client.slug, title: client.title, icon: client.icon }
        : null,
      actionLabel: rule.actionLabel,
      actionHref: resolveHref(rule.actionHref, client?.slug ?? null),
      resolved: Boolean(entry),
      resolvedAt: entry?.resolvedAt ?? null,
    });
  };

  for (const rule of applicable) {
    // Regras ancoradas no contrato do cliente: a janela é diferente para cada
    // cliente, por isso é o cliente que manda no ciclo e não o calendário.
    if (rule.schedule.kind === "client-month") {
      if (rule.scope !== "seo-client") continue; // sem cliente não há relógio
      for (const client of book) {
        for (const occ of clientMonthOccurrences(rule, client.startedAt, now)) {
          push(rule, occ, client);
        }
      }
      continue;
    }
    for (const occ of occurrencesFor(rule, now)) {
      const targets: (ClientRef | null)[] =
        rule.scope === "seo-client" ? book : [null];
      for (const client of targets) push(rule, occ, client);
    }
  }

  // Por resolver primeiro, e dentro disso o mais antigo à cabeça: o relatório
  // do mês passado que ficou por enviar é mais urgente do que o deste mês.
  return out.sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
    if (a.dueAt !== b.dueAt) return a.resolved ? b.dueAt - a.dueAt : a.dueAt - b.dueAt;
    return (a.client?.title ?? "").localeCompare(b.client?.title ?? "", "pt");
  });
}

/** Notificações em aberto (e as recentemente resolvidas) de um utilizador. */
/** Janela de tempo em que uma submissão de feedback continua a aparecer no
 *  sino. Depois disto sai do sino e vive só na página de Formação → Feedback:
 *  o sino é para o que está por tratar, não é um arquivo. */
const FEEDBACK_NOTIFICATION_WINDOW_MS = 60 * 24 * 60 * 60 * 1000; // 60 dias

/** Feedback da Formação → notificações, SÓ para SuperAdmins.
 *
 *  Isto não passa pelo motor de regras de propósito: as regras são um
 *  calendário (todo o mês 2, entre o mês 3 e o 6 do cliente…) e isto é um
 *  ACONTECIMENTO — alguém respondeu, num instante que ninguém agendou. Forçar
 *  um no molde do outro dava uma regra com um `schedule` falso.
 *
 *  Derivam-se do registo em cada leitura, como tudo o resto no sino: nada é
 *  "enviado" na submissão, portanto não há entrega que possa falhar em
 *  silêncio. E o corpo leva as RESPOSTAS, não um "há feedback novo" — quem
 *  abre o sino já fica a saber o que a pessoa disse. */
async function trainingFeedbackNotifications(
  viewer: Viewer,
  state: NotificationState,
  now: Date,
): Promise<UserNotification[]> {
  if (!isAdminUsername(viewer.username)) return [];
  let entries: Awaited<ReturnType<typeof listTrainingFeedback>>;
  try {
    entries = await listTrainingFeedback();
  } catch (err) {
    console.error("Notificações: feedback da Formação falhou:", err);
    return [];
  }
  const floor = now.getTime() - FEEDBACK_NOTIFICATION_WINDOW_MS;
  return entries
    .filter((e) => e.createdAt >= floor)
    .map((e) => {
      const id = `training-feedback:${e.id}`;
      const resolved = state[id];
      const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);
      const free = [
        e.whatWorked && `Funcionou: ${e.whatWorked}`,
        e.whatMissing && `Faltou: ${e.whatMissing}`,
        e.suggestions && `Mudaria: ${e.suggestions}`,
      ]
        .filter(Boolean)
        .join(" · ");
      return {
        id,
        ruleId: "training-feedback",
        title: `${e.name} deu feedback sobre a formação`,
        body:
          `Formador ${stars(e.ratings.instructor)} · Vídeo ${stars(e.ratings.video)} · ` +
          `Processo ${stars(e.ratings.process)} — na aula «${e.lessonTitle}», ` +
          `com ${e.lessonsWatchedAtTime} aulas vistas.` +
          (free ? ` ${free}` : ""),
        periodLabel: e.lessonTitle || "Formação",
        dueAt: e.createdAt,
        client: null,
        actionLabel: "Ler as respostas",
        actionHref: "/formacao/admin/feedback",
        resolved: Boolean(resolved),
        resolvedAt: resolved?.resolvedAt ?? null,
      };
    });
}

/** Estado do horizonte do roadmap de cada cliente SEO, por slug.
 *
 *  Atrás de uma cache de 30 minutos porque o sino corre em TODAS as páginas
 *  e isto é uma leitura de KV por cliente. Um roadmap não muda de semana
 *  entre dois refreshes — meia hora de atraso num aviso que fala de um mês
 *  não custa nada, e sem cache seria a coisa mais cara da app. */
const getRoadmapHorizons = unstable_cache(
  async (): Promise<Record<string, { week: number; totalWeeks: number }>> => {
    const out: Record<string, { week: number; totalWeeks: number }> = {};
    let all: Awaited<ReturnType<typeof getSeoClients>>;
    try {
      all = await getSeoClients();
    } catch {
      return out;
    }
    await Promise.all(
      all.map(async (c) => {
        try {
          const roadmap = await getCurrentRoadmap(c.slug);
          if (!roadmap || roadmap.tasks.length === 0) return;
          out[c.slug] = {
            week: currentWeekIndex(roadmap),
            totalWeeks: roadmapWeeks(roadmap),
          };
        } catch {
          /* um roadmap ilegível não pode calar o sino inteiro */
        }
      }),
    );
    return out;
  },
  ["notifications-roadmap-horizons-v1"],
  { revalidate: 1800 },
);

/** Roadmaps a chegar ao fim — para o consultor que os tem.
 *
 *  NÃO É UMA REGRA DO CALENDÁRIO, e por isso não passa pelo motor de regras:
 *  não há dia do mês em que isto aconteça. É um ESTADO — «este plano está a
 *  acabar» — e depende da data de arranque de cada roadmap, que é diferente
 *  para cada cliente.
 *
 *  Dois graus, porque são dois problemas: um plano no último mês ainda dá
 *  para estender com calma; um plano que já passou do horizonte é trabalho a
 *  decorrer sem plano nenhum, e isso é pior. Um aviso que os tratasse como
 *  iguais fazia o consultor adiar o segundo. */
async function roadmapEndingNotifications(
  viewer: Viewer,
  book: ClientRef[],
  state: NotificationState,
  now: Date,
): Promise<UserNotification[]> {
  if (book.length === 0) return [];
  let horizons: Record<string, { week: number; totalWeeks: number }>;
  try {
    horizons = await getRoadmapHorizons();
  } catch (err) {
    console.error("Notificações: horizontes de roadmap falharam:", err);
    return [];
  }

  const out: UserNotification[] = [];
  for (const client of book) {
    const h = horizons[client.slug];
    if (!h) continue;
    const { week, totalWeeks } = h;
    const past = week > totalWeeks;
    // Último mês = as quatro últimas semanas. O mesmo limiar do banner que
    // já existe dentro do roadmap (`nearingEnd`) — o sino e a página têm de
    // dizer a mesma coisa, senão uma delas está a mentir.
    const lastMonth = week >= totalWeeks - 3 && week <= totalWeeks;
    if (!past && !lastMonth) continue;

    // O período é o par (semana, total): quando o consultor estende o plano,
    // o total muda, o id muda, e o aviso desaparece sozinho — sem ninguém
    // ter de o marcar como resolvido.
    const periodKey = `w${week}-${totalWeeks}`;
    const id = notificationId("seo-roadmap-ending", periodKey, client.slug);
    const entry = state[id];
    const weeksLeft = totalWeeks - week;
    out.push({
      id,
      ruleId: "seo-roadmap-ending",
      title: past
        ? `O roadmap da ${client.title} chegou ao fim`
        : `Último mês do roadmap da ${client.title}`,
      body: past
        ? `A semana ${week} já vai além das ${totalWeeks} planeadas — há trabalho a decorrer sem plano. Estende o roadmap e as semanas novas entram vazias, prontas a planear; o que já lá está fica exatamente como está.`
        : `Estás na semana ${week} de ${totalWeeks}${
            weeksLeft > 0
              ? ` — faltam ${weeksLeft} semana${weeksLeft === 1 ? "" : "s"}`
              : ""
          }. Se o cliente continua (ou já aceitou renovar), acrescenta o próximo trimestre: as semanas novas entram vazias e as atuais não se mexem.`,
      periodLabel: `semana ${week} de ${totalWeeks}`,
      dueAt: now.getTime(),
      client: { slug: client.slug, title: client.title, icon: client.icon },
      actionLabel: "Abrir roadmap e estender",
      actionHref: `/seo/${client.slug}/roadmap`,
      resolved: Boolean(entry),
      resolvedAt: entry?.resolvedAt ?? null,
    });
  }
  return out;
}

/** Quem marca as Situation Point Calls. É o fundador, e é só ele: a call é
 *  dele com o cliente, e mandar o aviso a mais gente transformava um lembrete
 *  pessoal em ruído para quem não a pode marcar. */
const SITUATION_POINT_OWNER = "andre";

/** A partir de quantas SEMANAS de roadmap o cliente entra na lista. Quatro
 *  meses completos: com `WEEKS_PER_MONTH = 4`, o mês 4 acaba na semana 16, e
 *  na 17 o cliente tem quatro meses feitos. */
const SITUATION_POINT_WEEK = 17;

/** Clientes SEO com quatro meses de roadmap cumpridos.
 *
 *  Cache de 30 minutos pela mesma razão dos horizontes: isto corre no sino,
 *  que está em todas as páginas, e uma conta que muda uma vez por semana não
 *  justifica uma leitura de KV por cliente a cada render. */
const getSituationPointCandidates = unstable_cache(
  async (): Promise<
    { slug: string; title: string; icon: string | null; week: number }[]
  > => {
    let all: Awaited<ReturnType<typeof getSeoClients>>;
    try {
      all = await getSeoClients();
    } catch {
      return [];
    }
    let paused = new Set<string>();
    try {
      paused = await getPausedSlugSet();
    } catch {
      /* sem KV, mais vale a lista completa do que lista nenhuma */
    }
    const out: {
      slug: string;
      title: string;
      icon: string | null;
      week: number;
    }[] = [];
    await Promise.all(
      all.map(async (c) => {
        // Uma conta suspensa não precisa de ponto de situação — está parada
        // por decisão comercial já tomada.
        if (paused.has(c.slug)) return;
        try {
          const roadmap = await getCurrentRoadmap(c.slug);
          if (!roadmap || roadmap.tasks.length === 0) return;
          const week = currentWeekIndex(roadmap);
          if (week < SITUATION_POINT_WEEK) return;
          out.push({ slug: c.slug, title: c.title, icon: c.icon, week });
        } catch {
          /* um roadmap ilegível não pode calar o sino inteiro */
        }
      }),
    );
    return out.sort((a, b) => b.week - a.week);
  },
  ["notifications-situation-point-v1"],
  { revalidate: 1800 },
);

/** «Agendar Situation Point Call» — um lembrete por cliente que chega aos
 *  quatro meses de roadmap.
 *
 *  É UM MARCO, NÃO UM CICLO. Por isso o id não leva a semana: leva `m4` e o
 *  slug, e mais nada. Assim que o fundador marcar a call e der a coisa por
 *  resolvida, o lembrete desaparece PARA SEMPRE naquele cliente — não volta
 *  na semana seguinte só porque o roadmap avançou mais uma. Um marco que se
 *  repetisse todas as semanas ensinava-se a ignorar em duas. */
async function situationPointNotifications(
  viewer: Viewer,
  state: NotificationState,
  now: Date,
): Promise<UserNotification[]> {
  if (viewer.username !== SITUATION_POINT_OWNER) return [];
  let candidates: Awaited<ReturnType<typeof getSituationPointCandidates>>;
  try {
    candidates = await getSituationPointCandidates();
  } catch (err) {
    console.error("Notificações: situation point falhou:", err);
    return [];
  }
  return candidates.map((c) => {
    const id = notificationId("seo-situation-point", "m4", c.slug);
    const entry = state[id];
    return {
      id,
      ruleId: "seo-situation-point",
      title: `Agendar Situation Point Call com ${c.title}`,
      body: `Já leva 4 meses de roadmap — vai na semana ${c.week}. É o momento de sentar com o cliente e fazer o ponto de situação da parceria: o que já produziu, o que muda daqui para a frente, e se o plano seguinte continua a ser o certo.`,
      periodLabel: "4 meses de roadmap",
      dueAt: now.getTime(),
      client: { slug: c.slug, title: c.title, icon: c.icon },
      actionLabel: "Abrir ficha do cliente",
      actionHref: `/seo/${c.slug}`,
      resolved: Boolean(entry),
      resolvedAt: entry?.resolvedAt ?? null,
    };
  });
}

/** Janela em que uma resposta de NPS continua a aparecer no sino. Depois
 *  disto vive só na página de NPS do cliente — o sino é para o que está por
 *  tratar, não é arquivo. */
const NPS_NOTIFICATION_WINDOW_MS = 60 * 24 * 60 * 60 * 1000; // 60 dias

/** Respostas de NPS recentes de toda a carteira SEO.
 *
 *  Cache de 15 minutos: é uma leitura de KV por cliente e o sino corre em
 *  todas as páginas. Quinze e não trinta porque um NPS de um detrator é a
 *  coisa mais urgente que aparece aqui — meia hora de atraso a saber que um
 *  cliente está insatisfeito é meia hora a mais. */
const getRecentNpsSubmissions = unstable_cache(
  async (): Promise<
    {
      slug: string;
      title: string;
      icon: string | null;
      id: string;
      submittedAt: number;
      nps: number;
      overall: number;
      category: string;
      consultant: string | null;
      /** Quem tem a conta AGORA — pode não ser quem a tinha na resposta. */
      currentConsultant: string;
      identification: string | null;
    }[]
  > => {
    let all: Awaited<ReturnType<typeof getSeoClients>>;
    try {
      all = await getSeoClients();
    } catch {
      return [];
    }
    const floor = Date.now() - NPS_NOTIFICATION_WINDOW_MS;
    const out: Awaited<ReturnType<typeof getRecentNpsSubmissions>> = [];
    await Promise.all(
      all.map(async (c) => {
        try {
          const rec = await getNpsRecord(c.slug);
          for (const s of rec.submissions) {
            if (s.submittedAt < floor) continue;
            out.push({
              slug: c.slug,
              title: c.title,
              icon: c.icon,
              id: s.id,
              submittedAt: s.submittedAt,
              nps: s.scores.nps,
              overall: s.scores.overall,
              category: s.scores.category,
              consultant: s.consultant,
              currentConsultant: resolveConsultant(c.slug, c.consultant),
              identification: s.identification,
            });
          }
        } catch {
          /* um registo ilegível não pode calar o sino inteiro */
        }
      }),
    );
    return out.sort((a, b) => b.submittedAt - a.submittedAt);
  },
  ["notifications-recent-nps-v1"],
  { revalidate: 900 },
);

/** «Um cliente respondeu ao NPS» — para o COO.
 *
 *  Vai para quem é dono da relação com o cliente ao nível da casa, não para
 *  o consultor: o consultor já sabe que pediu o inquérito, e a resposta é
 *  precisamente a leitura que ELE não consegue fazer sobre si próprio.
 *
 *  O CORPO LEVA A NOTA. Um NPS de 9 e um de 4 pedem coisas opostas — um é
 *  para agradecer e pedir referência, o outro é para ligar hoje. Um aviso
 *  que dissesse só «há uma resposta nova» obrigava a abrir a página para
 *  saber qual dos dois é, e a urgência perdia-se pelo caminho. */
async function npsNotifications(
  viewer: Viewer,
  state: NotificationState,
  now: Date,
): Promise<UserNotification[]> {
  // DOIS DESTINATÁRIOS, DOIS MOTIVOS. O COO vê TODAS as respostas, porque a
  // leitura dele é transversal — a saúde da carteira inteira. O consultor vê
  // só as dos SEUS clientes, porque a dele é a conta: é ele que liga, que
  // corrige e que conhece o contexto do que o cliente escreveu.
  //
  // O dono resolve-se pelo consultor ATUAL da conta, não pelo que estava lá
  // no dia da resposta: quem tem de agir hoje é quem a tem hoje. Numa conta
  // que mudou de mãos, o aviso segue o cliente e não o histórico.
  const isCoo = viewer.username === SITUATION_POINT_OWNER;
  const isConsultant = viewer.dept === "SEO";
  if (!isCoo && !isConsultant) return [];
  let subs: Awaited<ReturnType<typeof getRecentNpsSubmissions>>;
  try {
    subs = await getRecentNpsSubmissions();
  } catch (err) {
    console.error("Notificações: NPS falhou:", err);
    return [];
  }
  const mine = isCoo
    ? subs
    : subs.filter((s) => s.currentConsultant === viewer.name);

  return mine.map((s) => {
    const id = notificationId("seo-nps-submitted", s.id, s.slug);
    const entry = state[id];
    const detractor = s.nps <= 6;
    const promoter = s.nps >= 9;
    const label = detractor
      ? "DETRATOR"
      : promoter
        ? "promotor"
        : "neutro";
    return {
      id,
      ruleId: "seo-nps-submitted",
      title: detractor
        ? `⚠️ NPS ${s.nps}/10 da ${s.title} — resposta de detrator`
        : `A ${s.title} respondeu ao NPS — ${s.nps}/10`,
      body:
        `Continuidade ${s.nps}/10 (${label}) · média geral ${s.overall.toFixed(1)}/10` +
        // Dizer «conta do Manuel» ao próprio Manuel é ruído; ao COO é a
        // informação que lhe diz com quem falar.
        (isCoo && s.currentConsultant !== "Unassigned"
          ? ` · conta do ${s.currentConsultant}`
          : "") +
        (s.identification ? ` · respondeu ${s.identification}` : "") +
        (detractor
          ? isCoo
            ? ". Vale uma chamada esta semana, antes de a renovação chegar."
            : ". Liga-lhe esta semana — uma resposta destas não se resolve por email."
          : promoter
            ? ". Bom momento para pedir uma referência ou uma review."
            : "."),
      // O painel agrupa por (regra, período). Com um rótulo constante, a
      // resposta de um detrator e a de um promotor caíam no mesmo grupo — e
      // o cabeçalho de um passava a descrever o outro. O rótulo leva o
      // cliente e a data, por isso cada resposta é o seu próprio bloco.
      periodLabel: `${s.title} · ${new Date(s.submittedAt).toLocaleDateString("en-GB")}`,
      dueAt: s.submittedAt,
      client: { slug: s.slug, title: s.title, icon: s.icon },
      actionLabel: "Ler as respostas",
      actionHref: `/seo/${s.slug}/nps`,
      resolved: Boolean(entry),
      resolvedAt: entry?.resolvedAt ?? null,
    };
  });
}

export async function getUserNotifications(
  viewer: Viewer,
  now: Date = new Date(),
): Promise<UserNotification[]> {
  const [rules, state] = await Promise.all([
    getNotificationRules(),
    getNotificationState(viewer.username),
  ]);

  // O feedback da Formação corre mesmo quando não há regra nenhuma aplicável
  // — não depende delas.
  const feedback = await trainingFeedbackNotifications(viewer, state, now);

  const applicable = rules.filter(
    (r) => r.enabled && audienceMatches(r.audience, viewer),
  );

  // A carteira lê-se quando alguma regra precisa dela OU para o aviso de
  // roadmap a acabar, que é por cliente e não depende de regra nenhuma.
  const needsBook = applicable.some((r) => r.scope === "seo-client");
  const needsStartDates = applicable.some(
    (r) => r.schedule.kind === "client-month",
  );
  const book =
    needsBook || viewer.dept === "SEO"
      ? ((await seoBooksByConsultant(needsStartDates)).get(viewer.name) ?? [])
      : [];

  const [ending, situationPoints, nps] = await Promise.all([
    roadmapEndingNotifications(viewer, book, state, now),
    situationPointNotifications(viewer, state, now),
    npsNotifications(viewer, state, now),
  ]);

  if (applicable.length === 0) {
    return [...nps, ...situationPoints, ...feedback, ...ending];
  }

  return [
    ...nps,
    ...situationPoints,
    ...feedback,
    ...ending,
    ...buildNotifications(viewer, rules, state, book, now),
  ];
}

// ---------------------------------------------------------------------------
// Painel de equipa — só para quem tem `isAdmin`
// ---------------------------------------------------------------------------

/** Quantas linhas em aberto de cada pessoa se mandam para o cliente. O painel
 *  é para SABER QUEM ESTÁ EM DÍVIDA, não para o C-Level despachar o trabalho
 *  dos outros — sem teto, um consultor com 30 clientes enchia o payload do
 *  header de toda a gente. */
const TEAM_ITEMS_PER_PERSON = 8;

export type TeamNotificationRow = {
  username: string;
  name: string;
  role: string;
  dept: string;
  pending: number;
  resolved: number;
  /** Quando é que a coisa mais antiga em aberto passou a estar em aberto. */
  oldestDueAt: number | null;
  /** Agrupado por lembrete + período, como no painel do próprio. */
  groups: { key: string; title: string; periodLabel: string; count: number }[];
  /** Amostra das linhas em aberto (ver TEAM_ITEMS_PER_PERSON). */
  items: { id: string; label: string; periodLabel: string; icon: string | null }[];
  /** Verdadeiro quando há mais do que os que vão em `items`. */
  truncated: number;
};

export type TeamNotificationSummary = {
  rows: TeamNotificationRow[];
  totalPending: number;
  peopleWithPending: number;
};

/** Fotografia das notificações de TODA a equipa — o que o Superadmin vê no
 *  seu painel lateral, por baixo das dele.
 *
 *  Uma leitura de regras, uma da carteira SEO inteira e UM `mget` para os
 *  estados de toda a gente. O custo é praticamente o mesmo de calcular só as
 *  do próprio. */
export async function getTeamNotificationSummary(
  now: Date = new Date(),
): Promise<TeamNotificationSummary> {
  const people = EMPLOYEE_CREDENTIALS.map((c) => ({
    username: c.username,
    name: c.name,
    role: c.role,
    dept: c.dept,
  }));

  const rules = await getNotificationRules();
  const enabled = rules.filter((r) => r.enabled);
  if (enabled.length === 0) {
    return { rows: [], totalPending: 0, peopleWithPending: 0 };
  }

  const needsBook = enabled.some((r) => r.scope === "seo-client");
  const needsStartDates = enabled.some(
    (r) => r.schedule.kind === "client-month",
  );
  const [states, books] = await Promise.all([
    getNotificationStateMany(people.map((p) => p.username)),
    needsBook
      ? seoBooksByConsultant(needsStartDates)
      : Promise.resolve(new Map<string, ClientRef[]>()),
  ]);

  const rows: TeamNotificationRow[] = [];
  for (const person of people) {
    const list = buildNotifications(
      person,
      rules,
      states[person.username] ?? {},
      books.get(person.name) ?? [],
      now,
    );
    if (list.length === 0) continue;

    const pending = list.filter((n) => !n.resolved);
    const groups = new Map<
      string,
      { key: string; title: string; periodLabel: string; count: number }
    >();
    for (const n of pending) {
      const key = `${n.ruleId}|${n.periodLabel}`;
      const g = groups.get(key);
      if (g) g.count += 1;
      else
        groups.set(key, {
          key,
          title: n.title,
          periodLabel: n.periodLabel,
          count: 1,
        });
    }

    rows.push({
      ...person,
      pending: pending.length,
      resolved: list.length - pending.length,
      oldestDueAt: pending.length
        ? Math.min(...pending.map((n) => n.dueAt))
        : null,
      groups: Array.from(groups.values()),
      items: pending.slice(0, TEAM_ITEMS_PER_PERSON).map((n) => ({
        id: n.id,
        label: n.client ? n.client.title : n.title,
        periodLabel: n.periodLabel,
        icon: n.client?.icon ?? null,
      })),
      truncated: Math.max(0, pending.length - TEAM_ITEMS_PER_PERSON),
    });
  }

  // Quem tem mais por resolver à cabeça; entre iguais, o atraso mais antigo.
  rows.sort(
    (a, b) =>
      b.pending - a.pending ||
      (a.oldestDueAt ?? Infinity) - (b.oldestDueAt ?? Infinity) ||
      a.name.localeCompare(b.name, "pt"),
  );

  return {
    rows,
    totalPending: rows.reduce((s, r) => s + r.pending, 0),
    peopleWithPending: rows.filter((r) => r.pending > 0).length,
  };
}

/** True quando este id é mesmo uma notificação em vigor para este utilizador.
 *  Sem esta verificação, um POST forjado escrevia chaves arbitrárias no
 *  estado de qualquer pessoa. */
export async function notificationExistsForUser(
  viewer: Viewer,
  id: string,
  now: Date = new Date(),
): Promise<boolean> {
  const list = await getUserNotifications(viewer, now);
  return list.some((n) => n.id === id);
}

/** Só para o painel do Superadmin: quantas pessoas uma regra abrange. */
export function ruleAudienceLabel(rule: NotificationRule): string {
  switch (rule.audience.kind) {
    case "all":
      return "Toda a equipa";
    case "dept":
      return rule.audience.dept === "All"
        ? "Toda a equipa"
        : `Departamento ${rule.audience.dept}`;
    case "users":
      return rule.audience.usernames.length === 0
        ? "Ninguém (lista vazia)"
        : rule.audience.usernames.join(", ");
  }
}
