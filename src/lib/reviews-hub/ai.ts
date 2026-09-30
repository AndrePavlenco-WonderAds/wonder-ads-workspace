// A IA que escreve as respostas do Reviews Hub — o Claude Sonnet.
//
// Modelo: Claude Sonnet 5.5 (o plano Anthropic da agência), com esforço
// «low» na página — é texto curto e aparece a ser escrito em tempo real — e
// «medium» na automação, onde ninguém está à espera. Se o Sonnet 5.5 falhar
// antes de escrever a primeira palavra (modelo indisponível na conta,
// sobrecarga), a mesma resposta é pedida ao Sonnet 4.6, que o resto da app
// já usa em produção.
//
// O que o Claude recebe, por esta ordem: quem é a marca → o guia base
// (reply-guide.ts: estrutura, casos sensíveis, português de Portugal, o que
// nunca fazer, tamanhos e exemplos) → a estratégia do nível de estrelas → o
// tom, o contacto e as regras que o cliente escreveu em Definições → o brief.
// A review vai na mensagem.

import { anthropic } from "@ai-sdk/anthropic";
import { generateText, streamText } from "ai";
import { getBriefForSlug } from "@/lib/briefs-storage";
import { formatDate } from "@/lib/dates";
import { getHubConfig } from "./config";
import { levelKey } from "./defaults";
import { renderGuide } from "./reply-guide";
import type { HubSettings } from "./types";

const MODEL_ID = "claude-sonnet-5-5";
const FALLBACK_MODEL_ID = "claude-sonnet-4-6";
const INTERACTIVE = { anthropic: { effort: "low" as const } };
const BACKGROUND = { anthropic: { effort: "medium" as const } };
/** A Google aceita até 4096 bytes; a regra do prompt fica bem abaixo. */
export const MAX_REPLY_CHARS = 4000;

export type ReplyInput = {
  salon: string;
  author: string;
  anonymous?: boolean;
  stars: number;
  text: string;
  created?: string;
  /** A versão anterior, quando se pede «outra resposta». */
  previous?: string;
  /** A resposta que já está publicada, quando se vai reescrever. */
  published?: string;
};

async function buildSystem(slug: string, settings: HubSettings, stars: number): Promise<string> {
  const cfg = getHubConfig(slug);
  const brand = cfg?.brand ?? slug;
  const key = levelKey(stars) ?? "5";
  const strategy = settings.strategies[key];
  const brief = await getBriefForSlug(slug).catch(() => null);
  const contact = settings.contactLine.trim()
    ? `pode contactar-nos através de ${settings.contactLine.trim()}`
    : "pode falar connosco diretamente no salão";

  const briefBlock =
    brief && (brief.dos.length || brief.donts.length || brief.notes.length)
      ? [
          "# Contexto da marca (brief do cliente)",
          "Usa só o que fizer sentido numa resposta curta — no máximo um destes pontos por resposta, e nunca à força.",
          brief.dos.length ? `Fazer:\n${brief.dos.map((d) => `- ${d}`).join("\n")}` : "",
          brief.donts.length ? `Evitar:\n${brief.donts.map((d) => `- ${d}`).join("\n")}` : "",
          brief.notes.length ? `Notas:\n${brief.notes.map((d) => `- ${d}`).join("\n")}` : "",
        ]
          .filter(Boolean)
          .join("\n\n")
      : "";

  return [
    `# Quem és\nÉs quem escreve as respostas públicas da ${brand} às reviews do Google. ${cfg?.aboutLine ?? ""} Escreves como a marca, nunca como uma IA. Cada resposta é lida pela pessoa que deixou a review e por todos os futuros clientes que visitam o perfil do salão.`,
    `# Guia base (segue-o sempre)\n${renderGuide({ signature: settings.signature, contact })}`,
    `# Estratégia para reviews de ${key} ${key === "1" ? "estrela" : "estrelas"}: «${strategy.title}»\n${strategy.description}\n${strategy.guidelines}`,
    `# Tom de voz definido pela marca\n${settings.tone}`,
    [
      "# Regras finais",
      settings.contactLine.trim()
        ? `- Quando convidares a pessoa a falar connosco em privado, usa exatamente este contacto: ${settings.contactLine.trim()}.`
        : "- Quando convidares a pessoa a falar connosco em privado, não inventes emails nem telefones — convida-a a falar connosco no salão.",
      settings.extraRules.trim() ? `- ${settings.extraRules.trim()}` : "",
      `- A última linha é sempre a assinatura, sozinha: ${settings.signature}`,
      "- Devolve só o texto da resposta: sem aspas, sem markdown, sem notas tuas.",
    ]
      .filter(Boolean)
      .join("\n"),
    briefBlock,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildPrompt(input: ReplyInput): string {
  const lines = [
    `Salão: ${input.salon}`,
    `Autor: ${input.anonymous ? "(anónimo)" : input.author}`,
    `Nota: ${input.stars} ${input.stars === 1 ? "estrela" : "estrelas"}`,
    input.created ? `Data da review: ${formatDate(input.created)}` : "",
    input.text.trim()
      ? `Review:\n«${input.text.trim()}»`
      : "Review: (sem texto — a pessoa deixou só a nota)",
  ];
  if (input.published?.trim()) {
    lines.push(`\nResposta que está publicada neste momento (vai ser substituída):\n${input.published.trim()}`);
  }
  if (input.previous?.trim()) {
    lines.push(
      `\nJá existe esta versão — escreve uma alternativa claramente diferente (outra abertura, outra estrutura), com a mesma estratégia:\n${input.previous.trim()}`,
    );
  }
  return lines.filter(Boolean).join("\n");
}

/** Limpa o que o modelo devolve: aspas à volta, espaços, excesso de tamanho. */
export function cleanReply(text: string): string {
  let t = text.trim();
  if (/^[«"“][\s\S]*[»"”]$/.test(t)) t = t.slice(1, -1).trim();
  return t.slice(0, MAX_REPLY_CHARS);
}

/** Resposta em streaming — para a página, que a mostra a ser escrita.
 *  Devolve um Response de texto simples (o que o hook da página lê). */
export async function streamReplyResponse(
  slug: string,
  settings: HubSettings,
  input: ReplyInput,
): Promise<Response> {
  const system = await buildSystem(slug, settings, input.stars);
  const prompt = buildPrompt(input);
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const [i, modelId] of [MODEL_ID, FALLBACK_MODEL_ID].entries()) {
        let sent = false;
        try {
          const result = streamText({
            model: anthropic(modelId),
            system,
            prompt,
            maxOutputTokens: 4000,
            maxRetries: 1,
            // O esforço só existe nos modelos novos — o Sonnet 4.6 dispensa-o.
            ...(i === 0 ? { providerOptions: INTERACTIVE } : {}),
          });
          for await (const part of result.fullStream) {
            if (part.type === "text-delta") {
              controller.enqueue(encoder.encode(part.text));
              sent = true;
            } else if (part.type === "error") {
              throw part.error;
            }
          }
          if (sent) break;
        } catch (err) {
          console.error(`[reviews-hub] ${modelId} failed:`, err);
          // A meio da escrita não se troca de modelo — ficava metade de cada.
          if (sent) break;
        }
      }
      controller.close();
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Resposta completa — para a automação (cron), sem ninguém a ver. */
export async function generateReply(
  slug: string,
  settings: HubSettings,
  input: ReplyInput,
): Promise<string> {
  const system = await buildSystem(slug, settings, input.stars);
  const prompt = buildPrompt(input);
  try {
    const { text } = await generateText({
      model: anthropic(MODEL_ID),
      system,
      prompt,
      maxOutputTokens: 4000,
      maxRetries: 3,
      providerOptions: BACKGROUND,
    });
    if (text.trim()) return cleanReply(text);
    throw new Error("Resposta vazia");
  } catch (err) {
    console.error(`[reviews-hub] ${MODEL_ID} failed, trying ${FALLBACK_MODEL_ID}:`, err);
    const { text } = await generateText({
      model: anthropic(FALLBACK_MODEL_ID),
      system,
      prompt,
      maxOutputTokens: 4000,
      maxRetries: 3,
    });
    return cleanReply(text);
  }
}
