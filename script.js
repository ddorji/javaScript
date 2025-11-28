/* =============================================================
  Quiz Battle (Multi-Player) 
  --------------------------------------------------------------
  This file controls all the game logic:
  - loading questions
  - managing players & scores
  - rendering questions and options
  - handling timer in hard mode
============================================================= */

// ============== Question sources & fallback ==============

// Paths (URLs) to JSON files that contain questions.
const QUESTIONS_SOURCES = ["./questions.json"];

// Fallback questions used when JSON file cannot be loaded.
let backupQuestions = [
  {
    questionItem: "Which organization manages hydropower projects in Bhutan?",
    options: [
      "Druk Green Power Corporation",
      "Bhutan Power Corporation",
      "Hydro Bhutan",
      "Royal Energy Agency",
    ],
    answer: "Druk Green Power Corporation",
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

let playerNames = []; // array of player names
let scores = []; // parallel array of scores
let currentPlayer = 0; // index of player whose turn it is
let currentQuestion = 0; // index of current question
let chosenDifficulty = "easy"; // "easy" or "hard"
let playerIndexCounter = 1; // used for label "Player X name"
let answersLog = []; // stores question/answer history

// ============== Timer constants & state ==============

const EASY_MODE_TIMER_SECONDS = 10;
const HARD_MODE_TIMER_SECONDS = 15;

let questionTimerId = null;
let questionTimeLeft = 0;

// ============== functions for DOM access ==============

const byId = (id) => document.getElementById(id);
const selectOne = (selector) => document.querySelector(selector);

// ============== Section / UI helper functions ==============

function setSection(name) {
  document
    .querySelectorAll(".section")
    .forEach((sectionElement) => sectionElement.classList.add("hidden"));

  const el = selectOne(`.section.${name}`);
  if (el) el.classList.remove("hidden");
}

/**
 * Set message text under the player name input.
 * If text is empty or undefined, clears the message.
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
  for (const url of QUESTIONS_SOURCES) {
    try {
      const response = await fetch(url, { cache: "no-cache" });
      if (!response.ok) continue;

      const data = await response.json();

      if (Array.isArray(data) && data.length) {
        validateQuestions(data);

        backupQuestions = data.map((questionItem) => ({
          ...questionItem,
          difficulty: questionItem.difficulty || undefined,
        }));

        console.log(
          "[Quiz] Loaded questions from",
          url,
          `(${backupQuestions.length})`
        );
        return;
      }
    } catch (showError) {
      console.warn("[Quiz] Failed to load", url, showError);
    }
  }

  console.log(
    "[Quiz] Using built-in fallback questions",
    backupQuestions.length
  );
}

//Validate that each question in data has the expected structure.
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

/**
 * Read name from input, validate it, add to playerNames,
 * reset scores array, and update UI.
 */
function addPlayerFromInput() {
  const input = byId("playerNameInput");
  if (!input) return;

  const name = input.value.trim();
  if (!name) {
    setMsg("Please enter a name.");
    return;
  }

  playerNames.push(name);
  scores = new Array(playerNames.length).fill(0);

  input.value = "";

  playerIndexCounter = playerNames.length + 1;
  updatePlayerPrompt();
  renderPlayersList();

  setMsg(`Added "${name}". Enter Player ${playerIndexCounter} or continue.`);
}

/**
 * Remove player at a given index from playerNames,
 * reset scores, and refresh UI.
 */
function removePlayerAt(index) {
  playerNames.splice(index, 1);
  scores = new Array(playerNames.length).fill(0);

  playerIndexCounter = playerNames.length + 1;
  updatePlayerPrompt();
  renderPlayersList();

  setMsg("Player removed.");
}

//Update the label above the input field to show "Player X name".
function updatePlayerPrompt() {
  const playerLabel = byId("playerPrompt");
  if (playerLabel) {
    const nextIndex = playerNames.length + 1;
    playerLabel.innerText = `Player ${nextIndex} name`;
  }
}

//Render the current players into the <ul id="playersList">.
function renderPlayersList() {
  const ul = byId("playersList");
  if (!ul) return;

  ul.innerHTML = "";

  playerNames.forEach((playerName, i) => {
    const listItem = document.createElement("li");
    listItem.className =
      "flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2";
    listItem.innerHTML = `<span>${playerName}</span>`;

    const playerRemove = document.createElement("button");
    playerRemove.type = "button";
    playerRemove.setAttribute("aria-label", `Remove ${playerName}`);
    playerRemove.textContent = "✕";
    playerRemove.className =
      "ml-3 px-2 py-1 rounded-md bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition";
    playerRemove.onclick = () => removePlayerAt(i);

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
    pool = backupQuestions.filter(
      (questionItem) =>
        !questionItem.difficulty || questionItem.difficulty === "easy"
    );
  } else {
    const hardOnly = backupQuestions.filter(
      (questionItem) => questionItem.difficulty === "hard"
    );
    pool = hardOnly.length ? hardOnly : backupQuestions.slice();
  }

  if (!pool.length) pool = backupQuestions.slice();

  shuffleArray(pool);
  backupQuestions = pool;

  currentQuestion = 0;
  currentPlayer = 0;
  scores = new Array(playerNames.length).fill(0);
}

/**
 * Fisher–Yates shuffle for randomizing an array in-place.
 */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ============== Quiz flow: rendering & transitions ==============

function showQuiz() {
  setSection("quiz");
  renderQuestion();
}

/**
 * Render the current question, options, progress, and timer.
 */
function renderQuestion() {
  if (currentQuestion >= backupQuestions.length) return endGame();

  byId("playerTurn").innerText = playerNames.length
    ? `It's ${playerNames[currentPlayer]}'s turn`
    : "Question";

  const questionObject = backupQuestions[currentQuestion];
  byId("question").innerText = questionObject.questionItem;

  const optDiv = byId("options");
  optDiv.innerHTML = "";
  questionObject.options.forEach((answerOption) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerText = answerOption;
    btn.className =
      "w-full px-4 py-2 rounded-lg bg-indigo-400 text-white font-semibold shadow hover:bg-indigo-500 transition text-left";
    btn.onclick = () => onAnswer(answerOption);
    optDiv.appendChild(btn);
  });

  byId("progressBar").innerText = `Question ${currentQuestion + 1} / ${
    backupQuestions.length
  }`;

  clearTimer();

  const secondsForThisQuestion =
    chosenDifficulty === "hard"
      ? HARD_MODE_TIMER_SECONDS
      : EASY_MODE_TIMER_SECONDS;

  startTimer(secondsForThisQuestion);
}

/**
 * Handle a player's selected answer.
 */
function onAnswer(selected) {
  const questionObject = backupQuestions[currentQuestion];
  const correct = questionObject.answer;
  const isCorrect = selected === correct;

  answersLog.push({
    playerIndex: currentPlayer,
    playerName: playerNames[currentPlayer],
    questionNumber: currentQuestion + 1,
    question: questionObject.questionItem,
    options: questionObject.options,
    selectedAnswer: selected,
    correctAnswer: correct,
    isCorrect: isCorrect,
  });

  if (isCorrect) {
    scores[currentPlayer]++;
  }

  nextTurn();
}

/**
 * Advance to next player.
 * After last player, move to next question.
 */
function nextTurn() {
  currentPlayer++;

  if (currentPlayer >= playerNames.length) {
    currentPlayer = 0;
    currentQuestion++;
  }

  if (currentQuestion >= backupQuestions.length) {
    endGame();
  } else {
    renderQuestion();
  }
}

/**
 * Stop timer, switch to results section, and render scores and review.
 */
function endGame() {
  clearTimer();
  setSection("results");
  renderScores();
  renderAnswersReview();
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

/**
 * Show a detailed list of each question and what each player answered.
 */
function renderAnswersReview() {
  const reviewDiv = byId("answersReview");
  if (!reviewDiv) return;

  reviewDiv.innerHTML = "";

  if (!answersLog.length) {
    reviewDiv.innerText = "No answers were recorded.";
    return;
  }

  answersLog.forEach((entry) => {
    const wrapper = document.createElement("div");
    wrapper.className = "border border-gray-200 rounded-lg p-3 bg-gray-50";

    const header = document.createElement("p");
    header.className = "font-semibold text-gray-800";
    header.innerText = `Q${entry.questionNumber}. ${entry.question}`;
    wrapper.appendChild(header);

    const playerLine = document.createElement("p");
    playerLine.className = "text-xs text-gray-500 mb-1";
    playerLine.innerText = `Player: ${entry.playerName}`;
    wrapper.appendChild(playerLine);

    const selectedLine = document.createElement("p");
    selectedLine.className = "mt-1";
    selectedLine.innerHTML = `<span class="font-medium">Your answer:</span> ${entry.selectedAnswer}`;
    wrapper.appendChild(selectedLine);

    const correctLine = document.createElement("p");
    correctLine.innerHTML = `<span class="font-medium">Correct answer:</span> ${entry.correctAnswer}`;
    wrapper.appendChild(correctLine);

    const resultLine = document.createElement("p");
    resultLine.className =
      "mt-1 font-semibold " +
      (entry.isCorrect ? "text-emerald-600" : "text-rose-600");
    resultLine.innerText = entry.isCorrect ? "✅ Correct" : "❌ Incorrect";
    wrapper.appendChild(resultLine);

    reviewDiv.appendChild(wrapper);
  });
}

// ============== Hard mode timer ==============

function startTimer(totalSeconds) {
  questionTimeLeft = totalSeconds;
  byId("timer").innerText = `⏳ ${questionTimeLeft}s`;

  questionTimerId = setInterval(() => {
    questionTimeLeft--;

    if (questionTimeLeft <= 0) {
      clearTimer();
      nextTurn();
      return;
    }

    byId("timer").innerText = `⏳ ${questionTimeLeft}s`;
  }, 1000);
}

function clearTimer() {
  if (questionTimerId) {
    clearInterval(questionTimerId);
    questionTimerId = null;
  }
}

// ============== App initialization ==============

window.addEventListener("DOMContentLoaded", async () => {
  await loadQuestions();

  const addBtn = byId("addPlayerBtn");
  const contBtn = byId("continueToDifficultyBtn");
  const input = byId("playerNameInput");

  if (!addBtn || !contBtn || !input) {
    console.error("[Quiz] Setup elements missing.");
    return;
  }

  setSection("setup-names");

  addBtn.addEventListener("click", addPlayerFromInput);

  input.addEventListener("keydown", (playerEnter) => {
    if (playerEnter.key === "Enter") {
      playerEnter.preventDefault();
      addPlayerFromInput();
    }
  });

  contBtn.addEventListener("click", () => {
    if (playerNames.length < 1) {
      setMsg("Add at least one player before continuing.");
      return;
    }
    setSection("setup-difficulty");
  });

  document
    .querySelectorAll('input[name="difficulty"]')
    .forEach((difficultOption) => {
      difficultOption.addEventListener("change", () => {
        chosenDifficulty = difficultOption.value;
      });
    });

  const startBtn = byId("startGameBtn");
  const backBtn = byId("backToNamesBtn");
  const againBtn = byId("playAgainBtn");

  startBtn.addEventListener("click", () => {
    applyDifficultyFilter();
    showQuiz();
  });

  backBtn.addEventListener("click", () => setSection("setup-names"));

  againBtn.addEventListener("click", () => location.reload());
});
