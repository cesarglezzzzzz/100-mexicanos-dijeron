// game.js
import { QUESTIONS_DATA } from './data.js';

// DOM
const setupForm = document.getElementById("setup-form");
const welcomeScreen = document.getElementById("welcome-screen");
const gameScreen = document.getElementById("game-screen");
const endScreen = document.getElementById("end-screen");

const team1Input = document.getElementById("team1-name");
const team2Input = document.getElementById("team2-name");

const team1Display = document.getElementById("team1-name-display");
const team2Display = document.getElementById("team2-name-display");
const team1PlayersDisplay = document.getElementById("team1-players-display");
const team2PlayersDisplay = document.getElementById("team2-players-display");

const scoreTeam1 = document.getElementById("score-team-1");
const scoreTeam2 = document.getElementById("score-team-2");

const currentTeamName = document.getElementById("current-team-name");
const currentPlayerName = document.getElementById("current-player-name");
const currentQuestionEl = document.getElementById("current-question");
const answersList = document.getElementById("answers-list");

const answerInput = document.getElementById("answer-input");
const submitAnswerBtn = document.getElementById("submit-answer-btn");
const nextRoundBtn = document.getElementById("next-round-btn");
const restartBtn = document.getElementById("restart-btn");
const restartBtnFinal = document.getElementById("restart-btn-final");

const winnerMessage = document.getElementById("winner-message");
const finalScore = document.getElementById("final-score");

// Modal de robo
const stealModal = document.getElementById("steal-modal");
const stealMessage = document.getElementById("steal-message");
const stealInput = document.getElementById("steal-input");
const stealSubmitBtn = document.getElementById("steal-submit-btn");

// Sonidos
const correctSound = document.getElementById("correct-sound");
const wrongSound = document.getElementById("wrong-sound");

// Confetti (from CDN global confetti)
const fireConfetti = (opts = {}) => {
  if (typeof confetti === "function") {
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.3 },
      ...opts
    });
  }
};

// Estado
let team1Name = "", team2Name = "";
let team1Players = [], team2Players = [];
let teamIndices = [0, 0]; // índice del jugador actual por equipo
let scores = [0, 0];
let currentRound = 1;
const MAX_ROUNDS = 3;
let currentTeam = 0; // 0 o 1, equipo en turno
let errors = 0;
let roundPoints = 0;
let currentQuestion = null;
let revealed = [];
let usedQuestionIndices = [];

// Helpers
const showScreen = (id) => {
  [welcomeScreen, gameScreen, endScreen].forEach(s => s.classList.toggle('active', s.id === id));
};

const pickRandomQuestionIndex = () => {
  if (usedQuestionIndices.length >= QUESTIONS_DATA.length) usedQuestionIndices = [];
  let idx;
  do {
    idx = Math.floor(Math.random() * QUESTIONS_DATA.length);
  } while (usedQuestionIndices.includes(idx));
  usedQuestionIndices.push(idx);
  return idx;
};

const play = (audioEl) => {
  if (!audioEl) return;
  try { audioEl.currentTime = 0; audioEl.play(); } catch(e) {}
};

const updateScoreUI = () => {
  scoreTeam1.textContent = scores[0];
  scoreTeam2.textContent = scores[1];
};

const updateTurnUI = () => {
  currentTeamName.textContent = currentTeam === 0 ? team1Name : team2Name;
  const idx = teamIndices[currentTeam];
  const playerName = currentTeam === 0 ? team1Players[idx] : team2Players[idx];
  currentPlayerName.textContent = playerName || "Jugador";
  // resaltar el jugador actual en la lista (si quieres, se podría mejorar visualmente)
};

const resetRoundState = () => {
  errors = 0;
  roundPoints = 0;
  revealed = [];
  if(answerInput) answerInput.value = "";
};

const renderQuestionUI = () => {
  if(!currentQuestion) return;
  currentQuestionEl.textContent = currentQuestion.question;
  answersList.innerHTML = "";
  currentQuestion.answers.forEach((ans, i) => {
    const div = document.createElement('div');
    div.className = 'answer-item';
    div.dataset.index = i;
    div.innerHTML = `<span class="answer-text">${i+1}. ${ans.text}</span><span class="answer-score">${ans.score}</span>`;
    answersList.appendChild(div);
    revealed[i] = false;

    // click para revelar (útil si el host quiere mostrar manualmente)
    div.addEventListener('click', () => revealAnswer(i));
  });
};

const revealAnswer = (index) => {
  if(revealed[index]) return;
  const tile = answersList.querySelector(`.answer-item[data-index="${index}"]`);
  if(!tile) return;
  revealed[index] = true;
  tile.classList.add('revealed');
  roundPoints += Number(currentQuestion.answers[index].score || 0);

  play(correctSound);

  // si todas reveladas -> finalizar ronda
  if(revealed.every(r => r)){
    // confetti de celebración
    fireConfetti();
    // concluye a favor del equipo actual (quien haya conseguido la última respuesta)
    concludeRound(currentTeam);
  }
};

const handleAnswerSubmitted = () => {
  const answerText = (answerInput.value || "").trim().toLowerCase();
  if(!answerText) return;
  answerInput.value = "";

  // Buscar respuesta exacta no revelada
  let foundIndex = currentQuestion.answers.findIndex((a,i) => !revealed[i] && a.text.trim().toLowerCase() === answerText);

  if(foundIndex !== -1){
    revealAnswer(foundIndex);
    errors = 0;
    return;
  }

  // Error
  play(wrongSound);
  errors++;

  if(errors >= 3){
    // Modal de robo
    const otherTeam = currentTeam === 0 ? 1 : 0;
    stealMessage.textContent = `${otherTeam === 0 ? team1Name : team2Name} ¡Oportunidad de robo!`;
    stealModal.classList.add('active');
    stealInput.value = "";
    stealInput.focus();

    stealSubmitBtn.onclick = () => {
      const guess = (stealInput.value || "").trim().toLowerCase();
      stealModal.classList.remove('active');

      if(!guess){
        alert("No ingresaste respuesta. Se concede la ronda al equipo original.");
        concludeRound(currentTeam);
        return;
      }

      const stealIndex = currentQuestion.answers.findIndex((a,i)=>!revealed[i] && a.text.trim().toLowerCase()===guess);
      if(stealIndex !== -1){
        // revelar y dar la ronda al equipo que robó
        revealAnswer(stealIndex);
        concludeRound(otherTeam);
      } else {
        alert("Robo fallido. Se concede la ronda al equipo original.");
        concludeRound(currentTeam);
      }
    };
  }
};

const concludeRound = (winner) => {
  // Sumar puntos al equipo ganador
  scores[winner] += roundPoints;
  updateScoreUI();

  submitAnswerBtn.disabled = true;
  answerInput.disabled = true;

  // aviso
  setTimeout(()=> {
    alert(`Ronda ${currentRound} ganada por ${winner===0?team1Name:team2Name} (+${roundPoints} pts)`);
  }, 80);

  // Avanzar jugador del equipo ganador (rotación)
  teamIndices[winner] = (teamIndices[winner] + 1) % 4;

  currentRound++;
  if(currentRound > MAX_ROUNDS){
    // finalizar juego
    endGame();
  } else {
    nextRoundBtn.style.display = 'inline-block';
    restartBtn.style.display = 'inline-block';
  }
};

const handleNextRound = () => {
  resetRoundState();
  submitAnswerBtn.disabled = false;
  answerInput.disabled = false;
  nextRoundBtn.style.display = 'none';
  restartBtn.style.display = 'none';

  // cambiar turno aleatorio (o podrías alternar: currentTeam = 1 - currentTeam)
  currentTeam = Math.random() < 0.5 ? 0 : 1;
  // actualizar UI (nombre de equipo + jugador)
  updateTurnUI();

  // nueva pregunta
  const idx = pickRandomQuestionIndex();
  currentQuestion = JSON.parse(JSON.stringify(QUESTIONS_DATA[idx]));
  renderQuestionUI();
};

const endGame = () => {
  showScreen('end-screen');
  if(scores[0] > scores[1]) winnerMessage.textContent = `🏆 Ganó ${team1Name}!`;
  else if(scores[1] > scores[0]) winnerMessage.textContent = `🏆 Ganó ${team2Name}!`;
  else winnerMessage.textContent = `🤝 ¡Empate!`;

  finalScore.textContent = `${team1Name}: ${scores[0]}  —  ${team2Name}: ${scores[1]}`;
};

// EVENTOS
setupForm.addEventListener('submit', e => {
  e.preventDefault();

  team1Name = (team1Input.value || "Equipo 1").trim();
  team2Name = (team2Input.value || "Equipo 2").trim();

  team1Players = Array.from(document.querySelectorAll('.team1-player')).map((i, idx) => (i.value && i.value.trim()) ? i.value.trim() : `T1-J${idx+1}`);
  team2Players = Array.from(document.querySelectorAll('.team2-player')).map((i, idx) => (i.value && i.value.trim()) ? i.value.trim() : `T2-J${idx+1}`);

  // reset índices y puntajes
  teamIndices = [0, 0];
  scores = [0, 0];
  currentRound = 1;

  // actualizar UI de equipos y jugadores
  team1Display.textContent = team1Name;
  team2Display.textContent = team2Name;
  team1PlayersDisplay.textContent = team1Players.join(" • ");
  team2PlayersDisplay.textContent = team2Players.join(" • ");

  updateScoreUI();

  // empezar con pregunta aleatoria
  const idx = pickRandomQuestionIndex();
  currentQuestion = JSON.parse(JSON.stringify(QUESTIONS_DATA[idx]));
  currentTeam = Math.random() < 0.5 ? 0 : 1;

  resetRoundState();
  renderQuestionUI();
  updateTurnUI();

  showScreen('game-screen');

  submitAnswerBtn.disabled = false;
  answerInput.disabled = false;
  nextRoundBtn.style.display = 'none';
  restartBtn.style.display = 'none';
});

submitAnswerBtn.addEventListener('click', e => { e.preventDefault(); handleAnswerSubmitted(); });
answerInput.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); handleAnswerSubmitted(); }});
nextRoundBtn.addEventListener('click', handleNextRound);
restartBtn.addEventListener('click', ()=>{ if(confirm("¿Reiniciar el juego? Se perderán los puntajes actuales.")){ showScreen('welcome-screen'); }});
if (restartBtnFinal) restartBtnFinal.addEventListener('click', ()=>{ showScreen('welcome-screen'); });

// Init
showScreen('welcome-screen');


