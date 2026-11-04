// O login com o cofre e o portão dos acessos (v78.72). Node only.
//
// Ordem: a password confere-se SEMPRE (mesmo tempo para toda a gente), e só
// depois se olha para o cancelamento — assim «este acesso foi cancelado» só
// aparece a quem sabe a password certa, e não serve para descobrir contas.
//
// Falha aberta: se o KV não responder, vale a linha de credentials.ts, como
// antes da v78.72. Uma password regenerada ou um cancelamento podem não se
// aplicar durante essa falha — preferível a ninguém conseguir entrar.

import "server-only";
import { findEmployeeByUsername } from "@/lib/auth/credentials";
import { matchesHash, verifyEmployeeLogin } from "@/lib/auth/password";
import { getVaultHash, readGateEntryFresh } from "./store";
import type { AccessGateEntry } from "./shared";

export type LoginCheck =
  | { ok: true; username: string }
  | { ok: false; reason: "invalid" | "revoked" };

export async function verifyLoginLive(usernameRaw: string, passwordRaw: string): Promise<LoginCheck> {
  const row = findEmployeeByUsername(usernameRaw);
  if (!row) {
    // Corre o scrypt-isco de sempre (mesmo tempo de resposta).
    verifyEmployeeLogin(usernameRaw, passwordRaw);
    return { ok: false, reason: "invalid" };
  }
  let vault: { salt: string; hash: string } | null = null;
  let gate: AccessGateEntry | null = null;
  try {
    [vault, gate] = await Promise.all([getVaultHash(row.username), readGateEntryFresh(row.username)]);
  } catch {
    vault = null;
    gate = null;
  }
  const ok = vault ? matchesHash(passwordRaw, vault.salt, vault.hash) : matchesHash(passwordRaw, row.salt, row.hash);
  if (!ok) return { ok: false, reason: "invalid" };
  if (gate?.revoked) return { ok: false, reason: "revoked" };
  return { ok: true, username: row.username };
}
