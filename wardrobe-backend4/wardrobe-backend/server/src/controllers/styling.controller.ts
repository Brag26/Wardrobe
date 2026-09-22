// server/src/controllers/styling.controller.ts
// Powers screens S2 (occasion) -> S3 (mood) -> S4 (build) -> S5 (reasoning) -> S6 (story)

import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import {
  createStylingSession, updateStylingSession, getStylingSession,
  listWardrobeItems, createOutfit, getOutfit,
} from '../services/mongodb.service';
import { getUserProfile } from '../services/otp.service';
import { ensureBackgroundRemovalForItems } from '../services/s3.service';
import {
  pickOutfitItems, buildReasoningSteps, generateOutfitStory, computeMatchScore, categoryInSlot,
} from '../services/aiStylist.service';
import { StylingSession, Outfit, Mood } from '../types/domain';

// QA-flagged: Ara-generated outfits all showed up as "Untitled
// outfit" in My Outfits, with no way to tell them apart at a glance.
// Names them from the mood the person actually selected when starting
// this session — simple, but real, distinguishing information instead
// of a generic placeholder every single time.
const MOOD_OUTFIT_NAMES: Record<Mood, string> = {
  confident: 'Confident Edit',
  romantic: 'Romantic Look',
  elegant: 'Elegant Ensemble',
  playful: 'Playful Pick',
  calm: 'Calm & Easy',
  creative: 'Creative Mix',
};

function nameForMood(mood: Mood | null): string | null {
  return mood ? MOOD_OUTFIT_NAMES[mood] : null;
}

// POST /api/styling-sessions   body: { occasion, mood }
export async function startSession(req: Request, res: Response) {
  const userId = req.auth?.userId;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const { occasion, mood } = req.body;
  const session: StylingSession = {
    id: randomUUID(), userId,
    occasion: occasion ?? null, mood: mood ?? null,
    status: 'collecting', resultOutfitId: null, reasoningSteps: null,
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  await createStylingSession(session);
  res.status(201).json(session);
}

// POST /api/styling-sessions/:id/generate
export async function generateOutfitForSession(req: Request, res: Response) {
  const { id } = req.params;
  const userId = req.auth?.userId;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const session = await getStylingSession(userId, id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  await updateStylingSession(userId, id, { status: 'generating' });

  const closet = await listWardrobeItems(userId);
  const profile = await getUserProfile(userId);
  const recommendedColors = profile?.colorProfile?.recommendedColors ?? null;

  const pickedItems = pickOutfitItems(closet, session.occasion, session.mood, recommendedColors);
  const reasoningSteps = buildReasoningSteps(session.occasion, session.mood, pickedItems, recommendedColors);
  const story = await generateOutfitStory(pickedItems, session.occasion, session.mood);
  const matchScore = computeMatchScore(pickedItems, session.occasion, session.mood, recommendedColors);

  const now = Date.now();
  const outfit: Outfit = {
    id: randomUUID(), userId, sessionId: id,
    name: nameForMood(session.mood), description: null,
    itemIdsBySlot: {
      tops: pickedItems.filter((i) => categoryInSlot(i.category, 'top')).map((i) => i.id),
      pants: pickedItems.filter((i) => categoryInSlot(i.category, 'bottom')).map((i) => i.id),
      shoes: pickedItems.filter((i) => categoryInSlot(i.category, 'shoes')).map((i) => i.id),
      bags: pickedItems.filter((i) => categoryInSlot(i.category, 'bag')).map((i) => i.id),
      other: pickedItems.filter((i) =>
        !categoryInSlot(i.category, 'top') &&
        !categoryInSlot(i.category, 'bottom') &&
        !categoryInSlot(i.category, 'shoes') &&
        !categoryInSlot(i.category, 'bag')
      ).map((i) => i.id),
    },
    itemIds: pickedItems.map((i) => i.id),
    category: null, customCategories: [], season: null, rating: null, aesthetic: null,
    brand: null, price: null, size: null, material: null,
    story, matchScore, source: 'ai_generated', isFavorite: false, deletedAt: null,
    createdAt: now, updatedAt: now,
  };
  await createOutfit(outfit);
  ensureBackgroundRemovalForItems(userId, outfit.itemIds);

  await updateStylingSession(userId, id, { status: 'ready', resultOutfitId: outfit.id, reasoningSteps });

  res.json({ session: { ...session, status: 'ready', resultOutfitId: outfit.id, reasoningSteps }, outfit });
}

// GET /api/styling-sessions/:id
export async function getSession(req: Request, res: Response) {
  const userId = req.auth?.userId;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const session = await getStylingSession(userId, req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
}

// GET /api/outfits/:id — used by S6 to render "Your outfit story"
export async function getOutfitById(req: Request, res: Response) {
  const userId = req.auth?.userId;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const outfit = await getOutfit(userId, req.params.id);
  if (!outfit) return res.status(404).json({ error: 'Outfit not found' });
  res.json(outfit);
}
