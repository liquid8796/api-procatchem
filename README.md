# PROCatchem Lua Script API Docs

This repository contains a static Redoc documentation site for the Lua scripting API exposed by **PROCatchem v1.0.15**.

The source of truth is `openapi.yaml`. The OpenAPI file models Lua functions as pseudo-endpoints so Redoc can render a searchable API reference. These are **not HTTP endpoints**; each operation documents one Lua global function or callback.

## Structure

```text
.
├── index.html       # Static Redoc page
├── openapi.yaml     # PROCatchem Lua API reference
├── package.json     # Local preview/build scripts
├── redocly.yaml     # Redocly lint/preview config
└── vercel.json      # Vercel deployment config
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

## Updating the docs

When the Lua script API changes, update `openapi.yaml` and bump the version field in `package.json`.

## Notes for script authors

- `onPathAction()` is called while outside battle.
- `onBattleAction()` is called while in battle.
- Execute at most one path or battle action per frame.
- Query/helper functions can be called before deciding which action to run.


## Documentation UI note

Sidebar operation titles use Lua function names only, for example `getPokedexEvolved()` or `onStart()`, while descriptions stay inside each API detail page.
