// Parse Claude's keyword-research markdown output into structured clusters.
//
// SEO Claude is instructed to emit each cluster as:
//
//   ### <Cluster name> — <one-line cluster thesis>
//   **Intent:** Commercial · **Difficulty range:** 18–42 · **Combined volume/mo:** 12.4k · **Pages it would feed:** 2
//
//   | Keyword | Vol/mo | KD | Intent | Priority | Suggested page | Why |
//   |---|---:|---:|---|---|---|---|
//   | dentista lisboa | 1.2k | 32 | Commercial | 🟢 Quick win | / | … |
//   | ... |
//
// We parse those H3 headings + their following table into a typed shape so
// the dashboard can render them as first-class rows alongside the raw
// DataforSEO data.

export type KwClusterPriority =
  | "quick-win"
  | "strategic"
  | "long-bet"
  | "watch"
  | null;

export type KwClusterRow = {
  keyword: string;
  /** Vol/mo as text (e.g. "1.2k", "260", "—"). Source-of-truth from the
   *  table. */
  volumeText: string;
  /** Parsed number when possible. Null when the cell is "—". */
  volume: number | null;
  difficultyText: string;
  difficulty: number | null;
  intent: string | null;
  priority: KwClusterPriority;
  priorityRaw: string;
  suggestedPage: string;
  why: string;
};

export type KwCluster = {
  name: string;
  thesis: string;
  meta: {
    intent?: string;
    difficultyRange?: string;
    combinedVolume?: string;
    pagesItWouldFeed?: string;
  };
  rows: KwClusterRow[];
};

const HEADING_RE = /^###\s+(?:Cluster\s+\d+\s*[—–-]\s*)?(.+?)$/i;
const PRIORITY_MAP: { test: RegExp; value: KwClusterPriority }[] = [
  { test: /quick\s*win/i, value: "quick-win" },
  { test: /strategic/i, value: "strategic" },
  { test: /long\s*bet/i, value: "long-bet" },
  { test: /watch/i, value: "watch" },
];

/** Normalise a markdown table cell — strip pipes, leading/trailing
 *  whitespace, **bold**, `code`, and emoji-only padding. */
function tidyCell(s: string): string {
  return s
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .trim()
    .replace(/^`(.*)`$/, "$1")
    .replace(/^\*\*(.*)\*\*$/, "$1")
    .trim();
}

function parseVolume(cell: string): number | null {
  const c = cell.trim().toLowerCase();
  if (!c || c === "—" || c === "-" || c === "n/a") return null;
  const num = c.replace(/[,$]/g, "");
  // "1.2k" → 1200, "12.4k" → 12400, "1m" → 1000000
  const kMatch = num.match(/^([\d.]+)\s*k$/);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);
  const mMatch = num.match(/^([\d.]+)\s*m$/);
  if (mMatch) return Math.round(parseFloat(mMatch[1]) * 1_000_000);
  const plain = parseFloat(num);
  return Number.isFinite(plain) ? plain : null;
}

function parseDifficulty(cell: string): number | null {
  const c = cell.trim();
  if (!c || c === "—" || c === "-" || c === "n/a") return null;
  // Could be "32" or "32%" or "Easy" or a range like "18–42" (we take
  // first number).
  const m = c.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function parsePriority(cell: string): {
  value: KwClusterPriority;
  raw: string;
} {
  for (const { test, value } of PRIORITY_MAP) {
    if (test.test(cell)) return { value, raw: cell };
  }
  return { value: null, raw: cell };
}

/** Split a markdown table line by `|`, dropping the empty leading/trailing
 *  cells the pipes produce. */
function splitRow(line: string): string[] {
  return line
    .split("|")
    .map((c) => c.trim())
    .filter((_, i, arr) => !(i === 0 && _ === "") && !(i === arr.length - 1 && _ === ""));
}

function isTableDelimiter(line: string): boolean {
  return /^\s*\|?\s*[:\- ]+\s*(\|\s*[:\- ]+\s*)*\|?\s*$/.test(line);
}

function isTableHeader(line: string, expectedCols: number): boolean {
  if (!line.includes("|")) return false;
  const cells = splitRow(line);
  return cells.length >= expectedCols;
}

/** Parse one cluster body — the lines between the `###` heading and the
 *  next H2/H3 (or end of doc). Returns the meta line + the rows of the
 *  first markdown table found. */
function parseClusterBody(body: string): {
  meta: KwCluster["meta"];
  rows: KwClusterRow[];
} {
  const lines = body.split("\n");
  const meta: KwCluster["meta"] = {};

  // Meta line: look for "**Intent:** ... · **Difficulty range:** ..." etc.
  for (const line of lines.slice(0, 5)) {
    const intentM = line.match(/\*\*Intent:\*\*\s*([^·\n]+)/i);
    if (intentM) meta.intent = intentM[1].trim();
    const diffM = line.match(/\*\*Difficulty range:\*\*\s*([^·\n]+)/i);
    if (diffM) meta.difficultyRange = diffM[1].trim();
    const volM = line.match(/\*\*Combined volume\/mo:\*\*\s*([^·\n]+)/i);
    if (volM) meta.combinedVolume = volM[1].trim();
    const pageM = line.match(/\*\*Pages it would feed:\*\*\s*([^\n]+)/i);
    if (pageM) meta.pagesItWouldFeed = pageM[1].trim();
  }

  // Find a markdown table — header row, then delimiter, then data rows.
  const rows: KwClusterRow[] = [];
  let headerIdx = -1;
  let dataStart = -1;
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    if (!line.includes("|")) continue;
    if (!isTableHeader(line, 4)) continue;
    const next = lines[i + 1] ?? "";
    if (isTableDelimiter(next)) {
      headerIdx = i;
      dataStart = i + 2;
      break;
    }
  }
  if (headerIdx < 0) return { meta, rows };

  const header = splitRow(lines[headerIdx]).map((c) => c.toLowerCase());
  const colIdx = (...names: string[]): number => {
    for (const n of names) {
      const idx = header.findIndex((h) => h.includes(n));
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const kwIdx = colIdx("keyword");
  const volIdx = colIdx("vol/mo", "volume", "vol");
  const kdIdx = colIdx("kd", "difficulty");
  const intentIdx = colIdx("intent");
  const priorityIdx = colIdx("priority");
  const pageIdx = colIdx("suggested page", "page");
  const whyIdx = colIdx("why", "rationale", "reason");

  if (kwIdx < 0) return { meta, rows };

  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (!line.includes("|")) break;
    // Stop at the next heading or quote-block separator.
    if (/^#{1,4}\s/.test(line)) break;
    const cells = splitRow(line);
    if (cells.length < 2) continue;
    const keyword = tidyCell(cells[kwIdx] ?? "");
    if (!keyword) continue;
    const volumeText = volIdx >= 0 ? tidyCell(cells[volIdx] ?? "—") : "—";
    const difficultyText = kdIdx >= 0 ? tidyCell(cells[kdIdx] ?? "—") : "—";
    const intent = intentIdx >= 0 ? tidyCell(cells[intentIdx] ?? "") : "";
    const priorityCell = priorityIdx >= 0 ? tidyCell(cells[priorityIdx] ?? "") : "";
    const { value: priority, raw: priorityRaw } = parsePriority(priorityCell);
    const suggestedPage = pageIdx >= 0 ? tidyCell(cells[pageIdx] ?? "") : "";
    const why = whyIdx >= 0 ? tidyCell(cells[whyIdx] ?? "") : "";
    rows.push({
      keyword,
      volumeText,
      volume: parseVolume(volumeText),
      difficultyText,
      difficulty: parseDifficulty(difficultyText),
      intent: intent || null,
      priority,
      priorityRaw,
      suggestedPage,
      why,
    });
  }

  return { meta, rows };
}

/** Parse a full keyword-research markdown analysis into the clusters
 *  Claude defined. Looks for H3 headings under the "## Cluster map"
 *  section. Returns an empty array when no clusters are found (e.g. the
 *  output was truncated before any cluster was emitted). */
export function parseClustersFromMarkdown(markdown: string): KwCluster[] {
  if (!markdown) return [];
  // Scope to the "## Cluster map" section to avoid grabbing unrelated H3s
  // elsewhere in the report (Strategic bets, Quick wins, etc.).
  const clusterMapStart = markdown.search(/^##\s+Cluster\s*map/im);
  if (clusterMapStart < 0) return [];
  // End at the next H2.
  const after = markdown.slice(clusterMapStart);
  const nextH2 = after.slice(2).search(/^##\s+/m); // search after the current H2
  const section = nextH2 >= 0 ? after.slice(0, nextH2 + 2) : after;

  // Find each H3 heading and its body (until the next H3 or end of section).
  const lines = section.split("\n");
  const clusters: KwCluster[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(HEADING_RE);
    if (m) {
      const rawHeading = m[1].trim();
      // Split "name — thesis" if a dash separator exists.
      const dashIdx = rawHeading.search(/\s+[—–-]\s+/);
      const name = dashIdx >= 0 ? rawHeading.slice(0, dashIdx).trim() : rawHeading;
      const thesis = dashIdx >= 0 ? rawHeading.slice(dashIdx).replace(/^\s+[—–-]\s+/, "").trim() : "";
      // Body extends until the next H3 or end of section.
      let j = i + 1;
      while (j < lines.length && !HEADING_RE.test(lines[j])) j++;
      const body = lines.slice(i + 1, j).join("\n");
      const { meta, rows } = parseClusterBody(body);
      if (rows.length > 0 || name) {
        clusters.push({ name, thesis, meta, rows });
      }
      i = j;
    } else {
      i++;
    }
  }
  return clusters;
}
