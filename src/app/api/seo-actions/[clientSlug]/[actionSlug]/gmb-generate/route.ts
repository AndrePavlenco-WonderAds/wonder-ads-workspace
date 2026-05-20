// GMB Posts generation endpoint — orchestrates Claude (captions) +
// Gemini Flash Image (creative images), grounded in the full client
// context. Streams NDJSON progress events so the UI can show a real
// phase-by-phase progress bar (not a cycling fake one).
//
// Event shapes:
//   {event:"progress", phase:"context"|"files"|"captions"|"images"|"saving",
//    message:string, filesCount?:number, postsCount?:number}
//   {event:"result", resultId:string, postsCount:number}
//   {event:"error", message:string}

import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { findAction } from "@/lib/seo-pillars";
import { getBriefForSlug } from "@/lib/briefs-storage";
import { getClientBySlug } from "@/lib/notion";
import { getClientWebsite } from "@/lib/client-meta";
import { getOnboardingForSlug } from "@/lib/onboarding-store";
import { listTargetKeywords } from "@/lib/target-keywords-store";
import { getFilesForSlug } from "@/lib/files-storage";
import { fetchImageBytes } from "@/lib/drive-fetcher";
import {
  generateGmbImage,
  imageGenConfigured,
  saveGmbImageToBlob,
  type ReferenceImage,
} from "@/lib/seo-tools/gmb-image-gen";
import {
  GMB_POST_TYPES,
  newGmbPostId,
  newGmbResultId,
  saveGmbResult,
  type GmbCta,
  type GmbPost,
  type GmbPostType,
  type GmbPostsResult,
} from "@/lib/gmb-posts-store";
import { getClientPalette } from "@/lib/client-colors";

export const runtime = "nodejs";
export const maxDuration = 60;

const CAPTION_MODEL = "claude-haiku-4-5-20251001";
const MAX_REFERENCE_IMAGES = 4;

const PostSchema = z.object({
  postType: z
    .enum(GMB_POST_TYPES)
    .describe("Google Business Profile post type."),
  caption: z
    .string()
    .min(40)
    .max(1500)
    .describe(
      "Body of the GMB post, max 1500 chars. Plain text only (no markdown). Lead with the hook; weave 1-2 target keywords naturally; end with a single clear CTA verb. NEVER make medical claims, NEVER promise outcomes for YMYL clients.",
    ),
  cta: z
    .enum(["Learn more", "Book", "Order online", "Buy", "Sign up", "Call now"])
    .nullable()
    .describe("The CTA button — `null` only if no CTA fits."),
  ctaUrl: z
    .string()
    .nullable()
    .describe(
      "URL the CTA links to. Use the default URL the consultant supplied unless a different page makes more sense (e.g. a service page for an Offer post).",
    ),
  imagePrompt: z
    .string()
    .min(20)
    .max(600)
    .describe(
      "Prompt for the image generator. Describe the SCENE the consultant wants in the post image — subject, mood, composition, environment. Do NOT describe brand colors or logos here; reference images handle that.",
    ),
  targetKeywords: z
    .array(z.string())
    .min(0)
    .max(5)
    .describe(
      "1-5 target keywords this post is intentionally seeding. Pick from the consultant's tracked target keyword list when there's a fit.",
    ),
  reasoning: z
    .string()
    .min(10)
    .max(200)
    .describe(
      "One sentence on why this angle was chosen — what the consultant should see at a glance when scanning the grid.",
    ),
});

const BatchSchema = z.object({
  posts: z.array(PostSchema).min(1).max(3),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ clientSlug: string; actionSlug: string }> },
) {
  const { clientSlug, actionSlug } = await ctx.params;
  const entry = findAction(actionSlug);
  if (!entry || entry.action.slug !== "gmb-posts") {
    return NextResponse.json({ error: "Action not supported" }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured." },
      { status: 503 },
    );
  }
  if (!imageGenConfigured) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY is not configured. Add it under Vercel → Settings → Environment Variables (the .env.local.example file has a comment with the link to grab one from Google AI Studio).",
      },
      { status: 503 },
    );
  }

  let body: {
    inputs?: Record<string, string>;
  } = {};
  try {
    body = (await req.json()) as { inputs?: Record<string, string> };
  } catch {
    /* empty body is fine */
  }
  const inputs = body.inputs ?? {};
  const postCount = clampPostCount(inputs.postCount);
  const postTypeInput = parsePostType(inputs.postGoal);
  const theme = (inputs.theme ?? "").trim();
  const details = (inputs.details ?? "").trim();
  const ctaUrlDefault = (inputs.ctaUrl ?? "").trim();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      try {
        send({
          event: "progress",
          phase: "context",
          message: "Loading client brief, onboarding form, and target keywords…",
        });

        const client = await getClientBySlug(clientSlug).catch(() => null);
        if (!client) {
          send({ event: "error", message: "Unknown client." });
          controller.close();
          return;
        }
        const [brief, onboarding, targets, files] = await Promise.all([
          getBriefForSlug(clientSlug),
          getOnboardingForSlug(clientSlug),
          listTargetKeywords(clientSlug),
          getFilesForSlug(clientSlug),
        ]);
        const website = getClientWebsite(clientSlug);
        const palette = getClientPalette(clientSlug);

        // ---- Fetch reference images ----
        send({
          event: "progress",
          phase: "files",
          message: `Fetching reference images from client files + Drive links (${files.length} total)…`,
        });
        const candidateFiles = files
          .filter((f) => f.kind === "image" || f.kind === "link")
          .slice(0, 12);
        const fetched = await Promise.all(
          candidateFiles.map((f) => fetchImageBytes(f.url)),
        );
        const referenceImages: ReferenceImage[] = fetched
          .filter((r): r is NonNullable<typeof r> => r !== null)
          .slice(0, MAX_REFERENCE_IMAGES)
          .map((r) => ({ bytes: r.bytes, mimeType: r.mimeType }));
        if (referenceImages.length === 0) {
          send({
            event: "progress",
            phase: "files",
            message:
              "⚠️ No usable reference images found in Client Files (none uploaded or Drive links private). Image generation will work but won't be anchored to existing brand assets.",
          });
        } else {
          send({
            event: "progress",
            phase: "files",
            message: `✓ Loaded ${referenceImages.length} brand reference image(s).`,
            filesCount: referenceImages.length,
          });
        }

        // ---- Build the Claude prompt ----
        send({
          event: "progress",
          phase: "captions",
          message: `Drafting ${postCount} caption(s) with Claude…`,
        });

        const userPrompt = buildPrompt({
          clientName: client.title,
          website,
          brief,
          onboardingText: onboarding?.extractedText ?? null,
          targets,
          postCount,
          postType: postTypeInput,
          theme,
          details,
          ctaUrlDefault,
        });
        const system = `You are an in-house GMB content strategist for Wonder Ads (Health & Wellness growth agency). You write Google Business Profile posts that:
- read like a real local business update — not promotional, not AI-stocky;
- weave the client's target keywords in naturally for local SEO (no stuffing);
- match the client's brand voice from the brief + onboarding;
- NEVER make medical claims for YMYL clinics, NEVER promise outcomes;
- write in Portuguese (Portugal) if the client's content is Portuguese, otherwise English.
Output STRICT JSON matching the schema. Caption MAX 1500 characters. Do NOT include hashtags. Do NOT include markdown. Do NOT include the brand name in the image prompt — the reference images handle that.`;

        const claudeResult = await generateObject({
          model: anthropic(CAPTION_MODEL),
          schema: BatchSchema,
          system,
          prompt: userPrompt,
          maxOutputTokens: 1800,
        });
        const draft = claudeResult.object;
        if (draft.posts.length === 0) {
          send({
            event: "error",
            message: "Claude returned no posts. Try regenerating with more detail in the Theme field.",
          });
          controller.close();
          return;
        }

        // Trim to requested count (Claude sometimes returns extra).
        const drafts = draft.posts.slice(0, postCount);

        // ---- Generate images in parallel via Gemini ----
        const resultId = newGmbResultId();
        send({
          event: "progress",
          phase: "images",
          message: `Generating ${drafts.length} on-brand image(s) via Gemini Flash Image…`,
        });
        const brandPalette = palette
          ? [palette.from, palette.via, palette.to].filter(
              (c): c is string => Boolean(c),
            )
          : undefined;
        const imageResults = await Promise.all(
          drafts.map(async (d, idx) => {
            try {
              const img = await generateGmbImage({
                prompt: d.imagePrompt,
                referenceImages,
                brandPalette,
              });
              const url = await saveGmbImageToBlob({
                bytes: img.bytes,
                mimeType: img.mimeType,
                clientSlug,
                resultId,
                index: idx,
              });
              return { url, error: null as string | null };
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              return { url: null as string | null, error: message };
            }
          }),
        );

        // ---- Persist ----
        send({
          event: "progress",
          phase: "saving",
          message: "Saving posts to your workspace…",
        });
        const now = Date.now();
        const posts: GmbPost[] = drafts.map((d, idx) => ({
          id: newGmbPostId(),
          postType: d.postType,
          caption: d.caption,
          cta: (d.cta ?? null) as GmbCta,
          ctaUrl: d.ctaUrl || ctaUrlDefault || website || null,
          imageUrl: imageResults[idx].url,
          imagePrompt: d.imagePrompt,
          targetKeywords: d.targetKeywords ?? [],
          reasoning: d.reasoning,
          status: "draft",
          createdAt: now,
          updatedAt: now,
        }));
        const result: GmbPostsResult = {
          id: resultId,
          clientSlug,
          createdAt: now,
          inputs: {
            postCount,
            postType: postTypeInput,
            theme: theme || undefined,
            ctaUrlDefault: ctaUrlDefault || undefined,
          },
          posts,
        };
        await saveGmbResult(result);
        revalidatePath(`/seo/${clientSlug}/actions/gmb-posts`);

        const imageFailures = imageResults.filter((r) => r.error).length;
        if (imageFailures > 0) {
          send({
            event: "progress",
            phase: "images",
            message: `⚠️ ${imageFailures} image generation(s) failed. The captions still saved — open the result to retry the image only.`,
          });
        }
        send({
          event: "result",
          resultId,
          postsCount: posts.length,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send({ event: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}

function clampPostCount(raw: string | undefined): number {
  const n = Math.floor(Number((raw ?? "").trim()));
  if (Number.isNaN(n)) return 2;
  return Math.max(1, Math.min(3, n));
}

function parsePostType(raw: string | undefined): GmbPostType {
  const v = (raw ?? "").trim();
  if ((GMB_POST_TYPES as readonly string[]).includes(v)) return v as GmbPostType;
  return "Update";
}

function buildPrompt(opts: {
  clientName: string;
  website: string | null;
  brief: { dos: string[]; donts: string[]; notes: string[] };
  onboardingText: string | null;
  targets: { keyword: string; searchVolume?: number | null }[];
  postCount: number;
  postType: GmbPostType;
  theme: string;
  details: string;
  ctaUrlDefault: string;
}): string {
  const briefBlock = formatBrief(opts.brief);
  const onboardingBlock = opts.onboardingText
    ? `## Onboarding form excerpt\n\`\`\`\n${opts.onboardingText.slice(0, 2200)}${opts.onboardingText.length > 2200 ? "\n…[truncated]" : ""}\n\`\`\``
    : "";
  const targetsBlock =
    opts.targets.length > 0
      ? `## Tracked target keywords (top 15 by volume)\n${[...opts.targets]
          .sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0))
          .slice(0, 15)
          .map((t) => `- ${t.keyword}`)
          .join("\n")}`
      : "";
  return [
    `# Generate ${opts.postCount} DIFFERENT GMB post(s) for **${opts.clientName}**`,
    `Type for this batch: **${opts.postType}**. Website: ${opts.website ?? "(none on file)"}.`,
    opts.theme ? `\n## Theme / focus\n${opts.theme}` : "",
    opts.details ? `\n## Hard facts that MUST appear literally\n${opts.details}` : "",
    opts.ctaUrlDefault
      ? `\n## Default CTA URL\n${opts.ctaUrlDefault}`
      : `\n## Default CTA URL\n_(none set — use the website URL above)_`,
    briefBlock,
    onboardingBlock,
    targetsBlock,
    `\n## Rules`,
    `- Produce ${opts.postCount} DIFFERENT posts (distinct angles, NOT variants of the same idea).`,
    `- Each caption max 1500 characters, plain text, no markdown.`,
    `- Weave 1-2 target keywords per caption naturally — no stuffing.`,
    `- NEVER make medical claims, NEVER promise outcomes for YMYL clinics.`,
    `- Write in Portuguese (Portugal) when the brief / onboarding is in Portuguese, otherwise English.`,
    `- For \`imagePrompt\`: describe the SCENE (subject, mood, composition). Do NOT mention brand colours or logos — reference images handle that.`,
    `- For \`reasoning\`: ONE sentence on why this angle, for the consultant scanning the grid.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatBrief(brief: {
  dos: string[];
  donts: string[];
  notes: string[];
}): string {
  const parts: string[] = [];
  if (brief.dos.length > 0) {
    parts.push(`### Do's\n${brief.dos.map((d) => `- ${d}`).join("\n")}`);
  }
  if (brief.donts.length > 0) {
    parts.push(
      `### Don'ts (HARD RULES — never violate)\n${brief.donts.map((d) => `- ${d}`).join("\n")}`,
    );
  }
  if (brief.notes.length > 0) {
    parts.push(`### Notes\n${brief.notes.map((n) => `- ${n}`).join("\n")}`);
  }
  if (parts.length === 0) return "";
  return `## Client brief\n${parts.join("\n\n")}`;
}
