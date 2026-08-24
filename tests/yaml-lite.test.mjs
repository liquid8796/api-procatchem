/**
 * The build-time YAML reader. It only has to cover the subset openapi.yaml uses,
 * but it has to cover it exactly — a silent mis-parse becomes a catalog that
 * lies about the API.
 *
 * Run with: node --test tests/
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { parseYaml } from '../scripts/lib/yaml-lite.mjs';

test('reads nested mappings by indentation', () => {
  assert.deepEqual(parseYaml('a:\n  b:\n    c: 1\n'), { a: { b: { c: 1 } } });
});

test('reads a sequence at the same column as its key', () => {
  assert.deepEqual(parseYaml('tags:\n- One\n- Two\n'), { tags: ['One', 'Two'] });
});

test('reads a sequence indented under its key', () => {
  assert.deepEqual(parseYaml('tags:\n  - One\n  - Two\n'), { tags: ['One', 'Two'] });
});

test('reads mappings inside sequence items', () => {
  const doc = parseYaml('x-codeSamples:\n- lang: Lua\n  source: log("hi")\n');
  assert.deepEqual(doc, { 'x-codeSamples': [{ lang: 'Lua', source: 'log("hi")' }] });
});

test('a sequence item may open a nested block', () => {
  const doc = parseYaml('items:\n- name: a\n  spec:\n    type: string\n- name: b\n');
  assert.deepEqual(doc, { items: [{ name: 'a', spec: { type: 'string' } }, { name: 'b' }] });
});

test('scalars keep their JSON-ish types', () => {
  assert.deepEqual(
    parseYaml('i: 3\nf: -1.5\nt: true\nf2: false\nn: null\ne:\ns: hello\n'),
    { i: 3, f: -1.5, t: true, f2: false, n: null, e: null, s: 'hello' },
  );
});

test('empty flow collections are understood', () => {
  assert.deepEqual(parseYaml('a: {}\nb: []\n'), { a: {}, b: [] });
});

test('quoted keys are unwrapped', () => {
  assert.deepEqual(parseYaml("responses:\n  '200':\n    ok: true\n"), { responses: { 200: { ok: true } } });
});

test('a plain scalar folds its continuation lines with spaces', () => {
  const doc = parseYaml('description: Keys are variable names, e.g.\n  pokemon for {pokemon}.\nnext: 1\n');
  assert.deepEqual(doc, { description: 'Keys are variable names, e.g. pokemon for {pokemon}.', next: 1 });
});

test('a single-quoted scalar folds a line break to a space', () => {
  assert.equal(parseYaml("d: 'one\n  two'\n").d, 'one two');
});

test('a blank line inside a quoted scalar folds to a newline', () => {
  assert.equal(parseYaml("d: 'one\n\n  two'\n").d, 'one\ntwo');
});

test("'' inside a single-quoted scalar is a literal quote", () => {
  assert.equal(parseYaml("d: 'it''s here'\n").d, "it's here");
});

test('a double-quoted scalar applies escapes', () => {
  assert.equal(parseYaml('d: "a\\nb\\tc \\"q\\" \\\\"\n').d, 'a\nb\tc "q" \\');
});

test('a trailing backslash swallows the line break, and \\  is a literal space', () => {
  // The exact shape the OpenAPI emitter produces when wrapping a long string.
  const doc = parseYaml('d: "Uses the specified\\\n  \\ move in the battle."\n');
  assert.equal(doc.d, 'Uses the specified move in the battle.');
});

test('a colon inside a quoted scalar does not start a new key', () => {
  assert.deepEqual(parseYaml('d: "format : {\\"x\\" = 1}"\nnext: 2\n'), { d: 'format : {"x" = 1}', next: 2 });
});

test('unicode escapes are decoded', () => {
  assert.equal(parseYaml('d: "\\u00e9\\x41"\n').d, 'éA');
});

test('comments are ignored', () => {
  assert.deepEqual(parseYaml('# leading\na: 1 # trailing\n'), { a: 1 });
});

test('an empty document is null', () => {
  assert.equal(parseYaml('\n\n# nothing\n'), null);
});

test('unsupported constructs are rejected rather than guessed at', () => {
  assert.throws(() => parseYaml('a: &anchor 1\n'), /anchors/);
  assert.throws(() => parseYaml('a: |\n  block\n'), /block scalars/);
  assert.throws(() => parseYaml('a: [1, 2]\n'), /flow collections/);
  assert.throws(() => parseYaml('a: "unterminated\n'), /unterminated/);
  assert.throws(() => parseYaml('a: "bad \\q"\n'), /unknown escape/);
  assert.throws(() => parseYaml('\ta: 1\n'), /tabs/);
});
