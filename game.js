/* ============================================================================
   MOON PATROL — an Atari-style 2D jeep scroller
   ----------------------------------------------------------------------------
   Plain Canvas 2D, no dependencies, no build step.
   Deploy the whole folder to Vercel (or any static host) as-is.

   CONTROLS
     W / ArrowUp    .... jump
     A / ArrowLeft  .... raise the gun barrel (aim up)
     D / ArrowRight .... lower the gun barrel (aim forward)
     Space          .... fire
     B              .... buy menu (spend currency on power-ups)
     P              .... pause / resume
     M              .... mute / unmute
     F              .... toggle fullscreen
     Space / Click  .... start & restart

   See CHANGELOG.md for the version history (current: v0.0.9).

   FILE MAP (all sections are in this one file, top to bottom):
     1. CONFIG        — every tunable number lives here
     2. PALETTE       — the Atari-ish colors
     3. AUDIO         — tiny WebAudio bleep/bloop synth
     4. INPUT         — keyboard + click handling
     5. TERRAIN       — procedural hills, hillier each level
     6. ENTITIES      — jeep, bullets, enemies, particles
     7. GAME STATE    — title / play / pause / game-over machine
     8. UPDATE        — fixed-timestep simulation
     9. RENDER        — all drawing
    10. MAIN LOOP     — timing, resize, fullscreen
   ============================================================================ */

"use strict";

/* ============================================================================
   1. CONFIG — tweak these to rebalance the game
   ============================================================================ */
const CONFIG = {
  // Game version — bump with every change (see CHANGELOG.md).
  version: "0.0.9",

  // Internal render resolution. The game is simulated and drawn at this
  // low resolution, then scaled up with crisp pixels for the retro look.
  viewW: 480,
  viewH: 270,

  // World scrolling (how fast the ground moves right-to-left, px/sec).
  scrollSpeed: 70,
  scrollSpeedPerLevel: 4,      // each level adds this much

  // Jeep
  jeepScreenX: 70,             // fixed distance from the left edge
  jeepW: 26,
  jeepH: 12,
  jumpPower: 215,              // initial upward velocity of a jump (moon-high)
  gravity: 360,                // low gravity: jumps hang and fall slowly

  // Gun (angle in degrees: 0 = horizontal right, -90 = straight up, + = down)
  gunMinAngle: -85,            // highest it can aim
  gunMaxAngle: 45,             // lowest it can aim (downward, for close ground targets)
  gunTurnSpeed: 110,           // degrees per second while holding A/D
  fireRate: 7,                 // player shots per second while holding Space
  bulletSpeed: 320,

  // Enemies
  maxEnemies: 4,               // never more than this on screen at once
  groundEnemySpeed: 26,        // extra leftward speed on top of the scroll
  airEnemySpeed: 34,           // air enemy leftward speed (screen space)
  enemyFireMin: 1.4,           // seconds between enemy shots (best case)
  enemyFireMax: 3.0,           // ... (worst case); shrinks as levels rise
  enemyBulletSpeed: 105,
  enemyBulletSpeedPerLevel: 9,

  // Spawning: seconds between spawn attempts, shrinks with level
  spawnMinBase: 2.2,
  spawnMaxBase: 4.2,
  spawnShrinkPerLevel: 0.22,   // multiplied into both ends each level

  // Levels
  levelLength: 1600,           // px of travel per level
  maxLevel: 10,

  // Terrain: hills grow from "smooth" (level 1) to "wild" (level 10)
  groundBase: 0.80,            // baseline ground height, fraction of viewH
  craterSpacing: 110,          // avg px between moon craters on the surface
  hillAmpStart: 6,             // wave amplitude at level 1 (px)
  hillAmpEnd: 46,              // wave amplitude at max level (px)
  hillFreqStart: 0.006,        // waves per px at level 1 (lower = smoother)
  hillFreqEnd: 0.020,          // waves per px at max level

  // Currency (was "score"): trickles in with distance, plus kill bounties.
  // Spend it in the BUY MENU (press B) — spent currency is gone for good.
  scorePerGroundKill: 100,     // green rover
  scorePerAirKill: 150,        // UFO
  scorePerBomberKill: 300,     // red ship
  scorePerPixel: 0.02,         // trickle of currency for distance travelled

  // Power-ups (buy menu)
  priceSmallShield: 100,       // +1 shield hit
  priceLargeShield: 300,       // +3 shield hits
  priceMissiles: 300,          // auto-fire 45° up-right until you die
  priceHeatSeekers: 500,       // homing red missiles until you die
  missileInterval: 2.5,        // seconds between auto missiles
  missileSpeed: 280,
  heatInterval: 1.8,           // seconds between heat seekers
  heatSpeed: 240,
  heatTurnRate: 4.6,           // radians/sec of homing steer
  shieldInvulnTime: 1.0,       // grace period after a shield absorbs a hit

  // Red bomber saucer: hovers across the top and drops big bombs.
  // Quota per level: 1 on level 1, 2 on level 2, 3 on every level after.
  // When a level ends, any bomber still on screen RETREATS (speeds away and
  // stops bombing) so its ships never leak into the next level's quota.
  bomberSpeed: 40,
  bomberRetreatSpeed: 220,     // how fast they flee when the level ends
  bomberMaxActive: 3,          // at most this many attacking bombers at once
  bomberDropMin: 1.1,          // seconds between bomb drops (min)
  bomberDropMax: 2.0,          // ... (max)
  bombDrift: -12,              // slight leftward drift as the bomb falls
  bombGravity: 0.55,           // fraction of normal gravity

  // Meteors (appear from level 3): fall from the top-right, slam down right
  // of center, then roll left toward the jeep. INDESTRUCTIBLE — jump them!
  meteorMinGap: 5,             // seconds between meteors (min)
  meteorMaxGap: 9,             // ... (max)
  meteorFallTime: 1.1,         // seconds from spawn to ground impact
  meteorRollSpeed: 36,         // leftward roll speed on top of the scroll
};

/* ============================================================================
   2. PALETTE
   ============================================================================ */
const COLORS = {
  sky:        "#02020c",
  starFar:    "#3a3a5c",
  starNear:   "#b0b0d0",
  groundFill: "#5c5c66",   // moon rock
  groundRim:  "#d8d8e8",   // bright regolith rim
  crater:     "#3c3c46",   // shadowed crater interior
  jeepBody:   "#ff8c1a",
  jeepDark:   "#7a3d00",
  tire:       "#1a1a1a",
  hub:        "#8c8c8c",
  gun:        "#5a5a6e",
  driver:     "#ffd9a0",
  rover:      "#39d353",   // alien moon rover (ground enemy) — fallback color
  roverDark:  "#14601f",
  // Ground rover colorways — each spawn cycles to the next [body, shadow].
  roverVariants: [
    ["#39d353", "#14601f"],  // classic green
    ["#2ad4c4", "#0f5a52"],  // teal
    ["#ffd23a", "#8a6a10"],  // gold
    ["#ff4ad8", "#7a1a66"],  // magenta
    ["#8ab4ff", "#2a4a8a"],  // moonlight blue
  ],
  canopy:     "#9adfff",   // cockpit glass
  ufo:        "#c0c0d0",   // flying saucer (air enemy)
  ufoDark:    "#6a1fa0",
  bomber:     "#ff2a2a",   // big red bomber saucer
  bomberDark: "#7a0e0e",
  bomb:       "#22222c",
  meteor:     "#8a6a4a",   // tumbling space rock
  meteorDark: "#4a3626",
  flame:      "#ff9a2a",
  bulletYou:  "#66ffff",
  bulletFoe:  "#ff5a3c",
  hud:        "#e8e8e8",
  hudDim:     "#7a7a9a",
  flash:      "#ffffff",
};

/* ============================================================================
   3. AUDIO — WebAudio square-wave SFX, no asset files needed.
   The context is created lazily on the first user gesture (browser rule).
   ============================================================================ */
const AudioSys = {
  ctx: null,
  muted: false,

  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
      this.muted = localStorage.getItem("moonpatrol_muted") === "1";
    }
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  },

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem("moonpatrol_muted", this.muted ? "1" : "0");
  },

  // One square-wave beep: freq slides from f0 to f1 over `dur` seconds.
  beep(f0, f1, dur, vol = 0.12, type = "square") {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  },

  // Filtered noise burst for explosions.
  noise(dur = 0.35, vol = 0.25) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1400, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start(t);
  },

  shoot()      { this.beep(900, 300, 0.07, 0.08); },
  enemyShoot() { this.beep(320, 140, 0.10, 0.07, "sawtooth"); },
  jump()       { this.beep(220, 520, 0.12, 0.09); },
  explosion()  { this.noise(0.4, 0.3); this.beep(180, 40, 0.35, 0.14, "sawtooth"); },
  levelUp()    { this.beep(440, 440, 0.09, 0.1); setTimeout(() => this.beep(660, 660, 0.09, 0.1), 110); setTimeout(() => this.beep(880, 880, 0.16, 0.1), 220); },
  gameOver()   { this.beep(330, 330, 0.18, 0.1); setTimeout(() => this.beep(220, 220, 0.18, 0.1), 200); setTimeout(() => this.beep(110, 60, 0.4, 0.12), 400); },
  buy()        { this.beep(660, 660, 0.07, 0.1); setTimeout(() => this.beep(990, 990, 0.12, 0.1), 80); },
  denied()     { this.beep(200, 110, 0.2, 0.1, "sawtooth"); },
  shieldHit()  { this.beep(500, 150, 0.18, 0.12); this.noise(0.15, 0.12); },
  missile()    { this.beep(500, 900, 0.12, 0.07, "sawtooth"); },
  shopOpen()   { this.beep(520, 780, 0.1, 0.09); },
};

/* ============================================================================
   4. INPUT
   ============================================================================ */
const Keys = Object.create(null);   // currently held keys, by KeyboardEvent.code

// Edges: keys pressed since last frame (consumed by the update step)
const Pressed = Object.create(null);

window.addEventListener("keydown", (e) => {
  // Stop the browser from scrolling / quick-find-ing while playing.
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
    e.preventDefault();
  }
  if (!Keys[e.code]) Pressed[e.code] = true;
  Keys[e.code] = true;
  AudioSys.init();
});

window.addEventListener("keyup", (e) => { Keys[e.code] = false; });

function consumePress(code) {
  if (Pressed[code]) { Pressed[code] = false; return true; }
  return false;
}

// Clear all pending key presses — used on state transitions so a key held
// from the previous state (e.g. holding Space to fire when you die) can't
// instantly trigger the next state (like skipping the game-over screen).
function clearPresses() {
  for (const k in Pressed) Pressed[k] = false;
}
const heldJump  = () => Keys["ArrowUp"] || Keys["KeyW"];
const aimUp     = () => Keys["ArrowLeft"] || Keys["KeyA"];
const aimDown   = () => Keys["ArrowRight"] || Keys["KeyD"];
const heldFire  = () => Keys["Space"];

/* ============================================================================
   5. TERRAIN — pure function of world x and level.
   A stack of sine waves: amplitude & frequency ramp up from level 1
   (nearly flat) to level 10 (maximum drivable bumpiness).
   ============================================================================ */
const Terrain = {
  level: 1,

  setLevel(n) { this.level = Math.min(n, CONFIG.maxLevel); },

  // 0..1 progress through the difficulty ramp
  ramp() { return (this.level - 1) / (CONFIG.maxLevel - 1); },

  // Ground surface y (screen coords) for a given world x.
  groundY(worldX) {
    const r = this.ramp();
    const base = CONFIG.viewH * CONFIG.groundBase;
    const amp = CONFIG.hillAmpStart + (CONFIG.hillAmpEnd - CONFIG.hillAmpStart) * r;
    const frq = CONFIG.hillFreqStart + (CONFIG.hillFreqEnd - CONFIG.hillFreqStart) * r;

    // Three sines at different wavelengths = natural-looking hills.
    const h =
      Math.sin(worldX * frq) * amp * 0.6 +
      Math.sin(worldX * frq * 2.7 + 1.3) * amp * 0.3 +
      Math.sin(worldX * frq * 6.1 + 4.2) * amp * 0.1;

    return base + h;
  },

  // Approximate slope (radians) of the ground at a world x — used to
  // tilt the jeep and ground enemies so they hug the terrain.
  slope(worldX) {
    const d = 2;
    return Math.atan2(this.groundY(worldX + d) - this.groundY(worldX - d), d * 2);
  },
};

/* ============================================================================
   6. ENTITIES
   ============================================================================ */
const Jeep = {
  x: CONFIG.jeepScreenX,   // screen x is fixed; the world scrolls past
  y: 0,                    // top-left of the body (screen space)
  vy: 0,
  airborne: false,
  gunAngle: -30,           // degrees; starts angled slightly upward
  fireCooldown: 0,
  invuln: 0,               // grace seconds after a shield absorbs a hit
  hasMissiles: false,      // bought: auto-fire 45° up-right
  hasHeat: false,          // bought: homing heat seekers
  missileTimer: 0,
  heatTimer: 0,

  reset() {
    this.vy = 0;
    this.airborne = false;
    this.gunAngle = -30;
    this.fireCooldown = 0;
    this.invuln = 0;
    this.hasMissiles = false;
    this.hasHeat = false;
    this.missileTimer = CONFIG.missileInterval;
    this.heatTimer = CONFIG.heatInterval;
  },

  get centerX() { return this.x + CONFIG.jeepW / 2; },
  get centerY() { return this.y + CONFIG.jeepH / 2; },

  // Where bullets leave the barrel (screen space).
  muzzle() {
    const pivot = this.gunPivot();
    const rad = (this.gunAngle * Math.PI) / 180;
    const len = 16;
    return { x: pivot.x + Math.cos(rad) * len, y: pivot.y + Math.sin(rad) * len };
  },

  gunPivot() {
    return { x: this.x + 15, y: this.y - 2 }; // on top of the jeep tub
  },
};

// Simple object pools — nothing is allocated during the hot loop.
function makePool(factory) {
  const free = [];
  return {
    get() { return free.pop() || factory(); },
    put(o) { free.push(o); },
  };
}

const bulletPool = makePool(() => ({ x: 0, y: 0, vx: 0, vy: 0, friendly: true, owner: null, dead: false }));
const enemyPool  = makePool(() => ({ type: "ground", x: 0, y: 0, w: 0, h: 0, fireTimer: 0, myBullet: null, bob: 0, hp: 1, maxHp: 1, hitFlash: 0, dropTimer: 0, retreating: false, colorIdx: 0, dead: false }));
const sparkPool  = makePool(() => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, color: "#fff", size: 2 }));

let bullets = [];     // {x,y,vx,vy,friendly,owner,dead}
let enemies = [];     // ground rovers, UFOs, red bombers
let sparks  = [];     // explosion particles
let bombs   = [];     // {x,y,vx,vy,dead} — big bombs dropped by bombers
let meteors = [];     // {x,y,vx,vy,state,spin,dead} — indestructible rollers
let missiles = [];    // {x,y,vx,vy,heat,dead} — bought auto-fire ordnance

// Auto-fired missile. heat=true → red, homes toward the nearest enemy.
function spawnMissile(x, y, heat) {
  const rad = (-45 * Math.PI) / 180; // 45° toward the top-right
  const sp = heat ? CONFIG.heatSpeed : CONFIG.missileSpeed;
  missiles.push({ x, y, vx: Math.cos(rad) * sp, vy: Math.sin(rad) * sp, heat, dead: false });
  AudioSys.missile();
}

// The jeep takes a hit. A shield charge absorbs it (brief invulnerability);
// otherwise the jeep explodes and the run ends. Returns true if the jeep died.
function damageJeep() {
  if (Jeep.invuln > 0) return false;
  if (Game.shield > 0) {
    Game.shield--;
    Jeep.invuln = CONFIG.shieldInvulnTime;
    AudioSys.shieldHit();
    for (let i = 0; i < 14; i++) {           // cyan shield-burst sparks
      const s = sparkPool.get();
      const a = Math.random() * Math.PI * 2;
      const sp = rand(40, 110);
      s.x = Jeep.centerX; s.y = Jeep.centerY;
      s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp;
      s.maxLife = s.life = rand(0.15, 0.4);
      s.color = COLORS.bulletYou; s.size = 2;
      sparks.push(s);
    }
    Game.flash = 0.06;
    return false;
  }
  explode(Jeep.centerX, Jeep.centerY, COLORS.jeepBody, 34);
  Game.gameOver();
  return true;
}

function spawnBullet(x, y, vx, vy, friendly, owner) {
  const b = bulletPool.get();
  b.x = x; b.y = y; b.vx = vx; b.vy = vy;
  b.friendly = friendly; b.owner = owner; b.dead = false;
  bullets.push(b);
  return b;
}

function spawnEnemy(type, worldOffset) {
  const e = enemyPool.get();
  e.type = type;
  e.dead = false;
  e.myBullet = null;
  e.bob = Math.random() * Math.PI * 2;

  if (type === "ground") {
    e.w = 24; e.h = 16;
    e.x = CONFIG.viewW + 10;
    e.y = Terrain.groundY(worldOffset + e.x) - e.h; // snapped each frame anyway
    e.fireTimer = rand(CONFIG.enemyFireMin, CONFIG.enemyFireMax) * 0.6; // first shot comes a bit quicker
    e.colorIdx = Game.roverCycle;                     // rotate through colorways
    Game.roverCycle = (Game.roverCycle + 1) % COLORS.roverVariants.length;
  } else if (type === "air") {
    e.w = 30; e.h = 15;
    e.x = CONFIG.viewW + 10;
    e.y = rand(40, CONFIG.viewH * 0.42);
    e.fireTimer = rand(CONFIG.enemyFireMin, CONFIG.enemyFireMax);
  } else { // "bomber" — big red saucer, drops bombs instead of firing dots
    e.w = 40; e.h = 18;
    e.x = CONFIG.viewW + 14;
    e.y = rand(30, CONFIG.viewH * 0.30);
    e.fireTimer = Infinity;                          // never fires aimed dots
    e.dropTimer = rand(0.8, 1.4);                    // first bomb comes early
    e.hp = 5 + Math.floor(rand(0, 6));               // armored: 5-10 hits to kill
    e.maxHp = e.hp;
    e.hitFlash = 0;
    e.retreating = false;                            // set when its level ends
  }
  enemies.push(e);
  return e;
}

// How many red bombers visit per level: 1 on L1, 2 on L2, 3 from L3 onward.
function bombersPerLevel(level) {
  return level === 1 ? 1 : level === 2 ? 2 : 3;
}

// Main body color of an enemy (ground rovers use their cycled colorway).
function enemyMainColor(e) {
  if (e.type === "ground") return COLORS.roverVariants[e.colorIdx % COLORS.roverVariants.length][0];
  return e.type === "bomber" ? COLORS.bomber : COLORS.ufo;
}

function spawnBomb(x, y) {
  bombs.push({ x, y, vx: CONFIG.bombDrift, vy: 10, dead: false });
  AudioSys.beep(180, 90, 0.15, 0.07, "sawtooth"); // whistle as it drops
}

// Meteor: spawns off the top-right corner, slams into the ground right of
// center, then rolls left toward the jeep. Cannot be shot — only jumped.
function spawnMeteor() {
  const impactX = rand(CONFIG.viewW * 0.55, CONFIG.viewW * 0.85);
  const startX = CONFIG.viewW + 16, startY = -14;
  const t = CONFIG.meteorFallTime;
  meteors.push({
    x: startX, y: startY,
    vx: (impactX - startX) / t,
    vy: (CONFIG.viewH * 0.75) / t,
    state: "falling", spin: 0, w: 12, h: 12, dead: false,
  });
  AudioSys.beep(1200, 200, 0.6, 0.08, "sawtooth"); // incoming whistle
}

// Tiny ricochet spark — bullets just bounce off meteors.
function tinySpark(x, y) {
  for (let i = 0; i < 4; i++) {
    const s = sparkPool.get();
    const a = Math.random() * Math.PI * 2;
    const sp = rand(20, 70);
    s.x = x; s.y = y;
    s.vx = Math.cos(a) * sp;
    s.vy = Math.sin(a) * sp - 20;
    s.maxLife = s.life = rand(0.1, 0.25);
    s.color = "#ffffff";
    s.size = 1;
    sparks.push(s);
  }
  AudioSys.beep(1400, 900, 0.04, 0.05);
}

function explode(x, y, color, count = 22) {
  for (let i = 0; i < count; i++) {
    const s = sparkPool.get();
    const a = Math.random() * Math.PI * 2;
    const sp = rand(30, 130);
    s.x = x; s.y = y;
    s.vx = Math.cos(a) * sp;
    s.vy = Math.sin(a) * sp - 40; // bias upward
    s.maxLife = s.life = rand(0.3, 0.8);
    s.color = Math.random() < 0.4 ? "#ffffff" : color;
    s.size = Math.random() < 0.5 ? 2 : 3;
    sparks.push(s);
  }
  AudioSys.explosion();
  Game.shake = 0.35;   // screen shake seconds
  Game.flash = 0.08;   // white flash seconds
}

function rand(a, b) { return a + Math.random() * (b - a); }

// Deterministic 0..1 hash of an integer (for craters — same every frame).
function hash1(n) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/* ============================================================================
   7. GAME STATE
   ============================================================================ */
const Game = {
  state: "title",        // "title" | "play" | "pause" | "shop" | "gameover"
  score: 0,              // CURRENCY — spendable in the buy menu
  hiScore: Number(localStorage.getItem("moonpatrol_hi") || 0),
  shield: 0,             // shield charges (small +1 / large +3)
  shopFlash: 0,          // "not enough currency" warning timer
  roverCycle: 0,         // next ground-rover colorway index
  level: 1,
  distance: 0,           // px travelled this run
  worldOffset: 0,        // total world x scrolled
  spawnTimer: 2.5,
  levelDuration: 20,   // seconds the current level takes to scroll by
  levelElapsed: 0,     // seconds since the current level started
  bomberSchedule: [],  // absolute arrival times (s into the level), one per bomber
  bomberIdx: 0,        // how many scheduled bombers have arrived
  meteorTimer: 0,

  // Seconds one level takes at the current scroll speed.
  computeLevelDuration() {
    const scroll = CONFIG.scrollSpeed + CONFIG.scrollSpeedPerLevel * (this.level - 1);
    return CONFIG.levelLength / scroll;
  },

  // Spread this level's red ships evenly across the whole level (with jitter):
  // L1 gets one mid-level visit, L2 two, L3+ three — never stacked up front.
  scheduleBombers() {
    this.levelDuration = this.computeLevelDuration();
    this.levelElapsed = 0;
    this.bomberIdx = 0;
    const quota = bombersPerLevel(this.level);
    this.bomberSchedule = [];
    for (let i = 0; i < quota; i++) {
      this.bomberSchedule.push(this.levelDuration * ((i + 0.6) / quota) * rand(0.9, 1.1));
    }
    this.bomberSchedule.sort((a, b) => a - b);
  },
  banner: "",            // e.g. "LEVEL 2"
  bannerTimer: 0,
  shake: 0,
  flash: 0,

  start() {
    this.state = "play";
    this.score = 0;
    this.level = 1;
    this.distance = 0;
    this.worldOffset = 0;
    this.spawnTimer = 2.5;
    this.scheduleBombers();
    this.meteorTimer = rand(CONFIG.meteorMinGap, CONFIG.meteorMaxGap);
    this.banner = "LEVEL 1";
    this.bannerTimer = 2;
    this.shake = 0;
    this.flash = 0;
    Terrain.setLevel(1);
    Jeep.reset();
    this.shield = 0;
    this.shopFlash = 0;
    this.roverCycle = 0;
    clearPresses();

    // Return everything to the pools.
    for (const b of bullets) bulletPool.put(b);
    for (const e of enemies) enemyPool.put(e);
    for (const s of sparks) sparkPool.put(s);
    bullets = []; enemies = []; sparks = [];
    bombs = []; meteors = []; missiles = [];
  },

  gameOver() {
    this.state = "gameover";
    this.hiScore = Math.max(this.hiScore, Math.floor(this.score));
    localStorage.setItem("moonpatrol_hi", String(this.hiScore));
    clearPresses();
    AudioSys.gameOver();
  },

  nextLevel() {
    this.level = Math.min(this.level + 1, CONFIG.maxLevel);
    Terrain.setLevel(this.level);
    // Any bomber still on screen belongs to the PREVIOUS level's quota:
    // send it packing so this level serves up exactly its own count.
    for (const e of enemies) {
      if (e.type === "bomber" && !e.retreating) e.retreating = true;
    }
    this.scheduleBombers(); // fresh, evenly-spread bomber quota
    this.banner = this.level >= CONFIG.maxLevel ? "LEVEL 10 — MAX HILLS!" : "LEVEL " + this.level;
    this.bannerTimer = 2;
    AudioSys.levelUp();
  },
};

/* ============================================================================
   8. UPDATE — fixed timestep (dt in seconds)
   ============================================================================ */

// The buy menu (press B during play). Prices come from CONFIG.
const SHOP_ITEMS = [
  { name: "SMALL SHIELD  +1 HIT",  price: () => CONFIG.priceSmallShield, owned: () => false,            apply() { Game.shield += 1; } },
  { name: "LARGE SHIELD  +3 HITS", price: () => CONFIG.priceLargeShield, owned: () => false,            apply() { Game.shield += 3; } },
  { name: "MISSILES  45 AUTO",     price: () => CONFIG.priceMissiles,    owned: () => Jeep.hasMissiles, apply() { Jeep.hasMissiles = true; } },
  { name: "HEAT SEEKERS  AUTO",    price: () => CONFIG.priceHeatSeekers, owned: () => Jeep.hasHeat,     apply() { Jeep.hasHeat = true; } },
];

function buyShopItem(i) {
  const it = SHOP_ITEMS[i];
  const p = it.price();
  if (it.owned() || Game.score < p) {   // already owned or can't afford
    Game.shopFlash = 1.4;
    AudioSys.denied();
    return;
  }
  Game.score -= p;                      // currency is spent for good
  it.apply();
  AudioSys.buy();
}

function update(dt) {
  // Global keys that work in any state.
  if (consumePress("KeyM")) AudioSys.toggleMute();
  if (consumePress("KeyF")) toggleFullscreen();
  if (fsBlockedFlash > 0) fsBlockedFlash -= dt;

  if (Game.state === "title") {
    if (consumePress("Space") || consumePress("Enter") || clicked) Game.start();
    clicked = false;
    return;
  }

  if (Game.state === "gameover") {
    updateSparks(dt);
    if (Game.shake > 0) Game.shake -= dt;
    if (Game.flash > 0) Game.flash -= dt;
    if (consumePress("Space") || consumePress("Enter") || clicked) Game.start();
    clicked = false;
    return;
  }

  /* -- BUY MENU: world is frozen while you shop -- */
  if (Game.state === "shop") {
    if (Game.shopFlash > 0) Game.shopFlash -= dt;
    if (consumePress("KeyB") || consumePress("Escape")) {
      Game.state = "play";
      clearPresses();
      clicked = false;
      return;
    }
    for (let i = 0; i < SHOP_ITEMS.length; i++) {
      if (consumePress("Digit" + (i + 1))) buyShopItem(i);
    }
    clicked = false;
    return;
  }

  if (consumePress("KeyP") || consumePress("Escape")) {
    Game.state = Game.state === "pause" ? "play" : "pause";
  }
  if (Game.state === "pause") { clicked = false; return; }

  // Open the buy menu from play.
  if (consumePress("KeyB")) {
    Game.state = "shop";
    AudioSys.shopOpen();
    clicked = false;
    return;
  }

  /* ---- PLAY ---- */

  const levelT = Game.level - 1;
  const scroll = CONFIG.scrollSpeed + CONFIG.scrollSpeedPerLevel * levelT;

  // World scrolls; jeep x stays put.
  Game.worldOffset += scroll * dt;
  Game.distance += scroll * dt;
  Game.score += scroll * dt * CONFIG.scorePerPixel;

  // Level progression by distance travelled.
  if (Game.distance >= Game.level * CONFIG.levelLength && Game.level < CONFIG.maxLevel) {
    Game.nextLevel();
  }

  if (Game.bannerTimer > 0) Game.bannerTimer -= dt;
  if (Game.shake > 0) Game.shake -= dt;
  if (Game.flash > 0) Game.flash -= dt;

  /* -- Jeep -- */
  const jeepWorldX = Game.worldOffset + Jeep.x;
  const groundHere = Terrain.groundY(jeepWorldX);

  if (consumePress("ArrowUp") || consumePress("KeyW")) {
    if (!Jeep.airborne) {
      Jeep.vy = -CONFIG.jumpPower;
      Jeep.airborne = true;
      AudioSys.jump();
    }
  }

  if (Jeep.airborne) {
    Jeep.vy += CONFIG.gravity * dt;
    Jeep.y += Jeep.vy * dt;
    if (Jeep.y >= groundHere - CONFIG.jeepH) {
      Jeep.y = groundHere - CONFIG.jeepH;
      Jeep.vy = 0;
      Jeep.airborne = false;
    }
  } else {
    Jeep.y = groundHere - CONFIG.jeepH;
  }

  // Aim the gun: A/Left raises the barrel, D/Right lowers it.
  if (aimUp())   Jeep.gunAngle -= CONFIG.gunTurnSpeed * dt;
  if (aimDown()) Jeep.gunAngle += CONFIG.gunTurnSpeed * dt;
  Jeep.gunAngle = Math.max(CONFIG.gunMinAngle, Math.min(CONFIG.gunMaxAngle, Jeep.gunAngle));

  // Fire: hold Space for a stream of dots.
  Jeep.fireCooldown -= dt;
  if (heldFire() && Jeep.fireCooldown <= 0) {
    Jeep.fireCooldown = 1 / CONFIG.fireRate;
    const m = Jeep.muzzle();
    const rad = (Jeep.gunAngle * Math.PI) / 180;
    spawnBullet(m.x, m.y, Math.cos(rad) * CONFIG.bulletSpeed, Math.sin(rad) * CONFIG.bulletSpeed, true, null);
    AudioSys.shoot();
  }

  if (Jeep.invuln > 0) Jeep.invuln -= dt;

  /* -- Bought ordnance: fires on its own until the run ends -- */
  if (Jeep.hasMissiles) {
    Jeep.missileTimer -= dt;
    if (Jeep.missileTimer <= 0) {
      Jeep.missileTimer = CONFIG.missileInterval;
      const mz = Jeep.muzzle();
      spawnMissile(mz.x, mz.y, false);          // straight 45° up-right
    }
  }
  if (Jeep.hasHeat) {
    Jeep.heatTimer -= dt;
    if (Jeep.heatTimer <= 0) {
      Jeep.heatTimer = CONFIG.heatInterval;
      spawnMissile(Jeep.centerX, Jeep.y - 4, true); // red homing missile
    }
  }

  /* -- Enemy spawning -- */
  Game.spawnTimer -= dt;
  if (Game.spawnTimer <= 0 && enemies.length < CONFIG.maxEnemies) {
    const shrink = Math.max(0.35, 1 - CONFIG.spawnShrinkPerLevel * levelT);
    Game.spawnTimer = rand(CONFIG.spawnMinBase, CONFIG.spawnMaxBase) * shrink;
    // Level 1 is gentle: ground enemies only for the first stretch.
    const type = (Game.level === 1 && Math.random() < 0.65) || Math.random() < 0.5 ? "ground" : "air";
    spawnEnemy(type, Game.worldOffset);
  }

  /* -- Red bomber quota (1 on L1, 2 on L2, 3 from L3) --
     Arrivals follow an absolute schedule spread across the whole level.
     Bombers are quota units, so they ignore the regular enemy cap (that
     cap used to starve them out at higher levels). */
  Game.levelElapsed += dt;
  if (Game.bomberIdx < Game.bomberSchedule.length
      && Game.levelElapsed >= Game.bomberSchedule[Game.bomberIdx]) {
    const anyRetreating = enemies.some(en => en.type === "bomber" && en.retreating);
    const activeBombers = enemies.filter(en => en.type === "bomber" && !en.retreating).length;
    if (!anyRetreating && activeBombers < CONFIG.bomberMaxActive) {
      Game.bomberIdx++;
      spawnEnemy("bomber", Game.worldOffset);
    }
  }

  /* -- Meteors (from level 3 onward) -- */
  if (Game.level >= 3) {
    Game.meteorTimer -= dt;
    if (Game.meteorTimer <= 0) {
      Game.meteorTimer = rand(CONFIG.meteorMinGap, CONFIG.meteorMaxGap);
      spawnMeteor();
    }
  }

  /* -- Enemies -- */
  const foeBulletSpeed = CONFIG.enemyBulletSpeed + CONFIG.enemyBulletSpeedPerLevel * levelT;
  const fireScale = Math.max(0.5, 1 - 0.05 * levelT);

  for (const e of enemies) {
    if (e.hitFlash > 0) e.hitFlash -= dt;
    if (e.type === "ground") {
      // Ground enemies ride the terrain, drifting left against the scroll.
      e.x -= (scroll + CONFIG.groundEnemySpeed) * dt;
      const wy = Terrain.groundY(Game.worldOffset + e.x + e.w / 2);
      e.y = wy - e.h;
    } else if (e.type === "bomber") {
      // Red bomber: heavy hover across the top, dropping big bombs.
      // Retreating bombers (their level ended) flee fast and stop bombing.
      e.bob += dt * 1.8;
      e.x -= (e.retreating ? CONFIG.bomberRetreatSpeed : CONFIG.bomberSpeed) * dt;
      e.y += Math.sin(e.bob) * 8 * dt;
      if (!e.retreating) {
        e.dropTimer -= dt;
        if (e.dropTimer <= 0 && e.x < CONFIG.viewW - 20 && e.x > CONFIG.viewW * 0.2) {
          e.dropTimer = rand(CONFIG.bomberDropMin, CONFIG.bomberDropMax);
          spawnBomb(e.x + e.w / 2, e.y + e.h);
        }
      }
    } else {
      // Air enemies hold altitude with a gentle bob.
      e.bob += dt * 2.4;
      e.x -= CONFIG.airEnemySpeed * dt;
      e.y += Math.sin(e.bob) * 12 * dt;
    }

    // Each enemy has at most ONE live bullet ("one at a time").
    if (e.myBullet && e.myBullet.dead) e.myBullet = null;

    const onScreen = e.x < CONFIG.viewW - 4 && e.x + e.w > 0;
    if (onScreen && !e.myBullet) {
      e.fireTimer -= dt;
      if (e.fireTimer <= 0) {
        e.fireTimer = rand(CONFIG.enemyFireMin, CONFIG.enemyFireMax) * fireScale;
        // Aim a dot straight at the jeep's current position.
        const sx = e.x + e.w / 2, sy = e.y + e.h / 2;
        const dx = Jeep.centerX - sx, dy = Jeep.centerY - sy;
        const d = Math.hypot(dx, dy) || 1;
        e.myBullet = spawnBullet(sx, sy, (dx / d) * foeBulletSpeed, (dy / d) * foeBulletSpeed, false, e);
        AudioSys.enemyShoot();
      }
    }

    // Ground enemy ramming the jeep: the rover dies either way; the jeep
    // only survives if a shield absorbs the hit.
    if (e.type === "ground" && rectsOverlap(Jeep.x, Jeep.y, CONFIG.jeepW, CONFIG.jeepH, e.x, e.y, e.w, e.h)) {
      explode(e.x + e.w / 2, e.y + e.h / 2, enemyMainColor(e));
      e.dead = true;
      damageJeep();
    }

    if (e.x + e.w < -30) e.dead = true; // left the screen
  }

  /* -- Bullets -- */
  for (const b of bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (b.x < -10 || b.x > CONFIG.viewW + 10 || b.y < -10 || b.y > CONFIG.viewH + 10) {
      b.dead = true;
      continue;
    }

    // Shots bury themselves in the moon dirt (matters now that the gun aims down).
    if (b.y >= Terrain.groundY(Game.worldOffset + b.x)) {
      b.dead = true;
      continue;
    }

    if (b.friendly) {
      // Player bullet vs enemies.
      for (const e of enemies) {
        if (e.dead) continue;
        if (pointInRect(b.x, b.y, e.x - 1, e.y - 1, e.w + 2, e.h + 2)) {
          b.dead = true;
          if (e.type === "bomber") {
            // Armored: takes 5-10 hits. Ping off the hull until hp runs out.
            e.hp--;
            e.hitFlash = 0.09;
            tinySpark(b.x, b.y);
            if (e.hp <= 0) {
              e.dead = true;
              explode(e.x + e.w / 2, e.y + e.h / 2, COLORS.bomber, 40);
              Game.score += CONFIG.scorePerBomberKill;
            }
          } else {
            e.dead = true;
            explode(e.x + e.w / 2, e.y + e.h / 2, enemyMainColor(e));
            Game.score += e.type === "ground" ? CONFIG.scorePerGroundKill : CONFIG.scorePerAirKill;
          }
          break;
        }
      }
      // Bullets can't hurt meteors — they spark off and die.
      if (!b.dead) {
        for (const m of meteors) {
          if (!m.dead && pointInRect(b.x, b.y, m.x - 1, m.y - 1, m.w + 2, m.h + 2)) {
            b.dead = true;
            tinySpark(b.x, b.y);
            break;
          }
        }
      }
    } else {
      // Enemy bullet vs jeep (hitbox padded to match the bigger dot).
      if (pointInRect(b.x, b.y, Jeep.x, Jeep.y - 5, CONFIG.jeepW, CONFIG.jeepH + 5)) {
        b.dead = true;
        damageJeep();
      }
    }
  }

  /* -- Bombs (dropped by red bombers) -- */
  for (const b of bombs) {
    b.vy += CONFIG.gravity * CONFIG.bombGravity * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Direct hit on the jeep = boom (unless a shield absorbs it).
    if (rectsOverlap(b.x - 4, b.y - 4, 8, 8, Jeep.x, Jeep.y - 4, CONFIG.jeepW, CONFIG.jeepH + 4)) {
      b.dead = true;
      damageJeep();
      continue;
    }

    // Ground impact: big blast, but only cosmetic if it missed the jeep.
    if (b.y >= Terrain.groundY(Game.worldOffset + b.x) - 3) {
      b.dead = true;
      explode(b.x, Terrain.groundY(Game.worldOffset + b.x) - 2, COLORS.flame, 26);
    }
    if (b.x < -12) b.dead = true;
  }

  /* -- Meteors: fall from the top-right, slam down, then roll at the jeep -- */
  for (const m of meteors) {
    if (m.state === "falling") {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.spin += dt * 6;

      // Ember trail: burning debris sheds off the falling rock.
      if (sparks.length < 220 && Math.random() < 0.55) {
        const s = sparkPool.get();
        s.x = m.x + rand(0, m.w);
        s.y = m.y - rand(0, 8);
        s.vx = rand(-25, 25) + 20;         // trails behind (right) as it falls left
        s.vy = rand(-70, -20);             // embers rise
        s.maxLife = s.life = rand(0.15, 0.45);
        s.color = Math.random() < 0.5 ? COLORS.flame : COLORS.bulletFoe;
        s.size = Math.random() < 0.6 ? 2 : 3;
        sparks.push(s);
      }

      const gy = Terrain.groundY(Game.worldOffset + m.x + m.w / 2);
      if (m.y + m.h >= gy && m.x < CONFIG.viewW * 0.9) {
        m.state = "rolling";
        m.y = gy - m.h;
        explode(m.x + m.w / 2, gy, COLORS.meteor, 18); // impact burst
      }
    } else {
      // Rolling: hugs the terrain as it bears down on the jeep.
      m.x -= (scroll + CONFIG.meteorRollSpeed) * dt;
      m.y = Terrain.groundY(Game.worldOffset + m.x + m.w / 2) - m.h;
      m.spin += dt * 10;

      if (rectsOverlap(Jeep.x, Jeep.y, CONFIG.jeepW, CONFIG.jeepH, m.x, m.y, m.w, m.h)) {
        damageJeep(); // a shield saves you, but the meteor keeps on rolling
      }
      if (m.x + m.w < -20) m.dead = true;
    }
  }

  /* -- Missiles (bought ordnance) -- */
  for (const m of missiles) {
    if (m.heat) {
      // Steer toward the nearest live enemy, turn-rate limited.
      let best = null, bd = Infinity;
      for (const e of enemies) {
        if (e.dead) continue;
        const dx = e.x + e.w / 2 - m.x, dy = e.y + e.h / 2 - m.y;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        const want = Math.atan2(best.y + best.h / 2 - m.y, best.x + best.w / 2 - m.x);
        const cur = Math.atan2(m.vy, m.vx);
        let diff = ((want - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        const maxTurn = CONFIG.heatTurnRate * dt;
        const next = cur + Math.max(-maxTurn, Math.min(maxTurn, diff));
        m.vx = Math.cos(next) * CONFIG.heatSpeed;
        m.vy = Math.sin(next) * CONFIG.heatSpeed;
      }
    }
    m.x += m.vx * dt;
    m.y += m.vy * dt;

    if (m.x < -12 || m.x > CONFIG.viewW + 12 || m.y < -12 || m.y > CONFIG.viewH + 12) { m.dead = true; continue; }
    if (m.y >= Terrain.groundY(Game.worldOffset + m.x)) {
      m.dead = true;
      explode(m.x, m.y - 2, COLORS.flame, 8);
      continue;
    }

    // Hits enemies like a bullet (bombers lose 1 hp; meteors shrug it off).
    for (const e of enemies) {
      if (e.dead) continue;
      if (pointInRect(m.x, m.y, e.x - 2, e.y - 2, e.w + 4, e.h + 4)) {
        m.dead = true;
        if (e.type === "bomber") {
          e.hp--;
          e.hitFlash = 0.09;
          if (e.hp <= 0) {
            e.dead = true;
            explode(e.x + e.w / 2, e.y + e.h / 2, COLORS.bomber, 40);
            Game.score += CONFIG.scorePerBomberKill;
          } else {
            explode(m.x, m.y, COLORS.flame, 8);
          }
        } else {
          e.dead = true;
          explode(e.x + e.w / 2, e.y + e.h / 2, enemyMainColor(e));
          Game.score += e.type === "ground" ? CONFIG.scorePerGroundKill : CONFIG.scorePerAirKill;
        }
        break;
      }
    }
    if (!m.dead) {
      for (const mt of meteors) {
        if (!mt.dead && pointInRect(m.x, m.y, mt.x - 1, mt.y - 1, mt.w + 2, mt.h + 2)) {
          m.dead = true;
          tinySpark(m.x, m.y);
          break;
        }
      }
    }
  }

  updateSparks(dt);

  // Sweep dead entities back into their pools.
  if (bullets.some(b => b.dead)) {
    const keep = [];
    for (const b of bullets) (b.dead ? bulletPool.put(b) : keep.push(b));
    bullets = keep;
  }
  if (enemies.some(e => e.dead)) {
    const keep = [];
    for (const e of enemies) (e.dead ? enemyPool.put(e) : keep.push(e));
    enemies = keep;
  }
  if (bombs.some(b => b.dead)) bombs = bombs.filter(b => !b.dead);
  if (meteors.some(m => m.dead)) meteors = meteors.filter(m => !m.dead);
  if (missiles.some(m => m.dead)) missiles = missiles.filter(m => !m.dead);

  clicked = false;
}

function updateSparks(dt) {
  for (const s of sparks) {
    s.life -= dt;
    s.vy += 300 * dt; // gravity on debris
    s.x += s.vx * dt;
    s.y += s.vy * dt;
  }
  if (sparks.some(s => s.life <= 0)) {
    const keep = [];
    for (const s of sparks) (s.life <= 0 ? sparkPool.put(s) : keep.push(s));
    sparks = keep;
  }
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
function pointInRect(px, py, rx, ry, rw, rh) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

/* ============================================================================
   9. RENDER
   ============================================================================ */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = CONFIG.viewW;
canvas.height = CONFIG.viewH;

// Tiny pixel-font: 3x5 glyphs for the characters the HUD needs.
// Each glyph is 5 rows of 3 bits (1 = pixel on).
const FONT = {
  "0": [7,5,5,5,7], "1": [2,6,2,2,7], "2": [7,1,7,4,7], "3": [7,1,7,1,7],
  "4": [5,5,7,1,1], "5": [7,4,7,1,7], "6": [7,4,7,5,7], "7": [7,1,1,2,2],
  "8": [7,5,7,5,7], "9": [7,5,7,1,7],
  "A": [2,5,7,5,5], "B": [6,5,6,5,6], "C": [3,4,4,4,3], "D": [6,5,5,5,6],
  "E": [7,4,6,4,7], "F": [7,4,6,4,4], "G": [3,4,5,5,3], "H": [5,5,7,5,5],
  "I": [7,2,2,2,7], "J": [1,1,1,5,2], "K": [5,6,4,6,5], "L": [4,4,4,4,7],
  "M": [5,7,7,5,5], "N": [6,5,5,5,5], "O": [7,5,5,5,7], "P": [7,5,7,4,4],
  "Q": [7,5,5,7,1], "R": [7,5,6,5,5], "S": [3,4,2,1,6], "T": [7,2,2,2,2],
  "U": [5,5,5,5,7], "V": [5,5,5,5,2], "W": [5,5,7,7,5], "X": [5,5,2,5,5],
  "Y": [5,5,2,2,2], "Z": [7,1,2,4,7],
  " ": [0,0,0,0,0], "-": [0,0,7,0,0], "!": [2,2,2,0,2], ".": [0,0,0,0,2],
  ":": [0,2,0,2,0], "/": [1,1,2,4,4], ">": [4,2,1,2,4], "<": [1,2,4,2,1],
};

function drawText(str, x, y, scale = 1, color = COLORS.hud) {
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of str.toUpperCase()) {
    const glyph = FONT[ch];
    if (glyph) {
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 3; col++) {
          if (glyph[row] & (4 >> col)) ctx.fillRect(cx + col * scale, y + row * scale, scale, scale);
        }
      }
    }
    cx += 4 * scale;
  }
}

function textWidth(str, scale = 1) { return str.length * 4 * scale - scale; }
function drawTextCentered(str, y, scale, color) {
  drawText(str, Math.round((CONFIG.viewW - textWidth(str, scale)) / 2), y, scale, color);
}

// Star field: two parallax layers, generated once, wrapped forever.
const stars = [];
for (let i = 0; i < 70; i++) {
  stars.push({ x: Math.random() * CONFIG.viewW, y: Math.random() * CONFIG.viewH * 0.7, near: i % 3 === 0 });
}

function render() {
  ctx.save();

  // Screen shake
  if (Game.shake > 0) {
    const s = Game.shake * 6;
    ctx.translate(Math.round(rand(-s, s)), Math.round(rand(-s, s)));
  }

  /* Sky */
  ctx.fillStyle = COLORS.sky;
  ctx.fillRect(-8, -8, CONFIG.viewW + 16, CONFIG.viewH + 16);

  /* Stars (parallax with the world) */
  for (const st of stars) {
    const speed = st.near ? 0.25 : 0.1;
    let sx = (st.x - Game.worldOffset * speed) % CONFIG.viewW;
    if (sx < 0) sx += CONFIG.viewW;
    ctx.fillStyle = st.near ? COLORS.starNear : COLORS.starFar;
    ctx.fillRect(Math.round(sx), Math.round(st.y), st.near ? 2 : 1, st.near ? 2 : 1);
  }

  /* Terrain */
  ctx.fillStyle = COLORS.groundFill;
  ctx.beginPath();
  ctx.moveTo(-8, CONFIG.viewH + 8);
  for (let sx = -8; sx <= CONFIG.viewW + 8; sx += 4) {
    ctx.lineTo(sx, Terrain.groundY(Game.worldOffset + sx));
  }
  ctx.lineTo(CONFIG.viewW + 8, CONFIG.viewH + 8);
  ctx.closePath();
  ctx.fill();

  // Bright rim along the surface — classic Atari ground highlight.
  ctx.fillStyle = COLORS.groundRim;
  for (let sx = -8; sx <= CONFIG.viewW + 8; sx += 2) {
    ctx.fillRect(sx, Math.round(Terrain.groundY(Game.worldOffset + sx)), 2, 2);
  }

  /* Craters: hashed from the world position, so they scroll with the ground */
  const sp = CONFIG.craterSpacing;
  const c0 = Math.floor(Game.worldOffset / sp), c1 = Math.floor((Game.worldOffset + CONFIG.viewW) / sp);
  ctx.fillStyle = COLORS.crater;
  for (let i = c0; i <= c1; i++) {
    if (hash1(i) < 0.6) {
      const wx = i * sp + hash1(i + 7919) * sp * 0.6;
      const cx = Math.round(wx - Game.worldOffset);
      const w = 8 + Math.floor(hash1(i + 31337) * 12);
      const gy = Math.round(Terrain.groundY(wx));
      ctx.fillRect(cx - (w >> 2), gy + 1, w >> 1, 2);   // shallow lip
      ctx.fillRect(cx - (w >> 1), gy + 3, w, 2);        // bowl
      ctx.fillRect(cx - (w >> 1), gy + 5, w, 2);
    }
  }

  /* Entities */
  for (const e of enemies) drawEnemy(e);
  for (const b of bombs) drawBomb(b);
  for (const m of meteors) drawMeteor(m);
  for (const m of missiles) drawMissile(m);
  drawJeep();

  /* Bullets */
  for (const b of bullets) {
    if (b.friendly) {
      ctx.fillStyle = COLORS.bulletYou;
      ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 2, 2);
    } else {
      // Enemy shots are big, mean 4x4 dots.
      ctx.fillStyle = COLORS.bulletFoe;
      ctx.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 2, 4, 4);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 1, 1);
    }
  }

  /* Explosion particles */
  for (const s of sparks) {
    ctx.globalAlpha = Math.max(0, s.life / s.maxLife);
    ctx.fillStyle = s.color;
    ctx.fillRect(Math.round(s.x), Math.round(s.y), s.size, s.size);
  }
  ctx.globalAlpha = 1;

  /* Hit flash */
  if (Game.flash > 0) {
    ctx.globalAlpha = Math.min(0.6, Game.flash * 8);
    ctx.fillStyle = COLORS.flash;
    ctx.fillRect(-8, -8, CONFIG.viewW + 16, CONFIG.viewH + 16);
    ctx.globalAlpha = 1;
  }

  /* HUD + state screens */
  drawHUD();
  if (Game.state === "title") drawTitle();
  else if (Game.state === "pause") drawPause();
  else if (Game.state === "shop") drawShop();
  else if (Game.state === "gameover") drawGameOver();
  else if (Game.bannerTimer > 0) {
    const pulse = Math.floor(Game.bannerTimer * 6) % 2 === 0;
    drawTextCentered(Game.banner, 84, 2, pulse ? COLORS.hud : COLORS.hudDim);
  }

  ctx.restore();
}

function drawMissile(m) {
  const x = Math.round(m.x), y = Math.round(m.y);
  if (m.heat) {
    // Red heat seeker with a flickering exhaust.
    ctx.fillStyle = COLORS.bomber;
    ctx.fillRect(x - 2, y - 1, 5, 3);
    ctx.fillStyle = Math.floor(performance.now() / 60) % 2 === 0 ? COLORS.flame : COLORS.bulletFoe;
    ctx.fillRect(x - 5, y, 3, 1);
  } else {
    // Standard missile: pale body, orange exhaust.
    ctx.fillStyle = COLORS.hud;
    ctx.fillRect(x - 2, y - 1, 5, 3);
    ctx.fillStyle = COLORS.flame;
    ctx.fillRect(x - 5, y, 3, 1);
  }
}

function drawJeep() {
  const slope = Jeep.airborne ? 0 : Terrain.slope(Game.worldOffset + Jeep.x + CONFIG.jeepW / 2);
  ctx.save();

  // Shield ring: cyan dotted halo while charges remain.
  if (Game.shield > 0) {
    ctx.fillStyle = COLORS.bulletYou;
    const flicker = Math.floor(performance.now() / 90) % 2 === 0;
    for (let i = 0; i < 14; i++) {
      if ((i + (flicker ? 1 : 0)) % 2 === 0) continue; // dashed ring
      const a = (i / 14) * Math.PI * 2;
      ctx.fillRect(Math.round(Jeep.centerX + Math.cos(a) * 21), Math.round(Jeep.centerY + Math.sin(a) * 17), 2, 2);
    }
  }

  // Blink while invulnerable after a shield hit.
  if (Jeep.invuln > 0 && Math.floor(performance.now() / 80) % 2 === 0) ctx.globalAlpha = 0.45;

  ctx.translate(Math.round(Jeep.centerX), Math.round(Jeep.y + CONFIG.jeepH));
  ctx.rotate(slope * 0.7); // tilt with the hill, damped so it stays readable

  const W = CONFIG.jeepW, H = CONFIG.jeepH;

  // Tires
  ctx.fillStyle = COLORS.tire;
  ctx.fillRect(-W / 2 + 2, -6, 7, 6);
  ctx.fillRect(W / 2 - 9, -6, 7, 6);
  ctx.fillStyle = COLORS.hub;
  ctx.fillRect(-W / 2 + 4, -4, 3, 2);
  ctx.fillRect(W / 2 - 7, -4, 3, 2);

  // Tub (open-top body) + hood
  ctx.fillStyle = COLORS.jeepBody;
  ctx.fillRect(-W / 2, -H, W, H - 5);
  ctx.fillRect(W / 2 - 8, -H - 2, 8, 4);          // hood
  ctx.fillStyle = COLORS.jeepDark;
  ctx.fillRect(-W / 2 + 4, -H + 1, 8, 3);          // open cockpit hollow

  // Driver head poking out of the open top
  ctx.fillStyle = COLORS.driver;
  ctx.fillRect(-W / 2 + 7, -H - 2, 3, 3);

  // Gun barrel (rotates around its pivot)
  const pivotLocalX = 15 - W / 2;                  // matches Jeep.gunPivot()
  const rad = (Jeep.gunAngle * Math.PI) / 180;
  ctx.fillStyle = COLORS.gun;
  ctx.fillRect(pivotLocalX - 3, -H - 4, 6, 4);     // turret base
  ctx.save();
  ctx.translate(pivotLocalX, -H - 2);
  ctx.rotate(rad);
  ctx.fillRect(0, -1, 16, 2);                      // barrel
  ctx.restore();

  ctx.restore();
}

function drawEnemy(e) {
  const x = Math.round(e.x), y = Math.round(e.y);
  if (e.type === "ground") {
    // Retro-futuristic wedge rover: pointed nose forward (left, toward the
    // jeep), bubble canopy, tail fin, side stripe. Colorway cycles per spawn.
    const [main, dark] = COLORS.roverVariants[e.colorIdx % COLORS.roverVariants.length];

    ctx.fillStyle = dark;
    ctx.fillRect(x + 19, y, 4, 5);                  // tail fin
    ctx.fillRect(x + 1, y + 13, 22, 2);             // skirt shadow

    ctx.fillStyle = COLORS.canopy;
    ctx.fillRect(x + 11, y + 1, 7, 4);              // bubble canopy
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 12, y + 1, 2, 1);              // canopy glint

    // Triangular wedge body: stacked rows widening toward the rear
    ctx.fillStyle = main;
    ctx.fillRect(x + 7, y + 4, 16, 3);              // upper deck
    ctx.fillRect(x + 4, y + 7, 19, 3);              // mid deck
    ctx.fillRect(x + 1, y + 10, 22, 3);             // lower deck
    ctx.fillRect(x, y + 9, 2, 2);                   // needle nose tip

    ctx.fillStyle = dark;
    ctx.fillRect(x + 5, y + 8, 17, 1);              // side stripe
    ctx.fillRect(x - 2, y + 9, 3, 1);               // nose laser, points left

    // Wheels
    ctx.fillStyle = COLORS.tire;
    ctx.fillRect(x + 4, y + 13, 5, 3);
    ctx.fillRect(x + 16, y + 13, 5, 3);
    ctx.fillStyle = COLORS.hub;
    ctx.fillRect(x + 6, y + 14, 1, 1);
    ctx.fillRect(x + 18, y + 14, 1, 1);
  } else if (e.type === "bomber") {
    // Red bomber saucer: wide, heavy, angry. Drops big bombs.
    ctx.fillStyle = COLORS.bomber;
    ctx.fillRect(x + 3, y + 8, e.w - 6, 6);         // disc
    ctx.fillRect(x + 8, y + 5, e.w - 16, 4);        // upper taper
    ctx.fillRect(x + 15, y + 1, 10, 5);             // dome
    ctx.fillStyle = COLORS.bomberDark;
    ctx.fillRect(x + 6, y + 14, e.w - 12, 3);       // armored underside
    ctx.fillStyle = COLORS.driver;
    ctx.fillRect(x + 17, y + 2, 6, 2);              // dome glass
    // Slow, menacing blink on the rim
    const blink = Math.floor(performance.now() / 250) % 5;
    ctx.fillStyle = COLORS.bulletFoe;
    for (let i = 0; i < 5; i++) {
      if (i === blink) ctx.fillRect(x + 5 + i * 7, y + 9, 2, 2);
    }
    ctx.fillStyle = COLORS.bomb;
    ctx.fillRect(x + e.w / 2 - 3, y + 15, 6, 3);    // bomb bay

    // Armor pips above the dome: one per hit point remaining.
    const pips = Math.max(0, e.hp);
    const pipW = Math.floor((e.w - 8) / e.maxHp);
    ctx.fillStyle = COLORS.bulletFoe;
    for (let i = 0; i < pips; i++) ctx.fillRect(x + 4 + i * pipW, y - 5, pipW - 1, 2);

    // Flash white when hit.
    if (e.hitFlash > 0) {
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = COLORS.flash;
      ctx.fillRect(x + 3, y + 1, e.w - 6, e.h - 2);
      ctx.globalAlpha = 1;
    }
  } else {
    // UFO: classic saucer — dome on top, wide disc, blinking lights
    ctx.fillStyle = COLORS.ufo;
    ctx.fillRect(x + 2, y + 6, e.w - 4, 5);         // disc
    ctx.fillRect(x + 6, y + 4, e.w - 12, 3);        // upper taper
    ctx.fillRect(x + 11, y + 1, 8, 4);              // glass dome
    ctx.fillStyle = COLORS.ufoDark;
    ctx.fillRect(x + 4, y + 11, e.w - 8, 2);        // underside shadow
    ctx.fillStyle = COLORS.bulletYou;
    ctx.fillRect(x + 13, y + 2, 4, 2);              // dome glow
    // Running lights blink along the rim
    const blink = Math.floor(performance.now() / 150) % 4;
    ctx.fillStyle = COLORS.bulletFoe;
    for (let i = 0; i < 4; i++) {
      if (i === blink) ctx.fillRect(x + 4 + i * 7, y + 7, 2, 2);
    }
  }
}

function drawBomb(b) {
  const x = Math.round(b.x), y = Math.round(b.y);
  // Big dark shell with a blinking red fuse on top.
  ctx.fillStyle = COLORS.bomb;
  ctx.fillRect(x - 4, y - 4, 8, 8);
  ctx.fillRect(x - 5, y - 2, 10, 4);
  ctx.fillStyle = "#4a4a58";
  ctx.fillRect(x - 2, y - 3, 2, 2);                  // highlight
  ctx.fillStyle = Math.floor(performance.now() / 120) % 2 === 0 ? COLORS.bulletFoe : COLORS.bomber;
  ctx.fillRect(x - 1, y - 6, 2, 2);                  // blinking fuse
}

function drawMeteor(m) {
  const x = Math.round(m.x), y = Math.round(m.y);
  // Big flickering fire while it's falling: red outer, orange mid, yellow core,
  // flames streaming up-right (opposite its down-left path).
  if (m.state === "falling") {
    const f = Math.floor(performance.now() / 70) % 3; // flicker phase
    // Outer red tongues (longest, most jittery)
    ctx.fillStyle = COLORS.bomber;
    ctx.fillRect(x + 2 + f, y - 12 - f, 3, 5);
    ctx.fillRect(x + 9 - f, y - 14 + f, 3, 6);
    ctx.fillRect(x + 5, y - 9, 4, 4);
    // Mid orange body
    ctx.fillStyle = COLORS.flame;
    ctx.fillRect(x + 1, y - 8 + f, 5, 5);
    ctx.fillRect(x + 6, y - 10, 5, 6);
    ctx.fillRect(x + 10, y - 6 - f, 4, 4);
    // Hot yellow core hugging the rock
    ctx.fillStyle = COLORS.bulletFoe;
    ctx.fillRect(x + 2, y - 4, 8, 3);
    ctx.fillRect(x + 4, y - 6 + f, 5, 3);
  }
  // Tumbling rock: dark crater pits rotate around the body.
  ctx.fillStyle = COLORS.meteor;
  ctx.fillRect(x, y + 2, 12, 8);
  ctx.fillRect(x + 2, y, 8, 12);
  const p = Math.floor(m.spin) % 4;
  ctx.fillStyle = COLORS.meteorDark;
  ctx.fillRect(x + 2 + p, y + 3, 3, 3);
  ctx.fillRect(x + 7 - p, y + 7, 2, 2);
  ctx.fillStyle = COLORS.groundRim;
  ctx.fillRect(x + 2 + ((p + 2) % 4), y + 1, 2, 2);  // glinting edge
}

function drawHUD() {
  drawText("CURRENCY " + Math.floor(Game.score), 6, 6, 1, COLORS.bulletFoe);

  // Owned power-ups, second row: shield pips + MSL / HEAT badges.
  let px = 6;
  if (Game.shield > 0) {
    drawText("SH", px, 14, 1, COLORS.bulletYou);
    px += 8;
    ctx.fillStyle = COLORS.bulletYou;
    for (let i = 0; i < Game.shield; i++) { ctx.fillRect(px, 15, 2, 3); px += 4; }
    px += 3;
  }
  if (Jeep.hasMissiles) { drawText("MSL", px, 14, 1, COLORS.hud); px += 13; }
  if (Jeep.hasHeat) { drawText("HEAT", px, 14, 1, COLORS.bomber); px += 17; }

  const lvl = "LEVEL " + Game.level;
  drawText(lvl, CONFIG.viewW - textWidth(lvl, 1) - 6, 6, 1, COLORS.hud);
  if (AudioSys.muted) drawText("MUTED", CONFIG.viewW - textWidth("MUTED", 1) - 6, 14, 1, COLORS.hudDim);

  // Fullscreen button (top-right corner) — bigger and clearly a button.
  const fx = CONFIG.viewW - 30, fy = 15;
  ctx.strokeStyle = COLORS.hudDim;
  ctx.lineWidth = 1;
  ctx.strokeRect(fx + 0.5, fy + 0.5, 22, 12);
  ctx.fillStyle = COLORS.hudDim;
  // Four corner arrows pointing outward (classic expand icon)
  ctx.fillRect(fx + 3, fy + 3, 3, 1); ctx.fillRect(fx + 3, fy + 3, 1, 3);
  ctx.fillRect(fx + 16, fy + 3, 3, 1); ctx.fillRect(fx + 18, fy + 3, 1, 3);
  ctx.fillRect(fx + 3, fy + 8, 3, 1); ctx.fillRect(fx + 3, fy + 6, 1, 3);
  ctx.fillRect(fx + 16, fy + 8, 3, 1); ctx.fillRect(fx + 18, fy + 6, 1, 3);

  // If the browser blocked fullscreen (embedded preview), say so briefly.
  if (fsBlockedFlash > 0) {
    drawTextCentered("FULLSCREEN BLOCKED IN THIS FRAME", 42, 1, COLORS.bulletFoe);
    drawTextCentered("OPEN THE PAGE DIRECTLY TO USE IT", 54, 1, COLORS.hudDim);
  }
}

function drawTitle() {
  shade();
  drawTextCentered("MOON PATROL", 70, 3, COLORS.jeepBody);
  drawTextCentered("SURVIVE THE MOON", 104, 1, COLORS.hud);
  drawTextCentered("W/UP JUMP   A/D AIM GUN", 126, 1, COLORS.hudDim);
  drawTextCentered("SPACE FIRE  P PAUSE  M MUTE", 138, 1, COLORS.hudDim);
  drawTextCentered("B BUY MENU  F FULLSCREEN", 150, 1, COLORS.hudDim);
  if (Math.floor(performance.now() / 400) % 2 === 0) {
    drawTextCentered("PRESS SPACE TO START", 172, 1, COLORS.groundRim);
  }
  if (Game.hiScore > 0) drawTextCentered("HI-SCORE " + Game.hiScore, 196, 1, COLORS.bulletFoe);
  drawText("V" + CONFIG.version, 4, CONFIG.viewH - 9, 1, COLORS.hudDim);
}

function drawPause() {
  shade();
  drawTextCentered("PAUSED", 110, 2, COLORS.hud);
  drawTextCentered("P TO RESUME", 140, 1, COLORS.hudDim);
}

function drawShop() {
  shade();
  drawTextCentered("BUY MENU", 56, 3, COLORS.bulletFoe);
  drawTextCentered("CURRENCY " + Math.floor(Game.score), 88, 1, COLORS.bulletYou);

  for (let i = 0; i < SHOP_ITEMS.length; i++) {
    const it = SHOP_ITEMS[i];
    const owned = it.owned();
    const afford = Game.score >= it.price();
    const label = (i + 1) + " " + it.name + (owned ? "  OWNED" : "  " + it.price());
    drawTextCentered(label, 112 + i * 13, 1, owned ? COLORS.hudDim : afford ? COLORS.hud : COLORS.bulletFoe);
  }

  if (Game.shopFlash > 0 && Math.floor(performance.now() / 150) % 2 === 0) {
    drawTextCentered("CANT BUY THAT", 172, 1, COLORS.bomber);
  }
  if (Math.floor(performance.now() / 400) % 2 === 0) {
    drawTextCentered("1-4 BUY   B CLOSE", 196, 1, COLORS.groundRim);
  }
}

function drawGameOver() {
  shade();
  drawTextCentered("GAME OVER", 90, 3, COLORS.bomber);
  drawTextCentered("CURRENCY " + Math.floor(Game.score), 134, 1, COLORS.hud);
  drawTextCentered("HI-SCORE " + Game.hiScore, 148, 1, COLORS.bulletFoe);
  drawTextCentered("REACHED LEVEL " + Game.level, 166, 1, COLORS.hudDim);
  if (Math.floor(performance.now() / 400) % 2 === 0) {
    drawTextCentered("PRESS SPACE TO RETRY", 192, 1, COLORS.groundRim);
  }
}

function shade() {
  ctx.fillStyle = "rgba(0,0,10,0.62)";
  ctx.fillRect(0, 0, CONFIG.viewW, CONFIG.viewH);
}

/* ============================================================================
   10. MAIN LOOP — fixed timestep sim, render every animation frame,
       letterboxed resize, fullscreen toggle, click handling.
   ============================================================================ */
let clicked = false;

canvas.addEventListener("pointerdown", (e) => {
  AudioSys.init();
  // Map the click into game coordinates to catch the fullscreen button.
  const r = canvas.getBoundingClientRect();
  const gx = ((e.clientX - r.left) / r.width) * CONFIG.viewW;
  const gy = ((e.clientY - r.top) / r.height) * CONFIG.viewH;
  if (gx > CONFIG.viewW - 34 && gy < 32) { toggleFullscreen(); return; }
  clicked = true;
});

// Double-click anywhere also toggles fullscreen.
canvas.addEventListener("dblclick", (e) => {
  e.preventDefault();
  toggleFullscreen();
});

let fsBlockedFlash = 0; // seconds to show the "blocked" hint

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
    return;
  }
  // requestFullscreen returns a promise that REJECTS when the page sits in
  // an iframe without the allowfullscreen permission (e.g. some embedded
  // previews). Catch it and show a hint instead of dying silently.
  const el = document.documentElement;
  const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: "hide" }) : null;
  if (p && p.catch) p.catch(() => { fsBlockedFlash = 3; });
}

// Letterbox: keep the 16:9 buffer centered & integer-scaled when possible.
function fitCanvas() {
  const aspect = CONFIG.viewW / CONFIG.viewH;
  let w = window.innerWidth, h = window.innerHeight;
  if (w / h > aspect) w = h * aspect; else h = w / aspect;
  canvas.style.width = Math.floor(w) + "px";
  canvas.style.height = Math.floor(h) + "px";
  canvas.style.position = "absolute";
  canvas.style.left = Math.floor((window.innerWidth - w) / 2) + "px";
  canvas.style.top = Math.floor((window.innerHeight - h) / 2) + "px";
}
window.addEventListener("resize", fitCanvas);
fitCanvas();

// Park the jeep on the ground for the title screen.
Jeep.y = Terrain.groundY(Jeep.x) - CONFIG.jeepH;

// Debug/testing handle (harmless in production): inspect state from devtools.
window.GAME = { Game, Jeep, Terrain, CONFIG, get enemies() { return enemies; }, get bullets() { return bullets; } };

const STEP = 1 / 60;
let acc = 0, last = performance.now();

function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  while (acc >= STEP) { update(STEP); acc -= STEP; }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
