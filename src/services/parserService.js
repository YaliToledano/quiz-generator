// ═══════════════════════════════════════════════════════════════════════
// src/services/parserService.js — File text extraction
//
// Turns an uploaded file's raw bytes (a Buffer) into a plain text string.
// The AI service receives this text and generates quiz questions from it.
//
// We support two file types:
//   .pdf  → extracted with the pdf-parse library (v2, class-based API)
//   .pptx → extracted with the officeparser library
//
// Both libraries work entirely locally — no network calls, no cost.
// ═══════════════════════════════════════════════════════════════════════

import { PDFParse } from "pdf-parse";
import officeParser from "officeparser";

// file is the multer file object: { originalname, buffer, mimetype, ... }
export async function extractText(file) {
  // Lowercase the filename so ".PDF" and ".pdf" are treated the same.
  const name = file.originalname.toLowerCase();

  if (name.endsWith(".pdf")) {
    // PDFParse accepts the raw file bytes (Buffer) directly —
    // no need to save the file to disk first.
    const parser = new PDFParse({ data: file.buffer });
    try {
      const result = await parser.getText();
      return result.text; // One long string of all the text in the PDF
    } finally {
      // destroy() frees the memory the parser was using.
      // The `finally` block runs whether getText() succeeded or threw an error.
      await parser.destroy();
    }
  }

  if (name.endsWith(".pptx")) {
    // officeparser also accepts a Buffer.
    // Returns all slide text concatenated into one string.
    return await officeParser.parseOfficeAsync(file.buffer);
  }

  // If we reach here, the file slipped past the upload filter somehow.
  // Attach a status code so errorHandler sends the right HTTP status.
  const err = new Error("Unsupported file type");
  err.status = 400;
  throw err;
}
