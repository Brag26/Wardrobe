// server/src/routes/auth.routes.ts
import { Router } from 'express';
import { requestOtpHandler, verifyOtpHandler, devLoginHandler } from '../controllers/auth.controller';

const router = Router();
router.post('/request-otp', requestOtpHandler);
router.post('/verify-otp', verifyOtpHandler);
router.post('/dev-login', devLoginHandler); // only responds when DEV_LOGIN_ENABLED=true

export default router;
