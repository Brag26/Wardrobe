// server/src/services/s3.service.ts
//
// All Amazon S3 interaction for wardrobe photos, plus the background-
// removal pipeline (the "Removing background..." screen in Add Items).
//
// UPLOAD FLOW (presigned URLs — client uploads directly to S3, never
// through this server):
//   1. Client calls POST /api/items/upload-url (single) or
//      POST /api/items/upload-urls (bulk) -> gets one presigned PUT URL
//      per photo.
//   2. Client PUTs the raw image bytes directly to each URL.
//   3. Client calls POST /api/items (single) or POST /api/items/bulk
//      to save the item metadata, passing back the s3Key(s).
//   4. That save call also kicks off background removal (fire-and-forget
//      here; for production, move this to an S3 ObjectCreated -> SQS ->
//      Lambda pipeline so it survives this server restarting mid-job —
//      see infra/serverless.yml's commented-out BackgroundRemovalQueue).
//   5. Client polls GET /api/items/:id (or a websocket/push if you add
//      one) until backgroundRemoval.status is 'done' or 'failed', then
//      swaps to s3KeyProcessed for display.
//
// Requires env vars (see .env.example):
//   AWS_REGION, AWS_S3_BUCKET,
//   BG_REMOVAL_PROVIDER ('removebg' | 'gemini' | 'none'),
//   BG_REMOVAL_API_KEY

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, CopyObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { getWardrobeItemsByIds, updateWardrobeItem } from './mongodb.service';

const REGION = process.env.AWS_REGION ?? 'ap-south-1';
const BUCKET = process.env.AWS_S3_BUCKET ?? '';

if (!BUCKET) {
  console.warn('[s3.service] AWS_S3_BUCKET is not set — uploads will fail until configured.');
}

const s3 = new S3Client({ region: REGION });

export interface UploadUrlResult {
  itemId: string;
  key: string;
  uploadUrl: string;
}

export async function getWardrobeUploadUrl(userId: string, fileExtension: string = 'jpg'): Promise<UploadUrlResult> {
  const itemId = randomUUID();
  const key = `wardrobe/${userId}/${itemId}/original.${fileExtension}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`,
  });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

  return { itemId, key, uploadUrl };
}

/** Separate path from wardrobe items — this is a selfie for color
 * analysis, not a clothing photo, so it's kept in its own prefix. */
export async function getProfilePhotoUploadUrl(userId: string, fileExtension: string = 'jpg'): Promise<{ key: string; uploadUrl: string }> {
  const key = `profile/${userId}/selfie-${Date.now()}.${fileExtension}`;
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`,
  });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
  return { key, uploadUrl };
}

/** Bulk version — powers the "Bulk Upload" button (Add Items screen). */
export async function getBulkWardrobeUploadUrls(userId: string, count: number, fileExtension: string = 'jpg'): Promise<UploadUrlResult[]> {
  const results = await Promise.all(
    Array.from({ length: count }, () => getWardrobeUploadUrl(userId, fileExtension))
  );
  return results;
}

export function getPublicUrl(key: string): string {
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

export async function getSignedReadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

export async function deleteWardrobePhoto(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

// Real server-enforced backstop, not just trusting the app's own
// check. Photos upload directly from the phone to S3 via a presigned
// URL — the request never passes through this server at all, so
// there's no way to reject an oversized upload in real time. This
// runs AFTER the client claims the upload finished (when the item's
// metadata gets saved): checks the actual uploaded object's real size
// via S3, and deletes it + rejects the save if it's over the limit.
// Catches anyone bypassing or tampering with the app's own client-
// side check — a modified build, a direct API call, anything that
// doesn't go through the real app. Keep MAX_PHOTO_BYTES here in sync
// with the client's copy in wardrobeApi.ts.
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024; // 20MB

export async function verifyUploadedPhotoSize(key: string): Promise<void> {
  const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
  const size = head.ContentLength ?? 0;
  if (size > MAX_PHOTO_BYTES) {
    await deleteWardrobePhoto(key);
    const mb = (size / (1024 * 1024)).toFixed(1);
    throw new Error(`Uploaded photo is ${mb}MB, over the ${MAX_PHOTO_BYTES / (1024 * 1024)}MB limit.`);
  }
}

// ---------- Background removal ----------
//
// Pluggable via BG_REMOVAL_PROVIDER:
//   'removebg'  — remove.bg's REST API. Good for flat-lay/product
//                 photos with NO person in frame. Does not remove a
//                 person if one's in the shot, only the background
//                 behind them.
//   'gemini'    — Gemini's image-editing model (2.5 or 3.1 Flash
//                 Image, aka "Nano Banana"). Genuinely removes a
//                 person/model from the photo via a prompt, keeping
//                 just the garment. Use this when uploaded photos are
//                 on-model rather than flat-lay.
//   'none'      — dev fallback, just copies the original through
//                 unprocessed so the pipeline is testable without any
//                 API key yet.
//
// Previously there was also a 'garment_segmentation' option (free
// Hugging Face Space, U2NET model) and a 'clipdrop' option — both
// removed. The Hugging Face one was slow (15-45+s), had no uptime
// guarantee, and lower accuracy than a real production model; Gemini's
// image-editing model does the same on-model-photo job properly.
// Clipdrop was never actually configured/used, so it's gone too —
// down to the two providers that matter: removebg for flat-lay,
// gemini for on-model.

// Gemini's IMAGE-EDITING models need Google's native generateContent
// endpoint, not the OpenAI-compatible /chat/completions path used
// elsewhere in this app (aiStylist.service.ts) for text/vision-to-text
// calls — that endpoint doesn't reliably support image OUTPUT. This
// takes an image in as inline base64 (not a URL — the native API
// doesn't accept image_url the way the OpenAI-compat shim does) and
// gets an edited image back the same way.
// One Gemini call with a hard timeout. Throws a GeminiError that says
// whether it's worth retrying (overload, timeout, no image returned) or
// not (bad API key, bad model name, bad request).
class GeminiError extends Error {
  constructor(message: string, public retryable: boolean) { super(message); }
}

const GEMINI_TIMEOUT_MS = 90_000;

async function callGeminiOnce(model: string, apiKey: string, prompt: string, mimeType: string, base64: string): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        // Key in the header rather than the URL so it never ends up in logs/error text.
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
        signal: controller.signal,
      }
    );
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new GeminiError(`Gemini (${model}) timed out after ${GEMINI_TIMEOUT_MS / 1000}s`, true);
    throw new GeminiError(`Could not reach Gemini (${model}): ${err?.message ?? err}`, true);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = (await res.text().catch(() => '')).slice(0, 400);
    // 429 = rate limit / quota, 5xx = Google overloaded: worth retrying.
    // 400/401/403/404 = wrong key, key without access, or wrong model name: retrying won't help.
    const retryable = res.status === 429 || res.status >= 500;
    throw new GeminiError(`Gemini (${model}) returned ${res.status}: ${body}`, retryable);
  }

  const data: any = await res.json();
  const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
  // Gemini 3.x can include "thought" parts (draft images from its thinking
  // step). Take the last real, non-thought image part as the final result.
  const imageParts = parts.filter((p) => (p.inline_data || p.inlineData) && !p.thought);
  const inline = imageParts.length ? (imageParts[imageParts.length - 1].inline_data ?? imageParts[imageParts.length - 1].inlineData) : null;

  if (!inline?.data) {
    const textPart = parts.find((p) => typeof p.text === 'string' && !p.thought)?.text;
    const finishReason = data?.candidates?.[0]?.finishReason;
    const blockReason = data?.promptFeedback?.blockReason;
    throw new GeminiError(
      `Gemini (${model}) did not return an image. finishReason=${finishReason ?? 'none'} blockReason=${blockReason ?? 'none'}` +
      (textPart ? ` text="${String(textPart).slice(0, 200)}"` : ''),
      true // image models skip the image now and then; a second try usually works
    );
  }
  return Buffer.from(inline.data, 'base64');
}

// Gemini image editing, with retries. Previously a single hiccup (Google
// returning 503 "model overloaded", a 429, a slow response, or the model
// answering with text only) failed the item permanently. Now:
//   attempt 1: main model
//   attempt 2: main model again after a short wait
//   attempt 3: fallback model (full Nano Banana 2 by default)
// Errors that retrying can't fix (bad key, unknown model) fail at once
// with a clear message.
async function runGeminiBackgroundRemoval(imageUrl: string, apiKey: string): Promise<Buffer> {
  if (!apiKey) {
    throw new Error('BG_REMOVAL_API_KEY is not set on the server. Add your Gemini API key to the backend environment variables and redeploy.');
  }
  const model = process.env.BG_REMOVAL_GEMINI_MODEL || 'gemini-3.1-flash-lite-image';
  const fallbackModel = process.env.BG_REMOVAL_GEMINI_FALLBACK_MODEL || 'gemini-3.1-flash-image';

  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) throw new Error(`Could not fetch source image for Gemini: ${imageRes.status}`);
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
  const mimeType = (imageRes.headers.get('content-type') || 'image/jpeg').split(';')[0];
  const base64 = imageBuffer.toString('base64');

  const prompt = 'Remove the person/model and everything else from this photo — keep ONLY the clothing item itself. Output a PNG with a fully transparent background (real alpha transparency, not a white or colored background) around the garment, cut cleanly along its actual edges. Preserve the garment\'s exact color, shape, texture, and details exactly as shown — do not alter, redesign, or restyle the item itself, only remove everything that is not the garment.';

  const attempts = [
    { model, waitMs: 0 },
    { model, waitMs: 3000 },
    { model: fallbackModel, waitMs: 6000 },
  ];
  const errors: string[] = [];
  for (let i = 0; i < attempts.length; i++) {
    const { model: m, waitMs } = attempts[i];
    if (waitMs) await new Promise((r) => setTimeout(r, waitMs));
    try {
      const buf = await callGeminiOnce(m, apiKey, prompt, mimeType, base64);
      if (i > 0) console.log(`[s3.service] Gemini background removal succeeded on attempt ${i + 1} (${m}).`);
      return buf;
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      errors.push(`#${i + 1}: ${msg}`);
      console.warn(`[s3.service] Gemini attempt ${i + 1}/${attempts.length} failed: ${msg}`);
      if (err instanceof GeminiError && !err.retryable) break;
    }
  }
  throw new Error(`Gemini background removal failed. ${errors.join(' | ')}`.slice(0, 1000));
}

// Client uploads originals via a presigned URL with no Cache-Control
// header (adding one there would require the app to send a matching
// header too, just to make the S3 signature validate — a client
// change we specifically want to avoid right now). This adds the same
// long-cache header retroactively via a pure backend self-copy
// instead — zero app involvement, so an item still sitting in
// 'pending'/'failed' (still showing its original, unprocessed photo)
// gets the same repeat-load speedup as a successfully processed one.
async function addCacheHeadersRetroactively(key: string): Promise<void> {
  try {
    await s3.send(new CopyObjectCommand({
      Bucket: BUCKET,
      CopySource: `${BUCKET}/${key}`,
      Key: key,
      MetadataDirective: 'REPLACE',
      CacheControl: 'public, max-age=31536000, immutable',
    }));
  } catch (err) {
    console.warn(`[s3.service] Could not add cache headers to ${key}:`, err);
  }
}

export async function removeBackground(originalKey: string, itemId: string, userId: string): Promise<{ processedKey: string }> {
  const provider = process.env.BG_REMOVAL_PROVIDER ?? 'none';
  const processedKey = `wardrobe/${userId}/${itemId}/processed.png`;

  if (provider === 'none') {
    // Dev fallback: just copy the original so the pipeline is testable
    // end-to-end without a real background-removal API key yet.
    await s3.send(new CopyObjectCommand({
      Bucket: BUCKET, CopySource: `${BUCKET}/${originalKey}`, Key: processedKey,
    }));
    return { processedKey };
  }

  const apiKey = process.env.BG_REMOVAL_API_KEY ?? '';
  const originalUrl = await getSignedReadUrl(originalKey, 600);

  let resultBuffer: Buffer;
  if (provider === 'removebg') {
    const res = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: originalUrl, size: 'auto' }),
    });
    if (!res.ok) throw new Error(`remove.bg failed: ${res.status} ${await res.text()}`);
    resultBuffer = Buffer.from(await res.arrayBuffer());
  } else if (provider === 'gemini') {
    resultBuffer = await runGeminiBackgroundRemoval(originalUrl, apiKey);
  } else {
    throw new Error(`Unknown BG_REMOVAL_PROVIDER: ${provider}`);
  }

  // Resized server-side (Node, via sharp) before ever reaching S3 —
  // this runs entirely on the backend, never touches the app, so it
  // carries none of the risk a client-side native image-resize module
  // did (that approach caused a real crash and was reverted). Every
  // closet thumbnail displays well under 300px; a removal provider can
  // return images several MB at full resolution, all of it wasted
  // bandwidth every time it's loaded. 1200px on the long edge is
  // generous headroom for the largest display size (the Outfit detail
  // screen's 300px collage) while cutting typical file size
  // dramatically. withoutEnlargement avoids upscaling anything already
  // smaller. Falls back to the unresized buffer if sharp fails for any
  // reason — a size optimization should never be the thing that
  // breaks background removal entirely.
  let finalBuffer = resultBuffer;
  try {
    finalBuffer = await sharp(resultBuffer)
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch (err) {
    console.warn('[s3.service] Server-side resize failed, storing original size instead:', err);
  }

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: processedKey, Body: finalBuffer, ContentType: 'image/png',
    // These almost never change once processed (a resave creates a
    // NEW key entirely, per replaceItemPhoto), so a long, immutable
    // cache is accurate, not just optimistic. This is what actually
    // fixes repeat-load speed — the OS/browser's own standard HTTP
    // cache honors this with zero app-side code needed at all.
    CacheControl: 'public, max-age=31536000, immutable',
  }));

  return { processedKey };
}

// Runs the same background-removal pipeline as adding a NEW item, but
// triggered by pulling an EXISTING item into an outfit instead. Real
// gap this closes: an item could sit with backgroundRemoval stuck on
// "pending" or "failed" indefinitely — nothing ever automatically
// retried it, so the only way to fix it was manually reopening that
// specific item and retrying by hand. Now, the moment an item is
// actually used in an outfit, this fires automatically for anything
// not already done — so the collage view (which only shows genuinely
// processed items) fills in on its own the more you actually use your
// closet, not by remembering to babysit individual items' processing
// status.
//
// Fire-and-forget, same as the original creation-time trigger — never
// blocks the outfit save itself on how long background removal takes.
// Skips anything already 'processing' (avoid double-triggering a run
// already in flight) or already 'done' (nothing to do).
export async function ensureBackgroundRemovalForItems(userId: string, itemIds: string[]): Promise<void> {
  if (itemIds.length === 0) return;
  const items = await getWardrobeItemsByIds(userId, itemIds);
  const STALE_PROCESSING_MS = 5 * 60 * 1000; // 5 minutes
  for (const item of items) {
    const status = item.backgroundRemoval?.status;
    if (status === 'done') continue;
    // Previously ANY 'processing' status was assumed to mean "actively
    // being handled right now, leave it alone" — but a real background
    // task only ever reaches 'done' or 'failed' if it runs to
    // completion. If the SERVER PROCESS ITSELF restarted mid-run (a
    // Render redeploy killing an in-flight request — genuinely common
    // given how many deploys happened during this build), the item is
    // left saying 'processing' forever with nothing actually
    // processing it — a permanently stuck, false-positive "already
    // handled" state that this function would otherwise skip retrying
    // indefinitely. Treats 'processing' as stale (and worth retrying)
    // once it's been sitting that way for more than 5 minutes — long
    // enough that a genuinely in-flight run would have finished either
    // way by then.
    const isStaleProcessing = status === 'processing' && (Date.now() - (item.updatedAt ?? 0)) > STALE_PROCESSING_MS;
    if (status === 'processing' && !isStaleProcessing) continue;
    if (!item.s3Key) continue; // nothing to process without an original photo
    processBackgroundRemovalInBackground(userId, item.id, item.s3Key);
  }
}

export async function processBackgroundRemovalInBackground(userId: string, itemId: string, s3Key: string) {
  addCacheHeadersRetroactively(s3Key); // fire-and-forget — helps the original load fast even before/if removal finishes
  console.log(`[s3.service] Background removal starting for item ${itemId}...`);
  try {
    await updateWardrobeItem(userId, itemId, { backgroundRemoval: { status: 'processing', error: null } });
    const { processedKey } = await removeBackground(s3Key, itemId, userId);
    await updateWardrobeItem(userId, itemId, {
      s3KeyProcessed: processedKey,
      imageUrl: getPublicUrl(processedKey),
      backgroundRemoval: { status: 'done', error: null },
    });
    // Previously nothing logged on success either — meaning a silent
    // success and a silent "never ran at all" looked identical in the
    // logs: both showed nothing. Adding a start line above and a done
    // line here means any test from now on gives an unambiguous
    // answer, not another round of "did this even fire?"
    console.log(`[s3.service] Background removal done for item ${itemId}.`);
  } catch (err: any) {
    // Previously this saved the error message to the database
    // (backgroundRemoval.error) but never actually printed it to the
    // server logs — meaning a genuine failure here left zero trace in
    // Render's logs, exactly the gap that made this issue impossible
    // to diagnose from logs alone. Now it's actually visible.
    console.error(`[s3.service] Background removal failed for item ${itemId}:`, err);
    await updateWardrobeItem(userId, itemId, {
      backgroundRemoval: { status: 'failed', error: err.message ?? 'Unknown error' },
    });
  }
}
