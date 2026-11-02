// Builds the flat CSS files that theme.json `inject` points at.
// CSS Loader injects each file as-is, so we never rely on @import (unverified there).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CSS_DIR } from './paths.mjs';

const cssFilesIn = (dir) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.css'))
        .sort()
        .map((f) => join(dir, f))
    : [];

/** Source files concatenated into shared.css, in cascade order. */
export function sharedSources() {
  return [
    join(CSS_DIR, 'tokens.css'),
    join(CSS_DIR, 'base.css'),
    ...cssFilesIn(join(CSS_DIR, 'components')),
    ...cssFilesIn(join(CSS_DIR, 'surfaces')),
    // Unchanged upstream CSS. Removed once milestone step 4 splits it.
    join(CSS_DIR, 'legacy-shared.css'),
  ].filter(existsSync);
}

const concat = (files) =>
  files
    .map((f) => `/* --- ${relative(CSS_DIR, f)} --- */\n${readFileSync(f, 'utf8').trim()}\n`)
    .join('\n');

/**
 * Returns { outputPath: { css, sources } } relative to the theme root,
 * e.g. "shared.css" and "patches/font-system.css".
 */
export function buildBundles() {
  const out = {};
  const shared = sharedSources();
  out['shared.css'] = { css: concat(shared), sources: shared };
  for (const f of cssFilesIn(join(CSS_DIR, 'patches'))) {
    out[`patches/${relative(join(CSS_DIR, 'patches'), f)}`] = { css: concat([f]), sources: [f] };
  }
  return out;
}
