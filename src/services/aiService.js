// ═══════════════════════════════════════════════════════════════════════
// src/services/aiService.js — AI quiz generation via Google Gemini
//
// Sends the extracted document text to Gemini and gets back a structured
// quiz object. This is the only file that calls an external AI API.
//
// Key technique: structured output.
// Instead of asking the AI to "please return JSON" (which can fail or
// return malformed JSON), we pass a schema that describes exactly the
// shape we want. Gemini guarantees its response matches that schema.
//
// To get a free API key: aistudio.google.com → "Get API key"
// Add it to .env as: GOOGLE_API_KEY=your-key-here
// ═══════════════════════════════════════════════════════════════════════

import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the SDK with your API key from .env.
// The key is read from process.env.GOOGLE_API_KEY — never hardcoded here.
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// ── Schema ────────────────────────────────────────────────────────────
// This describes the exact shape of JSON we want back from Gemini.
// Note: Gemini uses uppercase type names (STRING, INTEGER, ARRAY, OBJECT)
// unlike standard JSON Schema which uses lowercase.
const quizSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          question:     { type: "STRING" },
          options:      { type: "ARRAY", items: { type: "STRING" } },
          correctIndex: { type: "INTEGER" },
          // correctIndex is zero-based: 0 = first option, 1 = second, etc.
        },
        required: ["question", "options", "correctIndex"],
      },
    },
  },
  required: ["title", "questions"],
};

// Build the model once at startup so it's reused across requests.
// gemini-2.5-flash is free-tier eligible and fast.
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  systemInstruction:
    "You are a quiz generator. From the provided document text, create a " +
    "multiple-choice quiz. Write a concise quiz title and between 5 and 10 " +
    "questions. Each question must have exactly 4 options and exactly one " +
    "correct answer. correctIndex is the zero-based index of the correct " +
    "option in the options array. Base every question only on the document content.",
  generationConfig: {
    responseMimeType: "application/json", // Tell Gemini: respond with JSON
    responseSchema: quizSchema,           // Tell Gemini: the JSON must match this shape
  },
});

// ── Mock mode ─────────────────────────────────────────────────────────
// When MOCK_AI=true in .env, we skip the real API call entirely.
// Useful for testing the rest of the pipeline (upload, parse, DB,
// browser UI) without needing an API key or spending quota.
//
// The mock quiz includes the real word count from your file to prove
// the upload and parsing steps actually ran.
function buildMockQuiz(text) {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return {
    title: "Sample Quiz (Mock Mode — no AI was called)",
    questions: [
      {
        question: `Mock mode is on. The real pipeline ran: your file had ~${wordCount} words. Which step was skipped?`,
        options: ["The file upload", "The text extraction", "The call to Gemini", "Saving to the database"],
        correctIndex: 2,
      },
      {
        question: "What does passing this test prove?",
        options: [
          "That upload, parsing, storage, and the browser game all work",
          "That the AI wrote good questions",
          "Nothing at all",
          "That billing is set up",
        ],
        correctIndex: 0,
      },
      {
        question: "How do you switch to real AI-generated questions?",
        options: [
          "Reinstall everything",
          "Set MOCK_AI=false and add a real GOOGLE_API_KEY in .env",
          "Delete the database",
          "Nothing, it is automatic",
        ],
        correctIndex: 1,
      },
    ],
  };
}

// ── Main export ────────────────────────────────────────────────────────
// Takes the plain text extracted from the uploaded file.
// Returns a quiz object: { title, questions: [{question, options, correctIndex}] }
export async function generateQuiz(text) {
  if (process.env.MOCK_AI === "true") {
    return buildMockQuiz(text);
  }

  // Send the document text to Gemini.
  // The system instruction (persona + rules) is set at model-build time above.
  const result = await model.generateContent(
    `Document text:\n\n${text}`
  );

  // result.response.text() returns the guaranteed-valid JSON string.
  // JSON.parse converts it into a real JavaScript object.
  return JSON.parse(result.response.text());
}
