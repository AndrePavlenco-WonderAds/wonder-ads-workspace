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
import {
  fetchImageBytes,
  fetchDriveFile,
  extractDriveFolderId,
  extractDriveFileId,
  fetchImagesFromDriveFolder,
  listImageRefsInDriveFolder,
  downloadDriveImageById,
  type DriveImageRef,
} from "@/lib/drive-fetcher";
import type { ClientFile } from "@/lib/client-files";
import {
  runMiniSiteAudit,
  formatMiniSiteAuditForPrompt,
} from "@/lib/seo-tools/mini-site-audit";
import { shrinkForVisionInput } from "@/lib/seo-tools/thumbnail";
import { getClientGeo } from "@/lib/client-geo";
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
  // Build the "Hard facts" block from the post-type-specific inputs.
  // The form surfaces different fields for Offer / Event / Product /
  // Update; we collapse them into a single markdown block so the
  // prompt always sees a consistent shape.
  const details = buildHardFactsBlock(postTypeInput, inputs);
  const ctaUrlDefault = (inputs.ctaUrl ?? "").trim();
  const imageSource = parseImageSource(inputs.imageSource);

  // AI mode requires the Gemini key; client-files mode doesn't.
  if (imageSource === "ai-generated" && !imageGenConfigured) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY is not configured. Either pick \"Use client's photos\" instead, or add the key under Vercel → Settings → Environment Variables (see .env.local.example for the link).",
      },
      { status: 503 },
    );
  }

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
        const geo = getClientGeo(clientSlug);

        // ---- Mini site audit (ABSOLUTE RULE before every generation) ----
        // This is the fix for the "Sea Yourself → scuba diving" failure:
        // Claude can't lean on the brand name when the brief is weak. The
        // homepage + about-page text below becomes the source of truth
        // about what the business actually does.
        send({
          event: "progress",
          phase: "context",
          message:
            "Auditing the client's website so the posts ground in what the business actually does…",
        });
        let siteAuditBlock = "";
        if (website) {
          try {
            const audit = await runMiniSiteAudit(website);
            if (audit && (audit.title || audit.bodyExcerpt)) {
              siteAuditBlock = formatMiniSiteAuditForPrompt(audit);
              send({
                event: "progress",
                phase: "context",
                message: `✓ Site audit ready (${audit.h1s.length} H1${audit.h1s.length === 1 ? "" : "s"}, ${audit.bodyExcerpt.length} chars of body text${audit.aboutUrl ? ", about page included" : ""}).`,
              });
            } else {
              send({
                event: "progress",
                phase: "context",
                message:
                  "⚠️ Couldn't fetch the homepage — generation will rely on brief + onboarding only.",
              });
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            send({
              event: "progress",
              phase: "context",
              message: `⚠️ Site audit failed (${msg.slice(0, 80)}) — proceeding with brief + onboarding only.`,
            });
          }
        } else {
          send({
            event: "progress",
            phase: "context",
            message:
              "⚠️ No website on file for this client — generation will rely on brief + onboarding only.",
          });
        }

        // ---- Pre-pick branch: client-files OR AI-generate ----
        const resultId = newGmbResultId();
        let posts: GmbPost[] = [];
        const referencesUsed: import("@/lib/gmb-posts-store").GmbReferenceFile[] = [];

        if (imageSource === "client-files") {
          // ===== CLIENT-FILES MODE =====
          // App picks N images from the client's library and Claude writes
          // a vision-grounded caption for each. No Gemini call.
          send({
            event: "progress",
            phase: "files",
            message: `Collecting images from ${files.length} Client Files entr${files.length === 1 ? "y" : "ies"}…`,
          });
          const pool = await buildImagePool(files, referencesUsed);
          console.info(
            `[gmb-generate] client-files pool: ${pool.length} candidate images`,
          );
          if (pool.length === 0) {
            // Surface the per-entry reasons so the consultant knows
            // exactly WHY each Client Files entry was rejected. Empty
            // pool with no diagnostic was the failure mode that made
            // the v71.7 first test inscrutable.
            const failed = referencesUsed.filter((r) => r.status === "failed");
            const skipped = referencesUsed.filter((r) => r.status === "skipped");
            const detailLines: string[] = [];
            for (const r of failed) {
              detailLines.push(`✕ ${r.name} — ${r.reason ?? "no reason captured"}`);
            }
            for (const r of skipped) {
              detailLines.push(`• ${r.name} — ${r.reason ?? "skipped"}`);
            }
            const detail =
              detailLines.length > 0
                ? `\n\nDetails per Client Files entry:\n${detailLines.join("\n")}`
                : "";
            send({
              event: "error",
              message: `No images available in this client's library.${detail}\n\nFixes: upload images in Client Files, OR share the Drive folder with seo@wonder-ads.com (Viewer is enough) AND make sure the drive.readonly scope is authorized in Workspace Admin Console domain-wide delegation. Or switch to AI-generate mode.`,
            });
            controller.close();
            return;
          }
          // Random-sample up to postCount.
          const picked = shuffle([...pool]).slice(0, postCount);
          const actualCount = picked.length;
          if (actualCount < postCount) {
            send({
              event: "progress",
              phase: "files",
              message: `⚠️ Only ${actualCount} image(s) available in the library — generating ${actualCount} post(s) instead of the requested ${postCount}. Upload more brand photos to lift the cap.`,
            });
          } else {
            send({
              event: "progress",
              phase: "files",
              message: `✓ Picked ${actualCount} random image(s) from the library of ${pool.length}.`,
              filesCount: actualCount,
            });
          }

          // Per-post Claude vision caption. Sequential rather than parallel
          // so we don't slam the Anthropic API and so progress events
          // remain meaningful. Each call is ~3-6s with Haiku 4.5 → total
          // 9-18s for 3 posts, well under the 60s budget.
          send({
            event: "progress",
            phase: "captions",
            message: `Writing ${actualCount} caption(s) with Claude (vision)…`,
          });
          const now = Date.now();
          for (let i = 0; i < picked.length; i++) {
            const entry = picked[i];
            // Download bytes for vision input.
            const bytes = await entry.fetch();
            if (!bytes) {
              referencesUsed.push({
                name: entry.breadcrumb,
                url: entry.originUrl,
                status: "failed",
                reason: "Picked image couldn't be downloaded — auth or quota issue.",
              });
              continue;
            }
            // Re-host Drive images to Blob so the card has a stable URL.
            // Uploads already have a stable URL — pass-through.
            let blobUrl: string;
            if (entry.publicUrl) {
              blobUrl = entry.publicUrl;
            } else {
              blobUrl = await saveGmbImageToBlob({
                bytes: bytes.bytes,
                mimeType: bytes.mimeType,
                clientSlug,
                resultId,
                index: i,
              });
            }
            // Claude vision call for the matching caption. Downscale
            // first — Anthropic rejects images >~5MB and clinic photos
            // are routinely full-res prints (4-8MB). The shrunk version
            // is ONLY used as vision input; the post still saves the
            // original (or its re-host) as its imageUrl.
            let visionBytes: Uint8Array;
            let visionMime: string;
            try {
              const shrunk = await shrinkForVisionInput(bytes.bytes);
              visionBytes = shrunk.bytes;
              visionMime = shrunk.mimeType;
            } catch (err) {
              // sharp failures are rare (corrupt file, unsupported
              // format) — fall back to the original bytes and let
              // Claude's payload-size check reject it gracefully.
              console.warn(
                `[gmb-generate] thumbnail shrink failed for ${entry.breadcrumb}, falling back to original: ${err instanceof Error ? err.message : String(err)}`,
              );
              visionBytes = bytes.bytes;
              visionMime = bytes.mimeType;
            }
            try {
              const captionResult = await generateObject({
                model: anthropic(CAPTION_MODEL),
                schema: SinglePostSchema,
                system: clientFilesSystemPrompt(geo.languageCode),
                messages: [
                  {
                    role: "user",
                    content: [
                      {
                        type: "image",
                        image: visionBytes,
                        mediaType: visionMime,
                      },
                      {
                        type: "text",
                        text: buildClientFilesPrompt({
                          clientName: client.title,
                          website,
                          brief,
                          onboardingText: onboarding?.extractedText ?? null,
                          targets,
                          postType: postTypeInput,
                          theme,
                          details,
                          ctaUrlDefault,
                          siteAuditBlock,
                          languageCode: geo.languageCode,
                          imageFilename: bytes.filename,
                          postIndex: i,
                          totalPosts: actualCount,
                        }),
                      },
                    ],
                  },
                ],
                maxOutputTokens: 1200,
              });
              const cap = captionResult.object;
              posts.push({
                id: newGmbPostId(),
                postType: cap.postType,
                caption: cap.caption,
                cta: (cap.cta ?? null) as GmbCta,
                ctaUrl: cap.ctaUrl || ctaUrlDefault || website || null,
                imageUrl: blobUrl,
                imageError: null,
                imageSource: "client-files",
                imageOrigin: entry.breadcrumb,
                imagePrompt: `[client photo: ${entry.breadcrumb}]`,
                targetKeywords: cap.targetKeywords ?? [],
                reasoning: cap.reasoning,
                status: "draft",
                createdAt: now,
                updatedAt: now,
              });
              referencesUsed.push({
                name: entry.breadcrumb,
                url: entry.originUrl,
                status: "used",
              });
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error(
                `[gmb-generate] client-files caption failed for ${entry.breadcrumb}:`,
                err,
              );
              referencesUsed.push({
                name: entry.breadcrumb,
                url: entry.originUrl,
                status: "failed",
                reason: `Claude caption call failed: ${msg.slice(0, 160)}`,
              });
            }
          }
          // Persist
          send({
            event: "progress",
            phase: "saving",
            message: "Saving posts to your workspace…",
          });
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
            referencesUsed,
            posts,
          };
          await saveGmbResult(result);
          revalidatePath(`/seo/${clientSlug}/actions/gmb-posts`);
          send({ event: "result", resultId, postsCount: posts.length });
          controller.close();
          return;
        }

        // ===== AI-GENERATED MODE (original flow) =====
        // ---- Fetch reference images ----
        send({
          event: "progress",
          phase: "files",
          message: `Fetching reference images from client files + Drive links (${files.length} total)…`,
        });
        const candidateFiles = files
          .filter((f) => f.kind === "image" || f.kind === "link")
          .slice(0, 12);
        // Track every candidate's fate for the result page diagnostic so
        // consultants can see exactly which Drive links / uploads were
        // pulled in and which got rejected (private Drive link, non-image
        // mime, fetch failure, etc.). The `referencesUsed` array was
        // already declared above the branch.
        const referenceImages: ReferenceImage[] = [];
        for (const f of candidateFiles) {
          if (referenceImages.length >= MAX_REFERENCE_IMAGES) {
            referencesUsed.push({
              name: f.name,
              url: f.url,
              status: "skipped",
              reason: `cap of ${MAX_REFERENCE_IMAGES} reference images already reached`,
            });
            continue;
          }
          // Drive FOLDER link: list contents, recurse into sub-folders,
          // download up to the remaining slot count. Consultants paste
          // folder links far more often than individual file links
          // because Drive folders hold whole photo sessions (e.g.
          // "Sessão 9 — Abril 2026" with 56 photos).
          const folderId = extractDriveFolderId(f.url);
          if (folderId) {
            const slotsLeft = MAX_REFERENCE_IMAGES - referenceImages.length;
            const { images, totalFound, error } = await fetchImagesFromDriveFolder(
              folderId,
              { maxImages: slotsLeft },
            );
            for (const img of images) {
              referenceImages.push({
                bytes: img.bytes,
                mimeType: img.mimeType,
              });
              referencesUsed.push({
                name: `${f.name} → ${img.filename}`,
                url: f.url,
                status: "used",
              });
            }
            if (images.length === 0) {
              referencesUsed.push({
                name: f.name,
                url: f.url,
                status: "failed",
                reason:
                  error ??
                  "Drive folder couldn't be listed (share with seo@wonder-ads.com or make anyone-with-link public)",
              });
            } else if (totalFound > images.length) {
              // Informational: we used 4 of 47 images. Append a note to
              // the LAST "used" row so the diagnostic surfaces this.
              const lastIdx = referencesUsed.length - 1;
              referencesUsed[lastIdx] = {
                ...referencesUsed[lastIdx],
                reason: `${images.length} of ${totalFound} images in folder used as references`,
              };
            }
            continue;
          }
          try {
            const r = await fetchImageBytes(f.url);
            if (r) {
              referenceImages.push({ bytes: r.bytes, mimeType: r.mimeType });
              referencesUsed.push({ name: f.name, url: f.url, status: "used" });
            } else {
              referencesUsed.push({
                name: f.name,
                url: f.url,
                status: "failed",
                reason: f.url.includes("drive.google.com")
                  ? "Drive file isn't accessible — share it with seo@wonder-ads.com (Viewer is enough) OR make it anyone-with-link public, then retry"
                  : "could not fetch as an image (private, removed, or non-image mime-type)",
              });
            }
          } catch (err) {
            referencesUsed.push({
              name: f.name,
              url: f.url,
              status: "failed",
              reason: err instanceof Error ? err.message.slice(0, 120) : "fetch error",
            });
          }
        }
        // Files with kind !== image/link (e.g. videos) get counted as
        // skipped too, so the consultant sees the full picture.
        for (const f of files.filter(
          (f) => f.kind !== "image" && f.kind !== "link",
        )) {
          referencesUsed.push({
            name: f.name,
            url: f.url,
            status: "skipped",
            reason: `kind '${f.kind}' isn't a reference-image candidate`,
          });
        }
        console.info(
          `[gmb-generate] reference files: ${referenceImages.length} used / ${referencesUsed.filter((r) => r.status === "failed").length} failed / ${referencesUsed.filter((r) => r.status === "skipped").length} skipped (of ${files.length} total in library)`,
        );
        if (referenceImages.length === 0) {
          send({
            event: "progress",
            phase: "files",
            message:
              "⚠️ No usable reference images found in Client Files. Image generation will work but won't be anchored to existing brand assets — upload brand photos and re-share Drive links publicly to fix.",
          });
        } else {
          send({
            event: "progress",
            phase: "files",
            message: `✓ Using ${referenceImages.length} brand reference image(s) (of ${candidateFiles.length} candidates).`,
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
          siteAuditBlock,
          languageCode: geo.languageCode,
        });
        const languageDirective = languageInstructionFor(geo.languageCode);
        const system = `You are an in-house GMB content strategist for Wonder Ads (Health & Wellness growth agency). You write Google Business Profile posts that:
- read like a real local business update — not promotional, not AI-stocky;
- weave the client's target keywords in naturally for local SEO (no stuffing);
- match the client's brand voice from the brief + onboarding;
- NEVER make medical claims for YMYL clinics, NEVER promise outcomes;
- ${languageDirective}.

**ABSOLUTE RULE — read the Site Audit before writing anything.** The user prompt contains a "## Site audit" block with homepage + about-page text. THAT is the source of truth about what the business actually does. **NEVER infer from the brand name.** Many client names are wordplay (e.g. "Sea Yourself" is a mental-health clinic, NOT a diving school; "Aeger Prima" is a dental clinic, not a beauty brand). If the brief is weak (few/no Do's/Don'ts/Notes), lean MORE on the site audit, not less. If you cannot confidently identify the business from the site audit + brief + onboarding, write a SAFE generic local-business post (welcome, opening hours, how to find us) rather than guessing.

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
        // `resultId` declared up above the branch is reused here.
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
              // Log full error to Vercel server logs so the dev tab can
              // show it. The surfaced message on the card is the
              // important UX signal but the stack trace + cause helps
              // diagnose tier / quota / region / safety issues.
              console.error(
                `[gmb-generate] image gen failed for post ${idx}:`,
                err,
              );
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
        // Reuse the `posts` accumulator declared above the branch.
        posts = drafts.map((d, idx) => ({
          id: newGmbPostId(),
          postType: d.postType,
          caption: d.caption,
          cta: (d.cta ?? null) as GmbCta,
          ctaUrl: d.ctaUrl || ctaUrlDefault || website || null,
          imageUrl: imageResults[idx].url,
          imageError: imageResults[idx].error,
          imageSource: "ai-generated",
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
          referencesUsed,
          posts,
        };
        await saveGmbResult(result);
        revalidatePath(`/seo/${clientSlug}/actions/gmb-posts`);

        const imageFailures = imageResults.filter((r) => r.error);
        if (imageFailures.length > 0) {
          // Surface the actual error message instead of a generic "failed"
          // so consultants can see whether it's a quota / model name /
          // safety filter / config issue and act on it.
          const firstMsg = imageFailures[0].error?.slice(0, 240) ?? "unknown";
          send({
            event: "progress",
            phase: "images",
            message: `⚠️ ${imageFailures.length} image generation(s) failed. The captions still saved. First error: ${firstMsg}`,
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

/** Map the form's human-readable imageSource label to the internal
 *  enum. Defaults to client-files (the consultant's preferred path). */
function parseImageSource(
  raw: string | undefined,
): "client-files" | "ai-generated" {
  const v = (raw ?? "").trim().toLowerCase();
  if (v.startsWith("ai") || v.includes("gemini")) return "ai-generated";
  return "client-files";
}

/** Collapse the per-post-type structured inputs (offer headline,
 *  discount, event dates, product price, etc.) into the "Hard facts"
 *  markdown block the Claude prompt expects. Replaces the old free-
 *  form `details` textarea — captions can now reliably include the
 *  literal numbers / dates / titles a real GMB post needs. */
function buildHardFactsBlock(
  postType: GmbPostType,
  inputs: Record<string, string>,
): string {
  const lines: string[] = [];
  const v = (k: string) => (inputs[k] ?? "").trim();
  switch (postType) {
    case "Offer": {
      const title = v("offerTitle");
      if (title) lines.push(`- **Offer headline:** ${title}`);
      const discount = v("offerDiscount");
      if (discount) lines.push(`- **Discount:** ${discount}`);
      const from = v("offerValidFrom");
      const until = v("offerValidUntil");
      if (from && until) {
        lines.push(`- **Valid:** ${from} → ${until}`);
      } else if (from) {
        lines.push(`- **Valid from:** ${from}`);
      } else if (until) {
        lines.push(`- **Valid until:** ${until}`);
      }
      const terms = v("offerTerms");
      if (terms) lines.push(`- **Terms:** ${terms}`);
      break;
    }
    case "Event": {
      const title = v("eventTitle");
      if (title) lines.push(`- **Event:** ${title}`);
      const start = v("eventStart");
      const end = v("eventEnd");
      const time = v("eventTime");
      if (start && end) {
        lines.push(`- **Dates:** ${start} → ${end}${time ? ` · ${time}` : ""}`);
      } else if (start) {
        lines.push(`- **Date:** ${start}${time ? ` · ${time}` : ""}`);
      }
      const loc = v("eventLocation");
      if (loc) lines.push(`- **Location:** ${loc}`);
      const det = v("eventDetails");
      if (det) lines.push(`- **Details:** ${det}`);
      break;
    }
    case "Product": {
      const name = v("productName");
      if (name) lines.push(`- **Product / service:** ${name}`);
      const price = v("productPrice");
      if (price) lines.push(`- **Price:** ${price}`);
      const hl = v("productHighlights");
      if (hl) lines.push(`- **Highlights:** ${hl}`);
      break;
    }
    case "Update":
    default: {
      const det = v("updateDetails");
      if (det) lines.push(det);
      break;
    }
  }
  return lines.join("\n");
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
  siteAuditBlock: string;
  languageCode: string;
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
    // Site audit FIRST — Claude reads top-down, so this is what it sees
    // before brief/onboarding/targets. Reinforces the absolute rule.
    opts.siteAuditBlock,
    opts.theme ? `\n## Theme / focus\n${opts.theme}` : "",
    opts.details ? `\n## Hard facts that MUST appear literally\n${opts.details}` : "",
    opts.ctaUrlDefault
      ? `\n## Default CTA URL\n${opts.ctaUrlDefault}`
      : `\n## Default CTA URL\n_(none set — use the website URL above)_`,
    briefBlock,
    onboardingBlock,
    targetsBlock,
    `\n## Rules`,
    `- **Read the Site Audit above first.** What the business does is determined by the audit, NOT by the brand name.`,
    `- Produce ${opts.postCount} DIFFERENT posts (distinct angles, NOT variants of the same idea).`,
    `- Each caption max 1500 characters, plain text, no markdown.`,
    `- Weave 1-2 target keywords per caption naturally — no stuffing.`,
    `- NEVER make medical claims, NEVER promise outcomes for YMYL clinics.`,
    `- ${languageInstructionFor(opts.languageCode)}.`,
    `- For \`imagePrompt\`: describe the SCENE — subject, mood, composition, environment, lighting. Do NOT request a logo, brand name, slogan, or any text overlay in the image; do NOT mention brand colours (the image generator handles brand from the reference images). Bias toward real-looking human / place / object scenes, never AI-stocky abstractions.`,
    `- For \`reasoning\`: ONE sentence on why this angle, for the consultant scanning the grid.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Map ClientGeo languageCode → an unambiguous human-language directive
 *  for the prompt. Portuguese clients get European Portuguese explicitly
 *  (NOT Brazilian) because the agency operates in Portugal — the
 *  vocabulary, accent marks, and verb forms differ in ways consultants
 *  notice immediately ("você" vs "tu", "celular" vs "telemóvel" etc.). */
function languageInstructionFor(languageCode: string): string {
  switch (languageCode) {
    case "pt":
      return "Write captions and ALL string fields in **European Portuguese (Portugal, pt-PT)** — NOT Brazilian Portuguese. Use \"tu\" by default (or \"você\" only when the brand voice from the audit is explicitly formal), \"telemóvel\" not \"celular\", \"casa de banho\" not \"banheiro\", \"autocarro\" not \"ônibus\", etc.";
    case "es":
      return "Write captions in **European Spanish (Spain)** unless the audit shows a Latin-American audience.";
    case "fr":
      return "Write captions in **French (France)**.";
    case "it":
      return "Write captions in **Italian**.";
    case "de":
      return "Write captions in **German**.";
    case "en":
    default:
      return "Write captions in **English**, matching the tone the audit / brief implies (UK vs US neutral)";
  }
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

// ===== Client-files mode helpers =====

type PoolEntry = {
  /** Breadcrumb path for diagnostics — "Sessão 9 → IMG_5612.jpg". */
  breadcrumb: string;
  /** Original Client File link / blob URL — kept so the diagnostic row
   *  can link back to the source even when the actual image lives
   *  somewhere else (Drive). */
  originUrl: string;
  /** Stable public URL if the image is already on Vercel Blob.
   *  null when it'll need to be re-hosted after picking. */
  publicUrl: string | null;
  /** Lazy download — only invoked for the picked images, not the whole
   *  pool. Returns null on auth/fetch failure. */
  fetch: () => Promise<{
    bytes: Uint8Array;
    mimeType: string;
    filename: string;
  } | null>;
};

/** Schema for the per-image vision-grounded caption in client-files
 *  mode. Mirrors the batch schema minus `imagePrompt` (the image is
 *  already provided). */
const SinglePostSchema = z.object({
  postType: z.enum(GMB_POST_TYPES),
  caption: z.string().min(40).max(1500),
  cta: z
    .enum(["Learn more", "Book", "Order online", "Buy", "Sign up", "Call now"])
    .nullable(),
  ctaUrl: z.string().nullable(),
  targetKeywords: z.array(z.string()).min(0).max(5),
  reasoning: z.string().min(10).max(200),
});

/** Build a flat pool of image candidates from a client's library. Each
 *  pool entry has a lazy `fetch` so we only download the images we
 *  actually pick. Records every entry that DIDN'T make it into the
 *  pool (via `referencesUsed`) so the result page diagnostic stays
 *  accurate. */
async function buildImagePool(
  files: ClientFile[],
  referencesUsed: import("@/lib/gmb-posts-store").GmbReferenceFile[],
): Promise<PoolEntry[]> {
  const pool: PoolEntry[] = [];
  for (const f of files) {
    if (f.kind === "image") {
      // Vercel Blob upload — public URL, stable. No re-host needed.
      pool.push({
        breadcrumb: f.name,
        originUrl: f.url,
        publicUrl: f.url,
        fetch: async () => {
          try {
            const res = await fetch(f.url);
            if (!res.ok) return null;
            const buf = new Uint8Array(await res.arrayBuffer());
            return {
              bytes: buf,
              mimeType:
                res.headers.get("content-type") ?? "application/octet-stream",
              filename: f.name,
            };
          } catch {
            return null;
          }
        },
      });
      continue;
    }
    if (f.kind !== "link") {
      referencesUsed.push({
        name: f.name,
        url: f.url,
        status: "skipped",
        reason: `kind '${f.kind}' isn't an image candidate`,
      });
      continue;
    }
    // Drive folder
    const folderId = extractDriveFolderId(f.url);
    if (folderId) {
      const { refs, error } = await listImageRefsInDriveFolder(folderId, {
        rootLabel: f.name,
      });
      if (error || refs.length === 0) {
        referencesUsed.push({
          name: f.name,
          url: f.url,
          status: "failed",
          reason:
            error ??
            "Drive folder has no image files (looked recursively up to depth 2)",
        });
        continue;
      }
      for (const ref of refs) {
        pool.push({
          breadcrumb: ref.breadcrumb,
          originUrl: f.url,
          publicUrl: null,
          fetch: () => downloadDriveImageById(ref),
        });
      }
      continue;
    }
    // Drive single file
    if (extractDriveFileId(f.url)) {
      pool.push({
        breadcrumb: f.name,
        originUrl: f.url,
        publicUrl: null,
        fetch: () => fetchDriveFile(f.url),
      });
      continue;
    }
    // Other URL (public CDN, etc.)
    pool.push({
      breadcrumb: f.name,
      originUrl: f.url,
      publicUrl: f.url,
      fetch: () => fetchImageBytes(f.url),
    });
  }
  return pool;
}

/** Fisher–Yates shuffle for random sampling. */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function clientFilesSystemPrompt(languageCode: string): string {
  return `You are an in-house GMB content strategist for Wonder Ads (Health & Wellness growth agency). You're given ONE real photo of the client (already chosen — you don't get to pick) plus the client's brief, onboarding form, target keywords, and site audit. Your job is to write a Google Business Profile post caption that:

- describes / contextualises what's IN the image (so the caption matches the photo a reader is looking at);
- reads like a real local business update — not promotional, not AI-stocky;
- weaves 1–2 target keywords naturally for local SEO (no stuffing);
- matches the client's brand voice from the brief + onboarding + site audit;
- NEVER makes medical claims for YMYL clinics, NEVER promises outcomes;
- ${languageInstructionFor(languageCode)}.

**ABSOLUTE RULE — read the Site Audit before writing.** The user prompt contains a "## Site audit" block describing what the business actually does. NEVER infer business type from the brand name. If the brief + onboarding + audit don't give you a confident read, write a SAFE generic local-business caption.

Output STRICT JSON matching the schema. Caption MAX 1500 characters. No hashtags. No markdown.`;
}

function buildClientFilesPrompt(opts: {
  clientName: string;
  website: string | null;
  brief: { dos: string[]; donts: string[]; notes: string[] };
  onboardingText: string | null;
  targets: { keyword: string; searchVolume?: number | null }[];
  postType: GmbPostType;
  theme: string;
  details: string;
  ctaUrlDefault: string;
  siteAuditBlock: string;
  languageCode: string;
  imageFilename: string;
  postIndex: number;
  totalPosts: number;
}): string {
  const briefBlock = formatBrief(opts.brief);
  const onboardingBlock = opts.onboardingText
    ? `## Onboarding form excerpt\n\`\`\`\n${opts.onboardingText.slice(0, 2000)}${opts.onboardingText.length > 2000 ? "\n…[truncated]" : ""}\n\`\`\``
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
    `# Write a GMB post caption for **${opts.clientName}**`,
    `Image (attached above): \`${opts.imageFilename}\` — this is a real photo from the client. Look at it.`,
    `This is post ${opts.postIndex + 1} of ${opts.totalPosts} in this batch. Default post type: **${opts.postType}** (you can change if the photo clearly suggests a different type).`,
    `Website: ${opts.website ?? "(none on file)"}.`,
    opts.theme ? `\n## Theme / focus\n${opts.theme}` : "",
    opts.details ? `\n## Hard facts that MUST appear literally\n${opts.details}` : "",
    opts.ctaUrlDefault
      ? `\n## Default CTA URL\n${opts.ctaUrlDefault}`
      : `\n## Default CTA URL\n_(none set — use the website URL above)_`,
    opts.siteAuditBlock,
    briefBlock,
    onboardingBlock,
    targetsBlock,
    `\n## Rules`,
    `- **Read the Site Audit first** before writing. Brand name is NEVER the source of truth — the audit is.`,
    `- **Look at the image** and ground the caption in what's actually visible: who/what/where in the photo. The caption should make sense alongside this specific image.`,
    `- Caption max 1500 chars, plain text, no markdown.`,
    `- Weave 1–2 target keywords naturally — no stuffing.`,
    `- NEVER make medical claims / promise outcomes for YMYL clinics.`,
    `- ${languageInstructionFor(opts.languageCode)}.`,
    `- For \`reasoning\`: ONE sentence on why this angle (so the consultant scanning the grid can see at a glance).`,
  ]
    .filter(Boolean)
    .join("\n");
}
