/**
 * Configuration lint.
 *
 * Rules catch the mistakes that produce a script which loads fine but does
 * nothing useful — an empty ball ladder, a route the link graph cannot reach,
 * a healing condition that never fires. Each rule is an independent function,
 * registered here; adding one needs no changes elsewhere.
 */

import { Registry } from '../core/registry.js';
import { isEmptyCondition } from '../domain/condition.js';
import { EV_STATS } from '../domain/config.js';
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
  const { farmAction, farmArgs } = config.route;
  const args = String(farmArgs ?? '').trim();
  if (farmAction === 'moveToCell' && !/^-?\d+\s*[,;]\s*-?\d+$/.test(args)) {
    return finding('error', 'The cell hunting action needs coordinates like "12, 30".', 'route');
  }
  if (farmAction === 'useItem' && !args) {
    return finding('error', 'The item hunting action needs an item name, e.g. "Super Rod".', 'route');
  }
  return null;
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
  const named = [timeOfDay.morningMap, timeOfDay.noonMap, timeOfDay.nightMap]
    .filter((map) => String(map ?? '').trim());
  if (named.length) return null;
  return finding(
    'warning',
    'Time-of-day hunting is on but no period names a map, so it has no effect.',
    'stops',
  );
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
  (config.rules ?? []).forEach((rule, ruleIndex) => {
    const where = rule.label || `Rule ${ruleIndex + 1}`;
    (rule.steps ?? []).forEach((step, stepIndex) => {
      const at = `${where}, step ${stepIndex + 1}`;
      if (step.action === 'useMove' && !step.move) out.push(finding('error', `${at}: no move name.`, 'rules'));
      if (step.action === 'useItem' && !step.item) out.push(finding('error', `${at}: no item name.`, 'rules'));
      if (step.action === 'throwBalls' && !step.balls.length) {
        out.push(finding('error', `${at}: no balls listed.`, 'rules'));
      }
      if (step.action === 'rawLua' && !step.expr) {
        out.push(finding('error', `${at}: the raw Lua step is empty.`, 'rules'));
      }
    });
  });
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
