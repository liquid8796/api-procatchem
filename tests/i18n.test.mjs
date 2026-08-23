/**
 * Translation pack tests.
 *
 * Packs are classic browser scripts; evaluate them with a window stub and
 * check them against the shipped index.html so a future API addition that
 * forgets its translation shows up here, not on the live page.
 * Run with: node --test tests/
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const PACK_DIR = 'assets/i18n';
const RUNTIME = 'doc-i18n.js';
const html = readFileSync('index.html', 'utf8');
const runtimeSource = readFileSync(`${PACK_DIR}/${RUNTIME}`, 'utf8');

/** Evaluate every pack file into one registry, exactly as the page does. */
function loadRegistry() {
  const sandbox = { window: {} };
  for (const file of readdirSync(PACK_DIR)) {
    if (!file.endsWith('.js') || file === RUNTIME) continue;
    vm.runInNewContext(readFileSync(`${PACK_DIR}/${file}`, 'utf8'), sandbox);
  }
  return sandbox.window.PROCATCHEM_I18N ?? {};
}

test('packs self-register into the shared registry', () => {
  const registry = loadRegistry();
  const codes = Object.keys(registry);
  assert.ok(codes.length >= 1, 'no packs registered');
  assert.ok(codes.includes('vi'), `expected a vi pack, got ${codes.join(', ')}`);
});

test('every pack declares the fields the switcher needs', () => {
  const registry = loadRegistry();
  for (const [code, pack] of Object.entries(registry)) {
    assert.equal(pack.code, code, `${code}: code field must match its registry key`);
    assert.ok(pack.label?.length > 0, `${code}: missing a human-readable label`);
    assert.ok(pack.meta?.title?.length > 0, `${code}: missing meta.title`);
    assert.ok(pack.searchPlaceholder?.length > 0, `${code}: missing searchPlaceholder`);
    assert.ok(Object.keys(pack.cats).length >= 20, `${code}: category map looks short`);
    assert.ok(Object.keys(pack.dict).length >= 400, `${code}: only ${Object.keys(pack.dict).length} entries`);
  }
});

test('every category heading in the page has a translation in each pack', () => {
  const registry = loadRegistry();
  const headings = [...html.matchAll(/<h1 id="[^"]+">([^<]+)<\/h1>/g)].map((m) => m[1]);
  assert.ok(headings.length >= 20, `unexpected heading count ${headings.length}`);
  for (const [code, pack] of Object.entries(registry)) {
    const missing = headings.filter((name) => !pack.cats[name]);
    assert.deepEqual(missing, [], `${code}: untranslated categories: ${missing.join(', ')}`);
  }
});

test('structural labels are covered by every pack', () => {
  const registry = loadRegistry();
  const labels = ['Practical scenario', 'Returns', 'Parameters', 'Signature',
    'Name', 'Type', 'Required', 'Description', 'yes', 'no'];
  for (const [code, pack] of Object.entries(registry)) {
    for (const label of labels) {
      assert.ok(pack.dict[label], `${code}: missing structural label "${label}"`);
    }
  }
});

test('translations preserve inline code, placeholders, and markup', () => {
  const registry = loadRegistry();
  const snippets = (s, re) => [...s.matchAll(re)].map((m) => m[0]).sort();
  for (const [code, pack] of Object.entries(registry)) {
    for (const [en, translated] of Object.entries(pack.dict)) {
      assert.notEqual(translated.trim(), '', `${code}: empty translation for: ${en.slice(0, 60)}`);
      assert.deepEqual(
        snippets(translated, /<code>.*?<\/code>/g), snippets(en, /<code>.*?<\/code>/g),
        `${code}: code tags altered in: ${en.slice(0, 60)}`,
      );
      assert.deepEqual(
        snippets(translated, /\{[a-zA-Z]+\}/g), snippets(en, /\{[a-zA-Z]+\}/g),
        `${code}: template placeholders altered in: ${en.slice(0, 60)}`,
      );
      for (const tag of ['<a ', '<strong>', '<span']) {
        assert.equal(
          translated.split(tag).length, en.split(tag).length,
          `${code}: ${tag} count differs in: ${en.slice(0, 60)}`,
        );
      }
    }
  }
});

test('index.html loads every pack before the switcher, as classic scripts', () => {
  const runtimeAt = html.indexOf(`${PACK_DIR}/${RUNTIME}`);
  assert.ok(runtimeAt > 0, 'switcher script tag missing');

  for (const file of readdirSync(PACK_DIR)) {
    if (!file.endsWith('.js') || file === RUNTIME) continue;
    const at = html.indexOf(`${PACK_DIR}/${file}`);
    assert.ok(at > 0, `${file} is not referenced by index.html`);
    assert.ok(at < runtimeAt, `${file} must load before the switcher`);
  }
  assert.ok(!/type="module"[^>]*assets\/i18n/.test(html), 'i18n must stay classic for file:// use');
});

test('the switcher renders a select, not a fixed set of buttons', () => {
  assert.match(runtimeSource, /createElement\('select'\)/, 'expected a <select> control');
  assert.match(runtimeSource, /id = 'doc-lang-select'/);
  // Options come from the registry, so a new pack needs no edit here.
  assert.match(runtimeSource, /\[\{ code: SOURCE_CODE, label: SOURCE_LABEL \}\]\.concat\(packs\)/);
  assert.ok(!/data-lang="vi"/.test(runtimeSource), 'no language may be hardcoded in the switcher');
  assert.ok(!/PROCATCHEM_VI/.test(runtimeSource), 'switcher must read the registry, not one pack');
});

test('the switcher is positioned at the top right', () => {
  assert.match(runtimeSource, /\.lang-picker\{position:fixed;top:16px;right:24px/);
});

test('switching restores English before applying a pack', () => {
  // Going straight from one translation to another only works because the
  // English original is put back first; the dictionary keys are English.
  const setLanguage = runtimeSource.slice(
    runtimeSource.indexOf('function setLanguage'),
    runtimeSource.indexOf('function injectStyles'),
  );
  const restoreAt = setLanguage.indexOf('restoreSource()');
  const applyAt = setLanguage.indexOf('applyPack(pack)');
  assert.ok(restoreAt > 0 && applyAt > 0, 'expected both calls in setLanguage');
  assert.ok(restoreAt < applyAt, 'restoreSource() must run before applyPack()');
});
