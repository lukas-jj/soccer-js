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

## Soccer Rogue — football management roguelite

Soccer Rogue is a separate app; the Match Simulator, Batch Builder, Analysis,
Asset Manager and Scenario Lab remain at their existing URLs.

```bash
npm install
npm run build
npm run dev
```

Open **http://localhost:8080/html/soccer-rogue.html**, or follow **Play Soccer Rogue**
from the Match Simulator. Node.js 18+ is required. Serve over HTTP; do not open
HTML directly from the filesystem because the engine fetches its sprite assets.

Choose Harbor Lanterns (rain specialists), Orchard Comets (accelerated learning),
or Summit Rovers (rest specialists). Each has its own starting stat bias and
permanent perk. Four teams contest a three-round season in each of three divisions.
First place promotes, last place relegates. Last in District ends the run. Your
first Premier title wins; Continue Career keeps the same club and squad playing.
Tiebreaks are points, goal difference, goals scored, then stable club ID.

Before every fixture, spend three days on training, rest, scouting, the market,
or the shop. Formation/lineup, level choices, staff hires and inventory use do not
consume a day. A scouting/market/shop visit remains open until the next activity.
Scouting gives three cheaper prospects with estimates within eight stat points;
market gives six exactly assessed prospects. No contracts or wages. Purchases
cannot create debt. Fixture income is paid before operating costs; failing to
cover the bill means bankruptcy. Balance constants and prices are in
`kernel/rogue/data.js` (including 180 seconds of engine play per fixture).

Training directly adds attributes, never overall XP. Actual match minutes earn XP,
fatigue and independent GK/DF/MF/FW proficiency. Every level queues three upgrades
weighted by archetype; you choose one, with multiple choices retained until selected.
Cards explain every trait, injury and positional effect. Injury rolls resolve in
the match report; injured players cannot start the next fixture. Preparation days
heal injuries, doctors accelerate healing and stored treatments shorten recovery.
All stats remain on the engine's eight-attribute 1–100 scale.

Matches use the existing `Simulator`, its football rules, formations, AI, weather,
physics and sprites. Tactical styles reuse `ai_archetypes.json`. The career adapter
feeds effective player attributes into the engine. There is no random-score shortcut:
other league fixtures also run through the same simulator. Watch at 1–32×, pause,
or simulate rapidly. Queue substitutions at any time; they execute at the next
stoppage, limited to three. The player's club does not substitute automatically;
opponents retain the engine's behavior. Position swaps also execute at stoppages,
and actual minutes are allocated to each role separately.

Careers autosave under localStorage key `soccer-rogue-v1` with version 1. Export /
Import in Save & run controls provides portable JSON backups. Active matches save
the seed, fixed-step tick and manager command timeline; refresh replays the same
engine to that tick before continuing. Match rewards apply exactly once, then the
other league fixture resolves as a separate persistent phase. Save files from
unsupported versions are rejected instead of silently reset. Reset asks before
ending your career.

Targeted checks:

```bash
npm run test:rogue
npm run test:substitutions
npm run test:headless
npm run test:formations
npm run test:bundle
```

Career rules live in `kernel/rogue/{data,players,career}.js`, the engine bridge in
`kernel/rogue/match.js`, presentation in `kernel/apps/soccer-rogue/app.js`, and styling
in `scss/rogue.scss`. The build emits `build/rogue.bundle.js` and `build/rogue.css`
alongside the existing bundles. No backend or new runtime framework is required.
