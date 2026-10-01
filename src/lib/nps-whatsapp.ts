// «Um cliente respondeu ao NPS» → WhatsApp privado ao consultor da conta e ao
// André, pelo número oficial da agência no GHL (ver src/lib/ghl.ts).
//
// Os mesmos dois destinatários do sino, pelo mesmo motivo: o consultor é quem
// liga ao cliente, o André lê a carteira inteira. Um pedido ao webhook POR
// DESTINATÁRIO — assim o workflow do GHL é uma linha reta (contacto pelo email
// → modelo de WhatsApp), sem ramos.
//
// A MENSAGEM LEVA A NOTA: um 9 e um 4 pedem coisas opostas, e quem lê no
// telemóvel tem de perceber qual é sem abrir o link. As respostas escritas NÃO
// saem do Workspace — o WhatsApp só diz que há uma e onde ler.
//
// Os valores vão já formatados e numa linha só: as variáveis de um modelo de
// WhatsApp não aceitam quebras de linha nem podem ir vazias.

import { getClientBySlug } from "@/lib/notion";
import { SEO_CONSULTANTS } from "@/lib/client-overrides";
import type { NpsScores } from "@/lib/nps-questions";
import { ghlNpsWebhookConfigured, postToGhlNpsWebhook } from "@/lib/ghl";

/** Recebe TODAS as respostas, seja de quem for a conta. É também o email do
 *  contacto dele no GHL — o workflow encontra o contacto por aqui. */
export const NPS_ALWAYS_NOTIFY = {
  name: "André",
  email: "andre@wonder-ads.com",
} as const;

type Recipient = { name: string; email: string; role: "consultor" | "direcao" };

const oneLine = (s: string, max = 120) =>
  s.replace(/\s+/g, " ").trim().slice(0, max);

/** «Fran. Rosa» → «Fran», «João B.» → «João». */
const firstName = (full: string) => full.split(" ")[0].replace(/\.$/, "");

export function buildNpsGhlPayloads(input: {
  slug: string;
  clientTitle: string;
  scores: NpsScores;
  consultant: string | null;
  identification: string | null;
  npsUrl: string;
  submittedAt: number;
  isTest?: boolean;
}): Record<string, string | number | boolean>[] {
  const { scores } = input;
  const [emoji, category, nudge] =
    scores.category === "detractor"
      ? ["🔴", "detrator", "Vale uma chamada esta semana, antes de a renovação chegar."]
      : scores.category === "promoter"
        ? ["🟢", "promotor", "Bom momento para pedir uma referência ou uma review."]
        : ["🟡", "neutro", "Vale ler o que escreveu antes da próxima call."];

  // Só consultores de SEO conhecidos: um email que não seja de um contacto
  // da equipa no GHL faria o workflow criar um contacto SEM telemóvel (e o
  // WhatsApp falhava em silêncio). Conta sem consultor → só o André.
  const recipients: Recipient[] = [];
  const consultant = SEO_CONSULTANTS.find((c) => c.name === input.consultant);
  if (consultant) {
    recipients.push({
      name: firstName(consultant.name),
      email: consultant.email,
      role: "consultor",
    });
  }
  if (!recipients.some((r) => r.email === NPS_ALWAYS_NOTIFY.email)) {
    recipients.push({ ...NPS_ALWAYS_NOTIFY, role: "direcao" });
  }

  return recipients.map((r) => ({
    event: "nps_submitted",
    is_test: Boolean(input.isTest),
    recipient_email: r.email,
    recipient_name: r.name,
    recipient_role: r.role,
    client: oneLine(input.clientTitle),
    client_slug: input.slug,
    nps: scores.nps,
    category,
    category_emoji: emoji,
    overall: scores.overall.toFixed(1).replace(".", ","),
    consultant: input.consultant ? oneLine(input.consultant) : "sem consultor",
    respondent: input.identification ? oneLine(input.identification) : "anónimo",
    nudge,
    url: input.npsUrl,
    submitted_at: new Date(input.submittedAt).toISOString(),
  }));
}

/** Dispara um webhook por destinatário. Nunca lança; no-op (0) enquanto
 *  GHL_NPS_WEBHOOK_URL não estiver na Vercel. Devolve quantos passaram. */
export async function notifyNpsOnWhatsApp(input: {
  slug: string;
  scores: NpsScores;
  consultant: string | null;
  identification: string | null;
  submittedAt: number;
  origin: string;
}): Promise<number> {
  if (!ghlNpsWebhookConfigured()) return 0;
  try {
    // O nome vem do Notion (em cache); se o Notion falhar, o slug serve —
    // antes um aviso com o slug do que aviso nenhum.
    const client = await getClientBySlug(input.slug).catch(() => null);
    const payloads = buildNpsGhlPayloads({
      ...input,
      clientTitle: client?.title ?? input.slug,
      npsUrl: `${input.origin}/seo/${input.slug}/nps`,
    });
    const results = await Promise.all(payloads.map(postToGhlNpsWebhook));
    return results.filter(Boolean).length;
  } catch (err) {
    console.error("[nps-whatsapp] notify failed:", err);
    return 0;
  }
}
