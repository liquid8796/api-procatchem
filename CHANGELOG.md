# Changelog

## PROCatchem content — v1.0.110

*August 22, 2026*

**Added:**

- **Farm zones**: multiple `moveToRectangle` areas with five rotation triggers (fixed interval,
  random interval, fully random, after a heal, after a won battle). Line-shaped zones are patrolled
  with `moveToCell` instead, since `moveToRectangle` cannot move within a zero-width box.
- **Team management**: ability pinning for slots 1 and 2, lead rotation by level / EV cap /
  unique-id list, a held item kept on the lead, `strongestSlot()`, and move protection through
  `onLearningMove`.
- **Battle rules engine** as a new `Custom rules` farm mode: named rules, nested AND/OR/NOT
  condition trees from a registry of checks, ordered steps with per-step guards, once-per-battle
  flags, and a raw-Lua escape hatch that is still verified against the API.
- **Route stops** that converge the mount and terrain state before travelling on, and
  **time-of-day hunting** with a hop table per period.
- A custom keep-farming condition that replaces the simple healing settings.

**Fixed:**

- `opponentHasType()` no longer calls `ipairs` on a possibly-nil list.
- `ppLeft()` has a single definition site, so a healing clause and a condition that both use it no
  longer conflict — previously the healing clause was silently dropped.
- The dismount-without-mount lint never fired, because an empty array is truthy.


## PROCatchem content — v1.0.109

*August 22, 2026*

**Added:**

- **Script Builder** (`builder.html`): generates a complete, runnable Lua script from a form —
  farm mode, route, encounter filters, battle plan, healing rules and session safety.
- Route travel is emitted as `moveToCell(x, y)` warp-tile hops resolved by a breadth-first search
  over `maps-cache/link_graph.txt`, because the host retired `moveToMap()`.
- Every generated script is checked against the API catalogue; the preview reports the number of
  API calls and whether they all resolve.
- Configuration lint with jump-to-setting diagnostics, and a `--[==[PROBUILDER ... ]==]` header so a
  generated `.lua` can be reopened in the builder.
- Node test suite under `tests/`, runnable with `npm test`.

**Updated:**

- The API reference links to the builder from the sidebar and the hero.
- `npm run build` now also ships `builder.html` and `assets/` into `dist/`.


## PROCatchem content — v1.0.108

*August 18, 2026*

**Added:**

- Documented the new battle-only Lua API `getBattleTurn()`.
- Defined `0` as "no valid server `BT:n` marker received yet" and positive values as the latest server-confirmed battle turn.
- Documented monotonic turn behavior and why the API is preferable to counting `onBattleAction()` callbacks for automatic/forced battle progression.

**Updated:**

- Synchronized the Slate Markdown sources, OpenAPI metadata, static HTML navigation/content, README, and deployable `dist/` output.


## PROCatchem content — v1.0.107

*July 20, 2026*

**Added:**

- Documented `getOpponentGender()` and `disMount()` in OpenAPI, Slate Markdown, static HTML, and the sidebar navigation.
- Added a focused gender/dismount Lua example.

**Improved:**

- Added a concrete practical scenario to every Lua API entry.
- Added callback/action-safety and asynchronous PC operation guidance.
- Filled previously empty parameter descriptions.


## PROCatchem content — v1.0.106

*July 6, 2026*

**Fixed:**

- The `executeSteps` (Workflow) section was only in the Slate markdown source (`source/index.md`, `LUA_API_SLATE.md`); the served static pages did not show it. Rendered it directly into `index.html` and `dist/index.html`: a `Workflow` sidebar category, the `executeSteps()` content section, and a `Workflow -> Flow (#00B5AD)` entry in the type-color map. The DOM-computed dashboard counters (functions/categories) pick it up automatically.


## PROCatchem content — v1.0.105

*July 6, 2026*

**Changed:**

- Renamed the Lua workflow API `runWorkflow` -> `executeSteps` across `source/index.md`, `LUA_API_SLATE.md` and `openapi.yaml`.
- Renamed the OpenAPI path `/lua/workflow/run-workflow` -> `/lua/workflow/execute-steps` (operationId, summary, signature, code sample, and the Slate "Source key").
- Signature is now `executeSteps(steps [, options])`; behaviour is unchanged.


## PROCatchem content — v1.0.104

*July 6, 2026*

**Changed:**

- `runWorkflow`: **removed the parallel mode** — it is now sequential-only.
- Simplified the syntax to `runWorkflow(steps [, options])` with `{ "name", function }` step pairs; dropped `mode`/`actions` and the `workflowYield` helper from the docs.
- Updated `source/index.md`, `LUA_API_SLATE.md` and `openapi.yaml` (`/lua/workflow/run-workflow` request body: `steps` + `options`, no `mode`).


## PROCatchem content — v1.0.103

*July 6, 2026*

**Added:**

- New `# Workflow` category documenting `runWorkflow(spec)` (sequential/parallel composition of other Lua APIs) in `source/index.md` and `LUA_API_SLATE.md`.
- `openapi.yaml`: `/lua/workflow/run-workflow` path and `Workflow` tag.
- Regenerate `index.html` / `dist/index.html` via `npm run build` to surface the new section in the static pages.


## Version 1.2

*June 20, 2015*

**Fixes:**

- Remove crash on invalid languages
- Update Tocify to scroll to the highlighted header in the Table of Contents
- Fix variable leak and update search algorithms
- Update Python examples to be valid Python
- Update gems
- More misc. bugfixes of Javascript errors
- Add Dockerfile
- Remove unused gems
- Optimize images, fonts, and generated asset files
- Add chinese font support
- Remove RedCarpet header ID patch
- Update language tabs to not disturb existing query strings

## Version 1.1

*July 27th, 2014*

**Fixes:**

- Finally, a fix for the redcarpet upgrade bug

## Version 1.0

*July 2, 2014*

[View Issues](https://github.com/tripit/slate/issues?milestone=1&state=closed)

**Features:**

- Responsive designs for phones and tablets
- Started tagging versions

**Fixes:**

- Fixed 'unrecognized expression' error
- Fixed #undefined hash bug
- Fixed bug where the current language tab would be unselected
- Fixed bug where tocify wouldn't highlight the current section while searching
- Fixed bug where ids of header tags would have special characters that caused problems
- Updated layout so that pages with disabled search wouldn't load search.js
- Cleaned up Javascript
