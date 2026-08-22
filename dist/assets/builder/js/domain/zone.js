/**
 * Farm zones.
 *
 * A zone is a rectangle the bot wanders inside with `moveToRectangle`. Users
 * type them as `x1, y1, x2, y2`; this module turns that text into a checked
 * value the generator and the lint rules can both reason about.
 */

/**
 * @typedef {object} Zone
 * @property {number} x1
 * @property {number} y1
 * @property {number} x2
 * @property {number} y2
 * @property {boolean} flat true when the rectangle is a single row, column, or cell
 */

const COORDINATE_COUNT = 4;

/**
 * Parse one `x1, y1, x2, y2` string.
 *
 * @param {unknown} text
 * @returns {Zone | null} null when the text is not four whole numbers
 */
export function parseZone(text) {
  const parts = String(text ?? '')
    .split(/[,;\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length !== COORDINATE_COUNT) return null;

  const numbers = parts.map((part) => (/^-?\d+$/.test(part) ? Number.parseInt(part, 10) : NaN));
  if (numbers.some((value) => !Number.isInteger(value))) return null;

  const [ax, ay, bx, by] = numbers;
  // Normalise the corners so x1,y1 is always the lower-left of the pair.
  const x1 = Math.min(ax, bx);
  const x2 = Math.max(ax, bx);
  const y1 = Math.min(ay, by);
  const y2 = Math.max(ay, by);

  // A rectangle with no width or no height is a line: moveToRectangle would
  // stand still on it, so the generator patrols its ends instead.
  return { x1, y1, x2, y2, flat: x1 === x2 || y1 === y2 };
}

/**
 * Parse a list of zone strings, keeping only the valid ones.
 *
 * @param {unknown[]} list
 * @returns {{ zones: Zone[], invalid: string[] }}
 */
export function parseZones(list) {
  /** @type {Zone[]} */
  const zones = [];
  /** @type {string[]} */
  const invalid = [];
  for (const entry of Array.isArray(list) ? list : []) {
    const zone = parseZone(entry);
    if (zone) zones.push(zone);
    else invalid.push(String(entry ?? ''));
  }
  return { zones, invalid };
}
