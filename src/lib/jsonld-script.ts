// Wrap bare JSON-LD in the <script type="application/ld+json"> … </script>
// tag before a result is shown or exported.
//
// Why (v76.66): the Schema Markup action shipped the structured data as a
// plain ```json fenced block. Consultants copy exactly what they see, so the
// markup landed on client sites as naked JSON — no <script> wrapper — and
// Google silently ignored it. The prompt now asks for the tag, but a prompt
// is a request, not a guarantee, and every result generated before this
// change is still sitting in KV without it. This helper is the deterministic
// safety net: it rewrites JSON-LD code blocks at render/export time, so old
// and new results both come out paste-ready.
//
// Idempotent — a block that already carries a <script> tag is left alone.
// Pure string logic, no DOM: safe to import from client and server.

const OPEN_FENCE = /^([ \t]*)(`{3,}|~{3,})[ \t]*([A-Za-z0-9_+-]*)[ \t]*$/;

/** Languages we consider "this fence holds raw structured data". An empty
 *  info string counts too — the model sometimes omits it. */
const JSON_LANGS = new Set(["", "json", "jsonld", "json-ld", "ld+json"]);

function looksLikeJsonLd(lang: string, body: string): boolean {
  if (!JSON_LANGS.has(lang.toLowerCase())) return false;
  const text = body.trim();
  if (!text.startsWith("{") && !text.startsWith("[")) return false;
  // Already wrapped (by the model, or by a previous pass) — hands off.
  if (/<script/i.test(text)) return false;
  // "@context" is mandatory in valid JSON-LD, so it alone is enough of a
  // signal — we deliberately do NOT require JSON.parse() to succeed there,
  // because a still-streaming (or slightly malformed) payload should still
  // come out wrapped. Without "@context" we need harder proof.
  if (/"@context"/.test(text)) return true;
  if (!/"@(graph|type)"/.test(text)) return false;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function wrap(indent: string, marker: string, body: string[]): string[] {
  return [
    `${indent}${marker}html`,
    `${indent}<script type="application/ld+json">`,
    ...body,
    `${indent}</script>`,
  ];
}

/** Rewrite every bare JSON-LD fenced block in a markdown document so it
 *  includes the <script type="application/ld+json"> wrapper. Everything
 *  else is returned byte-identical. */
export function wrapJsonLdBlocks(markdown: string): string {
  if (!markdown || !markdown.includes("@")) return markdown;

  const lines = markdown.split("\n");
  const out: string[] = [];
  let sawFence = false;
  let i = 0;

  while (i < lines.length) {
    const open = OPEN_FENCE.exec(lines[i]);
    if (!open) {
      out.push(lines[i]);
      i++;
      continue;
    }

    sawFence = true;
    const [, indent, marker, lang] = open;
    // A closing fence is the same character, at least as long, nothing else
    // on the line.
    const close = new RegExp(`^[ \\t]*${marker[0]}{${marker.length},}[ \\t]*$`);
    const body: string[] = [];
    let j = i + 1;
    while (j < lines.length && !close.test(lines[j])) {
      body.push(lines[j]);
      j++;
    }
    const closed = j < lines.length;

    if (looksLikeJsonLd(lang, body.join("\n"))) {
      out.push(...wrap(indent, marker, body));
    } else {
      out.push(lines[i], ...body);
    }
    if (closed) out.push(lines[j]);
    i = closed ? j + 1 : j;
  }

  const result = out.join("\n");

  // Fallback: the model skipped the fence entirely and the whole document is
  // one raw JSON-LD payload. Fence it AND tag it so it's still copy-paste
  // ready.
  if (!sawFence) {
    const text = result.trim();
    if (
      (text.startsWith("{") || text.startsWith("[")) &&
      /"@context"/.test(text) &&
      !/<script/i.test(text)
    ) {
      return ["```html", '<script type="application/ld+json">', text, "</script>", "```"].join(
        "\n",
      );
    }
  }

  return result;
}
