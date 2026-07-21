// Catalogue of the onboarding "course" — categories → lessons. Client-facing,
// PT-PT. Pure module (no KV / React) so both the public hub and the internal
// team view can import it.
//
// Video embeds are intentionally left as `videoUrl: null` placeholders — the
// team will paste the final embed URLs here later; every lesson page already
// renders the player slot from this field.
//
// Each lesson carries a `track` (seo | ads | common). The flow a client sees
// is composed from their services (see onboarding-tracks.ts) — SEO lessons for
// SEO clients, Ads lessons for Ads clients, common lessons for everyone.

import type { OnbTrack, OnbService } from "@/lib/onboarding-tracks";

/** Team emails to grant as admins on the client's accounts. */
export const TEAM_ADMIN_EMAILS = [
  "alex@wonder-ads.com",
  "alice@wonder-ads.com",
  "andre@wonder-ads.com",
  "seo@wonder-ads.com",
];

export type LessonBlock =
  | { type: "p"; text: string }
  | { type: "emails"; intro: string; emails: string[] }
  | { type: "bullets"; intro?: string; items: string[] };

export type LessonKind = "video" | "form" | "info";

export type Lesson = {
  id: string;
  /** Category key (matches a OnboardingCategory.key). */
  category: string;
  title: string;
  kind: LessonKind;
  /** Emoji shown on the lesson thumbnail. */
  emoji: string;
  /** Embed URL for the lesson video — null until the team adds it. */
  videoUrl: string | null;
  /** One-line summary shown under the title in the hub. */
  summary: string;
  /** "SOBRE ESTE PASSO" rich content. */
  about: LessonBlock[];
  /** Which onboarding track this lesson belongs to. Missing → "seo". */
  track?: OnbTrack;
  /** Platform brand icon id (ga4, gsc, gmb, google-ads, meta, website…).
   *  When set, the UI shows the platform logo instead of the emoji. */
  platform?: string;
  /** Only shown when the client onboarding is flagged e-commerce. */
  ecommerce?: boolean;
  /** Only shown when the client signed up for this specific service. */
  requiresService?: OnbService;
  /** Optional override for the "~N min" estimate. When absent we fall back
   *  to the per-kind default (form 8 / video 3 / info 2). */
  estMinutes?: number;
};

/** Known platform icon ids (see PlatformIcon component). */
export const PLATFORM_IDS = [
  "ga4",
  "gsc",
  "gmb",
  "google-ads",
  "meta",
  "merchant",
  "tag-manager",
  "website",
  "wordpress",
  "shopify",
] as const;

export type OnboardingCategory = {
  key: string;
  title: string;
  lessons: Lesson[];
};

export const DEFAULT_ONBOARDING_CATEGORIES: OnboardingCategory[] = [
  {
    key: "onboarding-pt",
    title: "Vamos conhecer-nos melhor!",
    lessons: [
      {
        id: "comecar-aqui",
        track: "common",
        category: "onboarding-pt",
        title: "Começar Aqui",
        kind: "video",
        emoji: "🚀",
        videoUrl: "https://www.youtube.com/embed/hLQbjs-WGIE",
        summary: "Bem-vindo à Wonder Ads — o que esperar deste processo.",
        about: [
          {
            type: "p",
            text: "Bem-vindo(a) à Wonder Ads! Este é o ponto de partida da nossa parceria. Ao longo dos próximos passos vamos recolher tudo o que precisamos para preparar a sua estratégia de SEO.",
          },
          {
            type: "bullets",
            intro: "O processo tem 4 passos simples:",
            items: [
              "Ver este vídeo de boas-vindas.",
              "Preencher o formulário sobre a vossa audiência e conteúdo.",
              "Dar-nos os acessos necessários (Analytics, Search Console, GMB e Website).",
              "Concluir e avisar-nos — e começamos a trabalhar!",
            ],
          },
          {
            type: "p",
            text: "Pode fazer os passos ao seu ritmo. O seu progresso fica guardado automaticamente.",
          },
        ],
      },
      {
        id: "form-geral",
        track: "common",
        category: "onboarding-pt",
        title: "Sobre a Vossa Empresa (Formulário)",
        kind: "form",
        emoji: "🏢",
        videoUrl: null,
        summary: "Perguntas gerais para vos conhecermos melhor — objetivos, marca, mercado.",
        about: [
          {
            type: "p",
            text: "Este primeiro formulário ajuda-nos a conhecer o vosso negócio: objetivos, público-alvo, proposta de valor, produtos, concorrência e experiências passadas.",
          },
          {
            type: "p",
            text: "Reserve alguns minutos e responda com o máximo de detalhe possível — quanto melhor nos conhecermos, melhores serão os resultados.",
          },
        ],
      },
      {
        id: "form",
        track: "seo",
        category: "onboarding-pt",
        title: "Formulário SEO",
        kind: "form",
        emoji: "🔍",
        estMinutes: 2,
        videoUrl: null,
        summary: "Perguntas específicas de SEO — keywords, conteúdo e tom de voz.",
        about: [
          {
            type: "p",
            text: "Este formulário foca-se apenas no SEO: as keywords que já sabe que são importantes, quem pode rever conteúdos e o tom de voz da vossa marca.",
          },
          {
            type: "p",
            text: "Nota: para o conteúdo de blog, precisamos de cerca de 1h por semana de alguém que perceba do vosso negócio para rever/escrever.",
          },
        ],
      },
      {
        id: "form-ads",
        track: "ads",
        category: "onboarding-pt",
        title: "Questionário de Ads (Formulário)",
        kind: "form",
        emoji: "📣",
        videoUrl: null,
        summary: "Um formulário sobre os vossos objetivos, ofertas e orçamento de Ads.",
        about: [
          {
            type: "p",
            text: "As vossas respostas vão moldar cada parte das campanhas de Google e Meta Ads — desde onde os anúncios aparecem, ao que dizem, até como medimos o sucesso.",
          },
          {
            type: "p",
            text: "Responda com o máximo de detalhe possível; respostas em tópicos são perfeitas. Se alguma pergunta não se aplicar ou tiver dúvidas, escreva isso mesmo e falamos na nossa chamada.",
          },
        ],
      },
    ],
  },
  {
    key: "acessos",
    title: "Acessos Consultoria SEO",
    lessons: [
      {
        id: "ga4",
        platform: "ga4",
        category: "acessos",
        title: "Google Analytics 4",
        kind: "video",
        emoji: "📊",
        videoUrl: "https://www.youtube.com/embed/hLQbjs-WGIE",
        summary: "Adicionar a Wonder Ads como administrador do Google Analytics.",
        about: [
          {
            type: "p",
            text: "O Google Analytics 4 mostra-nos como as pessoas chegam e navegam no vosso website. Siga o vídeo para nos adicionar como administradores.",
          },
          {
            type: "emails",
            intro: "Emails para adicionar ao Google Analytics como Administradores:",
            emails: TEAM_ADMIN_EMAILS,
          },
        ],
      },
      {
        id: "gsc",
        platform: "gsc",
        category: "acessos",
        title: "Google Search Console",
        kind: "video",
        emoji: "🔍",
        videoUrl: "https://www.youtube.com/embed/20xo71m-9gs",
        summary: "Dar-nos acesso ao Search Console para acompanhar as pesquisas.",
        about: [
          {
            type: "p",
            text: "O Google Search Console mostra-nos por que palavras o vosso site aparece no Google. É essencial para o trabalho de SEO. Siga o vídeo para nos dar acesso.",
          },
          {
            type: "emails",
            intro: "Emails para adicionar ao Google Search Console como Proprietários/Utilizadores:",
            emails: TEAM_ADMIN_EMAILS,
          },
        ],
      },
      {
        id: "gmb",
        platform: "gmb",
        category: "acessos",
        title: "Google My Business (Perfil GMB)",
        kind: "video",
        emoji: "📍",
        videoUrl: "https://www.youtube.com/embed/OQDUnGktskw",
        summary: "Acesso ao Perfil de Empresa do Google (mapa e reviews).",
        about: [
          {
            type: "p",
            text: "O Perfil de Empresa do Google (GMB) é o que aparece no Google Maps e nas pesquisas locais, com as vossas reviews. Siga o vídeo para nos adicionar como gestores.",
          },
          {
            type: "emails",
            intro: "Emails para adicionar ao Perfil de Empresa do Google como Gestores:",
            emails: TEAM_ADMIN_EMAILS,
          },
        ],
      },
      {
        id: "website",
        platform: "website",
        category: "acessos",
        title: "Acesso ao Website — Clientes WordPress",
        kind: "video",
        emoji: "🌐",
        videoUrl: null,
        summary: "Como nos dar acesso ao vosso site (se for WordPress).",
        about: [
          {
            type: "p",
            text: "Para implementarmos as melhorias técnicas e de conteúdo, precisamos de acesso ao vosso website. Se o vosso site for em WordPress, o vídeo mostra como criar um utilizador de administrador para nós.",
          },
          {
            type: "p",
            text: "Se o vosso site não for em WordPress, não há problema — falem connosco e indicamos a melhor forma de nos dar acesso à vossa plataforma.",
          },
          {
            type: "emails",
            intro: "No WordPress, crie um utilizador de administrador com um destes emails (ou envie as credenciais em segurança):",
            emails: TEAM_ADMIN_EMAILS,
          },
        ],
      },
    ],
  },
  {
    key: "acessos-ads",
    title: "Acessos Consultoria Ads",
    lessons: [
      {
        id: "google-ads-conta",
        platform: "google-ads",
        track: "ads",
        category: "acessos-ads",
        title: "Acesso à Conta Google Ads",
        kind: "video",
        emoji: "🔎",
        videoUrl: null,
        summary: "Dar-nos acesso à conta Google Ads (ou criar uma nova).",
        about: [
          {
            type: "p",
            text: "Precisamos de acesso à vossa conta Google Ads. Se ainda não tiverem uma, o vídeo mostra como criá-la. Se já existir, partilhem o ID de cliente (Customer ID) e adicionem-nos como administradores.",
          },
          {
            type: "emails",
            intro: "Emails para adicionar à conta Google Ads como Administradores:",
            emails: TEAM_ADMIN_EMAILS,
          },
        ],
      },
      {
        id: "gmc",
        track: "ads",
        ecommerce: true,
        requiresService: "google-ads",
        platform: "merchant",
        category: "acessos-ads",
        title: "Acesso ao Google Merchant Center",
        kind: "video",
        emoji: "🛒",
        videoUrl: null,
        summary: "Ligar o catálogo de produtos para os anúncios Shopping.",
        about: [
          {
            type: "p",
            text: "Para anúncios de produtos (Shopping), precisamos de acesso ao vosso Google Merchant Center — é onde vive o feed de produtos que alimenta as campanhas de e-commerce.",
          },
          {
            type: "emails",
            intro: "Emails para adicionar ao Google Merchant Center como Administradores:",
            emails: TEAM_ADMIN_EMAILS,
          },
        ],
      },
      {
        id: "meta-ads-conta",
        platform: "meta",
        track: "ads",
        category: "acessos-ads",
        title: "Acesso à Conta Meta / Facebook Business",
        kind: "video",
        emoji: "📱",
        videoUrl: null,
        summary: "Acesso ao Meta Business (Facebook / Instagram Ads).",
        about: [
          {
            type: "p",
            text: "Para os anúncios de Facebook e Instagram, precisamos de acesso ao vosso Meta Business Manager (página, conta publicitária e pixel). O vídeo mostra como nos adicionar como parceiros.",
          },
          {
            type: "emails",
            intro: "Emails para adicionar ao Meta Business Manager:",
            emails: TEAM_ADMIN_EMAILS,
          },
        ],
      },
    ],
  },
  {
    key: "final",
    title: "Último Passo",
    lessons: [
      {
        id: "feito",
        track: "common",
        category: "final",
        title: "Feito! 🎉",
        kind: "info",
        emoji: "🎉",
        videoUrl: null,
        summary: "Concluiu o onboarding — obrigado! Só falta avisar-nos.",
        about: [
          {
            type: "p",
            text: "Muito obrigado! 🎉 Concluiu o processo de onboarding — a partir daqui começamos a preparar tudo do nosso lado.",
          },
          {
            type: "p",
            text: "Se já tem a próxima reunião connosco agendada, ótimo! Se ainda não, sem problema — envie-nos as suas disponibilidades e agendamos.",
          },
          {
            type: "p",
            text: "Por fim, avise-nos no grupo de WhatsApp que já terminou o onboarding, para darmos seguimento. Obrigado pela confiança!",
          },
        ],
      },
    ],
  },
];

// The catalogue is editable in-app (SuperAdmin) via onboarding-content-store.
// These helpers are PURE and take the live `categories` array so both the
// default and any KV override work identically.

/** A lesson's track, defaulting to "seo" for pre-track content. */
export function lessonTrack(l: Lesson): OnbTrack {
  return l.track ?? "seo";
}

export type ComposeCtx = {
  tracks: ("seo" | "ads")[];
  ecommerce: boolean;
  services: OnbService[];
};

/** The course a client sees — lessons whose track is "common" or active, that
 *  aren't e-commerce-only (unless the client is e-commerce) and whose required
 *  service (if any) the client has. Empty categories are dropped. */
export function courseForTracks(
  categories: OnboardingCategory[],
  ctx: ComposeCtx,
): OnboardingCategory[] {
  const active = new Set<OnbTrack>(["common", ...ctx.tracks]);
  return categories
    .map((c) => ({
      ...c,
      lessons: c.lessons.filter(
        (l) =>
          active.has(lessonTrack(l)) &&
          (!l.ecommerce || ctx.ecommerce) &&
          (!l.requiresService || ctx.services.includes(l.requiresService)),
      ),
    }))
    .filter((c) => c.lessons.length > 0);
}

/** Every lesson, flattened, in order. */
export function flattenLessons(categories: OnboardingCategory[]): Lesson[] {
  return categories.flatMap((c) => c.lessons);
}

export function findLesson(
  categories: OnboardingCategory[],
  id: string,
): Lesson | null {
  return flattenLessons(categories).find((l) => l.id === id) ?? null;
}

export function findCategory(
  categories: OnboardingCategory[],
  key: string,
): OnboardingCategory | null {
  return categories.find((c) => c.key === key) ?? null;
}

/** The category that comes after the one containing `lessonId`. */
export function nextCategory(
  categories: OnboardingCategory[],
  lessonId: string,
): OnboardingCategory | null {
  const lesson = findLesson(categories, lessonId);
  if (!lesson) return null;
  const ci = categories.findIndex((c) => c.key === lesson.category);
  if (ci < 0 || ci >= categories.length - 1) return null;
  return categories[ci + 1];
}

// ---- Normalisation (for the KV override → guard against malformed data) ----

const LESSON_KINDS: LessonKind[] = ["video", "form", "info"];
const TRACKS: OnbTrack[] = ["seo", "ads", "common"];

function normalizeBlocks(raw: unknown): LessonBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: LessonBlock[] = [];
  for (const b of raw) {
    if (!b || typeof b !== "object") continue;
    const t = (b as { type?: unknown }).type;
    if (t === "p" && typeof (b as { text?: unknown }).text === "string") {
      out.push({ type: "p", text: (b as { text: string }).text });
    } else if (t === "bullets") {
      const items = (b as { items?: unknown }).items;
      out.push({
        type: "bullets",
        intro:
          typeof (b as { intro?: unknown }).intro === "string"
            ? (b as { intro: string }).intro
            : undefined,
        items: Array.isArray(items)
          ? items.filter((x): x is string => typeof x === "string")
          : [],
      });
    } else if (t === "emails") {
      const emails = (b as { emails?: unknown }).emails;
      out.push({
        type: "emails",
        intro:
          typeof (b as { intro?: unknown }).intro === "string"
            ? (b as { intro: string }).intro
            : "",
        emails: Array.isArray(emails)
          ? emails.filter((x): x is string => typeof x === "string")
          : [],
      });
    }
  }
  return out;
}

/** Coerce arbitrary stored data into a valid course, or null if unusable. */
export function normalizeCourse(raw: unknown): OnboardingCategory[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const cats: OnboardingCategory[] = [];
  for (const c of raw) {
    if (!c || typeof c !== "object") continue;
    const key = (c as { key?: unknown }).key;
    const title = (c as { title?: unknown }).title;
    const lessons = (c as { lessons?: unknown }).lessons;
    if (typeof key !== "string" || typeof title !== "string") continue;
    const outLessons: Lesson[] = [];
    if (Array.isArray(lessons)) {
      for (const l of lessons) {
        if (!l || typeof l !== "object") continue;
        const id = (l as { id?: unknown }).id;
        const lTitle = (l as { title?: unknown }).title;
        if (typeof id !== "string" || typeof lTitle !== "string") continue;
        const kindRaw = (l as { kind?: unknown }).kind;
        const kind = LESSON_KINDS.includes(kindRaw as LessonKind)
          ? (kindRaw as LessonKind)
          : "video";
        const trackRaw = (l as { track?: unknown }).track;
        const track = TRACKS.includes(trackRaw as OnbTrack)
          ? (trackRaw as OnbTrack)
          : "seo";
        const videoUrl = (l as { videoUrl?: unknown }).videoUrl;
        const platformRaw = (l as { platform?: unknown }).platform;
        const platform =
          typeof platformRaw === "string" && platformRaw.trim()
            ? platformRaw
            : undefined;
        const ecommerce = Boolean((l as { ecommerce?: unknown }).ecommerce) || undefined;
        const reqRaw = (l as { requiresService?: unknown }).requiresService;
        const requiresService =
          reqRaw === "seo" || reqRaw === "google-ads" || reqRaw === "meta-ads"
            ? (reqRaw as OnbService)
            : undefined;
        const estRaw = (l as { estMinutes?: unknown }).estMinutes;
        const estMinutes =
          typeof estRaw === "number" && Number.isFinite(estRaw) && estRaw > 0
            ? estRaw
            : undefined;
        outLessons.push({
          id,
          category: key,
          title: lTitle,
          kind,
          track,
          platform,
          ecommerce,
          requiresService,
          estMinutes,
          emoji:
            typeof (l as { emoji?: unknown }).emoji === "string"
              ? (l as { emoji: string }).emoji
              : "📄",
          videoUrl: typeof videoUrl === "string" && videoUrl.trim() ? videoUrl : null,
          summary:
            typeof (l as { summary?: unknown }).summary === "string"
              ? (l as { summary: string }).summary
              : "",
          about: normalizeBlocks((l as { about?: unknown }).about),
        });
      }
    }
    cats.push({ key, title, lessons: outLessons });
  }
  return cats.length ? cats : null;
}
