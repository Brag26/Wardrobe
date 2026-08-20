// server/src/routes/wardrobe.routes.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  requestUploadUrl, requestBulkUploadUrls, saveWardrobeItem, saveBulkWardrobeItems,
  listItems, listBinItems, listArchive, getItem, closetOverview,
  updateItem, markWorn, setFavorite, retryBackgroundRemoval,
  moveToBin, restoreFromBin, permanentDelete, attributeSuggestions,
  archiveItemHandler, unarchiveItemHandler, reorderItems, scanTag,
} from '../controllers/wardrobe.controller';

const router = Router();
router.use(requireAuth);

// Upload
router.post('/upload-url', requestUploadUrl);
router.post('/upload-urls', requestBulkUploadUrls); // bulk
router.post('/items/scan-tag', scanTag);

// Create
router.post('/items', saveWardrobeItem);
router.post('/items/bulk', saveBulkWardrobeItems);

// Read — 'bin', 'archive', 'attribute-suggestions', and 'reorder' must be
// registered before '/items/:id', or Express matches them as getItem
// with id="bin" etc.
router.get('/items/bin', listBinItems);
router.get('/items/archive', listArchive);
router.get('/items/attribute-suggestions', attributeSuggestions);
router.post('/items/reorder', reorderItems);
router.get('/items', listItems);
router.get('/items/:id', getItem);

// Update
router.patch('/items/:id', updateItem);
router.post('/items/:id/worn', markWorn);
router.post('/items/:id/favorite', setFavorite);
router.post('/items/:id/archive', archiveItemHandler);
router.post('/items/:id/unarchive', unarchiveItemHandler);
router.post('/items/:id/retry-background-removal', retryBackgroundRemoval);

// Delete / Bin
router.delete('/items/:id', moveToBin);
router.post('/items/:id/restore', restoreFromBin);
router.delete('/items/:id/permanent', permanentDelete);

export default router;
