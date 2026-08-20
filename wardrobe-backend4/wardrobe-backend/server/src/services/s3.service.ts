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

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

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
async function runGeminiBackgroundRemoval(imageUrl: string, apiKey: string): Promise<Buffer> {
  const model = process.env.BG_REMOVAL_GEMINI_MODEL || 'gemini-2.5-flash-image';

  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) throw new Error(`Could not fetch source image for Gemini: ${imageRes.status}`);
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
  const mimeType = imageRes.headers.get('content-type') || 'image/jpeg';

  const prompt = 'Remove the person/model wearing this garment from the photo. Keep ONLY the clothing item, isolated on a clean plain white background. Preserve the garment\'s exact color, shape, texture, and details — do not alter the item itself, only remove the person and background around it.';

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: imageBuffer.toString('base64') } },
          ],
        }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini background removal failed: ${res.status} ${await res.text().catch(() => '')}`);

  const data: any = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p: any) => p.inline_data || p.inlineData);
  const inline = imagePart?.inline_data ?? imagePart?.inlineData;
  if (!inline?.data) throw new Error('Gemini did not return an edited image — check the model name supports image output');

  return Buffer.from(inline.data, 'base64');
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

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: processedKey, Body: resultBuffer, ContentType: 'image/png',
  }));

  return { processedKey };
}
