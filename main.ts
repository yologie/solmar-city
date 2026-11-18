// Solmar City — the entry program for make.fun's "Make GTA 6" bounty (gta6-01).
//
// Solmar City is an original open-world crime game: a sun-soaked coastal city to explore on
// foot and by car, with traffic and pedestrians, cars to steal and drive, a wanted level and
// police who respond to it, missions and a story, combat, a HUD with a minimap, a start screen
// and a way to save. It is plain static files under game/ (game/index.html and its ES modules,
// no library and no network request) and this program hands it in: it copies game/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json, the summary
// the judge reads, with the vendored make.fun library.
//
// Run it with Node 22 (the bounty's node22 runtime) — `node main.ts` runs this TypeScript
// as-is, with no flags, no build and no install, standard library only:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output.
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Solmar City runs on Node 22: refuse to run under anything older, so a stale runtime can
// never silently hand in a half-built entry.
const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] ?? '', 10);
if (!Number.isInteger(nodeMajor) || nodeMajor < 22) {
  throw new Error(`Solmar City needs Node 22 or later, got Node ${process.versions.node}`);
}

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The game must be there to hand in: game/index.html is the entry point the browser opens,
// and without it there is no entry at all. (Checked before any copy, so a broken tree can
// never produce a dossier that claims a game exists.)
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error(`Solmar City game entry point is missing: ${join(here, 'game', 'index.html')}`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the
// others refuse an entry the scorer would refuse (more than 4 screenshots or one over 256 KiB;
// more than 993 files in game/ or 48 MiB of game files, in all, or a path under game/ over 1000
// bytes: game/ counts beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
