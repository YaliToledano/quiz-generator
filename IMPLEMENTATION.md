# Implementation Guide — AI Quiz Generator

This is the complete build script. Each step has the **command or file**, an
**explanation first**, and what to expect. Follow top to bottom. The execution
session (Sonnet) should: explain each command before running it, create files
exactly as written, and pause for approval on anything that installs, deletes,
or sends data over the network.

**Rule from the user:** explanation comes *before* every command, never after.

---

## Status so far (already done)

- ✅ Folder structure created under `coding_for_fun/quiz-generator/`.
- ✅ `package.json` created (`type: module`, scripts `start` and `dev`).
- ✅ Node v24.1.0 / npm 11.3.0 confirmed.
- ⏭️ Next: install dependencies, then create all source + doc files.

---

## Step 1 — Install dependencies

**Command:**
```
npm install express better-sqlite3 multer pdf-parse officeparser @anthropic-ai/sdk dotenv
```
**Explain before running:** Downloads 7 libraries into a project-local
`node_modules/` folder (not global — only this project sees them) and records
them in `package.json`. Needs internet. Creates `package-lock.json`. Reversible
by deleting `node_modules/`. `better-sqlite3` compiles a native part, so it may
take ~30–60s.

| Package | Role |
|---|---|
| express | web server + routing |
| better-sqlite3 | SQLite database access |
| multer | file uploads |
| pdf-parse | extract text from PDF |
| officeparser | extract text from .pptx |
| @anthropic-ai/sdk | call Claude |
| dotenv | load API key from .env |

After it finishes, optionally run `du -sh node_modules` to see the size.

---

## Step 2 — Create the support files

### `.gitignore`
**Explain:** Tells git to never track these (secrets, the rebuildable cache, the
DB file). Plain text, no command.
```
node_modules/
.env
data/*.db
```

### `.env.example`
**Explain:** A safe-to-share template showing which secrets the app needs. The
real `.env` (with the actual key) is never committed.
```
ANTHROPIC_API_KEY=your-anthropic-api-key-here
PORT=3000
```

### `.env` (the real one — user must add their key)
**Explain before creating:** Holds the secret Claude API key. Listed in
`.gitignore` so it never leaves the machine. The user pastes their real key
here. Ask the user for it, or have them create the file themselves.
```
ANTHROPIC_API_KEY=sk-ant-...
PORT=3000
```

---

## Step 3 — Backend source files

> All code files contain **no comments** (per spec). Names carry the meaning.

### `src/config/database.js`
**Explain:** Opens (or creates) the SQLite file and ensures the `quizzes` table
exists. Exports one shared `db` handle the rest of the app imports.
```js
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "..", "..", "data", "quizzes.db");

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS quizzes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    questions_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export default db;
```

### `src/services/quizService.js`
**Explain:** The database layer. `create` inserts a quiz (stringifying the
questions array) and returns a new UUID; `getById` reads one row and parses the
JSON back into a real array. Uses prepared statements (compiled once, reused).
```js
import { randomUUID } from "crypto";
import db from "../config/database.js";

const insertStmt = db.prepare(
  "INSERT INTO quizzes (id, title, questions_json) VALUES (?, ?, ?)"
);
const selectStmt = db.prepare("SELECT * FROM quizzes WHERE id = ?");

export function create(title, questions) {
  const id = randomUUID();
  insertStmt.run(id, title, JSON.stringify(questions));
  return id;
}

export function getById(id) {
  const row = selectStmt.get(id);
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    questions: JSON.parse(row.questions_json),
    created_at: row.created_at,
  };
}
```

### `src/services/parserService.js`
**Explain:** Turns an uploaded file's bytes into plain text. Branches on the
file extension: `pdf-parse` for PDFs, `officeparser` for `.pptx`.
**Important:** import pdf-parse from its `lib/` path — importing the package
root runs debug code that crashes on load. This is the standard workaround.
```js
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import officeParser from "officeparser";

export async function extractText(file) {
  const name = file.originalname.toLowerCase();
  if (name.endsWith(".pdf")) {
    const data = await pdfParse(file.buffer);
    return data.text;
  }
  if (name.endsWith(".pptx")) {
    return await officeParser.parseOfficeAsync(file.buffer);
  }
  const err = new Error("Unsupported file type");
  err.status = 400;
  throw err;
}
```

### `src/services/aiService.js`
**Explain:** Sends the document text to Claude and gets back a quiz. Uses
**structured outputs** (`output_config.format` with a JSON Schema) so the reply
is guaranteed-valid JSON matching our shape. Counts (5–10 questions, exactly 4
options) live in the prompt because JSON Schema can't enforce array lengths in
structured-output mode. The key is read from the environment via dotenv.
```js
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const quizSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          correctIndex: { type: "integer" },
        },
        required: ["question", "options", "correctIndex"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "questions"],
  additionalProperties: false,
};

const systemPrompt =
  "You are a quiz generator. From the provided document text, create a multiple-choice quiz. Write a concise quiz title and between 5 and 10 questions. Each question must have exactly 4 options and exactly one correct answer. correctIndex is the zero-based index of the correct option in the options array. Base every question only on the document content.";

export async function generateQuiz(text) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16000,
    system: systemPrompt,
    output_config: {
      format: { type: "json_schema", schema: quizSchema },
    },
    messages: [{ role: "user", content: `Document text:\n\n${text}` }],
  });

  const block = response.content.find((b) => b.type === "text");
  return JSON.parse(block.text);
}
```

### `src/middleware/upload.js`
**Explain:** Configures multer to hold the upload in memory (we don't save it to
disk) and to reject anything that isn't a `.pdf` or `.pptx`, with a 20 MB cap.
```js
import multer from "multer";

const allowedMime = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

function fileFilter(req, file, cb) {
  const name = file.originalname.toLowerCase();
  const okExtension = name.endsWith(".pdf") || name.endsWith(".pptx");
  if (allowedMime.includes(file.mimetype) || okExtension) {
    cb(null, true);
  } else {
    const err = new Error("Only .pdf and .pptx files are allowed");
    err.status = 400;
    cb(err);
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

export default upload;
```

### `src/middleware/errorHandler.js`
**Explain:** One central place that turns any thrown error into a clean JSON
response. Express recognizes it as error middleware because it has 4 arguments.
Multer's own errors (e.g. file too large) get a 400.
```js
export function errorHandler(err, req, res, next) {
  const status = err.status || (err.name === "MulterError" ? 400 : 500);
  const message = err.message || "Internal server error";
  res.status(status).json({ error: message });
}
```

### `src/controllers/quizController.js`
**Explain:** The glue between HTTP and the services. `generate` orchestrates
parse → AI → save and returns the new id; `getOne` fetches a quiz by id. Errors
are passed to `next()` so the error handler formats them.
```js
import { extractText } from "../services/parserService.js";
import { generateQuiz } from "../services/aiService.js";
import * as quizService from "../services/quizService.js";

export async function generate(req, res, next) {
  try {
    if (!req.file) {
      const err = new Error("No file uploaded");
      err.status = 400;
      throw err;
    }
    const text = await extractText(req.file);
    if (!text || text.trim().length === 0) {
      const err = new Error("Could not extract any text from the file");
      err.status = 422;
      throw err;
    }
    const quiz = await generateQuiz(text);
    const id = quizService.create(quiz.title, quiz.questions);
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
}

export function getOne(req, res, next) {
  try {
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
```

### `src/routes/quizzes.js`
**Explain:** Maps the two URLs to controller functions. The upload middleware
runs before `generate` so `req.file` is populated.
```js
import { Router } from "express";
import upload from "../middleware/upload.js";
import * as quizController from "../controllers/quizController.js";

const router = Router();

router.post("/generate", upload.single("file"), quizController.generate);
router.get("/:id", quizController.getOne);

export default router;
```

### `src/server.js`
**Explain:** The entry point. Loads env vars, creates the Express app, serves the
frontend from `public/`, mounts a health check and the quiz routes, attaches the
error handler last, and starts listening.
```js
import "dotenv/config";
import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import "./config/database.js";
import quizzesRouter from "./routes/quizzes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(join(__dirname, "..", "public")));

app.get("/api/v1/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/v1/quizzes", quizzesRouter);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

---

## Step 4 — Frontend files

### `public/index.html`
**Explain:** A near-empty shell. Loads Tailwind from a CDN and defines three
container divs (one per screen). All visible content is built by `app.js`.
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Quiz Generator</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-slate-100 min-h-screen flex items-center justify-center p-4">
    <main class="w-full max-w-2xl">
      <div id="upload-screen"></div>
      <div id="quiz-screen" class="hidden"></div>
      <div id="results-screen" class="hidden"></div>
    </main>
    <script type="module" src="/js/app.js"></script>
  </body>
</html>
```

### `public/js/app.js`
**Explain:** The single-page app. A small `state` object holds the quiz, current
question index, score, and whether the current question was answered. One
`render` function per screen builds the DOM with `createElement`. Flow: upload →
POST file → GET quiz → answer questions with green/red feedback → results.
```js
const state = {
  quiz: null,
  current: 0,
  score: 0,
  answered: false,
  nextButton: null,
};

const uploadScreen = document.getElementById("upload-screen");
const quizScreen = document.getElementById("quiz-screen");
const resultsScreen = document.getElementById("results-screen");

function show(screen) {
  for (const s of [uploadScreen, quizScreen, resultsScreen]) {
    s.classList.add("hidden");
  }
  screen.classList.remove("hidden");
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function el(tag, classes, text) {
  const node = document.createElement(tag);
  if (classes) node.className = classes;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderUpload() {
  clear(uploadScreen);
  const card = el("div", "bg-white rounded-2xl shadow p-8 text-center");
  card.appendChild(el("h1", "text-2xl font-bold text-slate-800 mb-2", "AI Quiz Generator"));
  card.appendChild(el("p", "text-slate-500 mb-6", "Upload a PDF or PowerPoint to generate a quiz."));

  const input = el("input", "block w-full mb-4 text-sm");
  input.type = "file";
  input.accept = ".pdf,.pptx";

  const button = el("button", "bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg w-full", "Generate Quiz");
  const status = el("p", "text-slate-500 mt-4 hidden");

  button.addEventListener("click", () => handleUpload(input, button, status));

  card.appendChild(input);
  card.appendChild(button);
  card.appendChild(status);
  uploadScreen.appendChild(card);
  show(uploadScreen);
}

async function handleUpload(input, button, status) {
  const file = input.files[0];
  if (!file) {
    status.textContent = "Please choose a file first.";
    status.classList.remove("hidden");
    return;
  }
  button.disabled = true;
  button.textContent = "Generating…";
  status.textContent = "Reading your document and writing questions. This can take a moment.";
  status.classList.remove("hidden");

  try {
    const formData = new FormData();
    formData.append("file", file);

    const genRes = await fetch("/api/v1/quizzes/generate", {
      method: "POST",
      body: formData,
    });
    if (!genRes.ok) {
      const body = await genRes.json().catch(() => ({}));
      throw new Error(body.error || "Failed to generate quiz");
    }
    const { id } = await genRes.json();

    const quizRes = await fetch(`/api/v1/quizzes/${id}`);
    if (!quizRes.ok) throw new Error("Failed to load the generated quiz");
    const quiz = await quizRes.json();

    state.quiz = quiz;
    state.current = 0;
    state.score = 0;
    state.answered = false;
    renderQuestion();
  } catch (err) {
    status.textContent = err.message;
    button.disabled = false;
    button.textContent = "Generate Quiz";
  }
}

function renderQuestion() {
  clear(quizScreen);
  const q = state.quiz.questions[state.current];
  const total = state.quiz.questions.length;

  const card = el("div", "bg-white rounded-2xl shadow p-8");
  card.appendChild(el("p", "text-sm text-slate-400 mb-2", `Question ${state.current + 1} of ${total}`));
  card.appendChild(el("h2", "text-xl font-semibold text-slate-800 mb-6", q.question));

  const list = el("div", "space-y-3");
  q.options.forEach((option, index) => {
    const optionBtn = el("button", "block w-full text-left px-4 py-3 rounded-lg border border-slate-300 hover:bg-slate-50", option);
    optionBtn.addEventListener("click", () => handleAnswer(index, list));
    list.appendChild(optionBtn);
  });
  card.appendChild(list);

  const isLast = state.current + 1 >= total;
  const next = el("button", "mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg w-full hidden", isLast ? "See Results" : "Next Question");
  next.addEventListener("click", () => {
    if (isLast) {
      renderResults();
    } else {
      state.current += 1;
      state.answered = false;
      renderQuestion();
    }
  });
  card.appendChild(next);
  state.nextButton = next;

  quizScreen.appendChild(card);
  show(quizScreen);
}

function handleAnswer(chosenIndex, list) {
  if (state.answered) return;
  state.answered = true;

  const q = state.quiz.questions[state.current];
  const buttons = list.querySelectorAll("button");

  buttons.forEach((btn, index) => {
    btn.disabled = true;
    if (index === q.correctIndex) {
      btn.className = "block w-full text-left px-4 py-3 rounded-lg border border-green-500 bg-green-100 text-green-800";
    } else if (index === chosenIndex) {
      btn.className = "block w-full text-left px-4 py-3 rounded-lg border border-red-500 bg-red-100 text-red-800";
    } else {
      btn.className = "block w-full text-left px-4 py-3 rounded-lg border border-slate-200 text-slate-400";
    }
  });

  if (chosenIndex === q.correctIndex) state.score += 1;
  state.nextButton.classList.remove("hidden");
}

function renderResults() {
  clear(resultsScreen);
  const total = state.quiz.questions.length;
  const card = el("div", "bg-white rounded-2xl shadow p-8 text-center");
  card.appendChild(el("h2", "text-2xl font-bold text-slate-800 mb-2", state.quiz.title));
  card.appendChild(el("p", "text-slate-500 mb-4", "Quiz complete!"));
  card.appendChild(el("p", "text-4xl font-bold text-blue-600 mb-6", `${state.score} / ${total}`));

  const again = el("button", "bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg", "Play Again");
  again.addEventListener("click", renderUpload);
  card.appendChild(again);

  resultsScreen.appendChild(card);
  show(resultsScreen);
}

renderUpload();
```

---

## Step 5 — Documentation files

### `README.md`
**Explain:** The project's front door — what it is, how to install, run, and use.
```md
# AI Quiz Generator

Upload a PDF or PowerPoint (.pptx), and the app extracts the text, uses Claude to
generate a multiple-choice quiz, stores it in SQLite, and lets you play it in the
browser or fetch it as JSON.

## Tech stack
Node.js · Express · SQLite (better-sqlite3) · Multer · pdf-parse · officeparser ·
Anthropic Claude (claude-sonnet-4-6) · vanilla JS + Tailwind (CDN)

## Setup
1. `npm install`
2. Create a `.env` file (copy `.env.example`) and add your Anthropic API key.
3. `npm run dev`
4. Open http://localhost:3000

## API
- `POST /api/v1/quizzes/generate` — multipart/form-data, field `file` (.pdf or
  .pptx). Returns `{ "id": "..." }`.
- `GET /api/v1/quizzes/:id` — returns the quiz as JSON.
```

### `CLAUDE.md`
**Explain:** The stable context I read first each session.
```md
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
```

### `DEVLOG.md`
**Explain:** The dated progress diary. Append a new entry at the end of each
session.
```md
# Dev Log

## 2026-06-11
- Set up folder structure and package.json (ES modules).
- Confirmed Node v24.1.0 / npm 11.3.0.
- Wrote the full implementation guide (IMPLEMENTATION.md).
- NEXT: run `npm install`, then create all source + doc files, then test.
```

---

## Step 6 — Initialize git

**Explain before running:** Starts version tracking in this folder. `git init`
creates a hidden `.git/` folder (history lives there). `git add` stages files;
`git commit` saves a snapshot with a message. Nothing leaves your computer — git
is local until you choose to push to a remote like GitHub. `.gitignore` must
exist first so secrets and `node_modules/` aren't tracked.

```
git init
git add .
git commit -m "Initial commit: AI quiz generator scaffold and full implementation"
```
After each future working step, commit again, e.g.:
```
git add .
git commit -m "Add database layer and quiz service"
```

---

## Step 7 — Run and verify

**Explain before running:** `npm run dev` starts the server with auto-restart.
It needs a real key in `.env`. Leave it running; open the browser to test.
```
npm run dev
```
Then verify:
1. Open http://localhost:3000 → upload screen appears.
2. Upload a small `.pdf` → quiz renders; answering shows green/red; results show
   a score; "Play Again" resets.
3. Upload a `.pptx` → same.
4. Reject path: upload a `.txt`/`.png` → clean error message, no crash.
5. API directly (new terminal):
   - `curl -F "file=@sample.pdf" http://localhost:3000/api/v1/quizzes/generate`
     → `{ "id": "..." }`
   - `curl http://localhost:3000/api/v1/quizzes/<id>` → quiz JSON with a parsed
     `questions` array.
6. Persistence: stop the server (Ctrl+C), `npm run dev` again, re-fetch a known
   id → still there (proves SQLite, not memory).

---

## Troubleshooting notes

- **pdf-parse crashes on import** → make sure the import path is
  `pdf-parse/lib/pdf-parse.js`, not `pdf-parse`. (Already done above.)
- **officeparser named-import error** → use the default import
  `import officeParser from "officeparser"` and call
  `officeParser.parseOfficeAsync(buffer)`. (Already done above.)
- **`output_config` unsupported** → update the SDK (`npm install
  @anthropic-ai/sdk@latest`). As a fallback, drop `output_config` and instead
  end the system prompt with "Respond with only a JSON object matching: {title,
  questions:[{question, options, correctIndex}]}" then `JSON.parse` the text.
- **401 / authentication error** → the key in `.env` is missing/invalid.
- **AI returns fewer/odd questions** → tune the wording in `systemPrompt`.

---

## Build order checklist (for the execution session)

1. [ ] `npm install` (Step 1)
2. [ ] `.gitignore`, `.env.example`, `.env` (Step 2)
3. [ ] `src/config/database.js`
4. [ ] `src/services/quizService.js`
5. [ ] `src/services/parserService.js`
6. [ ] `src/middleware/upload.js`
7. [ ] `src/services/aiService.js`
8. [ ] `src/middleware/errorHandler.js`
9. [ ] `src/controllers/quizController.js`
10. [ ] `src/routes/quizzes.js`
11. [ ] `src/server.js`
12. [ ] `public/index.html`, `public/js/app.js`
13. [ ] `README.md`, `CLAUDE.md`, `DEVLOG.md`
14. [ ] `git init` + first commit (Step 6)
15. [ ] Run + verify (Step 7)
```
