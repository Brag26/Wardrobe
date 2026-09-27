// server/src/routes/looks.routes.ts
// Powers S7 (Discover/Shuffle) and S8 (Drag Studio quick-save).
// Favorites now live under /api/closet/favorites/* (see closet.routes.ts)
// and outfit favoriting is /api/outfits/:id/favorite (see outfits.routes.ts).

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { discoverLooks, shuffleLook, saveManualOutfit, dailyPick, getRecommendationUsage, getRecommendationHistoryRoute } from '../controllers/looks.controller';

const router = Router();
router.use(requireAuth);

router.get('/daily-pick', dailyPick); // "Today's Pick by Ara" — cached once per day
router.get('/discover', discoverLooks);   // GET  /api/looks/discover
router.post('/shuffle', shuffleLook);     // POST /api/looks/shuffle
router.post('/manual', saveManualOutfit); // POST /api/looks/manual (Drag Studio, S8)
router.get('/usage', getRecommendationUsage);     // GET /api/looks/usage — daily recommendation quota
router.get('/history', getRecommendationHistoryRoute); // GET /api/looks/history — past recommendations

export default router;
