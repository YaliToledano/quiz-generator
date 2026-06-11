# Project: AI Quiz Generator

A learning project to understand the canonical full-stack web workflow.

## What it does
Upload PDF/.pptx → extract text → Claude generates a multiple-choice quiz
(structured JSON) → store in SQLite → serve via web UI + public JSON API.

## Architecture (layered)
routes → controllers → services. Controllers handle HTTP; services
(parser/ai/quiz) do the work and know nothing about HTTP.

## Stack
Node + Express, better-sqlite3, multer, pdf-parse, officeparser,
@anthropic-ai/sdk (claude-sonnet-4-6), vanilla JS + Tailwind CDN. ES modules.

## Conventions
- NO comments in code files. Use clear names; explanation lives in docs.
- No frontend framework, no bundler.
- Secrets only in .env (gitignored).

## Endpoints
- POST /api/v1/quizzes/generate (multipart file → { id })
- GET  /api/v1/quizzes/:id (→ quiz JSON)

## DB schema
quizzes(id TEXT PK, title TEXT, questions_json TEXT, created_at DATETIME)

## Run
npm run dev → http://localhost:3000
