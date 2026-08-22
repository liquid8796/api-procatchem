/**
 * Registry of farm modes (Strategy pattern).
 *
 * Adding a mode means writing one module that satisfies the `FarmMode` shape
 * and registering it here — nothing in the composer, the UI, or the lint rules
 * needs to change.
 */

import { Registry } from '../core/registry.js';
import { evMode } from './modes/ev.js';
import { expMode } from './modes/exp.js';
import { goldMode } from './modes/gold.js';
import { huntMode } from './modes/hunt.js';

/**
 * @typedef {object} ModeTraits
 * @property {boolean} usesTargetFilters shows the target panel
 * @property {boolean} usesWeaken        shows the weaken controls
 * @property {boolean} usesBalls         shows the ball ladder
 * @property {boolean} usesEvStat        shows the EV stat picker
 * @property {boolean} engagesEveryEncounter true when the mode acts on every wild
 *           encounter, which makes the not-wanted fallback unreachable
 *
 * @typedef {object} FarmMode
 * @property {string} id
 * @property {string} label
 * @property {string} icon
 * @property {string} tagline
 * @property {string} description
 * @property {ModeTraits} traits
 * @property {(writer: import('../core/lua-writer.js').LuaWriter,
 *             context: import('./runtime.js').EmitContext) => void} emitHelpers
 *           Local functions the engagement step depends on.
 * @property {(writer: import('../core/lua-writer.js').LuaWriter,
 *             context: import('./runtime.js').EmitContext) => void} emitEngagement
 *           The wild-encounter branch of `onBattleAction`. Falling through to
 *           the end means "this encounter is not wanted".
 */

/** @type {Registry<FarmMode>} */
export const modeRegistry = new Registry('FarmMode');

modeRegistry.register(huntMode.id, huntMode);
modeRegistry.register(expMode.id, expMode);
modeRegistry.register(evMode.id, evMode);
modeRegistry.register(goldMode.id, goldMode);

/**
 * @param {string} id
 * @returns {FarmMode}
 */
export function requireMode(id) {
  return modeRegistry.require(id);
}
