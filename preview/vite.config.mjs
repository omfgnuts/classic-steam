// Local preview: serves captured fixtures with Steam's CSS plus our bundles,
// translated exactly like CSS Loader does on device. Hot-reloads theme/ edits.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vite';
import { buildBundles } from '../tools/lib/bundle.mjs';
import { FIXTURES_DIR, ROOT, THEME_DIR, readThemeJson } from '../tools/lib/paths.mjs';
import { loadTranslator } from '../tools/lib/translate.mjs';

function listFixtures() {
  if (!existsSync(FIXTURES_DIR)) return [];
  return readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({
      surface: d.name,
      versions: readdirSync(join(FIXTURES_DIR, d.name))
        .filter((f) => f.endsWith('.html'))
        .map((f) => f.slice(0, -5))
        .sort()
        .reverse(),
    }))
    .filter((s) => s.versions.length);
}

function classicSteamPreview() {
  const translators = {};
  const translator = (branch) => (translators[branch] ??= loadTranslator(branch));

  return {
    name: 'classic-steam-preview',
    configureServer(server) {
      server.watcher.add(THEME_DIR);
      server.watcher.on('all', (_event, file) => {
        if (file.startsWith(THEME_DIR)) server.ws.send({ type: 'custom', event: 'cs:theme-changed', data: { file } });
        if (file.startsWith(FIXTURES_DIR)) server.ws.send({ type: 'custom', event: 'cs:fixtures-changed' });
      });

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://x');
        try {
          if (url.pathname === '/__cs/manifest.json') {
            res.setHeader('content-type', 'application/json');
            return res.end(JSON.stringify({ theme: readThemeJson(), fixtures: listFixtures() }));
          }
          // Built bundle, translated: /__cs/theme/shared.css?branch=stable
          if (url.pathname.startsWith('/__cs/theme/')) {
            const path = decodeURIComponent(url.pathname.slice('/__cs/theme/'.length));
            const bundles = buildBundles();
            let css;
            if (bundles[path]) css = bundles[path].css;
            else if (existsSync(join(THEME_DIR, path)) && path.endsWith('.css')) css = readFileSync(join(THEME_DIR, path), 'utf8');
            else return next();
            const { translate } = await translator(url.searchParams.get('branch') ?? 'stable');
            res.setHeader('content-type', 'text/css');
            // CSS Loader serves theme assets at /themes_custom/<name>/; map that to theme/.
            return res.end(translate(css).replaceAll(`/themes_custom/${readThemeJson().name}/`, '/__cs/assets/'));
          }
          if (url.pathname.startsWith('/__cs/assets/')) {
            const file = join(THEME_DIR, 'assets', decodeURIComponent(url.pathname.slice('/__cs/assets/'.length)));
            if (!file.startsWith(join(THEME_DIR, 'assets')) || !existsSync(file)) return next();
            return res.end(readFileSync(file));
          }
          // Fixture document for the iframe: /__cs/frame/<surface>/<version>
          const m = url.pathname.match(/^\/__cs\/frame\/([\w.-]+)\/([\w.-]+)$/);
          if (m) {
            const base = join(FIXTURES_DIR, m[1], m[2]);
            if (!base.startsWith(FIXTURES_DIR) || !existsSync(`${base}.html`)) return next();
            let html = readFileSync(`${base}.html`, 'utf8').replace(/<script[\s\S]*?<\/script>/gi, '');
            const steamCss = existsSync(`${base}.steam.css`) ? `<link rel="stylesheet" href="/__cs/steamcss/${m[1]}/${m[2]}">` : '';
            const head = `<base href="/__cs/missing/">${steamCss}<style>html,body{overflow:hidden}</style>`;
            html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (h) => h + head) : head + html;
            res.setHeader('content-type', 'text/html');
            return res.end(html);
          }
          const s = url.pathname.match(/^\/__cs\/steamcss\/([\w.-]+)\/([\w.-]+)$/);
          if (s) {
            const file = join(FIXTURES_DIR, s[1], `${s[2]}.steam.css`);
            if (!file.startsWith(FIXTURES_DIR) || !existsSync(file)) return next();
            res.setHeader('content-type', 'text/css');
            return res.end(readFileSync(file));
          }
          // Steam's relative assets (fonts, images) aren't captured; answer 204 quietly.
          if (url.pathname.startsWith('/__cs/missing/')) {
            res.statusCode = 204;
            return res.end();
          }
        } catch (err) {
          res.statusCode = 500;
          return res.end(String(err.stack ?? err));
        }
        next();
      });
    },
  };
}

export default defineConfig({
  root: join(ROOT, 'preview'),
  server: { port: 5280, fs: { allow: [ROOT] } },
  plugins: [classicSteamPreview()],
});
