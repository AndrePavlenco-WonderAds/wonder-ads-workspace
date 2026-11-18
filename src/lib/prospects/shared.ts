// FICHA DO PROSPECT (v80.0) — o que o Comercial sabe do cliente, passado ao
// consultor que fica com ele.
//
// Nasce quando um SuperAdmin inicia um onboarding no C-Suite e vive em
// /prospects/<slug> — uma página PRIVADA: só abre com sessão na workspace
// (todos os departamentos e os comerciais, também os perfis só de leitura).
// Quando o cliente entra no SEO DPT e é atribuído a um consultor, a ficha
// aparece num chip no topo da página do cliente.
//
// Este módulo é PARTILHADO (servidor + browser): tipos, catálogos, rótulos,
// validação dos dados que chegam à API e a conta do «quão completa está».
// Nada aqui toca no KV nem nas credenciais.

export const PROSPECT_TEXT_FIELDS = [
  "summary",
  "interests",
  "expectations",
  "concerns",
  "competitors",
] as const;
export type ProspectTextField = (typeof PROSPECT_TEXT_FIELDS)[number];

export const PROSPECT_TEXT_LABEL: Record<ProspectTextField, string> = {
  summary: "Em 30 segundos",
  interests: "Interesses no programa",
  expectations: "Expectativas e sucesso",
  concerns: "Cuidados e sensibilidades",
  competitors: "Concorrência e referências",
};

export const PROFILE_FIELDS = [
  "website",
  "sector",
  "location",
  "contactName",
  "contactRole",
  "source",
  "deal",
] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];
export type ProspectProfile = Record<ProfileField, string>;

export const PROFILE_LABEL: Record<ProfileField, string> = {
  website: "Website",
  sector: "Especialidade / setor",
  location: "Localização",
  contactName: "Decisor",
  contactRole: "Cargo do decisor",
  source: "Origem do lead",
  deal: "Acordo fechado",
};

export const PROFILE_PLACEHOLDER: Record<ProfileField, string> = {
  website: "exemplo.pt",
  sector: "Fisioterapia, dentária, estética…",
  location: "Lisboa · 2 clínicas",
  contactName: "Nome de quem decide",
  contactRole: "Diretora clínica, sócio-gerente…",
  source: "Referência, inbound, evento…",
  deal: "Core · 12 meses · pré-pago",
};

/** Sugestões rápidas para a origem do lead — o campo continua livre. */
export const LEAD_SOURCE_SUGGESTIONS = [
  "Referência de cliente",
  "Inbound (site)",
  "Outbound",
  "LinkedIn",
  "Evento",
  "Parceiro",
];

/** Etiquetas rápidas para os interesses — um clique, sem escrever. */
export const INTEREST_SUGGESTIONS = [
  "Mais marcações",
  "Google Maps",
  "Aparecer nas IAs",
  "Novos serviços",
  "Nova localização",
  "Marca / autoridade",
  "Reviews",
  "Site novo",
  "Concorrência local",
  "Pacientes particulares",
];

// ── Reuniões e notas ────────────────────────────────────────────────────

export const NOTE_TYPES = [
  "discovery",
  "intro",
  "proposal",
  "closing",
  "followup",
  "note",
] as const;
export type NoteType = (typeof NOTE_TYPES)[number];

export const NOTE_TYPE_LABEL: Record<NoteType, string> = {
  discovery: "Discovery call",
  intro: "Reunião introdutória",
  proposal: "Apresentação da proposta",
  closing: "Fecho",
  followup: "Follow-up",
  note: "Nota",
};

/** Cor de cada tipo (hex) — a bolinha da linha do tempo. */
export const NOTE_TYPE_COLOR: Record<NoteType, string> = {
  discovery: "#38BDF8",
  intro: "#A78BFA",
  proposal: "#F472B6",
  closing: "#34D399",
  followup: "#FBBF24",
  note: "#94A3B8",
};

export type ProspectAttachmentKind = "image" | "video" | "audio" | "pdf" | "document";

export type ProspectAttachment = {
  id: string;
  name: string;
  url: string;
  kind: ProspectAttachmentKind;
  size: number | null;
  addedBy: string;
  addedAt: number;
};

export type ProspectNote = {
  id: string;
  type: NoteType;
  title: string;
  /** Dia da reunião (yyyy-mm-dd). */
  date: string;
  body: string;
  /** Link opcional da gravação/call (Fathom, Meet, Zoom…). */
  callUrl: string | null;
  attachments: ProspectAttachment[];
  author: string;
  createdAt: number;
  updatedAt: number | null;
};

// ── Oportunidades (cross-sell / upsell) ─────────────────────────────────

export type OpportunityKind = "cross-sell" | "upsell";
export const OPPORTUNITY_KIND_LABEL: Record<OpportunityKind, string> = {
  "cross-sell": "Cross-sell",
  upsell: "Upsell",
};
export const OPPORTUNITY_KIND_HINT: Record<OpportunityKind, string> = {
  "cross-sell": "Outros serviços da agência que o cliente pode vir a contratar",
  upsell: "Mais do mesmo programa: tier acima, add-ons, mais âmbito",
};

/** Sugestões por tipo — o campo «serviço» continua livre. */
export const OPPORTUNITY_SUGGESTIONS: Record<OpportunityKind, string[]> = {
  "cross-sell": ["Google Ads", "Meta Ads", "Website novo", "Landing pages", "CRM"],
  upsell: [
    "Subir de tier",
    "Mais localizações",
    "Origem dos pacientes",
    "Reviews Hub",
    "GEO / IAs",
    "Pré-pagamento anual",
  ],
};

export const OPPORTUNITY_POTENTIALS = ["alta", "media", "baixa"] as const;
export type OpportunityPotential = (typeof OPPORTUNITY_POTENTIALS)[number];
export const POTENTIAL_LABEL: Record<OpportunityPotential, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const OPPORTUNITY_STATUSES = ["ideia", "proposta", "ganho", "perdido"] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];
export const STATUS_LABEL: Record<OpportunityStatus, string> = {
  ideia: "Ideia",
  proposta: "Proposta enviada",
  ganho: "Ganho",
  perdido: "Perdido",
};

export const TIMING_SUGGESTIONS = ["Já", "3 meses", "6 meses", "12 meses", "Na renovação"];

export type ProspectOpportunity = {
  id: string;
  kind: OpportunityKind;
  service: string;
  note: string;
  potential: OpportunityPotential;
  timing: string;
  status: OpportunityStatus;
  createdBy: string;
  createdAt: number;
  updatedAt: number | null;
};

// ── Links e prioridades ─────────────────────────────────────────────────

export type ProspectLink = {
  id: string;
  label: string;
  url: string;
  addedBy: string;
  addedAt: number;
};

export type ProspectPriority = { id: string; text: string };

export type ProspectActivity = { at: number; by: string; text: string };

// ── A ficha ─────────────────────────────────────────────────────────────

export type ProspectFile = {
  slug: string;
  /** Nome do cliente quando a ficha nasceu (o nome em vigor vem do contexto). */
  title: string;
  createdAt: number;
  createdBy: string;
  /** Username do comercial responsável (quem fechou), ou null. */
  owner: string | null;
  updatedAt: number;
  updatedBy: string | null;
  profile: ProspectProfile;
  summary: string;
  interests: string;
  interestTags: string[];
  expectations: string;
  concerns: string;
  competitors: string;
  priorities: ProspectPriority[];
  opportunities: ProspectOpportunity[];
  notes: ProspectNote[];
  links: ProspectLink[];
  files: ProspectAttachment[];
  activity: ProspectActivity[];
};

// ── Limites ─────────────────────────────────────────────────────────────

export const LIMITS = {
  text: 8000,
  short: 200,
  noteBody: 20000,
  tags: 20,
  tag: 40,
  priorities: 15,
  priority: 280,
  opportunities: 40,
  notes: 200,
  links: 40,
  files: 120,
  attachmentsPerNote: 12,
  activity: 60,
  maxUploadBytes: 200 * 1024 * 1024,
} as const;

// ── Fábrica e normalização ──────────────────────────────────────────────

export function emptyProfile(): ProspectProfile {
  return {
    website: "",
    sector: "",
    location: "",
    contactName: "",
    contactRole: "",
    source: "",
    deal: "",
  };
}

export function emptyProspectFile(
  slug: string,
  title: string,
  createdBy: string,
  owner: string | null = null,
  now: number = Date.now(),
): ProspectFile {
  return {
    slug,
    title,
    createdAt: now,
    createdBy,
    owner,
    updatedAt: now,
    updatedBy: null,
    profile: emptyProfile(),
    summary: "",
    interests: "",
    interestTags: [],
    expectations: "",
    concerns: "",
    competitors: "",
    priorities: [],
    opportunities: [],
    notes: [],
    links: [],
    files: [],
    activity: [],
  };
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\r\n/g, "\n").slice(0, max) : "";
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function oneOf<T extends string>(v: unknown, list: readonly T[], fallback: T): T {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** Os registos no KV são crus — um campo novo é undefined nos antigos. Tudo
 *  o que se lê passa por aqui (ver feedback «KV reads are raw»). */
export function hydrateProspectFile(raw: unknown, slug: string): ProspectFile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const base = emptyProspectFile(slug, str(r.title, LIMITS.short) || slug, str(r.createdBy, 60) || "?");
  const profileRaw = (r.profile && typeof r.profile === "object" ? r.profile : {}) as Record<string, unknown>;
  const profile = emptyProfile();
  for (const f of PROFILE_FIELDS) profile[f] = str(profileRaw[f], LIMITS.short);

  return {
    ...base,
    createdAt: num(r.createdAt, base.createdAt),
    owner: typeof r.owner === "string" && r.owner ? r.owner : null,
    updatedAt: num(r.updatedAt, num(r.createdAt, base.createdAt)),
    updatedBy: typeof r.updatedBy === "string" ? r.updatedBy : null,
    profile,
    summary: str(r.summary, LIMITS.text),
    interests: str(r.interests, LIMITS.text),
    interestTags: arr(r.interestTags)
      .map((t) => str(t, LIMITS.tag).trim())
      .filter(Boolean)
      .slice(0, LIMITS.tags),
    expectations: str(r.expectations, LIMITS.text),
    concerns: str(r.concerns, LIMITS.text),
    competitors: str(r.competitors, LIMITS.text),
    priorities: arr(r.priorities)
      .map((p) => hydratePriority(p))
      .filter((p): p is ProspectPriority => Boolean(p))
      .slice(0, LIMITS.priorities),
    opportunities: arr(r.opportunities)
      .map((o) => hydrateOpportunity(o))
      .filter((o): o is ProspectOpportunity => Boolean(o))
      .slice(0, LIMITS.opportunities),
    notes: arr(r.notes)
      .map((n) => hydrateNote(n))
      .filter((n): n is ProspectNote => Boolean(n))
      .slice(0, LIMITS.notes),
    links: arr(r.links)
      .map((l) => hydrateLink(l))
      .filter((l): l is ProspectLink => Boolean(l))
      .slice(0, LIMITS.links),
    files: arr(r.files)
      .map((f) => hydrateAttachment(f))
      .filter((f): f is ProspectAttachment => Boolean(f))
      .slice(0, LIMITS.files),
    activity: arr(r.activity)
      .map((a) => {
        if (!a || typeof a !== "object") return null;
        const x = a as Record<string, unknown>;
        const text = str(x.text, 300);
        return text ? { at: num(x.at, 0), by: str(x.by, 60), text } : null;
      })
      .filter((a): a is ProspectActivity => Boolean(a))
      .slice(0, LIMITS.activity),
  };
}

export function hydratePriority(raw: unknown): ProspectPriority | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const text = str(r.text, LIMITS.priority).trim();
  if (!text) return null;
  return { id: str(r.id, 60) || newId("pr"), text };
}

export function hydrateOpportunity(raw: unknown): ProspectOpportunity | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const service = str(r.service, 120).trim();
  if (!service) return null;
  return {
    id: str(r.id, 60) || newId("op"),
    kind: oneOf(r.kind, ["cross-sell", "upsell"] as const, "upsell"),
    service,
    note: str(r.note, 2000),
    potential: oneOf(r.potential, OPPORTUNITY_POTENTIALS, "media"),
    timing: str(r.timing, 60).trim(),
    status: oneOf(r.status, OPPORTUNITY_STATUSES, "ideia"),
    createdBy: str(r.createdBy, 60),
    createdAt: num(r.createdAt, 0),
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : null,
  };
}

export function hydrateNote(raw: unknown): ProspectNote | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const body = str(r.body, LIMITS.noteBody);
  const title = str(r.title, LIMITS.short).trim();
  const attachments = arr(r.attachments)
    .map((a) => hydrateAttachment(a))
    .filter((a): a is ProspectAttachment => Boolean(a))
    .slice(0, LIMITS.attachmentsPerNote);
  const callUrl = cleanUrl(r.callUrl);
  if (!body.trim() && !title && attachments.length === 0 && !callUrl) return null;
  return {
    id: str(r.id, 60) || newId("nt"),
    type: oneOf(r.type, NOTE_TYPES, "note"),
    title,
    date: isISODate(r.date) ? (r.date as string) : "",
    body,
    callUrl,
    attachments,
    author: str(r.author, 60),
    createdAt: num(r.createdAt, 0),
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : null,
  };
}

export function hydrateLink(raw: unknown): ProspectLink | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const url = cleanUrl(r.url);
  if (!url) return null;
  return {
    id: str(r.id, 60) || newId("lk"),
    label: str(r.label, 120).trim(),
    url,
    addedBy: str(r.addedBy, 60),
    addedAt: num(r.addedAt, 0),
  };
}

/** Só ficheiros que vivem no Blob da Vercel — a ficha nunca guarda um URL
 *  qualquer a fingir que é um anexo. */
export function isBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export function hydrateAttachment(raw: unknown): ProspectAttachment | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const url = typeof r.url === "string" ? r.url : "";
  if (!isBlobUrl(url)) return null;
  const name = str(r.name, 200).trim() || "ficheiro";
  return {
    id: str(r.id, 60) || newId("fl"),
    name,
    url,
    kind: oneOf(r.kind, ["image", "video", "audio", "pdf", "document"] as const, attachmentKindOf(name, "")),
    size: typeof r.size === "number" && Number.isFinite(r.size) ? r.size : null,
    addedBy: str(r.addedBy, 60),
    addedAt: num(r.addedAt, 0),
  };
}

// ── Utilitários ─────────────────────────────────────────────────────────

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function isISODate(v: unknown): boolean {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/** http(s) só; acrescenta https:// a «fathom.video/…». */
export function cleanUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  let s = v.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString().slice(0, 1000);
  } catch {
    return null;
  }
}

export function attachmentKindOf(name: string, mime: string): ProspectAttachmentKind {
  const m = mime.toLowerCase();
  const n = name.toLowerCase();
  if (m.startsWith("image/") || /\.(png|jpe?g|gif|webp|avif|heic|heif|svg)$/.test(n)) return "image";
  if (m.startsWith("video/") || /\.(mp4|mov|webm|m4v|mkv|avi)$/.test(n)) return "video";
  if (m.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|aac)$/.test(n)) return "audio";
  if (m === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  return "document";
}

/** De onde vem um link de call — para o ícone e o rótulo do botão. */
export function callProvider(url: string): string {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    if (h.includes("fathom")) return "Fathom";
    if (h.includes("meet.google")) return "Google Meet";
    if (h.includes("zoom")) return "Zoom";
    if (h.includes("teams.microsoft") || h.includes("teams.live")) return "Teams";
    if (h.includes("loom")) return "Loom";
    if (h.includes("drive.google") || h.includes("docs.google")) return "Google Drive";
    if (h.includes("notion")) return "Notion";
    return h;
  } catch {
    return "link";
  }
}

export function formatBytes(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

// ── Quão completa está a ficha ──────────────────────────────────────────

export type CompletenessItem = { key: string; label: string; done: boolean };

/** O que um consultor precisa para arrancar sem voltar a perguntar ao
 *  cliente. Cada item vale o mesmo — é um empurrão, não uma nota. */
export function prospectCompleteness(f: ProspectFile): {
  pct: number;
  items: CompletenessItem[];
} {
  const items: CompletenessItem[] = [
    { key: "summary", label: "Resumo em 30 segundos", done: f.summary.trim().length > 0 },
    {
      key: "interests",
      label: "Interesses no programa",
      done: f.interests.trim().length > 0 || f.interestTags.length > 0,
    },
    { key: "priorities", label: "Prioridades", done: f.priorities.length > 0 },
    { key: "opportunities", label: "Cross-sells ou upsells", done: f.opportunities.length > 0 },
    { key: "notes", label: "Notas de uma reunião", done: f.notes.length > 0 },
    {
      key: "profile",
      label: "Perfil (setor e decisor)",
      done: Boolean(f.profile.sector.trim() && f.profile.contactName.trim()),
    },
    { key: "expectations", label: "Expectativas e sucesso", done: f.expectations.trim().length > 0 },
    { key: "concerns", label: "Cuidados e sensibilidades", done: f.concerns.trim().length > 0 },
  ];
  const done = items.filter((i) => i.done).length;
  return { pct: Math.round((done / items.length) * 100), items };
}

/** Uma ficha sem nada escrito — o chip do SEO diz «por preencher». */
export function isProspectFileEmpty(f: ProspectFile): boolean {
  return prospectCompleteness(f).pct === 0 && f.links.length === 0 && f.files.length === 0;
}

// ── Etapa (derivada, nunca guardada) ────────────────────────────────────

export type ProspectStage = "onboarding" | "unassigned" | "assigned" | "archived";

export const STAGE_LABEL: Record<ProspectStage, string> = {
  onboarding: "Em onboarding",
  unassigned: "Cliente · por atribuir",
  assigned: "Cliente",
  archived: "Arquivada",
};

export function prospectPath(slug: string): string {
  return `/prospects/${encodeURIComponent(slug)}`;
}
