import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { startSession, generateOutfitForSession, getSession } from '../controllers/styling.controller';

const router = Router();
router.use(requireAuth);

router.post('/', startSession);                          // POST /api/styling-sessions
router.post('/:id/generate', generateOutfitForSession);   // POST /api/styling-sessions/:id/generate
router.get('/:id', getSession);                           // GET  /api/styling-sessions/:id

export default router;
