/**
 * Tests for the V4 feature groups: farm zones, team management, the rules
 * engine, and multi-stop / time-of-day routes.
 * Run with: node --test tests/
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultConfig, createStep, normaliseConfig } from '../assets/builder/js/domain/config.js';
import { LinkGraph } from '../assets/builder/js/domain/link-graph.js';
import { parseZone } from '../assets/builder/js/domain/zone.js';
import { generateScript } from '../assets/builder/js/generators/index.js';

const GRAPH = LinkGraph.parse([
  'PROCATCHEM-LINKGRAPH\tv1',
  'Pokecenter Viridian\t9\t14\tViridian City',
  'Viridian City\t23\t8\tPokecenter Viridian',
  'Viridian City\t12\t3\tViridian Forest',
  'Viridian Forest\t14\t46\tViridian City',
  'Viridian City\t40\t20\tRoute 21',
  'Route 21\t2\t2\tViridian City',
].join('\n')).graph;

const EMPTY_GRAPH = new LinkGraph();

/** @param {(config: object) => void} [mutate] */
function configWith(mutate) {
  const config = createDefaultConfig();
  if (mutate) mutate(config);
  return config;
}

/** @param {object} config @param {LinkGraph} [graph] */
function generate(config, graph = EMPTY_GRAPH) {
  return generateScript(config, graph);
}

/** Strip comments so assertions look at executable Lua only. */
function code(lua) {
  return lua.replace(/--\[(=*)\[[\s\S]*?\]\1\]/g, ' ').replace(/--[^\n]*/g, ' ');
}

function assertSound(result, label) {
  assert.deepEqual(result.unknownCalls, [], `${label}: unknown calls`);
  assert.deepEqual(result.retiredCalls, [], `${label}: retired calls`);
  assert.ok(!/\bmoveToMap\b/.test(code(result.lua)), `${label}: emitted moveToMap`);
}

// ------------------------------------------------------------- farm zones

test('parseZone normalises corners and detects lines', () => {
  assert.deepEqual(parseZone('20, 20, 10, 10'), { x1: 10, y1: 10, x2: 20, y2: 20, flat: false });
  assert.deepEqual(parseZone('12 5 12 25'), { x1: 12, y1: 5, x2: 12, y2: 25, flat: true });
  assert.deepEqual(parseZone('7,7,7,7'), { x1: 7, y1: 7, x2: 7, y2: 7, flat: true });
  assert.equal(parseZone('1,2,3'), null);
  assert.equal(parseZone('a,b,c,d'), null);
  assert.equal(parseZone(''), null);
  assert.equal(parseZone('1.5,2,3,4'), null);
});

test('a single zone emits a rectangle walk with no rotation machinery', () => {
  const result = generate(configWith((c) => { c.route.zones = ['10,10,20,20']; }));
  assertSound(result, 'one-zone');
  assert.match(result.lua, /local ZONES = \{/);
  assert.match(result.lua, /return moveToRectangle\(zone\)/);
  assert.ok(!/rerollZone/.test(result.lua), 'emitted rotation for a single zone');
  assert.ok(!/zoneInterval/.test(result.lua), 'emitted a timer for a single zone');
});

test('several zones rotate on a fixed timer', () => {
  const result = generate(configWith((c) => {
    c.route.zones = ['10,10,20,20', '30,5,40,15'];
    c.route.zoneRotation = { mode: 'fixed', min: 15, max: 40 };
  }));
  assertSound(result, 'zones-fixed');
  assert.match(result.lua, /local function rerollZone\(\)/);
  assert.match(result.lua, /return 900\b/, '15 minutes should become 900 seconds');
  assert.match(result.lua, /if pick == zoneIdx then pick = \(pick % #ZONES\) \+ 1 end/);
});

test('random rotation never emits a reversed math.random range', () => {
  const result = generate(configWith((c) => {
    c.route.zones = ['1,1,2,2', '3,3,4,4'];
    // Deliberately reversed: the plan must clamp it.
    c.route.zoneRotation = { mode: 'random', min: 40, max: 10 };
  }));
  assertSound(result, 'zones-random');
  const match = result.lua.match(/math\.random\((\d+), (\d+)\)/);
  assert.ok(match, 'no interval emitted');
  assert.ok(Number(match[1]) <= Number(match[2]), `reversed range: ${match[0]}`);
});

test('a flat zone is patrolled with moveToCell instead of moveToRectangle', () => {
  const result = generate(configWith((c) => { c.route.zones = ['12,5,12,25']; }));
  assertSound(result, 'flat-zone');
  assert.match(result.lua, /flat = true/);
  assert.match(result.lua, /if zone\.flat then/);
  assert.match(result.lua, /return moveToCell\(tx, ty\)/);
  assert.ok(result.hostCalls.includes('getPlayerX'));
});

test('event-driven rotation arms on a heal and on a win', () => {
  const heal = generate(configWith((c) => {
    c.route.kind = 'route';
    c.route.farmMap = 'Viridian Forest';
    c.route.pokecenterMap = 'Pokecenter Viridian';
    c.route.zones = ['1,1,2,2', '3,3,4,4'];
    c.route.zoneRotation = { mode: 'onHeal', min: 1, max: 2 };
  }), GRAPH);
  assertSound(heal, 'zone-onheal');
  assert.match(heal.lua, /zoneReroll = true/);
  assert.ok(!/zoneInterval/.test(heal.lua), 'timer emitted for an event mode');

  const win = generate(configWith((c) => {
    c.route.zones = ['1,1,2,2', '3,3,4,4'];
    c.route.zoneRotation = { mode: 'onWin', min: 1, max: 2 };
  }));
  assertSound(win, 'zone-onwin');
  assert.match(win.lua, /stringContains\(message, "You have won"\) then zoneReroll = true/);
});

test('invalid zone text is dropped rather than emitted', () => {
  const result = generate(configWith((c) => { c.route.zones = ['10,10,20,20', 'nonsense']; }));
  assertSound(result, 'zone-invalid');
  assert.ok(!/nonsense/.test(result.lua));
});

// -------------------------------------------------------- team management

test('the strongest-slot helper is emitted only when asked for', () => {
  assert.ok(!/strongestSlot/.test(generate(createDefaultConfig()).lua));
  const result = generate(configWith((c) => { c.team.useStrongest = true; }));
  assertSound(result, 'strongest');
  assert.match(result.lua, /local function strongestSlot\(\)/);
});

test('a pinned lead ability parks its holder in slot 1', () => {
  const result = generate(configWith((c) => { c.team.leadAbility = 'Synchronize'; }));
  assertSound(result, 'lead-ability');
  assert.match(result.lua, /local LEAD_ABILITY = "Synchronize"/);
  assert.match(result.lua, /swapPokemon\(1, holder\)/);
  assert.match(result.lua, /if keepLeadAbility\(\) then return true end/);
});

test('rotation moves to a later slot when leading slots are pinned', () => {
  const one = generate(configWith((c) => {
    c.team.leadAbility = 'Synchronize';
    c.team.rotation = { mode: 'weakest', stat: 'ATK', target: 252, slots: 2, ids: [] };
  }));
  assertSound(one, 'rotate-pinned-1');
  assert.match(one.lua, /for slot = 2, getTeamSize\(\) do/);

  const two = generate(configWith((c) => {
    c.team.leadAbility = 'Synchronize';
    c.team.secondAbility = 'Trace';
    c.team.rotation = { mode: 'weakest', stat: 'ATK', target: 252, slots: 2, ids: [] };
  }));
  assertSound(two, 'rotate-pinned-2');
  assert.match(two.lua, /for slot = 3, getTeamSize\(\) do/);
});

test('EV rotation swaps a capped slot out', () => {
  const result = generate(configWith((c) => {
    c.team.rotation = { mode: 'ev', stat: 'spd', target: 252, slots: 2, ids: [] };
  }));
  assertSound(result, 'rotate-ev');
  assert.match(result.lua, /local EV_STAT   = "SPD"/);
  assert.match(result.lua, /getPokemonEffortValue\(1, EV_STAT\) < EV_TARGET then return false end/);
});

test('unique-id rotation needs ids, and falls back to no rotation without them', () => {
  const withIds = generate(configWith((c) => {
    c.team.rotation = { mode: 'uid', stat: 'ATK', target: 252, slots: 2, ids: ['111', '222'] };
  }));
  assertSound(withIds, 'rotate-uid');
  assert.match(withIds.lua, /local ROTATE_IDS = \{ 111, 222 \}/);

  const without = generate(configWith((c) => {
    c.team.rotation = { mode: 'uid', stat: 'ATK', target: 252, slots: 2, ids: [] };
  }));
  assertSound(without, 'rotate-uid-empty');
  assert.ok(!/rotateTeam/.test(without.lua), 'emitted a rotation with nothing to rotate');
});

test('the lead held item is reclaimed when the bag is empty', () => {
  const result = generate(configWith((c) => { c.team.leadItem = 'Leftovers'; }));
  assertSound(result, 'lead-item');
  assert.match(result.lua, /if hasItem\(LEAD_ITEM\) then return giveItemToPokemon\(LEAD_ITEM, 1\) end/);
  assert.match(result.lua, /takeItemFromPokemon\(slot\)/);
});

test('kept moves produce an onLearningMove callback', () => {
  const result = generate(configWith((c) => { c.team.keepMoves = ['False Swipe', 'Spore']; }));
  assertSound(result, 'keep-moves');
  assert.match(result.lua, /function onLearningMove\(moveName, pokemonIndex\)/);
  assert.match(result.lua, /forgetAnyMoveExcept\("False Swipe", "Spore"\)/);
});

test('no team management means no upkeep call', () => {
  const result = generate(createDefaultConfig());
  assert.ok(!/teamUpkeep/.test(result.lua));
});

// ----------------------------------------------------------- rules engine

test('the default rules mode generates a sound script', () => {
  const result = generate(configWith((c) => { c.mode = 'rules'; }));
  assertSound(result, 'rules-default');
  assert.match(result.lua, /local function rule1\(\)/);
  assert.match(result.lua, /if isOpponentShiny\(\) then/);
  assert.match(result.lua, /return rule1\(\)/);
});

test('a once-per-battle step is flagged and the table is cleared between battles', () => {
  const result = generate(configWith((c) => {
    c.mode = 'rules';
    c.rules[0].steps[1].once = true;
  }));
  assertSound(result, 'rules-once');
  assert.match(result.lua, /local F           = \{\}/);
  assert.match(result.lua, /if not F\["r1s2"\]/);
  assert.match(result.lua, /F\["r1s2"\] = true; return true/);
  assert.match(result.lua, /^\s*F = \{\}$/m);
});

test('a script with no once-steps declares no flag table', () => {
  const result = generate(configWith((c) => { c.mode = 'rules'; }));
  assert.ok(!/local F /.test(result.lua));
});

test('a fixed-slot move switches in before using the move', () => {
  const result = generate(configWith((c) => {
    c.mode = 'rules';
    c.rules[0].steps = [createStep({ action: 'useMove', move: 'Spore', slot: 3 })];
  }));
  assertSound(result, 'rules-fixed-slot');
  assert.match(result.lua, /if getActivePokemonNumber\(\) == 3 then/);
  assert.match(result.lua, /elseif not trapped then/);
  assert.match(result.lua, /if sendPokemon\(3\) then return true end/);
});

test('every step action emits something sound', () => {
  const actions = [
    { action: 'useMove', move: 'Tackle' },
    { action: 'useItem', item: 'Ultra Ball' },
    { action: 'throwBalls', balls: ['Ultra Ball', 'Pokeball'] },
    { action: 'sendPokemon', slotNumber: 2 },
    { action: 'attack' },
    { action: 'weakAttack' },
    { action: 'run' },
    { action: 'sendUsablePokemon' },
    { action: 'sendAnyPokemon' },
    { action: 'rawLua', expr: 'useItem("Repel")' },
  ];
  for (const overrides of actions) {
    const result = generate(configWith((c) => {
      c.mode = 'rules';
      c.rules[0].steps = [createStep(overrides)];
    }));
    assertSound(result, `step-${overrides.action}`);
  }
});

test('an unknown step action fails loudly', () => {
  assert.throws(() => generate(configWith((c) => {
    c.mode = 'rules';
    c.rules[0].steps = [createStep({ action: 'teleport' })];
  })), /Unknown step action/);
});

test('rule fallbacks each emit their policy', () => {
  const build = (fallback) => generate(configWith((c) => {
    c.mode = 'rules';
    c.rules[0].fallback = fallback;
  })).lua;

  assert.match(build('attack'), /return attack\(\) or sendUsablePokemon\(\)/);
  assert.match(build('run'), /return run\(\) or attack\(\)/);
  assert.match(build('nothing'), /stopping\."\)\n\s*return false/);
});

test('a rule with no condition always matches', () => {
  const result = generate(configWith((c) => {
    c.mode = 'rules';
    c.rules[0].match = { op: 'or', negate: false, items: [] };
  }));
  assertSound(result, 'rules-open');
  assert.match(result.lua, /if true then\n\s*return rule1\(\)/);
});

test('a raw Lua condition reaches the verifier', () => {
  const bad = generate(configWith((c) => {
    c.mode = 'rules';
    c.rules[0].match = {
      op: 'and',
      negate: false,
      items: [{ kind: 'rawLua', params: { expr: 'notARealApi() == 1' }, negate: false }],
    };
  }));
  assert.deepEqual(bad.unknownCalls, ['notARealApi']);
});

test('raw Lua calling a retired function is reported', () => {
  const result = generate(configWith((c) => {
    c.mode = 'rules';
    c.rules[0].steps = [createStep({ action: 'rawLua', expr: 'moveToMap("Viridian City")' })];
  }));
  assert.deepEqual(result.retiredCalls, ['moveToMap']);
});

// ------------------------------------------------- routes: stops and time

test('a stop adjusts mount and terrain before travelling on', () => {
  const result = generate(configWith((c) => {
    c.route.kind = 'route';
    c.route.farmMap = 'Route 21';
    c.route.pokecenterMap = 'Pokecenter Viridian';
    c.route.stops = [{ map: 'Viridian City', mount: 'off', terrain: 'water' }];
  }), GRAPH);
  assertSound(result, 'stops');
  assert.match(result.lua, /local function stopUpkeep\(map\)/);
  assert.match(result.lua, /if isMounted\(\) then return disMount\(\) end/);
  assert.match(result.lua, /if not isSurfing\(\) then return moveToWater\(\) end/);
  assert.match(result.lua, /if stopUpkeep\(map\) then return true end/);
});

test('a stop that changes nothing is dropped', () => {
  const result = generate(configWith((c) => {
    c.route.stops = [{ map: 'Viridian City', mount: 'auto', terrain: 'any' }];
  }));
  assert.ok(!/stopUpkeep/.test(result.lua));
});

test('a forced mount stop needs a configured mount', () => {
  const withMount = generate(configWith((c) => {
    c.mounts.land = ['Bicycle'];
    c.route.stops = [{ map: 'Route 1', mount: 'force', terrain: 'any' }];
  }));
  assertSound(withMount, 'stop-force-mount');
  assert.match(withMount.lua, /setMount\(pickMount\(LAND_MOUNTS\)\)/);

  const withoutMount = generate(configWith((c) => {
    c.route.stops = [{ map: 'Route 1', mount: 'force', terrain: 'any' }];
  }));
  assertSound(withoutMount, 'stop-force-no-mount');
  assert.ok(!/pickMount/.test(withoutMount.lua), 'referenced a mount list that is not emitted');
});

test('time-of-day hunting builds one hop table per period', () => {
  const result = generate(configWith((c) => {
    c.route.kind = 'route';
    c.route.farmMap = 'Viridian Forest';
    c.route.pokecenterMap = 'Pokecenter Viridian';
    c.route.timeOfDay = { enabled: true, morningMap: 'Route 21', noonMap: '', nightMap: '' };
  }), GRAPH);

  assert.deepEqual(result.plan.problems, []);
  assert.equal(result.plan.timeOfDay, true);
  assertSound(result, 'time-of-day');
  assert.match(result.lua, /local TO_FARM_MORNING = \{/);
  assert.match(result.lua, /local function activeLeg\(\)/);
  assert.match(result.lua, /if isMorning\(\) then return "Route 21", TO_FARM_MORNING, TO_HEAL_MORNING end/);
  assert.match(result.lua, /local farmMap, toFarm, toHeal = activeLeg\(\)/);
  assert.match(result.lua, /return walk\(toFarm\)/);
});

test('a time-of-day map missing from the link graph is reported', () => {
  const result = generate(configWith((c) => {
    c.route.kind = 'route';
    c.route.farmMap = 'Viridian Forest';
    c.route.pokecenterMap = 'Pokecenter Viridian';
    c.route.timeOfDay = { enabled: true, morningMap: 'Cinnabar Island', noonMap: '', nightMap: '' };
  }), GRAPH);
  assert.equal(result.plan.problems.length, 1);
  assert.match(result.plan.problems[0], /Cinnabar Island/);
});

test('time-of-day with no distinct maps collapses to a single leg', () => {
  const result = generate(configWith((c) => {
    c.route.kind = 'route';
    c.route.farmMap = 'Viridian Forest';
    c.route.pokecenterMap = 'Pokecenter Viridian';
    c.route.timeOfDay = { enabled: true, morningMap: 'Viridian Forest', noonMap: '', nightMap: '' };
  }), GRAPH);
  assert.equal(result.plan.timeOfDay, false);
  assert.ok(!/activeLeg/.test(result.lua));
});

// ------------------------------------------------------------ custom guard

test('a custom guard replaces the simple healing conditions', () => {
  const result = generate(configWith((c) => {
    c.team.customGuard = {
      op: 'and',
      negate: false,
      items: [{ kind: 'usableCount', params: { cmp: '>=', value: 3 }, negate: false }],
    };
  }));
  assertSound(result, 'custom-guard');
  assert.match(result.lua, /return getUsablePokemonCount\(\) >= 3/);
  assert.ok(!/ppLeft/.test(result.lua), 'simple PP clause survived alongside the guard');
});

test('a guard needing a helper gets that helper defined exactly once', () => {
  const result = generate(configWith((c) => {
    c.team.customGuard = {
      op: 'and',
      negate: false,
      items: [{ kind: 'ppLeft', params: { move: 'False Swipe', cmp: '>=', value: 1 }, negate: false }],
    };
  }));
  assertSound(result, 'guard-helper');
  assert.equal(result.lua.match(/local function ppLeft\(move\)/g).length, 1);
});

// ------------------------------------------------------------ round-tripping

test('a config using every new feature round-trips through normalisation', () => {
  const config = configWith((c) => {
    c.mode = 'rules';
    c.route.zones = ['10,10,20,20', '12,5,12,25'];
    c.route.zoneRotation = { mode: 'random', min: 5, max: 20 };
    c.route.stops = [{ map: 'Viridian City', mount: 'off', terrain: 'land' }];
    c.route.timeOfDay = { enabled: true, morningMap: 'Route 21', noonMap: '', nightMap: '' };
    c.team.leadAbility = 'Synchronize';
    c.team.leadItem = 'Leftovers';
    c.team.keepMoves = ['Surf'];
    c.team.rotation = { mode: 'uid', stat: 'ATK', target: 252, slots: 2, ids: ['999'] };
    c.rules[0].steps[0].once = true;
  });

  const restored = normaliseConfig(JSON.parse(JSON.stringify(config)));
  assert.deepEqual(restored.route.zones, config.route.zones);
  assert.deepEqual(restored.route.stops, config.route.stops);
  assert.equal(restored.team.leadAbility, 'Synchronize');
  assert.equal(restored.rules[0].steps[0].once, true);
  assert.equal(generate(restored, GRAPH).lua, generate(config, GRAPH).lua);
});

test('a forced-mount stop with no mount list emits nothing at all', () => {
  const result = generate(configWith((c) => {
    c.route.kind = 'route';
    c.route.farmMap = 'Viridian Forest';
    c.route.pokecenterMap = 'Pokecenter Viridian';
    c.route.stops = [{ map: 'Viridian City', mount: 'force', terrain: 'any' }];
  }), GRAPH);
  assertSound(result, 'stop-empty-branch');
  assert.ok(!/stopUpkeep/.test(result.lua), 'emitted an upkeep function with an empty branch');
});

test('stops are ignored when hunting in place', () => {
  const result = generate(configWith((c) => {
    c.route.kind = 'here';
    c.route.stops = [{ map: 'Viridian City', mount: 'off', terrain: 'any' }];
  }));
  assert.deepEqual(result.plan.stops, []);
  assert.ok(!/stopUpkeep/.test(result.lua));
});

test('ppLeft has exactly one definition even when a condition also uses it', () => {
  const result = generate(configWith((c) => {
    c.mode = 'rules';
    c.team.healOnPPOut = true;
    c.battle.weaken.move = 'False Swipe';
    c.rules[0].match = {
      op: 'and',
      negate: false,
      items: [{ kind: 'ppLeft', params: { move: 'Surf', cmp: '>=', value: 1 }, negate: false }],
    };
  }));
  assertSound(result, 'pp-single-def');
  const definitions = result.lua.match(/local function ppLeft\(move\)/g) ?? [];
  assert.equal(definitions.length, 1, `ppLeft defined ${definitions.length} times`);
});

test('healing on PP still emits its clause when a condition also uses ppLeft', () => {
  const result = generate(configWith((c) => {
    c.team.healOnPPOut = true;
    c.battle.weaken.mode = 'falseSwipe';
    c.battle.weaken.move = 'False Swipe';
    c.battle.status.moves = [];
    c.team.customGuard = { op: 'and', negate: false, items: [] };
  }));
  assertSound(result, 'pp-clause-kept');
  assert.match(result.lua, /local function teamIsReady\(\)[\s\S]*?ppLeft\("False Swipe"\) >= 1/);
  assert.equal((result.lua.match(/local function ppLeft\(move\)/g) ?? []).length, 1);
});

test('the battle plan section is not printed twice in rules mode', () => {
  const result = generate(configWith((c) => { c.mode = 'rules'; }));
  const headers = result.lua.match(/^-- -+ (Battle plan|Battle rules)$/gm) ?? [];
  assert.equal(headers.length, 1, `got ${headers.length} battle headers: ${headers.join(' | ')}`);
});
