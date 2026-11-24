// O armazenamento da Passagem de consultor (v80.40).
//
// Em produção é o KV. Em desenvolvimento local com DEV_PASSAGEM_FIXTURE=1
// passa a ser um mapa em memória com uma passagem de exemplo — para ver e
// desenhar o cockpit, a ficha e o lado do consultor SEM escrever dados falsos
// no KV partilhado (o .env.local aponta para o KV de produção). Nunca liga
// em produção (NODE_ENV).

import "server-only";
import { kv } from "@vercel/kv";
import { devPassagemSeed } from "./dev-fixture";

export type PassagemDb = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<unknown>;
  mget<T extends unknown[]>(...keys: string[]): Promise<T>;
  del(key: string): Promise<unknown>;
  lpush(key: string, value: string): Promise<unknown>;
  lrange<T>(key: string, start: number, end: number): Promise<T[]>;
};

export const PASSAGEM_DEV_FIXTURE = process.env.NODE_ENV !== "production" && process.env.DEV_PASSAGEM_FIXTURE === "1";

function memoryDb(): PassagemDb {
  // No globalThis: em dev, as páginas e as APIs são módulos diferentes e têm
  // de ver o mesmo mapa.
  const g = globalThis as { __passagemDevKv?: Map<string, unknown> };
  g.__passagemDevKv ??= new Map(Object.entries(devPassagemSeed()));
  const m = g.__passagemDevKv;
  const clone = <T,>(v: unknown): T => (v === undefined ? null : JSON.parse(JSON.stringify(v))) as T;
  return {
    async get<T>(k: string) {
      return clone<T | null>(m.get(k));
    },
    async set(k, v) {
      m.set(k, clone(v));
      return "OK";
    },
    async mget<T extends unknown[]>(...keys: string[]) {
      return keys.map((k) => clone(m.get(k))) as T;
    },
    async del(k) {
      m.delete(k);
      return 1;
    },
    async lpush(k, v) {
      const list = (m.get(k) as string[] | undefined) ?? [];
      m.set(k, [v, ...list]);
      return list.length + 1;
    },
    async lrange<T>(k: string, start: number, end: number) {
      const list = (m.get(k) as unknown[] | undefined) ?? [];
      return clone<T[]>(list.slice(start, end === -1 ? undefined : end + 1));
    },
  };
}

export const db: PassagemDb = PASSAGEM_DEV_FIXTURE ? memoryDb() : (kv as unknown as PassagemDb);
