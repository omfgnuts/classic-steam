# Class translation in CSS Loader

Verified 2026-11-02 against SDH-CssLoader `main` (`2951501`, package 2.1.3, `CSS_LOADER_VER = 9`) and DeckThemes/CSSLoader-Mappings (`a180462`). Reference clones live in `.reference/` (git-ignored).

## What happens on the device

1. **Fetch.** `main.py:fetch_class_mappings` downloads one of these files at startup and then every 60 s, until a fetch succeeds:
   - `https://api.deckthemes.com/stable.json`
   - `https://api.deckthemes.com/beta.json`, when the "Beta Branch CSS Translations" setting (`beta_translations`) is on.

   The file is saved as `~/homebrew/themes/css_translations.json`. With no network, the last saved copy is used.
2. **Build the map.** The format is `{ uid: [name1, name2, …, current] }`. Every entry except the last maps to the **last** entry (`css_inject.py:initialize_class_mappings`).
3. **Rewrite.** When each injected CSS file loads, `Inject.load()` rewrites it in two places:
   - Class selectors matching `\.[_a-zA-Z]+[_a-zA-Z0-9-]*`, when the name without the dot is a key.
   - Attribute selectors `[class*="…"]`, `[class^="…"]`, `[class|="…"]` and `[class~="…"]` with a quoted value that is a key.

   Nothing else is rewritten.

## Selector forms that stay alive

Each uid's list holds all the historical forms. Example from the live `stable.json`:

| form | example | translated? |
|---|---|---|
| legacy readable + short hash (2022) | `.gamepadtabbedpage_Tab_3eEbS` | ✅ → current hash |
| readable, no hash | `.gamepadtabbedpage_Tab` | ✅ → current hash |
| current raw hash | `._3eEbSktrstBdLk0dVpnKVI` | only while it is current, then ✅ as an old entry |
| unhashed semantic (`.DialogButton`, `.gpfocus`, `.Focusable`, `.BasicUI`, `.GamepadMode`) | — | not needed |

**Rule for this repo:**
1. Prefer unhashed semantic classes.
2. Otherwise write the **readable no-hash form** (`.module_Name`). It is the most readable form, and every later rename maps it forward.
3. Never ship raw current hashes.

To check a name, run:

```bash
npm run mappings -- gamepadtabbedpage_Tab mainmenu_Item
```

## What is *not* translated

- `@keyframes` names and `animation-name` values. The upstream override `@keyframes quickaccessmenu_ItemFocusAnim-darkerGrey-nocolor_2YeD3` can never match today's hashed keyframes. Override the `animation` on the element instead.
- Unquoted attribute selectors (`[class*=foo]`) and `[class$=…]`.
- Class names inside `:is()` and `:not()` *are* translated, because the regex runs over the whole file.
- The rewrite also escapes `\` and `` ` `` for JS injection, so a CSS escape like `content: "\201C"` reaches the page unchanged.

## Legacy CSS status (offline check)

Of the 60 hashed classes in `legacy-shared.css`, 48 are in the map and 12 are not. Classes that are not in the map are not rewritten at all, so they are almost certainly dead:

`searchbar_SearchContainer_161Tj`, `friendslist_TabBumper_24KhQ`, `gamepadpagedsettings_Active_1ELdD`, `gamepaddialog_ToggleRail_2bl0i`, `gamepaddialog_Toggle_9Ql-o`, `gamepaddialog_Field_eKmEX`, `gamepaddialog_HighlightOnFocus_2HFrm`, `basiccontextmenu_contextMenuItem_3PqLg`, `basiccontextmenu_Focused_3t3Zg`, `basiccontextmenu_Selected_iWaEr`, `gamepadslider_SliderNotchTick_u8QEa`, `gamepadslider_TickActive_j418S`

A translated class can still be dead if Valve removed the element. Only `npm run coverage` against real captures settles that.

## Tooling in this repo

- `tools/lib/translate.mjs` is a line-for-line port of the two regex passes. It caches the map in `.cache/` for 24 h. `npm run mappings` refreshes it; add `--beta` for the beta map.
- `npm run build` ships **untranslated** CSS, so the device keeps translating it after future Steam updates.
- The preview and `coverage.mjs` translate before matching, because fixtures contain current hashes.

## Offline fallback

`SteamClientHomebrew/ClassMapper`, named in the project brief, no longer exists. That URL now redirects to an unrelated repository (`ejalxndr/leafwire`). Use these instead:
- `DeckThemes/CSSLoader-Mappings`: `stable.orig.json`, `beta.orig.json` and per-build diffs in `webpack-mappings/`.
- The live JSON from `api.deckthemes.com`.
