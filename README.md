# MOON PATROL

An Atari-style 2D side-scrolling survival shooter for the browser. Drive an
open-top jeep with a mounted gun over increasingly cratered lunar terrain, jump enemy
fire, and shoot down alien moon rovers and flying saucers. Survive from level 1
(smooth ground) to level 10 (maximum hills).

Built with plain HTML5 Canvas + JavaScript — **no dependencies, no build step**.

Current version: **v0.0.9** — the full history of every change lives in
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
  - **Missiles (300)** — auto-fire a missile at 45° up-right every few
    seconds, until the run ends
  - **Heat Seekers (500)** — red homing missiles that chase the nearest
    enemy, until the run ends
- Shields show as a cyan ring and HUD pips; after a shielded hit you get a
  second of invulnerability (the jeep blinks).
- Enemy dots are aimed at you — one per enemy at a time. Jump to dodge.
- **Red bomber saucers** hover across the top and drop big bombs — only a
  direct hit kills you. One visits on level 1, two on level 2, three on
  every level after that; each takes 5–10 hits to destroy.
- **Meteorites** (level 3+) fall from the top-right, slam down right of
  center, then roll toward you. They **cannot be shot** — you must jump
  over them.
- Each level the terrain gets hillier and enemies spawn/shoot faster.
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
