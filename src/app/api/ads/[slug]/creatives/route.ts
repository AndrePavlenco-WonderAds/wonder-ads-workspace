// Claude Creatives Pro Max — an elite ad-creative-director agent for the
// ADS DPT. Streams creative concepts (hooks, headlines, primary text,
// visual direction, CTA, variations) for Google Ads + Meta Ads. Grounded
// in the client's Campaign Vault and the brief the user provides; writes
// in the CLIENT's language (English for IHN etc.).

import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { getCurrentSession } from "@/lib/auth/server";
import { getAdsClient } from "@/lib/ads-clients";
import { getVault, VAULT_KIND_LABEL } from "@/lib/ads/ads-vault-store";
import { getClientLocale, localeLanguageName } from "@/lib/client-locale";

export const maxDuration = 120;

function systemPrompt(opts: {
  clientName: string;
  language: string;
  vault: Awaited<ReturnType<typeof getVault>>;
  brief: { idea: string; direction: string; copy: string; platform: string; format: string };
}): string {
  const { clientName, language, vault, brief } = opts;
  const vaultLines =
    vault.length === 0
      ? "- (vazio)"
      : vault
          .slice(0, 40)
          .map(
            (v) =>
              `- [${VAULT_KIND_LABEL[v.kind]}]${v.platform ? ` (${v.platform})` : ""} ${v.title}${v.description ? ` — ${v.description}` : ""}`,
          )
          .join("\n");

  return `You are "Claude Creatives Pro Max" — a world-class paid-media creative director for Wonder Ads, expert in high-performing Google Ads and Meta Ads creatives for Health & Wellness brands.

Client: ${clientName}.

OUTPUT LANGUAGE: Write ALL creative output (headlines, primary text, copy, CTAs) in ${language}. The brief notes may be in another language — that's fine, but the deliverable creatives must be in ${language}.

What you produce per request — concrete, ready-to-ship ad creatives:
- 2-3 distinct creative concepts. For each: a one-line angle, a scroll-stopping hook, 3 headline options, primary text, a description/CTA, and a clear VISUAL DIRECTION (what the image/video should show — you describe it; you don't render images).
- Tailor to the platform (Meta feed/stories/reels vs Google RSA/Demand Gen/Display) and the requested format.
- Respect any "copy to use" the user gives — incorporate or refine it, don't discard it.
- Be specific and on-brand. No filler. No fabricated performance claims or medical guarantees.

Then invite the user to refine. Keep iterating conversationally.

## Campaign Vault (context)
${vaultLines}

## Brief from the user
- Platform: ${brief.platform}
- Format: ${brief.format || "(não especificado)"}
- Ideia / ponto de partida: ${brief.idea || "(nenhuma)"}
- Direcionamentos / que criativos usar: ${brief.direction || "(nenhum)"}
- Copy a usar: ${brief.copy || "(nenhuma)"}`;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!(await getCurrentSession())) {
    return new Response("Not authorised", { status: 401 });
  }
  const { slug } = await ctx.params;
  const client = getAdsClient(slug);
  if (!client) return new Response("Unknown client", { status: 404 });

  const {
    messages,
    brief,
  }: {
    messages: UIMessage[];
    brief?: { idea?: string; direction?: string; copy?: string; platform?: string; format?: string };
  } = await req.json();

  const vault = await getVault(slug);
  const system = systemPrompt({
    clientName: client.title,
    language: localeLanguageName(getClientLocale(slug)),
    vault,
    brief: {
      idea: brief?.idea ?? "",
      direction: brief?.direction ?? "",
      copy: brief?.copy ?? "",
      platform: brief?.platform ?? "all",
      format: brief?.format ?? "",
    },
  });

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
