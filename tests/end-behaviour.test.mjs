/**
 * What the farm loop does when the keep-farming condition stops holding, and
 * the rotation modes that go with a longer session.
 *
 * Run with: node --test tests/
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultConfig, normaliseConfig } from '../assets/builder/js/domain/config.js';
import { LinkGraph } from '../assets/builder/js/domain/link-graph.js';
import { generateScript } from '../assets/builder/js/generators/index.js';

const NO_GRAPH = new LinkGraph();

/**
 * @param {(config: object) => void} mutate
 * @returns {import('../assets/builder/js/generators/index.js').GenerationResult}
 */
function build(mutate) {
  const config = createDefaultConfig();
  mutate(config);
  return generateScript(normaliseConfig(config), NO_GRAPH);
}

/** The body of `onPathAction`, where the end-of-farm branch lives. */
function pathAction(lua) {
  const start = lua.indexOf('function onPathAction()');
  assert.ok(start >= 0, 'onPathAction was not emitted');
  return lua.slice(start, lua.indexOf('\nend', start) + 4);
}

test('the default keeps the Pokécenter trip', () => {
  const result = build(() => {});
  assert.match(pathAction(result.lua), /Team is spent — head back and heal\./);
  assert.match(pathAction(result.lua), /return usePokecenter\(\)/);
});

test('healing at an NPC never leaves the map', () => {
  const result = build((config) => {
    config.route.endBehaviour = 'healNpc';
    config.route.endHealCell = '59, 13';
  });
  const body = pathAction(result.lua);
  assert.match(body, /return talkToNpcOnCell\(59, 13\)/);
  assert.doesNotMatch(body, /usePokecenter/);
  assert.deepEqual(result.unknownCalls, []);
});

test('a money floor gates the heal and stops rather than looping below it', () => {
  const result = build((config) => {
    config.route.endBehaviour = 'healNpc';
    config.route.endHealCell = '59, 13';
    config.route.endHealMoney = 1500;
  });
  const body = pathAction(result.lua);
  assert.match(body, /if getMoney\(\) >= 1500 then\n {8}return talkToNpcOnCell\(59, 13\)\n {4}end/);
  assert.match(body, /fatal\("Not enough money to heal — needs 1500\."\)/);
});

test('a zero or missing money floor emits no gate at all', () => {
  const result = build((config) => {
    config.route.endBehaviour = 'healNpc';
    config.route.endHealCell = '59, 13';
    config.route.endHealMoney = null;
  });
  assert.doesNotMatch(pathAction(result.lua), /getMoney/);
});

test('stopping and logging out use the configured message', () => {
  const stop = build((config) => {
    config.route.endBehaviour = 'stop';
    config.route.endMessage = 'EV training finished.';
  });
  assert.match(pathAction(stop.lua), /fatal\("EV training finished\."\)/);

  const out = build((config) => {
    config.route.endBehaviour = 'logout';
    config.route.endMessage = '';
  });
  assert.match(pathAction(out.lua), /logout\("Farming condition no longer holds\."\)/);
});

test('standing still returns false and calls nothing', () => {
  const result = build((config) => { config.route.endBehaviour = 'idle'; });
  const body = pathAction(result.lua);
  assert.match(body, /Configured to stand still/);
  assert.match(body, /return false\nend$/);
});

test('an unrecognised end behaviour falls back to the Pokécenter loop', () => {
  const config = normaliseConfig({ ...createDefaultConfig(), route: { ...createDefaultConfig().route, endBehaviour: 'teleportHome' } });
  assert.equal(config.route.endBehaviour, 'pcLoop');
});

test('the relog delay is configurable and defaults when nonsense', () => {
  const custom = build((config) => {
    config.safety.onTrapped = 'relog';
    config.battle.onOther = 'run';
  });
  assert.match(custom.lua, /relog\(30, /);

  const longer = build((config) => {
    config.safety.onTrapped = 'relog';
    config.safety.relogDelay = 90;
  });
  assert.match(longer.lua, /relog\(90, /);

  const broken = build((config) => {
    config.safety.onTrapped = 'relog';
    config.safety.relogDelay = -5;
  });
  assert.match(broken.lua, /relog\(30, /);
});

// ----------------------------------------------------------------- rotation

test('highest-level rotation is the mirror of lowest-level', () => {
  const result = build((config) => { config.team.rotation.mode = 'highest'; });
  assert.match(result.lua, /if best == nil or level > best then/);
  assert.deepEqual(result.unknownCalls, []);
});

test('the EV table leads with the first Pokémon still short of its goal', () => {
  const result = build((config) => {
    config.team.rotation.mode = 'uidEv';
    config.team.rotation.goals = [
      { id: '111', stat: 'ATK', target: 252 },
      { id: '222', stat: 'SPD', target: 100 },
    ];
  });
  assert.match(result.lua, /local EV_GOALS = \{\n {4}\{ 111, "ATK", 252 \},\n {4}\{ 222, "SPD", 100 \},\n\}/);
  assert.match(result.lua, /getPokemonEffortValue\(slot, goal\[2\]\) < goal\[3\]/);
  assert.deepEqual(result.unknownCalls, []);
});

test('in EV mode the encounter filter follows the table, not the single stat', () => {
  const result = build((config) => {
    config.mode = 'ev';
    config.ev.stat = 'HP';
    config.team.rotation.mode = 'uidEv';
    config.team.rotation.goals = [{ id: '111', stat: 'ATK', target: 252 }];
  });
  assert.match(result.lua, /local stat = currentEvGoalStat\(\)/);
  assert.doesNotMatch(result.lua, /isOpponentEffortValue\("HP"\)/);
  assert.deepEqual(result.unknownCalls, []);
});

test('the goal-stat helper is only defined where something calls it', () => {
  const outsideEv = build((config) => {
    config.mode = 'exp';
    config.team.rotation.mode = 'uidEv';
    config.team.rotation.goals = [{ id: '111', stat: 'ATK', target: 252 }];
  });
  assert.doesNotMatch(outsideEv.lua, /currentEvGoalStat/);
  assert.deepEqual(outsideEv.unknownCalls, []);
});

test('an EV table with no rows turns rotation off rather than looping over nothing', () => {
  const result = build((config) => {
    config.team.rotation.mode = 'uidEv';
    config.team.rotation.goals = [];
  });
  assert.equal(result.team.rotationMode, 'off');
  assert.doesNotMatch(result.lua, /EV_GOALS/);
});

test('EV goal rows are cleaned up on load', () => {
  const base = createDefaultConfig();
  base.team.rotation.goals = [
    { id: ' 42 ', stat: 'spd', target: '9999' },
    { id: '', stat: 'ATK', target: 10 },
    { id: '7', stat: 'nonsense', target: -3 },
  ];
  const config = normaliseConfig(base);
  assert.deepEqual(config.team.rotation.goals, [
    { id: '42', stat: 'SPD', target: 252 },
    { id: '7', stat: 'ATK', target: 1 },
  ]);
});
