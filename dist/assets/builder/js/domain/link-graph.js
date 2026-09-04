/**
 * Map-to-map link graph.
 *
 * The bot host learns which cell on map A warps to map B and caches it in
 * `maps-cache/link_graph.txt`:
 *
 *     PROCATCHEM-LINKGRAPH<TAB>v1
 *     Viridian City<TAB>12<TAB>3<TAB>Viridian Forest
 *
 * That file is the reason the builder never needs the retired `moveToMap()`:
 * travelling from A to B is just walking onto the warp cell with
 * `moveToCell(x, y)`, one hop per map, until `getMapName()` reports the goal.
 */

import { t } from '../core/i18n.js';

export const LINK_GRAPH_HEADER = 'PROCATCHEM-LINKGRAPH';
const FIELDS_PER_RECORD = 4;
/** Fallback for files whose tabs were flattened to runs of spaces by an editor. */
const SPACED_RECORD_PATTERN = /^(.+?)\s{2,}(-?\d+)\s+(-?\d+)\s{2,}(.+)$/;

/**
 * @typedef {{ x: number, y: number }} Cell
 * @typedef {{ from: string, to: string, x: number, y: number }} Hop
 * @typedef {{ maps: number, edges: number, cells: number, skipped: number }} ParseStats
 */

/** @param {string} name @returns {string} */
function normalise(name) {
  return String(name ?? '').trim().toLowerCase();
}

export class LinkGraph {
  constructor() {
    /** @type {Map<string, Map<string, Cell[]>>} normalised from -> normalised to -> cells */
    this._edges = new Map();
    /** @type {Map<string, string>} normalised name -> display name */
    this._displayNames = new Map();
    this._edgeCount = 0;
    this._cellCount = 0;
  }

  /** @returns {boolean} true when nothing has been loaded */
  get isEmpty() {
    return this._edges.size === 0;
  }

  /** @returns {number} number of distinct directed map pairs */
  get edgeCount() {
    return this._edgeCount;
  }

  /** @returns {number} number of distinct warp cells */
  get cellCount() {
    return this._cellCount;
  }

  /**
   * Parse the contents of a `link_graph.txt` file.
   *
   * Unparseable lines are counted rather than thrown, because the host writes
   * the cache incrementally and a partially-flushed file is normal.
   *
   * @param {string} text
   * @returns {{ graph: LinkGraph, stats: ParseStats }}
   */
  static parse(text) {
    const graph = new LinkGraph();
    let skipped = 0;

    for (const rawLine of String(text ?? '').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.toUpperCase().startsWith(LINK_GRAPH_HEADER)) continue;

      let fields = rawLine.split('\t').map((part) => part.trim()).filter(Boolean);
      if (fields.length < FIELDS_PER_RECORD) {
        const relaxed = rawLine.match(SPACED_RECORD_PATTERN);
        fields = relaxed ? [relaxed[1].trim(), relaxed[2], relaxed[3], relaxed[4].trim()] : fields;
      }
      if (fields.length < FIELDS_PER_RECORD) {
        skipped += 1;
        continue;
      }

      const [from, rawX, rawY, ...rest] = fields;
      const x = Number.parseInt(rawX, 10);
      const y = Number.parseInt(rawY, 10);
      const to = rest.join(' ').trim();
      if (!graph.addLink(from, x, y, to)) skipped += 1;
    }

    return { graph, stats: { ...graph.stats(), skipped } };
  }

  /**
   * Record one warp cell. Duplicate cells for the same pair are ignored.
   *
   * @param {string} from
   * @param {number} x
   * @param {number} y
   * @param {string} to
   * @returns {boolean} false when the record was malformed
   */
  addLink(from, x, y, to) {
    const fromKey = normalise(from);
    const toKey = normalise(to);
    if (!fromKey || !toKey || !Number.isInteger(x) || !Number.isInteger(y)) return false;

    this._displayNames.set(fromKey, String(from).trim());
    this._displayNames.set(toKey, String(to).trim());

    let targets = this._edges.get(fromKey);
    if (!targets) {
      targets = new Map();
      this._edges.set(fromKey, targets);
    }

    let cells = targets.get(toKey);
    if (!cells) {
      cells = [];
      targets.set(toKey, cells);
      this._edgeCount += 1;
    }
    if (cells.some((cell) => cell.x === x && cell.y === y)) return true;

    cells.push({ x, y });
    // Keep a deterministic order so the same file always emits the same script.
    cells.sort((a, b) => a.x - b.x || a.y - b.y);
    this._cellCount += 1;
    return true;
  }

  /** @returns {ParseStats} */
  stats() {
    return {
      maps: this.mapNames().length,
      edges: this._edgeCount,
      cells: this._cellCount,
      skipped: 0,
    };
  }

  /** @returns {string[]} every map mentioned, display-cased, alphabetical */
  mapNames() {
    return [...this._displayNames.values()].sort((a, b) => a.localeCompare(b));
  }

  /**
   * Resolve user-typed text to the stored display name.
   *
   * @param {string} name
   * @returns {string | null}
   */
  resolveName(name) {
    return this._displayNames.get(normalise(name)) ?? null;
  }

  /** @param {string} name @returns {boolean} */
  hasMap(name) {
    return this._displayNames.has(normalise(name));
  }

  /**
   * @param {string} from
   * @returns {string[]} display names reachable in one hop
   */
  neighbours(from) {
    const targets = this._edges.get(normalise(from));
    if (!targets) return [];
    return [...targets.keys()]
      .map((key) => this._displayNames.get(key) ?? key)
      .sort((a, b) => a.localeCompare(b));
  }

  /**
   * The warp cell to step on to get from `from` to `to`.
   *
   * @param {string} from
   * @param {string} to
   * @returns {Cell | null}
   */
  hopCell(from, to) {
    const cells = this._edges.get(normalise(from))?.get(normalise(to));
    return cells && cells.length ? { ...cells[0] } : null;
  }

  /**
   * Breadth-first shortest path, so a route never takes more map transitions
   * than it has to. Returns display names including both endpoints.
   *
   * @param {string} from
   * @param {string} to
   * @returns {string[] | null} null when no path exists
   */
  findRoute(from, to) {
    const startKey = normalise(from);
    const goalKey = normalise(to);
    if (!startKey || !goalKey) return null;
    if (!this._displayNames.has(startKey) || !this._displayNames.has(goalKey)) return null;
    if (startKey === goalKey) return [this._displayNames.get(startKey)];

    /** @type {Map<string, string | null>} child -> parent */
    const cameFrom = new Map([[startKey, null]]);
    const queue = [startKey];

    for (let head = 0; head < queue.length; head += 1) {
      const current = queue[head];
      for (const next of this._edges.get(current)?.keys() ?? []) {
        if (cameFrom.has(next)) continue;
        cameFrom.set(next, current);
        if (next === goalKey) return this._reconstruct(cameFrom, goalKey);
        queue.push(next);
      }
    }
    return null;
  }

  /**
   * One hop from every map that can reach `destination`, pointing at it.
   *
   * `findRoute` answers "how do I get from here to there"; this answers "from
   * anywhere, which way is there" — the table a bot consults when it wakes up
   * somewhere the route never planned for. It is a breadth-first search over
   * the edges reversed, so each map gets the first step of its own shortest
   * path, and the whole thing is one table lookup at runtime.
   *
   * The destination itself is not included: standing on it, there is nothing
   * left to walk.
   *
   * @param {string} destination
   * @returns {Hop[]} nearest maps first, ties broken by name
   */
  hopsToward(destination) {
    const goalKey = normalise(destination);
    if (!goalKey || !this._displayNames.has(goalKey)) return [];

    /** @type {Map<string, string>} normalised map -> the map to step into next */
    const nextHop = new Map();
    let frontier = [goalKey];
    /** @type {Hop[]} */
    const hops = [];

    while (frontier.length) {
      /** @type {string[]} */
      const nextFrontier = [];
      for (const target of frontier) {
        // Everything with an edge *into* target can take one step toward it.
        for (const [from, targets] of this._edges) {
          if (from === goalKey || nextHop.has(from) || !targets.has(target)) continue;
          // A pair recorded without a cell cannot be walked. Skipping it here
          // rather than when writing the rows matters: accepted, it would
          // become the way home for everything behind it, and every one of
          // those maps would walk into a dead end.
          if (!targets.get(target)?.length) continue;
          nextHop.set(from, target);
          nextFrontier.push(from);
        }
      }
      nextFrontier.sort((a, b) => a.localeCompare(b));
      for (const from of nextFrontier) {
        const fromName = this._displayNames.get(from) ?? from;
        const toName = this._displayNames.get(nextHop.get(from)) ?? nextHop.get(from);
        const cell = this.hopCell(fromName, toName);
        if (cell) hops.push({ from: fromName, to: toName, x: cell.x, y: cell.y });
      }
      frontier = nextFrontier;
    }
    return hops;
  }

  /**
   * Turn a map path into the concrete hops a script walks.
   *
   * @param {string[]} path display names, as returned by {@link findRoute}
   * @returns {Hop[]}
   * @throws {Error} when a consecutive pair has no recorded warp cell
   */
  hopsFor(path) {
    /** @type {Hop[]} */
    const hops = [];
    for (let i = 0; i < path.length - 1; i += 1) {
      const from = path[i];
      const to = path[i + 1];
      const cell = this.hopCell(from, to);
      if (!cell) throw new Error(t('No warp cell recorded for "{from}" -> "{to}"', { from, to }));
      hops.push({ from, to, x: cell.x, y: cell.y });
    }
    return hops;
  }

  /**
   * Serialise back to `link_graph.txt` format.
   *
   * @returns {string} empty string when the graph holds nothing
   */
  toText() {
    /** @type {string[]} */
    const rows = [];
    for (const fromKey of [...this._edges.keys()].sort()) {
      const targets = this._edges.get(fromKey);
      for (const toKey of [...targets.keys()].sort()) {
        for (const cell of targets.get(toKey)) {
          rows.push([
            this._displayNames.get(fromKey) ?? fromKey,
            cell.x,
            cell.y,
            this._displayNames.get(toKey) ?? toKey,
          ].join('\t'));
        }
      }
    }
    return rows.length ? `${LINK_GRAPH_HEADER}\tv1\n${rows.join('\n')}\n` : '';
  }

  /**
   * @param {Map<string, string | null>} cameFrom
   * @param {string} goalKey
   * @returns {string[]}
   */
  _reconstruct(cameFrom, goalKey) {
    /** @type {string[]} */
    const reversed = [];
    for (let key = goalKey; key != null; key = cameFrom.get(key)) {
      reversed.push(this._displayNames.get(key) ?? key);
    }
    return reversed.reverse();
  }
}
