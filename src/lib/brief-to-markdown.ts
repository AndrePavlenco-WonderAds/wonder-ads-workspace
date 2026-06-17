// Render a client's Brief (Do's / Don'ts / Notes) as a read-only markdown
// document for the client approval preview — fed into PublicReportView,
// same pattern as the Roadmap + Target Keywords previews.

import type { ClientBrief } from "./client-briefs";

type Lang = "pt" | "en";

const COPY: Record<
  Lang,
  { dos: string; donts: string; notes: string; empty: string }
> = {
  pt: {
    dos: "✅ A Fazer",
    donts: "⛔ A Evitar",
    notes: "📝 Notas",
    empty: "Ainda não há conteúdo no brief.",
  },
  en: {
    dos: "✅ Do's",
    donts: "⛔ Don'ts",
    notes: "📝 Notes",
    empty: "No brief content yet.",
  },
};

export function briefToMarkdown(brief: ClientBrief, lang: Lang = "pt"): string {
  const c = COPY[lang];
  const sections: string[] = [];

  if (brief.dos.length > 0) {
    sections.push(`## ${c.dos}`, "", ...brief.dos.map((d) => `- ${d}`), "");
  }
  if (brief.donts.length > 0) {
    sections.push(`## ${c.donts}`, "", ...brief.donts.map((d) => `- ${d}`), "");
  }
  if (brief.notes.length > 0) {
    sections.push(`## ${c.notes}`, "", ...brief.notes.map((n) => `- ${n}`), "");
  }

  if (sections.length === 0) return c.empty;
  return sections.join("\n").trim();
}
