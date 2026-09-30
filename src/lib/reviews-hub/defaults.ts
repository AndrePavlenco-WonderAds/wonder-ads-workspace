// Os valores por omissão do Reviews Hub — as cinco estratégias (uma por nível
// de estrelas), o tom e as regras. O cliente edita tudo em Definições; isto é
// só o ponto de partida e o «repor» de cada campo. Sem imports de servidor.

import type { HubSettings, StarLevel, Strategy } from "./types";

export const DEFAULT_STRATEGIES: Record<`${StarLevel}`, Strategy> = {
  "1": {
    title: "Recuperar a confiança",
    description:
      "Respostas calmas, empáticas e orientadas para a resolução do problema.",
    guidelines:
      "Agradecer o feedback sem qualquer defensividade. Pedir desculpa pela experiência concreta que a pessoa descreve, sem inventar causas nem admitir culpas que não estão na review. Dizer que o salão vai analisar o que aconteceu. Convidar a pessoa a continuar a conversa em privado para resolvermos. Nunca discutir, nunca justificar com a correria do salão, nunca oferecer descontos.",
    mode: "approval",
  },
  "2": {
    title: "Resolver e compreender",
    description:
      "Mostrar que ouvimos, pedir mais detalhes e apresentar soluções.",
    guidelines:
      "Reconhecer o que correu mal, com as palavras da própria review. Mostrar que queremos perceber melhor e pedir que nos contacte com mais detalhes. Apresentar abertura para corrigir numa próxima visita, sem prometer compensações.",
    mode: "approval",
  },
  "3": {
    title: "Agradecer e melhorar",
    description:
      "Reconhecer os pontos positivos, abordar as críticas e mostrar abertura para evoluir.",
    guidelines:
      "Começar pelo que a pessoa gostou. Responder à crítica de forma direta e construtiva, sem desvalorizar. Mostrar que o comentário vai ser partilhado com a equipa do salão.",
    mode: "approval",
  },
  "4": {
    title: "Agradecer e reforçar",
    description:
      "Agradecer o feedback e reforçar o nosso compromisso com a excelência.",
    guidelines:
      "Agradecer de forma calorosa e específica — referir o serviço ou o detalhe que a pessoa mencionou. Se houver uma pequena sugestão, reconhecê-la numa frase. Reforçar o cuidado profissional da marca.",
    mode: "auto",
  },
  "5": {
    title: "Agradecer e fidelizar",
    description:
      "Mostrar gratidão, reforçar a relação e convidar para uma nova visita.",
    guidelines:
      "Agradecer com entusiasmo genuíno, referir o serviço ou o profissional que a pessoa elogiou (só se a review o nomear) e convidar para uma nova visita ao salão. Curto e caloroso.",
    mode: "auto",
  },
};

export const DEFAULT_TONE =
  "Próximo, profissional e caloroso — o meio termo entre clareza, autoridade e proximidade. Português de Portugal, trato formal na terceira pessoa (nunca «tu»), frases curtas e naturais.";

export const DEFAULT_EXTRA_RULES =
  "Nunca prometer resultados garantidos nem dizer que um produto resulta de certeza. Nunca falar de preços nem usar posicionamento por preço. Não atribuir o serviço a um profissional que a review não nomeia. Não usar linguagem que desvalorize o posicionamento premium.";

export function defaultSettings(signature: string): HubSettings {
  return {
    automation: { enabled: false, enabledAt: null },
    strategies: structuredClone(DEFAULT_STRATEGIES),
    signature,
    tone: DEFAULT_TONE,
    contactLine: "",
    extraRules: DEFAULT_EXTRA_RULES,
  };
}

/** Junta o que está gravado com os valores por omissão — um campo novo nas
 *  Definições nunca rebenta com registos antigos (KV devolve o objeto cru). */
export function hydrateSettings(
  raw: Partial<HubSettings> | null | undefined,
  signature: string,
): HubSettings {
  const base = defaultSettings(signature);
  if (!raw || typeof raw !== "object") return base;
  const strategies = { ...base.strategies };
  for (const k of Object.keys(strategies) as `${StarLevel}`[]) {
    const s = raw.strategies?.[k];
    if (s) strategies[k] = { ...strategies[k], ...s };
  }
  return {
    ...base,
    ...raw,
    automation: { ...base.automation, ...(raw.automation ?? {}) },
    strategies,
    signature: raw.signature?.trim() ? raw.signature : base.signature,
  };
}

/** O nível de estrelas como chave das estratégias. */
export function levelKey(stars: number): `${StarLevel}` | null {
  return stars >= 1 && stars <= 5 ? (String(stars) as `${StarLevel}`) : null;
}
