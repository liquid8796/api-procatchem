/**
 * A YAML reader for exactly the subset `openapi.yaml` is written in.
 *
 * The repository has no runtime dependencies on purpose — the docs are meant to
 * open straight from the filesystem — so the build scripts cannot reach for a
 * real YAML library. This reader is deliberately small and deliberately strict:
 * it throws on anything it does not understand rather than guessing, because a
 * silently mis-parsed spec would produce a catalog that lies about the API.
 *
 * Supported: block mappings, block sequences, plain scalars, single- and
 * double-quoted scalars (including the multi-line folding the OpenAPI emitter
 * produces), empty flow collections, and `#` comments.
 *
 * Not supported, and rejected loudly: anchors, aliases, tags, multiple
 * documents, block scalars, and non-empty flow collections.
 */

/** Characters that begin a construct this reader refuses to guess at. */
const UNSUPPORTED_SCALAR_PREFIX = /^[&*!]/;

/** Matches `key:` / `key: value`, with quoted keys allowed. */
const MAPPING_ENTRY = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^:#]+?)\s*:(?:\s+(.*))?$/;

/**
 * Parse a YAML document.
 *
 * @param {string} text
 * @returns {unknown}
 * @throws {Error} on any construct outside the supported subset
 */
export function parseYaml(text) {
  const lines = readLines(String(text ?? ''));
  if (!lines.length) return null;
  const reader = new BlockReader(lines);
  const value = reader.parseNode(lines[0].indent);
  reader.expectEnd();
  return value;
}

/**
 * @typedef {object} SourceLine
 * @property {number} number  1-based, for error messages and blank-line counting
 * @property {number} indent  leading spaces
 * @property {string} content the line with indentation removed
 */

/**
 * Split into significant lines, dropping blanks and whole-line comments.
 *
 * Blank lines still matter inside a multi-line quoted scalar, so each line
 * keeps its original number and the scalar folder recovers the gaps from it.
 *
 * @param {string} text
 * @returns {SourceLine[]}
 */
function readLines(text) {
  /** @type {SourceLine[]} */
  const out = [];
  const raw = text.split(/\r?\n/);
  for (let i = 0; i < raw.length; i += 1) {
    const line = raw[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (/^\s*\t/.test(line)) {
      throw new Error(`Line ${i + 1}: tabs cannot be used for YAML indentation`);
    }
    out.push({
      number: i + 1,
      indent: line.length - line.trimStart().length,
      content: line.trimStart(),
    });
  }
  return out;
}

/**
 * @param {SourceLine} line
 * @returns {boolean}
 */
function isSequenceLine(line) {
  return line.content === '-' || line.content.startsWith('- ');
}

/** Cursor over the significant lines, parsing one block node at a time. */
class BlockReader {
  /** @param {SourceLine[]} lines */
  constructor(lines) {
    this._lines = lines;
    this._index = 0;
  }

  /** @returns {SourceLine | null} */
  peek() {
    return this._index < this._lines.length ? this._lines[this._index] : null;
  }

  /** @throws {Error} when input remains after the root node */
  expectEnd() {
    const line = this.peek();
    if (line) throw new Error(`Line ${line.number}: unexpected content after the document`);
  }

  /**
   * Parse the block node whose first line sits at exactly `indent`.
   *
   * @param {number} indent
   * @returns {unknown}
   */
  parseNode(indent) {
    const line = this.peek();
    if (!line || line.indent !== indent) return null;
    return isSequenceLine(line) ? this.parseSequence(indent) : this.parseMapping(indent);
  }

  /**
   * The value of a mapping key or sequence item that had nothing after its
   * colon or dash.
   *
   * YAML lets a nested sequence sit at the *same* column as its key, which is
   * the style the OpenAPI emitter uses for `tags:`; anything else has to be
   * indented further.
   *
   * @param {number} ownerIndent
   * @returns {unknown}
   */
  parseChild(ownerIndent) {
    const next = this.peek();
    if (!next) return null;
    if (next.indent > ownerIndent) return this.parseNode(next.indent);
    if (next.indent === ownerIndent && isSequenceLine(next)) return this.parseSequence(ownerIndent);
    return null;
  }

  /**
   * @param {number} indent
   * @returns {unknown[]}
   */
  parseSequence(indent) {
    /** @type {unknown[]} */
    const items = [];
    for (;;) {
      const line = this.peek();
      if (!line || line.indent !== indent || !isSequenceLine(line)) break;

      this._index += 1;
      const inline = line.content === '-' ? '' : line.content.slice(2).trim();
      if (!inline) {
        items.push(this.parseChild(indent));
        continue;
      }
      // `- key: value` opens a mapping whose later keys line up with where the
      // inline text began, not with the dash.
      const itemIndent = indent + (line.content.length - line.content.slice(2).trimStart().length);
      items.push(MAPPING_ENTRY.test(inline)
        ? this.parseInlineMapping(line, inline, itemIndent)
        : this.readScalar(line, inline, itemIndent));
    }
    return items;
  }

  /**
   * @param {number} indent
   * @returns {Record<string, unknown>}
   */
  parseMapping(indent) {
    /** @type {Record<string, unknown>} */
    const map = {};
    for (;;) {
      const line = this.peek();
      if (!line || line.indent !== indent || isSequenceLine(line)) break;

      const entry = splitMappingEntry(line.content);
      if (!entry) throw new Error(`Line ${line.number}: expected "key: value"`);
      this._index += 1;
      map[entry.key] = entry.rest
        ? this.readScalar(line, entry.rest, indent)
        : this.parseChild(indent);
    }
    return map;
  }

  /**
   * A mapping that started on a sequence-item line: its first key is already in
   * hand, the rest follow at `itemIndent`.
   *
   * @param {SourceLine} line
   * @param {string} inline
   * @param {number} itemIndent
   * @returns {Record<string, unknown>}
   */
  parseInlineMapping(line, inline, itemIndent) {
    const entry = splitMappingEntry(inline);
    if (!entry) throw new Error(`Line ${line.number}: expected "key: value"`);
    const value = entry.rest
      ? this.readScalar(line, entry.rest, itemIndent)
      : this.parseChild(itemIndent);
    return { [entry.key]: value, ...this.parseMapping(itemIndent) };
  }

  /**
   * Read a scalar that begins on `line` after the key, consuming any
   * continuation lines a quoted scalar spans.
   *
   * @param {SourceLine} line
   * @param {string} first the text after `key:` (or after `- `)
   * @param {number} ownerIndent indent of the key or dash the scalar belongs to
   * @returns {unknown}
   */
  readScalar(line, first, ownerIndent) {
    if (first === '{}') return {};
    if (first === '[]') return [];
    if (first.startsWith('{') || first.startsWith('[')) {
      throw new Error(`Line ${line.number}: non-empty flow collections are not supported`);
    }
    if (UNSUPPORTED_SCALAR_PREFIX.test(first)) {
      throw new Error(`Line ${line.number}: anchors, aliases and tags are not supported`);
    }
    if (/^[|>][-+]?$/.test(first)) {
      throw new Error(`Line ${line.number}: block scalars are not supported`);
    }
    if (first.startsWith('"') || first.startsWith("'")) return this.readQuoted(line, first);
    return parsePlainScalar(this.readPlain(first, ownerIndent));
  }

  /**
   * Fold the continuation lines of a plain (unquoted) scalar.
   *
   * A plain scalar runs on while the following lines are indented past the key
   * and cannot be read as structure — which is exactly YAML's rule, since a
   * plain scalar may not contain `": "` and so can never look like a mapping
   * entry. Line breaks fold to single spaces.
   *
   * @param {string} first
   * @param {number} ownerIndent
   * @returns {string}
   */
  readPlain(first, ownerIndent) {
    let text = stripComment(first);
    for (;;) {
      const next = this.peek();
      if (!next || next.indent <= ownerIndent) break;
      if (isSequenceLine(next) || MAPPING_ENTRY.test(next.content)) break;
      text += ` ${stripComment(next.content)}`;
      this._index += 1;
    }
    return text.trim();
  }

  /**
   * Read a quoted scalar, folding its continuation lines exactly as YAML does:
   * a single line break becomes a space and each blank line in the gap becomes
   * a newline.
   *
   * The escaped line break of a double-quoted scalar (a trailing backslash) is
   * resolved *here* rather than in {@link unquote}, because once the break has
   * been folded to a space there is no way to tell it apart from the literal
   * `\ ` escape the OpenAPI emitter puts at the start of the next line.
   *
   * @param {SourceLine} line
   * @param {string} first
   * @returns {string}
   */
  readQuoted(line, first) {
    const quote = first[0];
    let body = first;
    let previousNumber = line.number;

    while (!isQuotedComplete(body, quote)) {
      const next = this.peek();
      if (!next) throw new Error(`Line ${line.number}: unterminated quoted scalar`);

      if (quote === '"' && endsWithEscapeCharacter(body)) {
        body = body.slice(0, -1) + next.content;
      } else {
        const blanks = next.number - previousNumber - 1;
        body += (blanks > 0 ? '\n'.repeat(blanks) : ' ') + next.content;
      }
      previousNumber = next.number;
      this._index += 1;
    }
    return unquote(body, quote, line.number);
  }
}

/**
 * True when `body` ends in a backslash that is acting as an escape character
 * (an odd number of trailing backslashes) rather than an escaped literal one.
 *
 * @param {string} body
 * @returns {boolean}
 */
function endsWithEscapeCharacter(body) {
  let run = 0;
  for (let i = body.length - 1; i >= 0 && body[i] === '\\'; i -= 1) run += 1;
  return run % 2 === 1;
}

/**
 * True when the quoted scalar in `body` is closed.
 *
 * @param {string} body
 * @param {string} quote
 * @returns {boolean}
 */
function isQuotedComplete(body, quote) {
  if (body.length < 2) return false;
  if (quote === '"') {
    let escaped = false;
    for (let i = 1; i < body.length; i += 1) {
      const char = body[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') escaped = true;
      else if (char === '"') return true;
    }
    return false;
  }
  return findSingleQuoteEnd(body) < body.length;
}

const DOUBLE_QUOTE_ESCAPES = {
  n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', 0: '\0',
  '"': '"', '\\': '\\', '/': '/', ' ': ' ',
};

/**
 * @param {string} body folded scalar text, starting at the opening quote
 * @param {string} quote
 * @param {number} lineNumber for error messages
 * @returns {string}
 */
function unquote(body, quote, lineNumber) {
  if (quote === "'") {
    const end = findSingleQuoteEnd(body);
    return body.slice(1, end).replace(/''/g, "'");
  }

  let out = '';
  for (let i = 1; i < body.length; i += 1) {
    const char = body[i];
    if (char === '"') return out;
    if (char !== '\\') {
      out += char;
      continue;
    }
    const escape = body[i + 1];
    if (escape === undefined) throw new Error(`Line ${lineNumber}: dangling escape in a quoted scalar`);
    i += 1;
    if (escape === 'x' || escape === 'u' || escape === 'U') {
      const width = escape === 'x' ? 2 : (escape === 'u' ? 4 : 8);
      const digits = body.slice(i + 1, i + 1 + width);
      if (digits.length !== width || !/^[0-9a-fA-F]+$/.test(digits)) {
        throw new Error(`Line ${lineNumber}: malformed \\${escape} escape`);
      }
      out += String.fromCodePoint(Number.parseInt(digits, 16));
      i += width;
      continue;
    }
    const simple = DOUBLE_QUOTE_ESCAPES[escape];
    if (simple === undefined) throw new Error(`Line ${lineNumber}: unknown escape \\${escape}`);
    out += simple;
  }
  throw new Error(`Line ${lineNumber}: unterminated double-quoted scalar`);
}

/**
 * @param {string} body
 * @returns {number} index of the closing quote, or `body.length` when unclosed
 */
function findSingleQuoteEnd(body) {
  for (let i = 1; i < body.length; i += 1) {
    if (body[i] !== "'") continue;
    if (body[i + 1] === "'") {
      i += 1;
      continue;
    }
    return i;
  }
  return body.length;
}

/**
 * @param {string} content a line with its indentation already removed
 * @returns {{ key: string, rest: string } | null}
 */
function splitMappingEntry(content) {
  const match = MAPPING_ENTRY.exec(content);
  if (!match) return null;
  const rawKey = match[1].trim();
  const quoted = rawKey.startsWith('"') || rawKey.startsWith("'");
  return {
    key: quoted ? rawKey.slice(1, -1).replace(/''/g, "'") : rawKey,
    rest: (match[2] ?? '').trim(),
  };
}

/**
 * Drop a trailing `#` comment from a plain scalar.
 *
 * @param {string} text
 * @returns {string}
 */
function stripComment(text) {
  const at = text.indexOf(' #');
  return (at >= 0 ? text.slice(0, at) : text).trim();
}

/**
 * @param {string} text
 * @returns {string | number | boolean | null}
 */
function parsePlainScalar(text) {
  if (text === '' || text === '~' || text === 'null') return null;
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (/^-?\d+$/.test(text)) return Number.parseInt(text, 10);
  if (/^-?\d*\.\d+$/.test(text)) return Number.parseFloat(text);
  return text;
}
