// Leitura dos DAILY UPDATES do consultor — o texto que ele já escreve todos
// os dias e cola no grupo interno — para o transformar em weekly reports.
//
// PORQUE SE FAZ O PARSE EM CÓDIGO E NÃO COM IA: o formato é previsível e
// escrito pela própria casa («Cliente:» seguido de bullets). Um parser
// determinístico erra sempre da mesma maneira e vê-se no ecrã; um modelo a
// fazer a mesma coisa pode inventar um cliente, fundir dois, ou perder o
// último bullet de um bloco longo — e ninguém dava por isso até a mensagem
// já estar no WhatsApp do cliente. A IA entra só onde é insubstituível:
// reescrever trabalho técnico em português que o cliente perceba.
//
// FORMATO ACEITE (tolerante de propósito — isto é texto colado à pressa):
//
//   Daily update – André 10/08:        ← cabeçalho, ignorado
//
//   White Clinic:                      ← nome de cliente (linha acabada em :)
//   • A tratar da questão do DNS       ← bullet (•, -, *, –, ou "1.")
//
//   Sentir Saúde:
//   - Criada página MBST em inglês
//
// Linhas soltas depois de um cliente e sem marca de bullet contam na mesma
// como trabalho: mais vale apanhar uma linha a mais (que o consultor vê e
// apaga) do que perder trabalho feito.

import { slugify } from "@/lib/notion";

/** Um dia de trabalho tal como veio do daily update. */
export type DailyBlock = {
  /** Rótulo do dia ("Segunda", "Terça"…) — só para dizer de onde veio. */
  label: string;
  text: string;
};

export type ParsedClientWork = {
  /** Nome tal como escrito no daily update ("Kings Gym"). */
  rawName: string;
  /** Slug resolvido contra a carteira SEO, ou null se não bater com ninguém. */
  slug: string | null;
  /** Título oficial do cliente quando resolvido. */
  title: string;
  /** Uma entrada por tarefa, com o dia em que apareceu. */
  items: { day: string; text: string }[];
};

/** Cabeçalhos de daily update — nunca são nomes de cliente. */
const HEADER_RE =
  /^(daily\s*update|update\s*di[áa]rio|resumo\s*do\s*dia|daily)\b/i;

const BULLET_RE = /^\s*(?:[•·▪◦*\-–—]|\d+[.)])\s+/;

/** Sem acentos, sem pontuação, minúsculas — "Kings Gym" e "kings gyms" têm
 *  de poder encontrar-se. */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Uma linha é nome de cliente quando acaba em ":" e não é um cabeçalho nem
 *  um bullet. Limita-se o comprimento porque uma frase inteira acabada em
 *  dois pontos é uma frase, não um cliente. */
function clientNameFrom(line: string): string | null {
  const t = line.trim();
  if (!t.endsWith(":")) return null;
  if (BULLET_RE.test(t)) return null;
  if (HEADER_RE.test(t)) return null;
  const name = t.slice(0, -1).trim();
  if (!name || name.length > 60) return null;
  // "10/08" ou "Segunda" sozinhos não são clientes.
  if (/^\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?$/.test(name)) return null;
  return name;
}

/** Resolve o nome escrito no daily update contra a carteira SEO.
 *
 *  Três tentativas, da mais estrita para a mais lassa: igualdade dobrada,
 *  slug igual, e prefixo (é o que apanha "Kings Gym" → "Kings Gyms" e
 *  "Sentir Saude" → "Sentir Saúde"). Não se inventa correspondência por
 *  semelhança vaga: um cliente errado numa mensagem que vai para o WhatsApp
 *  do cliente certo é pior do que um cliente por resolver. */
export function resolveClientName(
  rawName: string,
  roster: { slug: string; title: string }[],
): { slug: string | null; title: string } {
  const target = fold(rawName);
  if (!target) return { slug: null, title: rawName };

  const exact = roster.find((c) => fold(c.title) === target);
  if (exact) return { slug: exact.slug, title: exact.title };

  const bySlug = roster.find((c) => c.slug === slugify(rawName));
  if (bySlug) return { slug: bySlug.slug, title: bySlug.title };

  const prefix = roster.filter((c) => {
    const t = fold(c.title);
    return t.startsWith(target) || target.startsWith(t);
  });
  // Só se aceita prefixo quando ele identifica UMA pessoa. Dois candidatos
  // significa que não se sabe qual é — e adivinhar aqui é grave.
  if (prefix.length === 1) {
    return { slug: prefix[0].slug, title: prefix[0].title };
  }

  return { slug: null, title: rawName };
}

/** Lê os blocos de daily update e devolve o trabalho agrupado por cliente,
 *  pela ordem em que os clientes aparecem. */
export function parseDailyUpdates(
  blocks: DailyBlock[],
  roster: { slug: string; title: string }[],
): ParsedClientWork[] {
  const byKey = new Map<string, ParsedClientWork>();

  for (const block of blocks) {
    if (!block.text.trim()) continue;
    let current: string | null = null;

    for (const rawLine of block.text.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;

      const name = clientNameFrom(line);
      if (name) {
        current = name;
        continue;
      }
      if (HEADER_RE.test(line)) {
        // Um novo cabeçalho fecha o cliente anterior — o que vem a seguir
        // pertence a outro dia, não ao último cliente do dia anterior.
        current = null;
        continue;
      }
      if (!current) continue;

      const text = line.replace(BULLET_RE, "").trim();
      if (!text) continue;

      const resolved = resolveClientName(current, roster);
      const key = resolved.slug ?? `raw:${fold(current)}`;
      const entry = byKey.get(key) ?? {
        rawName: current,
        slug: resolved.slug,
        title: resolved.title,
        items: [],
      };
      entry.items.push({ day: block.label, text });
      byKey.set(key, entry);
    }
  }

  return Array.from(byKey.values()).filter((c) => c.items.length > 0);
}

/** Os cinco dias úteis, com a data real de cada um na semana a que
 *  pertence `reference`. Segunda a sexta — que é a semana de trabalho a que
 *  o weekly report diz respeito. */
export function weekdayBlocks(reference: Date): { label: string; date: string }[] {
  const names = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
  // getDay(): 0 = domingo. Recua-se até à segunda desta semana; ao domingo
  // considera-se a semana que acabou de terminar, não a que vai começar.
  const day = reference.getDay();
  const backToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(reference);
  monday.setDate(reference.getDate() - backToMonday);
  return names.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return { label, date: `${dd}/${mm}` };
  });
}
