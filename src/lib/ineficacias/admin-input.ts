// Leitura dos bodies das rotas da direção — pequenos parsers partilhados
// para as cinco rotas de /api/admin/ineficacias não divergirem.

import "server-only";
import { findEmployeeByUsername } from "@/lib/auth/credentials";
import { MAX_POINTS, LIMITS } from "./shared";

export function text(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function note(v: unknown): string {
  return text(v, LIMITS.note.max);
}

/** 0–10 inteiro, ou null. */
export function points(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > MAX_POINTS) return null;
  return n;
}

/** O username de um consultor a sério: existe, não é SuperAdmin, não é
 *  viewer. A direção não tem ledger. */
export function consultantUsername(v: unknown): string | null {
  const u = text(v, 64).toLowerCase();
  if (!u) return null;
  const row = findEmployeeByUsername(u);
  if (!row || row.isAdmin || row.viewerOf) return null;
  return row.username;
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = (await req.json()) as unknown;
    return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
