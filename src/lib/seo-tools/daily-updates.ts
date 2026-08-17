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
//   11/08                              ← data solta, fecha o cliente anterior
//
//   White Clinic:                      ← nome de cliente (linha acabada em :)
//   • A tratar da questão do DNS       ← bullet (•, -, *, –, ou "1.")
//
//   Adomingos                          ← nome SEM dois pontos também conta,
//   • Postei 2 novos posts no gmb        desde que bata com a carteira
//
//   Safe Away & Clinica em Casa        ← um cabeçalho pode nomear vários
//   • Reunião com o Hugo                 clientes — o trabalho vai para todos
//
// Ninguém escreve o daily update para a máquina — escreve-o no telemóvel, no
// fim do dia, e metade dos nomes vem sem os dois pontos (v76.74). A linha sem
// dois pontos só é aceite como cliente quando bate com a carteira, para uma
// frase curta nunca virar cliente por engano.
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

/** Como é que o nome escrito no daily update foi parar a este cliente.
 *  `fuzzy` é o único que envolveu adivinhar — a UI avisa nesse caso. */
export type MatchVia = "exact" | "slug" | "compact" | "prefix" | "fuzzy" | null;

export type ParsedClientWork = {
  /** Nome tal como escrito no daily update ("Kings Gym"). */
  rawName: string;
  /** Todas as grafias com que este cliente apareceu na semana. */
  rawNames: string[];
  /** Slug resolvido contra a carteira SEO, ou null se não bater com ninguém. */
  slug: string | null;
  /** Título oficial do cliente quando resolvido. */
  title: string;
  /** Como se lá chegou — ver MatchVia. */
  via: MatchVia;
  /** Uma entrada por tarefa, com o dia em que apareceu. */
  items: { day: string; text: string }[];
};

/** Cabeçalhos de daily update — nunca são nomes de cliente. */
const HEADER_RE =
  /^(daily\s*update|update\s*di[áa]rio|resumo\s*do\s*dia|daily)\b/i;

const BULLET_RE = /^\s*(?:[•·▪◦*\-–—]|\d+[.)])\s+/;

/** Uma linha que é só uma data («11/08», «📅 11/08», «17-08-2026»). Nos
 *  pastes de vários dias estas linhas separam os dias — fecham o cliente
 *  anterior, senão o primeiro bullet do dia seguinte colava-se ao último
 *  cliente do dia anterior. */
const DATE_LINE_RE =
  /^[^\p{L}\d]*\d{1,2}[/\-.]\d{1,2}([/\-.]\d{2,4})?[^\p{L}\d]*$/u;

/** Separadores de um cabeçalho com vários clientes («Safe Away & Clinica em
 *  Casa», «X, Y e Z»). Só se aceita a leitura múltipla quando TODAS as partes
 *  batem com a carteira — senão «Reunião com Elizabeth e Theodore» virava
 *  dois clientes. */
const MULTI_SPLIT_RE = /\s*[&+;,]\s*|\s+e\s+|\s+and\s+/i;

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

/** Como `fold`, mas também sem espaços. É isto que faz «A. Domingos»,
 *  «a.domingos» e «Adomingos» serem a mesma coisa: a diferença entre elas é
 *  só pontuação e espaços, que não são informação nenhuma sobre QUEM é o
 *  cliente. */
function foldCompact(s: string): string {
  return fold(s).replace(/ /g, "");
}

/** Distância de edição com teto: pára assim que passa de `max`.
 *
 *  Serve para o caso do consultor que escreve «admingos» em vez de
 *  «adomingos» — uma letra a menos, à pressa, no meio de um daily update. */
function editDistanceWithin(a: string, b: string, max: number): number | null {
  if (Math.abs(a.length - b.length) > max) return null;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    // Nenhuma célula desta linha está dentro do teto → o resultado final
    // também não vai estar. Sai já.
    if (rowMin > max) return null;
    prev = cur;
  }
  const d = prev[b.length];
  return d <= max ? d : null;
}

/** Quantos erros se toleram num nome deste tamanho. Um nome curto não tem
 *  folga nenhuma: em «Ana» vs «Ema» a distância é 1 e são pessoas
 *  diferentes. */
function tolerance(len: number): number {
  if (len <= 5) return 0;
  if (len <= 9) return 1;
  if (len <= 15) return 2;
  return 3;
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
 *  O daily update é escrito à pressa, no fim do dia, no telemóvel. O mesmo
 *  cliente aparece como «A. Domingos» à segunda, «Adomingos» à terça e
 *  «admingos» à quarta — e é o mesmo cliente. Uma app que só percebe a
 *  primeira grafia obriga o consultor a escrever bonito para a máquina, e
 *  parte a semana em três clientes que não existem.
 *
 *  Cinco tentativas, da mais estrita para a mais lassa:
 *    1. igualdade (sem acentos nem pontuação)
 *    2. slug igual
 *    3. igualdade COMPACTA — sem espaços: apanha «a.domingos» = «A Domingos»
 *    4. prefixo — apanha «Kings Gym» → «Kings Gyms»
 *    5. aproximada — até N erros de escrita, N conforme o tamanho do nome
 *
 *  REGRA QUE NÃO SE QUEBRA: qualquer passo só conta quando aponta para UM
 *  cliente. Dois candidatos empatados = não se sabe qual é, e fica por
 *  resolver. Uma mensagem no WhatsApp do cliente errado, com o trabalho de
 *  outro cliente lá dentro, é pior do que um cartão amarelo a pedir
 *  confirmação. */
export function resolveClientName(
  rawName: string,
  roster: { slug: string; title: string }[],
): { slug: string | null; title: string; via: MatchVia } {
  const target = fold(rawName);
  if (!target) return { slug: null, title: rawName, via: null };

  const exact = roster.find((c) => fold(c.title) === target);
  if (exact) return { slug: exact.slug, title: exact.title, via: "exact" };

  const bySlug = roster.find((c) => c.slug === slugify(rawName));
  if (bySlug) return { slug: bySlug.slug, title: bySlug.title, via: "slug" };

  const compactTarget = foldCompact(rawName);
  const compact = roster.filter((c) => foldCompact(c.title) === compactTarget);
  if (compact.length === 1) {
    return { slug: compact[0].slug, title: compact[0].title, via: "compact" };
  }

  const prefix = roster.filter((c) => {
    const t = fold(c.title);
    return t.startsWith(target) || target.startsWith(t);
  });
  if (prefix.length === 1) {
    return { slug: prefix[0].slug, title: prefix[0].title, via: "prefix" };
  }

  // Aproximado, sobre as formas compactas. Guarda-se o melhor E o segundo
  // melhor: se estiverem à mesma distância, há empate e não se escolhe.
  const max = tolerance(compactTarget.length);
  if (max > 0) {
    let best: { slug: string; title: string; d: number } | null = null;
    let runnerUp = Infinity;
    for (const c of roster) {
      const d = editDistanceWithin(compactTarget, foldCompact(c.title), max);
      if (d === null) continue;
      if (!best || d < best.d) {
        if (best) runnerUp = best.d;
        best = { slug: c.slug, title: c.title, d };
      } else if (d < runnerUp) {
        runnerUp = d;
      }
    }
    if (best && best.d < runnerUp) {
      return { slug: best.slug, title: best.title, via: "fuzzy" };
    }
  }

  return { slug: null, title: rawName, via: null };
}

type HeaderTarget = {
  rawName: string;
  slug: string | null;
  title: string;
  via: MatchVia;
};

/** Lê um candidato a cabeçalho como VÁRIOS clientes («Safe Away & Clinica em
 *  Casa»). Só devolve algo quando há pelo menos duas partes e todas resolvem
 *  contra a carteira, para slugs distintos. */
function resolveMulti(
  candidate: string,
  roster: { slug: string; title: string }[],
): HeaderTarget[] | null {
  const parts = candidate
    .split(MULTI_SPLIT_RE)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const out: HeaderTarget[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const r = resolveClientName(part, roster);
    if (!r.slug || seen.has(r.slug)) return null;
    seen.add(r.slug);
    out.push({ rawName: part, ...r });
  }
  return out;
}

/** Uma linha SEM dois pontos só é cabeçalho de cliente quando bate com a
 *  carteira. É a regra que deixa o formato real («Adomingos» numa linha, os
 *  bullets por baixo) funcionar sem que uma frase curta de trabalho vire
 *  cliente por engano: a frase não bate com carteira nenhuma. */
function colonlessHeader(
  line: string,
  roster: { slug: string; title: string }[],
): HeaderTarget[] | null {
  if (line.length > 48) return null;
  if (line.includes(":")) return null;
  if (/[.!?…]$/.test(line)) return null;

  const multi = resolveMulti(line, roster);
  if (multi) return multi;

  const r = resolveClientName(line, roster);
  if (!r.slug || !r.via) return null;
  // «prefix» só vale na direção segura — a linha ser o COMEÇO do título
  // («Kings Gym» → «Kings Gyms»). Na direção contrária, uma frase que começa
  // pelo nome do cliente («Safe Away apareceu 1 vez…») virava cabeçalho e
  // engolia os bullets seguintes.
  if (r.via === "prefix" && !fold(r.title).startsWith(fold(line))) return null;
  return [{ rawName: line, ...r }];
}

/** Todos os clientes que uma linha nomeia, ou null quando a linha não é um
 *  cabeçalho de cliente. Com dois pontos aceita-se qualquer nome (resolvido
 *  ou não — o aviso amarelo trata dos que não batem); sem dois pontos só se
 *  aceita o que bate com a carteira. */
function headerTargets(
  line: string,
  roster: { slug: string; title: string }[],
): HeaderTarget[] | null {
  const name = clientNameFrom(line);
  if (name) {
    return (
      resolveMulti(name, roster) ?? [
        { rawName: name, ...resolveClientName(name, roster) },
      ]
    );
  }
  if (BULLET_RE.test(line) || HEADER_RE.test(line)) return null;
  return colonlessHeader(line, roster);
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
    let current: HeaderTarget[] | null = null;

    for (const rawLine of block.text.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;

      if (HEADER_RE.test(line) || DATE_LINE_RE.test(line)) {
        // Um cabeçalho de dia (ou uma data solta) fecha o cliente anterior —
        // o que vem a seguir pertence a outro dia, não ao último cliente do
        // dia anterior.
        current = null;
        continue;
      }

      const targets = headerTargets(line, roster);
      if (targets) {
        current = targets;
        continue;
      }
      if (!current) continue;

      const text = line.replace(BULLET_RE, "").trim();
      if (!text) continue;

      for (const target of current) {
        // Chave do grupo: o slug quando resolveu. Quando não resolveu, a
        // forma COMPACTA do nome cru — assim «Xpto Lda» e «Xpto Lda.»
        // continuam a ser um cliente só, mesmo sem estarem na carteira.
        const key = target.slug ?? `raw:${foldCompact(target.rawName)}`;
        const entry = byKey.get(key) ?? {
          rawName: target.rawName,
          rawNames: [],
          slug: target.slug,
          title: target.title,
          via: target.via,
          items: [],
        };
        // Guardam-se todas as grafias da semana: é isso que a UI mostra
        // quando diz «lido como», e é a prova de que a app juntou o que
        // devia juntar.
        if (!entry.rawNames.includes(target.rawName))
          entry.rawNames.push(target.rawName);
        entry.items.push({ day: block.label, text });
        byKey.set(key, entry);
      }
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
