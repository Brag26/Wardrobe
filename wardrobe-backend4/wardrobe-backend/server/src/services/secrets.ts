// server/src/services/secrets.ts
// JWT_SECRET is stored in AWS Secrets Manager, not a plain env var
// (confirmed with the team). This fetches it once and caches it at
// module scope — same Lambda warm-start reuse pattern as db.ts's
// MongoDB connection, so it's not a network call on every request.
//
// Requires env var: JWT_SECRET_ARN (the Secrets Manager secret's ARN)
//
// LOCAL DEV: if JWT_SECRET_ARN isn't set, falls back to reading
// JWT_SECRET directly from .env — so you don't need real AWS Secrets
// Manager access just to run this locally.

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: process.env.AWS_REGION ?? 'ap-south-1' });

let cachedSecret: string | null = null;

export async function getJwtSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;

  const arn = process.env.JWT_SECRET_ARN;
  if (!arn) {
    // Local dev fallback — no Secrets Manager needed to run `npm run dev`
    const fallback = process.env.JWT_SECRET;
    if (!fallback) {
      throw new Error('Neither JWT_SECRET_ARN nor JWT_SECRET is set — see .env.example');
    }
    cachedSecret = fallback;
    return cachedSecret;
  }

  const result = await client.send(new GetSecretValueCommand({ SecretId: arn }));
  if (!result.SecretString) {
    throw new Error(`Secret ${arn} has no SecretString value`);
  }

  // Support both a plain-string secret and a {"JWT_SECRET": "..."} JSON secret
  try {
    const parsed = JSON.parse(result.SecretString);
    cachedSecret = parsed.JWT_SECRET ?? parsed.jwt_secret ?? result.SecretString;
  } catch {
    cachedSecret = result.SecretString;
  }

  return cachedSecret!;
}
