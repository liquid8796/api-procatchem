/**
 * Configuration lint.
 *
 * Rules catch the mistakes that produce a script which loads fine but does
 * nothing useful — an empty ball ladder, a route the link graph cannot reach,
 * a healing condition that never fires. Each rule is an independent function,
 * registered here; adding one needs no changes elsewhere.
 */

import { t } from '../core/i18n.js';
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
    t('Hunting on the current map, so the Pokécenter map is ignored. Switch to route mode to use it.'),
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
    out.push(finding('error', t('The cell hunting action needs coordinates like "12, 30".'), 'route'));
  }
  if (farmAction === 'fish') {
    if (!isCell) {
      out.push(finding('error', t('Fishing needs the cell to stand on, written as "12, 30".'), 'route'));
    }
    if (!String(farmRod ?? '').trim()) {
      out.push(finding('error', t('Fishing needs a rod, e.g. "Super Rod".'), 'route'));
    }
  }
  if (farmAction === 'useItem' && !args) {
    out.push(finding('error', t('The item hunting action needs an item name, e.g. "Repel".'), 'route'));
  }
  return out;
});

lintRegistry.register('heal-action-arguments', ({ config }) => {
  if (config.route.healAction !== 'talkToNpcOnCell') return null;
  if (/^-?\d+\s*[,;]\s*-?\d+$/.test(String(config.route.healArgs ?? '').trim())) return null;
  return finding('error', t('Healing by talking to an NPC needs the nurse cell, e.g. "7, 9".'), 'route');
});

lintRegistry.register('ball-ladder', ({ config, mode }) => {
  if (!mode.traits.usesBalls) return null;
  /** @type {Finding[]} */
  const out = [];
  if (!config.battle.balls.length) {
    out.push(finding('error', t('No balls configured — the script cannot catch anything.'), 'battle'));
  }
  if (config.battle.balls.some((ball) => !String(ball.item ?? '').trim())) {
    out.push(finding('error', t('A ball entry has no item name.'), 'battle'));
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
    t('Balls are gated on a status condition, but no status move is configured — the script would never throw.'),
    'battle',
  );
});

lintRegistry.register('weaken-move', ({ config, mode }) => {
  if (!mode.traits.usesWeaken) return null;
  if (config.battle.weaken.mode !== 'falseSwipe') return null;
  if (String(config.battle.weaken.move ?? '').trim()) return null;
  return finding('error', t('Weakening is set to a move, but no move name was given.'), 'battle');
});

lintRegistry.register('open-target-filter', ({ config, mode }) => {
  if (!mode.traits.usesTargetFilters) return null;
  const { shiny, notCaught, names, levelMin, levelMax, gender } = config.target;
  const hasFilter = shiny || notCaught || names.length || levelMin !== null
    || levelMax !== null || gender;
  if (hasFilter) return null;
  return finding(
    'warning',
    t('No target filters — the script will try to catch every wild Pokémon it meets.'),
    'target',
  );
});

lintRegistry.register('level-range', ({ config }) => {
  const { levelMin, levelMax } = config.target;
  if (levelMin === null || levelMax === null || levelMin <= levelMax) return null;
  return finding('error', t('Minimum level {min} is above maximum level {max} — nothing can match.', {
    min: levelMin, max: levelMax,
  }), 'target');
});

lintRegistry.register('requires-all-conflict', ({ config, mode }) => {
  if (!mode.traits.usesTargetFilters || !config.target.requireAll) return null;
  if (!config.target.shiny || !config.target.names.length) return null;
  return finding(
    'warning',
    t('Every filter must match, so this only catches a shiny that is also on the name list.'),
    'target',
  );
});

lintRegistry.register('never-heals', ({ config }) => {
  if (config.team.healBelowUsable !== null && config.team.healBelowUsable > 0) return null;
  if (config.team.healOnPPOut) return null;
  return finding(
    'warning',
    t('No healing rule is set, so the script farms until every Pokémon has fainted.'),
    'team',
  );
});

lintRegistry.register('break-ranges', ({ config }) => {
  if (!config.safety.breaks.enabled) return null;
  const { everyMin, everyMax, lengthMin, lengthMax } = config.safety.breaks;
  /** @type {Finding[]} */
  const out = [];
  if (Number(everyMin) > Number(everyMax)) {
    out.push(finding('error', t('Break interval: the minimum is above the maximum.'), 'safety'));
  }
  if (Number(lengthMin) > Number(lengthMax)) {
    out.push(finding('error', t('Break length: the minimum is above the maximum.'), 'safety'));
  }
  return out;
});

lintRegistry.register('break-parking', ({ config, plan }) => {
  if (!config.safety.breaks.enabled || plan.travels) return null;
  return finding(
    'info',
    t('During a break the bot stands on plain ground with moveToNormalGround(). '
      + 'If the hunting map has none, the host will stop the bot instead.'),
    'safety',
  );
});

lintRegistry.register('afk-timeout', ({ config }) => {
  const timeout = config.safety.afkTimeout;
  if (timeout === null || timeout > 0) return null;
  return finding('warning', t('The AFK timeout must be above zero to have any effect.'), 'safety');
});

lintRegistry.register('dismount-without-mount', ({ config }) => {
  if (!config.mounts.dismountOnFarm) return null;
  // Mount lists are arrays, and an empty array is truthy — check the length.
  if (config.mounts.land.length || config.mounts.water.length) return null;
  return finding('info', t('Dismount-before-hunting is on, but no mount is configured.'), 'route');
});

lintRegistry.register('ev-stat', ({ config, mode }) => {
  if (!mode.traits.usesEvStat) return null;
  const valid = EV_STATS.some((stat) => stat.id === String(config.ev.stat ?? '').toUpperCase());
  if (valid) return null;
  return finding('error', t('"{stat}" is not a stat the host recognises.', { stat: config.ev.stat }), 'mode');
});

lintRegistry.register('script-name', ({ config }) => {
  if (String(config.meta.name ?? '').trim()) return null;
  return finding('warning', t('The script has no name, so the tool will show it as blank.'), 'meta');
});

lintRegistry.register('generated-call-check', ({ unknownCalls, retiredCalls }) => {
  /** @type {Finding[]} */
  const out = [];
  for (const name of retiredCalls) {
    out.push(finding('error', t('The generated script calls the retired {name}(), which aborts on the host.', { name })));
  }
  for (const name of unknownCalls) {
    out.push(finding('error', t('The generated script calls {name}(), which is not in the Lua API.', { name })));
  }
  return out;
});

lintRegistry.register('helper-moves', ({ config, mode }) => {
  if (!mode.traits.usesBalls) return null;
  /** @type {Finding[]} */
  const out = [];
  (config.battle.helperMoves ?? []).forEach((helper, index) => {
    const at = t('Preparation move {n}', { n: index + 1 });
    if (!String(helper.move ?? '').trim()) {
      out.push(finding('error', `${at}: ${t('no move name.')}`, 'battle'));
      return;
    }
    if (helper.trigger === 'oppType' && !String(helper.type ?? '').trim()) {
      out.push(finding('error', `${at} ("${helper.move}"): ${t('no opponent type given.')}`, 'battle'));
    }
    if (helper.trigger === 'oppName' && !helper.names.length) {
      out.push(finding('error', `${at} ("${helper.move}"): ${t('no opponent names given.')}`, 'battle'));
    }
    if (helper.trigger === 'myAbility' && !String(helper.ability ?? '').trim()) {
      out.push(finding('error', `${at} ("${helper.move}"): ${t('no ability given.')}`, 'battle'));
    }
  });
  return out;
});

lintRegistry.register('zone-syntax', ({ config }) => {
  const bad = (config.route.zones ?? []).filter((entry) => String(entry).trim() && !parseZone(entry));
  return bad.map((entry) => finding(
    'error',
    t('"{zone}" is not four whole numbers — a zone is written as "x1, y1, x2, y2".', { zone: entry }),
    'zones',
  ));
});

lintRegistry.register('zone-rotation-range', ({ config, zones }) => {
  if (!zones.rotates || !zones.timed) return null;
  const { min, max } = config.route.zoneRotation;
  if (Number(min) <= Number(max)) return null;
  return finding(
    'warning',
    t('Zone interval {min}–{max} minutes is reversed; the builder clamped it to {low}–{high}.', {
      min, max, low: zones.minMinutes, high: zones.maxMinutes,
    }),
    'zones',
  );
});

lintRegistry.register('zone-flat-note', ({ zones }) => {
  if (!zones.zones.some((zone) => zone.flat)) return null;
  return finding(
    'info',
    t('A zone is a single row or column, so the bot patrols its two ends with moveToCell '
      + 'instead of wandering a rectangle.'),
    'zones',
  );
});

lintRegistry.register('zones-override-action', ({ config, zones }) => {
  if (!zones.active || config.route.farmAction === 'moveToGrass') return null;
  return finding(
    'info',
    t('Zones replace the "how to find encounters" action while they are configured.'),
    'zones',
  );
});

lintRegistry.register('stop-force-mount', ({ config, plan }) => {
  if (!plan.stops.some((stop) => stop.mount === 'force')) return null;
  if (config.mounts.land.length) return null;
  return finding(
    'warning',
    t('A stop forces a mount, but no land mount is configured — the step is skipped.'),
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
    t('Time-of-day hunting is on but no period changes anything, so it has no effect.'),
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
      out.push(finding('error', t('{period}: hunting this way needs a cell, e.g. "12, 30".', {
        period: t(period.label),
      }), 'stops'));
    }
    if (action === FISHING_ACTION && !String(timeOfDay[fields.rod] ?? '').trim()) {
      out.push(finding('error', t('{period}: fishing needs a rod, e.g. "Super Rod".', {
        period: t(period.label),
      }), 'stops'));
    }
    if (action === 'useItem' && !args) {
      out.push(finding('error', t('{period}: this needs an item name, e.g. "Repel".', {
        period: t(period.label),
      }), 'stops'));
    }
  }

  if (overrides && zones.active) {
    out.push(finding(
      'warning',
      t('Farm zones replace the hunting action, so the per-period ones never run.'),
      'zones',
    ));
  }
  return out;
});

lintRegistry.register('rotation-conflicts-with-pins', ({ team }) => {
  if (team.rotationMode === 'off' || team.pinnedSlots === 0) return null;
  return finding(
    'info',
    team.pinnedSlots > 1
      ? t('Slots 1 and 2 are pinned by an ability, so rotation works on slot {slot}.', {
        slot: team.rotationSlot,
      })
      : t('Slot 1 is pinned by an ability, so rotation works on slot {slot}.', {
        slot: team.rotationSlot,
      }),
    'team',
  );
});

lintRegistry.register('rotation-uid-list', ({ config }) => {
  if (config.team.rotation.mode !== 'uid') return null;
  const ids = config.team.rotation.ids;
  if (!ids.length) return finding('error', t('Unique-id rotation needs at least one id.'), 'team');
  const bad = ids.find((id) => !/^[0-9]+$/.test(String(id).trim()));
  if (!bad) return null;
  return finding('error', t('Unique ids must be whole numbers: "{id}" is not.', { id: bad }), 'team');
});

lintRegistry.register('rotation-ev-table', ({ config, mode }) => {
  if (config.team.rotation.mode !== 'uidEv') return null;
  const goals = config.team.rotation.goals ?? [];
  if (!goals.length) return finding('error', t('The EV table has no Pokémon in it.'), 'team');

  /** @type {Finding[]} */
  const out = [];
  const seen = new Set();
  goals.forEach((goal, index) => {
    const id = String(goal.id ?? '').trim();
    if (!id) {
      out.push(finding('error', t('EV table row {n} still needs a unique id.', { n: index + 1 }), 'team'));
      return;
    }
    if (!/^[0-9]+$/.test(id)) {
      out.push(finding('error', t('EV table row {n}: "{id}" is not a whole unique id.', {
        n: index + 1, id,
      }), 'team'));
      return;
    }
    if (seen.has(id)) {
      out.push(finding(
        'warning',
        t('EV table row {n}: {id} is listed twice; only the first row is ever reached.', {
          n: index + 1, id,
        }),
        'team',
      ));
    }
    seen.add(id);
  });

  if (mode.id !== 'ev') {
    out.push(finding(
      'info',
      t('The EV table also drives the encounter filter, but only in EV farm mode. '
        + 'Here it just decides who leads.'),
      'team',
    ));
  }
  return out;
});

lintRegistry.register('ev-stat-ignored', ({ config, mode }) => {
  if (mode.id !== 'ev' || config.team.rotation.mode !== 'uidEv') return null;
  return finding(
    'info',
    t('The EV table is in charge, so the single stat above is ignored — the filter follows '
      + 'whichever Pokémon is currently leading.'),
    'mode',
  );
});

lintRegistry.register('end-behaviour-arguments', ({ config, plan }) => {
  const behaviour = config.route.endBehaviour;
  /** @type {Finding[]} */
  const out = [];

  if (behaviour === 'healNpc'
    && !/^-?\d+\s*[,;]\s*-?\d+$/.test(String(config.route.endHealCell ?? '').trim())) {
    out.push(finding('error', t('Healing at an NPC needs its cell, e.g. "59, 13".'), 'team'));
  }
  if (behaviour !== 'pcLoop' && plan.travels) {
    out.push(finding(
      'info',
      t('The route still walks to the hunting map, but it never walks back — the return '
        + 'trip is only used for breaks now.'),
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
    t('Zones reroll on every heal, but the farm loop no longer heals — so the zone never changes.'),
    'zones',
  );
});

lintRegistry.register('relog-delay', ({ config, mode }) => {
  if (mode.traits.engagesEveryEncounter || config.safety.onTrapped !== 'relog') return null;
  const delay = Number.parseInt(String(config.safety.relogDelay ?? ''), 10);
  if (Number.isFinite(delay) && delay > 0) return null;
  return finding('warning', t('The relog delay must be above zero; 30 seconds is used instead.'), 'safety');
});

lintRegistry.register('custom-guard-overrides', ({ config }) => {
  if (isEmptyCondition(config.team.customGuard)) return null;
  return finding(
    'info',
    t('The custom keep-farming condition replaces the usable-count and PP settings above.'),
    'team',
  );
});

lintRegistry.register('rules-present', ({ config, mode }) => {
  if (mode.id !== 'rules') return null;
  if ((config.rules ?? []).some((rule) => rule.steps?.length)) return null;
  return finding('error', t('Custom-rules mode needs at least one rule with a step.'), 'rules');
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
    const label = rule.label || t('Rule {n}', { n: ruleIndex + 1 });
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
    const where = `${prefix}, ${t('step {n}', { n: index + 1 })}`;
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
      if (!step.move) out.push(finding('error', `${at}: ${t('no move name.')}`, 'rules'));
      break;
    case 'useItem':
      if (!step.item) out.push(finding('error', `${at}: ${t('no item name.')}`, 'rules'));
      break;
    case 'throwBalls':
      if (!step.balls?.length) out.push(finding('error', `${at}: ${t('no balls listed.')}`, 'rules'));
      break;
    case 'rawLua':
      if (!step.expr) out.push(finding('error', `${at}: ${t('the raw Lua step is empty.')}`, 'rules'));
      break;
    case 'group':
      if (!step.steps?.length) {
        out.push(finding('warning', `${at}: ${t('the group is empty, so it does nothing.')}`, 'rules'));
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
        out.push(finding('info', `${at}: ${t('no message, so a default one is logged.')}`, 'rules'));
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
  if (!links.length) return [finding('error', `${at}: ${t('the chain has no fallbacks.')}`, 'rules')];

  /** @type {Finding[]} */
  const out = [];
  links.forEach((link, index) => {
    const spec = CHAIN_ACTIONS.find((entry) => entry.id === link.action);
    if (spec && spec.needs !== 'none' && !String(link.value ?? '').trim()) {
      out.push(finding('error', `${at}, ${t('fallback {n}: {label} needs a value.', {
        n: index + 1, label: t(spec.label),
      })}`, 'rules'));
    }
  });

  // Everything after an unconditional action is dead: `run()` and `attack()`
  // only fail in situations where the ones after them would fail too.
  const alwaysActs = links.findIndex((link) => ALWAYS_ACTS.has(link.action));
  if (alwaysActs >= 0 && alwaysActs < links.length - 1) {
    out.push(finding(
      'info',
      `${at}: ${t('{name}() almost always succeeds, so the {count} fallback(s) after it rarely run.', {
        name: links[alwaysActs].action, count: links.length - alwaysActs - 1,
      })}`,
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
  if (!fn) return [finding('error', `${at}: ${t('no function chosen.')}`, 'rules')];
  return validateCall(fn, String(args ?? '')).map(
    (problem) => finding(problem.level, `${at}: ${problem.message}`, 'rules'),
  );
}

lintRegistry.register('condition-api-calls', ({ config }) => {
  /** @type {Finding[]} */
  const out = [];
  const trees = [
    { node: config.team.customGuard, panel: 'team', where: t('The keep-farming condition') },
    ...(config.rules ?? []).map((rule, index) => ({
      node: rule.match,
      panel: 'rules',
      where: t('"{name}" matches when', { name: rule.label || t('Rule {n}', { n: index + 1 }) }),
    })),
    ...[...eachRuleStep(config)].map(({ step, where }) => ({
      node: step.when,
      panel: 'rules',
      where: t("{where}'s guard", { where }),
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
  if (!value) return [finding('error', `${where}: ${t('no value to compare against.')}`, panel)];
  if (looksLikeUnquotedText(value)) {
    return [finding(
      'error',
      `${where}: ${t('{value} is not valid Lua. Text has to be quoted: "{value}".', { value })}`,
      panel,
    )];
  }
  if (!looksLikeBareWord(value)) return [];
  return [finding(
    'warning',
    `${where}: ${t('{value} is read as a variable name. Did you mean "{value}" in quotes?', { value })}`,
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
            ? t('A "heard in the battle log" condition has no phrase to listen for.')
            : t('An "opponent ability was announced" condition names no ability.'),
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
    t('"{name}" has no condition, so it matches everything and the {count} rule(s) after it never run.', {
      name: rules[openIndex].label, count: rules.length - openIndex - 1,
    }),
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
      findings.push(finding('error', t('Lint rule "{id}" failed: {message}', { id, message: error.message })));
    }
  }
  return findings.sort((a, b) => SEVERITY_ORDER[a.level] - SEVERITY_ORDER[b.level]);
}
