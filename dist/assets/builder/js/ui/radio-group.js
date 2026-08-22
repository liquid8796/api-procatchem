/**
 * Keyboard behaviour for button-based radio groups.
 *
 * A container with `role="radiogroup"` holding `role="radio"` buttons is only
 * correct if it also behaves like one: exactly one stop in the tab order, and
 * arrow keys moving the selection. Without this, every option is a separate tab
 * stop and assistive technology announces a group that does not work the way it
 * claims to.
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/radio/
 */

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown']);
const PREVIOUS_KEYS = new Set(['ArrowLeft', 'ArrowUp']);

/**
 * Apply roving tabindex and arrow-key navigation to a radio group.
 *
 * @param {HTMLElement} group a container with `role="radiogroup"`
 * @param {(index: number) => void} onSelect called with the chosen index
 * @returns {HTMLElement} the same group, for chaining
 */
export function wireRadioGroup(group, onSelect) {
  const options = () => /** @type {HTMLElement[]} */ (
    [...group.querySelectorAll('[role="radio"]')]
  );

  const items = options();
  const checkedIndex = Math.max(0, items.findIndex(
    (item) => item.getAttribute('aria-checked') === 'true',
  ));

  // Only the selected option is reachable with Tab; arrows move within.
  items.forEach((item, index) => {
    item.tabIndex = index === checkedIndex ? 0 : -1;
  });

  group.addEventListener('keydown', (event) => {
    const current = options();
    const index = current.indexOf(/** @type {HTMLElement} */ (event.target));
    if (index < 0) return;

    let next = -1;
    if (NEXT_KEYS.has(event.key)) next = (index + 1) % current.length;
    else if (PREVIOUS_KEYS.has(event.key)) next = (index - 1 + current.length) % current.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = current.length - 1;
    else return;

    event.preventDefault();
    // Focus first so the caller may re-render without losing the caret.
    current[next].focus();
    onSelect(next);
  });

  return group;
}
