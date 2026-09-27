// server/src/controllers/looks.controller.ts
// Powers S7 ("Discover your next perfect look" + Shuffle), S8 (Drag
// Studio -> save as outfit), and the Favorites screen.
//
// NOTE ON FAVORITES: favorites are stored as an `isFavorite` boolean
// directly on the WardrobeItem / Outfit row (not a separate join table).
// Simpler queries, and matches how the Figma "Favorites" screen and the
// heart icons on item/outfit cards work — toggling a heart is a single
// item update, not a separate collection to keep in sync.

import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import {
  listWardrobeItems, createOutfit, toggleItemFavorite, getOutfitsForUser, updateOutfit,
  getDailyPick, createDailyPick,
  countRecommendationsToday, logRecommendation, getRecentlyRecommendedItemIds, getRecommendationHistory,
} from '../services/mongodb.service';
import { pickOutfitItems, computeMatchScore, generateOutfitStory } from '../services/aiStylist.service';
import { ensureBackgroundRemovalForItems } from '../services/s3.service';
import { Outfit, Occasion, DailyPick } from '../types/domain';
import { randomUUID as uuid } from 'crypto';

const CATEGORY_OCCASION_MAP: Record<string, Occasion | null> = {
  all: null, casual: 'coffee', date_night: 'date', work: 'office',
};

function requireUser(req: Request, res: Response): string | null {
  const userId = req.auth?.userId;
  if (!userId) { res.status(401).json({ error: 'Not authenticated' }); return null; }
  return userId;
}

// item 10: "Set a user a limit for the AI Recommendation for fits,
// suggested is 3 times to 4 times ... concerning about api key usage."
// Applies to Discover's category picks + Shuffle, the two "give me a
// new recommendation" actions. Configurable via env; defaults to 4/day.
const DAILY_RECOMMENDATION_LIMIT = Number(process.env.AI_RECOMMENDATION_DAILY_LIMIT ?? 4);

async function checkRecommendationLimit(userId: string, res: Response): Promise<boolean> {
  const usedToday = await countRecommendationsToday(userId);
  if (usedToday >= DAILY_RECOMMENDATION_LIMIT) {
    res.status(429).json({
      error: `You've used all ${DAILY_RECOMMENDATION_LIMIT} AI recommendations for today — come back tomorrow for more, or build an outfit yourself in the meantime.`,
      limitReached: true,
      limit: DAILY_RECOMMENDATION_LIMIT,
    });
    return false;
  }
  return true;
}

// GET /api/looks/discover?category=all|casual|date_night|work
export async function discoverLooks(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  if (!(await checkRecommendationLimit(userId, res))) return;
  const category = (req.query.category as string) ?? 'all';
  const occasion = CATEGORY_OCCASION_MAP[category] ?? null;

  const closet = await listWardrobeItems(userId);
  const recentlyUsed = await getRecentlyRecommendedItemIds(userId);
  const items = pickOutfitItems(closet, occasion, null, null, recentlyUsed);
  const matchScore = computeMatchScore(items, occasion, null);
  await logRecommendation({
    id: uuid(), userId, itemIds: items.map((i) => i.id), occasion, mood: null, matchScore, createdAt: Date.now(),
  });

  res.json({
    itemIds: items.map((i) => i.id),
    matchScore,
    tip: occasion
      ? `Pieces tagged for ${occasion} scored highest for this pick.`
      : 'A mix pulled from across your closet, weighted toward what you wear least.',
  });
}

// GET /api/looks/daily-pick — "Today's Pick by Ara" on the Home screen.
// Generated ONCE per calendar day and cached (see mongodb.service.ts's
// createDailyPick / getDailyPick) — every request today after the first
// returns the same pick, it doesn't reshuffle on every visit.
export async function dailyPick(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;

  const existing = await getDailyPick(userId);
  if (existing) return res.json(existing);

  const closet = await listWardrobeItems(userId);
  const items = pickOutfitItems(closet, null, null);
  const story = await generateOutfitStory(items, null, null);
  const matchScore = computeMatchScore(items, null, null);

  const pick: DailyPick = {
    id: randomUUID(), userId,
    date: new Date().toISOString().slice(0, 10),
    itemIds: items.map((i) => i.id),
    story, matchScore,
    createdAt: Date.now(),
  };
  const saved = await createDailyPick(pick);
  res.json(saved);
}

// POST /api/looks/shuffle  body: { occasion?, mood? }
export async function shuffleLook(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  if (!(await checkRecommendationLimit(userId, res))) return;
  const { occasion, mood } = req.body;
  const closet = await listWardrobeItems(userId);
  const shuffled = [...closet].sort(() => Math.random() - 0.5);
  const recentlyUsed = await getRecentlyRecommendedItemIds(userId);
  const items = pickOutfitItems(shuffled, occasion ?? null, mood ?? null, null, recentlyUsed);
  const matchScore = computeMatchScore(items, occasion ?? null, mood ?? null);
  await logRecommendation({
    id: uuid(), userId, itemIds: items.map((i) => i.id), occasion: occasion ?? null, mood: mood ?? null, matchScore, createdAt: Date.now(),
  });
  res.json({ itemIds: items.map((i) => i.id) });
}

// GET /api/looks/recommendation-usage — how many of today's AI
// recommendations (Discover + Shuffle) are left, so the app can show
// "3 of 4 left today" instead of the person only finding out once
// they've already hit the limit.
export async function getRecommendationUsage(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const usedToday = await countRecommendationsToday(userId);
  res.json({ used: usedToday, limit: DAILY_RECOMMENDATION_LIMIT, remaining: Math.max(0, DAILY_RECOMMENDATION_LIMIT - usedToday) });
}

// GET /api/looks/history — item 11: "history should be there to verify
// what were selected previously". Returns recent recommendations
// (itemIds only — the client resolves them the same way OutfitsScreen
// resolves outfit itemIds into real item data).
export async function getRecommendationHistoryRoute(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const history = await getRecommendationHistory(userId, 20);
  res.json(history);
}

// POST /api/outfits/:id/favorite   body: { isFavorite: boolean }
// The heart / "Save this look" button, and unfavoriting from Favorites screen.
export async function setOutfitFavorite(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const { isFavorite } = req.body as { isFavorite: boolean };
  await updateOutfit(userId, req.params.id, { isFavorite: !!isFavorite });
  res.json({ ok: true });
}

// GET /api/favorites/items — Favorites screen (grid of hearted items)
export async function listFavoriteItems(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const items = await listWardrobeItems(userId, { favoritesOnly: true });
  res.json(items);
}

// GET /api/favorites/outfits
export async function listFavoriteOutfits(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const outfits = await getOutfitsForUser(userId);
  res.json(outfits.filter((o) => o.isFavorite));
}

// POST /api/outfits/manual   body: { itemIds: string[] }
// Powers S8 "AI Drag Studio" — user manually drags items onto the
// mannequin, this just persists their final choice as an Outfit.
export async function saveManualOutfit(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const { itemIds } = req.body as { itemIds: string[] };
  if (!itemIds?.length) return res.status(400).json({ error: 'itemIds is required' });

  const now = Date.now();
  const outfit: Outfit = {
    id: randomUUID(), userId, sessionId: null, name: null, description: null,
    itemIdsBySlot: { tops: [], pants: [], shoes: [], bags: [], other: itemIds },
    itemIds, category: null, customCategories: [], season: null, rating: null, aesthetic: null,
    brand: null, price: null, size: null, material: null,
    story: null, matchScore: null, source: 'drag_studio', isFavorite: false, deletedAt: null,
    createdAt: now, updatedAt: now,
  };
  await createOutfit(outfit);
  ensureBackgroundRemovalForItems(userId, itemIds);
  res.status(201).json(outfit);
}
