/* =============================================================
  Quiz Battle (Multi-Player) — Player Wizard + Difficulty
  --------------------------------------------------------------
  This file controls all the game logic:
  - loading questions
  - managing players & scores
  - switching between UI steps
  - rendering questions and options
  - handling timer in hard mode
============================================================= */

// Paths (URLs) to JSON files that contain questions.
// For now, just one file: "./questions.json"
const QUESTIONS_SOURCES = ["./questions.json"];

// Fallback questions used when JSON file cannot be loaded.
let backupQuestions = [
  {
    // The text of the question
    questionItem: "Which organization manages hydropower projects in Bhutan?",
    // All answer choices as an array of strings
    options: [
      "Druk Green Power Corporation",
      "Bhutan Power Corporation",
      "Hydro Bhutan",
      "Royal Energy Agency",
    ],
    answer: "Druk Green Power Corporation",
    // Difficulty tag used for filtering
    difficulty: "easy",
  },
  {
    questionItem:
      "Which Bhutanese festival involves mask dances and blessings?",
    options: ["Tshechu", "Losar", "Thruebab", "Neykor"],
    answer: "Tshechu",
    difficulty: "easy",
  },
  {
    questionItem: "Which Bhutanese king abdicated in favor of his son in 2006?",
    options: [
      "Jigme Singye Wangchuck",
      "Jigme Dorji Wangchuck",
      "Ugyen Wangchuck",
      "Jigme Khesar Namgyel Wangchuck",
    ],
    answer: "Jigme Singye Wangchuck",
    difficulty: "easy",
  },
  {
    questionItem:
      "Which Bhutanese policy restricts the number of tourists annually?",
    options: [
      "High Value, Low Volume Tourism",
      "Free Tourism",
      "Visa-Free Policy",
      "Mass Tourism",
    ],
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

// ============== Global game state ==============

// Array to store player names
let playerNames = [];

// Parallel array of scores, same length as playerNames
// e.g. [2, 3] means player 0 has 2 points, player 1 has 3 points.
let scores = [];

// Index (0-based) of the player whose turn it is.
let currentPlayer = 0;

// Index (0-based) of the current question in backupQuestions.
let currentQuestion = 0;

// Difficulty selected by user: "easy" or "hard".
let chosenDifficulty = "easy";

// ============== Timer constants & state ==============

// Total seconds allowed per question in easy and hard mode.
const EASY_MODE_TIMER_SECONDS = 10;
const HARD_MODE_TIMER_SECONDS = 15;

// ID of the setInterval timer.
// Used so we can stop the timer with clearInterval().
let hardModeTimerId = null;

// How many seconds left for the current question in hard mode.
let easyModeTimeLeft = EASY_MODE_TIMER_SECONDS;
let hardModeTimeLeft = HARD_MODE_TIMER_SECONDS;

// ============== Helper functions for DOM access ==============

// Short helper: get element by ID.
const byId = (id) => document.getElementById(id);

// Short helper: select first matching element by CSS selector.
const selectOne = (selector) => document.querySelector(selector);

// ============== Section / UI helper functions ==============

/**
 *
 * @param {string} name - The name of the section class (e.g. "setup-names", "quiz")
 */
function setSection(name) {
  // Hide all elements with class "section"
  document
    .querySelectorAll(".section")
    .forEach((sectionElement) => sectionElement.classList.add("hidden"));

  // Find the section that also has the given name as a class (e.g. ".section.quiz")
  const el = selectOne(`.section.${name}`);
  // If it exists, remove "hidden" so it becomes visible
  if (el) el.classList.remove("hidden");
}

/**
 * Set message text under the player name input.
 * If text is empty or undefined, clears the message.
 *
 * @param {string} text - Message to show
 */
function setMsg(text) {
  const element = byId("setupMsg");
  if (element) element.textContent = text || "";
}

// ============== Question loading & validation ==============

/**
 * Try to load questions from each URL in QUESTIONS_SOURCES.
 * If successful, replaces backupQuestions with loaded data.
 * If all fail, keeps the built-in backupQuestions.
 */
async function loadQuestions() {
  // Loop through each URL (currently only "./questions.json")
  for (const url of QUESTIONS_SOURCES) {
    try {
      // Fetch the JSON file (no-cache to avoid stale data)
      const response = await fetch(url, { cache: "no-cache" });
      // If HTTP status is not OK (e.g. 404), try next URL
      if (!response.ok) continue;

      // Parse JSON body
      const data = await response.json();

      // Ensure it's a non-empty array
      if (Array.isArray(data) && data.length) {
        // Validate structure
        validateQuestions(data);

        // Map each question to ensure difficulty is defined or left undefined
        backupQuestions = data.map((questionItem) => ({
          ...questionItem,
          difficulty: questionItem.difficulty || undefined,
        }));

        console.log(
          "[Quiz] Loaded questions from",
          url,
          `(${backupQuestions.length})`
        );
        // If we successfully loaded one file, we stop checking others
        return;
      }
    } catch (showError) {
      // Log error but continue with next URL
      console.warn("[Quiz] Failed to load", url, showError);
    }
  }

  // If we reach here, all external sources failed
  console.log(
    "[Quiz] Using built-in fallback questions",
    backupQuestions.length
  );
}

/**
 * Validate that each question in data has the expected structure.
 *
 * @param {Array} data - Array of question objects from JSON
 */
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

// ============== Player management ==============

// Counter for label "Player X name"
let playerIndexCounter = 1;

/**
 * Read name from input, validate it, add to playerNames,
 * reset scores array, and update UI.
 */
function addPlayerFromInput() {
  const input = byId("playerNameInput");
  if (!input) return;

  // Remove extra spaces from both ends of the input
  const name = input.value.trim();

  // If name is empty, show validation message
  if (!name) {
    setMsg("Please enter a name.");
    return;
  }

  // Add to players array
  playerNames.push(name);

  // Rebuild scores so length matches number of players
  scores = new Array(playerNames.length).fill(0);

  // Clear the input field for the next player
  input.value = "";

  // Next player label index is players.length + 1
  playerIndexCounter = playerNames.length + 1;

  // Update label "Player X name"
  updatePlayerPrompt();

  // Re-render the list of players on the right
  renderPlayersList();

  // Show confirmation message
  setMsg(`Added "${name}". Enter Player ${playerIndexCounter} or continue.`);

  console.log("[Quiz] Players:", playerNames);
}

/**
 * Remove player at a given index from playerNames,
 * reset scores, and refresh UI.
 *
 * @param {number} index
 */
function removePlayerAt(index) {
  // Remove 1 element at the given index
  playerNames.splice(index, 1);

  // Reset scores to match new player count
  scores = new Array(playerNames.length).fill(0);

  // Update label index counter
  playerIndexCounter = playerNames.length + 1;
  updatePlayerPrompt();

  // Refresh player list UI
  renderPlayersList();

  setMsg("Player removed.");
}

/**
 * Update the label above the input field to show "Player X name".
 */
function updatePlayerPrompt() {
  const playerLabel = byId("playerPrompt");
  if (playerLabel) playerLabel.innerText = `Player ${playerIndexCounter} name`;
}

/**
 * Render the current players into the <ul id="playersList">.
 * Each item has the player's name and a remove (✕) button.
 */
function renderPlayersList() {
  const ul = byId("playersList");
  if (!ul) return;

  // Clear existing list items
  ul.innerHTML = "";

  // For each player in playerNames...
  playerNames.forEach((playerName, i) => {
    // Create <li>
    const listItem = document.createElement("li");
    // Tailwind classes for styling each list item
    listItem.className =
      "flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2";
    // Put the name inside a <span>
    listItem.innerHTML = `<span>${playerName}</span>`;

    // Create remove button
    const playerRemove = document.createElement("button");
    playerRemove.setAttribute("type", "button");
    playerRemove.setAttribute("aria-label", `Remove ${playerName}`);
    playerRemove.textContent = "✕";
    // Tailwind classes for the remove button
    playerRemove.className =
      "ml-3 px-2 py-1 rounded-md bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition";
    // When clicked, remove this player
    playerRemove.onclick = () => removePlayerAt(i);

    // Add button into list item, then list item into <ul>
    listItem.appendChild(playerRemove);
    ul.appendChild(listItem);
  });
}

// ============== Difficulty & question pool ==============

/**
 * Filter questions depending on chosenDifficulty,
 * shuffle them, and reset game state.
 */
function applyDifficultyFilter() {
  let pool;

  if (chosenDifficulty === "easy") {
    // Keep questions that are easy or have no difficulty specified
    pool = backupQuestions.filter(
      (questionItem) =>
        !questionItem.difficulty || questionItem.difficulty === "easy"
    );
  } else {
    // Hard difficulty: prefer questions marked "hard"
    const hardOnly = backupQuestions.filter(
      (questionItem) => questionItem.difficulty === "hard"
    );
    // If there are hard-only questions, use them; otherwise use all questions
    pool = hardOnly.length ? hardOnly : backupQuestions.slice();
  }

  // Safety: if pool somehow ends up empty, use all questions
  if (!pool.length) pool = backupQuestions.slice();

  // Randomize question order
  shuffleArray(pool);

  // Replace global questions array with filtered pool
  backupQuestions = pool;

  // Reset question index, current player, and scores for a fresh game
  currentQuestion = 0;
  currentPlayer = 0;
  scores = new Array(playerNames.length).fill(0);
}

/**
 * Fisher–Yates shuffle for randomizing an array in-place.
 *
 * @param {Array} arr
 */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    // Pick random index from 0 to i
    const j = Math.floor(Math.random() * (i + 1));
    // Swap arr[i] and arr[j]
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ============== Quiz flow: rendering & transitions ==============

/**
 * Show quiz section and render the first question.
 */
function showQuiz() {
  setSection("quiz");
  renderQuestion();
}

/**
 * Render the current question, options, progress, and timer.
 */
function renderQuestion() {
  // If there are no more questions, end the game
  if (currentQuestion >= backupQuestions.length) return endGame();

  // Show whose turn it is, if we have players
  byId("playerTurn").innerText = playerNames.length
    ? `It's ${playerNames[currentPlayer]}'s turn`
    : "Question";

  // Get current question object from array
  const questionObject = backupQuestions[currentQuestion];

  // Put question text into <div id="question">
  byId("question").innerText = questionObject.questionItem;

  // Clear old answer buttons and create new ones
  const optDiv = byId("options");
  optDiv.innerHTML = "";
  questionObject.options.forEach((answerOption) => {
    const btn = document.createElement("button");
    btn.setAttribute("type", "button");
    btn.innerText = answerOption;
    // Tailwind classes for answer buttons
    btn.className =
      "w-full px-4 py-2 rounded-lg bg-indigo-400 text-white font-semibold shadow hover:bg-indigo-500 transition text-left";
    // When clicked, call onAnswer with chosen option
    btn.onclick = () => onAnswer(answerOption);
    optDiv.appendChild(btn);
  });

  // Update progress indicator "Question X / Y"
  byId("progressBar").innerText = `Question ${currentQuestion + 1} / ${
    backupQuestions.length
  }`;

  // Clear any previous timer so we don't stack intervals
  clearTimer();

  // In hard mode, always start the 12-second timer
  if (chosenDifficulty === "hard") {
    startTimer();
  } else {
    // In easy mode, no timer is shown
    byId("timer").innerText = "";
  }
}

/**
 * Handle a player's selected answer.
 *
 * @param {string} selected - The option the user clicked
 */
function onAnswer(selected) {
  const correct = backupQuestions[currentQuestion].answer;
  // If answer is correct, give 1 point to current player
  if (selected === correct) {
    scores[currentPlayer]++;
  }
  // Move to next player's turn (and maybe next question)
  nextTurn();
}

/**
 * Advance to next player.
 * After last player, move to next question.
 * If no more questions, end the game.
 */
function nextTurn() {
  currentPlayer++;

  // If we've gone past last player index, wrap around and go to next question
  if (currentPlayer >= playerNames.length) {
    currentPlayer = 0;
    currentQuestion++;
  }

  // If we passed the last question index, end game; otherwise, show next question
  if (currentQuestion >= backupQuestions.length) {
    endGame();
  } else {
    renderQuestion();
  }
}

/**
 * Stop timer, switch to results section, and render scores.
 */
function endGame() {
  clearTimer();
  setSection("results");
  renderScores();
}

/**
 * Create a list of final scores inside <div id="scoreboard">.
 */
function renderScores() {
  const scoreboard = byId("scoreboard");
  scoreboard.innerHTML = "";

  playerNames.forEach((playerName, i) => {
    const line = document.createElement("p");
    line.className = "text-gray-700";
    line.innerText = `${playerName}: ${scores[i]} point${
      scores[i] === 1 ? "" : "s"
    }`;
    scoreboard.appendChild(line);
  });
}

// ============== Hard mode timer ==============

/**
 * Start countdown timer for current question in hard mode.
 * When time hits 0, automatically move to next turn.
 */
function startTimer() {
  // Reset remaining time
  hardModeTimeLeft = HARD_MODE_TIMER_SECONDS;

  // Show initial value: "⏳ 12s"
  byId("timer").innerText = `⏳ ${hardModeTimeLeft}s`;

  // Set up interval to run once per second
  hardModeTimerId = setInterval(() => {
    // Decrease remaining time
    hardModeTimeLeft--;

    // If time is up
    if (hardModeTimeLeft <= 0) {
      // Stop timer
      clearTimer();
      // Move on as if player did not answer
      nextTurn();
      return;
    }

    // Update displayed seconds
    byId("timer").innerText = `⏳ ${hardModeTimeLeft}s`;
  }, 1000);
}

/**
 * Clear the timer interval if it is running.
 */
function clearTimer() {
  if (hardModeTimerId) {
    clearInterval(hardModeTimerId);
    hardModeTimerId = null;
  }
}

// ============== App initialization ==============

/**
 * Main entry point: runs when HTML is fully loaded.
 * Wires up event listeners and loads questions.
 */
window.addEventListener("DOMContentLoaded", async () => {
  console.log("[Quiz] DOM ready");

  // Try to load questions from external JSON first
  await loadQuestions();

  // Grab main elements used in setup
  const addBtn = byId("addPlayerBtn");
  const contBtn = byId("continueToDifficultyBtn");
  const input = byId("playerNameInput");

  // If any critical elements are missing, stop
  if (!addBtn || !contBtn || !input) {
    console.error("[Quiz] Setup elements missing.");
    return;
  }

  // Show the first step (player setup) explicitly
  setSection("setup-names");

  // Add player when "Add Player" button is clicked
  addBtn.addEventListener("click", addPlayerFromInput);

  // Add player when Enter is pressed in the input
  input.addEventListener("keydown", (playerEnter) => {
    if (playerEnter.key === "Enter") {
      playerEnter.preventDefault();
      addPlayerFromInput();
    }
  });

  // "Continue" button: go to difficulty selection if at least 1 player
  contBtn.addEventListener("click", () => {
    if (playerNames.length < 1) {
      setMsg("Add at least one player before continuing.");
      return;
    }
    setSection("setup-difficulty");
  });

  // Difficulty radio buttons: update chosenDifficulty on change
  document
    .querySelectorAll('input[name="difficulty"]')
    .forEach((difficultOption) => {
      difficultOption.addEventListener("change", () => {
        chosenDifficulty = difficultOption.value;
      });
    });

  // Get buttons for starting game, going back, and playing again
  const startBtn = byId("startGameBtn");
  const backBtn = byId("backToNamesBtn");
  const againBtn = byId("playAgainBtn");

  // Start game: apply difficulty filter and show quiz
  startBtn.addEventListener("click", () => {
    applyDifficultyFilter();
    showQuiz();
  });

  // Back: return to player setup step
  backBtn.addEventListener("click", () => setSection("setup-names"));

  // Play again: reload the page from scratch
  againBtn.addEventListener("click", () => location.reload());
});
