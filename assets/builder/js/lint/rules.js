/**
 * Configuration lint.
 *
 * Rules catch the mistakes that produce a script which loads fine but does
 * nothing useful — an empty ball ladder, a route the link graph cannot reach,
 * a healing condition that never fires. Each rule is an independent function,
 * registered here; adding one needs no changes elsewhere.
 */

import { Registry } from '../core/registry.js';
import { looksLikeBareWord, looksLikeUnquotedText, validateCall } from '../domain/api-call.js';
import { isEmptyCondition } from '../domain/condition.js';
import {
  CHAIN_ACTIONS,
  EV_STATS,
  FISHING_ACTION,
  TIME_PERIODS,
  periodFields,
  toStringList,
} from '../domain/config.js';
import { parseZone } from '../domain/zone.js';

/**
 * @typedef {'error' | 'warning' | 'info'} Severity
 *
 * @typedef {object} Finding
 * @property {Severity} level
 * @property {string} message
 * @property {string} [panel] id of the panel to jump to
 *
 * @typedef {object} LintInput
 * @property {object} config
 * @property {import('../generators/route-plan.js').RoutePlan} plan
 * @property {import('../generators/mode-registry.js').FarmMode} mode
 * @property {import('../generators/zones.js').ZonePlan} zones
 * @property {import('../generators/team.js').TeamPlan} team
 * @property {string[]} unknownCalls
 * @property {string[]} retiredCalls
 *
 * @typedef {(input: LintInput) => Finding[] | Finding | null} LintRule
 */

/** @type {Registry<LintRule>} */
export const lintRegistry = new Registry('LintRule');

/**
 * @param {Severity} level
 * @param {string} message
 * @param {string} [panel]
 * @returns {Finding}
 */
const finding = (level, message, panel) => ({ level, message, panel });

lintRegistry.register('route-problems', ({ plan }) =>
  plan.problems.map((problem) => finding('error', problem, 'route')));

lintRegistry.register('route-unused-pokecenter', ({ config, plan }) => {
  if (plan.kind !== 'here') return null;
  if (!String(config.route.pokecenterMap ?? '').trim()) return null;
  return finding(
    'info',
    'Hunting on the current map, so the Pokécenter map is ignored. Switch to route mode to use it.',
    'route',
  );
});

lintRegistry.register('farm-action-arguments', ({ config }) => {
  const { farmAction, farmArgs, farmRod } = config.route;
  const args = String(farmArgs ?? '').trim();
  const isCell = /^-?\d+\s*[,;]\s*-?\d+$/.test(args);
  /** @type {Finding[]} */
  const out = [];

  if (farmAction === 'moveToCell' && !isCell) {
    out.push(finding('error', 'The cell hunting action needs coordinates like "12, 30".', 'route'));
  }
  if (farmAction === 'fish') {
    if (!isCell) {
      out.push(finding('error', 'Fishing needs the cell to stand on, written as "12, 30".', 'route'));
    }
    if (!String(farmRod ?? '').trim()) {
      out.push(finding('error', 'Fishing needs a rod, e.g. "Super Rod".', 'route'));
    }
  }
  if (farmAction === 'useItem' && !args) {
    out.push(finding('error', 'The item hunting action needs an item name, e.g. "Repel".', 'route'));
  }
  return out;
});

lintRegistry.register('heal-action-arguments', ({ config }) => {
  if (config.route.healAction !== 'talkToNpcOnCell') return null;
  if (/^-?\d+\s*[,;]\s*-?\d+$/.test(String(config.route.healArgs ?? '').trim())) return null;
  return finding('error', 'Healing by talking to an NPC needs the nurse cell, e.g. "7, 9".', 'route');
});

lintRegistry.register('ball-ladder', ({ config, mode }) => {
  if (!mode.traits.usesBalls) return null;
  /** @type {Finding[]} */
  const out = [];
  if (!config.battle.balls.length) {
    out.push(finding('error', 'No balls configured — the script cannot catch anything.', 'battle'));
  }
  if (config.battle.balls.some((ball) => !String(ball.item ?? '').trim())) {
    out.push(finding('error', 'A ball entry has no item name.', 'battle'));
  }
  return out;
});

lintRegistry.register('status-gate', ({ config, mode }) => {
  if (!mode.traits.usesBalls) return null;
  const gated = config.battle.status.requireBeforeBall
    || config.battle.balls.some((ball) => ball.condition === 'status');
  if (!gated || config.battle.status.moves.length) return null;
  return finding(
    'error',
    'Balls are gated on a status condition, but no status move is configured — the script would never throw.',
    'battle',
  );
});

lintRegistry.register('weaken-move', ({ config, mode }) => {
  if (!mode.traits.usesWeaken) return null;
  if (config.battle.weaken.mode !== 'falseSwipe') return null;
  if (String(config.battle.weaken.move ?? '').trim()) return null;
  return finding('error', 'Weakening is set to a move, but no move name was given.', 'battle');
});

lintRegistry.register('open-target-filter', ({ config, mode }) => {
  if (!mode.traits.usesTargetFilters) return null;
  const { shiny, notCaught, names, levelMin, levelMax, gender } = config.target;
  const hasFilter = shiny || notCaught || names.length || levelMin !== null
    || levelMax !== null || gender;
  if (hasFilter) return null;
  return finding(
    'warning',
    'No target filters — the script will try to catch every wild Pokémon it meets.',
    'target',
  );
});

lintRegistry.register('level-range', ({ config }) => {
  const { levelMin, levelMax } = config.target;
  if (levelMin === null || levelMax === null || levelMin <= levelMax) return null;
  return finding('error', `Minimum level ${levelMin} is above maximum level ${levelMax} — nothing can match.`, 'target');
});

lintRegistry.register('requires-all-conflict', ({ config, mode }) => {
  if (!mode.traits.usesTargetFilters || !config.target.requireAll) return null;
  if (!config.target.shiny || !config.target.names.length) return null;
  return finding(
    'warning',
    'Every filter must match, so this only catches a shiny that is also on the name list.',
    'target',
  );
});

lintRegistry.register('never-heals', ({ config }) => {
  if (config.team.healBelowUsable !== null && config.team.healBelowUsable > 0) return null;
  if (config.team.healOnPPOut) return null;
  return finding(
    'warning',
    'No healing rule is set, so the script farms until every Pokémon has fainted.',
    'team',
  );
});

lintRegistry.register('break-ranges', ({ config }) => {
  if (!config.safety.breaks.enabled) return null;
  const { everyMin, everyMax, lengthMin, lengthMax } = config.safety.breaks;
  /** @type {Finding[]} */
  const out = [];
  if (Number(everyMin) > Number(everyMax)) {
    out.push(finding('error', 'Break interval: the minimum is above the maximum.', 'safety'));
  }
  if (Number(lengthMin) > Number(lengthMax)) {
    out.push(finding('error', 'Break length: the minimum is above the maximum.', 'safety'));
  }
  return out;
});

lintRegistry.register('break-parking', ({ config, plan }) => {
  if (!config.safety.breaks.enabled || plan.travels) return null;
  return finding(
    'info',
    'During a break the bot stands on plain ground with moveToNormalGround(). '
    + 'If the hunting map has none, the host will stop the bot instead.',
    'safety',
  );
});

lintRegistry.register('afk-timeout', ({ config }) => {
  const timeout = config.safety.afkTimeout;
  if (timeout === null || timeout > 0) return null;
  return finding('warning', 'The AFK timeout must be above zero to have any effect.', 'safety');
});

lintRegistry.register('dismount-without-mount', ({ config }) => {
  if (!config.mounts.dismountOnFarm) return null;
  // Mount lists are arrays, and an empty array is truthy — check the length.
  if (config.mounts.land.length || config.mounts.water.length) return null;
  return finding('info', 'Dismount-before-hunting is on, but no mount is configured.', 'route');
});

lintRegistry.register('ev-stat', ({ config, mode }) => {
  if (!mode.traits.usesEvStat) return null;
  const valid = EV_STATS.some((stat) => stat.id === String(config.ev.stat ?? '').toUpperCase());
  if (valid) return null;
  return finding('error', `"${config.ev.stat}" is not a stat the host recognises.`, 'mode');
});

lintRegistry.register('script-name', ({ config }) => {
  if (String(config.meta.name ?? '').trim()) return null;
  return finding('warning', 'The script has no name, so the tool will show it as blank.', 'meta');
});

lintRegistry.register('generated-call-check', ({ unknownCalls, retiredCalls }) => {
  /** @type {Finding[]} */
  const out = [];
  for (const name of retiredCalls) {
    out.push(finding('error', `The generated script calls the retired ${name}(), which aborts on the host.`));
  }
  for (const name of unknownCalls) {
    out.push(finding('error', `The generated script calls ${name}(), which is not in the Lua API.`));
  }
  return out;
});

lintRegistry.register('helper-moves', ({ config, mode }) => {
  if (!mode.traits.usesBalls) return null;
  /** @type {Finding[]} */
  const out = [];
  (config.battle.helperMoves ?? []).forEach((helper, index) => {
    const at = `Preparation move ${index + 1}`;
    if (!String(helper.move ?? '').trim()) {
      out.push(finding('error', `${at}: no move name.`, 'battle'));
      return;
    }
    if (helper.trigger === 'oppType' && !String(helper.type ?? '').trim()) {
      out.push(finding('error', `${at} ("${helper.move}"): no opponent type given.`, 'battle'));
    }
    if (helper.trigger === 'oppName' && !helper.names.length) {
      out.push(finding('error', `${at} ("${helper.move}"): no opponent names given.`, 'battle'));
    }
    if (helper.trigger === 'myAbility' && !String(helper.ability ?? '').trim()) {
      out.push(finding('error', `${at} ("${helper.move}"): no ability given.`, 'battle'));
    }
  });
  return out;
});

lintRegistry.register('zone-syntax', ({ config }) => {
  const bad = (config.route.zones ?? []).filter((entry) => String(entry).trim() && !parseZone(entry));
  return bad.map((entry) => finding(
    'error',
    `"${entry}" is not four whole numbers — a zone is written as "x1, y1, x2, y2".`,
    'zones',
  ));
});

lintRegistry.register('zone-rotation-range', ({ config, zones }) => {
  if (!zones.rotates || !zones.timed) return null;
  const { min, max } = config.route.zoneRotation;
  if (Number(min) <= Number(max)) return null;
  return finding(
    'warning',
    `Zone interval ${min}–${max} minutes is reversed; the builder clamped it to `
    + `${zones.minMinutes}–${zones.maxMinutes}.`,
    'zones',
  );
});

lintRegistry.register('zone-flat-note', ({ zones }) => {
  if (!zones.zones.some((zone) => zone.flat)) return null;
  return finding(
    'info',
    'A zone is a single row or column, so the bot patrols its two ends with moveToCell '
    + 'instead of wandering a rectangle.',
    'zones',
  );
});

lintRegistry.register('zones-override-action', ({ config, zones }) => {
  if (!zones.active || config.route.farmAction === 'moveToGrass') return null;
  return finding(
    'info',
    'Zones replace the "how to find encounters" action while they are configured.',
    'zones',
  );
});

lintRegistry.register('stop-force-mount', ({ config, plan }) => {
  if (!plan.stops.some((stop) => stop.mount === 'force')) return null;
  if (config.mounts.land.length) return null;
  return finding(
    'warning',
    'A stop forces a mount, but no land mount is configured — the step is skipped.',
    'stops',
  );
});

lintRegistry.register('time-of-day-empty', ({ config }) => {
  const timeOfDay = config.route.timeOfDay ?? {};
  if (!timeOfDay.enabled) return null;

  const changes = TIME_PERIODS.some((period) => {
    const fields = periodFields(period.id);
    return String(timeOfDay[fields.map] ?? '').trim()
      || String(timeOfDay[fields.action] ?? '').trim();
  });
  if (changes) return null;
  return finding(
    'warning',
    'Time-of-day hunting is on but no period changes anything, so it has no effect.',
    'stops',
  );
});

lintRegistry.register('time-of-day-arguments', ({ config, zones }) => {
  const timeOfDay = config.route.timeOfDay ?? {};
  if (!timeOfDay.enabled) return null;

  /** @type {Finding[]} */
  const out = [];
  let overrides = 0;

  for (const period of TIME_PERIODS) {
    const fields = periodFields(period.id);
    const action = String(timeOfDay[fields.action] ?? '').trim();
    if (!action) continue;
    overrides += 1;

    const args = String(timeOfDay[fields.args] ?? '').trim();
    const isCell = /^-?\d+\s*[,;]\s*-?\d+$/.test(args);
    if ((action === 'moveToCell' || action === FISHING_ACTION) && !isCell) {
      out.push(finding('error', `${period.label}: hunting this way needs a cell, e.g. "12, 30".`, 'stops'));
    }
    if (action === FISHING_ACTION && !String(timeOfDay[fields.rod] ?? '').trim()) {
      out.push(finding('error', `${period.label}: fishing needs a rod, e.g. "Super Rod".`, 'stops'));
    }
    if (action === 'useItem' && !args) {
      out.push(finding('error', `${period.label}: this needs an item name, e.g. "Repel".`, 'stops'));
    }
  }

  if (overrides && zones.active) {
    out.push(finding(
      'warning',
      'Farm zones replace the hunting action, so the per-period ones never run.',
      'zones',
    ));
  }
  return out;
});

lintRegistry.register('rotation-conflicts-with-pins', ({ team }) => {
  if (team.rotationMode === 'off' || team.pinnedSlots === 0) return null;
  const plural = team.pinnedSlots > 1;
  return finding(
    'info',
    `Slot${plural ? 's 1 and 2 are' : ' 1 is'} pinned by an ability, so rotation works on `
    + `slot ${team.rotationSlot}.`,
    'team',
  );
});

lintRegistry.register('rotation-uid-list', ({ config }) => {
  if (config.team.rotation.mode !== 'uid') return null;
  const ids = config.team.rotation.ids;
  if (!ids.length) return finding('error', 'Unique-id rotation needs at least one id.', 'team');
  const bad = ids.find((id) => !/^[0-9]+$/.test(String(id).trim()));
  if (!bad) return null;
  return finding('error', `Unique ids must be whole numbers: "${bad}" is not.`, 'team');
});

lintRegistry.register('rotation-ev-table', ({ config, mode }) => {
  if (config.team.rotation.mode !== 'uidEv') return null;
  const goals = config.team.rotation.goals ?? [];
  if (!goals.length) return finding('error', 'The EV table has no Pokémon in it.', 'team');

  /** @type {Finding[]} */
  const out = [];
  const seen = new Set();
  goals.forEach((goal, index) => {
    const id = String(goal.id ?? '').trim();
    if (!id) {
      out.push(finding('error', `EV table row ${index + 1} still needs a unique id.`, 'team'));
      return;
    }
    if (!/^[0-9]+$/.test(id)) {
      out.push(finding('error', `EV table row ${index + 1}: "${id}" is not a whole unique id.`, 'team'));
      return;
    }
    if (seen.has(id)) {
      out.push(finding(
        'warning',
        `EV table row ${index + 1}: ${id} is listed twice; only the first row is ever reached.`,
        'team',
      ));
    }
    seen.add(id);
  });

  if (mode.id !== 'ev') {
    out.push(finding(
      'info',
      'The EV table also drives the encounter filter, but only in EV farm mode. '
      + 'Here it just decides who leads.',
      'team',
    ));
  }
  return out;
});

lintRegistry.register('ev-stat-ignored', ({ config, mode }) => {
  if (mode.id !== 'ev' || config.team.rotation.mode !== 'uidEv') return null;
  return finding(
    'info',
    'The EV table is in charge, so the single stat above is ignored — the filter follows '
    + 'whichever Pokémon is currently leading.',
    'mode',
  );
});

lintRegistry.register('end-behaviour-arguments', ({ config, plan }) => {
  const behaviour = config.route.endBehaviour;
  /** @type {Finding[]} */
  const out = [];

  if (behaviour === 'healNpc'
    && !/^-?\d+\s*[,;]\s*-?\d+$/.test(String(config.route.endHealCell ?? '').trim())) {
    out.push(finding('error', 'Healing at an NPC needs its cell, e.g. "59, 13".', 'team'));
  }
  if (behaviour !== 'pcLoop' && plan.travels) {
    out.push(finding(
      'info',
      'The route still walks to the hunting map, but it never walks back — the return '
      + 'trip is only used for breaks now.',
      'team',
    ));
  }
  return out;
});

lintRegistry.register('zone-reroll-unreachable', ({ config, zones }) => {
  if (!zones.eventDriven || zones.mode !== 'onHeal') return null;
  if (config.route.endBehaviour === 'pcLoop') return null;
  return finding(
    'warning',
    'Zones reroll on every heal, but the farm loop no longer heals — so the zone never changes.',
    'zones',
  );
});

lintRegistry.register('relog-delay', ({ config, mode }) => {
  if (mode.traits.engagesEveryEncounter || config.safety.onTrapped !== 'relog') return null;
  const delay = Number.parseInt(String(config.safety.relogDelay ?? ''), 10);
  if (Number.isFinite(delay) && delay > 0) return null;
  return finding('warning', 'The relog delay must be above zero; 30 seconds is used instead.', 'safety');
});

lintRegistry.register('custom-guard-overrides', ({ config }) => {
  if (isEmptyCondition(config.team.customGuard)) return null;
  return finding(
    'info',
    'The custom keep-farming condition replaces the usable-count and PP settings above.',
    'team',
  );
});

lintRegistry.register('rules-present', ({ config, mode }) => {
  if (mode.id !== 'rules') return null;
  if ((config.rules ?? []).some((rule) => rule.steps?.length)) return null;
  return finding('error', 'Custom-rules mode needs at least one rule with a step.', 'rules');
});

lintRegistry.register('rule-step-arguments', ({ config, mode }) => {
  if (mode.id !== 'rules') return null;
  /** @type {Finding[]} */
  const out = [];
  for (const { step, where } of eachRuleStep(config)) {
    out.push(...checkStep(step, where));
  }
  return out;
});

/**
 * Every step in every rule, groups included, paired with a label that names
 * where it sits.
 *
 * @param {object} config
 * @returns {Generator<{ step: object, where: string }>}
 */
function* eachRuleStep(config) {
  for (const [ruleIndex, rule] of (config.rules ?? []).entries()) {
    const label = rule.label || `Rule ${ruleIndex + 1}`;
    yield* walkSteps(rule.steps, label);
  }
}

/**
 * @param {unknown} steps
 * @param {string} prefix
 * @returns {Generator<{ step: object, where: string }>}
 */
function* walkSteps(steps, prefix) {
  for (const [index, step] of (Array.isArray(steps) ? steps : []).entries()) {
    if (!step) continue;
    const where = `${prefix}, step ${index + 1}`;
    yield { step, where };
    if (step.action === 'group') yield* walkSteps(step.steps, where);
  }
}

/**
 * @param {object} step
 * @param {string} at
 * @returns {Finding[]}
 */
function checkStep(step, at) {
  /** @type {Finding[]} */
  const out = [];
  switch (step.action) {
    case 'useMove':
      if (!step.move) out.push(finding('error', `${at}: no move name.`, 'rules'));
      break;
    case 'useItem':
      if (!step.item) out.push(finding('error', `${at}: no item name.`, 'rules'));
      break;
    case 'throwBalls':
      if (!step.balls?.length) out.push(finding('error', `${at}: no balls listed.`, 'rules'));
      break;
    case 'rawLua':
      if (!step.expr) out.push(finding('error', `${at}: the raw Lua step is empty.`, 'rules'));
      break;
    case 'group':
      if (!step.steps?.length) {
        out.push(finding('warning', `${at}: the group is empty, so it does nothing.`, 'rules'));
      }
      break;
    case 'chain':
      out.push(...checkChain(step, at));
      break;
    case 'apiCall':
      out.push(...checkApiCall(step.fn, step.args, at));
      break;
    case 'stopBot':
    case 'logout':
      if (!String(step.message ?? '').trim()) {
        out.push(finding('info', `${at}: no message, so a default one is logged.`, 'rules'));
      }
      break;
    default:
      break;
  }
  return out;
}

/**
 * @param {object} step
 * @param {string} at
 * @returns {Finding[]}
 */
function checkChain(step, at) {
  const links = Array.isArray(step.chain) ? step.chain : [];
  if (!links.length) return [finding('error', `${at}: the chain has no fallbacks.`, 'rules')];

  /** @type {Finding[]} */
  const out = [];
  links.forEach((link, index) => {
    const spec = CHAIN_ACTIONS.find((entry) => entry.id === link.action);
    if (spec && spec.needs !== 'none' && !String(link.value ?? '').trim()) {
      out.push(finding('error', `${at}, fallback ${index + 1}: ${spec.label} needs a value.`, 'rules'));
    }
  });

  // Everything after an unconditional action is dead: `run()` and `attack()`
  // only fail in situations where the ones after them would fail too.
  const alwaysActs = links.findIndex((link) => ALWAYS_ACTS.has(link.action));
  if (alwaysActs >= 0 && alwaysActs < links.length - 1) {
    out.push(finding(
      'info',
      `${at}: ${links[alwaysActs].action}() almost always succeeds, so the `
      + `${links.length - alwaysActs - 1} fallback(s) after it rarely run.`,
      'rules',
    ));
  }
  return out;
}

/** Chain links that succeed in nearly every battle state. */
const ALWAYS_ACTS = new Set(['attack', 'weakAttack', 'sendAnyPokemon']);

/**
 * Check a hand-written call: does the function exist, and do the arguments fit?
 *
 * @param {unknown} name
 * @param {unknown} args
 * @param {string} at
 * @returns {Finding[]}
 */
function checkApiCall(name, args, at) {
  const fn = String(name ?? '').trim();
  if (!fn) return [finding('error', `${at}: no function chosen.`, 'rules')];
  return validateCall(fn, String(args ?? '')).map(
    (problem) => finding(problem.level, `${at}: ${problem.message}`, 'rules'),
  );
}

lintRegistry.register('condition-api-calls', ({ config }) => {
  /** @type {Finding[]} */
  const out = [];
  const trees = [
    { node: config.team.customGuard, panel: 'team', where: 'The keep-farming condition' },
    ...(config.rules ?? []).map((rule, index) => ({
      node: rule.match,
      panel: 'rules',
      where: `"${rule.label || `Rule ${index + 1}`}" matches when`,
    })),
    ...[...eachRuleStep(config)].map(({ step, where }) => ({
      node: step.when,
      panel: 'rules',
      where: `${where}'s guard`,
    })),
  ];

  for (const tree of trees) {
    for (const leaf of eachLeaf(tree.node)) {
      if (leaf.kind !== 'apiCall') continue;
      out.push(...checkApiCall(leaf.params?.fn, leaf.params?.args, tree.where)
        .map((item) => ({ ...item, panel: tree.panel })));
      out.push(...checkComparisonValue(leaf.params, tree.where, tree.panel));
    }
  }
  return out;
});

/**
 * A bare word on the right of a comparison is almost always a forgotten pair of
 * quotes: Lua reads it as an undefined global, which compares equal to nothing.
 *
 * @param {object} params
 * @param {string} where
 * @param {string} panel
 * @returns {Finding[]}
 */
function checkComparisonValue(params, where, panel) {
  const cmp = String(params?.cmp ?? '');
  if (!cmp) return [];
  const value = String(params?.value ?? '').trim();
  if (!value) return [finding('error', `${where}: no value to compare against.`, panel)];
  if (looksLikeUnquotedText(value)) {
    return [finding(
      'error',
      `${where}: ${value} is not valid Lua. Text has to be quoted: "${value}".`,
      panel,
    )];
  }
  if (!looksLikeBareWord(value)) return [];
  return [finding(
    'warning',
    `${where}: ${value} is read as a variable name. Did you mean "${value}" in quotes?`,
    panel,
  )];
}

/**
 * @param {unknown} node
 * @returns {Generator<object>} every leaf of a condition tree
 */
function* eachLeaf(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node.items)) {
    for (const child of node.items) yield* eachLeaf(child);
    return;
  }
  yield node;
}

lintRegistry.register('message-flag-phrases', ({ config }) => {
  /** @type {Finding[]} */
  const out = [];
  const seen = new Set();
  const trees = [
    config.team.customGuard,
    ...(config.rules ?? []).flatMap((rule) => [rule.match]),
    ...[...eachRuleStep(config)].map(({ step }) => step.when),
  ];

  for (const tree of trees) {
    for (const leaf of eachLeaf(tree)) {
      const phrases = leaf.kind === 'heardText' ? leaf.params?.on : (leaf.kind === 'oppAbility' ? leaf.params?.names : null);
      if (!phrases) continue;
      const list = toStringList(phrases);
      const key = `${leaf.kind}:${list.join('|')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!list.length) {
        out.push(finding(
          'error',
          leaf.kind === 'heardText'
            ? 'A "heard in the battle log" condition has no phrase to listen for.'
            : 'An "opponent ability was announced" condition names no ability.',
          'rules',
        ));
      }
    }
  }
  return out;
});

lintRegistry.register('rule-unreachable', ({ config, mode }) => {
  if (mode.id !== 'rules') return null;
  const rules = config.rules ?? [];
  const openIndex = rules.findIndex((rule) => isEmptyCondition(rule.match));
  if (openIndex < 0 || openIndex === rules.length - 1) return null;
  return finding(
    'warning',
    `"${rules[openIndex].label}" has no condition, so it matches everything and the `
    + `${rules.length - openIndex - 1} rule(s) after it never run.`,
    'rules',
  );
});

/** Order findings worst-first so the panel reads top-down. */
const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 };

/**
 * Run every registered rule.
 *
 * A rule that throws is reported rather than allowed to break the preview.
 *
 * @param {LintInput} input
 * @returns {Finding[]}
 */
export function runLint(input) {
  /** @type {Finding[]} */
  const findings = [];
  for (const id of lintRegistry.ids()) {
    const rule = lintRegistry.require(id);
    try {
      const result = rule(input);
      if (!result) continue;
      findings.push(...(Array.isArray(result) ? result : [result]));
    } catch (error) {
      findings.push(finding('error', `Lint rule "${id}" failed: ${error.message}`));
    }
  }
  return findings.sort((a, b) => SEVERITY_ORDER[a.level] - SEVERITY_ORDER[b.level]);
}
