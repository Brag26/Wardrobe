// src/services/wardrobeApi.ts
// Client-side calls to the AI Wardrobe backend. Place in supergirl-app at:
// src/services/wardrobeApi.ts
//
// AUTH: this app uses phone OTP -> a backend-issued JWT (NOT Firebase
// Auth). After POST /auth/verify-otp succeeds, store the returned token
// (e.g. in SecureStore / AsyncStorage) and pass it here via getToken().

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api';

// Wire this to wherever the app keeps the logged-in JWT — e.g.:
//   import * as SecureStore from 'expo-secure-store';
//   const getToken = () => SecureStore.getItemAsync('authToken');
let getToken: () => Promise<string | null> = async () => null;
export function setTokenGetter(fn: () => Promise<string | null>) {
  getToken = fn;
}

async function authedFetch(path: string, options: RequestInit = {}) {
  const token = await getToken();
  if (!token) throw new Error('Not signed in');

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// ---------- Auth (phone OTP) ----------

export function requestOtp(phone: string) {
  return fetch(`${API_BASE_URL}/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  }).then((r) => r.json());
}

export function verifyOtp(phone: string, code: string): Promise<{ token: string; user: { id: string; phone: string } }> {
  return fetch(`${API_BASE_URL}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  }).then((r) => r.json());
}

// ---------- Wardrobe photo upload (S3) ----------

/**
 * Full upload flow: get a presigned URL, PUT the photo directly to S3,
 * then save the item's metadata. Call this from the "Add to Closet" screen.
 */
export async function uploadWardrobeItem(
  localImageUri: string,
  meta: { category: string; color: string; occasionTags: string[]; moodTags?: string[] }
) {
  const { itemId, key, uploadUrl } = await authedFetch('/wardrobe/upload-url', {
    method: 'POST',
    body: JSON.stringify({ fileExtension: 'jpg' }),
  });

  const photoBlob = await (await fetch(localImageUri)).blob();
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    body: photoBlob,
    headers: { 'Content-Type': 'image/jpeg' },
  });
  if (!uploadRes.ok) throw new Error('Photo upload to S3 failed');

  return authedFetch('/wardrobe/items', {
    method: 'POST',
    body: JSON.stringify({ itemId, s3Key: key, ...meta }),
  });
}

export function getWardrobeItems(params: { category?: string; favoritesOnly?: boolean } = {}) {
  const qs = new URLSearchParams(params as any).toString();
  return authedFetch(`/wardrobe/items${qs ? `?${qs}` : ''}`);
}

export function getWardrobeItem(itemId: string) {
  return authedFetch(`/wardrobe/items/${itemId}`);
}

export function updateWardrobeItem(itemId: string, patch: Record<string, any>) {
  return authedFetch(`/wardrobe/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export function markItemWorn(itemId: string, currentWearCount: number) {
  return authedFetch(`/wardrobe/items/${itemId}/worn`, { method: 'POST', body: JSON.stringify({ currentWearCount }) });
}

export function setItemFavorite(itemId: string, isFavorite: boolean) {
  return authedFetch(`/wardrobe/items/${itemId}/favorite`, { method: 'POST', body: JSON.stringify({ isFavorite }) });
}

export function moveItemToBin(itemId: string) {
  return authedFetch(`/wardrobe/items/${itemId}`, { method: 'DELETE' });
}

export function restoreItemFromBin(itemId: string) {
  return authedFetch(`/wardrobe/items/${itemId}/restore`, { method: 'POST' });
}

export function retryBackgroundRemoval(itemId: string) {
  return authedFetch(`/wardrobe/items/${itemId}/retry-background-removal`, { method: 'POST' });
}

// ---------- Closet overview / Favorites ----------

export function getClosetOverview() {
  return authedFetch('/closet/overview');
}

export function getClosetExpenses() {
  return authedFetch('/closet/expenses');
}

export function getDailyPick() {
  return authedFetch('/looks/daily-pick');
}

export function getAttributeSuggestions() {
  return authedFetch('/wardrobe/items/attribute-suggestions');
}

export function getOutfitCategories() {
  return authedFetch('/outfits/categories');
}

export function getFavoriteItems() {
  return authedFetch('/closet/favorites/items');
}

export function getFavoriteOutfits() {
  return authedFetch('/closet/favorites/outfits');
}

// ---------- Styling flow (S2 -> S6) ----------

export function startStylingSession(occasion: string, mood: string) {
  return authedFetch('/styling-sessions', { method: 'POST', body: JSON.stringify({ occasion, mood }) });
}

export function generateOutfit(sessionId: string) {
  return authedFetch(`/styling-sessions/${sessionId}/generate`, { method: 'POST' });
}

export function getSession(sessionId: string) {
  return authedFetch(`/styling-sessions/${sessionId}`);
}

export function getOutfit(outfitId: string) {
  return authedFetch(`/outfits/${outfitId}`);
}

// ---------- Outfits (Create Outfit / My Outfits) ----------

export function listOutfits(category: string = 'all') {
  return authedFetch(`/outfits?category=${category}`);
}

export function createOutfit(payload: Record<string, any>) {
  return authedFetch('/outfits', { method: 'POST', body: JSON.stringify(payload) });
}

export function setOutfitFavorite(outfitId: string, isFavorite: boolean) {
  return authedFetch(`/outfits/${outfitId}/favorite`, { method: 'POST', body: JSON.stringify({ isFavorite }) });
}

// ---------- Discover / Shuffle / Drag Studio (S7, S8) ----------

export function discoverLooks(category: 'all' | 'casual' | 'date_night' | 'work' = 'all') {
  return authedFetch(`/looks/discover?category=${category}`);
}

export function shuffleLook(occasion?: string, mood?: string) {
  return authedFetch('/looks/shuffle', { method: 'POST', body: JSON.stringify({ occasion, mood }) });
}

export function saveManualOutfit(itemIds: string[]) {
  return authedFetch('/looks/manual', { method: 'POST', body: JSON.stringify({ itemIds }) });
}

// ---------- Chat ----------

export function getChatHistory() {
  return authedFetch('/chat/history');
}

export function sendChatMessage(text: string) {
  return authedFetch('/chat/message', { method: 'POST', body: JSON.stringify({ text }) });
}
