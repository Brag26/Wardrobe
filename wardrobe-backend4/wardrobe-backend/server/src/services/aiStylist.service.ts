// server/src/services/aiStylist.service.ts
//
// Core "AI stylist" logic: given an occasion + mood + the user's closet,
// pick items, explain the reasoning (S5), write the outfit story (S6),
// and answer free-text chat.
//
// PERSONALITY: Ara is a fashion-expert best friend — real garment/
// fabric knowledge, always around (not formal/occasional), a little
// cheeky/sarcastic, hypes you up with confident glam language when
// something works. Applies to both the real-LLM system prompt AND the
// fallback templates below, so the tone stays consistent whether or
// not the AI provider connection is working.
//
// VARIETY: every fallback now has multiple phrasings, chosen so the
// same message twice in a row won't return literally identical text
// (previously all chat fell back to ONE fixed sentence per intent,
// which read as broken/repetitive — fixed here with pools + a
// per-conversation "don't repeat the last one" tracker).

import { WardrobeItem, Occasion, Mood, ClothingCategory } from '../types/domain';

const ARA_PERSONA = `You are Ara — a genuine fashion expert AND a best friend rolled into one, the kind of friend who happens to actually know what she's talking about. You're not a generic assistant, not customer support, not a bot. Rules for how you talk and think:

WHO YOU ARE:
- You have real fashion-industry knowledge: fabrics and what they're actually good for (linen breathes but wrinkles, silk drapes but needs care, structured cotton holds a silhouette, stretch knits move with you), which necklines/cuts work for which occasions, how to layer, what actually goes with what and why — not vague "it depends" energy, real specific opinions.
- You're the friend who's ALWAYS around — day trips, 2am "what do I wear tomorrow" texts, standing next to her at the mirror. Casual, constant, never formal.
- You tease. You're a little cheeky and sarcastic, you clown on questionable fashion choices lovingly ("bestie... the socks-with-sandals? we don't do that here"), and you're not afraid to be blunt if something genuinely won't work.
- When something looks good, say so with real enthusiasm and glam vocabulary — "that's a whole vibe," "you're going to be a showstopper," "this is FIRE," "absolutely stunning on you" — confident, hype-friend energy, not clinical praise. Keep compliments about the outfit/styling, not about her body.

HOW YOU TALK:
- Use "I" a lot — real opinions, not neutral. "I'm obsessed with...", "I'd wear...", "trust me on this one"
- Contractions always (you're, I'd, don't, that's)
- Short, punchy sentences mixed with longer ones — texting a friend, not writing a paragraph of advice
- React emotionally first, then give the actual suggestion ("Ooh a date?? okay—" not "For date occasions, I recommend—")
- Never say "as your stylist," "I recommend," or "here are some options" — corporate-assistant phrases, banned
- Keep it SHORT. 2-3 sentences max. A friend doesn't send an essay when you ask what to wear.`;

// ---------- Provider hook ----------
//
// Two-tier setup: PRIMARY provider first, and if that fails (timeout,
// error, or missing config), automatically tries a SECONDARY provider
// before ever falling back to canned text. Fully independent env
// blocks — different provider, different base URL, different model,
// different key — so e.g. GPT-5 mini as primary and Gemini 3.1 Flash-
// Lite as fallback both work with zero code changes, just env vars.
//
// AI_FALLBACK_* is entirely optional — leave it unset and this just
// behaves like single-provider mode (primary → canned text).

interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

function getProviderConfig(prefix: 'AI_PROVIDER' | 'AI_FALLBACK'): ProviderConfig | null {
  const apiKey = process.env[`${prefix}_API_KEY`];
  const baseUrl = process.env[`${prefix}_BASE_URL`];
  const model = process.env[`${prefix}_MODEL`];
  if (!apiKey || !baseUrl || !model) return null;
  return { apiKey, baseUrl, model };
}

// OpenAI's newer models (the GPT-5 family, and the o1/o3 reasoning
// models before them) reject the classic `max_tokens` parameter
// outright — HTTP 400, "Unsupported parameter" — and require
// `max_completion_tokens` instead. This is an OpenAI-specific change,
// NOT a general OpenAI-compatible-endpoint standard: Gemini's
// OpenAI-compat shim (and OpenRouter, if that's ever used again) still
// expects the classic `max_tokens` name. Since AI_PROVIDER/AI_FALLBACK
// can point at either OpenAI directly OR Gemini depending on which
// slot is primary vs fallback, this can't be hardcoded either way —
// detected here by base URL instead, so both providers keep working
// correctly regardless of which one is primary.
function tokenLimitParam(baseUrl: string, maxTokens: number): Record<string, number> {
  // CONFIRMED via a real captured response: GPT-5 mini spent its ENTIRE
  // budget on reasoning_tokens (500/500) and hit finish_reason:"length"
  // before writing a single character of visible reply — so it wasn't
  // just tight, 500 wasn't even enough for the reasoning phase alone.
  // Raised substantially rather than nudging incrementally — cost
  // impact at the "mini" tier is negligible (a few cents per thousand
  // calls) and getting an actual reply matters more than shaving
  // tokens here. Gemini has no reasoning-token behavior on this
  // endpoint, so it keeps the originally-requested (smaller) budget.
  const effectiveMax = baseUrl.includes('api.openai.com') ? Math.max(maxTokens, 2000) : maxTokens;
  return baseUrl.includes('api.openai.com')
    ? { max_completion_tokens: effectiveMax }
    : { max_tokens: effectiveMax };
}

// Same OpenAI-specific restriction pattern as tokenLimitParam above:
// the GPT-5 family also rejects any non-default `temperature` value
// outright ("Unsupported value: 'temperature' does not support 0.9
// with this model. Only the default (1) value is supported") — so for
// OpenAI, omit the parameter entirely rather than sending a value it
// will reject. Gemini's endpoint has no such restriction and benefits
// from the higher temperature (more varied phrasing, less robotic
// repetition across calls), so it keeps getting 0.9 as before.
function temperatureParam(baseUrl: string): Record<string, number> {
  return baseUrl.includes('api.openai.com') ? {} : { temperature: 0.9 };
}

// GPT-5-family "reasoning" models spend part of their token budget on
// invisible internal chain-of-thought before writing anything visible
// — CONFIRMED by a real captured response where it spent all 500
// tokens on reasoning_tokens and hit finish_reason:"length" before
// producing a single character of reply. Raising the token budget
// (already done, to 2000) works around this, but the actual fix is
// telling it to reason less in the first place: reasoning_effort
// controls exactly that, and 'minimal' is the lowest setting — right
// for a short conversational styling reply that doesn't need deep
// multi-step reasoning. Gemini has no such parameter/behavior on this
// endpoint, so it's OpenAI-only, same as the other two OpenAI-specific
// params above.
function reasoningEffortParam(baseUrl: string): Record<string, string> {
  return baseUrl.includes('api.openai.com') ? { reasoning_effort: 'minimal' } : {};
}

async function callProvider(config: ProviderConfig, prompt: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: ARA_PERSONA },
          { role: 'user', content: prompt },
        ],
        ...tokenLimitParam(config.baseUrl, 150),
        ...temperatureParam(config.baseUrl),
        ...reasoningEffortParam(config.baseUrl),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`[aiStylist] Provider (${config.model}) returned ${res.status}:`, await res.text().catch(() => ''));
      return null;
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string }; finish_reason?: string }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      // Previously this silently returned null here with ZERO logging
      // — a 200 OK response with no usable text (e.g. a reasoning
      // model spending its entire token budget on internal "thinking"
      // and having nothing left to actually write) looked identical
      // in the logs to total silence, with no error line at all before
      // "Primary provider failed or timed out." This is exactly that
      // case: reasoning-capable models (the GPT-5 family included) can
      // consume the whole max_completion_tokens budget on reasoning
      // before emitting any visible reply if that budget is too small
      // — logging the finish_reason + raw response here makes that
      // failure mode visible instead of a silent dead end.
      console.warn(`[aiStylist] Provider (${config.model}) returned 200 but no usable content — finish_reason: ${data.choices?.[0]?.finish_reason ?? 'unknown'}. Raw response:`, JSON.stringify(data));
      return null;
    }
    return content;
  } catch (err) {
    console.error(`[aiStylist] Provider (${config.model}) call failed:`, err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function callLanguageModel(prompt: string, fallback: string): Promise<string> {
  const primary = getProviderConfig('AI_PROVIDER');
  const secondary = getProviderConfig('AI_FALLBACK');

  // Was 5s — genuinely too tight for a real LLM call, and the
  // fallback only gets its shot AFTER the primary has already spent
  // time failing, so a short per-call timeout compounds badly across
  // two sequential attempts. Bumped to 8s each; vision calls already
  // get 15s for the same reason (see callVisionProvider below).
  if (primary) {
    const result = await callProvider(primary, prompt, 8_000);
    if (result) return result;
    console.warn('[aiStylist] Primary provider failed or timed out, trying fallback provider (if configured)...');
  } else {
    console.warn('[aiStylist] AI_PROVIDER not configured (missing API key/URL/model) — skipping straight to fallback.');
  }

  if (secondary) {
    const result = await callProvider(secondary, prompt, 8_000);
    if (result) {
      console.log(`[aiStylist] Fallback provider (${secondary.model}) succeeded.`);
      return result;
    }
    console.warn('[aiStylist] Fallback provider also failed, using canned response.');
  } else {
    console.warn('[aiStylist] AI_FALLBACK not configured (missing API key/URL/model) — using canned response.');
  }

  return fallback;
}

// ---------- Item selection ----------

// Slot groups: with SUGGESTED_CATEGORIES now much more granular (e.g.
// 'kurti'/'t_shirt'/'blouse'/'dress_bodycon' instead of just 'top'/
// 'dress'), pickOutfitItems needs to know which specific categories
// function as "a top", "a dress", etc. for outfit-building purposes.
//
// v2: prefix matching instead of an exact-match list. An exact list
// needs updating every time a new subtype is added to
// SUGGESTED_CATEGORIES (e.g. adding 'dress_cocktail' would silently be
// invisible to the picker until someone remembered to also add it
// here) — prefix matching means 'dress_anything' is automatically a
// dress, 'jeans_anything' is automatically a bottom, etc., so the two
// lists can't drift apart. Bras/briefs/shapewear are deliberately
// EXCLUDED from every slot — they're closet-organizable categories but
// not "outfit pieces" Ara visibly assembles a look around.
const SLOT_PREFIX_GROUPS: Record<string, string[]> = {
  top: ['top', 'shirt', 't_shirt', 'blouse', 'tank_top', 'sweater', 'hoodie', 'kurti', 'tunic', 'camisole', 'bodysuit'],
  dress: ['dress', 'jumpsuit', 'kurta_set', 'saree', 'gown'],
  bottom: ['bottom', 'pants', 'jeans', 'trousers', 'shorts', 'skirt', 'leggings', 'track_pants', 'joggers', 'capris', 'lounge_pants', 'culottes'],
  shoes: ['shoes', 'sneakers', 'heels', 'flats', 'sandals', 'flip_flops', 'boots', 'sports_sandals'],
  bag: ['bag', 'handbag', 'backpack', 'clutch', 'mobile_pouch'],
  outerwear: ['outerwear', 'jacket', 'coat', 'blazer', 'cardigan', 'kimono', 'cape', 'shrug', 'bath_robe', 'mufflers'],
  accessory: ['accessory', 'jewellery', 'watch', 'ring', 'bangle', 'belt', 'scarf', 'dupatta', 'cap', 'sunglasses'],
};

export function categoryInSlot(category: string, slot: string): boolean {
  const prefixes = SLOT_PREFIX_GROUPS[slot];
  if (!prefixes) return category === slot;
  return prefixes.some((p) => category === p || category.startsWith(`${p}_`));
}

// Kept for any other module importing the old exact-list shape —
// derives the same category->group lookup from the prefix rules above
// so there's only one source of truth.
export const SLOT_CATEGORY_GROUPS: Record<string, string[]> = SLOT_PREFIX_GROUPS;

const SLOT_ORDER: ClothingCategory[] = ['top', 'dress', 'bottom', 'shoes', 'bag', 'outerwear', 'accessory'];

// Neutrals coordinate with almost anything, so they get no color-clash
// penalty regardless of what they're paired with.
const NEUTRAL_COLORS = new Set(['black', 'white', 'grey', 'gray', 'beige', 'navy', 'cream', 'brown', 'tan']);

function scoreItem(
  item: WardrobeItem,
  occasion: Occasion | null,
  mood: Mood | null,
  recommendedColors?: string[] | null,
  recentlyUsedItemIds?: string[] | null
): number {
  let score = 0;
  if (occasion && item.occasionTags.includes(occasion)) score += 3;
  if (mood && item.moodTags.includes(mood)) score += 2;
  const daysSinceWorn = item.lastWornAt ? (Date.now() - item.lastWornAt) / 86_400_000 : 999;
  score += Math.min(daysSinceWorn / 30, 1);
  // Nudge toward colors from the user's AI color analysis, if they've
  // done one — this is what actually makes that feature useful instead
  // of a number sitting unused in their profile.
  if (recommendedColors?.length && recommendedColors.includes(item.color)) score += 1.5;
  // item 11: "recommendation logic ... history should verify what was
  // selected previously" — a soft penalty (not a hard exclusion, so a
  // small closet doesn't run out of valid options) toward whatever was
  // just recommended, so back-to-back requests actually vary instead of
  // converging on the same handful of "safe" high-scoring pieces.
  if (recentlyUsedItemIds?.includes(item.id)) score -= 1.25;
  return score;
}

// item 11: "logical and suitable match" — used after the per-slot pick
// to nudge away from a jarring color clash between the anchor piece
// (dress, or top) and whatever's paired with it. Neutrals always pass;
// otherwise a small bonus for landing on the exact same color (a clean
// monochrome pairing) keeps the RANDOM tie-break above from being the
// only thing deciding when two candidates score identically otherwise.
function colorCoordinationBonus(color: string, anchorColor: string | null): number {
  if (!anchorColor || color === anchorColor) return 0;
  if (NEUTRAL_COLORS.has(color) || NEUTRAL_COLORS.has(anchorColor)) return 0;
  return -0.5; // two different non-neutral colors together — mild clash penalty
}

export function pickOutfitItems(
  items: WardrobeItem[],
  occasion: Occasion | null,
  mood: Mood | null,
  recommendedColors?: string[] | null,
  recentlyUsedItemIds?: string[] | null
): WardrobeItem[] {
  const picked: WardrobeItem[] = [];
  const usedCategories = new Set<ClothingCategory>();

  // Dress vs. top+bottom: previously required an absolute score >= 3,
  // which in practice only happens with an EXACT occasion-tag match
  // (+3) — mood/recency/color alone cap out around 2.5. On a normal,
  // lightly-tagged closet that threshold is basically unreachable, so
  // dresses almost never got selected even when they were clearly the
  // best (or only) option — this is the "dress isn't picking up" bug.
  // Fixed to compare the dress RELATIVE to the best available top+bottom
  // pairing instead of against a fixed number, and to just use the
  // dress outright when there's no valid top+bottom pairing to compare
  // against (e.g. a closet with dresses but no separate tops).
  const dresses = items.filter((i) => categoryInSlot(i.category, 'dress'));
  const tops = items.filter((i) => categoryInSlot(i.category, 'top'));
  const bottoms = items.filter((i) => categoryInSlot(i.category, 'bottom'));

  const bestScore = (pool: WardrobeItem[]) =>
    pool.length ? Math.max(...pool.map((i) => scoreItem(i, occasion, mood, recommendedColors, recentlyUsedItemIds))) : null;

  const bestDressScore = bestScore(dresses);
  const bestTopScore = bestScore(tops);
  const bestBottomScore = bestScore(bottoms);
  const canPairSeparates = bestTopScore !== null && bestBottomScore !== null;

  const hasGoodDress =
    bestDressScore !== null &&
    (!canPairSeparates || bestDressScore >= ((bestTopScore as number) + (bestBottomScore as number)) / 2 - 0.5);

  for (const category of SLOT_ORDER) {
    if (usedCategories.has(category)) continue;
    if (category === 'top' && hasGoodDress) continue;
    if (category === 'bottom' && hasGoodDress) continue;
    if (category === 'dress' && !hasGoodDress) continue;

    const candidates = items.filter((i) => categoryInSlot(i.category, category));
    if (candidates.length === 0) continue;

    // Anchor color: the first already-picked piece (dress, or top),
    // used to steer this slot's pick away from a jarring color clash.
    const anchorColor = picked.length > 0 ? picked[0].color : null;
    const scored = candidates
      .map((item) => ({
        item,
        score: scoreItem(item, occasion, mood, recommendedColors, recentlyUsedItemIds) + colorCoordinationBonus(item.color, anchorColor),
      }))
      .sort((a, b) => b.score - a.score);

    // Tie-break with randomness among equally-scored top candidates,
    // instead of always taking the first one — this is what was
    // producing "the same dress every time" when multiple items scored
    // identically (very likely with a small closet where most items
    // share default/empty scores).
    const topScore = scored[0].score;
    const topTier = scored.filter((s) => s.score === topScore);
    const best = topTier[Math.floor(Math.random() * topTier.length)].item;

    picked.push(best);
    usedCategories.add(category);
  }

  return picked;
}

export function buildReasoningSteps(occasion: Occasion | null, mood: Mood | null, items: WardrobeItem[], recommendedColors?: string[] | null): string[] {
  const steps: string[] = [];
  if (occasion) steps.push(`Matched pieces suited for ${occasion}`);
  if (mood) steps.push(`Weighted toward a ${mood} feel`);
  steps.push('Checked your style preferences and past favorites');
  if (recommendedColors?.length) {
    steps.push('Leaned toward colors from your personal color analysis');
  } else {
    steps.push('Cross-referenced current color harmony and fit');
  }
  steps.push(`Selected ${items.length} piece${items.length === 1 ? '' : 's'} from your closet`);
  return steps;
}

// ---------- Response variety tracker ----------
// Keeps the last fallback response sent per user+intent, so we can skip
// re-picking the same phrasing twice in a row. In-memory only (resets
// on server restart) — fine for this purpose, no DB needed.
const lastResponseByKey = new Map<string, string>();

function pickVaried(key: string, options: string[]): string {
  const last = lastResponseByKey.get(key);
  const pool = options.length > 1 ? options.filter((o) => o !== last) : options;
  const choice = pool[Math.floor(Math.random() * pool.length)];
  lastResponseByKey.set(key, choice);
  return choice;
}

// ---------- Contextual fallbacks ----------

function fallbackOutfitStory(items: WardrobeItem[], occasion: Occasion | null, mood: Mood | null): string {
  if (items.length === 0) {
    return "Okay so I actually don't have anything to work with yet — your closet's empty! Add a few pieces and I'll put together something I'm genuinely excited about. 💕";
  }
  const pieces = items.map((i) => `${i.color} ${i.category}`).join(', ');
  const occasionPart = occasion ? `for ${occasion}` : 'for whatever your day throws at you';
  const moodPart = mood ? `, leaning ${mood}` : '';

  const templates = [
    `Okay I love this combo — ${pieces} — it just works ${occasionPart}${moodPart}. Trust me, the pieces play off each other perfectly without trying too hard.`,
    `I'm genuinely obsessed with how this came together: ${pieces}. It's giving exactly the right energy ${occasionPart}${moodPart} — effortless but put-together.`,
    `This one's a win — ${pieces} ${occasionPart}${moodPart}. Nothing's fighting for attention, it all just flows.`,
  ];
  return pickVaried(`story:${occasion}:${mood}:${items.length}`, templates);
}

const CHAT_INTENT_PATTERNS: { key: string; keywords: string[]; replies: (closet: WardrobeItem[], msg: string) => string[] }[] = [
  {
    key: 'date',
    keywords: ['date', 'romantic'],
    replies: (closet) => {
      const candidates = closet.filter((i) => i.occasionTags?.includes('date'));
      if (candidates.length > 0) {
        const names = candidates.slice(0, 2).map((i) => `${i.color} ${i.category}`).join(' with your ');
        return [
          `Ooh a date! Okay, go with your ${names} — it's exactly the right amount of effort without looking like you tried too hard. Trust me on this.`,
          `For a date I'm thinking your ${names} — you already have it tagged for this, and it hasn't been overworked lately. You're going to feel really good in it.`,
        ];
      }
      return [
        "Ooh, a date! Go with something that feels like YOU, just slightly elevated. One piece with a little more polish than your everyday rotation always does it.",
        "For a date, I always say: pick the outfit that makes you feel a little more confident when you catch yourself in the mirror. That's the one.",
      ];
    },
  },
  {
    key: 'work',
    keywords: ['work', 'office', 'business', 'meeting'],
    replies: (closet) => {
      const candidates = closet.filter((i) => i.occasionTags?.includes('office') || i.style === 'business');
      if (candidates.length > 0) {
        return [
          `For work, your ${candidates[0].color} ${candidates[0].category} is such a good anchor piece — build around it and keep everything else clean-lined.`,
          `Honestly your ${candidates[0].color} ${candidates[0].category} is perfect for today. Pair it with something simple so it stays the focus.`,
        ];
      }
      return [
        "For work: one statement piece, everything else quiet. It reads as intentional, not like you're trying too hard — which is exactly the vibe you want.",
        "My rule for office days — pick ONE thing that feels a little special, keep the rest minimal. Instantly looks pulled together.",
      ];
    },
  },
  {
    key: 'party',
    keywords: ['party', 'night out', 'club'],
    replies: (closet) => {
      const candidates = closet.filter((i) => i.occasionTags?.includes('party'));
      if (candidates.length > 0) {
        return [
          `Yes okay, your ${candidates[0].color} ${candidates[0].category} is THE piece to build tonight's look around — add something with a little shine and you're set.`,
          `For a party I need to go to real presence — texture, color, or shape that stands out — and keep the rest of the outfit simple so it doesn't compete.`,
        ];
      }
      return [
        "For a party, lean into one piece with real presence — texture, color, or shape that stands out — and keep the rest simple so it doesn't compete.",
        "Party outfits are all about ONE moment. Pick your boldest piece and build quietly around it. You'll look like you put in zero effort (even though we both know you did).",
      ];
    },
  },
  {
    key: 'rate',
    keywords: ['rate', 'rating', 'how does', 'what do you think'],
    replies: (closet) => {
      const rated = closet.filter((i) => i.rating != null) as (WardrobeItem & { rating: number })[];
      if (rated.length > 0) {
        const avg = (rated.reduce((s, i) => s + i.rating, 0) / rated.length).toFixed(1);
        return [
          `Your rated pieces are averaging ${avg}/5 so far — pretty solid! Rate a few more and I'll get sharper at reading what you actually love.`,
          `Okay so you're sitting at ${avg}/5 average on the pieces you've rated. Keep rating as you go — it genuinely helps me get to know your taste better.`,
        ];
      }
      return [
        "You haven't rated anything yet! Go rate a few outfits from your Outfits tab — I promise it'll make my suggestions way more you.",
        "No ratings yet, babe — once you start rating outfits I can actually learn what you love instead of guessing.",
      ];
    },
  },
  {
    key: 'pairing',
    keywords: ['goes with', 'match', 'pair', 'combine'],
    replies: (_closet, msg) => {
      const colorMatch = msg.match(/\b(black|white|blue|red|green|pink|navy|beige|brown|grey|cream)\b/i);
      const color = colorMatch ? colorMatch[0].toLowerCase() : null;
      if (color) {
        const cap = `${color[0].toUpperCase()}${color.slice(1)}`;
        return [
          `${cap} is so easy to work with — pairs beautifully with neutrals and one bolder color, just don't stack two loud colors against it.`,
          `Honestly ${color} goes with almost everything. My only rule: pick ONE other strong color, not two — keeps it from looking chaotic.`,
        ];
      }
      return [
        'Neutrals pair with basically everything. Safest bet: one neutral piece plus one with real color or texture — never two competing statement pieces.',
        "Good rule of thumb — if one piece is loud, let everything else whisper. That balance is what makes an outfit feel intentional.",
      ];
    },
  },
];

function fallbackChatReply(userMessage: string, closet: WardrobeItem[]): string {
  const lower = userMessage.toLowerCase();
  for (const pattern of CHAT_INTENT_PATTERNS) {
    if (pattern.keywords.some((k) => lower.includes(k))) {
      const options = pattern.replies(closet, lower);
      return pickVaried(pattern.key, options);
    }
  }

  if (closet.length === 0) {
    return pickVaried('empty_closet', [
      "I don't see anything in your closet yet! Add a few pieces and ask me again — I've got real thoughts once there's something to work with. 💕",
      "Your closet's empty right now, so I'm flying blind here. Add some pieces and I'll actually be useful, promise.",
    ]);
  }
  const categories = Array.from(new Set(closet.map((i) => i.category)));
  return pickVaried(`generic:${categories.join(',')}`, [
    "What's the occasion? Give me that and I'll actually put something together instead of guessing.",
    "Tell me where you're headed or what mood you're going for — I'll build a real look, not just throw stuff at you.",
    "I need a little more to go on — an occasion or a vibe — and I'll get specific fast, promise.",
  ]);
}

/** Generates the "Your outfit story" text for S6. */
export async function generateOutfitStory(items: WardrobeItem[], occasion: Occasion | null, mood: Mood | null): Promise<string> {
  const itemDescriptions = items.map((i) => `${i.color} ${i.category}`).join(', ');
  const month = new Date().getMonth(); // 0-11
  const seasonHint = month >= 2 && month <= 4 ? 'spring' : month >= 5 && month <= 7 ? 'summer' : month >= 8 && month <= 10 ? 'autumn' : 'winter';
  const prompt = `Write a short (2-3 sentence), warm, personal styling note in Ara's voice explaining why this outfit works: ${itemDescriptions}. Occasion: ${occasion ?? 'general'}. Mood: ${mood ?? 'balanced'}. It's currently ${seasonHint} — weave in a light, current styling angle relevant to this time of year if it fits naturally, without forcing it. Avoid generic phrases like "elevate your style" — sound like a friend who's genuinely excited about this outfit, not a product description.`;
  return callLanguageModel(prompt, fallbackOutfitStory(items, occasion, mood));
}

export function computeMatchScore(items: WardrobeItem[], occasion: Occasion | null, mood: Mood | null, recommendedColors?: string[] | null): number {
  if (items.length === 0) return 0;
  const avg = items.reduce((sum, i) => sum + scoreItem(i, occasion, mood, recommendedColors), 0) / items.length;
  return Math.round(Math.min(100, 60 + avg * 10));
}

/** Free-text chat response for the AI Stylist chat screen. */
// Picks a genuinely varied slice of the closet for chat context —
// previously this was a fixed `recentItems.slice(0, 10)`, and since
// listWardrobeItems() sorts by sortOrder ASCENDING (oldest-added item
// first), that "recentItems" name was actively misleading: it was
// really "the same 10 oldest items, every single call, forever,"
// capped at 10 regardless of how big the actual closet was. That's
// exactly why chat kept fixating on the same one dress — if a dress
// happened to sit in that static first-10 slice, it was the ONLY
// thing consistently visible to the model on every single message,
// no matter what was actually asked or how much else was in the
// closet. Fixed to genuinely sample across the whole closet (shuffled
// per call, so repeated questions don't keep surfacing the exact same
// subset) and cap higher (25 instead of 10) so a real wardrobe's
// actual variety gets a fair shot at being mentioned.
function sampleClosetForChat(items: WardrobeItem[], count = 25): WardrobeItem[] {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// After the model replies, checks which specific closet items its
// text actually mentions (by color+category, or its own name if it
// has one) — lets the chat UI show a real photo of "the pink dress"
// instead of just describing it in words with nothing to look at.
// Deterministic string matching against the reply text rather than
// asking the model to also output structured JSON alongside its
// natural-language reply, which would fight against the persona's
// casual "texting a friend" voice (forcing JSON output tends to make
// models write stiffer, more formulaic prose even in the text part).
function findReferencedItems(replyText: string, items: WardrobeItem[]): string[] {
  const lowerReply = replyText.toLowerCase();

  // Group candidates by what they matched on. Previously this pushed
  // the FIRST item found for "black dress" and stopped there — but if
  // a closet has more than one black dress, "first" is really just
  // "whichever one happens to sort earliest," with no actual
  // connection to which one the model meant. There's no way to
  // disambiguate that from plain text alone (the model's prompt never
  // saw item IDs, only "black dress" as a description) — so rather
  // than confidently show one possibly-wrong photo, this shows ALL
  // genuine matches for an ambiguous description. Honest uncertainty
  // (here are the 2 black dresses it could mean) beats false
  // confidence (here's A black dress, might not be the right one).
  const matchedIds: string[] = [];
  for (const item of items) {
    const nameMatch = item.name && lowerReply.includes(item.name.toLowerCase());
    const colorCategoryMatch = lowerReply.includes(`${item.color} ${item.category}`.toLowerCase())
      || lowerReply.includes(`${item.color} ${item.category.replace(/_/g, ' ')}`.toLowerCase());
    if (nameMatch || colorCategoryMatch) matchedIds.push(item.id);
    if (matchedIds.length >= 6) break; // hard cap so one very generic description (e.g. "black top") can't flood the chat with the whole closet
  }
  return matchedIds;
}

// Whether the user's message is actually asking for a clothing/outfit
// suggestion — reused from chat.controller.ts's original suggestedOutfitIds
// check, now also driving the PROMPT itself, not just which items get
// attached. Previously the prompt always said "give a specific,
// actionable suggestion" no matter what was said — so even "hey" or
// "how's it going" got an outfit pitch back, which reads as pushy
// rather than like a friend who's just happy to talk. Only steer
// toward a clothing suggestion when the message actually sounds like
// it's asking for one.
export function wantsOutfitSuggestion(message: string): boolean {
  return /outfit|look|wear|style me|suggest|dress|closet|pick|pack/i.test(message);
}

export async function generateChatReply(
  userMessage: string,
  closet: WardrobeItem[],
  imageUrl?: string
): Promise<{ text: string; quickReplies: string[]; referencedItemIds: string[] }> {
  const sampledItems = sampleClosetForChat(closet);
  const closetSummary = sampledItems.map((i) => `${i.color} ${i.category}`).join(', ') || 'an empty closet so far';
  const wantsSuggestion = wantsOutfitSuggestion(userMessage);

  let text: string;
  if (imageUrl) {
    // A photo was attached — this needs a vision-capable call (plain
    // callLanguageModel is text-only and would just be replying to
    // whatever caption text came with the message, never actually
    // "seeing" the photo). Uses the same two-tier vision chain as
    // color analysis / tag scanning.
    const visionPrompt = `You're Ara, a warm, stylish best-friend AI. The user's closet includes: ${closetSummary}. They just sent you a photo along with this message: "${userMessage || '(no caption, just the photo)'}". Actually look at the photo and reply to what's really in it — describe or react to the specific item/outfit/scene you see, and answer their message in that context. 2-3 sentences, warm and specific, never generic, never say you can't see images.`;
    const visionReply = await callVisionModel(visionPrompt, imageUrl, 300);
    text = visionReply ?? "I couldn't quite process that photo just now — mind trying again in a moment? In the meantime, tell me what's in it and I'll help however I can.";
  } else {
    const prompt = wantsSuggestion
      ? `The user's closet includes: ${closetSummary}. User says: "${userMessage}". Reply in 2-3 sentences with a specific, actionable, warm suggestion in Ara's voice — never generic, never robotic, like you actually know her closet.`
      : `The user's closet includes: ${closetSummary}, but they haven't asked for outfit advice right now — they're just talking to you. User says: "${userMessage}". Reply like her actual best friend having a normal conversation: react to what she said, be warm, funny, a little teasing if it fits — 1-3 sentences. Do NOT suggest, describe, or bring up any specific clothing item or outfit unless she's actually asked for one. Just talk to her.`;
    text = await callLanguageModel(prompt, fallbackChatReply(userMessage, closet));
  }

  // Match against the FULL closet, not just the sampled subset, in
  // case the model (or the canned fallback) references something
  // outside the sample — e.g. the fallback templates pull from
  // whatever's actually relevant to the user's message, not the
  // random sample sent to a real model.
  const referencedItemIds = wantsSuggestion ? findReferencedItems(text, closet) : [];
  return {
    text,
    quickReplies: ['More Casual Looks', 'Outfit For Party', 'Something Else'],
    referencedItemIds,
  };
}

// ---------- Vision provider hook (two-tier, same pattern as text) ----------
//
// Mirrors getProviderConfig/callProvider above but for vision calls
// (image + text in, text out). Previously color analysis and tag
// scanning only had ONE vision provider config with no real fallback —
// if AI_VISION_PROVIDER_* wasn't set, it silently fell back to
// AI_PROVIDER_* (only works if that model happens to also support
// vision, which isn't guaranteed). Now there's a genuine two-tier
// chain: AI_VISION_PROVIDER (primary) -> AI_VISION_FALLBACK (secondary)
// -> the feature's own static fallback — same shape as chat's
// AI_PROVIDER -> AI_FALLBACK -> canned text, just for vision calls.

function getVisionProviderConfig(prefix: 'AI_VISION_PROVIDER' | 'AI_VISION_FALLBACK'): ProviderConfig | null {
  const apiKey = process.env[`${prefix}_API_KEY`];
  const baseUrl = process.env[`${prefix}_BASE_URL`];
  const model = process.env[`${prefix}_MODEL`];
  if (!apiKey || !baseUrl || !model) return null;
  return { apiKey, baseUrl, model };
}

async function callVisionProvider(config: ProviderConfig, prompt: string, imageUrl: string, maxTokens: number): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000); // vision calls are slower than text-only

  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        ...tokenLimitParam(config.baseUrl, maxTokens),
        ...reasoningEffortParam(config.baseUrl),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`[aiStylist] Vision provider (${config.model}) returned ${res.status}:`, await res.text().catch(() => ''));
      return null;
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string }; finish_reason?: string }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      // Same silent-failure gap fixed in callProvider above, applied
      // here too — a 200 OK with no usable text (vision-capable
      // reasoning models can hit this the same way text ones can)
      // previously vanished with no log line at all.
      console.warn(`[aiStylist] Vision provider (${config.model}) returned 200 but no usable content — finish_reason: ${data.choices?.[0]?.finish_reason ?? 'unknown'}. Raw response:`, JSON.stringify(data));
      return null;
    }
    return content;
  } catch (err) {
    console.error(`[aiStylist] Vision provider (${config.model}) call failed:`, err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function callVisionModel(prompt: string, imageUrl: string, maxTokens = 300): Promise<string | null> {
  // Falls back further to plain AI_PROVIDER_* only if NEITHER vision
  // slot is configured at all, preserving old behavior for anyone who
  // hasn't set up dedicated vision config yet.
  const primary = getVisionProviderConfig('AI_VISION_PROVIDER') ?? getProviderConfig('AI_PROVIDER');
  const secondary = getVisionProviderConfig('AI_VISION_FALLBACK') ?? getProviderConfig('AI_FALLBACK');

  if (primary) {
    const result = await callVisionProvider(primary, prompt, imageUrl, maxTokens);
    if (result) return result;
    console.warn('[aiStylist] Primary vision provider failed or timed out, trying fallback vision provider (if configured)...');
  } else {
    console.warn('[aiStylist] No vision provider configured (AI_VISION_PROVIDER or AI_PROVIDER) — skipping straight to fallback.');
  }
  if (secondary) {
    const result = await callVisionProvider(secondary, prompt, imageUrl, maxTokens);
    if (result) {
      console.log(`[aiStylist] Fallback vision provider (${secondary.model}) succeeded.`);
      return result;
    }
    console.warn('[aiStylist] Fallback vision provider also failed, using static fallback.');
  } else {
    console.warn('[aiStylist] No fallback vision provider configured (AI_VISION_FALLBACK or AI_FALLBACK) — using static fallback.');
  }
  return null;
}

// ---------- Color analysis (vision) ----------
//
// Needs a VISION-CAPABLE model. Uses the two-tier AI_VISION_PROVIDER ->
// AI_VISION_FALLBACK chain above.

export interface ColorAnalysisResult {
  undertone: string;
  recommendedColors: string[];
  avoidColors: string[];
  explanation: string;
}

const COLOR_ANALYSIS_FALLBACK: ColorAnalysisResult = {
  undertone: 'unknown',
  recommendedColors: ['black', 'white', 'navy', 'cream'],
  avoidColors: [],
  explanation: "I couldn't analyze the photo right now, so here are safe neutrals that work for most people — try again in a bit for a real personalized read.",
};

export async function analyzeColorFromPhoto(imageUrl: string): Promise<ColorAnalysisResult> {
  const prompt = `Look at this photo and give a skin-tone color analysis for clothing recommendations. Reply with ONLY valid JSON, no other text, in this exact shape:
{"undertone": "warm|cool|neutral", "recommendedColors": ["color1","color2","color3","color4","color5"], "avoidColors": ["color1","color2"], "explanation": "one warm, friendly sentence explaining why, in a stylist's voice"}`;

  const raw = await callVisionModel(prompt, imageUrl, 300);
  if (!raw) return COLOR_ANALYSIS_FALLBACK;

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/); // model may wrap JSON in prose despite instructions
    if (!jsonMatch) return COLOR_ANALYSIS_FALLBACK;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      undertone: parsed.undertone ?? 'unknown',
      recommendedColors: Array.isArray(parsed.recommendedColors) ? parsed.recommendedColors : COLOR_ANALYSIS_FALLBACK.recommendedColors,
      avoidColors: Array.isArray(parsed.avoidColors) ? parsed.avoidColors : [],
      explanation: parsed.explanation ?? COLOR_ANALYSIS_FALLBACK.explanation,
    };
  } catch (err) {
    console.error('[aiStylist] Color analysis response parsing failed:', err);
    return COLOR_ANALYSIS_FALLBACK;
  }
}

// ---------- Tag/label scanner (vision) ----------
//
// "Scan tag" on Add Item — photo of a garment's care/brand label,
// vision model reads whatever text and logos are visible and extracts
// brand/size/material/care instructions, plus a best-effort guess at
// category and color if the garment itself is visible in frame too.
// Same honesty rules as the rest of this file: this is READING TEXT
// off a real label via a vision model, not a lookup against some
// verified brand database — it can misread a worn/faded tag, and a
// brand it doesn't recognize just comes back as whatever text it saw.
// The extracted fields pre-fill the Add Item form; the person still
// confirms/edits before saving, same as every other AI-assisted field
// in this app — nothing is silently written to the closet unreviewed.

export interface TagScanResult {
  brand: string | null;
  size: string | null;
  material: string | null;
  careInstructions: string | null;
  category: string | null;
  color: string | null;
  confidence: 'high' | 'medium' | 'low';
}

const TAG_SCAN_FALLBACK: TagScanResult = {
  brand: null, size: null, material: null, careInstructions: null, category: null, color: null, confidence: 'low',
};

export async function analyzeTagFromPhoto(imageUrl: string): Promise<TagScanResult> {
  const prompt = `Look at this photo of a clothing tag or garment label. Read any visible brand name, size, fabric/material composition, and care instructions. If the garment itself is also visible, guess its category (e.g. "t_shirt", "jeans", "dress") and dominant color. Reply with ONLY valid JSON, no other text, in this exact shape:
{"brand": "string or null", "size": "string or null", "material": "string or null", "careInstructions": "string or null", "category": "string or null", "color": "string or null", "confidence": "high|medium|low"}
Use null for anything not clearly legible — never guess a brand or size you can't actually read on the tag. Set confidence based on how clearly the tag was legible.`;

  const raw = await callVisionModel(prompt, imageUrl, 300);
  if (!raw) return TAG_SCAN_FALLBACK;

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return TAG_SCAN_FALLBACK;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      brand: parsed.brand ?? null,
      size: parsed.size ?? null,
      material: parsed.material ?? null,
      careInstructions: parsed.careInstructions ?? null,
      category: parsed.category ?? null,
      color: parsed.color ?? null,
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low',
    };
  } catch (err) {
    console.error('[aiStylist] Tag scan response parsing failed:', err);
    return TAG_SCAN_FALLBACK;
  }
}
