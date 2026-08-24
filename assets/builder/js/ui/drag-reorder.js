/**
 * Drag-to-reorder for an ordered list of rows.
 *
 * The arrow buttons stay: they are how the list is reordered from the keyboard,
 * and dragging is not available to everyone. This adds the pointer gesture on
 * top, because a ball ladder is easier to think about by moving a row than by
 * pressing "up" four times.
 *
 * Rows opt in by carrying `data-row` with their index; the handle is any
 * element inside the row with `data-drag-handle`.
 */

/** Set while a drag is in flight, so `dragover` knows what is moving. */
const DRAG_TYPE = 'application/x-procatchem-row';

/**
 * @param {HTMLElement} container the element holding the rows
 * @param {(from: number, to: number) => void} onReorder
 */
export function makeReorderable(container, onReorder) {
  /** @type {number | null} */
  let dragging = null;

  container.addEventListener('dragstart', (event) => {
    const handle = event.target instanceof Element ? event.target.closest('[data-drag-handle]') : null;
    const row = rowOf(event.target);
    if (!handle || !row) return;

    dragging = Number(row.dataset.row);
    row.classList.add('is-dragging');
    // Some browsers refuse to start a drag without data on the transfer.
    event.dataTransfer?.setData(DRAG_TYPE, String(dragging));
    event.dataTransfer?.setData('text/plain', String(dragging));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  });

  container.addEventListener('dragover', (event) => {
    if (dragging === null) return;
    const row = rowOf(event.target);
    if (!row) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    markTarget(container, row);
  });

  container.addEventListener('drop', (event) => {
    if (dragging === null) return;
    const row = rowOf(event.target);
    if (!row) return;
    event.preventDefault();
    const to = Number(row.dataset.row);
    const from = dragging;
    finish(container);
    dragging = null;
    if (Number.isInteger(from) && Number.isInteger(to) && from !== to) onReorder(from, to);
  });

  // A drag can end anywhere — outside the list, or on Escape. Clean up either way.
  container.addEventListener('dragend', () => {
    finish(container);
    dragging = null;
  });
}

/**
 * @param {EventTarget | null} target
 * @returns {HTMLElement | null}
 */
function rowOf(target) {
  return target instanceof Element ? /** @type {HTMLElement | null} */ (target.closest('[data-row]')) : null;
}

/**
 * @param {HTMLElement} container
 * @param {HTMLElement} row
 */
function markTarget(container, row) {
  for (const other of container.querySelectorAll('.is-drop-target')) {
    other.classList.remove('is-drop-target');
  }
  if (!row.classList.contains('is-dragging')) row.classList.add('is-drop-target');
}

/** @param {HTMLElement} container */
function finish(container) {
  for (const row of container.querySelectorAll('.is-dragging, .is-drop-target')) {
    row.classList.remove('is-dragging', 'is-drop-target');
  }
}

/**
 * Move one entry of a list to another position.
 *
 * @template T
 * @param {T[]} list
 * @param {number} from
 * @param {number} to
 * @returns {T[]} a new list; the original when the move is a no-op
 */
export function moveEntry(list, from, to) {
  if (from === to) return list;
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return list;
  const next = list.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
