// A IA que escreve as respostas do Reviews Hub.
//
// Modelo: Claude Opus 5.5 com esforço «low» — é texto curto, e a página mostra
// a resposta a ser escrita em tempo real, por isso a latência conta mais do
// que raciocínio profundo. Se o Opus falhar antes de escrever a primeira
// palavra (modelo indisponível na conta, sobrecarga), a mesma resposta é
// pedida ao Sonnet 4.6 — o modelo que o resto da app já usa em produção.
// A estratégia do nível de estrelas, o tom, as regras e o brief do cliente
// vão no system; a review vai na mensagem.

import { anthropic } from "@ai-sdk/anthropic";
import { generateText, streamText } from "ai";
import { getBriefForSlug } from "@/lib/briefs-storage";
import { formatDate } from "@/lib/dates";
import { getHubConfig } from "./config";
import { levelKey } from "./defaults";
import type { HubSettings } from "./types";

const MODEL_ID = "claude-opus-5-5";
const FALLBACK_MODEL_ID = "claude-sonnet-4-6";
const PROVIDER_OPTIONS = { anthropic: { effort: "low" as const } };
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
    ? `Quando convidares a pessoa a falar connosco em privado, usa exatamente este contacto: ${settings.contactLine.trim()}`
    : "Quando convidares a pessoa a falar connosco em privado, não inventes emails nem telefones — diz apenas que gostaríamos de falar com ela diretamente ou no salão.";

  const briefBlock =
    brief && (brief.dos.length || brief.donts.length || brief.notes.length)
      ? [
          "## Contexto da marca (brief do cliente)",
          "Usa só o que fizer sentido numa resposta curta a uma review — no máximo um destes pontos por resposta, e nunca à força.",
          brief.dos.length ? `Fazer:\n${brief.dos.map((d) => `- ${d}`).join("\n")}` : "",
          brief.donts.length ? `Evitar:\n${brief.donts.map((d) => `- ${d}`).join("\n")}` : "",
          brief.notes.length ? `Notas:\n${brief.notes.map((d) => `- ${d}`).join("\n")}` : "",
        ]
          .filter(Boolean)
          .join("\n\n")
      : "";

  return [
    `Escreves as respostas públicas da ${brand} às reviews do Google. ${cfg?.aboutLine ?? ""}`.trim(),
    "Recebes uma review e escreves UMA resposta, pronta a publicar no perfil do salão.",
    `## Estratégia para reviews de ${key} ${key === "1" ? "estrela" : "estrelas"}: «${strategy.title}»\n${strategy.description}\n${strategy.guidelines}`,
    `## Tom de voz\n${settings.tone}`,
    [
      "## Regras",
      "- Responde no idioma da review. Se a review estiver em português ou não tiver texto, escreve em português de Portugal (equipa, contacto, receber — nunca português do Brasil).",
      "- Abre com uma saudação com o primeiro nome da pessoa («Olá Mariana,»). Se o nome não parecer um nome próprio, ou a review for anónima, usa só «Olá,».",
      "- Refere-te a coisas concretas que a review diz. Nunca inventes factos, serviços, profissionais, datas ou causas que lá não estejam.",
      "- Quando for natural, menciona o salão e o serviço referido — uma vez, sem forçar palavras-chave.",
      "- Nada de descontos, ofertas ou compensações, nem garantias de resultado.",
      "- Tamanho: 2 a 4 frases curtas para 4–5 estrelas; até 6 frases para 1–3 estrelas. Nunca mais de 900 caracteres.",
      `- ${contact}`,
      "- Varia a abertura e a estrutura — nada de fórmulas repetidas em todas as respostas.",
      settings.extraRules.trim() ? `- ${settings.extraRules.trim()}` : "",
      `- Termina numa linha própria com a assinatura: ${settings.signature}`,
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
            ...(i === 0 ? { providerOptions: PROVIDER_OPTIONS } : {}),
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
      providerOptions: PROVIDER_OPTIONS,
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
