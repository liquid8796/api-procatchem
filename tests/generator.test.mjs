/**
 * Generation tests: every configuration must produce a script whose calls all
 * resolve against the real host API, and which never touches a retired function.
 * Run with: node --test tests/
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultConfig, normaliseConfig } from '../assets/builder/js/domain/config.js';
import { LinkGraph } from '../assets/builder/js/domain/link-graph.js';
import {
  generateScript,
  parseConfigHeader,
  renderConfigHeader,
} from '../assets/builder/js/generators/index.js';
import { modeRegistry } from '../assets/builder/js/generators/mode-registry.js';

const SAMPLE_GRAPH = LinkGraph.parse([
  'PROCATCHEM-LINKGRAPH\tv1',
  'Pokecenter Viridian\t9\t14\tViridian City',
  'Viridian City\t23\t8\tPokecenter Viridian',
  'Viridian City\t12\t3\tViridian Forest',
  'Viridian Forest\t14\t46\tViridian City',
].join('\n')).graph;

const EMPTY_GRAPH = new LinkGraph();

/**
 * @param {(config: object) => void} [mutate]
 * @returns {object}
 */
function configWith(mutate) {
  const config = createDefaultConfig();
  if (mutate) mutate(config);
  return config;
}

/** @param {object} config @param {LinkGraph} [graph] */
function generate(config, graph = EMPTY_GRAPH) {
  return generateScript(config, graph);
}

/**
 * Strip comments so assertions look at executable Lua only — the banner
 * deliberately mentions `moveToMap()` in prose.
 *
 * @param {string} lua
 * @returns {string}
 */
function code(lua) {
  return lua.replace(/--\[(=*)\[[\s\S]*?\]\1\]/g, ' ').replace(/--[^\n]*/g, ' ');
}

/** Asserts the universal invariants every generated script must satisfy. */
function assertSound(result, label) {
  assert.deepEqual(result.unknownCalls, [], `${label}: unknown calls`);
  assert.deepEqual(result.retiredCalls, [], `${label}: retired calls`);
  assert.ok(!/\bmoveToMap\b/.test(code(result.lua)), `${label}: emitted moveToMap`);
  assert.match(result.lua, /function onPathAction\(\)/, `${label}: no onPathAction`);
  assert.match(result.lua, /function onBattleAction\(\)/, `${label}: no onBattleAction`);
}

test('every registered mode generates a sound script', () => {
  for (const id of modeRegistry.ids()) {
    const result = generate(configWith((c) => { c.mode = id; }));
    assertSound(result, id);
  }
});

test('the default configuration never calls the retired moveToMap', () => {
  const result = generate(createDefaultConfig());
  assertSound(result, 'default');
  assert.ok(result.hostCalls.length > 0);
});

test('route mode emits moveToCell hops from the link graph', () => {
  const config = configWith((c) => {
    c.route.kind = 'route';
    c.route.farmMap = 'Viridian Forest';
    c.route.pokecenterMap = 'Pokecenter Viridian';
  });
  const result = generate(config, SAMPLE_GRAPH);

  assert.deepEqual(result.plan.problems, []);
  assert.equal(result.plan.travels, true);
  assertSound(result, 'route');
  assert.match(result.lua, /moveToCell\(hop\[1\], hop\[2\]\)/);
  assert.match(result.lua, /\["Pokecenter Viridian"\] = \{ 9, 14 \}/);
  assert.match(result.lua, /\["Viridian City"\]\s+= \{ 12, 3 \}/);
  assert.ok(result.hostCalls.includes('moveToCell'));
});

test('route mode without a link graph reports a problem instead of emitting a stub', () => {
  const config = configWith((c) => {
    c.route.kind = 'route';
    c.route.farmMap = 'Viridian Forest';
    c.route.pokecenterMap = 'Pokecenter Viridian';
  });
  const result = generate(config, EMPTY_GRAPH);

  assert.equal(result.plan.problems.length, 1);
  assert.match(result.plan.problems[0], /link_graph\.txt/);
  assert.equal(result.plan.travels, false);
  // Still a valid script — it just hunts in place rather than emitting bad hops.
  assertSound(result, 'route-no-graph');
});

test('route mode reports an unreachable destination', () => {
  const config = configWith((c) => {
    c.route.kind = 'route';
    c.route.farmMap = 'Pewter City';
    c.route.pokecenterMap = 'Pokecenter Viridian';
  });
  const result = generate(config, SAMPLE_GRAPH);
  assert.equal(result.plan.problems.length, 1);
  assert.match(result.plan.problems[0], /not in the loaded link graph/);
});

test('a hunting map equal to the Pokécenter map needs no travel', () => {
  const config = configWith((c) => {
    c.route.kind = 'route';
    c.route.farmMap = 'Viridian City';
    c.route.pokecenterMap = 'viridian city';
  });
  const result = generate(config, SAMPLE_GRAPH);
  assert.deepEqual(result.plan.problems, []);
  assert.equal(result.plan.travels, false);
  assertSound(result, 'same-map');
});

test('the opponent status check compares against the host empty-string sentinel', () => {
  const config = configWith((c) => {
    c.battle.status.moves = ['Spore'];
  });
  const result = generate(config);
  assert.match(result.lua, /status ~= nil and status ~= ""/);
  assert.ok(!/"NONE"/.test(code(result.lua)), 'must not compare against "NONE"');
});

test('hostile text in a name cannot escape the Lua literal', () => {
  const config = configWith((c) => {
    c.target.names = ['"); logout("x"); --'];
    c.meta.name = 'evil " name';
  });
  const result = generate(config);
  assertSound(result, 'injection');
  assert.ok(!result.hostCalls.includes('logout'), 'injected call leaked into the script');
});

test('no ball ladder still produces a sound script', () => {
  const config = configWith((c) => { c.battle.balls = []; });
  const result = generate(config);
  assertSound(result, 'no-balls');
  assert.match(result.lua, /No balls configured/);
});

test('an empty target filter matches every encounter', () => {
  const config = configWith((c) => {
    c.target.shiny = false;
    c.target.notCaught = false;
    c.target.names = [];
  });
  const result = generate(config);
  assertSound(result, 'no-filters');
  assert.match(result.lua, /No filters configured/);
});

test('requireAll switches the target filter from OR to AND', () => {
  const build = (requireAll) => generate(configWith((c) => {
    c.target.requireAll = requireAll;
    c.target.names = ['Larvitar'];
    c.target.shiny = true;
  })).lua;

  assert.match(build(false), /isOpponentShiny\(\)\n\s+or \(/);
  assert.match(build(true), /isOpponentShiny\(\)\n\s+and \(/);
});

test('modes that fight everything omit the unreachable fallback', () => {
  const hunt = generate(configWith((c) => { c.mode = 'hunt'; })).lua;
  const exp = generate(configWith((c) => { c.mode = 'exp'; })).lua;
  assert.match(hunt, /Not what we are here for/);
  assert.ok(!/Not what we are here for/.test(exp));
});

test('breaks emit a schedule and a parking action', () => {
  const config = configWith((c) => { c.safety.breaks.enabled = true; });
  const result = generate(config);
  assertSound(result, 'breaks');
  assert.match(result.lua, /local function onBreak\(\)/);
  assert.match(result.lua, /math\.randomseed\(os\.time\(\)\)/);
  assert.ok(result.hostCalls.includes('moveToNormalGround'));
});

test('unused helpers are not emitted', () => {
  const bare = generate(configWith((c) => {
    c.mode = 'gold';
    c.logging.counters = false;
    c.safety.breaks.enabled = false;
    c.mounts.land = '';
    c.mounts.water = '';
    c.safety.onTrapped = '';
    c.team.healOnPPOut = false;
  })).lua;

  assert.ok(!/local function ppLeft/.test(bare), 'ppLeft emitted but unused');
  assert.ok(!/local function pickMount/.test(bare), 'pickMount emitted but unused');
  assert.ok(!/local function onBreak/.test(bare), 'onBreak emitted but unused');
  assert.ok(!/local trapped/.test(bare), 'trapped emitted but unused');
});

test('mounts are applied on start when configured', () => {
  const config = configWith((c) => {
    c.mounts.land = 'Arcanine Mount; Bicycle';
    c.mounts.water = 'Lapras Mount';
  });
  const result = generate(config);
  assertSound(result, 'mounts');
  assert.match(result.lua, /local LAND_MOUNTS  = \{ "Arcanine Mount", "Bicycle" \}/);
  assert.match(result.lua, /setMount\(pickMount\(LAND_MOUNTS\)\)/);
  assert.match(result.lua, /setWaterMount\(pickMount\(WATER_MOUNTS\)\)/);
});

test('the fishing farm action emits useItem with the rod name', () => {
  const config = configWith((c) => {
    c.route.farmAction = 'useItem';
    c.route.farmArgs = 'Super Rod';
  });
  const result = generate(config);
  assertSound(result, 'fishing');
  assert.match(result.lua, /return useItem\("Super Rod"\)/);
});

test('a cell farm action emits numeric coordinates', () => {
  const config = configWith((c) => {
    c.route.farmAction = 'moveToCell';
    c.route.farmArgs = '12, 30';
  });
  const result = generate(config);
  assertSound(result, 'cell');
  assert.match(result.lua, /return moveToCell\(12, 30\)/);
});

test('a non-numeric cell argument degrades to zero rather than emitting nil', () => {
  const config = configWith((c) => {
    c.route.farmAction = 'moveToCell';
    c.route.farmArgs = 'abc, def';
  });
  const result = generate(config);
  assertSound(result, 'bad-cell');
  assert.match(result.lua, /return moveToCell\(0, 0\)/);
});

test('EV mode filters on the configured stat', () => {
  const config = configWith((c) => { c.mode = 'ev'; c.ev.stat = 'spd'; });
  const result = generate(config);
  assertSound(result, 'ev');
  assert.match(result.lua, /isOpponentEffortValue\("SPD"\)/);
});

test('the config header round-trips through the generated document', () => {
  const config = configWith((c) => { c.meta.name = 'Round Trip'; });
  const { document } = generate(config);
  const recovered = parseConfigHeader(document);
  assert.equal(recovered.meta.name, 'Round Trip');
  assert.deepEqual(normaliseConfig(recovered), normaliseConfig(config));
});

test('a config value containing the comment terminator cannot break the header', () => {
  const config = configWith((c) => { c.meta.description = 'closes ]==] early'; });
  const { document } = generate(config);
  const body = document.slice(document.indexOf(']==]') + 4);
  assert.match(body, /^\s*--/, 'header terminated early');
  assert.equal(parseConfigHeader(document).meta.description, 'closes ]==] early');
});

test('parseConfigHeader rejects documents without a usable header', () => {
  assert.equal(parseConfigHeader('function onStart() end'), null);
  assert.equal(parseConfigHeader('--[==[PROBUILDER\nnot json\n]==]'), null);
  assert.equal(parseConfigHeader('--[==[PROBUILDER\n{"a":1}'), null);
  assert.equal(parseConfigHeader(''), null);
  assert.equal(parseConfigHeader(null), null);
});

test('renderConfigHeader always produces a closed Lua long comment', () => {
  const header = renderConfigHeader(createDefaultConfig());
  assert.ok(header.startsWith('--[==[PROBUILDER'));
  assert.ok(header.trimEnd().endsWith(']==]'));
});

test('an unknown mode id fails loudly rather than emitting a broken script', () => {
  assert.throws(
    () => generate(configWith((c) => { c.mode = 'nope'; })),
    /unknown id "nope"/,
  );
});

test('every trainer, other, and weaken policy combination stays sound', () => {
  for (const onTrainer of ['fight', 'run']) {
    for (const onOther of ['run', 'fight', 'weakAttack']) {
      for (const weaken of ['off', 'falseSwipe', 'percent']) {
        const config = configWith((c) => {
          c.battle.onTrainer = onTrainer;
          c.battle.onOther = onOther;
          c.battle.weaken.mode = weaken;
        });
        assertSound(generate(config), `${onTrainer}/${onOther}/${weaken}`);
      }
    }
  }
});

test('every ball condition stays sound', () => {
  for (const condition of ['always', 'turn1', 'status', 'lowHp']) {
    const config = configWith((c) => {
      c.battle.balls = [{ item: 'Ultra Ball', condition }];
    });
    assertSound(generate(config), condition);
  }
});

test('the trap escape never fires on a target the script wants to catch', () => {
  const config = configWith((c) => {
    c.safety.onTrapped = 'relog';
    c.mode = 'hunt';
  });
  const { lua } = generate(config);
  const engageAt = lua.indexOf('if isTarget() then');
  const escapeAt = lua.indexOf('if relogArmed then');
  assert.ok(engageAt > 0 && escapeAt > 0);
  assert.ok(
    escapeAt > engageAt,
    'the escape must sit after the target branch, or it would abandon a shiny',
  );
});

test('the run trap policy emits an escape when the fallback does not already run', () => {
  const config = configWith((c) => {
    c.safety.onTrapped = 'run';
    c.battle.onOther = 'fight';
  });
  const result = generate(config);
  assertSound(result, 'trap-run');
  assert.match(result.lua, /if trapped and run\(\) then return true end/);
});

test('the run trap policy is suppressed when the fallback already leads with run', () => {
  const config = configWith((c) => {
    c.safety.onTrapped = 'run';
    c.battle.onOther = 'run';
  });
  const result = generate(config);
  assertSound(result, 'trap-run-redundant');
  assert.ok(!/if trapped and run\(\)/.test(result.lua), 'emitted a redundant escape');
});

test('the relog trap policy actually relogs instead of only setting a flag', () => {
  const config = configWith((c) => { c.safety.onTrapped = 'relog'; });
  const result = generate(config);
  assertSound(result, 'trap-relog');
  assert.match(result.lua, /local relogArmed  = false/);
  assert.match(result.lua, /if relogArmed then/);
  assert.match(result.lua, /relog\(30, "Trapped in battle — reconnecting\."\)/);
  assert.ok(result.hostCalls.includes('relog'));
});

test('the keep-playing trap policy emits no escape', () => {
  const config = configWith((c) => { c.safety.onTrapped = ''; });
  const result = generate(config);
  assertSound(result, 'trap-none');
  assert.ok(!/relogArmed/.test(result.lua));
  assert.ok(!/if trapped and run\(\)/.test(result.lua));
});

test('modes that engage every encounter emit no trap escape at all', () => {
  for (const mode of ['exp', 'gold']) {
    const result = generate(configWith((c) => {
      c.mode = mode;
      c.safety.onTrapped = 'relog';
    }));
    assertSound(result, `trap-${mode}`);
    assert.ok(!/relogArmed/.test(result.lua), `${mode}: emitted an unreachable escape`);
  }
});

test('mounts are only emitted when at least one is listed', () => {
  const none = generate(configWith((c) => { c.mounts.land = []; c.mounts.water = []; })).lua;
  assert.ok(!/pickMount/.test(none), 'mount helper emitted for an empty list');

  const some = generate(configWith((c) => { c.mounts.land = ['Bicycle']; })).lua;
  assert.match(some, /local LAND_MOUNTS  = \{ "Bicycle" \}/);
});

test('mount lists accept both arrays and delimited strings', () => {
  const fromString = generate(configWith((c) => { c.mounts.land = 'Arcanine Mount; Bicycle'; })).lua;
  const fromArray = generate(configWith((c) => { c.mounts.land = ['Arcanine Mount', 'Bicycle']; })).lua;
  assert.equal(fromString, fromArray);
});

test('hunting in place with breaks does not declare an unused map local', () => {
  const result = generate(configWith((c) => {
    c.route.kind = 'here';
    c.safety.breaks.enabled = true;
  }));
  assertSound(result, 'here-breaks');
  assert.ok(!/local map = getMapName\(\)/.test(result.lua), 'declared an unused local');
});

test('route mode still reads the map name', () => {
  const result = generate(configWith((c) => {
    c.route.kind = 'route';
    c.route.farmMap = 'Viridian Forest';
    c.route.pokecenterMap = 'Pokecenter Viridian';
  }), SAMPLE_GRAPH);
  assert.match(result.lua, /local map = getMapName\(\)/);
});
