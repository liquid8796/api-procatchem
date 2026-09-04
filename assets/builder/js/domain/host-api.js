/**
 * Canonical list of globals the PROCatchem Lua host registers.
 * Generated from Bot/Scripting/LuaScript.cs � keep in sync with openapi.yaml.
 * Used to verify that every identifier the generator emits actually exists.
 */

/** Host-provided global functions callable from a script. @type {readonly string[]} */
export const HOST_FUNCTIONS = Object.freeze([
  'attack', 'buyItem', 'clearNotifyVars', 'closeChannel', 'depositPokemonToPC', 'disMount',
  'disableAutoEvolve', 'disableNpcInteractions', 'disablePartyInspection', 'disablePrivateMessage', 'enableAutoEvolve', 'enableNpcInteractions',
  'enablePartyInspection', 'enablePrivateMessage', 'executeSteps', 'fatal', 'forgetAnyMoveExcept', 'forgetMove',
  'getAccountName', 'getActiveBattlers', 'getActiveBerryTrees', 'getActiveDigSpots', 'getActiveHeadbuttTrees', 'getActivePokemonNumber',
  'getBattleTurn', 'getCellType', 'getCurrentPCBoxId', 'getCurrentPCBoxSize', 'getDamageMultiplier', 'getDiscoverableAbandonedPokemon',
  'getDiscoverableItems', 'getDiscoverablePokestops', 'getItemQuantity', 'getItemQuantityId', 'getMapHeight', 'getMapLinks',
  'getMapName', 'getMapWidth', 'getMoney', 'getNpcData', 'getOpponentEffortValue', 'getOpponentForm',
  'getOpponentGender', 'getOpponentHealth', 'getOpponentHealthPercent', 'getOpponentId', 'getOpponentLevel', 'getOpponentMaxHealth',
  'getOpponentName', 'getOpponentStatus', 'getOpponentType', 'getOption', 'getPCBoxCount', 'getPCPokemonCount',
  'getPlayerX', 'getPlayerY', 'getPokedexEvolved', 'getPokedexOwned', 'getPokedexSeen', 'getPokemonAbility',
  'getPokemonAbilityFromPC', 'getPokemonEffortValue', 'getPokemonEffortValueFromPC', 'getPokemonForm', 'getPokemonFormFromPC', 'getPokemonGender',
  'getPokemonGenderFromPC', 'getPokemonHappiness', 'getPokemonHappinessFromPC', 'getPokemonHealth', 'getPokemonHealthFromPC', 'getPokemonHealthPercent',
  'getPokemonHealthPercentFromPC', 'getPokemonHeldItem', 'getPokemonHeldItemFromPC', 'getPokemonId', 'getPokemonIdFromPC', 'getPokemonIndividualValue',
  'getPokemonIndividualValueFromPC', 'getPokemonLevel', 'getPokemonLevelFromPC', 'getPokemonMaxHealth', 'getPokemonMaxHealthFromPC', 'getPokemonMaxPowerPoints',
  'getPokemonMaxPowerPointsFromPC', 'getPokemonMoveAccuracy', 'getPokemonMoveAccuracyFromPC', 'getPokemonMoveDamageType', 'getPokemonMoveDamageTypeFromPC', 'getPokemonMoveName',
  'getPokemonMoveNameFromPC', 'getPokemonMovePower', 'getPokemonMovePowerFromPC', 'getPokemonMoveStatus', 'getPokemonMoveStatusFromPC', 'getPokemonMoveType',
  'getPokemonMoveTypeFromPC', 'getPokemonName', 'getPokemonNameFromPC', 'getPokemonNature', 'getPokemonNatureFromPC', 'getPokemonOriginalTrainer',
  'getPokemonOriginalTrainerFromPC', 'getPokemonRegion', 'getPokemonRegionFromPC', 'getPokemonRemainingExperience', 'getPokemonRemainingExperienceFromPC', 'getPokemonRemainingPowerPointsFromPC',
  'getPokemonStat', 'getPokemonStatFromPC', 'getPokemonStatus', 'getPokemonStatusFromPC', 'getPokemonTotalExperience', 'getPokemonTotalExperienceFromPC',
  'getPokemonType', 'getPokemonTypeFromPC', 'getPokemonUniqueId', 'getPokemonUniqueIdFromPC', 'getRemainingPowerPoints', 'getServer',
  'getTeamSize', 'getTextOption', 'getTime', 'getUsablePokemonCount', 'giveItemToPokemon', 'hasItem',
  'hasItemId', 'hasMove', 'hasPokemonInTeam', 'hasShopItem', 'isAccountMember', 'isAlreadyCaught',
  'isAutoEvolve', 'isCurrentPCBoxRefreshed', 'isGameScriptActive', 'isInArea', 'isMorning', 'isMounted',
  'isNight', 'isNoon', 'isNpcInteractionsEnabled', 'isNpcOnCell', 'isNpcVisible', 'isOpponentEffortValue',
  'isOpponentShiny', 'isOutside', 'isPCOpen', 'isPartyInspectionEnabled', 'isPokemonFromPCShiny', 'isPokemonShiny',
  'isPokemonUsable', 'isPrivateMessageEnabled', 'isRelearningMoves', 'isShopOpen', 'isSurfing', 'isTeamRangeSortedByLevelAscending',
  'isTeamRangeSortedByLevelDescending', 'isTeamSortedByLevelAscending', 'isTeamSortedByLevelDescending', 'isWildBattle', 'log', 'logToFile',
  'logout', 'moveNearExit', 'moveToCell', 'moveToGrass', 'moveToListCell', 'moveToMap',
  'moveToNormalGround', 'moveToRectangle', 'moveToWater', 'notify', 'openPCBox', 'playSound',
  'pushDialogAnswer', 'readLinesFromFile', 'refreshPCBox', 'registerHook', 'relearnMove', 'releasePokemonFromPC',
  'releasePokemonFromTeam', 'relog', 'removeOption', 'removeTextOption', 'restart', 'run',
  'sendAnyPokemon', 'sendNotification', 'sendNotificationTo', 'sendNotificationWith', 'sendNotificationWithTo', 'sendPokemon',
  'sendUsablePokemon', 'setAfk', 'setAfkTimeout', 'setBattleTimeout', 'setDialogTimeout', 'setFishingTimeout',
  'setItemUseTimeout', 'setLoadingMapTimeout', 'setLoadingTimeout', 'setMount', 'setMountingTimeout', 'setMoveRelearnerTimeout',
  'setMovementTimeout', 'setNotifyVar', 'setNpcBattleTimeout', 'setOption', 'setOptionDescription', 'setOptionName',
  'setRefreshingPCBoxTimeout', 'setSwapTimeout', 'setTeleportationTimeout', 'setTextOption', 'setTextOptionDescription', 'setTextOptionName',
  'setWaterMount', 'sortTeamByLevelAscending', 'sortTeamByLevelDescending', 'sortTeamRangeByLevelAscending', 'sortTeamRangeByLevelDescending', 'stringContains',
  'swapPokemon', 'swapPokemonFromPC', 'swapPokemonWithLeader', 'swapPokemonWithinPC', 'takeItemFromPokemon', 'talkToNpc',
  'talkToNpcOnCell', 'tradeAcceptMoney', 'tradeGiveMoney', 'useAnyMove', 'useItem', 'useItemOnPokemon',
  'useMove', 'usePC', 'usePokecenter', 'useSurf', 'weakAttack', 'withdrawPokemonFromPC',
  'writeToFile',
]);

/** Callbacks the host invokes on the script. @type {readonly string[]} */
export const HOST_CALLBACKS = Object.freeze([
  'name', 'author', 'description', 'onStart', 'onStop', 'onPause',
  'onResume', 'onPathAction', 'onBattleAction', 'onDialogMessage', 'onBattleMessage', 'onSystemMessage',
  'onWarningMessage', 'onLearningMove',
]);

/** Globals that exist but abort the script when called. */
export const RETIRED_FUNCTIONS = Object.freeze({ moveToMap: 'moveToCell' });

const HOST_SET = new Set([...HOST_FUNCTIONS, ...HOST_CALLBACKS]);

/**
 * Names a spec loaded at runtime documents that this list does not know about.
 *
 * The checked-in list mirrors a build of the host, so it goes stale the moment
 * the host gains a function. Loading a newer `openapi.yaml` widens the list for
 * the session rather than reporting every new function as a typo.
 *
 * @type {Set<string>}
 */
const EXTRA_HOST_FUNCTIONS = new Set();

/**
 * @param {readonly string[]} names
 */
export function registerExtraHostFunctions(names) {
  EXTRA_HOST_FUNCTIONS.clear();
  for (const name of names ?? []) {
    if (typeof name === 'string' && name && !HOST_SET.has(name)) EXTRA_HOST_FUNCTIONS.add(name);
  }
}

/** @param {string} identifier @returns {boolean} */
export function isHostFunction(identifier) {
  return HOST_SET.has(identifier) || EXTRA_HOST_FUNCTIONS.has(identifier);
}
