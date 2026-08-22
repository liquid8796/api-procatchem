/**
 * Emit generated scripts across a matrix of configurations so they can be
 * compiled and executed against the real MoonSharp host.
 *
 * Usage: node scripts/emit-fixtures.mjs <outputDir>
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import { createDefaultConfig } from '../assets/builder/js/domain/config.js';
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
  ['useItem', 'Super Rod'],
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
          config.route.healAction = index % 4 === 0 ? 'talkToNpcOnCell' : 'usePokecenter';
          config.route.healArgs = '7, 9';

          config.mounts.land = index % 2 === 0 ? 'Arcanine Mount; Bicycle' : '';
          config.mounts.water = index % 3 === 0 ? 'Lapras Mount' : '';
          config.mounts.dismountOnFarm = index % 5 === 0;

          config.target.names = index % 2 === 0 ? ['Larvitar', 'Pikachu'] : [];
          config.target.requireAll = index % 7 === 0;
          config.target.levelMin = index % 3 === 0 ? 10 : null;
          config.target.levelMax = index % 3 === 0 ? 40 : null;
          config.target.gender = index % 6 === 0 ? 'Female' : '';
          config.target.notCaught = index % 2 === 1;

          config.team.healBelowUsable = index % 4 === 0 ? null : 2;
          config.team.healOnPPOut = index % 2 === 0;

          config.safety.breaks.enabled = index % 2 === 0;
          config.safety.afkTimeout = index % 3 === 0 ? 300 : null;
          config.safety.onTrapped = ['', 'run', 'relog'][index % 3];

          config.logging.counters = index % 5 !== 0;
          config.logging.announceShiny = index % 2 === 0;

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
