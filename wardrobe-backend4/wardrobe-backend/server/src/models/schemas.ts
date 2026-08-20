// server/src/models/schemas.ts
// Mongoose schemas — the MongoDB equivalent of the DynamoDB table
// designs, using the same field shapes from types/domain.ts.
//
// Indexing notes:
// - Every schema indexes { userId: 1 } since almost every query is
//   scoped to "this user's stuff" (the same role userId played as the
//   DynamoDB partition key).
// - Compound indexes below match the actual query patterns used by the
//   controllers (category filter, favorites, bin, chat ordering) so
//   MongoDB can use an index instead of a collection scan as closets grow.

import mongoose, { Schema } from 'mongoose';
import { COLLECTIONS } from '../types/domain';

const BackgroundRemovalSchema = new Schema({
  status: { type: String, enum: ['pending', 'processing', 'done', 'failed'], required: true },
  error: { type: String, default: null },
}, { _id: false });

const WardrobeItemSchema = new Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  s3Key: { type: String, required: true },
  s3KeyProcessed: { type: String, default: null },
  imageUrl: { type: String, required: true },
  backgroundRemoval: { type: BackgroundRemovalSchema, required: true },
  category: { type: String, required: true, index: true },
  color: { type: String, required: true },
  occasionTags: { type: [String], default: [] },
  moodTags: { type: [String], default: [] },
  name: { type: String, default: null },
  description: { type: String, default: null },
  style: { type: String, default: null },
  season: { type: String, default: null },
  rating: { type: Number, default: null },
  brand: { type: String, default: null },
  price: { type: Number, default: null },
  size: { type: String, default: null },
  material: { type: String, default: null },
  wearCount: { type: Number, default: 0 },
  lastWornAt: { type: Number, default: null },
  isFavorite: { type: Boolean, default: false, index: true },
  archivedAt: { type: Number, default: null, index: true },
  deletedAt: { type: Number, default: null, index: true },
  sortOrder: { type: Number, default: 0 },
  createdAt: { type: Number, required: true },
  updatedAt: { type: Number, required: true },
});
WardrobeItemSchema.index({ userId: 1, category: 1 });
WardrobeItemSchema.index({ userId: 1, isFavorite: 1 });
WardrobeItemSchema.index({ userId: 1, deletedAt: 1 });
WardrobeItemSchema.index({ userId: 1, createdAt: -1 });

const OutfitSchema = new Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  sessionId: { type: String, default: null },
  name: { type: String, default: null },
  description: { type: String, default: null },
  itemIdsBySlot: {
    tops: { type: [String], default: [] },
    pants: { type: [String], default: [] },
    shoes: { type: [String], default: [] },
    bags: { type: [String], default: [] },
    other: { type: [String], default: [] },
  },
  itemIds: { type: [String], default: [] },
  category: { type: String, default: null, index: true },
  customCategories: { type: [String], default: [] },
  season: { type: String, default: null },
  rating: { type: Number, default: null },
  aesthetic: { type: String, default: null, index: true },
  brand: { type: String, default: null },
  price: { type: Number, default: null },
  size: { type: String, default: null },
  material: { type: String, default: null },
  story: { type: String, default: null },
  matchScore: { type: Number, default: null },
  source: { type: String, enum: ['ai_generated', 'drag_studio', 'manual', 'shuffle'], required: true },
  isFavorite: { type: Boolean, default: false, index: true },
  deletedAt: { type: Number, default: null },
  createdAt: { type: Number, required: true },
  updatedAt: { type: Number, required: true },
});
OutfitSchema.index({ userId: 1, category: 1 });
OutfitSchema.index({ userId: 1, createdAt: -1 });

const StylingSessionSchema = new Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  occasion: { type: String, default: null },
  mood: { type: String, default: null },
  status: { type: String, enum: ['collecting', 'generating', 'ready'], required: true },
  resultOutfitId: { type: String, default: null },
  reasoningSteps: { type: [String], default: null },
  createdAt: { type: Number, required: true },
  updatedAt: { type: Number, required: true },
});

const ChatMessageSchema = new Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  text: { type: String, required: true },
  suggestedOutfitIds: { type: [String], default: null },
  referencedItemIds: { type: [String], default: null },
  quickReplies: { type: [String], default: null },
  createdAt: { type: Number, required: true },
});
ChatMessageSchema.index({ userId: 1, createdAt: 1 });

const ColorProfileSchema = new Schema({
  undertone: { type: String, required: true },
  recommendedColors: { type: [String], default: [] },
  avoidColors: { type: [String], default: [] },
  explanation: { type: String, default: '' },
  analyzedAt: { type: Number, required: true },
}, { _id: false });

const UserSchema = new Schema({
  phone: { type: String, required: true, unique: true, index: true },
  name: { type: String, default: null },
  bodyShape: { type: String, default: null },
  colorProfile: { type: ColorProfileSchema, default: null },
  createdAt: { type: Number, required: true },
  lastLoginAt: { type: Number, default: null },
});

const OtpRequestSchema = new Schema({
  phone: { type: String, required: true, index: true },
  codeHash: { type: String, required: true }, // never store the raw code
  expiresAt: { type: Number, required: true },
  attempts: { type: Number, default: 0 },
  createdAt: { type: Number, required: true },
});
// TTL index — Mongo automatically deletes expired OTP docs, no cleanup job needed
OtpRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Separate append-only log purely for rate limiting (1 request / 60s,
// max 5 / hour per phone — confirmed limits). Kept independent from
// OtpRequestSchema above because that collection's TTL deletes docs
// after the 5-minute code expiry, which is too short a window to
// enforce an hourly limit against. Each request adds one row here;
// the TTL index below auto-expires rows after 1 hour so this table
// never grows unbounded.
const OtpRateLimitLogSchema = new Schema({
  phone: { type: String, required: true, index: true },
  requestedAt: { type: Number, required: true },
});
OtpRateLimitLogSchema.index({ phone: 1, requestedAt: 1 });
OtpRateLimitLogSchema.index({ requestedAt: 1 }, { expireAfterSeconds: 3600 });

const DailyPickSchema = new Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  date: { type: String, required: true }, // 'YYYY-MM-DD'
  itemIds: { type: [String], default: [] },
  story: { type: String, default: null },
  matchScore: { type: Number, default: null },
  createdAt: { type: Number, required: true },
});
// One pick per user per day, enforced at the DB level — a second
// "create" for the same user+date will throw a duplicate-key error,
// which the service layer catches and treats as "already generated,
// fetch the existing one instead" (see mongodb.service.ts).
DailyPickSchema.index({ userId: 1, date: 1 }, { unique: true });

// "Start packing" trips (Outfit Section board)
const PackingSchema = new Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  name: { type: String, default: null },
  coverImageUrl: { type: String, default: null },
  destination: { type: String, default: null },
  startDate: { type: String, default: null },
  endDate: { type: String, default: null },
  outfitIds: { type: [String], default: [] },
  deletedAt: { type: Number, default: null, index: true },
  createdAt: { type: Number, required: true },
  updatedAt: { type: Number, required: true },
});
PackingSchema.index({ userId: 1, createdAt: -1 });

// "Outfit of the Day" calendar entries
const CalendarEntrySchema = new Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  date: { type: String, required: true },
  outfitId: { type: String, required: true },
  note: { type: String, default: null },
  createdAt: { type: Number, required: true },
  updatedAt: { type: Number, required: true },
});
// One entry per user per date — setting a new outfit for a date
// updates the existing entry rather than creating a duplicate.
CalendarEntrySchema.index({ userId: 1, date: 1 }, { unique: true });

// mongoose.models check avoids "OverwriteModelError" on Lambda warm starts,
// where the module can be re-evaluated without the process fully restarting.
export const WardrobeItemModel = mongoose.models.WardrobeItem ?? mongoose.model(COLLECTIONS.wardrobeItems, WardrobeItemSchema);
export const OutfitModel = mongoose.models.Outfit ?? mongoose.model(COLLECTIONS.outfits, OutfitSchema);
export const StylingSessionModel = mongoose.models.StylingSession ?? mongoose.model(COLLECTIONS.stylingSessions, StylingSessionSchema);
export const ChatMessageModel = mongoose.models.ChatMessage ?? mongoose.model(COLLECTIONS.chatMessages, ChatMessageSchema);
export const UserModel = mongoose.models.User ?? mongoose.model(COLLECTIONS.users, UserSchema);
export const OtpRequestModel = mongoose.models.OtpRequest ?? mongoose.model(COLLECTIONS.otpRequests, OtpRequestSchema);
export const OtpRateLimitLogModel = mongoose.models.OtpRateLimitLog ?? mongoose.model('otp_rate_limit_log', OtpRateLimitLogSchema);
export const DailyPickModel = mongoose.models.DailyPick ?? mongoose.model(COLLECTIONS.dailyPicks, DailyPickSchema);
export const PackingModel = mongoose.models.Packing ?? mongoose.model(COLLECTIONS.packings, PackingSchema);
export const CalendarEntryModel = mongoose.models.CalendarEntry ?? mongoose.model(COLLECTIONS.calendarEntries, CalendarEntrySchema);
