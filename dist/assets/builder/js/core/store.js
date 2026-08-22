/**
 * Minimal observable state container.
 *
 * The whole builder reads from exactly one Store instance, so a panel never has
 * to know which other panel changed something — it just re-renders on notify.
 * Updates go through `setIn`/`replace`, which clone along the mutated path so a
 * subscriber can cheaply compare snapshots by reference if it wants to.
 */
export class Store {
  /** @param {object} initialState */
  constructor(initialState) {
    this._state = initialState;
    this._listeners = new Set();
  }

  /** @returns {object} the current (treat as read-only) state */
  get state() {
    return this._state;
  }

  /**
   * Subscribe to state changes.
   * @param {(state: object) => void} listener
   * @returns {() => void} unsubscribe
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Write a value at a dotted path, cloning every object along the way.
   * @param {string} path e.g. `'battle.balls'`
   * @param {unknown} value
   */
  setIn(path, value) {
    const keys = path.split('.');
    this._state = writePath(this._state, keys, 0, value);
    this._notify();
  }

  /**
   * Replace the value at a dotted path with one derived from its **current**
   * value.
   *
   * Editors must use this rather than `setIn` with a value computed from what
   * they rendered with: rendering is throttled, so a control can still be on
   * screen after the state behind it moved on. Writing back a derived snapshot
   * would silently discard whatever changed in between.
   *
   * @param {string} path
   * @param {(current: unknown) => unknown} updater
   * @param {unknown} [fallback] used when nothing is stored at `path` yet
   */
  update(path, updater, fallback = undefined) {
    const current = this.getIn(path);
    this.setIn(path, updater(current === undefined ? fallback : current));
  }

  /**
   * Read a value at a dotted path.
   * @param {string} path
   * @returns {unknown}
   */
  getIn(path) {
    return path.split('.').reduce(
      (node, key) => (node == null ? undefined : node[key]),
      this._state,
    );
  }

  /** Replace the entire state (used by config import / reset). @param {object} next */
  replace(next) {
    this._state = next;
    this._notify();
  }

  _notify() {
    // Copy first: a listener may unsubscribe while we iterate.
    for (const listener of [...this._listeners]) listener(this._state);
  }
}

/**
 * @param {any} node
 * @param {string[]} keys
 * @param {number} index
 * @param {unknown} value
 * @returns {any}
 */
function writePath(node, keys, index, value) {
  const key = keys[index];
  if (index === keys.length - 1) {
    if (Array.isArray(node)) {
      const copy = node.slice();
      copy[Number(key)] = value;
      return copy;
    }
    return { ...node, [key]: value };
  }

  const child = node == null ? undefined : node[key];
  const nextChild = writePath(
    child === undefined || child === null ? {} : child,
    keys,
    index + 1,
    value,
  );

  if (Array.isArray(node)) {
    const copy = node.slice();
    copy[Number(key)] = nextChild;
    return copy;
  }
  return { ...node, [key]: nextChild };
}
