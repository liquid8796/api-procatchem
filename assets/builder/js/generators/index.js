/**
 * Public entry point for script generation.
 *
 * `generateScript` is a pure function of (config, linkGraph): it plans the
 * route, lets the selected mode contribute its battle policy, assembles the
 * file, and verifies that every function the output calls actually exists in
 * the host API. The UI layer only ever calls this.
 */

import { LuaWriter } from '../core/lua-writer.js';
import { isHostFunction, RETIRED_FUNCTIONS } from '../domain/host-api.js';
import { emitOtherPolicy, emitTrainerPolicy, emitTrappedEscape } from './battle.js';
import { requireMode } from './mode-registry.js';
import { planRoute } from './route-plan.js';
import {
  analyseNeeds,
  emitBreaks,
  emitMountHelper,
  emitOnBattleMessage,
  emitOnPause,
  emitOnPathAction,
  emitOnStart,
  emitPreamble,
  emitRoute,
  emitState,
  emitTeamHelpers,
  emitTeamReady,
  section,
} from './runtime.js';

const CONFIG_BLOCK_OPEN = '--[==[PROBUILDER';
const CONFIG_BLOCK_CLOSE = ']==]';

/**
 * Lua identifiers the generated code defines itself, so the verifier does not
 * mistake them for missing host functions.
 */
const LOCAL_DEFINITIONS = new Set([
  'ppLeft', 'slotWithMove', 'useMoveFromAnySlot', 'opponentStatused', 'pickMount',
  'walk', 'scheduleNextBreak', 'onBreak', 'teamIsReady', 'isTarget', 'tryCatch',
  'knockOut', 'yieldsWantedEv',
]);

/** Lua standard-library entry points the host sandbox exposes. */
const STDLIB = new Set([
  'ipairs', 'pairs', 'tostring', 'tonumber', 'type', 'select', 'next',
  'os.time', 'math.random', 'math.randomseed', 'string.format', 'table.insert',
]);

/** Keywords that can precede `(` without being a call. */
const NOT_CALLS = new Set([
  'if', 'elseif', 'while', 'return', 'and', 'or', 'not', 'then', 'do', 'end',
  'for', 'in', 'local', 'function', 'true', 'false', 'nil', 'repeat', 'until', 'else',
]);

/**
 * @typedef {object} GenerationResult
 * @property {string} lua        the script body, without the config header
 * @property {string} document   header + body: what the user downloads
 * @property {import('./route-plan.js').RoutePlan} plan
 * @property {string[]} hostCalls    host functions the script calls, sorted
 * @property {string[]} unknownCalls identifiers that resolve to nothing (should be empty)
 * @property {string[]} retiredCalls retired host functions the script calls (should be empty)
 * @property {import('./mode-registry.js').FarmMode} mode
 */

/**
 * @param {object} config
 * @param {import('../domain/link-graph.js').LinkGraph} linkGraph
 * @returns {GenerationResult}
 */
export function generateScript(config, linkGraph) {
  const mode = requireMode(config.mode);
  const plan = planRoute(config, linkGraph);
  const needs = analyseNeeds(config, plan, mode.traits);
  const context = { config, plan, needs, mode };

  const writer = new LuaWriter();
  emitPreamble(writer, context);
  emitState(writer, context);
  emitTeamHelpers(writer, context);
  emitMountHelper(writer, context);
  emitRoute(writer, context);
  emitBreaks(writer, context);
  emitTeamReady(writer, context);

  section(writer, 'Battle plan');
  mode.emitHelpers(writer, context);

  emitOnStart(writer, context);
  emitOnPathAction(writer, context);
  emitOnBattleAction(writer, context);
  emitOnBattleMessage(writer, context);
  emitOnPause(writer, context);

  const lua = writer.toString();
  const document = `${renderConfigHeader(config)}${lua}`;
  const verification = verify(lua, writer.hostCalls());

  return { lua, document, plan, mode, ...verification };
}

/**
 * `onBattleAction` — trainer policy, then the mode's engagement, then the
 * fallback for encounters the mode did not want.
 *
 * @param {LuaWriter} writer
 * @param {import('./runtime.js').EmitContext & { mode: import('./mode-registry.js').FarmMode }} context
 */
function emitOnBattleAction(writer, context) {
  const { config, mode } = context;
  writer.fn('onBattleAction()', (w) => {
    w.useHost('isWildBattle');
    w.comment('Trainer battles never reach the wild logic below.');
    w.block('if not isWildBattle() then', (inner) => {
      emitTrainerPolicy(inner, config);
    });
    w.blank();

    mode.emitEngagement(w, context);

    if (!mode.traits.engagesEveryEncounter) {
      w.blank();
      w.comment('Not what we are here for.');
      emitTrappedEscape(w, config);
      emitOtherPolicy(w, config);
    }
  });
  writer.blank();
}

/**
 * Embed the configuration as a Lua long comment so a generated file can be
 * dropped back into the builder later. `--[==[ … ]==]` is a valid Lua comment,
 * so the host parses the file exactly as it would without it.
 *
 * @param {object} config
 * @returns {string}
 */
export function renderConfigHeader(config) {
  const json = JSON.stringify(config, null, 1);
  // Guard against a config value that would close the comment early.
  const safe = json.replace(/]==]/g, ']==\\u005d');
  return `${CONFIG_BLOCK_OPEN}\n${safe}\n${CONFIG_BLOCK_CLOSE}\n`;
}

/**
 * Recover the configuration embedded in a previously generated file.
 *
 * @param {string} document
 * @returns {object | null} null when the file has no readable header
 */
export function parseConfigHeader(document) {
  const text = String(document ?? '');
  if (!text.startsWith(CONFIG_BLOCK_OPEN)) return null;
  const end = text.indexOf(CONFIG_BLOCK_CLOSE);
  if (end < 0) return null;
  const json = text.slice(CONFIG_BLOCK_OPEN.length, end).replace(/]==\\u005d/g, ']==]');
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Prove that every call in the emitted script resolves.
 *
 * This is the same check that would otherwise only surface at runtime, when the
 * host aborts the script with "function 'x' does not exist".
 *
 * @param {string} lua
 * @param {string[]} declaredCalls names the emitters recorded
 * @returns {{ hostCalls: string[], unknownCalls: string[], retiredCalls: string[] }}
 */
function verify(lua, declaredCalls) {
  const source = stripCommentsAndStrings(lua);
  const called = new Set(declaredCalls);

  // Belt and braces: also scan the emitted text for `identifier(`.
  for (const match of source.matchAll(/([A-Za-z_][A-Za-z0-9_.]*)\s*\(/g)) {
    const name = match[1];
    if (!NOT_CALLS.has(name)) called.add(name);
  }

  /** @type {string[]} */
  const unknown = [];
  /** @type {string[]} */
  const retired = [];
  for (const name of called) {
    if (Object.hasOwn(RETIRED_FUNCTIONS, name)) {
      retired.push(name);
      continue;
    }
    if (LOCAL_DEFINITIONS.has(name) || STDLIB.has(name) || isHostFunction(name)) continue;
    unknown.push(name);
  }

  return {
    hostCalls: [...called].filter(isHostFunction).sort(),
    unknownCalls: unknown.sort(),
    retiredCalls: retired.sort(),
  };
}

/**
 * Blank out comments and string literals so the call scanner cannot be fooled
 * by prose or by a Pokémon name that happens to look like a call.
 *
 * @param {string} lua
 * @returns {string}
 */
function stripCommentsAndStrings(lua) {
  return lua
    .replace(/--\[(=*)\[[\s\S]*?\]\1\]/g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");
}
