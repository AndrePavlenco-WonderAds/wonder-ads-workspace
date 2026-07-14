// Per-client billing detail — the data behind the full-page client
// pop-up on the Clients table. Keyed by slug ONLY (not per department):
// a client that runs SEO + ADS is one company, so its contacts, email
// templates, notes and past invoices are shared across its rows.
//
// Stored in KV under `admin-client-detail:<slug>`. Reads degrade to a
// sensible default (with Portuguese email templates pre-filled) so the
// pop-up always opens even on a fresh client or when KV is unreachable.

import { kv } from "@vercel/kv";

const KEY_PREFIX = "admin-client-detail:";

export const detailStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

/** A billing contact for the client — who to email invoices to, plus a
 *  phone number. Free-form `role` label (e.g. "Financeiro", "CEO"). */
export type ClientContact = {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
};

/** A reusable email template — subject + body. Edited inline and copied
 *  to the clipboard from the pop-up. */
export type EmailTemplate = {
  subject: string;
  body: string;
};

/** A stored invoice file — uploaded to Vercel Blob, listed in the
 *  Faturas tab. `addedAt` is an epoch-ms timestamp. */
export type ClientInvoiceFile = {
  id: string;
  name: string;
  url: string;
  addedAt: number;
};

export type AdminClientDetail = {
  slug: string;
  contacts: ClientContact[];
  /** Template for asking our accountant to issue the invoice. */
  accountingEmail: EmailTemplate;
  /** Template for asking the client to pay the invoice. */
  clientEmail: EmailTemplate;
  notes: string;
  invoices: ClientInvoiceFile[];
  /** Signed contract(s) — same file shape as invoices, shown in the
   *  Contrato tab. */
  contracts: ClientInvoiceFile[];
  updatedAt: string;
};

/** Default PT template — request an invoice from our accountant. */
const DEFAULT_ACCOUNTING_EMAIL: EmailTemplate = {
  subject: "Pedido de fatura — [CLIENTE]",
  body: `Olá,

Podes por favor emitir a fatura referente ao cliente [CLIENTE], no valor de [VALOR] (+ IVA)?

Os dados de faturação seguem em anexo / são os habituais.

Obrigado,
Wonder Ads`,
};

/** Default PT template — request payment from the client. */
const DEFAULT_CLIENT_EMAIL: EmailTemplate = {
  subject: "Fatura [CLIENTE] — Wonder Ads",
  body: `Olá,

Segue em anexo a fatura referente aos serviços deste período.

Agradecemos o pagamento até à data de vencimento indicada. Para qualquer questão, estamos ao dispor.

Cumprimentos,
Wonder Ads`,
};

export function defaultClientDetail(slug: string): AdminClientDetail {
  return {
    slug,
    contacts: [],
    accountingEmail: { ...DEFAULT_ACCOUNTING_EMAIL },
    clientEmail: { ...DEFAULT_CLIENT_EMAIL },
    notes: "",
    invoices: [],
    contracts: [],
    updatedAt: new Date(0).toISOString(),
  };
}

function detailKey(slug: string): string {
  return `${KEY_PREFIX}${slug}`;
}

function asString(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

/** Coerce arbitrary stored/posted JSON into a clean AdminClientDetail,
 *  filling defaults for anything missing or malformed. Shared by the
 *  reader and the API's PUT handler so both trust the same shape. */
export function normaliseDetail(
  raw: unknown,
  slug: string,
): AdminClientDetail {
  const base = defaultClientDetail(slug);
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;

  const contacts: ClientContact[] = Array.isArray(r.contacts)
    ? r.contacts
        .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
        .slice(0, 50)
        .map((c) => ({
          id:
            typeof c.id === "string" && c.id.length > 0
              ? c.id
              : crypto.randomUUID(),
          name: asString(c.name, 120),
          role: asString(c.role, 80),
          email: asString(c.email, 160),
          phone: asString(c.phone, 60),
        }))
    : base.contacts;

  function template(v: unknown, fallback: EmailTemplate): EmailTemplate {
    if (!v || typeof v !== "object") return fallback;
    const t = v as Record<string, unknown>;
    return {
      subject:
        typeof t.subject === "string" ? t.subject.slice(0, 300) : fallback.subject,
      body: typeof t.body === "string" ? t.body.slice(0, 8000) : fallback.body,
    };
  }

  function fileList(v: unknown, fallback: ClientInvoiceFile[]): ClientInvoiceFile[] {
    return Array.isArray(v)
      ? v
          .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
          .filter((f) => typeof f.url === "string" && /^https?:\/\//i.test(f.url))
          .slice(0, 200)
          .map((f) => ({
            id:
              typeof f.id === "string" && f.id.length > 0
                ? f.id
                : crypto.randomUUID(),
            name:
              typeof f.name === "string" && f.name.trim().length > 0
                ? f.name.trim().slice(0, 200)
                : (f.url as string),
            url: f.url as string,
            addedAt: typeof f.addedAt === "number" ? f.addedAt : Date.now(),
          }))
      : fallback;
  }

  return {
    slug,
    contacts,
    accountingEmail: template(r.accountingEmail, base.accountingEmail),
    clientEmail: template(r.clientEmail, base.clientEmail),
    notes: asString(r.notes, 8000),
    invoices: fileList(r.invoices, base.invoices),
    contracts: fileList(r.contracts, base.contracts),
    updatedAt: base.updatedAt,
  };
}

export async function getClientDetail(
  slug: string,
): Promise<AdminClientDetail> {
  if (!detailStorageConfigured) return defaultClientDetail(slug);
  try {
    const stored = await kv.get<unknown>(detailKey(slug));
    if (stored) return normaliseDetail(stored, slug);
  } catch (err) {
    console.error("admin-client-detail KV read failed:", err);
  }
  return defaultClientDetail(slug);
}

export async function saveClientDetail(
  slug: string,
  patch: Partial<Omit<AdminClientDetail, "slug" | "updatedAt">>,
): Promise<AdminClientDetail> {
  if (!detailStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const current = await getClientDetail(slug);
  const merged = normaliseDetail({ ...current, ...patch }, slug);
  const next: AdminClientDetail = {
    ...merged,
    slug,
    updatedAt: new Date().toISOString(),
  };
  await kv.set(detailKey(slug), next);
  return next;
}
