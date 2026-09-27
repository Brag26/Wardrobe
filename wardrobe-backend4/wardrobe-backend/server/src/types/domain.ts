// server/src/types/domain.ts
// Domain types for the AI Wardrobe backend — fully-AWS build
// (DynamoDB + S3 + Cognito). Covers both flows from the Figma:
//  A) Ara chat/styling flow: Welcome -> Occasion -> Mood -> Build ->
//     Reasoning -> Story -> Discover/Shuffle -> Drag Studio -> Chat
//  B) Full closet management: Home/Overview -> Closet -> Add Items
//     (camera/album/bulk + background removal) -> Item Details ->
//     Create Outfit -> Outfit list -> Favorites -> Bin/Delete -> Filters

export type Occasion =
  | 'office' | 'coffee' | 'date' | 'party' | 'wedding'
  | 'brunch' | 'beach' | 'event' | 'travel';

export type Mood =
  | 'confident' | 'romantic' | 'elegant' | 'playful' | 'calm' | 'creative';

// No locked list here either — the Details screen's "+Add" button next
// to the category picker means users can add their own, same as
// color/style/season below. SUGGESTED_CATEGORIES seeds the picker UI;
// the stored value is free text.
//
// v3: real fashion-accurate subtypes, not just broad buckets — the
// previous list still had "bra"/"briefs" as single flat entries, which
// isn't how intimates actually get organized (a sports bra, a
// bralette, and a push-up bra are different garments a person wants to
// find separately). Same treatment applied to dresses/tops/bottoms/
// outerwear rather than singling out just intimates. Naming pattern is
// "{broad_type}_{specific_style}" (e.g. 'bra_sports', 'dress_bodycon')
// so the underlying garment type is still machine-readable — see
// categorizeForOutfitSlot() in aiStylist.service.ts, which groups by
// PREFIX rather than an exact-match list, so new subtypes added here
// later don't also require an aiStylist.service.ts edit to stay
// pickable by Ara's outfit generator.
export const SUGGESTED_CATEGORIES = [
  // tops
  'top', 'shirt', 't_shirt', 'blouse', 'tank_top', 'top_crop', 'top_tube', 'top_halter', 'top_peplum',
  'top_wrap', 'top_coldshoulder', 'top_bardot', 'top_bustier', 'top_corset', 'bodysuit',
  'sweater', 'hoodie', 'kurti', 'tunic', 'camisole',
  // bottoms
  'bottom', 'pants', 'pants_cargo', 'pants_palazzo', 'pants_widelegged', 'trousers',
  'jeans', 'jeans_skinny', 'jeans_mom', 'jeans_boyfriend', 'jeans_bootcut', 'jeans_flare',
  'shorts', 'shorts_bermuda', 'shorts_denim', 'shorts_bike', 'culottes',
  'skirt', 'skirt_mini', 'skirt_midi', 'skirt_maxi', 'skirt_pencil', 'skirt_pleated', 'skirt_wrap', 'skirt_aline',
  'leggings', 'track_pants', 'joggers', 'capris', 'lounge_pants',
  // one-piece
  'dress', 'dress_bodycon', 'dress_maxi', 'dress_midi', 'dress_mini', 'dress_wrap', 'dress_shift',
  'dress_aline', 'dress_slip', 'dress_sheath', 'dress_fitflare', 'dress_offshoulder', 'dress_cocktail',
  'dress_ballgown', 'dress_sundress', 'dress_shirtdress', 'dress_sweaterdress',
  'jumpsuit', 'kurta_set', 'saree', 'gown',
  // outerwear
  'outerwear', 'jacket', 'jacket_bomber', 'jacket_denim', 'jacket_leather', 'jacket_puffer', 'jacket_varsity',
  'coat', 'coat_trench', 'blazer', 'cardigan', 'kimono', 'cape', 'shrug', 'bath_robe', 'mufflers',
  // footwear
  'shoes', 'sneakers', 'heels', 'flats', 'sandals', 'flip_flops', 'boots', 'sports_sandals',
  // bags
  'bag', 'handbag', 'backpack', 'clutch', 'mobile_pouch',
  // accessories & jewellery
  'accessory', 'jewellery', 'watch', 'ring', 'bangle', 'belt', 'scarf', 'dupatta', 'cap', 'sunglasses',
  // intimates — bras, by type (as requested: named individually, not
  // lumped into one generic "bra" entry)
  'bra_everyday', 'bra_tshirt', 'bra_pushup', 'bra_sports', 'bra_strapless', 'bra_plunge',
  'bra_balconette', 'bra_underwire', 'bra_wireless', 'bra_minimizer', 'bra_nursing',
  'bra_backless', 'bra_racerback', 'bra_bandeau', 'bra_corset', 'bra_longline', 'bra_bralette',
  // intimates — briefs/underwear, by type
  'brief_bikini', 'brief_hipster', 'brief_highwaist', 'brief_seamless', 'brief_control',
  'brief_cheeky', 'thong', 'gstring', 'boyshorts',
  // shapewear
  'shapewear_bodysuit', 'shapewear_waist', 'shapewear_thigh',
  // beauty & personal care (Figma's "Add outfits" catalog includes these alongside clothing)
  'lipstick', 'lip_gloss', 'lip_care', 'kajal_eyeliner', 'foundation_primer', 'highlighter_blush', 'compact',
  'nail_polish', 'face_wash_cleanser', 'face_moisturiser', 'perfume_body_mist', 'fragrance_gift_set', 'beauty_accessory',
  // sleep/loungewear/swim
  'nightdress', 'night_suit', 'pajama_set', 'robe', 'baby_doll', 'swimwear',
  // misc
  'socks', 'wallet', 'travel_accessory', 'free_gift',
] as const;

export type ClothingCategory = string;

// No locked vocabulary for these — the team confirmed there's no fixed
// list. These are SUGGESTED defaults only (seed the picker UI / used as
// a fallback for the suggestions endpoint below); the actual stored
// value is free text, so it can grow from what the AI suggests and what
// users type in, without a backend deploy every time someone wants a
// new color/style/season name.
export const SUGGESTED_COLORS = [
  'black', 'white', 'cream', 'grey', 'beige', 'red', 'pink',
  'navy', 'green', 'mint', 'blue', 'orange', 'teal', 'yellow',
  'purple', 'sage', 'lavender', 'brown', 'olive', 'burgundy',
  'tan', 'turquoise', 'chocolate', 'multicolor',
] as const;

export const SUGGESTED_STYLES = [
  'casual', 'formal', 'business', 'evening_wear', 'sport', 'party_wear',
] as const;

// Trend/aesthetic tags — separate from SUGGESTED_STYLES on purpose.
// "Style" (casual/formal/business) is functional; "aesthetic" is the
// actual vocabulary people use to describe a look on social media —
// "this fits the vibe" more than "this is business casual". Lets
// Ara's chat and outfit generation work with that language directly
// instead of forcing everything through occasion/mood only.
//
// Mixed generations deliberately: the first wave here (clean_girl,
// y2k, dark_academia, e_girl...) is TikTok/Gen-Z coded; the second
// wave (quiet_luxury, capsule_wardrobe, parisian_chic, athleisure...)
// is the vocabulary millennials actually use for the same idea — a
// millennial user searching this list for "old money" would find it,
// but not necessarily "clean girl" for the same look. Free-text field,
// so nothing here is exclusive; it's the seed list a person searches
// against, and it should recognize itself across age groups.
export const SUGGESTED_AESTHETICS = [
  // Gen-Z / TikTok coded
  'clean_girl', 'coastal_grandma', 'dark_academia', 'light_academia', 'y2k', 'cottagecore',
  'streetwear', 'indie_sleaze', 'balletcore', 'gorpcore', 'cyber_y2k',
  'soft_girl', 'e_girl', 'grunge', 'kidcore', 'goth', 'barbiecore',
  // Millennial-coded (same idea, different vocabulary)
  'quiet_luxury', 'capsule_wardrobe', 'parisian_chic', 'athleisure', 'boho_chic',
  'workwear_staples', 'scandi_minimalist', 'timeless_classic', 'resort_wear', 'coastal',
  // Broadly cross-generational
  'old_money', 'preppy', 'minimalist', 'maximalist', 'vintage', 'bohemian', 'normcore',
] as const;

export const SUGGESTED_SEASONS = [
  'summer', 'autumn', 'winter', 'monsoon', 'spring', 'all_season',
] as const;

export type ClothingColor = string;
export type OutfitStyle = string;
export type Season = string;

export type BackgroundRemovalStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface WardrobeItem {
  id: string;
  userId: string;

  // image
  s3Key: string;                 // original upload, e.g. "wardrobe/{userId}/{itemId}/original.jpg"
  s3KeyProcessed: string | null; // background-removed version, once ready
  imageUrl: string;              // derived from s3KeyProcessed if present, else s3Key
  backgroundRemoval: {
    status: BackgroundRemovalStatus;
    error: string | null;
  };

  // core classification
  category: ClothingCategory;
  color: ClothingColor;
  occasionTags: Occasion[];
  moodTags: Mood[];

  // "Details" screen fields
  name: string | null;
  description: string | null;
  style: OutfitStyle | null;
  season: Season | null;
  rating: number | null;         // 0-5
  brand: string | null;
  price: number | null;
  size: string | null;
  material: string | null;

  // usage / lifecycle
  wearCount: number;
  lastWornAt: number | null;
  isFavorite: boolean;
  archivedAt: number | null;     // "Archive" (Closet Section board) — hidden from the main closet grid but NOT deleted; separate from deletedAt/Bin
  deletedAt: number | null;      // soft-delete ("Move to Bin") — null = active
  sortOrder: number;             // manual ordering from the "Reamange the order of items" screen — lower shows first

  createdAt: number;
  updatedAt: number;
}

// One pass through the Ara chat flow (Occasion -> Mood -> Build -> Story)
export type StylingSessionStatus = 'collecting' | 'generating' | 'ready';

export interface StylingSession {
  id: string;
  userId: string;
  occasion: Occasion | null;
  mood: Mood | null;
  status: StylingSessionStatus;
  resultOutfitId: string | null;
  reasoningSteps: string[] | null;
  createdAt: number;
  updatedAt: number;
}

// "My Outfits" — either AI-generated or manually built in Create Outfit / Drag Studio
export interface Outfit {
  id: string;
  userId: string;
  sessionId: string | null;

  name: string | null;
  description: string | null;

  // slot-based composition, matches "Create Outfit" screen (Tops/Pants/Shoes/Bags)
  itemIdsBySlot: {
    tops: string[];
    pants: string[];
    shoes: string[];
    bags: string[];
    other: string[];
  };
  itemIds: string[]; // flattened, for quick lookups/queries

  category: OutfitStyle | null;
  customCategories: string[]; // user-defined categories added via "+ Add"
  season: Season | null;
  rating: number | null;
  aesthetic: string | null; // trend/vibe tag, e.g. "clean_girl" — see SUGGESTED_AESTHETICS

  // "Add outfits" form's own metadata fields (separate from any single
  // item's brand/price/etc — this is store/collection-level info, e.g.
  // "this look is from Forever 21" even though individual pieces vary)
  brand: string | null;
  price: number | null;
  size: string | null;
  material: string | null;

  story: string | null;
  matchScore: number | null;
  source: 'ai_generated' | 'drag_studio' | 'manual' | 'shuffle';
  isFavorite: boolean;
  deletedAt: number | null;

  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  role: 'user' | 'assistant';
  text: string;
  // The photo the PERSON attached to their own message (not an item
  // photo) — was never persisted at all before, so a photo attached to
  // a user message vanished after the optimistic bubble was replaced by
  // the reloaded history, leaving only the literal "[+ photo attached]"
  // text with nothing to actually look at.
  imageUrl?: string | null;
  suggestedOutfitIds: string[] | null;
  referencedItemIds: string[] | null; // items Ara's reply actually mentions by name/color+category — lets the chat UI show a real picture instead of just describing an item in text
  quickReplies: string[] | null;
  createdAt: number;
}

// Closet Overview stat card (item/outfit/favorite counts on the home screen)
export interface ClosetOverview {
  totalItems: number;
  totalOutfits: number;
  totalFavorites: number;
  itemsByCategory: Record<string, number>;
}

// Query params for GET /api/items (Closet screen tabs + Filter panel)
export interface ItemListFilters {
  category?: ClothingCategory | 'all';
  color?: ClothingColor[];
  season?: Season[];
  style?: OutfitStyle;
  includeDeleted?: boolean; // true only for the Bin view
  includeArchived?: boolean; // true only for the Archive view — archived items are excluded from the normal closet grid by default
  favoritesOnly?: boolean;
  search?: string;
}

// "Start packing" / trip flow (Outfit Section board) — a named trip
// with a date range and a set of outfits earmarked for it. Distinct
// from a single Outfit: this is a collection of outfit references +
// trip metadata (destination, cover image, dates), not clothing itself.
export interface Packing {
  id: string;
  userId: string;
  name: string | null;          // trip name, e.g. "Australia"
  coverImageUrl: string | null;
  destination: string | null;
  startDate: string | null;     // 'YYYY-MM-DD'
  endDate: string | null;       // 'YYYY-MM-DD'
  outfitIds: string[];          // outfits packed for this trip
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

// User (phone OTP -> JWT auth, per the real production spec — not Cognito)
// Standard fashion-industry body shape categories — self-selected, not
// AI-guessed from a photo (confirmed decision: self-select is more
// reliable than AI estimating shape from a single image angle).
export const BODY_SHAPES = ['hourglass', 'pear', 'apple', 'rectangle', 'inverted_triangle'] as const;
export type BodyShape = (typeof BODY_SHAPES)[number];

export interface ColorProfile {
  undertone: string;           // e.g. "warm", "cool", "neutral"
  recommendedColors: string[]; // e.g. ["burgundy", "olive", "cream"]
  avoidColors: string[];
  explanation: string;         // short AI-written note on why
  analyzedAt: number;
}

export interface User {
  id: string;           // Mongo _id as string
  phone: string;        // E.164 format, e.g. "+919876543210"
  name: string | null;
  bodyShape: BodyShape | null;
  colorProfile: ColorProfile | null;
  createdAt: number;
  lastLoginAt: number | null;
}

export interface OtpRequest {
  phone: string;
  code: string;          // 6-digit, hashed at rest — see auth.service.ts
  expiresAt: number;
  attempts: number;
  createdAt: number;
}

// Mongoose collection names (MongoDB Atlas)
export const COLLECTIONS = {
  users: 'users',
  otpRequests: 'otp_requests',
  wardrobeItems: 'wardrobe_items',
  outfits: 'outfits',
  stylingSessions: 'styling_sessions',
  chatMessages: 'chat_messages',
  dailyPicks: 'daily_picks',
  packings: 'packings',
  calendarEntries: 'calendar_entries',
  recommendationLogs: 'recommendation_logs',
} as const;

// One row per "AI Recommendation for fits" generated (Discover's
// category picks + the Shuffle button) — serves two purposes:
//   1. Rate limiting (item 10): counting today's rows per user enforces
//      AI_RECOMMENDATION_DAILY_LIMIT without a separate counter table.
//   2. History (item 11): "history should be there to verify what were
//      selected previously" — the Discover screen lists past picks from
//      this same log, and pickOutfitItems() uses recent itemIds here to
//      avoid immediately repeating the same combination.
export interface RecommendationLog {
  id: string;
  userId: string;
  itemIds: string[];
  occasion: Occasion | null;
  mood: Mood | null;
  matchScore: number | null;
  createdAt: number;
}

// "Outfit of the Day" calendar (Home board's Calendar screen) — one
// outfit assigned per date, past or future ("plan ahead" and "log what
// I wore" are the same operation here: set the outfit for a date).
// NOTE: per-day only (one outfit per date), not the richer multi-event
// scheduling a real calendar/booking product like Calendly handles —
// this is a single-purpose "outfit for this day" tracker, matching what
// the Figma board actually shows (one look per date cell).
export interface CalendarEntry {
  id: string;
  userId: string;
  date: string;        // 'YYYY-MM-DD'
  outfitId: string;
  note: string | null;
  createdAt: number;
  updatedAt: number;
}
// "Today's Pick by Ara" — generated ONCE per calendar day per user, then
// cached and reused for every request that day (not regenerated on
// every screen visit — that's the "real daily-rotating" behavior confirmed).
export interface DailyPick {
  id: string;
  userId: string;
  date: string;          // 'YYYY-MM-DD', the cache key
  itemIds: string[];
  story: string | null;
  matchScore: number | null;
  createdAt: number;
}
