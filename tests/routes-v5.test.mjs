/**
 * The route work added in v5: a Pokécenter per period, the switch through it,
 * finding the way home from anywhere, hunting on any map, and putting the
 * ground mount back on after a stop drops it.
 *
 * Run with: node --test tests/
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { normaliseConfig } from '../assets/builder/js/domain/config.js';
import { LinkGraph } from '../assets/builder/js/domain/link-graph.js';
import { generateScript } from '../assets/builder/js/generators/index.js';

/**
 * Two towns, each with a Pokécenter, joined through a shared city — enough to
 * tell "walked out and back" apart from "knows the way home from anywhere".
 */
const { graph: GRAPH } = LinkGraph.parse([
  'PROCATCHEM-LINKGRAPH\tv1',
  'Pokecenter Viridian\t9\t14\tViridian City',
  'Viridian City\t23\t8\tPokecenter Viridian',
  'Viridian City\t12\t3\tViridian Forest',
  'Viridian Forest\t14\t46\tViridian City',
  'Viridian City\t40\t20\tRoute 21',
  'Route 21\t2\t2\tViridian City',
  'Route 21\t60\t11\tPewter City',
  'Pewter City\t1\t1\tRoute 21',
  'Pewter City\t5\t5\tPokecenter Pewter',
  'Pokecenter Pewter\t4\t9\tPewter City',
].join('\n'));

/**
 * @param {(config: object) => void} [adjust]
 * @returns {import('../assets/builder/js/generators/index.js').GenerationResult}
 */
function build(adjust) {
  const config = normaliseConfig({
    route: {
      kind: 'route',
      farmMap: 'Viridian Forest',
      pokecenterMap: 'Pokecenter Viridian',
    },
  });
  adjust?.(config);
  const result = generateScript(config, GRAPH);
  assert.deepEqual(result.plan.problems, [], 'the route should plan cleanly');
  assert.deepEqual(result.unknownCalls, [], 'every call must resolve');
  assert.deepEqual(result.retiredCalls, [], 'no retired call may be emitted');
  return result;
}

test('the return table knows the way home from every map in the graph', () => {
  const result = build();

  const table = result.lua.match(/local TO_HEAL = \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(table, /\["Route 21"\]/, 'a map the route never visits still needs a hop');
  assert.match(table, /\["Pokecenter Pewter"\]/, 'so does one two towns away');
  assert.match(
    result.lua,
    /if walk\(TO_FARM\) then return true end/,
    'the outbound table is tried first, with the recovery table behind it',
  );
});

test('recovery can be switched off, and then the tables shrink again', () => {
  const result = build((config) => {
    config.route.recoverWhenLost = false;
  });

  const table = result.lua.match(/local TO_HEAL = \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.ok(!/Pokecenter Pewter/.test(table), 'an unrelated town has no business in the table');
  assert.match(result.lua, /return walk\(TO_FARM\)/, 'no recovery fallback to fall through to');
});

test('a period can be anchored at its own Pokécenter', () => {
  const result = build((config) => {
    Object.assign(config.route.timeOfDay, {
      enabled: true,
      nightMap: 'Route 21',
      nightPokecenter: 'Pokecenter Pewter',
    });
  });

  assert.equal(result.plan.switchesCentre, true);
  assert.match(result.lua, /local TO_HEAL_NIGHT = \{/, 'the second Pokécenter needs its own table');
  assert.match(
    result.lua,
    /if isNight\(\) then return "Route 21", "Pokecenter Pewter", TO_FARM_NIGHT, TO_HEAL_NIGHT end/,
  );
  assert.match(result.lua, /if map == pcMap then/, 'healing follows the period, not the main route');
});

test('two periods that heal in the same place share one return table', () => {
  const result = build((config) => {
    Object.assign(config.route.timeOfDay, { enabled: true, nightMap: 'Route 21' });
  });

  assert.equal(result.plan.switchesCentre, false);
  assert.ok(!/TO_HEAL_NIGHT/.test(result.lua), 'one Pokécenter, one way home');
  assert.match(result.lua, /local TO_HEAL = \{/);
});

test('changing period routes through the new Pokécenter, but not at startup', () => {
  const result = build((config) => {
    Object.assign(config.route.timeOfDay, {
      enabled: true,
      nightMap: 'Route 21',
      nightPokecenter: 'Pokecenter Pewter',
    });
  });

  assert.match(result.lua, /local currentCentre = nil/);
  assert.match(
    result.lua,
    /if currentCentre ~= nil then needCentre = true end/,
    'the first frame sets the leg without arming the detour',
  );
  assert.match(result.lua, /if needCentre then/);
});

test('going straight to the new spot emits no switch at all', () => {
  const result = build((config) => {
    config.route.switchVia = 'direct';
    Object.assign(config.route.timeOfDay, {
      enabled: true,
      nightMap: 'Route 21',
      nightPokecenter: 'Pokecenter Pewter',
    });
  });

  assert.ok(!/needCentre/.test(result.lua));
  assert.match(result.lua, /local farmMap, pcMap, toFarm, toHeal = activeLeg\(\)/);
});

test('a period may heal differently and end differently', () => {
  const result = build((config) => {
    Object.assign(config.route.timeOfDay, {
      enabled: true,
      nightPokecenter: 'Pokecenter Pewter',
      nightHealAction: 'talkToNpcOnCell',
      nightHealArgs: '3, 4',
      nightEndBehaviour: 'stop',
    });
  });

  assert.match(result.lua, /if isNight\(\) then\n\s+return talkToNpcOnCell\(3, 4\)\n\s+end\n\s+return usePokecenter\(\)/);
  assert.match(result.lua, /if isNight\(\) then\n\s+-- Configured to stop[\s\S]*?fatal\(/);
});

test('a period may work its own patches', () => {
  const result = build((config) => {
    config.route.zones = ['10, 10, 20, 20'];
    Object.assign(config.route.timeOfDay, {
      enabled: true,
      nightMap: 'Route 21',
      nightZones: ['30, 30, 40, 40', '50, 50, 60, 60'],
    });
  });

  assert.match(result.lua, /local ZONES_NIGHT = \{/);
  assert.match(result.lua, /if isNight\(\) then return ZONES_NIGHT end/);
  assert.match(result.lua, /local set = activeZones\(\)/);
  assert.match(result.lua, /if zoneIdx > #set then zoneIdx = 1 end/, 'a shorter list must not be indexed off the end');
});

test('hunting anywhere drops the map check but keeps the walk home', () => {
  const result = build((config) => {
    config.route.huntAnywhere = true;
  });

  assert.ok(
    !/if map == "Viridian Forest" then/.test(result.lua),
    'the whole point is that the hunting map no longer gates farming',
  );
  assert.match(result.lua, /if map == "Pokecenter Viridian" then/, 'healing still needs the right map');
});

test('a stop that drops the mount turns it back on once the map is behind us', () => {
  const result = build((config) => {
    config.mounts.land = ['Arcanine Mount'];
    config.route.stops = [{ map: 'Viridian City', mount: 'off', terrain: 'any' }];
  });

  assert.match(result.lua, /local NO_MOUNT = \{\n {4}\["Viridian City"\] = true,/);
  assert.match(result.lua, /mountDropped = true/);
  assert.match(
    result.lua,
    /if mountDropped and not NO_MOUNT\[map\] and not isSurfing\(\) then/,
    'Surf is not a ground mount and must not be interrupted',
  );
});

test('with no mount configured there is nothing to put back on', () => {
  const result = build((config) => {
    config.route.stops = [{ map: 'Viridian City', mount: 'off', terrain: 'any' }];
  });

  assert.ok(!/NO_MOUNT/.test(result.lua));
  assert.ok(!/mountDropped/.test(result.lua));
  assert.match(result.lua, /if isMounted\(\) then return disMount\(\) end/, 'still a one-liner');
});

test('patches that belong to one period are not used outside it', () => {
  // Rectangles are measured on the map the period hunts, so standing in for
  // the rest of the day would walk to coordinates on the wrong map.
  const result = build((config) => {
    config.route.zones = [];
    Object.assign(config.route.timeOfDay, {
      enabled: true,
      nightMap: 'Route 21',
      nightZones: ['30, 30, 40, 40'],
    });
  });

  assert.match(result.lua, /local ZONES_NIGHT = \{/);
  assert.ok(!/local set = ZONES\b/.test(result.lua), 'there is no all-day list to name');
  assert.match(result.lua, /if isNight\(\) then return ZONES_NIGHT end\n {4}return nil/);
  assert.match(result.lua, /if not set then return false end/);
  assert.match(
    result.lua,
    /if farmZone\(\) then return true end[\s\S]*?return moveToGrass\(\)/,
    'the other periods fall through to the plain hunting action',
  );
});

test('two centres still get a selector even when neither leg walks', () => {
  // Both periods hunt on the map their own Pokécenter is on, so each leg's own
  // journey is empty. The clock can still move the run from one to the other,
  // and that walk has to be planned — otherwise the night leg is never handled.
  const result = build((config) => {
    config.route.recoverWhenLost = false;
    config.route.farmMap = 'Pokecenter Viridian';
    Object.assign(config.route.timeOfDay, {
      enabled: true,
      nightMap: 'Pokecenter Pewter',
      nightPokecenter: 'Pokecenter Pewter',
    });
  });

  assert.equal(result.plan.switchesCentre, true, 'the periods do heal in different places');
  assert.match(result.lua, /local function activeLeg\(\)/);
  assert.match(result.lua, /if isNight\(\) then return "Pokecenter Pewter", "Pokecenter Pewter"/);
  assert.match(
    result.lua,
    /local TO_HEAL_NIGHT = \{\n {4}\["Pokecenter Viridian"\]/,
    'the way to the night Pokécenter starts from the day one',
  );
});

test('hunting anywhere while dismounting leaves the mount off', () => {
  const result = build((config) => {
    config.mounts.land = ['Arcanine Mount'];
    config.mounts.dismountOnFarm = true;
    config.route.huntAnywhere = true;
  });

  assert.ok(
    !/mountDropped/.test(result.lua),
    'restoring it would only have it taken off again on the next frame',
  );
  assert.match(result.lua, /if isMounted\(\) then return disMount\(\) end/);
});

test('a break is taken at the Pokécenter of whichever period is running', () => {
  const result = build((config) => {
    config.safety.breaks.enabled = true;
    Object.assign(config.route.timeOfDay, {
      enabled: true,
      nightMap: 'Route 21',
      nightPokecenter: 'Pokecenter Pewter',
    });
  });

  const breakBlock = result.lua.match(/if onBreak\(\) then[\s\S]*?\n {4}end/)?.[0] ?? '';
  assert.match(breakBlock, /if map == pcMap then/, 'a fixed map name would be the wrong one at night');
  assert.match(breakBlock, /return walk\(toHeal\)/);
});

test('staying put and dismounting leaves the mount off', () => {
  // "Stay put" hunts on whatever map the bot stands on, so there is no map
  // where the mount can safely come back — putting it on would only have the
  // farm action take it off again on the next frame.
  const result = build((config) => {
    config.route.kind = 'here';
    config.mounts.land = ['Bicycle'];
    config.mounts.dismountOnFarm = true;
  });

  assert.ok(!/mountDropped/.test(result.lua));
  assert.ok(!/NO_MOUNT/.test(result.lua));
});

test('a one-way graph is reported even when recovery is on', () => {
  // Recovery answers "which way home" for the whole graph, so a spot it cannot
  // answer for is genuinely stranded — and used to be reported as a clean route
  // with an empty table.
  const { graph } = LinkGraph.parse([
    'PROCATCHEM-LINKGRAPH\tv1',
    'Pokecenter Viridian\t9\t14\tViridian City',
    'Viridian City\t12\t3\tViridian Forest',
  ].join('\n'));

  for (const recoverWhenLost of [true, false]) {
    const config = normaliseConfig({
      route: {
        kind: 'route',
        farmMap: 'Viridian Forest',
        pokecenterMap: 'Pokecenter Viridian',
        recoverWhenLost,
      },
    });
    const { plan } = generateScript(config, graph);
    assert.match(
      plan.problems.join('\n'),
      /No path from "Viridian Forest" to "Pokecenter Viridian"/,
      `recoverWhenLost=${recoverWhenLost} should have reported the dead end`,
    );
  }
});

test('the way home works from the other period’s spot too', () => {
  // At dusk the bot is standing wherever the day route left it, so the night
  // route's way home has to start from there and not only from its own spot.
  const result = build((config) => {
    config.route.recoverWhenLost = false;
    Object.assign(config.route.timeOfDay, {
      enabled: true,
      nightMap: 'Route 21',
      nightPokecenter: 'Pokecenter Pewter',
    });
  });

  const night = result.lua.match(/local TO_HEAL_NIGHT = \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(night, /\["Viridian Forest"\]/, 'the day spot has to be able to reach the night centre');
  const day = result.lua.match(/local TO_HEAL = \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(day, /\["Route 21"\]/, 'and the night spot the day centre');
});

test('hunting anywhere emits no table for the walk it never takes', () => {
  const result = build((config) => {
    config.route.huntAnywhere = true;
  });

  assert.ok(!/TO_FARM/.test(result.lua), 'the outbound table is never consulted');
  assert.match(result.lua, /local TO_HEAL = \{/, 'the walk back to heal still happens');
});

test('an EV table that is finished ends the run', () => {
  const config = normaliseConfig({
    mode: 'ev',
    route: { kind: 'here', endBehaviour: 'stop', endMessage: 'Every spread is done.' },
    team: {
      rotation: {
        mode: 'uidEv',
        goals: [{ id: 'Larvitar', stat: 'ATK', target: 252 }],
      },
    },
  });
  const result = generateScript(config, GRAPH);

  assert.deepEqual(result.unknownCalls, []);
  assert.match(result.lua, /local function evGoalsPending\(\)/);
  assert.match(
    result.lua,
    /if not evGoalsPending\(\) then return false end/,
    'the farm guard has to see it, or the run flees encounters forever instead of stopping',
  );
  assert.match(result.lua, /fatal\("Every spread is done\."\)/);
});
