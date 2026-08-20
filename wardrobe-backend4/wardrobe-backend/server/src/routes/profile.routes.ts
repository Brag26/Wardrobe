// server/src/routes/profile.routes.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getProfile, updateBodyShape, requestColorAnalysisUploadUrl, runColorAnalysis,
} from '../controllers/profile.controller';

const router = Router();
router.use(requireAuth);

router.get('/', getProfile);
router.patch('/body-shape', updateBodyShape);
router.post('/color-analysis/upload-url', requestColorAnalysisUploadUrl);
router.post('/color-analysis', runColorAnalysis);

export default router;
