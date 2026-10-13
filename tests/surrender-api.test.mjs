import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { apiEntry } from '../assets/builder/js/domain/api-catalog.js';
import { HOST_FUNCTIONS } from '../assets/builder/js/domain/host-api.js';

const read = (path) => readFileSync(path, 'utf8');
const spec = read('openapi.yaml');
const page = read('index.html');
const source = read('source/index.md');
const slate = read('LUA_API_SLATE.md');
const builder = read('assets/builder/js/domain/config.js');
const summary = 'Surrenders the current non-wild (Trainer/PvP) battle by sending /surrender.';
const scenario = 'Call from onBattleAction() only when intentionally forfeiting a Trainer or PvP battle. Lua scripts do not show a confirmation dialog.';
const note = 'Returns true when the command is sent, not when the server confirms defeat. Returns false in wild, finished or already-requested battles. A battle-only script error occurs if called outside battle.';

test('surrender is a registered and documented non-wild battle action', () => {
  assert.ok(HOST_FUNCTIONS.includes('surrender'));
  const entry = apiEntry('surrender');
  assert.equal(entry?.group, 'Battle actions');
  assert.equal(entry?.kind, 'action');
  assert.equal(entry?.signature, 'result = surrender()');
  assert.equal(entry?.returns, 'boolean');
  assert.deepEqual(entry?.params, []);
  assert.match(spec, /\/lua\/battle-actions\/surrender:/);
  assert.match(spec, /operationId: surrender/);
  assert.match(spec, /x-lua-signature: result = surrender\(\)/);
  for (const doc of [source, slate, page, spec]) {
    for (const phrase of [summary, scenario, note]) assert.ok(doc.includes(phrase));
  }
  assert.ok(page.includes('href="#surrender">surrender()</a>'));
  assert.ok(page.includes('<article class="operation" id="surrender">'));
  assert.ok(builder.includes("id: 'surrender'"));
  assert.ok(spec.includes('Tries to escape from the'));
  assert.ok(page.includes('Tries to escape from the current wild battle.'));
});

test('the new surrender reference text is translated in the shipped locales', () => {
  for (const language of ['vi', 'ja', 'zh']) {
    const ctx = { window: {} };
    vm.runInNewContext(read('assets/i18n/' + language + '.js'), ctx);
    const pack = ctx.window.PROCATCHEM_I18N[language];
    assert.ok(pack, language);
    for (const key of [summary, scenario, note]) {
      assert.ok(pack.dict[key], language + ': ' + key);
      assert.notEqual(pack.dict[key], key);
    }
  }
});
