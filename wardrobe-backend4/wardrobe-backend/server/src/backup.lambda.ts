// server/src/backup.lambda.ts
// Replaces "node-cron on EC2" for the nightly mongodump -> S3 backup job.
// Lambda has no persistent process to run node-cron on, so this becomes
// a separate Lambda triggered on a schedule by EventBridge instead
// (see infra/serverless.yml's `backup` function + its `schedule` event).
//
// NOTE ON APPROACH: the real `mongodump` binary needs a custom Lambda
// layer (it's a compiled Mongo tool, not an npm package) — doable, but
// adds real deployment complexity for a fairly simple need. This version
// exports every collection's documents as JSON straight through the
// driver instead, gzips them, and uploads to S3. Functionally the same
// backup guarantee (a restorable nightly snapshot in S3), no extra layer
// to maintain. Swap back to real `mongodump` + a Lambda layer later if
// the team specifically needs BSON-level fidelity or point-in-time restore
// tooling that matches mongodump/mongorestore exactly.

import { gzipSync } from 'zlib';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { connectToDatabase } from './services/db';
import {
  WardrobeItemModel, OutfitModel, StylingSessionModel, ChatMessageModel, UserModel,
} from './models/schemas';

const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'ap-south-1' });
const BACKUP_BUCKET = process.env.AWS_BACKUP_BUCKET ?? process.env.AWS_S3_BUCKET ?? '';

const COLLECTIONS_TO_BACKUP = [
  { name: 'wardrobe_items', model: WardrobeItemModel },
  { name: 'outfits', model: OutfitModel },
  { name: 'styling_sessions', model: StylingSessionModel },
  { name: 'chat_messages', model: ChatMessageModel },
  { name: 'users', model: UserModel },
];

export async function handler(): Promise<{ ok: boolean; collectionsBackedUp: number }> {
  await connectToDatabase();
  const dateStamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  for (const { name, model } of COLLECTIONS_TO_BACKUP) {
    const docs = await model.find({}).lean();
    const json = JSON.stringify(docs);
    const gzipped = gzipSync(Buffer.from(json, 'utf-8'));

    await s3.send(new PutObjectCommand({
      Bucket: BACKUP_BUCKET,
      Key: `backups/${dateStamp}/${name}.json.gz`,
      Body: gzipped,
      ContentType: 'application/gzip',
      ContentEncoding: 'gzip',
    }));
  }

  console.log(`[backup] Completed nightly backup for ${dateStamp}`);
  return { ok: true, collectionsBackedUp: COLLECTIONS_TO_BACKUP.length };
}
