// «Um cliente respondeu ao NPS» → grupo de WhatsApp do DPT de SEO.
//
// O sino já avisa o COO e o consultor da conta; o grupo existe para a equipa
// inteira saber na hora — um detrator é assunto de toda a gente, e um
// promotor é uma vitória que vale a pena ver passar.
//
// A MENSAGEM LEVA A NOTA, pela mesma razão do sino: um 9 e um 4 pedem coisas
// opostas, e quem lê no telemóvel tem de perceber qual é sem abrir o link.
// As respostas escritas NÃO vão para o grupo — ficam na página do NPS, atrás
// do login; o WhatsApp só diz que há uma e onde ler.

import { getClientBySlug } from "@/lib/notion";
import type { NpsScores } from "@/lib/nps-questions";
import { postToSeoWhatsAppGroup, seoGroupConfigured } from "@/lib/whatsapp";

const oneDecimal = (n: number) => n.toFixed(1).replace(".", ",");

export function buildNpsWhatsAppMessage(input: {
  clientTitle: string;
  scores: NpsScores;
  consultant: string | null;
  identification: string | null;
  npsUrl: string;
}): string {
  const { scores } = input;
  const [dot, label, nudge] =
    scores.category === "detractor"
      ? ["🔴", "detrator", "Vale uma chamada esta semana, antes de a renovação chegar."]
      : scores.category === "promoter"
        ? ["🟢", "promotor", "Bom momento para pedir uma referência ou uma review."]
        : ["🟡", "neutro", null];

  return [
    `${dot} *Novo NPS — ${input.clientTitle}*`,
    `Continuidade: *${scores.nps}/10* · ${label}`,
    `Média geral: ${oneDecimal(scores.overall)}/10`,
    input.consultant ? `Conta: ${input.consultant}` : null,
    input.identification ? `Respondeu: ${input.identification}` : null,
    "",
    nudge,
    `👉 ${input.npsUrl}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

/** Avisa o grupo de SEO. Nunca lança; no-op (false) enquanto WHAPI_TOKEN e
 *  WHATSAPP_SEO_GROUP_ID não estiverem na Vercel. */
export async function notifyNpsOnWhatsApp(input: {
  slug: string;
  scores: NpsScores;
  consultant: string | null;
  identification: string | null;
  origin: string;
}): Promise<boolean> {
  if (!seoGroupConfigured()) return false;
  try {
    // O nome vem do Notion (em cache); se o Notion falhar, o slug serve —
    // antes um aviso com o slug do que aviso nenhum.
    const client = await getClientBySlug(input.slug).catch(() => null);
    return await postToSeoWhatsAppGroup(
      buildNpsWhatsAppMessage({
        clientTitle: client?.title ?? input.slug,
        scores: input.scores,
        consultant: input.consultant,
        identification: input.identification,
        npsUrl: `${input.origin}/seo/${input.slug}/nps`,
      }),
    );
  } catch (err) {
    console.error("[nps-whatsapp] notify failed:", err);
    return false;
  }
}
