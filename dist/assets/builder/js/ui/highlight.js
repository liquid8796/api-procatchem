/**
 * Lua syntax highlighting for the preview screen.
 *
 * Uses the same token classes as the API reference (`tok-c`, `tok-s`, `tok-n`,
 * `tok-k`, `tok-f`) so the builder's LCD looks identical to the code samples in
 * the docs. Tokens are appended as text nodes, never as markup, so generated
 * content cannot inject HTML.
 */

const TOKEN_PATTERN = new RegExp([
  /(--\[(?:=*)\[[\s\S]*?\](?:=*)\]|--[^\n]*)/,          // 1 comment
  /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/,               // 2 string
  /(\b\d+(?:\.\d+)?\b)/,                                  // 3 number
  new RegExp(
    '(\\b(?:local|function|end|if|then|else|elseif|for|while|do|return|true|false'
    + '|nil|and|or|not|in|repeat|until|break)\\b)',
  ),                                                      // 4 keyword
  /([A-Za-z_][A-Za-z0-9_]*)(?=\s*\()/,                    // 5 call
].map((part) => part.source).join('|'), 'g');

const CLASS_BY_GROUP = ['tok-c', 'tok-s', 'tok-n', 'tok-k', 'tok-f'];

/**
 * Render highlighted Lua into `target`, replacing its contents.
 *
 * @param {HTMLElement} target
 * @param {string} source
 */
export function renderHighlightedLua(target, source) {
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;
  TOKEN_PATTERN.lastIndex = 0;

  for (let match = TOKEN_PATTERN.exec(source); match; match = TOKEN_PATTERN.exec(source)) {
    if (match.index > lastIndex) {
      fragment.appendChild(document.createTextNode(source.slice(lastIndex, match.index)));
    }
    const groupIndex = CLASS_BY_GROUP.findIndex((_, i) => match[i + 1] !== undefined);
    const span = document.createElement('span');
    span.className = CLASS_BY_GROUP[groupIndex] ?? 'tok-f';
    span.textContent = match[0];
    fragment.appendChild(span);
    lastIndex = match.index + match[0].length;
  }

  fragment.appendChild(document.createTextNode(source.slice(lastIndex)));
  target.textContent = '';
  target.appendChild(fragment);
}
