// server/src/routes/weather.routes.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getWeatherByPlace, getWeatherByCoords } from '../controllers/weather.controller';

const router = Router();
router.use(requireAuth);

router.get('/by-place', getWeatherByPlace);
router.get('/by-coords', getWeatherByCoords);

export default router;
