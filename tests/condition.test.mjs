/**
 * Condition tree tests.
 * Run with: node --test tests/
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { LuaWriter } from '../assets/builder/js/core/lua-writer.js';
import {
  CONDITION_KINDS,
  collectConditionHelpers,
  createLeaf,
  emitCondition,
  emptyGroup,
  isEmptyCondition,
  normaliseCondition,
} from '../assets/builder/js/domain/condition.js';

/** @param {object|null} node @returns {{ expr: string, writer: LuaWriter }} */
function emit(node) {
  const writer = new LuaWriter();
  return { expr: emitCondition(node, writer), writer };
}

const leaf = (kind, params = {}, negate = false) => ({ kind, params, negate });

test('an absent or empty tree means "always true"', () => {
  assert.equal(emit(null).expr, 'true');
  assert.equal(emit(undefined).expr, 'true');
  assert.equal(emit(emptyGroup()).expr, 'true');
  assert.equal(emit({ op: 'and', items: [emptyGroup(), emptyGroup()] }).expr, 'true');
});

test('isEmptyCondition sees through nested empty groups', () => {
  assert.equal(isEmptyCondition(null), true);
  assert.equal(isEmptyCondition(emptyGroup()), true);
  assert.equal(isEmptyCondition({ op: 'and', items: [emptyGroup()] }), true);
  assert.equal(isEmptyCondition({ op: 'and', items: [leaf('shiny')] }), false);
  assert.equal(isEmptyCondition(leaf('shiny')), false);
});

test('a single leaf emits without redundant parentheses', () => {
  assert.equal(emit(leaf('shiny')).expr, 'isOpponentShiny()');
  assert.equal(emit({ op: 'and', items: [leaf('shiny')] }).expr, 'isOpponentShiny()');
});

test('groups join with their operator and are parenthesised', () => {
  const node = { op: 'or', items: [leaf('shiny'), leaf('notCaught')] };
  assert.equal(emit(node).expr, '(isOpponentShiny() or (not isAlreadyCaught()))');

  const andNode = { op: 'and', items: [leaf('shiny'), leaf('wildBattle')] };
  assert.equal(emit(andNode).expr, '(isOpponentShiny() and isWildBattle())');
});

test('nested groups keep their own precedence', () => {
  const node = {
    op: 'and',
    items: [
      leaf('wildBattle'),
      { op: 'or', items: [leaf('shiny'), leaf('notCaught')] },
    ],
  };
  assert.equal(
    emit(node).expr,
    '(isWildBattle() and (isOpponentShiny() or (not isAlreadyCaught())))',
  );
});

test('negation wraps leaves and groups', () => {
  assert.equal(emit(leaf('shiny', {}, true)).expr, '(not (isOpponentShiny()))');
  const group = { op: 'or', negate: true, items: [leaf('shiny'), leaf('wildBattle')] };
  assert.equal(emit(group).expr, '(not (isOpponentShiny() or isWildBattle()))');
});

test('an empty AND child is dropped rather than emitting a bare true', () => {
  const node = { op: 'and', items: [leaf('shiny'), emptyGroup()] };
  assert.equal(emit(node).expr, 'isOpponentShiny()');
});

test('the status leaf compares against the host empty-string sentinel', () => {
  assert.equal(
    emit(leaf('oppStatus', { status: '' })).expr,
    '(getOpponentStatus() == nil or getOpponentStatus() == "")',
  );
  assert.equal(emit(leaf('oppStatus', { status: 'SLEEP' })).expr, 'getOpponentStatus() == "SLEEP"');
  assert.equal(
    emit(leaf('oppHasStatus')).expr,
    '(getOpponentStatus() ~= nil and getOpponentStatus() ~= "")',
  );
});

test('a name list becomes an OR of comparisons, and an empty list is false', () => {
  assert.equal(
    emit(leaf('oppName', { names: ['Larvitar', 'Pikachu'] })).expr,
    '(getOpponentName() == "Larvitar" or getOpponentName() == "Pikachu")',
  );
  assert.equal(emit(leaf('oppName', { names: [] })).expr, 'false');
  // A delimited string is accepted too, for hand-edited configs.
  assert.equal(
    emit(leaf('oppName', { names: 'Abra; Kadabra' })).expr,
    '(getOpponentName() == "Abra" or getOpponentName() == "Kadabra")',
  );
});

test('an invalid comparator falls back instead of emitting garbage', () => {
  assert.equal(emit(leaf('oppLevel', { cmp: '); evil(', value: 5 })).expr, 'getOpponentLevel() >= 5');
  assert.equal(emit(leaf('oppLevel', { cmp: '<=', value: 5 })).expr, 'getOpponentLevel() <= 5');
});

test('a non-numeric threshold degrades to the default rather than nil', () => {
  assert.equal(emit(leaf('oppHpPercent', { cmp: '<', value: 'abc' })).expr, 'getOpponentHealthPercent() < 30');
});

test('text parameters are escaped', () => {
  const { expr } = emit(leaf('mapIs', { map: 'evil" or logout("' }));
  assert.equal(expr, 'getMapName() == "evil\\" or logout(\\""');
});

test('raw Lua is emitted verbatim but parenthesised, and empty is false', () => {
  assert.equal(emit(leaf('rawLua', { expr: 'getBattleTurn() == 1' })).expr, '(getBattleTurn() == 1)');
  assert.equal(emit(leaf('rawLua', { expr: '   ' })).expr, '(false)');
});

test('emitting records the host calls it used', () => {
  const { writer } = emit({ op: 'or', items: [leaf('shiny'), leaf('oppLevel', { cmp: '>', value: 5 })] });
  assert.deepEqual(writer.hostCalls(), ['getOpponentLevel', 'isOpponentShiny']);
});

test('helpers are collected only when a leaf needs them', () => {
  assert.deepEqual([...collectConditionHelpers(leaf('shiny'))], []);
  assert.deepEqual([...collectConditionHelpers(leaf('oppType', { type: 'Water' }))], ['opponentHasType']);
  assert.deepEqual(
    [...collectConditionHelpers({ op: 'and', items: [leaf('ppLeft'), leaf('oppType')] })].sort(),
    ['opponentHasType', 'teamPpLeft'],
  );
});

test('createLeaf defaults every declared parameter', () => {
  for (const kind of Object.keys(CONDITION_KINDS)) {
    const created = createLeaf(kind);
    assert.equal(created.kind, kind);
    for (const param of CONDITION_KINDS[kind].params) {
      assert.ok(param.key in created.params, `${kind}.${param.key} not defaulted`);
    }
    // Every default must emit without throwing.
    assert.doesNotThrow(() => emit(created), `${kind} failed to emit with defaults`);
  }
});

test('createLeaf rejects an unknown kind', () => {
  assert.throws(() => createLeaf('nope'), /Unknown condition kind/);
});

test('emitCondition rejects an unknown kind rather than emitting nothing', () => {
  assert.throws(() => emit(leaf('nope')), /Unknown condition kind/);
});

test('normaliseCondition drops unknown leaves and keeps the tree usable', () => {
  const dirty = {
    op: 'or',
    items: [leaf('shiny'), { kind: 'nope', params: {} }, 'garbage', null],
  };
  const clean = normaliseCondition(dirty);
  assert.equal(clean.items.length, 1);
  assert.equal(clean.items[0].kind, 'shiny');
});

test('normaliseCondition coerces a bad operator to and', () => {
  assert.equal(normaliseCondition({ op: 'xor', items: [] }).op, 'and');
  assert.equal(normaliseCondition({ op: 'or', items: [] }).op, 'or');
});

test('normaliseCondition returns null for non-objects', () => {
  assert.equal(normaliseCondition(null), null);
  assert.equal(normaliseCondition('shiny'), null);
  assert.equal(normaliseCondition(42), null);
});
