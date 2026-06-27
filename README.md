# PROCatchem Lua API Docs - Slate Template

This package converts the full PROCatchem Lua API reference from the previous Redoc/OpenAPI page to the uploaded Slate-style template.

## What changed

- All Lua APIs from `openapi.yaml` are rendered into `source/index.md` using Slate sections and Lua code tabs.
- A direct static fallback is available at `index.html` and `dist/index.html`, so you can open the docs without building Ruby/Middleman.
- The previous Redoc sidebar-scroll workaround is no longer needed because this template uses normal anchor navigation.
- PC storage APIs include the latest flows: official PC open/close, team-PC swap, deposit/withdraw, release, and internal PC box swap.

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

Version: `1.0.98`.
