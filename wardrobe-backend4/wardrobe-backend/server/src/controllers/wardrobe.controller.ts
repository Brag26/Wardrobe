// server/src/controllers/wardrobe.controller.ts
// Powers: Closet screen, Add Items (single/bulk + background removal),
// Item Details, Favorites, Bin (move to bin / restore / permanent delete),
// Filter panel.

import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import {
  getWardrobeUploadUrl, getBulkWardrobeUploadUrls, getPublicUrl, removeBackground, deleteWardrobePhoto, getSignedReadUrl,
} from '../services/s3.service';
import {
  createWardrobeItem, listWardrobeItems, getWardrobeItem, updateWardrobeItem,
  markItemWorn, toggleItemFavorite, softDeleteItem, restoreItem, permanentlyDeleteItem,
  getClosetOverview, getExpenseBreakdown, getAttributeSuggestions,
  archiveItem, unarchiveItem, listArchivedItems, reorderWardrobeItems,
} from '../services/mongodb.service';
import { analyzeTagFromPhoto } from '../services/aiStylist.service';
import { WardrobeItem, ItemListFilters } from '../types/domain';

function requireUser(req: Request, res: Response): string | null {
  const userId = req.auth?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return userId;
}

// ---------- Upload ----------

// POST /api/items/upload-url   body: { fileExtension? }
export async function requestUploadUrl(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const { fileExtension } = req.body as { fileExtension?: string };
  const { itemId, key, uploadUrl } = await getWardrobeUploadUrl(userId, fileExtension ?? 'jpg');
  res.json({ itemId, key, uploadUrl, imageUrl: getPublicUrl(key) });
}

// POST /api/items/upload-urls   body: { count, fileExtension? }
// Powers "Bulk Upload" — client gets N presigned URLs in one call.
export async function requestBulkUploadUrls(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const { count, fileExtension } = req.body as { count: number; fileExtension?: string };
  if (!count || count < 1 || count > 20) {
    return res.status(400).json({ error: 'count must be between 1 and 20' });
  }
  const results = await getBulkWardrobeUploadUrls(userId, count, fileExtension ?? 'jpg');
  res.json(results.map((r) => ({ ...r, imageUrl: getPublicUrl(r.key) })));
}

// POST /api/items/scan-tag   body: { s3Key }
// "Scan tag" on Add Item — client uploads a photo of the garment's
// label to the s3Key it already has from requestUploadUrl (same
// upload flow as a normal item photo, just read by the vision model
// BEFORE the item is saved, so the extracted fields can pre-fill the
// form instead of the person typing brand/size/material by hand).
// Doesn't create or touch any wardrobe item — purely returns extracted
// fields for the client form to use.
export async function scanTag(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const { s3Key } = req.body as { s3Key: string };
  if (!s3Key) return res.status(400).json({ error: 's3Key is required' });

  try {
    const readUrl = await getSignedReadUrl(s3Key, 600);
    const result = await analyzeTagFromPhoto(readUrl);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Tag scan failed', detail: err.message });
  }
}

// Kicks off background removal and writes the result back onto the item.
// In production, replace this direct call with an S3 event -> SQS ->
// Lambda pipeline (see s3.service.ts's comment) so it's not tied to this
// request's lifetime — fine for now / for demo purposes.
async function processBackgroundRemoval(userId: string, itemId: string, s3Key: string) {
  try {
    await updateWardrobeItem(userId, itemId, { backgroundRemoval: { status: 'processing', error: null } });
    const { processedKey } = await removeBackground(s3Key, itemId, userId);
    await updateWardrobeItem(userId, itemId, {
      s3KeyProcessed: processedKey,
      imageUrl: getPublicUrl(processedKey),
      backgroundRemoval: { status: 'done', error: null },
    });
  } catch (err: any) {
    await updateWardrobeItem(userId, itemId, {
      backgroundRemoval: { status: 'failed', error: err.message ?? 'Unknown error' },
    });
  }
}

// ---------- Create ----------

// POST /api/items   — called after the client finishes the direct S3 upload
export async function saveWardrobeItem(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const {
    itemId, s3Key, category, color, occasionTags, moodTags,
    name, description, style, season, rating, brand, price, size, material,
  } = req.body;

  if (!itemId || !s3Key || !category || !color) {
    return res.status(400).json({ error: 'itemId, s3Key, category, and color are required' });
  }

  const now = Date.now();
  const item: WardrobeItem = {
    id: itemId,
    userId,
    s3Key,
    s3KeyProcessed: null,
    imageUrl: getPublicUrl(s3Key),
    backgroundRemoval: { status: 'pending', error: null },
    category, color,
    occasionTags: occasionTags ?? [],
    moodTags: moodTags ?? [],
    name: name ?? null,
    description: description ?? null,
    style: style ?? null,
    season: season ?? null,
    rating: rating ?? null,
    brand: brand ?? null,
    price: price ?? null,
    size: size ?? null,
    material: material ?? null,
    wearCount: 0,
    lastWornAt: null,
    isFavorite: false,
    archivedAt: null,
    deletedAt: null,
    sortOrder: now,
    createdAt: now,
    updatedAt: now,
  };

  await createWardrobeItem(item);
  processBackgroundRemoval(userId, itemId, s3Key); // fire-and-forget; client polls status
  res.status(201).json(item);
}

// POST /api/items/bulk   body: { items: [{ itemId, s3Key, category, color, ... }] }
export async function saveBulkWardrobeItems(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const { items } = req.body as { items: any[] };
  if (!items?.length) return res.status(400).json({ error: 'items array is required' });

  const now = Date.now();
  const saved: WardrobeItem[] = [];
  for (const raw of items) {
    if (!raw.itemId || !raw.s3Key || !raw.category || !raw.color) continue;
    const item: WardrobeItem = {
      id: raw.itemId, userId, s3Key: raw.s3Key, s3KeyProcessed: null,
      imageUrl: getPublicUrl(raw.s3Key),
      backgroundRemoval: { status: 'pending', error: null },
      category: raw.category, color: raw.color,
      occasionTags: raw.occasionTags ?? [], moodTags: raw.moodTags ?? [],
      name: raw.name ?? null, description: raw.description ?? null,
      style: raw.style ?? null, season: raw.season ?? null, rating: raw.rating ?? null,
      brand: raw.brand ?? null, price: raw.price ?? null, size: raw.size ?? null, material: raw.material ?? null,
      wearCount: 0, lastWornAt: null, isFavorite: false, archivedAt: null, deletedAt: null, sortOrder: now,
      createdAt: now, updatedAt: now,
    };
    await createWardrobeItem(item);
    processBackgroundRemoval(userId, item.id, item.s3Key);
    saved.push(item);
  }
  res.status(201).json(saved);
}

// ---------- Read ----------

// GET /api/items?category=&color=&season=&style=&favoritesOnly=&search=
export async function listItems(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const q = req.query;
  const filters: ItemListFilters = {
    category: (q.category as any) ?? undefined,
    color: q.color ? (Array.isArray(q.color) ? q.color as any : [q.color as any]) : undefined,
    season: q.season ? (Array.isArray(q.season) ? q.season as any : [q.season as any]) : undefined,
    style: (q.style as any) ?? undefined,
    favoritesOnly: q.favoritesOnly === 'true',
    search: (q.search as string) ?? undefined,
  };
  const items = await listWardrobeItems(userId, filters);
  res.json(items);
}

// GET /api/items/bin — soft-deleted items
export async function listBinItems(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const items = await listWardrobeItems(userId, { includeDeleted: true });
  res.json(items.filter((i) => i.deletedAt));
}

// GET /api/items/archive — archived items (Closet Section board's "Archive" screen)
export async function listArchive(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const items = await listArchivedItems(userId);
  res.json(items);
}

// GET /api/items/:id
export async function getItem(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const item = await getWardrobeItem(userId, req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
}

// GET /api/closet/overview — Home screen stat cards (items/outfits/favorites)
export async function closetOverview(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const overview = await getClosetOverview(userId);
  res.json(overview);
}

// GET /api/closet/expenses — S5's "Expense by Category" breakdown
export async function closetExpenses(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const breakdown = await getExpenseBreakdown(userId);
  res.json(breakdown);
}

// GET /api/wardrobe/attribute-suggestions
// No locked vocabulary for color/style/season (confirmed) — this
// returns the built-in seed list merged with whatever values this user
// has actually used before, so the picker UI can offer autocomplete
// that grows from real entries (manual or AI-suggested) instead of a
// fixed dropdown.
export async function attributeSuggestions(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const suggestions = await getAttributeSuggestions(userId);
  res.json(suggestions);
}

// ---------- Update ----------

// PATCH /api/items/:id — Details screen "save" (name, color, rating, style,
// season, brand, price, size, material, category, occasionTags)
export async function updateItem(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const allowed = [
    'name', 'description', 'category', 'color', 'occasionTags', 'moodTags',
    'style', 'season', 'rating', 'brand', 'price', 'size', 'material',
  ];
  const patch: Record<string, any> = {};
  for (const key of allowed) if (key in req.body) patch[key] = req.body[key];

  await updateWardrobeItem(userId, req.params.id, patch);
  const item = await getWardrobeItem(userId, req.params.id);
  res.json(item);
}

// POST /api/items/:id/worn
export async function markWorn(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const { currentWearCount } = req.body as { currentWearCount: number };
  await markItemWorn(userId, req.params.id, currentWearCount ?? 0);
  res.json({ ok: true });
}

// POST /api/items/:id/favorite   body: { isFavorite: boolean }
export async function setFavorite(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const { isFavorite } = req.body as { isFavorite: boolean };
  await toggleItemFavorite(userId, req.params.id, !!isFavorite);
  res.json({ ok: true });
}

// POST /api/items/:id/archive — Closet Section board's "Archive" kebab action
export async function archiveItemHandler(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  await archiveItem(userId, req.params.id);
  res.json({ ok: true });
}

// POST /api/items/:id/unarchive — Archive screen's "Unarchive" button
export async function unarchiveItemHandler(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  await unarchiveItem(userId, req.params.id);
  res.json({ ok: true });
}

// POST /api/items/reorder   body: { orderedIds: string[] }
// "Reamange the order of items" screen — orderedIds is the FULL new
// order (top to bottom / first to last) of whatever set the client was
// looking at when the reorder happened.
export async function reorderItems(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const { orderedIds } = req.body as { orderedIds: string[] };
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return res.status(400).json({ error: 'orderedIds array is required' });
  }
  await reorderWardrobeItems(userId, orderedIds);
  res.json({ ok: true });
}

// POST /api/wardrobe/items/:id/retry-background-removal
// The "Upload Failed — Retry" button on the Add Items screen when a bg
// removal attempt fails.
export async function retryBackgroundRemoval(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const item = await getWardrobeItem(userId, req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  processBackgroundRemoval(userId, item.id, item.s3Key); // fire-and-forget, same as on initial save
  res.json({ ok: true, status: 'processing' });
}

// ---------- Delete / Bin ----------

// DELETE /api/items/:id — "Move to Bin" (soft delete, recoverable)
export async function moveToBin(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  await softDeleteItem(userId, req.params.id);
  res.json({ ok: true });
}

// POST /api/items/:id/restore — undo a bin move
export async function restoreFromBin(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  await restoreItem(userId, req.params.id);
  res.json({ ok: true });
}

// DELETE /api/items/:id/permanent — the Bin's own "Delete. This item
// cannot be recovered" confirmation
export async function permanentDelete(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const item = await getWardrobeItem(userId, req.params.id);
  if (item) {
    await deleteWardrobePhoto(item.s3Key).catch(() => {});
    if (item.s3KeyProcessed) await deleteWardrobePhoto(item.s3KeyProcessed).catch(() => {});
  }
  await permanentlyDeleteItem(userId, req.params.id);
  res.json({ ok: true });
}
