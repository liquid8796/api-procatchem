/**
 * The generated API catalog must stay in step with openapi.yaml and with the
 * host's own list of globals.
 *
 * Run with: node --test tests/
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildCatalog, renderModule } from '../scripts/build-api-catalog.mjs';
import {
  API_ENTRIES,
  API_GROUPS,
  API_VERSION,
  apiEntry,
} from '../assets/builder/js/domain/api-catalog.js';
import { HOST_CALLBACKS, HOST_FUNCTIONS } from '../assets/builder/js/domain/host-api.js';

const SPEC = readFileSync('openapi.yaml', 'utf8');
const CATALOG_PATH = 'assets/builder/js/domain/api-catalog.js';

/**
 * Globals the host registers that openapi.yaml does not document yet.
 *
 * Listed rather than ignored so the gap is visible: if the spec gains one of
 * these, or the host gains a new undocumented global, this test says so.
 */
const UNDOCUMENTED_HOST_GLOBALS = [
  'setBattleTimeout', 'setDialogTimeout', 'setFishingTimeout', 'setItemUseTimeout',
  'setLoadingMapTimeout', 'setLoadingTimeout', 'setMountingTimeout', 'setMoveRelearnerTimeout',
  'setMovementTimeout', 'setNpcBattleTimeout', 'setRefreshingPCBoxTimeout', 'setSwapTimeout',
  'setTeleportationTimeout',
];

test('the checked-in catalog matches openapi.yaml', () => {
  const expected = renderModule(buildCatalog(SPEC));
  const actual = readFileSync(CATALOG_PATH, 'utf8');
  assert.equal(
    actual,
    expected,
    `${CATALOG_PATH} is stale — run "npm run build:catalog"`,
  );
});

test('the catalog version tracks the spec version', () => {
  const specVersion = /^\s{2}version:\s*(\S+)\s*$/m.exec(SPEC)?.[1];
  assert.equal(API_VERSION, specVersion);
});

test('every documented function is a real host global', () => {
  const host = new Set([...HOST_FUNCTIONS, ...HOST_CALLBACKS]);
  const strays = API_ENTRIES.map((entry) => entry.name).filter((name) => !host.has(name));
  assert.deepEqual(strays, [], 'documented functions the host does not register');
});

test('the undocumented host globals are exactly the ones we know about', () => {
  const documented = new Set(API_ENTRIES.map((entry) => entry.name));
  const missing = [...HOST_FUNCTIONS, ...HOST_CALLBACKS]
    .filter((name) => !documented.has(name))
    .sort();
  assert.deepEqual(missing, [...UNDOCUMENTED_HOST_GLOBALS].sort());
});

test('entries are sorted, unique, and fully populated', () => {
  const names = API_ENTRIES.map((entry) => entry.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)), 'not sorted by name');
  assert.equal(new Set(names).size, names.length, 'duplicate entries');

  for (const entry of API_ENTRIES) {
    assert.ok(entry.group, `${entry.name}: missing group`);
    assert.ok(API_GROUPS.includes(entry.group), `${entry.name}: group "${entry.group}" is not a spec tag`);
    assert.ok(entry.signature.includes(entry.name), `${entry.name}: signature does not name the function`);
    assert.ok(entry.summary.length > 0, `${entry.name}: empty summary`);
    assert.ok(Array.isArray(entry.params), `${entry.name}: params must be a list`);
    assert.ok(entry.returns.length > 0, `${entry.name}: missing return type`);
  }
});

test('parameters carry a name, a type, and a required flag', () => {
  for (const entry of API_ENTRIES) {
    for (const param of entry.params) {
      assert.ok(param.name, `${entry.name}: unnamed parameter`);
      assert.ok(param.type, `${entry.name}.${param.name}: missing type`);
      assert.equal(typeof param.required, 'boolean', `${entry.name}.${param.name}: required must be a boolean`);
    }
  }
});

test('a signature lists exactly the parameters the catalog records', () => {
  for (const entry of API_ENTRIES) {
    const inside = /\(([^)]*)\)/.exec(entry.signature)?.[1] ?? '';
    const named = inside.split(',').map((part) => part.trim()).filter(Boolean);
    assert.equal(
      named.length,
      entry.params.length,
      `${entry.name}: signature "${entry.signature}" lists ${named.length} arguments but the catalog records ${entry.params.length}`,
    );
  }
});

test('apiEntry looks up by name and reports misses as null', () => {
  assert.equal(apiEntry('useMove')?.returns, 'boolean');
  assert.deepEqual(apiEntry('useMove')?.params.map((p) => p.name), ['moveName']);
  assert.equal(apiEntry('moveToMap')?.name, 'moveToMap', 'retired functions stay in the catalog');
  assert.equal(apiEntry('definitelyNotAFunction'), null);
});
