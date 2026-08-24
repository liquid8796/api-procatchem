/**
 * A picture of the script's shape.
 *
 * The generated file is long, and the thing people actually want to check is
 * the order of decisions: what runs before what, and which branch a given
 * setting lands in. This describes that as a tree of steps, derived from the
 * same plan objects the generator emitted from — so it can never drift from
 * the script the way a hand-drawn diagram would.
 */

import { t } from '../core/i18n.js';
import { isEmptyCondition } from '../domain/condition.js';
import { TIME_PERIODS, periodFields, toStringList } from '../domain/config.js';
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
        h('h2.tool-title', { text: t('Script structure') }),
        h('button.icon-btn', {
          type: 'button', text: '×', title: t('Close'), 'aria-label': t('Close'),
          onClick: () => this._dialog.close(),
        }),
      ]),
      result
        ? h('div.flow', {}, describeScript(result, this._getConfig()).map(renderNode))
        : h('p.tool-error', { text: t('The script could not be generated, so there is nothing to draw.') }),
      h('p.tool-hint', {
        text: t('The host calls onPathAction outside battle and onBattleAction inside one, '
          + 'and each may perform at most one action per frame.'),
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
  if (needs.counters) children.push(step(t('Remember the starting money')));
  if (needs.mounts && config.mounts.applyOnStart) {
    const mounts = [...toStringList(config.mounts.land), ...toStringList(config.mounts.water)];
    children.push(step(t('Set the mount'), mounts.join(', ')));
  }
  if (config.safety.afkTimeout) children.push(step(t('Set the AFK timeout'), `${config.safety.afkTimeout}s`));
  if (needs.breaks) children.push(step(t('Schedule the first break')));
  children.push(step(t('Log that the script started')));

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

  if (needs.trapFlag) children.push(step(t('Clear the trapped flag')));
  if (needs.onceFlags) children.push(step(t('Clear the once-per-battle flags')));
  if (needs.conditionFlags?.size) {
    children.push(step(t('Clear the battle-log flags'), t('{count} tracked', { count: needs.conditionFlags.size })));
  }
  if (needs.stopUpkeep) children.push(check(t('On a stop?'), t('Fix the mount or the terrain, then continue')));
  if (needs.breaks) children.push(check(t('On a break?'), t('Stand on plain ground until it ends')));
  if (needs.teamUpkeep) {
    children.push(check(t('Team needs upkeep?'), describeUpkeep(team)));
  }

  children.push({
    label: t('Can we keep farming?'),
    tone: 'check',
    detail: describeGuard(config),
    children: [
      { label: t('Yes'), tone: 'note', children: farmBranch(plan, zones, config) },
      { label: t('No'), tone: 'note', children: [endBranch(config, plan)] },
    ],
  });

  return { label: 'onPathAction()', tone: 'callback', detail: t('outside battle'), children };
}

/**
 * @param {import('../generators/team.js').TeamPlan} team
 * @returns {string}
 */
function describeUpkeep(team) {
  const parts = [];
  if (team.leadAbility) parts.push(t('keep {name} in slot 1', { name: team.leadAbility }));
  if (team.secondAbility) parts.push(t('keep {name} in slot 2', { name: team.secondAbility }));
  if (team.rotationMode !== 'off') parts.push(t('rotate ({mode})', { mode: team.rotationMode }));
  if (team.leadItem) parts.push(t('keep {name} on the lead', { name: team.leadItem }));
  return parts.join(', ');
}

/**
 * @param {object} config
 * @returns {string}
 */
function describeGuard(config) {
  if (!isEmptyCondition(config.team.customGuard)) return t('your custom condition');
  const parts = [];
  if (config.team.healBelowUsable) {
    parts.push(t('at least {count} usable', { count: config.team.healBelowUsable }));
  }
  if (config.team.healOnPPOut) parts.push(t('battle moves still have PP'));
  return parts.length ? parts.join(` ${t('and')} `) : t('always — no healing rule is set');
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
      plan.timeOfDay
        ? t('On the hunting map for this time of day?')
        : t('On "{map}"?', { map: plan.farmMap }),
      plan.timeOfDay ? t('one route per period') : '',
    ));
    nodes.push(step(
      t('Otherwise walk one hop towards it'),
      t('{count} hop(s)', { count: plan.toFarm.length }),
    ));
  }
  if (config.mounts.dismountOnFarm) nodes.push(step(t('Dismount')));
  if (zones.active) {
    nodes.push(step(
      t('Work the current farm zone'),
      t('{count} zone(s), rotating {mode}', { count: zones.zones.length, mode: zones.mode }),
    ));
    return nodes;
  }

  // Periods that hunt their own way are branches of their own; each carries its
  // own surf guard, so the diagram shows them the same way the script does.
  for (const period of periodStyles(config)) {
    nodes.push(check(`${t(period.label)}?`, t('look for encounters with {action}', { action: period.action })));
  }
  nodes.push(step(t('Look for encounters'), config.route.farmAction));
  return nodes;
}

/**
 * Times of day that hunt differently from the main setting.
 *
 * @param {object} config
 * @returns {Array<{ label: string, action: string }>}
 */
function periodStyles(config) {
  const timeOfDay = config.route.timeOfDay ?? {};
  if (!timeOfDay.enabled) return [];
  return TIME_PERIODS
    .map((period) => ({
      label: period.label,
      action: String(timeOfDay[periodFields(period.id).action] ?? '').trim(),
    }))
    .filter((period) => period.action && period.action !== config.route.farmAction);
}

/**
 * @param {object} config
 * @param {import('../generators/route-plan.js').RoutePlan} plan
 * @returns {Node}
 */
function endBranch(config, plan) {
  switch (config.route.endBehaviour) {
    case 'healNpc':
      return step(t('Heal at the nurse on this map'), config.route.endHealCell);
    case 'stop':
      return step(t('Stop the bot'), config.route.endMessage || t('with the default message'));
    case 'logout':
      return step(t('Log out'), config.route.endMessage || t('with the default message'));
    case 'idle':
      return step(t('Stand still'));
    case 'pcLoop':
    default:
      return plan.travels
        ? step(t('Walk back to the Pokécenter and heal'), t('{count} hop(s)', { count: plan.toHeal.length }))
        : step(t('Heal'), config.route.healAction);
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
    check(
      t('A trainer battle?'),
      config.battle.onTrainer === 'run' ? t('try to run, then fight') : t('fight it out'),
    ),
  ];

  if (mode.id === 'rules') {
    children.push({
      label: t('Try each rule in order'),
      tone: 'check',
      children: (config.rules ?? []).map((rule, index) => ({
        label: rule.label || t('Rule {n}', { n: index + 1 }),
        tone: 'action',
        detail: t('{count} step(s), then {fallback}', {
          count: countSteps(rule.steps), fallback: rule.fallback,
        }),
      })),
    });
  } else {
    children.push(step(t(mode.label), t(mode.tagline)));
  }

  if (!mode.traits.engagesEveryEncounter) {
    children.push(step(t('Anything else'), config.battle.onOther));
  }
  return { label: 'onBattleAction()', tone: 'callback', detail: t('in battle'), children };
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
  if (needs.trapFlag) children.push(step(t('Notice that switching is blocked')));
  if (zones.eventDriven && zones.mode === 'onWin') children.push(step(t('Reroll the zone after a win')));
  for (const flag of (needs.conditionFlags ?? new Map()).values()) {
    children.push(step(t('Listen for a phrase'), flag.on.join(' / ')));
  }
  if (needs.counters) children.push(step(t('Count encounters, shinies and catches')));
  if (needs.counters && config.logging.announceShiny) children.push(step(t('Shout on a shiny')));

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
    children: [step(t('Forget anything except'), result.team.keepMoves.join(', '))],
  };
}

/**
 * @param {import('../generators/index.js').GenerationResult} result
 * @returns {Node | null}
 */
function onPause(result) {
  if (!result.needs.counters) return null;
  return { label: 'onPause()', tone: 'callback', children: [step(t('Log the session summary'))] };
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
