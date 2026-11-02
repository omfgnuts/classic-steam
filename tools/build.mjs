// theme/ -> dist/<ThemeName>/ (flat CSS, untranslated so CSS Loader's own
// translator keeps it alive on device). --zip also writes
// dist/<ThemeName>-<version>.zip with theme.json at the zip root.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { zipSync } from 'fflate';
import { buildBundles } from './lib/bundle.mjs';
import { DIST_DIR, ROOT, THEME_DIR, parseArgs, readThemeJson } from './lib/paths.mjs';

// Optional theme-root files CSS Loader reads (see docs/class-translation.md).
const EXTRA_FILES = ['PRIORITY'];

export function build() {
  const theme = readThemeJson();
  const outDir = join(DIST_DIR, theme.name);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  for (const [path, { css }] of Object.entries(buildBundles())) {
    mkdirSync(dirname(join(outDir, path)), { recursive: true });
    writeFileSync(join(outDir, path), css);
  }
  writeFileSync(join(outDir, 'theme.json'), JSON.stringify(theme, null, 2) + '\n');
  cpSync(join(ROOT, 'LICENSE'), join(outDir, 'LICENSE'));
  if (existsSync(join(THEME_DIR, 'assets'))) {
    cpSync(join(THEME_DIR, 'assets'), join(outDir, 'assets'), {
      recursive: true,
      filter: (src) => !src.endsWith('.gitkeep'),
    });
  }
  for (const f of EXTRA_FILES) {
    if (existsSync(join(THEME_DIR, f))) cpSync(join(THEME_DIR, f), join(outDir, f));
  }
  return { theme, outDir };
}

function listFiles(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
}

export function zip(theme, outDir) {
  const entries = {};
  for (const f of listFiles(outDir)) entries[relative(outDir, f)] = readFileSync(f);
  const zipPath = join(DIST_DIR, `${theme.name}-${theme.version}.zip`);
  writeFileSync(zipPath, zipSync(entries, { level: 9 }));
  return zipPath;
}

if (import.meta.main) {
  const args = parseArgs(['zip']);
  const { theme, outDir } = build();
  console.log(`built ${relative(ROOT, outDir)}/`);
  if (args.zip) console.log(`zipped ${relative(ROOT, zip(theme, outDir))}`);
}
