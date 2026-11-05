// Origem de Pacientes — quem entra em /<slug>/origem:
//   • a receção do cliente — com o PIN do cliente (6 dígitos), que emite um
//     cookie próprio (`orig_<slug>`, HMAC com o AUTH_SIGNING_SECRET da app,
//     180 dias: o tablet da receção não volta a pedir o PIN todas as semanas);
//   • a equipa WonderAds — qualquer sessão válida entra direto. Regista quem
//     pode editar o SEO; o «ver como» é só leitura.
//
// A página e as APIs estão fora do matcher do middleware (como o Reviews
// Hub): a verificação é toda feita aqui.
//
// O PIN NÃO vive no repo: só o scrypt (salt + hash, os parâmetros de
// src/lib/auth/password.ts). O texto fica com o André, num ficheiro no
// Desktop. Para trocar: salt novo + `scryptSync(novo, salt, 64)` em hex.

import "server-only";
import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { editableDepts } from "@/lib/auth/credentials";
import { getCurrentEmployee, getImpersonation } from "@/lib/auth/server";
import { getOrigemConfig } from "./config";

const PINS: Record<string, { salt: string; hash: string }> = {
  mymedic: {
    salt: "19883fe4975a64a7bc8814f82ef4a16d",
    hash: "06339164a90ca7b688361031ca72ed78563387525bc142d96e5f823746c6f9842c069beb418dbfc330e0105eee00b48fcf8abae0bd0e53a98177edd92d3e19a6",
  },
  // v78.76: um PIN por cliente (o texto está no ficheiro «Acessos — Origem dos
  // clientes (PINs e links)» no Desktop do André).
  "aeger-prima": {
    salt: "5c9e03595018bf43d863e5f40bbc8cd7",
    hash: "41e520895b90885702a108115c53bb569e669f2f3a6148ad9e2ad643341a0f39feb137e94a5cf72971f3a107a0bcfe62a46855efe51ae1f4ba9cf306ea12ca70",
  },
  "antonio-gaspar": {
    salt: "4da28e06b880da9e1017574596ca1454",
    hash: "f60862cd13e5435787d96739f1e9caf3a1a5751b30f4874ca8205f4cf49844a6593e7e1bc88a0430efe87a78316eb26bdd537ac0306a979f4860a91d7b9d05bd",
  },
  "atn-medical": {
    salt: "1d10602e575e45494564610329b56ee3",
    hash: "287970c78e6d99501a1e610dea1b286621b3c254ce4654d3b6dcd32d8de270381136e496f9de518bd36378d964cae1e6f094a63fce2561817472c0868489d7bd",
  },
  "b-life": {
    salt: "1c5467e2d0afa306488dac0b617bc3f3",
    hash: "25c96df1070fdc4e04a90859742362406be9c491914ff131a7f33e0f55daeb1b499256da811f831abc57850a74400495f93e7ba9687b20e0e9e57dfbe9044edf",
  },
  "brancoptica": {
    salt: "71dc11cbcb5fdbe1529adbf39bab5540",
    hash: "447524752db38428a1038dad1b7446905fe2000820f49f976f86f7ca008be617257c1cbec30e5df8fcfea3d174ff69cf7111820463ab230a214bc9fbe6e6ca4c",
  },
  "cdt": {
    salt: "6bc9b694b80ccd7d9a75944954dbc8b3",
    hash: "d147e997a423ea41b0f873508545aa0fc7dbc037b415bd9c3cce6f77a581adb5a76bb8a4f8570067573cb5afa6e5f60ba79581239d3467da2c3a1b618e784589",
  },
  "cidalia-cabeleireiros": {
    salt: "5ae851c4914b18c5ed25c3079db352b5",
    hash: "36cb108d8516098718b871dc4e96bcad8b1e6ddef9eb213168d861fe54b708e01cb286384f5b27d67d96da635f94607e94bf801dd167c1fd9c11c7884d1a3dd1",
  },
  "clinica-medica-dentaria-colegio-militar": {
    salt: "a19414a3d6b561613de0e7c18338555a",
    hash: "26d9aa2004fdc2aa4baa5ac34ea7b70ca4da369a35a166f5547bf5b828e739cc7931a7d1eba7274cae122db19e95b738bf332344342ca69c703034c2c60cedbe",
  },
  "clinica-fernando-almeida": {
    salt: "55258c2f361e529e4555410a85acddc6",
    hash: "809a146ee11bf939f84fea3bf1cd66fde675110e277d2f89b63cf11e9f0f1aaff3ec6ba7aa2fd5377f5ba18523526549bb2fbe3fef5256b044ffd54fcbad894d",
  },
  "maratona-clube-de-portugal": {
    salt: "ee42a6fcb94fe3e87098b5bc498ff3a8",
    hash: "c4f5d21edfbe9ea838d31a19f592827f6299bfe02691ed7061dee19ada812c114fc506ba05104980efb47d5af231a6ebc36f5b06566de7db6f126640d23f4ab4",
  },
  "medway": {
    salt: "79cee72e77dc1436d4222d585749d736",
    hash: "4f369d851ef5970159043947054800e01fd3fffca2908456c2a49500ace4fedc8bf4b568dc89ede2234fcc077f1a32a14156801a13a0c034eb5cf4bb855fce8d",
  },
  "clinica-mimus": {
    salt: "b0545af7c1daaac9e47b48ed3e67ebff",
    hash: "64b422b5859210b2fc5590f3a8a17cddde5ea7fbe168106ee30000658458f0e98ed3020398aa38502e979827e9422655ae7ce960591106a918f2644b313f1577",
  },
  "monte-mar": {
    salt: "3c69b8362878d31ff64962ac559ddb51",
    hash: "6cf71db7d5e8a60ad1d15c75c24396dcee72ad628c96019922e382b64a1f3840c140345ab1a7eaa08c42c0314ee2531d0ced57c915b7b63870a734a1a8af114b",
  },
  "physio-hub": {
    salt: "d2281a4f71c5f4f07fedb678be692a16",
    hash: "f181cddd5ba15968154ca2dd214e39faf17c9f44673484d8f569651085b294106e4c2dd95d85d8ed2f6640ab4ec37aed245219f30806ede7c5ef354e7a737448",
  },
  "sentir-saude": {
    salt: "6e666f8a94d48872541955eb8f6f50b3",
    hash: "924c8b110dfc93ec9a0353abc42a59fcbb2570955f9039759e795d97fa0fae182d83c847baacbc99108e43be5df4a6742b08bf1bba33b456f24593f3186561be",
  },
  "spine-center": {
    salt: "5845210439891335e829ecb38f19ce8f",
    hash: "5e6936bf7d9886ba06a73b07837ec8ed8d60a7e7da226254dc35e6b58c8f5163643976e3285e7ad95491c9592281bc7e5e4c229166e63bb5fef57ed18aef274f",
  },
  "white-clinic": {
    salt: "98480bd45afdfd12ecfee45aec10caeb",
    hash: "3cb935cf65d7eb7047c46022c12c2ded7511b404ac3c7ddb19c36d19f2f265115cfa7deb6a2bc21c77c3fe1ab92c634011069f044a99e91907e1eb12e65a5b35",
  },
};

const KEY_LENGTH = 64;
export const ORIGEM_COOKIE_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

export type OrigemViewer =
  | { kind: "client"; canWrite: true; username: null }
  | { kind: "team"; name: string; username: string; canWrite: boolean };

export function origemCookieName(slug: string): string {
  return `orig_${slug.replace(/[^a-z0-9-]/gi, "")}`;
}

function signingSecret(): string {
  const env = process.env.AUTH_SIGNING_SECRET;
  if (env && env.length >= 16) return env;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SIGNING_SECRET em falta — a Origem de Pacientes não emite cookies sem ele.");
  }
  return "dev-only-do-not-use-in-production-aaaaaaaaaa";
}

const sign = (body: string) => createHmac("sha256", signingSecret()).update(`orig.${body}`).digest("base64url");

export function verifyOrigemPin(slug: string, pin: string): boolean {
  const entry = PINS[slug];
  if (!entry || !/^\d{6}$/.test(pin)) return false;
  const expected = Buffer.from(entry.hash, "hex");
  const got = scryptSync(pin, entry.salt, KEY_LENGTH);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

export function issueOrigemCookie(slug: string): string {
  const body = Buffer.from(
    JSON.stringify({ s: slug, exp: Date.now() + ORIGEM_COOKIE_MAX_AGE_SECONDS * 1000 }),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

function readCookie(slug: string, value: string | undefined): boolean {
  if (!value) return false;
  const dot = value.indexOf(".");
  if (dot <= 0) return false;
  const body = value.slice(0, dot);
  const sig = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(sign(body));
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return false;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { s?: string; exp?: number };
    return p.s === slug && typeof p.exp === "number" && p.exp > Date.now();
  } catch {
    return false;
  }
}

/** Quem está a ver, ou null quando tem de passar pelo PIN. */
export async function getOrigemViewer(slug: string): Promise<OrigemViewer | null> {
  if (!getOrigemConfig(slug)) return null;
  const employee = await getCurrentEmployee().catch(() => null);
  if (employee) {
    const impersonating = Boolean(await getImpersonation().catch(() => null));
    return {
      kind: "team",
      name: employee.name,
      username: employee.username,
      canWrite: !impersonating && !employee.viewerOf && editableDepts(employee).includes("seo"),
    };
  }
  const store = await cookies();
  if (readCookie(slug, store.get(origemCookieName(slug))?.value)) {
    return { kind: "client", canWrite: true, username: null };
  }
  return null;
}
