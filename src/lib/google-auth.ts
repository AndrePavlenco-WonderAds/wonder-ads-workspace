// Shared Google service-account auth.
//
// One Google Cloud service account (key in GOOGLE_SERVICE_ACCOUNT_JSON) uses
// domain-wide delegation to impersonate GOOGLE_IMPERSONATE_SUBJECT — a
// Workspace user with access to the Search Console + Analytics properties.
// Both the GSC and GA4 integrations get their access tokens from here.

import { JWT } from "google-auth-library";

const IMPERSONATE_SUBJECT = process.env.GOOGLE_IMPERSONATE_SUBJECT || undefined;

export const googleAuthConfigured = Boolean(
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
);

type ServiceAccount = { client_email: string; private_key: string };

function loadServiceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!parsed.client_email || !parsed.private_key) return null;
    return {
      client_email: parsed.client_email,
      // Vercel may store the key with literal "\n" — normalise to newlines.
      private_key: parsed.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
}

// Tokens are cached per scope set — GSC and GA4 use different scopes.
const tokenCache = new Map<string, { token: string; expires: number }>();

/** An OAuth access token for the given scopes, impersonating the configured
 *  Workspace user. Throws if the service account isn't configured. */
export async function getGoogleAccessToken(scopes: string[]): Promise<string> {
  const sa = loadServiceAccount();
  if (!sa) throw new Error("Google service account not configured");

  const key = scopes.join(" ");
  const cached = tokenCache.get(key);
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;

  const jwt = new JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes,
    subject: IMPERSONATE_SUBJECT,
  });
  const { token } = await jwt.getAccessToken();
  if (!token) throw new Error("Failed to obtain a Google access token");

  tokenCache.set(key, { token, expires: Date.now() + 50 * 60_000 });
  return token;
}
