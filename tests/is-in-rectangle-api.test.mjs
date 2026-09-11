import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const spec = readFileSync('openapi.yaml', 'utf8');
const index = readFileSync('index.html', 'utf8');
const sourceIndex = readFileSync('source/index.md', 'utf8');
const slate = readFileSync('LUA_API_SLATE.md', 'utf8');
const hostApi = readFileSync('assets/builder/js/domain/host-api.js', 'utf8');

const summary = "Returns true when the player's current cell is inside the rectangle, including the border.";
const note = 'Coordinates are inclusive. Pass the upper-left corner first and the lower-right corner second. The function does not reorder the values.';
const scenario = 'Use this when a route should behave differently inside a fixed map area. The check is read-only: it does not move the player or consume a path action.';
const parameterDescriptions = [
  "X-coordinate of the rectangle's upper-left corner.",
  "Y-coordinate of the rectangle's upper-left corner.",
  "X-coordinate of the rectangle's lower-right corner.",
  "Y-coordinate of the rectangle's lower-right corner.",
];

function loadPack(path) {
  const sandbox = { window: {} };
  vm.runInNewContext(readFileSync(path, 'utf8'), sandbox);
  return Object.values(sandbox.window.PROCATCHEM_I18N ?? {})[0];
}

test('isInRectangle is documented in the canonical OpenAPI spec', () => {
  assert.match(spec, /\/lua\/map-and-npc\/isinrectangle:/);
  assert.match(spec, /operationId: isInRectangle/);
  assert.match(spec, /x-lua-signature: result = isInRectangle\(upperX, upperY, lowerX, lowerY\)/);
  assert.doesNotMatch(spec, /\binRectangle\b/);
  for (const name of ['upperX', 'upperY', 'lowerX', 'lowerY']) {
    assert.match(spec, new RegExp(`\\n\\s+${name}:`));
  }
});

test('the host list and both Markdown references include isInRectangle', () => {
  assert.match(hostApi, /'isInRectangle'/);
  assert.doesNotMatch(hostApi, /'inRectangle'/);
  for (const text of [sourceIndex, slate]) {
    assert.match(text, /## isInRectangle\(\)/);
    assert.match(text, /`result = isInRectangle\(upperX, upperY, lowerX, lowerY\)`/);
    assert.match(text, new RegExp(summary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('the static reference page exposes isInRectangle in navigation and content', () => {
  assert.match(index, /href="#isinrectangle">isInRectangle\(\)<\/a>/);
  assert.match(index, /<article class="operation" id="isinrectangle">/);
  assert.match(index, /result = isInRectangle\(upperX, upperY, lowerX, lowerY\)/);
  assert.match(index, new RegExp(summary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('every shipped reference-page language translates the new prose', () => {
  for (const code of ['vi', 'ja', 'zh']) {
    const pack = loadPack(`assets/i18n/${code}.js`);
    assert.ok(pack, `${code}: pack did not load`);
    for (const key of [summary, note, scenario, ...parameterDescriptions]) {
      assert.ok(pack.dict[key], `${code}: missing translation for ${key}`);
      assert.notEqual(pack.dict[key], key, `${code}: translation still equals English`);
    }
  }
});
