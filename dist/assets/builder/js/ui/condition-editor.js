/**
 * Recursive editor for condition trees.
 *
 * Unlike the path-bound controls in `fields.js`, this editor is callback-based:
 * a tree can be nested arbitrarily deep and lives inside arrays, so addressing
 * a node by a dotted store path would be unreadable. The editor is handed a
 * node and an `onChange`, and hands back a whole new node — the caller decides
 * where to store it.
 */

import { t } from '../core/i18n.js';
import { apiEntry } from '../domain/api-catalog.js';
import { COMPARATORS, CONDITION_KINDS, createLeaf, emptyGroup, isGroup } from '../domain/condition.js';
import { EV_STATS, splitList } from '../domain/config.js';
import { apiDatalistId } from './api-datalist.js';
import { h } from './dom.js';

/** Condition kinds grouped by their `group` field, for the add menu. */
function groupedKinds() {
  /** @type {Map<string, Array<{ id: string, label: string }>>} */
  const groups = new Map();
  for (const [id, spec] of Object.entries(CONDITION_KINDS)) {
    if (!groups.has(spec.group)) groups.set(spec.group, []);
    groups.get(spec.group).push({ id, label: spec.label });
  }
  return groups;
}

/**
 * Render a condition tree.
 *
 * @param {import('../domain/condition.js').ConditionNode} node
 * @param {(next: import('../domain/condition.js').ConditionNode) => void} onChange
 * @param {{ label?: string, depth?: number }} [options]
 * @returns {HTMLElement}
 */
export function renderConditionTree(node, onChange, options = {}) {
  const root = isGroup(node) ? node : emptyGroup('and');
  return renderGroup(root, onChange, options.label ?? '', options.depth ?? 0);
}

/**
 * @param {import('../domain/condition.js').ConditionGroup} group
 * @param {(next: object) => void} onChange
 * @param {string} label
 * @param {number} depth
 * @returns {HTMLElement}
 */
function renderGroup(group, onChange, label, depth) {
  const update = (patch) => onChange({ ...group, ...patch });
  const replaceItem = (index, next) => update({
    items: group.items.map((item, i) => (i === index ? next : item)),
  });
  const removeItem = (index) => update({ items: group.items.filter((_, i) => i !== index) });

  const body = h('div.cond-items', {}, group.items.length
    ? group.items.map((item, index) => renderNode(
      item,
      (next) => replaceItem(index, next),
      () => removeItem(index),
      depth + 1,
    ))
    : [h('p.cond-empty', { text: t('No conditions — this always passes.') })]);

  return h('div.cond-group', { dataset: { depth: String(depth) } }, [
    h('div.cond-head', {}, [
      label ? h('span.cond-label', { text: label }) : null,
      renderOperatorToggle(group, update),
      renderNegateToggle(group, update, t('Invert the whole group')),
      h('span.cond-spacer'),
      renderAddMenu((kind) => update({ items: [...group.items, createLeaf(kind)] })),
      h('button.btn.btn-ghost.cond-mini', {
        type: 'button',
        text: t('+ group'),
        title: t('Add a nested group'),
        onClick: () => update({ items: [...group.items, emptyGroup(group.op === 'and' ? 'or' : 'and')] }),
      }),
    ]),
    body,
  ]);
}

/**
 * @param {import('../domain/condition.js').ConditionNode} node
 * @param {(next: object) => void} onChange
 * @param {() => void} onRemove
 * @param {number} depth
 * @returns {HTMLElement}
 */
function renderNode(node, onChange, onRemove, depth) {
  if (isGroup(node)) {
    return h('div.cond-nested', {}, [
      renderGroup(node, onChange, '', depth),
      h('button.icon-btn.icon-btn-danger.cond-remove', {
        type: 'button', text: '×', title: t('Remove this group'),
        'aria-label': t('Remove this group'),
        onClick: onRemove,
      }),
    ]);
  }
  return renderLeaf(node, onChange, onRemove);
}

/**
 * @param {import('../domain/condition.js').ConditionLeaf} leaf
 * @param {(next: object) => void} onChange
 * @param {() => void} onRemove
 * @returns {HTMLElement}
 */
function renderLeaf(leaf, onChange, onRemove) {
  const spec = CONDITION_KINDS[leaf.kind];
  if (!spec) {
    return h('div.cond-leaf.cond-unknown', {}, [
      h('span', { text: t('Unknown condition "{kind}"', { kind: leaf.kind }) }),
      h('button.icon-btn.icon-btn-danger', { type: 'button', text: '×', onClick: onRemove }),
    ]);
  }

  const setParam = (key, value) => onChange({
    ...leaf,
    params: { ...leaf.params, [key]: value },
  });

  return h('div.cond-leaf', {}, [
    renderNegateToggle(leaf, (patch) => onChange({ ...leaf, ...patch }), t('Invert this condition')),
    h('span.cond-kind', { text: t(spec.label) }),
    ...spec.params.map((param) => renderParam(param, leaf.params?.[param.key], (value) => setParam(param.key, value))),
    h('span.cond-spacer'),
    h('button.icon-btn.icon-btn-danger', {
      type: 'button', text: '×', title: t('Remove'),
      'aria-label': t('Remove {name}', { name: t(spec.label) }),
      onClick: onRemove,
    }),
  ]);
}

/**
 * @param {object} group
 * @param {(patch: object) => void} update
 * @returns {HTMLElement}
 */
function renderOperatorToggle(group, update) {
  return h('div.cond-op', { role: 'group', 'aria-label': t('Combine with') }, ['and', 'or'].map((op) => h('button.cond-op-btn', {
    type: 'button',
    class: group.op === op ? 'is-active' : '',
    'aria-pressed': String(group.op === op),
    text: op.toUpperCase(),
    title: op === 'and' ? t('Every child must pass') : t('Any child may pass'),
    onClick: () => update({ op }),
  })));
}

/**
 * @param {object} node
 * @param {(patch: object) => void} update
 * @param {string} title
 * @returns {HTMLElement}
 */
function renderNegateToggle(node, update, title) {
  const on = Boolean(node.negate);
  return h('button.cond-not', {
    type: 'button',
    class: on ? 'is-active' : '',
    'aria-pressed': String(on),
    title,
    text: 'NOT',
    onClick: () => update({ negate: !on }),
  });
}

/**
 * The "add a condition" picker, grouped by area.
 *
 * @param {(kind: string) => void} onPick
 * @returns {HTMLElement}
 */
function renderAddMenu(onPick) {
  const select = h('select.input.select.cond-add', {
    'aria-label': t('Add a condition'),
    onChange: (event) => {
      const kind = event.target.value;
      event.target.value = '';
      if (kind) onPick(kind);
    },
  }, [
    h('option', { value: '', text: t('+ condition') }),
    ...[...groupedKinds()].map(([group, kinds]) => h('optgroup', { label: t(group) },
      kinds.map((kind) => h('option', { value: kind.id, text: t(kind.label) })))),
  ]);
  return select;
}

/**
 * One parameter of a leaf condition.
 *
 * @param {object} param descriptor from the condition registry
 * @param {unknown} value
 * @param {(next: unknown) => void} onChange
 * @returns {HTMLElement}
 */
function renderParam(param, value, onChange) {
  switch (param.type) {
    case 'comparator':
      return h('select.input.select.cond-param.cond-cmp', {
        'aria-label': t(param.label),
        onChange: (event) => onChange(event.target.value),
      }, COMPARATORS.map((entry) => h('option', {
        value: entry.id,
        selected: entry.id === value,
        text: entry.label,
      })));

    case 'number':
      return h('input.input.cond-param.cond-num', {
        type: 'number',
        value: value === null || value === undefined ? '' : String(value),
        min: param.min,
        max: param.max,
        'aria-label': t(param.label),
        title: t(param.label),
        onInput: (event) => {
          const parsed = Number.parseInt(event.target.value, 10);
          if (Number.isFinite(parsed)) onChange(parsed);
        },
      });

    case 'select':
      return h('select.input.select.cond-param', {
        'aria-label': t(param.label),
        onChange: (event) => onChange(event.target.value),
      }, param.options.map((option) => h('option', {
        value: option.id,
        selected: option.id === value,
        text: t(option.label),
      })));

    case 'evStat':
      return h('select.input.select.cond-param', {
        'aria-label': t(param.label),
        onChange: (event) => onChange(event.target.value),
      }, EV_STATS.map((stat) => h('option', {
        value: stat.id,
        selected: stat.id === value,
        text: t(stat.label),
      })));

    case 'apiFunction': {
      const name = String(value ?? '');
      const entry = apiEntry(name);
      return h('input.input.cond-param.cond-text.cond-fn', {
        type: 'text',
        value: name,
        list: apiDatalistId(),
        placeholder: param.placeholder ?? '',
        'aria-label': t(param.label),
        // Showing the signature on hover is what turns the datalist from a
        // guess into a reminder of what the function actually takes.
        title: entry ? entry.signature : t(param.hint ?? param.label),
        onChange: (event) => onChange(event.target.value.trim()),
      });
    }

    case 'chips':
      // A comma-separated field keeps a nested tree row compact; the model
      // still stores a real array.
      return h('input.input.cond-param.cond-text', {
        type: 'text',
        value: Array.isArray(value) ? value.join(', ') : String(value ?? ''),
        placeholder: param.placeholder ?? '',
        'aria-label': t(param.label),
        title: t(param.hint ?? param.label),
        onChange: (event) => onChange(splitList(event.target.value)),
      });

    case 'text':
    default:
      return h('input.input.cond-param.cond-text', {
        type: 'text',
        value: String(value ?? ''),
        placeholder: param.placeholder ?? '',
        'aria-label': t(param.label),
        title: t(param.hint ?? param.label),
        onChange: (event) => onChange(event.target.value),
      });
  }
}
