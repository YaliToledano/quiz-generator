// ═══════════════════════════════════════════════════════════════════════
// src/middleware/upload.js — File upload configuration
//
// Configures multer, the library that handles multipart/form-data
// (the format browsers use when uploading files).
//
// Two key decisions made here:
//   1. Memory storage: the uploaded file is held in RAM (as file.buffer)
//      rather than saved to disk. Good for files we process immediately
//      and don't need to keep around.
//   2. File filter: reject unsupported file types before they reach the
//      controller, so we fail fast with a clear error message.
// ═══════════════════════════════════════════════════════════════════════

import multer from "multer";

// MIME types are standardised labels browsers attach to files.
// "application/pdf" means PDF; the long string is the official MIME type
// for PowerPoint (.pptx) files.
const allowedMime = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

// fileFilter is called by multer for every incoming file.
// cb (callback) takes (error, acceptFile):
//   cb(null, true)  → accept the file
//   cb(error)       → reject it and pass the error along
function fileFilter(req, file, cb) {
  const name = file.originalname.toLowerCase();
  const okExtension = name.endsWith(".pdf") || name.endsWith(".pptx");

  // We check BOTH the MIME type and the file extension, because browsers
  // sometimes report incorrect MIME types. The extension check is a fallback.
  if (allowedMime.includes(file.mimetype) || okExtension) {
    cb(null, true);
  } else {
    const err = new Error("Only .pdf and .pptx files are allowed");
    err.status = 400;
    cb(err);
  }
}

const upload = multer({
  storage: multer.memoryStorage(),       // File lands in req.file.buffer (RAM)
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // Reject files over 20 MB
});

export default upload;
