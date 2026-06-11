# AI Quiz Generator

Upload a PDF or PowerPoint (.pptx), and the app extracts the text, uses Claude to
generate a multiple-choice quiz, stores it in SQLite, and lets you play it in the
browser or fetch it as JSON.

## Tech stack
Node.js · Express · SQLite (better-sqlite3) · Multer · pdf-parse · officeparser ·
Anthropic Claude (claude-sonnet-4-6) · vanilla JS + Tailwind (CDN)

## Setup
1. `npm install`
2. Create a `.env` file (copy `.env.example`) and add your Anthropic API key.
3. `npm run dev`
4. Open http://localhost:3000

## API
- `POST /api/v1/quizzes/generate` — multipart/form-data, field `file` (.pdf or
  .pptx). Returns `{ "id": "..." }`.
- `GET /api/v1/quizzes/:id` — returns the quiz as JSON.
