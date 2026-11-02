# Design system: 2004 Steam VGUI

Tokens are in [`theme/css/tokens.css`](../theme/css/tokens.css). Components use tokens only, never raw hex. `npm run validate` fails on raw hex outside `tokens.css`; `legacy-shared.css` is exempt.

## Rules
- **Bevels, not shadows.**
  - Raised: `border: var(--cs-bevel-width) solid; border-color: var(--cs-bevel-raised);`
  - Sunken (text entries, list boxes, troughs, pressed buttons): `var(--cs-bevel-sunken)`.
  - No radius, shadow or blur.
  - The only gradient allowed is the maize progress bar.
- **Three olive layers.**
  - `--cs-bg-dark`: window / page.
  - `--cs-bg`: panels, tab bodies, buttons.
  - `--cs-bg-light`: headers, focus, selection.
- **Maize is the only accent.** Use it for progress, active indicators, toggles that are on, slider fill and the current-item dot.
- **Text.**
  - `--cs-text`: primary.
  - `--cs-label`: labels.
  - `--cs-text-dim`: secondary.
  - `--cs-disabled-1` / `-2`: disabled text and its shadow.
  - `--cs-text-selected` (white): focused or selected text.
- **Controller focus.** `.gpfocus` / `.gpfocuswithin` use `--cs-bg-light` with a raised bevel. It must be visible from the couch on a 7" 1280×800 screen.
- **Type.**
  - Tahoma, via `--cs-font`.
  - Planned: ship an LGPL Wine Tahoma build in `theme/assets/fonts/` with its license. Wine's `fonts/tahoma.sfd` and `tahomabd.sfd` must be built to TTF with FontForge, and the license checked first.
  - Planned: a patch to use the system font instead.

## VS Code snippets
`cs-raised`, `cs-sunken`, `cs-focus` (`.vscode/classic-steam.code-snippets`).

## Planned patches
Font (Wine Tahoma / System) · Accent (Maize / Steam Blue / color-picker) · Bevel strength · Theme keyboard (Yes/No, required) · Hide non-classic chrome (`REQUIRE_NAV_PATCH`).
