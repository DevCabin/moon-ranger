# Changelog

All notable changes to MOON PATROL are documented here. This project follows simple semantic versioning: every gameplay or feature change bumps the version by 0.0.1.

The versions below map one-to-one to the conversation in which the game was built — each entry is one iteration of feedback and polish.

---

## [0.0.9] — Rover variety

- Ground rovers are now wedge-shaped, retro-futuristic buggies instead of boxy cars
- Five rotating colorways cycle across spawns (green, teal, yellow, magenta, blue)
- Explosion sparks match the color of the destroyed enemy
- Fix: "GAME OVER" text was still rendered in the old rover green — now properly red

## [0.0.8] — Red ship scheduling fix + meteor fire

- Red ships are now placed on a fixed, evenly spread schedule per level and ignore the regular enemy cap — no more swarms stacked at the start of levels 1–3 and no more disappearing after level 5
- Falling meteorites now trail a large three-layer flickering flame with ember particles

## [0.0.7] — Currency & buy menu

- Score is now spendable **currency**: it still auto-trickles with distance, kills pay 100 (rover) / 150 (UFO) / 300 (red ship), and spending reduces your total
- New buy menu on hotkey **B** (also pauses the game), purchase with keys **1–4**
- Power-ups: Small Shield (100, absorbs 1 hit), Large Shield (300, 3 hits), Missiles (300, auto-fire up-right until end of turn), Heat Seekers (500, homing missiles that chase the nearest enemy)
- Fix: unaffordable shop items were rendered green since the retheme — now red

## [0.0.6] — Red ship quota enforcement

- Strict quotas: exactly 1 red ship on level 1, exactly 2 on level 2, a maximum of 3 on every level after
- Red ships now retreat off-screen when a level ends instead of leaking across level boundaries and stacking

## [0.0.5] — Red ship armor

- Red ships now take 5–10 hits to destroy (randomized per ship), with visible HP pips and a hit flash
- Fix: dying while holding fire no longer skips the game-over screen instantly

## [0.0.4] — Fullscreen fix

- Fullscreen button enlarged with a bigger click zone; double-clicking the game also toggles fullscreen
- If fullscreen is blocked (e.g. inside an embedded preview), an in-game hint explains why instead of failing silently

## [0.0.3] — Red bomber & meteorites

- New large **red bomber saucer**: hovers across the top of the screen and drops a heavy bomb — 1 on level 1, 2 on level 2, 3 on every level after
- New **meteorites** from level 3 onward: fall from the top-right, slam into the ground right of center, then roll toward the jeep — they must be jumped and cannot be shot

## [0.0.2] — MOON PATROL retheme & handling pass

- Renamed to **MOON PATROL**: gray lunar terrain with craters, alien rovers on the ground, silver UFOs in the sky
- Gun can now aim below horizontal so ground targets are hittable
- Enemies are taller; enemy shots are larger
- Higher jumps with slower, floatier falls (low lunar gravity)

## [0.0.1] — Initial release ("HILL PATROL")

- Atari-style 2D side-scroller on HTML5 canvas, playable in-window or fullscreen
- Jeep with aimable mounted gun at bottom-left; terrain scrolls right-to-left
- Terrain starts smooth on level 1 and gets hillier up to a maximum at level 10
- Ground enemies enter from the right, air enemies from the top-right; both fire aimed single shots
- Controls: W/Up jump, A/D or Left/Right aim, Space rapid fire
- Title / pause / game-over screens, synthesized sound effects, persistent hi-score
