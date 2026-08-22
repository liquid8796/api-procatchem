/**
 * Lua source emitter (Builder pattern).
 *
 * Generators never concatenate strings by hand: they drive a LuaWriter, which
 * owns indentation and escaping. That keeps the emitted script well-formed no
 * matter what the user typed into a text field.
 */

const INDENT_UNIT = '    ';
const LUA_KEYWORDS = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
  'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return',
  'then', 'true', 'until', 'while',
]);
const SIMPLE_ESCAPES = {
  '\\': '\\\\',
  '"': '\\"',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
};
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const CONTROL_MAX = 0x1f;
const DELETE_CODE = 0x7f;

/**
 * Quote an arbitrary JS value as a Lua string literal.
 *
 * Every byte a user can type — quotes, backslashes, newlines, control
 * characters — is escaped, so a careless or hostile input cannot break out of
 * the literal and change the meaning of the generated script.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function luaString(value) {
  const text = value === null || value === undefined ? '' : String(value);
  let out = '"';
  for (const char of text) {
    const simple = SIMPLE_ESCAPES[char];
    if (simple) {
      out += simple;
      continue;
    }
    const code = char.codePointAt(0);
    // Escape C0 controls and DEL; everything else (incl. non-ASCII) passes through.
    out += code <= CONTROL_MAX || code === DELETE_CODE
      ? '\\' + String(code).padStart(3, '0')
      : char;
  }
  return out + '"';
}

/**
 * Render a Lua number literal, rejecting values that would emit `nan`/`inf`.
 *
 * @param {unknown} value
 * @param {number} [fallback]
 * @returns {string}
 */
export function luaNumber(value, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return String(Number.isFinite(parsed) ? parsed : fallback);
}

/**
 * Render a Lua table constructor from a list of already-rendered expressions.
 *
 * @param {string[]} expressions
 * @returns {string}
 */
export function luaArray(expressions) {
  return expressions.length ? `{ ${expressions.join(', ')} }` : '{}';
}

/**
 * Render a table key: bare when it is a safe identifier, bracketed otherwise.
 *
 * @param {string} key
 * @returns {string}
 */
export function luaKey(key) {
  const isIdentifier = IDENTIFIER_PATTERN.test(key) && !LUA_KEYWORDS.has(key);
  return isIdentifier ? key : `[${luaString(key)}]`;
}

export class LuaWriter {
  constructor() {
    /** @type {string[]} */
    this._lines = [];
    this._indent = 0;
    /** @type {Set<string>} every host function referenced by emitted code */
    this._calls = new Set();
  }

  /**
   * Append a raw line at the current indentation. Blank input emits a truly
   * blank line (no trailing whitespace), which keeps the output diff-friendly.
   *
   * @param {string} [text]
   * @returns {this}
   */
  line(text = '') {
    this._lines.push(text ? INDENT_UNIT.repeat(this._indent) + text : '');
    return this;
  }

  /**
   * Append several lines, splitting on newlines so callers can pass templates.
   *
   * @param {string} block
   * @returns {this}
   */
  lines(block) {
    for (const raw of String(block).split('\n')) this.line(raw);
    return this;
  }

  /**
   * @param {string} text
   * @returns {this}
   */
  comment(text) {
    return this.line(`-- ${text}`);
  }

  /** @returns {this} */
  blank() {
    return this.line();
  }

  /**
   * Emit `header` … `end`, running `body` one level deeper. Indentation is
   * restored even if the body throws, so a generator bug cannot corrupt the
   * rest of the output.
   *
   * @param {string} header
   * @param {(writer: this) => void} body
   * @param {string} [closer]
   * @returns {this}
   */
  block(header, body, closer = 'end') {
    this.line(header);
    this._indent += 1;
    try {
      body(this);
    } finally {
      this._indent -= 1;
    }
    return this.line(closer);
  }

  /**
   * Emit a top-level or local function definition.
   *
   * @param {string} signature e.g. `onBattleAction()`
   * @param {(writer: this) => void} body
   * @param {{ local?: boolean }} [options]
   * @returns {this}
   */
  fn(signature, body, options = {}) {
    const keyword = options.local ? 'local function' : 'function';
    return this.block(`${keyword} ${signature}`, body);
  }

  /**
   * Record that the emitted script calls a host function, and return the name
   * so it can be inlined straight into an expression.
   *
   * The verification pass uses this set to prove every call resolves against
   * the real Lua API.
   *
   * @param {string} name
   * @returns {string}
   */
  useHost(name) {
    this._calls.add(name);
    return name;
  }

  /**
   * Record several host calls at once.
   *
   * @param {string[]} names
   * @returns {this}
   */
  useHosts(names) {
    for (const name of names) this._calls.add(name);
    return this;
  }

  /** @returns {string[]} host functions referenced, sorted */
  hostCalls() {
    return [...this._calls].sort();
  }

  /** @returns {string} the assembled source, newline-terminated */
  toString() {
    const body = this._lines.join('\n').replace(/\n{3,}/g, '\n\n');
    return `${body.replace(/\s+$/, '')}\n`;
  }
}
