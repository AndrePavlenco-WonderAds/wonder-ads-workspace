// O MOLDE do weekly report — a mensagem que vai para o grupo de WhatsApp do
// cliente.
//
// PORQUE É CÓDIGO E NÃO PROMPT (v76.73): o formato desta mensagem é fixo. A
// saudação, as duas linhas com emoji, o fecho — sempre iguais, semana após
// semana, cliente após cliente. Pedir ao modelo que os repita é pedir-lhe
// para acertar em algo que não tem de decidir: mais cedo ou mais tarde
// escreve «Olá!» em vez de «Boa tarde!», troca 📅 por 🗓️, ou acrescenta uma
// linha de simpatia que não estava combinada. E a mensagem sai para um
// cliente que paga, sem ninguém a rever o molde.
//
// Aqui o modelo escreve APENAS os bullets — o trabalho da semana traduzido
// para benefício — e o molde é montado por código. O que é decisão fica com
// o modelo, o que é forma fica com a app.
//
// LÍNGUA: o cliente inglês recebe a mensagem em inglês. A carteira tem
// clínicas portuguesas mas também ginásios em Londres e clínicas no Canadá —
// mandar-lhes «Boa tarde!» é mandar-lhes a mensagem de outro cliente. A
// língua sai do mercado configurado em client-geo.

import { getClientGeo } from "./client-geo";

export type ReportLang = "pt" | "en";

/** O bullet do WhatsApp. Um caractere só, sem espaços invisíveis colados de
 *  mensagens antigas — o que se cola tem de ser limpo. */
const BULLET = "• ";

type Scaffold = {
  greeting: string;
  intro: string;
  doneHeading: string;
  nextHeading: string;
  signoff: string;
  thanks: string;
  /** Bullet neutro quando o roadmap não tem nada para a semana seguinte. */
  nextFallback: string;
  /** Como se diz ao modelo em que língua deve escrever os bullets. */
  promptLanguage: string;
};

const SCAFFOLDS: Record<ReportLang, Scaffold> = {
  pt: {
    greeting: "Boa tarde!",
    intro: "Segue o ponto de situação desta semana (SEO):",
    doneHeading: "✅ O que foi feito esta semana:",
    nextHeading: "📅 Na próxima semana:",
    signoff: "Qualquer dúvida, estamos por aqui!",
    thanks: "Obrigado!",
    nextFallback:
      "Damos continuidade aos trabalhos de SEO previstos para esta fase.",
    promptLanguage: "português de Portugal",
  },
  en: {
    greeting: "Good afternoon!",
    intro: "Here is this week's status update (SEO):",
    doneHeading: "✅ What was done this week:",
    nextHeading: "📅 Next week:",
    signoff: "Let us know if you have any questions!",
    thanks: "Thank you!",
    nextFallback: "We are continuing with the SEO work planned for this stage.",
    promptLanguage: "English",
  },
};

export function scaffoldFor(lang: ReportLang): Scaffold {
  return SCAFFOLDS[lang];
}

/** Língua da mensagem deste cliente. Mercado inglês → inglês; tudo o resto
 *  (incluindo o Brasil) → português. Um cliente que não resolveu contra a
 *  carteira não tem geo — fica em português, que é o comum da casa. */
export function reportLangFor(slug: string | null | undefined): ReportLang {
  if (!slug) return "pt";
  return getClientGeo(slug).languageCode === "en" ? "en" : "pt";
}

/** Monta a mensagem final a partir dos bullets. Esta função é a única coisa
 *  no sistema que decide como a mensagem é feita. */
export function buildWeeklyMessage(
  lang: ReportLang,
  done: string[],
  next: string[],
): string {
  const s = SCAFFOLDS[lang];
  const clean = (list: string[]) =>
    list
      .map((b) => b.replace(/^\s*[•·▪◦*\-–—]\s*/, "").trim())
      .filter(Boolean);

  const doneBullets = clean(done);
  const nextBullets = clean(next);

  return [
    s.greeting,
    "",
    s.intro,
    "",
    s.doneHeading,
    ...doneBullets.map((b) => `${BULLET}${b}`),
    "",
    s.nextHeading,
    ...(nextBullets.length > 0 ? nextBullets : [s.nextFallback]).map(
      (b) => `${BULLET}${b}`,
    ),
    "",
    s.signoff,
    "",
    s.thanks,
  ].join("\n");
}
