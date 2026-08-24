/**
 * Hunting differently at different times: a map per period, a hunting style per
 * period, or both.
 *
 * Run with: node --test tests/
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultConfig, normaliseConfig } from '../assets/builder/js/domain/config.js';
import { LinkGraph } from '../assets/builder/js/domain/link-graph.js';
import { generateScript } from '../assets/builder/js/generators/index.js';
import { runLint } from '../assets/builder/js/lint/rules.js';

const { graph } = LinkGraph.parse([
  'PROCATCHEM-LINKGRAPH\tv1',
  'Pokecenter Viridian\t9\t14\tViridian City',
  'Viridian City\t23\t8\tPokecenter Viridian',
  'Viridian City\t12\t3\tViridian Forest',
  'Viridian Forest\t14\t46\tViridian City',
  'Viridian City\t40\t20\tRoute 21',
  'Route 21\t2\t2\tViridian City',
].join('\n'));

/**
 * @param {(timeOfDay: object, config: object) => void} mutate
 * @returns {import('../assets/builder/js/generators/index.js').GenerationResult}
 */
function build(mutate) {
  const config = createDefaultConfig();
  config.route.timeOfDay.enabled = true;
  mutate(config.route.timeOfDay, config);
  return generateScript(normaliseConfig(config), graph);
}

/** The hunting half of onPathAction. */
function farmBranch(lua) {
  const start = lua.indexOf('if teamIsReady() then');
  assert.ok(start >= 0, 'the farm branch was not emitted');
  return lua.slice(start, lua.indexOf('\n\n', start));
}

/**
 * @param {import('../assets/builder/js/generators/index.js').GenerationResult} result
 * @param {object} config
 * @returns {import('../assets/builder/js/lint/rules.js').Finding[]}
 */
function lint(result, config) {
  return runLint({
    config,
    plan: result.plan,
    mode: result.mode,
    zones: result.zones,
    team: result.team,
    unknownCalls: result.unknownCalls,
    retiredCalls: result.retiredCalls,
  });
}

test('a period may change only the hunting style, staying on the same map', () => {
  const result = build((timeOfDay) => {
    timeOfDay.nightAction = 'fish';
    timeOfDay.nightArgs = '12, 30';
    timeOfDay.nightRod = 'Super Rod';
  });
  const branch = farmBranch(result.lua);

  assert.match(branch, /if isNight\(\) then/);
  assert.match(branch, /return useItem\("Super Rod"\)/);
  assert.match(branch, /return moveToGrass\(\)/, 'the main action stays as the fallback');
  assert.equal(result.plan.timeOfDay, false, 'no extra route is needed for a style change');
  assert.deepEqual(result.unknownCalls, []);
});

test('a period may change only the map, keeping the hunting style', () => {
  const result = build((timeOfDay, config) => {
    config.route.kind = 'route';
    config.route.farmMap = 'Viridian Forest';
    config.route.pokecenterMap = 'Pokecenter Viridian';
    timeOfDay.morningMap = 'Route 21';
  });

  assert.equal(result.plan.timeOfDay, true);
  assert.match(result.lua, /local TO_FARM_MORNING = \{/);
  assert.match(result.lua, /if isMorning\(\) then return "Route 21", TO_FARM_MORNING, TO_HEAL_MORNING end/);
  assert.deepEqual(result.unknownCalls, []);
});

test('every period can hunt its own way at once', () => {
  const result = build((timeOfDay) => {
    Object.assign(timeOfDay, {
      morningAction: 'moveToWater',
      noonAction: 'useItem',
      noonArgs: 'Repel',
      nightAction: 'moveToCell',
      nightArgs: '5, 5',
    });
  });
  const branch = farmBranch(result.lua);

  // Each branch ends in its own action; the land ones carry a surf guard first.
  assert.match(branch, /if isMorning\(\) then\n {12}return moveToWater\(\)\n {8}end/);
  assert.match(branch, /if isNight\(\) then[\s\S]*?return moveToCell\(5, 5\)\n {8}end/);
  assert.match(branch, /if isNoon\(\) then[\s\S]*?return useItem\("Repel"\)\n {8}end/);
  assert.equal(branch.match(/isSurfing\(\)/g)?.length, 3, 'one guard per land branch, plus the fallback');
  assert.deepEqual(result.unknownCalls, []);
});

test('the surf guard follows the action of the branch it is in', () => {
  const result = build((timeOfDay) => {
    timeOfDay.morningAction = 'moveToWater';
  });
  const branch = farmBranch(result.lua);
  const morning = branch.slice(branch.indexOf('if isMorning() then'), branch.indexOf('return moveToWater()'));

  assert.doesNotMatch(morning, /moveToNormalGround/, 'surfing on purpose must not be undone');
  assert.match(branch, /if isSurfing\(\) then return moveToNormalGround\(\) end\n {8}return moveToGrass\(\)/);
});

test('a period that repeats the main action emits no branch', () => {
  const result = build((timeOfDay) => { timeOfDay.morningAction = 'moveToGrass'; });
  assert.doesNotMatch(result.lua, /isMorning/);
});

test('a period style is ignored while zones are active, and the lint says so', () => {
  const config = createDefaultConfig();
  config.route.zones = ['1,1,9,9'];
  config.route.timeOfDay.enabled = true;
  config.route.timeOfDay.nightAction = 'moveToWater';
  const normalised = normaliseConfig(config);
  const result = generateScript(normalised, graph);

  assert.doesNotMatch(result.lua, /if isNight\(\) then\n {12}return moveToWater/);
  assert.ok(
    lint(result, normalised).some((finding) => /Farm zones replace the hunting action/.test(finding.message)),
  );
});

test('an incomplete period is reported per period', () => {
  const config = createDefaultConfig();
  Object.assign(config.route.timeOfDay, {
    enabled: true,
    nightAction: 'fish',
    morningAction: 'useItem',
    noonAction: 'moveToCell',
  });
  const normalised = normaliseConfig(config);
  const messages = lint(generateScript(normalised, graph), normalised)
    .filter((finding) => finding.level === 'error')
    .map((finding) => finding.message);

  assert.ok(messages.some((text) => /Night: hunting this way needs a cell/.test(text)));
  assert.ok(messages.some((text) => /Night: fishing needs a rod/.test(text)));
  assert.ok(messages.some((text) => /Morning: this needs an item name/.test(text)));
  assert.ok(messages.some((text) => /Noon: hunting this way needs a cell/.test(text)));
});

test('time-of-day with nothing configured is reported as having no effect', () => {
  const config = normaliseConfig({
    ...createDefaultConfig(),
    route: { ...createDefaultConfig().route, timeOfDay: { ...createDefaultConfig().route.timeOfDay, enabled: true } },
  });
  const messages = lint(generateScript(config, graph), config).map((finding) => finding.message);
  assert.ok(messages.some((text) => /no period changes anything/.test(text)));
});
