// server/src/routes/calendar.routes.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { listMonth, getDay, setDay, removeDay } from '../controllers/calendar.controller';

const router = Router();
router.use(requireAuth);

router.get('/', listMonth);
router.get('/:date', getDay);
router.put('/:date', setDay);
router.delete('/:date', removeDay);

export default router;
