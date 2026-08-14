// Detect placeholder / unfilled values inside the JSON-LD a consultant is
// about to paste onto a client's site.
//
// Why (v76.72): the model is told never to invent values and to omit
// properties it can't fill, but it sometimes ships a stand-in instead —
// "A PREENCHER", "[NOME DA CLÍNICA]", "+000 000 000", "info@example.com",
// or an empty string. Consultants copy the block straight into the site, so
// a stand-in ends up live: worse than a missing property, because Google
// reads it as a real (wrong) value.
//
// We only scan the JSON-LD payloads — never the surrounding prose, which
// legitimately talks about placeholders in the "Missing — client must
// provide" section.
//
// Pure string logic, no DOM: safe to import from client and server.

import { jsonLdPayloads } from "./jsonld-script";

export type PlaceholderHit = {
  /** JSON property the value belongs to, e.g. "telephone". */
  property: string;
  /** The offending value, verbatim (trimmed to something displayable). */
  value: string;
  /** Short human reason, in PT — rendered as-is in the alert. */
  reason: string;
  /** 0-based line in the original markdown, for ordering. */
  line: number;
};

const PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /\bpreencher\b/i, reason: "campo por preencher" },
  {
    re: /\b(to[\s_-]?fill|fill[\s_-]?in|to[\s_-]?be[\s_-]?(added|provided|defined|confirmed)|tbd|tba)\b/i,
    reason: "campo por preencher",
  },
  // Case-sensitive on purpose: "todo" is a common Portuguese word.
  { re: /\bTODO\b/, reason: "marcado como TODO" },
  { re: /\bplaceholder\b/i, reason: "valor de exemplo" },
  { re: /\blorem ipsum\b/i, reason: "texto de exemplo" },
  {
    re: /\b(example|exemplo|dominio|yourdomain|yoursite)\.(com|org|net|pt)\b/i,
    reason: "domínio de exemplo",
  },
  {
    re: /\b(your|seu|sua|teu|tua)[\s_-]?(name|business|company|phone|address|city|email|url|website|logo|nome|empresa|negocio|telefone|morada|cidade|site)\b/i,
    reason: "texto genérico («o seu nome»)",
  },
  {
    re: /\b(insert|insira|inserir|indique|preenche)\b/i,
    reason: "instrução em vez de valor",
  },
  { re: /x{4,}/i, reason: "valor mascarado (xxxx)" },
  // "[NOME]", "<url>", "{{cidade}}", "__EMAIL__" — the whole value is a token.
  {
    re: /^\s*(\[[^\]]{1,60}\]|<[^>]{1,60}>|\{\{[^}]{1,60}\}\}|_{2}[^_]{1,60}_{2})\s*$/,
    reason: "marcador por substituir",
  },
  { re: /^\s*(n\/a|n\.a\.|nan|null|undefined)\s*$/i, reason: "valor inválido" },
];

/** Quoted-string pairs on a line: `"key": "value"`. */
const PAIR = /"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
/** A bare string element of an array: `"value"` with no colon after it. */
const ITEM = /^\s*"((?:[^"\\]|\\.)*)"\s*,?\s*$/;
/** `"key": ""` / `"key": []` — the model was told to omit these entirely. */
const EMPTY = /"((?:[^"\\]|\\.)*)"\s*:\s*(""|\[\s*\])\s*,?\s*$/;
/** The key a bare array item belongs to: `"sameAs": [`. */
const ARRAY_KEY = /"((?:[^"\\]|\\.)*)"\s*:\s*\[\s*$/;

/** Filler numbers: "+351 000 000 000", "999999999", "+00 123 456 789".
 *  Only applied to values that are ENTIRELY a phone-shaped number, so a
 *  street address or a price never lands here. */
function isFillerNumber(value: string): boolean {
  if (!/^[+\d\s().\-/]{6,}$/.test(value)) return false;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 6) return false;
  const zeros = (digits.match(/0/g) ?? []).length;
  // Deliberately NOT flagging sequential runs ("…12345678"): a real
  // +351 91 234 5678 contains one.
  return zeros >= digits.length - 3 || /^(\d)\1+$/.test(digits);
}

function classify(value: string): string | null {
  for (const { re, reason } of PATTERNS) {
    if (re.test(value)) return reason;
  }
  if (isFillerNumber(value)) return "número de exemplo";
  return null;
}

function truncate(value: string): string {
  return value.length > 70 ? `${value.slice(0, 67)}…` : value;
}

/** Scan a result document and return every placeholder / empty value found
 *  inside its JSON-LD. Empty array = nothing to warn about. */
export function findSchemaPlaceholders(markdown: string): PlaceholderHit[] {
  const hits: PlaceholderHit[] = [];
  const seen = new Set<string>();

  const push = (hit: PlaceholderHit) => {
    const key = `${hit.property}|${hit.value}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push(hit);
  };

  for (const payload of jsonLdPayloads(markdown)) {
    let arrayKey = "";
    payload.lines.forEach((raw, idx) => {
      const line = payload.startLine + idx;

      const arr = ARRAY_KEY.exec(raw);
      if (arr) arrayKey = arr[1];

      const empty = EMPTY.exec(raw);
      if (empty) {
        push({
          property: empty[1],
          value: empty[2] === '""' ? "(vazio)" : "(lista vazia)",
          reason: "sem valor — devia ter sido omitido",
          line,
        });
      }

      let m: RegExpExecArray | null;
      PAIR.lastIndex = 0;
      let sawPair = false;
      while ((m = PAIR.exec(raw)) !== null) {
        sawPair = true;
        const [, property, value] = m;
        if (property.startsWith("@") && property !== "@id") continue;
        const reason = classify(value);
        if (reason) push({ property, value: truncate(value), reason, line });
      }
      if (sawPair) return;

      const item = ITEM.exec(raw);
      if (item) {
        const reason = classify(item[1]);
        if (reason) {
          push({
            property: arrayKey || "valor",
            value: truncate(item[1]),
            reason,
            line,
          });
        }
      }
    });
  }

  return hits.sort((a, b) => a.line - b.line);
}
