# Soccer Engine (soccer-js)

A **retro 2D isometric soccer game engine** written in JavaScript. It simulates full matches with team AI, set pieces, match rules, and optional human control — runnable in the browser or headlessly in Node.js for batch balance testing.

![Open Source Soocer Game Engine Demo](docs/game.jpg)

## 📺 Video Demo
Check out this Open Source Soocer Game Engine in action:

[![Open Source Soocer Game Engine Video Demo](https://img.youtube.com/vi/qSWvtv4tWGU/0.jpg)](https://youtu.be/qSWvtv4tWGU)

## Features

- **Fixed-timestep match simulation** — logic at 20 UPS, render at 60 FPS; seeded LCG for deterministic AI-only runs
- **Team & player AI** — formations, roles, support spots, pass safety, through balls, marking, counter-press, set-piece playbooks
- **Match rules** — kick-off, goals, throw-ins, corners, free kicks, penalties, offside (delayed), substitutions
- **Isometric canvas rendering** — modular sprites, flags, audio hooks, debug overlays
- **Manual control** — take over a player while AI runs the rest
- **Headless batch runner** — multi-worker simulations, telemetry, parameter sweeps
- **Scenario Lab** — isolated set-piece / open-play situations for interactive testing
- **Asset Manager** — browse and work with sprite / palette assets (game sprites created using [Sprite Editor](https://github.com/haeretici/sprite-editor))

## Requirements

- **Node.js** 18+ (recommended)
- A modern browser for the UI apps

## Quick start

```bash
# Install build tools (esbuild, sass)
npm install

# Build JS bundle + CSS
npm run build

# Serve the project (static HTTP on port 8080)
npm run dev
```

Then open:

| App | URL |
| :--- | :--- |
| Match Simulator | http://localhost:8080/html/index.html |
| Batch Builder | http://localhost:8080/html/batch-builder.html |
| Simulation Analysis | http://localhost:8080/html/simulation-analysis.html |
| Asset Manager | http://localhost:8080/html/asset-manager.html |
| Scenario Lab | http://localhost:8080/html/tests.html |

Root `index.html` redirects to `html/`, treating a missing trailing slash as a directory so `/prefix` and `/prefix/` both go to `/prefix/html/`.

### Subpath hosting

The UI can be served from a path prefix (e.g. `https://host/soccer/html/index.html`). Static tags in `html/*.html` use `../…`; runtime `fetch` / images use `appUrl()` from `kernel/core/lib/app_paths.js` (detects the parent of `/html/`). Optional override: `window.__APP_ROOT__ = '/soccer/'`.

## Project layout

```text
kernel/
  core/entities/     # Ball, Player, Team, Pitch, Goal, FSMs
  core/lib/          # AI, rules, steering, sprites, scenarios, …
  providers/simulator/  # Match flow, headless runner
  apps/              # Browser app entry points
  engine.js          # Canvas / application loops
  settings.js        # Physics, AI knobs, flags
html/                # UI pages
presets/             # Formations, AI params, palettes, stats (JSON)
assets/              # Sprites, flags, sounds
scripts/             # Batch sim, profile, param sweep CLIs
tests/               # Node unit / integration tests
docs/                # Architecture & subsystem docs
build/               # Generated app.bundle.js + CSS (do not edit)
```

## Scripts

| Command | Description |
| :--- | :--- |
| `npm run build` | Build CSS and browser JS bundle |
| `npm run build:js` / `build:css` | Build only JS or only CSS |
| `npm run dev` | Static server on port 8080 |
| `npm test` | Full test suite (quiet on success) |
| `npm run test:<name>` | Single suite, e.g. `test:pass-safety` |
| `npm run sim:batch` | Headless batch matches |
| `npm run sim:sweep` | Sweep one AI parameter |
| `npm run sim:profile` | Profile a batch run |

Verbose test output:

```bash
VERBOSE=1 npm run test:pass-safety
# or
VERBOSE=1 node tests/pass_safety.js
```

### Headless batch example

```bash
npm run sim:batch -- '{"iterations":10,"seed":42,"headless":true}'
```

Outputs land under `simulations/output/`. For very large runs, prefer `SIMULATION.sh` and run it locally.

### Parameter sweep example

```bash
npm run sim:sweep -- '{"knob":"PASS_AGGRESSION","min":0.1,"max":0.9,"steps":5}'
```

## Determinism

Match bootstrap and logic steps use a **seeded LCG** bound to `Math.random` only during `bootstrapMatch` / `updateAll` (and Scenario Lab apply). Same seed and no human input → same AI match. Manual control, wall-clock scheduling of human input, and non-seeded UI code intentionally diverge after that.

Physics and AI knobs live in `kernel/settings.js` (`Settings.physics`, `Settings.AI`) so balance tweaks stay in one place.

![Tweaks Demo](docs/tweaks.jpg)

## Documentation

Deep dives for contributors and agents:

| Doc | Topics |
| :--- | :--- |
| [docs/01_architecture.md](docs/01_architecture.md) | Hierarchy, fixed timestep, determinism, physics |
| [docs/02_ai_and_match.md](docs/02_ai_and_match.md) | Player AI, passes, FSMs, set pieces |
| [docs/03_rendering_assets.md](docs/03_rendering_assets.md) | Canvas, isometric draw, sprites, audio |
| [docs/04_simulation.md](docs/04_simulation.md) | Headless batch, telemetry, Scenario Lab, tests |
| [docs/05_spritesheet.md](docs/05_spritesheet.md) | Sprite sheet format (created via [Sprite Editor](https://github.com/haeretici/sprite-editor)) |

## License

This project is licensed under the [MIT License](LICENSE).

Copyright (c) 2026 Thiago Campos Viana

---

## 🌐 Connect with Me

Stay updated with my projects, coding sessions, and videos:

- **YouTube**: [tcviana](https://www.youtube.com/tcviana)
- **X (formerly Twitter)**: [@haeretici](https://x.com/haeretici)

---

## 💖 Support the Project (Crypto Donations)

If you find this project useful and would like to support its development, you can make a cryptocurrency donation to the following addresses:

* **BNB Chain / Ethereum / Polygon / OP / Linea / Base / Arbitrum (EVM)**:  
  `0xfE5Fc67Fe92234cB079B521EC7f9ad9c23da2AA8`

* **Solana (SOL)**:  
  `EjPqM1cX5nhkqdb7GK7z5aF9ayRswPUwPd5VnVP1PVVL`

* **Tron (TRX)**:  
  `TP3Ncy8RVYKJPkVBbrrMD8WsDmPkRCLArG`

* **Bitcoin (BTC)**:  
  `bc1qqk5s3rmvxe3mlhtzr07xnp44ap6yu95ksva703`

## Spellside Cup

Run the game locally and open **http://localhost:8080/**.

```bash
npm install
npm run build
npm run dev
```

Select **New Run** to roll starter abilities and shirt numbers, then choose a starter, name your team, and set its shirt color. You open with one outfielder
and no goalkeeper. The opener is against four Slimers and a Slime Keeper. The outfielders’ slow
projectiles halve your movement speed for two seconds on contact. Later
encounters draw different opponents and may include a keeper.

After selecting your starter, select **Play match** to kick off the first fixture.

Five clubs play a single round-robin league. Your club plays four one-minute
fixtures, with Mix Bag FC as the final opponent. A win earns three points and
145 gold plus club bonuses. A draw earns one point and a loss earns zero.
Only wins pay match gold. The club at the top wins the Cup. Goal difference,
then goals scored, break points ties. Clubs still level share the place.

After every match, pick a player upgrade. During the rest between fixtures,
check the standings and choose **Tavern**, **Explore**, or **Shop**. Finishing
or skipping the rest activity takes you straight to the next match.

The tavern always offers an Orc goalkeeper while your squad has no keeper.
Open **Events** on the title screen to try any of the three special challenges
or seven text encounters. Tests use a temporary squad and gold balance.
During a rest, **Explore** reveals a randomly rolled encounter.
Street 1v1 is the most common special challenge. Text encounters include the
chance to sign Varek Stonewall, a rare keeper with 84 Saving.

- **Street Kick-Ups** pays 100, 200, or 300 gold for a target of 10, 20, or 30.
  Move your mouse or drag on the court to steer the boot. Flick upward to
  kick the falling ball. You can also use Space or the Kick button.
- **Crossbar Challenge** gives you three shots with your selected player's Shot Speed and Shot Accuracy. Between shots, collect the next ball at midfield. Hit all three for 300 gold and the Crossbar Relic, or earn 50 gold per hit on a partial result. The relic pays 100 gold per kick that hits the opposition crossbar in completed league matches and events, including Street 1v1.
  Aim at the bar and hold Shoot to lift the ball.
- **Street 1v1** lets you pick a squad player to face a rolled challenger.
  The defender passes to start each attack. Both players attack the same goal
  against a neutral keeper, with up to three 10-second attacks each. Tackles
  change possession, and rebound walls keep the ball in play. An outright win lets you choose
  250 gold or recruit the challenger if your squad has room. A loss or tie awards
  a random potion. Inspired by the [Top Baller 1v1 rulebook](https://topballer.co/1v1-rulebook/).
The market's Scouting Contract lets you sign one outfield player from a beaten
team when your squad has room. The market also sells
permanent Perks and single-use items. Try either category from the main
menu. In matches, use single-use items from the counted icons in the top
toolbar. Boards around the pitch bounce misses back into play.

**Test Match** sets your side and the opponents independently from one to five.
Custom sides can include a keeper when they have at least two players. Test Match
also offers the Slimers and Horde FC presets. **Abilities**
opens individual and team practice drills.

League fixtures and Test Matches with more than one player on either side
start with an untimed warmup. Select **Kick off** when ready. One-on-one games
and special events start directly.

Use [PLAYTEST_FEEDBACK.md](PLAYTEST_FEEDBACK.md) to collect notes from any
playtest for Codex to review in one pass.

Control follows the receiver on an aimed pass and the ball carrier in
possession. In test matches with a keeper, **G** switches to them on defense.
Left click passes, right click clears, and **L** dives off the ball.

| Control | Action |
| --- | --- |
| WASD / arrows | Move |
| Mouse | Aim independently of movement |
| J / left mouse | Pass or tackle |
| K / right mouse | Shoot or shoulder tackle |
| L | Lob |
| Shift | Sprint |
| Q | Select the outfield teammate nearest the ball |
| G | Switch to or from the goalkeeper while defending |
| Space | Use the active player's special power |
| T | Cross for Overhead Kick and finish with the receiver facing away from goal |
| Escape | Pause or resume |

In open play, tap Pass to nudge the ball along the aim direction. Hold Pass
longer for a stronger pass, then release to kick. Movement aims when the pointer
is off the pitch. Touch controls include a movement stick and buttons for all
match actions.

- **Grum, Orc Warrior.** Barge takes the ball from an opponent in
  reach. A miss leaves Grum recovering briefly.
- **Nyx, Rogue winger.** Shadow Step dashes in the movement direction, or
  sideways when standing still.
- **Rune, Wizard playmaker.** Press **Space** to arm Swerve, aim at a teammate,
  then click to send the pass or hold and steer to shape the bend. In a solo
  match, Rune can bend the ball into space for his own run. Hold Shoot to
  lock the shot aim, steer the bend, and release to fire. Clone is another
  Mage ability. It sends out a decoy while the caster keeps the ball.
- **Asha, Knight striker.** A high shooting stat and regular charged shots.

Each power recharges automatically. The icon beside the active player shows
**Space** when ready and counts down in seconds after use. Upgrades can shorten
cooldowns, change a power's behavior, or refresh it through play. On your goal
kicks, aim and release **J** for a short pass or **K** / **L** for a clearance.

`npm run test:five` checks the match, powers, run progression, and interface.
The browser entry is `html/soccer-rogue.html`, with game code under
`kernel/five/` and the interface in `kernel/apps/soccer-rogue/app.js`.

### Event · The Last Ref

When someone asks where the refs are, point to a pile of bones and skulls.
The last ref hides in the shadows and swears he'll never ref another game.
The Last Ref has a 2% chance to appear when you explore. He sells one Red Card for 260 gold.

Each card is a single-use item. Select it from a compact icon with a count
in the top match toolbar, then choose any opposing player on the pitch to
send off for the rest of the match. Back out of targeting to keep the card.

A future variation could offer the Last Ref as a playable recruit. Whenever the ref takes damage or
gets stunned, he gives a random player on the pitch a yellow card. The card
halves that player's movement speed. The target can be on either team.
