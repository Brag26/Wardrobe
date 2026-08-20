// server/src/routes/outfits.routes.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  listOutfits, getOutfitDetail, createManualOutfit, updateOutfitDetail, deleteOutfit,
  listOutfitCategories,
} from '../controllers/outfits.controller';
import { setOutfitFavorite, listFavoriteItems, listFavoriteOutfits, saveManualOutfit } from '../controllers/looks.controller';

const router = Router();
router.use(requireAuth);

// IMPORTANT: '/categories' must be registered before '/:id', or Express
// will match it as getOutfitDetail with id="categories" instead.
router.get('/categories', listOutfitCategories);

router.get('/', listOutfits);
router.post('/', createManualOutfit);          // "Create Outfit" screen's Upload button
router.post('/manual', saveManualOutfit);      // "AI Drag Studio" quick-save
router.get('/:id', getOutfitDetail);
router.patch('/:id', updateOutfitDetail);
router.delete('/:id', deleteOutfit);
router.post('/:id/favorite', setOutfitFavorite);

export default router;
