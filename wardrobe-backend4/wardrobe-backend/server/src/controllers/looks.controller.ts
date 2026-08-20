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
} from '../services/mongodb.service';
import { pickOutfitItems, computeMatchScore, generateOutfitStory } from '../services/aiStylist.service';
import { Outfit, Occasion, DailyPick } from '../types/domain';

const CATEGORY_OCCASION_MAP: Record<string, Occasion | null> = {
  all: null, casual: 'coffee', date_night: 'date', work: 'office',
};

function requireUser(req: Request, res: Response): string | null {
  const userId = req.auth?.userId;
  if (!userId) { res.status(401).json({ error: 'Not authenticated' }); return null; }
  return userId;
}

// GET /api/looks/discover?category=all|casual|date_night|work
export async function discoverLooks(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const category = (req.query.category as string) ?? 'all';
  const occasion = CATEGORY_OCCASION_MAP[category] ?? null;

  const closet = await listWardrobeItems(userId);
  const items = pickOutfitItems(closet, occasion, null);
  const matchScore = computeMatchScore(items, occasion, null);

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
  const { occasion, mood } = req.body;
  const closet = await listWardrobeItems(userId);
  const shuffled = [...closet].sort(() => Math.random() - 0.5);
  const items = pickOutfitItems(shuffled, occasion ?? null, mood ?? null);
  res.json({ itemIds: items.map((i) => i.id) });
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
  res.status(201).json(outfit);
}
