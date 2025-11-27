const canvas = document.getElementById("tetris");
const context = canvas.getContext("2d");
const nextCanvas = document.getElementById("nextPiece");
const nextContext = nextCanvas.getContext("2d");

context.scale(1, 1);

const COLS = 10;
const ROWS = 20;
let blockSize;

const NEXT_SIZE = 4;
let nextBlockSize;

function resize() {
  const maxWidth = Math.min(window.innerWidth * 0.7, 360);
  const maxHeight = window.innerHeight * 0.8;

  blockSize = Math.floor(Math.min(maxWidth / COLS, maxHeight / ROWS));
  if (blockSize < 15) blockSize = 15;

  canvas.width = COLS * blockSize;
  canvas.height = ROWS * blockSize;
  context.setTransform(blockSize, 0, 0, blockSize, 0, 0);

  nextBlockSize = Math.floor(nextCanvas.width / 6);
  nextContext.setTransform(nextBlockSize, 0, 0, nextBlockSize, 0, 0);
}

window.addEventListener("resize", resize);

function createMatrix(w, h) {
  const matrix = [];
  while (h--) matrix.push(new Array(w).fill(0));
  return matrix;
}

const arena = createMatrix(COLS, ROWS);

const colors = [
  null,
  "#FF0D72",
  "#0DC2FF",
  "#0DFF72",
  "#F538FF",
  "#FF8E0D",
  "#FFE138",
  "#3877FF",
  "#FF4444"
];

let dropCounter = 0;
const dropInterval = 300;
let lastTime = 0;
let paused = true;
let animationId;

const player = {
  pos: { x: 0, y: 0 },
  matrix: null,
  score: 0,
};

// === TIMER ===
let gameTime = 0;
let timeLeft = 0;
let timerInterval = null;

// BORDER COUNTER
let borderCount = 0;

// Next piece
let nextPiece = null;
const pieces = "TJLOSZI";

function getRandomPiece() {
  return pieces[(pieces.length * Math.random()) | 0];
}

function drawGrid() {
  context.strokeStyle = "rgba(0, 255, 255, 0.12)";
  context.shadowColor = "rgba(0, 255, 255, 0.4)";
  context.shadowBlur = 6;
  context.lineWidth = 0.05;

  for (let x = 0; x <= COLS; x++) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, ROWS);
    context.stroke();
  }

  for (let y = 0; y <= ROWS; y++) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(COLS, y);
    context.stroke();
  }

  context.shadowBlur = 0;
}

function drawMatrix(matrix, offset, ctx = context) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        ctx.fillStyle = colors[value];
        ctx.fillRect(x + offset.x, y + offset.y, 1, 1);

        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.lineWidth = 0.10;
        ctx.strokeRect(x + offset.x, y + offset.y, 1, 1);
      }
    });
  });
}

function drawNextPiece() {
  nextContext.clearRect(0, 0, 6, 6);

  if (nextPiece) {
    const matrix = createPiece(nextPiece);
    const offsetX = (6 - matrix[0].length) / 2;
    const offsetY = (6 - matrix.length) / 2;
    drawMatrix(matrix, { x: offsetX, y: offsetY }, nextContext);
  }
}

function draw() {
  context.fillStyle = "#000";
  context.fillRect(0, 0, COLS, ROWS);

  drawGrid();
  drawMatrix(arena, { x: 0, y: 0 });
  drawMatrix(player.matrix, player.pos);
  drawNextPiece();
}

function collide(arena, player) {
  const m = player.matrix;
  const o = player.pos;
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < m[y].length; x++) {
      if (m[y][x] !== 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
        return true;
      }
    }
  }
  return false;
}

function merge(arena, player) {
  player.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        arena[y + player.pos.y][x + player.pos.x] = value;
      }
    });
  });
}

function explodeLine(row, callback) {
  const flashes = 6;
  let count = 0;
  let isRed = false;

  const interval = setInterval(() => {
    isRed = !isRed;
    for (let x = 0; x < COLS; x++) {
      arena[row][x] = isRed ? 8 : 0;
    }
    draw();
    count++;
    if (count >= flashes) {
      clearInterval(interval);
      callback();
    }
  }, 100);
}

function arenaSweep() {
  let rowCount = 0;

  return new Promise(async (resolve) => {
    outer: for (let y = arena.length - 1; y >= 0; y--) {
      for (let x = 0; x < COLS; x++) {
        if (arena[y][x] === 0) continue outer;
      }

      rowCount++;
      borderCount++; // FULL → +1 border

      await new Promise((r) => explodeLine(y, r));
      arena.splice(y, 1);
      arena.unshift(new Array(COLS).fill(0));
      y++;
    }

    player.score += rowCount * 50;
    updateScore();
    resolve();
  });
}

function updateScore() {
  document.getElementById("score").textContent = player.score;
}

function createPiece(type) {
  if (type === "T")
    return [[0, 0, 0],[1, 1, 1],[0, 1, 0]];
  if (type === "O")
    return [[2, 2],[2, 2]];
  if (type === "L")
    return [[0, 3, 0],[0, 3, 0],[0, 3, 3]];
  if (type === "J")
    return [[0, 4, 0],[0, 4, 0],[4, 4, 0]];
  if (type === "I")
    return [[0, 5, 0, 0],[0, 5, 0, 0],[0, 5, 0, 0],[0, 5, 0, 0]];
  if (type === "S")
    return [[0, 6, 6],[6, 6, 0],[0, 0, 0]];
  if (type === "Z")
    return [[7, 7, 0],[0, 7, 7],[0, 0, 0]];
}

function playerReset() {
  const pieceType = nextPiece || getRandomPiece();
  player.matrix = createPiece(pieceType);

  nextPiece = getRandomPiece();

  player.pos.y = 0;
  player.pos.x = ((COLS / 2) | 0) - ((player.matrix[0].length / 2) | 0);

  if (collide(arena, player)) {
    arena.forEach((row) => row.fill(0));
    player.score = 0;
    updateScore();

    playAgainBtn.style.display = "block";
    paused = true;
    cancelAnimationFrame(animationId);
    return;
  }
}

function playerDrop() {
  const before = player.pos.y;

  player.pos.y++;
  if (collide(arena, player)) {
    player.pos.y--;
    merge(arena, player);
    arenaSweep().then(() => {
      playerReset();
    });
  }

  const after = player.pos.y;

  if (after === before) {
    borderCount = Math.max(0, borderCount - 1);
  }

  dropCounter = 0;
}

function playerMove(dir) {
  player.pos.x += dir;
  if (collide(arena, player)) player.pos.x -= dir;
}

function rotate(matrix, dir) {
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < y; x++) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }
  if (dir > 0) matrix.forEach((row) => row.reverse());
  else matrix.reverse();
}

function playerRotate(dir) {
  const pos = player.pos.x;
  let offset = 1;
  rotate(player.matrix, dir);
  while (collide(arena, player)) {
    player.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > player.matrix[0].length) {
      rotate(player.matrix, -dir);
      player.pos.x = pos;
      return;
    }
  }
}

function update(time = 0) {
  if (paused) return;

  const deltaTime = time - lastTime;
  lastTime = time;
  dropCounter += deltaTime;

  if (dropCounter > dropInterval) {
    playerDrop();
  }

  draw();
  animationId = requestAnimationFrame(update);
}

function startGame() {
  if (!player.matrix) {
    nextPiece = getRandomPiece();
    playerReset();
  }
  if (paused) {
    paused = false;
    lastTime = performance.now();
    update();
  }
}

function formatTime(t) {
  const m = Math.floor(t / 60).toString().padStart(2, "0");
  const s = (t % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function startTimer() {
  clearInterval(timerInterval);

  const timeDisplay = document.getElementById("timeDisplay");

  if (gameTime === 0) {
    // FREE MODE (COUNT UP)
    timeLeft = 0;
    timerInterval = setInterval(() => {
      timeLeft++;
      timeDisplay.textContent = formatTime(timeLeft);
    }, 1000);
    return;
  }

  // TIMER MODE (COUNT DOWN)
  timeLeft = gameTime;
  timeDisplay.textContent = formatTime(timeLeft);

  timerInterval = setInterval(() => {
    timeLeft--;
    timeDisplay.textContent = formatTime(timeLeft);

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      endGame();
    }
  }, 1000);
}

function endGame() {
  paused = true;
  cancelAnimationFrame(animationId);

  const scoreBox = document.getElementById("score");
  scoreBox.style.color = player.score < 1000 ? "red" : "lime";

  // Tampilkan skor besar di popup Play Again
  playAgainBtn.innerHTML = `
    <div style="font-size:20px;margin-bottom:10px;">Score: 
      <span style="color:${player.score < 1000 ? "red" : "lime"};">
        ${player.score}
      </span>
    </div>
    <i class="fas fa-redo"></i> <span>Play Again</span>
  `;

  playAgainBtn.style.display = "block";
}


function resetGame() {
  paused = true;
  cancelAnimationFrame(animationId);

  arena.forEach((row) => row.fill(0));
  player.score = 0;
  updateScore();

  borderCount = 0;

  nextPiece = getRandomPiece();
  playerReset();
  draw();

  document.getElementById("score").style.color = "white";
}

const playAgainBtn = document.getElementById("playAgainBtn");
const timerMenu = document.getElementById("timerMenu");
const timerOptions = document.getElementById("timerOptions");

playAgainBtn.style.display = "none";

timerMenu.addEventListener("click", () => {
  timerMenu.style.display = "none";
  timerOptions.style.display = "flex";
});

document.querySelectorAll(".timer-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    gameTime = Number(btn.dataset.time);
    resetGame();

    timerOptions.style.display = "none";

    startGame();
    startTimer();
  });
});

playAgainBtn.addEventListener("click", () => {
  resetGame();
  playAgainBtn.style.display = "none";

  timerMenu.style.display = "block";
});

document.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
    event.preventDefault();
  }

  if (paused) return;

  if (event.key === "ArrowLeft") playerMove(-1);
  else if (event.key === "ArrowRight") playerMove(1);
  else if (event.key === "ArrowDown") playerDrop();
  else if (event.key === "ArrowUp") playerRotate(1);
});

document.getElementById("leftBtn").addEventListener("click", () => {
  if (!paused) playerMove(-1);
});
document.getElementById("rightBtn").addEventListener("click", () => {
  if (!paused) playerMove(1);
});
document.getElementById("downBtn").addEventListener("click", () => {
  if (!paused) playerDrop();
});
document.getElementById("rotateBtn").addEventListener("click", () => {
  if (!paused) playerRotate(1);
});

resize();
draw();
