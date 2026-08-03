// Inscrições na Formação.
//
// Regras:
//  • O módulo COMUM é implícito — toda a gente com sessão está inscrita, sempre.
//    Não se guarda nada em KV para isso.
//  • As ESPECIALIZAÇÕES derivam por defeito do `dept` da credencial (SEO →
//    SEO/GEO, ADS → ADS, Web → WEB, Commercial → Comercial), portanto ninguém
//    precisa de ser inscrito à mão no dia 1. O SuperAdmin pode sobrepor.
//  • UMA PESSOA PODE TER MAIS DO QUE UMA ESPECIALIZAÇÃO. Quem faz SEO e também
//    fecha vendas precisa das duas; o modelo é uma lista, não um campo único.
//    Uma lista vazia significa "explicitamente sem especialização" e vence o
//    departamento — é diferente de não haver override nenhum.
//  • Só as sobreposições ficam em KV, num único blob (o roster tem ~13 pessoas,
//    uma leitura serve a app inteira).

import { kv } from "@vercel/kv";
import {
  EMPLOYEE_CREDENTIALS,
  findEmployeeByUsername,
  type EmployeeCredential,
} from "@/lib/auth/credentials";
import {
  SPECIALIZATION_SLUGS,
  type SpecializationSlug,
} from "@/lib/training/catalog";

const KEY = "training-enrollments";

export type TrainingEnrollment = {
  /** Especializações atribuídas. `[]` = explicitamente sem especialização. */
  trackSlugs: SpecializationSlug[];
  /** Username do SuperAdmin que atribuiu. */
  assignedBy: string;
  assignedAt: number;
};

export type EnrollmentMap = Record<string, TrainingEnrollment>;

export const enrollmentsStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

function isSpecialization(v: unknown): v is SpecializationSlug {
  return (
    typeof v === "string" &&
    (SPECIALIZATION_SLUGS as readonly string[]).includes(v)
  );
}

/** Lista de slugs válida, sem repetidos e pela ordem canónica do catálogo —
 *  para que a UI mostre sempre "SEO/GEO · Comercial" e não a ordem de clique. */
function toSlugList(value: unknown): SpecializationSlug[] {
  const raw = Array.isArray(value) ? value : [value];
  const valid = raw.filter(isSpecialization);
  return SPECIALIZATION_SLUGS.filter((s) => valid.includes(s));
}

function normalize(raw: unknown): EnrollmentMap {
  if (!raw || typeof raw !== "object") return {};
  const out: EnrollmentMap = {};
  for (const [username, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const o = value as Record<string, unknown>;
    // Lista vazia é um valor legítimo — significa "explicitamente sem
    // especialização" e tem de vencer o default derivado do departamento.
    // `trackSlug` (singular) é o formato antigo: lê-se para que as atribuições
    // já gravadas em KV não se percam na migração.
    const trackSlugs =
      "trackSlugs" in o ? toSlugList(o.trackSlugs) : toSlugList(o.trackSlug);
    out[username] = {
      trackSlugs,
      assignedBy: typeof o.assignedBy === "string" ? o.assignedBy : "—",
      assignedAt: typeof o.assignedAt === "number" ? o.assignedAt : 0,
    };
  }
  return out;
}

/** Especialização por defeito para um departamento da credencial. C-Level
 *  ("All"/"Founder") não tem especialização derivada — só a Comum, até que
 *  alguém lhe atribua uma. */
export function defaultTrackForDept(
  dept: string | null | undefined,
): SpecializationSlug | null {
  switch (dept) {
    case "SEO":
      return "seo-geo";
    case "ADS":
      return "ads";
    case "Web":
      return "web";
    case "Commercial":
      return "comercial";
    default:
      return null;
  }
}

export async function getEnrollments(): Promise<EnrollmentMap> {
  if (!enrollmentsStorageConfigured) return {};
  try {
    return normalize(await kv.get<unknown>(KEY));
  } catch (err) {
    console.error("KV training-enrollments read failed:", err);
    return {};
  }
}

/** Especializações em vigor para um utilizador: override em KV se existir,
 *  senão a derivada do departamento. */
export function resolveTrackSlugs(
  username: string,
  dept: string | null | undefined,
  enrollments: EnrollmentMap,
): SpecializationSlug[] {
  const override = enrollments[username];
  if (override) return override.trackSlugs;
  const derived = defaultTrackForDept(dept);
  return derived ? [derived] : [];
}

/** Atribui as especializações de alguém. Lista vazia = explicitamente sem
 *  especialização (vence o departamento). */
export async function setEnrollment(
  username: string,
  trackSlugs: SpecializationSlug[],
  assignedBy: string,
  nowMs: number,
): Promise<EnrollmentMap> {
  if (!enrollmentsStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  if (!findEmployeeByUsername(username)) {
    throw new Error(`Utilizador desconhecido: ${username}`);
  }
  if (trackSlugs.some((s) => !isSpecialization(s))) {
    throw new Error("Especialização inválida.");
  }
  const current = await getEnrollments();
  const next: EnrollmentMap = {
    ...current,
    [username]: {
      trackSlugs: toSlugList(trackSlugs),
      assignedBy,
      assignedAt: nowMs,
    },
  };
  await kv.set(KEY, next);
  return next;
}

/** Remove a atribuição explícita — a pessoa volta a herdar a especialização
 *  do seu departamento. É diferente de gravar `trackSlugs: []`, que significa
 *  "explicitamente sem especialização" e vence o departamento. */
export async function clearEnrollment(
  username: string,
): Promise<EnrollmentMap> {
  if (!enrollmentsStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const current = await getEnrollments();
  if (!(username in current)) return current;
  const next = { ...current };
  delete next[username];
  await kv.set(KEY, next);
  return next;
}

export type TrainingUser = {
  username: string;
  name: string;
  role: string;
  dept: string;
  isAdmin: boolean;
  /** Especializações em vigor (override ou derivada). */
  trackSlugs: SpecializationSlug[];
  /** True quando veio de uma atribuição explícita do SuperAdmin. */
  assigned: boolean;
  assignedBy?: string;
  assignedAt?: number;
};

/** O roster inteiro com as especializações de cada um resolvidas — a base da
 *  tabela de consultores do Superadmin. */
export function rosterWithTracks(enrollments: EnrollmentMap): TrainingUser[] {
  return EMPLOYEE_CREDENTIALS.map((c: EmployeeCredential) => {
    const override = enrollments[c.username];
    const derived = defaultTrackForDept(c.dept);
    return {
      username: c.username,
      name: c.name,
      role: c.role,
      dept: c.dept,
      isAdmin: Boolean(c.isAdmin),
      trackSlugs: override
        ? override.trackSlugs
        : derived
          ? [derived]
          : [],
      assigned: Boolean(override),
      ...(override
        ? { assignedBy: override.assignedBy, assignedAt: override.assignedAt }
        : {}),
    };
  });
}
