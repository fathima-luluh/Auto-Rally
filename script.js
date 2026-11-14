
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const coinsDisplay = document.getElementById("coins");
const lapDisplay = document.getElementById("lap");
const timerDisplay = document.getElementById("timer");
const bestDisplay = document.getElementById("best-time");
const message = document.getElementById("message");
const startButton = document.getElementById("start-btn");
const muteButton = document.getElementById("mute-btn");
const leftButton = document.getElementById("left-btn");
const rightButton = document.getElementById("right-btn");

const CENTER_X = 210;
const CENTER_Y = 300;
const TOTAL_LAPS = 3;
const LAP_DISTANCE = Math.PI * 2;
const TOTAL_DISTANCE = LAP_DISTANCE * TOTAL_LAPS;

let running = false;
let progress = 0;
let coins = 0;
let lives = 3;
let lane = 0;
let steering = 0;
let startTime = 0;
let elapsedTime = 0;
let lastFrame = 0;
let invulnerableUntil = 0;
let shieldUntil = 0;
let muted = false;
let audioContext = null;
let objects = [];

let bestTime = Number(localStorage.getItem("autoRallyBestTime")) || 0;

function formatTime(milliseconds) {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    const centiseconds = Math.floor((milliseconds % 1000) / 10);

    return (
        String(minutes).padStart(2, "0") + ":" +
        String(seconds).padStart(2, "0") + "." +
        String(centiseconds).padStart(2, "0")
    );
}

function updateBestDisplay() {
    bestDisplay.textContent = bestTime
        ? formatTime(bestTime)
        : "Not set";
}

function updateHUD() {
    coinsDisplay.textContent = coins;
    lapDisplay.textContent =
        Math.min(Math.floor(progress / LAP_DISTANCE) + 1, TOTAL_LAPS)
        + " / " + TOTAL_LAPS;
    timerDisplay.textContent = formatTime(elapsedTime);
}

function playSound(frequency = 500, duration = 0.12) {
    if (muted) return;

    try {
        if (!audioContext) {
            audioContext = new (
                window.AudioContext || window.webkitAudioContext
            )();
        }

        if (audioContext.state === "suspended") {
            audioContext.resume();
        }

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.frequency.value = frequency;
        oscillator.type = "sine";

        gain.gain.setValueAtTime(0.12, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.001,
            audioContext.currentTime + duration
        );

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
        console.log("Sound is unavailable in this browser.");
    }
}

function createObjects() {
    objects = [];

    for (let lap = 0; lap < TOTAL_LAPS; lap++) {
        for (let i = 0; i < 12; i++) {
            const angle = 0.35 + i * 0.49 + Math.random() * 0.18;
            const random = Math.random();

            let type = "coin";

            if (random < 0.28) {
                type = "obstacle";
            } else if (random < 0.38) {
                type = "power";
            }

            objects.push({
                type,
                progress: lap * LAP_DISTANCE + angle,
                lane: [-25, 0, 25][Math.floor(Math.random() * 3)],
                collected: false
            });
        }
    }
}

function roadPosition(angle, laneOffset = 0) {
    const radiusX = 135 + laneOffset;
    const radiusY = 215 + laneOffset;

    return {
        x: CENTER_X + radiusX * Math.cos(angle),
        y: CENTER_Y + radiusY * Math.sin(angle)
    };
}

function drawRoad() {
    ctx.fillStyle = "#285b35";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Outer road border
    ctx.beginPath();
    ctx.ellipse(CENTER_X, CENTER_Y, 175, 255, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "#eeeeee";
    ctx.lineWidth = 96;
    ctx.stroke();

    // Asphalt
    ctx.beginPath();
    ctx.ellipse(CENTER_X, CENTER_Y, 175, 255, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "#454b52";
    ctx.lineWidth = 88;
    ctx.stroke();

    // Inner road border
    ctx.beginPath();
    ctx.ellipse(CENTER_X, CENTER_Y, 130, 210, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "#eeeeee";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Dashed lane markings
    ctx.beginPath();
    ctx.ellipse(CENTER_X, CENTER_Y, 153, 233, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "#f8d568";
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 13]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Grass in the middle
    ctx.beginPath();
    ctx.ellipse(CENTER_X, CENTER_Y, 85, 165, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#347c43";
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px Arial";
    ctx.textAlign = "center";
    ctx.fillText("AUTO RALLY", CENTER_X, CENTER_Y - 8);
    ctx.font = "12px Arial";
    ctx.fillText("3 LAP RACE", CENTER_X, CENTER_Y + 14);
}

function drawCoin(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd43b";
    ctx.fill();
    ctx.strokeStyle = "#a66b00";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#8b5a00";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText("$", x, y + 4);
}

function drawObstacle(x, y) {
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(-10, -13, 20, 26);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-7, -9, 14, 5);

    ctx.fillStyle = "#222222";
    ctx.fillRect(-13, -9, 4, 8);
    ctx.fillRect(9, -9, 4, 8);
    ctx.fillRect(-13, 5, 4, 8);
    ctx.fillRect(9, 5, 4, 8);

    ctx.restore();
}

function drawPowerUp(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fillStyle = "#36b9ff";
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.fillText("S", x, y + 5);
}

function drawAuto() {
    const angle = -Math.PI / 2 + (progress % LAP_DISTANCE);
    const position = roadPosition(angle, lane);

    ctx.save();
    ctx.translate(position.x, position.y);
    ctx.rotate(angle + Math.PI / 2);

    // Wheels
    ctx.fillStyle = "#111111";
    ctx.fillRect(-15, -15, 7, 12);
    ctx.fillRect(8, -15, 7, 12);
    ctx.fillRect(-15, 8, 7, 12);
    ctx.fillRect(8, 8, 7, 12);

    // Rickshaw body
    ctx.fillStyle = "#f5c542";
    ctx.fillRect(-12, -19, 24, 38);

    // Green roof and body
    ctx.fillStyle = "#159447";
    ctx.fillRect(-11, -13, 22, 24);

    // Windshield
    ctx.fillStyle = "#b9ecff";
    ctx.fillRect(-8, -17, 16, 8);

    // Front light
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-8, -21, 5, 3);
    ctx.fillRect(3, -21, 5, 3);

    // Shield effect
    if (performance.now() < shieldUntil) {
        ctx.beginPath();
        ctx.arc(0, 0, 27, 0, Math.PI * 2);
        ctx.strokeStyle = "#36b9ff";
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    ctx.restore();
}

function drawObjects() {
    for (const object of objects) {
        if (object.collected) continue;

        const distance = object.progress - progress;

        if (distance < 0 || distance > LAP_DISTANCE) continue;

        const angle = -Math.PI / 2 + (object.progress % LAP_DISTANCE);
        const position = roadPosition(angle, object.lane);

        if (object.type === "coin") {
            drawCoin(position.x, position.y);
        } else if (object.type === "obstacle") {
            drawObstacle(position.x, position.y);
        } else {
            drawPowerUp(position.x, position.y);
        }
    }
}

function drawLives() {
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px Arial";
    ctx.textAlign = "center";
    ctx.fillText("❤️".repeat(lives), CENTER_X, 42);
}

function drawGame() {
    drawRoad();
    drawObjects();
    drawAuto();
    drawLives();
}

function startRace() {
    progress = 0;
    coins = 0;
    lives = 3;
    lane = 0;
    steering = 0;
    elapsedTime = 0;
    invulnerableUntil = 0;
    shieldUntil = 0;

    createObjects();

    running = true;
    startTime = performance.now();
    lastFrame = startTime;

    startButton.textContent = "🔄 Restart Race";
    message.textContent = "Race started! Collect coins and avoid obstacles.";

    updateHUD();
    playSound(600, 0.15);
    requestAnimationFrame(gameLoop);
}

function finishRace() {
    running = false;
    steering = 0;

    if (!bestTime || elapsedTime < bestTime) {
        bestTime = elapsedTime;
        localStorage.setItem("autoRallyBestTime", bestTime);
        message.textContent = "🏆 New best time! " + formatTime(bestTime);
    } else {
        message.textContent = "🏁 Race finished! Your time: " + formatTime(elapsedTime);
    }

    updateBestDisplay();
    startButton.textContent = "🏁 Race Again";
    playSound(850, 0.4);
}

function gameOver() {
    running = false;
    steering = 0;
    message.textContent = "💥 Too many crashes! Press Race Again to retry.";
    startButton.textContent = "🏁 Race Again";
    playSound(130, 0.4);
}

function checkObjects(previousProgress, currentProgress) {
    for (const object of objects) {
        if (object.collected) continue;

        if (
            object.progress > previousProgress &&
            object.progress <= currentProgress
        ) {
            object.collected = true;

            const sameLane = Math.abs(object.lane - lane) < 20;

            if (!sameLane) continue;

            if (object.type === "coin") {
                coins++;
                playSound(750, 0.1);
                message.textContent = "🪙 Coin collected!";
            } else if (object.type === "power") {
                shieldUntil = performance.now() + 7000;
                playSound(950, 0.2);
                message.textContent = "🛡️ Shield activated!";
            } else {
                const now = performance.now();

                if (now < shieldUntil) {
                    shieldUntil = 0;
                    message.textContent = "🛡️ Shield protected you!";
                    playSound(650, 0.2);
                } else if (now > invulnerableUntil) {
                    lives--;
                    invulnerableUntil = now + 1500;
                    message.textContent = "💥 Crash! " + lives + " lives left.";
                    playSound(180, 0.25);

                    if (lives <= 0) {
                        gameOver();
                        return;
                    }
                }
            }
        }
    }
}

function gameLoop(timestamp) {
    if (!running) {
        drawGame();
        return;
    }

    const delta = Math.min(timestamp - lastFrame, 50);
    lastFrame = timestamp;

    const previousProgress = progress;

    // Automatic forward movement
    progress += delta * 0.0004;

    // Steering changes the auto's lane
    lane += steering * delta * 0.09;
    lane = Math.max(-25, Math.min(25, lane));

    elapsedTime = timestamp - startTime;

    checkObjects(previousProgress, progress);
    updateHUD();
    drawGame();

    if (!running) return;

    if (progress >= TOTAL_DISTANCE) {
        progress = TOTAL_DISTANCE;
        updateHUD();
        drawGame();
        finishRace();
        return;
    }

    requestAnimationFrame(gameLoop);
}

function setSteering(direction) {
    steering = direction;
}

function stopSteering() {
    steering = 0;
}

document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        event.preventDefault();
        setSteering(-1);
    }

    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        event.preventDefault();
        setSteering(1);
    }
});

document.addEventListener("keyup", (event) => {
    if (
        ["ArrowLeft", "ArrowRight", "a", "d"].includes(event.key)
    ) {
        stopSteering();
    }
});

leftButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    setSteering(-1);
});

rightButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    setSteering(1);
});

[leftButton, rightButton].forEach((button) => {
    button.addEventListener("pointerup", stopSteering);
    button.addEventListener("pointerleave", stopSteering);
    button.addEventListener("pointercancel", stopSteering);
});

startButton.addEventListener("click", startRace);

muteButton.addEventListener("click", () => {
    muted = !muted;
    muteButton.textContent = muted ? "🔇 Sound Off" : "🔊 Sound On";

    if (!muted) playSound(600, 0.1);
});

updateBestDisplay();
updateHUD();
drawGame();
