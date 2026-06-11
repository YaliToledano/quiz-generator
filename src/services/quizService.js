// ═══════════════════════════════════════════════════════════════════════
// src/services/quizService.js — Database layer for quizzes
//
// This is the only file in the project that reads from or writes to
// the database. Keeping all DB logic here means:
//   - If you change the schema, you edit one file.
//   - Controllers and other services never write raw SQL.
//
// We use "prepared statements": SQL compiled once when the server starts,
// then reused on every call. Two benefits:
//   1. Faster — the DB doesn't re-parse the SQL string each time.
//   2. Safe — values (the ? placeholders) are passed separately and
//      never interpolated into the SQL string, which prevents SQL injection.
// ═══════════════════════════════════════════════════════════════════════

import { randomUUID } from "crypto";
// ↑ Built into Node — no package needed.
// Generates a unique id like "6d03fe82-3b32-40f6-b59a-fc6ac659fdc0".

import db from "../config/database.js";

// Compile the SQL once at startup. ? marks are placeholders for values.
const insertStmt = db.prepare(
  "INSERT INTO quizzes (id, title, questions_json) VALUES (?, ?, ?)"
);
const selectStmt = db.prepare("SELECT * FROM quizzes WHERE id = ?");

// Saves a new quiz to the database. Returns the generated id.
export function create(title, questions) {
  const id = randomUUID();
  // JSON.stringify turns the JS array into a string for storage in the TEXT column.
  insertStmt.run(id, title, JSON.stringify(questions));
  return id;
}

// Fetches one quiz row by id. Returns null if no row exists with that id.
export function getById(id) {
  const row = selectStmt.get(id); // .get() returns one row object, or undefined
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    questions: JSON.parse(row.questions_json), // String → JS array
    created_at: row.created_at,
  };
}
