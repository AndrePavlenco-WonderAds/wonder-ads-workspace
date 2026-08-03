// Inscrições na Formação.
//
// Regras:
//  • A track COMUM é implícita — toda a gente com sessão está inscrita, sempre.
//    Não se guarda nada em KV para isso.
//  • A ESPECIALIZAÇÃO deriva por defeito do `dept` da credencial (SEO → SEO/GEO,
//    ADS → ADS, Web → WEB, Commercial → Comercial), portanto ninguém precisa de
//    ser inscrito à mão no dia 1. O C-Level pode sobrepor no admin.
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
  /** Slug da track de especialização, ou null = sem especialização atribuída. */
  trackSlug: SpecializationSlug | null;
  /** Username do C-Level que atribuiu. */
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

function normalize(raw: unknown): EnrollmentMap {
  if (!raw || typeof raw !== "object") return {};
  const out: EnrollmentMap = {};
  for (const [username, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const o = value as Record<string, unknown>;
    // `null` é um valor legítimo — significa "explicitamente sem especialização"
    // e tem de vencer o default derivado do departamento.
    const slug = isSpecialization(o.trackSlug) ? o.trackSlug : null;
    out[username] = {
      trackSlug: slug,
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

/** Especialização em vigor para um utilizador: override em KV se existir,
 *  senão a derivada do departamento. */
export function resolveTrackSlug(
  username: string,
  dept: string | null | undefined,
  enrollments: EnrollmentMap,
): SpecializationSlug | null {
  const override = enrollments[username];
  if (override) return override.trackSlug;
  return defaultTrackForDept(dept);
}

/** Atribui (ou limpa, com `trackSlug: null`) a especialização de alguém. */
export async function setEnrollment(
  username: string,
  trackSlug: SpecializationSlug | null,
  assignedBy: string,
  nowMs: number,
): Promise<EnrollmentMap> {
  if (!enrollmentsStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  if (!findEmployeeByUsername(username)) {
    throw new Error(`Utilizador desconhecido: ${username}`);
  }
  if (trackSlug !== null && !isSpecialization(trackSlug)) {
    throw new Error("Track de especialização inválida.");
  }
  const current = await getEnrollments();
  const next: EnrollmentMap = {
    ...current,
    [username]: { trackSlug, assignedBy, assignedAt: nowMs },
  };
  await kv.set(KEY, next);
  return next;
}

export type TrainingUser = {
  username: string;
  name: string;
  role: string;
  dept: string;
  isAdmin: boolean;
  /** Especialização em vigor (override ou derivada). */
  trackSlug: SpecializationSlug | null;
  /** True quando veio de uma atribuição explícita do C-Level. */
  assigned: boolean;
  assignedBy?: string;
  assignedAt?: number;
};

/** O roster inteiro com a track de cada um resolvida — a base da tabela de
 *  consultores do overview de admin. */
export function rosterWithTracks(enrollments: EnrollmentMap): TrainingUser[] {
  return EMPLOYEE_CREDENTIALS.map((c: EmployeeCredential) => {
    const override = enrollments[c.username];
    return {
      username: c.username,
      name: c.name,
      role: c.role,
      dept: c.dept,
      isAdmin: Boolean(c.isAdmin),
      trackSlug: override ? override.trackSlug : defaultTrackForDept(c.dept),
      assigned: Boolean(override),
      ...(override
        ? { assignedBy: override.assignedBy, assignedAt: override.assignedAt }
        : {}),
    };
  });
}
