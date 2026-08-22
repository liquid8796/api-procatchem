/**
 * Declarative form controls.
 *
 * A panel describes what it needs as a list of field descriptors; this module
 * turns each descriptor into a control bound to a path in the {@link Store}.
 * Adding a new option to the builder is therefore a one-line change in a panel,
 * not a new block of DOM code.
 *
 * Supported `type` values: `text`, `number`, `select`, `segmented`, `toggle`,
 * `chips`, `ballLadder`, `textList`, `stopList`, `conditionTree`, and `ruleList`.
 */

import { STOP_MOUNT_MODES, STOP_TERRAINS, splitList, toNullableInt } from '../domain/config.js';
import { renderConditionTree } from './condition-editor.js';
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
    case 'conditionTree': return renderConditionField(field, store);
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
    field.label ? h('label.field-label', { for: control.id || undefined, text: field.label }) : null,
    control,
    field.hint ? h('p.field-hint', { text: field.hint }) : null,
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
    placeholder: field.placeholder ?? '',
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
    placeholder: field.placeholder ?? '',
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
    return h('option', { value, selected: value === current, text: option.label });
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

  const group = h('div.segmented', { role: 'radiogroup', 'aria-label': field.label ?? '' },
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
        title: option.hint ?? '',
        onClick: () => select(index),
      }, [
        h('span.seg-label', { text: option.label }),
        option.hint ? h('span.seg-hint', { text: option.hint }) : null,
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
        h('span.toggle-label', { text: field.label ?? '' }),
        field.hint ? h('span.toggle-hint', { text: field.hint }) : null,
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
    placeholder: values.length ? '' : (field.placeholder ?? 'Type and press Enter'),
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
        'aria-label': `Remove ${value}`,
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
  const update = (next) => store.setIn(field.path, next);
  const rowId = (index) => `${idFor(field.path)}-row-${index}`;

  const rows = values.map((value, index) => h('div.list-row', {}, [
    h('span.ladder-rank', { text: String(index + 1) }),
    h('input.input', {
      id: rowId(index),
      type: 'text',
      value,
      placeholder: field.placeholder ?? '',
      'aria-label': `${field.label ?? 'Entry'} ${index + 1}`,
      onInput: (event) => update(values.map((entry, i) => (i === index ? event.target.value : entry))),
    }),
    h('button.icon-btn.icon-btn-danger', {
      type: 'button', text: '×', title: 'Remove',
      'aria-label': `Remove entry ${index + 1}`,
      onClick: () => {
        const next = values.filter((_, i) => i !== index);
        if (next.length) requestFocus(rowId(Math.min(index, next.length - 1)));
        update(next);
      },
    }),
  ]));

  return wrap(field, h('div.list-rows', {}, [
    ...rows,
    h('button.btn.btn-ghost.cond-mini', {
      type: 'button',
      text: field.addLabel ?? '+ Add',
      onClick: () => {
        requestFocus(rowId(values.length));
        update([...values, '']);
      },
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
  const update = (next) => store.setIn(field.path, next);
  const patchAt = (index, patch) => update(
    stops.map((stop, i) => (i === index ? { ...stop, ...patch } : stop)),
  );
  const rowId = (index) => `${idFor(field.path)}-map-${index}`;

  const rows = stops.map((stop, index) => h('div.stop-row', {}, [
    h('input.input', {
      id: rowId(index),
      type: 'text',
      value: stop.map,
      placeholder: 'Viridian City',
      'aria-label': `Stop ${index + 1} map`,
      onInput: (event) => patchAt(index, { map: event.target.value }),
    }),
    h('select.input.select', {
      'aria-label': `Stop ${index + 1} mount`,
      onChange: (event) => patchAt(index, { mount: event.target.value }),
    }, STOP_MOUNT_MODES.map((mode) => h('option', {
      value: mode.id, selected: mode.id === stop.mount, text: mode.label,
    }))),
    h('select.input.select', {
      'aria-label': `Stop ${index + 1} terrain`,
      onChange: (event) => patchAt(index, { terrain: event.target.value }),
    }, STOP_TERRAINS.map((mode) => h('option', {
      value: mode.id, selected: mode.id === stop.terrain, text: mode.label,
    }))),
    h('button.icon-btn.icon-btn-danger', {
      type: 'button', text: '×', title: 'Remove',
      'aria-label': `Remove stop ${index + 1}`,
      onClick: () => update(stops.filter((_, i) => i !== index)),
    }),
  ]));

  return wrap(field, h('div.list-rows', {}, [
    ...rows,
    h('button.btn.btn-ghost.cond-mini', {
      type: 'button',
      text: '+ Add a stop',
      onClick: () => {
        requestFocus(rowId(stops.length));
        update([...stops, { map: '', mount: 'auto', terrain: 'any' }]);
      },
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
function renderRuleField(field, store) {
  const list = renderRuleList(store.getIn(field.path) ?? [], (next) => store.setIn(field.path, next));
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
  const update = (next) => store.setIn(field.path, next);
  const replaceAt = (index, patch) => update(
    balls.map((ball, i) => (i === index ? { ...ball, ...patch } : ball)),
  );
  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= balls.length) return;
    const next = balls.slice();
    [next[index], next[target]] = [next[target], next[index]];
    // Follow the ball to its new row, so a second press moves the same ball
    // again rather than whatever slid into the old position.
    requestFocus(rowId(target, delta < 0 ? 'up' : 'down'));
    update(next);
  };
  const removeAt = (index) => {
    const next = balls.filter((_, i) => i !== index);
    if (next.length) requestFocus(rowId(Math.min(index, next.length - 1), 'remove'));
    update(next);
  };

  const rows = balls.map((ball, index) => h('div.ladder-row', {}, [
    h('span.ladder-rank', { text: String(index + 1) }),
    h('input.input.ladder-item', {
      id: rowId(index, 'item'),
      type: 'text',
      value: ball.item,
      placeholder: 'Ultra Ball',
      'aria-label': `Ball ${index + 1} name`,
      onInput: (event) => replaceAt(index, { item: event.target.value }),
    }),
    h('select.input.select.ladder-when', {
      id: rowId(index, 'when'),
      'aria-label': `Ball ${index + 1} condition`,
      onChange: (event) => replaceAt(index, { condition: event.target.value }),
    }, field.options.map((option) => h('option', {
      value: option.id,
      selected: option.id === ball.condition,
      text: option.label,
    }))),
    h('div.ladder-tools', {}, [
      h('button.icon-btn', {
        id: rowId(index, 'up'),
        type: 'button', text: '▲', title: 'Move up',
        'aria-label': `Move ball ${index + 1} up`,
        disabled: index === 0,
        onClick: () => move(index, -1),
      }),
      h('button.icon-btn', {
        id: rowId(index, 'down'),
        type: 'button', text: '▼', title: 'Move down',
        'aria-label': `Move ball ${index + 1} down`,
        disabled: index === balls.length - 1,
        onClick: () => move(index, 1),
      }),
      h('button.icon-btn.icon-btn-danger', {
        id: rowId(index, 'remove'),
        type: 'button', text: '×', title: 'Remove',
        'aria-label': `Remove ball ${index + 1}`,
        onClick: () => removeAt(index),
      }),
    ]),
  ]));

  const ladder = h('div.ladder', {}, [
    ...(rows.length ? rows : [h('p.field-hint.ladder-empty', {
      text: 'No balls yet — the script will have nothing to throw.',
    })]),
    h('button.btn.btn-ghost.ladder-add', {
      type: 'button',
      text: '+ Add a ball',
      onClick: () => update([...balls, { item: '', condition: 'always' }]),
    }),
  ]);

  return wrap(field, ladder);
}
