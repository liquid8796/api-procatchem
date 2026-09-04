/**
 * Read `openapi.yaml` and turn it into the catalog the builder validates
 * against.
 *
 * The build script writes this out as `api-catalog.js` so the page loads
 * instantly with no parsing; the same function runs in the browser when someone
 * hands the builder a newer spec than the one it shipped with. One reader, so
 * the two can never disagree about what the spec says.
 */

import { parseYaml } from '../core/yaml-lite.js';

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
 * @typedef {object} Catalog
 * @property {string} version
 * @property {string[]} groups
 * @property {CatalogEntry[]} entries
 *
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
