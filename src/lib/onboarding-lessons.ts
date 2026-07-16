// Catalogue of the onboarding "course" — categories → lessons. Client-facing,
// PT-PT. Pure module (no KV / React) so both the public hub and the internal
// team view can import it.
//
// Video embeds are intentionally left as `videoUrl: null` placeholders — the
// team will paste the final embed URLs here later; every lesson page already
// renders the player slot from this field.

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
};

export type OnboardingCategory = {
  key: string;
  title: string;
  lessons: Lesson[];
};

export const DEFAULT_ONBOARDING_CATEGORIES: OnboardingCategory[] = [
  {
    key: "onboarding-pt",
    title: "Onboarding PT",
    lessons: [
      {
        id: "comecar-aqui",
        category: "onboarding-pt",
        title: "Começar Aqui",
        kind: "video",
        emoji: "🚀",
        videoUrl: null,
        summary: "Bem-vindo à Wonder Ads — o que esperar deste processo.",
        about: [
          {
            type: "p",
            text: "Bem-vindo(a) à Wonder Ads! Este é o ponto de partida da nossa parceria. Ao longo dos próximos passos vamos recolher tudo o que precisamos para preparar a sua estratégia de SEO e agendar a Sessão de Estratégia.",
          },
          {
            type: "bullets",
            intro: "O processo tem 5 passos simples:",
            items: [
              "Ver este vídeo de boas-vindas.",
              "Preencher o formulário sobre a vossa audiência e conteúdo.",
              "Dar-nos os acessos necessários (Analytics, Search Console, GMB e Website).",
              "Agendar a Sessão de Estratégia.",
              "Concluir — e começamos a trabalhar!",
            ],
          },
          {
            type: "p",
            text: "Pode fazer os passos ao seu ritmo. O seu progresso fica guardado automaticamente.",
          },
        ],
      },
      {
        id: "form",
        category: "onboarding-pt",
        title: "A Vossa Audiência e Conteúdo (Formulário)",
        kind: "form",
        emoji: "📝",
        videoUrl: null,
        summary: "Um formulário passo-a-passo sobre o vosso negócio e objetivos.",
        about: [
          {
            type: "p",
            text: "Precisamos de recolher algumas informações antes da Sessão de Estratégia. Algumas perguntas poderão já ter sido respondidas numa chamada ou parecer repetitivas, mas é importante termos tudo registado por escrito.",
          },
          {
            type: "p",
            text: "Reserve alguns minutos e responda com o máximo de detalhe possível — quanto melhor nos conhecermos, melhores serão os resultados.",
          },
        ],
      },
    ],
  },
  {
    key: "acessos",
    title: "Acessos",
    lessons: [
      {
        id: "intro-acessos",
        category: "acessos",
        title: "Introdução",
        kind: "video",
        emoji: "🔑",
        videoUrl: null,
        summary: "Porque precisamos destes acessos e como os partilhar em segurança.",
        about: [
          {
            type: "p",
            text: "Para trabalharmos o vosso SEO com rigor, precisamos de acesso às ferramentas onde vivem os vossos dados. Nesta secção mostramos, passo a passo, como nos dar acesso a cada uma.",
          },
          {
            type: "emails",
            intro: "Sempre que pedirmos para adicionar a Wonder Ads como administrador, use os seguintes emails:",
            emails: TEAM_ADMIN_EMAILS,
          },
        ],
      },
      {
        id: "ga4",
        category: "acessos",
        title: "Google Analytics 4",
        kind: "video",
        emoji: "📊",
        videoUrl: null,
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
        category: "acessos",
        title: "Google Search Console",
        kind: "video",
        emoji: "🔍",
        videoUrl: null,
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
        category: "acessos",
        title: "Google My Business (Perfil GMB)",
        kind: "video",
        emoji: "📍",
        videoUrl: null,
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
        category: "acessos",
        title: "Acesso ao Website — Clientes Wordpress & Shopify",
        kind: "video",
        emoji: "🌐",
        videoUrl: null,
        summary: "Como nos dar acesso ao vosso site (WordPress ou Shopify).",
        about: [
          {
            type: "p",
            text: "Para implementarmos as melhorias técnicas e de conteúdo, precisamos de acesso ao vosso website. O vídeo mostra como criar um utilizador para nós em WordPress ou Shopify.",
          },
          {
            type: "emails",
            intro: "Crie um utilizador de administrador com um destes emails (ou envie as credenciais em segurança):",
            emails: TEAM_ADMIN_EMAILS,
          },
        ],
      },
    ],
  },
  {
    key: "final",
    title: "Último Passo e Obrigado!",
    lessons: [
      {
        id: "sessao-estrategia",
        category: "final",
        title: "4º Passo: Sessão de Estratégia",
        kind: "video",
        emoji: "🎯",
        videoUrl: null,
        summary: "Agende a reunião onde apresentamos a estratégia inicial.",
        about: [
          {
            type: "p",
            text: "Com o formulário preenchido e os acessos dados, está tudo pronto para a Sessão de Estratégia — a reunião onde alinhamos objetivos e apresentamos o plano inicial.",
          },
          {
            type: "p",
            text: "O vosso consultor irá partilhar o link para agendar. Escolha o horário que melhor lhe convier.",
          },
        ],
      },
      {
        id: "feito",
        category: "final",
        title: "5º Passo: Feito!",
        kind: "info",
        emoji: "🎉",
        videoUrl: null,
        summary: "Concluiu o onboarding — o que acontece a seguir.",
        about: [
          {
            type: "p",
            text: "Parabéns — concluiu o processo de onboarding! 🎉 A partir daqui, a nossa equipa começa a trabalhar na vossa estratégia de SEO.",
          },
          {
            type: "p",
            text: "Vai receber atualizações regulares do vosso consultor. Se tiver qualquer dúvida entretanto, é só falar connosco. Obrigado pela confiança!",
          },
        ],
      },
    ],
  },
];

// The catalogue is editable in-app (SuperAdmin) via onboarding-content-store.
// These helpers are PURE and take the live `categories` array so both the
// default and any KV override work identically.

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
        const videoUrl = (l as { videoUrl?: unknown }).videoUrl;
        outLessons.push({
          id,
          category: key,
          title: lTitle,
          kind,
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
