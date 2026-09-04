/**
 * Team management emission.
 *
 * Covers the out-of-battle upkeep the host has no single call for: pinning an
 * ability to a slot, rotating who leads, keeping a held item on the lead, and
 * protecting moves when a Pokémon levels up.
 *
 * Every upkeep step returns `true` when it performed a path action, because the
 * host allows exactly one per frame; `teamUpkeep()` chains them so the first
 * one that acts ends the tick.
 */

import { luaNumber, luaString, section } from '../core/lua-writer.js';
import { toStringList } from '../domain/config.js';
import { planRules } from './rules.js';

/**
 * @typedef {import('../core/lua-writer.js').LuaWriter} LuaWriter
 *
 * @typedef {object} TeamPlan
 * @property {boolean} active         any upkeep at all is emitted
 * @property {string} leadAbility     '' when slot 1 is not pinned
 * @property {string} secondAbility   '' when slot 2 is not pinned
 * @property {number} pinnedSlots     how many leading slots are reserved
 * @property {number} rotationSlot    the slot rotation swaps into
 * @property {string} rotationMode    'off' | 'weakest' | 'highest' | 'ev' | 'uid' | 'uidEv'
 * @property {string} evStat
 * @property {number} evTarget
 * @property {string[]} uids  Lua literals: a number for a unique id, a quoted name otherwise
 * @property {Array<{ id: string, stat: string, target: number }>} evGoals
 *           one EV goal per Pokémon, for the `uidEv` rotation
 * @property {string} leadItem        '' when no item is kept on the lead
 * @property {string[]} keepMoves
 * @property {boolean} useStrongest   emit `strongestSlot()` for battle steps
 * @property {boolean} needsAbilityLookup
 */

/**
 * @param {object} config
 * @returns {TeamPlan}
 */
export function planTeam(config) {
  const team = config.team ?? {};
  const rotation = team.rotation ?? {};

  const leadAbility = String(team.leadAbility ?? '').trim();
  const secondAbility = String(team.secondAbility ?? '').trim();
  // A pinned slot must not be the one rotation churns, or the two would fight
  // each other forever, swapping the same Pokémon back and forth.
  const pinnedSlots = (leadAbility ? 1 : 0) + (secondAbility ? 1 : 0);

  const uids = toStringList(rotation.ids).map(rosterEntry).filter(Boolean);

  const evGoals = (Array.isArray(rotation.goals) ? rotation.goals : [])
    .map((goal) => ({
      id: rosterEntry(goal?.id),
      stat: String(goal?.stat ?? 'ATK').toUpperCase(),
      target: Number.parseInt(String(goal?.target ?? 252), 10) || 252,
    }))
    .filter((goal) => goal.id);

  // A list rotation with an empty list would emit a loop over nothing, which
  // silently never rotates; treating it as "off" says so in the lint instead.
  const requested = rotation.mode ?? 'off';
  const rotationMode = (requested === 'uid' && !uids.length) || (requested === 'uidEv' && !evGoals.length)
    ? 'off'
    : requested;
  const leadItem = String(team.leadItem ?? '').trim();
  const keepMoves = toStringList(team.keepMoves);

  // A "send the strongest Pokémon" step calls `strongestSlot()`, so the helper
  // has to exist whether or not the team panel's toggle is on. Asking the rules
  // plan is cheaper than making the user find the toggle to fix a broken script.
  const useStrongest = Boolean(team.useStrongest)
    || (config.mode === 'rules' && planRules(config).usesStrongest);

  return {
    leadAbility,
    secondAbility,
    pinnedSlots,
    rotationSlot: pinnedSlots + 1,
    rotationMode,
    evStat: String(rotation.stat ?? 'ATK').toUpperCase(),
    evTarget: Math.max(1, Number.parseInt(String(rotation.target ?? 252), 10) || 252),
    uids,
    evGoals,
    // The EV encounter filter is the only caller of the goal-stat helper, and
    // it only exists in EV mode; emitting it elsewhere would leave dead code.
    exposeEvGoalStat: config.mode === 'ev' && rotationMode === 'uidEv',
    // The farm guard reads this in any mode: an EV table is a finite job, and
    // a run that has finished it should end rather than idle.
    exposeEvPending: rotationMode === 'uidEv',
    leadItem,
    keepMoves,
    useStrongest,
    needsAbilityLookup: Boolean(leadAbility || secondAbility),
    active: Boolean(
      leadAbility || secondAbility || leadItem || rotationMode !== 'off' || useStrongest,
    ),
  };
}

/**
 * One entry of a rotation list, as the Lua literal that identifies a Pokémon.
 *
 * A unique id survives boxing and reordering, so it is the better answer — but
 * most people know their team by name and have never seen a unique id, and a
 * name works perfectly well for a team that is not about to change. Digits are
 * read as an id, anything else as a name.
 *
 * @param {unknown} value
 * @returns {string} a Lua number or string literal, '' when there is nothing to match
 */
function rosterEntry(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return /^\d+$/.test(text) ? text : luaString(text);
}

/**
 * `matchesEntry(slot, entry)` — is this slot the Pokémon that entry names?
 *
 * @param {LuaWriter} writer
 */
function emitRosterMatcher(writer) {
  writer.comment('A list entry is either a unique id or a name; both identify one Pokémon.');
  writer.fn('matchesEntry(slot, entry)', (w) => {
    w.useHosts(['getPokemonUniqueId', 'getPokemonName']);
    w.line('if type(entry) == "number" then return getPokemonUniqueId(slot) == entry end');
    w.line('return getPokemonName(slot) == entry');
  }, { local: true });
  writer.blank();
}

/**
 * Helper functions plus `teamUpkeep()`.
 *
 * @param {LuaWriter} writer
 * @param {TeamPlan} plan
 */
export function emitTeamManagement(writer, plan) {
  if (!plan.active) return;
  section(writer, 'Team management');

  if (plan.useStrongest) emitStrongestSlot(writer);
  if (plan.needsAbilityLookup) emitAbilityLookup(writer);
  if (plan.rotationMode === 'uid' || plan.rotationMode === 'uidEv') emitRosterMatcher(writer);
  if (plan.leadAbility) emitAbilityPin(writer, 1, plan.leadAbility, 'LEAD_ABILITY');
  if (plan.secondAbility) emitAbilityPin(writer, 2, plan.secondAbility, 'SECOND_ABILITY');
  emitRotation(writer, plan);
  if (plan.leadItem) emitLeadItem(writer, plan);

  emitUpkeep(writer, plan);
}

/** @param {LuaWriter} writer */
function emitStrongestSlot(writer) {
  writer.comment('Highest-level team member that can still fight.');
  writer.fn('strongestSlot()', (w) => {
    w.useHosts(['getTeamSize', 'isPokemonUsable', 'getPokemonLevel']);
    w.line('local best, bestLevel = nil, -1');
    w.block('for slot = 1, getTeamSize() do', (loop) => {
      loop.block('if isPokemonUsable(slot) and getPokemonLevel(slot) > bestLevel then', (inner) => {
        inner.line('best, bestLevel = slot, getPokemonLevel(slot)');
      });
    });
    w.line('return best');
  }, { local: true });
  writer.blank();
}

/** @param {LuaWriter} writer */
function emitAbilityLookup(writer) {
  writer.comment('First slot whose ability matches, or nil.');
  writer.fn('slotWithAbility(ability)', (w) => {
    w.useHosts(['getTeamSize', 'getPokemonAbility']);
    w.block('for slot = 1, getTeamSize() do', (loop) => {
      loop.line('if getPokemonAbility(slot) == ability then return slot end');
    });
    w.line('return nil');
  }, { local: true });
  writer.blank();
}

/**
 * Keep the Pokémon with `ability` parked in `slot`.
 *
 * Converges: once the holder is in the slot, the lookup returns that slot and
 * the function stops acting.
 *
 * @param {LuaWriter} writer
 * @param {number} slot
 * @param {string} ability
 * @param {string} constantName
 */
function emitAbilityPin(writer, slot, ability, constantName) {
  const fnName = slot === 1 ? 'keepLeadAbility' : 'keepSecondAbility';
  writer.line(`local ${constantName} = ${luaString(ability)}`);
  writer.comment(`Park the ${ability} holder in slot ${slot}.`);
  writer.fn(`${fnName}()`, (w) => {
    w.useHost('swapPokemon');
    w.line(`local holder = slotWithAbility(${constantName})`);
    // Slots below this one are already pinned; never steal from them.
    const guard = slot === 1 ? `holder ~= ${slot}` : `holder > ${slot - 1} and holder ~= ${slot}`;
    w.line(`if holder and ${guard} then return swapPokemon(${slot}, holder) end`);
    w.line('return false');
  }, { local: true });
  writer.blank();
}

/**
 * @param {LuaWriter} writer
 * @param {TeamPlan} plan
 */
function emitRotation(writer, plan) {
  if (plan.rotationMode === 'off') return;
  const target = plan.rotationSlot;

  switch (plan.rotationMode) {
    case 'weakest':
    case 'highest':
      emitLevelRotation(writer, plan, target);
      break;

    case 'ev':
      writer.line(`local EV_STAT   = ${luaString(plan.evStat)}`);
      writer.line(`local EV_TARGET = ${luaNumber(plan.evTarget, 252)}`);
      writer.comment(`Rotate slot ${target} out once its ${plan.evStat} EV is capped.`);
      writer.fn('rotateTeam()', (w) => {
        w.useHosts(['getTeamSize', 'isPokemonUsable', 'getPokemonEffortValue', 'swapPokemon']);
        w.line(`if getPokemonEffortValue(${target}, EV_STAT) < EV_TARGET then return false end`);
        w.block(`for slot = ${target + 1}, getTeamSize() do`, (loop) => {
          loop.block(
            'if isPokemonUsable(slot) and getPokemonEffortValue(slot, EV_STAT) < EV_TARGET then',
            (inner) => inner.line(`return swapPokemon(${target}, slot)`),
          );
        });
        w.line('return false');
      }, { local: true });
      break;

    case 'uidEv':
      emitEvGoalRotation(writer, plan, target);
      break;

    case 'uid':
    default:
      writer.line(`local ROTATE_IDS = { ${plan.uids.join(', ')} }`);
      writer.comment('First listed Pokémon that can still fight leads; the list is the priority order.');
      writer.fn('rotateTeam()', (w) => {
        w.useHosts(['getTeamSize', 'isPokemonUsable', 'swapPokemon']);
        w.block('for _, entry in ipairs(ROTATE_IDS) do', (loop) => {
          loop.block('for slot = 1, getTeamSize() do', (inner) => {
            inner.block('if matchesEntry(slot, entry) and isPokemonUsable(slot) then', (hit) => {
              hit.line(`if slot ~= ${target} then return swapPokemon(${target}, slot) end`);
              hit.line('return false');
            });
          });
        });
        w.line('return false');
      }, { local: true });
  }
  writer.blank();
}

/**
 * Rotate by level, in whichever direction the mode asks for.
 *
 * @param {LuaWriter} writer
 * @param {TeamPlan} plan
 * @param {number} target
 */
function emitLevelRotation(writer, plan, target) {
  const wantsLowest = plan.rotationMode === 'weakest';
  const comparison = wantsLowest ? '<' : '>';

  writer.comment(wantsLowest
    ? `Bring the lowest-level usable Pokémon into slot ${target} so it earns the experience.`
    : `Bring the highest-level usable Pokémon into slot ${target} so battles end quickly.`);
  writer.fn('rotateTeam()', (w) => {
    w.useHosts(['getTeamSize', 'isPokemonUsable', 'getPokemonLevel', 'swapPokemon']);
    w.line('local pick, best = nil, nil');
    w.block(`for slot = ${target}, getTeamSize() do`, (loop) => {
      loop.block('if isPokemonUsable(slot) then', (inner) => {
        inner.line('local level = getPokemonLevel(slot)');
        inner.line(`if best == nil or level ${comparison} best then pick, best = slot, level end`);
      });
    });
    w.line(`if pick and pick ~= ${target} then return swapPokemon(${target}, pick) end`);
    w.line('return false');
  }, { local: true });
}

/**
 * Rotate through a list where each Pokémon trains its own stat to its own
 * target — the "EV table" of a multi-spread session.
 *
 * The leader is the first listed Pokémon that is still short of its goal, so
 * the run works down the table and stops rotating when the table is complete.
 *
 * @param {LuaWriter} writer
 * @param {TeamPlan} plan
 * @param {number} target
 */
function emitEvGoalRotation(writer, plan, target) {
  writer.comment('Each row is { unique id or name, stat, EV target }. The same Pokémon may');
  writer.comment('appear more than once — one row per stat it is being trained for.');
  writer.block('local EV_GOALS = {', (w) => {
    for (const goal of plan.evGoals) {
      w.line(`{ ${goal.id}, ${luaString(goal.stat)}, ${luaNumber(goal.target, 252)} },`);
    }
  }, '}');
  writer.blank();

  if (plan.exposeEvGoalStat) {
    writer.comment('The stat the leader still owes, for the EV encounter filter. Rows it has');
    writer.comment('already finished are skipped, so a two-stat spread moves on by itself.');
    writer.fn('currentEvGoalStat()', (w) => {
      w.useHost('getPokemonEffortValue');
      w.block('for _, goal in ipairs(EV_GOALS) do', (loop) => {
        loop.block(`if matchesEntry(${target}, goal[1]) then`, (hit) => {
          hit.line(`if getPokemonEffortValue(${target}, goal[2]) < goal[3] then return goal[2] end`);
        });
      });
      w.line('return nil');
    }, { local: true });
    writer.blank();
  }

  if (plan.exposeEvPending) {
    writer.comment('False once every row is met. The farm guard reads it, so the run ends on');
    writer.comment('the behaviour you chose instead of fleeing encounters it no longer wants.');
    writer.fn('evGoalsPending()', (w) => {
      w.useHosts(['getTeamSize', 'getPokemonEffortValue']);
      w.block('for _, goal in ipairs(EV_GOALS) do', (loop) => {
        loop.block('for slot = 1, getTeamSize() do', (inner) => {
          inner.block('if matchesEntry(slot, goal[1]) and getPokemonEffortValue(slot, goal[2]) < goal[3] then', (hit) => {
            hit.line('return true');
          });
        });
      });
      w.line('return false');
    }, { local: true });
    writer.blank();
  }

  writer.comment('Lead with the first listed Pokémon that is still short of its target.');
  writer.fn('rotateTeam()', (w) => {
    w.useHosts(['getTeamSize', 'isPokemonUsable', 'getPokemonEffortValue', 'swapPokemon']);
    const matches = 'matchesEntry(slot, goal[1]) and isPokemonUsable(slot)'
      + ' and getPokemonEffortValue(slot, goal[2]) < goal[3]';
    w.block('for _, goal in ipairs(EV_GOALS) do', (loop) => {
      loop.block('for slot = 1, getTeamSize() do', (inner) => {
        inner.block(`if ${matches} then`, (hit) => {
          hit.line(`if slot ~= ${target} then return swapPokemon(${target}, slot) end`);
          hit.line('return false');
        });
      });
    });
    w.line('return false');
  }, { local: true });
}

/**
 * Keep a held item on the lead, reclaiming it from a team-mate if the bag is empty.
 *
 * @param {LuaWriter} writer
 * @param {TeamPlan} plan
 */
function emitLeadItem(writer, plan) {
  writer.line(`local LEAD_ITEM = ${luaString(plan.leadItem)}`);
  writer.comment('Make sure the lead is holding the item, taking it back if need be.');
  writer.fn('keepLeadItem()', (w) => {
    w.useHosts(['getPokemonHeldItem', 'hasItem', 'giveItemToPokemon', 'getTeamSize', 'takeItemFromPokemon']);
    w.line('if getPokemonHeldItem(1) == LEAD_ITEM then return false end');
    w.line('if hasItem(LEAD_ITEM) then return giveItemToPokemon(LEAD_ITEM, 1) end');
    w.comment('None in the bag: reclaim it from whoever is carrying it.');
    w.block('for slot = 2, getTeamSize() do', (loop) => {
      loop.line('if getPokemonHeldItem(slot) == LEAD_ITEM then return takeItemFromPokemon(slot) end');
    });
    w.line('return false');
  }, { local: true });
  writer.blank();
}

/**
 * @param {LuaWriter} writer
 * @param {TeamPlan} plan
 */
function emitUpkeep(writer, plan) {
  const steps = [];
  if (plan.leadAbility) steps.push('keepLeadAbility');
  if (plan.secondAbility) steps.push('keepSecondAbility');
  if (plan.rotationMode !== 'off') steps.push('rotateTeam');
  if (plan.leadItem) steps.push('keepLeadItem');
  if (!steps.length) return;

  writer.comment('One upkeep action per frame; the first that acts ends the tick.');
  writer.fn('teamUpkeep()', (w) => {
    for (const step of steps) w.line(`if ${step}() then return true end`);
    w.line('return false');
  }, { local: true });
  writer.blank();
}

/**
 * `onLearningMove` — protect the configured moves.
 *
 * @param {LuaWriter} writer
 * @param {TeamPlan} plan
 */
export function emitOnLearningMove(writer, plan) {
  if (!plan.keepMoves.length) return;
  const list = plan.keepMoves.map(luaString).join(', ');

  writer.comment('Forget something that is not on the keep list.');
  writer.fn('onLearningMove(moveName, pokemonIndex)', (w) => {
    w.useHosts(['forgetAnyMoveExcept', 'log']);
    w.line(`if forgetAnyMoveExcept(${list}) then return end`);
    w.comment('Every current move is protected, so leave the choice to the tool.');
    w.line('log("Slot " .. pokemonIndex .. ": all moves protected, not learning " .. moveName .. ".")');
  });
  writer.blank();
}
