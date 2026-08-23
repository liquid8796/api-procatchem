/**
 * Vietnamese translation pack tests.
 *
 * The pack is a classic browser script; evaluate it with a window stub and
 * check it against the shipped index.html so a future API addition that
 * forgets its translation shows up here, not on the live page.
 * Run with: node --test tests/
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const packSource = readFileSync('assets/i18n/vi.js', 'utf8');
const html = readFileSync('index.html', 'utf8');

function loadPack() {
  const sandbox = { window: {} };
  vm.runInNewContext(packSource, sandbox);
  return sandbox.window.PROCATCHEM_VI;
}

test('the pack evaluates as a classic script and exposes the expected shape', () => {
  const pack = loadPack();
  assert.ok(pack, 'window.PROCATCHEM_VI missing');
  assert.ok(pack.meta?.title?.length > 0);
  assert.ok(pack.searchPlaceholder?.length > 0);
  assert.ok(Object.keys(pack.cats).length >= 20);
  assert.ok(Object.keys(pack.dict).length >= 400, `only ${Object.keys(pack.dict).length} entries`);
});

test('every category heading in the page has a Vietnamese name', () => {
  const pack = loadPack();
  const headings = [...html.matchAll(/<h1 id="[^"]+">([^<]+)<\/h1>/g)].map((m) => m[1]);
  assert.ok(headings.length >= 20, `unexpected heading count ${headings.length}`);
  const missing = headings.filter((name) => !pack.cats[name]);
  assert.deepEqual(missing, [], `untranslated categories: ${missing.join(', ')}`);
});

test('structural labels are covered', () => {
  const { dict } = loadPack();
  for (const label of ['Practical scenario', 'Returns', 'Parameters', 'Signature',
    'Name', 'Type', 'Required', 'Description', 'yes', 'no']) {
    assert.ok(dict[label], `missing structural label: ${label}`);
  }
});

test('translations preserve inline code, placeholders, and markup', () => {
  const { dict } = loadPack();
  const snippets = (s, re) => [...s.matchAll(re)].map((m) => m[0]).sort();
  for (const [en, vi] of Object.entries(dict)) {
    assert.notEqual(vi.trim(), '', `empty translation for: ${en.slice(0, 60)}`);
    assert.deepEqual(
      snippets(vi, /<code>.*?<\/code>/g), snippets(en, /<code>.*?<\/code>/g),
      `code tags altered in: ${en.slice(0, 60)}`,
    );
    assert.deepEqual(
      snippets(vi, /\{[a-zA-Z]+\}/g), snippets(en, /\{[a-zA-Z]+\}/g),
      `template placeholders altered in: ${en.slice(0, 60)}`,
    );
    for (const tag of ['<a ', '<strong>', '<span']) {
      assert.equal(
        vi.split(tag).length, en.split(tag).length,
        `${tag} count differs in: ${en.slice(0, 60)}`,
      );
    }
  }
});

test('index.html loads the pack before the switcher, as classic scripts', () => {
  const viAt = html.indexOf('assets/i18n/vi.js');
  const runtimeAt = html.indexOf('assets/i18n/doc-i18n.js');
  assert.ok(viAt > 0 && runtimeAt > 0, 'script tags missing');
  assert.ok(viAt < runtimeAt, 'pack must load before the switcher');
  assert.ok(!/type="module"[^>]*assets\/i18n/.test(html), 'i18n must stay classic for file:// use');
});
