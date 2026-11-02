# Classic Steam 2004

A [CSS Loader](https://github.com/DeckThemes/SDH-CssLoader) theme that brings back the 2004 Steam VGUI look in SteamOS Game Mode and Big Picture: olive panels, 1px bevels, Tahoma and maize accents.

It is a fork of [NegativeI0N/SDH-ClassicTheme](https://github.com/NegativeI0N/SDH-ClassicTheme).

> Status: alpha. The upstream CSS ships unchanged while we measure what still matches the current Steam client. See [docs/coverage.md](docs/coverage.md).

## Install
Download `ClassicSteam2004-<version>.zip` from Releases. Extract it into `~/homebrew/themes/ClassicSteam2004/` on the Deck, so that `theme.json` sits directly in that folder. Then enable the theme in the QAM → CSS Loader.

## Develop
Requires Node ≥ 24.

```bash
npm install
npm run dev        # local preview with hot reload
npm run deploy     # push to the Deck (needs .env, see docs/testing.md)
npm run zip        # validate and build dist/ClassicSteam2004-<version>.zip
```

| path | what |
|---|---|
| `theme/` | Source of what ships: `theme.json`, `css/{tokens,base}.css`, `css/components/`, `css/surfaces/`, `css/patches/`, `assets/` |
| `preview/` | Vite harness; `fixtures/<surface>/<steam-build>.*` are captured from CEF |
| `tools/` | `capture`, `coverage`, `validate`, `build`, `deploy`, plus `lib/translate.mjs` (port of CSS Loader's class translator) |
| `docs/` | [design-system](docs/design-system.md), [class-translation](docs/class-translation.md), [coverage](docs/coverage.md), [testing](docs/testing.md), [CHANGELOG](docs/CHANGELOG.md) |
| `legacy/` | Upstream plugin (`main_view.html`) and the v0.2 store package, unchanged |

## Credits & license
- Original Classic Steam CSS by **NegativeI0N**, released under CC0 (`legacy/LICENSE-upstream-CC0`).
- The deckthemes.com package carried the MIT notice of suchmememanyskill's theme template. This fork keeps that notice: see [LICENSE](LICENSE).
- Colours come from Valve's 2004 `steamscheme.res`.
- Not affiliated with Valve.
