/**
 * The battle-rule step actions added on top of the original ladder: nested
 * groups, fallback chains, guided API calls, and the two terminal actions.
 *
 * Run with: node --test tests/
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { createStep, normaliseConfig, createDefaultConfig } from '../assets/builder/js/domain/config.js';
import { LinkGraph } from '../assets/builder/js/domain/link-graph.js';
import { generateScript } from '../assets/builder/js/generators/index.js';

const NO_GRAPH = new LinkGraph();

/**
 * Generate a rules-mode script whose single rule runs `steps`.
 *
 * @param {object[]} steps
 * @param {object} [match]
 * @returns {import('../assets/builder/js/generators/index.js').GenerationResult}
 */
function build(steps, match = { op: 'or', negate: false, items: [] }) {
  const config = createDefaultConfig();
  config.mode = 'rules';
  config.rules = [{ id: 'r1', label: 'Only rule', match, fallback: 'attack', steps }];
  return generateScript(normaliseConfig(config), NO_GRAPH);
}

/** The body of `rule1`, which is where every step lands. */
function ruleBody(lua) {
  const lines = lua.split('\n');
  const start = lines.findIndex((line) => line.includes('local function rule1()'));
  assert.ok(start >= 0, 'rule1 was not emitted');
  const end = lines.findIndex((line, index) => index > start && line === 'end');
  return lines.slice(start, end + 1).join('\n');
}

test('every generated script resolves against the host API', () => {
  const result = build([
    createStep({ action: 'sendStrongest' }),
    createStep({ action: 'apiCall', fn: 'useItem', args: '"Repel"' }),
    createStep({ action: 'chain', chain: [{ action: 'useMove', value: 'Spore' }, { action: 'attack', value: '' }] }),
  ]);
  assert.deepEqual(result.unknownCalls, []);
  assert.deepEqual(result.retiredCalls, []);
});

test('a group emits its children inside its own guard', () => {
  const result = build([
    createStep({
      action: 'group',
      when: { op: 'and', negate: false, items: [{ kind: 'oppHpPercent', params: { cmp: '>', value: 25 }, negate: false }] },
      steps: [
        createStep({ action: 'attack' }),
        createStep({ action: 'run' }),
      ],
    }),
  ]);
  const body = ruleBody(result.lua);
  assert.match(body, /if getOpponentHealthPercent\(\) > 25 then\n {8}if attack\(\) then return true end\n {8}if run\(\) then return true end\n {4}end/);
});

test('once-per-battle flags inside a group do not collide with the outer list', () => {
  const result = build([
    createStep({ action: 'attack', once: true }),
    createStep({
      action: 'group',
      steps: [createStep({ action: 'run', once: true })],
    }),
  ]);
  const body = ruleBody(result.lua);
  assert.match(body, /F\["r1s1"\]/);
  assert.match(body, /F\["r1s2s1"\]/);
});

test('a chain becomes one or-expression, and switching is skipped while trapped', () => {
  const result = build([
    createStep({
      action: 'chain',
      chain: [
        { action: 'useMove', value: 'Spore' },
        { action: 'useItem', value: 'Ultra Ball' },
        { action: 'sendPokemon', value: '3' },
        { action: 'useAnyMove', value: '' },
        { action: 'rawLua', value: 'weakAttack()' },
        { action: 'attack', value: '' },
      ],
    }),
  ]);
  assert.match(
    ruleBody(result.lua),
    /if useMove\("Spore"\) or useItem\("Ultra Ball"\) or \(not trapped and sendPokemon\(3\)\) or useAnyMove\(\) or \(weakAttack\(\)\) or attack\(\) then return true end/,
  );
});

test('an incomplete chain link is dropped rather than emitted half-written', () => {
  const result = build([
    createStep({
      action: 'chain',
      chain: [{ action: 'useMove', value: '' }, { action: 'attack', value: '' }],
    }),
  ]);
  assert.match(ruleBody(result.lua), /if attack\(\) then return true end/);
  assert.doesNotMatch(result.lua, /useMove\(\)/);
});

test('a chain with nothing usable emits a comment, not a broken if', () => {
  const result = build([createStep({ action: 'chain', chain: [] })]);
  assert.match(ruleBody(result.lua), /-- Empty chain step\./);
  assert.doesNotMatch(result.lua, /if {2}then/);
});

test('terminal steps open their own block so `return` stays last in it', () => {
  const result = build([
    createStep({ action: 'stopBot', message: 'Out of balls.' }),
    createStep({ action: 'logout', message: 'Done.' }),
    createStep({ action: 'attack' }),
  ]);
  const body = ruleBody(result.lua);
  assert.match(body, /do\n {8}fatal\("Out of balls\."\)\n {8}return true\n {4}end/);
  assert.match(body, /do\n {8}logout\("Done\."\)\n {8}return true\n {4}end/);
  // The step after them, and the fallback, still follow — which is only legal
  // Lua because each `return` sits inside a `do … end` of its own.
  assert.match(body, /if attack\(\) then return true end/);
});

test('a terminal step falls back to a default message', () => {
  const result = build([createStep({ action: 'stopBot', message: '' })]);
  assert.match(ruleBody(result.lua), /fatal\("Script stopped by a battle rule\."\)/);
});

test('sendStrongest defines strongestSlot even without the team toggle', () => {
  const result = build([createStep({ action: 'sendStrongest' })]);
  assert.match(result.lua, /local function strongestSlot\(\)/);
  assert.match(ruleBody(result.lua), /local best = strongestSlot\(\)/);
  assert.deepEqual(result.unknownCalls, []);
});

test('a guided API call is emitted verbatim and recorded for verification', () => {
  const result = build([createStep({ action: 'apiCall', fn: 'talkToNpcOnCell', args: '7, 9' })]);
  assert.match(ruleBody(result.lua), /if talkToNpcOnCell\(7, 9\) then return true end/);
  assert.ok(result.hostCalls.includes('talkToNpcOnCell'));
});

test('a guided API call naming nothing emits a comment instead of a call', () => {
  const result = build([createStep({ action: 'apiCall', fn: '', args: '' })]);
  assert.match(ruleBody(result.lua), /-- No function chosen for this step\./);
});

test('a typo in a guided call surfaces as an unresolved name', () => {
  const result = build([createStep({ action: 'apiCall', fn: 'moveToCel', args: '1, 2' })]);
  assert.deepEqual(result.unknownCalls, ['moveToCel']);
});

test('groups nested past the limit are flattened rather than dropping their steps', () => {
  // Seven levels deep: one more than normaliseConfig will keep.
  let deepest = { action: 'attack', when: { op: 'and', items: [] } };
  for (let i = 0; i < 7; i += 1) {
    deepest = { action: 'group', when: { op: 'and', items: [] }, steps: [deepest] };
  }
  const config = createDefaultConfig();
  config.mode = 'rules';
  config.rules = [{ id: 'r1', label: 'Deep', match: { op: 'or', items: [] }, fallback: 'attack', steps: [deepest] }];

  const normalised = normaliseConfig(config);
  const result = generateScript(normalised, NO_GRAPH);
  assert.deepEqual(result.unknownCalls, []);

  // Walk down to the level that hit the cap; it must have become a real action.
  let step = normalised.rules[0].steps[0];
  let depth = 0;
  while (step.action === 'group' && step.steps.length) {
    step = step.steps[0];
    depth += 1;
  }
  assert.ok(depth <= 6, `nesting was not capped: ${depth}`);
  assert.notEqual(step.action, 'group', 'a group with nowhere to put its children survived');
});
