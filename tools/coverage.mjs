// Match our selectors (after CSS Loader's translation) against captured
// fixtures. Writes docs/coverage.generated.md; docs/coverage.md stays curated.
//
//   npm run coverage                 latest fixture per surface
//   npm run coverage -- --all        every fixture
//   npm run coverage -- --beta       use beta translations
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import postcss from 'postcss';
import { buildBundles } from './lib/bundle.mjs';
import { DOCS_DIR, FIXTURES_DIR, ROOT, parseArgs } from './lib/paths.mjs';
import { loadTranslator } from './lib/translate.mjs';

const args = parseArgs(['all', 'beta']);
const branch = args.beta ? 'beta' : 'stable';
const { forward, reverse, translate } = await loadTranslator(branch);

// --- fixtures ------------------------------------------------------------
const fixtures = [];
if (existsSync(FIXTURES_DIR)) {
  for (const surface of readdirSync(FIXTURES_DIR, { withFileTypes: true })) {
    // _-prefixed folders are handmade smoke tests, not Steam captures.
    if (!surface.isDirectory() || surface.name.startsWith('_')) continue;
    const files = readdirSync(join(FIXTURES_DIR, surface.name)).filter((f) => f.endsWith('.html')).sort();
    for (const f of args.all ? files : files.slice(-1)) {
      const path = join(FIXTURES_DIR, surface.name, f);
      const dom = new JSDOM(readFileSync(path, 'utf8'), { virtualConsole: new VirtualConsole() });
      fixtures.push({ surface: surface.name, file: relative(ROOT, path), doc: dom.window.document });
    }
  }
}

// --- selectors -----------------------------------------------------------
// State-dependent pseudos can't match a static DOM, so drop them before matching.
const STATE_PSEUDO =
  /::?(hover|focus|focus-visible|focus-within|active|visited|checked|disabled|before|after|placeholder|selection|marker|-webkit-[\w-]+)(\([^)]*\))?/g;
const staticSelector = (sel) => sel.replace(STATE_PSEUDO, '').trim() || '*';
const classesIn = (sel) => [...sel.matchAll(/\.([_a-zA-Z][_a-zA-Z0-9-]*)/g)].map((m) => m[1]);
// Steam's hashed classes: legacy "module_Name_hash" or current "_hash" forms.
const isHashed = (c) => /^[a-z0-9]+_[A-Za-z0-9-]+_[A-Za-z0-9-]{5}$/.test(c) || /^_[A-Za-z0-9_-]{15,}$/.test(c);

const rows = [];
for (const [bundle, { css }] of Object.entries(buildBundles())) {
  postcss.parse(css).walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
    for (const original of rule.selectors) {
      const translated = translate(original);
      const unknown = classesIn(original).filter((c) => isHashed(c) && !forward.has(c) && !reverse.has(c));
      const hits = [];
      let error = null;
      for (const fx of fixtures) {
        try {
          const n = fx.doc.querySelectorAll(staticSelector(translated)).length;
          if (n) hits.push(`${fx.surface} (${n})`);
        } catch (e) {
          error = e.message.split('\n')[0];
        }
      }
      const status = error
        ? 'error'
        : hits.length
          ? translated === original ? 'matching' : 'translated'
          : 'dead';
      rows.push({ bundle, original, translated, status, hits, unknown, error });
    }
  });
}

// --- unthemed classes per fixture ---------------------------------------
const ourClasses = new Set(rows.flatMap((r) => classesIn(r.translated)));
const unthemed = fixtures.map((fx) => {
  const counts = new Map();
  for (const el of fx.doc.querySelectorAll('[data-cs-visible][class]')) {
    for (const c of el.classList) if (!ourClasses.has(c)) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 40);
  return { ...fx, total: counts.size, top };
});

// --- report --------------------------------------------------------------
const tally = rows.reduce((t, r) => ((t[r.status] = (t[r.status] ?? 0) + 1), t), {});
const esc = (s) => s.replace(/\|/g, '\\|');
let md = `# Coverage report (generated)\n\n`;
md += `Generated ${new Date().toISOString()} by \`npm run coverage\` with **${branch}** translations.\n`;
md += `Do not edit by hand; curate results into [coverage.md](coverage.md).\n\n`;
md += `Fixtures: ${fixtures.length ? fixtures.map((f) => `\`${f.file}\``).join(', ') : '_none captured yet. Run `npm run capture`._'}\n\n`;
md += `**${rows.length} selectors**: ${Object.entries(tally).map(([k, v]) => `${v} ${k}`).join(', ')}\n\n`;
md += `- **matching**: matches as written. **translated**: matches only after CSS Loader's class translation.\n`;
md += `- **dead**: matches no captured fixture. It may still be alive on a surface we haven't captured.\n`;
md += `- **unknown to translator**: hashed classes that are not in the mapping at all. These are truly gone.\n\n`;
md += `| status | selector (as written) | matches | unknown to translator |\n|---|---|---|---|\n`;
const order = { error: 0, dead: 1, translated: 2, matching: 3 };
for (const r of [...rows].sort((a, b) => order[a.status] - order[b.status])) {
  md += `| ${r.status} | \`${esc(r.original)}\` | ${r.error ? esc(r.error) : r.hits.join(', ') || '–'} | ${r.unknown.map((c) => `\`${c}\``).join(' ') || '–'} |\n`;
}
for (const u of unthemed) {
  md += `\n## Unthemed visible classes: ${u.surface}\n\n\`${u.file}\`: ${u.total} classes on visible elements that none of our selectors use (top 40 by element count).\n\n`;
  md += `| class | readable name | elements |\n|---|---|---|\n`;
  for (const [c, n] of u.top) md += `| \`${c}\` | ${reverse.has(c) && reverse.get(c) !== c ? `\`${reverse.get(c)}\`` : '–'} | ${n} |\n`;
}
writeFileSync(join(DOCS_DIR, 'coverage.generated.md'), md);
console.log(`${rows.length} selectors: ${JSON.stringify(tally)} across ${fixtures.length} fixture(s)`);
console.log(`wrote ${relative(ROOT, join(DOCS_DIR, 'coverage.generated.md'))}`);
