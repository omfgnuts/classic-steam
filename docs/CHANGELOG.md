# Changelog

## v1.0.0-alpha.1 (unreleased)
Tested on: nothing yet. Next step is to capture a fixture and run coverage.

- Forked NegativeI0N/SDH-ClassicTheme as omfgnuts/classic-steam, keeping its history. The upstream plugin files moved to `legacy/`.
- Imported the deckthemes.com v0.2 package verbatim into `legacy/store-v0.2/`. Its `shared.css` equals upstream `og_theme`, apart from blank lines and one added `;`.
- theme.json changes:
  - name `ClassicSteam2004`, display_name "Classic Steam 2004"
  - manifest 9, target System-Wide
  - `tabs.default` = bigpicture, QuickAccess, MainMenu
  - `id` removed
- Upstream CSS ships unchanged as `css/legacy-shared.css`, until coverage is done. `--cs-` tokens added in `tokens.css`; nothing uses them yet.
- Tooling added: preview (Vite), capture (CDP), coverage, validate, build/zip, deploy (rsync), and a CI release workflow.
