/**
 * Script Builder translation-pack tests.
 *
 * The builder translates at render time through `t()` in core/i18n.js, so the
 * guard here is source-driven: every string literal passed to t(), and every
 * label the UI renders from a data module, must have an entry in each pack.
 * A feature added without its translation fails here, not on the live page.
 * Run with: node --test tests/
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { t, setLanguage, languages } from '../assets/builder/js/core/i18n.js';
import { ja } from '../assets/builder/js/i18n/ja.js';
import { vi } from '../assets/builder/js/i18n/vi.js';
import { zh } from '../assets/builder/js/i18n/zh.js';
import {
  BALL_CONDITIONS, CHAIN_ACTIONS, END_BEHAVIOURS, EV_STATS, FARM_ACTIONS,
  HEAL_ACTIONS, HELPER_PRESETS, HELPER_TRIGGERS, OTHER_POLICIES, ROTATION_MODES,
  RULE_FALLBACKS, STEP_ACTIONS, STOP_MOUNT_MODES, STOP_TERRAINS, SWITCH_MODES,
  TARGET_ACTIONS, TIME_PERIODS, TRAINER_POLICIES, TRAPPED_POLICIES, WEAKEN_MODES,
  ZONE_ROTATION_MODES,
} from '../assets/builder/js/domain/config.js';
import { CONDITION_KINDS, OPPONENT_GENDERS, STATUS_VALUES } from '../assets/builder/js/domain/condition.js';
import { TEMPLATES } from '../assets/builder/js/domain/templates.js';
import { modeRegistry } from '../assets/builder/js/generators/mode-registry.js';
import { HANDBOOK_SECTIONS } from '../assets/builder/js/ui/handbook.js';

const JS_ROOT = 'assets/builder/js';
const PACKS = [ja, vi, zh];

/** Every builder source file except the packs themselves. */
function sourceFiles(dir = JS_ROOT) {
  /** @type {string[]} */
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...sourceFiles(path));
    else if (name.endsWith('.js') && !path.replaceAll('\\', '/').includes('/i18n/')) files.push(path);
  }
  return files;
}

/**
 * Read one (possibly `'a' + 'b'`-concatenated) string literal starting at the
 * opening quote. Returns null when the argument is not a plain literal.
 *
 * @param {string} source
 * @param {number} start index of the opening quote
 * @returns {{ text: string, end: number } | null}
 */
function readLiteral(source, start) {
  let text = '';
  let i = start;
  for (;;) {
    const quote = source[i];
    if (quote !== "'" && quote !== '"') return null;
    i += 1;
    while (i < source.length && source[i] !== quote) {
      if (source[i] === '\\') {
        text += source[i + 1];
        i += 2;
        continue;
      }
      text += source[i];
      i += 1;
    }
    i += 1; // closing quote
    const rest = source.slice(i).match(/^\s*\+\s*/);
    if (!rest) return { text, end: i };
    i += rest[0].length;
  }
}

/** Every `t('…')` first argument written as a literal, across the builder. */
function collectTKeys() {
  /** @type {Map<string, string>} key -> first file seen in */
  const keys = new Map();
  for (const file of sourceFiles()) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\bt\(\s*/g)) {
      const literal = readLiteral(source, match.index + match[0].length);
      if (literal && !keys.has(literal.text)) keys.set(literal.text, file);
    }
  }
  return keys;
}

test('the builder registers Vietnamese alongside English', () => {
  const codes = languages().map((entry) => entry.code);
  assert.deepEqual(codes[0], 'en', 'English must come first');
  assert.ok(codes.includes('vi'), `expected vi, got ${codes.join(', ')}`);
});

test('every pack declares the fields the runtime needs', () => {
  for (const pack of PACKS) {
    assert.ok(pack.code, 'missing code');
    assert.ok(pack.label?.length > 0, `${pack.code}: missing label`);
    assert.ok(pack.meta?.title?.length > 0, `${pack.code}: missing meta.title`);
    assert.ok(pack.meta?.description?.length > 0, `${pack.code}: missing meta.description`);
    assert.ok(Object.keys(pack.dict).length >= 400, `${pack.code}: only ${Object.keys(pack.dict).length} entries`);
  }
});

test('every literal passed to t() has a translation in each pack', () => {
  const keys = collectTKeys();
  assert.ok(keys.size >= 250, `suspiciously few t() literals found: ${keys.size}`);
  for (const pack of PACKS) {
    const missing = [...keys].filter(([key]) => !pack.dict[key]);
    assert.deepEqual(
      missing.map(([key, file]) => `${file}: ${key}`),
      [],
      `${pack.code}: untranslated t() literals`,
    );
  }
});

/**
 * Field descriptors are data, not `t()` calls, so they need their own scan.
 *
 * @param {string} file
 * @returns {string[]}
 */
function fieldLiterals(file) {
  const source = readFileSync(file, 'utf8');
  /** @type {string[]} */
  const literals = [];
  for (const match of source.matchAll(/\b(?:title|subtitle|label|hint|addLabel):\s*/g)) {
    const literal = readLiteral(source, match.index + match[0].length);
    if (literal) literals.push(literal.text);
  }
  return literals;
}

test('panels.js field labels and hints are covered', () => {
  const literals = fieldLiterals(`${JS_ROOT}/ui/panels.js`);
  assert.ok(literals.length >= 60, `suspiciously few panel strings found: ${literals.length}`);
  for (const pack of PACKS) {
    const missing = literals.filter((key) => !pack.dict[key]);
    assert.deepEqual(missing, [], `${pack.code}: untranslated panel strings`);
  }
});

test('the quick form asks its questions in every language', () => {
  // Its fields go through the same renderer as the panels, so they translate
  // the same way — and are just as easy to add without a translation.
  const literals = fieldLiterals(`${JS_ROOT}/ui/quick-build.js`);
  assert.ok(literals.length >= 20, `suspiciously few quick-form strings found: ${literals.length}`);
  for (const pack of PACKS) {
    const missing = literals.filter((key) => !pack.dict[key]);
    assert.deepEqual(missing, [], `${pack.code}: untranslated quick-form strings`);
  }
});

test('option lists rendered by the form are covered', () => {
  const labelled = [
    ...FARM_ACTIONS, ...HEAL_ACTIONS, ...END_BEHAVIOURS, ...EV_STATS,
    ...WEAKEN_MODES, ...OTHER_POLICIES, ...TRAINER_POLICIES, ...TRAPPED_POLICIES,
    ...BALL_CONDITIONS, ...ZONE_ROTATION_MODES, ...STOP_MOUNT_MODES, ...STOP_TERRAINS,
    ...ROTATION_MODES, ...STEP_ACTIONS, ...RULE_FALLBACKS, ...HELPER_TRIGGERS,
    ...TIME_PERIODS, ...STATUS_VALUES, ...OPPONENT_GENDERS,
    ...SWITCH_MODES, ...TARGET_ACTIONS,
  ];
  for (const pack of PACKS) {
    const missing = new Set();
    for (const entry of labelled) {
      if (entry.label && !pack.dict[entry.label]) missing.add(entry.label);
      // Stop-list hints never render, but every other hint reaches a tooltip
      // or a select caption, so hold them all to the same bar.
      if (entry.hint && !pack.dict[entry.hint]) missing.add(entry.hint);
    }
    for (const preset of HELPER_PRESETS) {
      if (!pack.dict[preset.hint]) missing.add(preset.hint);
    }
    // Chain links read as code (`attack()`); only the one prose label counts.
    const prose = CHAIN_ACTIONS.find((entry) => entry.id === 'rawLua');
    if (!pack.dict[prose.label]) missing.add(prose.label);
    assert.deepEqual([...missing], [], `${pack.code}: untranslated option labels`);
  }
});

test('condition kinds, their parameters, and their groups are covered', () => {
  for (const pack of PACKS) {
    const missing = new Set();
    for (const spec of Object.values(CONDITION_KINDS)) {
      if (!pack.dict[spec.label]) missing.add(spec.label);
      if (!pack.dict[spec.group]) missing.add(spec.group);
      for (const param of spec.params) {
        if (param.label && !pack.dict[param.label]) missing.add(param.label);
        if (param.hint && !pack.dict[param.hint]) missing.add(param.hint);
        for (const option of param.options ?? []) {
          // Comparator glyphs (≥, =, …) are language-neutral.
          if (/[a-z]/i.test(option.label) && !pack.dict[option.label]) missing.add(option.label);
        }
      }
    }
    assert.deepEqual([...missing], [], `${pack.code}: untranslated condition strings`);
  }
});

test('farm modes and templates are covered', () => {
  for (const pack of PACKS) {
    const missing = new Set();
    for (const mode of modeRegistry.all()) {
      for (const text of [mode.label, mode.tagline, mode.description]) {
        if (!pack.dict[text]) missing.add(text);
      }
    }
    for (const template of TEMPLATES) {
      if (!pack.dict[template.label]) missing.add(template.label);
      if (!pack.dict[template.description]) missing.add(template.description);
    }
    assert.deepEqual([...missing], [], `${pack.code}: untranslated modes or templates`);
  }
});

test('the handbook is fully translated, Lua samples excepted', () => {
  for (const pack of PACKS) {
    const missing = [];
    for (const section of HANDBOOK_SECTIONS) {
      if (!pack.dict[section.title]) missing.push(section.title);
      for (const paragraph of section.paragraphs) {
        if (!pack.dict[paragraph]) missing.push(paragraph.slice(0, 60));
      }
    }
    assert.deepEqual(missing, [], `${pack.code}: untranslated handbook content`);
  }
});

test('static builder.html strings are covered', () => {
  const labels = [
    'Look things up', 'Map data', 'Start from a template', 'Presets',
    'Search the Lua API', 'Show the script structure', 'How this works',
    'Load link graph', 'Edit, check, repair…', 'Clear', 'Load this template',
    'Open a script or preset', 'Save preset', 'Reset everything',
    '← Back to the API reference', 'Trainer’s Field Manual', 'generated script',
    'Hide', 'Copy script', 'Download .lua', 'Diagnostics', 'Script',
    'Drop a link graph or a generated script', 'Assemble a run',
    'Script details', 'Farm mode', 'Where to hunt', 'Farm zones',
    'Stops and time of day', 'What to catch', 'Battle plan', 'Battle rules',
    'Team and healing', 'Session safety',
    'Link graph tools', 'Lua API reference', 'Script structure',
    'How the generated script works', 'Template', 'Hide the generated script',
    'Builder sections',
  ];
  for (const pack of PACKS) {
    const missing = labels.filter((label) => !pack.dict[label]);
    assert.deepEqual(missing, [], `${pack.code}: untranslated static strings`);
  }
});

test('translations keep placeholders, markup, and substance', () => {
  const tokens = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
  const tags = (text) => [...text.matchAll(/<\/?\w+>/g)].map((match) => match[0]).sort();
  for (const pack of PACKS) {
    for (const [en, translated] of Object.entries(pack.dict)) {
      assert.notEqual(translated.trim(), '', `${pack.code}: empty translation for: ${en.slice(0, 60)}`);
      const enTokens = new Set(tokens(en));
      for (const token of tokens(translated)) {
        assert.ok(enTokens.has(token), `${pack.code}: invented placeholder {${token}} in: ${en.slice(0, 60)}`);
      }
      assert.deepEqual(tags(translated), tags(en), `${pack.code}: markup altered in: ${en.slice(0, 60)}`);
    }
  }
});

test('t() falls back to English and fills placeholders', () => {
  setLanguage('en', false);
  assert.equal(t('No problems found — this script is ready to run.'),
    'No problems found — this script is ready to run.');
  assert.equal(t('Saved {name}.', { name: 'run.lua' }), 'Saved run.lua.');
  assert.equal(t('not a key at all'), 'not a key at all');

  setLanguage('vi', false);
  assert.equal(t('Saved {name}.', { name: 'run.lua' }), 'Đã lưu run.lua.');
  assert.equal(t('never translated either'), 'never translated either');
  setLanguage('en', false);
});

test('builder.html loads the shared switcher stylesheet', () => {
  const html = readFileSync('builder.html', 'utf8');
  assert.match(html, /<link href="assets\/i18n\/i18n\.css" rel="stylesheet"\/>/);
});

test('the builder wires the switcher and static pass at boot', () => {
  const main = readFileSync(`${JS_ROOT}/main.js`, 'utf8');
  assert.match(main, /installLanguageSwitcher\(\)/);
  assert.match(main, /applyStaticText\(\)/);
  assert.match(main, /onLanguageChange\(/);
});
