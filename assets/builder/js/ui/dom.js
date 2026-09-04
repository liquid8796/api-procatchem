/**
 * Tiny DOM helpers.
 *
 * The builder builds its UI in JavaScript rather than in markup, because every
 * control is derived from a field descriptor. These helpers keep that code
 * close to the shape of the HTML it produces, and they set text through
 * `textContent` so user-supplied strings are never parsed as markup.
 */

/**
 * Create an element.
 *
 * @param {string} tag e.g. `'div.panel'`, `'button.btn.btn-primary'`
 * @param {Record<string, unknown>} [props] attributes; `class`, `text`, `html`,
 *   `dataset`, and `on<Event>` handlers are treated specially
 * @param {Array<Node | string | null | undefined>} [children]
 * @returns {HTMLElement}
 */
export function h(tag, props = {}, children = []) {
  const [name, ...classes] = String(tag).split('.');
  const element = document.createElement(name || 'div');
  if (classes.length) element.classList.add(...classes);

  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue;

    if (key === 'text') {
      element.textContent = String(value);
    } else if (key === 'html') {
      // Only ever called with builder-authored markup, never user input.
      element.innerHTML = String(value);
    } else if (key === 'class') {
      element.classList.add(...String(value).split(/\s+/).filter(Boolean));
    } else if (key === 'dataset') {
      Object.assign(element.dataset, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) {
      element.setAttribute(key, '');
    } else {
      element.setAttribute(key, String(value));
    }
  }

  append(element, children);
  return element;
}

/**
 * Append children, skipping nullish entries and wrapping bare strings as text.
 *
 * @param {Node} parent
 * @param {Array<Node | string | null | undefined> | Node | string} children
 * @returns {Node} parent
 */
export function append(parent, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return parent;
}

/**
 * Replace every child of `parent`.
 *
 * @param {Node} parent
 * @param {Array<Node | string | null | undefined>} children
 * @returns {Node} parent
 */
export function replaceChildren(parent, children) {
  parent.textContent = '';
  return append(parent, children);
}

/**
 * @param {string} selector
 * @param {ParentNode} [root]
 * @returns {HTMLElement}
 * @throws {Error} when the element is missing, so a typo fails loudly at boot
 */
export function must(selector, root = document) {
  const found = root.querySelector(selector);
  if (!found) throw new Error(`Required element not found: ${selector}`);
  return /** @type {HTMLElement} */ (found);
}

/**
 * Milliseconds after which a pending update runs even without a frame.
 * Browsers stop serving `requestAnimationFrame` to hidden tabs, so a timer
 * fallback is what keeps the preview current when the page is in the
 * background — without it, edits made off-screen would appear to be lost.
 */
const FRAME_FALLBACK_MS = 50;

/**
 * Run `fn` at most once per frame, coalescing repeat calls.
 * Used to keep typing responsive while the preview regenerates.
 *
 * @param {() => void} fn
 * @returns {() => void}
 */
export function rafThrottle(fn) {
  let frame = 0;
  let timer = 0;

  const run = () => {
    if (frame) cancelAnimationFrame(frame);
    if (timer) clearTimeout(timer);
    frame = 0;
    timer = 0;
    fn();
  };

  return () => {
    if (frame || timer) return;
    frame = requestAnimationFrame(run);
    timer = setTimeout(run, FRAME_FALLBACK_MS);
  };
}

/** @type {string | null} element id to focus once the next render finishes */
let pendingFocusId = null;

/**
 * Ask for `id` to receive focus after the next render.
 *
 * Controls that reorder their own rows (the ball ladder) cannot rely on
 * "restore whatever was focused", because the element at that position is a
 * different row afterwards. They name the element that should end up focused
 * instead.
 *
 * @param {string} id
 */
export function requestFocus(id) {
  pendingFocusId = id;
}

/**
 * Take the pending focus request, if any.
 *
 * @returns {string | null}
 */
export function consumeFocusRequest() {
  const id = pendingFocusId;
  pendingFocusId = null;
  return id;
}

/**
 * Run `render`, then put the caret back where it was.
 *
 * The builder rebuilds its controls from state on every change, which drops
 * focus — and a text field that loses focus on every keystroke is unusable. An
 * explicit {@link requestFocus} wins over "whatever happened to be focused",
 * because a control that reordered its own rows knows better which element the
 * caret should end up in.
 *
 * @param {() => void} render
 */
export function keepingFocus(render) {
  const active = document.activeElement;
  const requested = consumeFocusRequest();
  const focusId = requested ?? (active instanceof HTMLElement ? active.id || null : null);
  const selectionStart = !requested && active instanceof HTMLInputElement
    ? active.selectionStart
    : null;

  render();

  if (!focusId) return;
  const restored = document.getElementById(focusId);
  if (!(restored instanceof HTMLElement)) return;
  restored.focus({ preventScroll: true });
  if (restored instanceof HTMLInputElement && selectionStart !== null && restored.type !== 'number') {
    try {
      restored.setSelectionRange(selectionStart, selectionStart);
    } catch {
      // Some input types forbid selection ranges; focus alone is enough.
    }
  }
}

/** @returns {boolean} true when the visitor asked for reduced motion */
export function prefersReducedMotion() {
  return typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
