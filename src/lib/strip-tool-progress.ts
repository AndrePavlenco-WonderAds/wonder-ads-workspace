// Extract the analysis body from a streamed action output, stripping the
// leading tool-progress blockquote block (and its "\n---\n\n" boundary)
// WITHOUT being fooled by markdown "---" horizontal rules inside the
// analysis itself.
//
// Bug this fixes (v74.31.3): the old logic sliced at the FIRST "\n---\n\n"
// anywhere in the string. Saved analyses — SEO Audit, blog articles, FAQ
// generator, and most other SEO actions — routinely use "---" as section
// rules, so the PDF export, the public preview page, and the DOCX export
// all dropped everything before the first rule (i.e. the whole opening
// section / Overview). The fix: only treat a "\n---\n\n" as the
// tool→analysis boundary when everything BEFORE it is tool-progress
// blockquotes.
//
// Pure string logic — safe to import from both client and server.

const SEPARATOR = "\n---\n\n";

/** True when every line is a tool-progress blockquote ("> …") or blank. */
function isProgressOnly(text: string): boolean {
  return text
    .split("\n")
    .every((l) => l.trim() === "" || l.trimStart().startsWith(">"));
}

/** Strip the leading tool-progress block from a streamed/saved output and
 *  return just the analysis markdown. Returns "" while a live generation
 *  is still emitting only tool-progress (no analysis yet). */
export function extractAnalysis(output: string | null | undefined): string {
  if (!output) return "";
  const idx = output.indexOf(SEPARATOR);
  // Strip a leading progress block ONLY when the text before the first
  // separator is entirely progress blockquotes — that's the genuine
  // tool→analysis boundary the run routes emit. A "---" inside the
  // analysis has real content (a heading, prose) before it, so we leave
  // the whole document intact.
  if (idx >= 0 && isProgressOnly(output.slice(0, idx))) {
    return output.slice(idx + SEPARATOR.length);
  }
  // No real boundary. If the WHOLE thing is still just progress
  // blockquotes we're mid-tools (live generation) → nothing to show yet.
  if (output.trim() !== "" && isProgressOnly(output)) return "";
  return output;
}
