/* ============================================================================
   MOON RANGER — an Atari-style 2D jeep scroller
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

   See CHANGELOG.md for the version history (current: v0.1.0).

   FILE MAP (all sections are in this one file, top to bottom):
     1. CONFIG        — every tunable number lives here (plus MODIFIERS, 1b)
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
  version: "0.1.0",

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

  // Levels / sectors. Levels 1-10 are the campaign; after the octopus dies the
  // counter keeps going as the endless Patrol (sector 11, 12, ...).
  levelLength: 1600,           // px of travel per level
  maxLevel: 10,                // terrain stops getting hillier here (levels stay 1-10)

  // Endless Patrol (sector 11+). Difficulty grows through density and variety,
  // and these caps stop the numbers from running away.
  scrollCap: 126,              // world scroll never exceeds this (px/sec)
  spawnScaleFloor: 0.22,       // late-sector floor on the spawn-gap scale
  fireScaleFloor: 0.38,        // late-sector floor on the enemy fire-gap scale
  enemyBulletSpeedCap: 240,    // enemy shot speed ceiling
  milestoneTime: 2.5,          // "MOON SAVED" freeze before the Patrol begins

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
  maxMissileStacks: 3,         // buy up to this many 45° launchers
  maxHeatStacks: 3,            // ... and up to this many heat-seeker banks
  salvoGap: 0.12,              // seconds between shots inside a stacked volley
  missileInterval: 2.5,        // seconds between auto missile volleys
  missileSpeed: 280,
  heatInterval: 1.8,           // seconds between heat-seeker volleys
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
  bossMeteorMinGap: 3.5,       // meteors keep falling during boss fights...
  bossMeteorMaxGap: 6.5,       // ...on their own, faster cadence
  meteorFallTime: 1.1,         // seconds from spawn to ground impact
  meteorRollSpeed: 36,         // leftward roll speed on top of the scroll

  // Bosses — a creature guards the end of levels 3, 7 and 10. The level
  // cannot advance until it dies. The spider and crab take 6x a red ship's
  // hits (red ships are 5-10, so bosses are 30-60). The level-10 octopus
  // shrugs off bullets and normal missiles: only HEAT SEEKERS hurt it, and
  // it takes exactly `octopusHeatHits` of them.
  bosses: {
    3:  { kind: "spider",  name: "SPIDER",  w: 88,  h: 52, hover: 0.30 },
    7:  { kind: "crab",    name: "CRAB",    w: 80,  h: 48, hover: 0.33 },
    10: { kind: "octopus", name: "OCTOPUS", w: 112, h: 70, hover: 0.30, heatOnly: true },
  },
  bossHpBase: 5,               // red ship base hits (5-10)
  bossHpFactor: 6,             // bosses take this many times a red ship's hits
  octopusHeatHits: 20,         // heat-seeker hits the octopus needs
  bossEntryTime: 2.2,          // seconds spent sliding into the arena
  bossScrollFactor: 0.35,      // world scroll speed during a boss fight
  bossFireMin: 0.9,            // seconds between boss shots (min)
  bossFireMax: 1.6,            // ... (max)
  bossBulletSpeed: 118,
  scorePerBossKill: 900,

  // Patrol bosses: from sector 15 the same three creatures return every 5
  // sectors (spider -> crab -> octopus). Each appearance is 25% tougher, and
  // from the second visit the fight carries an elite trait.
  patrolBossStart: 15,
  patrolBossEvery: 5,
  bossHpGrowth: 0.25,          // +25% hp per repeat appearance
  bossFrenzyFireScale: 0.75,   // FRENZIED: aimed shots come this much faster
  bossShieldRegen: 6,          // SHIELDED: seconds per hit point regained
};

/* ============================================================================
   1b. SECTOR MODIFIERS — one per Patrol sector (11+), announced in the banner
   and shown in the HUD. Values live here so each flavour reads in one place.
   ============================================================================ */
const MODIFIERS = {
  meteor:   { name: "METEOR STORM", meteorGap: [1.2, 2.2], meteorMax: 4 },
  bombers:  { name: "BOMBER WING",  bomberQuota: 4, dropGap: [0.6, 1.1] },
  air:      { name: "AIR RAID",     airBias: 0.8, speedScale: 1.15 },
  ground:   { name: "GROUND SWARM", groundBias: 0.8, speedScale: 1.15 },
  gravity:  { name: "LOW GRAVITY",  jump: 260, gravity: 270 },
  armored:  { name: "ARMORED",      hits: 2 },
  blackout: { name: "BLACKOUT" },
  fast:     { name: "FAST FORWARD", scrollScale: 1.25 },
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
  // Boss creatures (end of levels 3, 7, 10)
  bossSpider:   "#a45cff",
  bossSpiderDk: "#4a1a7a",
  bossCrab:     "#ff5a1f",
  bossCrabDk:   "#7a2208",
  bossOcto:     "#ff3fa4",
  bossOctoDk:   "#7a1450",
  bossEye:      "#ffffff",
  bossPupil:    "#101018",
  bossBeak:     "#ffd23a",
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
      this.muted = localStorage.getItem("moonranger_muted") === "1";
    }
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  },

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem("moonranger_muted", this.muted ? "1" : "0");
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
  bossAlarm()  { this.beep(90, 45, 0.8, 0.16, "sawtooth"); this.noise(0.5, 0.18); },
  bossHit()    { this.beep(170, 90, 0.07, 0.1, "square"); },
  victory()    { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.beep(f, f, 0.18, 0.12), i * 140)); },
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
  missiles: 0,             // bought stacks (0-3): a volley of 1, 2 or 3 per cycle
  heatSeekers: 0,          // bought stacks (0-3): same, homing
  missileTimer: 0,
  heatTimer: 0,
  salvoLeft: 0,            // missiles still to leave the tube this volley
  salvoTimer: 0,
  heatSalvoLeft: 0,
  heatSalvoTimer: 0,

  reset() {
    this.vy = 0;
    this.airborne = false;
    this.gunAngle = -30;
    this.fireCooldown = 0;
    this.invuln = 0;
    this.missiles = 0;
    this.heatSeekers = 0;
    this.missileTimer = CONFIG.missileInterval;
    this.heatTimer = CONFIG.heatInterval;
    this.salvoLeft = 0;
    this.salvoTimer = 0;
    this.heatSalvoLeft = 0;
    this.heatSalvoTimer = 0;
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
  // Boss shots draw as a mini copy of the creature. Copy the kind now: the
  // boss can die (and be pooled) while the shot is still in flight.
  b.bossKind = owner && owner.type === "boss" ? owner.bossKind : null;
  bullets.push(b);
  return b;
}

function spawnEnemy(type, worldOffset) {
  const e = enemyPool.get();
  e.type = type;
  e.dead = false;
  e.myBullet = null;
  e.bob = Math.random() * Math.PI * 2;
  // ARMORED rovers and saucers need two hits; set explicitly so a recycled
  // pool object can't inherit a stale hp from a previous spawn.
  const mod = Game.modifierDef();
  const hits = (mod && mod.hits) || 1;

  if (type === "ground") {
    e.w = 24; e.h = 16;
    e.x = CONFIG.viewW + 10;
    e.y = Terrain.groundY(worldOffset + e.x) - e.h; // snapped each frame anyway
    e.fireTimer = rand(CONFIG.enemyFireMin, CONFIG.enemyFireMax) * 0.6; // first shot comes a bit quicker
    e.colorIdx = Game.roverCycle;                     // rotate through colorways
    Game.roverCycle = (Game.roverCycle + 1) % COLORS.roverVariants.length;
    e.hp = e.maxHp = hits;
    e.hitFlash = 0;
  } else if (type === "air") {
    e.w = 30; e.h = 15;
    e.x = CONFIG.viewW + 10;
    e.y = rand(40, CONFIG.viewH * 0.42);
    e.fireTimer = rand(CONFIG.enemyFireMin, CONFIG.enemyFireMax);
    e.hp = e.maxHp = hits;
    e.hitFlash = 0;
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

// Base stats per creature. CONFIG.bosses pins them to the campaign sectors
// 3/7/10; the Patrol reuses the same sprites and numbers.
const BOSS_BASE = {
  spider:  CONFIG.bosses[3],
  crab:    CONFIG.bosses[7],
  octopus: CONFIG.bosses[10],
};

// Which boss (if any) guards the end of a sector. Campaign sectors come
// straight from CONFIG.bosses; every 5th sector from 15 rotates the trio, with
// `occurrence` counting repeat visits (1 = the creature's first Patrol outing).
function bossForSector(sector) {
  const campaign = CONFIG.bosses[sector];
  if (campaign) return { occurrence: 1, recurring: false, elite: "", ...campaign };
  if (sector < CONFIG.patrolBossStart || sector % CONFIG.patrolBossEvery !== 0) return null;
  const kind = ["spider", "crab", "octopus"][((sector / CONFIG.patrolBossEvery) - 3) % 3];
  const base = BOSS_BASE[kind];
  const occurrence = Math.floor((sector - CONFIG.patrolBossStart) / 15) + 1;
  return {
    kind,
    name: base.name,
    w: base.w,
    h: base.h,
    hover: base.hover,
    heatOnly: !!base.heatOnly,
    occurrence,
    recurring: true,
    // Repeat visits get harder every time: faster shots from the second,
    // armour regen from the third.
    frenzied: occurrence >= 2,
    shielded: occurrence >= 3,
    elite: occurrence >= 3 ? "FRENZIED + SHIELDED" : occurrence === 2 ? "FRENZIED" : "",
  };
}

// Bosses: one creature guards the end of levels 3, 7 and 10, and again at
// intervals through the Patrol. It slides in from the right and the sector
// cannot advance until it dies. Called from update() at the finish line.
function spawnBoss(sector) {
  const cfg = bossForSector(sector);
  const e = enemyPool.get();
  e.type = "boss";
  e.bossKind = cfg.kind;
  e.name = cfg.name;
  e.heatOnly = !!cfg.heatOnly;
  e.w = cfg.w;
  e.h = cfg.h;
  e.baseX = Math.round(CONFIG.viewW * 0.62 - cfg.w / 2);
  e.baseY = Math.round(CONFIG.viewH * cfg.hover - cfg.h / 2);
  e.x = CONFIG.viewW + 8;
  e.y = e.baseY;
  e.entry = CONFIG.bossEntryTime;   // > 0 while still sliding in (can't shoot)
  e.bob = 0;
  e.fireTimer = 1.2;
  e.myBullet = null;
  e.hitFlash = 0;
  e.colorIdx = 0;
  e.dead = false;
  // Campaign: 6x a red ship's 5-10 hits (30-60), except the octopus which
  // takes 20 heat-seeker hits. Patrol repeats add 25% hp per appearance.
  const baseHp = e.heatOnly
    ? CONFIG.octopusHeatHits
    : CONFIG.bossHpFactor * (CONFIG.bossHpBase + Math.floor(rand(0, 6)));
  e.hp = e.maxHp = Math.round(baseHp * (1 + CONFIG.bossHpGrowth * (cfg.occurrence - 1)));
  e.frenzied = !!cfg.frenzied;
  e.shielded = !!cfg.shielded;
  e.elite = cfg.elite;
  e.regenTimer = CONFIG.bossShieldRegen;
  enemies.push(e);
  Game.bossActive = true;
  Game.bossDefeated = false;
  Game.banner = cfg.name + " ATTACKS!";
  Game.bannerTimer = 2;
  AudioSys.bossAlarm();
  // The octopus can only be hurt by heat seekers. Front the price the first
  // time it appears so the campaign finale can't deadlock — later octopuses
  // rely on the player's own planning.
  if (e.heatOnly && !Game.cleared && Jeep.heatSeekers === 0 && Game.score < CONFIG.priceHeatSeekers) {
    Game.score = CONFIG.priceHeatSeekers;
    Game.bossHintTimer = 4;
  }
  return e;
}

// One hit lands on a boss. Bullets and plain missiles streak off the octopus;
// only heat seekers damage it. Any hit damages the spider and crab.
function damageBoss(e, fromHeat, hx, hy) {
  if (e.heatOnly && !fromHeat) {
    Game.bossHintTimer = 2.4;
    tinySpark(hx === undefined ? e.x + e.w / 2 : hx, hy === undefined ? e.y + e.h / 2 : hy);
    AudioSys.denied();
    return;
  }
  e.hp--;
  e.hitFlash = 0.1;
  e.regenTimer = CONFIG.bossShieldRegen;   // a hit restarts the SHIELDED clock
  AudioSys.bossHit();
  if (e.hp > 0) return;

  e.dead = true;
  explode(e.x + e.w / 2, e.y + e.h / 2, enemyMainColor(e), 60);
  Game.shake = 0.8;
  Game.score += CONFIG.scorePerBossKill;
  Game.bossActive = false;
  // The campaign octopus is the milestone, not the end: MOON SAVED, then the
  // Patrol continues. Every other boss just opens the next sector.
  if (e.heatOnly && !Game.cleared) {
    Game.milestone();
  } else {
    Game.bossDefeated = true;
    Game.nextLevel();
  }
}

// Main body color of an enemy (ground rovers use their cycled colorway).
function enemyMainColor(e) {
  if (e.type === "ground") return COLORS.roverVariants[e.colorIdx % COLORS.roverVariants.length][0];
  if (e.type === "boss") {
    return e.bossKind === "spider" ? COLORS.bossSpider
         : e.bossKind === "crab" ? COLORS.bossCrab
         : COLORS.bossOcto;
  }
  return e.type === "bomber" ? COLORS.bomber : COLORS.ufo;
}

function spawnBomb(x, y) {
  bombs.push({ x, y, vx: CONFIG.bombDrift, vy: 10, dead: false });
  AudioSys.beep(180, 90, 0.15, 0.07, "sawtooth"); // whistle as it drops
}

// Meteor: spawns off the top-right corner, slams into the ground right of
// center, then rolls left toward the jeep. Cannot be shot — only jumped.
function spawnMeteor(minFrac = 0.55, maxFrac = 0.85) {
  const impactX = rand(CONFIG.viewW * minFrac, CONFIG.viewW * maxFrac);
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
  hiScore: Number(localStorage.getItem("moonranger_hi") || 0),
  depth: Number(localStorage.getItem("moonranger_depth") || 0),   // best sector ever
  clearedEver: localStorage.getItem("moonranger_cleared") === "1",
  shield: 0,             // shield charges (small +1 / large +3)
  shopFlash: 0,          // "not enough currency" warning timer
  roverCycle: 0,         // next ground-rover colorway index
  sector: 1,             // unbounded run counter (levels 1-10, then Patrol)
  cleared: false,        // this run has beaten the campaign octopus
  patrolAnnounced: false,// "PATROL BEGINS" banner has been shown this run
  winFlash: 0,           // seconds left on the MOON SAVED overlay
  modifier: null,        // active sector modifier id (see MODIFIERS), or null
  recentMods: [],        // last few modifier ids, so none repeat back-to-back
  distance: 0,           // px travelled this run
  worldOffset: 0,        // total world x scrolled
  spawnTimer: 2.5,
  levelDuration: 20,   // seconds the current level takes to scroll by
  levelElapsed: 0,     // seconds since the current level started
  bomberSchedule: [],  // absolute arrival times (s into the level), one per bomber
  bomberIdx: 0,        // how many scheduled bombers have arrived
  meteorTimer: 0,

  // Boss fight bookkeeping (see spawnBoss / CONFIG.bosses).
  bossActive: false,     // a boss is on screen and the level is blocked
  bossDefeated: false,   // this level's boss has been destroyed
  bossHintTimer: 0,      // "heat seekers only" flash after a wasted hit

  /* -- Sector helpers. Everything past sector 10 reads these instead of doing
        its own arithmetic, so the curve lives in one place. -- */

  // "LEVEL 5" inside the campaign, "SECTOR 23" out in the Patrol.
  sectorLabel() {
    return (this.sector <= CONFIG.maxLevel ? "LEVEL " : "SECTOR ") + this.sector;
  },

  // Terrain is a visual ramp that tops out at sector 10; sectors keep counting.
  terrainLevel() { return Math.min(this.sector, CONFIG.maxLevel); },

  /* -- Sector modifiers. One per Patrol sector; never on a boss sector, and
        no flavour repeats within three sectors. -- */

  modifierDef() { return this.modifier ? MODIFIERS[this.modifier] : null; },
  hasModifier(id) { return this.modifier === id; },
  isBossSector() { return !!bossForSector(this.sector); },

  pickModifier() {
    this.modifier = null;
    if (this.sector <= CONFIG.maxLevel || this.isBossSector()) return;
    const all = Object.keys(MODIFIERS);
    let pool = all.filter((id) => this.recentMods.indexOf(id) === -1);
    // Ease into the Patrol: the first endless sector only shifts the look or
    // the jump arc, never the enemy mix.
    if (this.sector === CONFIG.maxLevel + 1) {
      pool = ["blackout", "gravity"].filter((id) => this.recentMods.indexOf(id) === -1);
    }
    if (!pool.length) pool = all;
    this.modifier = pool[Math.floor(Math.random() * pool.length)];
    this.recentMods.push(this.modifier);
    if (this.recentMods.length > 3) this.recentMods.shift();
  },

  // World scroll (px/sec), capped so the endgame never outruns the driver.
  scrollSpeed() {
    const s = Math.min(
      CONFIG.scrollSpeed + CONFIG.scrollSpeedPerLevel * (this.sector - 1),
      CONFIG.scrollCap
    );
    const m = this.modifierDef();
    return m && m.scrollScale ? Math.round(s * m.scrollScale) : s;
  },

  // Jump arc — LOW GRAVITY floats the jeep higher and drops it slower.
  jumpPower() {
    const m = this.modifierDef();
    return (m && m.jump) || CONFIG.jumpPower;
  },
  gravity() {
    const m = this.modifierDef();
    return (m && m.gravity) || CONFIG.gravity;
  },

  // Which enemy the spawner rolls; AIR RAID / GROUND SWARM bias the mix.
  spawnType() {
    const m = this.modifierDef();
    if (m && m.airBias)    return Math.random() < m.airBias    ? "air" : "ground";
    if (m && m.groundBias) return Math.random() < m.groundBias ? "ground" : "air";
    if (this.sector === 1 && Math.random() < 0.65) return "ground";
    return Math.random() < 0.5 ? "ground" : "air";
  },

  // Seconds between a bomber's bomb drops.
  bomberDropGap() {
    const m = this.modifierDef();
    return (m && m.dropGap) || [CONFIG.bomberDropMin, CONFIG.bomberDropMax];
  },

  // Enemies allowed on screen at once: 4, then 5 from sector 15, 6 from 25.
  enemyCap() {
    if (this.sector >= 25) return 6;
    if (this.sector >= 15) return 5;
    return CONFIG.maxEnemies;
  },

  // Multiplier on the spawn gap: tightens to 0.35 by sector 4, then keeps
  // easing down to 0.22 across the Patrol.
  spawnScale() {
    if (this.sector <= CONFIG.maxLevel) {
      return Math.max(0.35, 1 - CONFIG.spawnShrinkPerLevel * (this.sector - 1));
    }
    return Math.max(CONFIG.spawnScaleFloor, 0.35 - 0.01 * (this.sector - CONFIG.maxLevel));
  },

  // Multiplier on the enemy fire gap. Burns down to 0.38, never further.
  fireScale() {
    return Math.max(CONFIG.fireScaleFloor, 1 - 0.05 * (this.sector - 1));
  },

  // Enemy shot speed: +9 px/sec per sector, ceiling 240.
  foeBulletSpeed() {
    const s = CONFIG.enemyBulletSpeed + CONFIG.enemyBulletSpeedPerLevel * (this.sector - 1);
    return Math.min(s, CONFIG.enemyBulletSpeedCap);
  },

  // Red bomber visits per sector: 1 / 2 / 3 through the campaign, then 4 and 5.
  bomberQuota() {
    let quota = this.sector >= 30 ? 5 : this.sector >= 20 ? 4 : this.sector === 1 ? 1 : this.sector === 2 ? 2 : 3;
    const m = this.modifierDef();
    if (m && m.bomberQuota) quota = Math.max(quota, m.bomberQuota);
    return quota;
  },

  // Remember the deepest sector ever reached (shown on the title screen).
  saveDepth() {
    if (this.sector <= this.depth) return;
    this.depth = this.sector;
    localStorage.setItem("moonranger_depth", String(this.depth));
  },

  // Seconds one level takes at the current scroll speed.
  computeLevelDuration() {
    return CONFIG.levelLength / this.scrollSpeed();
  },

  // Spread this level's red ships evenly across the whole level (with jitter):
  // L1 gets one mid-level visit, L2 two, L3+ three — never stacked up front.
  scheduleBombers() {
    this.levelDuration = this.computeLevelDuration();
    this.levelElapsed = 0;
    this.bomberIdx = 0;
    const quota = this.bomberQuota();
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
    this.sector = 1;
    this.cleared = false;
    this.patrolAnnounced = false;
    this.winFlash = 0;
    this.modifier = null;
    this.recentMods = [];
    this.distance = 0;
    this.worldOffset = 0;
    this.spawnTimer = 2.5;
    this.scheduleBombers();
    this.meteorTimer = rand(CONFIG.meteorMinGap, CONFIG.meteorMaxGap);
    this.banner = "LEVEL 1";
    this.bannerTimer = 2;
    this.shake = 0;
    this.flash = 0;
    Terrain.setLevel(this.terrainLevel());
    Jeep.reset();
    this.shield = 0;
    this.shopFlash = 0;
    this.roverCycle = 0;
    this.bossActive = false;
    this.bossDefeated = false;
    this.bossHintTimer = 0;
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
    this.saveDepth();
    this.hiScore = Math.max(this.hiScore, Math.floor(this.score));
    localStorage.setItem("moonranger_hi", String(this.hiScore));
    clearPresses();
    AudioSys.gameOver();
  },

  // The campaign octopus is dead, but the run is not over: hold a short
  // MOON SAVED freeze (update() returns early while winFlash runs), then roll
  // into the endless Patrol at sector 11.
  milestone() {
    this.cleared = true;
    if (!this.clearedEver) {
      this.clearedEver = true;
      localStorage.setItem("moonranger_cleared", "1");
    }
    this.bossDefeated = true;   // don't respawn the octopus behind the overlay
    this.winFlash = CONFIG.milestoneTime;
    this.saveDepth();
    clearPresses();
    AudioSys.victory();
  },

  nextLevel() {
    this.sector++;                    // no cap — the Patrol is endless
    this.pickModifier();              // before scheduleBombers: it reads scroll
    Terrain.setLevel(this.terrainLevel());
    this.bossActive = false;
    this.bossDefeated = false;
    this.bossHintTimer = 0;
    // Any bomber still on screen belongs to the PREVIOUS level's quota:
    // send it packing so this level serves up exactly its own count.
    for (const e of enemies) {
      if (e.type === "bomber" && !e.retreating) e.retreating = true;
    }
    this.scheduleBombers(); // fresh, evenly-spread bomber quota
    const modName = this.modifier ? " - " + MODIFIERS[this.modifier].name : "";
    if (!this.patrolAnnounced && this.sector > CONFIG.maxLevel) {
      this.patrolAnnounced = true;
      this.banner = "PATROL BEGINS" + modName;
    } else {
      this.banner = this.sector === CONFIG.maxLevel
        ? "LEVEL 10 — MAX HILLS!"
        : this.sectorLabel() + modName;
    }
    this.bannerTimer = 2;
    this.saveDepth();
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
  { name: "MISSILES  45 AUTO",     price: () => CONFIG.priceMissiles,    owned: () => Jeep.missiles >= CONFIG.maxMissileStacks,    apply() { Jeep.missiles++; } },
  { name: "HEAT SEEKERS  AUTO",    price: () => CONFIG.priceHeatSeekers, owned: () => Jeep.heatSeekers >= CONFIG.maxHeatStacks, apply() { Jeep.heatSeekers++; } },
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

  /* -- MOON SAVED freeze: the world holds still for a moment after the
        campaign octopus dies, then the Patrol begins at sector 11. -- */
  if (Game.winFlash > 0) {
    Game.winFlash -= dt;
    if (Game.winFlash <= 0) {
      clearPresses();
      Game.nextLevel();
    }
    clicked = false;
    return;
  }

  // Open the buy menu from play.
  if (consumePress("KeyB")) {
    Game.state = "shop";
    AudioSys.shopOpen();
    clicked = false;
    return;
  }

  /* ---- PLAY ---- */

  // The world slows right down while a boss is on screen — the fight is an arena.
  const scroll = Game.scrollSpeed() * (Game.bossActive ? CONFIG.bossScrollFactor : 1);

  // World scrolls; jeep x stays put.
  Game.worldOffset += scroll * dt;
  Game.distance += scroll * dt;
  Game.score += scroll * dt * CONFIG.scorePerPixel;

  // Sector progression by distance travelled. Levels 3, 7 and 10 hold their
  // finish line open until their boss dies; there is no upper bound any more.
  const levelEnd = Game.distance >= Game.sector * CONFIG.levelLength;
  if (levelEnd && bossForSector(Game.sector) && !Game.bossDefeated) {
    Game.distance = Game.sector * CONFIG.levelLength;   // hold the finish line
    if (!Game.bossActive) spawnBoss(Game.sector);
  } else if (levelEnd) {
    Game.nextLevel();
  }

  if (Game.bannerTimer > 0) Game.bannerTimer -= dt;
  if (Game.shake > 0) Game.shake -= dt;
  if (Game.flash > 0) Game.flash -= dt;
  if (Game.bossHintTimer > 0) Game.bossHintTimer -= dt;

  /* -- Jeep -- */
  const jeepWorldX = Game.worldOffset + Jeep.x;
  const groundHere = Terrain.groundY(jeepWorldX);

  if (consumePress("ArrowUp") || consumePress("KeyW")) {
    if (!Jeep.airborne) {
      Jeep.vy = -Game.jumpPower();
      Jeep.airborne = true;
      AudioSys.jump();
    }
  }

  if (Jeep.airborne) {
    Jeep.vy += Game.gravity() * dt;
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

  /* -- Bought ordnance: each stack adds a shot, fired as a 1,2,3 volley -- */
  if (Jeep.missiles > 0) {
    Jeep.missileTimer -= dt;
    if (Jeep.missileTimer <= 0) {
      Jeep.missileTimer = CONFIG.missileInterval;
      Jeep.salvoLeft = Jeep.missiles;          // this cycle fires 1-3 shots
      Jeep.salvoTimer = 0;                     // first one leaves immediately
    }
    if (Jeep.salvoLeft > 0) {
      Jeep.salvoTimer -= dt;
      if (Jeep.salvoTimer <= 0) {
        const mz = Jeep.muzzle();
        spawnMissile(mz.x, mz.y, false);       // straight 45° up-right
        Jeep.salvoLeft--;
        Jeep.salvoTimer = CONFIG.salvoGap;
      }
    }
  }
  if (Jeep.heatSeekers > 0) {
    Jeep.heatTimer -= dt;
    if (Jeep.heatTimer <= 0) {
      Jeep.heatTimer = CONFIG.heatInterval;
      Jeep.heatSalvoLeft = Jeep.heatSeekers;
      Jeep.heatSalvoTimer = 0;
    }
    if (Jeep.heatSalvoLeft > 0) {
      Jeep.heatSalvoTimer -= dt;
      if (Jeep.heatSalvoTimer <= 0) {
        spawnMissile(Jeep.centerX, Jeep.y - 4, true); // red homing missile
        Jeep.heatSalvoLeft--;
        Jeep.heatSalvoTimer = CONFIG.salvoGap;
      }
    }
  }

  /* -- Enemy spawning -- */
  Game.spawnTimer -= dt;
  if (Game.spawnTimer <= 0 && enemies.length < Game.enemyCap() && !Game.bossActive) {
    Game.spawnTimer = rand(CONFIG.spawnMinBase, CONFIG.spawnMaxBase) * Game.spawnScale();
    spawnEnemy(Game.spawnType(), Game.worldOffset);
  }

  /* -- Red bomber quota (1 on L1, 2 on L2, 3 from L3) --
     Arrivals follow an absolute schedule spread across the whole level.
     Bombers are quota units, so they ignore the regular enemy cap (that
     cap used to starve them out at higher levels). */
  if (!Game.bossActive) Game.levelElapsed += dt;   // boss fights pause the schedule
  if (!Game.bossActive
      && Game.bomberIdx < Game.bomberSchedule.length
      && Game.levelElapsed >= Game.bomberSchedule[Game.bomberIdx]) {
    const anyRetreating = enemies.some(en => en.type === "bomber" && en.retreating);
    const activeBombers = enemies.filter(en => en.type === "bomber" && !en.retreating).length;
    if (!anyRetreating && activeBombers < CONFIG.bomberMaxActive) {
      Game.bomberIdx++;
      spawnEnemy("bomber", Game.worldOffset);
    }
  }

  /* -- Meteors (from level 3 onward; they keep falling during boss fights) -- */
  if (Game.sector >= 3) {
    Game.meteorTimer -= dt;
    if (Game.meteorTimer <= 0) {
      const mod = Game.modifierDef();
      const gap = Game.bossActive
        ? [CONFIG.bossMeteorMinGap, CONFIG.bossMeteorMaxGap]
        : (mod && mod.meteorGap) || [CONFIG.meteorMinGap, CONFIG.meteorMaxGap];
      Game.meteorTimer = rand(gap[0], gap[1]);
      // METEOR STORM keeps the sky busy but caps how many rocks are live.
      if (!mod || !mod.meteorMax || meteors.length < mod.meteorMax) {
        // In a boss fight they slam down between the jeep and the creature, so
        // the rolling rock is a jumpable hazard without covering the boss.
        spawnMeteor(Game.bossActive ? 0.30 : 0.55, Game.bossActive ? 0.50 : 0.85);
      }
    }
  }

  /* -- Enemies -- */
  const foeBulletSpeed = Game.foeBulletSpeed();
  const fireScale = Game.fireScale();
  // AIR RAID / GROUND SWARM also wind their side of the mix up 15%.
  const modDef = Game.modifierDef();
  const groundScale = modDef && modDef.groundBias ? modDef.speedScale : 1;
  const airScale = modDef && modDef.airBias ? modDef.speedScale : 1;

  for (const e of enemies) {
    if (e.hitFlash > 0) e.hitFlash -= dt;
    if (e.type === "ground") {
      // Ground enemies ride the terrain, drifting left against the scroll.
      e.x -= (scroll + CONFIG.groundEnemySpeed * groundScale) * dt;
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
          const gap = Game.bomberDropGap();
          e.dropTimer = rand(gap[0], gap[1]);
          spawnBomb(e.x + e.w / 2, e.y + e.h);
        }
      }
    } else if (e.type === "boss") {
      // Boss: slides in from the right, then hovers in the arena, swaying.
      if (e.entry > 0) {
        e.entry -= dt;
        const travel = CONFIG.viewW + 8 - e.baseX;
        e.x = e.baseX + Math.max(0, e.entry / CONFIG.bossEntryTime) * travel;
        e.y = e.baseY;
      } else {
        e.bob += dt * 1.5;
        e.x = e.baseX + Math.sin(e.bob * 0.9) * 9;
        e.y = e.baseY + Math.sin(e.bob) * 5;
        // SHIELDED: slowly regains a hit point; any damage restarts the clock
        // (see damageBoss). Only while fully materialised, never mid-entry.
        if (e.shielded && e.hp < e.maxHp) {
          e.regenTimer -= dt;
          if (e.regenTimer <= 0) {
            e.regenTimer = CONFIG.bossShieldRegen;
            e.hp++;
            tinySpark(e.x + e.w / 2, e.y + e.h / 2);
            AudioSys.beep(260, 560, 0.14, 0.06);
          }
        }
      }
    } else {
      // Air enemies hold altitude with a gentle bob.
      e.bob += dt * 2.4;
      e.x -= CONFIG.airEnemySpeed * airScale * dt;
      e.y += Math.sin(e.bob) * 12 * dt;
    }

    // Each enemy has at most ONE live bullet ("one at a time").
    if (e.myBullet && e.myBullet.dead) e.myBullet = null;

    const isBoss = e.type === "boss";
    const onScreen = e.x < CONFIG.viewW - 4 && e.x + e.w > 0;
    const mayFire = onScreen && !e.myBullet && !(isBoss && e.entry > 0);
    if (mayFire) {
      e.fireTimer -= dt;
      if (e.fireTimer <= 0) {
        e.fireTimer = isBoss
          ? rand(CONFIG.bossFireMin, CONFIG.bossFireMax) * (e.frenzied ? CONFIG.bossFrenzyFireScale : 1)
          : rand(CONFIG.enemyFireMin, CONFIG.enemyFireMax) * fireScale;
        // Aim a dot straight at the jeep's current position.
        const sx = e.x + e.w / 2, sy = e.y + e.h / 2;
        const dx = Jeep.centerX - sx, dy = Jeep.centerY - sy;
        const d = Math.hypot(dx, dy) || 1;
        const spd = isBoss ? CONFIG.bossBulletSpeed : foeBulletSpeed;
        e.myBullet = spawnBullet(sx, sy, (dx / d) * spd, (dy / d) * spd, false, e);
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
          if (e.type === "boss") {
            damageBoss(e, false, b.x, b.y);
          } else if (e.type === "bomber") {
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
            // Rovers and saucers die in one hit, unless ARMORED is running.
            e.hp--;
            if (e.hp > 0) {
              e.hitFlash = 0.09;
              tinySpark(b.x, b.y);
            } else {
              e.dead = true;
              explode(e.x + e.w / 2, e.y + e.h / 2, enemyMainColor(e));
              Game.score += e.type === "ground" ? CONFIG.scorePerGroundKill : CONFIG.scorePerAirKill;
            }
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
        if (e.type === "boss") {
          damageBoss(e, m.heat, m.x, m.y);
        } else if (e.type === "bomber") {
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
          e.hp--;
          if (e.hp > 0) {
            e.hitFlash = 0.09;
            tinySpark(m.x, m.y);
          } else {
            e.dead = true;
            explode(e.x + e.w / 2, e.y + e.h / 2, enemyMainColor(e));
            Game.score += e.type === "ground" ? CONFIG.scorePerGroundKill : CONFIG.scorePerAirKill;
          }
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
  " ": [0,0,0,0,0], "-": [0,0,7,0,0], "+": [0,2,7,2,0], "!": [2,2,2,0,2], ".": [0,0,0,0,2],
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

  /* Stars (parallax with the world). BLACKOUT pulls them out of the sky. */
  if (!Game.hasModifier("blackout")) {
    for (const st of stars) {
      const speed = st.near ? 0.25 : 0.1;
      let sx = (st.x - Game.worldOffset * speed) % CONFIG.viewW;
      if (sx < 0) sx += CONFIG.viewW;
      ctx.fillStyle = st.near ? COLORS.starNear : COLORS.starFar;
      ctx.fillRect(Math.round(sx), Math.round(st.y), st.near ? 2 : 1, st.near ? 2 : 1);
    }
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

  // Bright rim along the surface — classic Atari ground highlight. BLACKOUT
  // drops the rim too, so the horizon loses its outline.
  if (!Game.hasModifier("blackout")) {
    ctx.fillStyle = COLORS.groundRim;
    for (let sx = -8; sx <= CONFIG.viewW + 8; sx += 2) {
      ctx.fillRect(sx, Math.round(Terrain.groundY(Game.worldOffset + sx)), 2, 2);
    }
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
    } else if (b.bossKind) {
      drawBossBullet(b);
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
  else if (Game.winFlash > 0) drawMilestone();
  else if (Game.bannerTimer > 0) {
    const pulse = Math.floor(Game.bannerTimer * 6) % 2 === 0;
    // Patrol banners carry a modifier name, so they are long enough to land on
    // an enemy: sit them on a dark band instead of bare sky.
    const bw = textWidth(Game.banner, 2) + 12;
    ctx.fillStyle = "rgba(0,0,10,0.62)";
    ctx.fillRect(Math.round((CONFIG.viewW - bw) / 2), 80, Math.round(bw), 16);
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
  // Non-fatal hits flash the sprite; BLACKOUT brightens every enemy so the
  // silhouettes still read against a starless sky.
  if (e.hitFlash > 0) ctx.filter = "brightness(2)";
  else if (Game.hasModifier("blackout")) ctx.filter = "brightness(1.35)";
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
  } else if (e.type === "boss") {
    drawBoss(e);
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
  ctx.filter = "none";
}

/* -- Boss creature art. All three are drawn in blocks at the 480x270 buffer's
   resolution so they read as chunky 8-bit sprites. -- */
function drawBoss(e) {
  // Brighten the sprite itself while a hit lands. A white rect would just
  // paint the hitbox as a grey card behind the creature.
  const flash = e.hitFlash > 0;
  if (flash) ctx.filter = "brightness(2.4)";
  if (e.bossKind === "spider") drawSpider(e);
  else if (e.bossKind === "crab") drawCrab(e);
  else drawOctopus(e);
  if (flash) ctx.filter = "none";
}

// SPIDER — level 3. Two-lobed purple body, eight long jointed legs, four eyes.
function drawSpider(e) {
  const x = Math.round(e.x), y = Math.round(e.y);
  const k = Math.floor(performance.now() / 180) % 2;   // leg tick

  // Legs are runs of 3x3 blocks stepping outward: contiguous, so they read as
  // limbs rather than dashes. Hips sit on the body edge so none are buried.
  // [hipX, hipY, dx1, dy1, n1, dx2, dy2, n2]
  const run = (sx, sy, dx, dy, n) => {
    for (let s = 0; s < n; s++) ctx.fillRect(x + sx + dx * s, y + sy + dy * s, 3, 3);
  };
  const legs = [
    [34, 24, -3, -2, 5, -2, -1, 4],
    [34, 29, -3, -1, 6, -2,  0, 3],
    [34, 34, -3,  1, 6, -2,  0, 3],
    [34, 38, -3,  2, 4, -2,  0, 3],
    [66, 24,  3, -2, 5,  2, -1, 3],
    [66, 29,  3, -1, 6,  2,  0, 2],
    [66, 34,  3,  1, 6,  2,  0, 2],
    [66, 38,  3,  2, 3,  2,  0, 2],
  ];
  ctx.fillStyle = COLORS.bossSpiderDk;
  for (let i = 0; i < legs.length; i++) {
    const [hx, hy, dx1, dy1, n1, dx2, dy2, n2] = legs[i];
    const t = i % 2 === k ? 1 : 0;
    run(hx, hy + t, dx1, dy1, n1);
    run(hx + dx1 * (n1 - 1), hy + dy1 * (n1 - 1) + t, dx2, dy2, n2);
  }

  // Abdomen: tall rounded blob at the rear, with darker banding.
  ctx.fillStyle = COLORS.bossSpider;
  ctx.fillRect(x + 46, y + 14, 20, 5);
  ctx.fillRect(x + 40, y + 19, 30, 12);
  ctx.fillRect(x + 44, y + 31, 24, 6);
  ctx.fillRect(x + 50, y + 37, 14, 3);
  ctx.fillStyle = COLORS.bossSpiderDk;
  ctx.fillRect(x + 46, y + 21, 18, 3);
  ctx.fillRect(x + 48, y + 27, 14, 3);
  ctx.fillRect(x + 53, y + 33, 10, 2);

  // Cephalothorax and head, facing the jeep.
  ctx.fillStyle = COLORS.bossSpider;
  ctx.fillRect(x + 24, y + 22, 18, 14);
  ctx.fillRect(x + 12, y + 24, 14, 12);

  // Four bright eyes.
  ctx.fillStyle = COLORS.bossEye;
  ctx.fillRect(x + 13, y + 26, 3, 3);
  ctx.fillRect(x + 18, y + 26, 3, 3);
  ctx.fillRect(x + 13, y + 32, 3, 3);
  ctx.fillRect(x + 18, y + 32, 3, 3);
  ctx.fillStyle = COLORS.bossPupil;
  ctx.fillRect(x + 14, y + 27, 1, 1);
  ctx.fillRect(x + 19, y + 33, 1, 1);

  // Fangs.
  ctx.fillStyle = COLORS.bossSpiderDk;
  ctx.fillRect(x + 9, y + 27, 4, 2);
  ctx.fillRect(x + 9, y + 32, 4, 2);
}

// CRAB — level 7. Wide carapace, two big raised claws, eyestalks, six legs.
function drawCrab(e) {
  const x = Math.round(e.x), y = Math.round(e.y);
  const lift = Math.round(Math.sin(performance.now() / 500) * 2);

  // Legs: three jointed runs a side, stepping down and outward.
  const run = (sx, sy, dx, dy, n) => {
    for (let s = 0; s < n; s++) ctx.fillRect(x + sx + dx * s, y + sy + dy * s, 3, 3);
  };
  ctx.fillStyle = COLORS.bossCrabDk;
  for (let i = 0; i < 3; i++) {
    const ly = 24 + i * 6;
    run(30, ly, -4, 2, 3);
    run(66, ly,  4, 2, 3);
  }

  // Carapace: wide stepped shell with darker ridges.
  ctx.fillStyle = COLORS.bossCrab;
  ctx.fillRect(x + 34, y + 12, 26, 6);
  ctx.fillRect(x + 28, y + 16, 40, 12);
  ctx.fillRect(x + 30, y + 28, 36, 6);
  ctx.fillStyle = COLORS.bossCrabDk;
  ctx.fillRect(x + 34, y + 19, 26, 3);
  ctx.fillRect(x + 37, y + 24, 19, 2);

  // Claws: two big pincers at the front, bobbing.
  ctx.fillStyle = COLORS.bossCrab;
  ctx.fillRect(x + 16, y + 2 + lift, 22, 9);
  ctx.fillRect(x + 10, y + 7 + lift, 10, 8);
  ctx.fillRect(x + 18, y + 30 - lift, 20, 9);
  ctx.fillRect(x + 12, y + 32 - lift, 10, 8);
  ctx.fillStyle = COLORS.bossCrabDk;
  ctx.fillRect(x + 18, y + 11 + lift, 14, 3);    // upper pincer mouth
  ctx.fillRect(x + 18, y + 30 - lift, 12, 3);    // lower pincer mouth
  ctx.fillRect(x + 30, y + 4 + lift, 6, 8);      // arms into the shell
  ctx.fillRect(x + 30, y + 30 - lift, 6, 8);

  // Eyestalks with big white eyes.
  ctx.fillStyle = COLORS.bossCrabDk;
  ctx.fillRect(x + 42, y + 6, 2, 8);
  ctx.fillRect(x + 54, y + 6, 2, 8);
  ctx.fillStyle = COLORS.bossEye;
  ctx.fillRect(x + 39, y + 1, 7, 6);
  ctx.fillRect(x + 51, y + 1, 7, 6);
  ctx.fillStyle = COLORS.bossPupil;
  ctx.fillRect(x + 41, y + 3, 2, 2);
  ctx.fillRect(x + 53, y + 3, 2, 2);
}

// OCTOPUS — the level 10 final boss. Eight wriggling tentacles under a huge
// 8-bit head. Immune to bullets and plain missiles: 20 heat seekers only.
function drawOctopus(e) {
  const x = Math.round(e.x), y = Math.round(e.y);
  const t = performance.now() / 1000;

  // Tentacles: eight columns of blocks, each swaying on its own phase.
  for (let i = 0; i < 8; i++) {
    const bx = x + 12 + i * 12;
    const sway = Math.sin(t * 2.2 + i * 0.8);
    for (let s = 0; s < 5; s++) {
      const w = 10 - s;
      const off = Math.round(sway * s * 1.2);
      ctx.fillStyle = i % 2 ? COLORS.bossOctoDk : COLORS.bossOcto;
      ctx.fillRect(bx + off, y + 44 + s * 5, w, 5);
    }
    ctx.fillStyle = COLORS.bossEye;
    ctx.fillRect(bx + Math.round(sway * 4) + 4, y + 48, 1, 1);   // sucker
  }

  // Head: stacked rows, widest in the middle — a big 8-bit dome.
  ctx.fillStyle = COLORS.bossOcto;
  ctx.fillRect(x + 32, y + 2, 48, 6);
  ctx.fillRect(x + 22, y + 8, 68, 8);
  ctx.fillRect(x + 14, y + 16, 84, 12);
  ctx.fillRect(x + 8, y + 28, 96, 12);
  ctx.fillRect(x + 12, y + 40, 88, 8);
  ctx.fillStyle = COLORS.bossOctoDk;
  ctx.fillRect(x + 12, y + 44, 88, 4);            // darker underside
  ctx.fillRect(x + 18, y + 26, 8, 4);             // skin blotches
  ctx.fillRect(x + 86, y + 26, 8, 4);

  // Two big white eyes with pupils looking at the jeep.
  ctx.fillStyle = COLORS.bossEye;
  ctx.fillRect(x + 30, y + 16, 18, 16);
  ctx.fillRect(x + 64, y + 16, 18, 16);
  ctx.fillStyle = COLORS.bossPupil;
  ctx.fillRect(x + 33, y + 20, 8, 8);
  ctx.fillRect(x + 67, y + 20, 8, 8);

  // Beak.
  ctx.fillStyle = COLORS.bossBeak;
  ctx.fillRect(x + 50, y + 36, 14, 6);
  ctx.fillStyle = COLORS.bossOctoDk;
  ctx.fillRect(x + 52, y + 41, 10, 2);
}

// Boss projectiles are tiny copies of the creature that fired them: a small
// sprite plus a halo that pulses as it flies. The hitbox is still a point, so
// the size is purely cosmetic.
function drawBossBullet(b) {
  const x = Math.round(b.x), y = Math.round(b.y);
  const kind = b.bossKind;
  const color = kind === "spider" ? COLORS.bossSpider
    : kind === "crab" ? COLORS.bossCrab
    : COLORS.bossOcto;
  const dark = kind === "spider" ? COLORS.bossSpiderDk
    : kind === "crab" ? COLORS.bossCrabDk
    : COLORS.bossOctoDk;

  // Pulsing halo: eight pixels that breathe outward and fade. Keeping it
  // pixel-sized avoids the "selection box" look of a stroked rectangle.
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 110);
  const r = Math.round(5 + pulse * 2);        // 5..7 px from the centre
  const d = Math.round(r * 0.7);
  ctx.globalAlpha = 0.3 + (1 - pulse) * 0.45;
  ctx.fillStyle = color;
  for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [d, d], [d, -d], [-d, d], [-d, -d]]) {
    ctx.fillRect(x + dx, y + dy, 1, 1);
  }
  ctx.globalAlpha = 1;

  // A dark silhouette behind the body keeps each little monster readable
  // against the black sky.
  ctx.fillStyle = dark;
  if (kind === "spider") {
    ctx.fillRect(x - 3, y - 3, 7, 7);
    ctx.fillRect(x - 4, y - 2, 2, 1);          // legs
    ctx.fillRect(x - 4, y + 1, 2, 1);
    ctx.fillRect(x + 3, y - 2, 2, 1);
    ctx.fillRect(x + 3, y + 1, 2, 1);
    ctx.fillRect(x - 1, y - 4, 3, 1);
  } else if (kind === "crab") {
    ctx.fillRect(x - 4, y - 2, 9, 5);
    ctx.fillRect(x - 5, y - 4, 2, 2);          // claws
    ctx.fillRect(x + 4, y - 4, 2, 2);
    ctx.fillRect(x - 3, y + 2, 2, 1);          // legs
    ctx.fillRect(x, y + 2, 1, 1);
    ctx.fillRect(x + 2, y + 2, 2, 1);
  } else {
    ctx.fillRect(x - 4, y - 3, 9, 6);
    ctx.fillRect(x - 3, y + 3, 2, 1);          // tentacle tips
    ctx.fillRect(x, y + 3, 1, 1);
    ctx.fillRect(x + 2, y + 3, 2, 1);
  }

  ctx.fillStyle = color;
  if (kind === "spider") {
    ctx.fillRect(x - 2, y - 2, 5, 5);          // body
    ctx.fillStyle = COLORS.bossEye;
    ctx.fillRect(x - 1, y - 1, 1, 1);          // eyes
    ctx.fillRect(x + 1, y - 1, 1, 1);
  } else if (kind === "crab") {
    ctx.fillRect(x - 3, y - 1, 7, 3);          // shell
    ctx.fillRect(x - 5, y - 4, 2, 2);          // claws
    ctx.fillRect(x + 4, y - 4, 2, 2);
    ctx.fillStyle = COLORS.bossEye;
    ctx.fillRect(x - 2, y - 2, 1, 1);          // eyes
    ctx.fillRect(x + 1, y - 2, 1, 1);
  } else {
    ctx.fillRect(x - 3, y - 2, 7, 4);          // dome
    ctx.fillRect(x - 3, y + 2, 2, 2);          // tentacles
    ctx.fillRect(x, y + 2, 1, 2);
    ctx.fillRect(x + 2, y + 2, 2, 2);
    ctx.fillStyle = COLORS.bossEye;
    ctx.fillRect(x - 2, y - 1, 1, 1);          // eyes
    ctx.fillRect(x + 1, y - 1, 1, 1);
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
  if (Jeep.missiles > 0) {
    const s = "MSL " + Jeep.missiles;
    drawText(s, px, 14, 1, COLORS.hud);
    px += textWidth(s, 1) + 5;
  }
  if (Jeep.heatSeekers > 0) {
    const s = "HEAT " + Jeep.heatSeekers;
    drawText(s, px, 14, 1, COLORS.bomber);
    px += textWidth(s, 1) + 5;
  }

  const lvl = Game.sectorLabel();
  drawText(lvl, CONFIG.viewW - textWidth(lvl, 1) - 6, 6, 1, COLORS.hud);
  // Active sector modifier, dim and out of the way under the power-up row.
  if (Game.modifier) {
    drawText(MODIFIERS[Game.modifier].name, 6, 22, 1, COLORS.hudDim);
  }
  if (AudioSys.muted) drawText("MUTED", CONFIG.viewW - textWidth("MUTED", 1) - 6, 14, 1, COLORS.hudDim);

  // Boss health: name over a bar, plus the octopus' immunity hint. Only while
  // a fight is actually running — not over the game-over or victory screens.
  const boss = (Game.state === "play" || Game.state === "pause" || Game.state === "shop")
    ? enemies.find(e => e.type === "boss" && !e.dead)
    : null;
  if (boss) {
    const bw = 160, bx = Math.round((CONFIG.viewW - bw) / 2), by = 26;
    drawTextCentered(boss.name + (boss.elite ? " - " + boss.elite : ""), by - 9, 1, enemyMainColor(boss));
    ctx.strokeStyle = COLORS.hudDim;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw, 5);
    const frac = Math.max(0, boss.hp / boss.maxHp);
    ctx.fillStyle = boss.heatOnly ? COLORS.bulletYou : COLORS.bomber;
    ctx.fillRect(bx + 1, by + 1, Math.round((bw - 1) * frac), 4);
    if (boss.heatOnly) {
      const hot = Game.bossHintTimer > 0 && Math.floor(performance.now() / 120) % 2 === 0;
      drawTextCentered("HEAT SEEKERS ONLY", by + 12, 1, hot ? COLORS.bulletFoe : COLORS.hudDim);
    }
  }

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
  drawTextCentered("MOON RANGER", 70, 3, COLORS.jeepBody);
  drawTextCentered("PATROL THE MOON", 104, 1, COLORS.hud);
  drawTextCentered("W/UP JUMP   A/D AIM GUN", 126, 1, COLORS.hudDim);
  drawTextCentered("SPACE FIRE  P PAUSE  M MUTE", 138, 1, COLORS.hudDim);
  drawTextCentered("B BUY MENU  F FULLSCREEN", 150, 1, COLORS.hudDim);
  if (Math.floor(performance.now() / 400) % 2 === 0) {
    drawTextCentered("PRESS SPACE TO START", 172, 1, COLORS.groundRim);
  }
  if (Game.hiScore > 0) drawTextCentered("HI-SCORE " + Game.hiScore, 184, 1, COLORS.bulletFoe);
  if (Game.depth > 0) drawTextCentered("DEEPEST SECTOR " + Game.depth, 196, 1, COLORS.bulletYou);
  if (Game.clearedEver) drawTextCentered("MOON SAVED", 208, 1, COLORS.jeepBody);
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
    const label = (i + 1) + " " + it.name + (owned ? "  MAX" : "  " + it.price());
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
  drawTextCentered("REACHED " + Game.sectorLabel(), 166, 1, COLORS.hudDim);
  if (Math.floor(performance.now() / 400) % 2 === 0) {
    drawTextCentered("PRESS SPACE TO RETRY", 192, 1, COLORS.groundRim);
  }
}

// Campaign milestone: the run continues, so this is a banner, not an ending.
function drawMilestone() {
  shade();
  drawTextCentered("MOON SAVED", 78, 3, COLORS.jeepBody);
  drawTextCentered("OCTOPUS DESTROYED", 118, 1, COLORS.hud);
  drawTextCentered("CURRENCY " + Math.floor(Game.score), 140, 1, COLORS.bulletYou);
  if (Math.floor(performance.now() / 400) % 2 === 0) {
    drawTextCentered("PATROL BEGINS...", 164, 1, COLORS.groundRim);
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
window.GAME = {
  Game, Jeep, Terrain, CONFIG, MODIFIERS,
  spawnEnemy, spawnBullet, spawnMeteor, spawnBoss, bossForSector, damageBoss,
  get enemies() { return enemies; },
  get bullets() { return bullets; },
  get meteors() { return meteors; },
  get missiles() { return missiles; },
};

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
