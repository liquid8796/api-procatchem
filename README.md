# PROCatchem Lua Script API Docs

This repository contains a static Redoc documentation site for the Lua scripting API exposed by **PROCatchem v1.0.92**.

The source of truth is `openapi.yaml`. The OpenAPI file models Lua functions as pseudo-endpoints so Redoc can render a searchable API reference. These are **not HTTP endpoints**; each operation documents one Lua global function or callback.

## New in this docs update

- Fixed sidebar operation navigation: clicking a function in the left Redoc menu now updates the URL hash and scrolls the main page to the selected function, with sticky-header offset handling.
- Added the notification Lua APIs:
  - `sendNotification(templateName)`
  - `sendNotificationWith(templateName, values)`
  - `sendNotificationTo(templateName, target)`
  - `sendNotificationWithTo(templateName, values, target)`
  - `notify(message)`
  - `setNotifyVar(name, value)`
  - `clearNotifyVars()`
- Added SEO metadata for Google Search: title/description/keywords, Open Graph/Twitter cards, JSON-LD structured data, `robots.txt`, and `sitemap.xml`.
- Fixed the documentation header layout so the SEO intro no longer appears as a large visible block above Redoc. SEO metadata/JSON-LD remain in place, and the semantic intro is kept visually hidden to avoid breaking the UI.

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

## Documentation UI note

Sidebar operation titles use Lua function names only, for example `getPokedexEvolved()` or `onStart()`, while descriptions stay inside each API detail page.
