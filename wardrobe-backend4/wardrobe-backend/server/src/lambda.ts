// server/src/lambda.ts
// Lambda entrypoint — wraps the exact same Express app used for local
// dev (src/app.ts) with serverless-http, so moving EC2 -> Lambda
// required NO changes to routes/controllers/services, only this file
// plus the deployment config (infra/serverless.yml).
//
// This replaces: Nginx reverse proxy, PM2, and the EC2 instance itself.
// API Gateway becomes the new "API entry" point (with its own managed
// TLS cert instead of Let's Encrypt/certbot).

import serverlessHttp from 'serverless-http';
import type { Context, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import app from './app';

const serverlessHandler = serverlessHttp(app);

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  // Critical for MongoDB + Lambda: without this, Lambda waits for the
  // MongoDB socket (kept open deliberately for connection reuse across
  // warm invocations — see services/db.ts) to go idle before returning
  // the response, adding latency to every single request.
  context.callbackWaitsForEmptyEventLoop = false;

  return serverlessHandler(event, context) as Promise<APIGatewayProxyResult>;
}
