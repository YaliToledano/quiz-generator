// ═══════════════════════════════════════════════════════════════════════
// src/middleware/errorHandler.js — Central error handler
//
// When any route or middleware calls next(err), Express routes the error
// here instead of to the next normal middleware.
//
// Having one place to handle all errors means:
//   - Every error becomes a consistent JSON response.
//   - You never accidentally leak a stack trace to the client.
//   - The "turn an error into a response" logic is written once.
//
// Why 4 arguments?
// Express identifies error-handling middleware by its signature.
// If this function only had 3 arguments, Express would treat it as a
// normal route handler and error handling would silently break.
// ═══════════════════════════════════════════════════════════════════════

export function errorHandler(err, req, res, next) {
  // Multer (the upload library) throws its own error type "MulterError"
  // (e.g. file too large). We give those a 400 Bad Request status.
  // Other errors use their own .status, or 500 if nothing was set.
  const status = err.status || (err.name === "MulterError" ? 400 : 500);
  const message = err.message || "Internal server error";

  // Always respond with JSON so the client (browser or curl) can reliably
  // parse the error, regardless of whether it's a 400 or 500.
  res.status(status).json({ error: message });
}
