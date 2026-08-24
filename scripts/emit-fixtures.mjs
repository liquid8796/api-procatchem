/**
 * Emit generated scripts across a matrix of configurations so they can be
 * compiled and executed against the real MoonSharp host.
 *
 * Usage: node scripts/emit-fixtures.mjs <outputDir>
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import { createDefaultConfig, createStep } from '../assets/builder/js/domain/config.js';
import { LinkGraph } from '../assets/builder/js/domain/link-graph.js';
import { generateScript } from '../assets/builder/js/generators/index.js';
import { modeRegistry } from '../assets/builder/js/generators/mode-registry.js';

const outputDir = process.argv[2];
if (!outputDir) {
  console.error('usage: node scripts/emit-fixtures.mjs <outputDir>');
  process.exit(2);
}

const { graph } = LinkGraph.parse([
  'PROCATCHEM-LINKGRAPH\tv1',
  'Pokecenter Viridian\t9\t14\tViridian City',
  'Viridian City\t23\t8\tPokecenter Viridian',
  'Viridian City\t12\t3\tViridian Forest',
  'Viridian Forest\t14\t46\tViridian City',
  'Viridian City\t40\t20\tRoute 21',
  'Route 21\t2\t2\tViridian City',
].join('\n'));

const MODES = modeRegistry.ids();
const TRAINER = ['fight', 'run'];
const OTHER = ['run', 'fight', 'weakAttack'];
const WEAKEN = ['off', 'falseSwipe', 'percent'];
const BALL_CONDITIONS = ['always', 'turn1', 'status', 'lowHp'];
const FARM_ACTIONS = [
  ['moveToGrass', ''],
  ['moveToWater', ''],
  ['moveToNormalGround', ''],
  ['moveToCell', '12, 30'],
  ['fish', '12, 30'],
  ['useItem', 'Repel'],
];

/** Preparation-move setups, including the incomplete rows that must be dropped. */
const HELPER_SETUPS = [
  [],
  [{ move: 'Soak', trigger: 'oppType', type: 'Ghost', names: [], slot: 1, ability: '' }],
  [
    { move: 'Soak', trigger: 'oppType', type: 'Ghost', names: [], slot: 1, ability: '' },
    { move: 'Skill Swap', trigger: 'oppName', type: '', names: ['Abra'], slot: 1, ability: '' },
  ],
  [
    { move: 'Thief', trigger: 'myAbility', type: '', names: [], slot: 1, ability: 'Trace' },
    { move: 'Growl', trigger: 'always', type: '', names: [], slot: 1, ability: '' },
  ],
  // Incomplete rows: the generator must skip these rather than emit half a call.
  [{ move: 'Soak', trigger: 'oppType', type: '', names: [], slot: 1, ability: '' }],
];

/** Zone setups, including a line zone and an empty (disabled) case. */
const ZONE_SETUPS = [
  { zones: [], rotation: { mode: 'fixed', min: 30, max: 60 } },
  { zones: ['10,10,20,20'], rotation: { mode: 'fixed', min: 15, max: 40 } },
  { zones: ['10,10,20,20', '30,5,40,15'], rotation: { mode: 'random', min: 5, max: 20 } },
  { zones: ['12,5,12,25', '3,3,9,9'], rotation: { mode: 'chaotic', min: 5, max: 20 } },
  { zones: ['1,1,4,4', '6,6,9,9'], rotation: { mode: 'onHeal', min: 5, max: 20 } },
  { zones: ['1,1,4,4', '6,6,9,9'], rotation: { mode: 'onWin', min: 5, max: 20 } },
];

/** Team management setups, from "nothing" to "everything at once". */
const TEAM_SETUPS = [
  {},
  { useStrongest: true },
  { leadAbility: 'Synchronize', rotation: { mode: 'weakest', stat: 'ATK', target: 252, ids: [], goals: [] } },
  {
    leadAbility: 'Synchronize',
    secondAbility: 'Trace',
    rotation: { mode: 'ev', stat: 'SPD', target: 252, ids: [], goals: [] },
    leadItem: 'Leftovers',
    keepMoves: ['False Swipe', 'Surf'],
  },
  { rotation: { mode: 'uid', stat: 'ATK', target: 252, ids: ['111', '222'], goals: [] } },
  { rotation: { mode: 'highest', stat: 'ATK', target: 252, ids: [], goals: [] } },
  {
    rotation: {
      mode: 'uidEv',
      stat: 'ATK',
      target: 252,
      ids: [],
      goals: [{ id: '111', stat: 'ATK', target: 252 }, { id: '222', stat: 'SPD', target: 100 }],
    },
  },
];

/** What happens when the keep-farming condition fails. */
const END_SETUPS = [
  { endBehaviour: 'pcLoop' },
  { endBehaviour: 'healNpc', endHealCell: '59, 13', endHealMoney: null },
  { endBehaviour: 'healNpc', endHealCell: '59, 13', endHealMoney: 1500 },
  { endBehaviour: 'stop', endMessage: 'Session finished.' },
  { endBehaviour: 'logout', endMessage: '' },
  { endBehaviour: 'idle' },
];

/** Every step action, so each emitter is executed at least once. */
const STEP_SETS = [
  [
    createStep({ action: 'useMove', move: 'False Swipe', slot: 'auto' }),
    createStep({ action: 'throwBalls', balls: ['Ultra Ball', 'Pokeball'] }),
  ],
  [
    createStep({ action: 'useMove', move: 'Spore', slot: 3, once: true }),
    createStep({ action: 'useItem', item: 'Ultra Ball' }),
    createStep({ action: 'sendPokemon', slotNumber: 2 }),
  ],
  [
    createStep({ action: 'attack' }),
    createStep({ action: 'weakAttack' }),
    createStep({ action: 'run' }),
  ],
  [
    createStep({ action: 'sendUsablePokemon' }),
    createStep({ action: 'sendAnyPokemon' }),
    createStep({ action: 'rawLua', expr: 'useItem("Repel")' }),
  ],
  [
    createStep({
      action: 'group',
      when: { op: 'and', negate: false, items: [{ kind: 'oppHpPercent', params: { cmp: '>', value: 25 }, negate: false }] },
      steps: [
        createStep({ action: 'useMove', move: 'False Swipe', slot: 'auto' }),
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
      ],
    }),
    createStep({ action: 'sendStrongest' }),
    createStep({ action: 'apiCall', fn: 'useItem', args: '"Repel"', once: true }),
  ],
  [
    // A terminal step followed by more of them: `return` has to end its own
    // block or the file will not even compile.
    createStep({ action: 'stopBot', message: 'Out of balls.' }),
    createStep({ action: 'logout', message: 'Done for the session.' }),
    createStep({ action: 'attack' }),
  ],
];

/** Condition trees exercised as rule matchers, including nesting and negation. */
const MATCHERS = [
  { op: 'or', negate: false, items: [{ kind: 'shiny', params: {}, negate: false }] },
  {
    op: 'and',
    negate: false,
    items: [
      { kind: 'oppHpPercent', params: { cmp: '<=', value: 40 }, negate: false },
      { op: 'or', negate: true, items: [{ kind: 'oppHasStatus', params: {}, negate: false }] },
    ],
  },
  {
    op: 'and',
    negate: false,
    items: [
      { kind: 'oppType', params: { type: 'Water' }, negate: false },
      { kind: 'ppLeft', params: { move: 'Surf', cmp: '>=', value: 1 }, negate: false },
      { kind: 'battleTurn', params: { cmp: '>', value: 2 }, negate: true },
    ],
  },
  {
    op: 'and',
    negate: false,
    items: [
      { kind: 'heardText', params: { on: ['was taunted'], off: ['shook off the taunt'], turns: 0 }, negate: false },
      { kind: 'heardText', params: { on: ['is confused'], off: [], turns: 3 }, negate: false },
      { kind: 'oppAbility', params: { names: ['Contrary', 'Intimidate'] }, negate: false },
      { kind: 'oppForm', params: {}, negate: false },
      { kind: 'oppGender', params: { gender: 'F' }, negate: false },
    ],
  },
  {
    op: 'and',
    negate: false,
    items: [
      { kind: 'slotEv', params: { slot: 1, stat: 'ATK', cmp: '<', value: 252 }, negate: false },
      { kind: 'slotGender', params: { slot: 2, gender: 'M' }, negate: false },
      { kind: 'activeSlot', params: { slot: 1 }, negate: false },
      { kind: 'activeUsable', params: {}, negate: false },
      { kind: 'apiCall', params: { fn: 'getPlayerX', args: '', cmp: '>=', value: '10' }, negate: false },
      { kind: 'apiCall', params: { fn: 'isOutside', args: '', cmp: '', value: '' }, negate: false },
    ],
  },
  { op: 'or', negate: false, items: [] },
];

/** Custom farm guards, including "not set". */
const GUARDS = [
  { op: 'and', negate: false, items: [] },
  {
    op: 'and',
    negate: false,
    items: [
      { kind: 'usableCount', params: { cmp: '>=', value: 2 }, negate: false },
      { kind: 'itemCount', params: { item: 'Ultra Ball', cmp: '>', value: 0 }, negate: false },
    ],
  },
  {
    op: 'and',
    negate: false,
    items: [
      { kind: 'money', params: { cmp: '>=', value: 5000 }, negate: false },
      { kind: 'slotEv', params: { slot: 1, stat: 'SPD', cmp: '<', value: 252 }, negate: false },
    ],
  },
];

await fs.mkdir(outputDir, { recursive: true });
let index = 0;
let unsound = 0;

for (const mode of MODES) {
  for (const onTrainer of TRAINER) {
    for (const onOther of OTHER) {
      for (const weaken of WEAKEN) {
        for (const routeKind of ['here', 'route']) {
          const config = createDefaultConfig();
          config.mode = mode;
          config.battle.onTrainer = onTrainer;
          config.battle.onOther = onOther;
          config.battle.weaken.mode = weaken;
          config.battle.balls = [
            { item: 'Ultra Ball', condition: BALL_CONDITIONS[index % BALL_CONDITIONS.length] },
            { item: 'Pokeball', condition: 'always' },
          ];
          config.battle.status.requireBeforeBall = index % 3 === 0;
          config.battle.status.moves = index % 2 === 0 ? ['Spore', 'Hypnosis'] : [];

          const [action, args] = FARM_ACTIONS[index % FARM_ACTIONS.length];
          config.route.kind = routeKind;
          config.route.farmAction = action;
          config.route.farmArgs = args;
          config.route.farmMap = routeKind === 'route' ? 'Viridian Forest' : '';
          config.route.pokecenterMap = routeKind === 'route' ? 'Pokecenter Viridian' : '';
          config.route.farmRod = 'Super Rod';
          config.battle.helperMoves = HELPER_SETUPS[index % HELPER_SETUPS.length]
            .map((helper) => ({ ...helper }));
          config.route.healAction = index % 4 === 0 ? 'talkToNpcOnCell' : 'usePokecenter';
          config.route.healArgs = '7, 9';

          config.mounts.land = index % 2 === 0 ? 'Arcanine Mount; Bicycle' : '';
          config.mounts.water = index % 3 === 0 ? 'Lapras Mount' : '';
          config.mounts.dismountOnFarm = index % 5 === 0;

          config.target.names = index % 2 === 0 ? ['Larvitar', 'Pikachu'] : [];
          config.target.requireAll = index % 7 === 0;
          config.target.levelMin = index % 3 === 0 ? 10 : null;
          config.target.levelMax = index % 3 === 0 ? 40 : null;
          config.target.gender = index % 6 === 0 ? 'F' : '';
          config.target.notCaught = index % 2 === 1;

          config.team.healBelowUsable = index % 4 === 0 ? null : 2;
          config.team.healOnPPOut = index % 2 === 0;

          config.safety.breaks.enabled = index % 2 === 0;
          config.safety.afkTimeout = index % 3 === 0 ? 300 : null;
          config.safety.onTrapped = ['', 'run', 'relog'][index % 3];
          config.safety.relogDelay = index % 6 === 2 ? 90 : 30;

          // `index` alternates route kind, so selecting on `index` directly
          // would pin every end behaviour to one of them. Halving it first
          // gives each behaviour a turn on both.
          Object.assign(config.route, END_SETUPS[Math.floor(index / 2) % END_SETUPS.length]);

          config.logging.counters = index % 5 !== 0;
          config.logging.announceShiny = index % 2 === 0;

          // ---- V4 feature groups -------------------------------------
          // Zones cycle on a slower index than FARM_ACTIONS: with both keyed on
          // `index % 6` they moved in lockstep, so a zone always shadowed the
          // fishing action and it was never generated.
          const zoneSetup = ZONE_SETUPS[Math.floor(index / FARM_ACTIONS.length) % ZONE_SETUPS.length];
          config.route.zones = [...zoneSetup.zones];
          config.route.zoneRotation = { ...zoneSetup.rotation };

          config.route.stops = index % 4 === 0
            ? [{ map: 'Viridian City', mount: index % 8 === 0 ? 'off' : 'force', terrain: 'land' }]
            : [];

          // `index` is even on the 'here' pass and odd on the 'route' pass, so the
          // selector must be odd for time-of-day to ever reach a routed fixture.
          config.route.timeOfDay = { ...createDefaultConfig().route.timeOfDay };
          if (routeKind === 'route' && index % 6 === 1) {
            Object.assign(config.route.timeOfDay, { enabled: true, morningMap: 'Route 21' });
          }
          // A period that hunts a different way, on both route kinds.
          if (index % 10 === 4) {
            Object.assign(config.route.timeOfDay, {
              enabled: true,
              nightAction: 'fish',
              nightArgs: '12, 30',
              nightRod: 'Super Rod',
              morningAction: 'moveToWater',
              noonAction: 'useItem',
              noonArgs: 'Repel',
            });
          }

          Object.assign(config.team, TEAM_SETUPS[index % TEAM_SETUPS.length]);
          config.team.customGuard = GUARDS[index % GUARDS.length];

          config.rules = [
            {
              id: 'rule-a',
              label: 'Primary',
              match: MATCHERS[index % MATCHERS.length],
              fallback: ['attack', 'run', 'nothing'][index % 3],
              steps: STEP_SETS[index % STEP_SETS.length],
            },
            {
              id: 'rule-b',
              label: 'Secondary',
              match: MATCHERS[(index + 1) % MATCHERS.length],
              fallback: 'attack',
              steps: STEP_SETS[(index + 2) % STEP_SETS.length],
            },
          ];

          const result = generateScript(config, graph);
          if (result.unknownCalls.length || result.retiredCalls.length) {
            unsound += 1;
            console.error(
              `UNSOUND fixture_${index}: unknown=${result.unknownCalls.join(',')} `
              + `retired=${result.retiredCalls.join(',')}`,
            );
          }
          // Write the full document (config header included) — that is what the
          // host actually loads.
          await fs.writeFile(
            path.join(outputDir, `fixture_${String(index).padStart(3, '0')}.lua`),
            result.document,
            'utf8',
          );
          index += 1;
        }
      }
    }
  }
}

console.log(`wrote ${index} fixtures to ${outputDir}`);
console.log(unsound ? `UNSOUND: ${unsound}` : 'all fixtures verified against the host API');
process.exit(unsound ? 1 : 0);
