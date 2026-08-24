/**
 * Editor for preparation moves (Soak, Skill Swap, Thief, …).
 *
 * Each row is one move plus the trigger that decides when it is worth a turn.
 * Only the inputs the chosen trigger needs are shown, so a row stays readable.
 * Presets exist because these moves are used for a handful of well-known
 * reasons, and typing the trigger out every time is friction for no benefit.
 */

import { t } from '../core/i18n.js';
import {
  HELPER_PRESETS,
  HELPER_TRIGGERS,
  createHelperMove,
  splitList,
} from '../domain/config.js';
import { h, requestFocus } from './dom.js';

/** Which inputs each trigger needs, keyed by trigger id. */
const TRIGGER_NEEDS = new Map(HELPER_TRIGGERS.map((entry) => [entry.id, entry.needs]));

/**
 * @param {object[]} helpers the rows to draw
 * @param {(updater: (live: object[]) => object[]) => void} update applies a
 *   change to the *current* list, not to the snapshot this render captured
 * @param {string} idPrefix
 * @returns {HTMLElement}
 */
export function renderHelperMoves(helpers, update, idPrefix) {
  const rowId = (index, part) => `${idPrefix}-${part}-${index}`;
  const patchAt = (index, patch) => update(
    (live) => live.map((helper, i) => (i === index ? { ...helper, ...patch } : helper)),
  );
  const removeAt = (index) => update((live) => live.filter((_, i) => i !== index));
  const add = (overrides) => update((live) => {
    requestFocus(rowId(live.length, 'move'));
    return [...live, createHelperMove(overrides)];
  });

  const rows = helpers.map((helper, index) => {
    const needs = TRIGGER_NEEDS.get(helper.trigger) ?? [];
    return h('div.helper-row', {}, [
      h('input.input.helper-move', {
        id: rowId(index, 'move'),
        type: 'text',
        value: helper.move,
        placeholder: 'Soak',
        'aria-label': t('Preparation move {n}', { n: index + 1 }),
        onInput: (event) => patchAt(index, { move: event.target.value }),
      }),
      h('select.input.select.helper-when', {
        'aria-label': t('Move {n} trigger', { n: index + 1 }),
        onChange: (event) => patchAt(index, { trigger: event.target.value }),
      }, HELPER_TRIGGERS.map((entry) => h('option', {
        value: entry.id,
        selected: entry.id === helper.trigger,
        text: t(entry.label),
      }))),
      ...needs.map((need) => renderTriggerInput(need, helper, index, patchAt, rowId)),
      h('button.icon-btn.icon-btn-danger', {
        type: 'button', text: '×', title: t('Remove'),
        'aria-label': t('Remove preparation move {n}', { n: index + 1 }),
        onClick: () => removeAt(index),
      }),
    ]);
  });

  return h('div.helpers', {}, [
    ...rows,
    h('div.helper-add', {}, [
      h('button.btn.btn-ghost.cond-mini', {
        type: 'button',
        text: t('+ Add a move'),
        onClick: () => add({}),
      }),
      ...HELPER_PRESETS.map((preset) => h('button.btn.btn-ghost.cond-mini.helper-preset', {
        type: 'button',
        text: preset.move,
        title: t(preset.hint),
        onClick: () => add({
          move: preset.move,
          trigger: preset.trigger,
          type: preset.type ?? '',
        }),
      })),
    ]),
  ]);
}

/**
 * @param {string} need
 * @param {object} helper
 * @param {number} index
 * @param {(index: number, patch: object) => void} patchAt
 * @param {(index: number, part: string) => string} rowId
 * @returns {HTMLElement | null}
 */
function renderTriggerInput(need, helper, index, patchAt, rowId) {
  switch (need) {
    case 'type':
      return h('input.input.helper-arg', {
        id: rowId(index, 'type'),
        type: 'text',
        value: helper.type,
        placeholder: 'Ghost',
        'aria-label': t('Move {n} opponent type', { n: index + 1 }),
        onInput: (event) => patchAt(index, { type: event.target.value }),
      });

    case 'names':
      return h('input.input.helper-arg.helper-wide', {
        id: rowId(index, 'names'),
        type: 'text',
        value: helper.names.join(', '),
        placeholder: 'Gastly, Haunter',
        'aria-label': t('Move {n} opponent names', { n: index + 1 }),
        onChange: (event) => patchAt(index, { names: splitList(event.target.value) }),
      });

    case 'slot':
      return h('select.input.select.helper-slot', {
        'aria-label': t('Move {n} slot', { n: index + 1 }),
        onChange: (event) => patchAt(index, { slot: Number.parseInt(event.target.value, 10) }),
      }, [1, 2, 3, 4, 5, 6].map((slot) => h('option', {
        value: String(slot),
        selected: helper.slot === slot,
        text: t('slot {n}', { n: slot }),
      })));

    case 'ability':
      return h('input.input.helper-arg', {
        id: rowId(index, 'ability'),
        type: 'text',
        value: helper.ability,
        placeholder: 'Trace',
        'aria-label': t('Move {n} ability', { n: index + 1 }),
        onInput: (event) => patchAt(index, { ability: event.target.value }),
      });

    default:
      return null;
  }
}
