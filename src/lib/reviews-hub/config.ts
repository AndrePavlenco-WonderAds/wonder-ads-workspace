// Reviews Hub — a plataforma de respostas a reviews do Google que o cliente
// abre com password em /<slug>/reviews (v77.53).
//
// É um produto por cliente, não uma funcionalidade de todos: só os slugs
// desta tabela têm página, chip no cabeçalho do SEO e sincronização no cron.
// Para ligar outro cliente basta uma entrada nova — os perfis GMB vêm da
// conta de serviço (seo@wonder-ads.com), filtrados por `matchTitle`.
//
// A password NÃO vive aqui: só o scrypt (salt + hash, os mesmos parâmetros
// de src/lib/auth/password.ts). O texto simples fica fora do repo, com o
// Andre. Para trocar: gerar salt novo + `scryptHash(nova, salt)`.

export type ReviewsHubClient = {
  slug: string;
  /** Nome da marca tal como assina as respostas e aparece na página. */
  brand: string;
  /** Que perfis GMB (dos que a conta de serviço vê) pertencem ao cliente. */
  matchTitle: RegExp;
  passwordSalt: string;
  passwordHash: string;
  /** Assinatura por omissão das respostas (editável em Definições). */
  defaultSignature: string;
  /** Texto da marca para o prompt — uma linha sobre quem é o cliente. */
  aboutLine: string;
};

const CLIENTS: Record<string, ReviewsHubClient> = {
  "cidalia-cabeleireiros": {
    slug: "cidalia-cabeleireiros",
    brand: "Cidália Cabeleireiros",
    matchTitle: /cid[aá]lia/i,
    passwordSalt: "10b3af2708ee68ffbcab45cc9a4e231e",
    passwordHash:
      "7688a91bfd18db023cdd240660d5c42e106df97a50ffc1560974f759cd4b0effa16ecc05268675b4186308b904e5d6ca08cb7e3a6367cb35bc82f8342f56681e",
    defaultSignature: "A equipa Cidália Cabeleireiros",
    aboutLine:
      "Rede de cabeleireiros premium em Portugal desde 1970, com salões em centros comerciais e ruas de Lisboa, Margem Sul, Sintra, Setúbal e Évora, e loja online.",
  },
};

export function getHubConfig(slug: string): ReviewsHubClient | null {
  return CLIENTS[slug] ?? null;
}

export function hubSlugs(): string[] {
  return Object.keys(CLIENTS);
}

/** Caminho público da plataforma — o que o chip abre e o que se envia ao cliente. */
export function hubPath(slug: string): string {
  return `/${slug}/reviews`;
}
