# Changelog

## PROCatchem content — v1.0.116

*September 4, 2026*

**Added — the route can change with the clock:**

- **Each time of day may bring its own route.** A period was already allowed its own hunting map
  and its own way of finding encounters; it can now also name its own Pokécenter, its own way of
  healing there, its own farm zones and its own answer to "what now" when farming stops. Anything a
  period leaves blank falls back to the main setting, so a run that hunts one spot all day still
  costs one field per period. The four route-shaped overrides need "Pokécenter loop"; a period's
  hunting style still works when you are staying put.
- A period's patches belong to the map that period hunts, so they are not borrowed for the rest of
  the day: outside those hours the run hunts the plain way instead of walking to coordinates
  measured somewhere else.
- The way home is planned from **every** spot the clock can put the bot on, not just from the leg
  it belongs to — otherwise a route that changes Pokécenter at dusk walks the bot to a table with
  no row for where it is standing and it waits there until morning.
- `activeLeg()` grew accordingly: it returns the period's spot, its Pokécenter and its hop tables,
  and the whole out-and-back loop is written once against those values. Two periods anchored at the
  same Pokécenter share one return table rather than emitting the same rows twice — and, since it
  is the Pokécenter the detour is about, moving between two periods that heal in the same place is
  not treated as a change at all.
- **When the clock moves a run onto another route**, it can go by way of the new Pokécenter first
  so the next stretch starts on a full team, or head straight out. The setting only appears once a
  period names a Pokécenter of its own, and the first frame of a session is never treated as a
  change — starting the bot does not send it on a detour.
- **A bot that wakes up off-route now walks home.** The return table is no longer the path it
  walked out on; it is one hop for every map the link graph can reach the Pokécenter from, so
  logging in halfway across the region ends in a walk back rather than a bot standing still. It is
  a toggle, for anyone who would rather keep the script short: turned off, the table shrinks back to
  the direct path and the diagnostics say what that costs.
- **"Hunt wherever the bot is standing"** drops the map check for runs that work whatever ground
  they are on. The walk back to heal is untouched.
- The link-graph workbench gained **"Check the route I have configured"**: it walks every leg the
  current form plans and then cross-checks them, because it is not enough for each period to work
  on its own — every spot has to be able to reach every Pokécenter, or the run stops at dusk. The
  same check runs as a lint rule.

**Added — the mount comes back on:**

- `disMount()` clears the configured mount as well as dismounting, so a map ticked "dismount here"
  used to leave automatic mounting off for the rest of the run. The script now remembers that it
  dropped the mount and puts it back the moment it steps off that map, guarded by a `NO_MOUNT`
  table and by `isSurfing()` — Surf is not a ground mount and is never interrupted.

**Added — filters that read the battle log:**

- **Alternate forms, announced abilities, announced held items and effort-value yield** joined the
  target filters. Ability and held item have no getter at all: a Trace lead copies the wild ability
  and the game says so, a Frisk lead names the item, and the filter latches what it hears. The
  diagnostics ask for the lead that makes each one work.
- **What a match is for** is now a choice: catch it, knock it out, run from it, or stop the bot and
  hand it over. Anything but catching skips the ball ladder and the weakening moves entirely rather
  than emitting code nothing calls.
- **"Fight only if…"** gives the wild Pokémon you did not ask for their own condition tree — clear
  the low levels and flee the rest, or only fight what feeds the right effort value.
- Two new conditions: **the health percentage of one of your own slots**, and **the PP one slot has
  left for a move** alongside the existing whole-team check.

**Added — the team list speaks names:**

- **Rotation lists take Pokémon names as well as unique ids.** An id survives boxing and
  reordering, which is why it is still the better answer, but most people know their team by name
  and have never looked an id up. Digits are read as an id, anything else as a name.
- **The EV table takes a Pokémon more than once**, one row per stat, and moves on to the second row
  by itself once the first is met. In EV farm mode the encounter filter follows whichever stat the
  leader still owes rather than the first row that matches it.
- **A finished EV table ends the run.** It is a job with a last page, so once every row is met the
  farm guard goes false and the "when that condition fails" behaviour takes over — stop with a
  message, log out, go and heal. Previously the run stayed up fleeing every encounter, silently,
  because there was no longer a stat it wanted.

**Added — two ways in, and a way to stay current:**

- **Quick build.** The questions that decide almost every run, assembled into a complete
  configuration and dropped into the main form — where all sixty settings are still there to
  adjust. It writes a configuration, not a script: there is nothing it can express that the form
  cannot.
- **A newer `openapi.yaml` can be loaded into the running page.** The checked-in catalog is a
  snapshot of one build of the host, so when the API moves on the builder would otherwise report
  every new function as a typo. Load the spec from the API browser and the function list, the
  completion boxes, the guided call step and the verification pass all follow it, with a summary of
  what changed; one button puts the built-in catalog back.
- Six starter templates for the shapes that were awkward to reach from a blank form: **Ghost hunt
  with Soak**, **Skill Swap**, **item farm with Thief**, **ability hunt with Trace**, **two layers
  of sleep**, and **an EV chain across the team**.
- Held-item fields suggest the items worth handing to a lead — Everstone, Exp. Share, Macho Brace,
  Soothe Bell, Amulet Coin, Lucky Egg, Leftovers — without restricting what you can type.

**Added — the handbook explains the machinery:**

- Three new sections: **what the builder assembles for you** (the six shapes that are
  several API calls plus a variable rather than one function), **lists, separators and quotes**,
  and **two things that read backwards** — the `return` inside an `if` that is not a fallback, and
  the OR-by-default filter that is not "shiny Ralts".
- **"Every choice, and what it writes"** is generated by running each condition through the same
  emitter the script uses, so the table cannot drift from the generator the way a hand-written list
  would.
- The diagnostics gained a warning that has been earned for a while: a **level range or a gender is
  OR-ed with the other filters**, so "shiny, level 40 to 50" catches everything from level 40 up.
  Turning on "All must match" is what makes a range a limit, and the handbook now says so instead
  of claiming those two were special.

**Translated:**

- All of the above in Tiếng Việt, 日本語 and 简体中文 — 396 new strings, 132 per language, hand
  written in the same voice as the rest of each pack. `tests/builder-i18n.test.mjs` now scans the
  quick form's field descriptors too, which is the hole the first pass went through.

**Changed:**

- **API version bumped to 1.0.109**, in `openapi.yaml` and everything derived from it: the
  generated catalog, `package.json`, and the badge on both pages. The Lua surface itself is
  unchanged — no function was added, removed or resignatured — so a script written against 1.0.108
  runs untouched.
- `yaml-lite` and the spec reader moved from `scripts/` into `assets/builder/js/`, so the page and
  the build script read `openapi.yaml` through one implementation instead of two.
- The generated script's return table is bigger by default: one row per map you have walked, rather
  than one per map on the route. Turn "find the way back from anywhere" off to get the old shape.

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

**Added — Japanese and Simplified Chinese:**

- **Both pages now ship in four languages.** 日本語 and 简体中文 join English and Tiếng Việt on the
  API reference *and* the Script Builder, from the same top-right dropdown. The choice is still
  stored under one key, so picking a language on either page carries to the other.
- 2,456 strings translated by hand: 419 per language on the reference page and 809 on the builder.
  Nothing is machine-filled — the wording follows what players in each language actually say
  (手持ち / ボックス / 色違い / 努力値 and 队伍 / 盒子 / 闪光 / 努力值), while move, item, map and
  function names stay in English because that is what the game and the fields expect.
- The generated Lua is untouched in every language, as are the handbook's worked examples: a
  script written in Japanese reads identically to one written in English.
- Adding these needed no runtime change. The reference page discovers packs from the registry, so
  it took one `<script>` tag each; the builder takes one line in `PACKS`. The pixel-font fallback
  already keys off "not English", so Japanese and Chinese headings picked it up for free — Press
  Start 2P has no CJK either.
- `tests/builder-i18n.test.mjs` previously checked only the Vietnamese pack; it now runs its
  source-driven coverage over every registered pack, so none of the three can drift.

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
- **Button labels broke mid-word in Vietnamese** — the farm-mode cards and the segmented controls
  ("Bắt đúng con khớp bộ lọc", "Đánh trainer đó") mixed two typefaces inside a single word. Form
  controls do not inherit `font-family`, so every button that named no font of its own had been
  rendering in the browser's own face rather than Nunito. That passed unnoticed for as long as the
  UI was English; it broke visibly in Vietnamese because Arial **Bold** carries no precomposed
  Vietnamese glyphs (`ạ ắ ẹ ệ ỉ ộ ớ`), so bold labels fell back glyph by glyph. `button`, `input`,
  `select` and `textarea` now inherit the family on both pages — family only, so every control
  keeps its own size and weight — and the test suite fails if that line is ever dropped.

**Changed:**

- **Each sidebar category is one control again.** The collapsible category row on the API
  reference carried two: the label and a separate caret button beside it, both wired to the same
  toggle. That meant two tab stops and two hit targets for one action. The row is now the single
  control, with the caret drawn as a pseudo-element on it — it has to stay a pseudo-element,
  because the translation pass matches on the link's own `innerHTML` and a child node would stop
  the category names finding their dictionary entry.
- The control never navigated (every click was already cancelled in favour of toggling), so it now
  says as much: `role="button"` with `aria-expanded`, and it answers Space as well as Enter, which
  is what the caret button used to provide. The role is applied from script, so with JavaScript off
  the sidebar is still a plain list of links that jump to their section.
- Removed with it: the `.nav-tag-header` wrapper that existed only to sit the two controls side by
  side, the `.nav-toggle` and `.nav-caret` rules, and the now-unreachable `.nav-tag-header > a`
  selector in the translation runtime.

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
