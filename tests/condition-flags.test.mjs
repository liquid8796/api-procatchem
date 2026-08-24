/**
 * Conditions that read state the game only ever announces, plus the checks
 * added alongside them.
 *
 * Run with: node --test tests/
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { LuaWriter } from '../assets/builder/js/core/lua-writer.js';
import {
  CONDITION_KINDS,
  collectConditionFlags,
  emitCondition,
  normaliseGender,
} from '../assets/builder/js/domain/condition.js';
import { createDefaultConfig, normaliseConfig } from '../assets/builder/js/domain/config.js';
import { LinkGraph } from '../assets/builder/js/domain/link-graph.js';
import { generateScript } from '../assets/builder/js/generators/index.js';

/**
 * @param {string} kind
 * @param {object} params
 * @returns {{ expression: string, writer: LuaWriter }}
 */
function emitLeaf(kind, params = {}) {
  const writer = new LuaWriter();
  return { expression: emitCondition({ kind, params, negate: false }, writer), writer };
}

/**
 * Build a rules-mode script whose only rule matches on `items`.
 *
 * @param {object[]} items
 * @returns {import('../assets/builder/js/generators/index.js').GenerationResult}
 */
function buildWithMatch(items) {
  const config = createDefaultConfig();
  config.mode = 'rules';
  config.rules = [{
    id: 'r1',
    label: 'Only rule',
    match: { op: 'and', negate: false, items },
    fallback: 'attack',
    steps: [{ id: 's1', action: 'attack', when: { op: 'and', negate: false, items: [] } }],
  }];
  return generateScript(normaliseConfig(config), new LinkGraph());
}

test('every condition kind emits something without throwing', () => {
  for (const kind of Object.keys(CONDITION_KINDS)) {
    const { expression } = emitLeaf(kind, defaultParams(kind));
    assert.equal(typeof expression, 'string', `${kind} did not return an expression`);
    assert.ok(expression.length, `${kind} returned an empty expression`);
  }
});

/** @param {string} kind @returns {object} */
function defaultParams(kind) {
  const spec = CONDITION_KINDS[kind];
  /** @type {Record<string, unknown>} */
  const params = {};
  for (const param of spec.params) {
    if (param.type === 'chips') params[param.key] = ['phrase'];
    else if (param.type === 'number') params[param.key] = param.min ?? 1;
    else if (param.type === 'comparator') params[param.key] = '>=';
    else if (param.type === 'select') params[param.key] = param.options?.[0]?.id ?? '';
    else if (param.type === 'evStat') params[param.key] = 'ATK';
    else if (param.type === 'apiFunction') params[param.key] = 'isOutside';
    else params[param.key] = 'x';
  }
  return params;
}

// ------------------------------------------------------------ message flags

test('a latching flag reads as a plain boolean', () => {
  const { expression } = emitLeaf('heardText', { on: ['was taunted'], off: [], turns: 0 });
  assert.match(expression, /^heard_was_taunted_[a-z0-9]{6}$/);
});

test('a timed flag compares against the turn it was heard on', () => {
  const { expression, writer } = emitLeaf('heardText', { on: ['is confused'], off: [], turns: 3 });
  assert.match(expression, /^\(heard_is_confused_[a-z0-9]{6} > 0 and getBattleTurn\(\) <= heard_is_confused_[a-z0-9]{6} \+ 3\)$/);
  assert.ok(writer.hostCalls().includes('getBattleTurn'));
});

test('two leaves listening for the same phrases share one flag', () => {
  const params = { on: ['was taunted'], off: ['shook off'], turns: 0 };
  const flags = collectConditionFlags({
    op: 'and',
    negate: false,
    items: [
      { kind: 'heardText', params: { ...params }, negate: false },
      { kind: 'heardText', params: { ...params }, negate: false },
    ],
  });
  assert.equal(flags.size, 1);
});

test('changing any part of the phrase set makes a different flag', () => {
  const flags = collectConditionFlags({
    op: 'and',
    negate: false,
    items: [
      { kind: 'heardText', params: { on: ['a'], off: [], turns: 0 }, negate: false },
      { kind: 'heardText', params: { on: ['a'], off: ['b'], turns: 0 }, negate: false },
      { kind: 'heardText', params: { on: ['a'], off: [], turns: 2 }, negate: false },
    ],
  });
  assert.equal(flags.size, 3);
});

test('a flag with no phrases still produces a usable name', () => {
  const flags = collectConditionFlags({
    op: 'and', negate: false, items: [{ kind: 'heardText', params: {}, negate: false }],
  });
  const [flag] = [...flags.values()];
  assert.match(flag.name, /^heard_[a-z0-9_]+$/);
  assert.ok(flag.on.length, 'an empty listener would never match anything');
});

test('a flag is declared, raised, cleared, and reset between battles', () => {
  const result = buildWithMatch([
    { kind: 'heardText', params: { on: ['was taunted'], off: ['shook off the taunt'], turns: 0 }, negate: false },
  ]);
  const name = /local (heard_was_taunted_[a-z0-9]{6}) = false/.exec(result.lua)?.[1];
  assert.ok(name, 'the flag was not declared');

  assert.match(result.lua, new RegExp(`if stringContains\\(message, "was taunted"\\) then ${name} = true end`));
  assert.match(result.lua, new RegExp(`if stringContains\\(message, "shook off the taunt"\\) then ${name} = false end`));
  // onPathAction only runs between battles, which is what makes it the reset point.
  const pathAction = result.lua.slice(result.lua.indexOf('function onPathAction()'));
  assert.match(pathAction, new RegExp(`${name} = false`));
  assert.deepEqual(result.unknownCalls, []);
});

test('a timed flag stores the turn and resets to zero', () => {
  const result = buildWithMatch([
    { kind: 'heardText', params: { on: ['is confused'], off: [], turns: 2 }, negate: false },
  ]);
  const name = /local (heard_is_confused_[a-z0-9]{6}) = 0/.exec(result.lua)?.[1];
  assert.ok(name, 'a timed flag should start at 0');
  assert.match(result.lua, new RegExp(`if stringContains\\(message, "is confused"\\) then ${name} = getBattleTurn\\(\\) end`));
});

test('an announced ability is a flag over the ability names', () => {
  const result = buildWithMatch([
    { kind: 'oppAbility', params: { names: ['Contrary', 'Intimidate'] }, negate: false },
  ]);
  assert.match(result.lua, /if stringContains\(message, "Contrary"\) or stringContains\(message, "Intimidate"\) then heard_contrary_[a-z0-9]{6} = true end/);
  assert.deepEqual(result.unknownCalls, []);
});

test('a phrase with a quote in it cannot break out of the Lua literal', () => {
  const result = buildWithMatch([
    { kind: 'heardText', params: { on: ['say "hi"'], off: [], turns: 0 }, negate: false },
  ]);
  assert.match(result.lua, /stringContains\(message, "say \\"hi\\""\)/);
  assert.deepEqual(result.unknownCalls, []);
});

// ------------------------------------------------------------------ gender

test('gender conditions emit what the host actually returns', () => {
  assert.equal(emitLeaf('oppGender', { gender: 'F' }).expression, 'getOpponentGender() == "F"');
  assert.equal(emitLeaf('slotGender', { slot: 2, gender: 'M' }).expression, 'getPokemonGender(2) == "M"');
});

test('the long spellings a saved config may hold are migrated', () => {
  assert.equal(normaliseGender('Male'), 'M');
  assert.equal(normaliseGender('female'), 'F');
  assert.equal(normaliseGender('m'), 'M');
  assert.equal(normaliseGender(''), '');
  assert.equal(normaliseGender('nonsense'), '');
  assert.equal(emitLeaf('oppGender', { gender: 'Female' }).expression, 'getOpponentGender() == "F"');
});

test('a target filter loaded with the old gender spelling is corrected', () => {
  const config = normaliseConfig({ ...createDefaultConfig(), target: { ...createDefaultConfig().target, gender: 'Female' } });
  assert.equal(config.target.gender, 'F');
  const result = generateScript(config, new LinkGraph());
  assert.match(result.lua, /getOpponentGender\(\) == "F"/);
});

// -------------------------------------------------------- the other new kinds

test('the numeric and slot conditions emit the calls they claim', () => {
  assert.equal(emitLeaf('oppForm').expression, 'getOpponentForm() ~= 0');
  assert.equal(emitLeaf('money', { cmp: '>=', value: 5000 }).expression, 'getMoney() >= 5000');
  assert.equal(emitLeaf('activeSlot', { slot: 3 }).expression, 'getActivePokemonNumber() == 3');
  assert.equal(emitLeaf('activeUsable').expression, 'isPokemonUsable(getActivePokemonNumber())');
  assert.equal(
    emitLeaf('slotEv', { slot: 1, stat: 'atk', cmp: '<', value: 252 }).expression,
    'getPokemonEffortValue(1, "ATK") < 252',
  );
});

test('a guided API call can be a truth test or a comparison', () => {
  assert.equal(emitLeaf('apiCall', { fn: 'isOutside', args: '', cmp: '', value: '' }).expression, 'isOutside()');
  assert.equal(
    emitLeaf('apiCall', { fn: 'getPlayerX', args: '', cmp: '>=', value: '10' }).expression,
    '(getPlayerX() >= 10)',
  );
});

test('a guided API call with no function is false rather than silently true', () => {
  assert.equal(emitLeaf('apiCall', { fn: '', args: '', cmp: '', value: '' }).expression, 'false');
});

test('an unrecognised comparator falls back to a truth test, never to raw text', () => {
  const { expression } = emitLeaf('apiCall', { fn: 'isOutside', args: '', cmp: 'DROP TABLE', value: '1' });
  assert.equal(expression, 'isOutside()');
});
