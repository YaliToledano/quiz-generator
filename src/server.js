// ═══════════════════════════════════════════════════════════════════════
// src/server.js — Application entry point
//
// This is the first file Node runs when you type `npm run dev`.
// Its only job: wire up the Express app and start listening.
//
// Architecture reminder — every request flows like this:
//   Browser → Middleware → Route → Controller → Service → DB / AI
//   Browser ←─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

import "dotenv/config";
// ↑ Must come first. Reads your .env file and copies its contents into
// process.env so every other import can access secrets via process.env.KEY.

import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Side-effect import: we don't use a return value, but running this file
// opens the database connection and creates the table if it doesn't exist.
import "./config/database.js";

import quizzesRouter from "./routes/quizzes.js";
import { errorHandler } from "./middleware/errorHandler.js";

// ES modules don't have __dirname built in (unlike the older CommonJS style).
// These two lines recreate it from the current file's URL.
const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000; // Use the .env value, or 3000 as a fallback

// ── Middleware stack ───────────────────────────────────────────────────
// Middleware runs on EVERY request before it reaches any route.
// Express processes middleware in the order it's registered — order matters.

app.use(cors());
// ↑ Adds Access-Control-Allow-Origin headers so a webpage served from a
// DIFFERENT origin (e.g. our consumer app on http://localhost:8080) is
// allowed by the browser to call this API. cors() with no options allows
// ALL origins — appropriate for a public, non-authenticated read API like
// this. A private API would restrict it, e.g. cors({ origin: "https://myapp.com" }).

app.use(express.json());
// ↑ Parses incoming JSON request bodies into req.body.
// Without this, req.body is undefined for JSON requests.

app.use(express.static(join(__dirname, "..", "public")));
// ↑ Serves files from the /public folder directly.
// A browser asking for "/" automatically gets public/index.html.
// A browser asking for "/js/app.js" gets public/js/app.js.

// ── Routes ────────────────────────────────────────────────────────────

app.get("/api/v1/health", (req, res) => {
  // A simple "is the server alive?" check — useful for debugging.
  res.json({ status: "ok" });
});

// Mount the quizzes router at this URL prefix.
// Anything starting with /api/v1/quizzes is handled by routes/quizzes.js.
app.use("/api/v1/quizzes", quizzesRouter);

// ── Error handler ─────────────────────────────────────────────────────
// Must be registered LAST. Express identifies error middleware by its
// 4-argument signature (err, req, res, next). When any route calls
// next(err), Express skips all normal middleware and jumps here.
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
