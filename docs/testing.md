# Testing & dev loop

## One-time setup on the Deck / Steam Machine

1. Install Decky Loader. The latest release is v3.3.1 (2026-10-27): <https://github.com/SteamDeckHomebrew/decky-loader/releases>.
2. Install CSS Loader from the Decky store.
3. Decky settings → Developer mode on → **Allow Remote CEF Debugging** on.
4. Desktop Mode → Konsole:

   ```bash
   passwd                          # if you never set one
   sudo systemctl enable --now sshd
   ip -4 addr show | grep inet     # note the LAN IP
   ```
5. Back on your Mac:

   ```bash
   cp .env.example .env            # set DECK_HOST to that IP
   ssh-copy-id deck@<DECK_IP>
   ```
6. Enable live reload. Either turn on CSS Loader → Settings → **Live CSS Editing**, or run:

   ```bash
   ssh deck@<DECK_IP> touch ~/homebrew/themes/WATCH
   ```

## Daily loop

| goal | command |
|---|---|
| Local preview at 1280×800 with hot reload | `npm run dev` |
| Push the theme to the device; CSS Loader reloads it | `npm run deploy:watch` |
| List CEF tabs | `npm run capture -- --list` |
| Capture the surface open on the device | `npm run capture -- --surface library` |
| Selector report → `docs/coverage.generated.md` | `npm run coverage` |
| Checks before commit | `npm run validate` |
| Release zip in `dist/` | `npm run zip` |

The first time, enable the theme in the QAM → CSS Loader after the first deploy.

To inspect the live DOM, open `chrome://inspect` → Configure → `<DECK_IP>:8081`.

## Capturing fixtures

- The default target is the Big Picture tab, which CSS Loader matches by the URL `Valve Steam Gamepad/default`.
- For the QAM and the Main Menu, open the menu on the device first, then run one of:

  ```bash
  npm run capture -- --surface qam --tab "QuickAccess.*"
  npm run capture -- --surface mainmenu --tab "MainMenu.*"
  ```
- Output goes to `preview/fixtures/<surface>/<steam-build>.{html,steam.css,png,json}`:
  - `.json` records the Steam build, the SteamOS build and the **Chromium version**.
  - Visible elements are tagged `data-cs-visible`, which coverage uses to find unthemed elements.
- Personal data:
  - Put your persona name and friends' names in `SCRUB_STRINGS`.
  - Avatar URLs are blanked automatically.
  - **Read the HTML before committing.**
- Our own CSS Loader styles (`.css-loader-style`) are left out of `.steam.css`. Add `--keep-theme` to include them.
- `preview/fixtures/_smoke/` holds handmade fixtures. Coverage ignores them.

## Not yet verified (needs the device)

| question | how to check |
|---|---|
| Chromium version in Steam's CEF | `npm run capture` prints it. Or, in the debugger console, run `navigator.userAgent`. Record it in CHANGELOG before using `:has()`, nesting, `@layer` or container queries. |
| Current tab titles | `npm run capture -- --list` |
| `GetSystemInfo()` field names used by `capture.mjs` | Check the `.json` next to the first capture. `steam` is `null` if the call failed, and the file is then named `unknown`. Pass `--version <build>`. |
| Notification toasts tab name in Game Mode | `--list` while a toast is showing. CSS Loader's `notificationtoasts_.*` mapping is only in the *desktop* popup group. |
| Decky on the Steam Machine | Nothing official found as of 2026-11-02. On the device: `systemctl status plugin_loader`, then check `~/homebrew/` and that CEF port 8081 answers. |
| Installing from a local zip | **Not supported** in CSS Loader 2.1.3, which only has store download and upload. Install by extracting the zip to `~/homebrew/themes/ClassicSteam2004/`, or use `npm run deploy`. |

## Release checklist

1. Bump `version` in `theme/theme.json` and add a `docs/CHANGELOG.md` entry that includes the Steam build tested.
2. Run `npm run validate` and `npm run zip`.
3. Test on stable, and on beta if you are on beta.
4. Tag `vX.Y.Z` and push. CI checks that the tag matches theme.json and attaches the zip.
