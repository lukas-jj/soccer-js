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

## SOCCER / FIVE — playable 5v5

The main game is now direct-control five-a-side football. Open
**http://localhost:8080/** or **http://localhost:8080/html/soccer-rogue.html**.
Choose one of four players and press Play. You control that character for the
entire match; four teammates (including the goalkeeper) and five opponents use
the existing AI. There are no career, shopping, training or management menus.

```bash
npm install
npm run build
npm run dev
```

| Control | Action |
| --- | --- |
| WASD / arrows | Move |
| Mouse | Aim independently of movement |
| J / left mouse | Pass; tackle when defending |
| K / Space / right mouse | Shoot; shoulder tackle when defending |
| L | Lob; slide tackle when defending |
| Shift | Sprint |
| E | Call for a pass (queued for 3 seconds; safe backward passes allowed) |
| Escape | Pause / resume |

Teammates look for your actual position and favor an open pass to you. E queues a
request while the carrier finishes a committed action. Feedback shows PASS COMING,
GET OPEN, MOVE CLOSER or WIN POSSESSION. Possession still changes through a real
pass, interception or first touch.

Hold and release pass, lob or shoot to set power. Without a mouse, movement sets
your aim. Touch devices have a movement stick and pass, shoot, lob, sprint and
call buttons. Use landscape on a phone for the largest pitch. The selected
player has a gold marker; control never jumps to the ball owner or pass receiver.

Matches use the original physics, ball ownership, shooting, tackles, goalkeeper
AI, goals, halftime and set-piece restarts. The small-sided formation has five
slots, the pitch is 52 × 34 metres and there is no offside. The running clock is
three minutes of open play. Pause, replay and change-player controls are available.
Your last character choice is remembered; earlier career saves are left untouched.

The existing Match Simulator and other engine tools remain at their original
`html/` URLs. The former career modules remain in source as inactive legacy code;
the browser entry no longer loads or presents them.

```bash
npm run test:five
npm run test:manual-control
npm run test:formations
npm run test:substitutions
npm run test:bundle
```

Five-a-side rules and inputs live in `kernel/five/`. The browser interface is
`kernel/apps/soccer-rogue/app.js`, styled by `scss/rogue.scss`. The build emits
`build/rogue.bundle.js` and `build/rogue.css`. The original 11v11 entry is unchanged.
