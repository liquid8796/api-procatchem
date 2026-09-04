/**
 * Every emitter is guarded by a flag in the feature analysis, and every flag
 * has to agree with the emitter that declares the variable it depends on. The
 * API check catches a call to a function that does not exist; it cannot see a
 * script reading `pcMap` in a configuration where the route never declared one.
 *
 * So this sweeps the options that interact against each other, and reads the
 * output for a name used without a `local` for it. It is the check that would
 * have caught "the period switch is emitted for a route that never emitted the
 * leg selector".
 *
 * Run with: node --test tests/
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { normaliseConfig } from '../assets/builder/js/domain/config.js';
import { LinkGraph } from '../assets/builder/js/domain/link-graph.js';
import { generateScript } from '../assets/builder/js/generators/index.js';
import { runLint } from '../assets/builder/js/lint/rules.js';

/** Two towns, each with a Pokécenter, so a period can be anchored elsewhere. */
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

/**
 * Locals and tables the runtime only declares for some configurations. A name
 * missing from this list is simply not checked, so adding a conditional local
 * means adding it here too.
 */
const GUARDED_NAMES = Object.freeze([
  'mountDropped', 'NO_MOUNT', 'currentLeg', 'needCentre',
  'legId', 'farmMap', 'pcMap', 'toFarm', 'toHeal',
  'zoneIdx', 'zoneFlip', 'zoneReroll', 'zoneTimer', 'zoneDue',
  'trapped', 'relogArmed', 'F',
  'ZONES', 'ZONES_MORNING', 'ZONES_NOON', 'ZONES_NIGHT',
  'TO_FARM', 'TO_HEAL', 'TO_FARM_MORNING', 'TO_HEAL_MORNING',
  'TO_FARM_NOON', 'TO_HEAL_NOON', 'TO_FARM_NIGHT', 'TO_HEAL_NIGHT',
  'LAND_MOUNTS', 'WATER_MOUNTS', 'ROTATE_IDS', 'EV_GOALS', 'LEAD_ITEM',
  'nextBreakAt', 'breakUntil', 'wildSeen', 'shinySeen', 'caught', 'startMoney',
]);

/**
 * @param {string} lua
 * @returns {string[]} guarded names the script reads but never declares
 */
function undeclared(lua) {
  // Comments and strings would give false positives — a name is often
  // mentioned in the comment that explains it.
  const body = lua
    .replace(/--\[(=*)\[[\s\S]*?\]\1\]/g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');

  return GUARDED_NAMES.filter((name) => {
    const declared = new RegExp(`local\\s+(?:[\\w, ]*\\b)?${name}\\b`).test(body);
    const used = new RegExp(`(?<!local\\s)\\b${name}\\b`).test(body);
    return used && !declared;
  });
}

/** The settings most likely to interact; every combination of these is built. */
const CROSSED = Object.freeze({
  kind: ['here', 'route'],
  // The second value puts the hunting map on the Pokécenter itself, which is
  // the case where a route plans no walking at all.
  farmMap: ['Viridian Forest', 'Pokecenter Viridian'],
  recoverWhenLost: [true, false],
  huntAnywhere: [true, false],
  switchVia: ['center', 'direct'],
  period: ['none', 'map', 'centre', 'zones', 'heal', 'end'],
  stop: ['none', 'off', 'force'],
});

/** Everything else, rotated through so each value is paired with many others. */
const ROTATED = Object.freeze({
  zones: [[], ['10,10,20,20'], ['10,10,20,20', '30,5,40,15']],
  mount: [[], ['Arcanine Mount']],
  dismountOnFarm: [true, false],
  onMatch: ['catch', 'fight', 'run', 'stop'],
  onOther: ['run', 'conditional'],
  rotation: ['off', 'uid', 'uidEv'],
  breaks: [true, false],
});

const LEVEL_GUARD = Object.freeze({
  op: 'and',
  negate: false,
  items: [{ kind: 'oppLevel', params: { cmp: '<=', value: 20 }, negate: false }],
});

/**
 * @param {object} pick
 * @returns {object} the per-period overrides that choice implies
 */
function periodOverrides(pick) {
  const timeOfDay = { enabled: pick.period !== 'none' };
  const elsewhere = pick.farmMap === 'Viridian Forest' ? 'Route 21' : 'Pokecenter Pewter';

  if (pick.period === 'map') timeOfDay.nightMap = elsewhere;
  if (pick.period === 'centre') {
    timeOfDay.nightMap = elsewhere;
    timeOfDay.nightPokecenter = 'Pokecenter Pewter';
  }
  if (pick.period === 'zones') timeOfDay.nightZones = ['30,30,40,40'];
  if (pick.period === 'heal') {
    timeOfDay.nightHealAction = 'talkToNpcOnCell';
    timeOfDay.nightHealArgs = '3, 4';
  }
  if (pick.period === 'end') timeOfDay.nightEndBehaviour = 'stop';
  return timeOfDay;
}

/** @returns {object[]} one settings object per configuration to build */
function configurations() {
  const crossed = Object.entries(CROSSED).reduce(
    (rows, [key, values]) => rows.flatMap((row) => values.map((value) => ({ ...row, [key]: value }))),
    [{}],
  );
  const rotated = Object.entries(ROTATED);

  return crossed.map((base, round) => {
    const pick = { ...base };
    for (const [index, [key, values]] of rotated.entries()) {
      pick[key] = values[(round + index * 3) % values.length];
    }
    return pick;
  });
}

/**
 * @param {object} pick
 * @returns {object} a normalised configuration
 */
function configFrom(pick) {
  return normaliseConfig({
    mode: 'hunt',
    route: {
      kind: pick.kind,
      farmMap: pick.farmMap,
      pokecenterMap: 'Pokecenter Viridian',
      recoverWhenLost: pick.recoverWhenLost,
      huntAnywhere: pick.huntAnywhere,
      switchVia: pick.switchVia,
      zones: pick.zones,
      stops: pick.stop === 'none' ? [] : [{ map: 'Viridian City', mount: pick.stop, terrain: 'any' }],
      timeOfDay: periodOverrides(pick),
    },
    mounts: { land: pick.mount, dismountOnFarm: pick.dismountOnFarm },
    target: { onMatch: pick.onMatch, abilities: ['Contrary'], heldItems: ['Leftovers'], form: true },
    battle: {
      onOther: pick.onOther,
      otherGuard: pick.onOther === 'conditional' ? LEVEL_GUARD : undefined,
    },
    team: {
      rotation: {
        mode: pick.rotation,
        ids: ['12345', 'Larvitar'],
        goals: [
          { id: 'Larvitar', stat: 'ATK', target: 252 },
          { id: 'Larvitar', stat: 'HP', target: 252 },
        ],
      },
    },
    safety: {
      breaks: { enabled: pick.breaks, everyMin: 10, everyMax: 30, lengthMin: 30, lengthMax: 180 },
    },
  });
}

test('no configuration emits a script that reads a local it never declared', () => {
  const picks = configurations();
  assert.ok(picks.length >= 500, `the sweep collapsed to ${picks.length} configurations`);

  /** @type {string[]} */
  const failures = [];
  for (const pick of picks) {
    const config = configFrom(pick);
    let result;
    try {
      result = generateScript(config, graph);
    } catch (error) {
      failures.push(`threw ${error.message} — ${JSON.stringify(pick)}`);
      continue;
    }
    if (result.unknownCalls.length) {
      failures.push(`unknown ${result.unknownCalls.join(',')} — ${JSON.stringify(pick)}`);
    }
    if (result.retiredCalls.length) {
      failures.push(`retired ${result.retiredCalls.join(',')} — ${JSON.stringify(pick)}`);
    }
    const missing = undeclared(result.lua);
    if (missing.length) failures.push(`undeclared ${missing.join(',')} — ${JSON.stringify(pick)}`);
  }

  assert.deepEqual(failures.slice(0, 5), [], `${failures.length} unsound configurations`);
});

test('no configuration makes a lint rule throw', () => {
  /** @type {string[]} */
  const failures = [];
  for (const pick of configurations()) {
    const config = configFrom(pick);
    const result = generateScript(config, graph);
    // runLint catches a throwing rule and reports it as a finding rather than
    // letting it break the preview, so the finding is what to look for.
    const findings = runLint({
      config,
      plan: result.plan,
      mode: result.mode,
      zones: result.zones,
      team: result.team,
      linkGraph: graph,
      unknownCalls: result.unknownCalls,
      retiredCalls: result.retiredCalls,
    });
    const broken = findings.filter((finding) => /^Lint rule /.test(finding.message));
    if (broken.length) failures.push(`${broken[0].message} — ${JSON.stringify(pick)}`);
  }

  assert.deepEqual(failures.slice(0, 5), []);
});
