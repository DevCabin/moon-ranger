# MOON RANGER

An Atari-style 2D side-scrolling survival shooter for the browser. Drive an
open-top jeep with a mounted gun over increasingly cratered lunar terrain, jump enemy
fire, and shoot down alien moon rovers and flying saucers. Survive from level 1
(smooth ground) to level 10 (maximum hills), then keep going into the endless
Patrol.

Built with plain HTML5 Canvas + JavaScript — **no dependencies, no build step**.

Current version: **v0.1.1** — the full history of every change lives in
[CHANGELOG.md](CHANGELOG.md).

## Run locally

Just open `index.html` in a browser, or serve the folder (recommended):

```bash
npx serve .        # or: python3 -m http.server
```

## Deploy to Vercel

This is a fully static site.

- **CLI:** run `vercel` in this folder and accept the defaults
  (framework: *Other*, no build command, output directory: `./`).
- **Dashboard:** import the repo/folder; Vercel will detect it as a static
  site automatically. `vercel.json` is included and marks it as static.

## Controls

| Key | Action |
| --- | --- |
| `W` / `↑` | Jump |
| `A` / `←` | Raise gun barrel (aim up) |
| `D` / `→` | Lower gun barrel (aims below horizontal too!) |
| `Space` | Fire (hold for rapid fire) / start / restart |
| `B` | Open / close the buy menu |
| `1`–`4` (in menu) | Buy power-up |
| `P` / `Esc` | Pause / resume |
| `M` | Mute / unmute |
| `F`, corner button, or double-click | Toggle fullscreen |

## Rules

- Your score is **currency**: it trickles in with distance and grows with
  kills — rovers = 100, saucers = 150, red ships = 300.
- Press **B** to open the **buy menu** (the world freezes while you shop).
  Spending is permanent — your currency drops by the price paid.
  - **Small Shield (100)** — absorbs 1 hit
  - **Large Shield (300)** — absorbs 3 hits (stacks with small)
  - **Missiles (300)** — auto-fire at 45° up-right until the run ends. Buy up
    to **3**: every cycle launches one missile per launcher, so 1, 2, 3…
  - **Heat Seekers (500)** — red homing missiles that chase the nearest
    enemy, until the run ends. They stack **3** deep the same way.
- Shields show as a cyan ring and HUD pips; after a shielded hit you get a
  second of invulnerability (the jeep blinks).
- Enemy dots are aimed at you — one per enemy at a time. Jump to dodge.
- **Red bomber saucers** hover across the top and drop big bombs — only a
  direct hit kills you. One visits on level 1, two on level 2, three on
  every level after that; each takes 5–10 hits to destroy.
- **Meteorites** (level 3+) fall from the top-right, slam down right of
  center, then roll toward you. They **cannot be shot** — you must jump
  over them.
- **Bosses guard the end of levels 3, 7 and 10.** The level holds at its
  finish line until the creature is destroyed:
  - **Spider** (level 3) and **Crab** (level 7) take six times a red
    ship's hits — 30 to 60 of them.
  - **Octopus** (level 10) is the big one. Gunfire and ordinary missiles
    bounce off it: only **Heat Seekers** hurt it, and it takes **20 hits**.
    If you reach it without heat seekers and can't afford the 500, the moon
    base fronts you the price — press **B** to buy.
  - **Meteorites keep falling during boss fights**, on their own faster,
    intermittent cadence. They slam down between you and the creature and
    must be jumped.
  - Boss shots are **tiny copies of the creature**, pulsing as they fly.
- **Destroy the Octopus to save the moon** — but the run no longer ends there.
  After a short **MOON SAVED** freeze the campaign rolls into the endless
  **Patrol**: the counter keeps climbing past level 10 as sectors
  (`SECTOR 11`, `SECTOR 12`, …), enemies spawn denser and shoot faster, and
  your deepest sector is saved between sessions.
- **Every Patrol sector carries a modifier**, named in the banner and listed
  under the HUD:
  - **METEOR STORM** — rocks every 1–2 s, up to four in the air
  - **BOMBER WING** — more red ships, dropping bombs twice as often
  - **AIR RAID** — mostly UFOs, 15% faster
  - **GROUND SWARM** — mostly rovers, 15% faster
  - **LOW GRAVITY** — jump higher and hang longer
  - **ARMORED** — rovers and saucers take two hits
  - **BLACKOUT** — no stars, no horizon rim, enemies lit brighter
  - **FAST FORWARD** — the world scrolls 25% faster
- **The bosses return.** From sector 15 a creature guards every 5th sector,
  rotating spider → crab → octopus. Each visit is **25% tougher**, and repeat
  bosses carry elite traits: **FRENZIED** (fires faster) from the second visit,
  **SHIELDED** (slowly regains health until you hit it again) from the third.
  A recurring octopus still only takes heat seekers.
- **Patrol bosses carry ordnance.** From sector 15 a boss throws missiles as
  well as aimed shots: **1 aimed missile** at 15, **2** at 20, then heat
  seekers — **1** at 25, **2** at 30, **3** from 35. They are slow, up to four
  are in the air at once (five at 35+), **one bullet shoots one down**, and a
  jump timed as a seeker closes makes it overshoot. Everything a boss has in the
  air vanishes when it dies.
- **Shields cost more the deeper you go:** +15% of base per sector past 10,
  rounded to 10s — 120 / 350 at sector 11, 180 / 530 at sector 15. Missiles and
  heat seekers stay at 300 / 500.
- Each boss pays a 900-credit bounty.
- Each level the terrain gets hillier and enemies spawn/shoot faster. Past
  sector 10 the hills stop growing (level 10 is the terrain ceiling); difficulty
  comes from spawn rate, enemy count, fire rate and the sector modifier.
  Enemies on screen go 4 → 5 (sector 15) → 6 (sector 25), and shot speed caps
  at 240 px/s so late sectors stay dodgeable.
- Your **deepest sector** is saved (`moonranger_depth`), alongside the
  hi-score. Beating the campaign once is remembered too (`moonranger_cleared`).
- High score is saved in your browser (`localStorage`).

## Editing

Everything lives in **`game.js`**, organized into numbered sections with a
map at the top of the file. All gameplay tuning (speeds, hill sizes per
level, fire rates, scoring, colors) is in the `CONFIG` and `COLORS` objects
at the very top — change numbers there and refresh; no build needed.

Files:

| File | Purpose |
| --- | --- |
| `index.html` | Page shell, loads the canvas and script |
| `style.css` | Page chrome (fills window, crisp pixels) |
| `game.js` | The entire game (config → audio → input → terrain → entities → state → update → render → loop) |
| `vercel.json` | Marks the project as a static deployment |
| `CHANGELOG.md` | Version-by-version history of every change |
