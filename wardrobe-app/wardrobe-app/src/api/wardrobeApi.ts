import AsyncStorage from '@react-native-async-storage/async-storage';

// API base URL is auto-detected per platform/device below — see
// resolveApiBaseUrl(). Android emulator, iOS simulator, and Expo Go on
// a physical device all work automatically with zero config. A
// STANDALONE BUILD (installed APK) on a real physical phone is the one
// case that needs manual setup — see MANUAL_LAN_IP_FOR_PHYSICAL_DEVICE_TESTING
// below, since there's no dev-server connection to auto-detect a LAN IP from.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

// resizeForUpload previously used expo-image-manipulator here, but
// that native module (added alongside expo-image in the same build)
// is the suspected cause of a crash-on-launch — reverted together
// with expo-image so both risky additions are removed in one clean
// pass, restoring a known-good baseline before re-attempting either
// with better-verified native module versions. This is now a no-op
// passthrough (returns the original URI unresized) rather than
// actually resizing — the upload-time size optimization is paused,
// not the upload itself.
async function resizeForUpload(localImageUri: string, maxDimension = 1200): Promise<string> {
  return localImageUri;
}

// Auto-picks the right host for wherever this is running:
//   - Physical device via Expo Go: extracts the LAN IP from Expo's own
//     dev-server connection info (the same IP your phone already used
//     to load the JS bundle) — no manual typing needed, and it updates
//     itself automatically if you switch networks.
//   - Android emulator: 10.0.2.2 is its special alias for "the host machine"
//   - iOS simulator + web (browser): both run ON the host machine
//     directly, so localhost reaches it fine
//   - STANDALONE BUILD (installed APK) on a real physical phone: uses
//     the deployed backend below — this is what makes the app actually
//     work "wherever it loads," not just on the same wifi as whoever's
//     laptop happens to be running a local dev server.

// The real, deployed backend (Render) — reachable from any network,
// not just a shared wifi. This is what a standalone APK on a real
// phone uses by default now. Update this if the backend ever moves to
// a different host/URL.
const DEPLOYED_BACKEND_URL = 'https://wardrobe-76v8.onrender.com/api';

// Optional override for LOCAL testing a standalone APK against your
// own machine's backend instead of the deployed one (e.g. testing an
// unreleased backend change before it's deployed). Leave blank to use
// the deployed backend above by default — that's almost always what
// you want. Only fill this in for a specific local-testing session,
// and only works while phone + computer share the same wifi (Windows:
// `ipconfig`, "IPv4 Address" under your active wifi adapter).
const MANUAL_LAN_IP_OVERRIDE = '';

function resolveApiBaseUrl(): string {
  // hostUri looks like "192.168.1.42:8081" when running via Expo Go's
  // dev server. Device.isDevice (from expo-device) is true only on a
  // REAL physical device — Constants.isDevice used to serve this
  // purpose but was removed from expo-constants in a past SDK update.
  const hostUri = Constants.expoConfig?.hostUri ?? (Constants as any).manifest?.debuggerHost;
  const isPhysicalDevice = Device.isDevice === true;

  // Connected to Expo Go's own dev server — extract the LAN IP Expo
  // Go already used to load this JS bundle. Works automatically, no
  // manual config needed. This branch is for active local development
  // only (via `npx expo start`), so it intentionally still targets your
  // local backend rather than the deployed one.
  if (isPhysicalDevice && hostUri) {
    const lanIp = hostUri.split(':')[0];
    return `http://${lanIp}:4000/api`;
  }

  // A STANDALONE build (installed APK, not Expo Go) on a real phone
  // has NO dev-server connection to read a LAN IP from — hostUri is
  // always empty here. Previously this case fell through to the
  // emulator-only 10.0.2.2 alias, which doesn't mean anything on a
  // real device and just hung forever (the "stuck on loading" bug).
  // Now defaults to the real deployed backend, which works from any
  // network — the LAN override only kicks in if explicitly set above.
  if (isPhysicalDevice) {
    if (MANUAL_LAN_IP_OVERRIDE) {
      return `http://${MANUAL_LAN_IP_OVERRIDE}:4000/api`;
    }
    return DEPLOYED_BACKEND_URL;
  }

  // Emulator/simulator only from here on — 10.0.2.2 is Android
  // emulator's real alias for "the host machine"; iOS
  // simulator/web run ON the host machine directly, so localhost
  // reaches it fine. Kept pointed at local backend for fast dev
  // iteration without round-tripping to the deployed server.
  return Platform.select({
    android: 'http://10.0.2.2:4000/api',
    ios: 'http://localhost:4000/api',
    web: 'http://localhost:4000/api',
    default: 'http://localhost:4000/api',
  }) as string;
}

export const API_BASE_URL = resolveApiBaseUrl();
const TOKEN_KEY = 'wardrobe_auth_token';
// Render's free tier spins the backend down after a period of
// inactivity — the FIRST request after idle can take 30-60+ seconds
// while it wakes back up, well past a "normal" API response time.
// 15s was fine for a locally-running backend that's always instantly
// available, but times out before Render even finishes cold-starting.
// 45s tolerates a cold start; once warm, real responses still return
// in a second or two either way, so this doesn't make normal usage
// feel slower.
const REQUEST_TIMEOUT_MS = 45_000;

export async function getStoredToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}
export async function storeToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}
export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

// Every network call in this app goes through this.
//
// IMPORTANT: this does NOT rely on AbortController alone. In testing,
// a genuinely unreachable host (wrong API_BASE_URL, emulator network
// misconfiguration) caused React Native's fetch to hang far past the
// timeout — AbortController's abort() doesn't reliably interrupt a
// connection that's stuck at the native networking layer trying to
// connect to an unreachable address, even though it works fine for a
// request that's already in flight. Promise.race guarantees the JS
// side moves on and shows an error after the timeout regardless of
// what the native layer is still doing in the background — the
// abandoned native request may still be attempting to connect, but the
// app itself is never blocked waiting on it.
function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<Response> {
  const timeoutPromise = new Promise<Response>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Request timed out after ${timeoutMs / 1000}s — check API_BASE_URL (currently "${API_BASE_URL}") is reachable from this device/emulator, and that the backend is running.`));
    }, timeoutMs);
  });

  return Promise.race([fetch(url, options), timeoutPromise]);
}

async function authedFetch(path: string, options: RequestInit = {}) {
  const token = await getStoredToken();
  const res = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed: ${res.status}`);
  return body;
}

export function requestOtp(phone: string) {
  return fetchWithTimeout(`${API_BASE_URL}/auth/request-otp`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }),
  }).then(async (r) => {
    const body = await r.json();
    if (!r.ok) throw new Error(body.error ?? 'Failed to send OTP');
    return body;
  });
}

export async function verifyOtp(phone: string, code: string) {
  const res = await fetchWithTimeout(`${API_BASE_URL}/auth/verify-otp`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, code }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? 'Invalid code');
  await storeToken(body.token);
  return body as { token: string; user: { id: string; phone: string } };
}

// Dev-only: skips OTP entirely. Only works if the backend has
// DEV_LOGIN_ENABLED=true set (never true in production).
export async function devLogin(phone: string) {
  const res = await fetchWithTimeout(`${API_BASE_URL}/auth/dev-login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? 'Dev login not available — is DEV_LOGIN_ENABLED=true on the backend?');
  await storeToken(body.token);
  return body as { token: string; user: { id: string; phone: string } };
}

export const getClosetOverview = () => authedFetch('/closet/overview');
export const getClosetExpenses = () => authedFetch('/closet/expenses');
export const getFavoriteItems = () => authedFetch('/closet/favorites/items');
export const getFavoriteOutfits = () => authedFetch('/closet/favorites/outfits');
export const getDailyPick = () => authedFetch('/looks/daily-pick');

export const getWardrobeItems = (params: Record<string, string> = {}) => {
  const qs = new URLSearchParams(params).toString();
  return authedFetch(`/wardrobe/items${qs ? `?${qs}` : ''}`);
};
export const getWardrobeItem = (id: string) => authedFetch(`/wardrobe/items/${id}`);
export const getItemsByIds = async (ids: string[]) => {
  const results = await Promise.all(ids.map((id) => getWardrobeItem(id).catch(() => null)));
  return results.filter(Boolean);
};
export const getBinItems = () => authedFetch('/wardrobe/items/bin');
export const getArchivedItems = () => authedFetch('/wardrobe/items/archive');
export const getAttributeSuggestions = () => authedFetch('/wardrobe/items/attribute-suggestions');

export async function uploadWardrobeItem(
  localImageUri: string | null,
  meta: {
    category: string; color: string; occasionTags?: string[]; moodTags?: string[];
    name?: string; style?: string; season?: string; rating?: number;
    brand?: string; price?: number; size?: string; material?: string;
  }
) {
  const { itemId, key, uploadUrl } = await authedFetch('/wardrobe/upload-url', {
    method: 'POST', body: JSON.stringify({ fileExtension: 'jpg' }),
  });

  // Uploading the actual photo bytes is best-effort — if reading the
  // local file fails (this happens on some Android emulators/content://
  // URIs) or the upload itself fails, the item still needs to save with
  // its metadata. A real photo is a nice-to-have here, not a blocker.
  if (localImageUri) {
    try {
      const resizedUri = await resizeForUpload(localImageUri);
      const photoBlob = await (await fetch(resizedUri)).blob();
      await fetchWithTimeout(uploadUrl, { method: 'PUT', body: photoBlob, headers: { 'Content-Type': 'image/jpeg' } });
    } catch (err) {
      console.warn('[uploadWardrobeItem] Photo upload failed, saving item without a photo:', err);
    }
  }

  return authedFetch('/wardrobe/items', { method: 'POST', body: JSON.stringify({ itemId, s3Key: key, ...meta }) });
}

export const updateWardrobeItem = (id: string, patch: Record<string, any>) =>
  authedFetch(`/wardrobe/items/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
export const markItemWorn = (id: string, currentWearCount: number) =>
  authedFetch(`/wardrobe/items/${id}/worn`, { method: 'POST', body: JSON.stringify({ currentWearCount }) });
export const setItemFavorite = (id: string, isFavorite: boolean) =>
  authedFetch(`/wardrobe/items/${id}/favorite`, { method: 'POST', body: JSON.stringify({ isFavorite }) });
export const retryBackgroundRemoval = (id: string) =>
  authedFetch(`/wardrobe/items/${id}/retry-background-removal`, { method: 'POST' });

// "Resave" on Item Details — replace an existing item's photo and
// re-run background removal on it. Previously there was no way to fix
// a bad initial photo (wrong crop, background-removal that didn't come
// out clean) short of deleting the item and re-adding it from scratch.
export async function replaceItemPhoto(itemId: string, localImageUri: string) {
  const { key, uploadUrl } = await authedFetch('/wardrobe/upload-url', {
    method: 'POST', body: JSON.stringify({ fileExtension: 'jpg' }),
  });
  const resizedUri = await resizeForUpload(localImageUri);
  const photoBlob = await (await fetch(resizedUri)).blob();
  await fetchWithTimeout(uploadUrl, { method: 'PUT', body: photoBlob, headers: { 'Content-Type': 'image/jpeg' } });
  return authedFetch(`/wardrobe/items/${itemId}/photo`, { method: 'POST', body: JSON.stringify({ s3Key: key }) });
}
export const moveItemToBin = (id: string) => authedFetch(`/wardrobe/items/${id}`, { method: 'DELETE' });
export const restoreItemFromBin = (id: string) => authedFetch(`/wardrobe/items/${id}/restore`, { method: 'POST' });
export const permanentlyDeleteItem = (id: string) => authedFetch(`/wardrobe/items/${id}/permanent`, { method: 'DELETE' });
export const archiveWardrobeItem = (id: string) => authedFetch(`/wardrobe/items/${id}/archive`, { method: 'POST' });
export const unarchiveWardrobeItem = (id: string) => authedFetch(`/wardrobe/items/${id}/unarchive`, { method: 'POST' });
export const reorderWardrobeItems = (orderedIds: string[]) =>
  authedFetch('/wardrobe/items/reorder', { method: 'POST', body: JSON.stringify({ orderedIds }) });

// Tag scanner ("Scan tag" on Add Item): uploads a photo of the
// garment's label using the SAME presigned-URL flow as a normal item
// photo, then asks the vision model to read it. Returns extracted
// fields to pre-fill the form — does not save anything itself.
export async function scanItemTag(localImageUri: string) {
  const { key: s3Key, uploadUrl } = await authedFetch('/wardrobe/upload-url', { method: 'POST', body: JSON.stringify({ fileExtension: 'jpg' }) });
  const photoBlob = await (await fetch(localImageUri)).blob();
  await fetchWithTimeout(uploadUrl, { method: 'PUT', body: photoBlob, headers: { 'Content-Type': 'image/jpeg' } });
  return authedFetch('/wardrobe/items/scan-tag', { method: 'POST', body: JSON.stringify({ s3Key }) });
}

// Bulk upload — mirrors uploadWardrobeItem but for N items uploaded in
// one go (the "Bulk Upload" screens across all three boards). Requests
// N presigned URLs at once, uploads each photo, then saves all N item
// records in a single call.
export async function uploadWardrobeItemsBulk(
  entries: { localImageUri: string | null; meta: Record<string, any> }[]
) {
  if (entries.length === 0) return [];
  const urls = await authedFetch('/wardrobe/upload-urls', {
    method: 'POST', body: JSON.stringify({ count: entries.length, fileExtension: 'jpg' }),
  });

  await Promise.all(
    entries.map(async (entry, idx) => {
      if (!entry.localImageUri) return;
      try {
        const resizedUri = await resizeForUpload(entry.localImageUri);
        const photoBlob = await (await fetch(resizedUri)).blob();
        await fetchWithTimeout(urls[idx].uploadUrl, { method: 'PUT', body: photoBlob, headers: { 'Content-Type': 'image/jpeg' } });
      } catch (err) {
        console.warn('[uploadWardrobeItemsBulk] Photo upload failed for one item, saving without a photo:', err);
      }
    })
  );

  const items = entries.map((entry, idx) => ({
    itemId: urls[idx].itemId, s3Key: urls[idx].key, ...entry.meta,
  }));
  return authedFetch('/wardrobe/items/bulk', { method: 'POST', body: JSON.stringify({ items }) });
}

export const listOutfits = (category: string = 'all', filters: Record<string, string> = {}) => {
  const params = new URLSearchParams({ category, ...filters }).toString();
  return authedFetch(`/outfits?${params}`);
};
export const getOutfitCategories = () => authedFetch('/outfits/categories');
export const getOutfit = (id: string) => authedFetch(`/outfits/${id}`);
export const createOutfit = (payload: Record<string, any>) =>
  authedFetch('/outfits', { method: 'POST', body: JSON.stringify(payload) });
export const updateOutfit = (id: string, patch: Record<string, any>) =>
  authedFetch(`/outfits/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
export const setOutfitFavorite = (id: string, isFavorite: boolean) =>
  authedFetch(`/outfits/${id}/favorite`, { method: 'POST', body: JSON.stringify({ isFavorite }) });
export const deleteOutfit = (id: string) => authedFetch(`/outfits/${id}`, { method: 'DELETE' });

// ---------- Packing / trips ("Start packing" flow) ----------

export const listPackings = () => authedFetch('/packing');
export const getPacking = (id: string) => authedFetch(`/packing/${id}`);
export const createPacking = (payload: Record<string, any>) =>
  authedFetch('/packing', { method: 'POST', body: JSON.stringify(payload) });
export const updatePacking = (id: string, patch: Record<string, any>) =>
  authedFetch(`/packing/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
export const deletePacking = (id: string) => authedFetch(`/packing/${id}`, { method: 'DELETE' });

// Cover photo for a trip reuses the same wardrobe-upload presigned-URL
// flow (it's just an image in the same S3 bucket) rather than a
// separate endpoint.
export async function uploadPackingCoverImage(localImageUri: string): Promise<string> {
  const { key, uploadUrl, imageUrl } = await authedFetch('/wardrobe/upload-url', {
    method: 'POST', body: JSON.stringify({ fileExtension: 'jpg' }),
  });
  const resizedUri = await resizeForUpload(localImageUri);
  const photoBlob = await (await fetch(resizedUri)).blob();
  await fetchWithTimeout(uploadUrl, { method: 'PUT', body: photoBlob, headers: { 'Content-Type': 'image/jpeg' } });
  return imageUrl;
}

// ---------- Calendar / Outfit of the Day ----------

export const listCalendarMonth = (month: string) => authedFetch(`/calendar?month=${month}`);
export const getCalendarDay = (date: string) => authedFetch(`/calendar/${date}`);
export const setCalendarDay = (date: string, outfitId: string, note?: string) =>
  authedFetch(`/calendar/${date}`, { method: 'PUT', body: JSON.stringify({ outfitId, note }) });
export const deleteCalendarDay = (date: string) => authedFetch(`/calendar/${date}`, { method: 'DELETE' });
export const getTodayOutfit = () => authedFetch('/calendar/today/outfit');

// ---------- Weather ----------
// Proxied through our own backend — the app never calls a third-party
// weather domain directly, only this API. See server/src/controllers/
// weather.controller.ts for how the backend sources the actual data.
export const getWeatherByPlace = (place: string) => authedFetch(`/weather/by-place?place=${encodeURIComponent(place)}`);
export const getWeatherByCoords = (lat: number, lon: number) => authedFetch(`/weather/by-coords?lat=${lat}&lon=${lon}`);

export const startStylingSession = (occasion: string, mood: string) =>
  authedFetch('/styling-sessions', { method: 'POST', body: JSON.stringify({ occasion, mood }) });
export const generateOutfit = (sessionId: string) =>
  authedFetch(`/styling-sessions/${sessionId}/generate`, { method: 'POST' });

export const discoverLooks = (category: string = 'all') => authedFetch(`/looks/discover?category=${category}`);
export const shuffleLook = (occasion?: string, mood?: string) =>
  authedFetch('/looks/shuffle', { method: 'POST', body: JSON.stringify({ occasion, mood }) });
export const saveManualOutfit = (itemIds: string[]) =>
  authedFetch('/looks/manual', { method: 'POST', body: JSON.stringify({ itemIds }) });

export const getChatHistory = () => authedFetch('/chat/history');
export const clearChatHistory = () => authedFetch('/chat/history', { method: 'DELETE' });
export const sendChatMessage = (text: string) =>
  authedFetch('/chat/message', { method: 'POST', body: JSON.stringify({ text }) });

// ---------- Style Profile (body shape + AI color analysis) ----------

export const getProfile = () => authedFetch('/profile');

export const setBodyShape = (bodyShape: string) =>
  authedFetch('/profile/body-shape', { method: 'PATCH', body: JSON.stringify({ bodyShape }) });

export async function submitColorAnalysis(localImageUri: string) {
  const { key, uploadUrl } = await authedFetch('/profile/color-analysis/upload-url', {
    method: 'POST', body: JSON.stringify({ fileExtension: 'jpg' }),
  });

  const photoBlob = await (await fetch(localImageUri)).blob();
  await fetchWithTimeout(uploadUrl, { method: 'PUT', body: photoBlob, headers: { 'Content-Type': 'image/jpeg' } });

  // Vision analysis genuinely takes longer than normal requests (up to
  // 15s backend-side) — this call needs more room than the default timeout.
  const token = await getStoredToken();
  const res = await fetchWithTimeout(`${API_BASE_URL}/profile/color-analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ s3Key: key }),
  }, 25_000);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? 'Color analysis failed');
  return body;
}
