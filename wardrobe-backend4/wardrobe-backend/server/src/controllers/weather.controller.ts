// server/src/controllers/weather.controller.ts
//
// Weather proxy: the app never talks to a third-party weather domain
// directly — it only ever calls this backend endpoint, which then
// reaches out to the actual weather data provider internally. This is
// what "internal" weather actually means in practice: there's no such
// thing as real weather data that doesn't originate from SOME external
// meteorological source (even Apple/Google's own weather features pull
// from external providers) — what's genuinely achievable, and what
// this does, is keep that third party entirely behind your own API so
// the client only ever sees your domain. Swapping providers later
// (e.g. to a paid one with real long-range forecasts) means editing
// this one file, not shipping a new app build.
//
// Provider: Open-Meteo (free, no API key). In-memory cache (5 min TTL)
// so repeated screen opens for the same place don't re-hit the
// external provider every time.

import { Request, Response } from 'express';

interface WeatherResult {
  temp: number;
  code: number;
  season: string;
  placeName: string;
}

const cache = new Map<string, { data: WeatherResult; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function seasonFromTemp(tempC: number): string {
  if (tempC >= 28) return 'summer';
  if (tempC >= 18) return 'spring';
  if (tempC >= 8) return 'autumn';
  return 'winter';
}

async function fetchByCoords(lat: number, lon: number, placeName: string): Promise<WeatherResult> {
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`);
  if (!res.ok) throw new Error(`Weather provider returned ${res.status}`);
  const data: any = await res.json();
  const temp = data.current.temperature_2m;
  const code = data.current.weather_code;
  return { temp, code, season: seasonFromTemp(temp), placeName };
}

function requireUser(req: Request, res: Response): string | null {
  const userId = req.auth?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return userId;
}

// GET /api/weather/by-place?place=Sydney
export async function getWeatherByPlace(req: Request, res: Response) {
  if (!requireUser(req, res)) return;
  const place = (req.query.place as string)?.trim();
  if (!place) return res.status(400).json({ error: 'place is required' });

  const cacheKey = `place:${place.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return res.json(cached.data);

  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1`);
    if (!geoRes.ok) throw new Error(`Geocoding provider returned ${geoRes.status}`);
    const geo: any = await geoRes.json();
    const found = geo?.results?.[0];
    if (!found) return res.status(404).json({ error: `Could not find a location for "${place}"` });

    const result = await fetchByCoords(found.latitude, found.longitude, found.name);
    cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    res.json(result);
  } catch (err: any) {
    res.status(502).json({ error: 'Weather lookup failed', detail: err.message });
  }
}

// GET /api/weather/by-coords?lat=..&lon=..
export async function getWeatherByCoords(req: Request, res: Response) {
  if (!requireUser(req, res)) return;
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: 'lat and lon query params are required' });
  }

  const cacheKey = `coords:${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return res.json(cached.data);

  try {
    const result = await fetchByCoords(lat, lon, 'your location');
    cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    res.json(result);
  } catch (err: any) {
    res.status(502).json({ error: 'Weather lookup failed', detail: err.message });
  }
}
