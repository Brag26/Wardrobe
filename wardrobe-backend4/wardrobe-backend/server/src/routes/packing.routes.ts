// server/src/routes/packing.routes.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  listPackingsHandler, getPackingHandler, createPackingHandler,
  updatePackingHandler, deletePackingHandler,
} from '../controllers/packing.controller';

const router = Router();
router.use(requireAuth);

router.get('/', listPackingsHandler);
router.post('/', createPackingHandler);
router.get('/:id', getPackingHandler);
router.patch('/:id', updatePackingHandler);
router.delete('/:id', deletePackingHandler);

export default router;
