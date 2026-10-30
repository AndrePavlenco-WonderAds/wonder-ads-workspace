// Alterações à Documentação (v78.62) — o que muda numa página chega ao sino
// do SEO DPT, com um botão para a página e a lista do que mudou.
//
// Duas origens, a mesma forma (`DocUpdate`):
//
//   • «app» — a direção edita uma página na própria página (Jornada de
//     Cliente, Protocolos). A API grava e regista a alteração sozinha, com a
//     diferença calculada aqui (`describeProtocolsChange`,
//     `describeJourneyChange`). Edições seguidas da mesma pessoa na mesma
//     página juntam-se num só aviso (ver updates-store.ts);
//   • «codigo» — uma página feita em código (Bónus NPS, Comissões,
//     Ineficácias…) muda numa versão nova da app. Quem mexe no código
//     acrescenta uma entrada a `CODE_DOC_UPDATES` (updates-log.ts) na mesma
//     versão — documento novo, regra nova, acrescento, alteração ou remoção.
//
// O sino deriva os avisos destas listas em cada leitura, como o resto das
// notificações: nada se «envia», por isso nada se perde em silêncio. Quem
// recebe: o SEO DPT (`DOC_UPDATE_DEPTS`) e a direção, mas só quem consegue
// abrir a página — o público do bloco manda (a Matriz de Talento, por
// exemplo, só chega a quem é Treinador).
//
// Módulo puro: sem servidor.

import { readerSees, type BlockAudience, type DocsReader } from "./access";
import { DOCS_BLOCKS, type DocsBlock } from "./blocks";
import { PLACEHOLDER_TITLE, type Journey } from "./jornada";
import type { ProtocolDoc } from "./protocolos";

/** O tipo de alteração — decide a frase do aviso. */
export type DocUpdateKind = "nova" | "regra" | "add-on" | "alterada" | "removida";

export const DOC_UPDATE_KIND_LABEL: Record<DocUpdateKind, string> = {
  nova: "Documento novo",
  regra: "Nova regra",
  "add-on": "Acrescento",
  alterada: "Alteração",
  removida: "Remoção",
};

export type DocUpdate = {
  id: string;
  /** A página (`DocsPage.id`) — dá o título, o link e o público. */
  page: string;
  /** Para uma página que já não existe (removida): o bloco que manda no
   *  público. Sem página nem bloco, vai ao SEO DPT e aponta para o hub. */
  blockId?: string;
  kind: DocUpdateKind;
  /** O que mudou, uma linha por mudança. */
  changes: string[];
  /** Nome de quem mudou («Direção» nas de código). */
  by: string;
  byUsername: string | null;
  source: "app" | "codigo";
  /** Quando apareceu. */
  at: number;
  /** A última edição juntada a este aviso — quem já o tinha lido volta a
   *  vê-lo por ler se mudou depois disso. */
  updatedAt: number;
  /** Âncora dentro da página (sem o #), para o botão ir direto à secção. */
  anchor?: string;
  /** Versão da app (só nas de código). */
  version?: string;
};

/** Quem recebe os avisos no sino, além da direção (pedido do André,
 *  30/10/2026: «toda a equipa de SEO DPT»). Para alargar a outro
 *  departamento, acrescenta-se aqui — o público de cada bloco continua a
 *  mandar. */
export const DOC_UPDATE_DEPTS: string[] = ["SEO"];

/** Quanto tempo um aviso fica no sino. */
export const DOC_UPDATE_WINDOW_MS = 60 * 24 * 60 * 60 * 1000;

/** Quantas linhas do que mudou cabem num aviso — o resto vai num «e mais N». */
export const MAX_CHANGE_LINES = 8;

export type DocUpdateTarget = {
  /** Nome da página («Protocolos Obrigatórios»). */
  label: string;
  href: string;
  audience: BlockAudience;
  block: DocsBlock | null;
};

/** Para onde aponta um aviso e quem o pode ver. */
export function docUpdateTarget(u: Pick<DocUpdate, "page" | "blockId" | "anchor">): DocUpdateTarget {
  for (const block of DOCS_BLOCKS) {
    const page = block.pages.find((p) => p.id === u.page);
    if (page) {
      return { label: page.label, href: u.anchor ? `${page.href}#${u.anchor}` : page.href, audience: block.audience, block };
    }
  }
  const block = u.blockId ? DOCS_BLOCKS.find((b) => b.id === u.blockId) ?? null : null;
  return {
    label: block?.title ?? "Documentação",
    href: "/documentacao",
    audience: block?.audience ?? { depts: ["SEO"] },
    block,
  };
}

/** Este aviso chega a esta pessoa? Direção sempre (se puder ler a página);
 *  o resto, só quem é de `DOC_UPDATE_DEPTS` e lê o bloco. */
export function docUpdateReaches(u: DocUpdate, reader: DocsReader): boolean {
  if (reader.viewerOf) return false;
  if (!reader.isAdmin && !DOC_UPDATE_DEPTS.includes(reader.dept)) return false;
  return readerSees(reader, docUpdateTarget(u).audience);
}

/** As linhas do aviso, com o «e mais N» quando passa do teto. */
export function changeLines(changes: string[]): string[] {
  if (changes.length <= MAX_CHANGE_LINES) return changes;
  const rest = changes.length - (MAX_CHANGE_LINES - 1);
  return [...changes.slice(0, MAX_CHANGE_LINES - 1), `… e mais ${rest} alterações`];
}

// ---------------------------------------------------------------------------
// O que mudou — diferença entre duas versões de uma página editável
// ---------------------------------------------------------------------------

export type ChangeSummary = {
  changes: string[];
  kind: DocUpdateKind;
};

const q = (s: string) => `«${s.trim() || "sem título"}»`;
const NONE: ChangeSummary = { changes: [], kind: "alterada" };

function kindOf(added: number, removed: number, changed: number, addKind: DocUpdateKind): DocUpdateKind {
  if (added > 0 && removed === 0 && changed === 0) return addKind;
  if (removed > 0 && added === 0 && changed === 0) return "removida";
  return "alterada";
}

/** Protocolos: cada item é uma regra. Novo → «Nova regra». */
export function describeProtocolsChange(
  before: Pick<ProtocolDoc, "items">,
  after: Pick<ProtocolDoc, "items">,
): ChangeSummary {
  const old = new Map(before.items.map((p) => [p.id, p]));
  const now = new Map(after.items.map((p) => [p.id, p]));
  const lines: string[] = [];
  let added = 0;
  let removed = 0;
  let changed = 0;
  for (const p of after.items) {
    const prev = old.get(p.id);
    if (!prev) {
      added++;
      lines.push(`Novo: ${q(p.title)}${p.cadence ? ` (${p.cadence})` : ""}`);
      continue;
    }
    const bits: string[] = [];
    if (prev.title.trim() !== p.title.trim()) bits.push(`${q(prev.title)} passou a ${q(p.title)}`);
    if (prev.cadence.trim() !== p.cadence.trim()) {
      bits.push(`frequência ${prev.cadence.trim() || "—"} → ${p.cadence.trim() || "—"}`);
    }
    if (prev.detail.trim() !== p.detail.trim()) bits.push("explicação revista");
    if (bits.length) {
      changed++;
      lines.push(
        prev.title.trim() !== p.title.trim()
          ? `Alterado: ${bits.join(" · ")}`
          : `Alterado: ${q(p.title)} — ${bits.join(" · ")}`,
      );
    }
  }
  for (const p of before.items) {
    if (!now.has(p.id)) {
      removed++;
      lines.push(`Removido: ${q(p.title)}`);
    }
  }
  if (lines.length === 0) {
    const sameOrder = before.items.map((p) => p.id).join("|") === after.items.map((p) => p.id).join("|");
    if (sameOrder) return NONE;
    return { changes: ["Nova ordem da lista"], kind: "alterada" };
  }
  return { changes: lines, kind: kindOf(added, removed, changed, "regra") };
}

function monthName(m: { title: string }, index: number): string {
  return m.title.trim() ? `Mês ${index + 1} · ${m.title.trim()}` : `Mês ${index + 1}`;
}

function blockTitle(b: { title: string; placeholder?: true }): string {
  return b.placeholder || !b.title.trim() ? PLACEHOLDER_TITLE : b.title.trim();
}

/** Jornada de Cliente: meses e tarefas. Uma tarefa nova → «Acrescento». */
export function describeJourneyChange(
  before: Pick<Journey, "months">,
  after: Pick<Journey, "months">,
): ChangeSummary {
  const lines: string[] = [];
  let added = 0;
  let removed = 0;
  let changed = 0;

  // Meses
  const oldMonths = new Map(before.months.map((m, i) => [m.id, { m, i }]));
  const newMonths = new Map(after.months.map((m, i) => [m.id, { m, i }]));
  after.months.forEach((m, i) => {
    const prev = oldMonths.get(m.id);
    if (!prev) {
      added++;
      lines.push(`Mês novo: ${monthName(m, i)}`);
      return;
    }
    if (prev.m.title.trim() !== m.title.trim()) {
      changed++;
      lines.push(
        prev.m.title.trim()
          ? `Mês ${i + 1}: ${q(prev.m.title)} passou a ${q(m.title)}`
          : `Mês ${i + 1} passou a chamar-se ${q(m.title)}`,
      );
    }
    if (prev.m.goal.trim() !== m.goal.trim()) {
      changed++;
      lines.push(`${monthName(m, i)}: objetivo ${!prev.m.goal.trim() ? "definido" : m.goal.trim() ? "revisto" : "retirado"}`);
    }
  });
  before.months.forEach((m, i) => {
    if (!newMonths.has(m.id)) {
      removed++;
      lines.push(`Mês removido: ${monthName(m, i)}`);
    }
  });

  // Tarefas (procuradas em todos os meses — uma tarefa pode mudar de mês)
  type Where = { b: Journey["months"][number]["blocks"][number]; month: number };
  const index = (j: Pick<Journey, "months">) => {
    const map = new Map<string, Where>();
    j.months.forEach((m, mi) => m.blocks.forEach((b) => map.set(b.id, { b, month: mi })));
    return map;
  };
  const oldBlocks = index(before);
  const newBlocks = index(after);
  const reordered = new Set<number>();
  for (const [id, cur] of newBlocks) {
    const prev = oldBlocks.get(id);
    const where = monthName(after.months[cur.month], cur.month);
    if (!prev) {
      if (cur.b.placeholder) continue; // um espaço vazio a mais não é novidade
      added++;
      lines.push(`Tarefa nova em ${where}: ${q(cur.b.title)}`);
      continue;
    }
    const bits: string[] = [];
    if (prev.b.placeholder && !cur.b.placeholder) {
      added++;
      lines.push(`Tarefa definida em ${where}: ${q(cur.b.title)}`);
    } else if (blockTitle(prev.b) !== blockTitle(cur.b)) {
      bits.push(`${q(blockTitle(prev.b))} passou a ${q(blockTitle(cur.b))}`);
    }
    if (prev.b.detail.trim() !== cur.b.detail.trim()) bits.push(`explicação de ${q(blockTitle(cur.b))} revista`);
    if ((prev.b.guide ?? "") !== (cur.b.guide ?? "")) {
      bits.push(cur.b.guide ? `processo ligado a ${q(blockTitle(cur.b))}` : `processo retirado de ${q(blockTitle(cur.b))}`);
    }
    const movedMonth = after.months[cur.month]?.id !== before.months[prev.month]?.id;
    if (movedMonth) bits.push(`${q(blockTitle(cur.b))} passou para ${where}`);
    if (bits.length) {
      changed++;
      lines.push(`Alterado: ${bits.join(" · ")}`);
    }
  }
  for (const [id, prev] of oldBlocks) {
    if (newBlocks.has(id) || prev.b.placeholder) continue;
    removed++;
    lines.push(`Tarefa removida: ${q(prev.b.title)}`);
  }
  // Ordem: só as tarefas que estavam e continuam no mesmo mês, comparadas
  // entre si — um espaço acrescentado não conta como «nova ordem».
  after.months.forEach((m, mi) => {
    const prevMonth = before.months.find((x) => x.id === m.id);
    if (!prevMonth) return;
    const stay = new Set(m.blocks.map((b) => b.id).filter((id) => prevMonth.blocks.some((b) => b.id === id)));
    const was = prevMonth.blocks.map((b) => b.id).filter((id) => stay.has(id));
    const is = m.blocks.map((b) => b.id).filter((id) => stay.has(id));
    if (was.join("|") !== is.join("|")) reordered.add(mi);
  });
  if (lines.length === 0 && reordered.size > 0) {
    return {
      changes: [...reordered].sort((a, b) => a - b).map((m) => `Nova ordem das tarefas em ${monthName(after.months[m], m)}`),
      kind: "alterada",
    };
  }
  if (lines.length === 0) return NONE;
  return { changes: lines, kind: kindOf(added, removed, changed, "add-on") };
}
