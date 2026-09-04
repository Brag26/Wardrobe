# How to test this backend locally (before touching AWS deployment)

You don't need AWS Lambda deployed, or even a real AWS account fully
set up, to test most of this. Here's the fastest path.

## 1. Get MongoDB Atlas running (5 minutes, free)

1. Go to https://www.mongodb.com/cloud/atlas/register, make a free account
2. Create a free "M0" cluster (no credit card needed)
3. Database Access → add a user with a password
4. Network Access → add IP `0.0.0.0/0` (allow from anywhere — fine for testing, tighten before production)
5. Database → Connect → Drivers → copy the connection string, looks like:
   `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/`
6. Add `/wardrobe` on the end (that becomes your database name):
   `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/wardrobe`

## 2. Get an S3 bucket (5 minutes)

1. AWS Console → S3 → Create bucket, any name (must be globally unique), any region
2. Leave "Block all public access" ON (we use presigned URLs, not public files)
3. Note the bucket name and region

## 3. Configure the backend

```
cd server
cp .env.example .env
```
Open `.env` and fill in:
```
MONGODB_URI=mongodb+srv://...   (from step 1)
JWT_SECRET=<run: openssl rand -hex 32>
AWS_REGION=<your S3 bucket's region, e.g. us-east-1>
AWS_S3_BUCKET=<your bucket name>
AWS_ACCESS_KEY_ID=<your AWS access key>
AWS_SECRET_ACCESS_KEY=<your AWS secret key>
SEND_REAL_SMS=false
```
`SEND_REAL_SMS=false` is important for testing — it makes the OTP code
print in your terminal instead of sending a real text message, so you
don't need SNS set up yet.

## 4. Install and run

```
npm install
npm run dev
```
You should see it start on `http://localhost:4000`. Test it's alive:
```
curl http://localhost:4000/health
```
Should return `{"ok":true}`.

## 5. Walk through the full flow with curl

**Request an OTP:**
```
curl -X POST http://localhost:4000/api/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"+919876543210"}'
```
Check your terminal running `npm run dev` — you'll see:
```
[DEV OTP] Code for +919876543210: 482913
```

**Verify it (use the code from your terminal):**
```
curl -X POST http://localhost:4000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"+919876543210","code":"482913"}'
```
This returns `{ "token": "...", "user": {...} }`. **Copy that token** —
you need it for every request below.

**Save the token as a variable** (makes the rest easier):
```
TOKEN="paste-the-token-here"
```

**Check the closet overview (should be all zeros — nothing added yet):**
```
curl http://localhost:4000/api/closet/overview \
  -H "Authorization: Bearer $TOKEN"
```

**Get a presigned upload URL:**
```
curl -X POST http://localhost:4000/api/wardrobe/upload-url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fileExtension":"jpg"}'
```
This returns `{ itemId, key, uploadUrl, imageUrl }`. In a real app the
client PUTs an actual photo to `uploadUrl`; for a quick backend-only
test you can skip the real photo and just save the item with the `key`
you got back:

**Save the item:**
```
curl -X POST http://localhost:4000/api/wardrobe/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "itemId": "paste-itemId-from-above",
    "s3Key": "paste-key-from-above",
    "category": "top",
    "color": "black"
  }'
```

**List your items — you should now see the one you just added:**
```
curl http://localhost:4000/api/wardrobe/items \
  -H "Authorization: Bearer $TOKEN"
```

**Try the Ara styling flow:**
```
curl -X POST http://localhost:4000/api/styling-sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"occasion":"date","mood":"confident"}'
```
Copy the `id` it returns, then:
```
curl -X POST http://localhost:4000/api/styling-sessions/PASTE_SESSION_ID/generate \
  -H "Authorization: Bearer $TOKEN"
```
This should return an outfit built from your closet, with a generated
"story" (using the fallback templates, since no AI provider key is set
yet).

## 6. Easier than curl: use Postman or the VS Code REST Client

If typing curl commands is tedious, either:
- Import these as a **Postman collection** (I can generate one if useful — just ask)
- Or install the **"REST Client"** extension in VS Code and create a
  `.http` file where you can click "Send Request" above each call

## 7. What you can't fully test locally yet

- **Real SMS delivery** — until `SEND_REAL_SMS=true` and SNS production
  access is requested, OTPs only appear in your terminal, not on a phone
- **Background removal** — defaults to `BG_REMOVAL_PROVIDER=none`, which
  just copies the photo instead of actually removing the background,
  until you add a remove.bg/Clipdrop API key
- **Real AI-generated outfit stories/chat** — falls back to canned
  templates until `AI_PROVIDER_API_KEY` is set
- **Lambda-specific behavior** (cold starts, timeout limits) — only
  shows up once actually deployed with `npm run deploy`

Everything else — the full data flow, auth, item/outfit CRUD, filters,
bin/restore, favorites — works exactly the same locally as it will once
deployed.
