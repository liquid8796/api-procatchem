/**
 * Guards that translated text always lands in a face that can draw it.
 *
 * Two ways it has gone wrong, both invisible in English:
 *
 * 1. Press Start 2P ships latin and latin-ext only — Google Fonts serves no
 *    Vietnamese subset for it — so translated text set in that face loses its
 *    diacritics mid-word ("Giới thiệu" rendering as "Gi?i thi?u").
 * 2. Form controls do not inherit font-family, so a button that names no font
 *    of its own renders in the UA face. Arial Bold carries no precomposed
 *    Vietnamese glyphs, so bold button labels broke glyph by glyph.
 *
 * The pages defend against that by inverting the default: `--ff-pixel` is
 * retargeted to the body face while a translation is active, so every element
 * is safe without being listed anywhere. The one dangerous act left is opting
 * back out via `--ff-pixel-latin`, which is correct only for text that is
 * never translated. This file holds that opt-out to an explicit allowlist, so
 * pinning the pixel face on translatable text has to be a deliberate edit.
 * Run with: node --test tests/
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const RAW_FACE = 'Press Start 2P';
const LATIN_TOKEN = '--ff-pixel-latin';

/**
 * Selectors allowed to keep the pixel face, with the reason each one's text
 * can never be translated. Verified in the browser: every one renders ASCII
 * in both languages.
 */
const LATIN_ONLY = {
  'index.html': {
    '.brand h1': 'product name — "PROCatchem Lua API"',
    '.hero h1': 'product name — "PROCatchem Lua API"',
    '.stat b': 'digits only — 242 / 20 / 11',
    '.type-chip': 'Pokémon type names injected by the page script — "Normal", "Psychic"',
    '.operation h2': 'function signatures — "moveToCell()"',
    '.copy-btn': 'English badge — "COPY"',
    '.method': 'English badge — "GET"',
    '.builder-link .bl-title': 'product name — the pack maps "Script Builder" to itself',
    '.builder-link .bl-new': 'English badge — "NEW"',
  },
  'assets/builder/builder.css': {
    '.brand h1': 'product name — "Script Builder"',
    '.hero h1': 'product name — "Script Builder"',
  },
};

/**
 * The CSS of a file, with comments removed.
 *
 * Stripping matters: the crude rule splitter below treats everything before a
 * `{` as the selector, so prose containing a comma would otherwise be read as
 * extra selectors — and a comment naming a font would look like a declaration.
 *
 * @param {string} file
 * @returns {string}
 */
function styleSheet(file) {
  const source = readFileSync(file, 'utf8');
  let css = source;
  if (file.endsWith('.html')) {
    const start = source.indexOf('<style>');
    const end = source.indexOf('</style>');
    assert.ok(start > 0 && end > start, `${file}: no inline <style> block`);
    css = source.slice(start, end);
  }
  return css.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/**
 * Selectors whose declarations mention `token`, one entry per selector in a
 * comma-separated list.
 *
 * @param {string} css
 * @param {string} token
 * @returns {string[]}
 */
function selectorsUsing(css, token) {
  const found = [];
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    // The `:root` block declares the tokens rather than consuming them.
    if (body.includes(`${token}:`)) continue;
    if (!body.includes(`var(${token})`)) continue;
    for (const part of selector.split(',')) {
      const cleaned = part.replace(/\/\*[\s\S]*?\*\//g, '').trim().replace(/\s+/g, ' ');
      if (cleaned) found.push(cleaned);
    }
  }
  return found;
}

test('the switcher stylesheet retargets the pixel token while translated', () => {
  const css = readFileSync('assets/i18n/i18n.css', 'utf8');
  const block = css.match(/html:not\(\[data-doc-lang="en"\]\)\s*\{([^}]*)\}/);
  assert.ok(block, 'no token-level fallback for translated pages');
  assert.match(block[1], /--ff-pixel:\s*var\(--ff-body\)/,
    'the pixel token must fall back to the body face, which carries Vietnamese');
});

for (const [file, allowed] of Object.entries(LATIN_ONLY)) {
  test(`${file}: only never-translated text opts out of the fallback`, () => {
    const used = selectorsUsing(styleSheet(file), LATIN_TOKEN);
    const unlisted = used.filter((selector) => !(selector in allowed));
    assert.deepEqual(unlisted, [],
      `${file}: these pin the pixel face without a documented reason. If the text is `
      + 'never translated, add it to LATIN_ONLY; otherwise use --ff-pixel so it falls back.');
    // A stale allowlist entry is a rule that quietly stopped applying.
    const stale = Object.keys(allowed).filter((selector) => !used.includes(selector));
    assert.deepEqual(stale, [], `${file}: allowlisted but no longer pinning the pixel face`);
  });

  test(`${file}: the pixel face is only ever named by the token`, () => {
    const css = styleSheet(file);
    for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!body.includes(RAW_FACE)) continue;
      assert.match(body, new RegExp(`${LATIN_TOKEN}:[^;]*${RAW_FACE}`),
        `${selector.trim()}: name the face through ${LATIN_TOKEN}, so the fallback stays in one place`);
    }
  });

  test(`${file}: the plain token routes through the latin one`, () => {
    // --ff-pixel must be defined as var(--ff-pixel-latin); spelling the face
    // out twice would let the two drift apart.
    assert.match(styleSheet(file), /--ff-pixel:\s*var\(--ff-pixel-latin\)/,
      `${file}: --ff-pixel must derive from ${LATIN_TOKEN}`);
  });
}

for (const file of ['index.html', 'assets/builder/builder.css']) {
  test(`${file}: form controls inherit the page font`, () => {
    // Without this the UA face leaks into any control that names no font of
    // its own, and Arial Bold cannot draw ắ ạ ộ ệ — the bug that broke the
    // segmented controls and mode cards. Only the family is inherited, so
    // each component keeps its own size and weight.
    const css = styleSheet(file);
    const inherits = new Set();
    for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/font-family:\s*inherit/.test(body)) continue;
      for (const part of selector.split(',')) inherits.add(part.trim().replace(/\s+/g, ' '));
    }
    for (const control of ['button', 'input', 'select', 'textarea']) {
      assert.ok(inherits.has(control),
        `${file}: \`${control}\` must inherit font-family, or the UA font leaks in`);
    }
  });
}

test('every pixel-font selector is either translatable or allowlisted', () => {
  // The point of the inversion: whatever still uses --ff-pixel is safe, so this
  // only asserts the two sets do not overlap.
  for (const [file, allowed] of Object.entries(LATIN_ONLY)) {
    const fallback = selectorsUsing(styleSheet(file), '--ff-pixel');
    const overlap = fallback.filter((selector) => selector in allowed);
    assert.deepEqual(overlap, [], `${file}: selector claims both the fallback and the latin pin`);
  }
});
