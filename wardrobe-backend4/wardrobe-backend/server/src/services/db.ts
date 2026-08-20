// server/src/services/db.ts
//
// MongoDB Atlas connection, written for Lambda's execution model:
// Lambda reuses the same container (and its module-level variables)
// across "warm" invocations, so we cache the connection at module scope
// instead of reconnecting on every request. On a cold start this connects
// once; on warm starts it's instant.
//
// IMPORTANT Lambda setting this depends on: set
//   context.callbackWaitsForEmptyEventLoop = false
// in the Lambda handler (see lambda.ts), otherwise Lambda will wait for
// the idle MongoDB socket to close before returning, adding latency to
// every request.
//
// Requires env var: MONGODB_URI (the Atlas connection string, including
// db name — e.g. mongodb+srv://user:pass@cluster.mongodb.net/wardrobe)

import mongoose from 'mongoose';

// Cache the CONNECTION PROMISE, not just the resolved connection. If two
// requests arrive close together while the first connection is still in
// progress (very possible right after a cold start / server restart),
// caching only the resolved value meant both requests would call
// mongoose.connect() again, racing each other. Caching the promise means
// every concurrent caller awaits the same in-flight connection instead.
let connectionPromise: Promise<typeof mongoose> | null = null;

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!connectionPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI is not set — see .env.example');
    }

    // bufferCommands defaults to true (not overridden here) — mongoose
    // queues any query that arrives before the connection is fully
    // ready and runs it once connected, instead of throwing. Setting
    // this to false was meant to "fail fast" for easier Lambda
    // debugging, but it created a real race: a request arriving in the
    // small window between connectToDatabase() being called and the
    // connection actually finishing could throw instead of just
    // waiting the extra moment. Buffering is the safer default.
    connectionPromise = mongoose.connect(uri, {
      maxPoolSize: 5, // Lambda concurrency means many containers each hold a small pool, not one big pool
    });
  }

  return connectionPromise;
}
