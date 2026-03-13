const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
  playerHealth: document.getElementById("player-health"),
  demonTide: document.getElementById("demon-tide"),
  score: document.getElementById("score"),
  time: document.getElementById("time"),
  overlay: document.getElementById("overlay"),
  overlayTitle: document.getElementById("overlay-title"),
  overlayMessage: document.getElementById("overlay-message"),
  playerNameInput: document.getElementById("player-name-input"),
  saveScoreBtn: document.getElementById("save-score"),
  playAgainBtn: document.getElementById("play-again"),
  leaderboardList: document.getElementById("leaderboard-list")
};

const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;

const keys = {
  left: false,
  right: false,
  up: false,
  attack: false,
  block: false
};

window.addEventListener("keydown", e => {
  if (e.code === "KeyA") keys.left = true;
  if (e.code === "KeyD") keys.right = true;
  if (e.code === "KeyW" || e.code === "Space") keys.up = true;
  if (e.code === "KeyJ") keys.attack = true;
  if (e.code === "KeyK") keys.block = true;
});

window.addEventListener("keyup", e => {
  if (e.code === "KeyA") keys.left = false;
  if (e.code === "KeyD") keys.right = false;
  if (e.code === "KeyW" || e.code === "Space") keys.up = false;
  if (e.code === "KeyJ") keys.attack = false;
  if (e.code === "KeyK") keys.block = false;
});

class Entity {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
  }

  get left() {
    return this.x;
  }
  get right() {
    return this.x + this.w;
  }
  get top() {
    return this.y;
  }
  get bottom() {
    return this.y + this.h;
  }
}

class Knight extends Entity {
  constructor() {
    const w = 38;
    const h = 68;
    super(120, GAME_HEIGHT - h - 40, w, h);
    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.facing = 1;
    this.attackCooldown = 0;
    this.blocking = false;
    this.invulnTime = 0;
    this.score = 0;
  }

  update(dt, demons) {
    const accel = 750;
    const maxSpeed = 260;
    const jumpVelocity = -430;
    const gravity = 1150;

    if (keys.left) this.vx -= accel * dt;
    if (keys.right) this.vx += accel * dt;
    if (!keys.left && !keys.right) this.vx *= 0.8;

    if (this.vx > maxSpeed) this.vx = maxSpeed;
    if (this.vx < -maxSpeed) this.vx = -maxSpeed;

    if (this.vx > 10) this.facing = 1;
    else if (this.vx < -10) this.facing = -1;

    if (keys.up && this.onGround) {
      this.vy = jumpVelocity;
      this.onGround = false;
    }

    this.vy += gravity * dt;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const groundY = GAME_HEIGHT - 40;
    if (this.bottom >= groundY) {
      this.y = groundY - this.h;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    if (this.left < 40) {
      this.x = 40;
      this.vx = 0;
    }
    if (this.right > GAME_WIDTH - 40) {
      this.x = GAME_WIDTH - 40 - this.w;
      this.vx = 0;
    }

    this.blocking = keys.block;

    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.invulnTime > 0) this.invulnTime -= dt;

    if (keys.attack && this.attackCooldown <= 0) {
      this.performAttack(demons);
      this.attackCooldown = 0.45;
    }
  }

  performAttack(demons) {
    const reach = 64;
    const hitbox = {
      x: this.facing === 1 ? this.right : this.left - reach,
      y: this.top + 10,
      w: reach,
      h: this.h - 20
    };

    demons.forEach(demon => {
      if (!demon.alive) return;
      if (rectsOverlap(hitbox, demon)) {
        demon.takeHit();
        this.score += 25;
      }
    });
  }

  takeHit(damage) {
    if (this.invulnTime > 0) return;
    let finalDamage = damage;
    if (this.blocking) {
      finalDamage = Math.round(damage * 0.35);
    }
    this.health -= finalDamage;
    if (this.health < 0) this.health = 0;
    this.invulnTime = 0.8;
  }

  draw(ctx) {
    const padding = 4;
    ctx.save();
    ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
    ctx.scale(this.facing, 1);

    if (this.invulnTime > 0 && Math.floor(this.invulnTime * 20) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    ctx.fillStyle = "#f4f1e6";
    ctx.beginPath();
    ctx.roundRect(-this.w / 2, -this.h / 2, this.w, this.h, 8);
    ctx.fill();

    ctx.fillStyle = "#c0392b";
    ctx.beginPath();
    ctx.roundRect(2 - this.w / 2, -this.h / 2 + 6, 10, 18, 4);
    ctx.fill();

    ctx.fillStyle = "#555b7a";
    ctx.beginPath();
    ctx.roundRect(-this.w / 2 + padding, -4, this.w - padding * 2, this.h / 2, 8);
    ctx.fill();

    ctx.fillStyle = "#f4d35e";
    ctx.fillRect(-this.w / 2 + 4, -this.h / 2 + 6, 6, this.h / 2 - 12);

    ctx.strokeStyle = "#fefefe";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-this.w / 2 + 6, -this.h / 2 + 6);
    ctx.lineTo(-this.w / 2 + this.w / 2 - 10, -this.h / 2 + 6);
    ctx.stroke();

    ctx.fillStyle = "#f8f8f8";
    ctx.fillRect(-this.w / 2 + this.w / 2 - 12, -this.h / 2 + 4, 6, 10);

    if (this.blocking) {
      ctx.save();
      ctx.translate(this.w / 2 + 10, -this.h / 4);
      ctx.fillStyle = "#f4d35e";
      ctx.beginPath();
      ctx.roundRect(-10, -20, 22, 40, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(20, 11, 3, 0.65)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(0, 18);
      ctx.moveTo(-5, 0);
      ctx.lineTo(5, 0);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.save();
      const swing = Math.max(0, 0.45 - this.attackCooldown);
      const angle = swing * 3.4 + 0.3;
      ctx.translate(this.w / 2 + 10, -this.h / 4);
      ctx.rotate(-angle);
      ctx.fillStyle = "#f5f5f5";
      ctx.fillRect(0, -3, 40, 6);
      ctx.fillStyle = "#f4d35e";
      ctx.fillRect(-4, -6, 10, 12);
      ctx.restore();
    }

    ctx.restore();
  }
}

class Demon extends Entity {
  constructor(x, level) {
    const w = 42;
    const h = 54;
    const groundY = GAME_HEIGHT - 40;
    super(x, groundY - h, w, h);
    this.speed = 90 + level * 12 + Math.random() * 15;
    this.damage = 12 + level * 2;
    this.alive = true;
    this.attackCooldown = 0;
  }

  update(dt, knight) {
    if (!this.alive) return;
    const dir = knight.x < this.x ? -1 : 1;
    this.vx = dir * this.speed;

    this.x += this.vx * dt;

    const groundY = GAME_HEIGHT - 40;
    this.y = groundY - this.h;

    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    if (rectsOverlap(this, knight) && this.attackCooldown <= 0) {
      knight.takeHit(this.damage);
      this.attackCooldown = 0.9;
    }
  }

  takeHit() {
    this.alive = false;
  }

  draw(ctx) {
    if (!this.alive) return;
    ctx.save();
    ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
    ctx.fillStyle = "#e74c3c";
    ctx.beginPath();
    ctx.roundRect(-this.w / 2, -this.h / 2, this.w, this.h, 10);
    ctx.fill();

    ctx.fillStyle = "#fffbf2";
    ctx.beginPath();
    ctx.arc(-8, -10, 4, 0, Math.PI * 2);
    ctx.arc(8, -10, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2c0f1b";
    ctx.beginPath();
    ctx.arc(-8, -10, 2, 0, Math.PI * 2);
    ctx.arc(8, -10, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#2c0f1b";
    ctx.beginPath();
    ctx.moveTo(-10, 4);
    ctx.quadraticCurveTo(0, 12, 10, 4);
    ctx.lineTo(10, 8);
    ctx.quadraticCurveTo(0, 18, -10, 8);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#f8e5c4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-14, -this.h / 2 + 4);
    ctx.lineTo(-6, -this.h / 2 - 14);
    ctx.moveTo(14, -this.h / 2 + 4);
    ctx.lineTo(6, -this.h / 2 - 14);
    ctx.stroke();

    ctx.restore();
  }
}

function rectsOverlap(a, b) {
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  );
}

class Game {
  constructor() {
    this.knight = new Knight();
    this.demons = [];
    this.spawnTimer = 0;
    this.spawnInterval = 2.4;
    this.level = 1;
    this.time = 0;
    this.gameOver = false;
    this.lastTimestamp = 0;
    this.demonPressure = 0;
    this.loop = this.loop.bind(this);
  }

  reset() {
    this.knight = new Knight();
    this.demons = [];
    this.spawnTimer = 0;
    this.spawnInterval = 2.4;
    this.level = 1;
    this.time = 0;
    this.demonPressure = 0;
    this.gameOver = false;
    this.lastTimestamp = performance.now();
    ui.overlay.classList.add("hidden");
    requestAnimationFrame(this.loop);
  }

  start() {
    this.lastTimestamp = performance.now();
    requestAnimationFrame(this.loop);
  }

  spawnDemon() {
    const margin = 80;
    const spawnLeft = Math.random() < 0.5;
    const x = spawnLeft ? 20 : GAME_WIDTH - margin;
    this.demons.push(new Demon(x, this.level));
  }

  update(dt) {
    if (this.gameOver) return;

    this.time += dt;

    const baseInterval = 2.0;
    const difficultyFactor = 0.08;
    this.spawnInterval = Math.max(0.6, baseInterval - this.level * difficultyFactor);
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnDemon();
      if (this.time > 5 && this.time % 15 < 0.04) {
        this.level++;
      }
    }

    this.knight.update(dt, this.demons);

    this.demons.forEach(demon => demon.update(dt, this.knight));

    this.demons = this.demons.filter(d => d.alive || d.x > -80 && d.x < GAME_WIDTH + 80);

    const baseScore = dt * 12;
    const demonsNearby = this.demons.filter(d => d.alive && Math.abs(d.x - this.knight.x) < 220).length;
    const pressureMultiplier = 1 + demonsNearby * 0.32;
    this.knight.score += baseScore * pressureMultiplier;

    if (this.knight.health <= 0) {
      this.endGame(false);
    }

    const pressure = Math.min(1, this.demons.length / 10 + demonsNearby / 6);
    this.demonPressure = this.demonPressure * 0.92 + pressure * 0.08;

    this.updateHud();
  }

  updateHud() {
    const healthRatio = Math.max(0, this.knight.health / this.knight.maxHealth);
    ui.playerHealth.style.width = `${healthRatio * 100}%`;
    const tideRatio = Math.min(1, this.demonPressure);
    ui.demonTide.style.width = `${tideRatio * 100}%`;

    ui.score.textContent = Math.round(this.knight.score).toString();
    ui.time.textContent = `${Math.floor(this.time)}s`;
  }

  drawBackground(ctx) {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, "#1c2541");
    gradient.addColorStop(0.4, "#111827");
    gradient.addColorStop(1, "#050811");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.fillStyle = "rgba(255, 249, 233, 0.95)";
    ctx.beginPath();
    ctx.arc(110, 80, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 249, 233, 0.35)";
    ctx.beginPath();
    ctx.arc(110, 80, 60, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(GAME_WIDTH - 200, GAME_HEIGHT - 240);
    ctx.fillStyle = "#303753";
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(-8 - i * 26, -20, 16, 210);
    }
    ctx.fillStyle = "#f4f1e6";
    ctx.fillRect(-12, -32, 24, 18);
    ctx.fillStyle = "#c0392b";
    ctx.fillRect(-3, -30, 6, 14);
    ctx.restore();

    ctx.fillStyle = "#090d1a";
    ctx.fillRect(0, GAME_HEIGHT - 40, GAME_WIDTH, 40);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const y = GAME_HEIGHT - 40 + i * 6;
      ctx.moveTo(0, y);
      ctx.lineTo(GAME_WIDTH, y);
    }
    ctx.stroke();
  }

  draw(ctx) {
    this.drawBackground(ctx);
    this.knight.draw(ctx);
    this.demons.forEach(d => d.draw(ctx));
  }

  loop(timestamp) {
    const dt = Math.min(0.05, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;
    this.update(dt);
    this.draw(ctx);
    if (!this.gameOver) {
      requestAnimationFrame(this.loop);
    }
  }

  endGame(victory) {
    this.gameOver = true;
    ui.overlayTitle.textContent = victory ? "Victory" : "Fallen Crusader";
    const finalScore = Math.round(this.knight.score);
    const survivedSeconds = Math.floor(this.time);
    ui.overlayMessage.textContent = `Score: ${finalScore} · Time: ${survivedSeconds}s`;
    ui.overlay.classList.remove("hidden");
    this.updateHud();
    this.lastResult = { score: finalScore, survivedSeconds };
    fetchLeaderboard();
  }
}

const game = new Game();
game.start();

ui.playAgainBtn.addEventListener("click", () => {
  game.reset();
});

ui.saveScoreBtn.addEventListener("click", async () => {
  if (!game.lastResult) return;
  const nameRaw = ui.playerNameInput.value.trim();
  const name = nameRaw || "Anonymous";
  try {
    await fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        score: game.lastResult.score,
        survivedSeconds: game.lastResult.survivedSeconds
      })
    });
    await fetchLeaderboard();
  } catch (err) {
    console.error("Failed to save score", err);
  }
});

async function fetchLeaderboard() {
  try {
    const res = await fetch("/api/leaderboard");
    if (!res.ok) throw new Error("Bad response");
    const data = await res.json();
    const scores = Array.isArray(data.scores) ? data.scores : [];
    ui.leaderboardList.innerHTML = "";
    scores.forEach((entry, idx) => {
      const li = document.createElement("li");
      const nameSpan = document.createElement("span");
      nameSpan.className = "name";
      nameSpan.textContent = `${idx + 1}. ${entry.name}`;
      const scoreSpan = document.createElement("span");
      scoreSpan.className = "score";
      scoreSpan.textContent = `${Math.round(entry.score)} · ${Math.floor(
        entry.survivedSeconds || 0
      )}s`;
      li.appendChild(nameSpan);
      li.appendChild(scoreSpan);
      ui.leaderboardList.appendChild(li);
    });
  } catch (err) {
    console.error("Failed to fetch leaderboard", err);
  }
}

