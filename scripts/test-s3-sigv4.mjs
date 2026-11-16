// Testa o assinante S3 (src/lib/report/s3-read.ts) contra os exemplos
// publicados pela AWS («Signature Calculations for the Authorization Header:
// Transferring Payload in a Single Chunk»). Correr: node scripts/test-s3-sigv4.mjs
import path from "node:path";
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const { createJiti } = await import(path.join(repo, "node_modules/jiti/lib/jiti.mjs"));
const jiti = createJiti(import.meta.url, { alias: { "@": path.join(repo, "src") } });
const { signS3Get } = await jiti.import(path.join(repo, "src/lib/report/s3-read.ts"));

const creds = { accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", region: "us-east-1" };
const base = { creds, host: "examplebucket.s3.amazonaws.com", amzDate: "20130524T000000Z" };
const cases = [
  ["GET Object", { ...base, path: "/test.txt", extraHeaders: { Range: "bytes=0-9" } }, "f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41"],
  ["GET Bucket (list)", { ...base, path: "/", query: { "max-keys": "2", prefix: "J" } }, "34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7"],
  ["GET lifecycle", { ...base, path: "/", query: { lifecycle: "" } }, "fea454ca298b7da1c68078a5d1bdbfbbe0d65c699e0f91ac7a200a0136783543"],
];
let failed = 0;
for (const [name, opts, want] of cases) {
  const got = signS3Get(opts).authorization.split("Signature=")[1];
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — ${got}`}`);
}
process.exit(failed ? 1 : 0);
