# MOON RANGER — Developer Walkthrough

A complete orientation for a developer joining this project. Read it top to bottom
once (~30 minutes), then keep it open as a map while you work.

**What this game is:** an Atari-style side-scrolling shooter in the browser. You drive
a jeep across lunar terrain, jump enemy fire, and shoot rovers, UFOs, and red bomber
saucers. Score doubles as currency, which you spend on shields and missiles. The
campaign runs from level 1 to the level-10 octopus, then continues into an endless
**Patrol** of sectors.

**What the codebase is:** four source files and four docs. No framework, no bundler, no
package manager, no dependencies, no build step, no tests. `game.js` is ~2,600 lines of
plain JavaScript in one file, organized into ten numbered sections.

---

## Contents

1. [Get it running](#1-get-it-running)
2. [The 60-second mental model](#2-the-60-second-mental-model)
3. [File-by-file tour](#3-file-by-file-tour)
4. [How one frame works](#4-how-one-frame-works)
5. [The ten sections of game.js](#5-the-ten-sections-of-gamejs)
6. [Coordinate systems and hitboxes](#6-coordinate-systems-and-hitboxes)
7. [Game data: state, pools, and entities](#7-game-data-state-pools-and-entities)
8. [Pacing: the numbers a player feels](#8-pacing-the-numbers-a-player-feels)
9. [Sectors, modifiers, and the Patrol](#9-sectors-modifiers-and-the-patrol)
10. [Debugging and testing recipes](#10-debugging-and-testing-recipes)
11. [How to change things (cookbook)](#11-how-to-change-things-cookbook)
12. [House rules and pitfalls](#12-house-rules-and-pitfalls)
13. [Deploying](#13-deploying)
14. [Glossary](#14-glossary)

---

## 1. Get it running

There is nothing to install. `index.html` loads `style.css` and `game.js` directly.

```bash
# from the project root — any static server works
python3 -m http.server 8123
# then open http://127.0.0.1:8123/index.html
```

You *can* open `index.html` straight from disk (it works over `file://`), but prefer a
local server: it mirrors how the game is served in production and keeps browser
script-loading rules identical to deploy.

**Your first 15 minutes of play** matter more than the code. Play a run to level 3 or
so and notice: the terrain gets hillier, enemies arrive faster, red bombers show up on
a schedule, and meteors start falling at level 3. Kill the spider, then skip ahead with
`GAME.Game.sector = 20; GAME.Game.distance = 32000` and watch a Patrol sector play
differently. Then come back to the code — every number you felt is in one object
(see [CONFIG](game.js#L38)).

**Before every commit**, the entire verification suite is:

```bash
node --check game.js     # syntax
# then reload the page and play for a minute
```

## 2. The 60-second mental model

- The game **simulates and draws at 480×270** in a `<canvas>`, then CSS scales that
  buffer up to fill the window with `image-rendering: pixelated`. Every coordinate you
  see in the code is in that 480×270 space, never in CSS pixels.
- The **jeep never moves horizontally**. The world scrolls right-to-left past it
  (`Game.worldOffset` grows every frame). "World x" of a visible object is
  `Game.worldOffset + screenX`.
- **Terrain is a pure function** of world x and terrain level: three stacked sine waves.
  Nothing stores hill geometry; `Terrain.groundY(worldX)` recomputes it on demand, so
  hills and craters scroll perfectly and nothing has to be kept in sync.
- The **simulation is fixed-step at 1/60 s**, decoupled from rendering, so speeds are in
  units-per-second and gameplay is identical on a 60 Hz or 144 Hz display.
- **Score is currency.** It trickles up with distance and jumps on kills; the buy menu
  (key **B**) subtracts what you spend. There is no separate points counter.
- **One counter, two names.** `Game.sector` counts runs of 1,600 px forever. Sectors 1–10
  are the campaign and display as `LEVEL n`; from 11 they display as `SECTOR n`. Terrain
  difficulty is clamped separately by `terrainLevel()`.
- **One state machine, five states:** `title`, `play`, `pause`, `shop`, `gameover`.
  `update()` dispatches on `Game.state`; `render()` always draws the world, then overlays
  the relevant screen. The post-octopus celebration is *not* a state — it is a
  `Game.winFlash` timer that freezes `play` (see [section 9](#9-sectors-modifiers-and-the-patrol)).

## 3. File-by-file tour

| File | Lines | What it holds |
| --- | --- | --- |
| [game.js](game.js) | ~2,600 | The entire game. Read this; everything else is a shell. |
| [index.html](index.html) | 18 | One `<canvas id="game">` and a classic (non-module) `<script src="game.js">`. |
| [style.css](style.css) | 28 | Full-window black page, pixelated canvas scaling. No game logic. |
| [favicon.svg](favicon.svg) | 85 | The pixel moon in the browser tab. Static art, unrelated to the game loop. |
| [vercel.json](vercel.json) | 6 | Marks the folder as a static deployment with no build. |
| [README.md](README.md) | — | Player-facing rules, controls, and deployment notes. |
| [CHANGELOG.md](CHANGELOG.md) | — | One entry per change, with a version bump each time. |
| [developers.md](developers.md) | — | This document. |
| [next_levels.md](next_levels.md) | — | The implementation plan for the Patrol, kept as design rationale. |

Two facts worth internalizing:

- **`index.html` loads `game.js` as a classic script, not a module.** That means no
  `import`/`export`, and top-level declarations are one shared scope. Don't convert it to
  `type="module"` casually: module scripts are deferred (load timing changes) and run in
  strict module scope, which would hide `window.GAME` unless explicitly assigned.
- **There are no binary assets.** Audio is synthesized with WebAudio oscillators, the
  font is a 3×5 bitmap table in code, and stars/craters are generated. `favicon.svg` is
  the one piece of static art, and it is text for exactly this reason. Dropping in a
  `.png`, `.ico` or `.wav` would be the first binary file in the repo — a deliberate
  design choice to keep it this small.

### The favicon

[favicon.svg](favicon.svg) is a hand-placed 16×16 pixel moon: a `viewBox="0 0 16 16"`
with `shape-rendering: crispEdges`, filled by 1×1 `<rect>`s that are merged into
horizontal runs (one rect per unbroken colour, per scanline). Nothing generates it at
runtime and no code reads it. To change the art, edit the rects by hand or rebuild it
from an ASCII map — five greys, one char each: highlight `#e8e8f4`, rim `#d8d8e8`,
rock `#9a9aa8`, shadow `#5c5c66`, crater `#3c3c46`, sky `#02020c` (the same lunar greys
as `COLORS` in `game.js`). Keep the disc inside the 16-unit box and the top and bottom
rows of sky, or the moon stops looking round in a small tab.

## 4. How one frame works

```js
// game.js:2385 — the whole loop
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000);  // seconds since last frame, clamped
  last = now;
  while (acc >= STEP) { update(STEP); acc -= STEP; }   // STEP = 1/60
  render();                                   // once per animation frame
  requestAnimationFrame(frame);
}
```

The accumulator is the important part. Frames can be uneven (a tab regains focus, the
browser hitches), but `update()` always receives exactly `1/60`. Two consequences:

1. **All motion must be written as `x += speed * dt`.** A bare `x += 2` runs at whatever
   the display's refresh rate is. That's why every number in `CONFIG` is either a
   per-second rate or a size.
2. The `Math.min(0.1, …)` clamp means a 5-second stall simulates at most 0.1 s — the game
   freezes briefly instead of fast-forwarding and killing you.

Inside `update(1/60)` during `play`, phases run in a fixed order (search for the
`/* -- ... -- */` comment banners):

```
state dispatch: title / gameover / shop / pause  →  (MOON SAVED freeze returns here)
world scroll (sector-scaled) + distance + currency trickle
sector check: a boss holds the finish line, otherwise nextLevel()
banner/shake/flash timers
jeep: jump (modifier-scaled), terrain snap, gun aim, fire
bought ordnance: missiles / heat seekers
enemy spawning  →  bomber schedule  →  meteor spawner   (spawns/bombers pause in boss fights)
enemies: move (a boss slides in, hovers, regenerates if SHIELDED), fire one aimed dot, ram check
bullets: move, terrain burial, hit enemies/meteors, hit jeep
bombs: fall, hit jeep or ground
meteors: fall → impact → roll
missiles: home (heat seekers), move, collide
sparks (particles)
sweep dead entities back into pools
```

Movement happens **before** collision, so collisions always test post-move positions.
If you add an entity type, insert its phase in that same rhythm.

`render()` then draws in back-to-front order: screen shake transform → sky → stars →
terrain fill + rim + craters → enemies/bombs/meteors/missiles/jeep → bullets → sparks →
flash → HUD → state overlay (or the frozen MOON SAVED card) → banner on its dark band.

## 5. The ten sections of game.js

The file starts with a map (lines 20–31) that matches the code exactly. Keep it accurate
if you add a section.

| # | Section | Start | What it does |
| --- | --- | --- | --- |
| 1 | CONFIG | [L38](game.js#L38) | Every tunable number. Rebalancing should not require touching logic. |
| 1b | MODIFIERS | [L192](game.js#L192) | The eight Patrol sector modifiers and their values. |
| 2 | PALETTE | [L206](game.js#L206) | `COLORS`, including the five rotating rover colorways and the boss colors. |
| 3 | AUDIO | [L259](game.js#L259) | `AudioSys`: square-wave beeps and filtered noise, lazily created on first input, mute persisted to `localStorage`. |
| 4 | INPUT | [L334](game.js#L334) | `Keys` (held) and `Pressed` (edge-triggered) maps, plus helpers. |
| 5 | TERRAIN | [L372](game.js#L372) | `groundY()` / `slope()` / difficulty `ramp()`. |
| 6 | ENTITIES | [L407](game.js#L407) | `Jeep` singleton, pools, spawners, bosses, `damageJeep()`, particles. |
| 7 | GAME STATE | [L799](game.js#L799) | `Game` object: state string, currency, sector, difficulty helpers, transitions. |
| 8 | UPDATE | [L1070](game.js#L1070) | The fixed-step simulation. The biggest function in the file. |
| 9 | RENDER | [L1714](game.js#L1714) | Pixel font, starfield, terrain drawing, all entity drawing, HUD, overlays. |
| 10 | MAIN LOOP | [L2525](game.js#L2525) | Debug handle, pointer input, fullscreen, letterbox resizing, the frame loop. |

### Reading order recommendation

1. `CONFIG` → `MODIFIERS` → `COLORS`: learn the vocabulary. Half the game is names and
   numbers.
2. `Terrain.groundY()` ([L372](game.js#L372)): 15 lines, and suddenly hills make sense.
3. `Jeep` ([L407](game.js#L407)): the player's whole data model.
4. `Game` ([L801](game.js#L801)): the state machine, the sector helpers, the transitions.
5. `update()` ([L1097](game.js#L1097)): read it in phases; don't try to hold 600 lines at once.
6. `drawText()` + `render()` ([L1738](game.js#L1738), [L1765](game.js#L1765)): there is no
   `ctx.fillText` anywhere — all text is a hand-drawn 3×5 bitmap font.
7. `frame()` ([L2593](game.js#L2593)): the loop, and you're done.

## 6. Coordinate systems and hitboxes

| Space | Origin | Used for |
| --- | --- | --- |
| Screen | top-left of the 480×270 buffer | everything you draw, and all entity `x`/`y` |
| World | `Game.worldOffset` (grows forever) | terrain sampling and craters only |

Rule of thumb: **terrain is sampled in world space, everything else lives in screen
space.**

```js
Terrain.groundY(Game.worldOffset + screenX)   // correct
Terrain.groundY(screenX)                       // wrong — hills won't scroll
```

Sizes (all pixels in the 480×270 buffer):

| Thing | Size | Notes |
| --- | --- | --- |
| Jeep | 26 × 12 | `CONFIG.jeepW/H`; screen x fixed at 70 |
| Ground rover | 24 × 16 | Rides the terrain; 2 HP under ARMORED |
| UFO | 30 × 15 | Bobs at y 40–113; 2 HP under ARMORED |
| Red bomber | 40 × 18 | 5–10 HP, shows armor pips |
| Bomb | 8 × 8 | Hitbox is an 8×8 box around the center |
| Meteor | 12 × 12 | Indestructible |
| Spider boss | 88 × 52 | Hovers around y 81 |
| Crab boss | 80 × 48 | Hovers around y 89 |
| Octopus boss | 112 × 70 | Hovers around y 81 |
| Bullet (yours) | 2 × 2 | Drawn 2×2 |
| Bullet (enemy) | 4 × 4 | Boss shots are a small sprite, but the hitbox is still a point |
| Boss missile | 9 × 6 | Drawn rotated along its velocity; hitbox is an 8×8 box |

Ground height is `viewH * 0.80` = 216 px, modulated by hills whose amplitude grows from
6 px (level 1) to 46 px (level 10). The jeep body's `y` is the **top** of the body; its
wheels extend ~6 px below it, and the ground contact point used for tilting is
`Jeep.y + jeepH`.

## 7. Game data: state, pools, and entities

### The `Game` singleton

Everything that survives a frame lives on `Game` ([L801](game.js#L801)) or `Jeep`.
Highlights:

| Field | Meaning |
| --- | --- |
| `state` | `"title" \| "play" \| "pause" \| "shop" \| "gameover"` |
| `sector` | Unbounded run counter. 1–10 is the campaign, 11+ the Patrol. |
| `distance` | Total px travelled this run; the sector is derived from it. |
| `modifier` | Active modifier id (key into `MODIFIERS`) or `null`. |
| `recentMods` | Last three modifier ids, used to prevent repeats. |
| `bossActive`, `bossDefeated`, `bossHintTimer` | Boss-fight bookkeeping (see below) |
| `cleared`, `clearedEver`, `winFlash` | Campaign-win flag (this run), campaign-win flag (ever, persisted), and the MOON SAVED freeze timer |
| `depth` | Best sector ever reached, persisted to `localStorage.moonranger_depth` |
| `score` | Currency. A float; always display with `Math.floor`. |
| `hiScore` | Peak currency, persisted to `localStorage.moonranger_hi` |
| `shieldSmall`, `shieldLarge` | Shield hits owned — small 1 per purchase (max 3), large 3 per purchase (max 9). `Game.shield` is a **getter** summing them (max 12); small charges are spent first in `damageJeep()`. |
| `worldOffset` | Total pixels scrolled; feeds all terrain sampling |
| `bomberSchedule`, `bomberIdx`, `levelElapsed` | Per-sector red-ship timeline |
| `Jeep.missiles`, `Jeep.heatSeekers` | Bought stacks (0–3); each stack adds a shot per volley |
| `shake`, `flash`, `bannerTimer` | Presentation timers |

`localStorage` holds exactly four keys: `moonranger_hi`, `moonranger_muted`,
`moonranger_depth`, `moonranger_cleared`.

### Entities and pools

There are three pools — bullets, enemies, sparks — created by
[`makePool()`](game.js#L457). Objects are never allocated during play:

```js
const b = bulletPool.get();   // reuse or create
... b.dead = true;            // mark
// end of update: sweep dead objects back with bulletPool.put(b)
```

**Never splice an array while iterating it.** Mark `dead`, then let the sweep at the end
of `update()` rebuild the array. `bombs`, `meteors` and `missiles` are plain arrays
filtered at the end of the frame.

**Pooled objects keep old fields.** A recycled enemy still carries the previous enemy's
`hp`, `hitFlash`, `regenTimer` and so on. Anything a spawner reads later must be assigned
at spawn time — that is why `spawnEnemy()` sets `hp` explicitly for every type, even
though the pool initialises it to 1.

An enemy carries its own single bullet in `e.myBullet`; the rule "one live shot per
enemy" is enforced by not firing while `e.myBullet` exists. If you add a second shot,
budget for it explicitly instead of removing that check.

### The death path

All player damage funnels through [`damageJeep()`](game.js#L487):

```
invulnerable?  → ignore
shield > 0     → spend one hit (small charges first), 1 s invulnerability, blink
otherwise      → explode, Game.gameOver()
```

`Game.shield` is a **getter** for `shieldSmall + shieldLarge`, not a stored field —
assigning to it throws in strict mode. Set the two counters instead.

Called by: enemy bullets, ground-rover rams, bombs, rolling meteors. If you add a new
hazard, call this — never set the state to `"gameover"` directly.

### Bosses

Campaign bosses guard sectors 3, 7 and 10 (`CONFIG.bosses`). Patrol bosses return every
5 sectors from 15. Both paths go through
[`bossForSector(sector)`](game.js#L576), which returns a resolved descriptor
(`kind`, `name`, size, `hover`, `heatOnly`, `occurrence`, `recurring`, elite flags) or
`null`. Everything else — the finish-line hold, the modifier exclusion, `spawnBoss()` —
asks that function, so the schedule lives in exactly one place.

- `update()` holds the finish line while `bossForSector(Game.sector)` is non-null and
  `Game.bossDefeated` is false, calling [`spawnBoss()`](game.js#L639) once. That is what
  stops the sector advancing.
- A boss is an ordinary entry in `enemies` with `type: "boss"`, so drawing, collision and
  homing reuse the existing loops. It carries `bossKind` (`spider` / `crab` /
  `octopus`), `baseX`/`baseY` (its hover point), `entry` (seconds left sliding in),
  `heatOnly` (its damage rule), and the elite fields `frenzied`, `shielded`, `elite`,
  `regenTimer`.
- Baseline HP is `bossHpFactor * (bossHpBase + rand(0..5))` — 6× a red ship's 5–10, so
  30–60. The octopus uses `octopusHeatHits` (20) instead.
  Repeat appearances multiply that by `1 + bossHpGrowth * (occurrence - 1)`, rounded, so
  a second-visit spider is 38–75 and a second-visit octopus is 25.
- Elite traits are set from `occurrence`: `frenzied` from the 2nd (aimed shots at
  `bossFrenzyFireScale` = 0.75× the gap), `shielded` from the 3rd (regains 1 HP every
  `bossShieldRegen` = 6 s, and [`damageBoss()`](game.js#L693) resets that timer on every
  hit). The HUD prints `e.elite` next to the boss name.
- `damageBoss(e, fromHeat)` is the single damage gate: it rejects non-heat hits on a
  `heatOnly` boss, decrements HP, restarts the shield clock, pays the bounty on death,
  and then either calls `Game.milestone()` (first octopus) or `nextLevel()`.
- Boss shots copy `bossKind` onto the bullet at spawn (so it survives the boss dying and
  being pooled) and draw through [`drawBossBullet()`](game.js#L2261) as a miniature of the
  creature with a pulsing halo.
- While `Game.bossActive`, scroll drops to `bossScrollFactor` and regular spawning and
  bomber arrivals are skipped. Meteorites keep falling on their own faster cadence
  (`bossMeteorMinGap`/`MaxGap`) and land between the jeep and the creature.
- The health bar lives in [`drawHUD()`](game.js#L2376) and only draws during `play`,
  `pause` and `shop`.
- Patrol bosses also fire ordnance (`e.ord`, the separate `foeMissiles` array);
  the ladder, the tuning notes and the shoot-down rules are in
  [section 9](#9-sectors-modifiers-and-the-patrol).

Testing catch: jumping sectors from the console while a boss is alive leaves
`bossActive` true, so the next sector's boss never spawns. Clear `enemies` and reset both
flags first (see the recipes below).

### Input edges

`Keys` is "is this held right now" (jump/aim/fire). `Pressed` is "was this tapped since
the last frame" and is consumed by `consumePress()` (start, pause, shop, mute). Every
state transition calls `clearPresses()` so a key held through a death can't instantly
skip the game-over screen. If you add a key, decide deliberately which one it is.

## 8. Pacing: the numbers a player feels

Campaign values (sectors 1–10):

| Quantity | Level 1 | Level 10 |
| --- | --- | --- |
| Scroll speed | 70 px/s | 106 px/s |
| Hill amplitude | 6 px | 46 px |
| Level length | 1,600 px ≈ 22.9 s | 1,600 px ≈ 15.1 s |
| Spawn gap | 2.2–4.2 s | 0.8–1.5 s |
| Enemy fire gap | 1.4–3.0 s | 0.77–1.65 s |
| Enemy bullet speed | 105 px/s | 186 px/s |

Patrol values (sector 11+), all produced by the `Game` helpers:

| Quantity | Value | Reached at |
| --- | --- | --- |
| Scroll | `min(70 + 4·(s-1), 126)` | cap at sector 15 |
| Enemies on screen | 4 → 5 → 6 | 15, then 25 |
| Spawn gap scale | 0.35 → 0.22 (linear) | floor at sector 23 |
| Fire gap scale | `max(0.38, 1 - 0.05·(s-1))` | floor at sector 14 |
| Enemy shot speed | `min(105 + 9·(s-1), 240)` | cap at sector 16 |
| Bomber quota | 4 then 5 | 20, then 30 |
| Meteors | every 5–9 s | from sector 3 |
| Boss | every 5th sector | from 15 |

Other fixed numbers worth knowing:

- **Jump:** 215 px/s launch, 360 px/s² gravity → ~64 px high (~61 measured), ~1.2 s of
  air. Under LOW GRAVITY it is 260 px/s at 270 px/s² → ~125 px, nearly two seconds of air.
- **Gun:** aims −85° (up) to +45° (down), turns at 110°/s, starts at −30°. Player fire is
  7 shots/s at 320 px/s.
- **Red bombers:** 1 on level 1, 2 on level 2, then 3 (4 from sector 20, 5 from 30). They
  arrive on an absolute schedule spread across the sector, ignore the enemy cap, have
  5–10 HP, drop a bomb every 1.1–2.0 s, and flee when their sector ends.
- **Meteors:** from sector 3, every 5–9 s, fall for 1.1 s, then roll at 36 px/s + scroll.
- **Currency:** kills pay 100 / 150 / 300 / 900 (boss); distance pays 0.02 per px.
- **Shop:** small shield 100, large shield 300, missiles 300, heat seekers 500. Missiles
  auto-fire every 2.5 s; heat seekers every 1.8 s and steer at 4.6 rad/s. Both stack up
  to 3, and each cycle fires one shot per stack (1, 2, 3) spaced by `salvoGap`.
- **Shield banking:** three small (+1 each) and three large (+3 each) may be held at once
  — a full bank is 12 hits, and a purchase only lands if the whole charge fits
  (`owned()` refuses at `shieldLarge > 6`). Small charges absorb first, so damage frees
  small slots before large ones.
- **Bosses:** campaign 3/7/10; Patrol every 5 from 15. Spider and crab take 30–60 hits
  (+25% per repeat); the octopus 20 heat-seeker hits (+25% per repeat). Each pays 900.
  While one is alive the scroll drops to 35%, the finish line holds, and meteorites fall
  every 3.5–6.5 s.
- **Boss ordnance:** from sector 15 — one aimed missile (150 px/s), two from 20, one
  heat seeker (115 px/s, 1.0 rad/s turn) from 25, two from 30, three from 35. Volleys
  every 4.5–6 s; at most 4 alive (5 from 35); each lives 6–7 s.
- **Shield prices scale past sector 10:** `base × (1 + 0.15 × (sector − 10))`, rounded
  to 10s. 100/300 stay 100/300 through level 10, then 120/350 at 11 and 180/530 at 15.
  Missiles (300) and heat seekers (500) never change price.

## 9. Sectors, modifiers, and the Patrol

This is the part of the game built after the campaign, and the part most likely to
surprise you when reading `update()`.

### The endless counter

`Game.sector` increments in `nextLevel()` with **no upper bound**. `distance` is the
source of truth: a sector ends at `sector * CONFIG.levelLength`, and `update()` calls
`nextLevel()` on the frame it is crossed — unless `bossForSector(sector)` says a creature
is guarding the line, in which case `distance` is pinned at the threshold until the boss
dies.

Terrain is the one thing that still stops scaling: `terrainLevel()` returns
`min(sector, CONFIG.maxLevel)`, so the hills freeze at their sector-10 shape and
`Terrain.setLevel()` is always fed that value.

Difficulty helpers (all on `Game`, all reading `sector` + `modifier`):

| Helper | Returns |
| --- | --- |
| `sectorLabel()` | `"LEVEL 7"` / `"SECTOR 23"` — used by the HUD, banner and game over |
| `scrollSpeed()` | sector scroll, capped at `scrollCap`, × modifier |
| `enemyCap()` | 4 / 5 / 6 |
| `spawnScale()`, `fireScale()` | multipliers on the base gaps |
| `foeBulletSpeed()` | sector shot speed, capped at `enemyBulletSpeedCap` |
| `bomberQuota()` | 1/2/3, 4, 5 — raised to at least 4 by BOMBER WING |
| `jumpPower()`, `gravity()` | `CONFIG` values, overridden by LOW GRAVITY |
| `spawnType()` | which enemy the spawner rolls, biased by AIR RAID / GROUND SWARM |
| `bomberDropGap()` | `[min, max]` seconds between bomb drops |

If you need a new sector-scaled number, add a helper here and call it from `update()`.
Do **not** start a third place that does its own `sector` arithmetic.

### Modifiers

`MODIFIERS` ([L192](game.js#L192)) is a flat table; ids are the keys and are stored in
`Game.modifier`:

```js
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
```

Selection happens in [`pickModifier()`](game.js#L853), called by `nextLevel()` **before**
`scheduleBombers()` (the bomber schedule depends on scroll speed, which depends on the
modifier):

- Campaign sectors (≤ 10) and boss sectors get `null`.
- No id may repeat within the last three (`Game.recentMods`).
- Sector 11 is restricted to `blackout` or `gravity`, so the first Patrol sector changes
  the look or the jump arc instead of the enemy mix.

Hooks, if you add another modifier:

| Where | What reads it |
| --- | --- |
| `spawnType()` | `airBias` / `groundBias` |
| enemies loop in `update()` | `speedScale` via `groundBias`/`airBias` |
| meteor spawner | `meteorGap`, `meteorMax` |
| bomber schedule | `bomberQuota` |
| bomber drop timer | `dropGap` |
| jump + gravity integration | `jump`, `gravity` |
| `scrollSpeed()` | `scrollScale` |
| `spawnEnemy()` + both hit paths | `hits` (ARMORED) |
| `render()` + `drawEnemy()` | BLACKOUT: no stars, no rim, `brightness(1.35)` on enemies |

The HUD prints the name under the power-up row, and the banner appends ` - NAME`.
Modifier banners sit on a translucent dark band because they are long enough to land on a
passing saucer.

### Boss ordnance

From sector 15 the bosses also throw missiles. `bossOrdnance(sector)` decides the stage;
it is keyed off the **sector**, not the creature, so the same spider opens with one aimed
missile at 15 and three heat seekers at 35.

| Sector | Volley | Cadence | Max live |
| --- | --- | --- | --- |
| 15 | 1 aimed missile | 3.5–4.5 s | 4 |
| 20 | 2 aimed missiles | 3.5–4.5 s | 4 |
| 25 | 1 heat seeker | 5.0–6.0 s | 4 |
| 30 | 2 heat seekers | 5.0–6.0 s | 4 |
| 35+ | 3 heat seekers | 4.5–5.5 s | 5 |

- They live in `foeMissiles`, a plain array kept separate from the player's `missiles`:
  different targeting, rendering and collision rules.
- `spawnFoeMissile(boss, heat)` aims at the jeep's current centre. Heat seekers then
  steer at `foeHeatTurnRate` and expire after `foeHeatLife`.
- Both kinds are **shootable** — one player bullet or missile each — explode on terrain,
  and use a padded point test against the jeep into `damageJeep()`.
- Salvo state (`ordTimer`, `ordSalvo`, `ordSalvoTimer`) lives on the enemy and is reset in
  `spawnBoss()`; a pooled boss must never inherit a half-fired volley.
- `damageBoss()` calls `clearFoeMissiles()` on death. They also freeze with the world in
  the shop and pause screens, because `update()` returns early there.

**The turn rate is load-bearing.** Measured: at 1.8 rad/s a jump dodged a heat seeker
from any distance, which made them decorative; at 1.0 a mid-approach jump makes it
overshoot while jumping early (~100 px out) or at the last instant (~20 px) still gets
you hit. Change that number only with a dodge test (harness in
[section 10](#10-debugging-and-testing-recipes)).

### The milestone, and why it is not a state

The first octopus death calls `Game.milestone()` ([L1028](game.js#L1028)) instead of
`nextLevel()`:

1. `cleared = true`, `moonranger_cleared` persisted (first time only).
2. `bossDefeated = true` so the pinned finish line cannot respawn the octopus.
3. `winFlash = CONFIG.milestoneTime` (2.5 s).

`update()` returns early while `winFlash > 0`, so the world is frozen and input is
ignored — deliberately, like the game-over screen. When it expires, `clearPresses()` runs
and `nextLevel()` moves to sector 11 with the `PATROL BEGINS` banner (once per run, via
`patrolAnnounced`).

`render()` draws [`drawMilestone()`](game.js#L2509) whenever `winFlash > 0`, before the
banner branch. There is no `"victory"` state any more.

### Persistence

| Key | Written when | Read where |
| --- | --- | --- |
| `moonranger_hi` | game over | `Game.hiScore` |
| `moonranger_muted` | mute toggle | `AudioSys.init()` |
| `moonranger_depth` | every sector advance, and on death | `Game.depth` → title screen |
| `moonranger_cleared` | first campaign clear | `Game.clearedEver` → title screen |

`saveDepth()` only writes when the sector is a new best, so it never lowers the record.

## 10. Debugging and testing recipes

There are no tests, so the fastest way to verify behavior is from the devtools console.
The game exposes a handle ([L2579](game.js#L2579)):

```js
GAME.Game              // state, score, sector, distance, modifier, depth...
GAME.Jeep              // y, vy, airborne, gunAngle, missiles, heatSeekers
GAME.Terrain           // level, groundY(worldX), slope(worldX), ramp()
GAME.CONFIG            // live-tweakable: change a number and feel it immediately
GAME.MODIFIERS         // the modifier table
GAME.enemies           // live array (getter)
GAME.bullets           // live array (getter)GAME.meteors          // live array (getter)
GAME.missiles         // live array (getter)
GAME.foeMissiles      // live boss ordnance (getter)
GAME.spawnEnemy(type, worldOffset)   // "ground" | "air" | "bomber"
GAME.spawnBullet(x, y, vx, vy, friendly, owner)
GAME.spawnMeteor(minFrac, maxFrac)
GAME.spawnBoss(sector)               // sector must actually have a boss
GAME.bossForSector(sector)           // null, or the resolved boss descriptor
GAME.bossOrdnance(sector)            // null, or { heat, volley, gap, maxLive }
GAME.spawnFoeMissile(boss, heat)     // fire one piece of boss ordnance
GAME.damageBoss(boss, fromHeat)      // true heat damage / false otherwise
```

Handy snippets:

```js
// What's happening right now, at a glance
({ state: GAME.Game.state, sector: GAME.Game.sector, score: Math.floor(GAME.Game.score),
   modifier: GAME.Game.modifier, enemies: GAME.enemies.map(e => e.type) })

// Jump to a harder sector (distance must stay inside the sector's range)
GAME.Game.sector = 7; GAME.Terrain.setLevel(7); GAME.Game.scheduleBombers();
GAME.Game.distance = GAME.CONFIG.levelLength * 6 + 10;

// Jump straight into a Patrol sector with a chosen modifier
GAME.Game.sector = 12; GAME.Game.distance = GAME.CONFIG.levelLength * 11 + 10;
GAME.Game.modifier = "meteor"; GAME.Game.scheduleBombers();

// Skip to the next sector immediately
GAME.Game.distance = GAME.CONFIG.levelLength * GAME.Game.sector + 1;

// Shopping spree / a full 12-hit shield bank
GAME.Game.score = 5000; GAME.Game.shieldSmall = 3; GAME.Game.shieldLarge = 9;

// Force a spawn on the next frame
GAME.Game.spawnTimer = 0;

// Jump straight into a boss fight. Clear a live boss first or the next one
// will never spawn (bossActive stays true), and put distance just short of the
// sector's finish line so it spawns on its own.
GAME.enemies.length = 0;
GAME.Game.bossActive = false; GAME.Game.bossDefeated = false;
GAME.Game.sector = 15; GAME.Game.distance = GAME.CONFIG.levelLength * 15 - 5;

// Or spawn one directly (15 spider, 20 crab, 25 octopus, 30 frenzied spider...)
const b = GAME.spawnBoss(30);
b.entry = 0; b.x = b.baseX;          // skip the fly-in
b.hp = 1; GAME.damageBoss(b, false); // instant kill

// Ordnance on demand: fire a volley now and inspect it
const b2 = GAME.spawnBoss(35); b2.entry = 0; b2.x = b2.baseX; b2.ordTimer = 0;
GAME.foeMissiles;                     // live missiles
GAME.CONFIG.foeHeatTurnRate = 1.6;    // feel a wider/narrower dodge window live

// Freeze the world and inspect draw code while paused
GAME.Game.state = "pause";
```

Pause the debugger inside `update()` at a phase boundary (the `/* -- X -- */` comments)
instead of stepping the whole function.

**Sector-up sanity check:** set `GAME.Game.distance = 1599`, wait a beat, and confirm
`sector` becomes 2, the banner reads `LEVEL 2`, and `bomberSchedule.length` is 2.

## 11. How to change things (cookbook)

### Rebalance difficulty

Everything is in `CONFIG`. Scroll speed, spawn gap, fire gap, hills, prices, jump power,
and the Patrol caps (`scrollCap`, `spawnScaleFloor`, `fireScaleFloor`,
`enemyBulletSpeedCap`). Change numbers, hard-refresh, play. Nothing else needs to move.

### Add a new ground enemy

1. Add its colors to `COLORS`.
2. Add a `type` branch in [`spawnEnemy()`](game.js#L523): set `w`, `h`, `y`,
   `fireTimer`, and any `hp`. Set `hp`/`maxHp` explicitly even if it is 1 — pooled
   objects keep old values.
3. Add its movement in the enemies loop of `update()`, and make sure its `y` is re-snapped
   to `Terrain.groundY(...)` if it walks.
4. Add a `drawEnemy()` branch ([L1996](game.js#L1996)) using `Math.round(x)`/`Math.round(y)`.
5. Add its currency value in **both** hit paths (player bullets and missiles).
6. Bump the version, update the README rules, add a CHANGELOG entry.

### Add a shop item

1. Price in `CONFIG`; an ownership getter and `apply()` in
   [`SHOP_ITEMS`](game.js#L1074).
2. That's it for buying — `buyShopItem()` and `drawShop()` iterate the array.
3. **Layout caveat:** `drawShop()` positions rows at `112 + i * 13` and prints the
   "can't buy" warning at y 172. A fifth item lands at y 164 and crowds that warning, and
   the "1-4 BUY" hint at the bottom becomes stale — adjust both if you add one.
4. Show ownership in the HUD the way `MSL 3`/`HEAT 2` do, and reset it in `Jeep.reset()`.
5. For a **stackable** item, make `owned()` a `>= CONFIG.maxXStacks` check and bump a
   counter in `apply()`. The missiles and heat seekers are the template: counters and
   volley timers on `Jeep`, volley firing in `update()`, and the count in `drawHUD()`.

### Add a modifier

1. Add an entry to `MODIFIERS` with a `name` and whatever values the hook needs.
2. Read it through `Game.modifierDef()` in the relevant helper or update phase (table in
   [section 9](#9-sectors-modifiers-and-the-patrol)).
3. If it should be available from sector 11, leave the sector-11 whitelist in
   `pickModifier()` alone.
4. Keep it a *modifier*, not a new enemy or system: the value of this design is that it
   recombines things the player already understands.

### Add a HUD string

Use only glyphs in the `FONT` table ([L1723](game.js#L1723)): `A–Z`, `0–9`, space, and
`- + ! . : / > <`. Uppercase everything; unknown characters are silently skipped (you'll
get a gap in the text). If you need a new character, add a 3×5 glyph there — each row is
a 3-bit mask with the most significant bit on the left. `+` was added for the elite boss
labels; an em dash is still missing.

### Add a new state (e.g. an options screen)

1. Add the string to `Game`'s state comment and a branch in `update()` (handle input,
   return early).
2. Add a `drawX()` overlay and one line in `render()`'s overlay chain.
3. Make sure every exit calls `clearPresses()` and clears `clicked`.
4. Make sure pause/escape handling still returns you to `"play"` correctly.

## 12. House rules and pitfalls

**Rules of the house**

- **No dependencies, no build step.** Keep it one classic script. If you think you need
  a library, the answer is almost certainly "write the 20 lines".
- **Tuning numbers go in `CONFIG`/`MODIFIERS`/`COLORS`**, not inline in logic.
- **One semantic version bump per change**, in three places: `CONFIG.version`
  ([L40](game.js#L40)), the "current version" line in the README, and a new CHANGELOG
  entry at the top. They are currently in sync at 0.1.3; keep them that way.
- **Keep the file map and section banners accurate** if you add a section.
- **The README is player-facing.** If a change is visible to players (rules, controls,
  new enemies, modifiers), update it in the same pass.

**Pitfalls that will bite you**

1. **`dt` everything.** `x += 2` in `update()` is frame-rate dependent and will be wrong
   on a 120 Hz display.
2. **Don't use `performance.now()` for gameplay.** It's used only for visual flicker
   (invulnerability blink, bomb fuse, bomber rim lights, boss bullet halo). Gameplay
   timing uses accumulator-driven timers.
3. **Forget `worldOffset` and the world slides under your object.** See
   [coordinate systems](#6-coordinate-systems-and-hitboxes).
4. **Round before drawing pixels.** `ctx.fillRect(Math.round(x), …)` keeps the chunky
   look; rotated things (jeep, barrel) are the intentional exception.
5. **Don't mutate arrays during iteration.** Set `dead`, let the sweep do it.
6. **`Game.score` is a float.** Compare against prices as a float (so you can't buy with
   99.9), display with `Math.floor`.
7. **`hiScore` is peak currency, not net worth.** Buying things lowers your visible
   score but not the saved high score. That's intentional; don't "fix" it without
   agreeing on the semantics.
8. **State transitions need `clearPresses()`** or a held key skips the next screen. The
   MOON SAVED freeze does this deliberately; don't file it as a bug.
9. **Entities spawn just off-screen right** (`x ≈ viewW + 10`) and are culled off-screen
   left (enemies at `x + w < -30`, meteors at `-20`). Keep new spawns consistent or
   they'll pop in.
10. **Fullscreen is best-effort.** `requestFullscreen()` rejects inside some iframes; the
    game catches that and shows an in-canvas hint (`fsBlockedFlash`). Don't remove the
    `.catch()` — an unhandled rejection would break the toggle silently.
11. **Any enemy with `hp > 1` must be handled in both hit paths.** Player bullets and
    missiles each carry their own collision block; ARMORED is what made that a
    requirement, and forgetting one makes armoured enemies unkillable or free kills.
12. **Don't write to `Game.shield`.** It is a getter over `shieldSmall` and
    `shieldLarge`; an assignment throws under `"use strict"`. Everything else (the HUD,
    the cyan ring, `damageJeep()`) reads the getter, which is why the cap lives in the
    shop's `owned()` checks rather than in the pool itself.

## 13. Deploying

The whole folder is the artifact — there is no build output and no environment config.

- **Vercel CLI:** run `vercel` in the project root, accept the defaults (framework
  *Other*, no build command, output `./`).
- **Vercel dashboard:** import the folder/repo; `vercel.json` already pins it as static.
- **Any other static host:** upload `index.html`, `style.css`, `game.js`, `favicon.svg`,
  and the docs.
  No server-side code, no routing, no secrets.

Cache-busting is manual: the script URL is unversioned, so after deploying, hard-refresh
if you see a stale build.

## 14. Glossary

| Term | Meaning here |
| --- | --- |
| **Buffer** | The 480×270 canvas backing store; all game coordinates live here |
| **World x** | `Game.worldOffset + screenX`; the coordinate terrain is sampled at |
| **Ramp** | 0→1 difficulty progress from terrain level 1 to 10, drives hill size/frequency |
| **Sector** | The unbounded run counter; 1–10 is the campaign, 11+ the Patrol |
| **Terrain level** | `min(sector, 10)` — the visual hill ramp, deliberately capped |
| **Patrol** | The endless mode after the octopus; one modifier per sector |
| **Modifier** | A named per-sector twist (meteors, swarms, gravity…) in `MODIFIERS` |
| **Occurrence** | Which visit a recurring boss is on (1 = its first Patrol outing) |
| **Milestone** | The MOON SAVED freeze after the first octopus; the run continues |
| **Pool** | A free-list of reused objects (bullets, enemies, sparks) to avoid GC churn |
| **Edge press** | A key event consumed once per tap, versus a held key |
| **Bomber quota** | Red ships allowed per sector, scheduled across it |
| **Currency** | `Game.score` — points you can spend, unlike a classic score |
| **Ordnance** | Bought auto-firing weapons: missiles (fixed 45°) and heat seekers (homing) |
