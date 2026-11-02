// Port of SDH-CssLoader's class translation (css_inject.py, Inject.load) so the
// preview and coverage see the same selectors CSS Loader injects on the Deck.
// See docs/class-translation.md.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE_DIR, parseArgs } from './paths.mjs';

const URLS = {
  stable: 'https://api.deckthemes.com/stable.json',
  beta: 'https://api.deckthemes.com/beta.json',
};
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const cachePath = (branch) => join(CACHE_DIR, `css_translations.${branch}.json`);

export async function fetchMappings(branch = 'stable', { refresh = false } = {}) {
  const file = cachePath(branch);
  const fresh = existsSync(file) && Date.now() - statSync(file).mtimeMs < MAX_AGE_MS;
  if (!refresh && fresh) return JSON.parse(readFileSync(file, 'utf8'));
  try {
    const res = await fetch(URLS[branch]);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(file, text);
    return JSON.parse(text);
  } catch (err) {
    if (existsSync(file)) {
      console.warn(`[translate] fetch failed (${err.message}); using cached ${file}`);
      return JSON.parse(readFileSync(file, 'utf8'));
    }
    throw new Error(`[translate] no mappings for ${branch}: ${err.message}`);
  }
}

/**
 * Same as initialize_class_mappings(): every older name in a uid's list maps to
 * the last (current) one. Also returns a reverse map current -> readable name.
 */
export function buildMaps(data) {
  const forward = new Map();
  const reverse = new Map();
  for (const names of Object.values(data)) {
    const latest = names[names.length - 1];
    for (const n of names.slice(0, -1)) forward.set(n, latest);
    // Prefer the hash-free "module_Name" form as the readable label.
    const readable =
      names.find((n) => /^[a-z0-9]+_[A-Za-z0-9-]+$/.test(n) && !/_[A-Za-z0-9-]{5}$/.test(n)) ??
      names.find((n) => /^[a-z]/i.test(n) && n !== latest) ??
      latest;
    reverse.set(latest, readable);
  }
  return { forward, reverse };
}

/** Mirrors the two regex passes in Inject.load(). */
export function translateCss(css, forward) {
  let out = css
    .split(/(\.[_a-zA-Z]+[_a-zA-Z0-9-]*)/)
    .map((p) => (p.startsWith('.') && forward.has(p.slice(1)) ? '.' + forward.get(p.slice(1)) : p))
    .join('');
  out = out
    .split(/(\[class[*^|~]="[_a-zA-Z0-9-]*"\])/)
    .map((p) =>
      p.startsWith('[class') && p.endsWith('"]') && forward.has(p.slice(9, -2))
        ? p.slice(0, 9) + forward.get(p.slice(9, -2)) + p.slice(-2)
        : p,
    )
    .join('');
  return out;
}

export async function loadTranslator(branch = 'stable', opts) {
  const maps = buildMaps(await fetchMappings(branch, opts));
  return { ...maps, translate: (css) => translateCss(css, maps.forward) };
}

// CLI: node tools/lib/translate.mjs [--refresh] [--beta] [selector-or-class ...]
if (import.meta.main) {
  const args = parseArgs(['refresh', 'beta']);
  const branch = args.beta ? 'beta' : 'stable';
  const { forward, reverse, translate } = await loadTranslator(branch, { refresh: !!args.refresh });
  console.log(`${branch}: ${forward.size} legacy names -> ${reverse.size} current classes`);
  for (const q of args._) {
    const sel = q.startsWith('.') || q.includes('[') ? q : '.' + q;
    const t = translate(sel);
    const back = reverse.get(t.replace(/^\./, ''));
    console.log(`${sel}\n  -> ${t}${t === sel ? '  (unchanged)' : ''}${back ? `\n  readable: ${back}` : ''}`);
  }
}
