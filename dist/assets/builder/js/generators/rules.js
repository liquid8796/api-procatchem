/**
 * The battle rules engine.
 *
 * A rule is a named condition plus an ordered list of steps. In battle the
 * script walks the rules top to bottom, runs the first whose condition matches,
 * and inside it runs the first step whose own guard passes and whose action
 * actually succeeds. Because the host allows one battle action per frame, each
 * step ends the turn as soon as it acts; the next frame resumes from the top,
 * which is how a multi-turn sequence (weaken, then sleep, then throw) plays out.
 *
 * Steps can be marked once-per-battle; those are tracked in a table cleared by
 * `onPathAction`, which only runs between battles.
 */

import { luaNumber, luaString } from '../core/lua-writer.js';
import {
  collectConditionHelpers,
  emitCondition,
  isEmptyCondition,
} from '../domain/condition.js';

/** Ladders reused for a rule's "everything declined" fallback. */
const FIGHT_CHAIN = 'attack() or sendUsablePokemon() or sendAnyPokemon() or run()';
const FLEE_CHAIN = 'run() or attack() or sendUsablePokemon() or sendAnyPokemon()';

/** Actions that are a bare host call with no arguments. */
const SIMPLE_ACTIONS = Object.freeze({
  attack: 'attack',
  weakAttack: 'weakAttack',
  run: 'run',
  sendUsablePokemon: 'sendUsablePokemon',
  sendAnyPokemon: 'sendAnyPokemon',
});

/**
 * @typedef {import('../core/lua-writer.js').LuaWriter} LuaWriter
 *
 * @typedef {object} RulesPlan
 * @property {object[]} rules       rules that have something to do
 * @property {boolean} active
 * @property {boolean} usesOnce     any step is once-per-battle
 * @property {boolean} usesMoveHelper  any step uses a move from an automatic slot
 * @property {boolean} usesTrapFlag    switching is attempted somewhere
 * @property {Set<string>} conditionHelpers helper ids the conditions need
 */

/**
 * @param {object} config
 * @returns {RulesPlan}
 */
export function planRules(config) {
  const rules = (Array.isArray(config.rules) ? config.rules : []).filter(
    (rule) => rule && Array.isArray(rule.steps) && rule.steps.length,
  );

  /** @type {Set<string>} */
  const conditionHelpers = new Set();
  let usesOnce = false;
  let usesMoveHelper = false;
  let usesSwitch = false;

  for (const rule of rules) {
    collectConditionHelpers(rule.match, conditionHelpers);
    for (const step of rule.steps) {
      collectConditionHelpers(step.when, conditionHelpers);
      if (step.once) usesOnce = true;
      if (step.action === 'useMove' && step.slot === 'auto') usesMoveHelper = true;
      if (step.action === 'useMove' && step.slot !== 'auto') usesSwitch = true;
      if (step.action === 'sendPokemon') usesSwitch = true;
    }
  }

  return {
    rules,
    active: rules.length > 0,
    usesOnce,
    usesMoveHelper,
    usesTrapFlag: usesMoveHelper || usesSwitch,
    conditionHelpers,
  };
}

/**
 * One Lua function per rule.
 *
 * @param {LuaWriter} writer
 * @param {RulesPlan} plan
 */
export function emitRules(writer, plan) {
  if (!plan.active) return;

  plan.rules.forEach((rule, index) => {
    writer.comment(`Rule ${index + 1}: ${rule.label || 'unnamed'}`);
    writer.fn(`${ruleFunctionName(index)}()`, (w) => {
      rule.steps.forEach((step, stepIndex) => emitStep(w, step, index, stepIndex));
      w.blank();
      emitFallback(w, rule.fallback, rule.label || `rule ${index + 1}`);
    }, { local: true });
    writer.blank();
  });
}

/**
 * The rule dispatch used inside `onBattleAction`.
 *
 * @param {LuaWriter} writer
 * @param {RulesPlan} plan
 */
export function emitRuleDispatch(writer, plan) {
  if (!plan.active) {
    writer.comment('No rules configured.');
    return;
  }
  plan.rules.forEach((rule, index) => {
    const guard = isEmptyCondition(rule.match) ? 'true' : emitCondition(rule.match, writer);
    writer.comment(`${rule.label || `Rule ${index + 1}`}`);
    writer.block(`if ${guard} then`, (inner) => {
      inner.line(`return ${ruleFunctionName(index)}()`);
    });
  });
}

/**
 * @param {number} index
 * @returns {string}
 */
function ruleFunctionName(index) {
  return `rule${index + 1}`;
}

/**
 * Emit one step: guard, action, and the once-per-battle bookkeeping.
 *
 * @param {LuaWriter} writer
 * @param {object} step
 * @param {number} ruleIndex
 * @param {number} stepIndex
 */
function emitStep(writer, step, ruleIndex, stepIndex) {
  const flag = `"r${ruleIndex + 1}s${stepIndex + 1}"`;
  // `useOnce` checks the flag itself, so an outer guard would be redundant.
  const flagCheckedInside = step.once && step.action === 'useMove' && step.slot === 'auto';
  const guards = [];
  if (step.once && !flagCheckedInside) guards.push(`not F[${flag}]`);
  if (!isEmptyCondition(step.when)) guards.push(emitCondition(step.when, writer));

  const body = (target) => emitStepAction(target, step, flag);
  if (!guards.length) {
    body(writer);
    return;
  }
  writer.block(`if ${guards.join(' and ')} then`, body);
}

/**
 * @param {LuaWriter} writer
 * @param {object} step
 * @param {string} flag
 */
function emitStepAction(writer, step, flag) {
  const succeed = step.once ? `F[${flag}] = true; return true` : 'return true';

  switch (step.action) {
    case 'useMove':
      emitUseMove(writer, step, succeed, flag);
      return;

    case 'useItem':
      writer.useHost('useItem');
      writer.line(`if useItem(${luaString(step.item)}) then ${succeed} end`);
      return;

    case 'throwBalls': {
      writer.useHost('useItem');
      const balls = Array.isArray(step.balls) ? step.balls.filter(Boolean) : [];
      if (!balls.length) {
        writer.comment('No balls listed for this step.');
        return;
      }
      for (const ball of balls) {
        writer.line(`if useItem(${luaString(ball)}) then ${succeed} end`);
      }
      return;
    }

    case 'sendPokemon':
      writer.useHost('sendPokemon');
      writer.line(`if not trapped and sendPokemon(${luaNumber(step.slotNumber, 1)}) then ${succeed} end`);
      return;

    case 'rawLua': {
      const expression = String(step.expr ?? '').trim();
      if (!expression) {
        writer.comment('Empty raw step.');
        return;
      }
      writer.line(`if (${expression}) then ${succeed} end`);
      return;
    }

    default: {
      const host = SIMPLE_ACTIONS[step.action];
      if (!host) throw new Error(`Unknown step action: ${step.action}`);
      writer.useHost(host);
      writer.line(`if ${host}() then ${succeed} end`);
    }
  }
}

/**
 * A move either comes from whichever slot still knows it, or from one fixed
 * slot that has to be switched in first.
 *
 * @param {LuaWriter} writer
 * @param {object} step
 * @param {string} succeed
 */
function emitUseMove(writer, step, succeed, flag) {
  const move = luaString(step.move);
  if (step.slot === 'auto') {
    // `useOnce` owns the flag, because only it can tell a landed move from a
    // turn spent switching the owner in.
    if (step.once) writer.line(`if useOnce(${flag}, ${move}) then return true end`);
    else writer.line(`if useMoveFromAnySlot(${move}) then return true end`);
    return;
  }

  const slot = luaNumber(step.slot, 1);
  writer.useHosts(['getActivePokemonNumber', 'sendPokemon', 'useMove']);
  writer.ifChain([
    {
      cond: `getActivePokemonNumber() == ${slot}`,
      body: (inner) => inner.line(`if useMove(${move}) then ${succeed} end`),
    },
    {
      cond: 'not trapped',
      body: (inner) => inner.line(`if sendPokemon(${slot}) then return true end`),
    },
  ]);
}

/**
 * @param {LuaWriter} writer
 * @param {string} fallback
 * @param {string} ruleLabel
 */
function emitFallback(writer, fallback, ruleLabel) {
  writer.comment('Every step declined.');
  switch (fallback) {
    case 'run':
      writer.useHosts(['run', 'attack', 'sendUsablePokemon', 'sendAnyPokemon']);
      writer.line(`return ${FLEE_CHAIN}`);
      return;
    case 'nothing':
      writer.useHost('log');
      writer.comment('Doing nothing stops the bot, which is safer than losing the encounter.');
      writer.line(`log(${luaString(`No step could act for "${ruleLabel}" — stopping.`)})`);
      writer.line('return false');
      return;
    case 'attack':
    default:
      writer.useHosts(['attack', 'sendUsablePokemon', 'sendAnyPokemon', 'run']);
      writer.line(`return ${FIGHT_CHAIN}`);
  }
}
