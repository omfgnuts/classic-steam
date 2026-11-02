// Dump a Steam UI surface from the Deck's CEF debugger into preview/fixtures/.
//
//   npm run capture -- --list                         list CEF tabs
//   npm run capture -- --surface library              capture the Big Picture tab
//   npm run capture -- --surface qam --tab "QuickAccess.*"
//
// Writes preview/fixtures/<surface>/<steam-version>.{html,steam.css,png,json}.
// Open the surface on the Deck first. Review the HTML for personal data before committing.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { connect, getVersion, listTargets } from './lib/cdp.mjs';
import { FIXTURES_DIR, ROOT, loadEnv, parseArgs } from './lib/paths.mjs';

loadEnv();
const args = parseArgs(['list', 'no-screenshot', 'keep-theme']);
const host = args.host ?? process.env.DECK_HOST;
const port = Number(args.port ?? process.env.DECK_CEF_PORT ?? 8081);
if (!host) {
  console.error('Set DECK_HOST in .env or pass --host <ip>');
  process.exit(1);
}

const targets = await listTargets(host, port).catch((e) => {
  console.error(`${e.message}\nIs "Allow Remote CEF Debugging" on in Decky settings, and is ${host}:${port} reachable?`);
  process.exit(1);
});

if (args.list || !args.surface) {
  for (const t of targets) console.log(`${t.title.padEnd(40)} ${t.url}`);
  if (!args.surface) console.log('\nPass --surface <name> [--tab <title regex> | --url <substring>] to capture.');
  process.exit(0);
}

// Default target = CSS Loader's "bigpicture" shorthand (URL match).
const byUrl = args.url ?? (args.tab ? null : 'Valve Steam Gamepad');
const target = targets.find((t) =>
  byUrl ? decodeURIComponent(t.url).includes(byUrl) : new RegExp(`^(${args.tab})$`).test(t.title),
);
if (!target) {
  console.error(`no tab matches ${byUrl ? `url ~${byUrl}~` : `title /${args.tab}/`}; try --list`);
  process.exit(1);
}

const scrub = (process.env.SCRUB_STRINGS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const cdp = await connect(target.webSocketDebuggerUrl);

// Runs in the page: mark visible elements and collect Steam's stylesheets
// (minus CSS Loader's, unless --keep-theme) so the preview looks right.
const snapshot = await cdp.evaluate(`(async () => {
  const doc = document.documentElement.cloneNode(true);
  const live = document.documentElement.querySelectorAll('*');
  const copy = doc.querySelectorAll('*');
  live.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0)
      copy[i].setAttribute('data-cs-visible', '');
  });
  doc.querySelectorAll('script, noscript').forEach((n) => n.remove());
  const sheets = [];
  for (const s of document.styleSheets) {
    const owner = s.ownerNode;
    // CSS Loader tags its <style> elements with .css-loader-style (css_browserhook.py)
    if (!${!!args['keep-theme']} && owner?.classList?.contains('css-loader-style')) continue;
    try { sheets.push('/* ' + (s.href || 'inline') + ' */\\n' + [...s.cssRules].map((r) => r.cssText).join('\\n')); }
    catch (e) { sheets.push('/* unreadable: ' + s.href + ' */'); }
  }
  doc.querySelectorAll('link[rel=stylesheet], style').forEach((n) => n.remove());
  let steam = null;
  try { steam = await SteamClient.System.GetSystemInfo(); } catch (e) {}
  return {
    html: '<!doctype html>\\n' + doc.outerHTML,
    css: sheets.join('\\n\\n'),
    userAgent: navigator.userAgent,
    viewport: [innerWidth, innerHeight],
    htmlClasses: document.documentElement.className,
    steam,
  };
})()`);

let html = snapshot.html;
for (const s of scrub) html = html.split(s).join('Player');
// Avatars and profile images are personal; keep layout, drop the image.
html = html.replace(/(src|srcset)="https:\/\/[^"]*(avatars|steamusercontent|steamuserimages)[^"]*"/g, '$1=""');

const v = await getVersion(host, port);
const chromium = (snapshot.userAgent.match(/Chrome\/([\d.]+)/) ?? [])[1] ?? 'unknown';
const steamVersion =
  args.version ??
  snapshot.steam?.sSteamBuildDate?.replace(/[^\w.-]+/g, '-') ??
  String(snapshot.steam?.nSteamVersion ?? 'unknown');
const outDir = join(FIXTURES_DIR, args.surface);
mkdirSync(outDir, { recursive: true });
const base = join(outDir, steamVersion);

writeFileSync(`${base}.html`, html);
writeFileSync(`${base}.steam.css`, snapshot.css);
writeFileSync(
  `${base}.json`,
  JSON.stringify(
    {
      surface: args.surface,
      capturedAt: new Date().toISOString(),
      tab: { title: target.title, url: target.url },
      htmlClasses: snapshot.htmlClasses,
      viewport: snapshot.viewport,
      chromium,
      browser: v.Browser,
      steam: snapshot.steam && {
        version: snapshot.steam.nSteamVersion,
        buildDate: snapshot.steam.sSteamBuildDate,
        os: snapshot.steam.sOSName,
        osBuild: snapshot.steam.sOSBuildId,
        kernel: snapshot.steam.sKernelVersion,
      },
    },
    null,
    2,
  ) + '\n',
);
if (!args['no-screenshot']) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${base}.png`, Buffer.from(data, 'base64'));
}
cdp.close();

console.log(`captured "${target.title}" -> ${relative(ROOT, base)}.*`);
console.log(`Chromium ${chromium}; Steam ${snapshot.steam?.nSteamVersion ?? '?'} (${snapshot.steam?.sOSName ?? '?'} ${snapshot.steam?.sOSBuildId ?? ''})`);
console.log('Review the .html for names/personal data before committing.');
