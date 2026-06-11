// ═══════════════════════════════════════════════════════════════════════
// src/config/database.js — Database setup
//
// Opens (or creates) the SQLite database file and ensures our table
// exists. Exports one shared `db` handle that every other file imports.
//
// SQLite is a file-based database: the entire database lives in a single
// file on disk (data/quizzes.db). No separate server process needed —
// just a file you read and write.
//
// better-sqlite3 is synchronous, meaning reads and writes return
// immediately — no async/await needed for database calls.
// ═══════════════════════════════════════════════════════════════════════

import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Build the path to the DB file relative to THIS file's location,
// not the working directory (which changes depending on where you run npm start).
const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "..", "data");
const dbPath = join(dataDir, "quizzes.db");

// Ensure the data/ folder exists before opening the database.
// Git doesn't track empty folders, so on a fresh deploy (e.g. Railway)
// the data/ directory won't exist and better-sqlite3 would crash trying
// to create the file inside a missing folder. recursive:true makes this
// a safe no-op when the folder already exists.
mkdirSync(dataDir, { recursive: true });

// Open the database. If the file doesn't exist yet, better-sqlite3 creates it.
const db = new Database(dbPath);

// Create the quizzes table — IF NOT EXISTS means this is a safe no-op
// if the table already exists. Runs every time the server starts.
db.exec(`
  CREATE TABLE IF NOT EXISTS quizzes (
    id             TEXT PRIMARY KEY,
    title          TEXT NOT NULL,
    questions_json TEXT NOT NULL,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
// Why store questions as TEXT (a JSON string)?
// SQLite has no native array type. We serialize the JS array to a
// JSON string on save, and parse it back into an array on read.
// This is the standard pattern for nested data you always load as a whole.

export default db;
