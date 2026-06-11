// ═══════════════════════════════════════════════════════════════════════
// public/js/app.js — Browser-side Single-Page Application
//
// This file runs in the USER'S BROWSER (not on the server).
// It manages three screens using a "state machine" pattern:
//
//   [upload] ──(submit file)──▶ [quiz] ──(all answered)──▶ [results]
//            ◀──────────────────────────────(play again)────────────
//
// A state machine just means: the app is always in exactly one state,
// and specific events trigger transitions to another state.
//
// All visible content is built with document.createElement — not
// innerHTML. This is the safe, canonical approach: textContent never
// executes HTML, so there's no risk of injecting malicious markup.
// ═══════════════════════════════════════════════════════════════════════

// ── State ──────────────────────────────────────────────────────────────
// One object holds everything the app needs to remember across screens.
// When state changes, we call a render function to rebuild the DOM.
const state = {
  quiz: null,       // The quiz object fetched from the API
  current: 0,       // Index of the question currently being shown
  score: 0,         // Running count of correct answers
  answered: false,  // Whether the current question has been answered
  nextButton: null, // Reference to the "Next" button, revealed after answering
};

// ── DOM references ─────────────────────────────────────────────────────
// Grab the three screen containers once at startup — they never change.
const uploadScreen  = document.getElementById("upload-screen");
const quizScreen    = document.getElementById("quiz-screen");
const resultsScreen = document.getElementById("results-screen");

// ── Utility helpers ────────────────────────────────────────────────────

// Hide all screens, then reveal the one we want.
// Tailwind's "hidden" class applies `display: none`.
function show(screen) {
  for (const s of [uploadScreen, quizScreen, resultsScreen]) {
    s.classList.add("hidden");
  }
  screen.classList.remove("hidden");
}

// Remove all child elements from a node, leaving it empty.
// Called at the start of each render function to start fresh.
function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// Create an element, optionally set its Tailwind classes and text content.
// This helper keeps render functions readable instead of repeating 3 lines
// of createElement / className / textContent every time.
function el(tag, classes, text) {
  const node = document.createElement(tag);
  if (classes) node.className = classes;
  if (text !== undefined) node.textContent = text; // textContent is injection-safe
  return node;
}

// ═══════════════════════════════════════════════════════════════════════
// Screen 1: Upload
// ═══════════════════════════════════════════════════════════════════════

function renderUpload() {
  clear(uploadScreen);

  const card = el("div", "bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-10 text-center");

  // Small purple label above the heading — matches the "AI SOFTWARE ENGINEER" style
  card.appendChild(el("p", "text-violet-400 text-xs font-semibold uppercase tracking-widest mb-4", "AI Quiz Generator"));
  card.appendChild(el("h1", "text-4xl font-bold text-white mb-3", "Turn any document into a quiz"));
  card.appendChild(el("p", "text-slate-400 mb-8 text-base leading-relaxed", "Upload a PDF or PowerPoint — I'll extract the content and write the questions."));

  // File input styled to match the dark theme
  const input = el("input",
    "block w-full mb-6 text-sm text-slate-400 " +
    "file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 " +
    "file:text-sm file:font-semibold file:bg-slate-800 file:text-slate-300 " +
    "hover:file:bg-slate-700 cursor-pointer"
  );
  input.type = "file";
  input.accept = ".pdf,.pptx";

  // Purple gradient button — the key visual from the reference design
  const button = el("button",
    "bg-gradient-to-r from-purple-600 to-violet-500 hover:from-purple-500 hover:to-violet-400 " +
    "text-white font-semibold px-6 py-3 rounded-xl w-full transition-all duration-200",
    "Generate Quiz"
  );

  const status = el("p", "text-slate-400 mt-5 hidden text-sm");

  button.addEventListener("click", () => handleUpload(input, button, status));

  card.appendChild(input);
  card.appendChild(button);
  card.appendChild(status);
  uploadScreen.appendChild(card);
  show(uploadScreen);
}

async function handleUpload(input, button, status) {
  const file = input.files[0]; // The first (and only) file the user selected
  if (!file) {
    status.textContent = "Please choose a file first.";
    status.classList.remove("hidden");
    return;
  }

  // Disable the button while the request is in flight so the user
  // can't accidentally submit the same file twice.
  button.disabled = true;
  button.textContent = "Generating…";
  status.textContent = "Reading your document and writing questions. This can take a moment.";
  status.classList.remove("hidden");

  try {
    // FormData is how browsers send a file in a POST request.
    // It automatically sets the correct Content-Type header including
    // the multipart boundary — do NOT set Content-Type manually.
    const formData = new FormData();
    formData.append("file", file); // "file" must match upload.single("file") on the server

    // Step 1: POST the file. The server parses it, calls AI, saves to DB,
    // and returns just { id } — the database id of the new quiz.
    const genRes = await fetch("/api/v1/quizzes/generate", {
      method: "POST",
      body: formData,
    });

    if (!genRes.ok) {
      const body = await genRes.json().catch(() => ({}));
      throw new Error(body.error || "Failed to generate quiz");
    }
    const { id } = await genRes.json();

    // Step 2: Fetch the full quiz using the id we just received.
    const quizRes = await fetch(`/api/v1/quizzes/${id}`);
    if (!quizRes.ok) throw new Error("Failed to load the generated quiz");
    const quiz = await quizRes.json();

    // Load the quiz into state, reset counters, and transition to the quiz screen.
    state.quiz = quiz;
    state.current = 0;
    state.score = 0;
    state.answered = false;
    renderQuestion();
  } catch (err) {
    // On any error: show the message and re-enable the button.
    status.textContent = err.message;
    button.disabled = false;
    button.textContent = "Generate Quiz";
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Screen 2: Quiz
// ═══════════════════════════════════════════════════════════════════════

function renderQuestion() {
  clear(quizScreen);

  const q     = state.quiz.questions[state.current];
  const total = state.quiz.questions.length;

  const card = el("div", "bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8");

  // Small purple label + progress
  card.appendChild(el("p",
    "text-violet-400 text-xs font-semibold uppercase tracking-widest mb-4",
    `Question ${state.current + 1} of ${total}`
  ));
  card.appendChild(el("h2", "text-2xl font-bold text-white mb-8", q.question));

  // Build one button per answer option.
  const list = el("div", "space-y-3");
  q.options.forEach((option, index) => {
    const optionBtn = el(
      "button",
      "block w-full text-left px-5 py-4 rounded-xl border border-slate-700 " +
      "bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all duration-150",
      option
    );
    // Each button closes over its own `index` so handleAnswer
    // knows which option was clicked.
    optionBtn.addEventListener("click", () => handleAnswer(index, list));
    list.appendChild(optionBtn);
  });
  card.appendChild(list);

  // "Next" / "See Results" button — hidden until the user answers.
  const isLast = state.current + 1 >= total;
  const next = el(
    "button",
    "mt-6 bg-gradient-to-r from-purple-600 to-violet-500 hover:from-purple-500 hover:to-violet-400 " +
    "text-white font-semibold px-6 py-3 rounded-xl w-full transition-all duration-200 hidden",
    isLast ? "See Results" : "Next Question"
  );
  next.addEventListener("click", () => {
    if (isLast) {
      renderResults();
    } else {
      state.current += 1;
      state.answered = false;
      renderQuestion(); // Re-render this same screen with the next question
    }
  });
  card.appendChild(next);

  // Store the button reference so handleAnswer can unhide it.
  state.nextButton = next;

  quizScreen.appendChild(card);
  show(quizScreen);
}

function handleAnswer(chosenIndex, list) {
  if (state.answered) return; // Ignore any click after the first answer
  state.answered = true;

  const q       = state.quiz.questions[state.current];
  const buttons = list.querySelectorAll("button");

  // Colour-code all buttons and disable them:
  //   correct answer → green
  //   wrong choice   → red
  //   everything else → dimmed
  buttons.forEach((btn, index) => {
    btn.disabled = true;
    if (index === q.correctIndex) {
      btn.className = "block w-full text-left px-5 py-4 rounded-xl border border-emerald-500 bg-emerald-950 text-emerald-300";
    } else if (index === chosenIndex) {
      btn.className = "block w-full text-left px-5 py-4 rounded-xl border border-red-500 bg-red-950 text-red-300";
    } else {
      btn.className = "block w-full text-left px-5 py-4 rounded-xl border border-slate-800 bg-slate-900 text-slate-600";
    }
  });

  if (chosenIndex === q.correctIndex) state.score += 1;

  // Reveal the next/finish button now that the question is answered.
  state.nextButton.classList.remove("hidden");
}

// ═══════════════════════════════════════════════════════════════════════
// Screen 3: Results
// ═══════════════════════════════════════════════════════════════════════

function renderResults() {
  clear(resultsScreen);
  const total = state.quiz.questions.length;

  const card = el("div", "bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-10 text-center");

  card.appendChild(el("p", "text-violet-400 text-xs font-semibold uppercase tracking-widest mb-4", "Results"));
  card.appendChild(el("h2", "text-3xl font-bold text-white mb-2", state.quiz.title));
  card.appendChild(el("p", "text-slate-400 mb-8", "Quiz complete!"));

  // Big score in purple — the visual centrepiece of this screen
  card.appendChild(el("p", "text-6xl font-bold text-violet-400 mb-2", `${state.score}`));
  card.appendChild(el("p", "text-slate-500 mb-10", `out of ${total}`));

  const again = el(
    "button",
    "bg-gradient-to-r from-purple-600 to-violet-500 hover:from-purple-500 hover:to-violet-400 " +
    "text-white font-semibold px-8 py-3 rounded-xl transition-all duration-200",
    "Play Again"
  );
  // "Play Again" sends the user back to the upload screen.
  again.addEventListener("click", renderUpload);
  card.appendChild(again);

  resultsScreen.appendChild(card);
  show(resultsScreen);
}

// ── Kick off the app ────────────────────────────────────────────────────
// Start on the upload screen. Everything else is driven by user actions.
renderUpload();
