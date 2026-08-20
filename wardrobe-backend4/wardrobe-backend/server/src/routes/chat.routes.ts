import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getHistory, sendMessage, deleteHistory } from '../controllers/chat.controller';

const router = Router();
router.use(requireAuth);

router.get('/history', getHistory);      // GET    /api/chat/history
router.post('/message', sendMessage);    // POST   /api/chat/message
router.delete('/history', deleteHistory); // DELETE /api/chat/history — clear conversation

export default router;
