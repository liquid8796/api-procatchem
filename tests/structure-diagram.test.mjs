/**
 * The structure view describes the script the generator just emitted, so its
 * model has to follow the configuration rather than a fixed shape.
 *
 * Run with: node --test tests/
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultConfig, createStep, normaliseConfig } from '../assets/builder/js/domain/config.js';
import { LinkGraph } from '../assets/builder/js/domain/link-graph.js';
import { generateScript } from '../assets/builder/js/generators/index.js';
import { describeScript } from '../assets/builder/js/ui/structure-diagram.js';

const { graph } = LinkGraph.parse([
  'PROCATCHEM-LINKGRAPH\tv1',
  'Pokecenter Viridian\t9\t14\tViridian City',
  'Viridian City\t23\t8\tPokecenter Viridian',
  'Viridian City\t12\t3\tViridian Forest',
  'Viridian Forest\t14\t46\tViridian City',
].join('\n'));

/**
 * @param {(config: object) => void} [mutate]
 * @returns {import('../assets/builder/js/ui/structure-diagram.js').Node[]}
 */
function describe(mutate = () => {}) {
  const config = createDefaultConfig();
  mutate(config);
  const normalised = normaliseConfig(config);
  return describeScript(generateScript(normalised, graph), normalised);
}

/**
 * Every label in the tree, depth-first.
 *
 * @param {Array<{ label: string, detail?: string, children?: object[] }>} nodes
 * @returns {string[]}
 */
function labels(nodes) {
  return nodes.flatMap((node) => [
    node.detail ? `${node.label} [${node.detail}]` : node.label,
    ...labels(node.children ?? []),
  ]);
}

test('the tree names one callback per callback the script defines', () => {
  const roots = describe().map((node) => node.label);
  assert.deepEqual(roots, ['onStart()', 'onPathAction()', 'onBattleAction()', 'onBattleMessage()', 'onPause()']);
});

test('a callback the script does not define is left out', () => {
  const roots = describe((config) => {
    config.logging.counters = false;
    config.safety.onTrapped = '';
    config.battle.onOther = 'run';
    config.battle.weaken.mode = 'off';
    config.battle.status.moves = [];
    config.battle.helperMoves = [];
  }).map((node) => node.label);

  assert.equal(roots.includes('onPause()'), false, 'no counters, so no summary to log');
  assert.equal(roots.includes('onBattleMessage()'), false, 'nothing to listen for');
});

test('onLearningMove appears exactly when moves are protected', () => {
  assert.equal(describe().map((n) => n.label).includes('onLearningMove()'), false);
  const withKeeps = describe((config) => { config.team.keepMoves = ['False Swipe']; });
  assert.ok(withKeeps.map((node) => node.label).includes('onLearningMove()'));
});

test('the farm branch describes the route it will actually walk', () => {
  const text = labels(describe((config) => {
    config.route.kind = 'route';
    config.route.farmMap = 'Viridian Forest';
    config.route.pokecenterMap = 'Pokecenter Viridian';
  })).join('\n');

  assert.match(text, /On "Viridian Forest"\?/);
  assert.match(text, /Otherwise walk one hop towards it \[2 hop\(s\)\]/);
  assert.match(text, /Walk back to the Pokécenter and heal/);
});

test('the end branch follows the configured behaviour', () => {
  assert.match(labels(describe((config) => {
    config.route.endBehaviour = 'stop';
    config.route.endMessage = 'All done.';
  })).join('\n'), /Stop the bot \[All done\.\]/);

  assert.match(labels(describe((config) => {
    config.route.endBehaviour = 'idle';
  })).join('\n'), /Stand still/);
});

test('the keep-farming check reports which condition is in force', () => {
  assert.match(
    labels(describe()).join('\n'),
    /Can we keep farming\? \[at least 2 usable and battle moves still have PP\]/,
  );
  assert.match(
    labels(describe((config) => {
      config.team.customGuard = {
        op: 'and', negate: false, items: [{ kind: 'shiny', params: {}, negate: false }],
      };
    })).join('\n'),
    /Can we keep farming\? \[your custom condition\]/,
  );
  assert.match(
    labels(describe((config) => {
      config.team.healBelowUsable = null;
      config.team.healOnPPOut = false;
    })).join('\n'),
    /Can we keep farming\? \[always — no healing rule is set\]/,
  );
});

test('rules mode lists the rules, counting the steps inside groups', () => {
  const text = labels(describe((config) => {
    config.mode = 'rules';
    config.rules = [{
      id: 'r1',
      label: 'Catch it',
      match: { op: 'or', negate: false, items: [] },
      fallback: 'attack',
      steps: [
        createStep({ action: 'group', steps: [createStep({ action: 'attack' }), createStep({ action: 'run' })] }),
        createStep({ action: 'run' }),
      ],
    }];
  })).join('\n');

  assert.match(text, /Try each rule in order/);
  assert.match(text, /Catch it \[4 step\(s\), then attack\]/);
});

test('battle-log flags are listed with the phrases they listen for', () => {
  const text = labels(describe((config) => {
    config.team.customGuard = {
      op: 'and',
      negate: false,
      items: [{
        kind: 'heardText',
        params: { on: ['was taunted', 'is confused'], off: [], turns: 0 },
        negate: false,
      }],
    };
  })).join('\n');

  assert.match(text, /Listen for a phrase \[was taunted \/ is confused\]/);
  assert.match(text, /Clear the battle-log flags \[1 tracked\]/);
});

test('zones replace the plain hunting action in the description', () => {
  const text = labels(describe((config) => {
    config.route.zones = ['1,1,9,9', '10,10,20,20'];
    config.route.zoneRotation = { mode: 'onWin', min: 5, max: 20 };
  })).join('\n');

  assert.match(text, /Work the current farm zone \[2 zone\(s\), rotating onWin\]/);
  assert.match(text, /Reroll the zone after a win/);
});

test('a period that hunts its own way gets a branch in the diagram', () => {
  const text = labels(describe((config) => {
    Object.assign(config.route.timeOfDay, {
      enabled: true,
      nightAction: 'fish',
      nightArgs: '12, 30',
      nightRod: 'Super Rod',
    });
  })).join('\n');

  assert.match(text, /Night\? \[look for encounters with fish\]/);
  assert.match(text, /Look for encounters \[moveToGrass\]/, 'the main action is still the fallback');
});

test('a period that repeats the main action adds no branch', () => {
  const text = labels(describe((config) => {
    Object.assign(config.route.timeOfDay, { enabled: true, nightAction: 'moveToGrass' });
  })).join('\n');
  assert.doesNotMatch(text, /Night\?/);
});
