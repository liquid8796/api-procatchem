/**
 * Editor for the battle rules list.
 *
 * A rule is a name, a match condition, an ordered list of steps, and a
 * fallback. Steps show only the inputs their action needs, which keeps a long
 * rule readable.
 */

import { t } from '../core/i18n.js';
import { apiEntry } from '../domain/api-catalog.js';
import {
  CHAIN_ACTIONS,
  GROUP_ACTION,
  RULE_FALLBACKS,
  STEP_ACTIONS,
  createChainLink,
  createEmptyRule,
  createStep,
  splitList,
} from '../domain/config.js';
import { apiDatalistId } from './api-datalist.js';
import { renderConditionTree } from './condition-editor.js';
import { h } from './dom.js';

/** Which extra inputs each action shows, keyed by action id. */
const ACTION_NEEDS = new Map(STEP_ACTIONS.map((entry) => [entry.id, entry.needs]));
/** What each chain link needs typing in next to it. */
const CHAIN_NEEDS = new Map(CHAIN_ACTIONS.map((entry) => [entry.id, entry]));

/**
 * Actions that always end the turn, so "once per battle" would be meaningless —
 * and a group, whose children carry their own flags.
 */
const NO_ONCE_ACTIONS = new Set([GROUP_ACTION, 'stopBot', 'logout']);

/** How deep the editor lets groups nest before it stops offering another. */
const MAX_GROUP_DEPTH = 3;

/**
 * @param {object[]} rules the rules to draw
 * @param {(updater: (live: object[]) => object[]) => void} update applies a
 *   change to the *current* list, not to the snapshot this render captured
 * @returns {HTMLElement}
 */
export function renderRuleList(rules, update) {
  const replaceAt = (index, next) => update(
    (live) => live.map((rule, i) => (i === index ? next : rule)),
  );
  const removeAt = (index) => update((live) => live.filter((_, i) => i !== index));
  const move = (index, delta) => update((live) => {
    const target = index + delta;
    if (target < 0 || target >= live.length) return live;
    const next = live.slice();
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  return h('div.rules', {}, [
    ...(rules.length
      ? rules.map((rule, index) => renderRule(rule, index, rules.length, {
        onChange: (next) => replaceAt(index, next),
        onRemove: () => removeAt(index),
        onMove: (delta) => move(index, delta),
      }))
      : [h('p.field-hint', { text: t('No rules yet — the script will not act on wild encounters.') })]),
    h('button.btn.btn-ghost', {
      type: 'button',
      text: t('+ Add a rule'),
      onClick: () => update((live) => [...live, createEmptyRule()]),
    }),
  ]);
}

/**
 * @param {object} rule
 * @param {number} index
 * @param {number} total
 * @param {{ onChange: (next: object) => void, onRemove: () => void, onMove: (delta: number) => void }} handlers
 * @returns {HTMLElement}
 */
function renderRule(rule, index, total, handlers) {
  const update = (patch) => handlers.onChange({ ...rule, ...patch });

  return h('article.rule', {}, [
    h('header.rule-head', {}, [
      h('span.rule-rank', { text: String(index + 1) }),
      h('input.input.rule-name', {
        type: 'text',
        value: rule.label ?? '',
        placeholder: t('Rule name'),
        'aria-label': t('Rule {n} name', { n: index + 1 }),
        onInput: (event) => update({ label: event.target.value }),
      }),
      h('div.ladder-tools', {}, [
        h('button.icon-btn', {
          type: 'button', text: '▲', title: t('Move up'),
          'aria-label': t('Move rule {n} up', { n: index + 1 }),
          disabled: index === 0,
          onClick: () => handlers.onMove(-1),
        }),
        h('button.icon-btn', {
          type: 'button', text: '▼', title: t('Move down'),
          'aria-label': t('Move rule {n} down', { n: index + 1 }),
          disabled: index === total - 1,
          onClick: () => handlers.onMove(1),
        }),
        h('button.icon-btn.icon-btn-danger', {
          type: 'button', text: '×', title: t('Remove this rule'),
          'aria-label': t('Remove rule {n}', { n: index + 1 }),
          onClick: handlers.onRemove,
        }),
      ]),
    ]),

    h('div.rule-body', {}, [
      renderConditionTree(rule.match, (next) => update({ match: next }), { label: t('Applies when') }),

      h('div.rule-steps', {}, [
        h('p.field-label', { text: t('Steps, in order') }),
        renderStepList(rule.steps, (next) => update({ steps: next }), 0),
      ]),

      h('div.field', {}, [
        h('label.field-label', { text: t('When every step declines') }),
        h('select.input.select', {
          onChange: (event) => update({ fallback: event.target.value }),
        }, RULE_FALLBACKS.map((entry) => h('option', {
          value: entry.id,
          selected: entry.id === rule.fallback,
          text: `${t(entry.label)} — ${t(entry.hint)}`,
        }))),
      ]),
    ]),
  ]);
}

/**
 * An ordered list of steps, with the add button underneath.
 *
 * Groups hold their own list, so this renders itself recursively; `depth` only
 * controls how much further nesting is offered.
 *
 * @param {object[]} steps
 * @param {(next: object[]) => void} onChange
 * @param {number} depth
 * @returns {HTMLElement}
 */
function renderStepList(steps, onChange, depth) {
  const list = Array.isArray(steps) ? steps : [];
  const replaceAt = (index, next) => onChange(list.map((step, i) => (i === index ? next : step)));
  const removeAt = (index) => onChange(list.filter((_, i) => i !== index));
  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const next = list.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return h('div.step-list', {}, [
    ...list.map((step, index) => renderStep(step, index, list.length, depth, {
      onChange: (next) => replaceAt(index, next),
      onRemove: () => removeAt(index),
      onMove: (delta) => move(index, delta),
    })),
    h('button.btn.btn-ghost.cond-mini', {
      type: 'button',
      text: t('+ Add a step'),
      onClick: () => onChange([...list, createStep()]),
    }),
  ]);
}

/**
 * @param {object} step
 * @param {number} index
 * @param {number} total
 * @param {number} depth
 * @param {{ onChange: (next: object) => void, onRemove: () => void, onMove: (delta: number) => void }} handlers
 * @returns {HTMLElement}
 */
function renderStep(step, index, total, depth, handlers) {
  const update = (patch) => handlers.onChange({ ...step, ...patch });
  const needs = ACTION_NEEDS.get(step.action) ?? [];
  const isGroup = step.action === GROUP_ACTION;

  return h('div.step', { class: isGroup ? 'step-group' : '' }, [
    h('div.step-head', {}, [
      h('span.step-rank', { text: `${index + 1}` }),
      h('select.input.select.step-action', {
        'aria-label': t('Step {n} action', { n: index + 1 }),
        onChange: (event) => update({ action: event.target.value }),
      }, STEP_ACTIONS
        // Offering a group at the limit would produce one nothing can go into.
        .filter((entry) => entry.id !== GROUP_ACTION || depth < MAX_GROUP_DEPTH || isGroup)
        .map((entry) => h('option', {
          value: entry.id,
          selected: entry.id === step.action,
          text: t(entry.label),
        }))),
      ...needs.map((need) => renderStepInput(need, step, update, index)),
      NO_ONCE_ACTIONS.has(step.action) ? null : h('label.step-once', {
        title: t('Run this step at most once per battle'),
      }, [
        h('input', {
          type: 'checkbox',
          checked: Boolean(step.once),
          'aria-label': t('Step {n} runs once per battle', { n: index + 1 }),
          onChange: (event) => update({ once: event.target.checked }),
        }),
        h('span', { text: t('once') }),
      ]),
      h('div.ladder-tools', {}, [
        h('button.icon-btn', {
          type: 'button', text: '▲', title: t('Move up'),
          'aria-label': t('Move step {n} up', { n: index + 1 }),
          disabled: index === 0,
          onClick: () => handlers.onMove(-1),
        }),
        h('button.icon-btn', {
          type: 'button', text: '▼', title: t('Move down'),
          'aria-label': t('Move step {n} down', { n: index + 1 }),
          disabled: index === total - 1,
          onClick: () => handlers.onMove(1),
        }),
        h('button.icon-btn.icon-btn-danger', {
          type: 'button', text: '×', title: t('Remove'),
          'aria-label': t('Remove step {n}', { n: index + 1 }),
          onClick: handlers.onRemove,
        }),
      ]),
    ]),
    renderConditionTree(step.when, (next) => update({ when: next }), {
      label: isGroup ? t('Enter the group when') : t('Only when'),
      depth: 1,
    }),
    step.action === 'chain'
      ? renderChainEditor(step.chain, (next) => update({ chain: next }), index)
      : null,
    isGroup
      ? h('div.step-children', {}, [
        renderStepList(step.steps, (next) => update({ steps: next }), depth + 1),
      ])
      : null,
  ]);
}

/**
 * The `a() or b() or c()` ladder of a chain step.
 *
 * @param {Array<{ action: string, value: string }>} chain
 * @param {(next: Array<{ action: string, value: string }>) => void} onChange
 * @param {number} stepIndex
 * @returns {HTMLElement}
 */
function renderChainEditor(chain, onChange, stepIndex) {
  const links = Array.isArray(chain) ? chain : [];
  const replaceAt = (index, patch) => onChange(
    links.map((link, i) => (i === index ? { ...link, ...patch } : link)),
  );
  const removeAt = (index) => onChange(links.filter((_, i) => i !== index));
  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= links.length) return;
    const next = links.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return h('div.chain', {}, [
    h('p.field-hint', {
      text: t('Tried left to right; the first one that manages to act ends the turn.'),
    }),
    ...links.map((link, index) => {
      const spec = CHAIN_NEEDS.get(link.action);
      return h('div.chain-link', {}, [
        h('span.chain-rank', { text: `${index + 1}` }),
        h('select.input.select', {
          'aria-label': t('Step {step} chain link {n}', { step: stepIndex + 1, n: index + 1 }),
          onChange: (event) => replaceAt(index, { action: event.target.value }),
        }, CHAIN_ACTIONS.map((entry) => h('option', {
          value: entry.id,
          selected: entry.id === link.action,
          text: t(entry.label),
        }))),
        spec && spec.needs !== 'none' ? h('input.input.chain-value', {
          type: spec.needs === 'number' ? 'number' : 'text',
          value: link.value ?? '',
          placeholder: spec.placeholder ?? '',
          'aria-label': t('{label} value', { label: t(spec.label) }),
          onInput: (event) => replaceAt(index, { value: event.target.value }),
        }) : null,
        h('div.ladder-tools', {}, [
          h('button.icon-btn', {
            type: 'button', text: '◀', title: t('Move earlier'),
            'aria-label': t('Move link {n} earlier', { n: index + 1 }),
            disabled: index === 0,
            onClick: () => move(index, -1),
          }),
          h('button.icon-btn', {
            type: 'button', text: '▶', title: t('Move later'),
            'aria-label': t('Move link {n} later', { n: index + 1 }),
            disabled: index === links.length - 1,
            onClick: () => move(index, 1),
          }),
          h('button.icon-btn.icon-btn-danger', {
            type: 'button', text: '×', title: t('Remove'),
            'aria-label': t('Remove link {n}', { n: index + 1 }),
            onClick: () => removeAt(index),
          }),
        ]),
      ]);
    }),
    h('button.btn.btn-ghost.cond-mini', {
      type: 'button',
      text: t('+ Add a fallback'),
      onClick: () => onChange([...links, createChainLink()]),
    }),
  ]);
}

/**
 * The action-specific input for a step.
 *
 * @param {string} need
 * @param {object} step
 * @param {(patch: object) => void} update
 * @param {number} index
 * @returns {HTMLElement | null}
 */
function renderStepInput(need, step, update, index) {
  switch (need) {
    case 'move':
      return h('input.input.step-input', {
        type: 'text',
        value: step.move ?? '',
        placeholder: t('Move name'),
        'aria-label': t('Step {n} move', { n: index + 1 }),
        onInput: (event) => update({ move: event.target.value }),
      });

    case 'slot':
      return h('select.input.select.step-slot', {
        'aria-label': t('Step {n} slot', { n: index + 1 }),
        title: t('Which team member uses the move'),
        onChange: (event) => {
          const value = event.target.value;
          update({ slot: value === 'auto' ? 'auto' : Number.parseInt(value, 10) });
        },
      }, [
        h('option', { value: 'auto', selected: step.slot === 'auto', text: t('any slot') }),
        ...[1, 2, 3, 4, 5, 6].map((slot) => h('option', {
          value: String(slot),
          selected: step.slot === slot,
          text: t('slot {n}', { n: slot }),
        })),
      ]);

    case 'slotNumber':
      return h('select.input.select.step-slot', {
        'aria-label': t('Step {n} slot', { n: index + 1 }),
        onChange: (event) => update({ slotNumber: Number.parseInt(event.target.value, 10) }),
      }, [1, 2, 3, 4, 5, 6].map((slot) => h('option', {
        value: String(slot),
        selected: step.slotNumber === slot,
        text: t('slot {n}', { n: slot }),
      })));

    case 'item':
      return h('input.input.step-input', {
        type: 'text',
        value: step.item ?? '',
        placeholder: t('Item name'),
        'aria-label': t('Step {n} item', { n: index + 1 }),
        onInput: (event) => update({ item: event.target.value }),
      });

    case 'balls':
      return h('input.input.step-input.step-wide', {
        type: 'text',
        value: Array.isArray(step.balls) ? step.balls.join(', ') : '',
        placeholder: 'Ultra Ball, Great Ball, Pokeball',
        'aria-label': t('Step {n} balls', { n: index + 1 }),
        title: t('Thrown top to bottom until one is used'),
        onChange: (event) => update({ balls: splitList(event.target.value) }),
      });

    case 'expr':
      return h('input.input.step-input.step-wide', {
        type: 'text',
        value: step.expr ?? '',
        placeholder: 'useItem("Repel")',
        'aria-label': t('Step {n} Lua', { n: index + 1 }),
        title: t('Emitted verbatim; anything it calls is checked against the API'),
        onInput: (event) => update({ expr: event.target.value }),
      });

    case 'fn': {
      const entry = apiEntry(step.fn ?? '');
      return h('input.input.step-input', {
        type: 'text',
        value: step.fn ?? '',
        list: apiDatalistId(),
        placeholder: 'useItem',
        'aria-label': t('Step {n} function', { n: index + 1 }),
        title: entry ? entry.signature : t('Any function from the API reference'),
        onChange: (event) => update({ fn: event.target.value.trim() }),
      });
    }

    case 'args':
      return h('input.input.step-input.step-wide', {
        type: 'text',
        value: step.args ?? '',
        placeholder: '"Repel"',
        'aria-label': t('Step {n} arguments', { n: index + 1 }),
        title: t('Lua syntax — quote every text value'),
        onInput: (event) => update({ args: event.target.value }),
      });

    case 'message':
      return h('input.input.step-input.step-wide', {
        type: 'text',
        value: step.message ?? '',
        placeholder: t('Why the script is stopping'),
        'aria-label': t('Step {n} message', { n: index + 1 }),
        onInput: (event) => update({ message: event.target.value }),
      });

    default:
      return null;
  }
}
