# Wardrobe App — Real Expo App, Wired to Your Backend

This is the actual app, not a test harness — built to match your Figma
(Ara mascot flow + closet management), calling your real backend.

## Before you run it
1. Backend must be running (`cd ../server && npm run dev`)
2. Open `src/api/wardrobeApi.ts`, check `API_BASE_URL`:
   - iOS Simulator: `http://localhost:4000/api` works as-is
   - Physical phone (Expo Go): change to your computer's LAN IP, e.g. `http://192.168.1.42:4000/api`
   - Android Emulator: use `http://10.0.2.2:4000/api`

## Run it
```
npm install
npx expo start
```
Scan the QR with Expo Go, or press `a`/`i` for an emulator.

## Flow to test
1. Phone number → Send code → check backend terminal for OTP → verify
2. Home shows your real stats
3. Closet → + Add → photo, category, color → Save
4. Ara tab → occasion → mood → real generated outfit + story
5. Outfits → + Create → build one from your items
6. Chat tab → talk to Ara

## Not yet built as UI (backend ready for all of these)
AR Try-On / Smart Mirror, 3D Orbit View, background-removal retry button.

## Just added
- **Outfit item carousel**: the outfit result screen now shows real item
  thumbnails (photo if you uploaded one, colored+emoji card otherwise),
  not just a count
- **S7 Discover grid**: category tabs (All/Casual/Date Night/Work),
  Shuffle, Save this look
- **S8 Drag Studio**: tap a slot (Top/Bottom/Shoes/Bag), pick a
  replacement from your closet, save the mix — note this is tap-to-swap,
  not true drag-gesture reordering, since `react-native-gesture-handler`
  isn't in this project's dependencies yet. Same functional outcome
  (mixing items into an outfit interactively), different interaction
  style. Say the word if you want real drag gestures added — it's one
  more dependency plus a rewrite of this screen's interaction.
- **Chat suggestion pills**: quick-tap common questions above the input
- Reasoning steps on the outfit story screen now render as colorful tags
  instead of a plain bullet list
