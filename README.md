# The Candleman: Descent

A playable first-person browser horror game with five underground floors, procedural environments and audio, Rapier collision, an offline question bank, puzzles, enemy pursuit, a shop, persistent progression, and two endings.

## Run

Requires Node.js 22.12+ (validated with Node 24) and a desktop browser with WebGL2, keyboard, and mouse.

```sh
npm ci --cache /workspace/.npm-cache
npm run dev
```

Open the address printed by Vite in your browser. Click **Begin the descent**, then click the world to capture the mouse if needed. Escape releases the mouse and pauses. No API keys or runtime asset services are needed. The application runs offline when served locally; initial dependency installation requires registry access.

```sh
npm run build       # TypeScript validation and production dist/
npm run preview     # Serve the production build
npm test            # Model, enemy navigation, and director tests
npm run test:browser -- --workers=1
```

The browser tests use `/usr/bin/chromium`. Set `CHROMIUM_PATH` for another installed Chromium executable. They use Low graphics and one worker to reduce resource usage. Development-only test hooks are removed from production builds.

## Play

| Input | Action |
|---|---|
| WASD / mouse | Move / look |
| Shift / Ctrl | Sprint / crouch |
| E | Interact with the object under the crosshair |
| F | Toggle flashlight after finding it |
| Tab / J | Inventory and collected clues / objectives |
| Escape | Pause and release mouse |

Keys and sensitivity are configurable in Settings. Separate master, music, ambience, and effects volume sliders are available. Low reduces rendering cost; High enables flashlight shadows and a nearby planar mirror reflection. A graphics preset is not a verified frame-rate guarantee.

Explore each floor, read its notes, collect required objects, solve its mechanisms, survive any required hunt, and answer the voice at the questioning circle. The exit is sealed until every requirement is complete. Sprinting attracts attention. A sheltered alcove hides you while you remain still with the flashlight off. Flashlight charge regenerates when off. Health and stamina recover between floors.

Coins reward discoveries, puzzles, questions, and floor completion. Spend them between floors on battery endurance, stamina, sanity protection, an extra consumable pocket, revival, or a hint. Quest items have their own satchel and cannot fill your consumable pockets.

Progress auto-saves to this browser after interactions and periodically during play. Continue resumes at the current floor's entrance with discoveries and mechanisms preserved. Death allows a retry; unfinished required hunts restart. Chapters only exposes unlocked floors. Four hidden photographs across floors 1–4 unlock the true ending when the final journal is found.

For puzzle solutions, see [the spoiler walkthrough](docs/WALKTHROUGH.md).

## Implementation

- `src/rendering/world.ts`: procedural geometry/materials, lights, particles, mirrors, hands, interactable rendering.
- `src/physics/controller.ts`: Rapier capsule collision and movement.
- `src/enemies/candleman.ts`: seven-state enemy, hearing, line of sight, grid navigation.
- `src/core/model.ts`: pure gameplay state, prerequisites, economy, saves, retry, endings.
- `src/core/director.ts`: paced supernatural events.
- `src/data/`: five floor definitions and 30 questions.
- `src/audio/audio.ts`: synthesized ambience and positional effects.
- `src/ui/`: settings and cinematic interface styles; `src/main.ts` connects gameplay to the interface and frame loop.
- `src/tests/` and `e2e/`: automated logic and browser checks.

Save data is versioned and validated. Reward ledgers prevent ordinary replay and reload duplication. Local saves are editable by their owner; offline storage is not a tamper-proof economy. Clearing browser storage deletes progress. No analytics or server accounts are used.

## Scope and validation

This is a compact procedural indie game, with stylized geometry and synthesized sound rather than licensed photorealistic art or recorded voices. It has no SSAO pass and no certified 60 FPS benchmark. Browser tests use teleportation to reach interaction points and fast-forward mandatory hunt timers; these are functional completion checks, not an uninterrupted manual playthrough. See [validation notes](docs/VALIDATION.md) for actual results and limits.

Code and original procedural content: MIT. Third-party packages retain their own licenses (Three.js: MIT; Rapier: Apache-2.0).
