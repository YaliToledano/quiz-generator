# AI Quiz Generator

Upload a PDF or PowerPoint (.pptx) — the app extracts the text, uses Google Gemini
to generate a multiple-choice quiz, stores it in SQLite, and lets you play it in
the browser or fetch it as a JSON API.

## Tech stack
Node.js · Express · SQLite (better-sqlite3) · Multer · pdf-parse · officeparser ·
Google Gemini (gemini-2.5-flash via @google/generative-ai) · cors ·
vanilla JS + Tailwind CDN

## Setup
1. `npm install`
2. Copy `.env.example` → `.env` and fill in your values:
   - `GOOGLE_API_KEY` — free key from [aistudio.google.com](https://aistudio.google.com) → "Get API key"
   - `MOCK_AI=false` — set to `true` to skip the AI call and use a fake quiz (no key needed)
3. `npm run dev`
4. Open http://localhost:3000

## API
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/quizzes/generate` | Multipart upload, field `file` (.pdf or .pptx). Returns `{ "id": "..." }`. |
| `GET`  | `/api/v1/quizzes/:id`      | Returns the full quiz as JSON. |
| `GET`  | `/api/v1/health`           | Returns `{ "status": "ok" }`. |

CORS is enabled for all origins — any external app can call this API.

## Consumer example
A separate demo app lives in `../quiz-consumer/`. It's a standalone green-themed
page that calls this API over HTTP from a different origin (port 8080).
Run it with:
```
cd ../quiz-consumer
python3 -m http.server 8080
```
Then open http://localhost:8080.

## Folder structure
```
src/
  server.js              entry point
  config/database.js     SQLite setup
  routes/quizzes.js      URL → controller mapping
  controllers/quizController.js
  services/
    parserService.js     PDF / PPTX → text
    aiService.js         text → Gemini → quiz JSON
    quizService.js       insert / fetch from SQLite
  middleware/
    upload.js            multer config
    errorHandler.js      central JSON error responses
public/
  index.html             SPA shell
  js/app.js              dark/violet UI state machine
data/
  quizzes.db             SQLite file (gitignored, created on first run)
```
