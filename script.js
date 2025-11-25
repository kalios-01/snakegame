/**
 * Snake Game Logic
 * - Grid-based movement
 * - Target score progression
 * - Elapsed timer
 * - Mobile swipe controls
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const scoreEl = document.getElementById('currentScore');
const targetEl = document.getElementById('targetScore');
const highScoreEl = document.getElementById('highScore');
const timerEl = document.getElementById('timer');
const overlay = document.getElementById('overlay');
const levelOverlay = document.getElementById('levelOverlay');
const startBtn = document.getElementById('startBtn');
const nextLevelBtn = document.getElementById('nextLevelBtn');
const statusText = document.getElementById('statusText');

// Game Constants
const GRID_SIZE = 20; // Number of cells per row/col
const MAX_SCORE = 397; // 20x20 - 3 initial segments
let TILE_SIZE = 0; // Calculated based on canvas size

// Assets
const assets = {
    head: {
        up: new Image(), down: new Image(), left: new Image(), right: new Image()
    },
    body: {
        vertical: new Image(), horizontal: new Image(),
        topLeft: new Image(), topRight: new Image(), bottomLeft: new Image(), bottomRight: new Image()
    },
    tail: {
        up: new Image(), down: new Image(), left: new Image(), right: new Image()
    },
    food: new Image()
};

assets.head.up.src = 'assets/head_up.png';
assets.head.down.src = 'assets/head_down.png';
assets.head.left.src = 'assets/head_left.png';
assets.head.right.src = 'assets/head_right.png';

assets.body.vertical.src = 'assets/body_vertical.png';
assets.body.horizontal.src = 'assets/body_horizontal.png';
assets.body.topLeft.src = 'assets/body_topleft.png';
assets.body.topRight.src = 'assets/body_topright.png';
assets.body.bottomLeft.src = 'assets/body_bottomleft.png';
assets.body.bottomRight.src = 'assets/body_bottomright.png';

assets.tail.up.src = 'assets/tail_up.png';
assets.tail.down.src = 'assets/tail_down.png';
assets.tail.left.src = 'assets/tail_left.png';
assets.tail.right.src = 'assets/tail_right.png';

assets.food.src = 'assets/apple.png'; // Default

// Customization Data
const FOOD_OPTIONS = [
    { id: 'apple', src: 'assets/apple.png', label: '🍎' },
    { id: 'banana', src: 'assets/banana.png', label: '🍌' },
    { id: 'cherry', src: 'assets/cherry.png', label: '🍒' }, // Fallback
];

const COLOR_OPTIONS = [
    { id: 'cyan', value: 'hue-rotate(0deg)', label: 'Cyan' }, // Default
    { id: 'green', value: 'hue-rotate(90deg)', label: 'Green' },
    { id: 'purple', value: 'hue-rotate(200deg)', label: 'Purple' },
    { id: 'red', value: 'hue-rotate(150deg) saturate(1.5)', label: 'Red' },
    { id: 'yellow', value: 'hue-rotate(60deg) brightness(1.2)', label: 'Yellow' },
    { id: 'pink', value: 'hue-rotate(280deg)', label: 'Pink' },
    { id: 'blue', value: 'hue-rotate(20deg)', label: 'Blue' }, // Adjusted
    { id: 'gradient', value: 'hue-rotate(0deg) contrast(1.2)', label: 'Gradient' }
];

// Game State
let snake = [];
let food = { x: 0, y: 0 };
let direction = { x: 0, y: 0 };
let nextDirectionQueue = []; // Input buffer
let score = 0;
let targetScore = 10;
let highScore = localStorage.getItem('snakeHighScore') || 0;
let gameRunning = false;
let lastRenderTime = 0;
let snakeSpeed = 5; // Moves per second
let currentSnakeColor = COLOR_OPTIONS[0].value;
let currentFoodSrc = FOOD_OPTIONS[0].src;
let startTime = 0;
let timerInterval;

// Initialize High Score UI
highScoreEl.textContent = highScore;

// Initialize Customization UI
function initCustomization() {
    const foodContainer = document.getElementById('foodOptions');
    const colorContainer = document.getElementById('colorOptions');

    // Food Options
    FOOD_OPTIONS.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'w-10 h-10 rounded-lg bg-purple-800 border border-purple-600 flex items-center justify-center text-xl hover:bg-purple-700 transition focus:outline-none focus:ring-2 focus:ring-cyan-400';
        btn.textContent = opt.label;
        btn.onclick = () => {
            assets.food.src = opt.src;
            currentFoodSrc = opt.src; // Update current food source
            // Visual feedback could be added here
        };
        foodContainer.appendChild(btn);
    });

    // Color Options
    COLOR_OPTIONS.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'w-10 h-10 rounded-lg border border-purple-600 hover:scale-110 transition focus:outline-none focus:ring-2 focus:ring-white';
        btn.style.background = '#2D1B4E'; // Base

        // Preview dot
        const dot = document.createElement('div');
        dot.className = 'w-6 h-6 rounded-full mx-auto';
        dot.style.backgroundColor = '#4ECDC4'; // Base cyan
        dot.style.filter = opt.value;

        btn.appendChild(dot);

        btn.onclick = () => {
            currentSnakeColor = opt.value;
        };
        colorContainer.appendChild(btn);
    });
}
initCustomization();

// Resize Canvas
function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    TILE_SIZE = canvas.width / GRID_SIZE;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Input Handling
document.addEventListener('keydown', handleKeyInput);

// Touch Handling
let touchStartX = 0;
let touchStartY = 0;
canvas.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    e.preventDefault(); // Prevent scrolling
}, { passive: false });

canvas.addEventListener('touchend', e => {
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    handleSwipe(touchStartX, touchStartY, touchEndX, touchEndY);
}, { passive: false });

function handleKeyInput(e) {
    if (!gameRunning) return;

    const lastDir = nextDirectionQueue.length > 0 ? nextDirectionQueue[nextDirectionQueue.length - 1] : direction;

    switch (e.key) {
        case 'ArrowUp':
            if (lastDir.y === 0) nextDirectionQueue.push({ x: 0, y: -1 });
            break;
        case 'ArrowDown':
            if (lastDir.y === 0) nextDirectionQueue.push({ x: 0, y: 1 });
            break;
        case 'ArrowLeft':
            if (lastDir.x === 0) nextDirectionQueue.push({ x: -1, y: 0 });
            break;
        case 'ArrowRight':
            if (lastDir.x === 0) nextDirectionQueue.push({ x: 1, y: 0 });
            break;
    }
}

function handleSwipe(startX, startY, endX, endY) {
    if (!gameRunning) return;
    const dx = endX - startX;
    const dy = endY - startY;

    const lastDir = nextDirectionQueue.length > 0 ? nextDirectionQueue[nextDirectionQueue.length - 1] : direction;

    if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal
        if (dx > 0 && lastDir.x === 0) nextDirectionQueue.push({ x: 1, y: 0 });
        else if (dx < 0 && lastDir.x === 0) nextDirectionQueue.push({ x: -1, y: 0 });
    } else {
        // Vertical
        if (dy > 0 && lastDir.y === 0) nextDirectionQueue.push({ x: 0, y: 1 });
        else if (dy < 0 && lastDir.y === 0) nextDirectionQueue.push({ x: 0, y: -1 });
    }
}

// Game Logic
function startGame() {
    snake = [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }]; // Head at top
    direction = { x: 0, y: -1 }; // Moving up
    nextDirectionQueue = [{ x: 0, y: -1 }];
    score = 0;
    targetScore = 10; // Reset target on new game
    snakeSpeed = 5;

    scoreEl.textContent = score;
    targetEl.textContent = targetScore;

    placeFood();
    gameRunning = true;
    overlay.classList.add('hidden');
    levelOverlay.classList.add('hidden');

    startTimer();

    window.requestAnimationFrame(mainLoop);
}

function nextLevel() {
    snake = [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }];
    direction = { x: 0, y: -1 };
    nextDirectionQueue = [{ x: 0, y: -1 }];

    // Increase target and speed
    targetScore += 5;
    snakeSpeed += 0.5;

    targetEl.textContent = targetScore;

    placeFood();
    gameRunning = true;
    levelOverlay.classList.add('hidden');

    startTimer();

    window.requestAnimationFrame(mainLoop);
}

function startTimer() {
    startTime = Date.now();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 10);
}

function updateTimer() {
    const elapsed = Date.now() - startTime;
    const ms = Math.floor((elapsed % 1000) / 10); // 2 digits
    const s = Math.floor((elapsed / 1000) % 60);
    const m = Math.floor((elapsed / (1000 * 60)) % 60);

    timerEl.textContent = `${pad(m)}:${pad(s)}:${pad(ms)}`;
}

function pad(n) {
    return n.toString().padStart(2, '0');
}

function mainLoop(currentTime) {
    if (!gameRunning) return;

    window.requestAnimationFrame(mainLoop);

    const secondsSinceLastRender = (currentTime - lastRenderTime) / 1000;
    if (secondsSinceLastRender < 1 / snakeSpeed) return;

    lastRenderTime = currentTime;

    update();
    draw();
}

function update() {
    if (nextDirectionQueue.length > 0) {
        direction = nextDirectionQueue.shift();
    }

    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

    // Wall Collision
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        gameOver();
        return;
    }

    // Self Collision
    for (let i = 0; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            gameOver();
            return;
        }
    }

    snake.unshift(head); // Add new head

    // Eat Food
    if (head.x === food.x && head.y === food.y) {
        score++;
        scoreEl.textContent = score;

        // Max Score Check
        if (score >= MAX_SCORE) {
            gameOver(true); // Victory
            return;
        }

        // Target Progression
        if (score >= targetScore) {
            levelCleared();
            return;
        }

        placeFood();
    } else {
        snake.pop(); // Remove tail
    }
}

function levelCleared() {
    gameRunning = false;
    clearInterval(timerInterval);
    levelOverlay.classList.remove('hidden');
}

function placeFood() {
    let valid = false;
    while (!valid) {
        food.x = Math.floor(Math.random() * GRID_SIZE);
        food.y = Math.floor(Math.random() * GRID_SIZE);

        valid = true;
        for (let segment of snake) {
            if (segment.x === food.x && segment.y === food.y) {
                valid = false;
                break;
            }
        }
    }
}

function draw() {
    // Clear Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Grid (Optional, for style)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(i * TILE_SIZE, 0);
        ctx.lineTo(i * TILE_SIZE, canvas.height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i * TILE_SIZE);
        ctx.lineTo(canvas.width, i * TILE_SIZE);
        ctx.stroke();
    }

    // Draw Food
    ctx.drawImage(assets.food, food.x * TILE_SIZE, food.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

    // Draw Snake
    for (let i = 0; i < snake.length; i++) {
        const segment = snake[i];
        let img = null;

        ctx.filter = currentSnakeColor; // Apply selected color filter

        if (i === 0) {
            // HEAD
            if (direction.x === 1) img = assets.head.right;
            else if (direction.x === -1) img = assets.head.left;
            else if (direction.y === 1) img = assets.head.down;
            else if (direction.y === -1) img = assets.head.up;
            else img = assets.head.up; // Default
        } else if (i === snake.length - 1) {
            // TAIL
            const prev = snake[i - 1]; // Segment towards the head
            if (prev.x > segment.x) img = assets.tail.left; // Tail points left
            else if (prev.x < segment.x) img = assets.tail.right;
            else if (prev.y > segment.y) img = assets.tail.up;
            else if (prev.y < segment.y) img = assets.tail.down;
        } else {
            // BODY
            const prev = snake[i - 1]; // Towards head
            const next = snake[i + 1]; // Towards tail

            // Determine relative positions
            const p = { x: prev.x - segment.x, y: prev.y - segment.y };
            const n = { x: next.x - segment.x, y: next.y - segment.y };

            // Straight
            if (p.x === n.x) img = assets.body.vertical;
            else if (p.y === n.y) img = assets.body.horizontal;

            // Corners
            else {
                // Identify connections
                const hasTop = p.y === -1 || n.y === -1;
                const hasBottom = p.y === 1 || n.y === 1;
                const hasLeft = p.x === -1 || n.x === -1;
                const hasRight = p.x === 1 || n.x === 1;

                if (hasTop && hasLeft) img = assets.body.topLeft;
                else if (hasTop && hasRight) img = assets.body.topRight;
                else if (hasBottom && hasLeft) img = assets.body.bottomLeft;
                else if (hasBottom && hasRight) img = assets.body.bottomRight;
            }
        }

        if (img) {
            ctx.drawImage(img, segment.x * TILE_SIZE, segment.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }

        ctx.filter = 'none'; // Reset filter
    }
}

// Helper functions drawRotated and getRotation are no longer needed but kept if we revert
function getRotation(dir) {
    if (dir.x === 1) return 90 * Math.PI / 180;
    if (dir.x === -1) return -90 * Math.PI / 180;
    if (dir.y === 1) return 180 * Math.PI / 180;
    if (dir.y === -1) return 0;
    return 0;
}

function drawRotated(img, x, y, rotation) {
    ctx.save();
    ctx.translate((x + 0.5) * TILE_SIZE, (y + 0.5) * TILE_SIZE);
    ctx.rotate(rotation);
    ctx.drawImage(img, -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
    ctx.restore();
}

function gameOver(victory = false) {
    gameRunning = false;
    clearInterval(timerInterval);

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('snakeHighScore', highScore);
        highScoreEl.textContent = highScore;
    }

    if (victory) {
        statusText.textContent = `YOU WIN! Score: ${score}`;
        statusText.classList.add('text-yellow-400'); // Add highlight
    } else {
        statusText.textContent = `Game Over! Score: ${score}`;
        statusText.classList.remove('text-yellow-400');
    }

    startBtn.textContent = 'PLAY AGAIN';
    overlay.classList.remove('hidden');
}

startBtn.addEventListener('click', startGame);
nextLevelBtn.addEventListener('click', nextLevel);
