/**
 * A picture of the script's shape.
 *
 * The generated file is long, and the thing people actually want to check is
 * the order of decisions: what runs before what, and which branch a given
 * setting lands in. This describes that as a tree of steps, derived from the
 * same plan objects the generator emitted from — so it can never drift from
 * the script the way a hand-drawn diagram would.
 */

import { isEmptyCondition } from '../domain/condition.js';
import { toStringList } from '../domain/config.js';
import { h, replaceChildren } from './dom.js';

/**
 * @typedef {object} Node
 * @property {string} label
 * @property {string} [detail]
 * @property {'callback' | 'check' | 'action' | 'note'} [tone]
 * @property {Node[]} [children]
 */

export class StructureDiagram {
  /**
   * @param {HTMLDialogElement} dialog
   * @param {() => import('../generators/index.js').GenerationResult | null} getResult
   * @param {() => object} getConfig
   */
  constructor(dialog, getResult, getConfig) {
    this._dialog = dialog;
    this._getResult = getResult;
    this._getConfig = getConfig;
  }

  /** Draw the current script's structure and show it. */
  open() {
    const result = this._getResult();
    replaceChildren(this._dialog, [
      h('header.tool-head', {}, [
        h('h2.tool-title', { text: 'Script structure' }),
        h('button.icon-btn', {
          type: 'button', text: '×', title: 'Close', 'aria-label': 'Close',
          onClick: () => this._dialog.close(),
        }),
      ]),
      result
        ? h('div.flow', {}, describeScript(result, this._getConfig()).map(renderNode))
        : h('p.tool-error', { text: 'The script could not be generated, so there is nothing to draw.' }),
      h('p.tool-hint', {
        text: 'The host calls onPathAction outside battle and onBattleAction inside one, '
          + 'and each may perform at most one action per frame.',
      }),
    ]);
    this._dialog.showModal();
  }
}

/**
 * @param {Node} node
 * @returns {HTMLElement}
 */
function renderNode(node) {
  return h('div.flow-node', { class: `flow-${node.tone ?? 'action'}` }, [
    h('div.flow-label', {}, [
      h('span.flow-title', { text: node.label }),
      node.detail ? h('span.flow-detail', { text: node.detail }) : null,
    ]),
    node.children?.length
      ? h('div.flow-children', {}, node.children.map(renderNode))
      : null,
  ]);
}

/**
 * Build the tree from a generation result.
 *
 * @param {import('../generators/index.js').GenerationResult} result
 * @param {object} config
 * @returns {Node[]}
 */
export function describeScript(result, config) {
  return [
    onStart(result, config),
    onPathAction(result, config),
    onBattleAction(result, config),
    ...optional(onBattleMessage(result, config)),
    ...optional(onLearningMove(result)),
    ...optional(onPause(result)),
  ];
}

/**
 * @param {Node | null} node
 * @returns {Node[]}
 */
function optional(node) {
  return node ? [node] : [];
}

/**
 * @param {import('../generators/index.js').GenerationResult} result
 * @param {object} config
 * @returns {Node}
 */
function onStart(result, config) {
  const { needs } = result;
  /** @type {Node[]} */
  const children = [];
  if (needs.counters) children.push(step('Remember the starting money'));
  if (needs.mounts && config.mounts.applyOnStart) {
    const mounts = [...toStringList(config.mounts.land), ...toStringList(config.mounts.water)];
    children.push(step('Set the mount', mounts.join(', ')));
  }
  if (config.safety.afkTimeout) children.push(step('Set the AFK timeout', `${config.safety.afkTimeout}s`));
  if (needs.breaks) children.push(step('Schedule the first break'));
  children.push(step('Log that the script started'));

  return { label: 'onStart()', tone: 'callback', children };
}

/**
 * @param {import('../generators/index.js').GenerationResult} result
 * @param {object} config
 * @returns {Node}
 */
function onPathAction(result, config) {
  const { needs, plan, zones, team } = result;
  /** @type {Node[]} */
  const children = [];

  if (needs.trapFlag) children.push(step('Clear the trapped flag'));
  if (needs.onceFlags) children.push(step('Clear the once-per-battle flags'));
  if (needs.conditionFlags?.size) {
    children.push(step('Clear the battle-log flags', `${needs.conditionFlags.size} tracked`));
  }
  if (needs.stopUpkeep) children.push(check('On a stop?', 'Fix the mount or the terrain, then continue'));
  if (needs.breaks) children.push(check('On a break?', 'Stand on plain ground until it ends'));
  if (needs.teamUpkeep) {
    children.push(check('Team needs upkeep?', describeUpkeep(team)));
  }

  children.push({
    label: 'Can we keep farming?',
    tone: 'check',
    detail: describeGuard(config),
    children: [
      { label: 'Yes', tone: 'note', children: farmBranch(plan, zones, config) },
      { label: 'No', tone: 'note', children: [endBranch(config, plan)] },
    ],
  });

  return { label: 'onPathAction()', tone: 'callback', detail: 'outside battle', children };
}

/**
 * @param {import('../generators/team.js').TeamPlan} team
 * @returns {string}
 */
function describeUpkeep(team) {
  const parts = [];
  if (team.leadAbility) parts.push(`keep ${team.leadAbility} in slot 1`);
  if (team.secondAbility) parts.push(`keep ${team.secondAbility} in slot 2`);
  if (team.rotationMode !== 'off') parts.push(`rotate (${team.rotationMode})`);
  if (team.leadItem) parts.push(`keep ${team.leadItem} on the lead`);
  return parts.join(', ');
}

/**
 * @param {object} config
 * @returns {string}
 */
function describeGuard(config) {
  if (!isEmptyCondition(config.team.customGuard)) return 'your custom condition';
  const parts = [];
  if (config.team.healBelowUsable) parts.push(`at least ${config.team.healBelowUsable} usable`);
  if (config.team.healOnPPOut) parts.push('battle moves still have PP');
  return parts.length ? parts.join(' and ') : 'always — no healing rule is set';
}

/**
 * @param {import('../generators/route-plan.js').RoutePlan} plan
 * @param {import('../generators/zones.js').ZonePlan} zones
 * @param {object} config
 * @returns {Node[]}
 */
function farmBranch(plan, zones, config) {
  /** @type {Node[]} */
  const nodes = [];
  if (plan.travels) {
    nodes.push(check(
      `On ${plan.timeOfDay ? 'the hunting map for this time of day' : `"${plan.farmMap}"`}?`,
      plan.timeOfDay ? 'one route per period' : '',
    ));
    nodes.push(step('Otherwise walk one hop towards it', `${plan.toFarm.length} hop(s)`));
  }
  if (config.route.surfFix) nodes.push(step('Step off the water if we are surfing'));
  if (config.mounts.dismountOnFarm) nodes.push(step('Dismount'));
  nodes.push(zones.active
    ? step('Work the current farm zone', `${zones.zones.length} zone(s), rotating ${zones.mode}`)
    : step('Look for encounters', config.route.farmAction));
  return nodes;
}

/**
 * @param {object} config
 * @param {import('../generators/route-plan.js').RoutePlan} plan
 * @returns {Node}
 */
function endBranch(config, plan) {
  switch (config.route.endBehaviour) {
    case 'healNpc':
      return step('Heal at the nurse on this map', config.route.endHealCell);
    case 'stop':
      return step('Stop the bot', config.route.endMessage || 'with the default message');
    case 'logout':
      return step('Log out', config.route.endMessage || 'with the default message');
    case 'idle':
      return step('Stand still');
    case 'pcLoop':
    default:
      return plan.travels
        ? step('Walk back to the Pokécenter and heal', `${plan.toHeal.length} hop(s)`)
        : step('Heal', config.route.healAction);
  }
}

/**
 * @param {import('../generators/index.js').GenerationResult} result
 * @param {object} config
 * @returns {Node}
 */
function onBattleAction(result, config) {
  const { mode } = result;
  /** @type {Node[]} */
  const children = [
    check('A trainer battle?', config.battle.onTrainer === 'run' ? 'try to run, then fight' : 'fight it out'),
  ];

  if (mode.id === 'rules') {
    children.push({
      label: 'Try each rule in order',
      tone: 'check',
      children: (config.rules ?? []).map((rule, index) => ({
        label: rule.label || `Rule ${index + 1}`,
        tone: 'action',
        detail: `${countSteps(rule.steps)} step(s), then ${rule.fallback}`,
      })),
    });
  } else {
    children.push(step(mode.label, mode.tagline));
  }

  if (!mode.traits.engagesEveryEncounter) {
    children.push(step('Anything else', config.battle.onOther));
  }
  return { label: 'onBattleAction()', tone: 'callback', detail: 'in battle', children };
}

/**
 * @param {unknown} steps
 * @returns {number} steps including the ones inside groups
 */
function countSteps(steps) {
  return (Array.isArray(steps) ? steps : []).reduce(
    (total, step) => total + 1 + (step?.action === 'group' ? countSteps(step.steps) : 0),
    0,
  );
}

/**
 * @param {import('../generators/index.js').GenerationResult} result
 * @param {object} config
 * @returns {Node | null}
 */
function onBattleMessage(result, config) {
  const { needs, zones } = result;
  /** @type {Node[]} */
  const children = [];
  if (needs.trapFlag) children.push(step('Notice that switching is blocked'));
  if (zones.eventDriven && zones.mode === 'onWin') children.push(step('Reroll the zone after a win'));
  for (const flag of (needs.conditionFlags ?? new Map()).values()) {
    children.push(step('Listen for a phrase', flag.on.join(' / ')));
  }
  if (needs.counters) children.push(step('Count encounters, shinies and catches'));
  if (needs.counters && config.logging.announceShiny) children.push(step('Shout on a shiny'));

  return children.length ? { label: 'onBattleMessage()', tone: 'callback', children } : null;
}

/**
 * @param {import('../generators/index.js').GenerationResult} result
 * @returns {Node | null}
 */
function onLearningMove(result) {
  if (!result.team.keepMoves.length) return null;
  return {
    label: 'onLearningMove()',
    tone: 'callback',
    children: [step('Forget anything except', result.team.keepMoves.join(', '))],
  };
}

/**
 * @param {import('../generators/index.js').GenerationResult} result
 * @returns {Node | null}
 */
function onPause(result) {
  if (!result.needs.counters) return null;
  return { label: 'onPause()', tone: 'callback', children: [step('Log the session summary')] };
}

/**
 * @param {string} label
 * @param {string} [detail]
 * @returns {Node}
 */
function step(label, detail) {
  return { label, detail, tone: 'action' };
}

/**
 * @param {string} label
 * @param {string} [detail]
 * @returns {Node}
 */
function check(label, detail) {
  return { label, detail, tone: 'check' };
}
