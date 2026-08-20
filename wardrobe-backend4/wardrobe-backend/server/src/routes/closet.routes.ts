// server/src/routes/closet.routes.ts
// Home screen stat cards (Items / Outfits / Favorites counts) + Favorites screen
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { closetOverview, closetExpenses } from '../controllers/wardrobe.controller';
import { listFavoriteItems, listFavoriteOutfits } from '../controllers/looks.controller';

const router = Router();
router.use(requireAuth);

router.get('/overview', closetOverview);
router.get('/expenses', closetExpenses);
router.get('/favorites/items', listFavoriteItems);
router.get('/favorites/outfits', listFavoriteOutfits);

export default router;
