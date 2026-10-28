# Validation

Performed in the cloud workspace using Node 24 and installed Chromium with software WebGL.

- Cached frozen dependency installation (`npm ci --offline --cache /workspace/.npm-cache`) succeeded.
- Production build and TypeScript check succeeded (`npm run build`). Vite reports large vendor chunks: Rapier contains its embedded WASM. Total output is approximately 4.8 MB before HTTP compression.
- 20 unit tests passed across three files: full five-level state paths to both endings, question validation, puzzle prerequisites, rewards, shop and inventory constraints, save validation, death/retry, enemy transitions, pathfinding/line of sight, and event pacing.
- Chromium rendered the title and basement and launched gameplay.
- Browser completion check passed through all five floors using native E/raycast interactions, puzzle UI, question choices, shop purchases, save reload, and both endings.
- Browser controls check passed keyboard movement, wall collision, locked exits, inventory, death, and retry.
- Browser settings check passed key rebinding persistence, locked chapters, and corrupted-save recovery. All three browser tests passed in 3.8 minutes using one worker and Low graphics.
- After the browser run, the navigation callback was tightened to reject positions outside level bounds; the final production build type-checks this correction.

The completion test uses development-only teleportation to approach objects and fast-forwards hunt timers. Enemy pursuit logic is covered by unit tests; an uninterrupted manual playthrough of every hunt has not been performed. Software WebGL results do not establish gaming-PC frame rates. High-preset visual effects and audio output have not been manually evaluated across browser/device combinations.

No publication, external deployment, or fresh-task snapshot restoration is claimed. Runtime requires a local HTTP server; opening index.html directly via a file URL is unsupported. Source changes have not been pushed to GitHub.
