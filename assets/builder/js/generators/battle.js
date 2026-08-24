/**
 * Emitters for battle tactics shared by the farm modes: the trainer and
 * non-target policies, the wild-target predicate, the catch ladder, and the
 * knock-out ladder.
 *
 * Only one battle action may run per `onBattleAction` call, so every emitted
 * sequence is a chain of `if <action> then return true end` steps: the first
 * one that succeeds ends the turn.
 */

import { luaNumber, luaString } from '../core/lua-writer.js';
import { toStringList } from '../domain/config.js';

/**
 * @typedef {import('../core/lua-writer.js').LuaWriter} LuaWriter
 * @typedef {import('./runtime.js').EmitContext} EmitContext
 */

/** Ladder used whenever the script just needs to survive a battle it did not choose. */
const FIGHT_CHAIN = 'attack() or sendUsablePokemon() or sendAnyPokemon() or run()';
const FLEE_CHAIN = 'run() or attack() or sendUsablePokemon() or sendAnyPokemon()';
const WEAK_CHAIN = 'weakAttack() or attack() or sendUsablePokemon() or sendAnyPokemon()';

/**
 * The `if not isWildBattle()` branch.
 *
 * @param {LuaWriter} writer
 * @param {object} config
 */
export function emitTrainerPolicy(writer, config) {
  const flees = config.battle.onTrainer === 'run';
  writer.useHosts(['attack', 'sendUsablePokemon', 'sendAnyPokemon', 'run']);
  if (flees) {
    writer.comment('Most trainer battles cannot be fled, so this falls through to fighting.');
    writer.line(`return ${FLEE_CHAIN}`);
    return;
  }
  writer.line(`return ${FIGHT_CHAIN}`);
}

/**
 * What to do with a wild encounter the script does not want.
 *
 * @param {LuaWriter} writer
 * @param {object} config
 */
export function emitOtherPolicy(writer, config) {
  switch (config.battle.onOther) {
    case 'fight':
      writer.useHosts(['attack', 'sendUsablePokemon', 'sendAnyPokemon', 'run']);
      writer.line(`return ${FIGHT_CHAIN}`);
      return;
    case 'weakAttack':
      writer.useHosts(['weakAttack', 'attack', 'sendUsablePokemon', 'sendAnyPokemon']);
      writer.line(`return ${WEAK_CHAIN}`);
      return;
    case 'run':
    default:
      writer.useHosts(['run', 'sendUsablePokemon', 'attack', 'sendAnyPokemon']);
      writer.line(`return ${FLEE_CHAIN}`);
  }
}

/**
 * `isTarget()` — the wild-encounter filter built from the target panel.
 *
 * With `requireAll` off (the default) the clauses are OR-ed, which is what a
 * shiny hunt wants: catch a shiny *or* anything on the name list. With it on
 * they are AND-ed for a precise hunt.
 *
 * @param {LuaWriter} writer
 * @param {object} config
 */
export function emitTargetPredicate(writer, config) {
  const target = config.target;
  /** @type {string[]} */
  const clauses = [];

  if (target.shiny) {
    writer.useHost('isOpponentShiny');
    clauses.push('isOpponentShiny()');
  }
  if (target.notCaught) {
    writer.useHost('isAlreadyCaught');
    clauses.push('(not isAlreadyCaught())');
  }
  if (target.names.length) {
    writer.useHost('getOpponentName');
    const names = target.names
      .map((name) => `getOpponentName() == ${luaString(name)}`)
      .join(' or ');
    clauses.push(`(${names})`);
  }
  if (target.levelMin !== null) {
    writer.useHost('getOpponentLevel');
    clauses.push(`getOpponentLevel() >= ${luaNumber(target.levelMin, 1)}`);
  }
  if (target.levelMax !== null) {
    writer.useHost('getOpponentLevel');
    clauses.push(`getOpponentLevel() <= ${luaNumber(target.levelMax, 100)}`);
  }
  if (target.gender) {
    writer.useHost('getOpponentGender');
    clauses.push(`getOpponentGender() == ${luaString(target.gender)}`);
  }

  writer.comment('Which wild encounters are worth engaging.');
  writer.fn('isTarget()', (w) => {
    if (!clauses.length) {
      w.comment('No filters configured, so every wild encounter counts as a target.');
      w.line('return true');
      return;
    }
    const joiner = config.target.requireAll ? '\n    and ' : '\n    or ';
    w.line(`return ${clauses.join(joiner)}`);
  }, { local: true });
  writer.blank();
}

/**
 * Preparation moves: Soak, Skill Swap, Thief and the like.
 *
 * They run before weakening, at most once per battle each, because their effect
 * is a one-off change to the encounter rather than something to repeat. The
 * once-per-battle bookkeeping lives in `useOnce`, which only marks a step done
 * when the move actually landed rather than when a turn went on switching.
 *
 * @param {LuaWriter} writer
 * @param {object} config
 */
export function emitHelperMoves(writer, config) {
  const helpers = helperMovesOf(config);
  if (!helpers.length) return;

  writer.comment('Preparation moves, at most once each per battle.');
  helpers.forEach((helper, index) => {
    const flag = luaString(`h${index + 1}`);
    const call = `useOnce(${flag}, ${luaString(helper.move)})`;
    const guard = helperGuard(helper, writer);
    writer.line(guard
      ? `if ${guard} and ${call} then return true end`
      : `if ${call} then return true end`);
  });
  writer.blank();
}

/**
 * The configured preparation moves that are complete enough to emit.
 *
 * @param {object} config
 * @returns {object[]}
 */
export function helperMovesOf(config) {
  return (config.battle.helperMoves ?? []).filter((helper) => {
    if (!String(helper.move ?? '').trim()) return false;
    if (helper.trigger === 'oppType') return Boolean(String(helper.type ?? '').trim());
    if (helper.trigger === 'oppName') return toStringList(helper.names).length > 0;
    if (helper.trigger === 'myAbility') return Boolean(String(helper.ability ?? '').trim());
    return true;
  });
}

/**
 * @param {object} helper
 * @param {LuaWriter} writer
 * @returns {string} a Lua condition, or '' when the move always applies
 */
function helperGuard(helper, writer) {
  switch (helper.trigger) {
    case 'oppType':
      // `opponentHasType` is defined by the condition-helper emitter.
      return `opponentHasType(${luaString(helper.type)})`;
    case 'oppName': {
      const call = writer.useHost('getOpponentName');
      const names = toStringList(helper.names);
      return `(${names.map((name) => `${call}() == ${luaString(name)}`).join(' or ')})`;
    }
    case 'myAbility':
      return `${writer.useHost('getPokemonAbility')}(${luaNumber(helper.slot, 1)}) == ${luaString(helper.ability)}`;
    case 'always':
    default:
      return '';
  }
}

/**
 * `tryCatch()` — weaken, apply status, then work down the ball ladder.
 *
 * @param {LuaWriter} writer
 * @param {EmitContext} context
 */
export function emitCatchSequence(writer, { config, needs }) {
  const { weaken, status, balls, lowHpPercent } = config.battle;

  writer.comment('One catching step per turn; the first success ends the turn.');
  writer.fn('tryCatch()', (w) => {
    emitHelperMoves(w, config);
    emitWeakenStep(w, weaken);
    emitStatusStep(w, status, needs);
    emitBallLadder(w, balls, status.requireBeforeBall, lowHpPercent);

    w.blank();
    w.comment('Nothing left to throw. Stop instead of fleeing so the encounter is not lost.');
    w.useHost('log');
    w.line('log("No usable ball for this target — stopping so you do not lose it.")');
    w.line('return false');
  }, { local: true });
  writer.blank();
}

/**
 * @param {LuaWriter} writer
 * @param {{ mode: string, move: string, percent: number }} weaken
 */
function emitWeakenStep(writer, weaken) {
  if (weaken.mode === 'falseSwipe') {
    const move = String(weaken.move ?? '').trim();
    if (!move) return;
    writer.useHost('getOpponentHealth');
    writer.comment(`Chip to 1 HP with ${move} — it can never faint the target.`);
    writer.block('if getOpponentHealth() > 1 then', (inner) => {
      inner.line(`if useMoveFromAnySlot(${luaString(move)}) then return true end`);
    });
    writer.blank();
    return;
  }

  if (weaken.mode === 'percent') {
    writer.useHosts(['getOpponentHealthPercent', 'weakAttack']);
    writer.comment('Wear the target down with the weakest available move.');
    writer.block(`if getOpponentHealthPercent() > ${luaNumber(weaken.percent, 30)} then`, (inner) => {
      inner.line('if weakAttack() then return true end');
    });
    writer.blank();
  }
}

/**
 * @param {LuaWriter} writer
 * @param {{ moves: string[] }} status
 * @param {import('./runtime.js').Needs} needs
 */
function emitStatusStep(writer, status, needs) {
  if (!status.moves.length || !needs.slotHelpers) return;
  writer.comment('Land a status condition to improve the catch rate.');
  writer.block('if not opponentStatused() then', (inner) => {
    for (const move of status.moves) {
      inner.line(`if useMoveFromAnySlot(${luaString(move)}) then return true end`);
    }
  });
  writer.blank();
}

/**
 * @param {LuaWriter} writer
 * @param {Array<{item: string, condition: string}>} balls
 * @param {boolean} requireStatus
 * @param {number} lowHpPercent
 */
function emitBallLadder(writer, balls, requireStatus, lowHpPercent) {
  if (!balls.length) {
    writer.comment('No balls configured — add at least one in the Battle panel.');
    return;
  }
  writer.useHost('useItem');

  const emitLadder = (target) => {
    for (const ball of balls) {
      const guard = ballGuard(target, ball.condition, lowHpPercent);
      const throwCall = `useItem(${luaString(ball.item)})`;
      target.line(guard ? `if ${guard} and ${throwCall} then return true end` : `if ${throwCall} then return true end`);
    }
  };

  writer.comment('Ball ladder — best ball first, cheapest as the fallback.');
  if (requireStatus) {
    writer.comment('Gated on a status condition, as configured.');
    writer.block('if opponentStatused() then', emitLadder);
    return;
  }
  emitLadder(writer);
}

/**
 * @param {LuaWriter} writer
 * @param {string} condition
 * @param {number} lowHpPercent
 * @returns {string} a Lua boolean expression, or '' when unconditional
 */
function ballGuard(writer, condition, lowHpPercent) {
  switch (condition) {
    case 'turn1':
      writer.useHost('getBattleTurn');
      return 'getBattleTurn() == 1';
    case 'status':
      return 'opponentStatused()';
    case 'lowHp':
      writer.useHost('getOpponentHealthPercent');
      return `getOpponentHealthPercent() <= ${luaNumber(lowHpPercent, 20)}`;
    case 'always':
    default:
      return '';
  }
}

/** Fallback wait before reconnecting when a trap forces a relog. */
const DEFAULT_RELOG_DELAY = 30;

/**
 * @param {object} config
 * @returns {number} seconds to wait before reconnecting
 */
function relogDelay(config) {
  const configured = Number.parseInt(String(config.safety.relogDelay ?? ''), 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_RELOG_DELAY;
}

/**
 * Whether the configured trap escape would emit anything.
 *
 * The escape is only ever used on encounters the mode did not want, and the
 * `run` policy is redundant when the fallback already leads with `run()`.
 *
 * @param {object} config
 * @returns {boolean}
 */
export function hasTrappedEscape(config) {
  const policy = config.safety.onTrapped;
  if (policy === 'relog') return true;
  return policy === 'run' && config.battle.onOther !== 'run';
}

/**
 * The configured escape from a battle that has blocked switching.
 *
 * Emitted in the not-wanted branch only. Escaping a *target* would throw away
 * the encounter the script exists to catch; while trapped on a target the
 * `trapped` flag already stops the catch ladder attempting a doomed switch.
 *
 * @param {LuaWriter} writer
 * @param {object} config
 */
export function emitTrappedEscape(writer, config) {
  if (!hasTrappedEscape(config)) return;
  const policy = config.safety.onTrapped;

  if (policy === 'run') {
    writer.useHost('run');
    writer.comment('Switching is blocked — break out of the trap first.');
    writer.line('if trapped and run() then return true end');
    writer.blank();
    return;
  }
  if (policy === 'relog') {
    writer.useHost('relog');
    writer.comment('Switching is blocked — reconnect to clear it.');
    writer.block('if relogArmed then', (inner) => {
      inner.line('relogArmed = false');
      inner.line(`relog(${relogDelay(config)}, "Trapped in battle — reconnecting.")`);
      inner.line('return true');
    });
    writer.blank();
  }
}

/**
 * `knockOut()` — the ladder used by the EXP, EV, and gold modes.
 *
 * @param {LuaWriter} writer
 */
export function emitKnockoutSequence(writer) {
  writer.useHosts(['attack', 'sendUsablePokemon', 'sendAnyPokemon', 'run']);
  writer.comment('Knock the target out for experience, money, and EVs.');
  writer.fn('knockOut()', (w) => {
    w.line(`return ${FIGHT_CHAIN}`);
  }, { local: true });
  writer.blank();
}
