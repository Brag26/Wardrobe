# Test Client

A single HTML file that lets you click through the backend instead of
typing curl/Postman requests by hand. **This is not the final app
design** — no Figma styling, just a functional dashboard for testing.

## How to use

1. Make sure the backend is running (`cd server && npm run dev`)
2. Double-click `index.html` to open it in your browser (no server or
   build step needed — it's a plain static file)
3. It auto-checks `/health` on load — should show green/`{"ok":true}`
4. Go through the tabs in order:
   - **Auth**: request an OTP (code prints in your backend's terminal),
     then verify it — this stores your token in the browser automatically
   - **Home**: closet overview stats, Today's Pick, expense breakdown
   - **Closet**: add items (no real photo needed for testing), see them
     as cards, favorite/bin them
   - **Outfits**: create an outfit from item IDs (copy them from the
     Closet tab's item cards), see outfit categories
   - **Ara Styling**: pick an occasion + mood, generate an AI outfit;
     try Discover and Shuffle too
   - **Chat**: talk to Ara, see the conversation

## If it doesn't connect

- Confirm the API base URL at the top of the Auth tab matches where
  your backend is actually running (default: `http://localhost:4000/api`)
- CORS is already enabled on the backend, so opening this HTML file
  directly (via `file://`) works fine — no need to serve it through a
  web server

## This is a test harness, not a deliverable

Skip straight to a real frontend (React Native / the actual Figma
screens) when you're ready — this file's only job is letting you see
the backend work without typing requests by hand.
