// Preview shell: picks a fixture, injects our CSS the way theme.json would,
// and re-injects on every theme/ change (Vite custom HMR event).
const $ = (id) => document.getElementById(id);
const els = { surface: $('surface'), version: $('version'), branch: $('branch'), themeOn: $('themeOn'), fit: $('fit') };
const frame = $('frame');
const state = { manifest: null, patches: {} };

const stored = (() => {
  try {
    return JSON.parse(localStorage.getItem('cs-preview') ?? '{}');
  } catch {
    return {};
  }
})();
const save = () => {
  try {
    localStorage.setItem(
      'cs-preview',
      JSON.stringify({ surface: els.surface.value, version: els.version.value, branch: els.branch.value, patches: state.patches }),
    );
  } catch {}
};

async function loadManifest() {
  state.manifest = await (await fetch('/__cs/manifest.json')).json();
  const { fixtures, theme } = state.manifest;
  $('empty').hidden = fixtures.length > 0;
  $('stage').hidden = fixtures.length === 0;
  els.surface.innerHTML = fixtures.map((f) => `<option>${f.surface}</option>`).join('');
  if (fixtures.some((f) => f.surface === stored.surface)) els.surface.value = stored.surface;
  fillVersions();
  if (stored.branch) els.branch.value = stored.branch;
  state.patches = { ...Object.fromEntries(Object.entries(theme.patches ?? {}).map(([n, p]) => [n, p.default])), ...stored.patches };
  renderPatches(theme.patches ?? {});
}

function fillVersions() {
  const f = state.manifest.fixtures.find((x) => x.surface === els.surface.value);
  els.version.innerHTML = (f?.versions ?? []).map((v) => `<option>${v}</option>`).join('');
  if (f?.versions.includes(stored.version)) els.version.value = stored.version;
}

function renderPatches(patches) {
  $('patches').innerHTML = '';
  for (const [name, patch] of Object.entries(patches)) {
    const label = document.createElement('label');
    label.textContent = name + ' ';
    const sel = document.createElement('select');
    sel.innerHTML = Object.keys(patch.values).map((v) => `<option>${v}</option>`).join('');
    sel.value = state.patches[name] in patch.values ? state.patches[name] : patch.default;
    sel.onchange = () => {
      state.patches[name] = sel.value;
      save();
      injectTheme();
    };
    label.append(sel);
    $('patches').append(label);
  }
}

/** Resolve inject entries for theme.inject + selected patch values. Tabs are ignored: one fixture = one tab. */
function activeInjects() {
  const { theme } = state.manifest;
  const entries = [theme.inject ?? {}];
  for (const [name, patch] of Object.entries(theme.patches ?? {})) {
    entries.push(patch.values[state.patches[name]] ?? {});
    for (const c of patch.components ?? []) if (c.on === state.patches[name]) entries.push({ [c.css_variable]: [c.default] });
  }
  const files = [];
  const vars = [];
  for (const inject of entries)
    for (const [key, val] of Object.entries(inject)) key.startsWith('--') ? vars.push(`${key}: ${val[0]};`) : files.push(key);
  return { files, vars };
}

function injectTheme() {
  const doc = frame.contentDocument;
  if (!doc?.head) return;
  doc.querySelectorAll('.css-loader-style').forEach((n) => n.remove());
  if (!els.themeOn.checked) return;
  const { files, vars } = activeInjects();
  const bust = Date.now();
  for (const f of files) {
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.className = 'css-loader-style';
    link.href = `/__cs/theme/${f}?branch=${els.branch.value}&t=${bust}`;
    doc.head.append(link);
  }
  if (vars.length) {
    const style = doc.createElement('style');
    style.className = 'css-loader-style';
    style.textContent = `:root { ${vars.join(' ')} }`;
    doc.head.append(style);
  }
  $('status').textContent = `injected ${files.length} file(s) · ${new Date().toLocaleTimeString()}`;
}

function loadFrame() {
  if (!els.version.value) return;
  frame.onload = injectTheme;
  frame.src = `/__cs/frame/${els.surface.value}/${els.version.value}`;
  save();
}

function fit() {
  const scale = els.fit.checked ? Math.min(1, (innerWidth - 32) / 1280, (innerHeight - 100) / 800) : 1;
  $('stage').style.zoom = scale;
}

els.surface.onchange = () => (fillVersions(), loadFrame());
els.version.onchange = loadFrame;
els.branch.onchange = () => (save(), injectTheme());
els.themeOn.onchange = injectTheme;
els.fit.onchange = fit;
addEventListener('resize', fit);

if (import.meta.hot) {
  import.meta.hot.on('cs:theme-changed', async ({ file }) => {
    if (file.endsWith('theme.json')) await loadManifest();
    injectTheme();
  });
  import.meta.hot.on('cs:fixtures-changed', async () => (await loadManifest(), loadFrame()));
}

await loadManifest();
fit();
loadFrame();
