/**
 * The API the builder is currently checking against.
 *
 * `api-catalog.js` is generated at build time and is what the page starts with.
 * But the host gains functions faster than this tool gets rebuilt, so the
 * builder will also read a newer `openapi.yaml` handed to it at runtime: the
 * function browser, the completion lists, the "call an API function" step and
 * the verification pass all read through here, so one load updates all of them.
 *
 * The swap lasts for the session. Nothing is written to disk, and reloading the
 * page brings back the catalog the tool shipped with.
 */

import { API_ENTRIES, API_GROUPS, API_VERSION } from './api-catalog.js';
import { registerExtraHostFunctions } from './host-api.js';
import { buildCatalog } from './spec-catalog.js';

/**
 * @typedef {import('./api-catalog.js').ApiEntry} ApiEntry
 *
 * @typedef {object} Catalog
 * @property {string} version
 * @property {readonly string[]} groups
 * @property {readonly ApiEntry[]} entries
 *
 * @typedef {object} CatalogDiff
 * @property {string} version
 * @property {string[]} added    functions the loaded spec has and the built-in one does not
 * @property {string[]} removed  functions the built-in catalog has and the loaded one does not
 * @property {string[]} changed  functions whose signature moved
 */

/** What the tool was built with; always available to go back to. */
const BUILT_IN = Object.freeze({
  version: API_VERSION,
  groups: API_GROUPS,
  entries: API_ENTRIES,
});

/** @type {Catalog} */
let active = BUILT_IN;
/** @type {Map<string, ApiEntry>} */
let byName = new Map(BUILT_IN.entries.map((entry) => [entry.name, entry]));
/** @type {Set<() => void>} */
const listeners = new Set();

/** @returns {readonly ApiEntry[]} every documented function, sorted by name */
export function apiEntries() {
  return active.entries;
}

/** @returns {readonly string[]} tag names, in reference order */
export function apiGroups() {
  return active.groups;
}

/** @returns {string} the spec version in force */
export function apiVersion() {
  return active.version;
}

/** @returns {boolean} true while a spec loaded at runtime is in force */
export function isCustomCatalog() {
  return active !== BUILT_IN;
}

/**
 * @param {string} name
 * @returns {ApiEntry | null}
 */
export function apiEntry(name) {
  return byName.get(name) ?? null;
}

/**
 * Read an `openapi.yaml` and make it the API in force.
 *
 * @param {string} specText
 * @returns {CatalogDiff} what changed against the catalog the tool shipped with
 * @throws {Error} when the text is not a spec this reader understands
 */
export function loadSpec(specText) {
  const catalog = buildCatalog(String(specText ?? ''));
  if (!catalog.entries.length) throw new Error('That spec documents no functions.');
  return install(catalog);
}

/**
 * Go back to the catalog generated at build time.
 *
 * @returns {CatalogDiff} an empty diff, for a caller that reports either way
 */
export function resetCatalog() {
  return install(BUILT_IN);
}

/**
 * @param {Catalog} catalog
 * @returns {CatalogDiff}
 */
function install(catalog) {
  active = catalog;
  byName = new Map(catalog.entries.map((entry) => [entry.name, entry]));
  // The verification pass rejects anything the host does not register, so a new
  // spec has to widen that list or every new function it documents would be
  // reported as unknown the moment somebody used it. Going back to the built-in
  // catalog narrows it again — including back to nothing, which is what it was
  // before anything was loaded.
  registerExtraHostFunctions(
    catalog === BUILT_IN ? [] : catalog.entries.map((entry) => entry.name),
  );
  for (const listener of listeners) listener();
  return diffAgainstBuiltIn(catalog);
}

/**
 * @param {Catalog} catalog
 * @returns {CatalogDiff}
 */
function diffAgainstBuiltIn(catalog) {
  const before = new Map(BUILT_IN.entries.map((entry) => [entry.name, entry]));
  const after = new Map(catalog.entries.map((entry) => [entry.name, entry]));

  const added = [...after.keys()].filter((name) => !before.has(name)).sort();
  const removed = [...before.keys()].filter((name) => !after.has(name)).sort();
  const changed = [...after.keys()]
    .filter((name) => before.has(name) && before.get(name).signature !== after.get(name).signature)
    .sort();

  return { version: catalog.version, added, removed, changed };
}

/**
 * Run `fn` whenever the API in force changes. There is no unsubscribe: the
 * handful of subscribers all live as long as the page.
 *
 * @param {() => void} fn
 */
export function onCatalogChange(fn) {
  listeners.add(fn);
}
