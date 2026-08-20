// server/src/controllers/profile.controller.ts
// Powers the Body Shape selector and the AI Color Analysis (selfie ->
// undertone + recommended palette) features.

import { Request, Response } from 'express';
import { getUserProfile, setUserBodyShape, setUserColorProfile } from '../services/otp.service';
import { getProfilePhotoUploadUrl, getSignedReadUrl } from '../services/s3.service';
import { analyzeColorFromPhoto } from '../services/aiStylist.service';
import { BODY_SHAPES } from '../types/domain';

function requireUser(req: Request, res: Response): string | null {
  const userId = req.auth?.userId;
  if (!userId) { res.status(401).json({ error: 'Not authenticated' }); return null; }
  return userId;
}

// GET /api/profile
export async function getProfile(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const profile = await getUserProfile(userId);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  res.json(profile);
}

// PATCH /api/profile/body-shape   body: { bodyShape }
export async function updateBodyShape(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const { bodyShape } = req.body as { bodyShape: string };
  if (!BODY_SHAPES.includes(bodyShape as any)) {
    return res.status(400).json({ error: `bodyShape must be one of: ${BODY_SHAPES.join(', ')}` });
  }
  await setUserBodyShape(userId, bodyShape);
  res.json({ ok: true, bodyShape });
}

// POST /api/profile/color-analysis/upload-url
export async function requestColorAnalysisUploadUrl(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const { fileExtension } = req.body as { fileExtension?: string };
  const { key, uploadUrl } = await getProfilePhotoUploadUrl(userId, fileExtension ?? 'jpg');
  res.json({ key, uploadUrl });
}

// POST /api/profile/color-analysis   body: { s3Key }
// Runs AFTER the client has already PUT the selfie to the presigned URL.
export async function runColorAnalysis(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const { s3Key } = req.body as { s3Key: string };
  if (!s3Key) return res.status(400).json({ error: 's3Key is required' });

  try {
    // The vision model needs a URL it can actually fetch — a short-lived
    // signed read URL works even on a private bucket.
    const readUrl = await getSignedReadUrl(s3Key, 600);
    const result = await analyzeColorFromPhoto(readUrl);
    await setUserColorProfile(userId, result);
    res.json({ ...result, analyzedAt: Date.now() });
  } catch (err: any) {
    res.status(500).json({ error: 'Color analysis failed', detail: err.message });
  }
}
