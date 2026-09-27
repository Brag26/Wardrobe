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

// Previously there was genuinely no size limit anywhere — not on the
// picker, not on the upload, not on the server. Someone could pick an
// enormous photo and it would silently upload (slowly) and get
// processed as-is. This is the client-side layer: fast feedback,
// before wasting time on a slow upload of something that's going to
// get rejected anyway. MAX_PHOTO_BYTES matches the server-side check
// in wardrobe.controller.ts — keep both in sync if this changes.
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024; // 20MB

export function checkPhotoSize(fileSize: number | undefined): { ok: true } | { ok: false; message: string } {
  // fileSize is undefined on some platforms/pick methods — when we
  // genuinely can't know the size ahead of time, let it through here
  // and rely on the server-side backstop instead of blocking a valid
  // upload over a missing field.
  if (fileSize == null) return { ok: true };
  if (fileSize > MAX_PHOTO_BYTES) {
    const mb = (fileSize / (1024 * 1024)).toFixed(1);
    return { ok: false, message: `That photo is ${mb}MB — please use one under ${MAX_PHOTO_BYTES / (1024 * 1024)}MB.` };
  }
  return { ok: true };
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

// A failed S3 PUT resolves as an ordinary Response with ok:false — it
// never throws — so every call site that did `await fetchWithTimeout(uploadUrl,
// { method: 'PUT', ... })` and moved on without checking `.ok` was
// treating silent upload failures as successes. The item/chat-message
// save that follows then references a photo that was never actually
// written to S3: the backend either can't find it (HeadObject throws an
// opaque AWS SDK error) or hands the vision model a URL that 404s, which
// is why "add item" saves could fail with an unhelpful "UnknownError"
// and why Ara's photo replies could come back generic, as if it never
// saw the photo at all. Centralizing the upload here so every caller
// gets the same real failure check.
async function putPhotoToS3(uploadUrl: string, blob: Blob): Promise<void> {
  const res = await fetchWithTimeout(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } });
  if (!res.ok) {
    throw new Error(`Photo upload failed (${res.status}) — check your connection and try again.`);
  }
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
    // Previously called r.json() directly with no protection — unlike
    // authedFetch (which already safely falls back if the response
    // isn't valid JSON), a genuinely non-JSON response here (a crash
    // page, a proxy error, anything not real JSON) would throw a raw,
    // unhandled "JSON Parse error" instead of a real message.
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error ?? `Failed to send OTP (${r.status})`);
    return body;
  });
}

export async function verifyOtp(phone: string, code: string) {
  const res = await fetchWithTimeout(`${API_BASE_URL}/auth/verify-otp`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, code }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Invalid code (${res.status})`);
  await storeToken(body.token);
  return body as { token: string; user: { id: string; phone: string } };
}

// Dev-only: skips OTP entirely. Only works if the backend has
// DEV_LOGIN_ENABLED=true set (never true in production).
export async function devLogin(phone: string) {
  const res = await fetchWithTimeout(`${API_BASE_URL}/auth/dev-login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Dev login not available (${res.status}) — is DEV_LOGIN_ENABLED=true on the backend?`);
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

  // This used to swallow a failed PUT silently (the comment here called
  // it "best effort") and still hand `key` to the /wardrobe/items save
  // call below as if the photo were there. Two problems made that
  // actually break saving instead of gracefully degrading:
  //   1. A failed S3 PUT (bad/expired presigned URL, network blip, a
  //      signature mismatch) resolves as a normal Response with
  //      ok:false — it never throws — so the try/catch below never
  //      caught it, and the code sailed on as if the upload worked.
  //   2. The backend's POST /wardrobe/items requires s3Key and always
  //      calls verifyUploadedPhotoSize(s3Key), which does an S3
  //      HeadObject on it. If nothing was ever actually uploaded to
  //      that key, HeadObject fails and the AWS SDK throws an opaque,
  //      unhelpful "UnknownError" — exactly the "Could not save"
  //      alert this was producing, with no indication the real cause
  //      was an upload that silently failed.
  // Now the PUT's status is actually checked, and a failure here throws
  // a clear, actionable error immediately instead of limping forward
  // into a guaranteed backend failure with a useless message.
  if (localImageUri) {
    const resizedUri = await resizeForUpload(localImageUri);
    const photoBlob = await (await fetch(resizedUri)).blob();
    await putPhotoToS3(uploadUrl, photoBlob);
  } else {
    throw new Error('Add a photo of the item before saving.');
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
  await putPhotoToS3(uploadUrl, photoBlob);
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
  await putPhotoToS3(uploadUrl, photoBlob);
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

  // Bulk save requires a real photo per item (the backend's HeadObject
  // check on s3Key isn't optional) — but one bad photo among a batch of
  // N shouldn't sink the other N-1 that uploaded fine. Previously a
  // failed PUT here was swallowed (try/catch that just logged a
  // warning) and the item still went into the batch with a phantom
  // s3Key, ending up in the same "UnknownError" state the single-item
  // flow had. Now a failed upload actually drops just that one item
  // from the batch — the rest still save.
  const uploadFailed = new Set<number>();
  await Promise.all(
    entries.map(async (entry, idx) => {
      if (!entry.localImageUri) { uploadFailed.add(idx); return; }
      try {
        const resizedUri = await resizeForUpload(entry.localImageUri);
        const photoBlob = await (await fetch(resizedUri)).blob();
        await putPhotoToS3(urls[idx].uploadUrl, photoBlob);
      } catch (err) {
        console.warn(`[uploadWardrobeItemsBulk] Photo upload failed for item ${idx}, dropping it from this batch:`, err);
        uploadFailed.add(idx);
      }
    })
  );

  const items = entries
    .map((entry, idx) => ({ itemId: urls[idx].itemId, s3Key: urls[idx].key, ...entry.meta }))
    .filter((_, idx) => !uploadFailed.has(idx));
  if (items.length === 0) {
    throw new Error('None of the photos could be uploaded — check your connection and try again.');
  }
  const saved = await authedFetch('/wardrobe/items/bulk', { method: 'POST', body: JSON.stringify({ items }) });
  if (uploadFailed.size > 0) {
    console.warn(`[uploadWardrobeItemsBulk] ${uploadFailed.size} of ${entries.length} item photo(s) failed to upload and were skipped.`);
  }
  return saved;
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
// Read-only version — used by the Calendar screen, which should only ever
// show today's outfit if one is already assigned, never silently generate
// and auto-assign a brand new one just because the tab was opened. Only
// Home's explicit "Outfit of the Day" button (getTodayOutfit above) may
// trigger generation.
export const getTodayOutfitIfSet = () => authedFetch('/calendar/today/outfit?generate=false');

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
// Bug fix: an attached photo used to never actually reach the AI — the
// app just appended "[+ photo attached]" as literal text. Now, if a
// local photo URI is passed, it's uploaded first (same presigned-URL
// flow as everything else) and its s3Key is sent along with the
// message so the backend can hand the real image to a vision model.
export async function sendChatMessage(text: string, localImageUri?: string | null) {
  let s3Key: string | undefined;
  if (localImageUri) {
    const { key, uploadUrl } = await authedFetch('/wardrobe/upload-url', {
      method: 'POST', body: JSON.stringify({ fileExtension: 'jpg' }),
    });
    const photoBlob = await (await fetch(localImageUri)).blob();
    // Was unchecked here — a failed PUT (bad/expired presigned URL,
    // dropped connection) went unnoticed, s3Key still got sent to
    // /chat/message, and the backend built an imageUrl pointing at a
    // photo that was never actually in S3. Ara's vision call then either
    // 404'd fetching it or got nothing back, which is exactly what
    // looked like "the AI can't recognize the photo" — it genuinely
    // never saw it. Throwing here surfaces that as a real, actionable
    // error instead of a silent no-op that still sends the message.
    await putPhotoToS3(uploadUrl, photoBlob);
    s3Key = key;
  }
  return authedFetch('/chat/message', { method: 'POST', body: JSON.stringify({ text, s3Key }) });
}

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
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Color analysis failed (${res.status})`);
  return body;
}
