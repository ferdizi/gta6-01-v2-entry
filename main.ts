// LAGUNA AZUL v2 — entry program for the make.fun gta6-01 bounty.
// Stages game/ and screenshots/ from this repository into the output
// directory (MAKEFUN_OUTPUT_DIR, default /output) and writes
// /output/dossier.json via buildDossier from vendor/makefun-game.ts.
// Run:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = resolve(import.meta.dirname);
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

const MAX_SHOT_BYTES = 262144;
const MAX_DOSSIER_BYTES = 1572864;

function abort(msg) {
  console.error('main.ts: ' + msg);
  process.exit(1);
}

function countTree(dir) {
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    n++;
    if (e.isDirectory()) n += countTree(join(dir, e.name));
  }
  return n;
}

function isShotFile(name) {
  return /\.(png|jpe?g)$/i.test(name);
}

/* ---- input validation ---- */
if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) abort('no game/ directory in ' + repoRoot);
if (!existsSync(join(gameDir, 'index.html'))) abort('game/index.html is missing');
for (const core of ['js/main.js', 'js/entities.js', 'js/world.js', 'js/hud.js', 'js/missions.js']) {
  if (!existsSync(join(gameDir, core))) abort('game/' + core + ' is missing');
}
if (!existsSync(shotsDir) || !statSync(shotsDir).isDirectory()) abort('no screenshots/ directory in ' + repoRoot);
const shotFiles = readdirSync(shotsDir).filter(isShotFile);
if (shotFiles.length < 3 || shotFiles.length > 4) {
  abort('screenshots/ must hold 3 or 4 images, found ' + shotFiles.length);
}
for (const f of shotFiles) {
  const size = statSync(join(shotsDir, f)).size;
  if (size > MAX_SHOT_BYTES) abort('screenshots/' + f + ' is ' + size + ' bytes, over the 256 KiB cap');
}

/* ---- staging ---- */
try {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  cpSync(gameDir, join(outDir, 'game'), { recursive: true });
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: MAX_SHOT_BYTES },
    game_max_files: 993,
    game_max_bytes: 50331648,
  });
  if (dossier.length > MAX_DOSSIER_BYTES) {
    abort('dossier.json is ' + dossier.length + ' bytes, over the 1.5 MiB cap');
  }
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  const dossierPath = join(outDir, 'dossier.json');
  if (!existsSync(dossierPath) || statSync(dossierPath).size !== dossier.length) {
    abort('dossier.json was not written correctly to ' + outDir);
  }
  const shotSizes = shotFiles.map((f) => f + ' ' + statSync(join(shotsDir, f)).size + 'B').join(', ');
  console.log('main.ts: wrote ' + outDir + ' — game/ ' + countTree(join(outDir, 'game')) +
    ' entries, screenshots/ ' + shotSizes + ', dossier.json ' + dossier.length + ' bytes');
} catch (err) {
  abort('build failed: ' + (err && err.message ? err.message : String(err)));
}
