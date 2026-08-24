/**
 * Declarative form controls.
 *
 * A panel describes what it needs as a list of field descriptors; this module
 * turns each descriptor into a control bound to a path in the {@link Store}.
 * Adding a new option to the builder is therefore a one-line change in a panel,
 * not a new block of DOM code.
 *
 * Supported `type` values: `text`, `number`, `select`, `segmented`, `toggle`,
 * `chips`, `ballLadder`, `textList`, `stopList`, `evGoals`, `helperMoves`,
 * `conditionTree`, and `ruleList`.
 */

import { t } from '../core/i18n.js';
import {
  EV_STATS,
  STOP_MOUNT_MODES,
  STOP_TERRAINS,
  createEvGoal,
  splitList,
  toNullableInt,
} from '../domain/config.js';
import { renderConditionTree } from './condition-editor.js';
import { makeReorderable, moveEntry } from './drag-reorder.js';
import { renderHelperMoves } from './helper-moves.js';
import { renderRuleList } from './rule-editor.js';
import { h, requestFocus } from './dom.js';
import { wireRadioGroup } from './radio-group.js';

/**
 * @typedef {object} Field
 * @property {string} type
 * @property {string} [path]         dotted path into the config
 * @property {string} [label]
 * @property {string} [hint]
 * @property {string} [placeholder]
 * @property {Array<{id?: string, value?: string, label: string, hint?: string}>} [options]
 * @property {number} [min]
 * @property {number} [max]
 * @property {boolean} [nullable]    a blank number field stores null
 * @property {(config: object) => boolean} [visibleWhen]
 */

/**
 * Render one field, or null when it is hidden for the current config.
 *
 * @param {Field} field
 * @param {import('../core/store.js').Store} store
 * @returns {HTMLElement | null}
 */
export function renderField(field, store) {
  if (field.visibleWhen && !field.visibleWhen(store.state)) return null;

  switch (field.type) {
    case 'text': return renderText(field, store);
    case 'number': return renderNumber(field, store);
    case 'select': return renderSelect(field, store);
    case 'segmented': return renderSegmented(field, store);
    case 'toggle': return renderToggle(field, store);
    case 'chips': return renderChips(field, store);
    case 'ballLadder': return renderBallLadder(field, store);
    case 'textList': return renderTextList(field, store);
    case 'stopList': return renderStopList(field, store);
    case 'evGoals': return renderEvGoals(field, store);
    case 'conditionTree': return renderConditionField(field, store);
    case 'helperMoves': return renderHelperField(field, store);
    case 'ruleList': return renderRuleField(field, store);
    default: throw new Error(`Unknown field type: ${field.type}`);
  }
}

/**
 * Render a list of fields into a fragment.
 *
 * @param {Field[]} fields
 * @param {import('../core/store.js').Store} store
 * @returns {DocumentFragment}
 */
export function renderFields(fields, store) {
  const fragment = document.createDocumentFragment();
  for (const field of fields) {
    const node = renderField(field, store);
    if (node) fragment.appendChild(node);
  }
  return fragment;
}

/**
 * A labelled wrapper shared by most controls.
 *
 * @param {Field} field
 * @param {HTMLElement} control
 * @returns {HTMLElement}
 */
function wrap(field, control) {
  return h('div.field', {}, [
    field.label ? h('label.field-label', { for: control.id || undefined, text: t(field.label) }) : null,
    control,
    field.hint ? h('p.field-hint', { text: t(field.hint) }) : null,
  ]);
}

/** @param {string} path @returns {string} */
function idFor(path) {
  return `f-${String(path).replace(/\./g, '-')}`;
}

/**
 * @param {Field} field
 * @param {import('../core/store.js').Store} store
 * @returns {HTMLElement}
 */
function renderText(field, store) {
  const input = h('input.input', {
    id: idFor(field.path),
    type: 'text',
    value: String(store.getIn(field.path) ?? ''),
    placeholder: field.placeholder ? t(field.placeholder) : '',
    onInput: (event) => store.setIn(field.path, event.target.value),
  });
  return wrap(field, input);
}

/**
 * A blank value stores `null` when the field is nullable, so "no limit" is
 * distinguishable from "zero".
 *
 * @param {Field} field
 * @param {import('../core/store.js').Store} store
 * @returns {HTMLElement}
 */
function renderNumber(field, store) {
  const current = store.getIn(field.path);
  const input = h('input.input', {
    id: idFor(field.path),
    type: 'number',
    value: current === null || current === undefined ? '' : String(current),
    placeholder: field.placeholder ? t(field.placeholder) : '',
    min: field.min,
    max: field.max,
    onInput: (event) => {
      const raw = event.target.value.trim();
      if (raw === '') {
        store.setIn(field.path, field.nullable ? null : (field.min ?? 0));
        return;
      }
      const parsed = toNullableInt(raw);
      if (parsed === null) return; // Intermediate states like "-" keep the old value.
      // Only the upper bound is enforced while typing. Clamping up to `min` on
      // every keystroke would rewrite a half-typed "1" of "15" into the minimum
      // and fight the user; that check happens on blur instead.
      store.setIn(field.path, clamp(parsed, undefined, field.max));
    },
    onBlur: (event) => {
      if (event.target.value.trim() === '') return;
      const parsed = toNullableInt(event.target.value);
      if (parsed === null) return;
      store.setIn(field.path, clamp(parsed, field.min, field.max));
    },
  });
  return wrap(field, input);
}

/**
 * @param {number} value
 * @param {number} [min]
 * @param {number} [max]
 * @returns {number}
 */
function clamp(value, min, max) {
  let out = value;
  if (typeof min === 'number') out = Math.max(min, out);
  if (typeof max === 'number') out = Math.min(max, out);
  return out;
}

/**
 * @param {Field} field
 * @param {import('../core/store.js').Store} store
 * @returns {HTMLElement}
 */
function renderSelect(field, store) {
  const current = String(store.getIn(field.path) ?? '');
  const select = h('select.input.select', {
    id: idFor(field.path),
    onChange: (event) => store.setIn(field.path, event.target.value),
  }, field.options.map((option) => {
    const value = option.value ?? option.id ?? '';
    return h('option', { value, selected: value === current, text: t(option.label) });
  }));
  return wrap(field, select);
}

/**
 * A row of mutually exclusive buttons — faster to scan than a select when there
 * are three or four choices with explanations.
 *
 * @param {Field} field
 * @param {import('../core/store.js').Store} store
 * @returns {HTMLElement}
 */
function renderSegmented(field, store) {
  // Options may carry booleans (e.g. "all filters must match"), so compare by
  // string form but store the original typed value.
  const current = String(store.getIn(field.path) ?? '');
  const select = (index) => {
    const option = field.options[index];
    store.setIn(field.path, option.value ?? option.id ?? '');
  };

  const group = h('div.segmented', { role: 'radiogroup', 'aria-label': field.label ? t(field.label) : '' },
    field.options.map((option, index) => {
      const value = option.value ?? option.id ?? '';
      const active = String(value) === current;
      return h('button.seg', {
        // Stable per-option id: focus restoration after a re-render keys off it.
        id: `${idFor(field.path)}-${index}`,
        type: 'button',
        role: 'radio',
        'aria-checked': String(active),
        class: active ? 'is-active' : '',
        title: option.hint ? t(option.hint) : '',
        onClick: () => select(index),
      }, [
        h('span.seg-label', { text: t(option.label) }),
        option.hint ? h('span.seg-hint', { text: t(option.hint) }) : null,
      ]);
    }));
  wireRadioGroup(group, select);
  return wrap(field, group);
}

/**
 * @param {Field} field
 * @param {import('../core/store.js').Store} store
 * @returns {HTMLElement}
 */
function renderToggle(field, store) {
  const checked = Boolean(store.getIn(field.path));
  const input = h('input', {
    id: idFor(field.path),
    type: 'checkbox',
    checked,
    onChange: (event) => store.setIn(field.path, event.target.checked),
  });
  return h('div.field.field-toggle', {}, [
    h('label.toggle', { for: input.id }, [
      input,
      h('span.toggle-track', { 'aria-hidden': 'true' }, [h('span.toggle-thumb')]),
      h('span.toggle-text', {}, [
        h('span.toggle-label', { text: field.label ? t(field.label) : '' }),
        field.hint ? h('span.toggle-hint', { text: t(field.hint) }) : null,
      ]),
    ]),
  ]);
}

/**
 * A list of short strings entered as chips.
 *
 * Typing `Enter` or `,` commits an entry; `Backspace` on an empty input removes
 * the last one. The underlying config value stays a real array.
 *
 * @param {Field} field
 * @param {import('../core/store.js').Store} store
 * @returns {HTMLElement}
 */
function renderChips(field, store) {
  /** @type {string[]} */
  const values = store.getIn(field.path) ?? [];

  const commit = (next) => {
    // De-duplicate case-insensitively while keeping the first spelling.
    const seen = new Set();
    const cleaned = next.filter((entry) => {
      const key = entry.toLowerCase();
      if (!entry || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    store.setIn(field.path, cleaned);
  };

  const inputId = `${idFor(field.path)}-entry`;
  const input = h('input.chip-input', {
    // Stable id: adding a chip re-renders the panel, and focus is restored by id.
    id: inputId,
    type: 'text',
    placeholder: values.length ? '' : t(field.placeholder ?? 'Type and press Enter'),
    onKeydown: (event) => {
      if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault();
        const additions = splitList(event.target.value);
        event.target.value = '';
        if (additions.length) {
          requestFocus(inputId); // keep typing the next name without re-clicking
          commit([...values, ...additions]);
        }
      } else if (event.key === 'Backspace' && event.target.value === '' && values.length) {
        event.preventDefault();
        commit(values.slice(0, -1));
      }
    },
    onBlur: (event) => {
      const additions = splitList(event.target.value);
      if (additions.length) commit([...values, ...additions]);
      event.target.value = '';
    },
  });

  const box = h('div.chips', {
    onClick: (event) => {
      if (event.target === event.currentTarget) input.focus();
    },
  }, [
    ...values.map((value, index) => h('span.chip', {}, [
      h('span.chip-text', { text: value }),
      h('button.chip-x', {
        type: 'button',
        'aria-label': t('Remove {name}', { name: value }),
        text: '×',
        onClick: () => commit(values.filter((_, i) => i !== index)),
      }),
    ])),
    input,
  ]);

  return wrap(field, box);
}

/**
 * An ordered list of free-text rows — farm zones, unique ids, and anything else
 * where each entry is one short string that benefits from its own input.
 *
 * @param {Field} field
 * @param {import('../core/store.js').Store} store
 * @returns {HTMLElement}
 */
function renderTextList(field, store) {
  /** @type {string[]} */
  const values = store.getIn(field.path) ?? [];
  // Every mutation is derived from the live value, not from `values`: rendering
  // is throttled, so this closure can outlive the state it was built from.
  const update = (fn) => store.update(field.path, fn, []);
  const rowId = (index) => `${idFor(field.path)}-row-${index}`;

  const rows = values.map((value, index) => h('div.list-row', {}, [
    h('span.ladder-rank', { text: String(index + 1) }),
    h('input.input', {
      id: rowId(index),
      type: 'text',
      value,
      placeholder: field.placeholder ? t(field.placeholder) : '',
      'aria-label': `${t(field.label ?? 'Entry')} ${index + 1}`,
      onInput: (event) => update((live) => live.map((entry, i) => (i === index ? event.target.value : entry))),
    }),
    h('button.icon-btn.icon-btn-danger', {
      type: 'button', text: '×', title: t('Remove'),
      'aria-label': t('Remove entry {n}', { n: index + 1 }),
      onClick: () => update((live) => {
        const next = live.filter((_, i) => i !== index);
        if (next.length) requestFocus(rowId(Math.min(index, next.length - 1)));
        return next;
      }),
    }),
  ]));

  return wrap(field, h('div.list-rows', {}, [
    ...rows,
    h('button.btn.btn-ghost.cond-mini', {
      type: 'button',
      text: t(field.addLabel ?? '+ Add'),
      onClick: () => update((live) => {
        requestFocus(rowId(live.length));
        return [...live, ''];
      }),
    }),
  ]));
}

/**
 * Stops along a route: a map plus the mount and terrain it needs.
 *
 * @param {Field} field
 * @param {import('../core/store.js').Store} store
 * @returns {HTMLElement}
 */
function renderStopList(field, store) {
  /** @type {Array<{map: string, mount: string, terrain: string}>} */
  const stops = store.getIn(field.path) ?? [];
  const update = (fn) => store.update(field.path, fn, []);
  const patchAt = (index, patch) => update(
    (live) => live.map((stop, i) => (i === index ? { ...stop, ...patch } : stop)),
  );
  const rowId = (index) => `${idFor(field.path)}-map-${index}`;

  const rows = stops.map((stop, index) => h('div.stop-row', {}, [
    h('input.input', {
      id: rowId(index),
      type: 'text',
      value: stop.map,
      placeholder: 'Viridian City',
      'aria-label': t('Stop {n} map', { n: index + 1 }),
      onInput: (event) => patchAt(index, { map: event.target.value }),
    }),
    h('select.input.select', {
      'aria-label': t('Stop {n} mount', { n: index + 1 }),
      onChange: (event) => patchAt(index, { mount: event.target.value }),
    }, STOP_MOUNT_MODES.map((mode) => h('option', {
      value: mode.id, selected: mode.id === stop.mount, text: t(mode.label),
    }))),
    h('select.input.select', {
      'aria-label': t('Stop {n} terrain', { n: index + 1 }),
      onChange: (event) => patchAt(index, { terrain: event.target.value }),
    }, STOP_TERRAINS.map((mode) => h('option', {
      value: mode.id, selected: mode.id === stop.terrain, text: t(mode.label),
    }))),
    h('button.icon-btn.icon-btn-danger', {
      type: 'button', text: '×', title: t('Remove'),
      'aria-label': t('Remove stop {n}', { n: index + 1 }),
      onClick: () => update((live) => live.filter((_, i) => i !== index)),
    }),
  ]));

  return wrap(field, h('div.list-rows', {}, [
    ...rows,
    h('button.btn.btn-ghost.cond-mini', {
      type: 'button',
      text: t('+ Add a stop'),
      onClick: () => update((live) => {
        requestFocus(rowId(live.length));
        return [...live, { map: '', mount: 'auto', terrain: 'any' }];
      }),
    }),
  ]));
}

/**
 * The EV table: one row per Pokémon, each with its own stat and target.
 *
 * @param {Field} field
 * @param {import('../core/store.js').Store} store
 * @returns {HTMLElement}
 */
function renderEvGoals(field, store) {
  /** @type {Array<{ id: string, stat: string, target: number }>} */
  const goals = store.getIn(field.path) ?? [];
  const update = (fn) => store.update(field.path, fn, []);
  const patchAt = (index, patch) => update(
    (live) => live.map((goal, i) => (i === index ? { ...goal, ...patch } : goal)),
  );
  const rowId = (index) => `${idFor(field.path)}-uid-${index}`;

  const rows = goals.map((goal, index) => h('div.stop-row', {}, [
    h('span.ladder-rank', { text: String(index + 1) }),
    h('input.input', {
      id: rowId(index),
      type: 'text',
      value: goal.id ?? '',
      placeholder: t('unique id'),
      inputmode: 'numeric',
      'aria-label': t('Row {n} unique id', { n: index + 1 }),
      onInput: (event) => patchAt(index, { id: event.target.value }),
    }),
    h('select.input.select', {
      'aria-label': t('Row {n} stat', { n: index + 1 }),
      onChange: (event) => patchAt(index, { stat: event.target.value }),
    }, EV_STATS.map((stat) => h('option', {
      value: stat.id, selected: stat.id === goal.stat, text: t(stat.label),
    }))),
    h('input.input', {
      type: 'number',
      value: String(goal.target ?? 252),
      min: 1,
      max: 252,
      'aria-label': t('Row {n} target', { n: index + 1 }),
      onInput: (event) => {
        const parsed = Number.parseInt(event.target.value, 10);
        if (Number.isFinite(parsed)) patchAt(index, { target: parsed });
      },
    }),
    h('button.icon-btn.icon-btn-danger', {
      type: 'button', text: '×', title: t('Remove'),
      'aria-label': t('Remove row {n}', { n: index + 1 }),
      onClick: () => update((live) => live.filter((_, i) => i !== index)),
    }),
  ]));

  return wrap(field, h('div.list-rows', {}, [
    ...rows,
    h('button.btn.btn-ghost.cond-mini', {
      type: 'button',
      text: t('+ Add a Pokémon'),
      onClick: () => update((live) => {
        requestFocus(rowId(live.length));
        return [...live, createEvGoal()];
      }),
    }),
  ]));
}

/**
 * @param {Field} field
 * @param {import('../core/store.js').Store} store
 * @returns {HTMLElement}
 */
function renderConditionField(field, store) {
  const tree = renderConditionTree(
    store.getIn(field.path),
    (next) => store.setIn(field.path, next),
    { label: field.label },
  );
  // The label lives inside the tree header, so it is not repeated here.
  return wrap({ ...field, label: undefined }, tree);
}

/**
 * @param {Field} field
 * @param {import('../core/store.js').Store} store
 * @returns {HTMLElement}
 */
function renderHelperField(field, store) {
  const list = renderHelperMoves(
    store.getIn(field.path) ?? [],
    (fn) => store.update(field.path, fn, []),
    idFor(field.path),
  );
  return wrap(field, list);
}

/**
 * @param {Field} field
 * @param {import('../core/store.js').Store} store
 * @returns {HTMLElement}
 */
function renderRuleField(field, store) {
  const list = renderRuleList(
    store.getIn(field.path) ?? [],
    (fn) => store.update(field.path, fn, []),
  );
  return wrap(field, list);
}

/**
 * The ordered ball ladder: which ball to throw and when.
 *
 * @param {Field} field
 * @param {import('../core/store.js').Store} store
 * @returns {HTMLElement}
 */
function renderBallLadder(field, store) {
  /** @type {Array<{item: string, condition: string}>} */
  const balls = store.getIn(field.path) ?? [];
  const rowId = (index, part) => `${idFor(field.path)}-${part}-${index}`;
  const update = (fn) => store.update(field.path, fn, []);
  const replaceAt = (index, patch) => update(
    (live) => live.map((ball, i) => (i === index ? { ...ball, ...patch } : ball)),
  );
  const move = (index, delta) => update((live) => {
    const target = index + delta;
    if (target < 0 || target >= live.length) return live;
    const next = live.slice();
    [next[index], next[target]] = [next[target], next[index]];
    // Follow the ball to its new row, so a second press moves the same ball
    // again rather than whatever slid into the old position.
    requestFocus(rowId(target, delta < 0 ? 'up' : 'down'));
    return next;
  });
  const removeAt = (index) => update((live) => {
    const next = live.filter((_, i) => i !== index);
    if (next.length) requestFocus(rowId(Math.min(index, next.length - 1), 'remove'));
    return next;
  });

  const rows = balls.map((ball, index) => h('div.ladder-row', {
    draggable: 'true',
    dataset: { row: String(index) },
  }, [
    h('span.ladder-rank', {
      dataset: { dragHandle: 'true' },
      title: t('Drag to reorder'),
      text: String(index + 1),
    }),
    h('input.input.ladder-item', {
      id: rowId(index, 'item'),
      type: 'text',
      value: ball.item,
      placeholder: 'Ultra Ball',
      'aria-label': t('Ball {n} name', { n: index + 1 }),
      onInput: (event) => replaceAt(index, { item: event.target.value }),
    }),
    h('select.input.select.ladder-when', {
      id: rowId(index, 'when'),
      'aria-label': t('Ball {n} condition', { n: index + 1 }),
      onChange: (event) => replaceAt(index, { condition: event.target.value }),
    }, field.options.map((option) => h('option', {
      value: option.id,
      selected: option.id === ball.condition,
      text: t(option.label),
    }))),
    h('div.ladder-tools', {}, [
      h('button.icon-btn', {
        id: rowId(index, 'up'),
        type: 'button', text: '▲', title: t('Move up'),
        'aria-label': t('Move ball {n} up', { n: index + 1 }),
        disabled: index === 0,
        onClick: () => move(index, -1),
      }),
      h('button.icon-btn', {
        id: rowId(index, 'down'),
        type: 'button', text: '▼', title: t('Move down'),
        'aria-label': t('Move ball {n} down', { n: index + 1 }),
        disabled: index === balls.length - 1,
        onClick: () => move(index, 1),
      }),
      h('button.icon-btn.icon-btn-danger', {
        id: rowId(index, 'remove'),
        type: 'button', text: '×', title: t('Remove'),
        'aria-label': t('Remove ball {n}', { n: index + 1 }),
        onClick: () => removeAt(index),
      }),
    ]),
  ]));

  const ladder = h('div.ladder', {}, [
    ...(rows.length ? rows : [h('p.field-hint.ladder-empty', {
      text: t('No balls yet — the script will have nothing to throw.'),
    })]),
    h('button.btn.btn-ghost.ladder-add', {
      type: 'button',
      text: t('+ Add a ball'),
      onClick: () => update((live) => [...live, { item: '', condition: 'always' }]),
    }),
  ]);

  // Dragging complements the arrow buttons rather than replacing them: those
  // are how the ladder is reordered from the keyboard.
  makeReorderable(ladder, (from, to) => update((live) => moveEntry(live, from, to)));

  return wrap(field, ladder);
}
