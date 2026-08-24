/**
 * A shared `<datalist>` of every documented API function.
 *
 * Several controls offer the same completion list, and a datalist per control
 * would put a few hundred `<option>` elements into the DOM for each of them.
 * One list, created on first use and reused by id, keeps that to a single copy.
 */

import { API_ENTRIES } from '../domain/api-catalog.js';
import { h } from './dom.js';

/** The id controls point their `list` attribute at. */
export const API_DATALIST_ID = 'api-function-names';

/**
 * Ensure the shared list exists, and return its id.
 *
 * @returns {string}
 */
export function apiDatalistId() {
  if (!document.getElementById(API_DATALIST_ID)) {
    document.body.appendChild(h('datalist', { id: API_DATALIST_ID }, API_ENTRIES.map(
      (entry) => h('option', { value: entry.name, label: entry.signature }),
    )));
  }
  return API_DATALIST_ID;
}
