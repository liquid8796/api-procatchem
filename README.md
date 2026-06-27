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

## Run static page

```bash
python3 -m http.server 8080 -d dist
```

Then open `http://localhost:8080`.

## Optional Slate/Middleman build

If Ruby dependencies are available:

```bash
bundle install
bundle exec middleman build
```

Version: `1.0.97`.
