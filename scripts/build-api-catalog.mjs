/**
 * Generate `assets/builder/js/domain/api-catalog.js` from `openapi.yaml`.
 *
 * The Script Builder needs more than the list of names in `host-api.js`: to
 * offer a guided "call any API function" step it has to know each function's
 * parameters, their types, and what it returns. That information already exists
 * in the spec, so it is derived from it rather than typed a second time.
 *
 * Run it after editing openapi.yaml:
 *
 *     npm run build:catalog
 *
 * `tests/api-catalog.test.mjs` fails when the checked-in catalog drifts from
 * the spec, so a forgotten run cannot ship.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseYaml } from './lib/yaml-lite.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_PATH = path.join(rootDir, 'openapi.yaml');
const OUTPUT_PATH = path.join(rootDir, 'assets/builder/js/domain/api-catalog.js');

/** Tags whose operations perform an action rather than answer a question. */
const ACTION_GROUPS = new Set([
  'Workflow', 'Path actions', 'Dialog functions', 'Battle actions',
  'Move learning actions', 'Legacy special actions', 'Chat', 'Notifications',
  'File APIs', 'Bot configuration', 'Custom options',
]);

const CALLBACK_MARKER = '**Callback**';
const METADATA_GROUP = 'Script metadata';
const SCENARIO_HEADING = '**Practical scenario**';

/**
 * @typedef {object} CatalogEntry
 * @property {string} name
 * @property {string} group
 * @property {'callback' | 'field' | 'action' | 'query'} kind
 * @property {string} signature
 * @property {string} summary
 * @property {Array<{ name: string, type: string, required: boolean, description: string }>} params
 * @property {string} returns
 */

/**
 * Read the spec and turn every operation into a catalog entry.
 *
 * @param {string} specText
 * @returns {{ version: string, groups: string[], entries: CatalogEntry[] }}
 */
export function buildCatalog(specText) {
  const doc = parseYaml(specText);
  if (!doc || typeof doc !== 'object' || !doc.paths) {
    throw new Error('openapi.yaml has no paths section');
  }

  const groups = (doc.tags ?? []).map((tag) => tag.name);
  /** @type {CatalogEntry[]} */
  const entries = [];

  for (const item of Object.values(doc.paths)) {
    for (const operation of Object.values(item ?? {})) {
      if (!operation || typeof operation !== 'object' || !operation.operationId) continue;
      entries.push(toEntry(operation));
    }
  }

  const names = entries.map((entry) => entry.name);
  const duplicate = names.find((name, index) => names.indexOf(name) !== index);
  if (duplicate) throw new Error(`Duplicate operationId in the spec: ${duplicate}`);

  entries.sort((a, b) => a.name.localeCompare(b.name));
  return { version: String(doc.info?.version ?? '0'), groups, entries };
}

/**
 * @param {Record<string, unknown>} operation
 * @returns {CatalogEntry}
 */
function toEntry(operation) {
  const group = String(operation.tags?.[0] ?? 'Other');
  const description = String(operation.description ?? '');

  return {
    name: String(operation.operationId),
    group,
    kind: classify(group, description),
    signature: String(operation['x-lua-signature'] ?? `${operation.operationId}()`),
    summary: summarise(description),
    params: readParams(operation.requestBody),
    returns: readReturn(operation.responses),
  };
}

/**
 * @param {string} group
 * @param {string} description
 * @returns {'callback' | 'field' | 'action' | 'query'}
 */
function classify(group, description) {
  if (description.includes(CALLBACK_MARKER)) {
    return group === METADATA_GROUP ? 'field' : 'callback';
  }
  return ACTION_GROUPS.has(group) ? 'action' : 'query';
}

/**
 * The prose an author actually needs: everything before the worked example,
 * with the signature code fence removed.
 *
 * @param {string} description
 * @returns {string}
 */
function summarise(description) {
  const head = description.split(SCENARIO_HEADING)[0];
  return head
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\*\*(Lua global function|Callback)\*\*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {unknown} requestBody
 * @returns {Array<{ name: string, type: string, required: boolean, description: string }>}
 */
function readParams(requestBody) {
  const schema = requestBody?.content?.['application/json']?.schema;
  const properties = schema?.properties;
  if (!properties || typeof properties !== 'object') return [];

  const required = new Set(Array.isArray(schema.required) ? schema.required.map(String) : []);
  return Object.entries(properties).map(([name, spec]) => ({
    name,
    type: String(spec?.type ?? 'any'),
    required: required.has(name),
    description: String(spec?.description ?? '').replace(/\s+/g, ' ').trim(),
  }));
}

/**
 * @param {unknown} responses
 * @returns {string} the Lua return type, or `'void'` when nothing is returned
 */
function readReturn(responses) {
  const schema = responses?.['200']?.content?.['application/json']?.schema;
  if (!schema) return 'void';
  if (schema.type) return String(schema.type);
  // `oneOf` covers the LuaValue union, which the builder treats as "anything".
  return schema.oneOf ? 'any' : 'void';
}

/**
 * @param {{ version: string, groups: string[], entries: CatalogEntry[] }} catalog
 * @returns {string} the module source
 */
export function renderModule(catalog) {
  const entries = catalog.entries.map((entry) => `  ${JSON.stringify(entry)},`).join('\n');
  return `/**
 * The PROCatchem Lua API, derived from openapi.yaml.
 *
 * GENERATED FILE — do not edit by hand. Run \`npm run build:catalog\` after
 * changing the spec; \`tests/api-catalog.test.mjs\` fails if the two drift.
 *
 * \`host-api.js\` stays the authority on *which* globals exist (it mirrors the
 * host's own registration list). This module adds the shape of each one, which
 * is what lets the builder validate a hand-written call before it is emitted.
 */

/** Spec version this catalog was generated from. */
export const API_VERSION = ${JSON.stringify(catalog.version)};

/** Tag names, in the order the reference presents them. */
export const API_GROUPS = Object.freeze(${JSON.stringify(catalog.groups)});

/**
 * @typedef {object} ApiEntry
 * @property {string} name
 * @property {string} group
 * @property {'callback' | 'field' | 'action' | 'query'} kind
 * @property {string} signature
 * @property {string} summary
 * @property {Array<{ name: string, type: string, required: boolean, description: string }>} params
 * @property {string} returns
 */

/** @type {readonly ApiEntry[]} sorted by name */
export const API_ENTRIES = Object.freeze([
${entries}
]);

/** @type {Map<string, ApiEntry>} */
const BY_NAME = new Map(API_ENTRIES.map((entry) => [entry.name, entry]));

/**
 * @param {string} name
 * @returns {ApiEntry | null}
 */
export function apiEntry(name) {
  return BY_NAME.get(name) ?? null;
}
`;
}

/** Regenerate the checked-in catalog. */
async function main() {
  const catalog = buildCatalog(await fs.readFile(SPEC_PATH, 'utf8'));
  await fs.writeFile(OUTPUT_PATH, renderModule(catalog), 'utf8');
  console.log(
    `wrote ${path.relative(rootDir, OUTPUT_PATH)}: `
    + `${catalog.entries.length} functions, API ${catalog.version}`,
  );
}

// Importing this module must not rewrite the catalog: the staleness test
// depends on comparing the file on disk against a freshly built one.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
