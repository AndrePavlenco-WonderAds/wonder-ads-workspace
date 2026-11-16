// Leitura mínima de um bucket S3 (v78.96): listar e descarregar objetos,
// assinados com AWS Signature V4 — só GETs, sem SDK (duas operações não
// justificam uma dependência de vários MB).
//
// O assinante segue o exemplo oficial da AWS («Signature Calculations for
// the Authorization Header», GET Object e ListObjects); os testes em
// scripts/test-s3-sigv4.mjs reproduzem as assinaturas publicadas.

import { createHash, createHmac } from "node:crypto";

export type S3Creds = {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
};

const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const sha256Hex = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const hmac = (key: Buffer | string, s: string) => createHmac("sha256", key).update(s, "utf8").digest();

/** Codificação URI da AWS: tudo menos A-Z a-z 0-9 - _ . ~ (e «/» no caminho). */
function awsEncode(s: string, keepSlash: boolean): string {
  let out = "";
  for (const ch of Buffer.from(s, "utf8")) {
    const c = String.fromCharCode(ch);
    if (/[A-Za-z0-9\-_.~]/.test(c) || (keepSlash && c === "/")) out += c;
    else out += `%${ch.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return out;
}

/** Os cabeçalhos assinados de um GET (exportado para os testes). */
export function signS3Get(opts: {
  creds: Pick<S3Creds, "accessKeyId" | "secretAccessKey" | "region">;
  host: string;
  path: string;
  query?: Record<string, string>;
  extraHeaders?: Record<string, string>;
  amzDate: string; // AAAAMMDDTHHMMSSZ
}): Record<string, string> {
  const { creds, host, path, amzDate } = opts;
  const date = amzDate.slice(0, 8);
  const scope = `${date}/${creds.region}/s3/aws4_request`;
  const query = Object.entries(opts.query ?? {})
    .map(([k, v]) => [awsEncode(k, false), awsEncode(v, false)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": EMPTY_SHA256,
    "x-amz-date": amzDate,
  };
  for (const [k, v] of Object.entries(opts.extraHeaders ?? {})) headers[k.toLowerCase()] = v.trim();
  const names = Object.keys(headers).sort();
  const canonical = [
    "GET",
    awsEncode(path, true),
    query,
    names.map((n) => `${n}:${headers[n]}\n`).join(""),
    names.join(";"),
    EMPTY_SHA256,
  ].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonical)].join("\n");
  const kDate = hmac(`AWS4${creds.secretAccessKey}`, date);
  const kSigning = hmac(hmac(hmac(kDate, creds.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", kSigning).update(toSign, "utf8").digest("hex");
  const out: Record<string, string> = { ...headers };
  delete out.host;
  out.authorization = `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${scope},SignedHeaders=${names.join(";")},Signature=${signature}`;
  return out;
}

function amzNow(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

async function s3Get(
  creds: S3Creds,
  path: string,
  query: Record<string, string> = {},
): Promise<Response> {
  const host = `${creds.bucket}.s3.${creds.region}.amazonaws.com`;
  const headers = signS3Get({ creds, host, path, query, amzDate: amzNow() });
  const qs = Object.entries(query)
    .map(([k, v]) => `${awsEncode(k, false)}=${awsEncode(v, false)}`)
    .join("&");
  const url = `https://${host}${awsEncode(path, true)}${qs ? `?${qs}` : ""}`;
  return fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(30_000) });
}

const xmlDecode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

function tags(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g");
  return [...xml.matchAll(re)].map((m) => xmlDecode(m[1]));
}

/** Lista as chaves com um prefixo (todas as páginas), e as «pastas» se
 *  `delimiter` vier preenchido. */
export async function s3List(
  creds: S3Creds,
  prefix: string,
  opts: { delimiter?: string; startAfter?: string; max?: number } = {},
): Promise<{ keys: { key: string; size: number }[]; folders: string[] }> {
  const keys: { key: string; size: number }[] = [];
  const folders: string[] = [];
  let token: string | null = null;
  const max = opts.max ?? 5000;
  do {
    const q: Record<string, string> = { "list-type": "2", prefix };
    if (opts.delimiter) q.delimiter = opts.delimiter;
    if (opts.startAfter && !token) q["start-after"] = opts.startAfter;
    if (token) q["continuation-token"] = token;
    const res = await s3Get(creds, "/", q);
    const xml = await res.text();
    if (!res.ok) {
      const code = tags(xml, "Code")[0] ?? `HTTP ${res.status}`;
      throw new Error(`S3 recusou a listagem (${code}).`);
    }
    for (const block of tags(xml, "Contents")) {
      const key = tags(block, "Key")[0];
      if (key) keys.push({ key, size: Number(tags(block, "Size")[0] ?? 0) });
    }
    for (const block of tags(xml, "CommonPrefixes")) {
      const p = tags(block, "Prefix")[0];
      if (p) folders.push(p);
    }
    token = tags(xml, "IsTruncated")[0] === "true" ? tags(xml, "NextContinuationToken")[0] ?? null : null;
  } while (token && keys.length < max);
  return { keys, folders };
}

/** Descarrega um objeto inteiro. */
export async function s3Download(creds: S3Creds, key: string): Promise<Buffer> {
  const res = await s3Get(creds, `/${key}`);
  if (!res.ok) {
    const xml = await res.text().catch(() => "");
    throw new Error(`S3 recusou ${key} (${tags(xml, "Code")[0] ?? `HTTP ${res.status}`}).`);
  }
  return Buffer.from(await res.arrayBuffer());
}
