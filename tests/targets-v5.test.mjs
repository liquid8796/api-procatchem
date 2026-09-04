/**
 * The battle-side work added in v5: the extra target filters, what a match is
 * for, "fight only if…", rotation lists that accept names, an EV table with
 * two stats for one Pokémon, and swapping the API catalog at runtime.
 *
 * Run with: node --test tests/
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { normaliseConfig } from '../assets/builder/js/domain/config.js';
import { LinkGraph } from '../assets/builder/js/domain/link-graph.js';
import { generateScript } from '../assets/builder/js/generators/index.js';
import { runLint } from '../assets/builder/js/lint/rules.js';
import { apiEntry, apiVersion, isCustomCatalog, loadSpec, resetCatalog } from '../assets/builder/js/domain/api-registry.js';
import { isHostFunction } from '../assets/builder/js/domain/host-api.js';
import { configFromAnswers } from '../assets/builder/js/ui/quick-build.js';

/**
 * @param {(config: object) => void} [adjust]
 * @returns {import('../assets/builder/js/generators/index.js').GenerationResult}
 */
function build(adjust) {
  const config = normaliseConfig({});
  adjust?.(config);
  const result = generateScript(config, new LinkGraph());
  assert.deepEqual(result.unknownCalls, [], 'every call must resolve');
  assert.deepEqual(result.retiredCalls, []);
  return result;
}

/**
 * @param {import('../assets/builder/js/generators/index.js').GenerationResult} result
 * @param {object} config
 * @returns {ReturnType<typeof runLint>}
 */
function lintOf(result, config) {
  return runLint({
    config,
    plan: result.plan,
    mode: result.mode,
    zones: result.zones,
    team: result.team,
    linkGraph: new LinkGraph(),
    unknownCalls: result.unknownCalls,
    retiredCalls: result.retiredCalls,
  });
}

/** @param {string} lua @returns {string} the body of isTarget() */
function targetBody(lua) {
  return lua.match(/local function isTarget\(\)[\s\S]*?\nend/)?.[0] ?? '';
}

test('an alternate form and an effort-value yield are plain calls', () => {
  const result = build((config) => {
    config.target.shiny = false;
    config.target.form = true;
    config.target.evYield = 'SPD';
  });

  const body = targetBody(result.lua);
  assert.match(body, /getOpponentForm\(\) ~= 0/);
  assert.match(body, /isOpponentEffortValue\("SPD"\)/);
});

test('an ability filter becomes a flag raised from the battle log', () => {
  const result = build((config) => {
    config.target.shiny = false;
    config.target.abilities = ['Contrary'];
    config.team.secondAbility = 'Trace';
  });

  const flag = result.lua.match(/local (heard_contrary_\w+) = false/)?.[1];
  assert.ok(flag, 'the filter needs somewhere to remember what it heard');
  assert.match(targetBody(result.lua), new RegExp(`return ${flag}`));
  assert.match(result.lua, new RegExp(`if stringContains\\(message, "Contrary"\\) then ${flag} = true end`));
});

test('the lint asks for the lead that makes those filters work', () => {
  const config = normaliseConfig({ target: { abilities: ['Contrary'], heldItems: ['Leftovers'] } });
  const withoutLead = lintOf(generateScript(config, new LinkGraph()), config);
  const messages = withoutLead.map((finding) => finding.message).join('\n');
  assert.match(messages, /Trace/);
  assert.match(messages, /Frisk/);

  config.team.leadAbility = 'Trace';
  config.team.secondAbility = 'Frisk';
  const withLead = lintOf(generateScript(config, new LinkGraph()), config)
    .map((finding) => finding.message).join('\n');
  assert.ok(!/Trace lead/.test(withLead), 'the ask should go away once the lead is pinned');
});

test('a match can be knocked out instead of caught, and then no ladder is emitted', () => {
  const result = build((config) => {
    config.target.onMatch = 'fight';
  });

  assert.ok(!/local function tryCatch/.test(result.lua), 'nothing calls it, so nothing defines it');
  assert.ok(!/useItem\("Ultra Ball"\)/.test(result.lua));
  assert.match(result.lua, /if isTarget\(\) then\n {8}return attack\(\)/);
});

test('a match can stop the bot for a human to take over', () => {
  const result = build((config) => {
    config.target.onMatch = 'stop';
  });

  assert.match(result.lua, /log\("Target found: " \.\. getOpponentName\(\)/);
  assert.match(result.lua, /fatal\("A target turned up\. The bot is yours\."\)/);
});

test('"fight only if" gates the knock-out and flees everything else', () => {
  const result = build((config) => {
    config.battle.onOther = 'conditional';
    config.battle.otherGuard = {
      op: 'and',
      negate: false,
      items: [{ kind: 'oppLevel', params: { cmp: '<=', value: 20 }, negate: false }],
    };
  });

  assert.match(result.lua, /if getOpponentLevel\(\) <= 20 then\n\s+return attack\(\)/);
  assert.match(result.lua, /return run\(\) or attack\(\)/, 'the rest are still fled');
});

test('an empty "fight only if" flees everything, and says so', () => {
  const config = normaliseConfig({ battle: { onOther: 'conditional' } });
  const result = generateScript(config, new LinkGraph());

  assert.match(result.lua, /-- No condition set for fighting these/);
  assert.match(
    lintOf(result, config).map((finding) => finding.message).join('\n'),
    /has no condition yet/,
  );
});

test('a rotation list takes names as happily as unique ids', () => {
  const result = build((config) => {
    config.team.rotation.mode = 'uid';
    config.team.rotation.ids = ['12345', 'Larvitar'];
  });

  assert.match(result.lua, /local ROTATE_IDS = \{ 12345, "Larvitar" \}/);
  assert.match(result.lua, /if type\(entry\) == "number" then return getPokemonUniqueId\(slot\) == entry end/);
  assert.match(result.lua, /return getPokemonName\(slot\) == entry/);
});

test('one Pokémon can hold two rows of the EV table, one per stat', () => {
  const config = normaliseConfig({
    mode: 'ev',
    team: {
      rotation: {
        mode: 'uidEv',
        goals: [
          { id: 'Larvitar', stat: 'ATK', target: 252 },
          { id: 'Larvitar', stat: 'HP', target: 252 },
        ],
      },
    },
  });
  const result = generateScript(config, new LinkGraph());

  assert.deepEqual(result.unknownCalls, []);
  assert.match(result.lua, /\{ "Larvitar", "ATK", 252 \},\n\s+\{ "Larvitar", "HP", 252 \},/);
  assert.match(
    result.lua,
    /if getPokemonEffortValue\(1, goal\[2\]\) < goal\[3\] then return goal\[2\] end/,
    'the filter must follow the stat still owed, not the first row that matches',
  );
  assert.ok(
    !lintOf(result, config).some((finding) => /listed twice/.test(finding.message)),
    'two stats for one Pokémon is the feature, not a mistake',
  );
});

test('the same stat twice for one Pokémon is still reported', () => {
  const config = normaliseConfig({
    mode: 'ev',
    team: {
      rotation: {
        mode: 'uidEv',
        goals: [
          { id: 'Larvitar', stat: 'ATK', target: 252 },
          { id: 'Larvitar', stat: 'ATK', target: 100 },
        ],
      },
    },
  });
  const findings = lintOf(generateScript(config, new LinkGraph()), config);
  assert.ok(findings.some((finding) => /never reached/.test(finding.message)));
});

test('the quick form assembles a configuration the generator accepts', () => {
  const answers = {
    mode: 'hunt',
    route: {
      kind: 'here', farmMap: '', pokecenterMap: '',
      farmAction: 'moveToGrass', farmArgs: '', farmRod: 'Super Rod',
    },
    mounts: { land: ['Bicycle'], water: [] },
    target: {
      names: ['Ralts'], shiny: true, notCaught: false,
      levelMin: 10, levelMax: 30, onMatch: 'catch',
    },
    battle: {
      weakenMode: 'falseSwipe', weakenPercent: 30,
      statusMoves: ['Spore'], requireStatus: true,
    },
    team: {
      rotationMode: 'off', evStat: 'SPD', evTarget: 252,
      leadAbility: 'Synchronize', healBelowUsable: 2, leadItem: 'Leftovers',
    },
    safety: { breaks: true },
  };

  const config = configFromAnswers(answers);
  assert.equal(config.target.levelMin, 10);
  assert.equal(config.safety.breaks.enabled, true);
  assert.deepEqual(config.mounts.land, ['Bicycle']);

  const result = generateScript(config, new LinkGraph());
  assert.deepEqual(result.unknownCalls, []);
  assert.match(result.lua, /getOpponentName\(\) == "Ralts"/);
});

test('a spec loaded at runtime replaces the API in force, and can be undone', () => {
  const before = apiVersion();
  assert.equal(isCustomCatalog(), false);

  const spec = readFileSync('openapi.yaml', 'utf8')
    .replace('operationId: getMapName', 'operationId: getMapNickname');
  const diff = loadSpec(spec);

  assert.ok(diff.added.includes('getMapNickname'), `expected the renamed entry, got ${diff.added}`);
  assert.ok(diff.removed.includes('getMapName'));
  assert.equal(isCustomCatalog(), true);
  assert.ok(apiEntry('getMapNickname'), 'the browser and the completion lists read through here');
  assert.equal(
    isHostFunction('getMapNickname'),
    true,
    'a function the new spec documents must verify rather than read as a typo',
  );

  resetCatalog();
  assert.equal(isCustomCatalog(), false);
  assert.equal(apiVersion(), before);
  assert.equal(apiEntry('getMapNickname'), null);
  assert.equal(isHostFunction('getMapNickname'), false);
});

test('both forms rebuild through the caret rescue', () => {
  // Neither form can be rendered in this runner, so the guard is structural:
  // a rebuild-from-state that forgets this drops focus on every keystroke.
  for (const file of ['assets/builder/js/ui/app.js', 'assets/builder/js/ui/quick-build.js']) {
    assert.match(readFileSync(file, 'utf8'), /keepingFocus\(\(\) => \{/, `${file} rebuilds without it`);
  }
});

test('a spec that drops a function does not break a script that calls it', () => {
  // host-api.js mirrors what the host actually registers and stays the
  // authority on that; the spec is documentation. A function disappearing from
  // the docs must not make a working script read as broken.
  const config = normaliseConfig({});
  // Drop the whole path item, the way a spec that retired the call would.
  const spec = readFileSync('openapi.yaml', 'utf8')
    .replace(/\n {2}\/lua\/map-and-npc\/getmapname:[\s\S]*?(?=\n {2}\/lua\/)/, '');
  const diff = loadSpec(spec);

  try {
    assert.ok(diff.removed.includes('getMapName'), `getMapName should be gone, removed: ${diff.removed}`);
    assert.equal(apiEntry('getMapName'), null, 'the browser no longer documents it');
    assert.equal(isHostFunction('getMapName'), true, 'but the host still registers it');
    assert.deepEqual(generateScript(config, new LinkGraph()).unknownCalls, []);
  } finally {
    resetCatalog();
  }
});

test('a period that repeats the main map earns no route of its own', () => {
  const config = normaliseConfig({
    route: {
      kind: 'here',
      farmMap: 'Viridian Forest',
      timeOfDay: { enabled: true, nightMap: 'Viridian Forest' },
    },
  });
  const result = generateScript(config, new LinkGraph());

  assert.equal(result.plan.legs.length, 0, 'hunting in place plans no legs at all');
  assert.ok(!/isNight\(\)/.test(result.lua), 'nothing about the night differs, so nothing is emitted');
});

test('a level range OR-ed with the other filters is called out', () => {
  const config = normaliseConfig({
    target: { shiny: true, levelMin: 40, levelMax: 50, requireAll: false },
  });
  const loose = lintOf(generateScript(config, new LinkGraph()), config)
    .map((finding) => finding.message).join('\n');
  assert.match(loose, /matches on its own rather than narrowing/);

  config.target.requireAll = true;
  const strict = lintOf(generateScript(config, new LinkGraph()), config)
    .map((finding) => finding.message).join('\n');
  assert.ok(!/matches on its own/.test(strict), 'with "all must match" it really is a limit');
});

test('a period that only changes the Pokécenter is not called pointless', () => {
  const { graph } = LinkGraph.parse([
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
  const config = normaliseConfig({
    route: {
      kind: 'route',
      farmMap: 'Viridian Forest',
      pokecenterMap: 'Pokecenter Viridian',
      timeOfDay: { enabled: true, nightPokecenter: 'Pokecenter Pewter', nightEndBehaviour: 'stop' },
    },
  });
  const result = generateScript(config, graph);

  assert.equal(result.plan.legs.length, 2, 'it changes plenty');
  const findings = runLint({
    config,
    plan: result.plan,
    mode: result.mode,
    zones: result.zones,
    team: result.team,
    linkGraph: graph,
    unknownCalls: result.unknownCalls,
    retiredCalls: result.retiredCalls,
  }).map((finding) => finding.message).join('\n');
  assert.ok(!/no period changes anything/.test(findings));
});
