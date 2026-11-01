# Changelog

All notable changes to MOON RANGER are documented here. This project follows simple semantic versioning: every gameplay or feature change bumps the version by 0.0.1.

The versions below map one-to-one to the conversation in which the game was built — each entry is one iteration of feedback and polish.

---

## [0.1.3] — Pixel moon favicon

- The browser tab now shows a chunky **pixel-art moon** instead of the default
  blank page icon: a 16×16 disc lit from the upper left, complete with two
  craters, drawn in the same lunar greys as the game's terrain.
- It is a single hand-placed `favicon.svg` — 1×1 rects on a 16-unit grid with
  `shape-rendering: crispEdges` — so it stays sharp at any tab size, needs no PNG
  or `.ico`, and weighs under 5 KB of text with no binary asset to keep in sync.
- `index.html` links it with `rel="icon" type="image/svg+xml"`. Everything else
  about the deploy is unchanged: still no build step, still a static folder.

## [0.1.2] — Shields stack like ordnance

- Shields now cap out the same way missiles do: at most **three small** (+1
  each) and **three large** (+3 each) owned at once, for a full bank of **12
  hits**. Previously they stacked with no limit at all.
- A purchase only goes through if the whole charge fits, so a partly-drained
  large stack never sells you a wasted 300-credit top-up and the bank can never
  exceed 12. Damaged charges free their slot again as soon as they are spent.
- Small charges soak a hit before large ones, so a large shield stays intact the
  longest.
- The HUD draws each large charge as a bar (3 hits, shrinking as it drains) and
  each small one as a pip, so the composition of the bank is readable at a
  glance.
- The buy menu marks both shield rows **MAX** when no further charge fits, like
  the missiles and heat seekers.

## [0.1.1] — Boss ordnance

- Patrol bosses now throw ordnance as well as aimed shots: **1 aimed missile**
  at sector 15, **2** at 20, **1 heat seeker** at 25, **2** at 30 and **3** from
  35 on, up to four live at once (five from 35). Campaign bosses never fire
  these.
- Boss missiles are slow and **shootable** — one player bullet destroys one —
  and they disappear the instant the boss dies. They freeze with the world in
  the shop and pause screens.
- The heat-seeker turn rate was set by measurement, not guesswork: at 1.8 rad/s
  a jump dodged it from any distance, so it was dropped to 1.0, where a jump
  timed mid-approach makes it overshoot while jumping early or at the last
  instant still gets you hit.
- Shields now cost more as the Patrol deepens: +15% of base per sector past 10,
  rounded to the nearest 10 (120 / 350 at sector 11, 180 / 530 at sector 15).
  Missile and heat-seeker prices are unchanged.
- Fix: a recurring octopus could re-trigger the MOON SAVED freeze if the run had
  not registered a campaign clear. The milestone is now limited to the campaign
  octopus.

## [0.1.0] — The Patrol: endless sectors

- The run no longer ends at the Octopus. Beating it shows **MOON SAVED**, then
  the game continues into the endless **Patrol** — sector 11, 12, 13…
- Levels become unbounded **sectors**. Sectors 1–10 play exactly as before; past
  that, difficulty comes from density rather than runaway numbers: enemies on
  screen go 4 → 5 (sector 15) → 6 (sector 25), spawn and fire gaps keep
  tightening to fixed floors, and enemy shot speed caps at 240 px/s. Terrain
  still tops out at its level-10 hills.
- Every Patrol sector carries one **modifier**, named in the banner and listed
  in the HUD: **METEOR STORM** (rocks every 1–2 s, max four), **BOMBER WING**
  (more ships, bombs twice as often), **AIR RAID** / **GROUND SWARM** (80% of
  one enemy type, 15% faster), **LOW GRAVITY** (higher, floatier jumps),
  **ARMORED** (rovers and saucers take two hits), **BLACKOUT** (no stars or
  terrain rim, enemies lit brighter) and **FAST FORWARD** (+25% scroll).
  None repeat within three sectors, boss sectors never carry one, and sector 11
  always opens with BLACKOUT or LOW GRAVITY.
- **Bosses return:** every 5 sectors from 15, rotating spider → crab → octopus,
  each visit 25% tougher. Repeat visits add elite traits — **FRENZIED** (aimed
  shots 25% faster) from the second, **SHIELDED** (regains 1 HP every 6 s, and
  any hit restarts that clock) from the third. A recurring octopus is still
  heat-seeker-only.
- New saved records: `moonranger_depth` (deepest sector, shown as DEEPEST
  SECTOR on the title screen) and `moonranger_cleared` (campaign beaten). The
  game-over screen now reports the sector you reached.
- The 500-credit emergency handout for the heat-seeker-only Octopus now happens
  only on the first one, so recurring octopuses can't be farmed for credits.
- Banner text now sits on a dark band, keeping long `SECTOR 12 - METEOR STORM`
  lines readable over passing enemies, and the pixel font gained a `+` glyph.

## [0.0.15] — Patrol the Moon

- The title screen tagline now reads **PATROL THE MOON** instead of SURVIVE THE MOON

## [0.0.14] — Boss shots are baby bosses

- Each boss now fires a miniature copy of itself instead of a red dot, with a
  pulsing halo as it flies
- Spider, crab and octopus shots each use their own mini sprite and colour, so
  you can read which creature is shooting at you

## [0.0.13] — Tougher bosses

- Boss hit counts doubled: the spider and crab now take six times a red ship's
  hits (30–60, up from 15–30)
- The octopus now needs 20 heat-seeker hits (up from 10)

## [0.0.12] — Rebrand: MOON RANGER

- The game is now **MOON RANGER** (previously MOON PATROL): the title screen,
  page title, README and developer walkthrough all use the new name
- Local save keys are now `moonranger_hi` and `moonranger_muted`, so a high score
  or mute setting saved under the old keys does not carry over

## [0.0.11] — Boss meteor fire & stacked ordnance

- Meteorites now keep falling during boss fights, on their own faster cadence,
  slamming down between the jeep and the creature so they can be jumped
- Missiles and heat seekers can be bought up to **3** times each and stack like
  shields; every cycle now launches one shot per stack, in a 1, 2, 3… volley
- The HUD shows the stack count (`MSL 3`, `HEAT 2`), and the shop shows `MAX`
  instead of `OWNED` when you hold all three

## [0.0.10] — Boss levels

- Levels 3, 7 and 10 now end with a boss: reaching the finish line spawns it, and
  the level cannot advance until it is destroyed
- **Spider** (level 3) and **Crab** (level 7) take three times a red ship's hits
  (15–30), with a health bar and name shown at the top of the screen
- **Octopus** (level 10) is an oversized 8-bit final boss: bullets and ordinary
  missiles bounce off, and only 10 heat-seeker hits can destroy it. Reach it
  without heat seekers and short of the 500 price, and the game fronts you the
  difference so the final fight can't dead-end
- Boss fights slow the world to a third speed and pause regular spawning,
  meteorites and bomber arrivals
- Destroying the Octopus ends the run on a new **MOON SAVED** victory screen
- Each boss pays a 900-credit bounty

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

## [0.0.2] — Moon theme & handling pass

- Rethemed to the moon: gray lunar terrain with craters, alien rovers on the ground, silver UFOs in the sky
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
