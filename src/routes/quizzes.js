// ═══════════════════════════════════════════════════════════════════════
// src/routes/quizzes.js — URL routing for /api/v1/quizzes
//
// A Router is a mini Express app that groups related URL paths together.
// This file answers one question: "which URL maps to which function?"
// All the logic lives in the controller; all the file handling lives
// in the upload middleware.
//
// This router is mounted in server.js with:
//   app.use("/api/v1/quizzes", quizzesRouter)
//
// That prefix is prepended to every path defined below, so:
//   "/generate"  becomes  "/api/v1/quizzes/generate"
//   "/:id"       becomes  "/api/v1/quizzes/:id"
// ═══════════════════════════════════════════════════════════════════════

import { Router } from "express";
import upload from "../middleware/upload.js";
import * as quizController from "../controllers/quizController.js";

const router = Router();

// POST /api/v1/quizzes/generate
// Two middleware functions run in sequence before the controller:
//   1. upload.single("file") — multer parses the multipart request body,
//      validates the file type and size, and puts the file on req.file.
//      "file" must match the field name used in the browser's FormData.
//   2. quizController.generate — reads req.file and does the actual work.
router.post("/generate", upload.single("file"), quizController.generate);

// GET /api/v1/quizzes/:id
// :id is a URL parameter — any value after the slash becomes req.params.id.
router.get("/:id", quizController.getOne);

export default router;
