// server/src/services/otp.service.ts
// Phone OTP via Amazon SNS — matches the real production spec
// ("SMS / OTP: Amazon SNS for OTP SMS").
//
// Rate limits (confirmed with the team): 1 request per 60 seconds,
// max 5 requests per hour, per phone number.
//
// Flow:
//   1. POST /api/auth/request-otp  { phone } -> checks rate limits,
//      generates a 6-digit code, stores a HASH of it (never the raw
//      code) in Mongo with a 5-minute TTL, sends the raw code via SNS.
//   2. POST /api/auth/verify-otp   { phone, code } -> hashes the submitted
//      code, compares, and if it matches issues a JWT + creates/updates
//      the User record.
//
// Requires env vars: AWS_REGION, JWT_SECRET (or AWS Secrets Manager — see services/secrets.ts)

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { randomInt, createHash } from 'crypto';
import { OtpRequestModel, OtpRateLimitLogModel, UserModel } from '../models/schemas';
import { connectToDatabase } from './db';

const sns = new SNSClient({ region: process.env.AWS_REGION ?? 'ap-south-1' });

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;

const RATE_LIMIT_COOLDOWN_MS = 60 * 1000;      // 1 request per 60 seconds
const RATE_LIMIT_MAX_PER_HOUR = 5;             // max 5 per hour
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;   // 1 hour

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generateCode(): string {
  return String(randomInt(100000, 999999)); // always 6 digits
}

export type RequestOtpResult =
  | { ok: true }
  | { ok: false; reason: string; retryAfterSeconds?: number };

async function checkRateLimit(phone: string): Promise<RequestOtpResult> {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  const recentRequests = await OtpRateLimitLogModel.find({ phone, requestedAt: { $gte: windowStart } })
    .sort({ requestedAt: -1 })
    .lean();

  if (recentRequests.length >= RATE_LIMIT_MAX_PER_HOUR) {
    const oldestInWindow = recentRequests[recentRequests.length - 1];
    const retryAfterSeconds = Math.ceil((oldestInWindow.requestedAt + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { ok: false, reason: 'Too many OTP requests. Max 5 per hour.', retryAfterSeconds };
  }

  const lastRequest = recentRequests[0];
  if (lastRequest && now - lastRequest.requestedAt < RATE_LIMIT_COOLDOWN_MS) {
    const retryAfterSeconds = Math.ceil((lastRequest.requestedAt + RATE_LIMIT_COOLDOWN_MS - now) / 1000);
    return { ok: false, reason: 'Please wait before requesting another code.', retryAfterSeconds };
  }

  return { ok: true };
}

export async function requestOtp(phone: string): Promise<RequestOtpResult> {
  await connectToDatabase();

  const rateLimitCheck = await checkRateLimit(phone);
  if (!rateLimitCheck.ok) return rateLimitCheck;

  const code = generateCode();
  const now = Date.now();

  await OtpRateLimitLogModel.create({ phone, requestedAt: now });

  await OtpRequestModel.deleteMany({ phone });
  await OtpRequestModel.create({
    phone, codeHash: hashCode(code), expiresAt: now + OTP_TTL_MS, attempts: 0, createdAt: now,
  });

  // DEV MODE: skip real SNS and just log the code, so you can test the
  // full OTP flow locally without AWS SNS set up (SNS sandbox mode also
  // only delivers to manually-verified numbers, which is a pain for
  // day-to-day dev testing). Set SEND_REAL_SMS=true once SNS is ready.
  if (process.env.SEND_REAL_SMS !== 'true') {
    console.log(`\n[DEV OTP] Code for ${phone}: ${code}\n(Set SEND_REAL_SMS=true in .env to send real SMS via SNS instead.)\n`);
    return { ok: true };
  }

  await sns.send(new PublishCommand({
    PhoneNumber: phone, // must be E.164 format, e.g. +919876543210
    Message: `Your verification code is ${code}. It expires in 5 minutes.`,
    MessageAttributes: {
      'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
    },
  }));

  return { ok: true };
}

export async function verifyOtp(phone: string, code: string): Promise<{ ok: boolean; reason?: string }> {
  await connectToDatabase();
  const request = await OtpRequestModel.findOne({ phone }).sort({ createdAt: -1 });

  if (!request) return { ok: false, reason: 'No OTP requested for this number' };
  if (request.expiresAt < Date.now()) return { ok: false, reason: 'Code expired, request a new one' };
  if (request.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'Too many attempts, request a new code' };

  if (request.codeHash !== hashCode(code)) {
    request.attempts += 1;
    await request.save();
    return { ok: false, reason: 'Incorrect code' };
  }

  await OtpRequestModel.deleteOne({ _id: request._id });
  return { ok: true };
}

/** Creates the user on first login, or just bumps lastLoginAt if they exist. */
export async function upsertUserByPhone(phone: string): Promise<{ id: string; phone: string }> {
  await connectToDatabase();
  const now = Date.now();
  const user = await UserModel.findOneAndUpdate(
    { phone },
    { $setOnInsert: { phone, name: null, createdAt: now }, $set: { lastLoginAt: now } },
    { upsert: true, new: true }
  );
  return { id: user._id.toString(), phone: user.phone };
}

export async function getUserProfile(userId: string) {
  await connectToDatabase();
  const user = await UserModel.findById(userId).lean() as any;
  if (!user) return null;
  return {
    id: user._id.toString(),
    phone: user.phone,
    name: user.name,
    bodyShape: user.bodyShape,
    colorProfile: user.colorProfile,
  };
}

export async function setUserBodyShape(userId: string, bodyShape: string) {
  await connectToDatabase();
  await UserModel.updateOne({ _id: userId }, { $set: { bodyShape } });
}

export async function setUserColorProfile(userId: string, colorProfile: {
  undertone: string; recommendedColors: string[]; avoidColors: string[]; explanation: string;
}) {
  await connectToDatabase();
  await UserModel.updateOne({ _id: userId }, { $set: { colorProfile: { ...colorProfile, analyzedAt: Date.now() } } });
}
