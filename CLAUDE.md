# Project: AI Quiz Generator

A learning project to understand the canonical full-stack web workflow.

## What it does
Upload PDF/.pptx → extract text → Google Gemini generates a multiple-choice quiz
(structured JSON output) → store in SQLite → serve via dark/violet web UI + public JSON API.

## Architecture (layered)
routes → controllers → services. Controllers handle HTTP; services
(parser / ai / quiz) do the work and know nothing about HTTP.

## Stack
Node.js + Express, better-sqlite3, multer, pdf-parse (v2, class-based API),
officeparser, @google/generative-ai (gemini-2.5-flash), cors,
vanilla JS + Tailwind CDN. ES modules throughout.

## Conventions
- Comments in every file (educational project — explain WHY, not just WHAT).
- No frontend framework, no bundler.
- Secrets only in .env (gitignored). Never hardcode keys.

## Endpoints
- POST /api/v1/quizzes/generate — multipart/form-data, field `file` (.pdf or .pptx) → { id }
- GET  /api/v1/quizzes/:id     — returns full quiz JSON with parsed questions array
- GET  /api/v1/health          — { status: "ok" }

## CORS
app.use(cors()) is in server.js — all origins allowed (public API).
To restrict: cors({ origin: "https://yourapp.com" }).

## DB schema
quizzes(id TEXT PK, title TEXT, questions_json TEXT, created_at DATETIME)
questions_json is a serialised JS array; parsed back to array on read in quizService.js.

## Environment variables (.env)
GOOGLE_API_KEY=...   ← free key from aistudio.google.com
MOCK_AI=false        ← set to "true" to skip the real AI call (returns a fake quiz)
PORT=3000

## Run
npm run dev → http://localhost:3000   (node --watch auto-restarts on file changes)
npm start   → production (no watch)

## Known gotchas
- pdf-parse v2 uses class-based API: `new PDFParse({ data: buffer })` → `.getText()` → `.text`
  (the old `pdfParse(buffer)` function from v1 no longer exists)
- data/ folder is created at boot by mkdirSync (git doesn't track empty folders)
- .env changes do NOT trigger --watch restart; must kill and re-run manually

## Related projects
- quiz-consumer/ (sibling folder, NOT in this repo) — separate GfG-green consumer
  app that calls this API over HTTP. Served on port 8080 with python3 -m http.server 8080.
  Demonstrates cross-origin API consumption.

## Git / GitHub
- Repo: https://github.com/YaliToledano/quiz-generator
- Main branch: main
- CORS package (cors) added; push to GitHub before deploying.
