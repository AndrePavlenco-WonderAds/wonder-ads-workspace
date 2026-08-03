// Data de entrada de cada pessoa — a âncora dos exames de fase.
//
// Mesmo padrão das inscrições: o default vive em código (`startedAt` na
// credencial, inferido do dia em que a credencial foi criada no workspace) e
// o SuperAdmin grava um override num único blob em KV. O roster tem ~13
// pessoas — uma leitura serve a app inteira.
//
// PORQUE É QUE ISTO NÃO PODE SER ADIVINHADO: o exame dos 90 dias decide a
// efetividade de alguém. Uma data errada por uma semana desloca seis exames e
// uma decisão de carreira. O default existe para a funcionalidade não nascer
// morta; a data a sério é a que o C-Level escreve aqui.

import { kv } from "@vercel/kv";
import {
  EMPLOYEE_CREDENTIALS,
  findEmployeeByUsername,
} from "@/lib/auth/credentials";

const KEY = "training-start-dates";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type StartDateEntry = {
  /** ISO yyyy-mm-dd. */
  date: string;
  setBy: string;
  setAt: number;
};

export type StartDateMap = Record<string, StartDateEntry>;

export const startDatesStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

/** True quando a string é uma data ISO real (e não "2026-13-45"). */
export function isValidISODate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  // `new Date("2026-02-31")` não falha — reconstrói-se e compara-se.
  const [y, m, day] = value.split("-").map(Number);
  return (
    d.getFullYear() === y && d.getMonth() + 1 === m && d.getDate() === day
  );
}

function normalize(raw: unknown): StartDateMap {
  if (!raw || typeof raw !== "object") return {};
  const out: StartDateMap = {};
  for (const [username, value] of Object.entries(
    raw as Record<string, unknown>,
  )) {
    if (!value || typeof value !== "object") continue;
    const o = value as Record<string, unknown>;
    if (!isValidISODate(o.date)) continue;
    out[username] = {
      date: o.date,
      setBy: typeof o.setBy === "string" ? o.setBy : "—",
      setAt: typeof o.setAt === "number" ? o.setAt : 0,
    };
  }
  return out;
}

export async function getStartDates(): Promise<StartDateMap> {
  if (!startDatesStorageConfigured) return {};
  try {
    return normalize(await kv.get<unknown>(KEY));
  } catch (err) {
    console.error("KV training-start-dates read failed:", err);
    return {};
  }
}

/** Data em vigor para uma pessoa: override em KV se existir, senão o default
 *  da credencial, senão null (o relógio dos exames não arranca). */
export function resolveStartDate(
  username: string,
  overrides: StartDateMap,
): string | null {
  const override = overrides[username];
  if (override) return override.date;
  const row = findEmployeeByUsername(username);
  return row?.startedAt && isValidISODate(row.startedAt)
    ? row.startedAt
    : null;
}

/** True quando a data em vigor veio de uma escolha explícita do C-Level. */
export function startDateIsExplicit(
  username: string,
  overrides: StartDateMap,
): boolean {
  return username in overrides;
}

export async function setStartDate(
  username: string,
  date: string,
  setBy: string,
  nowMs: number,
): Promise<StartDateMap> {
  if (!startDatesStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  if (!findEmployeeByUsername(username)) {
    throw new Error(`Utilizador desconhecido: ${username}`);
  }
  if (!isValidISODate(date)) {
    throw new Error("Data inválida — usa o formato do calendário.");
  }
  const current = await getStartDates();
  const next: StartDateMap = {
    ...current,
    [username]: { date, setBy, setAt: nowMs },
  };
  await kv.set(KEY, next);
  return next;
}

/** Remove o override — a pessoa volta ao default da credencial. */
export async function clearStartDate(username: string): Promise<StartDateMap> {
  if (!startDatesStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const current = await getStartDates();
  if (!(username in current)) return current;
  const next = { ...current };
  delete next[username];
  await kv.set(KEY, next);
  return next;
}

/** Quantas pessoas do roster ainda estão a correr com a data por defeito —
 *  o aviso que o painel de Inscrições mostra ao C-Level. */
export function pendingStartDateCount(overrides: StartDateMap): number {
  return EMPLOYEE_CREDENTIALS.filter((c) => !(c.username in overrides)).length;
}
