// ═══════════════════════════════════════════════════════════════════════
// src/controllers/quizController.js — HTTP request handlers
//
// Controllers sit between routes and services. Their only job:
//   - Read data from the HTTP request (req.file, req.params, etc.)
//   - Call the appropriate service functions to do the actual work
//   - Send the HTTP response back (res.json, res.status)
//
// Controllers know about HTTP. Services do NOT.
// This separation means: if you wanted to run quiz generation from a
// command-line script (not a web request), you'd call the services
// directly — you'd never involve a controller.
// ═══════════════════════════════════════════════════════════════════════

import { extractText } from "../services/parserService.js";
import { generateQuiz } from "../services/aiService.js";
import * as quizService from "../services/quizService.js";

// Handles: POST /api/v1/quizzes/generate
// Flow: validate → extract text → generate quiz → save → respond with id
export async function generate(req, res, next) {
  try {
    // req.file is populated by the multer middleware that runs before this
    // function (see routes/quizzes.js). If the user sent no file, fail early.
    if (!req.file) {
      const err = new Error("No file uploaded");
      err.status = 400;
      throw err;
    }

    const text = await extractText(req.file);

    // Guard against valid files that contain no readable text
    // (e.g. a scanned-image PDF — we'd need OCR to handle that).
    if (!text || text.trim().length === 0) {
      const err = new Error("Could not extract any text from the file");
      err.status = 422; // 422 Unprocessable Entity — we got the file but can't use it
      throw err;
    }

    const quiz = await generateQuiz(text);
    const id = quizService.create(quiz.title, quiz.questions);

    // 201 Created is the standard success code for "a new resource was made".
    res.status(201).json({ id });
  } catch (err) {
    // Pass errors to the central error handler (errorHandler.js).
    // Never send the error response directly from here.
    next(err);
  }
}

// Handles: GET /api/v1/quizzes/:id
export function getOne(req, res, next) {
  try {
    // req.params.id is captured from the :id placeholder in the route.
    // Example: GET /api/v1/quizzes/abc123 → req.params.id = "abc123"
    const quiz = quizService.getById(req.params.id);

    if (!quiz) {
      const err = new Error("Quiz not found");
      err.status = 404;
      throw err;
    }

    res.json(quiz);
  } catch (err) {
    next(err);
  }
}
