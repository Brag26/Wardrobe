// server/src/controllers/auth.controller.ts
// Phone OTP -> backend JWT, per the real production spec (not Cognito).
// JWT_SECRET comes from AWS Secrets Manager (confirmed with the team) —
// see services/secrets.ts.

import { Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { requestOtp, verifyOtp, upsertUserByPhone } from '../services/otp.service';
import { getJwtSecret } from '../services/secrets';

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '30d';

function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

// POST /api/auth/request-otp   body: { phone }
export async function requestOtpHandler(req: Request, res: Response) {
  const { phone } = req.body as { phone?: string };
  if (!phone || !isValidE164(phone)) {
    return res.status(400).json({ error: 'phone must be in E.164 format, e.g. +919876543210' });
  }

  const result = await requestOtp(phone);
  if (!result.ok) {
    if (result.retryAfterSeconds) res.set('Retry-After', String(result.retryAfterSeconds));
    return res.status(429).json({ error: result.reason, retryAfterSeconds: result.retryAfterSeconds });
  }

  res.json({ ok: true, message: 'OTP sent' });
}

// POST /api/auth/verify-otp   body: { phone, code }
export async function verifyOtpHandler(req: Request, res: Response) {
  const { phone, code } = req.body as { phone?: string; code?: string };
  if (!phone || !code) return res.status(400).json({ error: 'phone and code are required' });

  const result = await verifyOtp(phone, code);
  if (!result.ok) return res.status(401).json({ error: result.reason });

  const user = await upsertUserByPhone(phone);
  const jwtSecret = await getJwtSecret();
  const signOptions: SignOptions = { expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  const token = jwt.sign({ sub: user.id, phone: user.phone }, jwtSecret, signOptions);

  res.json({ token, user });
}

// POST /api/auth/dev-login   body: { phone }
// Completely skips OTP — no SNS, no code, nothing to configure. Issues
// a real, valid token straight away.
//
// SAFETY: only works when DEV_LOGIN_ENABLED=true is explicitly set in
// .env. Never set that in any deployed/production environment — this
// endpoint is a real authentication bypass by design, meant only for
// local testing before SNS access is set up.
export async function devLoginHandler(req: Request, res: Response) {
  if (process.env.DEV_LOGIN_ENABLED !== 'true') {
    return res.status(404).json({ error: 'Not found' });
  }

  const { phone } = req.body as { phone?: string };
  if (!phone || !isValidE164(phone)) {
    return res.status(400).json({ error: 'phone must be in E.164 format, e.g. +919876543210' });
  }

  const user = await upsertUserByPhone(phone);
  const jwtSecret = await getJwtSecret();
  const signOptions: SignOptions = { expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  const token = jwt.sign({ sub: user.id, phone: user.phone }, jwtSecret, signOptions);

  res.json({ token, user, warning: 'DEV LOGIN — not for production use' });
}
