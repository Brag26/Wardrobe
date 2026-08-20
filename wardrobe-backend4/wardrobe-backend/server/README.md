# AI Wardrobe Backend — MongoDB Atlas + S3 + SNS + Lambda

Backend only, no UI. Matches the real production architecture you
shared (Monolith Express app, MongoDB Atlas, S3, SNS OTP, JWT auth) —
**migrated from EC2 to Lambda** as requested, with everything else kept

## Production config (confirmed by the team, 31 July)

| Setting | Value |
|---|---|
| MongoDB Atlas | M0 Free cluster |
| AWS Account | 720374066183 |
| AWS Region | `ap-south-1` (Mumbai) |
| S3 Bucket | `superbae-media` |
| JWT Secret | AWS Secrets Manager (not a plain env var — see `services/secrets.ts`) |
| SNS Production Access | Pending — OTPs stay in dev/console-log mode until this clears |
| OTP Rate Limit | 1 request per 60 seconds, max 5 per hour, per phone (enforced in `services/otp.service.ts`) |
| Bin Retention | 30 days — auto-permanent-delete via the `binCleanup` scheduled Lambda |

the same on purpose, to minimize what actually changes in this move.

## What changed vs. what stayed (EC2 → Lambda migration)

| Aspect | Before (EC2) | Now (Lambda) |
|---|---|---|
| Compute | Single Node/Express on EC2 (t3.micro) via PM2 | Lambda function running the *same* Express app via `serverless-http` |
| API entry | Nginx reverse proxy + Let's Encrypt/certbot | API Gateway (managed TLS, no certbot renewal) |
| DNS | Registrar A-record → Elastic IP | Point your domain at the API Gateway custom domain (or CloudFront in front of it) instead |
| Long-running jobs | `node-cron` on the EC2 box | EventBridge scheduled rule → a separate Lambda (`backup.lambda.ts`) |
| Scaling | Vertical (bigger EC2) | Automatic (Lambda scales per-request) |
| Deployment | git push → CI/CD auto-deploy to EC2 | `npm run deploy` (Serverless Framework) → CI/CD can call the same command |
| **Database** | MongoDB Atlas | **Unchanged** — MongoDB Atlas |
| **File storage** | Amazon S3 (presigned uploads) | **Unchanged** |
| **SMS/OTP** | Amazon SNS | **Unchanged** |
| **Auth** | Phone OTP → backend JWT | **Unchanged** |
| **Monitoring** | Sentry + CloudWatch/PM2 logs | Sentry (add the Lambda SDK integration) + CloudWatch Logs (automatic with Lambda, no PM2 needed) |
| **Backups** | Nightly `mongodump` → S3 via cron | Nightly JSON export → S3 via EventBridge + Lambda (see note in `backup.lambda.ts` on why this isn't literally `mongodump`) |

Routes, controllers, and business logic **did not need to change** for
this migration — only `lambda.ts` (new) and `infra/serverless.yml` (new)
were added. `server.ts` still works for local dev exactly as before.

## Folder structure

```
server/
  src/
    app.ts                    Express app — same file for local dev AND Lambda
    server.ts                 Local dev entrypoint (npm run dev)
    lambda.ts                 Lambda entrypoint (wraps app.ts with serverless-http)
    backup.lambda.ts          Scheduled nightly backup (replaces node-cron)
    middleware/auth.ts         Verifies our own JWT (phone OTP login)
    models/schemas.ts          Mongoose schemas (MongoDB Atlas)
    services/
      db.ts                   MongoDB connection (Lambda-aware, connection reuse)
      mongodb.service.ts       All data access
      s3.service.ts            Presigned uploads, bulk uploads, background removal
      otp.service.ts           SNS SMS + hashed-code verification
      aiStylist.service.ts     Outfit picking, reasoning, story generation, chat replies
    controllers/                One per feature area (see routes below)
    routes/
    types/domain.ts             Shared TypeScript types
  infra/serverless.yml          Deployment config (Lambda + API Gateway + EventBridge)
  .env.example
```

## API routes (grouped by Figma screen)

**Auth (no token required)**
- `POST /api/auth/request-otp` `{ phone }` → sends SMS via SNS. Rate limited: 1/60s, max 5/hour per phone — returns `429` with `retryAfterSeconds` if exceeded.
- `POST /api/auth/verify-otp` `{ phone, code }` → returns `{ token, user }`

## Decisions confirmed with the team

- **Background removal**: remove.bg (`BG_REMOVAL_PROVIDER=removebg` in `.env`, add your key)
- **AI provider**: GLM-5.2 via NVIDIA NIM (already the default, add your key)
- **Custom outfit categories**: per-user dynamic tabs — system categories (Casual/Formal/Business/Evening Wear/Sport) always show first, then each user's own custom categories they've created, fetched via `GET /api/outfits/categories`
- **"Today's Pick by Ara"**: real daily-rotating pick, generated once per calendar day and cached (`GET /api/looks/daily-pick`) — doesn't reshuffle on every screen visit, same pick all day
- **Color/style/season vocabulary**: no locked list. Values are free text that grows from what the AI suggests and what users type in. `GET /api/wardrobe/items/attribute-suggestions` returns a seed list merged with whatever this user has actually used before, for autocomplete
- **Item category**: same treatment — the Details screen's own "+Add" button next to the category picker means item categories are free text too, not just outfit categories. Same suggestions endpoint now returns `categories` alongside `colors`/`styles`/`seasons`

**Closet (Home overview, Favorites, Expenses)**
- `GET /api/closet/overview` → item/outfit/favorite counts for the stat cards
- `GET /api/closet/expenses` → S5's "Expense by Category" budget breakdown
- `GET /api/closet/favorites/items`
- `GET /api/closet/favorites/outfits`

**Wardrobe Items (Closet screen, Add Items, Details, Bin, Filter)**
- `POST /api/wardrobe/upload-url` → one presigned S3 upload URL
- `POST /api/wardrobe/upload-urls` `{ count }` → bulk presigned URLs
- `POST /api/wardrobe/items` → save item metadata after direct S3 upload (kicks off background removal)
- `POST /api/wardrobe/items/bulk` → same, for multiple items at once
- `GET /api/wardrobe/items?category=&color=&season=&style=&favoritesOnly=&search=`
- `GET /api/wardrobe/items/attribute-suggestions` → color/style/season autocomplete (seed list + this user's own past entries)
- `GET /api/wardrobe/items/bin` → soft-deleted items
- `GET /api/wardrobe/items/:id`
- `PATCH /api/wardrobe/items/:id` → Details screen save (name, color, rating, brand, price, size, material, etc.)
- `POST /api/wardrobe/items/:id/worn`
- `POST /api/wardrobe/items/:id/favorite`
- `POST /api/wardrobe/items/:id/retry-background-removal` → "Upload Failed — Retry" button
- `DELETE /api/wardrobe/items/:id` → move to Bin (soft delete)
- `POST /api/wardrobe/items/:id/restore`
- `DELETE /api/wardrobe/items/:id/permanent` → Bin's "cannot be recovered" delete

**Outfits (Create Outfit, My Outfits tabs, Outfit detail)**
- `GET /api/outfits/categories` → system + this user's custom categories, for the tab bar
- `GET /api/outfits?category=casual|formal|business|evening_wear|sport|<custom>|all`
- `POST /api/outfits` → "Create Outfit" screen's final Upload
- `GET /api/outfits/:id` → resolved with full item objects, not just ids
- `PATCH /api/outfits/:id`
- `DELETE /api/outfits/:id`
- `POST /api/outfits/:id/favorite`

**Ara styling flow (S2–S6)**
- `POST /api/styling-sessions` `{ occasion, mood }`
- `POST /api/styling-sessions/:id/generate` → runs AI picking + reasoning + story
- `GET /api/styling-sessions/:id`

**Discover / Shuffle / Drag Studio (S7–S8) + Daily Pick**
- `GET /api/looks/daily-pick` → "Today's Pick by Ara", cached once per day
- `GET /api/looks/discover?category=`
- `POST /api/looks/shuffle`
- `POST /api/looks/manual` (Drag Studio quick-save)

**Chat (Ara)**
- `GET /api/chat/history`
- `POST /api/chat/message`

## Setting up AWS access (do this before `npm run deploy`)

**1. Create the JWT secret in Secrets Manager:**
- AWS Console → Secrets Manager → Store a new secret → "Other type of secret"
- Key/value pair: key `JWT_SECRET`, value = a random string (e.g. `openssl rand -hex 32` output)
- Name it something like `wardrobe-jwt-secret`
- Copy the resulting ARN into `JWT_SECRET_ARN` in your deploy environment

**2. Create the deployment IAM role/user** (this is what gets shared with the team once created, per the "share the creds" request):
- AWS Console → IAM → Users → Create user (e.g. `wardrobe-deployer`)
- Attach permissions for: CloudFormation, Lambda, API Gateway, IAM (to create the function's own execution role), S3, EventBridge, CloudWatch Logs — or attach `AdministratorAccess` short-term for the first deploy and scope it down afterward once everything's confirmed working
- Security credentials tab → Create access key → choose "Command Line Interface (CLI)"
- **This is the Access Key ID + Secret Access Key to share with the team** — never paste these in chat/Slack in plaintext if avoidable; use a password manager's secure share feature or AWS's own IAM Identity Center if the team has it set up
- Locally: `aws configure` and paste them in, or export as env vars before running `npm run deploy`

**3. Confirm S3 bucket exists**: `superbae-media` in `ap-south-1` — if not created yet, AWS Console → S3 → Create bucket → name it exactly `superbae-media`, region Mumbai (`ap-south-1`).

## Setup

1. **MongoDB Atlas**: create a free cluster, get the connection string, put it in `MONGODB_URI`.
2. **AWS**: create an S3 bucket, note the region — put both in `.env`.
3. **JWT_SECRET**: generate with `openssl rand -hex 32`.
4. **SNS**: no setup needed beyond IAM permission (already in `infra/serverless.yml`) — SNS SMS works out of the box in most AWS accounts, though brand-new accounts may start in "SMS sandbox" mode (only verified numbers can receive texts) until you request production access in the SNS console.
5. Copy `.env.example` → `.env`, fill in the values above.
6. `cd server && npm install`
7. Local dev: `npm run dev` (runs on `http://localhost:4000`)
8. Deploy to Lambda: `npm run deploy` (needs AWS credentials configured via `aws configure` first)

## Things a human still needs to decide/configure

- **Background removal provider**: currently defaults to `none` (just copies the photo). Get a `remove.bg` or Clipdrop API key to make this real — see `s3.service.ts`.
- **AI provider for Ara's chat/story generation**: currently falls back to canned templates if `AI_PROVIDER_API_KEY` is blank. Wire up GLM-5.2 (NVIDIA NIM) or whichever provider the team picks — see `aiStylist.service.ts`.
- **SNS production access**: request it in the AWS console before launch, or OTP SMS will silently fail for any number not manually verified in the sandbox.
- **API Gateway custom domain + DNS**: point your existing domain at the deployed API Gateway endpoint (replaces the old A-record → Elastic IP setup).
