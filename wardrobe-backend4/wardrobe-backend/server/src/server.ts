// server/src/server.ts
import 'dotenv/config';
import app from './app';
import {
  STSClient,
  GetCallerIdentityCommand,
} from '@aws-sdk/client-sts';

const PORT = process.env.PORT ?? 4000;

const REGION = process.env.AWS_REGION;
const BUCKET = process.env.AWS_S3_BUCKET;

const sts = new STSClient({
  region: REGION,
});

async function debugAWS() {
  console.log('================ AWS DEBUG ================');

  console.log('[AWS DEBUG] Region:', REGION);
  console.log('[AWS DEBUG] Bucket:', BUCKET);

  // Don't print the actual credentials
  console.log(
    '[AWS DEBUG] Access Key configured:',
    !!process.env.AWS_ACCESS_KEY_ID
  );

  console.log(
    '[AWS DEBUG] Secret Key configured:',
    !!process.env.AWS_SECRET_ACCESS_KEY
  );

  try {
    const result = await sts.send(
      new GetCallerIdentityCommand({})
    );

    console.log('[AWS DEBUG] Authentication: SUCCESS');
    console.log('[AWS DEBUG] Account:', result.Account);
    console.log('[AWS DEBUG] ARN:', result.Arn);
    console.log('[AWS DEBUG] UserId:', result.UserId);
  } catch (error: any) {
    console.error('[AWS DEBUG] Authentication: FAILED');
    console.error('[AWS DEBUG] Error name:', error?.name);
    console.error('[AWS DEBUG] Error message:', error?.message);
    console.error('[AWS DEBUG] HTTP status:', error?.$metadata?.httpStatusCode);
  }

  console.log('===========================================');
}

async function startServer() {
  await debugAWS();

  app.listen(PORT, () => {
    console.log(`AI Wardrobe backend listening on port ${PORT}`);
  });
}

startServer();