/**
 * Shared `<datalist>` elements.
 *
 * Several controls offer the same completion list, and a datalist per control
 * would put the same options into the DOM once for every one of them. Each list
 * is created on first use and reused by id, so there is only ever one copy.
 *
 * A datalist suggests without restricting: the API function box still accepts a
 * name the catalog has not heard of, and the held-item box still accepts an
 * item that is not on the short list of the usual suspects.
 */

import { apiEntries, onCatalogChange } from '../domain/api-registry.js';
import { h } from './dom.js';

/** The id controls point their `list` attribute at for API function names. */
export const API_DATALIST_ID = 'api-function-names';

/** The id for held items worth putting on a lead. */
export const HELD_ITEM_DATALIST_ID = 'lead-held-items';

/**
 * Items that change what a run produces rather than how a battle goes — the
 * ones worth handing to whoever is in front.
 */
const HELD_ITEMS = Object.freeze([
  { value: 'Everstone', label: 'Blocks evolution' },
  { value: 'Exp. Share', label: 'Shares experience with the team' },
  { value: 'Macho Brace', label: 'Doubles effort values, halves speed' },
  { value: 'Soothe Bell', label: 'Friendship grows faster' },
  { value: 'Amulet Coin', label: 'Doubles prize money' },
  { value: 'Lucky Egg', label: 'More experience per battle' },
  { value: 'Leftovers', label: 'Heals a little every turn' },
]);

/**
 * Ensure a list exists, and return its id.
 *
 * @param {string} id
 * @param {() => Array<{ value: string, label?: string }>} build called only on first use
 * @returns {string}
 */
export function sharedDatalist(id, build) {
  if (!document.getElementById(id)) {
    document.body.appendChild(h('datalist', { id }, build().map(
      (entry) => h('option', { value: entry.value, label: entry.label }),
    )));
  }
  return id;
}

/**
 * Drop a list so the next caller rebuilds it.
 *
 * @param {string} id
 */
function invalidate(id) {
  document.getElementById(id)?.remove();
}

// The API list is built from whichever catalog is in force. Loading a newer
// spec has to reach it too, or the completion box goes on offering a function
// that spec no longer documents.
let watchingCatalog = false;

/** @returns {string} the id of the API function list */
export function apiDatalistId() {
  if (!watchingCatalog) {
    watchingCatalog = true;
    onCatalogChange(() => invalidate(API_DATALIST_ID));
  }
  return sharedDatalist(API_DATALIST_ID, () => apiEntries().map(
    (entry) => ({ value: entry.name, label: entry.signature }),
  ));
}

/** @returns {string} the id of the held-item list */
export function heldItemDatalistId() {
  return sharedDatalist(HELD_ITEM_DATALIST_ID, () => HELD_ITEMS.map((item) => ({ ...item })));
}
