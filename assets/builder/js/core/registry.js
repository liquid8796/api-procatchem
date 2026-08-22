/**
 * A name-keyed registry with a stable ordering.
 *
 * Both farm modes and lint rules are plug-ins: adding one means writing a module
 * and calling `register`, with no edits to the code that consumes them.
 *
 * @template T
 */
export class Registry {
  /** @param {string} label used in error messages */
  constructor(label) {
    this._label = label;
    this._entries = new Map();
  }

  /**
   * @param {string} id
   * @param {T} value
   * @returns {T}
   */
  register(id, value) {
    if (this._entries.has(id)) {
      throw new Error(`${this._label}: duplicate registration for "${id}"`);
    }
    this._entries.set(id, value);
    return value;
  }

  /**
   * @param {string} id
   * @returns {T}
   */
  require(id) {
    const found = this._entries.get(id);
    if (!found) {
      const known = [...this._entries.keys()].join(', ') || '<none>';
      throw new Error(`${this._label}: unknown id "${id}" (known: ${known})`);
    }
    return found;
  }

  /** @returns {T[]} in registration order */
  all() {
    return [...this._entries.values()];
  }

  /** @returns {string[]} in registration order */
  ids() {
    return [...this._entries.keys()];
  }
}
