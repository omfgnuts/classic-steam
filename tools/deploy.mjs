// Build, then rsync dist/<ThemeName>/ to the Deck / Steam Machine over SSH.
// --watch rebuilds and re-syncs on every change under theme/; CSS Loader's
// live reload (WATCH file or "Live CSS Editing") picks it up on device.
import { spawnSync } from 'node:child_process';
import { watch } from 'node:fs';
import { build } from './build.mjs';
import { THEME_DIR, loadEnv, parseArgs } from './lib/paths.mjs';

loadEnv();
const args = parseArgs(['watch', 'dry-run']);
const host = args.host ?? process.env.DECK_HOST;
const user = process.env.DECK_USER ?? 'deck';
const themesDir = process.env.DECK_THEMES_DIR ?? '/home/deck/homebrew/themes';

if (!host) {
  console.error('Set DECK_HOST in .env (see .env.example) or pass --host <ip>');
  process.exit(1);
}

function deploy() {
  const { theme, outDir } = build();
  const dest = `${user}@${host}:${themesDir}/${theme.name}/`;
  const rsync = ['-az', '--delete', '--exclude', 'config_*.json', ...(args['dry-run'] ? ['-n', '-v'] : []), `${outDir}/`, dest];
  const res = spawnSync('rsync', rsync, { stdio: 'inherit' });
  if (res.status === 0) console.log(`${new Date().toLocaleTimeString()} deployed -> ${dest}`);
  else console.error(`rsync failed (${res.status}). Check SSH access: ssh ${user}@${host}`);
  return res.status;
}

const status = deploy();
if (!args.watch) process.exit(status);

let timer;
watch(THEME_DIR, { recursive: true }, () => {
  clearTimeout(timer);
  timer = setTimeout(deploy, 150);
});
console.log('watching theme/ ... (Ctrl+C to stop)');
