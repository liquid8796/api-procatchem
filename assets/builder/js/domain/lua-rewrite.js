/**
 * Rewriting an existing script so it stops calling the retired `moveToMap()`.
 *
 * The host aborts any script that calls it, which strands scripts written
 * before it was retired. Travelling from A to B is really "walk onto the warp
 * cell on A that leads to B", and the link graph knows where those cells are —
 * so the call can be replaced mechanically, provided the script says which map
 * it is standing on.
 *
 * Deciding that is the whole problem. Scripts say it in one of two shapes:
 *
 *     if getMapName() == "Viridian City" then …
 *     local map = getMapName()
 *     if map == "Viridian City" then …
 *
 * Both are tracked. Anything the rewriter cannot place is left exactly as it
 * was and reported, because a wrong cell would walk the bot somewhere else
 * entirely — worse than the error it replaced.
 */

/** The call being replaced, and what replaces it. */
const RETIRED_CALL = /\bmoveToMap\s*\(\s*(["'])((?:\\.|(?!\1).)*)\1\s*\)/g;
/** `getMapName() == "X"`, in either order, with `==` or `~=`. */
const MAP_TEST = /(?:getMapName\s*\(\s*\)|\b[A-Za-z_][A-Za-z0-9_]*\b)\s*(==)\s*(["'])((?:\\.|(?!\2).)*)\2/;
/** `local map = getMapName()` — the alias form. */
const MAP_ALIAS = /\blocal\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*getMapName\s*\(\s*\)/;
/** Openers and closers used to track how deep a map assertion still applies. */
const BLOCK_OPEN = /\b(?:if|for|while|function|do)\b/g;
const BLOCK_CLOSE = /\bend\b/g;

/**
 * @typedef {object} RewriteNote
 * @property {number} line     1-based
 * @property {string} target   the map `moveToMap` was heading for
 * @property {string} reason
 *
 * @typedef {object} RewriteResult
 * @property {string} lua        the rewritten source
 * @property {number} converted  calls replaced
 * @property {RewriteNote[]} skipped calls left alone, with why
 */

/**
 * Replace every `moveToMap` call the link graph can place.
 *
 * @param {string} source
 * @param {import('./link-graph.js').LinkGraph} graph
 * @returns {RewriteResult}
 */
export function convertMoveToMap(source, graph) {
  const lines = String(source ?? '').split('\n');
  /** @type {RewriteNote[]} */
  const skipped = [];
  let converted = 0;

  /** Map assertions still in force, innermost last. */
  const scopes = [];
  /** Names that alias `getMapName()`, so `map == "X"` is understood too. */
  const aliases = new Set(['getMapName']);
  let depth = 0;

  const rewritten = lines.map((line, index) => {
    const code = withoutCommentsAndStrings(line);
    const alias = MAP_ALIAS.exec(line);
    if (alias) aliases.add(alias[1]);

    // A closer pops every assertion opened deeper than the level it returns to.
    depth -= count(code, BLOCK_CLOSE);
    while (scopes.length && scopes[scopes.length - 1].depth > depth) scopes.pop();

    const opened = count(code, BLOCK_OPEN);
    const outerMap = scopes.length ? scopes[scopes.length - 1].map : null;

    // A one-line `if getMapName() == "X" then … end` asserts the map for the
    // calls that follow it *on this line*, so the test has to be read before
    // the replacement rather than after it.
    const test = opened ? MAP_TEST.exec(line) : null;
    // Only an equality test pins the map down; `~=` says where it is not.
    const asserted = test && test[1] === '==' && namesTheMap(line, test, aliases)
      ? { map: unescapeLua(test[3]), from: test.index + test[0].length }
      : null;
    const mapAt = (offset) => (asserted && offset >= asserted.from ? asserted.map : outerMap);

    const output = replaceCalls(line, mapAt, graph, index + 1, skipped, () => { converted += 1; });

    depth += opened;
    if (asserted) scopes.push({ map: asserted.map, depth });
    return output;
  });

  return { lua: rewritten.join('\n'), converted, skipped };
}

/**
 * True when the comparison really reads the current map name rather than some
 * other string variable that happens to sit next to a block opener.
 *
 * @param {string} line
 * @param {RegExpExecArray} test
 * @param {Set<string>} aliases
 * @returns {boolean}
 */
function namesTheMap(line, test, aliases) {
  const before = line.slice(0, test.index + test[0].length);
  const subject = /([A-Za-z_][A-Za-z0-9_]*)\s*\(?\s*\)?\s*==\s*["'][^"']*["']$/.exec(before);
  return Boolean(subject && aliases.has(subject[1]));
}

/**
 * @param {string} line
 * @param {(offset: number) => string | null} mapAt which map the script is on
 *   at a given column, which a same-line assertion can change part-way through
 * @param {import('./link-graph.js').LinkGraph} graph
 * @param {number} lineNumber
 * @param {RewriteNote[]} skipped
 * @param {() => void} onConverted
 * @returns {string}
 */
function replaceCalls(line, mapAt, graph, lineNumber, skipped, onConverted) {
  RETIRED_CALL.lastIndex = 0;
  return line.replace(RETIRED_CALL, (match, _quote, rawTarget, offset) => {
    const target = unescapeLua(rawTarget);
    const currentMap = mapAt(offset);
    if (!currentMap) {
      skipped.push({
        line: lineNumber,
        target,
        reason: 'the script does not say which map it is on here',
      });
      return match;
    }
    const cell = graph.hopCell(currentMap, target);
    if (!cell) {
      skipped.push({
        line: lineNumber,
        target,
        reason: `the link graph has no warp cell from "${currentMap}" to "${target}"`,
      });
      return match;
    }
    onConverted();
    return `moveToCell(${cell.x}, ${cell.y})`;
  });
}

/**
 * @param {string} text
 * @param {RegExp} pattern a global regex
 * @returns {number}
 */
function count(text, pattern) {
  pattern.lastIndex = 0;
  let total = 0;
  while (pattern.exec(text)) total += 1;
  return total;
}

/**
 * Blank out comments and strings so a keyword inside either cannot be mistaken
 * for a block opener.
 *
 * @param {string} line
 * @returns {string}
 */
function withoutCommentsAndStrings(line) {
  return line
    .replace(/--.*$/, ' ')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");
}

/**
 * Undo the escapes in a Lua string literal, so a map name matches the graph.
 *
 * @param {string} text
 * @returns {string}
 */
function unescapeLua(text) {
  return String(text).replace(/\\(.)/g, (_match, char) => {
    if (char === 'n') return '\n';
    if (char === 't') return '\t';
    return char;
  });
}
