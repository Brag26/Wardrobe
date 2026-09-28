// server/src/server.ts
import 'dotenv/config';
import app from './app';

import {
  S3Client,
  HeadBucketCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

import {
  STSClient,
  GetCallerIdentityCommand,
} from '@aws-sdk/client-sts';

const PORT = process.env.PORT ?? 4000;

const REGION = process.env.AWS_REGION ?? 'ap-south-1';
const BUCKET = process.env.AWS_S3_BUCKET ?? '';

const s3 = new S3Client({
  region: REGION,
});

const sts = new STSClient({
  region: REGION,
});

async function debugAWS() {
  console.log('================ AWS DEBUG ================');

  console.log('[AWS] Region:', REGION);
  console.log('[AWS] Bucket:', BUCKET);

  try {
    const identity = await sts.send(
      new GetCallerIdentityCommand({})
    );

    console.log('[AWS] Authentication: SUCCESS');
    console.log('[AWS] Account:', identity.Account);
    console.log('[AWS] ARN:', identity.Arn);
    console.log('[AWS] UserId:', identity.UserId);
  } catch (error: any) {
    console.error('[AWS] Authentication: FAILED');
    console.error('[AWS] Name:', error?.name);
    console.error('[AWS] Message:', error?.message);
    return;
  }

  console.log('===========================================');
}

async function debugS3Bucket() {
  console.log('================ S3 BUCKET TEST ===========');

  try {
    const result = await s3.send(
      new HeadBucketCommand({
        Bucket: BUCKET,
      })
    );

    console.log('[S3] HeadBucket: SUCCESS');
    console.log('[S3] Status:', result.$metadata?.httpStatusCode);
  } catch (error: any) {
    console.error('[S3] HeadBucket: FAILED');
    console.error('[S3] Name:', error?.name);
    console.error('[S3] Message:', error?.message);
    console.error(
      '[S3] Status:',
      error?.$metadata?.httpStatusCode
    );
    console.error(
      '[S3] RequestId:',
      error?.$metadata?.requestId
    );
  }

  console.log('============================================');
}

async function debugS3Object() {
  console.log('================ S3 OBJECT TEST ============');

  // Use one EXISTING object key from your previous Render log.
  const key =
    'wardrobe/6ab3688594a97c1d509c4f8f/43e39ffa-377e-42a3-b6c7-227eeef7e964/original.jpg';

  console.log('[S3] Testing key:', key);

  try {
    const result = await s3.send(
      new HeadObjectCommand({
        Bucket: BUCKET,
        Key: key,
      })
    );

    console.log('[S3] HeadObject: SUCCESS');
    console.log('[S3] Status:', result.$metadata?.httpStatusCode);
    console.log('[S3] ContentLength:', result.ContentLength);
    console.log('[S3] ContentType:', result.ContentType);
  } catch (error: any) {
    console.error('[S3] HeadObject: FAILED');
    console.error('[S3] Name:', error?.name);
    console.error('[S3] Message:', error?.message);
    console.error(
      '[S3] Status:',
      error?.$metadata?.httpStatusCode
    );
    console.error(
      '[S3] RequestId:',
      error?.$metadata?.requestId
    );
  }

  console.log('============================================');
}

async function startServer() {
  await debugAWS();
  await debugS3Bucket();
  await debugS3Object();

  app.listen(PORT, () => {
    console.log(`AI Wardrobe backend listening on port ${PORT}`);
  });
}

startServer();