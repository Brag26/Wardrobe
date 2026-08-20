// server/src/app.ts
// If supergirl-app's server/ folder already has an app.ts / index.ts,
// merge these route mounts into it rather than replacing the whole file.

import express from 'express';
import cors from 'cors';
import 'express-async-errors';
import { requireAuth } from './middleware/auth';
import { getOutfitById } from './controllers/styling.controller';

import authRoutes from './routes/auth.routes';
import wardrobeRoutes from './routes/wardrobe.routes';
import stylingRoutes from './routes/styling.routes';
import looksRoutes from './routes/looks.routes';
import outfitsRoutes from './routes/outfits.routes';
import closetRoutes from './routes/closet.routes';
import chatRoutes from './routes/chat.routes';
import profileRoutes from './routes/profile.routes';
import packingRoutes from './routes/packing.routes';
import calendarRoutes from './routes/calendar.routes';
import weatherRoutes from './routes/weather.routes';

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

// Public — no auth required (this IS how auth is obtained)
app.use('/api/auth', authRoutes);

// Everything else requires a valid JWT (checked inside each router via requireAuth)
app.use('/api/wardrobe', wardrobeRoutes);
app.use('/api/styling-sessions', stylingRoutes);
app.use('/api/looks', looksRoutes);
app.use('/api/outfits', outfitsRoutes);
app.use('/api/closet', closetRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/packing', packingRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/weather', weatherRoutes);
app.get('/api/outfits-legacy/:id', requireAuth, getOutfitById); // kept for the S6 "outfit story" lookup used by styling.controller's flow

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
