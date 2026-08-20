// server/src/controllers/packing.controller.ts
// Powers the Outfit Section board's "Start packing" flow: My packing
// list, Start packing (name/cover/destination/dates), Select outfit,
// and the packing card's Edit/Delete kebab.

import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import {
  createPacking, getPacking, listPackings, updatePacking, softDeletePacking,
} from '../services/mongodb.service';
import { Packing } from '../types/domain';

function requireUser(req: Request, res: Response): string | null {
  const userId = req.auth?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return userId;
}

// GET /api/packing — "My packing" section on the Outfits home screen
export async function listPackingsHandler(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const packings = await listPackings(userId);
  res.json(packings);
}

// GET /api/packing/:id
export async function getPackingHandler(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const packing = await getPacking(userId, req.params.id);
  if (!packing) return res.status(404).json({ error: 'Packing not found' });
  res.json(packing);
}

// POST /api/packing — "Start packing" screen's initial save (name,
// cover image, destination, dates); outfits are added afterward via
// PATCH from the "Select outfit" screen.
export async function createPackingHandler(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const { name, coverImageUrl, destination, startDate, endDate, outfitIds } = req.body as Partial<Packing>;

  const now = Date.now();
  const packing: Packing = {
    id: randomUUID(),
    userId,
    name: name ?? null,
    coverImageUrl: coverImageUrl ?? null,
    destination: destination ?? null,
    startDate: startDate ?? null,
    endDate: endDate ?? null,
    outfitIds: outfitIds ?? [],
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await createPacking(packing);
  res.status(201).json(packing);
}

// PATCH /api/packing/:id — rename, change dates/cover, or (most often)
// replace the outfitIds list from the "Select outfit" screen's "Done".
export async function updatePackingHandler(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  const allowed = ['name', 'coverImageUrl', 'destination', 'startDate', 'endDate', 'outfitIds'];
  const patch: Record<string, any> = {};
  for (const key of allowed) if (key in req.body) patch[key] = req.body[key];

  await updatePacking(userId, req.params.id, patch);
  const packing = await getPacking(userId, req.params.id);
  if (!packing) return res.status(404).json({ error: 'Packing not found' });
  res.json(packing);
}

// DELETE /api/packing/:id — "Delete this packing" confirmation
export async function deletePackingHandler(req: Request, res: Response) {
  const userId = requireUser(req, res); if (!userId) return;
  await softDeletePacking(userId, req.params.id);
  res.json({ ok: true });
}
