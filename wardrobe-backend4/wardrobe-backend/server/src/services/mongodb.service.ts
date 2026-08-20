// server/src/services/mongodb.service.ts
//
// Data access on MongoDB Atlas, matching the real production spec
// (see the architecture table shared in chat). Every exported function
// here has the SAME name and signature as the dynamodb.service.ts
// version it replaces, so controllers only need their import path
// changed, not their logic.

import { connectToDatabase } from './db';
import { randomUUID } from 'crypto';
import {
  WardrobeItemModel, OutfitModel, StylingSessionModel, ChatMessageModel, DailyPickModel, PackingModel, CalendarEntryModel,
} from '../models/schemas';
import {
  WardrobeItem, Outfit, StylingSession, ChatMessage, ItemListFilters, DailyPick, Packing, CalendarEntry,
  SUGGESTED_COLORS, SUGGESTED_STYLES, SUGGESTED_SEASONS, SUGGESTED_CATEGORIES, SUGGESTED_AESTHETICS,
} from '../types/domain';

function strip(doc: any) {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : doc;
  delete obj._id;
  delete obj.__v;
  return obj;
}

// ---------- Wardrobe Items ----------

export async function createWardrobeItem(item: WardrobeItem): Promise<void> {
  await connectToDatabase();
  await WardrobeItemModel.create(item);
}

export async function getWardrobeItem(userId: string, id: string): Promise<WardrobeItem | null> {
  await connectToDatabase();
  const doc = await WardrobeItemModel.findOne({ userId, id }).lean();
  return doc ? (strip(doc) as WardrobeItem) : null;
}

export async function listWardrobeItems(userId: string, filters: ItemListFilters = {}): Promise<WardrobeItem[]> {
  await connectToDatabase();
  const query: Record<string, any> = { userId };

  query.deletedAt = filters.includeDeleted ? { $ne: undefined } : null;
  // Archived items are hidden from the normal closet grid by default —
  // same idea as the Bin, but its own separate flag/screen.
  if (!filters.includeArchived) query.archivedAt = null;
  if (filters.category && filters.category !== 'all') query.category = filters.category;
  if (filters.color?.length) query.color = { $in: filters.color };
  if (filters.season?.length) query.season = { $in: filters.season };
  if (filters.style) query.style = filters.style;
  if (filters.favoritesOnly) query.isFavorite = true;
  if (filters.search) {
    const re = new RegExp(filters.search, 'i');
    query.$or = [{ name: re }, { brand: re }, { category: re }];
  }

  const docs = await WardrobeItemModel.find(query).sort({ sortOrder: 1, createdAt: -1 }).lean();
  return docs.map(strip) as WardrobeItem[];
}

export async function getWardrobeItemsByIds(userId: string, ids: string[]): Promise<WardrobeItem[]> {
  if (ids.length === 0) return [];
  await connectToDatabase();
  const docs = await WardrobeItemModel.find({ userId, id: { $in: ids } }).lean();
  return docs.map(strip) as WardrobeItem[];
}

export async function updateWardrobeItem(userId: string, id: string, patch: Partial<WardrobeItem>): Promise<void> {
  await connectToDatabase();
  await WardrobeItemModel.updateOne({ userId, id }, { $set: { ...patch, updatedAt: Date.now() } });
}

export async function markItemWorn(userId: string, id: string, currentWearCount: number): Promise<void> {
  await updateWardrobeItem(userId, id, { wearCount: currentWearCount + 1, lastWornAt: Date.now() });
}

export async function toggleItemFavorite(userId: string, id: string, isFavorite: boolean): Promise<void> {
  await updateWardrobeItem(userId, id, { isFavorite });
}

export async function softDeleteItem(userId: string, id: string): Promise<void> {
  await updateWardrobeItem(userId, id, { deletedAt: Date.now() });
}

export async function restoreItem(userId: string, id: string): Promise<void> {
  await connectToDatabase();
  await WardrobeItemModel.updateOne({ userId, id }, { $set: { deletedAt: null, updatedAt: Date.now() } });
}

export async function permanentlyDeleteItem(userId: string, id: string): Promise<void> {
  await connectToDatabase();
  await WardrobeItemModel.deleteOne({ userId, id });
}

// ---------- Archive (Closet Section board) ----------
// Distinct from the Bin/soft-delete above: archived items are hidden
// from the normal closet grid but not on a path to permanent deletion —
// they show up in their own Archive screen and can be unarchived any
// time. An item can't be both archived and deleted at once in the UI's
// model, but this doesn't enforce that at the DB level (deletedAt still
// wins — the Bin is checked first everywhere archivedAt is read).

export async function archiveItem(userId: string, id: string): Promise<void> {
  await updateWardrobeItem(userId, id, { archivedAt: Date.now() });
}

export async function unarchiveItem(userId: string, id: string): Promise<void> {
  await connectToDatabase();
  await WardrobeItemModel.updateOne({ userId, id }, { $set: { archivedAt: null, updatedAt: Date.now() } });
}

export async function listArchivedItems(userId: string): Promise<WardrobeItem[]> {
  await connectToDatabase();
  const docs = await WardrobeItemModel.find({ userId, archivedAt: { $ne: null }, deletedAt: null }).sort({ archivedAt: -1 }).lean();
  return docs.map(strip) as WardrobeItem[];
}

// ---------- Manual item ordering ("Reamange the order of items") ----------

export async function reorderWardrobeItems(userId: string, orderedIds: string[]): Promise<void> {
  await connectToDatabase();
  await Promise.all(
    orderedIds.map((id, idx) =>
      WardrobeItemModel.updateOne({ userId, id }, { $set: { sortOrder: idx, updatedAt: Date.now() } })
    )
  );
}

// ---------- Styling Sessions ----------

export async function createStylingSession(session: StylingSession): Promise<void> {
  await connectToDatabase();
  await StylingSessionModel.create(session);
}

export async function updateStylingSession(userId: string, id: string, patch: Partial<StylingSession>): Promise<void> {
  await connectToDatabase();
  await StylingSessionModel.updateOne({ userId, id }, { $set: { ...patch, updatedAt: Date.now() } });
}

export async function getStylingSession(userId: string, id: string): Promise<StylingSession | null> {
  await connectToDatabase();
  const doc = await StylingSessionModel.findOne({ userId, id }).lean();
  return doc ? (strip(doc) as StylingSession) : null;
}

// ---------- Outfits ----------

export async function createOutfit(outfit: Outfit): Promise<void> {
  await connectToDatabase();
  await OutfitModel.create(outfit);
}

export async function getOutfit(userId: string, id: string): Promise<Outfit | null> {
  await connectToDatabase();
  const doc = await OutfitModel.findOne({ userId, id }).lean();
  return doc ? (strip(doc) as Outfit) : null;
}

export async function updateOutfit(userId: string, id: string, patch: Partial<Outfit>): Promise<void> {
  await connectToDatabase();
  await OutfitModel.updateOne({ userId, id }, { $set: { ...patch, updatedAt: Date.now() } });
}

export async function getOutfitsForUser(userId: string, category?: string, includeDeleted = false, extraFilters?: { season?: string; minRating?: number; color?: string; aesthetic?: string }): Promise<Outfit[]> {
  await connectToDatabase();
  const query: Record<string, any> = { userId };
  query.deletedAt = includeDeleted ? { $ne: undefined } : null;
  if (category && category !== 'all') {
    query.$or = [{ category }, { customCategories: category }];
  }
  if (extraFilters?.season) query.season = extraFilters.season;
  if (extraFilters?.minRating != null) query.rating = { $gte: extraFilters.minRating };
  if (extraFilters?.aesthetic) query.aesthetic = extraFilters.aesthetic;

  let docs = await OutfitModel.find(query).sort({ createdAt: -1 }).lean();
  let outfits = docs.map(strip) as Outfit[];

  // Color isn't a field on Outfit itself (a look is made of several
  // items, each with its own color) — filtering by color means
  // filtering by "does any piece in this outfit have that color",
  // which needs a lookup against the item ids rather than a plain
  // Mongo query field.
  if (extraFilters?.color) {
    const allItemIds = Array.from(new Set(outfits.flatMap((o) => o.itemIds)));
    if (allItemIds.length > 0) {
      const items = await WardrobeItemModel.find({ userId, id: { $in: allItemIds }, color: extraFilters.color }).select('id').lean();
      const matchingIds = new Set(items.map((i: any) => i.id));
      outfits = outfits.filter((o) => o.itemIds.some((id) => matchingIds.has(id)));
    } else {
      outfits = [];
    }
  }

  return outfits;
}

export async function softDeleteOutfit(userId: string, id: string): Promise<void> {
  await updateOutfit(userId, id, { deletedAt: Date.now() });
}

// ---------- Chat ----------

export async function saveChatMessage(message: ChatMessage): Promise<void> {
  await connectToDatabase();
  await ChatMessageModel.create(message);
}

export async function getChatHistory(userId: string, limit = 50): Promise<ChatMessage[]> {
  await connectToDatabase();
  const docs = await ChatMessageModel.find({ userId }).sort({ createdAt: 1 }).limit(limit).lean();
  return docs.map(strip) as ChatMessage[];
}

export async function clearChatHistory(userId: string): Promise<void> {
  await connectToDatabase();
  await ChatMessageModel.deleteMany({ userId });
}

// ---------- Closet Overview ----------

export async function getClosetOverview(userId: string) {
  const [items, outfits] = await Promise.all([
    listWardrobeItems(userId),
    getOutfitsForUser(userId),
  ]);
  const itemsByCategory: Record<string, number> = {};
  for (const item of items) itemsByCategory[item.category] = (itemsByCategory[item.category] ?? 0) + 1;
  return {
    totalItems: items.length,
    totalOutfits: outfits.length,
    totalFavorites: items.filter((i) => i.isFavorite).length,
    itemsByCategory,
  };
}

// S5's "Expense by Category" budget breakdown — sums each item's `price`
// field, grouped by category. Items with no price set are excluded from
// totals but counted separately so the UI can show "X items have no
// price recorded" rather than silently treating them as free.
export async function getExpenseBreakdown(userId: string) {
  const items = await listWardrobeItems(userId);
  const byCategory: Record<string, number> = {};
  let total = 0;
  let itemsWithoutPrice = 0;

  for (const item of items) {
    if (typeof item.price !== 'number') {
      itemsWithoutPrice += 1;
      continue;
    }
    byCategory[item.category] = (byCategory[item.category] ?? 0) + item.price;
    total += item.price;
  }

  return {
    total,
    byCategory,
    itemsWithoutPrice,
    itemsPriced: items.length - itemsWithoutPrice,
  };
}

// ---------- Attribute suggestions (color/style/season — no locked list) ----------
//
// Since there's no fixed vocabulary, suggestions are: the built-in
// seed list, PLUS whatever values this user has actually typed before
// (so their own past entries become autocomplete options), deduped.
// AI-suggested values naturally join this pool too, since the AI writes
// them onto items/outfits the same way a manual entry would.

export async function getAttributeSuggestions(userId: string) {
  await connectToDatabase();

  const [usedCategories, usedColors, usedStyles, usedSeasons, usedAesthetics] = await Promise.all([
    WardrobeItemModel.distinct('category', { userId, deletedAt: null }),
    WardrobeItemModel.distinct('color', { userId, deletedAt: null }),
    WardrobeItemModel.distinct('style', { userId, deletedAt: null }),
    WardrobeItemModel.distinct('season', { userId, deletedAt: null }),
    OutfitModel.distinct('aesthetic', { userId, deletedAt: null }),
  ]);

  const dedupe = (seed: readonly string[], used: any[]) =>
    Array.from(new Set([...seed, ...used.filter((v) => typeof v === 'string' && v)]));

  return {
    categories: dedupe(SUGGESTED_CATEGORIES, usedCategories),
    colors: dedupe(SUGGESTED_COLORS, usedColors),
    styles: dedupe(SUGGESTED_STYLES, usedStyles),
    seasons: dedupe(SUGGESTED_SEASONS, usedSeasons),
    aesthetics: dedupe(SUGGESTED_AESTHETICS, usedAesthetics),
  };
}

// ---------- Outfit categories (My Outfits tabs — system + per-user custom) ----------
//
// Decision: per-user dynamic tabs. System categories (casual/formal/
// business/evening_wear/sport) always show first, then any custom
// categories this specific user has actually created via "+ Add" on
// the Create Outfit screen, deduped and alphabetized.

export async function getOutfitCategories(userId: string) {
  await connectToDatabase();
  const outfits = await OutfitModel.find({ userId, deletedAt: null }).select('customCategories').lean();
  const customSet = new Set<string>();
  for (const o of outfits) {
    for (const c of (o as any).customCategories ?? []) if (c) customSet.add(c);
  }
  return {
    systemCategories: SUGGESTED_STYLES,
    customCategories: Array.from(customSet).sort(),
  };
}

// ---------- Daily Pick ("Today's Pick by Ara") ----------
//
// Decision: real daily-rotating pick, generated once per calendar day
// and cached — not regenerated on every screen visit. `date` is the
// unique key (see schemas.ts's unique index), so a race between two
// simultaneous requests on the same day safely resolves to one winner.

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD', UTC
}

export async function getDailyPick(userId: string): Promise<DailyPick | null> {
  await connectToDatabase();
  const doc = await DailyPickModel.findOne({ userId, date: todayDateString() }).lean();
  return doc ? (strip(doc) as DailyPick) : null;
}

export async function createDailyPick(pick: DailyPick): Promise<DailyPick> {
  await connectToDatabase();
  try {
    const doc = await DailyPickModel.create(pick);
    return strip(doc) as DailyPick;
  } catch (err: any) {
    // Duplicate key (userId+date already exists) — another request beat
    // us to it today. That's fine: fetch and return the existing one
    // instead of erroring, so the client always gets a consistent pick.
    if (err.code === 11000) {
      const existing = await getDailyPick(pick.userId);
      if (existing) return existing;
    }
    throw err;
  }
}

// ---------- Packing / trips ----------

export async function createPacking(packing: Packing): Promise<void> {
  await connectToDatabase();
  await PackingModel.create(packing);
}

export async function getPacking(userId: string, id: string): Promise<Packing | null> {
  await connectToDatabase();
  const doc = await PackingModel.findOne({ userId, id }).lean();
  return doc ? (strip(doc) as Packing) : null;
}

export async function listPackings(userId: string): Promise<Packing[]> {
  await connectToDatabase();
  const docs = await PackingModel.find({ userId, deletedAt: null }).sort({ createdAt: -1 }).lean();
  return docs.map(strip) as Packing[];
}

export async function updatePacking(userId: string, id: string, patch: Partial<Packing>): Promise<void> {
  await connectToDatabase();
  await PackingModel.updateOne({ userId, id }, { $set: { ...patch, updatedAt: Date.now() } });
}

export async function softDeletePacking(userId: string, id: string): Promise<void> {
  await updatePacking(userId, id, { deletedAt: Date.now() });
}

// ---------- Calendar / Outfit of the Day ----------

export async function setCalendarEntry(userId: string, date: string, outfitId: string, note?: string | null): Promise<CalendarEntry> {
  await connectToDatabase();
  const now = Date.now();
  const existing = await CalendarEntryModel.findOne({ userId, date }).lean();
  if (existing) {
    await CalendarEntryModel.updateOne({ userId, date }, { $set: { outfitId, note: note ?? (existing as any).note ?? null, updatedAt: now } });
  } else {
    await CalendarEntryModel.create({ id: randomUUID(), userId, date, outfitId, note: note ?? null, createdAt: now, updatedAt: now });
  }
  const doc = await CalendarEntryModel.findOne({ userId, date }).lean();
  return strip(doc) as CalendarEntry;
}

export async function getCalendarEntry(userId: string, date: string): Promise<CalendarEntry | null> {
  await connectToDatabase();
  const doc = await CalendarEntryModel.findOne({ userId, date }).lean();
  return doc ? (strip(doc) as CalendarEntry) : null;
}

export async function listCalendarEntriesForMonth(userId: string, monthPrefix: string): Promise<CalendarEntry[]> {
  await connectToDatabase();
  // monthPrefix is 'YYYY-MM' — dates are stored as 'YYYY-MM-DD' so a
  // prefix regex is a correct and simple range match.
  const docs = await CalendarEntryModel.find({ userId, date: { $regex: `^${monthPrefix}` } }).lean();
  return docs.map(strip) as CalendarEntry[];
}

export async function deleteCalendarEntry(userId: string, date: string): Promise<void> {
  await connectToDatabase();
  await CalendarEntryModel.deleteOne({ userId, date });
}
