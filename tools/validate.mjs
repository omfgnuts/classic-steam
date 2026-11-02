// theme.json schema + referenced files exist + --cs- prefix + !important budget
// + size limit. Exit code 1 on errors; warnings never fail.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import Ajv from 'ajv';
import postcss from 'postcss';
import { buildBundles } from './lib/bundle.mjs';
import { CSS_DIR, ROOT, THEME_DIR, readThemeJson } from './lib/paths.mjs';

const MAX_BYTES = 10 * 1024 * 1024; // DeckThemes limit
const IMPORTANT_BUDGET = 150; // per non-legacy file; tighten as the split lands
// Files that are allowed to break style rules until milestone step 4.
const LEGACY = new Set(['legacy-shared.css']);
// Steam's own custom properties we may override (not ours, so no --cs- prefix).
const STEAM_VARS = new Set(['--left-track-color']);

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const theme = readThemeJson();

// 1. Schema
const schema = JSON.parse(readFileSync(join(ROOT, 'tools', 'theme.schema.json'), 'utf8'));
const ajv = new Ajv({ allErrors: true });
if (!ajv.validate(schema, theme)) {
  for (const e of ajv.errors) err(`theme.json${e.instancePath} ${e.message}`);
}
if (theme.id) warn('theme.json has "id": store-assigned ids should not be in a fork');

// 2. Referenced files exist (as bundle outputs or files under theme/)
const bundles = buildBundles();
const exists = (p) => p in bundles || existsSync(join(THEME_DIR, p));
const checkInject = (inject, where) => {
  for (const key of Object.keys(inject ?? {})) {
    if (key.startsWith('--')) {
      if (!key.startsWith('--cs-')) err(`${where}: injected variable ${key} must use the --cs- prefix`);
    } else if (!exists(key)) err(`${where}: "${key}" is neither a built bundle nor a file in theme/`);
  }
};
checkInject(theme.inject, 'inject');
for (const [name, patch] of Object.entries(theme.patches ?? {})) {
  for (const [value, inject] of Object.entries(patch.values ?? {})) checkInject(inject, `patches.${name}.${value}`);
  if (patch.type === 'checkbox' && !('Yes' in patch.values && 'No' in patch.values))
    err(`patches.${name}: checkbox values must be "Yes"/"No" (CSS Loader falls back to dropdown)`);
  for (const c of patch.components ?? []) {
    if (!c.css_variable.startsWith('--cs-')) err(`patches.${name}.${c.name}: css_variable must use --cs-`);
  }
}
const tabNames = Object.keys(theme.tabs ?? {});
if (tabNames.length && !tabNames.includes('default')) warn('tabs has no "default" mapping');
if (Object.values(theme.inject ?? {}).flat().includes('SP')) warn('inject uses legacy tab "SP"; use bigpicture');

// 3. CSS rules
const sourceFiles = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sourceFiles(p) : p.endsWith('.css') ? [p] : [];
  });
let importantTotal = 0;
for (const file of sourceFiles(CSS_DIR)) {
  const rel = relative(CSS_DIR, file);
  const legacy = LEGACY.has(basename(file));
  const report = legacy ? warn : err;
  let root;
  try {
    root = postcss.parse(readFileSync(file, 'utf8'), { from: file });
  } catch (e) {
    err(`${rel}: parse error ${e.message}`);
    continue;
  }
  let important = 0;
  root.walkAtRules('import', (r) => report(`${rel}:${r.source.start.line} @import is not verified to work in CSS Loader`));
  root.walkDecls((d) => {
    const at = `${rel}:${d.source.start.line}`;
    if (d.important) important++;
    if (d.prop.startsWith('--') && !d.prop.startsWith('--cs-') && !STEAM_VARS.has(d.prop))
      report(`${at} custom property ${d.prop} lacks the --cs- prefix`);
    if (/^background-image$/.test(d.prop) && /^var\(|^#/.test(d.value)) report(`${at} background-image with a color value`);
    if (/^background-color$/.test(d.prop) && d.value === 'none') report(`${at} background-color: none is invalid`);
    if (!legacy && rel !== 'tokens.css' && /#[0-9a-f]{3,8}\b/i.test(d.value) && !d.prop.startsWith('--'))
      err(`${at} raw hex in a component; use a --cs- token`);
  });
  root.walkAtRules(/keyframes$/, (r) => {
    if (/_[A-Za-z0-9-]{5}$/.test(r.params)) report(`${rel}:${r.source.start.line} @keyframes ${r.params} overrides a hashed Steam name (not translated)`);
  });
  importantTotal += important;
  if (!legacy && important > IMPORTANT_BUDGET) err(`${rel}: ${important} !important (budget ${IMPORTANT_BUDGET})`);
}

// 4. Size
const bytes = Object.values(bundles).reduce((n, b) => n + Buffer.byteLength(b.css), 0) +
  (existsSync(join(THEME_DIR, 'assets')) ? dirSize(join(THEME_DIR, 'assets')) : 0);
function dirSize(dir) {
  return readdirSync(dir).reduce((n, f) => {
    const p = join(dir, f);
    return n + (statSync(p).isDirectory() ? dirSize(p) : statSync(p).size);
  }, 0);
}
if (bytes > MAX_BYTES) err(`theme is ${(bytes / 1e6).toFixed(1)} MB (limit 10 MB)`);

// 5. Submission rules not yet met
const patchNames = Object.keys(theme.patches ?? {}).map((n) => n.toLowerCase());
if (!patchNames.some((n) => n.includes('keyboard'))) warn('no keyboard toggle patch yet (required for System-Wide on DeckThemes)');

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);
console.log(`\n${errors.length} errors, ${warnings.length} warnings, ${importantTotal} !important, ${(bytes / 1024).toFixed(1)} KB`);
process.exit(errors.length ? 1 : 0);
