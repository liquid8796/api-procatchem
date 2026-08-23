# PROCatchem Lua API Docs - Slate Template

This package converts the full PROCatchem Lua API reference from the previous Redoc/OpenAPI page to the uploaded Slate-style template.

## What changed

- All Lua APIs from `openapi.yaml` are rendered into `source/index.md` using Slate sections and Lua code tabs.
- A direct static fallback is available at `index.html` and `dist/index.html`, so you can open the docs without building Ruby/Middleman.
- The previous Redoc sidebar-scroll workaround is no longer needed because this template uses normal anchor navigation.
- PC storage APIs include the latest flows: official PC open/close, team-PC swap, deposit/withdraw, release, and internal PC box swap.

## Pokédex UI theme (v1.0.107)

The static docs now ship with a vivid, Pokémon-game-inspired template:

- **Pokédex shell sidebar** — red device chrome with a blue lens, status LEDs, and a capture-ball emblem; the navigation sits on a green LCD screen inside the shell.
- **Type-coded categories** — each of the 19 API categories carries a classic elemental type color (PC storage → Electric, Battle actions → Fire, Path actions → Flying, ...). The color flows from the sidebar dot to the section chip, heading underline, parameter markers, table headers, and signature cards.
- **LCD code screens** — every code block renders as a handheld screen with scanlines, phosphor-green Lua syntax highlighting (keywords, strings, numbers, comments, function calls), a one-click `COPY` button, and sticky positioning beside long entries.
- **Hero dashboard** — the intro opens with live counters (functions, categories, callbacks, computed from the DOM) and an HP-style coverage bar.
- **Method chips** — the source keys are rendered as game-style `GET`/`POST` badges next to their paths.
- **Extras** — capture-ball quick links, a floating back-to-top ball, scroll-reveal entries, custom scrollbars, keyboard-visible focus states, and full `prefers-reduced-motion` support.
- **Typography** — Press Start 2P (pixel display), Nunito (body), and JetBrains Mono (code) via Google Fonts, with system fallbacks so the page stays readable offline.

No build-pipeline changes: the theme lives entirely in `index.html` (CSS + a progressive-enhancement script), so `npm run build` still just copies static assets into `dist/`.

## Workflow API (v1.0.106)

A **Workflow** category documents `executeSteps(steps [, options])` — a Lua global that runs a list of other Lua APIs/functions as one **ordered** action. Each step is a bare function, a `{ "name", function }` pair, or an explicit `{ name, run, args, continueOnError }` table; `options` is `{ stopOnError, stopOnAction, logProgress }`. It honours the engine's one-action-per-frame rule (stops at the first bot action and returns `nextIndex` to resume next frame) and returns a result table (`ok`, `completed`, `stoppedForAction`, `nextIndex`, per-step `results`, ...).

- Added to `source/index.md` and `LUA_API_SLATE.md` (the `# Workflow` section), and to `openapi.yaml` (`/lua/workflow/execute-steps` path + `Workflow` tag).
- **v1.0.104:** the parallel mode was removed — `executeSteps` is now sequential-only and the syntax was simplified (`executeSteps(steps [, options])`, `{ "name", function }` step pairs).
- **v1.0.105:** renamed `runWorkflow` → `executeSteps` (and the OpenAPI path `/lua/workflow/run-workflow` → `/lua/workflow/execute-steps`).
- **v1.0.106:** rendered the `executeSteps` section into the static `index.html` / `dist/index.html` (sidebar nav entry, content section, and `Workflow` type color) so it appears without a Slate/Middleman rebuild.
- The static `index.html` / `dist/index.html` are pre-rendered snapshots; regenerate them with `npm run build` (or `npm run slate:build`) to surface the section in the static pages.


## Complete practical examples (v1.0.107)

- Added Lua API documentation for `getOpponentGender()` and `disMount()` based on the current tool implementation.
- Every documented Lua API now contains a concrete scenario with runnable-style Lua code, the correct callback context, and notes for one-action-per-frame or asynchronous server updates where applicable.
- Empty parameter descriptions were replaced with explicit meanings for indexes, coordinates, item/move names, PC box identifiers, notification values, and other common inputs.
- Added `examples/opponent-gender-and-dismount.lua`.
- Synchronized `openapi.yaml`, `source/index.md`, `LUA_API_SLATE.md`, `index.html`, and deployable `dist/` output.

## Vietnamese language option (v1.0.112)

The API reference page has an EN/VI switcher under the search box. The Vietnamese pack lives in
`assets/i18n/vi.js` as a map from the *normalized English innerHTML* of each translatable element
to its translation; `assets/i18n/doc-i18n.js` applies it, stashing the English original so
switching back restores the page byte-for-byte. Both are classic scripts on purpose — the page
still works when opened from the filesystem, where ES modules cannot load.

Because lookups are content-keyed, a newly added API entry simply stays English until its strings
are added to the pack — nothing breaks. `tests/i18n.test.mjs` guards the pack: category coverage,
structural labels, and that no translation alters inline `<code>` snippets, `{template}`
placeholders, or markup structure.

## Script Builder (v1.0.109)

A form-driven generator at **`builder.html`** (linked from the sidebar and the hero of the API
reference) that assembles a complete, runnable Lua script — route, encounter filters, battle
plan, healing rules and session safety — and verifies every function it emits against the API
catalogue before you copy it.

### Why it never emits `moveToMap()`

The host retired `moveToMap()`: calling it raises a fatal error and stops the script. The builder
therefore expresses every map transition as `moveToCell(x, y)` onto a warp tile, using the link
graph the bot writes to `maps-cache/link_graph.txt` while it plays:

```lua
local TO_FARM = {
    ["Pokecenter Viridian"] = { 9, 14 }, -- -> Viridian City
    ["Viridian City"]       = { 12, 3 }, -- -> Viridian Forest
}
local function walk(hops)
    local hop = hops[getMapName()]
    if hop then return moveToCell(hop[1], hop[2]) end
    return false
end
```

Load that file in the builder's sidebar to unlock Pokécenter routes. Without it the builder says so
rather than emitting a route that cannot work; hunting on the current map needs no link graph.

### V4 feature groups (v1.0.110)

Four groups ported from the standalone V4 builder:

**Farm zones** — several `moveToRectangle` boxes plus a picker. Zones rotate on a fixed timer, a
random interval, fully at random, after every heal, or after every won battle. A rectangle that is
really a line (one row, one column, or a single cell) is patrolled end to end with `moveToCell`,
because `moveToRectangle` would leave the bot standing still on it.

**Team management** — pin an ability to slot 1 and slot 2 (Synchronize, Trace), rotate the lead by
lowest level / EV cap / a unique-id priority list, keep an item on the lead (reclaiming it from a
team-mate when the bag runs out), expose `strongestSlot()`, and protect moves through
`onLearningMove`. Rotation automatically works on the first slot no ability has pinned, so the two
never fight over the same Pokémon.

**Battle rules engine** — a fifth farm mode, `Custom rules`. Rules are named conditions with ordered
steps; conditions are arbitrarily nested AND/OR/NOT trees built from a registry of checks, and each
step can be gated, marked once-per-battle, or drop to raw Lua. Anything a raw expression calls is
still checked against the API catalogue.

**Routes** — stops that adjust the mount or the terrain before travelling on (both convergent, so
they cannot loop), and a different hunting map per time of day with its own outbound and return hop
tables selected by `activeLeg()`.

The same condition trees also power an optional custom keep-farming guard, replacing the simple
usable-count and PP settings.

### Feedback fixes (v1.0.111)

- **Fishing** is its own hunting action with both a cell and a rod, because the host has no fishing
  call: the script walks onto the tile, then casts. The surf guard is skipped for it.
- **Preparation moves** (Soak, Skill Swap, Thief) sit in the basic battle plan, run at most once per
  battle before weakening, and can be triggered by opponent type, opponent name, or the ability
  showing on one of your slots — a Trace lead is how you read the opponent's ability, since the host
  exposes no `getOpponentAbility`.
- The generated script can be **collapsed**; Copy, Download and Diagnostics stay available.

### Source layout

The builder ships as plain ES modules — no bundler, no framework:

```
assets/builder/
  builder.css                 Pokédex theme for the builder page
  js/
    core/       store.js, registry.js, lua-writer.js    state, plug-in registry, Lua emitter
    domain/     config.js, condition.js, link-graph.js, config schema, condition trees,
                zone.js, host-api.js                    BFS routing, zones, API catalogue
    generators/ index.js, runtime.js, battle.js,        composition + shared emitters
                route-plan.js, zones.js, team.js,
                rules.js, mode-registry.js,
                modes/{hunt,exp,ev,gold,rules}.js       one Strategy per farm mode
    lint/       rules.js                                configuration checks
    ui/         app.js, panels.js, fields.js,           wiring, panel descriptors, controls
                condition-editor.js, rule-editor.js,
                helper-moves.js,
                dom.js, highlight.js, radio-group.js
```

Extension points:

- **A new farm mode** — add `generators/modes/<id>.js` exporting a `FarmMode`, then register it in
  `generators/mode-registry.js`. The UI, lint and panels pick it up automatically.
- **A new condition** — add one entry to `CONDITION_KINDS` in `domain/condition.js`. The tree editor
  renders its parameters from the descriptor and the emitter calls its `emit`.
- **A new battle step action** — add it to `STEP_ACTIONS` in `domain/config.js` and handle it in
  `generators/rules.js`.
- **A new setting** — add the field to `domain/config.js`, a descriptor to the relevant panel in
  `ui/panels.js`, and the emitter that consumes it.
- **A new check** — add one function to `lint/rules.js` and register it.

### Tests

`npm test` runs the Node test suite in `tests/` (Lua escaping, link-graph routing, and generation
invariants — no configuration may emit an unknown or retired API call).

`scripts/emit-fixtures.mjs <dir>` writes a matrix of generated scripts so they can be compiled and
executed against the real MoonSharp host used by the bot.

## Battle turn API (v1.0.108)

- Added `getBattleTurn()` to the **Battle state** Lua API reference.
- The API returns the latest server-confirmed `BT:n` battle turn stored by PROCatchem.
- `0` means the current battle has not received a valid `BT:n` marker yet; positive values are monotonic and do not move backwards on duplicate/out-of-order markers.
- The API is battle-only and follows the existing fatal Lua error contract outside battle.
- Updated `source/index.md`, `LUA_API_SLATE.md`, `openapi.yaml`, `index.html`, and deployable `dist/` output.

## Files

- `source/index.md` - Slate source document.
- `index.html` - direct static Slate-like page.
- `dist/index.html` - deployable static page.
- `openapi.yaml` - source metadata retained for tooling.
- `examples/` - Lua examples.

## Build and run static page

The default build is Vercel-safe and does not require Ruby gems:

```bash
npm install
npm run build
npm run dev
```

Then open `http://localhost:8080`.

## Optional Slate/Middleman build

If Ruby dependencies are available and you specifically want to rebuild from the Slate/Middleman source:

```bash
npm run slate:build
```

Vercel uses the default `npm run build` static build to avoid failing when Bundler gems are not installed.

Version: `1.0.108`.

- Sidebar categories are collapsed by default on first landing. Clicking either the category label or the chevron toggles collapse/expand; function links still scroll to their API sections.
