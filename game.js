'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap = (v, max) => ((v % max) + max) % max;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

// Formas fijas para asteroides grandes (size 3): cada entrada es un polígono
// normalizado ([x, y] como fracción del radio). `null` = polígono random clásico.
const LARGE_ASTEROID_SHAPES = [
  null,
  [
    [0.930, 0.011], [0.782, 0.561], [0.282, 0.547], [0.049, 0.934],
    [-0.635, 0.596], [-0.959, 0.018], [-0.804, -0.595], [-0.092, -0.983],
    [0.507, -0.799], [0.380, -0.228], [0.944, -0.052],
  ],
];

class Asteroid {
  constructor(x, y, size = 3) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    const fixedShape = size === 3
      ? LARGE_ASTEROID_SHAPES[randInt(0, LARGE_ASTEROID_SHAPES.length - 1)]
      : null;

    if (fixedShape) {
      this.verts = fixedShape.map(([nx, ny]) => [nx * this.radius, ny * this.radius]);
    } else {
      // Polígono irregular
      const n = randInt(8, 13);
      this.verts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = this.radius * rand(0.6, 1.0);
        this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
    }
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x = W / 2;
    this.y = H / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.radius = 12;
    this.thrusting = false;
    this.invincible = 3;
    this.shootCooldown = 0;
    this.tripleShot = 0;
    this.shield = 0;
    this.dead = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.tripleShot > 0) this.tripleShot -= dt;
    if (this.shield > 0) this.shield -= dt;

    const ROT = 3.5;   // rad/s
    const THRUST = 260;  // px/s²
    const DRAG = 0.987;

    if (keys['ArrowLeft']) this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShot > 0) {
      return [-TRIPLE_SPREAD, 0, TRIPLE_SPREAD].map(d => new Bullet(ox, oy, this.angle + d));
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;

    // Escudo: pulso constante, parpadeo rápido en el último segundo
    if (this.shield > 0 && (this.shield > 1 || Math.floor(this.shield * 10) % 2 === 0)) {
      const pulse = Math.sin(performance.now() / 120);
      ctx.save();
      ctx.strokeStyle = `rgba(68,255,136,${(0.75 + pulse * 0.25).toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, SHIELD_RADIUS + pulse * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo(20, 0);   // nariz
    ctx.lineTo(-12, -9);   // ala izquierda
    ctx.lineTo(-7, 0);   // muesca trasera
    ctx.lineTo(-12, 9);   // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8, 4);
      ctx.strokeStyle = 'rgba(255, 130, 0, 0.85)';
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Power-ups: Disparo Triple y Escudo ────────────────────────────────────────
const POWERUP_CHANCE = 0.12;        // probabilidad por asteroide destruido
const TRIPLE_SHOT_DURATION = 5;     // segundos
const TRIPLE_SPREAD = 0.2;          // rad entre balas del abanico
const SHIELD_DURATION = 5;          // segundos
const SHIELD_RADIUS = 24;
const SHIELD_GRACE = 0.5;           // invencibilidad tras absorber un golpe

class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;               // 'triple' | 'shield'
    this.radius = 10;
    const angle = rand(0, Math.PI * 2);
    this.vx = Math.cos(angle) * 20;
    this.vy = Math.sin(angle) * 20;
    this.t = 0;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.t += dt;
  }

  draw() {
    const pulse = 1 + Math.sin(this.t * 6) * 0.15;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = this.type === 'shield' ? '#4f8' : '#0ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * pulse, 0, Math.PI * 2);
    ctx.stroke();
    if (this.type === 'shield') {
      // Anillo interior
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Tres líneas en abanico
      ctx.beginPath();
      for (const a of [-0.5, 0, 0.5]) {
        ctx.moveTo(0, 5);
        ctx.lineTo(Math.sin(a) * 8, 5 - Math.cos(a) * 11);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles;
let powerUps, pendingPowerUps;   // en pantalla / tipos que faltan soltar este nivel
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function initGame() {
  ship = new Ship();
  bullets = [];
  asteroids = [];
  particles = [];
  powerUps = [];
  pendingPowerUps = ['triple', 'shield'];
  score = 0;
  lives = 3;
  level = 1;
  state = 'playing';
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  pendingPowerUps = ['triple', 'shield'];
  bullets = [];
  particles = [];
  const { tripleShot, shield } = ship;
  ship.reset();
  ship.tripleShot = tripleShot;
  ship.shield = shield;
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state = 'dead';
    deadTimer = 2;
  }
}

// El escudo absorbe el golpe: el asteroide rebota alejándose de la nave
function absorbHit(a) {
  let nx = a.x - ship.x;
  let ny = a.y - ship.y;
  const d = Math.hypot(nx, ny) || 1;
  nx /= d;
  ny /= d;
  const speed = Math.max(Math.hypot(a.vx, a.vy), SPEEDS[a.size]);
  a.vx = nx * speed;
  a.vy = ny * speed;
  const sep = SHIELD_RADIUS + a.radius * 0.82 + 1;
  a.x = wrap(ship.x + nx * sep, W);
  a.y = wrap(ship.y + ny * sep, H);
  explode(ship.x + nx * SHIELD_RADIUS, ship.y + ny * SHIELD_RADIUS, 4);
  ship.shield = 0;
  ship.invincible = SHIELD_GRACE;
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    powerUps.forEach(p => p.update(dt));
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));
  powerUps.forEach(p => p.update(dt));

  bullets = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += POINTS[a.size];
        explode(a.x, a.y, a.size * 5);
        // Cada nivel suelta Triple y Escudo: al azar de a uno en pantalla; si es el
        // último asteroide, se sueltan todos los que falten
        const isLast = newAsteroids.length === 0 && a.size === 1 && asteroids.every(x => x.dead);
        if (isLast) {
          pendingPowerUps.splice(0).forEach((type, i) =>
            powerUps.push(new PowerUp(a.x + i * 24, a.y, type)));
        } else if (pendingPowerUps.length && powerUps.length === 0 && Math.random() < POWERUP_CHANCE) {
          const type = pendingPowerUps.splice(randInt(0, pendingPowerUps.length - 1), 1)[0];
          powerUps.push(new PowerUp(a.x, a.y, type));
        }
        newAsteroids.push(...a.split());
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets = bullets.filter(b => !b.dead);

  // Nave vs asteroide
  if (ship.invincible <= 0) {
    for (const a of asteroids) {
      const r = ship.shield > 0 ? SHIELD_RADIUS : ship.radius;
      if (dist(ship, a) < r + a.radius * 0.82) {
        if (ship.shield > 0) absorbHit(a);
        else killShip();
        break;
      }
    }
  }

  // Recoger power-up
  if (state === 'playing') {
    for (const p of powerUps) {
      if (dist(ship, p) < ship.radius + p.radius) {
        if (p.type === 'shield') ship.shield = SHIELD_DURATION;
        else ship.tripleShot = TRIPLE_SHOT_DURATION;
        explode(p.x, p.y, 6);
        p.dead = true;
      }
    }
    powerUps = powerUps.filter(p => !p.dead);
  }

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  let hudY = 46;
  ctx.textAlign = 'left';
  if (ship.tripleShot > 0) {
    ctx.fillStyle = '#0ff';
    ctx.fillText(`TRIPLE ${Math.ceil(ship.tripleShot)}s`, 14, hudY);
    hudY += 20;
  }
  if (ship.shield > 0) {
    ctx.fillStyle = '#4f8';
    ctx.fillText(`SHIELD ${Math.ceil(ship.shield)}s`, 14, hudY);
  }
}

function drawOverlay(title, sub) {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font = '18px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  powerUps.forEach(p => p.draw());
  bullets.forEach(b => b.draw());
  ship.draw();

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
