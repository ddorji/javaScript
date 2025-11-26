/* =============================================================
  Quiz Battle (Multi-Player) — Player Wizard + Difficulty
  --------------------------------------------------------------
  Reliability upgrades:
  - Buttons marked type="button" to avoid accidental form submits/reloads.
  - Inline message area for quick feedback.
  - Defensive event wiring with clear console logs.
============================================================= */

const QUESTIONS_SOURCES = ["./questions.json"];

let backupQuestions = [
  {
    questionItem: "Which organization manages hydropower projects in Bhutan?",
    options: ["Druk Green Power Corporation", "Bhutan Power Corporation", "Hydro Bhutan", "Royal Energy Agency"],
    answer: "Druk Green Power Corporation",
    difficulty: "easy",
  },
  {
    questionItem: "Which Bhutanese festival involves mask dances and blessings?",
    options: ["Tshechu", "Losar", "Thruebab", "Neykor"],
    answer: "Tshechu",
    difficulty: "easy",
  },
  {
    questionItem: "Which Bhutanese king abdicated in favor of his son in 2006?",
    options: ["Jigme Singye Wangchuck", "Jigme Dorji Wangchuck", "Ugyen Wangchuck", "Jigme Khesar Namgyel Wangchuck"],
    answer: "Jigme Singye Wangchuck",
    difficulty: "easy",
  },
  {
    questionItem: "Which Bhutanese policy restricts the number of tourists annually?",
    options: ["High Value, Low Volume Tourism", "Free Tourism", "Visa-Free Policy", "Mass Tourism"],
    answer: "High Value, Low Volume Tourism",
    difficulty: "hard",
  },
  {
    questionItem: "Which year did Bhutan first hold democratic elections?",
    options: ["2008", "2005", "2010", "2013"],
    answer: "2008",
    difficulty: "hard",
  },
];
// Holds player names (strings)
let playerNames = [];
// Parallel array to players[] holding numeric scores
let scores = [];
// Index of the player whose turn it is (0-based)
let currentPlayer = 0;
// Index of the current question (0-based) in questions[]
let currentQuestion = 0;
// Global difficulty chosen from the radio buttons ("easy" or "hard")
let chosenDifficulty = "easy";

// =========================
// Timer constants & state
// =========================

// Number of seconds per question in hard mode
const HARD_MODE_TIMER_SECONDS = 12;

// ID of the setInterval timer (null when timer is not running)
let hardModeTimerId = null;

// Remaining seconds for current question in hard mode
let hardModeTimeLeft = HARD_MODE_TIMER_SECONDS;

// =========================
// Helper functions for DOM access
// =========================

// Shortcut to document.getElementById
const byId = (id) => document.getElementById(id);
// Shortcut to document.querySelector
const selectOne = (selector) => document.querySelector(selector);

// =========================
// Section / UI helper functions
// =========================

// Show a section by class name (e.g., "setup-names", "quiz", "results")
// and hide all others.
// Each section div has class="section <name>" in the HTML.
function setSection(name) {
  document
    .querySelectorAll(".section")
    .forEach((sectionElement) => sectionElement.classList.remove("active"));
  const elment = selectOne(`.${name}`);
  if (elment) elment.classList.add("active");
}

// Set a small inline message at the bottom of the player input area.
// Used to show validation or status messages.
function setMsg(text) {
  const element = byId("setupMsg");
  if (element) element.textContent = text || "";
}

// =========================
// Question loading & validation
// =========================

// Asynchronously load questions from the configured JSON files.
// The first successfully loaded file will replace the fallback questions.
async function loadQuestions() {
  for (const url of QUESTIONS_SOURCES) {
    try {
      const response = await fetch(url, { cache: "no-cache" });
      // If request fails, skip to next URL
      if (!response.ok) continue;
      const data = await response.json();
      // Expecting an array of question objects
      if (Array.isArray(data) && data.length) {
        // Validate shape of each question
        validateQuestions(data);
        // Copy questions and ensure each entry has a difficulty property
        backupQuestions = data.map((questionItem) => ({
          ...questionItem,
          difficulty: questionItem.difficulty || undefined,
        }));
        console.log(
          "[Quiz] Loaded questions from",
          url,
          `(${backupQuestions.length})`
        );
        return; // Stop once first valid source is used
      }
    } catch (showError) {
      console.warn("[Quiz] Failed to load", url, showError);
    }
  }
  // If all external sources fail, use the built-in fallback questions
  console.log("[Quiz] Using built-in fallback questions", backupQuestions.length);
}

// Basic validation for loaded questions:
// - questionItem is a string
// - options is an array
// - answer is a string
function validateQuestions(data) {
  data.forEach((questionItem, i) => {
    if (
      typeof questionItem.questionItem !== "string" ||
      !Array.isArray(questionItem.options) ||
      typeof questionItem.answer !== "string"
    ) {
      throw new Error(`Invalid question at index ${i}.`);
    }
  });
}

// =========================
// Player management
// =========================

// Counter used only to show "Player X name" in label.
// It does NOT need to match players.length exactly,
// but we keep it in sync for clarity.
let playerIndexCounter = 1;

// Called when clicking "Next" or pressing Enter in player name input.
// - Validates that a name is entered
// - Adds it to players[]
// - Resets scores[]
// - Updates the UI
function addPlayerFromInput() {
  const input = byId("playerNameInput");
  if (!input) return;
  const name = input.value.trim();
  if (!name) {
    setMsg("Please enter a name.");
    return;
  }
  // Add the new player to array
  playerNames.push(name);
  // Reset scores array so it matches the number of players
  scores = new Array(playerNames.length).fill(0);
  // Clear input for the next player
  input.value = "";
  // Update the player index counter for the label text
  playerIndexCounter = playerNames.length + 1;
  updatePlayerPrompt();
  // Re-render the players list UI
  renderPlayersList();
  setMsg(`Added "${name}". Enter Player ${playerIndexCounter} or continue.`);
  console.log("[Quiz] Players:", playerNames);
}
// Remove a player by index (from the ☓ button in the list).
// Also resets scores and related UI elements.
function removePlayerAt(index) {
  playerNames.splice(index, 1);
  // Rebuild scores so it matches new players length
  scores = new Array(playerNames.length).fill(0);
  // Recalculate next player label index
  playerIndexCounter = playerNames.length + 1;
  updatePlayerPrompt();
  // Re-render list UI
  renderPlayersList();
  setMsg("Player removed.");
}

// Update the label to reflect next player index (Player 1, Player 2, etc.)
function updatePlayerPrompt() {
  const playerLabel = byId("playerPrompt");
  if (playerLabel) playerLabel.innerText = `Player ${playerIndexCounter} name`;
}

// Render the current players[] array into the <ul id="playersList">
// Each list item shows the player name and a remove (✕) button.
function renderPlayersList() {
  const ul = byId("playersList");
  if (!ul) return;
  // Clear existing list
  ul.innerHTML = "";
  playerNames.forEach((playerName, i) => {
    const listItem = document.createElement("li");
    listItem.innerHTML = `<span>${playerName}</span>`;
    // Remove button for each player
    const playerRemove = document.createElement("button");
    playerRemove.setAttribute("type", "button");
    playerRemove.setAttribute("aria-label", `Remove ${playerName}`);
    playerRemove.textContent = "✕";
    playerRemove.onclick = () => removePlayerAt(i);
    listItem.appendChild(playerRemove);
    ul.appendChild(listItem);
  });
}

// =========================
// Difficulty & question pool
// =========================

// Filter and shuffle the questions based on the chosen difficulty.
//
// - For "easy":
//     Use questions with no difficulty OR difficulty === "easy".
// - For "hard":
//     Use questions with difficulty === "hard"; if none exist, fall back
//     to all questions.
// - Then shuffle the resulting pool and reset progress & scores.
function applyDifficultyFilter() {
  let pool;
  if (chosenDifficulty === "easy") {
    // Include questions that are easy or have no explicit difficulty
    pool = backupQuestions.filter((questionItem) => !questionItem.difficulty || questionItem.difficulty === "easy");
  } else {
    // Hard difficulty selected
    const hardOnly = backupQuestions.filter((questionItem) => questionItem.difficulty === "hard");
    // If no hard-only questions, use all
    pool = hardOnly.length ? hardOnly : backupQuestions.slice();
  }
  // As a safety net, if pool is empty, use full set
  if (!pool.length) pool = backupQuestions.slice();

  // Randomize question order
  shuffleArray(pool);
  // Replace global questions array with filtered & shuffled pool
  backupQuestions = pool;
  // Reset progress and scores for new game
  currentQuestion = 0;
  currentPlayer = 0;
  scores = new Array(playerNames.length).fill(0);
}
// Simple Fisher–Yates shuffle for randomizing an array in-place
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
// =========================
// Quiz flow: rendering and state transitions
// =========================

// Switch to quiz section and render the first question
function showQuiz() {
  setSection("quiz");
  renderQuestion();
}
// Render the current question and its options.
function renderQuestion() {
  // If we ran out of questions, end the game
  if (currentQuestion >= backupQuestions.length) return endGame();

  // Show current player's turn (or generic label if no players)
  byId("playerTurn").innerText = playerNames.length
    ? `It's ${playerNames[currentPlayer]}'s turn`
    : "Question";

  const questionObject = backupQuestions[currentQuestion];
  // Set question text
  byId("question").innerText = questionObject.questionItem;

  // Create answer buttons for each option
  const optDiv = byId("options");
  optDiv.innerHTML = "";
  questionObject.options.forEach((answerOption) => {
    const btn = document.createElement("button");
    btn.setAttribute("type", "button");
    btn.innerText = answerOption;
    btn.onclick = () => onAnswer(answerOption); // When clicked, handle answer logic
    optDiv.appendChild(btn);
  });

  // Update progress indicator (e.g. "Q 1 / 10")
  byId("progressBar").innerText = `Question ${currentQuestion + 1} / ${
    backupQuestions.length
  }`;

  // Clear any previous timer
  clearTimer();

  // For "hard" difficulty logic:
  // NOTE: In this implementation, the timer starts only when
  // there are NO questions explicitly marked as difficulty="hard".
  // If at least one question has difficulty="hard", you could adjust
  // this check to start timer based on each question.
  if (
    chosenDifficulty === "hard" ){
    startTimer();
  } else {
    byId("timer").innerText = "";
  }
}
// Handle a player's answer
function onAnswer(selected) {
  const correct = backupQuestions[currentQuestion].answer;
  // If answer matches, increment current player's score
  if (selected === correct) {
    scores[currentPlayer]++;
  }
  // Move to next turn / question
  nextTurn();
}
// Advance to the next player's turn.
// After the last player answers, move to the next question.
// If we've run out of questions, go to the results screen.
function nextTurn() {
  currentPlayer++;
  // Wrap around when we reach the end of players array
  if (currentPlayer >= playerNames.length) {
    currentPlayer = 0;
    currentQuestion++;
  }
  // If we are past the last question, end game
  if (currentQuestion >= backupQuestions.length) {
    endGame();
  } else {
    // Otherwise, render next question (or next player's turn on same question)
    renderQuestion();
  }
}
// End the game: stop timer and show results section
function endGame() {
  clearTimer();
  setSection("results");
  renderScores();
}
// Render each player's final score to the scoreboard area
function renderScores() {
  const scoreboard = byId("scoreboard");
  scoreboard.innerHTML = "";
  playerNames.forEach((playerName, i) => {
    const line = document.createElement("p");
    line.innerText = `${playerName}: ${scores[i]} point${scores[i] === 1 ? "" : "s"}`;
    scoreboard.appendChild(line);
  });
}
// =========================
// Hard mode timer
// =========================

// Start countdown timer for a question in hard mode.
// If time runs out, automatically move to next turn (no score).
function startTimer() {
  hardModeTimeLeft = HARD_MODE_TIMER_SECONDS;
  byId("timer").innerText = `⏳ ${hardModeTimeLeft}s`;
  // Run every second
  hardModeTimerId = setInterval(() => {
    hardModeTimeLeft--;
    // When time is up:
    if (hardModeTimeLeft <= 0) {
      clearTimer();
      nextTurn(); // automatically move on as if the player didn't answer
      return;
    }
    // Update displayed seconds
    byId("timer").innerText = `⏳ ${hardModeTimeLeft}s`;
  }, 1000);
}
// Stop and reset the timer interval if active
function clearTimer() {
  if (hardModeTimerId) {
    clearInterval(hardModeTimerId);
    hardModeTimerId = null;
  }
}
// =========================
// App initialization
// =========================

// When the DOM is ready, wire up event listeners and load questions.
window.addEventListener("DOMContentLoaded", async () => {
  console.log("[Quiz] DOM ready");
  // Try to load questions from external JSON sources
  await loadQuestions();

  // Grab references to key elements needed in setup step
  const addBtn = byId("addPlayerBtn");
  const contBtn = byId("continueToDifficultyBtn");
  const input = byId("playerNameInput");

  // Safety: if any are missing, abort setup
  if (!addBtn || !contBtn || !input) {
    console.error("[Quiz] Setup elements missing.");
    return;
  }
  
  // Event: click on "Next" to add player
  addBtn.addEventListener("click", addPlayerFromInput);
  // Event: press Enter in name input to add player
  input.addEventListener("keydown", (playerEnter) => {
    if (playerEnter.key === "Enter") {
      playerEnter.preventDefault();
      addPlayerFromInput();
    }
  });

  // Event: click "Continue" to move to difficulty selection
  contBtn.addEventListener("click", () => {
    if (playerNames.length < 1) {
      setMsg("Add at least one player before continuing.");
      return;
    }
    setSection("setup-difficulty");
  });

  // Difficulty radios: update chosenDifficulty on change
  document.querySelectorAll('input[name="difficulty"]').forEach((difficultOption) => {
    difficultOption.addEventListener("change", () => {
      chosenDifficulty = difficultOption.value;
    });
  });

  // Buttons for starting game, going back, and playing again
  const startBtn = byId("startGameBtn");
  const backBtn = byId("backToNamesBtn");
  const againBtn = byId("playAgainBtn");

  // Start game: filter questions, then show quiz
  startBtn.addEventListener("click", () => {
    applyDifficultyFilter();
    showQuiz();
  });
  // Back to name setup section
  backBtn.addEventListener("click", () => setSection("setup-names"));
  // Play again: simply reload the entire page
  againBtn.addEventListener("click", () => location.reload());
});
