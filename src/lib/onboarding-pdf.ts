// Builds the branded "Formulário de Onboarding" PDF from a submitted intake.
// Pure server-side (Node runtime) using pdf-lib — no native binaries / wasm,
// so it runs on Vercel's serverless functions. Embeds the Wonder Ads butterfly
// logo and lays out every question + answer, grouped by section, with a
// DD/MM/YYYY submission date.

import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { formatDate } from "@/lib/dates";
import {
  isCheckbox,
  isFile,
  optionLabel,
  otherTextKey,
  type OnbField,
  type OnbStep,
} from "@/lib/onboarding-questions";
import type { OnboardingIntake } from "@/lib/onboarding-intake-store";

const INK = rgb(0.106, 0.141, 0.188); // #1B2430
const PURPLE = rgb(0.471, 0.239, 0.961); // #783DF5
const GREY = rgb(0.36, 0.36, 0.36);
const GOLD = rgb(0.663, 0.514, 0.31); // #A9834F

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;

// pdf-lib's standard fonts use WinAnsi (CP1252). Keep accented Latin-1
// letters; normalise typographic punctuation; drop anything unencodable
// (emoji, other scripts) so a stray character can never crash generation.
const CP1252_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
function enc(s: string): string {
  return (s ?? "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\t/g, "  ")
    .split("")
    .filter((ch) => {
      const c = ch.codePointAt(0) ?? 0;
      return c === 10 || c <= 255 || CP1252_EXTRA.includes(ch);
    })
    .join("");
}

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const rawLine of enc(text).split("\n")) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const trial = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(trial, size) <= maxW) {
        line = trial;
      } else {
        if (line) out.push(line);
        // A single word longer than the line — hard-break it.
        if (font.widthOfTextAtSize(w, size) > maxW) {
          let chunk = "";
          for (const ch of w) {
            if (font.widthOfTextAtSize(chunk + ch, size) > maxW) {
              out.push(chunk);
              chunk = ch;
            } else chunk += ch;
          }
          line = chunk;
        } else {
          line = w;
        }
      }
    }
    if (line) out.push(line);
  }
  return out;
}

/** Answer for a field, flattened to display lines (or null if unanswered). */
function answerText(
  field: OnbField,
  intake: OnboardingIntake,
  steps: OnbStep[],
): string | null {
  if (isCheckbox(field)) {
    const picked = intake.choices[field.name] ?? [];
    if (picked.length === 0) return null;
    const parts = picked.map((v) => {
      const label = optionLabel(steps, field.name, v);
      const extra = intake.texts[otherTextKey(field.name, v)];
      return extra ? `${label}: ${extra}` : label;
    });
    return parts.map((p) => `• ${p}`).join("\n");
  }
  if (isFile(field)) {
    const uploaded = intake.files[field.name] ?? [];
    if (uploaded.length === 0) return null;
    return uploaded.map((f) => `• ${f.name} (${f.url})`).join("\n");
  }
  const t = (intake.texts[field.name] ?? "").trim();
  return t === "" ? null : t;
}

export async function buildOnboardingPdf(opts: {
  clientTitle: string;
  intake: OnboardingIntake;
  steps: OnbStep[];
}): Promise<Uint8Array> {
  const { clientTitle, intake, steps } = opts;
  const doc = await PDFDocument.create();
  doc.setTitle(`Formulário de Onboarding — ${clientTitle}`);
  doc.setProducer("Wonder Ads Workspace");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let logo: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  try {
    const bytes = await readFile(
      path.join(process.cwd(), "public", "wonder-ads-butterfly.png"),
    );
    logo = await doc.embedPng(bytes);
  } catch {
    logo = null;
  }

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };
  const ensure = (needed: number) => {
    if (y - needed < MARGIN) newPage();
  };

  // ---- Header ----
  if (logo) {
    const h = 34;
    const w = (logo.width / logo.height) * h;
    page.drawImage(logo, { x: MARGIN, y: y - h, width: w, height: h });
    page.drawText("Wonder Ads", {
      x: MARGIN + w + 12,
      y: y - h + 9,
      size: 20,
      font: bold,
      color: INK,
    });
  } else {
    page.drawText("Wonder Ads", { x: MARGIN, y: y - 24, size: 20, font: bold, color: INK });
  }
  y -= 52;

  page.drawText(enc("FORMULÁRIO DE ONBOARDING"), {
    x: MARGIN,
    y,
    size: 10,
    font: bold,
    color: GOLD,
  });
  y -= 22;
  for (const line of wrap(clientTitle, bold, 22, CONTENT_W)) {
    page.drawText(line, { x: MARGIN, y, size: 22, font: bold, color: INK });
    y -= 26;
  }
  y -= 2;
  page.drawText(enc(`Submetido em ${formatDate(intake.submittedAt)}`), {
    x: MARGIN,
    y,
    size: 10,
    font,
    color: GREY,
  });
  y -= 16;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 1,
    color: rgb(0.86, 0.86, 0.86),
  });
  y -= 26;

  // ---- Sections + questions ----
  let lastSection = "";
  for (const step of steps) {
    if (step.section !== lastSection) {
      lastSection = step.section;
      ensure(40);
      page.drawText(enc(`${step.sectionTag} · ${step.section.toUpperCase()}`), {
        x: MARGIN,
        y,
        size: 11,
        font: bold,
        color: PURPLE,
      });
      y -= 18;
    }

    for (const field of step.fields) {
      const answer = answerText(field, intake, steps);
      // Question label
      const qLines = wrap(field.label, bold, 10.5, CONTENT_W);
      ensure(qLines.length * 14 + 18);
      for (const line of qLines) {
        page.drawText(line, { x: MARGIN, y, size: 10.5, font: bold, color: INK });
        y -= 14;
      }
      y -= 2;
      // Answer
      const aLines =
        answer === null
          ? ["(sem resposta)"]
          : wrap(answer, font, 10.5, CONTENT_W);
      for (const line of aLines) {
        ensure(14);
        page.drawText(line, {
          x: MARGIN,
          y,
          size: 10.5,
          font,
          color: answer === null ? rgb(0.6, 0.6, 0.6) : GREY,
        });
        y -= 14;
      }
      y -= 12;
    }
  }

  return doc.save();
}
