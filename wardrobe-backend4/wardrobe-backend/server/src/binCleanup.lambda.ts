// server/src/binCleanup.lambda.ts
// Bin retention: 30 days (confirmed with the team). Items and outfits
// that have been sitting in the Bin (soft-deleted, deletedAt set) for
// longer than 30 days get permanently removed — including their S3
// photos, so storage doesn't grow forever with things nobody wants back.
//
// Runs on a daily EventBridge schedule (see infra/serverless.yml).

import { connectToDatabase } from './services/db';
import { WardrobeItemModel, OutfitModel } from './models/schemas';
import { deleteWardrobePhoto } from './services/s3.service';

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function handler(): Promise<{ ok: boolean; itemsDeleted: number; outfitsDeleted: number }> {
  await connectToDatabase();
  const cutoff = Date.now() - RETENTION_MS;

  const expiredItems = await WardrobeItemModel.find({
    deletedAt: { $ne: null, $lt: cutoff },
  }).lean();

  for (const item of expiredItems) {
    await deleteWardrobePhoto((item as any).s3Key).catch(() => {});
    if ((item as any).s3KeyProcessed) {
      await deleteWardrobePhoto((item as any).s3KeyProcessed).catch(() => {});
    }
  }
  const itemsResult = await WardrobeItemModel.deleteMany({ deletedAt: { $ne: null, $lt: cutoff } });

  const outfitsResult = await OutfitModel.deleteMany({ deletedAt: { $ne: null, $lt: cutoff } });

  console.log(`[binCleanup] Permanently deleted ${itemsResult.deletedCount} items and ${outfitsResult.deletedCount} outfits older than 30 days in Bin.`);

  return {
    ok: true,
    itemsDeleted: itemsResult.deletedCount ?? 0,
    outfitsDeleted: outfitsResult.deletedCount ?? 0,
  };
}
