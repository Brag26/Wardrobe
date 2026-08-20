// server/src/middleware/auth.ts
// Verifies OUR OWN JWT (issued after phone OTP verification — see
// controllers/auth.controller.ts), NOT Cognito. Attaches { userId } to
// req.auth, where userId is the Mongo _id of the user document.
//
// JWT_SECRET comes from AWS Secrets Manager (confirmed with the team) —
// see services/secrets.ts, which also has a local-dev fallback.

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../services/secrets';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { userId: string; phone?: string };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const token = header.replace('Bearer ', '');

  try {
    const jwtSecret = await getJwtSecret();
    const payload = jwt.verify(token, jwtSecret) as { sub: string; phone?: string };
    req.auth = { userId: payload.sub, phone: payload.phone };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
