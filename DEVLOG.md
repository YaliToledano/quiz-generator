# Dev Log

## 2026-06-11 — Session 1: Build

- Set up folder structure and package.json (ES modules, `"type": "module"`).
- Confirmed Node v24.1.0 / npm 11.3.0.
- Installed all backend dependencies (Express, better-sqlite3, multer, pdf-parse,
  officeparser, @anthropic-ai/sdk, dotenv — 170 packages, 0 vulnerabilities).
- Created all source files: database, services, middleware, controllers, routes, server.
- Created dark/violet frontend (Tailwind CDN, vanilla JS state machine, no framework).
- Created all documentation files.

## 2026-06-11 — Session 2: Fix, Switch AI, Style

- **pdf-parse v2 fix:** installed version was v2.4.5 (class-based API), not v1.x.
  Updated parserService.js to use `new PDFParse({ data: buffer })` → `.getText()`.
- **Switched AI from Anthropic to Google Gemini** (free tier, no credit card):
  - Installed `@google/generative-ai`.
  - Rewrote `aiService.js` to use `gemini-2.5-flash` with structured output
    (`responseMimeType: "application/json"` + `responseSchema`).
  - Added `MOCK_AI` env var (set to "true" skips real AI call; useful for testing).
  - Env var is now `GOOGLE_API_KEY` (from aistudio.google.com).
- **Added educational comments** to every source file — explains WHY, not just WHAT.
- **Restyled UI** to dark navy + violet gradient (matches reference design screenshot).
- **Verified end-to-end:** uploaded Hebrew LP exercise PDF; Gemini returned 9 real
  questions in Hebrew about linear programming.

## 2026-06-11 — Session 3: API, Git, Consumer

- **CORS added:** installed `cors` package; added `app.use(cors())` to server.js.
  All origins now allowed — any external app can call the API.
- **Deploy prep:** added `mkdirSync(dataDir, { recursive: true })` to database.js
  so the data/ folder is created at boot (git doesn't track empty folders; this
  prevents a crash on fresh Railway/Render deploys).
- **Git initialised:** first commit at `github.com/YaliToledano/quiz-generator`.
- **Consumer app built** at `../quiz-consumer/` (sibling folder, not in this repo):
  - Separate GfG-green styled page (plain CSS, no Tailwind).
  - Uses `innerHTML` + template literals (vs this app's `createElement` approach).
  - Full flow: upload → POST /generate → GET /:id → display.
  - Display mode: all questions visible at once; answers hidden until clicked
    (green = correct, red = wrong choice); locks each question after answering.
  - Served on port 8080 via `python3 -m http.server 8080`.
  - Proves cross-origin API consumption — the browser calls localhost:3000 from
    a page served at localhost:8080, and CORS headers allow it.
- **Updated all .md files** to reflect current state.

## NEXT
- Deploy to Railway: `npm start` script is ready; PORT env var already handled.
  Add GOOGLE_API_KEY + MOCK_AI=false in Railway dashboard. Generate domain.
- After deploy: update `API_BASE` in quiz-consumer/app.js to the Railway URL.
- Optional future features: hash-based deduplication (same PDF → return cached quiz),
  Railway persistent volume for SQLite, quiz listing endpoint.
