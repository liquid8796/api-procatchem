/**
 * Checking hand-written calls against the API.
 *
 * Anywhere the builder lets you type Lua yourself — the "call an API function"
 * condition and step, a raw expression, an imported script — the text can name
 * a function that does not exist or pass the wrong number of arguments. The
 * host reports that by aborting the script at runtime; these helpers turn it
 * into a diagnostic in the page instead.
 *
 * Argument *values* are only checked where it is safe to: a literal that is
 * obviously the wrong type is reported, anything that is an expression is left
 * alone, because its type is not knowable without running the script.
 */

import { t } from '../core/i18n.js';
import { API_ENTRIES, apiEntry } from './api-catalog.js';
import { HOST_FUNCTIONS, isHostFunction, RETIRED_FUNCTIONS } from './host-api.js';

/** Longest name distance still worth offering as "did you mean". */
const SUGGESTION_MAX_DISTANCE = 3;
/** Names shorter than this produce too many nonsense suggestions. */
const SUGGESTION_MIN_LENGTH = 4;

/**
 * @typedef {object} CallProblem
 * @property {'error' | 'warning'} level
 * @property {string} message
 */

/**
 * Split a Lua argument list on its top-level commas.
 *
 * Commas inside strings, brackets, braces or nested calls belong to an
 * argument, not between two of them.
 *
 * @param {string} text the text between the parentheses
 * @returns {string[]} trimmed arguments; empty for an empty list
 */
export function splitArguments(text) {
  const source = String(text ?? '');
  /** @type {string[]} */
  const parts = [];
  let current = '';
  let depth = 0;
  /** @type {string | null} */
  let quote = null;
  let escaped = false;

  for (const char of source) {
    if (quote) {
      current += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === '(' || char === '[' || char === '{') depth += 1;
    if (char === ')' || char === ']' || char === '}') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current.trim());

  const trimmed = parts.map((part) => part.trim());
  return trimmed.length === 1 && trimmed[0] === '' ? [] : trimmed;
}

/**
 * What an argument literally is, as far as can be told without running it.
 *
 * @param {string} text
 * @returns {'string' | 'number' | 'boolean' | 'nil' | 'table' | 'unknown'}
 */
export function argumentKind(text) {
  const value = String(text ?? '').trim();
  if (/^".*"$/s.test(value) || /^'.*'$/s.test(value)) return 'string';
  if (/^-?\d+(\.\d+)?$/.test(value)) return 'number';
  if (value === 'true' || value === 'false') return 'boolean';
  if (value === 'nil') return 'nil';
  if (value.startsWith('{')) return 'table';
  return 'unknown';
}

/**
 * True when a fragment of Lua looks like prose someone forgot to quote.
 *
 * `useItem(Ultra Ball)` is not a type error the checker can see — it is a
 * syntax error the host would reject on load — so it is worth naming
 * explicitly. Anything with brackets or operators is assumed to be a real
 * expression and left alone.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function looksLikeUnquotedText(text) {
  const value = String(text ?? '').trim();
  if (!value || argumentKind(value) !== 'unknown') return false;
  if (/[()[\]{}+\-*/%^#<>=~]/.test(value)) return false;
  // A single bare word could legitimately be a variable; two words in a row
  // cannot be anything but a string that lost its quotes.
  return /\s/.test(value);
}

/**
 * True when a fragment is a bare identifier — legal Lua, but in a builder field
 * it is nearly always a string whose quotes were forgotten.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function looksLikeBareWord(text) {
  const value = String(text ?? '').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) return false;
  return !['true', 'false', 'nil'].includes(value);
}

/** Catalog types a literal of each kind satisfies. */
const ACCEPTS = {
  string: new Set(['string', 'any']),
  number: new Set(['number', 'integer', 'any']),
  boolean: new Set(['boolean', 'any']),
  table: new Set(['object', 'array', 'any']),
  // `nil` is how an optional argument is skipped, so it is never a type error.
  nil: null,
  unknown: null,
};

/**
 * Check one call.
 *
 * @param {string} name
 * @param {string} argsText the text between the parentheses
 * @param {{ localFunctions?: Set<string> }} [options] names the script defines
 *   for itself, which are legal to call even though the host does not know them
 * @returns {CallProblem[]} empty when the call is fine
 */
export function validateCall(name, argsText, options = {}) {
  const identifier = String(name ?? '').trim();
  const nameProblem = resolveName(identifier, options.localFunctions);
  if (nameProblem) return [nameProblem];

  const entry = apiEntry(identifier);
  // No entry and no problem means a local or an undocumented host global; there
  // is no signature to check the arguments against.
  return entry ? checkArguments(entry, splitArguments(argsText)) : [];
}

/**
 * Check that a name resolves to something callable.
 *
 * Separate from {@link validateCall} because scanning a whole file can only
 * check names — its argument text has been blanked out along with the strings.
 *
 * @param {string} identifier
 * @param {Set<string>} [localFunctions]
 * @returns {CallProblem | null} null when the name is fine
 */
export function resolveName(identifier, localFunctions) {
  if (!identifier) return { level: 'error', message: t('No function name given.') };

  if (Object.hasOwn(RETIRED_FUNCTIONS, identifier)) {
    return {
      level: 'error',
      message: t('{name}() is retired — the host aborts any script that calls it. Use {replacement}() instead.', {
        name: identifier, replacement: RETIRED_FUNCTIONS[identifier],
      }),
    };
  }
  if (localFunctions?.has(identifier)) return null;
  if (apiEntry(identifier)) return null;
  if (isHostFunction(identifier)) {
    return {
      level: 'warning',
      message: t('{name}() exists but is not documented, so its arguments cannot be checked.', {
        name: identifier,
      }),
    };
  }

  const suggestion = suggestName(identifier);
  return {
    level: 'error',
    message: suggestion
      ? t('There is no API function called {name}() — did you mean {suggestion}()?', {
        name: identifier, suggestion,
      })
      : t('There is no API function called {name}().', { name: identifier }),
  };
}

/**
 * @param {import('./api-catalog.js').ApiEntry} entry
 * @param {string[]} args
 * @returns {CallProblem[]}
 */
function checkArguments(entry, args) {
  /** @type {CallProblem[]} */
  const problems = [];
  const required = entry.params.filter((param) => param.required).length;
  // A table parameter is how the spec models a variadic list, so a call may
  // legitimately pass more than one value for it.
  const variadic = entry.params.some((param) => param.type === 'array');

  if (args.length < required) {
    problems.push({
      level: 'error',
      message: t('{name}() needs {arity}, but {count} {were} given. Signature: {signature}', {
        name: entry.name,
        arity: describeArity(required, entry.params.length),
        count: args.length,
        were: args.length === 1 ? t('was') : t('were'),
        signature: entry.signature,
      }),
    });
  } else if (args.length > entry.params.length && !variadic) {
    problems.push({
      level: 'error',
      message: t('{name}() takes {arity}, but {count} were given. Signature: {signature}', {
        name: entry.name,
        arity: describeArity(required, entry.params.length),
        count: args.length,
        signature: entry.signature,
      }),
    });
  }

  entry.params.forEach((param, index) => {
    const arg = args[index];
    if (arg === undefined) return;
    if (looksLikeUnquotedText(arg)) {
      problems.push({
        level: 'error',
        message: t('{name}(): argument {n} ({param}) is not valid Lua. Text has to be quoted: "{value}".', {
          name: entry.name, n: index + 1, param: param.name, value: arg,
        }),
      });
      return;
    }
    const kind = argumentKind(arg);
    const accepted = ACCEPTS[kind];
    if (!accepted || accepted.has(param.type)) return;
    problems.push({
      level: 'error',
      message: t('{name}(): argument {n} ({param}) should be a {expected}, but {value} is a {actual}.', {
        name: entry.name, n: index + 1, param: param.name, expected: param.type, value: arg, actual: kind,
      }),
    });
  });

  return problems;
}

/**
 * @param {number} required
 * @param {number} total
 * @returns {string}
 */
function describeArity(required, total) {
  if (required === total) {
    return total === 1 ? t('1 argument') : t('{count} arguments', { count: total });
  }
  return t('{min}–{max} arguments', { min: required, max: total });
}

/**
 * The documented function whose name is closest to `name`.
 *
 * @param {string} name
 * @returns {string | null} null when nothing is close enough to be useful
 */
export function suggestName(name) {
  const needle = String(name ?? '');
  if (needle.length < SUGGESTION_MIN_LENGTH) return null;

  const lower = needle.toLowerCase();
  let best = null;
  let bestDistance = SUGGESTION_MAX_DISTANCE + 1;

  for (const candidate of knownNames()) {
    // A pure case difference is the most common typo and always worth offering.
    if (candidate.toLowerCase() === lower) return candidate;
    const distance = editDistance(needle, candidate, bestDistance);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return bestDistance <= SUGGESTION_MAX_DISTANCE ? best : null;
}

/**
 * Every callable name, documented ones first so a tie in edit distance offers
 * the one the builder can show a signature for.
 *
 * @type {readonly string[]}
 */
const KNOWN_NAMES = Object.freeze([
  ...new Set([...API_ENTRIES.map((entry) => entry.name), ...HOST_FUNCTIONS]),
]);

/** @returns {readonly string[]} */
function knownNames() {
  return KNOWN_NAMES;
}

/**
 * Levenshtein distance, abandoned early once it cannot beat `limit`.
 *
 * @param {string} a
 * @param {string} b
 * @param {number} limit
 * @returns {number} the distance, or `limit` when it is at least that far
 */
function editDistance(a, b, limit) {
  if (Math.abs(a.length - b.length) >= limit) return limit;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowBest = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (current[j] < rowBest) rowBest = current[j];
    }
    if (rowBest >= limit) return limit;
    previous = current;
  }
  return previous[b.length];
}

/** Matches `identifier(` in Lua source, so a whole file can be scanned. */
const CALL_PATTERN = /([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;

/** Keywords that can sit in front of `(` without being a call. */
const NOT_CALLS = new Set([
  'if', 'elseif', 'while', 'return', 'and', 'or', 'not', 'then', 'do', 'end',
  'for', 'in', 'local', 'function', 'true', 'false', 'nil', 'repeat', 'until', 'else',
]);

/**
 * Lua standard-library names the host sandbox exposes, plus the globals a
 * generated script assigns rather than calls.
 */
const STDLIB = new Set([
  'ipairs', 'pairs', 'tostring', 'tonumber', 'type', 'select', 'next', 'unpack',
  'pcall', 'error', 'assert', 'require', 'setmetatable', 'getmetatable', 'rawget', 'rawset',
]);

/**
 * Scan a whole Lua file for calls that will not resolve.
 *
 * Used on scripts opened from disk that the builder did not write, so an author
 * can find a typo without waiting for the host to abort.
 *
 * @param {string} source
 * @returns {CallProblem[]}
 */
export function scanLuaCalls(source) {
  const text = stripCommentsAndStrings(String(source ?? ''));
  const defined = collectDefinitions(text);
  /** @type {Map<string, CallProblem>} */
  const problems = new Map();

  for (const match of text.matchAll(CALL_PATTERN)) {
    const name = match[1];
    if (NOT_CALLS.has(name) || STDLIB.has(name) || defined.has(name)) continue;
    if (problems.has(name)) continue;
    // Argument text was blanked out along with the strings, so only the name
    // can be checked here.
    const problem = resolveName(name, defined);
    if (problem && problem.level === 'error') problems.set(name, problem);
  }
  return [...problems.values()];
}

/** Matches every function and local this script defines for itself. */
const DEFINITION_PATTERNS = [
  /function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g,
  /local\s+function\s+([A-Za-z_][A-Za-z0-9_]*)/g,
  /local\s+([A-Za-z_][A-Za-z0-9_]*)\s*=/g,
];

/**
 * @param {string} text source with comments and strings already removed
 * @returns {Set<string>}
 */
function collectDefinitions(text) {
  /** @type {Set<string>} */
  const names = new Set();
  for (const pattern of DEFINITION_PATTERNS) {
    for (const match of text.matchAll(pattern)) names.add(match[1]);
  }
  return names;
}

/**
 * Blank out comments and string literals so the scanner cannot be fooled by
 * prose or by a Pokémon name that happens to look like a call.
 *
 * @param {string} lua
 * @returns {string}
 */
function stripCommentsAndStrings(lua) {
  return lua
    .replace(/--\[(=*)\[[\s\S]*?\]\1\]/g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\[(=*)\[[\s\S]*?\]\1\]/g, '""')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");
}
