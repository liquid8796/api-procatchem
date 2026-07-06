# Changelog

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
