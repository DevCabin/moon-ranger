# MOON PATROL — Developer Walkthrough

A complete orientation for a developer joining this project. Read it top to bottom
once (~25 minutes), then keep it open as a map while you work.

**What this game is:** an Atari-style side-scrolling shooter in the browser. You drive
a jeep across lunar terrain, jump enemy fire, and shoot rovers, UFOs, and red bomber
saucers. Score doubles as currency, which you spend on shields and missiles.

**What the codebase is:** four source files and three docs. No framework, no bundler, no
package manager, no dependencies, no build step, no tests. `game.js` is ~1,620 lines of
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
9. [Debugging and testing recipes](#9-debugging-and-testing-recipes)
10. [How to change things (cookbook)](#10-how-to-change-things-cookbook)
11. [House rules and pitfalls](#11-house-rules-and-pitfalls)
12. [Deploying](#12-deploying)
13. [Glossary](#13-glossary)

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
a schedule, and meteors start falling at level 3. Then come back to the code — every
number you felt is in one object (see [CONFIG](game.js#L38)).

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
- **Terrain is a pure function** of world x and level: three stacked sine waves. Nothing
  stores hill geometry; `Terrain.groundY(worldX)` recomputes it on demand, so hills and
  craters scroll perfectly and nothing has to be kept in sync.
- The **simulation is fixed-step at 1/60 s**, decoupled from rendering, so speeds are in
  units-per-second and gameplay is identical on a 60 Hz or 144 Hz display.
- **Score is currency.** It trickles up with distance and jumps on kills; the buy menu
  (key **B**) subtracts what you spend. There is no separate points counter.
- **One state machine, five states:** `title`, `play`, `pause`, `shop`, `gameover`.
  `update()` dispatches on `Game.state`; `render()` always draws the world, then overlays
  the relevant screen.

## 3. File-by-file tour

| File | Lines | What it holds |
| --- | --- | --- |
| [game.js](game.js) | ~1,620 | The entire game. Read this; everything else is a shell. |
| [index.html](index.html) | 15 | One `<canvas id="game">` and a classic (non-module) `<script src="game.js">`. |
| [style.css](style.css) | 28 | Full-window black page, pixelated canvas scaling. No game logic. |
| [vercel.json](vercel.json) | 6 | Marks the folder as a static deployment with no build. |
| [README.md](README.md) | — | Player-facing rules, controls, and deployment notes. |
| [CHANGELOG.md](CHANGELOG.md) | — | One entry per change, with a version bump each time. |
| [developers.md](developers.md) | — | This document. |

Two facts worth internalizing:

- **`index.html` loads `game.js` as a classic script, not a module.** That means no
  `import`/`export`, and top-level declarations are one shared scope. Don't convert it to
  `type="module"` casually: module scripts are deferred (load timing changes) and run in
  strict module scope, which would hide `window.GAME` unless explicitly assigned.
- **There are no hidden assets.** Audio is synthesized with WebAudio oscillators, the
  font is a 3×5 bitmap table in code, and stars/craters are generated. Adding art or a
  sound file would be the first binary asset in the repo — a deliberate design choice to
  keep it this small.

## 4. How one frame works

```js
// game.js:1613 — the whole loop
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
world scroll + distance + currency trickle + level check
banner/shake/flash timers
jeep: jump, terrain snap, gun aim, fire
bought ordnance: missiles / heat seekers
enemy spawning  →  bomber schedule  →  meteor spawner
enemies: move, fire one aimed dot, ram check
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
flash → HUD → state overlay.

## 5. The ten sections of game.js

The file starts with a map (lines 17–30) that matches the code exactly. Keep it accurate
if you add a section.

| # | Section | Start | What it does |
| --- | --- | --- | --- |
| 1 | CONFIG | [L38](game.js#L38) | Every tunable number. Rebalancing should not require touching logic. |
| 2 | PALETTE | [L133](game.js#L133) | `COLORS`, including the five rotating rover colorways. |
| 3 | AUDIO | [L176](game.js#L176) | `AudioSys`: square-wave beeps and filtered noise, lazily created on first input, mute persisted to `localStorage`. |
| 4 | INPUT | [L245](game.js#L245) | `Keys` (held) and `Pressed` (edge-triggered) maps, plus helpers. |
| 5 | TERRAIN | [L285](game.js#L285) | `groundY()` / `slope()` / difficulty `ramp()`. |
| 6 | ENTITIES | [L320](game.js#L320) | `Jeep` singleton, pools, spawners, `damageJeep()`, particles. |
| 7 | GAME STATE | [L535](game.js#L535) | `Game` object: state string, currency, level, bomber schedule, transitions. |
| 8 | UPDATE | [L652](game.js#L652) | The fixed-step simulation. The biggest function in the file. |
| 9 | RENDER | [L1149](game.js#L1149) | Pixel font, starfield, terrain drawing, all entity drawing, HUD, overlays. |
| 10 | MAIN LOOP | [L1554](game.js#L1554) | Pointer input, fullscreen, letterbox resizing, the frame loop. |

### Reading order recommendation

1. `CONFIG` → `COLORS`: learn the vocabulary. Half the game is names and numbers.
2. `Terrain.groundY()` ([L285](game.js#L285)): 15 lines, and suddenly hills make sense.
3. `Jeep` ([L320](game.js#L320)): the player's whole data model.
4. `Game` ([L535](game.js#L535)): the state machine and level/bomber scheduling.
5. `update()` ([L652](game.js#L652)): read it in phases; don't try to hold 420 lines at once.
6. `drawText()` + `render()` ([L1122](game.js#L1122), [L1149](game.js#L1149)): there is no
   `ctx.fillText` anywhere — all text is a hand-drawn 3×5 bitmap font.
7. `frame()` ([L1613](game.js#L1613)): the loop, and you're done.

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
| Ground rover | 24 × 16 | Rides the terrain |
| UFO | 30 × 15 | Bobs at y 40–113 |
| Red bomber | 40 × 18 | 5–10 HP, shows armor pips |
| Bomb | 8 × 8 | Hitbox is an 8×8 box around the center |
| Meteor | 12 × 12 | Indestructible |
| Bullet (yours) | 2 × 2 | Drawn 2×2 |
| Bullet (enemy) | 4 × 4 | Drawn 4×4, hitbox padded 5 px above the jeep |

Ground height is `viewH * 0.80` = 216 px, modulated by hills whose amplitude grows from
6 px (level 1) to 46 px (level 10). The jeep body's `y` is the **top** of the body; its
wheels extend ~6 px below it, and the ground contact point used for tilting is
`Jeep.y + jeepH`.

## 7. Game data: state, pools, and entities

### The `Game` singleton

Everything that survives a frame lives on `Game` ([L535](game.js#L535)) or `Jeep`.
Highlights:

| Field | Meaning |
| --- | --- |
| `state` | `"title" \| "play" \| "pause" \| "shop" \| "gameover"` |
| `score` | Currency. A float; always display with `Math.floor`. |
| `hiScore` | Peak currency, persisted to `localStorage.moonpatrol_hi` |
| `shield` | Shield charges (small +1, large +3) |
| `level`, `distance` | Level is derived from cumulative distance |
| `worldOffset` | Total pixels scrolled; feeds all terrain sampling |
| `bomberSchedule`, `bomberIdx`, `levelElapsed` | Per-level red-ship timeline |
| `shake`, `flash`, `bannerTimer` | Presentation timers |

### Entities and pools

There are three pools — bullets, enemies, sparks — created by
[`makePool()`](game.js#L362). Objects are never allocated during play:

```js
const b = bulletPool.get();   // reuse or create
... b.dead = true;            // mark
// end of update: sweep dead objects back with bulletPool.put(b)
```

**Never splice an array while iterating it.** Mark `dead`, then let the sweep at the end
of `update()` rebuild the array. `bombs`, `meteors`, and `missiles` are plain arrays
filtered at the end of the frame.

An enemy carries its own single bullet in `e.myBullet`; the rule "one live shot per
enemy" is enforced by not firing while `e.myBullet` exists. If you add a second shot,
budget for it explicitly instead of removing that check.

### The death path

All player damage funnels through [`damageJeep()`](game.js#L391):

```
invulnerable?  → ignore
shield > 0     → consume a charge, 1 s invulnerability, blink
otherwise      → explode, Game.gameOver()
```

Called by: enemy bullets, ground-rover rams, bombs, rolling meteors. If you add a new
hazard, call this — never set the state to `"gameover"` directly.

### Input edges

`Keys` is "is this held right now" (jump/aim/fire). `Pressed` is "was this tapped since
the last frame" and is consumed by `consumePress()` (start, pause, shop, mute). Every
state transition calls `clearPresses()` so a key held through a death can't instantly
skip the game-over screen. If you add a key, decide deliberately which one it is.

## 8. Pacing: the numbers a player feels

Useful reference when tuning; all are `CONFIG` values.

| Quantity | Level 1 | Level 10 |
| --- | --- | --- |
| Scroll speed | 70 px/s | 106 px/s |
| Hill amplitude | 6 px | 46 px |
| Level length | 1,600 px ≈ 22.9 s | 1,600 px ≈ 15.1 s |
| Spawn gap | 2.2–4.2 s | 0.8–1.5 s |
| Enemy fire gap | 1.4–3.0 s | 0.77–1.65 s |
| Enemy bullet speed | 105 px/s | 186 px/s |

Other fixed numbers worth knowing:

- **Jump:** 215 px/s launch, 360 px/s² gravity → ~64 px high, ~1.2 s of air. Enough to
  clear a bullet and to hop most hills.
- **Gun:** aims −85° (up) to +45° (down), turns at 110°/s, starts at −30°. Player fire is
  7 shots/s at 320 px/s.
- **Red bombers:** 1 on level 1, 2 on level 2, 3 after that. They arrive on an absolute
  schedule spread across the level, ignore the 4-enemy spawn cap, have 5–10 HP, drop a
  bomb every 1.1–2.0 s, and flee when their level ends.
- **Meteors:** from level 3, every 5–9 s, fall for 1.1 s, then roll at 36 px/s + scroll.
- **Currency:** kills pay 100 / 150 / 300; distance pays 0.02 per px (≈1.4/s at level 1).
- **Shop:** small shield 100, large shield 300, missiles 300, heat seekers 500. Missiles
  auto-fire every 2.5 s; heat seekers every 1.8 s and steer at 4.6 rad/s.

## 9. Debugging and testing recipes

There are no tests, so the fastest way to verify behavior is from the devtools console.
The game exposes a handle ([L1608](game.js#L1608)):

```js
GAME.Game        // state, score, level, distance, shield, bomberSchedule...
GAME.Jeep        // y, vy, airborne, gunAngle, hasMissiles, hasHeat
GAME.Terrain     // level, groundY(worldX), slope(worldX), ramp()
GAME.CONFIG      // live-tweakable: change a number and feel it immediately
GAME.enemies     // live array (getter)
GAME.bullets     // live array (getter)
```

Handy snippets:

```js
// What's happening right now, at a glance
({ state: GAME.Game.state, level: GAME.Game.level, score: Math.floor(GAME.Game.score),
   enemies: GAME.enemies.map(e => e.type) })

// Jump straight to a harder level
GAME.Game.level = 7; GAME.Terrain.setLevel(7); GAME.Game.scheduleBombers();

// Skip to the next level immediately
GAME.Game.distance = GAME.CONFIG.levelLength * GAME.Game.level + 1;

// Shopping spree
GAME.Game.score = 5000;

// Free shields, to test damage/damageJeep()
GAME.Game.shield = 3;

// Force a spawn on the next frame (no public spawner exists)
GAME.Game.spawnTimer = 0;

// Freeze the world and inspect draw code while paused
GAME.Game.state = "pause";
```

Pause the debugger inside `update()` at a phase boundary (the `/* -- X -- */` comments)
instead of stepping the whole function.

**Level-up sanity check:** set `GAME.Game.distance = 1599`, wait a beat, and confirm
`level` becomes 2, the banner reads `LEVEL 2`, and `bomberSchedule.length` is 2.

## 10. How to change things (cookbook)

### Rebalance difficulty

Everything is in `CONFIG`. Scroll speed, spawn gap, fire gap, hills, prices, jump power.
Change numbers, hard-refresh, play. Nothing else needs to move.

### Add a new ground enemy

1. Add its colors to `COLORS`.
2. Add a `type` branch in [`spawnEnemy()`](game.js#L423): set `w`, `h`, `y`, `fireTimer`,
   and any `hp`.
3. Add its movement in the enemies loop of `update()`, and make sure its `y` is re-snapped
   to `Terrain.groundY(...)` if it walks.
4. Add a `drawEnemy()` branch ([L1328](game.js#L1328)) using `Math.round(x)`, `Math.round(y)`.
5. Add its currency value in the friendly-bullet collision block.
6. Bump the version, update the README rules, add a CHANGELOG entry.

### Add a shop item

1. Price in `CONFIG`; an ownership getter and `apply()` in
   [`SHOP_ITEMS`](game.js#L632).
2. That's it for buying — `buyShopItem()` and `drawShop()` iterate the array.
3. **Layout caveat:** `drawShop()` positions rows at `112 + i * 13` and prints the
   "can't buy" warning at y 172. A fifth item lands at y 164 and crowds that warning, and
   the "1-4 BUY" hint at the bottom becomes stale — adjust both if you add one.
4. Show ownership in the HUD the way `MSL`/`HEAT` do, and reset it in `Jeep.reset()`.

### Add a HUD string

Use only glyphs in the `FONT` table ([L1107](game.js#L1107)): `A–Z`, `0–9`, space, and
`- ! . : / > <`. Uppercase everything; unknown characters are silently skipped (you'll
get a gap in the text). If you need a new character, add a 3×5 glyph there — each row is
a 3-bit mask with the most significant bit on the left. Note that `+` and `—` are
currently missing, which is why the shop names render with a gap.

### Add a new state (e.g. an options screen)

1. Add the string to `Game`'s state comment and a branch in `update()` (handle input,
   return early).
2. Add a `drawX()` overlay and one line in `render()`'s overlay chain.
3. Make sure every exit calls `clearPresses()` and clears `clicked`.
4. Make sure pause/escape handling still returns you to `"play"` correctly.

## 11. House rules and pitfalls

**Rules of the house**

- **No dependencies, no build step.** Keep it one classic script. If you think you need
  a library, the answer is almost certainly "write the 20 lines".
- **Tuning numbers go in `CONFIG`/`COLORS`**, not inline in logic.
- **One semantic version bump per change**, in three places: `CONFIG.version`
  ([L40](game.js#L40)), the "current version" line in the README, and a new CHANGELOG
  entry at the top. They are currently in sync at 0.0.9; keep them that way.
- **Keep the file map and section banners accurate** if you add a section.
- **The README is player-facing.** If a change is visible to players (rules, controls,
  new enemies), update it in the same pass.

**Pitfalls that will bite you**

1. **`dt` everything.** `x += 2` in `update()` is frame-rate dependent and will be wrong
   on a 120 Hz display.
2. **Don't use `performance.now()` for gameplay.** It's used only for visual flicker
   (invulnerability blink, bomb fuse, bomber rim lights). Gameplay timing uses
   accumulator-driven timers.
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
8. **State transitions need `clearPresses()`** or a held key skips the next screen.
9. **Entities spawn just off-screen right** (`x ≈ viewW + 10`) and are culled off-screen
   left (enemies at `x + w < -30`, meteors at `-20`). Keep new spawns consistent or
   they'll pop in.
10. **Fullscreen is best-effort.** `requestFullscreen()` rejects inside some iframes; the
    game catches that and shows an in-canvas hint (`fsBlockedFlash`). Don't remove the
    `.catch()` — an unhandled rejection would break the toggle silently.

## 12. Deploying

The whole folder is the artifact — there is no build output and no environment config.

- **Vercel CLI:** run `vercel` in the project root, accept the defaults (framework
  *Other*, no build command, output `./`).
- **Vercel dashboard:** import the folder/repo; `vercel.json` already pins it as static.
- **Any other static host:** upload `index.html`, `style.css`, `game.js`, and the docs.
  No server-side code, no routing, no secrets.

Cache-busting is manual: the script URL is unversioned, so after deploying, hard-refresh
if you see a stale build.

## 13. Glossary

| Term | Meaning here |
| --- | --- |
| **Buffer** | The 480×270 canvas backing store; all game coordinates live here |
| **World x** | `Game.worldOffset + screenX`; the coordinate terrain is sampled at |
| **Ramp** | 0→1 difficulty progress from level 1 to 10, drives hill size/frequency |
| **Pool** | A free-list of reused objects (bullets, enemies, sparks) to avoid GC churn |
| **Edge press** | A key event consumed once per tap, versus a held key |
| **Bomber quota** | Red ships allowed per level (1/2/3), scheduled across the level |
| **Currency** | `Game.score` — points you can spend, unlike a classic score |
| **Ordnance** | Bought auto-firing weapons: missiles (fixed 45°) and heat seekers (homing) |
