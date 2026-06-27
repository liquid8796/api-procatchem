# PROCatchem Lua Script API Docs

This repository contains a static Redoc documentation site for the Lua scripting API exposed by **PROCatchem v1.0.145**.

The source of truth is `openapi.yaml`. The OpenAPI file models Lua functions as pseudo-endpoints so Redoc can render a searchable API reference. These are **not HTTP endpoints**; each operation documents one Lua global function or callback.

## New in this docs update

- Updated PC storage Lua APIs to match the latest tool behavior:
  - `depositPokemonToPC(teamPokemonId)` documents team index based deposit into the current PC box.
  - `withdrawPokemonFromPC(boxId, boxPokemonId)` documents PC index based withdraw back to team.
  - `swapPokemonFromPC(boxId, boxPokemonId, teamPokemonId)` documents team ↔ PC swap using visible one-based indexes.
  - Added `swapPokemonWithinPC(boxId, firstBoxPokemonId, secondBoxPokemonId)` for internal PC box position swaps.
  - `releasePokemonFromPC(boxId, boxPokemonId)` now documents permanent PC release/delete behavior.
  - `refreshPCBox(boxId)` / `isCurrentPCBoxRefreshed()` notes now explain async PC metadata, snapshot, and delta updates.
- Updated mount/surf docs: `setWaterMount()` is optional and should be configured before entering water; default surfing still uses the normal `/surf` flow.
- Fixed Redoc sidebar navigation for same-page clicks: the helper now waits for Redoc's `history.pushState` update, uses the current hash or clicked `data-item-id`, scrolls the actual Redoc content section, and supports both window and nested scroll containers without heavy DOM scans.
- SEO metadata and examples remain in place.

## Structure

```text
.
├── index.html                         # Static Redoc page + compact header + SEO metadata
├── openapi.yaml                       # PROCatchem Lua API reference
├── robots.txt                         # Search-engine crawl rules
├── sitemap.xml                        # Sitemap for indexing
├── examples/
│   ├── basic-script.lua
│   └── notification-script.lua
├── package.json                       # Local preview/build scripts
├── redocly.yaml                       # Redocly lint/preview config
└── vercel.json                        # Vercel deployment config
```

## Local preview

```bash
npm install
npm run dev
```

Alternative static preview:

```bash
npm run build
npx serve dist
```

## Deploy to Vercel from GitHub

1. Create a new GitHub repository, for example `procatchem-api-docs`.
2. Push these files to the repository root.
3. Open Vercel and choose **Add New Project**.
4. Import the GitHub repository.
5. Keep the settings from `vercel.json`:
   - Framework Preset: `Other`
   - Build Command: `npm run build`
   - Output Directory: `dist`
6. Deploy.

## SEO note

The included canonical URL and sitemap use `https://api-procatchem.vercel.app/` as the default deployment URL. If you deploy under a different Vercel project name or a custom domain, update these files before publishing:

- `index.html` canonical / Open Graph URL
- `sitemap.xml`
- `robots.txt` sitemap URL

After deployment, submit the live URL and sitemap in Google Search Console to help Google discover `PROCatchem` faster.

## Updating the docs

When the Lua script API changes, update `openapi.yaml` and bump the version field in `package.json`.

## Notes for script authors

- `onPathAction()` is called while outside battle.
- `onBattleAction()` is called while in battle.
- Execute at most one path or battle action per frame.
- Query/helper functions can be called before deciding which action to run.
- Notification sending is asynchronous. Lua calls return after queueing the send, not after Discord/Telegram delivery is complete.

## Redoc navigation fix note

The left menu and main content are linked by Redoc attributes: sidebar items expose `data-item-id`, and content sections expose the same value through `data-section-id`. Redoc updates the URL with `history.pushState`, which does not emit a normal browser `hashchange` event, so the page uses a small capture-phase fallback that waits for Redoc to activate the item, then scrolls the matching content section with the sticky header offset. The fallback supports both normal window scrolling and nested Redoc scroll containers. It does not scan API headings, does not depend on SEO hidden content, and avoids long retry loops to prevent UI freezes.

## Documentation UI note

Sidebar operation titles use Lua function names only, for example `getPokedexEvolved()` or `onStart()`, while descriptions stay inside each API detail page.
