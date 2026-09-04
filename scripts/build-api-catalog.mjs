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

import { buildCatalog } from '../assets/builder/js/domain/spec-catalog.js';

export { buildCatalog };

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_PATH = path.join(rootDir, 'openapi.yaml');
const OUTPUT_PATH = path.join(rootDir, 'assets/builder/js/domain/api-catalog.js');


/**
 * @param {import('../assets/builder/js/domain/spec-catalog.js').Catalog} catalog
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
