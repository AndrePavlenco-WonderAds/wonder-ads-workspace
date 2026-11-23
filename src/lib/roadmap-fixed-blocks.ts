// Blocos fixos do arranque de um projeto SEO (v80.27).
//
// Fonte: «Arranque de projeto de SEO — Checklist de tarefas fixas ·
// WonderAds», o PDF do André de 23/11/2026. Os títulos são os dele, tal e
// qual. Cada grupo de blocos vive numa semana certa do roadmap:
//
//   • Antes da reunião ........ «Week 0» — antes da reunião de onboarding /
//                                sessão de estratégia n.º 1 (a semana 1
//                                começa com essa reunião).
//   • Primeira semana ......... arranque, tracking e conformidade básica,
//                                na semana 1.
//   • Mês 3 ................... reporte trimestral, na última semana do
//                                mês 3 (semana 12).
//   • Mês 5 e 2 semanas ....... renovação: mês 5, passadas 2 semanas →
//                                semana 19 de um plano de 6 meses. Noutro
//                                comprimento fica à mesma distância do fim
//                                (penúltimo mês, 3.ª semana).
//
// Um bloco fixo está «preso»: não se apaga, não muda de semana e o título
// não se edita. Só o estado (feito / em curso…) e as notas mudam. Isto é
// garantido no quadro E no servidor (`lockFixedTasks` no PUT), por isso um
// separador antigo ou um pedido feito à mão não os consegue tirar do sítio.
//
// Só entram em roadmaps NOVOS — o primeiro de um cliente (sem roadmap, ou
// com o quadro vazio e sem arquivo). Os roadmaps que já existiam ficam como
// estavam. Numa regeneração, quem já os tinha volta a tê-los, com o estado
// de cada um preservado.
//
// Módulo puro (sem KV): o quadro, a pré-visualização do cliente e o
// servidor usam todos as mesmas regras.

import type {
  Roadmap,
  RoadmapPillar,
  RoadmapTask,
} from "./roadmap-store";

export const FIXED_GROUP_IDS = [
  "antes",
  "arranque",
  "tracking",
  "conformidade",
  "trimestral",
  "renovacao",
] as const;
export type FixedGroupId = (typeof FIXED_GROUP_IDS)[number];

/** Marca gravada na tarefa. `key` é estável — é por ela que a regeneração
 *  reconhece o bloco e lhe guarda o estado. */
export type FixedMark = { group: FixedGroupId; key: string };

/** Aula da Formação ligada a um grupo de blocos. */
export const CONFORMIDADE_LESSON_ID = "seo-conformidade-inicial";
export const CONFORMIDADE_LESSON_HREF = `/formacao/seo-geo/aula/${CONFORMIDADE_LESSON_ID}`;

export type FixedGroup = {
  id: FixedGroupId;
  /** Como aparece no quadro (curto — a coluna já diz a semana). */
  label: string;
  /** O título da secção no PDF do André. */
  docLabel: string;
  pillar: RoadmapPillar;
  /** Trabalho interno da equipa: não aparece ao cliente (pré-visualização
   *  do roadmap nem weekly report). */
  internal: boolean;
  lesson?: { href: string; label: string };
};

export const FIXED_GROUPS: Record<FixedGroupId, FixedGroup> = {
  antes: {
    id: "antes",
    label: "Antes da reunião de onboarding",
    docLabel: "Antes da reunião",
    pillar: "research",
    internal: true,
  },
  arranque: {
    id: "arranque",
    label: "Arranque",
    docLabel: "Primeira semana: arranque",
    pillar: "technical",
    internal: false,
  },
  tracking: {
    id: "tracking",
    label: "Tracking",
    docLabel: "Primeira semana: tracking",
    pillar: "technical",
    internal: false,
  },
  conformidade: {
    id: "conformidade",
    label: "Conformidade básica",
    docLabel: "Primeira semana: conformidade básica",
    pillar: "technical",
    internal: false,
    lesson: {
      href: CONFORMIDADE_LESSON_HREF,
      label: "Conformidade inicial de um site",
    },
  },
  trimestral: {
    id: "trimestral",
    label: "Reporte trimestral",
    docLabel: "Mês 3",
    pillar: "research",
    internal: false,
  },
  renovacao: {
    id: "renovacao",
    label: "Renovação",
    docLabel: "Mês 5 e 2 semanas: renovação",
    pillar: "research",
    internal: true,
  },
};

type FixedTemplate = {
  group: FixedGroupId;
  key: string;
  /** Título — função quando depende do comprimento do plano. */
  title: string | ((months: number) => string);
};

const TEMPLATES: FixedTemplate[] = [
  // Antes da reunião
  { group: "antes", key: "dos-donts", title: "Preparar Do's/Don'ts/Notes" },
  { group: "antes", key: "site-audit", title: "Fazer o Site Audit" },
  { group: "antes", key: "keyword-research", title: "Fazer a Keyword Research" },
  { group: "antes", key: "roadmap-client", title: "Preparar o Roadmap Client" },
  { group: "antes", key: "acesso-site", title: "Pedir acesso ao site" },
  { group: "antes", key: "acesso-gmb", title: "Pedir acesso ao GMB" },
  { group: "antes", key: "acesso-ga4", title: "Pedir acesso ao GA4" },
  { group: "antes", key: "acesso-gsc", title: "Pedir acesso ao GSC" },
  { group: "antes", key: "acesso-gtm", title: "Pedir acesso ao GTM" },
  { group: "antes", key: "fotos", title: "Pedir fotos e materiais" },
  { group: "antes", key: "registar-acessos", title: "Registar os acessos na app" },
  { group: "antes", key: "searchable", title: "Configurar os prompts no Searchable" },
  // Primeira semana: arranque
  {
    group: "arranque",
    key: "ponto-partida",
    title: "Guardar o ponto de partida: GSC, GA4, Semrush e Searchable",
  },
  { group: "arranque", key: "backup", title: "Fazer uma cópia de segurança do site" },
  { group: "arranque", key: "wonderflow", title: "Instalar o Wonderflow (plano 0)" },
  // Primeira semana: tracking
  { group: "tracking", key: "ga4-gsc", title: "Ligar o GA4 ao GSC" },
  { group: "tracking", key: "ga4-retencao", title: "Pôr a retenção de dados do GA4 em 14 meses" },
  { group: "tracking", key: "ga4-trafego-interno", title: "Excluir o tráfego interno no GA4" },
  { group: "tracking", key: "gtm-formulario", title: 'Criar o evento "formulário enviado" no GTM' },
  { group: "tracking", key: "gtm-ligar", title: 'Criar o evento "clique para ligar" no GTM' },
  { group: "tracking", key: "gtm-email", title: 'Criar o evento "clique no email" no GTM' },
  { group: "tracking", key: "gtm-whatsapp", title: 'Criar o evento "clique no WhatsApp" no GTM' },
  { group: "tracking", key: "gmb-utm", title: "Pôr UTM no link do site na ficha GMB" },
  { group: "tracking", key: "testar-eventos", title: "Testar todos os eventos" },
  // Primeira semana: conformidade básica
  {
    group: "conformidade",
    key: "banner-cookies",
    title: 'Rever o banner de cookies ("rejeitar" tão visível como "aceitar")',
  },
  {
    group: "conformidade",
    key: "consentimento",
    title: "Confirmar que análise e publicidade só arrancam depois do consentimento",
  },
  { group: "conformidade", key: "consent-mode", title: "Ativar o Consent Mode v2" },
  {
    group: "conformidade",
    key: "custo-chamada",
    title: "Pôr o custo da chamada junto a cada telefone do site",
  },
  // Mês 3
  {
    group: "trimestral",
    key: "reporte",
    title: "Reporte trimestral: resultados trimestrais, evolução nas IAs e números gerais",
  },
  // Mês 5 e 2 semanas: renovação
  {
    group: "renovacao",
    key: "documento",
    title: (m) =>
      `Preparar o documento de 7 pontos dos últimos ${m} meses: resumo executivo, keywords e Authority Score, GA/GSC, AI Visibility (Searchable), GMB, próximos passos e sources`,
  },
  {
    group: "renovacao",
    key: "proposta",
    title: "Preparar a proposta de roadmap para os próximos 6 meses",
  },
  {
    group: "renovacao",
    key: "reuniao",
    title: (m) =>
      `Fazer a reunião de renovação com o documento, a proposta de roadmap e as abas de analytics abertas. A conversa é sobre como correram os ${m} meses e o que propomos para os próximos 6.`,
  },
];

/** Títulos em inglês dos blocos que o CLIENTE vê (pré-visualização do
 *  roadmap e weekly report), para os clientes EN (IHN, Kings Gym…). Os
 *  grupos internos (antes da reunião, renovação) nunca lhe aparecem. A
 *  equipa trabalha sempre com os títulos em português. */
const TITLES_EN: Record<string, string> = {
  "ponto-partida": "Save the starting point: GSC, GA4, Semrush and Searchable",
  "backup": "Make a backup of the website",
  "wonderflow": "Install Wonderflow (plan 0)",
  "ga4-gsc": "Link GA4 to GSC",
  "ga4-retencao": "Set GA4 data retention to 14 months",
  "ga4-trafego-interno": "Exclude internal traffic in GA4",
  "gtm-formulario": 'Create the "form submitted" event in GTM',
  "gtm-ligar": 'Create the "click to call" event in GTM',
  "gtm-email": 'Create the "email click" event in GTM',
  "gtm-whatsapp": 'Create the "WhatsApp click" event in GTM',
  "gmb-utm": "Add UTM tags to the website link on the GMB profile",
  "testar-eventos": "Test all events",
  "banner-cookies": 'Review the cookie banner ("reject" as visible as "accept")',
  "consentimento": "Confirm analytics and advertising only start after consent",
  "consent-mode": "Enable Consent Mode v2",
  "custo-chamada": "Add the call cost next to every phone number on the website",
  "reporte": "Quarterly report: quarterly results, AI visibility progress and overall numbers",
};

/** Título de uma tarefa na língua do cliente: os blocos fixos visíveis
 *  saem em inglês para clientes EN; o resto fica como está escrito. */
export function clientTaskTitle(
  t: Pick<RoadmapTask, "title" | "fixed">,
  lang: "pt" | "en",
): string {
  if (lang === "en" && t.fixed) return TITLES_EN[t.fixed.key] ?? t.title;
  return t.title;
}

/** Semana onde vive um grupo num plano de `months` meses (0 = antes da
 *  reunião de onboarding). Quatro semanas por mês: o mês k tem as semanas
 *  4(k−1)+1 … 4k. */
export function fixedGroupWeek(group: FixedGroupId, months: number): number {
  switch (group) {
    case "antes":
      return 0;
    case "arranque":
    case "tracking":
    case "conformidade":
      return 1;
    case "trimestral":
      // Mês 3 — fecha o trimestre: a última semana do mês 3.
      return 12;
    case "renovacao":
      // «Mês 5 e 2 semanas» num plano de 6 meses = semana 19. Em geral:
      // penúltimo mês, 3.ª semana (para 3 meses → semana 7).
      return Math.max(1, (Math.max(3, months) - 2) * 4 + 3);
  }
}

export function fixedTaskId(group: FixedGroupId, key: string): string {
  return `fx-${group}-${key}`;
}

export function isFixedTask(t: Pick<RoadmapTask, "fixed">): boolean {
  return Boolean(t.fixed);
}

export function fixedGroupOf(t: Pick<RoadmapTask, "fixed">): FixedGroup | null {
  return t.fixed ? FIXED_GROUPS[t.fixed.group] ?? null : null;
}

/** Bloco interno (antes da reunião, renovação) — fora do que o cliente vê. */
export function isInternalFixedTask(t: Pick<RoadmapTask, "fixed">): boolean {
  return Boolean(fixedGroupOf(t)?.internal);
}

/** As tarefas que a equipa planeou (tudo menos os blocos fixos). */
export function plannedTasks<T extends Pick<RoadmapTask, "fixed">>(tasks: T[]): T[] {
  return tasks.filter((t) => !t.fixed);
}

/** Valida a marca vinda de fora (KV ou PUT). Inválida → undefined. */
export function parseFixedMark(raw: unknown): FixedMark | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as { group?: unknown; key?: unknown };
  if (
    typeof o.group === "string" &&
    (FIXED_GROUP_IDS as readonly string[]).includes(o.group) &&
    typeof o.key === "string" &&
    o.key.length > 0 &&
    o.key.length <= 60
  ) {
    return { group: o.group as FixedGroupId, key: o.key };
  }
  return undefined;
}

/** Os blocos fixos de um plano de `months` meses. `carry` = tarefas do
 *  roadmap anterior: um bloco que já lá estava guarda o estado, as notas e
 *  as datas (por `group` + `key`). */
export function buildFixedTasks(
  months: number,
  now: number,
  carry: RoadmapTask[] = [],
): RoadmapTask[] {
  const previous = new Map<string, RoadmapTask>();
  for (const t of carry) {
    if (t.fixed) previous.set(fixedTaskId(t.fixed.group, t.fixed.key), t);
  }
  return TEMPLATES.map((tpl, i) => {
    const id = fixedTaskId(tpl.group, tpl.key);
    const before = previous.get(id);
    return {
      id,
      week: fixedGroupWeek(tpl.group, months),
      title: typeof tpl.title === "function" ? tpl.title(months) : tpl.title,
      description: before?.description,
      status: before?.status ?? "not_started",
      pillar: FIXED_GROUPS[tpl.group].pillar,
      // Ordem do PDF; o quadro desenha os blocos fixos por cima do resto.
      order: -1000 + i,
      statusChangedAt: before?.statusChangedAt ?? now,
      createdAt: before?.createdAt ?? now,
      fixed: { group: tpl.group, key: tpl.key },
    };
  });
}

/** Menor número de meses que ainda segura todos os blocos fixos — o
 *  «Remove months» não pode cortar abaixo disto. */
export function minMonthsForFixed(tasks: Pick<RoadmapTask, "fixed" | "week">[]): number {
  let maxWeek = 0;
  for (const t of tasks) if (t.fixed && t.week > maxWeek) maxWeek = t.week;
  return Math.ceil(maxWeek / 4);
}

/** Guarda do servidor (PUT): os blocos fixos do roadmap gravado ficam onde
 *  estão, com o mesmo título — o pedido só lhes pode mudar o estado e as
 *  notas. Um bloco que falte volta a entrar; uma tarefa que não era fixa
 *  não passa a ser; o plano não encolhe para fora de um bloco fixo. */
export function lockFixedTasks(prev: Roadmap | null, next: Roadmap): Roadmap {
  const locked = new Map<string, RoadmapTask>();
  for (const t of prev?.tasks ?? []) if (t.fixed) locked.set(t.id, t);

  const seen = new Set<string>();
  const tasks: RoadmapTask[] = [];
  for (const t of next.tasks) {
    const original = locked.get(t.id);
    if (!original) {
      // Não era fixa → não pode passar a ser, nem viver na semana 0.
      if (t.fixed || t.week < 1) {
        tasks.push({ ...t, fixed: undefined, week: Math.max(1, t.week) });
      } else {
        tasks.push(t);
      }
      continue;
    }
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    tasks.push({
      ...original,
      status: t.status,
      statusChangedAt: t.statusChangedAt,
      description: t.description,
    });
  }
  for (const [id, original] of locked) {
    if (!seen.has(id)) tasks.push(original);
  }

  const floor = minMonthsForFixed(tasks);
  const months = typeof next.months === "number" ? next.months : 3;
  if (floor > months) {
    return { ...next, months: floor, weeks: floor * 4, tasks };
  }
  return { ...next, tasks };
}
