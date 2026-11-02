import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const THEME_DIR = join(ROOT, 'theme');
export const CSS_DIR = join(THEME_DIR, 'css');
export const DIST_DIR = join(ROOT, 'dist');
export const CACHE_DIR = join(ROOT, '.cache');
export const FIXTURES_DIR = join(ROOT, 'preview', 'fixtures');
export const DOCS_DIR = join(ROOT, 'docs');

export function readThemeJson() {
  return JSON.parse(readFileSync(join(THEME_DIR, 'theme.json'), 'utf8'));
}

/** Load .env from the repo root if present (Node >= 21.7). */
export function loadEnv() {
  try {
    process.loadEnvFile(join(ROOT, '.env'));
  } catch {
    // no .env: fall back to the real environment
  }
}

/** Minimal --flag / --key value parser. Names in `booleans` never take a value. */
export function parseArgs(booleans = [], argv = process.argv.slice(2)) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      args._.push(a);
      continue;
    }
    const [key, inline] = a.slice(2).split('=', 2);
    if (inline !== undefined) args[key] = inline;
    else if (!booleans.includes(key) && argv[i + 1] && !argv[i + 1].startsWith('--')) args[key] = argv[++i];
    else args[key] = true;
  }
  return args;
}
