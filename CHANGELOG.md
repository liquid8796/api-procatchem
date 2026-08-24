# Changelog

## PROCatchem content — v1.0.115

*August 24, 2026*

**Added:**

- **Vietnamese on the Script Builder.** The same EN/VI dropdown as the API reference page, top
  right, and the same rule: anything untranslated simply stays English. The choice is stored under
  the reference page's key, so picking a language on either page covers both.
- Coverage is the whole surface — form panels, farm modes, the condition and rules editors,
  diagnostics, the API browser, the structure view, the handbook, the link-graph workbench, toasts
  and confirmations: 809 strings translated by hand. The generated Lua is deliberately untouched;
  scripts read the same whatever the page language.
- The builder rebuilds its UI from state on every change, so translation happens at render time:
  strings pass through `t()` in `assets/builder/js/core/i18n.js` (with `{token}` placeholders
  filled after lookup) and a language switch simply re-renders. Data modules stay English — the
  source string doubles as the dictionary key, exactly like the reference page's packs.
- The static markup of `builder.html` (sidebar, hero, preview bar, labelling attributes) is swapped
  by `ui/static-text.js`, which stashes the English original in a data attribute so switching back
  restores it byte for byte.
- Pixel-font headings fall back to the body face while a translation is active, as on the reference
  page — Press Start 2P has no Vietnamese diacritics. The two "Script Builder" titles keep the
  pixel font: the name is never translated.
- `tests/builder-i18n.test.mjs` guards the pack from the source: every string literal passed to
  `t()`, every option list, condition kind, farm mode, template, and handbook section must have an
  entry — a feature added without its translation fails in CI, not on the live page.

**Fixed:**

- **Vietnamese headings lost their diacritics** where the pixel font was still in play — "Giới
  thiệu" rendered as broken glyphs on the API reference, along with the "Docs coverage" label.
  Press Start 2P ships latin and latin-ext only; Google Fonts serves no Vietnamese subset for it,
  so those characters fell back mid-word.
- The cause was the fix's shape rather than its coverage: the fallback was a hand-kept list of
  headings to exempt, and keeping that list in step with the pages had already failed twice. The
  default is now inverted — `--ff-pixel` itself retargets to the body face while a translation is
  active, so every element is safe without being listed. Text that is never translated (product
  names, type chips, function signatures, the `COPY`/`GET`/`NEW` badges) opts out through the new
  `--ff-pixel-latin` and keeps the pixel face. A missed size rule now costs a little visual
  weight instead of a broken word.
- The shared switcher stylesheet was also forcing `text-transform: uppercase` on the hero eyebrow,
  which the reference page sets for itself but the Script Builder does not — it shouted the
  builder's Vietnamese eyebrow. The shared rules now adjust size and weight only and leave each
  page's own typography alone.
- `tests/pixel-font.test.mjs` holds the opt-out to an allowlist that documents why each entry's
  text can never be translated, so pinning the pixel face on translatable text has to be a
  deliberate edit rather than an accident.

## PROCatchem content — v1.0.114

*August 24, 2026*

Closing the gap between the Script Builder and the V5 standalone tool, and fixing three things
that comparison turned up.

**Fixed:**

- **The gender filter could never match.** Both the target filter and the opponent-gender
  condition compared against `"Male"` / `"Female"`, but the host normalises to `"M"` / `"F"`.
  Saved drafts are migrated on load.
- **Eight EV/IV/stat functions documented stat names the host rejects.** The spec said `SPA` and
  `SPE`; the host accepts `SPATK`, `SPDEF` and `SPD` (speed), and stops the script on anything
  else. Corrected in `openapi.yaml` and on the reference page.
- The surf guard was one decision for the whole script, so a single surfing period disabled it
  everywhere. It now belongs to the branch it guards.

**Added — conditions:**

- **Heard in the battle log.** Some state has no getter: nothing asks whether your move was
  taunted. The game says it out loud, so a flag latches in `onBattleMessage()` and clears on a
  second phrase or after N turns. **Opponent ability was announced** is the same mechanism over
  ability names, since the host offers no `getOpponentAbility`.
- **Call an API function** — any documented function, with arguments and an optional comparison.
  Arity and literal argument types are checked before anything is emitted.
- Alternate form, money on hand, slot effort value, slot gender, which slot is in battle, and
  whether the Pokémon in battle can still fight.

**Added — battle rules:**

- `group` nests steps under one shared condition; `chain` emits `a() or b() or c()`, skipping a
  switch while trapped; plus `sendStrongest`, `stopBot` and `logout`.

**Added — the run itself:**

- **What happens when farming ends** is now a choice: the Pokécenter loop, healing at a nurse on
  the current map (with an optional money floor, since those charge), stopping with a logged
  message, logging out, or standing still.
- **Each time of day can hunt its own way**, not only on its own map — fishing at night and
  walking grass by day is one script now.
- Team rotation gains *highest level first*, and an **EV table** where each Pokémon trains its own
  stat to its own target; in EV farm mode the encounter filter follows the table.
- The relog delay after a trapped battle is configurable instead of pinned at 30 seconds.

**Added — tools:**

- **Link-graph workbench**: edit the graph by hand, export it, check that a route exists, and
  rewrite an older script that still calls the retired `moveToMap()`. A call is only rewritten
  where the script says which map it is standing on; everything else is reported untouched.
- **API browser**: all 242 documented functions, searchable, with signatures and argument types.
- **Script structure**: the generated script drawn as a tree of decisions, derived from the same
  plan the generator emitted from.
- **How this works**: eight sections on the patterns the builder emits, four of them quoting the
  generator verbatim — a test keeps those quotes honest.
- **Six starter templates**, each a complete run rather than a fragment.
- Opening a `.lua` with no embedded configuration now checks every call in it against the API and
  reports the results in Diagnostics.
- **A dark theme**, following the system by default with an explicit light/dark override. Fixing
  the palette also lifted two light-theme colours over the 4.5:1 contrast line.
- The ball ladder can be reordered by dragging; the arrow buttons stay for the keyboard.

**Internal:**

- The API catalog is now **generated from `openapi.yaml`** rather than hand-maintained, and a test
  fails when the checked-in copy drifts. Cross-checking it against the host's own registration
  list also pinned the thirteen `set*Timeout` globals the spec does not document.


## PROCatchem content — v1.0.113

*August 23, 2026*

**Changed:**

- The language control is now a **dropdown in the top-right corner** of the API reference page,
  replacing the two EN/VI buttons under the search box. It stays reachable at any scroll position.
- Translation packs **register themselves** into `window.PROCATCHEM_I18N`, and the switcher builds
  its options from whatever it finds. Adding a language is one new file plus one `<script>` tag —
  no edit to the switcher.
- Switching now restores English before applying the target pack, so going straight from one
  translation to another is correct. The previous two-state toggle would have matched nothing when
  applying a second pack over already-translated content.

**Handled:**

- A saved language whose pack is no longer shipped falls back to English instead of leaving the
  page half-translated.
- A pack with no `label` falls back to its code; a pack with no `dict` is ignored rather than
  breaking the dropdown.
- With no packs present at all, the switcher renders nothing and leaves the page untouched.


## PROCatchem content — v1.0.112

*August 23, 2026*

**Added:**

- **Vietnamese language option** on the API reference page. An EN/VI switcher sits under the
  search box; the choice persists across visits. All 242 API entries — descriptions, practical
  scenarios, parameter tables, category headings, hero, and sidebar — were translated by hand
  (399 unique strings) in a natural, reader-first tone; Lua code samples stay untouched.
- The pack ships as classic scripts (`assets/i18n/vi.js` + `assets/i18n/doc-i18n.js`) so the page
  keeps working when opened straight from the filesystem, where ES modules cannot load.
- Untranslated content can never blank the page: anything missing from the pack simply stays
  English, and switching back to English restores the exact original markup.
- While Vietnamese is active, headings set in the pixel font (which has no Vietnamese diacritics)
  render in the body face instead, so accents display correctly.


## PROCatchem content — v1.0.111

*August 22, 2026*

Acting on user feedback about the Script Builder.

**Fixed:**

- **Fishing had no rod box.** The hunting action could express the cell *or* the item, never both,
  so a fishing setup could not be described at all. There is now a dedicated *Fish from a cell*
  action with its own cell and rod fields; it walks onto the tile and only then casts.
- The surf guard no longer fires for fishing: it would have stepped ashore forever while the
  script tried to walk to a fishing cell on water.
- A once-per-battle move was marked done the moment the script *switched* the owner in, so the
  move itself never landed. `useMoveFromAnySlot` now reports whether the move landed, and
  `useOnce` only sets the flag when it did.
- List editors wrote a snapshot of their rows back to the store, so a change made while a render
  was still pending was silently discarded. They now derive every change from the live value
  through the new `Store.update`.

**Added:**

- **Preparation moves** in the basic battle plan: Soak, Skill Swap, Thief and anything else worth
  one turn before weakening, each used at most once per battle. Triggers are *every battle*,
  *opponent has type* (Soak against Ghost so False Swipe connects), *opponent is named*, and
  *my slot shows ability* — which is how a Trace lead exposes the opponent's ability, since the
  host offers no `getOpponentAbility`.
- A matching `Slot shows ability` condition for the rules engine and the custom farm guard.
- A show/hide toggle for the generated script. Collapsing it widens the form by about a third;
  Copy, Download and Diagnostics stay on screen, and the choice is remembered.


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
