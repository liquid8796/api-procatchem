/**
 * The handbook explains the script by quoting it. Those quotes have to stay
 * true, so the ones taken verbatim from the generator are checked against real
 * output rather than trusted.
 *
 * Run with: node --test tests/
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultConfig, normaliseConfig } from '../assets/builder/js/domain/config.js';
import { LinkGraph } from '../assets/builder/js/domain/link-graph.js';
import { generateScript } from '../assets/builder/js/generators/index.js';
import { HANDBOOK_SECTIONS } from '../assets/builder/js/ui/handbook.js';
import { actionSamples, conditionSamples } from '../assets/builder/js/ui/emit-reference.js';

const { graph } = LinkGraph.parse([
  'PROCATCHEM-LINKGRAPH\tv1',
  'Pokecenter Viridian\t9\t14\tViridian City',
  'Viridian City\t23\t8\tPokecenter Viridian',
  'Viridian City\t12\t3\tViridian Forest',
  'Viridian Forest\t14\t46\tViridian City',
].join('\n'));

/** A configuration that exercises every feature the handbook quotes. */
function richScript() {
  const config = createDefaultConfig();
  config.route.kind = 'route';
  config.route.farmMap = 'Viridian Forest';
  config.route.pokecenterMap = 'Pokecenter Viridian';
  config.battle.helperMoves = [{
    move: 'Soak', trigger: 'oppType', type: 'Ghost', names: [], slot: 1, ability: '',
  }];
  config.team.customGuard = {
    op: 'and',
    negate: false,
    items: [{
      kind: 'heardText',
      params: { on: ['was taunted'], off: ['shook off the taunt'], turns: 0 },
      negate: false,
    }],
  };
  return generateScript(normaliseConfig(config), graph);
}

/** @param {string} id @returns {import('../assets/builder/js/ui/handbook.js').Section} */
function section(id) {
  const found = HANDBOOK_SECTIONS.find((entry) => entry.id === id);
  assert.ok(found, `no handbook section called "${id}"`);
  return found;
}

/**
 * Does `haystack` contain `block`, ignoring how far each line is indented?
 *
 * A handbook snippet is written flush left; the same code inside the script is
 * indented by whatever encloses it. Indentation is not what the example is
 * teaching, so it is not what the comparison should turn on.
 *
 * @param {string} haystack
 * @param {string} block
 * @returns {boolean}
 */
function containsBlock(haystack, block) {
  const strip = (text) => text.split('\n').map((line) => line.trim()).join('\n');
  return strip(haystack).includes(strip(block));
}

test('every section has an id, a title, and something to say', () => {
  const ids = new Set();
  for (const entry of HANDBOOK_SECTIONS) {
    assert.ok(entry.id, 'a section has no id');
    assert.equal(ids.has(entry.id), false, `duplicate section id: ${entry.id}`);
    ids.add(entry.id);
    assert.ok(entry.title.length > 0, `${entry.id}: no title`);
    assert.ok(entry.paragraphs.length > 0, `${entry.id}: nothing to say`);
    for (const paragraph of entry.paragraphs) {
      assert.ok(paragraph.length > 40, `${entry.id}: a paragraph is too thin to be useful`);
    }
  }
});

test('the useOnce example is the function the generator emits', () => {
  const lua = richScript().lua;
  assert.ok(
    containsBlock(lua, section('once-per-battle').lua),
    'the handbook quotes a useOnce that no longer matches the generator',
  );
});

test('the walk example is the function the generator emits', () => {
  const lua = richScript().lua;
  const quoted = section('warp-cells').lua;
  const walkOnly = quoted.slice(quoted.indexOf('local function walk(hops)'));
  assert.ok(containsBlock(lua, walkOnly), 'the handbook quotes a walk() that no longer matches the generator');
});

test('the hop table example matches the shape the generator writes', () => {
  const lua = richScript().lua;
  const quoted = section('warp-cells').lua;
  const tableOnly = quoted.slice(0, quoted.indexOf('}') + 1);
  assert.ok(containsBlock(lua, tableOnly), 'the handbook quotes a hop table that no longer matches');
});

test('the battle-log example matches the clauses the generator writes', () => {
  const lua = richScript().lua;
  const flag = /local (heard_was_taunted_[a-z0-9]{6})/.exec(lua)?.[1];
  assert.ok(flag, 'the test configuration should have produced a battle-log flag');

  // The handbook uses a fixed suffix for readability; the shape is what matters.
  const quoted = section('heard').lua.replace(/heard_was_taunted_\w+/g, flag);
  assert.ok(containsBlock(lua, quoted), 'the handbook quotes onBattleMessage clauses that no longer match');
});

test('the one-action example uses only calls that exist', () => {
  const lua = richScript().lua;
  for (const call of ['useMoveFromAnySlot(', 'opponentStatused()', 'getOpponentHealth()', 'useItem(']) {
    assert.ok(lua.includes(call), `the handbook shows ${call} but the generator never emits it`);
  }
});

test('the mount re-arm example matches what the generator writes', () => {
  const config = createDefaultConfig();
  config.route.kind = 'route';
  config.route.farmMap = 'Viridian Forest';
  config.route.pokecenterMap = 'Pokecenter Viridian';
  config.mounts.land = ['Arcanine Mount'];
  config.route.stops = [{ map: 'Viridian City', mount: 'off', terrain: 'any' }];

  const { lua } = generateScript(normaliseConfig(config), graph);
  assert.ok(
    containsBlock(lua, section('built-from-parts').lua),
    'the composite-algorithms section quotes code the generator no longer writes',
  );
});

test('every condition in the generated reference produces real Lua', () => {
  const samples = conditionSamples();
  assert.ok(samples.length >= 30, `suspiciously few samples: ${samples.length}`);

  for (const sample of samples) {
    assert.ok(sample.lua.trim(), `${sample.label} produced nothing`);
    assert.ok(!sample.lua.startsWith('--'), `${sample.label} threw: ${sample.lua}`);
    // A bare boolean is what an unfilled row emits; the reference fills the
    // placeholders precisely so no row illustrates itself as "false".
    assert.ok(
      !['true', 'false'].includes(sample.lua.trim()),
      `${sample.label} shows a bare boolean instead of the shape it writes`,
    );
  }
});

test('the reference names the hunting and healing actions too', () => {
  const labels = actionSamples().map((sample) => sample.label);
  assert.ok(labels.includes('Fish from a cell'));
  assert.ok(labels.includes('Use the Pokécenter'));
  const fishing = actionSamples().find((sample) => sample.label === 'Fish from a cell');
  assert.match(fishing.lua, /moveToCell/);
  assert.match(fishing.lua, /useItem\("Super Rod"\)/);
});
