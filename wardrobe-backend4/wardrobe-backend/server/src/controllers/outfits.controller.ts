// server/src/controllers/outfits.controller.ts
// Powers "My Outfits" tabs (Casual/Formal/Business/Evening Wear/Sport +
// custom categories), the "Create Outfit" screen (Tops/Pants/Shoes/Bags
// slots), and the Outfit detail/list views.

import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { createOutfit, getOutfitsForUser, getOutfit, updateOutfit, softDeleteOutfit, getOutfitCategories } from '../services/mongodb.service';
import { getWardrobeItemsByIds } from '../services/mongodb.service';
import { Outfit } from '../types/domain';

function requireUser(req: Request, res: Response): string | null {
  const userId = req.auth?.userId;
  if (!userId) { res.status(401).json({ error: 'Not authenticated' }); return null; }
  return userId;
}

// GET /api/outfits?category=casual|formal|business|evening_wear|sport|<custom>|all&season=&minRating=&color=
export async function listOutfits(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const category = (req.query.category as string) ?? 'all';
  const season = (req.query.season as string) || undefined;
  const color = (req.query.color as string) || undefined;
  const aesthetic = (req.query.aesthetic as string) || undefined;
  const minRating = req.query.minRating ? Number(req.query.minRating) : undefined;
  const outfits = await getOutfitsForUser(userId, category, false, { season, minRating, color, aesthetic });
  res.json(outfits);
}

// GET /api/outfits/categories — powers the "My Outfits" tab bar:
// system categories (Casual/Formal/Business/Evening Wear/Sport) always
// first, then this user's own custom categories they've added via "+ Add".
export async function listOutfitCategories(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const categories = await getOutfitCategories(userId);
  res.json(categories);
}

// GET /api/outfits — with resolved item objects (not just ids), since
// the Outfit screen shows thumbnails for every piece in the look.
export async function getOutfitDetail(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const outfit = await getOutfit(userId, req.params.id);
  if (!outfit) return res.status(404).json({ error: 'Outfit not found' });
  const items = await getWardrobeItemsByIds(userId, outfit.itemIds);
  res.json({ ...outfit, items });
}

// POST /api/outfits — "Create Outfit" screen's final "Upload" button
// body: { name, description, itemIdsBySlot: {tops,pants,shoes,bags,other},
//         category, customCategories, season, rating, brand, price, size, material }
export async function createManualOutfit(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const {
    name, description, itemIdsBySlot, category, customCategories, season, rating, aesthetic,
    brand, price, size, material,
  } = req.body;

  const slots = {
    tops: itemIdsBySlot?.tops ?? [],
    pants: itemIdsBySlot?.pants ?? [],
    shoes: itemIdsBySlot?.shoes ?? [],
    bags: itemIdsBySlot?.bags ?? [],
    other: itemIdsBySlot?.other ?? [],
  };
  const itemIds = [...slots.tops, ...slots.pants, ...slots.shoes, ...slots.bags, ...slots.other];
  if (itemIds.length === 0) {
    return res.status(400).json({ error: 'At least one item is required to create an outfit' });
  }

  const now = Date.now();
  const outfit: Outfit = {
    id: randomUUID(), userId,
    sessionId: null,
    name: name ?? null, description: description ?? null,
    itemIdsBySlot: slots, itemIds,
    category: category ?? null, customCategories: customCategories ?? [],
    season: season ?? null, rating: rating ?? null, aesthetic: aesthetic ?? null,
    brand: brand ?? null, price: price ?? null, size: size ?? null, material: material ?? null,
    story: null, matchScore: null, source: 'manual', isFavorite: false, deletedAt: null,
    createdAt: now, updatedAt: now,
  };
  await createOutfit(outfit);
  res.status(201).json(outfit);
}

// PATCH /api/outfits/:id — edit name/description/category/rating/etc.
export async function updateOutfitDetail(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const allowed = ['name', 'description', 'category', 'customCategories', 'season', 'rating', 'aesthetic', 'itemIdsBySlot', 'itemIds', 'brand', 'price', 'size', 'material'];
  const patch: Record<string, any> = {};
  for (const key of allowed) if (key in req.body) patch[key] = req.body[key];
  await updateOutfit(userId, req.params.id, patch);
  const outfit = await getOutfit(userId, req.params.id);
  res.json(outfit);
}

// DELETE /api/outfits/:id — move to bin (soft delete, same pattern as items)
export async function deleteOutfit(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  await softDeleteOutfit(userId, req.params.id);
  res.json({ ok: true });
}
