# PROCatchem Lua API Docs - Slate Template

This package converts the full PROCatchem Lua API reference from the previous Redoc/OpenAPI page to the uploaded Slate-style template.

## What changed

- All Lua APIs from `openapi.yaml` are rendered into `source/index.md` using Slate sections and Lua code tabs.
- A direct static fallback is available at `index.html` and `dist/index.html`, so you can open the docs without building Ruby/Middleman.
- The previous Redoc sidebar-scroll workaround is no longer needed because this template uses normal anchor navigation.
- PC storage APIs include the latest flows: official PC open/close, team-PC swap, deposit/withdraw, release, and internal PC box swap.

## Pokédex UI theme (v1.0.102)

The static docs now ship with a vivid, Pokémon-game-inspired template:

- **Pokédex shell sidebar** — red device chrome with a blue lens, status LEDs, and a capture-ball emblem; the navigation sits on a green LCD screen inside the shell.
- **Type-coded categories** — each of the 19 API categories carries a classic elemental type color (PC storage → Electric, Battle actions → Fire, Path actions → Flying, ...). The color flows from the sidebar dot to the section chip, heading underline, parameter markers, table headers, and signature cards.
- **LCD code screens** — every code block renders as a handheld screen with scanlines, phosphor-green Lua syntax highlighting (keywords, strings, numbers, comments, function calls), a one-click `COPY` button, and sticky positioning beside long entries.
- **Hero dashboard** — the intro opens with live counters (functions, categories, callbacks, computed from the DOM) and an HP-style coverage bar.
- **Method chips** — the source keys are rendered as game-style `GET`/`POST` badges next to their paths.
- **Extras** — capture-ball quick links, a floating back-to-top ball, scroll-reveal entries, custom scrollbars, keyboard-visible focus states, and full `prefers-reduced-motion` support.
- **Typography** — Press Start 2P (pixel display), Nunito (body), and JetBrains Mono (code) via Google Fonts, with system fallbacks so the page stays readable offline.

No build-pipeline changes: the theme lives entirely in `index.html` (CSS + a progressive-enhancement script), so `npm run build` still just copies static assets into `dist/`.

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

Version: `1.0.102`.

- Sidebar categories are collapsed by default on first landing. Clicking either the category label or the chevron toggles collapse/expand; function links still scroll to their API sections.
