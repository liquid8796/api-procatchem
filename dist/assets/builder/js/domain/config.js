/**
 * The builder's configuration document: its default shape, the option lists the
 * UI renders from, and the normalisation applied to anything loaded from disk.
 *
 * Every panel reads and writes this one document, so adding a feature means
 * adding a field here plus the generator code that consumes it.
 */

import { emptyGroup, normaliseCondition } from './condition.js';

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

/** How the script gets healed once the team runs dry. */
export const HEAL_ACTIONS = Object.freeze([
  { id: 'usePokecenter', label: 'Use the Pokécenter', args: 'none' },
  { id: 'talkToNpcOnCell', label: 'Talk to a nurse on a cell', args: 'cell' },
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
  { id: 'ev', label: 'Until an EV target', hint: 'Rotates a slot out once its EV is capped' },
  { id: 'uid', label: 'Through a unique-id list', hint: 'Exactly the Pokémon you name' },
]);

/** What a battle step does when its guard passes. */
export const STEP_ACTIONS = Object.freeze([
  { id: 'useMove', label: 'Use a move', needs: ['move', 'slot'] },
  { id: 'useItem', label: 'Use an item', needs: ['item'] },
  { id: 'throwBalls', label: 'Throw balls in order', needs: ['balls'] },
  { id: 'sendPokemon', label: 'Switch to a slot', needs: ['slotNumber'] },
  { id: 'attack', label: 'Attack', needs: [] },
  { id: 'weakAttack', label: 'Weak attack', needs: [] },
  { id: 'run', label: 'Run away', needs: [] },
  { id: 'sendUsablePokemon', label: 'Send a usable Pokémon', needs: [] },
  { id: 'sendAnyPokemon', label: 'Send any Pokémon', needs: [] },
  { id: 'rawLua', label: 'Raw Lua statement', needs: ['expr'] },
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
    ...overrides,
  };
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
      surfFix: true,
      // Group 1 — several rectangles to work, and when to move between them.
      zones: [],
      zoneRotation: { mode: 'fixed', min: 30, max: 60 },
      // Group 4 — extra legs between the Pokécenter and the hunting map, and a
      // different hunting map per time of day.
      stops: [],
      timeOfDay: { enabled: false, morningMap: '', noonMap: '', nightMap: '' },
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
    },
    battle: {
      onTrainer: 'fight',
      onOther: 'run',
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
      rotation: { mode: 'off', stat: 'ATK', target: 252, slots: 2, ids: [] },
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
  merged.mounts.land = toStringList(merged.mounts.land);
  merged.mounts.water = toStringList(merged.mounts.water);
  merged.battle.status.moves = toStringList(merged.battle.status.moves);
  merged.battle.helperMoves = toHelperMoveList(merged.battle.helperMoves);
  merged.battle.balls = toBallList(merged.battle.balls, base.battle.balls);

  merged.route.zones = toStringList(merged.route.zones);
  merged.route.stops = toStopList(merged.route.stops);
  merged.team.rotation.ids = toStringList(merged.team.rotation.ids);
  merged.team.keepMoves = toStringList(merged.team.keepMoves);
  merged.team.customGuard = normaliseCondition(merged.team.customGuard) ?? emptyGroup('and');
  merged.rules = toRuleList(merged.rules, base.rules);

  merged.target.levelMin = toNullableInt(merged.target.levelMin);
  merged.target.levelMax = toNullableInt(merged.target.levelMax);
  merged.team.healBelowUsable = toNullableInt(merged.team.healBelowUsable);
  merged.safety.afkTimeout = toNullableInt(merged.safety.afkTimeout);

  return merged;
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

/**
 * @param {unknown} value
 * @returns {object[]}
 */
function toStepList(value) {
  if (!Array.isArray(value)) return [];
  const actions = new Set(STEP_ACTIONS.map((entry) => entry.id));
  return value
    .filter(isPlainObject)
    .map((step) => ({
      id: typeof step.id === 'string' && step.id ? step.id : newEntityId('step'),
      when: normaliseCondition(step.when) ?? emptyGroup('and'),
      once: Boolean(step.once),
      action: actions.has(step.action) ? step.action : 'attack',
      move: String(step.move ?? '').trim(),
      slot: step.slot === 'auto' ? 'auto' : (toNullableInt(step.slot) ?? 'auto'),
      slotNumber: toNullableInt(step.slotNumber) ?? 1,
      item: String(step.item ?? '').trim(),
      balls: toStringList(step.balls),
      expr: String(step.expr ?? '').trim(),
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
