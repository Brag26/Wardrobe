// server/src/controllers/calendar.controller.ts
// Powers the Home board's Calendar screen — one outfit per date,
// past (log what you wore) or future (plan ahead), plus the
// "Outfit of the Day" snap/wrap confirmation flow.

import { Request, Response } from 'express';
import {
  setCalendarEntry, getCalendarEntry, listCalendarEntriesForMonth, deleteCalendarEntry,
} from '../services/mongodb.service';

function requireUser(req: Request, res: Response): string | null {
  const userId = req.auth?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return userId;
}

// GET /api/calendar?month=YYYY-MM
export async function listMonth(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });
  const entries = await listCalendarEntriesForMonth(userId, month);
  res.json(entries);
}

// GET /api/calendar/:date   (date = YYYY-MM-DD)
export async function getDay(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const entry = await getCalendarEntry(userId, req.params.date);
  res.json(entry);
}

// PUT /api/calendar/:date   body: { outfitId, note? }
export async function setDay(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const { outfitId, note } = req.body as { outfitId: string; note?: string };
  if (!outfitId) return res.status(400).json({ error: 'outfitId is required' });
  const entry = await setCalendarEntry(userId, req.params.date, outfitId, note);
  res.json(entry);
}

// DELETE /api/calendar/:date
export async function removeDay(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  await deleteCalendarEntry(userId, req.params.date);
  res.json({ ok: true });
}
