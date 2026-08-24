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
 * @property {string} rotationMode    'off' | 'weakest' | 'ev' | 'uid'
 * @property {string} evStat
 * @property {number} evTarget
 * @property {number[]} uids
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

  const uids = toStringList(rotation.ids)
    .map((entry) => Number.parseInt(entry, 10))
    .filter(Number.isInteger);

  const rotationMode = rotation.mode === 'uid' && !uids.length ? 'off' : (rotation.mode ?? 'off');
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
      writer.comment(`Bring the lowest-level usable Pokémon into slot ${target} so it earns the experience.`);
      writer.fn('rotateTeam()', (w) => {
        w.useHosts(['getTeamSize', 'isPokemonUsable', 'getPokemonLevel', 'swapPokemon']);
        w.line('local pick, lowest = nil, nil');
        w.block(`for slot = ${target}, getTeamSize() do`, (loop) => {
          loop.block('if isPokemonUsable(slot) then', (inner) => {
            inner.line('local level = getPokemonLevel(slot)');
            inner.line('if lowest == nil or level < lowest then pick, lowest = slot, level end');
          });
        });
        w.line(`if pick and pick ~= ${target} then return swapPokemon(${target}, pick) end`);
        w.line('return false');
      }, { local: true });
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

    case 'uid':
    default:
      writer.line(`local ROTATE_IDS = { ${plan.uids.join(', ')} }`);
      writer.comment('First listed Pokémon that can still fight leads; the list is the priority order.');
      writer.fn('rotateTeam()', (w) => {
        w.useHosts(['getTeamSize', 'getPokemonUniqueId', 'isPokemonUsable', 'swapPokemon']);
        w.block('for _, uid in ipairs(ROTATE_IDS) do', (loop) => {
          loop.block('for slot = 1, getTeamSize() do', (inner) => {
            inner.block('if getPokemonUniqueId(slot) == uid and isPokemonUsable(slot) then', (hit) => {
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
