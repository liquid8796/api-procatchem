/**
 * The builder's configuration document: its default shape, the option lists the
 * UI renders from, and the normalisation applied to anything loaded from disk.
 *
 * Every panel reads and writes this one document, so adding a feature means
 * adding a field here plus the generator code that consumes it.
 */

import { emptyGroup, normaliseCondition, normaliseGender } from './condition.js';

/** Farm actions that need no arguments. */
export const FARM_ACTIONS = Object.freeze([
  { id: 'moveToGrass', label: 'Walk in grass', hint: 'Standard wild encounters', args: 'none' },
  { id: 'moveToWater', label: 'Surf on water', hint: 'Requires a water mount', args: 'none' },
  { id: 'moveToNormalGround', label: 'Walk on plain ground', hint: 'Caves and interiors', args: 'none' },
  { id: 'moveToCell', label: 'Stand on a cell', hint: 'A fixed spot', args: 'cell' },
  { id: 'fish', label: 'Fish from a cell', hint: 'Walk to the tile, then cast the rod', args: 'fish' },
  { id: 'useItem', label: 'Use an item', hint: 'Repel, or a rod where you already stand', args: 'item' },
]);

/** Farm actions that need a rod as well as a cell. */
export const FISHING_ACTION = 'fish';

/**
 * Time-of-day periods, with the host predicate that selects each.
 *
 * `night` is tested before `noon` because the generated selector returns on the
 * first match, and the two are the ones players most often set together.
 */
export const TIME_PERIODS = Object.freeze([
  { id: 'morning', label: 'Morning', host: 'isMorning' },
  { id: 'night', label: 'Night', host: 'isNight' },
  { id: 'noon', label: 'Noon', host: 'isNoon' },
]);

/**
 * The field names one period uses inside `route.timeOfDay`.
 *
 * A period may redefine as much or as little of the route as it likes: where to
 * hunt, how, which Pokécenter it belongs to, which patches to work, and what to
 * do when farming stops. Everything left blank falls back to the main setting,
 * so the common case — one spot, one style, one Pokécenter — still costs one
 * field per period.
 *
 * @param {string} period
 * @returns {{ map: string, action: string, args: string, rod: string,
 *             pokecenter: string, healAction: string, healArgs: string,
 *             zones: string, endBehaviour: string }}
 */
export function periodFields(period) {
  return {
    map: `${period}Map`,
    action: `${period}Action`,
    args: `${period}Args`,
    rod: `${period}Rod`,
    pokecenter: `${period}Pokecenter`,
    healAction: `${period}HealAction`,
    healArgs: `${period}HealArgs`,
    zones: `${period}Zones`,
    endBehaviour: `${period}EndBehaviour`,
  };
}

/** How the script gets healed once the team runs dry. */
export const HEAL_ACTIONS = Object.freeze([
  { id: 'usePokecenter', label: 'Use the Pokécenter', args: 'none' },
  { id: 'talkToNpcOnCell', label: 'Talk to a nurse on a cell', args: 'cell' },
]);

/**
 * What happens when the keep-farming condition stops holding.
 *
 * The Pokécenter loop is the usual answer, but a run that cannot be resumed
 * unattended — an EV session with a fixed target, a rented account — is better
 * off stopping cleanly than walking in circles.
 */
export const END_BEHAVIOURS = Object.freeze([
  { id: 'pcLoop', label: 'Walk back and heal', hint: 'The Pokécenter trip, then carry on' },
  { id: 'healNpc', label: 'Heal here, at an NPC', hint: 'No travel — a nurse on this map' },
  { id: 'stop', label: 'Stop the bot', hint: 'Logs a message and halts' },
  { id: 'logout', label: 'Log out', hint: 'Leaves the game running no longer' },
  { id: 'idle', label: 'Stand still', hint: 'Stays logged in and does nothing' },
]);

/** Stat keys accepted by the host's effort-value functions. */
export const EV_STATS = Object.freeze([
  { id: 'HP', label: 'HP' },
  { id: 'ATK', label: 'Attack' },
  { id: 'DEF', label: 'Defence' },
  { id: 'SPATK', label: 'Sp. Attack' },
  { id: 'SPDEF', label: 'Sp. Defence' },
  { id: 'SPD', label: 'Speed' },
]);

export const WEAKEN_MODES = Object.freeze([
  { id: 'off', label: 'Do not weaken', hint: 'Throw balls at full HP' },
  { id: 'falseSwipe', label: 'False Swipe to 1 HP', hint: 'Safest — never faints the target' },
  { id: 'percent', label: 'Attack down to a HP %', hint: 'Faster, small faint risk' },
]);

export const OTHER_POLICIES = Object.freeze([
  { id: 'run', label: 'Run away', hint: 'Fastest reset' },
  { id: 'fight', label: 'Knock it out', hint: 'Earns EXP but costs PP' },
  { id: 'weakAttack', label: 'Weak attack only', hint: 'Spares your strongest move' },
  { id: 'conditional', label: 'Fight only if…', hint: 'Your own condition decides; the rest are fled' },
]);

/**
 * What a matched wild encounter is for.
 *
 * Catching is the usual answer, but the same filter is just as useful for
 * "level on exactly these" or for stopping the session the moment something
 * rare turns up so a human can take over.
 */
export const TARGET_ACTIONS = Object.freeze([
  { id: 'catch', label: 'Catch it', hint: 'Weaken, status, then the ball ladder' },
  { id: 'fight', label: 'Knock it out', hint: 'For experience, money, or EVs' },
  { id: 'run', label: 'Run from it', hint: 'A filter that says what to avoid' },
  { id: 'stop', label: 'Stop the bot', hint: 'Logs the encounter and halts so you can take over' },
]);

export const TRAINER_POLICIES = Object.freeze([
  { id: 'fight', label: 'Fight the trainer', hint: 'Most trainer battles cannot be fled' },
  { id: 'run', label: 'Try to run first', hint: 'Falls back to fighting when fleeing fails' },
]);

export const TRAPPED_POLICIES = Object.freeze([
  { id: '', label: 'Keep playing', hint: 'Just stop trying to switch' },
  { id: 'run', label: 'Run from the battle', hint: 'Breaks free of the trap' },
  { id: 'relog', label: 'Relog', hint: 'Heavy-handed but always works' },
]);

export const BALL_CONDITIONS = Object.freeze([
  { id: 'always', label: 'Any turn' },
  { id: 'turn1', label: 'First turn only' },
  { id: 'status', label: 'Only once statused' },
  { id: 'lowHp', label: 'Only below the HP threshold' },
]);

/** How the script picks which farm zone to work next. */
export const ZONE_ROTATION_MODES = Object.freeze([
  { id: 'fixed', label: 'Every N minutes', hint: 'A steady timer' },
  { id: 'random', label: 'Every N–M minutes', hint: 'A fresh interval each time' },
  { id: 'chaotic', label: 'Fully random', hint: 'Anywhere from a minute to the maximum' },
  { id: 'onHeal', label: 'After every heal', hint: 'No clock — rerolls on the Pokécenter trip' },
  { id: 'onWin', label: 'After every won battle', hint: 'Rerolls when a battle is won' },
]);

/**
 * What happens the moment the clock moves a run onto a different period.
 *
 * Going by way of the Pokécenter costs a walk but starts the new stretch with a
 * full team, which is what you want when each period is anchored somewhere
 * else. Heading straight out is faster and fine when the two spots share a
 * Pokécenter.
 */
export const SWITCH_MODES = Object.freeze([
  { id: 'center', label: 'Heal at the new Pokécenter first', hint: 'Arrive at the next spot with a fresh team' },
  { id: 'direct', label: 'Go straight to the new spot', hint: 'No detour; keeps whatever the team has left' },
]);

/** Per-stop mount handling on a multi-leg route. */
export const STOP_MOUNT_MODES = Object.freeze([
  { id: 'auto', label: 'Leave it alone', hint: 'Whatever the game is already doing' },
  { id: 'force', label: 'Force a mount here', hint: 'Emits an explicit mount call' },
  { id: 'off', label: 'Dismount here', hint: 'Caves and mount-banned maps' },
]);

/**
 * Terrain a stop must be on before the route continues.
 *
 * Both settings are convergent — once satisfied the script moves on — which is
 * why a stop adjusts state rather than running an arbitrary action: an action
 * has no completion signal and would loop forever.
 */
export const STOP_TERRAINS = Object.freeze([
  { id: 'any', label: 'Whatever it is', hint: 'No terrain change' },
  { id: 'water', label: 'Get on the water', hint: 'Surf across before continuing' },
  { id: 'land', label: 'Get back on land', hint: 'Leave the water before continuing' },
]);

/** How the team rotation picks the next lead. */
export const ROTATION_MODES = Object.freeze([
  { id: 'off', label: 'No rotation', hint: 'Keep the team as it is' },
  { id: 'weakest', label: 'Lowest level first', hint: 'Levels the whole team evenly' },
  { id: 'highest', label: 'Highest level first', hint: 'Fastest knock-outs, for money runs' },
  { id: 'ev', label: 'Until an EV target', hint: 'Rotates a slot out once its EV is capped' },
  { id: 'uid', label: 'Through a unique-id list', hint: 'Exactly the Pokémon you name' },
  { id: 'uidEv', label: 'A list, each with its own EV goal', hint: 'Trains several spreads in one run' },
]);

/** What a battle step does when its guard passes. */
export const STEP_ACTIONS = Object.freeze([
  { id: 'useMove', label: 'Use a move', needs: ['move', 'slot'] },
  { id: 'useItem', label: 'Use an item', needs: ['item'] },
  { id: 'throwBalls', label: 'Throw balls in order', needs: ['balls'] },
  { id: 'sendPokemon', label: 'Switch to a slot', needs: ['slotNumber'] },
  { id: 'sendStrongest', label: 'Send the strongest Pokémon', needs: [] },
  { id: 'attack', label: 'Attack', needs: [] },
  { id: 'weakAttack', label: 'Weak attack', needs: [] },
  { id: 'run', label: 'Run away', needs: [] },
  { id: 'sendUsablePokemon', label: 'Send a usable Pokémon', needs: [] },
  { id: 'sendAnyPokemon', label: 'Send any Pokémon', needs: [] },
  { id: 'chain', label: 'Try each of these in turn', needs: ['chain'] },
  { id: 'group', label: 'Group of steps under one condition', needs: [] },
  { id: 'apiCall', label: 'Call an API function', needs: ['fn', 'args'] },
  { id: 'stopBot', label: 'Stop the bot', needs: ['message'] },
  { id: 'logout', label: 'Log out of the game', needs: ['message'] },
  { id: 'rawLua', label: 'Raw Lua statement', needs: ['expr'] },
]);

/** Step actions that hold other steps rather than acting themselves. */
export const GROUP_ACTION = 'group';

/**
 * Links available inside a "try each of these in turn" chain.
 *
 * Every one returns a boolean, because the chain is emitted as
 * `a() or b() or c()` — a void call such as `logout()` would evaluate to nil,
 * silently fall through, and make the rest of the chain run as well. Those get
 * their own step actions instead.
 */
export const CHAIN_ACTIONS = Object.freeze([
  { id: 'attack', label: 'attack()', needs: 'none' },
  { id: 'weakAttack', label: 'weakAttack()', needs: 'none' },
  { id: 'run', label: 'run()', needs: 'none' },
  { id: 'useAnyMove', label: 'useAnyMove()', needs: 'none' },
  { id: 'sendUsablePokemon', label: 'sendUsablePokemon()', needs: 'none' },
  { id: 'sendAnyPokemon', label: 'sendAnyPokemon()', needs: 'none' },
  { id: 'useMove', label: 'useMove(move)', needs: 'text', placeholder: 'Spore' },
  { id: 'useItem', label: 'useItem(item)', needs: 'text', placeholder: 'Ultra Ball' },
  { id: 'sendPokemon', label: 'sendPokemon(slot)', needs: 'number', placeholder: '5' },
  { id: 'rawLua', label: 'a Lua expression', needs: 'text', placeholder: 'myHelper()' },
]);

/** What a rule does when every one of its steps declined to act. */
export const RULE_FALLBACKS = Object.freeze([
  { id: 'attack', label: 'Attack', hint: 'Keep the battle moving' },
  { id: 'run', label: 'Run away', hint: 'Abandon the encounter' },
  { id: 'nothing', label: 'Do nothing', hint: 'Stops the bot — use to avoid losing a target' },
]);

/**
 * When a preparation move is worth using.
 *
 * These cover the moves players reach for before a catch attempt: Soak to strip
 * a Ghost type so False Swipe connects, Skill Swap or Thief against particular
 * Pokémon, and anything gated on the ability your lead is currently showing —
 * which is how a Trace lead reveals the opponent's ability, since the host has
 * no `getOpponentAbility`.
 */
export const HELPER_TRIGGERS = Object.freeze([
  { id: 'always', label: 'Every battle', needs: [] },
  { id: 'oppType', label: 'Opponent has type', needs: ['type'] },
  { id: 'oppName', label: 'Opponent is named', needs: ['names'] },
  { id: 'myAbility', label: 'My slot shows ability', needs: ['slot', 'ability'] },
]);

/** Preparation moves offered as one-click presets. */
export const HELPER_PRESETS = Object.freeze([
  { move: 'Soak', trigger: 'oppType', type: 'Ghost', hint: 'Strips Ghost so False Swipe connects' },
  { move: 'Skill Swap', trigger: 'oppName', hint: 'Swap away a troublesome ability' },
  { move: 'Thief', trigger: 'oppName', hint: 'Take the held item before catching' },
]);

/** Sensible starting ladder: cheapest ball last so it is the fallback. */
const DEFAULT_BALLS = Object.freeze([
  { item: 'Quick Ball', condition: 'turn1' },
  { item: 'Ultra Ball', condition: 'always' },
  { item: 'Great Ball', condition: 'always' },
  { item: 'Pokeball', condition: 'always' },
]);

/** Monotonic ids so the editor can key rows without relying on their index. */
let nextEntityId = 0;

/**
 * A unique id for a rule or step. Only used by the editor; it round-trips
 * through the saved config so reopening a preset keeps row identity stable.
 *
 * @param {string} prefix
 * @returns {string}
 */
export function newEntityId(prefix) {
  nextEntityId += 1;
  return `${prefix}-${nextEntityId}`;
}

/**
 * A blank battle step.
 *
 * @param {Partial<object>} [overrides]
 * @returns {object}
 */
export function createStep(overrides = {}) {
  return {
    id: newEntityId('step'),
    when: emptyGroup('and'),
    once: false,
    action: 'useMove',
    move: '',
    slot: 'auto',
    slotNumber: 1,
    item: '',
    balls: [],
    expr: '',
    // Only the matching action reads these, but keeping them present means
    // switching action back and forth never loses what was typed.
    chain: [],
    steps: [],
    fn: '',
    args: '',
    message: '',
    ...overrides,
  };
}

/**
 * A blank link for a "try each of these in turn" chain.
 *
 * @param {Partial<object>} [overrides]
 * @returns {{ action: string, value: string }}
 */
export function createChainLink(overrides = {}) {
  return { action: 'attack', value: '', ...overrides };
}

/**
 * The starter rule: catch a shiny by chipping it to 1 HP, then throwing balls.
 * It doubles as a worked example of what the editor can express.
 *
 * @returns {object}
 */
export function createDefaultRule() {
  return {
    id: newEntityId('rule'),
    label: 'Shiny',
    match: { op: 'or', negate: false, items: [{ kind: 'shiny', params: {}, negate: false }] },
    fallback: 'nothing',
    steps: [
      createStep({
        action: 'useMove',
        move: 'False Swipe',
        when: {
          op: 'and',
          negate: false,
          items: [{ kind: 'oppHp', params: { cmp: '>', value: 1 }, negate: false }],
        },
      }),
      createStep({
        action: 'useMove',
        move: 'Spore',
        when: {
          op: 'and',
          negate: false,
          items: [{ kind: 'oppStatus', params: { status: '' }, negate: false }],
        },
      }),
      createStep({
        action: 'throwBalls',
        balls: ['Ultra Ball', 'Great Ball', 'Pokeball'],
        when: emptyGroup('and'),
      }),
    ],
  };
}

/**
 * A blank rule for the "add rule" button.
 *
 * @returns {object}
 */
export function createEmptyRule() {
  return {
    id: newEntityId('rule'),
    label: 'New rule',
    match: emptyGroup('or'),
    fallback: 'attack',
    steps: [createStep()],
  };
}

export const CONFIG_VERSION = 1;

/**
 * @returns {object} a fresh, fully-populated configuration document
 */
export function createDefaultConfig() {
  return {
    version: CONFIG_VERSION,
    meta: {
      name: 'My Hunt Script',
      author: '',
      description: 'Generated by the PROCatchem Script Builder',
      fileName: 'my_hunt_script.lua',
    },
    mode: 'hunt',
    route: {
      kind: 'here',
      farmMap: '',
      farmAction: 'moveToGrass',
      farmArgs: '',
      // Fishing needs both a tile to stand on and a rod to cast; one text field
      // could only ever hold one of them.
      farmRod: 'Super Rod',
      pokecenterMap: '',
      healAction: 'usePokecenter',
      healArgs: '',
      // What happens when teamIsReady() stops holding.
      endBehaviour: 'pcLoop',
      endHealCell: '',
      endHealMoney: null,
      endMessage: '',
      surfFix: true,
      // Hunt on whatever map the bot is standing on, even in route mode. The
      // walk to the Pokécenter still happens; only the "am I in the right
      // place" check is dropped.
      huntAnywhere: false,
      // When the clock moves the run onto another period's spot.
      switchVia: 'center',
      // Let the return tables cover every map the graph knows, so a bot that
      // wakes up off-route walks home instead of standing still.
      recoverWhenLost: true,
      // Group 1 — several rectangles to work, and when to move between them.
      zones: [],
      zoneRotation: { mode: 'fixed', min: 30, max: 60 },
      // Group 4 — extra legs between the Pokécenter and the hunting map, and a
      // different hunting map per time of day.
      stops: [],
      // A period may change the hunting map, the way encounters are found, or
      // both. A blank action means "whatever the main setting says", so the
      // common case — one spot, one style — stays a single field.
      timeOfDay: {
        enabled: false,
        morningMap: '', morningAction: '', morningArgs: '', morningRod: '',
        morningPokecenter: '', morningHealAction: '', morningHealArgs: '',
        morningZones: [], morningEndBehaviour: '',
        noonMap: '', noonAction: '', noonArgs: '', noonRod: '',
        noonPokecenter: '', noonHealAction: '', noonHealArgs: '',
        noonZones: [], noonEndBehaviour: '',
        nightMap: '', nightAction: '', nightArgs: '', nightRod: '',
        nightPokecenter: '', nightHealAction: '', nightHealArgs: '',
        nightZones: [], nightEndBehaviour: '',
      },
    },
    mounts: {
      land: [],
      water: [],
      applyOnStart: true,
      dismountOnFarm: false,
    },
    target: {
      names: [],
      shiny: true,
      notCaught: false,
      levelMin: null,
      levelMax: null,
      gender: '',
      requireAll: false,
      // An alternate form — the Christmas hats, the regional variants — reads
      // as a non-zero form id.
      form: false,
      // Neither of these has a getter. The game announces them, so the script
      // latches what it hears: abilities need a Trace lead, held items a Frisk
      // one. See the "announced" condition kinds.
      abilities: [],
      heldItems: [],
      // Blank means the yield is not part of the filter.
      evYield: '',
      // What a match is for.
      onMatch: 'catch',
    },
    battle: {
      onTrainer: 'fight',
      onOther: 'run',
      // Only read when onOther is 'conditional'.
      otherGuard: emptyGroup('and'),
      weaken: { mode: 'falseSwipe', move: 'False Swipe', percent: 30 },
      status: { moves: ['Spore'], requireBeforeBall: false },
      // Preparation moves used at most once per battle, before weakening.
      helperMoves: [],
      balls: DEFAULT_BALLS.map((ball) => ({ ...ball })),
      lowHpPercent: 20,
    },
    team: {
      healBelowUsable: 2,
      healOnPPOut: true,
      // A non-empty tree replaces the two simple conditions above.
      customGuard: emptyGroup('and'),
      // Group 2 — rotation and lead management.
      rotation: { mode: 'off', stat: 'ATK', target: 252, ids: [], goals: [] },
      leadAbility: '',
      secondAbility: '',
      useStrongest: false,
      leadItem: '',
      keepMoves: [],
    },
    ev: {
      stat: 'SPD',
    },
    // Group 3 — the rules engine, used by the "Custom rules" farm mode.
    rules: [createDefaultRule()],
    safety: {
      breaks: { enabled: false, everyMin: 10, everyMax: 30, lengthMin: 30, lengthMax: 180 },
      afkTimeout: null,
      onTrapped: 'run',
      relogDelay: 30,
    },
    logging: {
      counters: true,
      announceShiny: true,
    },
  };
}

/**
 * Merge a loaded document onto the defaults so an older or hand-edited config
 * never leaves a field undefined for the generators.
 *
 * @param {unknown} loaded
 * @returns {object}
 */
export function normaliseConfig(loaded) {
  const base = createDefaultConfig();
  if (!loaded || typeof loaded !== 'object') return base;

  const merged = deepMerge(base, loaded);
  merged.version = CONFIG_VERSION;

  // Fields the UI treats as lists must survive a scalar or null in the file.
  merged.target.names = toStringList(merged.target.names);
  merged.target.abilities = toStringList(merged.target.abilities);
  merged.target.heldItems = toStringList(merged.target.heldItems);
  merged.target.onMatch = TARGET_ACTIONS.some((entry) => entry.id === merged.target.onMatch)
    ? merged.target.onMatch
    : 'catch';
  merged.target.evYield = EV_STATS.some((entry) => entry.id === merged.target.evYield)
    ? merged.target.evYield
    : '';
  merged.mounts.land = toStringList(merged.mounts.land);
  merged.mounts.water = toStringList(merged.mounts.water);
  merged.battle.status.moves = toStringList(merged.battle.status.moves);
  merged.battle.helperMoves = toHelperMoveList(merged.battle.helperMoves);
  merged.battle.balls = toBallList(merged.battle.balls, base.battle.balls);
  merged.battle.otherGuard = normaliseCondition(merged.battle.otherGuard) ?? emptyGroup('and');

  merged.route.zones = toStringList(merged.route.zones);
  merged.route.stops = toStopList(merged.route.stops);
  merged.route.switchVia = SWITCH_MODES.some((entry) => entry.id === merged.route.switchVia)
    ? merged.route.switchVia
    : 'center';
  merged.route.endBehaviour = END_BEHAVIOURS.some((entry) => entry.id === merged.route.endBehaviour)
    ? merged.route.endBehaviour
    : 'pcLoop';
  normalisePeriods(merged.route.timeOfDay);
  merged.route.endHealMoney = toNullableInt(merged.route.endHealMoney);
  merged.team.rotation.ids = toStringList(merged.team.rotation.ids);
  merged.team.rotation.goals = toEvGoalList(merged.team.rotation.goals);
  merged.team.keepMoves = toStringList(merged.team.keepMoves);
  merged.team.customGuard = normaliseCondition(merged.team.customGuard) ?? emptyGroup('and');
  merged.rules = toRuleList(merged.rules, base.rules);

  merged.target.levelMin = toNullableInt(merged.target.levelMin);
  merged.target.levelMax = toNullableInt(merged.target.levelMax);
  // Drafts saved before the "M" / "F" fix still hold "Male" / "Female", which
  // the host never returns; migrate rather than silently filtering nothing.
  merged.target.gender = normaliseGender(merged.target.gender);
  merged.team.healBelowUsable = toNullableInt(merged.team.healBelowUsable);
  merged.safety.afkTimeout = toNullableInt(merged.safety.afkTimeout);

  return merged;
}

/**
 * Tidy the per-period overrides in place.
 *
 * A period's zone list has to survive the same scalar-or-null a hand-edited
 * file may hold, and an end behaviour it does not recognise is safer read as
 * "same as the main setting" than as a behaviour nobody asked for.
 *
 * @param {object} timeOfDay
 */
function normalisePeriods(timeOfDay) {
  for (const period of TIME_PERIODS) {
    const fields = periodFields(period.id);
    timeOfDay[fields.zones] = toStringList(timeOfDay[fields.zones]);
    const end = timeOfDay[fields.endBehaviour];
    timeOfDay[fields.endBehaviour] = END_BEHAVIOURS.some((entry) => entry.id === end) ? end : '';
    const heal = timeOfDay[fields.healAction];
    timeOfDay[fields.healAction] = HEAL_ACTIONS.some((entry) => entry.id === heal) ? heal : '';
  }
}

/**
 * Recursively merge plain objects; arrays and scalars from `source` win outright.
 *
 * @param {object} target
 * @param {object} source
 * @returns {object}
 */
function deepMerge(target, source) {
  const out = Array.isArray(target) ? target.slice() : { ...target };
  for (const [key, value] of Object.entries(source ?? {})) {
    if (!(key in out)) continue; // Ignore unknown keys rather than trusting the file.
    const current = out[key];
    out[key] = isPlainObject(current) && isPlainObject(value)
      ? deepMerge(current, value)
      : value;
  }
  return out;
}

/** @param {unknown} value @returns {boolean} */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Coerce a value that may be a list, a delimited string, or nothing into a
 * clean array of trimmed entries.
 *
 * @param {unknown} value
 * @returns {string[]}
 */
export function toStringList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }
  return splitList(value);
}

/**
 * Split a comma/semicolon/newline separated string into trimmed entries.
 *
 * @param {unknown} text
 * @returns {string[]}
 */
export function splitList(text) {
  return String(text ?? '')
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * @param {unknown} value
 * @param {Array<{item: string, condition: string}>} fallback
 * @returns {Array<{item: string, condition: string}>}
 */
function toBallList(value, fallback) {
  if (!Array.isArray(value)) return fallback.map((ball) => ({ ...ball }));
  const valid = new Set(BALL_CONDITIONS.map((entry) => entry.id));
  return value
    .map((entry) => {
      if (typeof entry === 'string') return { item: entry.trim(), condition: 'always' };
      if (!isPlainObject(entry)) return null;
      const item = String(entry.item ?? '').trim();
      const condition = valid.has(entry.condition) ? entry.condition : 'always';
      return item ? { item, condition } : null;
    })
    .filter(Boolean);
}

/**
 * @param {unknown} value
 * @returns {Array<{map: string, mount: string, terrain: string}>}
 */
function toStopList(value) {
  if (!Array.isArray(value)) return [];
  const mounts = new Set(STOP_MOUNT_MODES.map((entry) => entry.id));
  const terrains = new Set(STOP_TERRAINS.map((entry) => entry.id));
  return value
    .map((entry) => {
      if (!isPlainObject(entry)) return null;
      const map = String(entry.map ?? '').trim();
      if (!map) return null;
      return {
        map,
        mount: mounts.has(entry.mount) ? entry.mount : 'auto',
        terrain: terrains.has(entry.terrain) ? entry.terrain : 'any',
      };
    })
    .filter(Boolean);
}

/**
 * Rebuild the rules list, dropping anything malformed rather than letting a
 * hand-edited preset reach the generator.
 *
 * @param {unknown} value
 * @param {object[]} fallback
 * @returns {object[]}
 */
function toRuleList(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  const fallbacks = new Set(RULE_FALLBACKS.map((entry) => entry.id));
  return value
    .filter(isPlainObject)
    .map((rule) => ({
      id: typeof rule.id === 'string' && rule.id ? rule.id : newEntityId('rule'),
      label: String(rule.label ?? 'Rule').trim() || 'Rule',
      match: normaliseCondition(rule.match) ?? emptyGroup('or'),
      fallback: fallbacks.has(rule.fallback) ? rule.fallback : 'attack',
      steps: toStepList(rule.steps),
    }));
}

/** Guards against a hand-edited config nesting groups deeply enough to matter. */
const MAX_STEP_DEPTH = 6;

/**
 * @param {unknown} value
 * @param {number} [depth]
 * @returns {object[]}
 */
function toStepList(value, depth = 0) {
  if (!Array.isArray(value)) return [];
  const actions = new Set(STEP_ACTIONS.map((entry) => entry.id));
  return value
    .filter(isPlainObject)
    .map((step) => {
      const action = actions.has(step.action) ? step.action : 'attack';
      // A group at the depth limit has nowhere to put its children, so it is
      // flattened to a plain action rather than silently dropping them.
      const nested = action === GROUP_ACTION && depth < MAX_STEP_DEPTH
        ? toStepList(step.steps, depth + 1)
        : [];
      return {
        id: typeof step.id === 'string' && step.id ? step.id : newEntityId('step'),
        when: normaliseCondition(step.when) ?? emptyGroup('and'),
        once: Boolean(step.once),
        action: action === GROUP_ACTION && !nested.length && depth >= MAX_STEP_DEPTH ? 'attack' : action,
        move: String(step.move ?? '').trim(),
        slot: step.slot === 'auto' ? 'auto' : (toNullableInt(step.slot) ?? 'auto'),
        slotNumber: toNullableInt(step.slotNumber) ?? 1,
        item: String(step.item ?? '').trim(),
        balls: toStringList(step.balls),
        expr: String(step.expr ?? '').trim(),
        chain: toChainList(step.chain),
        steps: nested,
        fn: String(step.fn ?? '').trim(),
        args: String(step.args ?? '').trim(),
        message: String(step.message ?? '').trim(),
      };
    });
}

/** The default EV target when a goal row does not name one. */
const FULL_EV = 252;

/**
 * @param {unknown} value
 * @returns {Array<{ id: string, stat: string, target: number }>}
 */
function toEvGoalList(value) {
  if (!Array.isArray(value)) return [];
  const stats = new Set(EV_STATS.map((entry) => entry.id));
  // A row whose id has not been filled in yet is kept, not dropped: it is the
  // shape of the table the player is still working on. The generator ignores
  // it and the lint asks for the missing id.
  return value
    .filter(isPlainObject)
    .map((goal) => {
      const stat = String(goal.stat ?? '').toUpperCase();
      return {
        id: String(goal.id ?? '').trim(),
        stat: stats.has(stat) ? stat : 'ATK',
        target: clampEv(goal.target),
      };
    });
}

/**
 * @param {unknown} value
 * @returns {number} a target between 1 and a maxed-out stat
 */
function clampEv(value) {
  const parsed = toNullableInt(value);
  if (parsed === null) return FULL_EV;
  return Math.min(FULL_EV, Math.max(1, parsed));
}

/**
 * A blank per-Pokémon EV goal for the "add" button.
 *
 * @param {Partial<object>} [overrides]
 * @returns {{ id: string, stat: string, target: number }}
 */
export function createEvGoal(overrides = {}) {
  return { id: '', stat: 'ATK', target: FULL_EV, ...overrides };
}

/**
 * @param {unknown} value
 * @returns {Array<{ action: string, value: string }>}
 */
function toChainList(value) {
  if (!Array.isArray(value)) return [];
  const actions = new Set(CHAIN_ACTIONS.map((entry) => entry.id));
  return value
    .filter(isPlainObject)
    .map((link) => ({
      action: actions.has(link.action) ? link.action : 'attack',
      value: String(link.value ?? '').trim(),
    }));
}

/**
 * @param {unknown} value
 * @returns {Array<object>}
 */
function toHelperMoveList(value) {
  if (!Array.isArray(value)) return [];
  const triggers = new Set(HELPER_TRIGGERS.map((entry) => entry.id));
  return value
    .filter(isPlainObject)
    .map((entry) => ({
      move: String(entry.move ?? '').trim(),
      trigger: triggers.has(entry.trigger) ? entry.trigger : 'always',
      type: String(entry.type ?? '').trim(),
      names: toStringList(entry.names),
      slot: toNullableInt(entry.slot) ?? 1,
      ability: String(entry.ability ?? '').trim(),
    }))
    .filter((entry) => entry.move);
}

/**
 * A blank preparation move for the "add" button.
 *
 * @param {Partial<object>} [overrides]
 * @returns {object}
 */
export function createHelperMove(overrides = {}) {
  return { move: '', trigger: 'always', type: '', names: [], slot: 1, ability: '', ...overrides };
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
export function toNullableInt(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}
