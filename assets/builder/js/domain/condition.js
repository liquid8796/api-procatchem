/**
 * Condition trees.
 *
 * A condition is either a **leaf** (one named check, e.g. "the opponent is
 * shiny") or a **group** that joins children with AND/OR. Either can be negated.
 * The same model drives the farm guard, per-rule matching, and per-step guards,
 * so there is one editor and one emitter for all of them.
 *
 * Leaf kinds live in {@link CONDITION_KINDS}, a registry: adding a new check
 * means adding one entry — the UI renders its parameters from the descriptor and
 * the emitter calls its `emit`.
 */

import { luaNumber, luaString } from '../core/lua-writer.js';

/**
 * @typedef {'and' | 'or'} GroupOperator
 *
 * @typedef {object} ConditionLeaf
 * @property {string} kind    an id from {@link CONDITION_KINDS}
 * @property {object} params
 * @property {boolean} [negate]
 *
 * @typedef {object} ConditionGroup
 * @property {GroupOperator} op
 * @property {boolean} [negate]
 * @property {ConditionNode[]} items
 *
 * @typedef {ConditionLeaf | ConditionGroup} ConditionNode
 */

/** Comparison operators offered wherever a number is compared. */
export const COMPARATORS = Object.freeze([
  { id: '>=', label: '≥' },
  { id: '>', label: '>' },
  { id: '==', label: '=' },
  { id: '~=', label: '≠' },
  { id: '<=', label: '≤' },
  { id: '<', label: '<' },
]);

const VALID_COMPARATORS = new Set(COMPARATORS.map((entry) => entry.id));

/** Host sentinel for "no status condition" — the host returns "", never "NONE". */
const NO_STATUS = '""';

/**
 * Status conditions the host can report, plus the "clean" sentinel.
 * `getOpponentStatus()` returns an empty string when nothing is applied.
 */
export const STATUS_VALUES = Object.freeze([
  { id: '', label: 'No status' },
  { id: 'SLEEP', label: 'Asleep' },
  { id: 'PARALYSIS', label: 'Paralysed' },
  { id: 'FREEZE', label: 'Frozen' },
  { id: 'BURN', label: 'Burned' },
  { id: 'POISON', label: 'Poisoned' },
]);

/**
 * Local helper functions a condition may depend on.
 * The emitter collects the ids it needs so the script only defines what it uses.
 *
 * @type {Record<string, { name: string, emit: (writer: import('../core/lua-writer.js').LuaWriter) => void }>}
 */
export const CONDITION_HELPERS = {
  opponentHasType: {
    name: 'opponentHasType',
    emit(writer) {
      writer.comment('getOpponentType() returns a list, so membership needs a scan.');
      writer.fn('opponentHasType(want)', (w) => {
        w.useHost('getOpponentType');
        w.line('local types = getOpponentType()');
        w.comment('nil only happens outside battle, where the host already aborts.');
        w.line('if not types then return false end');
        w.block('for _, entry in ipairs(types) do', (loop) => {
          loop.line('if entry == want then return true end');
        });
        w.line('return false');
      }, { local: true });
      writer.blank();
    },
  },
  teamPpLeft: {
    name: 'ppLeft',
    emit(writer) {
      writer.comment('Highest remaining PP for `move` across every usable team member.');
      writer.fn('ppLeft(move)', (w) => {
        w.useHosts(['getTeamSize', 'hasMove', 'isPokemonUsable', 'getRemainingPowerPoints']);
        w.line('local best = 0');
        w.block('for slot = 1, getTeamSize() do', (loop) => {
          loop.block('if hasMove(slot, move) and isPokemonUsable(slot) then', (inner) => {
            inner.line('local left = getRemainingPowerPoints(slot, move)');
            inner.line('if left > best then best = left end');
          });
        });
        w.line('return best');
      }, { local: true });
      writer.blank();
    },
  },
};

/**
 * @param {unknown} value
 * @returns {string} a comparison operator that is safe to emit
 */
function comparator(value) {
  return VALID_COMPARATORS.has(value) ? value : '>=';
}

/**
 * Leaf condition registry.
 *
 * `params` are field descriptors the tree editor renders. `emit` returns a Lua
 * boolean expression and may declare host calls on the writer.
 */
export const CONDITION_KINDS = Object.freeze({
  // ------------------------------------------------------------ battle state
  shiny: {
    group: 'Battle', label: 'Opponent is shiny', params: [],
    emit: (_p, w) => `${w.useHost('isOpponentShiny')}()`,
  },
  notCaught: {
    group: 'Battle', label: 'Not in the Pokédex yet', params: [],
    emit: (_p, w) => `(not ${w.useHost('isAlreadyCaught')}())`,
  },
  wildBattle: {
    group: 'Battle', label: 'Is a wild battle', params: [],
    emit: (_p, w) => `${w.useHost('isWildBattle')}()`,
  },
  oppName: {
    group: 'Battle',
    label: 'Opponent is named',
    params: [{ key: 'names', type: 'chips', label: 'Names', placeholder: 'Larvitar, Pikachu' }],
    emit: (p, w) => {
      const names = toList(p.names);
      if (!names.length) return 'false';
      const call = w.useHost('getOpponentName');
      return `(${names.map((n) => `${call}() == ${luaString(n)}`).join(' or ')})`;
    },
  },
  oppLevel: {
    group: 'Battle',
    label: 'Opponent level',
    params: [
      { key: 'cmp', type: 'comparator', label: 'is' },
      { key: 'value', type: 'number', label: 'level', min: 1, max: 100 },
    ],
    emit: (p, w) => `${w.useHost('getOpponentLevel')}() ${comparator(p.cmp)} ${luaNumber(p.value, 1)}`,
  },
  oppGender: {
    group: 'Battle',
    label: 'Opponent gender',
    params: [{
      key: 'gender',
      type: 'select',
      label: 'is',
      options: [{ id: 'Male', label: 'Male' }, { id: 'Female', label: 'Female' }],
    }],
    emit: (p, w) => `${w.useHost('getOpponentGender')}() == ${luaString(p.gender || 'Male')}`,
  },
  oppHp: {
    group: 'Battle',
    label: 'Opponent HP (absolute)',
    params: [
      { key: 'cmp', type: 'comparator', label: 'is' },
      { key: 'value', type: 'number', label: 'HP', min: 0 },
    ],
    emit: (p, w) => `${w.useHost('getOpponentHealth')}() ${comparator(p.cmp)} ${luaNumber(p.value, 1)}`,
  },
  oppHpPercent: {
    group: 'Battle',
    label: 'Opponent HP (%)',
    params: [
      { key: 'cmp', type: 'comparator', label: 'is' },
      { key: 'value', type: 'number', label: '%', min: 0, max: 100 },
    ],
    emit: (p, w) => `${w.useHost('getOpponentHealthPercent')}() ${comparator(p.cmp)} ${luaNumber(p.value, 30)}`,
  },
  oppStatus: {
    group: 'Battle',
    label: 'Opponent status',
    params: [{ key: 'status', type: 'select', label: 'is', options: STATUS_VALUES }],
    emit: (p, w) => {
      const call = `${w.useHost('getOpponentStatus')}()`;
      // The host reports "" for a clean opponent, never "NONE".
      return p.status ? `${call} == ${luaString(p.status)}` : `(${call} == nil or ${call} == ${NO_STATUS})`;
    },
  },
  oppHasStatus: {
    group: 'Battle',
    label: 'Opponent has any status',
    params: [],
    emit: (_p, w) => {
      const call = `${w.useHost('getOpponentStatus')}()`;
      return `(${call} ~= nil and ${call} ~= ${NO_STATUS})`;
    },
  },
  oppType: {
    group: 'Battle',
    label: 'Opponent has type',
    params: [{ key: 'type', type: 'text', label: 'Type', placeholder: 'Water' }],
    helpers: ['opponentHasType'],
    emit: (p) => `opponentHasType(${luaString(p.type || '')})`,
  },
  oppEvYield: {
    group: 'Battle',
    label: 'Opponent yields only this EV',
    params: [{ key: 'stat', type: 'evStat', label: 'Stat' }],
    emit: (p, w) => `${w.useHost('isOpponentEffortValue')}(${luaString(String(p.stat || 'SPD').toUpperCase())})`,
  },
  battleTurn: {
    group: 'Battle',
    label: 'Battle turn',
    params: [
      { key: 'cmp', type: 'comparator', label: 'is' },
      { key: 'value', type: 'number', label: 'turn', min: 0 },
    ],
    emit: (p, w) => `${w.useHost('getBattleTurn')}() ${comparator(p.cmp)} ${luaNumber(p.value, 1)}`,
  },

  // -------------------------------------------------------------------- team
  slotUsable: {
    group: 'Team',
    label: 'Slot is usable',
    params: [{ key: 'slot', type: 'number', label: 'Slot', min: 1, max: 6 }],
    emit: (p, w) => `${w.useHost('isPokemonUsable')}(${luaNumber(p.slot, 1)})`,
  },
  usableCount: {
    group: 'Team',
    label: 'Usable Pokémon count',
    params: [
      { key: 'cmp', type: 'comparator', label: 'is' },
      { key: 'value', type: 'number', label: 'count', min: 0, max: 6 },
    ],
    emit: (p, w) => `${w.useHost('getUsablePokemonCount')}() ${comparator(p.cmp)} ${luaNumber(p.value, 1)}`,
  },
  ppLeft: {
    group: 'Team',
    label: 'PP left for a move (whole team)',
    params: [
      { key: 'move', type: 'text', label: 'Move', placeholder: 'False Swipe' },
      { key: 'cmp', type: 'comparator', label: 'is' },
      { key: 'value', type: 'number', label: 'PP', min: 0 },
    ],
    helpers: ['teamPpLeft'],
    emit: (p) => `ppLeft(${luaString(p.move || '')}) ${comparator(p.cmp)} ${luaNumber(p.value, 1)}`,
  },
  slotHasMove: {
    group: 'Team',
    label: 'Slot knows a move',
    params: [
      { key: 'slot', type: 'number', label: 'Slot', min: 1, max: 6 },
      { key: 'move', type: 'text', label: 'Move', placeholder: 'Surf' },
    ],
    emit: (p, w) => `${w.useHost('hasMove')}(${luaNumber(p.slot, 1)}, ${luaString(p.move || '')})`,
  },
  hasItem: {
    group: 'Team',
    label: 'Bag contains an item',
    params: [{ key: 'item', type: 'text', label: 'Item', placeholder: 'Ultra Ball' }],
    emit: (p, w) => `${w.useHost('hasItem')}(${luaString(p.item || '')})`,
  },
  itemCount: {
    group: 'Team',
    label: 'Item quantity',
    params: [
      { key: 'item', type: 'text', label: 'Item', placeholder: 'Ultra Ball' },
      { key: 'cmp', type: 'comparator', label: 'is' },
      { key: 'value', type: 'number', label: 'count', min: 0 },
    ],
    emit: (p, w) => `${w.useHost('getItemQuantity')}(${luaString(p.item || '')}) ${comparator(p.cmp)} ${luaNumber(p.value, 1)}`,
  },

  // ------------------------------------------------------------------- world
  mapIs: {
    group: 'World',
    label: 'Current map is',
    params: [{ key: 'map', type: 'text', label: 'Map', placeholder: 'Viridian Forest' }],
    emit: (p, w) => `${w.useHost('getMapName')}() == ${luaString(p.map || '')}`,
  },
  isMorning: {
    group: 'World', label: 'It is morning', params: [],
    emit: (_p, w) => `${w.useHost('isMorning')}()`,
  },
  isNoon: {
    group: 'World', label: 'It is noon', params: [],
    emit: (_p, w) => `${w.useHost('isNoon')}()`,
  },
  isNight: {
    group: 'World', label: 'It is night', params: [],
    emit: (_p, w) => `${w.useHost('isNight')}()`,
  },
  isSurfing: {
    group: 'World', label: 'Currently surfing', params: [],
    emit: (_p, w) => `${w.useHost('isSurfing')}()`,
  },
  isMounted: {
    group: 'World', label: 'Currently mounted', params: [],
    emit: (_p, w) => `${w.useHost('isMounted')}()`,
  },
  isOutside: {
    group: 'World', label: 'Currently outside', params: [],
    emit: (_p, w) => `${w.useHost('isOutside')}()`,
  },

  // --------------------------------------------------------------- escape hatch
  rawLua: {
    group: 'Advanced',
    label: 'Raw Lua expression',
    params: [{
      key: 'expr',
      type: 'text',
      label: 'Expression',
      placeholder: 'getBattleTurn() == 1',
      hint: 'Emitted verbatim. Anything it calls is checked against the API.',
    }],
    emit: (p) => `(${String(p.expr ?? '').trim() || 'false'})`,
  },
});

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function toList(value) {
  if (Array.isArray(value)) return value.map((v) => String(v ?? '').trim()).filter(Boolean);
  return String(value ?? '').split(/[,;\n]/).map((v) => v.trim()).filter(Boolean);
}

/** @param {unknown} node @returns {node is ConditionGroup} */
export function isGroup(node) {
  return Boolean(node) && typeof node === 'object' && Array.isArray(node.items);
}

/**
 * A fresh, empty AND group.
 *
 * @param {GroupOperator} [op]
 * @returns {ConditionGroup}
 */
export function emptyGroup(op = 'and') {
  return { op, negate: false, items: [] };
}

/**
 * A fresh leaf of the given kind, with its parameters defaulted.
 *
 * @param {string} kind
 * @returns {ConditionLeaf}
 */
export function createLeaf(kind) {
  const spec = CONDITION_KINDS[kind];
  if (!spec) throw new Error(`Unknown condition kind: ${kind}`);
  /** @type {Record<string, unknown>} */
  const params = {};
  for (const param of spec.params) {
    if (param.type === 'chips') params[param.key] = [];
    else if (param.type === 'number') params[param.key] = param.min ?? 1;
    else if (param.type === 'comparator') params[param.key] = '>=';
    else if (param.type === 'select') params[param.key] = param.options?.[0]?.id ?? '';
    else if (param.type === 'evStat') params[param.key] = 'SPD';
    else params[param.key] = '';
  }
  return { kind, params, negate: false };
}

/**
 * Does this tree contain anything to evaluate?
 *
 * @param {ConditionNode | null | undefined} node
 * @returns {boolean}
 */
export function isEmptyCondition(node) {
  if (!node) return true;
  if (!isGroup(node)) return false;
  return node.items.every(isEmptyCondition);
}

/**
 * Collect the helper ids a tree needs, so only those get defined.
 *
 * @param {ConditionNode | null | undefined} node
 * @param {Set<string>} [into]
 * @returns {Set<string>}
 */
export function collectConditionHelpers(node, into = new Set()) {
  if (!node) return into;
  if (isGroup(node)) {
    for (const child of node.items) collectConditionHelpers(child, into);
    return into;
  }
  for (const helper of CONDITION_KINDS[node.kind]?.helpers ?? []) into.add(helper);
  return into;
}

/**
 * Render a condition tree as a Lua boolean expression.
 *
 * An empty tree is "always true", which is what an unset guard should mean.
 * Parentheses are added around every group so operator precedence can never
 * change the meaning the editor showed.
 *
 * @param {ConditionNode | null | undefined} node
 * @param {import('../core/lua-writer.js').LuaWriter} writer
 * @returns {string} a Lua expression, or `'true'` for an empty tree
 */
export function emitCondition(node, writer) {
  if (!node) return 'true';

  if (isGroup(node)) {
    const parts = node.items
      .map((child) => emitCondition(child, writer))
      .filter((part) => part !== 'true' || node.op === 'or');
    if (!parts.length) return 'true';

    const joined = parts.length === 1 ? parts[0] : `(${parts.join(` ${node.op} `)})`;
    return node.negate ? `(not ${joined})` : joined;
  }

  const spec = CONDITION_KINDS[node.kind];
  if (!spec) throw new Error(`Unknown condition kind: ${node.kind}`);
  const expression = spec.emit(node.params ?? {}, writer);
  return node.negate ? `(not (${expression}))` : expression;
}

/**
 * Normalise a tree loaded from a file, dropping anything unrecognised so a
 * hand-edited or older config cannot crash the generator.
 *
 * @param {unknown} node
 * @returns {ConditionNode | null}
 */
export function normaliseCondition(node) {
  if (!node || typeof node !== 'object') return null;

  if (Array.isArray(node.items)) {
    return {
      op: node.op === 'or' ? 'or' : 'and',
      negate: Boolean(node.negate),
      items: node.items.map(normaliseCondition).filter(Boolean),
    };
  }
  if (typeof node.kind !== 'string' || !CONDITION_KINDS[node.kind]) return null;
  return {
    kind: node.kind,
    params: node.params && typeof node.params === 'object' ? { ...node.params } : {},
    negate: Boolean(node.negate),
  };
}
