# Next Steps — Endless Patrol (post-level-10)

**Status:** plan only, nothing implemented yet.
**Target version:** `0.1.0` (new mode, not a patch).
**Current build:** `0.0.15` — 10 levels, bosses at 3/7/10, Octopus ends the run.

This document is self-contained: it records the current constraints, the agreed
design, the new boss-ordnance requirement, the exact numbers we intend to start
from, and the order of work. A developer (or a later session) should be able to
implement from this alone.

---

## 1. Goal

Do not end the game at the Octopus. After the campaign finale, the run continues
into an endless **Patrol**: the player keeps flying/sector-ing into higher
sectors with rotating modifiers, recurring bosses, and a persisted depth record.
It must not become "same fight, bigger numbers".

Non-goals for this pass: new enemy art, new weapons for the player, online
leaderboards, mobile controls.

---

## 2. Current constraints (why it goes stale)

Numbers verified in `game.js` at `0.0.15`:

| Knob | Current behaviour | Saturates at |
| --- | --- | --- |
| Terrain amplitude / frequency | `Terrain.ramp()` = `(level-1)/(maxLevel-1)` | level 10 |
| `Game.level` / `Terrain.setLevel()` | hard clamped to `CONFIG.maxLevel` (10) | level 10 |
| Spawn gap | `rand(2.2,4.2) * max(0.35, 1-0.22*(level-1))` | **level 4** (0.77–1.47 s) |
| Enemy fire gap | `rand(1.4,3.0) * max(0.5, 1-0.05*(level-1))` | level 11 |
| Enemy bullet speed | `105 + 9*(level-1)` | never (but level is clamped) |
| Enemies on screen | `CONFIG.maxEnemies = 4` | always |
| Bomber quota | `bombersPerLevel()` → 1 / 2 / 3 | level 3 |
| Meteors | every 5–9 s from level 3 | level 3 |
| Bosses | `CONFIG.bosses[3,7,10]`, gated by `CONFIG.bosses[Game.level]` | level 10 |
| Run end | `Game.victory()` → `state = "victory"` | level 10 |

Also relevant:

- Boss HP: `bossHpFactor (6) * (bossHpBase (5) + floor(rand(0,6)))` = **30–60**;
  Octopus = `octopusHeatHits` = **20** heat-seeker hits.
- Bosses fire aimed "baby boss" bullets (`spawnBullet(...)`, `b.bossKind` copied
  at spawn, drawn by `drawBossBullet()`), one live shot per enemy (`e.myBullet`).
- Player missiles: `spawnMissile(x, y, heat)` → 45° up-right, homing for heat
  seekers, stored in the `missiles` array, drawn by `drawMissile()`.
- Player ordnance stacks: `Jeep.missiles` / `Jeep.heatSeekers` (0–3), fired as
  1,2,3 volleys; prices 300 / 500.
- Currency: `Game.score` (float). Kills 100/150/300/900, distance 0.02/px.
- Storage: `moonranger_hi`, `moonranger_muted`.
- Emergency heat-seeker top-up fires whenever a `heatOnly` boss spawns without
  heat seekers and `score < 500` — **this would repeat every Octopus**.

---

## 3. Terminology

- **Sector** — the new unbounded counter. Sectors 1–10 are exactly the current
  campaign levels. Sector 11+ is endless.
- **Terrain level** — visual difficulty, still capped at 10: use
  `Math.min(Game.sector, CONFIG.maxLevel)` for `Terrain.setLevel()`.
- **Occurrence index (n)** — which time a given boss appears: 1st at sector 15,
  2nd at 20, 3rd at 25, …

Banner rules: sectors 1–10 read `LEVEL n` (unchanged). Sector 11+ reads
`SECTOR n`, except the first time, which shows `PATROL BEGINS`.

---

## 4. Core loop after the Octopus

1. Octopus dies (first time only) → 2.5 s freeze with **MOON SAVED** overlay →
   `moonranger_cleared = "1"` saved → continue at sector 11.
2. Every sector: banner + (if not a boss sector) a named modifier.
3. Every 5th sector from 15: recurring boss with ordnance ladder (section 8).
4. Depth saved on level-up and on death: `moonranger_depth`.
5. Death still ends the run: game-over shows **REACHED SECTOR n** and depth.
6. Currency keeps trickling; shield prices scale (section 9).

There is no forced end. Optional "retire" is explicitly out of scope for this
pass (can be added later with `Esc` on the pause screen).

---

## 5. Data model & persistence

Add to `Game`:

```js
sector: 1,            // unbounded; replaces level for difficulty & UI
cleared: false,       // Octopus #1 beaten this run
winFlash: 0,          // seconds left on the "MOON SAVED" overlay
modifier: null,       // active sector modifier id (see MODIFIERS)
bossOrd: 0,           // 0..4 ordnance stage of the active recurring boss
depth: 0,             // best sector ever, loaded from storage
```

Keep `Game.level` as an alias for `sector` **or** rename all uses — prefer the
rename (`level` → `sector`) and compute `terrainLevel()` where needed, because
leaving two counters invites drift.

Storage keys (new):

| Key | Meaning |
| --- | --- |
| `moonranger_depth` | highest sector ever reached (int) |
| `moonranger_cleared` | `"1"` once the campaign Octopus has been beaten |

`moonranger_hi` stays as peak currency. On game over: `depth = max(depth,
sector)`, persist.

Display: title screen `DEEPEST SECTOR n` (only when n > 0); game over
`REACHED SECTOR n` plus existing currency/hi-score.

---

## 6. Difficulty curve past sector 10

Replace clamped, level-based formulas with sector-based helpers. Starting
values (tune by playtest):

| Quantity | Sectors 1–10 | 11+ |
| --- | --- | --- |
| Terrain | as today | `Terrain.setLevel(10)` |
| Scroll | `70 + 4*(sector-1)` | `+1 per sector`, cap **126** |
| Enemy cap | 4 | 5 at sector 15, 6 at 25 |
| Spawn gap scale | current formula | `max(0.22, 0.35 - 0.01*(sector-10))` |
| Fire gap scale | current formula | `max(0.38, 1 - 0.05*(sector-1))` |
| Enemy bullet speed | `105 + 9*(sector-1)` | same, cap **240** (hits at sector 16) |
| Bomber quota | 1/2/3 | 4 at sector 20, 5 at 30 |
| Meteor cadence | 5–9 s | unchanged (modifiers change it) |

Rationale: density and variety carry the difficulty after 10; speed caps keep
the game dodgeable. Do **not** let bullet speed or fire rate run away.

---

## 7. Sector modifiers (the anti-monotony core)

One modifier per non-boss sector from 11 onward. Announced in the banner and
shown small in the HUD, e.g. `METEOR STORM`.

| id | Name | Effect | Implementation hook |
| --- | --- | --- | --- |
| `meteor` | METEOR STORM | meteor gap `1.2–2.2 s`, max 4 on screen | meteor spawner |
| `bombers` | BOMBER WING | quota 4, drop gap `0.6–1.1 s` | bomber schedule / `bomberDrop*` |
| `air` | AIR RAID | 80% of spawns are UFOs, +15% UFO speed | spawn type roll |
| `ground` | GROUND SWARM | 80% rovers, +15% rover speed | spawn type roll |
| `gravity` | LOW GRAVITY | jump 215→260, gravity 360→270 | `CONFIG.jumpPower/gravity` |
| `armored` | ARMORED | rovers and UFOs take 2 hits | enemy `hp` on spawn + bullet hit path |
| `blackout` | BLACKOUT | stars + terrain rim hidden, enemy colours slightly brighter | render only |
| `fast` | FAST FORWARD | scroll +25% | scroll helper |

Rules:

- **No repeat within 3 sectors**; keep a small recent list.
- First endless sector (11) should be `blackout` or `gravity` — a visible change
  without a difficulty spike.
- Boss sectors get no modifier (readability wins).
- Do not combine `fast` + `meteor` before sector 20; leave stacking for a later
  pass.
- Implement as a table of pure functions/fields, and have difficulty helpers
  read `Game.modifier`. Avoid mutating `CONFIG` and restoring it later — it is
  easy to leak state across restarts.

Suggested shape:

```js
const MODIFIERS = {
  meteor:  { name: "METEOR STORM", meteorGap: [1.2, 2.2] },
  gravity: { name: "LOW GRAVITY", jump: 260, gravity: 270 },
  // ...
};
```

`nextLevel()` picks the next modifier and sets `Game.modifier`; all formulas
consult it via helper functions (`scrollSpeed()`, `spawnGap()`, `meteorGap()`,
`jumpPower()`, …).

---

## 8. Recurring bosses

### 8.1 Schedule

| Sector | Boss | Occurrence n |
| --- | --- | --- |
| 15 | Spider | 1 |
| 20 | Crab | 1 |
| 25 | Octopus | 1 |
| 30 | Spider | 2 |
| 35 | Crab | 2 |
| 40 | Octopus | 2 |
| … | cycles spider → crab → octopus | … |

Every 5 sectors; `bossKind = ["spider","crab","octopus"][(sector/5 - 3) % 3]`.

HP scaling from the rolled base (spider/crab 30–60; Octopus 20 heat hits):

```
hp = Math.round(baseHp * (1 + 0.25 * (n - 1)))
```

So a first-time Spider is 30–60, its second appearance 38–75, etc. Octopus hits
go 20 → 25 → 30.

Campaign bosses at 3/7/10 keep their current stats and do **not** get ordnance.

### 8.2 Boss ordnance ladder (new requirement)

Recurring bosses keep their aimed baby-boss bullets **and** gain missiles as the
sector rises. This is the requested progression:

| Sector | Ordnance | Volley | Cadence | Notes |
| --- | --- | --- | --- | --- |
| 15 | **1 missile** | 1 | 3.5–4.5 s | straight, aimed at the jeep |
| 20 | **multiple missiles** | 2 | 3.5–4.5 s | staggered 0.15 s, ±10° spread |
| 25 | **1 heat seeker** | 1 | 5.0–6.0 s | homes at the jeep |
| 30 | **multiple heat seekers** | 2 | 5.0–6.0 s | staggered 0.2 s |
| 35+ | **multiple heat seekers** | 3 | 4.5–5.5 s | cap 3 per volley; cadence tightens slowly |

Stage is derived from sector (not from the boss kind), so the same Spider at
sector 15 fires one missile and at sector 30 fires two heat seekers.

Specs (starting points):

| Property | Aimed missile | Boss heat seeker |
| --- | --- | --- |
| Speed | 150 px/s | 115 px/s |
| Homing | none | `1.8 rad/s` turn toward `Jeep.centerX/Y` |
| Lifetime | 6 s | 7 s |
| Max live at once | 4 (all boss missiles together) | 4 (5 after sector 35) |
| Shootable? | **yes**, 1 player bullet destroys it | **yes**, 1 bullet |
| Collision | point vs jeep rect, padded 4 px → `damageJeep()` | same |
| Terrain | explodes on impact | explodes on impact |

Fairness rules (important):

- **Homing turn rate is deliberately low.** A jump timed as the missile closes
  should make it overshoot; it must be dodgeable without shields.
- **Lifetime caps** ensure a missed homing missile does not orbit forever.
- **Shoot-down**: player bullets kill boss missiles — this rewards aiming and
  keeps the screen from filling.
- **Telegraph**: launch sound (`AudioSys.bossAlarm`-style beep) and a distinct
  colour per boss. Optional HUD line `MISSILE INBOUND` while any is live.
- Boss missiles are cleared when the boss dies (no post-victory deaths).
- Pause/shop freeze them (update already returns early).

Implementation notes:

- Add a separate array `foeMissiles` with `{x, y, vx, vy, heat, life, dead}`,
  plus `drawFoeMissile()`. Do **not** reuse the player's `missiles` array: the
  two have different targeting, rendering and collision rules, and mixing them
  would break player homing.
- Give the boss launcher state on the enemy: `missileTimer`, `missileSalvo`,
  `missileSalvoTimer`, staged like the player's volley code in `update()`.
- Spawn from the boss centre toward the jeep: `atan2(Jeep.centerY - sy, Jeep.centerX - sx)`.
- Player bullet collision: check `foeMissiles` before/with enemies; on hit,
  `tinySpark` + explode small + remove.
- `Game.start()` must clear `foeMissiles`; the boss death path must too.

### 8.3 Elite traits

Stack one trait per recurrence, starting at n = 2:

| n | Trait | Effect |
| --- | --- | --- |
| 1 | — | baseline |
| 2 | Frenzied | boss fire gap ×0.75 (bullets only; ordnance cadence unchanged) |
| 3 | Shielded | regains 1 HP every 6 s if not hit in the last 2 s |
| 4+ | Frenzied + Shielded | both |

For the Octopus, "Shielded" restores 1 heat-seeker hit instead of HP; if that
proves too punishing, restrict Shielded to Spider/Crab.

### 8.4 Octopus heat economy fix (must do)

Current rule tops the player up to 500 credits whenever a `heatOnly` boss spawns
without heat seekers and can't afford them. With recurring Octopuses this
becomes a repeatable 500-credit gift.

Options (pick one, recommend A):

- **A.** Gate the top-up behind `!Game.cleared` (first Octopus only). Later
  Octopuses rely on the player's income/planning.
- **B.** Remove the top-up entirely and raise distance income past sector 10.
- **C.** Allow 4th/5th heat-seeker stacks in the endgame so 25–30 hits stay
  achievable.

If C is chosen: `maxHeatStacks` 3 → 4 at sector 25 (price 1500), 5 at 35 (2500),
and update `SHOP_ITEMS` ownership checks + HUD.

---

## 9. Economy past sector 10

Money stops mattering once shields and both ordnance stacks are maxed. Add sinks:

- **Shield prices scale with depth**: `price = base * (1 + 0.15 * (sector - 10))`,
  rounded to 10s. Small 100→115 at 11, large 300→345.
- Optional: repairs are already shields; do not add a separate HP system.
- Track total spend? Not needed.

Keep ordnance prices fixed unless option 8.4.C is used.

---

## 10. Presentation

- Banner: `SECTOR 12 — METEOR STORM`; boss sectors `SECTOR 15 — SPIDER`.
- HUD: `LEVEL n` for 1–10, `SECTOR n` for 11+; modifier name under it, small and dim.
- Title: `DEEPEST SECTOR n` below the hi-score when n > 0.
- Game over: `REACHED SECTOR n`.
- First campaign win: 2.5 s `MOON SAVED` overlay, then `PATROL BEGINS` banner.

---

## 11. Victory → continue

Replace the terminating `Game.victory()` call in `damageBoss()`:

1. If `Game.sector >= 10` (campaign Octopus) and `!Game.cleared`:
   - `Game.cleared = true`, persist `moonranger_cleared`.
   - Freeze the simulation for `winFlash = 2.5` while rendering the overlay
     (simplest: a state `"milestone"` that decrements a timer and returns early,
     like `"pause"`, then resumes `"play"`; do not use the old `"victory"` state
     for this).
   - After it expires, `nextLevel()` into sector 11 with the `PATROL BEGINS`
     banner.
2. Any later boss death: normal `nextLevel()`.

`Game.victory()` can be deleted or kept for a future "retire" feature; do not
call it on the first Octopus anymore.

---

## 12. Implementation order

Each step should be playable before moving on.

1. **Counters & persistence** — rename `level` → `sector`, terrain clamp,
   `moonranger_depth` / `moonranger_cleared`, title + game-over display.
2. **Difficulty helpers** — sector-based scroll/spawn/fire/cap/bomber values.
3. **Victory → continue** — milestone overlay, sector 11 entry. (Game is endless
   now, even before modifiers.)
4. **Modifiers** — table, selection, banner + HUD, hooks in spawn/meteor/scroll/
   gravity/armor/blackout.
5. **Boss schedule** — recurring bosses every 5, HP scaling, elite traits.
6. **Boss ordnance** — `foeMissiles`, stages from section 8.2, draw + collision +
   shoot-down + audio.
7. **Economy** — shield price scaling; Octopus heat-economy fix.
8. **Docs & release** — README rules, CHANGELOG, developers.md (new section +
   line refs), version `0.1.0`.

Rough effort: 1.5–2 focused days. Steps 1–3 are the minimum shippable slice;
5–6 are the bulk of the work.

---

## 13. Test plan (manual, via `window.GAME`)

`Game.sector` exists after step 1; before that, use `Game.level` in these
snippets.

```
GAME.Game.sector = 10; GAME.Terrain.setLevel(10);
GAME.Game.distance = GAME.CONFIG.levelLength * 10 - 3;   // spawn the Octopus
GAME.Jeep.invuln = 999;                                   // test-only
GAME.enemies.length = 0; GAME.Game.bossActive = false;
```

Checklist:

- [ ] Octopus #1 dies → overlay → sector 11, run continues.
- [ ] Reload → `DEEPEST SECTOR` persisted; `moonranger_cleared` set.
- [ ] Sector 11 shows a modifier and its effect is observable (meteors/gravity…).
- [ ] Modifier resets cleanly on the next sector (no leaked CONFIG values).
- [ ] Boss at 15 fires 1 missile; 20 fires 2; 25 fires 1 heat seeker; 30 fires 2.
- [ ] A jump dodges a homing missile (turn rate sanity).
- [ ] Player bullets destroy a boss missile.
- [ ] Boss missiles disappear when the boss dies and on restart.
- [ ] Octopus #2 does not hand out 500 credits again.
- [ ] Shield prices rise past sector 10.
- [ ] Death saves depth; game over shows sector reached.
- [ ] `node --check game.js`, console clean, no stale pooled fields.
- [ ] Enemy count / projectile count stays bounded at sector 40 (performance).

---

## 14. Tuning knobs (keep all of these in CONFIG)

New or changed entries:

```js
maxLevel: 10,               // terrain cap (unchanged)
sectorScrollBonus: 1,       // extra px/s per sector past 10
scrollCap: 126,
enemyCapBySector: 4,        // 5 at 15, 6 at 25 — implement via helper
spawnScaleFloor: 0.22,
fireScaleFloor: 0.38,
foeMissileSpeed: 150,
foeHeatSpeed: 115,
foeHeatTurnRate: 1.8,
foeMissileLife: 6,
foeHeatLife: 7,
foeMissileMax: 4,
bossOrdnanceCadence: { missile: [3.5, 4.5], heat: [5.0, 6.0] },
shieldPriceScale: 0.15,
```

---

## 15. Open questions

1. Should modifiers stack at sectors 30+? (Recommend: one modifier only, but
   intensification inside a modifier.)
2. Should the recurring Octopus stay heat-seeker-only, or should armour alternate
   by occurrence? (Heat-only plus 25/30 hits may be a big heat-seeker economy
   requirement.)
3. Is "retire" wanted as an explicit end to a run for recording depth?
4. Should `moonranger_hi` switch from currency to deepest sector as the headline
   record? (Recommend: keep currency, headline depth.)
